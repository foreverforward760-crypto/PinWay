# PinWay — Production Setup Guide

## What's Included

```
PinWay-Production/
├── server/                     ← Node.js + Express backend
│   ├── index.js                  Main server entry point
│   ├── config/
│   │   ├── database.js           PostgreSQL connection pool
│   │   └── logger.js             Winston logger
│   ├── middleware/
│   │   └── auth.js               JWT verification middleware
│   ├── routes/
│   │   ├── auth.js               Login / register / me
│   │   ├── pins.js               Create / freeze / revoke / rotate PINs
│   │   ├── transactions.js       POS authorization + transaction history
│   │   └── contacts.js           Contact management
│   ├── services/
│   │   ├── pinService.js         Secure PIN generation (crypto.randomInt)
│   │   ├── mccService.js         MCC + geo restriction engine
│   │   └── notificationService.js  Twilio SMS + SendGrid email
│   ├── migrations/
│   │   └── 001_init.sql          Full database schema
│   ├── Dockerfile
│   └── package.json
│
├── src/                        ← React frontend (updated from your repo)
│   ├── App.jsx                   Full UI — now connected to real API
│   ├── AppShell.jsx              Auth-gate wrapper
│   ├── main.jsx                  App entry point with AuthProvider
│   ├── context/
│   │   └── AuthContext.jsx       JWT auth state management
│   ├── services/
│   │   └── api.js                Fetch-based API client
│   └── pages/
│       └── Login.jsx             Sign in / create account screen
│
├── docker-compose.yml          ← Run entire stack with one command
├── Dockerfile.client           ← Multi-stage React build + Nginx
├── nginx.conf                  ← Production Nginx config
├── .env.example                ← Template for your secrets
└── .gitignore
```

---

## Quick Start (Local Development)

### 1. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your values
```

Minimum required for local dev:
- `JWT_SECRET` — any long random string
- `DB_PASSWORD` — any password you choose
- `TWILIO_*` and `SENDGRID_*` — optional for dev (PIN delivery will be skipped)

### 2. Start with Docker (easiest)

```bash
docker-compose up --build
```

This starts PostgreSQL, the API server, and the frontend all at once.

- Frontend: http://localhost
- API: http://localhost:4000
- API health: http://localhost:4000/health

### 3. Manual setup (without Docker)

**Prerequisites:** Node 18+, PostgreSQL 14+

```bash
# Create the database
createdb pinway
createuser pinway_user
psql pinway -c "GRANT ALL ON DATABASE pinway TO pinway_user;"

# Run migrations
cd server
npm install
node migrations/run.js

# Start the API
npm run dev   # development (hot reload)
npm start     # production

# In a separate terminal — start the frontend
cd ..
npm install
npm run dev
```

---

## Deploying to Production

### Recommended: AWS / DigitalOcean / Render

1. Push your code to GitHub (make sure `.env` is in `.gitignore`)
2. Set environment variables on your hosting platform (use the `.env.example` as a guide)
3. Run `docker-compose up -d` on your server

### Free option: Railway.app

1. Connect your GitHub repo to Railway
2. Add a PostgreSQL plugin
3. Set your environment variables in the Railway dashboard
4. Railway auto-detects and builds your Docker containers

---

## Setting Up Twilio (SMS)

1. Create a free account at https://twilio.com
2. Get your Account SID and Auth Token from the dashboard
3. Buy a phone number ($1/month)
4. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxx
   TWILIO_AUTH_TOKEN=xxxx
   TWILIO_FROM_NUMBER=+1XXXXXXXXXX
   ```

## Setting Up SendGrid (Email)

1. Create a free account at https://sendgrid.com (100 emails/day free)
2. Go to Settings → API Keys → Create API Key
3. Verify your sender email address
4. Add to `.env`:
   ```
   SENDGRID_API_KEY=SG.xxxx
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   ```

---

## Security Checklist Before Launch

- [ ] `JWT_SECRET` is at least 64 random characters
- [ ] `DB_PASSWORD` is strong and unique
- [ ] `.env` is NOT committed to Git
- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is enabled (use Cloudflare or Let's Encrypt)
- [ ] Remove the `- "5432:5432"` port mapping from docker-compose.yml (no external DB access)
- [ ] Set `FRONTEND_URL` to your actual domain in `.env`

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Sign in, get JWT |
| GET | /api/auth/me | Get current user |
| GET | /api/pins | List all your PINs |
| POST | /api/pins | Create a new PIN |
| PATCH | /api/pins/:id/freeze | Freeze/unfreeze |
| PATCH | /api/pins/:id/revoke | Permanently revoke |
| POST | /api/pins/:id/rotate | Issue new PIN number |
| GET | /api/transactions | List transactions |
| POST | /api/transactions/authorize | POS authorization |
| GET | /api/contacts | List contacts |
| POST | /api/contacts | Add contact |

All protected endpoints require: `Authorization: Bearer <token>`
