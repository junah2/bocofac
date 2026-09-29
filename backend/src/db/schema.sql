CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS ledger_id_seq START 7000;
CREATE SEQUENCE IF NOT EXISTS applicant_id_seq START 900;
CREATE SEQUENCE IF NOT EXISTS order_id_seq START 500;
CREATE SEQUENCE IF NOT EXISTS session_id_seq START 300;
CREATE SEQUENCE IF NOT EXISTS product_id_seq START 20;
CREATE SEQUENCE IF NOT EXISTS withdrawal_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS notification_id_seq START 1;

-- [DATABASE] Mga member ng coop at required share capital nila
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  required_share_capital NUMERIC(12,2) NOT NULL DEFAULT 10000,
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Delinquent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS ncfrs_id TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS rsbsa_id TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_fee NUMERIC(12,2) NOT NULL DEFAULT 300.00;
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_fee_date_paid DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_fee_reference TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS has_cv BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS has_farm_photo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS has_share_cert BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS farm_profile_notes TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS civic_org_affiliation TEXT;

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN ('Active', 'Delinquent', 'Removed'));

-- [DATABASE] Accounts: password_hash (bcrypt) at role (customer / admin / board)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'board')),
  member_id TEXT REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- [DATABASE] Share capital payments (GCash / Over-the-Counter), Pending hanggang ma-verify
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('GCash', 'Over-the-Counter')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Verified', 'Pending')),
  verified_at DATE,
  verified_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_member_id ON ledger(member_id);
ALTER TABLE ledger DROP CONSTRAINT IF EXISTS ledger_payment_method_check;
UPDATE ledger SET payment_method = 'GCash' WHERE payment_method = 'Bank Transfer';
ALTER TABLE ledger ADD CONSTRAINT ledger_payment_method_check
  CHECK (payment_method IN ('GCash', 'Over-the-Counter'));
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS entered_by INTEGER REFERENCES users(id);
CREATE SEQUENCE IF NOT EXISTS ledger_or_seq START 1;
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS or_number TEXT;

-- [DATABASE] Withdrawal requests ng earnings ng members
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  requested_amount NUMERIC(12,2) NOT NULL CHECK (requested_amount > 0),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Sent', 'Rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_amount NUMERIC(12,2),
  sent_reference TEXT,
  note TEXT,
  processed_by INTEGER REFERENCES users(id),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_member_id ON withdrawals(member_id);
-- [DATABASE] Withdrawal flow: Pending (request) -> Approved (claim sa office) -> Sent (released) / Rejected
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_status_check;
ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_status_check
  CHECK (status IN ('Pending', 'Approved', 'Sent', 'Rejected'));

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('success', 'error', 'info')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- [DATABASE] Membership applications
CREATE TABLE IF NOT EXISTS applicants (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  agricultural_type TEXT,
  farm_size_hectares NUMERIC(6,2),
  address TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'PMES Pending', 'Pending Review', 'Approved', 'Rejected')),
  pmes_attended BOOLEAN NOT NULL DEFAULT false,
  pmes_date DATE,
  registration_fee_paid BOOLEAN NOT NULL DEFAULT false,
  reference_number TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_member_id TEXT REFERENCES members(id),
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  suffix TEXT,
  address_number TEXT,
  street TEXT,
  zone TEXT,
  barangay TEXT,
  mun_city TEXT,
  civil_status TEXT,
  birthdate DATE,
  birthplace TEXT,
  gender TEXT,
  cp_number TEXT,
  occupation TEXT,
  facebook TEXT,
  annual_income NUMERIC(12,2),
  employer TEXT,
  business_owned TEXT,
  tin TEXT,
  religion TEXT,
  spouse_contact_person TEXT,
  spouse_cp_number TEXT,
  no_of_dependents INTEGER NOT NULL DEFAULT 0,
  edu_attainment TEXT,
  educom_chairperson TEXT,
  id_type TEXT,
  id_number TEXT,
  id_date_issued DATE,
  id_place_issued TEXT,
  membership_fee NUMERIC(12,2) NOT NULL DEFAULT 300.00,
  subscribed_share NUMERIC(12,2),
  paid_up_capital NUMERIC(12,2),
  or_number TEXT,
  farm_profile JSONB
);
CREATE INDEX IF NOT EXISTS idx_applicants_email ON applicants(email);

ALTER TABLE applicants ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS suffix TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS zone TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS barangay TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS mun_city TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS civil_status TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS birthplace TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS cp_number TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS facebook TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS annual_income NUMERIC(12,2);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS employer TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS business_owned TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS tin TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS spouse_contact_person TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS spouse_cp_number TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS no_of_dependents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS edu_attainment TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS educom_chairperson TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS id_date_issued DATE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS id_place_issued TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS membership_fee NUMERIC(12,2) NOT NULL DEFAULT 300.00;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS subscribed_share NUMERIC(12,2);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS paid_up_capital NUMERIC(12,2);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS or_number TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS farm_profile JSONB;

ALTER TABLE applicants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE TABLE IF NOT EXISTS applicant_dependents (
  id SERIAL PRIMARY KEY,
  applicant_id TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birthdate DATE,
  age INTEGER,
  sex TEXT
);
CREATE INDEX IF NOT EXISTS idx_applicant_dependents_applicant_id ON applicant_dependents(applicant_id);

CREATE TABLE IF NOT EXISTS applicant_documents (
  id SERIAL PRIMARY KEY,
  applicant_id TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('valid_id', 'registration_fee_receipt', 'pmes_certificate')),
  file_path TEXT NOT NULL,
  original_filename TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(applicant_id, doc_type)
);

ALTER TABLE applicant_documents DROP CONSTRAINT IF EXISTS applicant_documents_doc_type_check;
ALTER TABLE applicant_documents ADD CONSTRAINT applicant_documents_doc_type_check
  CHECK (doc_type IN ('valid_id', 'registration_fee_receipt', 'pmes_certificate'));

-- [DATABASE] PMES seminar schedules (max 40 participants)
CREATE TABLE IF NOT EXISTS pmes_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE,
  time_range TEXT,
  venue TEXT,
  speaker TEXT,
  capacity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Completed', 'Cancelled'))
);
ALTER TABLE pmes_sessions ADD COLUMN IF NOT EXISTS venue TEXT;

CREATE TABLE IF NOT EXISTS pmes_registrations (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES pmes_sessions(id),
  applicant_id TEXT REFERENCES applicants(id),
  member_id TEXT REFERENCES members(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attended BOOLEAN NOT NULL DEFAULT false,
  CHECK (applicant_id IS NOT NULL OR member_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pmes_reg_applicant ON pmes_registrations(session_id, applicant_id) WHERE applicant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pmes_reg_member ON pmes_registrations(session_id, member_id) WHERE member_id IS NOT NULL;

ALTER TABLE pmes_registrations ADD COLUMN IF NOT EXISTS walk_in_name TEXT;
ALTER TABLE pmes_registrations ADD COLUMN IF NOT EXISTS walk_in_email TEXT;
ALTER TABLE pmes_registrations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;
ALTER TABLE pmes_registrations ADD COLUMN IF NOT EXISTS certificate_sent_at TIMESTAMPTZ;

ALTER TABLE pmes_registrations DROP CONSTRAINT IF EXISTS pmes_registrations_check;
ALTER TABLE pmes_registrations DROP CONSTRAINT IF EXISTS pmes_registrations_identity_check;
ALTER TABLE pmes_registrations ADD CONSTRAINT pmes_registrations_identity_check
  CHECK (applicant_id IS NOT NULL OR member_id IS NOT NULL OR (walk_in_name IS NOT NULL AND walk_in_email IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pmes_reg_walkin ON pmes_registrations(session_id, walk_in_email) WHERE walk_in_email IS NOT NULL;

-- [DATABASE] Products at stock (inventory)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Charcoal', 'Fertilizer', 'Fibre & Coir', 'Handicraft')),
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT,
  image TEXT,
  rating NUMERIC(2,1) DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  specifications TEXT[] DEFAULT '{}'
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_group TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_label TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

-- [DATABASE] Orders ng customers (GCash / Cash on Delivery)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  phone TEXT,
  shipping_address TEXT,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('GCash', 'Cash on Delivery')),
  reference_number TEXT,
  payment_receipt_path TEXT,
  status TEXT NOT NULL DEFAULT 'Pending Verification' CHECK (status IN ('Pending Verification', 'Completed')),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Pending Verification', 'Completed', 'Rejected', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
UPDATE orders SET payment_method = 'GCash',
  reference_number = CASE WHEN reference_number ~ '^[0-9]{13}$' THEN reference_number
                          ELSE lpad(floor(random() * 1e13)::bigint::text, 13, '0') END
WHERE payment_method = 'Bank Transfer';
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('GCash', 'Cash on Delivery'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_discount_applied BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id INTEGER REFERENCES users(id),
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB,
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'failure'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at ON audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

CREATE SEQUENCE IF NOT EXISTS conversation_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS message_id_seq START 1;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'admin')),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  body TEXT NOT NULL,
  read_by_customer BOOLEAN NOT NULL DEFAULT false,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- [DATABASE] Petsa kung kailan idinagdag ang product (para hindi ma-flag na slow-moving ang bagong product).
-- Sa mga lumang product: petsa ng unang order nila; kung wala pang order, ngayong araw.
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE products p SET created_at = COALESCE(
  (SELECT MIN(o.ordered_at) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = p.id),
  now()
) WHERE created_at IS NULL;
ALTER TABLE products ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE products ALTER COLUMN created_at SET NOT NULL;
