// src/utils/printDocument.js
// Opens a small, self-contained popup window with print-ready HTML and
// triggers the browser print dialog. Used for the share-capital Official
// Receipt and Statement of Account - deliberately not a PDF library
// dependency, just clean HTML the browser's own "Save as PDF" print
// destination can turn into a file if the user wants one.

const COOP_NAME = 'BOCOFAC Coconut Farmers Cooperative';

// Every value below (buyer names, member names/emails, product names...)
// can originate from a customer/applicant-controlled form field, not just
// staff input, and it's about to be dropped straight into document.write().
// Without escaping, a name like <img src=x onerror=...> would execute as
// real script in this popup - which is same-origin as the app and would
// still carry the printing staff member's session cookie on any request it
// makes. Escape everything interpolated into HTML below, no exceptions.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function openPrintWindow(title, bodyHtml, { width = 480, height = 640 } = {}) {
  const win = window.open('', '_blank', `width=${width},height=${height}`);
  if (!win) return; // popup blocked - nothing we can do without user gesture
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
  const target = Number(member.requiredShareCapital) || 0;
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
      <tr><td class="label">Required Share Capital</td><td class="value">₱${target.toLocaleString()}</td></tr>
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
      <tr><td class="label">Remaining Balance</td><td class="value">₱${Math.max(target - totalPaid, 0).toLocaleString()}</td></tr>
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
