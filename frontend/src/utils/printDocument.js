const COOP_NAME = 'BOCOFAC Coconut Farmers Cooperative';

const MIN_REQUIRED_SHARE_CAPITAL = 4000;
const MAX_REQUIRED_SHARE_CAPITAL = 25000;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function openPrintWindow(title, bodyHtml, { width = 480, height = 640 } = {}) {
  const win = window.open('', '_blank', `width=${width},height=${height}`);
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #0f172a; padding: 28px; }
          h1 { font-size: 16px; margin: 0 0 2px; }
          .sub { font-size: 11px; color: #64748b; margin: 0 0 18px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          td, th { padding: 6px 0; font-size: 13px; vertical-align: top; text-align: left; }
          td.label { color: #64748b; width: 42%; }
          td.value { font-weight: 600; text-align: right; }
          .divider { border-top: 1px solid #e2e8f0; margin: 14px 0; }
          .total { font-size: 15px; font-weight: 800; }
          .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
          .data-table th { font-size: 10px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          .data-table td { border-bottom: 1px solid #f1f5f9; font-size: 12px; }
          .data-table td.num, .data-table th.num { text-align: right; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; background: #f1f5f9; color: #475569; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        ${bodyHtml}
        <div class="footer">Printed ${new Date().toLocaleString('en-PH')}</div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
}

export function printOfficialReceipt(entry) {
  const rows = [
    ['OR Number', entry.orNumber || '—'],
    ['Received From', `${entry.memberName || ''} (${entry.memberId})`],
    ['Payment Date', entry.paymentDate ? new Date(entry.paymentDate).toLocaleDateString('en-PH') : '—'],
    ['Payment Method', entry.paymentMethod],
    ['Reference No.', entry.referenceId || '—'],
    ['Verified By', entry.verifiedByName || '—'],
    ['Verified On', entry.verifiedAt ? new Date(entry.verifiedAt).toLocaleDateString('en-PH') : '—'],
  ];
  const bodyHtml = `
    <h1>${COOP_NAME}</h1>
    <p class="sub">Official Receipt - Share Capital Contribution</p>
    <table>
      ${rows.map(([label, value]) => `<tr><td class="label">${label}</td><td class="value">${escapeHtml(value)}</td></tr>`).join('')}
    </table>
    <div class="divider"></div>
    <table>
      <tr><td class="label total">Amount Received</td><td class="value total">₱${Number(entry.amount).toLocaleString()}</td></tr>
    </table>
  `;
  openPrintWindow(`Official Receipt ${entry.orNumber || entry.id}`, bodyHtml);
}

export function printStatementOfAccount(member, entries) {
  const verified = entries.filter((e) => e.status === 'Verified');
  const totalPaid = verified.reduce((sum, e) => sum + Number(e.amount), 0);
  const remainingMin = Math.max(MIN_REQUIRED_SHARE_CAPITAL - totalPaid, 0);
  const remainingMax = Math.max(MAX_REQUIRED_SHARE_CAPITAL - totalPaid, 0);
  const remainingBalanceText = remainingMin === remainingMax
    ? `₱${remainingMin.toLocaleString()}`
    : `₱${remainingMin.toLocaleString()} - ₱${remainingMax.toLocaleString()}`;
  const rows = verified
    .slice()
    .sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate))
    .map((e) => `
      <tr>
        <td style="font-size:12px;padding:5px 0;">${new Date(e.paymentDate).toLocaleDateString('en-PH')}</td>
        <td style="font-size:12px;padding:5px 0;">${escapeHtml(e.orNumber || e.id)}</td>
        <td style="font-size:12px;padding:5px 0;">${escapeHtml(e.paymentMethod)}</td>
        <td style="font-size:12px;padding:5px 0;text-align:right;font-weight:600;">₱${Number(e.amount).toLocaleString()}</td>
      </tr>
    `).join('');

  const bodyHtml = `
    <h1>${COOP_NAME}</h1>
    <p class="sub">Share Capital Statement of Account</p>
    <table>
      <tr><td class="label">Shareholder</td><td class="value">${escapeHtml(member.name)}</td></tr>
      <tr><td class="label">Member ID</td><td class="value">${escapeHtml(member.id)}</td></tr>
      <tr><td class="label">Required Share Capital</td><td class="value">₱${MIN_REQUIRED_SHARE_CAPITAL.toLocaleString()} - ₱${MAX_REQUIRED_SHARE_CAPITAL.toLocaleString()}</td></tr>
    </table>
    <div class="divider"></div>
    <table>
      <thead>
        <tr>
          <td style="font-size:10px;color:#94a3b8;text-transform:uppercase;">Date</td>
          <td style="font-size:10px;color:#94a3b8;text-transform:uppercase;">OR #</td>
          <td style="font-size:10px;color:#94a3b8;text-transform:uppercase;">Method</td>
          <td style="font-size:10px;color:#94a3b8;text-transform:uppercase;text-align:right;">Amount</td>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="4" style="font-size:12px;color:#94a3b8;padding:10px 0;">No verified payments yet.</td></tr>'}
      </tbody>
    </table>
    <div class="divider"></div>
    <table>
      <tr><td class="label total">Total Verified Contribution</td><td class="value total">₱${totalPaid.toLocaleString()}</td></tr>
      <tr><td class="label">Remaining Balance</td><td class="value">${remainingBalanceText}</td></tr>
    </table>
  `;
  openPrintWindow(`Statement of Account - ${member.name}`, bodyHtml);
}

export function printSalesReport(orders) {
  const realized = orders
    .slice()
    .sort((a, b) => new Date(b.orderedAt) - new Date(a.orderedAt));
  const totalSales = realized.reduce((sum, o) => sum + o.totalAmount, 0);

  const rows = realized.map((o) => `
    <tr>
      <td>${o.orderedAt ? new Date(o.orderedAt).toLocaleDateString('en-PH') : '—'}</td>
      <td>${escapeHtml(o.id)}</td>
      <td>${escapeHtml(o.buyerName || '—')}</td>
      <td>${escapeHtml(o.paymentMethod || '—')}</td>
      <td><span class="badge">${escapeHtml(o.status)}</span></td>
      <td class="num">₱${Number(o.totalAmount).toLocaleString()}</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <h1>${COOP_NAME}</h1>
    <p class="sub">Sales Report</p>
    <table>
      <tr><td class="label">Total Verified Revenue</td><td class="value total">₱${totalSales.toLocaleString()}</td></tr>
      <tr><td class="label">Orders Counted</td><td class="value">${realized.length}</td></tr>
    </table>
    <div class="divider"></div>
    <table class="data-table">
      <thead>
        <tr><th>Date</th><th>Order</th><th>Buyer</th><th>Payment</th><th>Status</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6" style="font-size:12px;color:#94a3b8;padding:10px 0;">No orders to report.</td></tr>'}
      </tbody>
    </table>
  `;
  openPrintWindow('Sales Report', bodyHtml, { width: 720, height: 800 });
}

export function printMembershipReport(members, pendingApplicants = 0) {
  const sorted = members
    .slice()
    .sort((a, b) => new Date(b.joinedDate) - new Date(a.joinedDate));
  const activeCount = members.filter((m) => m.status === 'Active').length;

  const rows = sorted.map((m) => `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.email || '—')}</td>
      <td>${m.joinedDate ? new Date(m.joinedDate).toLocaleDateString('en-PH') : '—'}</td>
      <td><span class="badge">${escapeHtml(m.status)}</span></td>
    </tr>
  `).join('');

  const bodyHtml = `
    <h1>${COOP_NAME}</h1>
    <p class="sub">Membership Report</p>
    <table>
      <tr><td class="label">Total Members</td><td class="value total">${members.length}</td></tr>
      <tr><td class="label">Active Members</td><td class="value">${activeCount}</td></tr>
      <tr><td class="label">Pending Applications</td><td class="value">${pendingApplicants}</td></tr>
    </table>
    <div class="divider"></div>
    <table class="data-table">
      <thead>
        <tr><th>Member</th><th>Email</th><th>Joined</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="4" style="font-size:12px;color:#94a3b8;padding:10px 0;">No members to report.</td></tr>'}
      </tbody>
    </table>
  `;
  openPrintWindow('Membership Report', bodyHtml, { width: 640, height: 800 });
}

export function printInventoryReport(products, lowStockThreshold = 20) {
  const sorted = products.slice().sort((a, b) => a.stock - b.stock);
  const lowStockCount = products.filter((p) => p.stock < lowStockThreshold).length;

  const rows = sorted.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category || '—')}</td>
      <td class="num">₱${Number(p.price).toLocaleString()}</td>
      <td class="num" style="${p.stock < lowStockThreshold ? 'color:#e11d48;font-weight:700;' : ''}">${p.stock} ${escapeHtml(p.unit || '')}</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <h1>${COOP_NAME}</h1>
    <p class="sub">Inventory Report</p>
    <table>
      <tr><td class="label">Total Products</td><td class="value total">${products.length}</td></tr>
      <tr><td class="label">Below ${lowStockThreshold} Units</td><td class="value">${lowStockCount}</td></tr>
    </table>
    <div class="divider"></div>
    <table class="data-table">
      <thead>
        <tr><th>Product</th><th>Category</th><th class="num">Price</th><th class="num">Stock</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="4" style="font-size:12px;color:#94a3b8;padding:10px 0;">No products to report.</td></tr>'}
      </tbody>
    </table>
  `;
  openPrintWindow('Inventory Report', bodyHtml, { width: 640, height: 800 });
}

// [MEMBERSHIP] Membership Application Form (A4). Walang data = blangkong form na susulatan sa papel;
// may data = ang form na may impormasyong inilagay ng applicant.
const APPLICATION_GENDERS = ['Male', 'Female'];
const APPLICATION_CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated'];
const APPLICATION_EDUCATION = [
  'No Formal Education', 'Elementary Level', 'Elementary Graduate',
  'High School Level', 'High School Graduate', 'Vocational',
  'College Level', 'College Graduate', 'Post Graduate',
];
const MEMBERSHIP_FEE = 300;

const APPLICATION_STYLES = `
  <style>
    @page { size: A4; margin: 14mm; }
    body { padding: 0; font-size: 11px; }
    .form-head { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1e2318; padding-bottom: 10px; }
    .form-head img { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; }
    .form-head h1 { font-size: 17px; }
    .form-head .sub { margin: 0; }
    .form-title { font-size: 14px; font-weight: 800; letter-spacing: .06em; text-align: center; margin: 12px 0 4px; }
    .form-meta { display: flex; justify-content: space-between; font-size: 10.5px; color: #475569; margin-bottom: 6px; }
    h2 { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; background: #eef1e8; color: #1e2318; padding: 4px 6px; margin: 12px 0 0; }
    .grid { display: grid; border-left: 1px solid #94a3b8; border-top: 1px solid #94a3b8; }
    .cell { border-right: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; padding: 3px 6px 4px; min-height: 34px; }
    .cell .k { font-size: 8.5px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
    .cell .v { font-size: 12px; font-weight: 600; margin-top: 2px; min-height: 15px; word-break: break-word; }
    .opts { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 3px; font-size: 11px; }
    .box { display: inline-block; width: 10px; height: 10px; border: 1px solid #334155; margin-right: 4px; vertical-align: -1px; text-align: center; line-height: 9px; font-size: 9px; font-weight: 800; }
    table.lined { width: 100%; border-collapse: collapse; margin-top: 0; }
    table.lined th, table.lined td { border: 1px solid #94a3b8; padding: 4px 6px; font-size: 11px; text-align: left; }
    table.lined th { font-size: 8.5px; text-transform: uppercase; color: #64748b; background: #f8fafc; }
    table.lined td { height: 22px; font-weight: 600; }
    .declaration { font-size: 10.5px; line-height: 1.5; margin-top: 12px; }
    .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 30px; }
    .sign { text-align: center; font-size: 10px; color: #475569; }
    .sign b { display: block; min-height: 18px; color: #0f172a; font-size: 12px; border-bottom: 1px solid #0f172a; padding-bottom: 2px; margin-bottom: 3px; }
    .office { margin-top: 14px; border: 1.5px dashed #94a3b8; padding: 8px; }
    .office h3 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
    .office .grid { border: 0; gap: 10px; }
    .office .cell { border: 0; border-bottom: 1px solid #94a3b8; }
    .page-break { break-before: page; }
  </style>
`;

export function printMembershipApplication(application, logoUrl) {
  const a = application || {};
  const blank = !application;
  const v = (value) => (blank || value === undefined || value === null || value === '' ? '' : escapeHtml(value));
  const cell = (label, value, span = 1) => `<div class="cell" style="grid-column: span ${span}"><div class="k">${label}</div><div class="v">${v(value)}</div></div>`;
  const choices = (label, options, selected, span = 1) => `
    <div class="cell" style="grid-column: span ${span}"><div class="k">${label}</div>
      <div class="opts">${options.map((o) => `<span><span class="box">${!blank && selected === o ? '✓' : ''}</span>${escapeHtml(o)}</span>`).join('')}</div>
    </div>`;
  const grid = (cols, cells) => `<div class="grid" style="grid-template-columns: repeat(${cols}, 1fr)">${cells.join('')}</div>`;
  const date = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '');
  const farm = a.farmProfile || {};
  const f = (group, key) => (farm[group] || {})[key];
  const padRows = (rows, min) => rows.concat(Array(Math.max(0, min - rows.length)).fill(null));

  const fullName = [a.firstName, a.middleName, a.lastName, a.suffix].filter(Boolean).join(' ');
  const dependents = padRows((a.dependents || []).filter((d) => d.name), 4);
  const crops = padRows((a.otherCrops || []).filter((c) => c.crop), 3);
  const line = '______________';

  const bodyHtml = `
    ${APPLICATION_STYLES}
    <div class="form-head">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="">` : ''}
      <div>
        <h1>${COOP_NAME}</h1>
        <p class="sub">Sitio Torens, North Villazar, Sipocot, Camarines Sur</p>
      </div>
    </div>
    <div class="form-title">MEMBERSHIP APPLICATION FORM</div>
    <div class="form-meta">
      <span>Application No.: ${line}</span>
      <span>Date Filed: ${blank ? line : date(new Date())}</span>
    </div>

    <h2>I. Personal Data Sheet</h2>
    ${grid(4, [
      cell('First Name', a.firstName), cell('Middle Name', a.middleName), cell('Family Name', a.lastName), cell('Suffix', a.suffix),
      cell('Birthday', date(a.birthdate)), cell('Age', a.age), cell('Birthplace', a.birthplace, 2),
      choices('Gender', APPLICATION_GENDERS, a.gender), choices('Civil Status', APPLICATION_CIVIL_STATUSES, a.civilStatus, 3),
      cell('CP # / Mobile Number', a.phone, 2), cell('Email Address', a.email, 2),
    ])}

    <h2>II. Address &amp; Background</h2>
    ${grid(5, [
      cell('House No.', a.addressNumber), cell('Street', a.street), cell('Zone / Purok', a.zone), cell('Barangay', a.barangay), cell('Municipality / City', a.munCity),
    ])}
    ${grid(4, [
      cell('Facebook', a.facebook), cell('Occupation', a.occupation), cell('Employer', a.employer),
      cell('Annual Income', a.annualIncome !== undefined && a.annualIncome !== '' ? `₱${Number(a.annualIncome).toLocaleString()}` : ''),
      cell('Business Owned / Connected', a.businessOwned, 2), cell('TIN', a.tin), cell('Religion', a.religion),
    ])}

    <h2>III. Family &amp; Dependents</h2>
    ${grid(2, [cell('Spouse / Contact Person', a.spouseContactPerson), cell('Contact Person CP #', a.spouseCpNumber)])}
    <table class="lined">
      <thead><tr><th style="width:52%">Name of Dependent</th><th>Birthday</th><th style="width:16%">Sex</th></tr></thead>
      <tbody>${dependents.map((d) => `<tr><td>${d ? v(d.name) : ''}</td><td>${d ? v(date(d.birthdate)) : ''}</td><td>${d ? v(d.sex) : ''}</td></tr>`).join('')}</tbody>
    </table>

    <h2>IV. Education</h2>
    ${grid(1, [choices('Highest Educational Attainment', APPLICATION_EDUCATION, a.eduAttainment)])}

    <h2 class="page-break">V. Farm Profile</h2>
    ${grid(4, [
      cell('Coconut Area (ha)', f('coconut', 'areaHa')), cell('Bearing', f('coconut', 'bearing')), cell('Non-Bearing', f('coconut', 'nonBearing')), cell('Months / Harvest', f('coconut', 'monthsPerHarvest')),
      cell('Ave. Nuts / Harvest', f('coconut', 'aveNutsHarvest')), cell('Last Harvest', date(f('coconut', 'lastHarvest'))), cell('Ave. Kopra Sold (kg)', f('coconut', 'aveKopraSoldKg')), cell('Ave. Harvest Charcoal', f('coconut', 'aveHarvestCharcoal')),
    ])}
    ${grid(4, [
      cell('Swine - Sow', f('swine', 'sow')), cell('Piglets', f('swine', 'piglets')), cell('Farrowing Date', date(f('swine', 'farrowingDate'))), cell('Fattening', f('swine', 'fattening')),
      cell('Cow - Male', f('livestock', 'cowMale')), cell('Cow - Female', f('livestock', 'cowFemale')), cell('Carabao - Male', f('livestock', 'carabaoMale')), cell('Carabao - Female', f('livestock', 'carabaoFemale')),
      cell('Goat', f('livestock', 'goat')), cell('Other Livestock', f('livestock', 'others'), 3),
    ])}
    ${grid(4, [
      cell('Cacao Area (ha/sqm)', f('cacao', 'areaHaSqm')), cell('Bearing', f('cacao', 'bearing')), cell('Non-Bearing', f('cacao', 'nonBearing')), cell('Harvest Cycle', f('cacao', 'harvestCycle')),
      cell('Ave. Nuts / Harvest', f('cacao', 'aveNutsHarvest')), cell('Last Harvest', date(f('cacao', 'lastHarvest'))), cell('Total / Harvest', f('cacao', 'totalHarvest')), cell('Unit Price', f('cacao', 'unitPrice')),
      cell('Ave. Beans Sold (kg)', f('cacao', 'aveBeansSoldKg'), 4),
    ])}
    ${grid(4, [
      cell('Rice Area (ha/sqm)', f('rice', 'areaHaSqm')), cell('Rice Location', f('rice', 'location')), cell('Corn Area (ha/sqm)', f('corn', 'areaHaSqm')), cell('Corn Location', f('corn', 'location')),
    ])}
    <table class="lined">
      <thead><tr><th style="width:60%">Vegetables &amp; Other Crops</th><th>Area (ha/sqm)</th></tr></thead>
      <tbody>${crops.map((c) => `<tr><td>${c ? v(c.crop === 'Others' ? c.cropOther || 'Others' : c.crop) : ''}</td><td>${c ? v(c.areaHaSqm) : ''}</td></tr>`).join('')}</tbody>
    </table>
    ${grid(1, [cell('Other Remarks', farm.otherRemarks)])}

    <h2>VI. Requirements &amp; Payment</h2>
    ${grid(4, [
      cell('Valid ID Type', a.idType), cell('ID Number', a.idNumber), cell('Date Issued', date(a.idDateIssued)), cell('Place Issued', a.idPlaceIssued),
      cell('EDUCOM Chairperson', a.educomChairperson, 2),
      `<div class="cell"><div class="k">Membership Fee</div><div class="v">₱${MEMBERSHIP_FEE.toFixed(2)}</div></div>`,
      cell('GCash Reference No.', a.refNum),
    ])}

    <p class="declaration">
      I hereby apply for membership in the ${COOP_NAME}. I certify that the information above is true and correct,
      that I have attended the Pre-Membership Education Seminar (PMES), and that I will abide by the Articles of
      Cooperation, By-Laws, and policies of the cooperative.
    </p>
    <div class="signs">
      <div class="sign"><b>${blank ? '&nbsp;' : escapeHtml(fullName)}</b>Signature over Printed Name of Applicant</div>
      <div class="sign"><b>&nbsp;</b>Date</div>
    </div>

    <div class="office">
      <h3>For BOCOFAC Use Only</h3>
      <div class="grid" style="grid-template-columns: repeat(4, 1fr)">
        ${['Received By', 'Date Received', 'BOD Resolution No.', 'Member ID'].map((k) => `<div class="cell"><div class="k">${k}</div><div class="v"></div></div>`).join('')}
      </div>
      <div class="opts" style="margin-top:8px"><span><span class="box"></span>Approved</span><span><span class="box"></span>Disapproved</span><span>Remarks: ____________________________________________</span></div>
    </div>
  `;
  openPrintWindow(blank ? 'BOCOFAC Membership Application Form' : `Membership Application - ${fullName}`, bodyHtml, { width: 900, height: 1000 });
}
