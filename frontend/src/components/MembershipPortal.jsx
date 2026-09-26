import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Check,
  Calendar,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Info,
  Sparkles,
  Users,
  Landmark,
  AlertTriangle,
  X,
} from 'lucide-react';

import { downloadFile } from '../utils/downloadFile';
import { formatDate } from '../utils/formatDate';
import { getPmesDisplayStatus } from '../utils/pmesStatus';
import { isValidGcashRef13, validationBorderClass } from '../utils/validators';
import { displayApplicantStatus } from '../utils/applicantStatus';
import { Field, Section } from './ProfileField';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
// Where an in-progress, not-yet-filed application is auto-saved in the
// browser, so an applicant who leaves before finishing (e.g. no PMES
// certificate yet) can pick up where they left off instead of retyping
// everything.
// Suffixed with the signed-in account's id/email at the point of use (see
// draftStorageKey below) - never used bare, so one account's draft is never
// read back on a different account sharing the same browser.
const DRAFT_STORAGE_KEY_PREFIX = 'bocofac_membership_draft_v1:';
// Attached files (Valid ID, GCash receipt, PMES certificate) are saved
// separately from the text draft above, as base64, so a large/near-quota
// image never blocks the always-important text fields from saving. Capped
// per file so three attachments together can't blow past the browser's
// localStorage limit (~5MB on most browsers).
const DRAFT_FILES_STORAGE_KEY_PREFIX = 'bocofac_membership_draft_files_v1:';
const MAX_PERSISTABLE_FILE_BYTES = 2 * 1024 * 1024; // 2MB

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// A valid GCash/bank transfer confirmation always carries some subset of
// these words - mirrors Storefront.jsx's RECEIPT_OCR_KEYWORDS so the
// membership fee receipt gets the same content sanity check as an order
// payment receipt.
const RECEIPT_OCR_KEYWORDS = [
  'gcash', 'reference', 'ref no', 'amount', 'transaction', 'payment',
  'sent', 'transfer', 'total', 'php', 'bank', 'received',
];

// Pulls every digit run out of OCR'd receipt text, joining runs only split by
// whitespace (receipts commonly print "1234 5678 9012 3") so a reference
// number isn't missed just because the receipt grouped its digits.
function extractDigitRuns(ocrText) {
  return (ocrText.replace(/\s+/g, '').match(/\d+/g)) || [];
}

// True once a receipt has been scanned AND the typed reference number
// actually appears among its digit runs - a 13-digit value that's simply
// well-formed but absent from the receipt itself shouldn't pass as "correct".
function refNumberMatchesReceipt(digitRuns, ref) {
  if (!digitRuns || !ref) return null;
  return digitRuns.some((run) => run.includes(ref));
}

function dataURLToFile(dataURL, filename) {
  const [header, base64] = dataURL.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function computeAge(birthdateStr) {
  if (!birthdateStr) return null;
  const bd = new Date(birthdateStr);
  if (Number.isNaN(bd.getTime())) return null;
  const diffMs = Date.now() - bd.getTime();
  return Math.max(0, Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000)));
}

const inputClass = "w-full px-4 text-sm py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white";
const labelClass = "block text-xs font-semibold text-slate-500 mb-1";

// Input filters applied as-you-type so the field can never hold the wrong
// kind of value in the first place (rather than only flagging it on submit).
const digitsOnly = (value, maxLen) => value.replace(/\D/g, '').slice(0, maxLen);
// Keeps real Filipino names/places typeable (hyphens, apostrophes, periods,
// ñ) while still rejecting stray digits or symbols.
const lettersOnly = (value) => value.replace(/[^A-Za-zÀ-ÿ\s.'-]/g, '');
const alnumOnly = (value) => value.replace(/[^A-Za-z0-9\s-]/g, '');

const onDigits = (setter, maxLen) => (e) => setter(digitsOnly(e.target.value, maxLen));
const onLetters = (setter) => (e) => setter(lettersOnly(e.target.value));
const onAlnum = (setter) => (e) => setter(alnumOnly(e.target.value));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value) => EMAIL_REGEX.test(value.trim());
// Same PH mobile rule used across the app's other forms (AuthPages, backend
// phSchema): 11 digits starting with 09.
const isValidPhone = (value) => /^09\d{9}$/.test(value);

// Sourced from each ID's issuing agency (PSA/PhilSys, SSS, PhilHealth, BIR,
// LTO, DFA, GSIS, PRC) - these are the only IDs on VALID_ID_TYPES with one
// fixed, nationwide numeric format. The rest (Postal ID, IBP, OFW/OWWA, PWD,
// Senior Citizen's, Solo Parent, Voter's ID) are issued per-agency/LGU with
// no single official numbering scheme, so they're left format-free below
// rather than guessing a pattern that could wrongly reject a real ID.
const ID_FORMATS = {
  'National ID': { pattern: /^\d{4}-\d{4}-\d{4}-\d{4}$/, example: '0000-0000-0000-0000', hint: '16-digit PhilSys Card Number (PCN) printed on the PhilID.' },
  SSS: { pattern: /^\d{2}-\d{7}-\d{1}$/, example: '00-0000000-0', hint: '10-digit SSS number.' },
  Philhealth: { pattern: /^\d{2}-\d{9}-\d{1}$/, example: '00-000000000-0', hint: '12-digit PhilHealth Identification Number (PIN).' },
  TIN: { pattern: /^\d{3}-\d{3}-\d{3}(-\d{3})?$/, example: '000-000-000', hint: '9-digit TIN, plus the 3-digit branch code only if you have one.' },
  "Driver's License": { pattern: /^[A-Za-z]\d{2}-\d{2}-\d{6}$/, example: 'N01-23-456789', hint: 'LTO license number format.' },
  Passport: { pattern: /^[A-Za-z]\d{7}$/, example: 'P1234567', hint: '1 letter followed by 7 digits, as printed on the passport.' },
  'GSIS E-card': { pattern: /^\d{10}$/, example: '0000000000', hint: '10-digit GSIS BP number.' },
  PRC: { pattern: /^\d{7}$/, example: '0000000', hint: '7-digit PRC license number.' },
};
const getIdFormat = (type) => ID_FORMATS[type] || null;
const isValidIdNumber = (type, value) => {
  const fmt = getIdFormat(type);
  return fmt ? fmt.pattern.test(value.trim()) : value.trim().length >= 4;
};

// Bucketed choices for the "Member's Farm Profile" paper form - farmers pick
// a range instead of typing exact figures, matching how the paper intake is
// actually filled out in the field.
const TREE_COUNT_OPTIONS = ['0', '1–10', '11–25', '26–50', '51–100', '101–200', '200+'];
const ANIMAL_COUNT_OPTIONS = ['0', '1', '2', '3', '4', '5+'];
const SWINE_COUNT_OPTIONS = ['0', '1–2', '3–5', '6–10', '10+'];
const HARVEST_FREQUENCY_OPTIONS = ['Monthly', 'Every 2 Months', 'Quarterly', 'Semi-Annual', 'Annual'];
const COCONUT_NUTS_OPTIONS = ['Below 500', '500–1,000', '1,001–2,000', '2,001–5,000', '5,000+'];
const KOPRA_KG_OPTIONS = ['Below 50 kg', '50–100 kg', '101–200 kg', '201–500 kg', '500+ kg'];
const CHARCOAL_OPTIONS = ['None', '1–10 sacks', '11–30 sacks', '31–50 sacks', '50+ sacks'];
const CACAO_HARVEST_CYCLE_OPTIONS = ['Once a Year', 'Twice a Year', 'Continuous / Year-Round'];
const CACAO_NUTS_OPTIONS = ['Below 100', '100–300', '301–600', '601–1,000', '1,000+'];
const CACAO_HARVEST_KG_OPTIONS = ['Below 50 kg', '50–100 kg', '101–250 kg', '251–500 kg', '500+ kg'];
const UNIT_PRICE_OPTIONS = ['Below ₱50/kg', '₱50–100/kg', '₱101–150/kg', '₱151–200/kg', '₱200+/kg'];
const AREA_OPTIONS = ['Below 0.25 ha', '0.25–0.5 ha', '0.51–1 ha', '1.01–2 ha', '2+ ha'];
const EDU_ATTAINMENT_OPTIONS = [
  'No Formal Education', 'Elementary Level', 'Elementary Graduate',
  'High School Level', 'High School Graduate', 'Vocational',
  'College Level', 'College Graduate', 'Post Graduate',
];
const VEGETABLE_CROP_OPTIONS = [
  'Eggplant', 'Tomato', 'Okra', 'String Beans (Sitaw)', 'Squash (Kalabasa)',
  'Pechay', 'Ampalaya', 'Cassava', 'Banana', 'Others',
];
const VALID_ID_TYPES = [
  'Digital Postal ID', "Driver's License", 'GSIS E-card', 'IBP ID', 'National ID',
  'OFW ID', 'OWWA ID', 'Passport', 'Philhealth', 'PRC', 'PWD',
  "Senior Citizen's ID", 'Single Parent', 'SSS', 'TIN', "Voter's ID",
];

// Custom-built instead of a plain <select> - the native options popup can't
// be styled at all (font size, spacing, colors are entirely up to the
// device's own OS/browser), so on mobile it renders as an oversized,
// visually jarring list that clashes with the rest of this app's design.
// onChange still receives a { target: { value } } shape so every existing
// call site (written for a real <select>'s change event) keeps working.
function SelectField({ label, value, onChange, options, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const pick = (opt) => {
    onChange({ target: { value: opt } });
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className={labelClass}>{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left cursor-pointer focus:outline-none`}
      >
        <span className={`truncate ${value ? '' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer transition ${
                opt === value
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MembershipPortal({
  user,
  sessions,
  onSessionsRefresh,
  onAddApplicant,
  onUpdateApplicantStatus,
  onToast,
  onGoToDashboard,
  onGoHome,
}) {
  // Only 'Upcoming' seminars are ever worth showing here - a Completed/
  // Cancelled session or one whose date has already passed isn't something
  // anyone can still reserve a slot for. A session at capacity stays in the
  // list (each render site shows it as disabled/"Full") instead of vanishing,
  // so it doesn't look like the session was deleted.
  const upcomingSessions = sessions.filter(
    s => getPmesDisplayStatus(s) === 'Upcoming'
  );

  // Scoped to the signed-in account (id, falling back to email) so one
  // account's in-progress draft is never read back on a different account
  // that happens to share the same browser/device.
  const draftOwnerKey = user?.id || user?.email || 'guest';
  const draftStorageKey = `${DRAFT_STORAGE_KEY_PREFIX}${draftOwnerKey}`;
  const draftFilesStorageKey = `${DRAFT_FILES_STORAGE_KEY_PREFIX}${draftOwnerKey}`;

  // Wizard state for applicant submission
  const [wizardStep, setWizardStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Personal Data Sheet - identity
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [birthplace, setBirthplace] = useState('');
  const [gender, setGender] = useState('Female');
  const [civilStatus, setCivilStatus] = useState('Single');
  // Signed-in customers apply using their account email so the board's
  // approval step (which links members -> users by matching email) reliably
  // connects the application back to this account's dashboard.
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');

  // Step 2: Address & background
  const [addressNumber, setAddressNumber] = useState('');
  const [street, setStreet] = useState('');
  const [zone, setZone] = useState('');
  const [barangay, setBarangay] = useState('');
  const [munCity, setMunCity] = useState('');
  const [facebook, setFacebook] = useState('');
  const [occupation, setOccupation] = useState('');
  const [employer, setEmployer] = useState('');
  const [annualIncome, setAnnualIncome] = useState('');
  const [businessOwned, setBusinessOwned] = useState('');
  const [tin, setTin] = useState('');
  const [religion, setReligion] = useState('');

  // Step 3: Family & dependents
  const [spouseContactPerson, setSpouseContactPerson] = useState('');
  const [spouseCpNumber, setSpouseCpNumber] = useState('');
  const [dependents, setDependents] = useState([]);

  // Step 4: Farm specs & education (mirrors the paper "Member's Farm Profile" form)
  const [eduAttainment, setEduAttainment] = useState('');
  const emptyFarmProfile = () => ({
    coconut: { areaHa: '', bearing: '', nonBearing: '', monthsPerHarvest: '', aveNutsHarvest: '', lastHarvest: '', aveKopraSoldKg: '', aveHarvestCharcoal: '' },
    swine: { sow: '', piglets: '', farrowingDate: '', fattening: '' },
    livestock: { cowMale: '', cowFemale: '', goat: '', carabaoFemale: '', carabaoMale: '', others: '' },
    cacao: { areaHaSqm: '', bearing: '', nonBearing: '', harvestCycle: '', aveNutsHarvest: '', lastHarvest: '', totalHarvest: '', unitPrice: '', aveBeansSoldKg: '' },
    rice: { areaHaSqm: '', location: '' },
    corn: { areaHaSqm: '', location: '' },
    otherRemarks: '',
  });
  const [farmProfile, setFarmProfile] = useState(emptyFarmProfile());
  const [otherCrops, setOtherCrops] = useState([]);

  // Step 5: Documents & requirements
  const [validIdAttached, setValidIdAttached] = useState(false);
  const [validIdName, setValidIdName] = useState('');
  const [validIdFile, setValidIdFile] = useState(null);
  const [validIdPreview, setValidIdPreview] = useState('');
  const [educomChairperson, setEducomChairperson] = useState('');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idDateIssued, setIdDateIssued] = useState('');
  const [idPlaceIssued, setIdPlaceIssued] = useState('');
  const idFormat = getIdFormat(idType);

  // Step 6: Membership fee & payment
  const [regFeePaid, setRegFeePaid] = useState(false);
  const [refNum, setRefNum] = useState('');
  const [feeReceiptPreview, setFeeReceiptPreview] = useState('');
  const [feeReceiptFile, setFeeReceiptFile] = useState(null);
  const [scanningFeeReceipt, setScanningFeeReceipt] = useState(false);
  // Digit runs OCR'd off the receipt itself (see handleFeeReceiptUpload) -
  // lets the typed reference number be cross-checked against what the
  // receipt actually shows, not just its own 13-digit format.
  const [receiptDigitRuns, setReceiptDigitRuns] = useState(null);

  // Sandbox active applicant status lookups
  const [lookupEmail, setLookupEmail] = useState('');
  const [activeSearchedApplicant, setActiveSearchedApplicant] = useState(null);

  const [activePortalTab, setActivePortalTab] = useState('apply');
  const [showPmesSchedule, setShowPmesSchedule] = useState(false);

  // PMES certificate: selecting a file just previews it locally - the
  // actual upload only fires when the applicant clicks Submit.
  const [pmesCertFile, setPmesCertFile] = useState(null);
  const [pmesCertPreview, setPmesCertPreview] = useState('');
  const [submittingPmesCert, setSubmittingPmesCert] = useState(false);

  // Attached files (Valid ID, GCash receipt, PMES certificate) mirrored here
  // as base64 so the draft-save/restore effects below can persist and bring
  // them back, instead of the applicant having to re-attach every picture.
  const [persistedFiles, setPersistedFiles] = useState({});
  // Full-size preview of whichever attached image the applicant clicks on
  // (Valid ID / receipt / certificate thumbnail) in the Review step, so they
  // can double check it's the right, legible photo before filing.
  const [viewedAttachmentUrl, setViewedAttachmentUrl] = useState(null);

  // Restore a saved in-progress application (if any) once, when this page
  // first opens - so an applicant who leaves mid-form (e.g. because they
  // haven't attended PMES yet) doesn't lose everything they already typed
  // or already attached (Valid ID / GCash receipt / PMES certificate are
  // restored too, from DRAFT_FILES_STORAGE_KEY).
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;

    // One-time cleanup: an earlier version of this feature saved the draft
    // under one bare key shared by every account on the browser, so any
    // account that opened this page could see whatever the previous account
    // had typed. Remove that old shared draft so it can never leak again.
    try {
      window.localStorage.removeItem('bocofac_membership_draft_v1');
      window.localStorage.removeItem('bocofac_membership_draft_files_v1');
    } catch { /* ignore */ }

    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return;

      if (draft.firstName) setFirstName(draft.firstName);
      if (draft.middleName) setMiddleName(draft.middleName);
      if (draft.lastName) setLastName(draft.lastName);
      if (draft.suffix) setSuffix(draft.suffix);
      if (draft.birthdate) setBirthdate(draft.birthdate);
      if (draft.birthplace) setBirthplace(draft.birthplace);
      if (draft.gender) setGender(draft.gender);
      if (draft.civilStatus) setCivilStatus(draft.civilStatus);
      if (draft.email) setEmail(draft.email);
      if (draft.phone) setPhone(draft.phone);

      if (draft.addressNumber) setAddressNumber(draft.addressNumber);
      if (draft.street) setStreet(draft.street);
      if (draft.zone) setZone(draft.zone);
      if (draft.barangay) setBarangay(draft.barangay);
      if (draft.munCity) setMunCity(draft.munCity);
      if (draft.facebook) setFacebook(draft.facebook);
      if (draft.occupation) setOccupation(draft.occupation);
      if (draft.employer) setEmployer(draft.employer);
      if (draft.annualIncome !== undefined && draft.annualIncome !== '') setAnnualIncome(draft.annualIncome);
      if (draft.businessOwned) setBusinessOwned(draft.businessOwned);
      if (draft.tin) setTin(draft.tin);
      if (draft.religion) setReligion(draft.religion);

      if (draft.spouseContactPerson) setSpouseContactPerson(draft.spouseContactPerson);
      if (draft.spouseCpNumber) setSpouseCpNumber(draft.spouseCpNumber);
      if (Array.isArray(draft.dependents) && draft.dependents.length) setDependents(draft.dependents);

      if (draft.eduAttainment) setEduAttainment(draft.eduAttainment);
      if (draft.farmProfile) setFarmProfile(draft.farmProfile);
      if (Array.isArray(draft.otherCrops) && draft.otherCrops.length) setOtherCrops(draft.otherCrops);

      if (draft.educomChairperson) setEducomChairperson(draft.educomChairperson);
      if (draft.idType) setIdType(draft.idType);
      if (draft.idNumber) setIdNumber(draft.idNumber);
      if (draft.idDateIssued) setIdDateIssued(draft.idDateIssued);
      if (draft.idPlaceIssued) setIdPlaceIssued(draft.idPlaceIssued);

      if (draft.refNum) setRefNum(draft.refNum);
      if (draft.wizardStep) setWizardStep(draft.wizardStep);

      let restoredFileCount = 0;
      try {
        const rawFiles = window.localStorage.getItem(draftFilesStorageKey);
        const files = rawFiles ? JSON.parse(rawFiles) : null;
        if (files && typeof files === 'object') {
          if (files.validId?.dataUrl) {
            const file = dataURLToFile(files.validId.dataUrl, files.validId.name || 'valid-id');
            setValidIdAttached(true);
            setValidIdName(file.name);
            setValidIdFile(file);
            setValidIdPreview(files.validId.dataUrl);
            restoredFileCount++;
          }
          if (files.feeReceipt?.dataUrl) {
            const file = dataURLToFile(files.feeReceipt.dataUrl, files.feeReceipt.name || 'gcash-receipt');
            setRegFeePaid(true);
            setFeeReceiptFile(file);
            setFeeReceiptPreview(files.feeReceipt.dataUrl);
            restoredFileCount++;
          }
          if (files.pmesCert?.dataUrl) {
            const file = dataURLToFile(files.pmesCert.dataUrl, files.pmesCert.name || 'pmes-certificate');
            setPmesCertFile(file);
            setPmesCertPreview(files.pmesCert.dataUrl);
            restoredFileCount++;
          }
          setPersistedFiles(files);
        }
      } catch {
        // Corrupted/old file draft - the text fields above still restored fine.
      }

      onToast?.(
        restoredFileCount > 0
          ? 'Restored your unfinished application draft, including your attached files.'
          : 'Restored your unfinished application draft. Please re-attach any files (ID photo, receipt, certificate).',
        'success'
      );
    } catch {
      // Corrupted/old draft - ignore it rather than blocking the page.
    }
  }, []);

  // Auto-save everything typed so far (except files, which browsers won't
  // let us persist to localStorage) every time it changes, so progress isn't
  // lost if the applicant navigates away or closes the tab before filing.
  useEffect(() => {
    const hasAnyInput = firstName || lastName || phone || barangay || munCity || email !== (user?.email || '');
    if (!hasAnyInput) return;
    const draft = {
      wizardStep,
      firstName, middleName, lastName, suffix, birthdate, birthplace, gender, civilStatus, email, phone,
      addressNumber, street, zone, barangay, munCity, facebook, occupation, employer, annualIncome, businessOwned, tin, religion,
      spouseContactPerson, spouseCpNumber, dependents,
      eduAttainment, farmProfile, otherCrops,
      educomChairperson, idType, idNumber, idDateIssued, idPlaceIssued,
      refNum,
    };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Storage full or unavailable (e.g. private browsing) - draft-saving
      // is a convenience, not a requirement, so this fails silently.
    }
  }, [
    wizardStep,
    firstName, middleName, lastName, suffix, birthdate, birthplace, gender, civilStatus, email, phone,
    addressNumber, street, zone, barangay, munCity, facebook, occupation, employer, annualIncome, businessOwned, tin, religion,
    spouseContactPerson, spouseCpNumber, dependents,
    eduAttainment, farmProfile, otherCrops,
    educomChairperson, idType, idNumber, idDateIssued, idPlaceIssued,
    refNum, user,
  ]);

  // Attached files are saved to their own storage key, separately from the
  // text draft above, so a large image failing to fit in localStorage never
  // stops the (always-important) text fields from being saved.
  useEffect(() => {
    try {
      if (!persistedFiles || Object.keys(persistedFiles).length === 0) {
        window.localStorage.removeItem(draftFilesStorageKey);
        return;
      }
      window.localStorage.setItem(draftFilesStorageKey, JSON.stringify(persistedFiles));
    } catch {
      // Over quota or unavailable - the applicant just re-attaches the file(s) next time.
    }
  }, [persistedFiles, draftFilesStorageKey]);

  const addDependentRow = () => {
    setDependents(prev => [...prev, { name: '', birthdate: '', sex: 'Male' }]);
  };
  const updateDependentField = (idx, field, value) => {
    setDependents(prev => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  };
  const removeDependentRow = (idx) => {
    setDependents(prev => prev.filter((_, i) => i !== idx));
  };

  const updateFarmField = (section, field, value) => {
    setFarmProfile(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };
  const addCropRow = () => {
    setOtherCrops(prev => [...prev, { crop: '', cropOther: '', areaHaSqm: '' }]);
  };
  const updateCropField = (idx, field, value) => {
    setOtherCrops(prev => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const removeCropRow = (idx) => {
    setOtherCrops(prev => prev.filter((_, i) => i !== idx));
  };

  const rememberFileForDraft = (key, file) => {
    if (!file || file.size > MAX_PERSISTABLE_FILE_BYTES) return;
    readFileAsDataURL(file)
      .then((dataUrl) => setPersistedFiles((prev) => ({ ...prev, [key]: { dataUrl, name: file.name } })))
      .catch(() => { /* best-effort only - the file still works for this session either way */ });
  };

  const handleDocumentUpload = (docType, file) => {
    if (!file) return;
    if (docType === 'id') {
      setValidIdAttached(true);
      setValidIdName(file.name);
      setValidIdFile(file);
      setValidIdPreview(file.type === 'application/pdf' ? '' : URL.createObjectURL(file));
      rememberFileForDraft('validId', file);
    }
    onToast(`Attached: ${file.name}`, 'success');
  };

  // Same client-side OCR sanity check used at storefront checkout (see
  // Storefront.jsx's handleReceiptUpload/RECEIPT_OCR_KEYWORDS) - scans the
  // image for words any real GCash/bank confirmation would contain, so an
  // applicant can't accidentally (or otherwise) attach an unrelated photo as
  // their membership fee proof of payment.
  const handleFeeReceiptUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-picking the same file to re-trigger onChange
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onToast('Please upload an image (JPG, PNG, or WebP) of your payment receipt.', 'error');
      return;
    }

    setScanningFeeReceipt(true);
    try {
      const { default: Tesseract } = await import('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      const normalized = text.toLowerCase();
      const matchCount = RECEIPT_OCR_KEYWORDS.filter((kw) => normalized.includes(kw)).length;
      if (matchCount < 2) {
        onToast("This doesn't look like a payment receipt screenshot. Please attach the actual GCash/bank transfer confirmation.", 'error');
        return;
      }
      setReceiptDigitRuns(extractDigitRuns(text));
      setRegFeePaid(true);
      setFeeReceiptFile(file);
      setFeeReceiptPreview(URL.createObjectURL(file));
      rememberFileForDraft('feeReceipt', file);
      onToast(`Receipt "${file.name}" looks valid and is attached.`, 'success');
    } catch (err) {
      onToast('Could not scan that image - please try a clearer screenshot of the receipt.', 'error');
    } finally {
      setScanningFeeReceipt(false);
    }
  };

  const removeFeeReceipt = () => {
    setRegFeePaid(false);
    setFeeReceiptFile(null);
    setFeeReceiptPreview('');
    setReceiptDigitRuns(null);
    setPersistedFiles((prev) => { const next = { ...prev }; delete next.feeReceipt; return next; });
  };

  const resetWizard = () => {
    setWizardStep(1);
    setFirstName(''); setMiddleName(''); setLastName(''); setSuffix('');
    setBirthdate(''); setBirthplace(''); setGender('Female'); setCivilStatus('Single');
    setEmail(user?.email || ''); setPhone('');
    setAddressNumber(''); setStreet(''); setZone(''); setBarangay(''); setMunCity('');
    setFacebook(''); setOccupation(''); setEmployer(''); setAnnualIncome(''); setBusinessOwned(''); setTin(''); setReligion('');
    setSpouseContactPerson(''); setSpouseCpNumber(''); setDependents([]);
    setEduAttainment('');
    setFarmProfile(emptyFarmProfile()); setOtherCrops([]);
    setValidIdAttached(false); setValidIdFile(null); setValidIdPreview('');
    setEducomChairperson(''); setIdType(''); setIdNumber(''); setIdDateIssued(''); setIdPlaceIssued('');
    setRegFeePaid(false); setRefNum(''); setFeeReceiptPreview(''); setFeeReceiptFile(null); setReceiptDigitRuns(null);
  };

  const submitApplication = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !barangay || !munCity) {
      onToast('Please fill in essential profile and address fields.', 'error');
      return;
    }
    if (!isValidEmail(email)) {
      onToast('Please enter a valid email address (e.g., name@gmail.com).', 'error');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      onToast('Contact number must be 11 digits starting with 09 (e.g., 09171234567).', 'error');
      return;
    }
    if (spouseCpNumber && !isValidPhone(spouseCpNumber)) {
      onToast('Spouse/Contact Person CP # must be 11 digits starting with 09.', 'error');
      return;
    }
    if (idType && idNumber && !isValidIdNumber(idType, idNumber)) {
      onToast(`ID Number does not match the ${idType} format${idFormat ? ` (${idFormat.example})` : ''}.`, 'error');
      return;
    }
    if (!regFeePaid && !refNum) {
      onToast('Please attach your GCash receipt or enter the payment reference number to confirm your ₱300 membership fee payment.', 'error');
      return;
    }
    if (refNum && refNum.length !== 13) {
      onToast('Payment reference number must be exactly 13 digits.', 'error');
      return;
    }
    if (refNum && refNumberMatchesReceipt(receiptDigitRuns, refNum) === false) {
      onToast("The reference number you entered doesn't match your attached receipt. Please double-check it.", 'error');
      return;
    }
    if (!pmesCertFile) {
      onToast('Please attach your PMES Certificate before filing the application.', 'error');
      return;
    }

    const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
    const address = [
      addressNumber && `#${addressNumber}`,
      street,
      zone && `Zone ${zone}`,
      barangay,
      munCity,
    ].filter(Boolean).join(', ');

    const payload = {
      fullName, email, phone, cpNumber: phone,
      address,
      registrationFeePaid: regFeePaid,
      firstName, middleName, lastName, suffix,
      addressNumber, street, zone, barangay, munCity,
      civilStatus, birthdate: birthdate || null, birthplace, gender,
      occupation, facebook,
      annualIncome: annualIncome === '' ? null : Number(annualIncome),
      employer, businessOwned, tin, religion,
      spouseContactPerson, spouseCpNumber,
      dependents: dependents
        .filter(d => d.name)
        .map(d => ({ name: d.name, birthdate: d.birthdate || null, age: computeAge(d.birthdate), sex: d.sex })),
      eduAttainment, educomChairperson,
      idType, idNumber, idDateIssued: idDateIssued || null, idPlaceIssued,
      farmProfile: {
        ...farmProfile,
        otherCrops: otherCrops
          .filter(c => c.crop)
          .map(c => ({
            crop: c.crop === 'Others' && c.cropOther ? c.cropOther : c.crop,
            areaHaSqm: c.areaHaSqm,
          })),
      },
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/applicants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit application to the registry.');
      }
      const created = await res.json();

      const uploads = [
        validIdFile && ['valid_id', validIdFile],
        feeReceiptFile && ['registration_fee_receipt', feeReceiptFile],
        pmesCertFile && ['pmes_certificate', pmesCertFile],
      ].filter(Boolean);

      for (const [docType, file] of uploads) {
        const form = new FormData();
        form.append('docType', docType);
        form.append('email', email);
        form.append('file', file);
        await fetch(`${API_BASE}/applicants/${created.id}/documents`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
      }

      const finalApplicant = { ...created, referenceNumber: created.referenceNumber || refNum || null };
      onAddApplicant(finalApplicant);
      setActiveSearchedApplicant(finalApplicant);
      setLookupEmail(finalApplicant.email);

      resetWizard();
      try {
        window.localStorage.removeItem(draftStorageKey);
        window.localStorage.removeItem(draftFilesStorageKey);
      } catch { /* ignore */ }
      setPersistedFiles({});
      onToast('Digital Registration filed and saved to the cooperative registry! Submitted for board verification.', 'success');
      setActivePortalTab('status');
    } catch (err) {
      onToast(err.message || 'Something went wrong while filing the application.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const searchApplicantByEmail = async (emailValue) => {
    try {
      const res = await fetch(`${API_BASE}/applicants/by-email/${encodeURIComponent(emailValue.trim())}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setActiveSearchedApplicant(null);
        onToast('No membership profile matches this registered email address.', 'error');
        return;
      }
      const found = await res.json();
      setActiveSearchedApplicant(found);
      onToast(`Found membership application record for ${found.fullName}`, 'success');
    } catch {
      onToast('Could not reach the membership registry service.', 'error');
    }
  };

  const handleSearchApplicantStatus = (e) => {
    e.preventDefault();
    searchApplicantByEmail(lookupEmail);
  };

  // A guest who attended a PMES seminar as a walk-in (checked in present at
  // the venue by admin) has no applicant/member record yet, so their
  // attendance can only be recognized by matching this email against the
  // walk-in roster - same email match POST /applicants uses to auto-link
  // that attendance once they actually submit. Checking it here just lets
  // "Apply for Membership" ungate itself before that submission happens.
  const [pmesAttendanceConfirmed, setPmesAttendanceConfirmed] = useState(false);
  const checkPmesAttendance = async (emailValue) => {
    if (!emailValue || !isValidEmail(emailValue)) return;
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/attendance-check/${encodeURIComponent(emailValue.trim())}`);
      const data = res.ok ? await res.json() : { attended: false };
      setPmesAttendanceConfirmed(!!data.attended);
    } catch {
      // Best-effort - leave it ungated by this check alone if it fails.
    }
  };
  const pmesConfirmed = !!(activeSearchedApplicant?.pmesAttended || pmesAttendanceConfirmed);
  // True once a certificate is actually on file for this applicant - checked
  // both ways since the field lands under a different name depending on
  // which endpoint last populated activeSearchedApplicant (the by-email
  // lookup's reduced toPublicStatusClient vs. the full toClient the upload
  // endpoint returns).
  const pmesCertOnFile = !!(activeSearchedApplicant?.pmesCertificateAttached || activeSearchedApplicant?.documentsUploaded?.pmesCertificate);

  // Pops up once when landing on "Apply" without a confirmed PMES attendance
  // - the inline banner below says the same thing, but a popup is harder to
  // miss than a banner scrolled past. Stays dismissed until the applicant
  // switches away and back to "Apply", or their attendance status changes.
  const [pmesGateOpen, setPmesGateOpen] = useState(false);
  const [pmesGateDismissed, setPmesGateDismissed] = useState(false);
  useEffect(() => {
    setPmesGateOpen(activePortalTab === 'apply' && !pmesConfirmed && !pmesGateDismissed);
  }, [activePortalTab, pmesConfirmed, pmesGateDismissed]);
  const goToPmesSchedule = () => {
    setPmesGateDismissed(true);
    setPmesGateOpen(false);
    document.getElementById('pmes-schedule-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Signed-in customers land here already knowing their email - surface
  // their existing application status immediately instead of making them
  // retype it into the lookup form.
  useEffect(() => {
    if (user?.email) {
      setLookupEmail(user.email);
      searchApplicantByEmail(user.email);
      checkPmesAttendance(user.email);
    }
  }, [user?.email]);

  // Reservation confirmation popup (see render below) - separate from the
  // toast used for errors, since a successful reservation is worth a harder
  // to miss confirmation with the actual date/venue on it.
  const [reservedSession, setReservedSession] = useState(null);

  const registerForPmesSession = async (session) => {
    // Preferred identity: an application already on file. Otherwise, a
    // signed-in account with no application yet can still self-register -
    // PMES attendance has to happen *before* applying, so requiring an
    // application first here would be circular. A fully anonymous guest has
    // no account for the backend to attach the reservation to, so that case
    // still needs an application on file (or a look-up) first.
    const body = activeSearchedApplicant
      ? { applicantId: activeSearchedApplicant.id, email: activeSearchedApplicant.email }
      : {};
    if (!activeSearchedApplicant && !user) {
      onToast('Please sign in, or submit/look up your application first (Check Application Status tab), before reserving a PMES slot.', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/${session.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to reserve a slot for this session.');
      }
      await onSessionsRefresh?.();
      setReservedSession(session);
    } catch (err) {
      onToast(err.message || 'Could not reserve a slot for this session.', 'error');
    }
  };

  // PMES attendance is now confirmed at the session roster check-in, then
  // the certificate is sent from there (see BoardDashboardPage's PMES
  // Attendance tab) - not by this upload. This just lets the applicant keep
  // a copy of the certificate they were emailed on file.
  const uploadPmesCertificateForActiveApplicant = async (file) => {
    if (!activeSearchedApplicant) {
      onToast('Please look up or submit an active applicant profile first.', 'error');
      return;
    }
    if (!file) return;

    try {
      const form = new FormData();
      form.append('docType', 'pmes_certificate');
      form.append('email', activeSearchedApplicant.email);
      form.append('file', file);
      const res = await fetch(`${API_BASE}/applicants/${activeSearchedApplicant.id}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload PMES certificate.');
      }
      const { applicant: updated } = await res.json();

      setActiveSearchedApplicant(updated);
      onUpdateApplicantStatus(updated.id, { pmesAttended: updated.pmesAttended, status: updated.status });
      onToast('PMES certificate attached to your file.', 'success');
    } catch (err) {
      onToast(err.message || 'Could not upload PMES certificate.', 'error');
    }
  };

  // Once the board has approved this account's application, the apply/track
  // pipeline no longer applies - contribution tracking moves to the Dashboard.
  const isApprovedMember = !!user && activeSearchedApplicant?.status === 'Approved';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {pmesGateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" onClick={() => setPmesGateDismissed(true)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl max-w-sm w-full p-6 space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">You must attend a PMES seminar first</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                You need to attend a Pre-Membership Education Seminar (PMES) in person before you can apply for
                membership. Pick a schedule below, reserve a slot, attend it, and once you're checked in as present
                you'll be able to file your application.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setPmesGateDismissed(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm cursor-pointer"
              >
                Got it
              </button>
              <button
                onClick={goToPmesSchedule}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm cursor-pointer"
              >
                View PMES Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {reservedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" onClick={() => setReservedSession(null)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl max-w-sm w-full p-6 space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Slot Reserved!</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                You're booked for <span className="font-semibold text-slate-700 dark:text-slate-300">{reservedSession.title}</span> on{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(reservedSession.date)}</span>
                {reservedSession.time ? ` (${reservedSession.time})` : ''} at{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">{reservedSession.venue || 'the announced venue'}</span>.
                Your reservation is already on the cooperative's attendance roster for this session.
              </p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setReservedSession(null)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {isApprovedMember ? (
        <div className="max-w-2xl mx-auto text-center bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-10 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-800 flex items-center justify-center">
            <Landmark className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">You're Already a BOCOFAC Member</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Your membership application has been approved by the Board of Directors. Track your share capital
            contribution and payment history from your Dashboard.
          </p>
          {onGoToDashboard && (
            <button
              onClick={onGoToDashboard}
              className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer"
            >
              Go to My Dashboard
            </button>
          )}
        </div>
      ) : (
      <>
      {/* Tab Navigation header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="space-y-1 text-left">
          <p className="text-sm font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">BOCOFAC Fellowship</p>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Membership applicant Pipeline</h2>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border self-start">
          <button
            onClick={() => setActivePortalTab('apply')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activePortalTab === 'apply' ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-sm' : 'text-slate-500'
            }`}
          >
            1. Apply Online
          </button>
          <button
            onClick={() => setActivePortalTab('status')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activePortalTab === 'status' ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-sm' : 'text-slate-500'
            }`}
          >
            2. Check Application Status
          </button>
        </div>
      </div>

      {activePortalTab === 'apply' && !pmesConfirmed && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-bold mb-1">You must attend a PMES seminar first</p>
          <p>
            You need to attend a Pre-Membership Education Seminar (PMES) in person before you can apply for
            membership. Reserve a slot from the "Upcoming PMES Seminars" panel on the right, attend it, and once
            you're checked in as present you'll be able to file your application.
          </p>
        </div>
      )}

      {activePortalTab === 'apply' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Main Onboarding Wizard Form */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
                Cooperative Registrar Portal
              </h3>
              <p className="text-xs text-slate-400 font-mono">STEP {wizardStep} of 7</p>
            </div>

            {/* Step Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 text-center text-[10px] font-bold">
              <div onClick={() => setWizardStep(1)} className={`py-2 rounded-lg cursor-pointer transition ${wizardStep >= 1 ? 'bg-emerald-800 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>Personal</div>
              <div onClick={() => { if (firstName) setWizardStep(2); }} className={`py-2 rounded-lg cursor-pointer transition ${wizardStep >= 2 ? 'bg-emerald-800 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>Address</div>
              <div onClick={() => { if (firstName) setWizardStep(3); }} className={`py-2 rounded-lg cursor-pointer transition ${wizardStep >= 3 ? 'bg-emerald-800 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>Family</div>
              <div onClick={() => { if (firstName) setWizardStep(4); }} className={`py-2 rounded-lg cursor-pointer transition ${wizardStep >= 4 ? 'bg-emerald-800 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>Farm/Edu</div>
              <div onClick={() => { if (firstName) setWizardStep(5); }} className={`py-2 rounded-lg cursor-pointer transition ${wizardStep >= 5 ? 'bg-emerald-800 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>Requirements</div>
              <div onClick={() => { if (firstName) setWizardStep(6); }} className={`py-2 rounded-lg cursor-pointer transition ${wizardStep >= 6 ? 'bg-emerald-800 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>Payment</div>
              <div onClick={() => { if (firstName) setWizardStep(7); }} className={`py-2 rounded-lg cursor-pointer transition ${wizardStep >= 7 ? 'bg-emerald-800 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>Review</div>
            </div>

            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/5 text-emerald-800 dark:text-emerald-400 text-xs flex gap-2 border">
                  <Info className="w-5 h-5 shrink-0" />
                  <p>Filing a membership application converts standard public buying accounts to privileged shareholder accounts, unlocking dynamic dividend-share programs.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input type="text" value={firstName} onChange={onLetters(setFirstName)} placeholder="Estela" className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Middle Name</label>
                    <input type="text" value={middleName} onChange={onLetters(setMiddleName)} placeholder="Reyes" className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Family Name</label>
                    <input type="text" value={lastName} onChange={onLetters(setLastName)} placeholder="Custodio" className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Suffix</label>
                    <input type="text" value={suffix} onChange={onLetters(setSuffix)} placeholder="Jr., Sr., III" className={inputClass}  autoComplete="off"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>Birthday</label>
                    <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className={inputClass} autoComplete="off" />
                  </div>
                  <div>
                    <label className={labelClass}>Age</label>
                    <input type="text" readOnly value={computeAge(birthdate) ?? ''} placeholder="Auto-computed" className={`${inputClass} opacity-70`}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Birthplace</label>
                    <input type="text" value={birthplace} onChange={onLetters(setBirthplace)} placeholder="Naga City" className={inputClass}  autoComplete="off"/>
                  </div>
                  <SelectField label="Gender" value={gender} onChange={(e) => setGender(e.target.value)} options={['Female', 'Male']} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField
                    label="Civil Status"
                    value={civilStatus}
                    onChange={(e) => setCivilStatus(e.target.value)}
                    options={['Single', 'Married', 'Widowed', 'Separated']}
                  />
                  <div>
                    <label className={labelClass}>CP # / Mobile Number</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      value={phone}
                      onChange={onDigits(setPhone, 11)}
                      placeholder="09171234567"
                      className={`${inputClass} ${validationBorderClass(phone, isValidPhone(phone))}`}
                     autoComplete="off"/>
                    {phone && !isValidPhone(phone) && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">Must be 11 digits starting with 09 (e.g., 09171234567).</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Active Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={(e) => !user && checkPmesAttendance(e.target.value)}
                    placeholder="estela@outlook.com"
                    readOnly={!!user}
                    className={`${inputClass} ${user ? 'opacity-70 cursor-not-allowed' : ''}`}
                    autoComplete="off"
                  />
                  {!user && email && !isValidEmail(email) && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">Invalid email format.</p>
                  )}
                  {user && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Using your account email so this application shows up in your dashboard.
                    </p>
                  )}
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      if (!firstName || !lastName || !email) {
                        onToast('Please complete name and email before moving on.', 'error');
                        return;
                      }
                      if (!isValidEmail(email)) {
                        onToast('Please enter a valid email address (e.g., name@gmail.com).', 'error');
                        return;
                      }
                      if (phone && !isValidPhone(phone)) {
                        onToast('Contact number must be 11 digits starting with 09 (e.g., 09171234567).', 'error');
                        return;
                      }
                      setWizardStep(2);
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-800 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    Address & Background <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Address #</label>
                    <input type="text" value={addressNumber} onChange={onAlnum(setAddressNumber)} className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Street</label>
                    <input type="text" value={street} onChange={onAlnum(setStreet)} className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Zone</label>
                    <input type="text" value={zone} onChange={onAlnum(setZone)} className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Barangay</label>
                    <input type="text" value={barangay} onChange={onLetters(setBarangay)} placeholder="North Villazar" className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Mun. / City</label>
                    <input type="text" value={munCity} onChange={onLetters(setMunCity)} placeholder="Sipocot" className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Facebook</label>
                    <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)} className={inputClass} autoComplete="off" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Occupation</label>
                    <input type="text" value={occupation} onChange={onLetters(setOccupation)} className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Employer</label>
                    <input type="text" value={employer} onChange={onAlnum(setEmployer)} className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Annual Income (₱)</label>
                    <input type="number" min="0" value={annualIncome} onChange={(e) => setAnnualIncome(e.target.value)} className={inputClass} autoComplete="off" />
                  </div>
                  <div>
                    <label className={labelClass}>Business owned / connected</label>
                    <input type="text" value={businessOwned} onChange={onAlnum(setBusinessOwned)} className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>TIN</label>
                    <input type="text" inputMode="numeric" maxLength={12} value={tin} onChange={onDigits(setTin, 12)} className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>Religion</label>
                    <input type="text" value={religion} onChange={onLetters(setReligion)} className={inputClass}  autoComplete="off"/>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-xs rounded-xl border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900">
                    Back to Personal
                  </button>
                  <button
                    onClick={() => {
                      if (!barangay || !munCity) {
                        onToast('Please complete Barangay and Mun./City before moving on.', 'error');
                        return;
                      }
                      setWizardStep(3);
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-800 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    Family & Dependents <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Spouse / Contact Person</label>
                    <input type="text" value={spouseContactPerson} onChange={onLetters(setSpouseContactPerson)} className={inputClass}  autoComplete="off"/>
                  </div>
                  <div>
                    <label className={labelClass}>CP #s</label>
                    <input type="tel" inputMode="numeric" maxLength={11} value={spouseCpNumber} onChange={onDigits(setSpouseCpNumber, 11)} placeholder="09171234567" className={`${inputClass} ${validationBorderClass(spouseCpNumber, isValidPhone(spouseCpNumber))}`}  autoComplete="off"/>
                    {spouseCpNumber && !isValidPhone(spouseCpNumber) && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">Must be 11 digits starting with 09.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Dependents ({dependents.length})
                    </h4>
                    <button onClick={addDependentRow} type="button" className="px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer">
                      + Add Dependent
                    </button>
                  </div>

                  {dependents.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No dependents added.</p>
                  )}

                  {dependents.map((dep, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end p-3 rounded-xl border bg-slate-50/50 dark:bg-slate-950/20">
                      <div className="col-span-2 sm:col-span-2">
                        <label className={labelClass}>Name</label>
                        <input type="text" value={dep.name} onChange={(e) => updateDependentField(idx, 'name', lettersOnly(e.target.value))} className={inputClass} autoComplete="off" />
                      </div>
                      <div>
                        <label className={labelClass}>Birthdate</label>
                        <input type="date" value={dep.birthdate} onChange={(e) => updateDependentField(idx, 'birthdate', e.target.value)} className={inputClass} autoComplete="off" />
                      </div>
                      <SelectField
                        label="Sex"
                        value={dep.sex}
                        onChange={(e) => updateDependentField(idx, 'sex', e.target.value)}
                        options={['Male', 'Female']}
                      />
                      <button
                        type="button"
                        onClick={() => removeDependentRow(idx)}
                        className="px-3 py-2.5 rounded-xl border text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4">
                  <button onClick={() => setWizardStep(2)} className="px-4 py-2 text-xs rounded-xl border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900">
                    Back to Address
                  </button>
                  <button
                    onClick={() => setWizardStep(4)}
                    className="px-5 py-2 rounded-xl bg-emerald-800 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    Farm & Education <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-emerald-500/5 text-emerald-800 dark:text-emerald-400 text-xs flex gap-2 border">
                  <Info className="w-5 h-5 shrink-0" />
                  <p>
                    The cooperative uses these details to understand the type and size of your farm/livestock - this is used to determine appropriate support (e.g. patronage refund, aid, insurance, extension services).
                    {' '}
                    <span className="font-semibold">If you don't own any particular crop or animal, just leave it blank or select "0 / None"</span> - this won't stop you from proceeding to the next step.
                  </p>
                </div>
                <div>
                  <SelectField label="Educational Attainment" value={eduAttainment} onChange={(e) => setEduAttainment(e.target.value)} options={EDU_ATTAINMENT_OPTIONS} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField label="Coconut Area (ha)" value={farmProfile.coconut.areaHa} onChange={(e) => updateFarmField('coconut', 'areaHa', e.target.value)} options={AREA_OPTIONS} />
                  <SelectField label="Coconut Bearing" value={farmProfile.coconut.bearing} onChange={(e) => updateFarmField('coconut', 'bearing', e.target.value)} options={TREE_COUNT_OPTIONS} />
                  <SelectField label="Coconut Non-Bearing" value={farmProfile.coconut.nonBearing} onChange={(e) => updateFarmField('coconut', 'nonBearing', e.target.value)} options={TREE_COUNT_OPTIONS} />
                  <SelectField label="Coconut Months / Harvest" value={farmProfile.coconut.monthsPerHarvest} onChange={(e) => updateFarmField('coconut', 'monthsPerHarvest', e.target.value)} options={HARVEST_FREQUENCY_OPTIONS} />
                  <SelectField label="Coconut Ave Nuts / Harvest" value={farmProfile.coconut.aveNutsHarvest} onChange={(e) => updateFarmField('coconut', 'aveNutsHarvest', e.target.value)} options={COCONUT_NUTS_OPTIONS} />
                  <div>
                    <label className={labelClass}>Coconut Last Harvest</label>
                    <input type="date" value={farmProfile.coconut.lastHarvest} onChange={(e) => updateFarmField('coconut', 'lastHarvest', e.target.value)} className={inputClass} autoComplete="off" />
                  </div>
                  <SelectField label="Ave Kopra Sold (kg)" value={farmProfile.coconut.aveKopraSoldKg} onChange={(e) => updateFarmField('coconut', 'aveKopraSoldKg', e.target.value)} options={KOPRA_KG_OPTIONS} />
                  <SelectField label="Ave Harvest Charcoal" value={farmProfile.coconut.aveHarvestCharcoal} onChange={(e) => updateFarmField('coconut', 'aveHarvestCharcoal', e.target.value)} options={CHARCOAL_OPTIONS} />
                  <SelectField label="Sow" value={farmProfile.swine.sow} onChange={(e) => updateFarmField('swine', 'sow', e.target.value)} options={SWINE_COUNT_OPTIONS} />
                  <SelectField label="Piglets" value={farmProfile.swine.piglets} onChange={(e) => updateFarmField('swine', 'piglets', e.target.value)} options={SWINE_COUNT_OPTIONS} />
                  <div>
                    <label className={labelClass}>Farrowing Date</label>
                    <input type="date" value={farmProfile.swine.farrowingDate} onChange={(e) => updateFarmField('swine', 'farrowingDate', e.target.value)} className={inputClass} autoComplete="off" />
                  </div>
                  <SelectField label="Fattening" value={farmProfile.swine.fattening} onChange={(e) => updateFarmField('swine', 'fattening', e.target.value)} options={SWINE_COUNT_OPTIONS} />
                  <SelectField label="Cow - Male" value={farmProfile.livestock.cowMale} onChange={(e) => updateFarmField('livestock', 'cowMale', e.target.value)} options={ANIMAL_COUNT_OPTIONS} />
                  <SelectField label="Cow - Female" value={farmProfile.livestock.cowFemale} onChange={(e) => updateFarmField('livestock', 'cowFemale', e.target.value)} options={ANIMAL_COUNT_OPTIONS} />
                  <SelectField label="Goat" value={farmProfile.livestock.goat} onChange={(e) => updateFarmField('livestock', 'goat', e.target.value)} options={ANIMAL_COUNT_OPTIONS} />
                  <SelectField label="Carabao - Female" value={farmProfile.livestock.carabaoFemale} onChange={(e) => updateFarmField('livestock', 'carabaoFemale', e.target.value)} options={ANIMAL_COUNT_OPTIONS} />
                  <SelectField label="Carabao - Male" value={farmProfile.livestock.carabaoMale} onChange={(e) => updateFarmField('livestock', 'carabaoMale', e.target.value)} options={ANIMAL_COUNT_OPTIONS} />
                  <SelectField label="Other Livestock" value={farmProfile.livestock.others} onChange={(e) => updateFarmField('livestock', 'others', e.target.value)} options={ANIMAL_COUNT_OPTIONS} />
                  <SelectField label="Cacao Area (ha/sqm)" value={farmProfile.cacao.areaHaSqm} onChange={(e) => updateFarmField('cacao', 'areaHaSqm', e.target.value)} options={AREA_OPTIONS} />
                  <SelectField label="Cacao Bearing" value={farmProfile.cacao.bearing} onChange={(e) => updateFarmField('cacao', 'bearing', e.target.value)} options={TREE_COUNT_OPTIONS} />
                  <SelectField label="Cacao Non-Bearing" value={farmProfile.cacao.nonBearing} onChange={(e) => updateFarmField('cacao', 'nonBearing', e.target.value)} options={TREE_COUNT_OPTIONS} />
                  <SelectField label="Cacao Harvest Cycle" value={farmProfile.cacao.harvestCycle} onChange={(e) => updateFarmField('cacao', 'harvestCycle', e.target.value)} options={CACAO_HARVEST_CYCLE_OPTIONS} />
                  <SelectField label="Cacao Ave Nuts / Harvest" value={farmProfile.cacao.aveNutsHarvest} onChange={(e) => updateFarmField('cacao', 'aveNutsHarvest', e.target.value)} options={CACAO_NUTS_OPTIONS} />
                  <div>
                    <label className={labelClass}>Cacao Last Harvest</label>
                    <input type="date" value={farmProfile.cacao.lastHarvest} onChange={(e) => updateFarmField('cacao', 'lastHarvest', e.target.value)} className={inputClass} autoComplete="off" />
                  </div>
                  <SelectField label="Cacao Total / Harvest" value={farmProfile.cacao.totalHarvest} onChange={(e) => updateFarmField('cacao', 'totalHarvest', e.target.value)} options={CACAO_HARVEST_KG_OPTIONS} />
                  <SelectField label="Cacao Unit Price" value={farmProfile.cacao.unitPrice} onChange={(e) => updateFarmField('cacao', 'unitPrice', e.target.value)} options={UNIT_PRICE_OPTIONS} />
                  <SelectField label="Ave Beans Sold (kg)" value={farmProfile.cacao.aveBeansSoldKg} onChange={(e) => updateFarmField('cacao', 'aveBeansSoldKg', e.target.value)} options={CACAO_HARVEST_KG_OPTIONS} />
                  <SelectField label="Rice Area (ha/sqm)" value={farmProfile.rice.areaHaSqm} onChange={(e) => updateFarmField('rice', 'areaHaSqm', e.target.value)} options={AREA_OPTIONS} />
                  <div>
                    <label className={labelClass}>Rice Location</label>
                    <input type="text" value={farmProfile.rice.location} onChange={(e) => updateFarmField('rice', 'location', e.target.value)} className={inputClass} autoComplete="off" />
                  </div>
                  <SelectField label="Corn Area (ha/sqm)" value={farmProfile.corn.areaHaSqm} onChange={(e) => updateFarmField('corn', 'areaHaSqm', e.target.value)} options={AREA_OPTIONS} />
                  <div>
                    <label className={labelClass}>Corn Location</label>
                    <input type="text" value={farmProfile.corn.location} onChange={(e) => updateFarmField('corn', 'location', e.target.value)} className={inputClass} autoComplete="off" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase text-slate-400">Vegetables & Other Crops</h4>
                    <button onClick={addCropRow} type="button" className="px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer">
                      + Add Crop
                    </button>
                  </div>

                  {otherCrops.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No other crops added.</p>
                  )}

                  {otherCrops.map((c, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end p-3 rounded-xl border bg-slate-50/50 dark:bg-slate-950/20">
                      <div className="col-span-2 sm:col-span-2">
                        <SelectField label="Crop" value={c.crop} onChange={(e) => updateCropField(idx, 'crop', e.target.value)} options={VEGETABLE_CROP_OPTIONS} />
                      </div>
                      {c.crop === 'Others' && (
                        <div>
                          <label className={labelClass}>Specify Crop</label>
                          <input type="text" value={c.cropOther} onChange={(e) => updateCropField(idx, 'cropOther', e.target.value)} className={inputClass} autoComplete="off" />
                        </div>
                      )}
                      <div>
                        <SelectField label="Area (ha/sqm)" value={c.areaHaSqm} onChange={(e) => updateCropField(idx, 'areaHaSqm', e.target.value)} options={AREA_OPTIONS} />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCropRow(idx)}
                        className="px-3 py-2.5 rounded-xl border text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <label className={labelClass}>Other Remarks</label>
                  <textarea
                    rows={3}
                    value={farmProfile.otherRemarks}
                    onChange={(e) => setFarmProfile(prev => ({ ...prev, otherRemarks: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 text-xs rounded-xl border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    Back to Family
                  </button>
                  <button
                    onClick={() => setWizardStep(5)}
                    className="px-5 py-2 rounded-xl bg-emerald-800 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    Requirements <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="space-y-5">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase text-slate-400">Requirements for Membership</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>EDUCOM Chairperson</label>
                      <input type="text" value={educomChairperson} onChange={onLetters(setEducomChairperson)} className={inputClass}  autoComplete="off"/>
                    </div>
                    <SelectField label="ID Type" value={idType} onChange={(e) => { setIdType(e.target.value); setIdNumber(''); }} options={VALID_ID_TYPES} />
                    <div>
                      <label className={labelClass}>ID #</label>
                      <input
                        type="text"
                        value={idNumber}
                        onChange={onAlnum(setIdNumber)}
                        placeholder={idFormat?.example || ''}
                        className={inputClass}
                       autoComplete="off"/>
                      {idFormat && (
                        <p className="text-[11px] text-slate-400 mt-1">Format: {idFormat.example} — {idFormat.hint}</p>
                      )}
                      {idNumber && !isValidIdNumber(idType, idNumber) && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                          {idFormat ? `Must match the ${idType} format: ${idFormat.example}` : 'Please enter a valid ID number.'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Date Issued</label>
                      <input type="date" value={idDateIssued} onChange={(e) => setIdDateIssued(e.target.value)} className={inputClass} autoComplete="off" />
                    </div>
                    <div>
                      <label className={labelClass}>Place Issued</label>
                      <input type="text" value={idPlaceIssued} onChange={onLetters(setIdPlaceIssued)} className={inputClass}  autoComplete="off"/>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400">PMES Schedule & Venue Announcements</h4>
                    <p className="text-xs text-slate-500 mt-1">Attendance is face-to-face and required before board review. See the "Upcoming PMES Seminars" panel on the right to browse dates and reserve a slot - you don't need to finish this form first, reservations just need an application on file (either already submitted, or looked up under "Check Application Status") matched by your email.</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Upload Photos</h4>
                    <p className="text-xs text-slate-500">The photo you attach should show the ID Type you selected above. Fast upload screenshots or PDFs below:</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    <div className="border border-dashed rounded-xl p-4 text-center space-y-2 hover:border-emerald-500 transition relative bg-slate-50/50 dark:bg-slate-950/20">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleDocumentUpload('id', e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      {validIdPreview ? (
                        <img src={validIdPreview} alt="Valid ID preview" className="h-20 mx-auto rounded-lg shadow-md border object-contain" />
                      ) : (
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-950 border">
                          {validIdAttached ? <Check className="w-4 h-4 text-emerald-600" /> : <Upload className="w-4 h-4 text-slate-400" />}
                        </div>
                      )}
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{idType || 'Valid Govt ID'} Photo</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{validIdAttached ? validIdName : 'Click to attach (PNG/PDF)'}</p>
                      {validIdAttached && <p className="text-[10px] text-slate-400">Click or drag again to replace</p>}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-semibold text-amber-800 dark:text-amber-400">PMES Certificate:</span> you are required to attend a face-to-face PMES seminar (see schedule above) before the Board of Directors can approve your application. The Board will confirm your attendance, and once confirmed, your certificate will be automatically emailed to you — you can then attach it under the "Check Application Status" tab.
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={() => setWizardStep(4)}
                    className="px-4 py-2 text-xs rounded-xl border hover:bg-slate-100 cursor-pointer dark:hover:bg-slate-950"
                  >
                    Back to Farm/Edu
                  </button>
                  <button
                    onClick={() => {
                      if (!validIdAttached) {
                        onToast('Please submit at least one valid identity document to proceed.', 'error');
                        return;
                      }
                      if (idType && idNumber && !isValidIdNumber(idType, idNumber)) {
                        onToast(`ID Number does not match the ${idType} format${idFormat ? ` (${idFormat.example})` : ''}.`, 'error');
                        return;
                      }
                      setWizardStep(6);
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-800 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    Membership Fees <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 6 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-2 text-left">
                  <p className="font-bold text-amber-900 dark:text-amber-400 flex items-center gap-1.5"><Landmark className="w-4 h-4" /> Membership Fee: ₱300.00</p>
                  <p className="text-slate-500">Cooperative registry fees cover digital profile validation, credentials printing, and onboarding materials logistics. Pay safely via GCash to complete registry filing.</p>
                </div>


                <div className="p-4 bg-slate-100 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-slate-600">Off-site Remittance Target (GCash)</p>
                    <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800">COOP BILLING</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-mono font-bold">0917-889-4402</p>
                      <p className="text-[10px] text-slate-400">Account Name: BOCOFAC Coop Primary</p>
                    </div>
                    {/* File chooser */}
                    <div className="relative inline-block">
                      {scanningFeeReceipt ? (
                        <div className="flex flex-col items-center gap-1 px-3 py-1.5">
                          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                          <p className="text-[10px] font-medium text-slate-500">Scanning receipt…</p>
                        </div>
                      ) : feeReceiptPreview ? (
                        <div className="text-center">
                          <img src={feeReceiptPreview} alt="Receipt preview" className="h-16 rounded-lg shadow-md border object-contain" />
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Attached: {feeReceiptFile?.name}</p>
                        </div>
                      ) : (
                        <button className="px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 transition">
                          Attach Receipt Screenshot
                        </button>
                      )}
                      {!scanningFeeReceipt && (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFeeReceiptUpload}
                          className="absolute inset-0 opacity-0 w-full cursor-pointer"
                        />
                      )}
                      {feeReceiptPreview && !scanningFeeReceipt && (
                        <button
                          type="button"
                          onClick={removeFeeReceipt}
                          title="Remove attached receipt"
                          className="absolute -top-2 -right-2 z-10 p-1 rounded-full border bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={13}
                      placeholder="Enter 13-digit payment Ref Number"
                      value={refNum}
                      onChange={onDigits(setRefNum, 13)}
                      className={`w-full px-4 text-sm py-2 rounded-lg border bg-white dark:bg-slate-950 ${validationBorderClass(refNum, isValidGcashRef13(refNum) && refNumberMatchesReceipt(receiptDigitRuns, refNum) !== false)}`}
                     autoComplete="off"/>
                    {refNum && isValidGcashRef13(refNum) && refNumberMatchesReceipt(receiptDigitRuns, refNum) === false ? (
                      <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold">
                        This doesn't match the reference number on your attached receipt. Please double-check and correct it.
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400 font-medium">
                        Warning: The reference number you entered must match the one shown in your receipt screenshot. Payment will not be accepted if they don't match.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={() => setWizardStep(5)}
                    className="px-4 py-2 text-xs rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-950 cursor-pointer"
                  >
                    Back to Requirements
                  </button>
                  <button
                    onClick={() => setWizardStep(7)}
                    disabled={scanningFeeReceipt}
                    className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center gap-1 transition shadow-lg hover:shadow-emerald-900/10 cursor-pointer"
                  >
                    Review Application <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 7 && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-emerald-500/5 text-emerald-800 dark:text-emerald-400 text-xs flex gap-2 border">
                  <Info className="w-5 h-5 shrink-0" />
                  <p>Review everything below before filing - go back to any step to fix something, or file the application if it all looks right.</p>
                </div>

                <Section title="Personal Data Sheet">
                  <Field label="First Name" value={firstName} />
                  <Field label="Middle Name" value={middleName} />
                  <Field label="Family Name" value={lastName} />
                  <Field label="Suffix" value={suffix} />
                  <Field label="Birthday" value={birthdate ? new Date(birthdate).toLocaleDateString() : null} />
                  <Field label="Birthplace" value={birthplace} />
                  <Field label="Gender" value={gender} />
                  <Field label="Civil Status" value={civilStatus} />
                  <Field label="Email" value={email} />
                  <Field label="Mobile / CP #" value={phone} />
                </Section>

                <Section title="Address & Background">
                  <Field label="Address" value={[addressNumber && `#${addressNumber}`, street, zone && `Zone ${zone}`, barangay, munCity].filter(Boolean).join(', ')} />
                  <Field label="Facebook" value={facebook} />
                  <Field label="Occupation" value={occupation} />
                  <Field label="Employer" value={employer} />
                  <Field label="Annual Income" value={annualIncome !== '' ? `₱${Number(annualIncome).toLocaleString()}` : null} />
                  <Field label="Business Owned / Connected" value={businessOwned} />
                  <Field label="TIN" value={tin} />
                  <Field label="Religion" value={religion} />
                </Section>

                <Section title="Family & Dependents">
                  <Field label="Spouse / Contact Person" value={spouseContactPerson} />
                  <Field label="CP #s" value={spouseCpNumber} />
                  <Field label="No. of Dependents" value={dependents.filter(d => d.name).length} />
                </Section>

                <Section title="Farm & Education">
                  <Field label="Educational Attainment" value={eduAttainment} />
                </Section>

                <Section title="Requirements & Documents">
                  <Field label="EDUCOM Chairperson" value={educomChairperson} />
                  <Field label="ID Type / #" value={[idType, idNumber].filter(Boolean).join(' / ')} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Valid ID Attached</p>
                    {validIdAttached ? (
                      validIdPreview ? (
                        <img
                          src={validIdPreview}
                          alt="Valid ID"
                          onClick={() => setViewedAttachmentUrl(validIdPreview)}
                          title="Click to view full size"
                          className="mt-1 h-16 rounded-lg border object-contain cursor-pointer hover:opacity-80 transition"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Yes (PDF file)</p>
                      )
                    ) : (
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Not yet</p>
                    )}
                  </div>
                </Section>

                <Section title="Payment">
                  <Field label="Membership Fee" value="₱300.00" />
                  <Field label="Reference Number" value={refNum} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Receipt Attached</p>
                    {feeReceiptFile ? (
                      feeReceiptPreview ? (
                        <img
                          src={feeReceiptPreview}
                          alt="GCash receipt"
                          onClick={() => setViewedAttachmentUrl(feeReceiptPreview)}
                          title="Click to view full size"
                          className="mt-1 h-16 rounded-lg border object-contain cursor-pointer hover:opacity-80 transition"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Yes (PDF file)</p>
                      )
                    ) : (
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Not yet</p>
                    )}
                  </div>
                </Section>

                <Section title="PMES Certificate">
                  <div className="sm:col-span-3 space-y-2">
                    {pmesCertFile ? (
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Attached: {pmesCertFile.name}
                      </p>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                          <span className="font-bold">No PMES Certificate attached yet</span> - attach the copy emailed
                          to you once the Board confirms your seminar attendance. This is required before you can
                          file the application. Don&apos;t worry, everything you&apos;ve typed in this form is saved
                          automatically on this device, so you can come back and finish once you have your
                          certificate without filling it out again.
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      {pmesCertPreview && (
                        <img src={pmesCertPreview} alt="PMES certificate preview" className="h-16 rounded-lg shadow-md border object-contain" />
                      )}
                      <div className="relative overflow-hidden inline-block">
                        <button type="button" className="px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer">
                          {pmesCertFile ? 'Replace File' : 'Attach PMES Certificate'}
                        </button>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setPmesCertFile(file);
                            setPmesCertPreview(file && file.type !== 'application/pdf' ? URL.createObjectURL(file) : '');
                            if (file) rememberFileForDraft('pmesCert', file);
                          }}
                          className="absolute inset-0 opacity-0 w-full cursor-pointer"
                        />
                      </div>
                      {pmesCertFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setPmesCertFile(null);
                            setPmesCertPreview('');
                            setPersistedFiles((prev) => { const next = { ...prev }; delete next.pmesCert; return next; });
                          }}
                          title="Remove attached certificate"
                          className="p-1.5 rounded-lg border text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </Section>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => onGoHome?.()}
                    className="px-4 py-2 text-xs rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-950 cursor-pointer"
                  >
                    Back to Home
                  </button>
                  <button
                    onClick={submitApplication}
                    disabled={submitting || !pmesCertFile}
                    title={!pmesCertFile ? 'Attach your PMES Certificate first' : undefined}
                    className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center gap-1 transition shadow-lg hover:shadow-emerald-900/10 cursor-pointer"
                  >
                    {submitting ? 'Filing...' : 'File Membership Application'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Side Info Stats */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8 text-left">
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                Who can Join BOCOFAC?
              </h4>
              <p className="text-xs line-clamp-4 text-slate-500 leading-relaxed">
                membership is open to active coconut farmers, copra producers, handicraft artisans, and organic agribusiness workers within our geographic cooperative operating zones.
              </p>
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Check className="w-4 h-4 text-emerald-600" /> 1 Vote/Member governance shares
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Check className="w-4 h-4 text-emerald-600" /> Patronage refund dividends
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Check className="w-4 h-4 text-emerald-600" /> Direct-to-coop crop selling rates
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-800 text-white space-y-2 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              <p className="text-xs font-semibold opacity-80 uppercase tracking-widest">Seminars requirement</p>
              <p className="text-base font-bold leading-tight">PMES Attendance</p>
              <p className="text-xs opacity-90 leading-relaxed">
                All candidates are required to attend one Pre-Membership Education Seminar (PMES) to verify voting understanding and financial capital covenants.
              </p>
            </div>

            {/* Always visible regardless of wizard step (or even before
                starting the form at all) - not everyone browsing seminar
                dates has decided to apply yet, and this used to only appear
                after reaching step 5 of the wizard. */}
            <div id="pmes-schedule-panel" className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                Upcoming PMES Seminars
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Reserving a slot needs an application on file, matched by your email - submit one below or look yours up under "Check Application Status" first.
              </p>
              {upcomingSessions.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No seminars scheduled yet - check back soon.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingSessions.map(session => {
                    const isFull = session.registeredCount >= session.capacity;
                    return (
                    <div key={session.id} className="border rounded-xl p-3 space-y-2 bg-slate-50/50 dark:bg-slate-950/20">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{session.title}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400" /> {formatDate(session.date)} | {session.time}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Venue:</span> {session.venue || 'BOCOFAC Cooperative Hall, Sipocot'}
                        </p>
                        <p className="text-[11px] text-slate-500">Facilitator: <span className="font-semibold text-slate-700 dark:text-slate-300">{session.speaker}</span></p>
                        <p className={`text-[11px] ${isFull ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500'}`}>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{session.registeredCount}/{session.capacity}</span> registered · {isFull ? 'Full' : `${session.capacity - session.registeredCount} slot(s) left`}
                        </p>
                      </div>
                      <div className="flex justify-end pt-1 border-t">
                        <button
                          type="button"
                          onClick={() => registerForPmesSession(session)}
                          disabled={isFull}
                          className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                        >
                          {isFull ? 'Full' : 'Reserve Slot'}
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {activePortalTab === 'status' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 sm:p-8 space-y-6 max-w-2xl mx-auto">
          <div className="space-y-1 text-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Filing Lookup & Audit Console</h3>
            <p className="text-xs text-slate-500">Provide your registered email address to check the live verification status of your membership credentials.</p>
          </div>

          <form onSubmit={handleSearchApplicantStatus} className="flex gap-2 max-w-md mx-auto">
            <input
              type="email"
              required
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              autoComplete="off"
              placeholder="e.g., estela.custodio@outlook.com"
              className="flex-1 px-4 py-2 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-semibold text-xs cursor-pointer"
            >
              Verify Profile
            </button>
          </form>

          {activeSearchedApplicant ? (
            <div className="border rounded-xl p-5 space-y-4 bg-slate-50 dark:bg-slate-950 text-left animate-in zoom-in-95">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{activeSearchedApplicant.fullName}</h4>
                  <p className="text-xs text-slate-400 font-mono">ID Reference: {activeSearchedApplicant.id}</p>
                </div>
                {/* Visual Status Badges */}
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  activeSearchedApplicant.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                  activeSearchedApplicant.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {displayApplicantStatus(activeSearchedApplicant.status)}
                </span>
              </div>

              {activeSearchedApplicant.status === 'Rejected' && activeSearchedApplicant.rejectionReason && (
                <p className="text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                  Reason: {activeSearchedApplicant.rejectionReason}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-400">Mobile hotline</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{activeSearchedApplicant.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Agricultural focus</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{activeSearchedApplicant.agriculturalType}</p>
                </div>
                <div>
                  <p className="text-slate-400">Land Area</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{activeSearchedApplicant.farmSizeHectares} Ha</p>
                </div>
                <div>
                  <p className="text-slate-400">Payment Reference</p>
                  <p className="font-mono text-emerald-700 font-bold dark:text-emerald-400">{activeSearchedApplicant.referenceNumber || 'Pending payment'}</p>
                </div>
              </div>

              {/* Personal data sheet summary, matching the paper application form */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs border-t pt-4">
                <div>
                  <p className="text-slate-400">Barangay / Mun-City</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{[activeSearchedApplicant.barangay, activeSearchedApplicant.munCity].filter(Boolean).join(', ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Civil Status</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{activeSearchedApplicant.civilStatus || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400">No. of Dependents</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{activeSearchedApplicant.noOfDependents ?? 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">ID Type / #</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{[activeSearchedApplicant.idType, activeSearchedApplicant.idNumber].filter(Boolean).join(' / ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Membership Fee</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">₱{Number(activeSearchedApplicant.membershipFee ?? 300).toFixed(2)}</p>
                </div>
              </div>

              {/* Status Stepper visualization */}
              <div className="space-y-3 pt-3 border-t">
                <p className="text-xs font-bold uppercase text-slate-400">Compliance checklist:</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-slate-500">Government KYC Identity Documents</p>
                    <span className="font-semibold text-emerald-600">Upload Verified</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-slate-500">BOCOFAC Registrar Filing Fee (₱300)</p>
                    <span className="font-semibold text-emerald-600">Remitted</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-slate-500">Pre-Membership Seminar (PMES)</p>
                    {activeSearchedApplicant.pmesAttended ? (
                      <span className="font-semibold text-emerald-600">Attended (Certificate emailed)</span>
                    ) : (
                      <span className="font-semibold text-amber-600">Pending Board Confirmation</span>
                    )}
                  </div>

                  {!activeSearchedApplicant.pmesAttended && (
                    <div className="p-3 rounded-xl border border-dashed bg-slate-50/50 dark:bg-slate-950/20 space-y-2">
                      <p className="text-[11px] text-slate-500">Haven't attended a face-to-face PMES seminar yet? Pick a schedule and reserve a slot below. The Board of Directors will confirm your attendance afterward, and your certificate will be automatically emailed to you once confirmed.</p>
                      <button
                        onClick={() => setShowPmesSchedule(v => !v)}
                        className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
                      >
                        {showPmesSchedule ? 'Hide Schedule' : 'View PMES Schedule'}
                      </button>

                      {showPmesSchedule && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {upcomingSessions.map(session => {
                            const isFull = session.registeredCount >= session.capacity;
                            return (
                            <div key={session.id} className="border rounded-xl p-3 space-y-2 bg-white dark:bg-slate-900">
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{session.title}</p>
                                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-slate-400" /> {formatDate(session.date)} | {session.time}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Venue:</span> {session.venue || 'BOCOFAC Cooperative Hall, Sipocot'}
                                </p>
                                <p className="text-[11px] text-slate-500">Facilitator: <span className="font-semibold text-slate-700 dark:text-slate-300">{session.speaker}</span></p>
                                <p className={`text-[11px] ${isFull ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500'}`}>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{session.registeredCount}/{session.capacity}</span> registered · {isFull ? 'Full' : `${session.capacity - session.registeredCount} slot(s) left`}
                                </p>
                              </div>
                              <div className="flex justify-end pt-1 border-t">
                                <button
                                  onClick={() => registerForPmesSession(session)}
                                  disabled={isFull}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                                >
                                  {isFull ? 'Full' : 'Reserve Slot'}
                                </button>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {pmesCertOnFile ? (
                    <div className="p-3 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/10 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <Check className="w-4 h-4 shrink-0" /> Your PMES Certificate is on file.
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed bg-slate-50/50 dark:bg-slate-950/20 space-y-2">
                      <p className="text-[11px] text-slate-500">
                        {activeSearchedApplicant.pmesAttended
                          ? 'Already received your PMES certificate by email? Optionally attach a copy here for your own file.'
                          : "Already attended and received your certificate by email? Optionally attach a copy here for your own file while waiting for board confirmation."}
                      </p>
                      {pmesCertPreview && (
                        <div className="text-center">
                          <img src={pmesCertPreview} alt="PMES certificate preview" className="h-24 mx-auto rounded-lg shadow-md border object-contain" />
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Attached: {pmesCertFile?.name}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="relative overflow-hidden inline-block">
                          <button type="button" className="px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer">
                            {pmesCertFile ? 'Replace File' : 'Attach PMES Certificate'}
                          </button>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setPmesCertFile(file);
                              setPmesCertPreview(file && file.type !== 'application/pdf' ? URL.createObjectURL(file) : '');
                              // Only staged locally until "Submit" below is clicked -
                              // remembering it here just means a refresh/back doesn't
                              // silently lose the pick; it never auto-uploads on its own.
                              if (file) rememberFileForDraft('pmesCert', file);
                            }}
                            className="absolute inset-0 opacity-0 w-full cursor-pointer"
                          />
                        </div>
                        {pmesCertFile && (
                          <button
                            type="button"
                            disabled={submittingPmesCert}
                            onClick={async () => {
                              setSubmittingPmesCert(true);
                              await uploadPmesCertificateForActiveApplicant(pmesCertFile);
                              setPmesCertFile(null);
                              setPmesCertPreview('');
                              setPersistedFiles((prev) => { const next = { ...prev }; delete next.pmesCert; return next; });
                              setSubmittingPmesCert(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-xs cursor-pointer"
                          >
                            {submittingPmesCert ? 'Submitting…' : 'Submit'}
                          </button>
                        )}
                        {pmesCertFile && (
                          <button
                            type="button"
                            disabled={submittingPmesCert}
                            onClick={() => {
                              setPmesCertFile(null);
                              setPmesCertPreview('');
                              setPersistedFiles((prev) => { const next = { ...prev }; delete next.pmesCert; return next; });
                            }}
                            title="Remove attached certificate"
                            className="p-1.5 rounded-lg border text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-60 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {activeSearchedApplicant.pmesAttended && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-950 text-white flex items-center justify-between mt-3">
                    <div>
                      <p className="text-xs font-semibold opacity-95">Board Review</p>
                      <p className="text-sm font-bold">Application Pending Board Approval</p>
                    </div>
                    <button
                      onClick={() => {
                        const a = activeSearchedApplicant;
                        const lines = [
                          'BOCOFAC - Membership Application Filing Summary',
                          '='.repeat(48),
                          `Application ID: ${a.id}`,
                          `Reference Number: ${a.referenceNumber || '—'}`,
                          `Status: ${displayApplicantStatus(a.status)}`,
                          `Submitted: ${a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '—'}`,
                          '',
                          `Full Name: ${a.fullName}`,
                          `Email: ${a.email}`,
                          `Phone: ${a.phone || a.cpNumber || '—'}`,
                          `Address: ${a.address || '—'}`,
                          '',
                          `Agricultural Type: ${a.agriculturalType || '—'}`,
                          `Farm Size (hectares): ${a.farmSizeHectares ?? '—'}`,
                          `PMES Attended: ${a.pmesAttended ? 'Yes' : 'No'}`,
                        ];
                        downloadFile(`bocofac-filing-summary-${a.id}.txt`, lines.join('\n'), 'text/plain');
                        onToast('Filing summary downloaded.', 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] hover:bg-amber-400 cursor-pointer"
                    >
                      Download Filing Summary
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed rounded-xl text-center space-y-2 text-slate-400">
              <FileText className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm font-semibold">No profile queried yet</p>
              <p className="text-xs max-w-xs mx-auto">Please input your registered email address or file an initial application to track verification progress.</p>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {viewedAttachmentUrl && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setViewedAttachmentUrl(null)}
        >
          <button
            onClick={() => setViewedAttachmentUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={viewedAttachmentUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
}
