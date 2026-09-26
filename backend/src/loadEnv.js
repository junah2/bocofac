const path = require('path');
const dotenv = require('dotenv');

// Local dev settings live in backend/.env.local, not backend/.env: `firebase
// deploy` uploads a plain `.env` from the functions source folder as the live
// function's config, which would ship local secrets and localhost URLs to
// production. `*.local` files are never uploaded. Production config comes
// from .env.bocofac-ad6b4 (non-secret) and Firebase secrets instead.
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
