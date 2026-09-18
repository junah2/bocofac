// src/data/initialData.js

// Generic neutral placeholder - mirrors backend/src/db/seed.js's NO_PHOTO.
// There's no product-photo upload in the admin dashboard yet, so real photos
// aren't available; this avoids a broken-image icon in the meantime.
const NO_PHOTO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' font-size='20' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' dy='.3em'%3ENo Photo%3C/text%3E%3C/svg%3E";

// This is only the shape a first-ever visitor sees for an instant before
// the real GET /api/products fetch resolves (see App.jsx's loadProducts) -
// mirrors the seeded DB catalog so that flash of content matches reality.
export const INITIAL_PRODUCTS = [
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
  { id: 'prod-17', name: 'Coconut Shell Sandok Set', category: 'Handicraft', description: 'Coconut-shell sandok (ladle) set in assorted sizes, plus a flat spatula.', price: 75, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-18', name: 'Keychain', category: 'Handicraft', description: 'Coconut-shell keychain.', price: 30, stock: 100, unit: 'Piece', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] },
  { id: 'prod-19', name: 'Coconut Shell Briquettes', category: 'Charcoal', description: 'Coconut shell charcoal briquettes, sold by the kilo.', price: 90, stock: 100, unit: '1 kg', image: NO_PHOTO, rating: 0, views: 0, ordersCount: 0, specifications: [] }
];

export const INITIAL_MEMBERS = [
  {
    id: 'M-1021',
    name: 'Generosa M. Ramos',
    email: 'generosa.ramos@outlook.com',
    requiredShareCapital: 10000,
    joinedDate: '2024-03-12',
    status: 'Active'
  },
  {
    id: 'M-1022',
    name: 'Danilo S. Santos',
    email: 'danilo.santos@gmail.com',
    requiredShareCapital: 10000,
    joinedDate: '2024-05-18',
    status: 'Active'
  },
  {
    id: 'M-1023',
    name: 'Teodoro G. Alcantara',
    email: 'teodoro.alcantara@yahoo.com',
    requiredShareCapital: 10000,
    joinedDate: '2025-01-20',
    status: 'Active'
  },
  {
    id: 'M-1024',
    name: 'Fe Corazon De Guzman',
    email: 'corade_guzman@gmail.com',
    requiredShareCapital: 15000,
    joinedDate: '2025-11-02',
    status: 'Active'
  },
  {
    id: 'M-1025',
    name: 'Anacleto P. Bonifacio',
    email: 'bonifacio.anac@gmail.com',
    requiredShareCapital: 10000,
    joinedDate: '2026-02-14',
    status: 'Delinquent'
  }
];

export const INITIAL_LEDGER = [
  {
    id: 'TXN-7001',
    memberId: 'M-1021',
    memberName: 'Generosa M. Ramos',
    paymentDate: '2024-03-12',
    amount: 5000,
    referenceId: 'REF-00192837',
    paymentMethod: 'GCash',
    status: 'Verified',
    verifiedAt: '2024-03-13'
  },
  {
    id: 'TXN-7002',
    memberId: 'M-1021',
    memberName: 'Generosa M. Ramos',
    paymentDate: '2024-09-15',
    amount: 5000,
    referenceId: 'REF-00832104',
    paymentMethod: 'GCash',
    status: 'Verified',
    verifiedAt: '2024-09-16'
  },
  {
    id: 'TXN-7003',
    memberId: 'M-1022',
    memberName: 'Danilo S. Santos',
    paymentDate: '2024-05-18',
    amount: 3000,
    referenceId: 'REF-00948371',
    paymentMethod: 'GCash',
    status: 'Verified',
    verifiedAt: '2024-05-19'
  },
  {
    id: 'TXN-7004',
    memberId: 'M-1022',
    memberName: 'Danilo S. Santos',
    paymentDate: '2025-06-11',
    amount: 3000,
    referenceId: 'REF-00103986',
    paymentMethod: 'GCash',
    status: 'Verified',
    verifiedAt: '2025-06-12'
  },
  {
    id: 'TXN-7005',
    memberId: 'M-1023',
    memberName: 'Teodoro G. Alcantara',
    paymentDate: '2025-01-20',
    amount: 10000,
    referenceId: 'REF-00448209',
    paymentMethod: 'Over-the-Counter',
    status: 'Verified',
    verifiedAt: '2025-01-20'
  }
];

export const INITIAL_APPLICANTS = [
  {
    id: 'APP-901',
    fullName: 'Ronaldo V. Santos',
    email: 'ronny.santos@gmail.com',
    phone: '+63 917 123 4567',
    agriculturalType: 'Coconut Multi-cropping',
    farmSizeHectares: 2.5,
    address: 'Sitio Coco, Brgy. San Juan, San Pablo City, Laguna',
    submittedAt: '2026-06-10T10:30:00Z',
    status: 'PMES Pending',
    pmesAttended: false,
    documentsUploaded: {
      validId: true,
      farmDeclaration: true,
      barangayClearance: true
    },
    registrationFeePaid: true,
    referenceNumber: 'REF-98761234'
  },
  {
    id: 'APP-902',
    fullName: 'Maria Estela Custodio',
    email: 'estela.custodio@outlook.com',
    phone: '+63 920 987 6543',
    agriculturalType: 'Pure Coconut Cultivation',
    farmSizeHectares: 4.8,
    address: 'Zone 4, Brgy. Santa Elena, Tiaong, Quezon',
    submittedAt: '2026-06-15T14:45:00Z',
    status: 'Pending Review',
    pmesAttended: true,
    pmesDate: '2026-06-14',
    documentsUploaded: {
      validId: true,
      farmDeclaration: false,
      barangayClearance: true
    },
    registrationFeePaid: true,
    referenceNumber: 'REF-88495021'
  },
  {
    id: 'APP-903',
    fullName: 'Jaime L. Cruz',
    email: 'jaimito.cruz@yahoo.com',
    phone: '+63 908 444 8812',
    agriculturalType: 'Coconut-Livestock Silvopasture',
    farmSizeHectares: 1.2,
    address: 'Purok Ginto, Brgy. Concepcion, Sariaya, Quezon',
    submittedAt: '2026-06-20T08:15:00Z',
    status: 'Draft',
    pmesAttended: false,
    documentsUploaded: {
      validId: false,
      farmDeclaration: false,
      barangayClearance: false
    },
    registrationFeePaid: false
  }
];

export const INITIAL_PMES_SESSIONS = [
  {
    id: 'SEM-301',
    title: 'Pre-Membership Education Training (Session A)',
    date: '2026-06-25',
    time: '13:00 - 16:30 PHT',
    venue: 'BOCOFAC Cooperative Hall, Sitto Torbela, Zone 6, North Villazar, Sipocot',
    speaker: 'Dr. Leonardo P. Macasaet (Coconut Dev Authority)',
    registeredCount: 14,
    status: 'Upcoming',
    capacity: 25
  },
  {
    id: 'SEM-302',
    title: 'Financial Stewardship & Coop Governance Seminar',
    date: '2026-07-02',
    time: '09:00 - 12:00 PHT',
    venue: 'Barangay North Villazar Multi-Purpose Covered Court, Sipocot',
    speaker: 'Atty. Susan R. Villavert (CDA Consultant)',
    registeredCount: 8,
    status: 'Upcoming',
    capacity: 30
  }
];

export const INITIAL_ORDERS = [
  {
    id: 'ORD-501',
    buyerName: 'Gerry A. Lopez',
    buyerEmail: 'gerry.lopez@yahoo.com',
    phone: '09123456789',
    shippingAddress: '42 Orchid St, Villa Maria, Lipa City, Batangas',
    items: [
      { productId: 'prod-01', productName: 'Premium Coconut Shell Activated Charcoal', price: 450, quantity: 2 },
      { productId: 'prod-02', productName: 'Cocopeat Organic Enrichment Fertilizer', price: 180, quantity: 5 }
    ],
    totalAmount: 1800,
    paymentMethod: 'GCash',
    referenceNumber: 'GCASH-771928',
    paymentReceiptName: 'screenshot_receipt_lipa.jpg',
    status: 'Pending Verification',
    orderedAt: '2026-06-19T11:20:00Z'
  },
  {
    id: 'ORD-502',
    buyerName: 'Salvador M. Reyes',
    buyerEmail: 'salvador.r@gmail.com',
    phone: '09198887766',
    shippingAddress: 'Purok 3, Brgy San Jose, Alaminos, Laguna',
    items: [
      { productId: 'prod-wre', productName: 'Coir Geo-Textile High-Density EcoRope', price: 850, quantity: 1 }
    ],
    totalAmount: 850,
    paymentMethod: 'Bank Transfer',
    referenceNumber: 'BPI-TRANSFER-0041',
    paymentReceiptName: 'bpi_screenshot.jpg',
    status: 'Completed',
    orderedAt: '2026-06-15T09:05:00Z'
  }
];
