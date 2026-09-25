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

  // Additional realistic member dataset (generated) so the Membership /
  // Share Capital admin views have real-looking volume to demonstrate,
  // instead of just the original 5 handwritten demo rows above.
  { id: "M-1026", name: "Lourdes X. Perete", email: "lourdes.perete@outlook.com", requiredShareCapital: 15000, joinedDate: "2025-12-28", status: "Active", address: "Purok 2, Brgy. Lipilip, Sipocot, Camarines Sur", mobileNumber: "09199970328", ncfrsId: "NCFRS-2025-71040", rsbsaId: "04-08-06-105-899458", membershipFee: 300, membershipFeeDatePaid: "2025-12-31", membershipFeeReference: "REF-85577751", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Sitio Torens Farmers Association" },
  { id: "M-1027", name: "Rodrigo N. Fajardo", email: "rodrigo.fajardo@gmail.com", requiredShareCapital: 10000, joinedDate: "2025-07-15", status: "Active", address: "Purok 6, Brgy. Tarum, Pasacao, Camarines Sur", mobileNumber: "09198359337", ncfrsId: "NCFRS-2025-42792", rsbsaId: "05-03-17-290-017599", membershipFee: 300, membershipFeeDatePaid: "2025-07-16", membershipFeeReference: "REF-12310283", hasCv: true, hasFarmPhoto: false, hasShareCert: true, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1028", name: "Perla F. Vergara", email: "perla.vergara@yahoo.com", requiredShareCapital: 4000, joinedDate: "2024-03-23", status: "Delinquent", address: "Purok 7, Brgy. San Miguel, Del Gallego, Camarines Sur", mobileNumber: "09353797121", ncfrsId: "NCFRS-2024-35494", rsbsaId: "04-09-01-757-432165", membershipFee: 300, membershipFeeDatePaid: "2024-03-26", membershipFeeReference: "REF-25384464", hasCv: true, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: null },
  { id: "M-1029", name: "Perla I. Bragais", email: "perla.bragais@yahoo.com", requiredShareCapital: 25000, joinedDate: "2024-10-15", status: "Active", address: "Purok 7, Brgy. Del Rosario, Sipocot, Camarines Sur", mobileNumber: "09455953539", ncfrsId: "NCFRS-2024-12461", rsbsaId: "01-17-14-465-780356", membershipFee: 300, membershipFeeDatePaid: "2024-10-17", membershipFeeReference: "REF-88026146", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Sitio Torens Farmers Association" },
  { id: "M-1030", name: "Cesar N. Rosales", email: "cesar.rosales@gmail.com", requiredShareCapital: 4000, joinedDate: "2024-08-10", status: "Active", address: "Purok 2, Brgy. Osmena, Del Gallego, Camarines Sur", mobileNumber: "09652882560", ncfrsId: "NCFRS-2024-70733", rsbsaId: "05-06-02-546-767500", membershipFee: 300, membershipFeeDatePaid: "2024-08-12", membershipFeeReference: "REF-31725528", hasCv: true, hasFarmPhoto: false, hasShareCert: true, civicOrgAffiliation: "Sitio Torens Farmers Association" },
  { id: "M-1031", name: "Amelia F. Nacario", email: "amelia.nacario@yahoo.com", requiredShareCapital: 20000, joinedDate: "2024-02-26", status: "Delinquent", address: "Purok 5, Brgy. Pangpang, Sipocot, Camarines Sur", mobileNumber: "09187787694", ncfrsId: "NCFRS-2024-31817", rsbsaId: "02-11-09-692-721124", membershipFee: 300, membershipFeeDatePaid: "2024-02-28", membershipFeeReference: "REF-46941850", hasCv: true, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: null },
  { id: "M-1032", name: "Rodel O. Bordios", email: "rodel.bordios@yahoo.com", requiredShareCapital: 20000, joinedDate: "2026-05-14", status: "Active", address: "Purok 3, Brgy. Pangpang, Sipocot, Camarines Sur", mobileNumber: "09350366567", ncfrsId: "NCFRS-2026-47295", rsbsaId: "04-13-17-675-664398", membershipFee: 300, membershipFeeDatePaid: "2026-05-14", membershipFeeReference: "REF-83835830", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "BOCOFAC Youth Wing" },
  { id: "M-1033", name: "Rustico E. Peralta", email: "rustico.peralta@gmail.com", requiredShareCapital: 20000, joinedDate: "2024-06-01", status: "Active", address: "Purok 5, Brgy. Salvacion, Cabusao, Camarines Sur", mobileNumber: "09206260590", ncfrsId: "NCFRS-2024-82516", rsbsaId: "04-09-01-045-036839", membershipFee: 300, membershipFeeDatePaid: "2024-06-02", membershipFeeReference: "REF-56796312", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Barangay Agri Council" },
  { id: "M-1034", name: "Fernando L. Zabala", email: "fernando.zabala@outlook.com", requiredShareCapital: 15000, joinedDate: "2024-05-12", status: "Delinquent", address: "Purok 6, Brgy. Osmena, Del Gallego, Camarines Sur", mobileNumber: "09205805789", ncfrsId: "NCFRS-2024-70492", rsbsaId: "05-02-02-532-301032", membershipFee: 300, membershipFeeDatePaid: "2024-05-13", membershipFeeReference: "REF-27618701", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Camarines Sur Coconut Growers Assoc." },
  { id: "M-1035", name: "Norma C. Bordado", email: "norma.bordado@yahoo.com", requiredShareCapital: 20000, joinedDate: "2025-12-08", status: "Delinquent", address: "Purok 6, Brgy. Pangpang, Pasacao, Camarines Sur", mobileNumber: "09553936277", ncfrsId: "NCFRS-2025-09898", rsbsaId: "05-13-20-254-661154", membershipFee: 300, membershipFeeDatePaid: "2025-12-09", membershipFeeReference: "REF-95007958", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1036", name: "Josefina C. Casulla", email: "josefina.casulla@outlook.com", requiredShareCapital: 12500, joinedDate: "2024-09-23", status: "Active", address: "Purok 2, Brgy. Cadiz, Del Gallego, Camarines Sur", mobileNumber: "09186304119", ncfrsId: "NCFRS-2024-58487", rsbsaId: "04-15-15-911-958233", membershipFee: 300, membershipFeeDatePaid: "2024-09-23", membershipFeeReference: "REF-94036186", hasCv: true, hasFarmPhoto: false, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1037", name: "Zenaida I. Salamat", email: "zenaida.salamat@gmail.com", requiredShareCapital: 6000, joinedDate: "2025-02-05", status: "Active", address: "Purok 2, Brgy. Amtic, Pasacao, Camarines Sur", mobileNumber: "09192799557", ncfrsId: "NCFRS-2025-24962", rsbsaId: "05-04-06-967-254295", membershipFee: 300, membershipFeeDatePaid: "2025-02-06", membershipFeeReference: "REF-87856137", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1038", name: "Rosario C. Vergara", email: "rosario.vergara@gmail.com", requiredShareCapital: 20000, joinedDate: "2026-03-02", status: "Delinquent", address: "Purok 5, Brgy. Osmena, Cabusao, Camarines Sur", mobileNumber: "09553419592", ncfrsId: "NCFRS-2026-35938", rsbsaId: "03-03-19-808-041218", membershipFee: 300, membershipFeeDatePaid: "2026-03-04", membershipFeeReference: "REF-38900265", hasCv: true, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: null },
  { id: "M-1039", name: "Wilfredo E. Bordios", email: "wilfredo.bordios@gmail.com", requiredShareCapital: 6000, joinedDate: "2024-11-06", status: "Active", address: "Purok 4, Brgy. South Villazar, Pamplona, Camarines Sur", mobileNumber: "09758624759", ncfrsId: "NCFRS-2024-78985", rsbsaId: "05-01-07-950-782459", membershipFee: 300, membershipFeeDatePaid: "2024-11-07", membershipFeeReference: "REF-89733330", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Sitio Torens Farmers Association" },
  { id: "M-1040", name: "Eduardo Y. Delos Santos", email: "eduardo.delossantos@outlook.com", requiredShareCapital: 4000, joinedDate: "2025-10-16", status: "Active", address: "Purok 7, Brgy. Salvacion, Pasacao, Camarines Sur", mobileNumber: "09956803147", ncfrsId: "NCFRS-2025-33608", rsbsaId: "02-07-03-599-728412", membershipFee: 300, membershipFeeDatePaid: "2025-10-19", membershipFeeReference: "REF-45577507", hasCv: true, hasFarmPhoto: false, hasShareCert: true, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1041", name: "Aurora N. Añonuevo", email: "aurora.aonuevo@outlook.com", requiredShareCapital: 5000, joinedDate: "2024-12-17", status: "Active", address: "Purok 4, Brgy. South Villazar, Cabusao, Camarines Sur", mobileNumber: "09181874299", ncfrsId: "NCFRS-2024-35503", rsbsaId: "02-05-02-191-843604", membershipFee: 300, membershipFeeDatePaid: "2024-12-17", membershipFeeReference: "REF-30322456", hasCv: false, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Barangay Agri Council" },
  { id: "M-1042", name: "Leticia E. Fajardo", email: "leticia.fajardo@outlook.com", requiredShareCapital: 5000, joinedDate: "2026-06-12", status: "Active", address: "Purok 2, Brgy. North Villazar, Cabusao, Camarines Sur", mobileNumber: "09558467643", ncfrsId: "NCFRS-2026-76863", rsbsaId: "04-01-04-076-906240", membershipFee: 300, membershipFeeDatePaid: "2026-06-15", membershipFeeReference: "REF-44428888", hasCv: false, hasFarmPhoto: false, hasShareCert: true, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1043", name: "Editha V. Sarto", email: "editha.sarto@yahoo.com", requiredShareCapital: 12500, joinedDate: "2025-04-15", status: "Active", address: "Purok 7, Brgy. Cadiz, Pamplona, Camarines Sur", mobileNumber: "09657926226", ncfrsId: "NCFRS-2025-90753", rsbsaId: "05-04-13-358-963966", membershipFee: 300, membershipFeeDatePaid: "2025-04-17", membershipFeeReference: "REF-99236106", hasCv: true, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1044", name: "Flordeliza L. Bonto", email: "flordeliza.bonto@gmail.com", requiredShareCapital: 20000, joinedDate: "2024-06-01", status: "Active", address: "Purok 4, Brgy. Danawan, Pasacao, Camarines Sur", mobileNumber: "09751008489", ncfrsId: "NCFRS-2024-14989", rsbsaId: "04-16-16-555-509178", membershipFee: 300, membershipFeeDatePaid: "2024-06-03", membershipFeeReference: "REF-62838015", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1045", name: "Eduardo C. Bordado", email: "eduardo.bordado@gmail.com", requiredShareCapital: 25000, joinedDate: "2025-11-24", status: "Active", address: "Purok 6, Brgy. Pinit, Sipocot, Camarines Sur", mobileNumber: "09452766304", ncfrsId: "NCFRS-2025-40858", rsbsaId: "04-07-11-904-402725", membershipFee: 300, membershipFeeDatePaid: "2025-11-26", membershipFeeReference: "REF-72108802", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "BOCOFAC Youth Wing" },
  { id: "M-1046", name: "Armando B. Buensalido", email: "armando.buensalido@yahoo.com", requiredShareCapital: 10000, joinedDate: "2024-05-13", status: "Active", address: "Purok 2, Brgy. Pangpang, Cabusao, Camarines Sur", mobileNumber: "09450177601", ncfrsId: "NCFRS-2024-64881", rsbsaId: "04-05-17-224-818535", membershipFee: 300, membershipFeeDatePaid: "2024-05-16", membershipFeeReference: "REF-35317531", hasCv: true, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: "Sitio Torens Farmers Association" },
  { id: "M-1047", name: "Bienvenido O. Villaruel", email: "bienvenido.villaruel@gmail.com", requiredShareCapital: 10000, joinedDate: "2024-05-05", status: "Active", address: "Purok 6, Brgy. Tarum, Cabusao, Camarines Sur", mobileNumber: "09754733669", ncfrsId: "NCFRS-2024-25753", rsbsaId: "04-10-03-982-181930", membershipFee: 300, membershipFeeDatePaid: "2024-05-05", membershipFeeReference: "REF-17310387", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1048", name: "Erlinda S. Villaruel", email: "erlinda.villaruel@yahoo.com", requiredShareCapital: 15000, joinedDate: "2026-05-20", status: "Active", address: "Purok 7, Brgy. Del Rosario, Cabusao, Camarines Sur", mobileNumber: "09351007684", ncfrsId: "NCFRS-2026-39374", rsbsaId: "02-19-20-348-952205", membershipFee: 300, membershipFeeDatePaid: "2026-05-21", membershipFeeReference: "REF-88541013", hasCv: true, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: "BOCOFAC Youth Wing" },
  { id: "M-1049", name: "Alfredo W. Reonal", email: "alfredo.reonal@gmail.com", requiredShareCapital: 4000, joinedDate: "2024-03-23", status: "Active", address: "Purok 6, Brgy. San Rafael, Del Gallego, Camarines Sur", mobileNumber: "09209146127", ncfrsId: "NCFRS-2024-05560", rsbsaId: "02-02-11-376-616815", membershipFee: 300, membershipFeeDatePaid: "2024-03-23", membershipFeeReference: "REF-50238877", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1050", name: "Domingo A. Rebong", email: "domingo.rebong@gmail.com", requiredShareCapital: 25000, joinedDate: "2025-04-27", status: "Delinquent", address: "Purok 7, Brgy. South Villazar, Sipocot, Camarines Sur", mobileNumber: "09657294217", ncfrsId: "NCFRS-2025-39705", rsbsaId: "04-17-03-757-822407", membershipFee: 300, membershipFeeDatePaid: "2025-04-27", membershipFeeReference: "REF-87706001", hasCv: true, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: null },
  { id: "M-1051", name: "Rodrigo Y. Salamat", email: "rodrigo.salamat@outlook.com", requiredShareCapital: 10000, joinedDate: "2025-09-19", status: "Active", address: "Purok 5, Brgy. Sagrada Familia, Del Gallego, Camarines Sur", mobileNumber: "09752887203", ncfrsId: "NCFRS-2025-10761", rsbsaId: "05-06-04-241-522813", membershipFee: 300, membershipFeeDatePaid: "2025-09-22", membershipFeeReference: "REF-73058884", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Barangay Agri Council" },
  { id: "M-1052", name: "Eduardo Y. Rebong", email: "eduardo.rebong@outlook.com", requiredShareCapital: 25000, joinedDate: "2025-06-29", status: "Active", address: "Purok 6, Brgy. North Villazar, Cabusao, Camarines Sur", mobileNumber: "09659651472", ncfrsId: "NCFRS-2025-60523", rsbsaId: "05-20-03-787-315639", membershipFee: 300, membershipFeeDatePaid: "2025-07-02", membershipFeeReference: "REF-97075630", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1053", name: "Lourdes X. Dalisay", email: "lourdes.dalisay@outlook.com", requiredShareCapital: 10000, joinedDate: "2026-03-07", status: "Active", address: "Purok 7, Brgy. Quipia, Pamplona, Camarines Sur", mobileNumber: "09650673077", ncfrsId: "NCFRS-2026-80566", rsbsaId: "03-03-07-882-666485", membershipFee: 300, membershipFeeDatePaid: "2026-03-09", membershipFeeReference: "REF-48267140", hasCv: true, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: null },
  { id: "M-1054", name: "Nestor K. Fajardo", email: "nestor.fajardo@gmail.com", requiredShareCapital: 6000, joinedDate: "2024-01-28", status: "Active", address: "Purok 1, Brgy. Pangpang, Sipocot, Camarines Sur", mobileNumber: "09181215025", ncfrsId: "NCFRS-2024-52776", rsbsaId: "02-09-05-251-968726", membershipFee: 300, membershipFeeDatePaid: "2024-01-29", membershipFeeReference: "REF-43109070", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "BOCOFAC Youth Wing" },
  { id: "M-1055", name: "Benjamin H. Bermundo", email: "benjamin.bermundo@gmail.com", requiredShareCapital: 6000, joinedDate: "2024-10-28", status: "Delinquent", address: "Purok 2, Brgy. Cadiz, Del Gallego, Camarines Sur", mobileNumber: "09208838827", ncfrsId: "NCFRS-2024-55795", rsbsaId: "01-09-01-643-085925", membershipFee: 300, membershipFeeDatePaid: "2024-10-31", membershipFeeReference: "REF-99808543", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1056", name: "Cesar M. Casin", email: "cesar.casin@outlook.com", requiredShareCapital: 4000, joinedDate: "2024-08-01", status: "Active", address: "Purok 3, Brgy. Pinit, Pasacao, Camarines Sur", mobileNumber: "09182209300", ncfrsId: "NCFRS-2024-20166", rsbsaId: "01-02-16-482-188685", membershipFee: 300, membershipFeeDatePaid: "2024-08-03", membershipFeeReference: "REF-42584333", hasCv: false, hasFarmPhoto: true, hasShareCert: false, civicOrgAffiliation: "Camarines Sur Coconut Growers Assoc." },
  { id: "M-1057", name: "Bienvenido O. Peralta", email: "bienvenido.peralta@gmail.com", requiredShareCapital: 7500, joinedDate: "2024-03-20", status: "Delinquent", address: "Purok 6, Brgy. Malaguico, Del Gallego, Camarines Sur", mobileNumber: "09355937331", ncfrsId: "NCFRS-2024-27192", rsbsaId: "03-07-09-485-530906", membershipFee: 300, membershipFeeDatePaid: "2024-03-21", membershipFeeReference: "REF-30092138", hasCv: true, hasFarmPhoto: false, hasShareCert: false, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1058", name: "Nestor O. Belga", email: "nestor.belga@gmail.com", requiredShareCapital: 6000, joinedDate: "2026-06-24", status: "Active", address: "Purok 6, Brgy. Danawan, Pasacao, Camarines Sur", mobileNumber: "09658643722", ncfrsId: "NCFRS-2026-00174", rsbsaId: "01-02-13-086-363941", membershipFee: 300, membershipFeeDatePaid: "2026-06-24", membershipFeeReference: "REF-98729504", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Camarines Sur Coconut Growers Assoc." },
  { id: "M-1059", name: "Zenaida C. Rosales", email: "zenaida.rosales@yahoo.com", requiredShareCapital: 7500, joinedDate: "2024-03-02", status: "Active", address: "Purok 1, Brgy. Lipilip, Del Gallego, Camarines Sur", mobileNumber: "09759141117", ncfrsId: "NCFRS-2024-48065", rsbsaId: "05-10-09-803-981227", membershipFee: 300, membershipFeeDatePaid: "2024-03-04", membershipFeeReference: "REF-83939361", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Sitio Torens Farmers Association" },
  { id: "M-1060", name: "Erlinda O. Salamat", email: "erlinda.salamat@outlook.com", requiredShareCapital: 25000, joinedDate: "2024-03-15", status: "Active", address: "Purok 7, Brgy. Sagrada Familia, Libmanan, Camarines Sur", mobileNumber: "09186299016", ncfrsId: "NCFRS-2024-82895", rsbsaId: "01-10-13-667-030306", membershipFee: 300, membershipFeeDatePaid: "2024-03-15", membershipFeeReference: "REF-41655302", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1061", name: "Milagros J. Bermundo", email: "milagros.bermundo@yahoo.com", requiredShareCapital: 5000, joinedDate: "2024-05-22", status: "Active", address: "Purok 5, Brgy. North Villazar, Cabusao, Camarines Sur", mobileNumber: "09197026861", ncfrsId: "NCFRS-2024-12183", rsbsaId: "02-11-11-028-903418", membershipFee: 300, membershipFeeDatePaid: "2024-05-23", membershipFeeReference: "REF-74757387", hasCv: true, hasFarmPhoto: false, hasShareCert: true, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1062", name: "Editha B. Fortuna", email: "editha.fortuna@outlook.com", requiredShareCapital: 25000, joinedDate: "2026-03-02", status: "Active", address: "Purok 7, Brgy. Sagrada Familia, Pamplona, Camarines Sur", mobileNumber: "09558640737", ncfrsId: "NCFRS-2026-63375", rsbsaId: "02-02-10-387-027615", membershipFee: 300, membershipFeeDatePaid: "2026-03-02", membershipFeeReference: "REF-62504901", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1063", name: "Herminia Y. Vergara", email: "herminia.vergara@outlook.com", requiredShareCapital: 15000, joinedDate: "2024-06-23", status: "Delinquent", address: "Purok 7, Brgy. Bagacay, Pamplona, Camarines Sur", mobileNumber: "09551316606", ncfrsId: "NCFRS-2024-44563", rsbsaId: "01-13-04-943-595201", membershipFee: 300, membershipFeeDatePaid: "2024-06-26", membershipFeeReference: "REF-98469156", hasCv: true, hasFarmPhoto: false, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1064", name: "Remedios A. Espiritu", email: "remedios.espiritu@gmail.com", requiredShareCapital: 10000, joinedDate: "2025-02-08", status: "Active", address: "Purok 4, Brgy. San Miguel, Pamplona, Camarines Sur", mobileNumber: "09651650124", ncfrsId: "NCFRS-2025-00242", rsbsaId: "04-16-18-276-656890", membershipFee: 300, membershipFeeDatePaid: "2025-02-09", membershipFeeReference: "REF-15704114", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1065", name: "Ricardo P. Sarto", email: "ricardo.sarto@gmail.com", requiredShareCapital: 5000, joinedDate: "2025-06-24", status: "Active", address: "Purok 7, Brgy. Amtic, Libmanan, Camarines Sur", mobileNumber: "09192412526", ncfrsId: "NCFRS-2025-03593", rsbsaId: "04-01-19-318-249436", membershipFee: 300, membershipFeeDatePaid: "2025-06-24", membershipFeeReference: "REF-44122894", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1066", name: "Corazon Q. Buban", email: "corazon.buban@gmail.com", requiredShareCapital: 25000, joinedDate: "2026-07-20", status: "Active", address: "Purok 2, Brgy. Quipia, Pamplona, Camarines Sur", mobileNumber: "09185487753", ncfrsId: "NCFRS-2026-27102", rsbsaId: "04-13-08-875-462802", membershipFee: 300, membershipFeeDatePaid: "2026-07-23", membershipFeeReference: "REF-85375738", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "4-H Club Sipocot Chapter" },
  { id: "M-1067", name: "Efren I. Odiao", email: "efren.odiao@gmail.com", requiredShareCapital: 7500, joinedDate: "2025-03-01", status: "Active", address: "Purok 5, Brgy. Bagacay, Cabusao, Camarines Sur", mobileNumber: "09552244318", ncfrsId: "NCFRS-2025-62183", rsbsaId: "02-15-04-232-310532", membershipFee: 300, membershipFeeDatePaid: "2025-03-03", membershipFeeReference: "REF-27397129", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Sitio Torens Farmers Association" },
  { id: "M-1068", name: "Rustico E. Sales", email: "rustico.sales@gmail.com", requiredShareCapital: 15000, joinedDate: "2025-02-17", status: "Active", address: "Purok 3, Brgy. Bagacay, Cabusao, Camarines Sur", mobileNumber: "09958726516", ncfrsId: "NCFRS-2025-33749", rsbsaId: "05-20-12-228-742051", membershipFee: 300, membershipFeeDatePaid: "2025-02-20", membershipFeeReference: "REF-68324141", hasCv: false, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: null },
  { id: "M-1069", name: "Rodel L. Bragais", email: "rodel.bragais@yahoo.com", requiredShareCapital: 4000, joinedDate: "2024-11-03", status: "Active", address: "Purok 4, Brgy. Amtic, Pasacao, Camarines Sur", mobileNumber: "09656439330", ncfrsId: "NCFRS-2024-02526", rsbsaId: "03-10-10-518-027935", membershipFee: 300, membershipFeeDatePaid: "2024-11-04", membershipFeeReference: "REF-40990607", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "Camarines Sur Coconut Growers Assoc." },
  { id: "M-1070", name: "Rustico J. Sales", email: "rustico.sales@outlook.com", requiredShareCapital: 6000, joinedDate: "2026-01-20", status: "Active", address: "Purok 7, Brgy. Danawan, Sipocot, Camarines Sur", mobileNumber: "09180303963", ncfrsId: "NCFRS-2026-98281", rsbsaId: "05-05-12-581-866474", membershipFee: 300, membershipFeeDatePaid: "2026-01-21", membershipFeeReference: "REF-99276715", hasCv: true, hasFarmPhoto: true, hasShareCert: true, civicOrgAffiliation: "BOCOFAC Youth Wing" },
];

const LEDGER = [
  { id: 'TXN-7001', memberId: 'M-1021', paymentDate: '2024-03-12', amount: 5000, referenceId: 'REF-00192837', paymentMethod: 'GCash', status: 'Verified', verifiedAt: '2024-03-13' },
  { id: 'TXN-7002', memberId: 'M-1021', paymentDate: '2024-09-15', amount: 5000, referenceId: 'REF-00832104', paymentMethod: 'GCash', status: 'Verified', verifiedAt: '2024-09-16' },
  { id: 'TXN-7003', memberId: 'M-1022', paymentDate: '2024-05-18', amount: 3000, referenceId: 'REF-00948371', paymentMethod: 'Bank Transfer', status: 'Verified', verifiedAt: '2024-05-19' },
  { id: 'TXN-7004', memberId: 'M-1022', paymentDate: '2025-06-11', amount: 3000, referenceId: 'REF-00103986', paymentMethod: 'GCash', status: 'Verified', verifiedAt: '2025-06-12' },
  { id: 'TXN-7005', memberId: 'M-1023', paymentDate: '2025-01-20', amount: 10000, referenceId: 'REF-00448209', paymentMethod: 'Over-the-Counter', status: 'Verified', verifiedAt: '2025-01-20' },

  // Contribution history for the additional members above.
  { id: "TXN-7100", memberId: "M-1026", paymentDate: "2026-05-02", amount: 3500, referenceId: "REF-20353841", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-05-03" },
  { id: "TXN-7101", memberId: "M-1026", paymentDate: "2026-08-15", amount: 3500, referenceId: "REF-15038336", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-08-16" },
  { id: "TXN-7102", memberId: "M-1027", paymentDate: "2025-10-19", amount: 3000, referenceId: "REF-82622085", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2025-10-20" },
  { id: "TXN-7103", memberId: "M-1027", paymentDate: "2026-01-28", amount: 3000, referenceId: "REF-17993165", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-01-29" },
  { id: "TXN-7104", memberId: "M-1027", paymentDate: "2026-02-27", amount: 2500, referenceId: "REF-91006620", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2026-02-28" },
  { id: "TXN-7105", memberId: "M-1029", paymentDate: "2025-02-04", amount: 4000, referenceId: "REF-55720484", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-02-05" },
  { id: "TXN-7106", memberId: "M-1029", paymentDate: "2025-03-07", amount: 3500, referenceId: "REF-58460409", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-03-08" },
  { id: "TXN-7107", memberId: "M-1029", paymentDate: "2025-07-29", amount: 4000, referenceId: "REF-12660837", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-07-30" },
  { id: "TXN-7108", memberId: "M-1029", paymentDate: "2025-12-18", amount: 3500, referenceId: "REF-64876022", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2025-12-19" },
  { id: "TXN-7109", memberId: "M-1030", paymentDate: "2024-10-28", amount: 2000, referenceId: "REF-31712245", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2024-10-29" },
  { id: "TXN-7110", memberId: "M-1032", paymentDate: "2026-09-03", amount: 10000, referenceId: "REF-16860446", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-09-04" },
  { id: "TXN-7111", memberId: "M-1033", paymentDate: "2024-08-14", amount: 11500, referenceId: "REF-74951171", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-08-15" },
  { id: "TXN-7112", memberId: "M-1036", paymentDate: "2024-10-16", amount: 3500, referenceId: "REF-37084573", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2024-10-17" },
  { id: "TXN-7113", memberId: "M-1036", paymentDate: "2025-03-07", amount: 3500, referenceId: "REF-39337240", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-03-08" },
  { id: "TXN-7114", memberId: "M-1037", paymentDate: "2025-03-13", amount: 5000, referenceId: "REF-79056778", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2025-03-14" },
  { id: "TXN-7115", memberId: "M-1038", paymentDate: "2026-06-13", amount: 5000, referenceId: "REF-92164548", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2026-06-14" },
  { id: "TXN-7116", memberId: "M-1039", paymentDate: "2025-01-17", amount: 1500, referenceId: "REF-71093736", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-01-18" },
  { id: "TXN-7117", memberId: "M-1039", paymentDate: "2025-05-30", amount: 2000, referenceId: "REF-20610057", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-05-31" },
  { id: "TXN-7118", memberId: "M-1039", paymentDate: "2025-09-02", amount: 1500, referenceId: "REF-88560528", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-09-03" },
  { id: "TXN-7119", memberId: "M-1040", paymentDate: "2026-01-18", amount: 1000, referenceId: "REF-48134145", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2026-01-19" },
  { id: "TXN-7120", memberId: "M-1040", paymentDate: "2026-03-02", amount: 1000, referenceId: "REF-25018055", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2026-03-03" },
  { id: "TXN-7121", memberId: "M-1040", paymentDate: "2026-04-29", amount: 1000, referenceId: "REF-48848578", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-04-30" },
  { id: "TXN-7122", memberId: "M-1040", paymentDate: "2026-09-18", amount: 500, referenceId: "REF-95289933", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2026-09-19" },
  { id: "TXN-7123", memberId: "M-1041", paymentDate: "2025-02-09", amount: 1000, referenceId: "REF-92167456", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-02-10" },
  { id: "TXN-7124", memberId: "M-1041", paymentDate: "2025-06-08", amount: 1000, referenceId: "REF-59117062", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2025-06-09" },
  { id: "TXN-7125", memberId: "M-1041", paymentDate: "2025-09-05", amount: 1500, referenceId: "REF-89505503", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-09-06" },
  { id: "TXN-7126", memberId: "M-1041", paymentDate: "2026-01-13", amount: 1000, referenceId: "REF-84080917", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-01-14" },
  { id: "TXN-7127", memberId: "M-1043", paymentDate: "2025-05-31", amount: 1500, referenceId: "REF-86562250", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-06-01" },
  { id: "TXN-7128", memberId: "M-1043", paymentDate: "2025-10-24", amount: 2000, referenceId: "REF-65457471", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-10-25" },
  { id: "TXN-7129", memberId: "M-1043", paymentDate: "2026-01-10", amount: 1500, referenceId: "REF-32973034", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-01-11" },
  { id: "TXN-7130", memberId: "M-1044", paymentDate: "2024-07-28", amount: 6500, referenceId: "REF-76867556", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-07-29" },
  { id: "TXN-7131", memberId: "M-1044", paymentDate: "2024-09-22", amount: 6000, referenceId: "REF-28924593", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-09-23" },
  { id: "TXN-7132", memberId: "M-1045", paymentDate: "2026-01-01", amount: 25000, referenceId: "REF-72969837", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-01-02" },
  { id: "TXN-7133", memberId: "M-1046", paymentDate: "2024-06-06", amount: 8000, referenceId: "REF-15049658", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2024-06-07" },
  { id: "TXN-7134", memberId: "M-1047", paymentDate: "2024-09-18", amount: 4000, referenceId: "REF-92518739", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2024-09-19" },
  { id: "TXN-7135", memberId: "M-1047", paymentDate: "2024-10-25", amount: 3500, referenceId: "REF-74117844", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-10-26" },
  { id: "TXN-7136", memberId: "M-1048", paymentDate: "2026-09-18", amount: 3500, referenceId: "REF-54122874", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2026-09-19" },
  { id: "TXN-7137", memberId: "M-1049", paymentDate: "2024-06-18", amount: 2000, referenceId: "REF-75797870", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-06-19" },
  { id: "TXN-7138", memberId: "M-1049", paymentDate: "2024-07-22", amount: 1500, referenceId: "REF-82349930", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-07-23" },
  { id: "TXN-7139", memberId: "M-1051", paymentDate: "2026-02-06", amount: 1000, referenceId: "REF-20740669", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-02-07" },
  { id: "TXN-7140", memberId: "M-1051", paymentDate: "2026-05-23", amount: 1000, referenceId: "REF-48522529", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-05-24" },
  { id: "TXN-7141", memberId: "M-1051", paymentDate: "2026-08-01", amount: 1500, referenceId: "REF-97955427", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-08-02" },
  { id: "TXN-7142", memberId: "M-1052", paymentDate: "2025-07-28", amount: 8000, referenceId: "REF-48245266", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-07-29" },
  { id: "TXN-7143", memberId: "M-1052", paymentDate: "2025-10-20", amount: 8000, referenceId: "REF-89625633", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-10-21" },
  { id: "TXN-7144", memberId: "M-1052", paymentDate: "2026-02-23", amount: 8000, referenceId: "REF-88806766", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2026-02-24" },
  { id: "TXN-7145", memberId: "M-1053", paymentDate: "2026-04-23", amount: 8500, referenceId: "REF-13638043", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-04-24" },
  { id: "TXN-7146", memberId: "M-1054", paymentDate: "2024-03-08", amount: 4000, referenceId: "REF-94838520", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-03-09" },
  { id: "TXN-7147", memberId: "M-1056", paymentDate: "2024-10-06", amount: 500, referenceId: "REF-84436181", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-10-07" },
  { id: "TXN-7148", memberId: "M-1056", paymentDate: "2025-02-15", amount: 500, referenceId: "REF-79232857", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-02-16" },
  { id: "TXN-7149", memberId: "M-1056", paymentDate: "2025-04-23", amount: 1000, referenceId: "REF-77202703", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2025-04-24" },
  { id: "TXN-7150", memberId: "M-1056", paymentDate: "2025-05-22", amount: 500, referenceId: "REF-96903167", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-05-23" },
  { id: "TXN-7151", memberId: "M-1057", paymentDate: "2024-04-30", amount: 1500, referenceId: "REF-14224138", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2024-05-01" },
  { id: "TXN-7152", memberId: "M-1059", paymentDate: "2024-06-13", amount: 1000, referenceId: "REF-67175909", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2024-06-14" },
  { id: "TXN-7153", memberId: "M-1059", paymentDate: "2024-08-19", amount: 1000, referenceId: "REF-80526229", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-08-20" },
  { id: "TXN-7154", memberId: "M-1059", paymentDate: "2024-12-19", amount: 1000, referenceId: "REF-51299495", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-12-20" },
  { id: "TXN-7155", memberId: "M-1059", paymentDate: "2025-02-17", amount: 500, referenceId: "REF-46784286", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-02-18" },
  { id: "TXN-7156", memberId: "M-1060", paymentDate: "2024-06-04", amount: 7500, referenceId: "REF-72235177", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-06-05" },
  { id: "TXN-7157", memberId: "M-1060", paymentDate: "2024-06-29", amount: 7500, referenceId: "REF-36070720", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2024-06-30" },
  { id: "TXN-7158", memberId: "M-1060", paymentDate: "2024-08-31", amount: 7000, referenceId: "REF-82870919", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2024-09-01" },
  { id: "TXN-7159", memberId: "M-1061", paymentDate: "2024-07-25", amount: 1500, referenceId: "REF-94413988", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-07-26" },
  { id: "TXN-7160", memberId: "M-1061", paymentDate: "2024-09-10", amount: 1500, referenceId: "REF-70461255", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-09-11" },
  { id: "TXN-7161", memberId: "M-1061", paymentDate: "2024-11-15", amount: 1500, referenceId: "REF-38930467", paymentMethod: "GCash", status: "Verified", verifiedAt: "2024-11-16" },
  { id: "TXN-7162", memberId: "M-1062", paymentDate: "2026-04-21", amount: 12500, referenceId: "REF-24182504", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-04-22" },
  { id: "TXN-7163", memberId: "M-1062", paymentDate: "2026-08-10", amount: 12000, referenceId: "REF-50512728", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-08-11" },
  { id: "TXN-7164", memberId: "M-1064", paymentDate: "2025-04-28", amount: 6000, referenceId: "REF-97446590", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-04-29" },
  { id: "TXN-7165", memberId: "M-1065", paymentDate: "2025-10-08", amount: 1000, referenceId: "REF-28000208", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-10-09" },
  { id: "TXN-7166", memberId: "M-1065", paymentDate: "2025-11-09", amount: 1000, referenceId: "REF-46270919", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-11-10" },
  { id: "TXN-7167", memberId: "M-1065", paymentDate: "2026-02-20", amount: 1500, referenceId: "REF-45652694", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-02-21" },
  { id: "TXN-7168", memberId: "M-1065", paymentDate: "2026-05-06", amount: 1000, referenceId: "REF-11725025", paymentMethod: "Bank Transfer", status: "Verified", verifiedAt: "2026-05-07" },
  { id: "TXN-7169", memberId: "M-1066", paymentDate: "2026-08-16", amount: 6000, referenceId: "REF-29623969", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2026-08-17" },
  { id: "TXN-7170", memberId: "M-1067", paymentDate: "2025-05-22", amount: 1500, referenceId: "REF-80853576", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-05-23" },
  { id: "TXN-7171", memberId: "M-1067", paymentDate: "2025-06-16", amount: 1500, referenceId: "REF-26131537", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-06-17" },
  { id: "TXN-7172", memberId: "M-1067", paymentDate: "2025-11-09", amount: 1500, referenceId: "REF-80793870", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-11-10" },
  { id: "TXN-7173", memberId: "M-1067", paymentDate: "2026-02-17", amount: 1500, referenceId: "REF-50326111", paymentMethod: "GCash", status: "Verified", verifiedAt: "2026-02-18" },
  { id: "TXN-7174", memberId: "M-1068", paymentDate: "2025-04-01", amount: 4000, referenceId: "REF-13617723", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-04-02" },
  { id: "TXN-7175", memberId: "M-1068", paymentDate: "2025-05-17", amount: 4000, referenceId: "REF-56750712", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-05-18" },
  { id: "TXN-7176", memberId: "M-1068", paymentDate: "2025-07-26", amount: 4000, referenceId: "REF-10672451", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-07-27" },
  { id: "TXN-7177", memberId: "M-1069", paymentDate: "2025-03-12", amount: 1000, referenceId: "REF-40281549", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2025-03-13" },
  { id: "TXN-7178", memberId: "M-1069", paymentDate: "2025-05-11", amount: 500, referenceId: "REF-47158862", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-05-12" },
  { id: "TXN-7179", memberId: "M-1069", paymentDate: "2025-09-01", amount: 1000, referenceId: "REF-28568664", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-09-02" },
  { id: "TXN-7180", memberId: "M-1069", paymentDate: "2025-12-14", amount: 500, referenceId: "REF-95001134", paymentMethod: "GCash", status: "Verified", verifiedAt: "2025-12-15" },
  { id: "TXN-7181", memberId: "M-1070", paymentDate: "2026-02-11", amount: 4000, referenceId: "REF-71983851", paymentMethod: "Over-the-Counter", status: "Verified", verifiedAt: "2026-02-12" },
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
        `INSERT INTO members (
           id, name, email, required_share_capital, joined_date, status,
           address, mobile_number, ncfrs_id, rsbsa_id,
           membership_fee, membership_fee_date_paid, membership_fee_reference,
           has_cv, has_farm_photo, has_share_cert, civic_org_affiliation
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO NOTHING`,
        [
          m.id, m.name, m.email, m.requiredShareCapital, m.joinedDate, m.status,
          m.address || null, m.mobileNumber || null, m.ncfrsId || null, m.rsbsaId || null,
          m.membershipFee ?? 300, m.membershipFeeDatePaid || null, m.membershipFeeReference || null,
          m.hasCv ?? false, m.hasFarmPhoto ?? false, m.hasShareCert ?? false, m.civicOrgAffiliation || null,
        ]
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
