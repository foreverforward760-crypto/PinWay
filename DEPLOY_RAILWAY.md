# PinWay — Deploy to Railway (15 minutes, $0)

## Prerequisites
- Railway account: [railway.app](https://railway.app) — sign up with GitHub (free)

---

## Step 1 — New project from GitHub

1. railway.app → **New Project**
2. → **Deploy from GitHub repo**
3. Select `foreverforward760-crypto/PinWay`
4. Railway detects `railway.toml` and uses `server/Dockerfile` automatically

---

## Step 2 — Add Postgres

1. In your project → **+ New** → **Database** → **Add PostgreSQL**
2. Railway sets `DATABASE_URL` in your service automatically — nothing to configure

---

## Step 3 — Set environment variables

Railway → your backend service → **Variables** tab:

| Variable | Value |
|---|---|
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DEMO_MODE` | `true` |
| `PGSSL` | `true` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Your frontend Railway URL (set after frontend deploys) |

Leave `STRIPE_SECRET_KEY` blank while in demo mode.

---

## Step 4 — Deploy

Railway deploys automatically. Watch the log for:

```
✅  Environment validated [production / DEMO]
Database connection established
PinWay API running on port XXXX [production]
```

Test it:
```bash
curl https://YOUR-URL.up.railway.app/health
# → {"status":"ok","version":"1.0.0","timestamp":"..."}
```

---

## Step 5 — Quick end-to-end test

```bash
BASE=https://YOUR-URL.up.railway.app/api

# Sign up
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@pinway.io","password":"pinway-demo-2026","name":"Demo Sender"}'

# Login
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@pinway.io","password":"pinway-demo-2026"}' | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token")

# Create a PIN ($75, groceries only, 24h)
curl -s -X POST $BASE/pins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":75,"description":"Grocery funds","categories":["groceries"],"geo":"us","maxUses":5,"expirationHours":24,"perTxLimit":75,"dailyLimit":75,"deliveryMethod":"none"}'
```

---

## Step 6 — Upgrading to real Stripe Issuing

When you're ready to show real virtual cards:

1. stripe.com → Settings → Issuing → Enable
2. Create a test cardholder in the Stripe dashboard
3. In Railway Variables:
   - `STRIPE_SECRET_KEY` = `sk_test_...`
   - `STRIPE_TEST_CARDHOLDER_ID` = `ich_...`
   - Remove `DEMO_MODE` (or set to `false`)

Real cards, test mode — no money moves, but actual Visa network flow.
This is the milestone that moves your valuation from $150K to $350K+.

---

## Cost

| Service | Cost |
|---|---|
| Railway free tier | $5/month credit — covers this demo indefinitely |
| Railway Postgres | Included in free tier |
| Stripe Issuing test mode | Free |
| **Total** | **$0** |
