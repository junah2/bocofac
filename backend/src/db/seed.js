require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./pool');

// Generic neutral placeholder - the admin dashboard has no product-photo
// upload yet (see the note on the PATCH /:id/stock route), so real product
// photos aren't available until that's built; this avoids broken-image
// icons in the meantime instead of guessing at a stock-photo URL.
const NO_PHOTO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' font-size='20' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' dy='.3em'%3ENo Photo%3C/text%3E%3C/svg%3E";

const PRODUCTS = [
  // Old placeholder/demo catalog - kept (not deleted) because demo seed
  // orders below still reference these ids via order_items' FK, but hidden
  // from the storefront (stock 0) now that the real BOCOFAC catalog exists.
  { id: 'prod-01', name: 'Premium Coconut Shell Activated Charcoal', category: 'Charcoal', description: 'High-surface-property activated carbon tailored for supreme air purification, water filtration, and metallurgical applications. Sourced 100% from organic coconut husks.', price: 450, stock: 0, unit: '10kg Bag', image: 'https://images.unsplash.com/photo-1605600656374-27726839e731?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', rating: 4.8, views: 1240, ordersCount: 48, specifications: ['Mesh size: 8x30', 'Moisture < 5%', 'Ash content < 3%', 'Iodine number: 1050 mg/g'] },
  { id: 'prod-02', name: 'Cocopeat Organic Enrichment Fertilizer', category: 'Fertilizer', description: 'Dehydrated luxury cocopeat brick rich in nitrogen, potassium, and magnesium. Retains 800% water by weight—excellent for greenhouse potting mixes.', price: 180, stock: 0, unit: '5kg Block', image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', rating: 4.9, views: 1890, ordersCount: 112, specifications: ['pH: 5.8 - 6.5', 'EC < 0.5 mS/cm', '100% biodegradable', 'Double washed to remove salts'] },
  { id: 'prod-wre', name: 'Coir Geo-Textile High-Density EcoRope', category: 'Fibre & Coir', description: 'Heavy-duty eco-ropes constructed with hand-twisted coir fibre. Tailored for steep slope soil erosion prevention, gardening support, and marine utility.', price: 850, stock: 0, unit: '100m Roll', image: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', rating: 4.6, views: 950, ordersCount: 22, specifications: ['Diameter: 12mm', 'Tensile strength: 120 lbs', 'Rot-resistant (lasts 3-5 years)', 'Natural hemp tint'] },
  { id: 'prod-03', name: 'Artisanal Coconut Shell Salad Bowls (Set)', category: 'Handicraft', description: 'Beautifully polished, reusable serving bowls carved from discarded coconut shells. Sanded and buffed with organic virgin coconut oil for a glossy sheen.', price: 320, stock: 0, unit: 'Set of 4', image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', rating: 4.7, views: 740, ordersCount: 15, specifications: ['Size: ~12-14cm diameter', 'Food safe', 'Chemical-free processing', 'Zero waste packaging'] },
  { id: 'prod-04', name: 'Heavy Duty Coir Fiber Welcome Doormat', category: 'Handicraft', description: 'Extra stiff natural coir doormat with tough rubber backing. High moisture trapping ability, explicitly engineered for aggressive dirt scraping.', price: 250, stock: 0, unit: 'Piece', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', rating: 4.5, views: 620, ordersCount: 30, specifications: ['Dimensions: 40x60cm', 'Pile height: 15mm', 'Anti-slip base', 'Fade-free dyes'] },

  // Real BOCOFAC catalog. Stock defaults to 100 (no actual counts given yet)
  // - adjust via Admin Dashboard > Products, which updates in realtime now.
  { id: 'prod-05', name: 'Organic Fertilizer', category: 'Fertilizer', description: 'Organic soil fertilizer produced by the cooperative, sold by the kilo.', price: 15, stock: 100, unit: '1 kg', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-06', name: 'Screened Coco Peat', category: 'Fertilizer', description: 'Finely screened coco peat growing medium, sold by the sack.', price: 250, stock: 100, unit: '1 Sack', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-07', name: 'Unscreened Coco Peat', category: 'Fertilizer', description: 'Raw, unscreened coco peat growing medium, sold by the sack.', price: 200, stock: 100, unit: '1 Sack', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-08', name: 'Coconut Rope (12m)', category: 'Fibre & Coir', description: 'Hand-twisted coconut coir rope, 12 meters per piece.', price: 35, stock: 100, unit: 'Piece (12m)', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: ['Length: 12m'] },
  { id: 'prod-09', name: 'Coconut Coir', category: 'Fibre & Coir', description: 'Raw coconut coir fibre, sold by the kilo.', price: 12, stock: 100, unit: '1 kg', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-10', name: 'Coconut Husk Pole (1 ft)', category: 'Fibre & Coir', description: 'Coconut husk pole, 1 foot length.', price: 35, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: ['Length: 1 ft'] },
  { id: 'prod-11', name: 'Coconut Husk Pole (2 ft)', category: 'Fibre & Coir', description: 'Coconut husk pole, 2 feet length.', price: 50, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: ['Length: 2 ft'] },
  { id: 'prod-12', name: 'Coconut Husk Pole (3 ft)', category: 'Fibre & Coir', description: 'Coconut husk pole, 3 feet length.', price: 65, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: ['Length: 3 ft'] },
  { id: 'prod-13', name: 'Coconut Husk Pole (4 ft)', category: 'Fibre & Coir', description: 'Coconut husk pole, 4 feet length.', price: 80, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: ['Length: 4 ft'] },
  { id: 'prod-14', name: 'Coconut Bowl', category: 'Handicraft', description: 'Handcrafted bowl made from coconut shell.', price: 20, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-15', name: 'Coconut Cup', category: 'Handicraft', description: 'Handcrafted cup made from coconut shell.', price: 350, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-16', name: 'Coconut Mug', category: 'Handicraft', description: 'Handcrafted mug made from coconut shell.', price: 350, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-17', name: 'Kitchen Ware', category: 'Handicraft', description: 'Coconut-shell kitchen ware/utensils.', price: 75, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-18', name: 'Keychain', category: 'Handicraft', description: 'Coconut-shell keychain.', price: 30, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-19', name: 'Coconut Shell Briquettes', category: 'Charcoal', description: 'Coconut shell charcoal briquettes, sold by the kilo.', price: 90, stock: 100, unit: '1 kg', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
];

const MEMBERS = [
  { id: 'M-1021', name: 'Generosa M. Ramos', email: 'generosa.ramos@outlook.com', requiredShareCapital: 10000, joinedDate: '2024-03-12', status: 'Active' },
  { id: 'M-1022', name: 'Danilo S. Santos', email: 'danilo.santos@gmail.com', requiredShareCapital: 10000, joinedDate: '2024-05-18', status: 'Active' },
  { id: 'M-1023', name: 'Teodoro G. Alcantara', email: 'teodoro.alcantara@yahoo.com', requiredShareCapital: 10000, joinedDate: '2025-01-20', status: 'Active' },
  { id: 'M-1024', name: 'Fe Corazon De Guzman', email: 'corade_guzman@gmail.com', requiredShareCapital: 15000, joinedDate: '2025-11-02', status: 'Active' },
  { id: 'M-1025', name: 'Anacleto P. Bonifacio', email: 'bonifacio.anac@gmail.com', requiredShareCapital: 10000, joinedDate: '2026-02-14', status: 'Delinquent' },
];

const LEDGER = [
  { id: 'TXN-7001', memberId: 'M-1021', paymentDate: '2024-03-12', amount: 5000, referenceId: 'REF-00192837', paymentMethod: 'GCash', status: 'Verified', verifiedAt: '2024-03-13' },
  { id: 'TXN-7002', memberId: 'M-1021', paymentDate: '2024-09-15', amount: 5000, referenceId: 'REF-00832104', paymentMethod: 'GCash', status: 'Verified', verifiedAt: '2024-09-16' },
  { id: 'TXN-7003', memberId: 'M-1022', paymentDate: '2024-05-18', amount: 3000, referenceId: 'REF-00948371', paymentMethod: 'Bank Transfer', status: 'Verified', verifiedAt: '2024-05-19' },
  { id: 'TXN-7004', memberId: 'M-1022', paymentDate: '2025-06-11', amount: 3000, referenceId: 'REF-00103986', paymentMethod: 'GCash', status: 'Verified', verifiedAt: '2025-06-12' },
  { id: 'TXN-7005', memberId: 'M-1023', paymentDate: '2025-01-20', amount: 10000, referenceId: 'REF-00448209', paymentMethod: 'Over-the-Counter', status: 'Verified', verifiedAt: '2025-01-20' },
];

// NOTE: documentsUploaded booleans from the old mock data aren't backed by real
// files, so we don't fabricate applicant_documents rows here - they'll be
// populated for real once someone uploads through POST /applicants/:id/documents.
const APPLICANTS = [
  { id: 'APP-901', fullName: 'Ronaldo V. Santos', email: 'ronny.santos@gmail.com', phone: '+63 917 123 4567', agriculturalType: 'Coconut Multi-cropping', farmSizeHectares: 2.5, address: 'Sitio Coco, Brgy. San Juan, San Pablo City, Laguna', submittedAt: '2026-06-10T10:30:00Z', status: 'PMES Pending', pmesAttended: false, registrationFeePaid: true, referenceNumber: 'REF-98761234' },
  { id: 'APP-902', fullName: 'Maria Estela Custodio', email: 'estela.custodio@outlook.com', phone: '+63 920 987 6543', agriculturalType: 'Pure Coconut Cultivation', farmSizeHectares: 4.8, address: 'Zone 4, Brgy. Santa Elena, Tiaong, Quezon', submittedAt: '2026-06-15T14:45:00Z', status: 'Pending Review', pmesAttended: true, pmesDate: '2026-06-14', registrationFeePaid: true, referenceNumber: 'REF-88495021' },
  { id: 'APP-903', fullName: 'Jaime L. Cruz', email: 'jaimito.cruz@yahoo.com', phone: '+63 908 444 8812', agriculturalType: 'Coconut-Livestock Silvopasture', farmSizeHectares: 1.2, address: 'Purok Ginto, Brgy. Concepcion, Sariaya, Quezon', submittedAt: '2026-06-20T08:15:00Z', status: 'Draft', pmesAttended: false, registrationFeePaid: false, referenceNumber: null },
];

const PMES_SESSIONS = [
  { id: 'SEM-301', title: 'Pre-Membership Education Training (Session A)', date: '2026-06-25', time: '13:00 - 16:30 PHT', venue: 'BOCOFAC Cooperative Hall, Sipocot', speaker: 'Dr. Leonardo P. Macasaet (Coconut Dev Authority)', capacity: 25 },
  { id: 'SEM-302', title: 'Financial Stewardship & Coop Governance Seminar', date: '2026-07-02', time: '09:00 - 12:00 PHT', venue: 'BOCOFAC Cooperative Hall, Sipocot', speaker: 'Atty. Susan R. Villavert (CDA Consultant)', capacity: 30 },
];

const ORDERS = [
  { id: 'ORD-501', buyerName: 'Gerry A. Lopez', buyerEmail: 'gerry.lopez@yahoo.com', phone: '09123456789', shippingAddress: '42 Orchid St, Villa Maria, Lipa City, Batangas', items: [{ productId: 'prod-01', productName: 'Premium Coconut Shell Activated Charcoal', price: 450, quantity: 2 }, { productId: 'prod-02', productName: 'Cocopeat Organic Enrichment Fertilizer', price: 180, quantity: 5 }], totalAmount: 1800, paymentMethod: 'GCash', referenceNumber: 'GCASH-771928', status: 'Pending Verification', orderedAt: '2026-06-19T11:20:00Z' },
  { id: 'ORD-502', buyerName: 'Salvador M. Reyes', buyerEmail: 'salvador.r@gmail.com', phone: '09198887766', shippingAddress: 'Purok 3, Brgy San Jose, Alaminos, Laguna', items: [{ productId: 'prod-wre', productName: 'Coir Geo-Textile High-Density EcoRope', price: 850, quantity: 1 }], totalAmount: 850, paymentMethod: 'Bank Transfer', referenceNumber: 'BPI-TRANSFER-0041', status: 'Completed', orderedAt: '2026-06-15T09:05:00Z' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO products (id, name, category, description, price, stock, unit, image, rating, views, orders_count, specifications)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.category, p.description, p.price, p.stock, p.unit, p.image, p.rating, p.views, p.ordersCount, p.specifications]
      );
    }

    for (const m of MEMBERS) {
      await client.query(
        `INSERT INTO members (id, name, email, required_share_capital, joined_date, status)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.name, m.email, m.requiredShareCapital, m.joinedDate, m.status]
      );
    }
    await client.query(`SELECT setval('member_id_seq', (SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 1000) FROM members))`);

    for (const l of LEDGER) {
      await client.query(
        `INSERT INTO ledger (id, member_id, payment_date, amount, reference_id, payment_method, status, verified_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [l.id, l.memberId, l.paymentDate, l.amount, l.referenceId, l.paymentMethod, l.status, l.verifiedAt || null]
      );
    }
    await client.query(`SELECT setval('ledger_id_seq', (SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 7000) FROM ledger))`);

    for (const a of APPLICANTS) {
      await client.query(
        `INSERT INTO applicants (id, full_name, email, phone, agricultural_type, farm_size_hectares, address, submitted_at, status, pmes_attended, pmes_date, registration_fee_paid, reference_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.fullName, a.email, a.phone, a.agriculturalType, a.farmSizeHectares, a.address, a.submittedAt, a.status, a.pmesAttended, a.pmesDate || null, a.registrationFeePaid, a.referenceNumber]
      );
    }
    await client.query(`SELECT setval('applicant_id_seq', (SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 900) FROM applicants))`);

    for (const s of PMES_SESSIONS) {
      await client.query(
        `INSERT INTO pmes_sessions (id, title, date, time_range, venue, speaker, capacity, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Upcoming')
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.title, s.date, s.time, s.venue, s.speaker, s.capacity]
      );
    }
    await client.query(`SELECT setval('session_id_seq', (SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 300) FROM pmes_sessions))`);

    for (const o of ORDERS) {
      // Skip items too when the order already exists - unlike the other
      // ON CONFLICT DO NOTHING inserts above, order_items has no unique
      // constraint to dedupe against, so re-running this loop against an
      // already-seeded order used to insert a duplicate set of items every
      // time.
      const { rows: existingOrder } = await client.query('SELECT 1 FROM orders WHERE id = $1', [o.id]);
      if (existingOrder.length) continue;

      await client.query(
        `INSERT INTO orders (id, buyer_name, buyer_email, phone, shipping_address, total_amount, payment_method, reference_number, status, ordered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [o.id, o.buyerName, o.buyerEmail, o.phone, o.shippingAddress, o.totalAmount, o.paymentMethod, o.referenceNumber, o.status, o.orderedAt]
      );
      for (const item of o.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES ($1,$2,$3,$4,$5)`,
          [o.id, item.productId, item.productName, item.price, item.quantity]
        );
      }
    }
    await client.query(`SELECT setval('order_id_seq', (SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 500) FROM orders))`);

    // Seed-only admin/board accounts - there is no public signup path for these roles.
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@bocofac.coop';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const boardEmail = process.env.SEED_BOARD_EMAIL || 'board@bocofac.coop';
    const boardPassword = process.env.SEED_BOARD_PASSWORD || 'Board123!';

    const adminHash = await bcrypt.hash(adminPassword, 10);
    const boardHash = await bcrypt.hash(boardPassword, 10);

    await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'admin')
       ON CONFLICT (email) DO NOTHING`,
      ['Admin User', adminEmail, adminHash]
    );
    await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'board')
       ON CONFLICT (email) DO NOTHING`,
      ['Board Member', boardEmail, boardHash]
    );

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
    console.log(`Board login: ${boardEmail} / ${boardPassword}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
