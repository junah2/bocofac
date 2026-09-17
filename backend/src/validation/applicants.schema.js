const { z } = require('zod');
const { phSchema, emailSchema } = require('./auth.schema');

// A bucketed "Member's Farm Profile" value is always a short display string
// picked from a fixed option list in the frontend (e.g. '11–25', '₱50–100/kg')
// or a short free-typed date/number. We don't mirror each of the ~12 option
// lists here (that would mean keeping 12 backend enums in lockstep with
// frontend constants forever, for a field the board reads manually rather
// than a security boundary) - just cap length as a blanket abuse guard.
const farmLeaf = z.string().max(100).optional().or(z.literal(''));

const farmSectionSchema = (fields) => z.object(
  Object.fromEntries(fields.map((f) => [f, farmLeaf]))
).partial().strict();

const farmProfileSchema = z.object({
  coconut: farmSectionSchema([
    'areaHa', 'bearing', 'nonBearing', 'monthsPerHarvest',
    'aveNutsHarvest', 'lastHarvest', 'aveKopraSoldKg', 'aveHarvestCharcoal',
  ]),
  swine: farmSectionSchema(['sow', 'piglets', 'farrowingDate', 'fattening']),
  livestock: farmSectionSchema([
    'cowMale', 'cowFemale', 'goat', 'carabaoFemale', 'carabaoMale', 'others',
  ]),
  cacao: farmSectionSchema([
    'areaHaSqm', 'bearing', 'nonBearing', 'harvestCycle', 'aveNutsHarvest',
    'lastHarvest', 'totalHarvest', 'unitPrice', 'aveBeansSoldKg',
  ]),
  rice: farmSectionSchema(['areaHaSqm', 'location']),
  corn: farmSectionSchema(['areaHaSqm', 'location']),
  otherRemarks: z.string().max(1000).optional().or(z.literal('')),
  otherCrops: z.array(z.object({
    crop: z.string().min(1).max(100),
    areaHaSqm: farmLeaf,
  })).max(20).optional(),
}).partial().strict()
  // Blanket size guard against an oversized/malformed JSON blob, independent
  // of the per-field caps above.
  .refine((val) => JSON.stringify(val).length <= 20_000, {
    message: 'Farm profile data is too large.',
  });

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date.');

// Optional short free-text field, matching the paper form's open-ended
// fields (no format beyond a sane length cap).
const shortText = (max = 200) => z.string().trim().max(max).optional().nullable().or(z.literal(''));

const dependentSchema = z.object({
  name: z.string().trim().min(1, 'Dependent name is required.').max(200),
  birthdate: dateSchema.optional().nullable().or(z.literal('')),
  age: z.coerce.number().int().min(0).max(120).optional().nullable(),
  sex: z.string().max(20).optional().nullable().or(z.literal('')),
});

const boundedMoney = (max) => z.coerce.number().min(0).max(max).optional().nullable().or(z.literal(''));

const applicantCreateSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(300),
  email: emailSchema,
  phone: phSchema.optional().nullable().or(z.literal('')),
  cpNumber: phSchema.optional().nullable().or(z.literal('')),
  agriculturalType: shortText(100),
  farmSizeHectares: z.coerce.number().min(0).max(9999.99).optional().nullable().or(z.literal('')),
  address: shortText(500),
  registrationFeePaid: z.coerce.boolean().optional(),

  firstName: shortText(200),
  middleName: shortText(200),
  lastName: shortText(200),
  suffix: shortText(20),
  addressNumber: shortText(50),
  street: shortText(200),
  zone: shortText(50),
  barangay: shortText(200),
  munCity: shortText(200),
  civilStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated']).optional().nullable().or(z.literal('')),
  birthdate: dateSchema.optional().nullable().or(z.literal('')),
  birthplace: shortText(200),
  gender: z.enum(['Female', 'Male']).optional().nullable().or(z.literal('')),
  occupation: shortText(200),
  facebook: shortText(200),
  annualIncome: boundedMoney(100_000_000),
  employer: shortText(200),
  businessOwned: shortText(500),
  tin: shortText(50),
  religion: shortText(100),
  spouseContactPerson: shortText(200),
  spouseCpNumber: phSchema.optional().nullable().or(z.literal('')),
  dependents: z.array(dependentSchema).max(20).optional(),

  eduAttainment: z.enum([
    'No Formal Education', 'Elementary Level', 'Elementary Graduate',
    'High School Level', 'High School Graduate', 'Vocational',
    'College Level', 'College Graduate', 'Post Graduate',
  ]).optional().nullable().or(z.literal('')),
  educomChairperson: shortText(200),

  idType: z.enum([
    'Digital Postal ID', "Driver's License", 'GSIS E-card', 'IBP ID', 'National ID',
    'OFW ID', 'OWWA ID', 'Passport', 'Philhealth', 'PRC', 'PWD',
    "Senior Citizen's ID", 'Single Parent', 'SSS', 'TIN', "Voter's ID",
  ]).optional().nullable().or(z.literal('')),
  idNumber: shortText(100),
  idDateIssued: dateSchema.optional().nullable().or(z.literal('')),
  idPlaceIssued: shortText(200),

  subscribedShare: boundedMoney(9_999_999.99),
  paidUpCapital: boundedMoney(9_999_999.99),
  orNumber: z.string().regex(/^\d{13}$/, 'Reference number must be 13 digits.').optional().nullable().or(z.literal('')),

  farmProfile: farmProfileSchema.optional().nullable(),
});

module.exports = { applicantCreateSchema, dependentSchema, farmProfileSchema };
