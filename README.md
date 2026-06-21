# PinWay — Sender-Controlled PIN Payment Platform

> **U.S. Patent Pending (Provisional Application Filed 2026)**
> Strategic acquisition inquiries: **LuminarkMeridian@gmail.com**

---

PinWay is a production-ready, white-label fintech platform for issuing controlled PIN-based payments on existing Visa/Mastercard prepaid rails. No recipient account, app, or smartphone required. Sender retains full post-transmission control until the moment of redemption.

## Core Differentiators

| Capability | PinWay | Western Union | Venmo/Zelle | Prepaid Card |
|---|---|---|---|---|
| No recipient account required | ✅ | ❌ Agent visit | ❌ Mandatory | ❌ Activation |
| No recipient smartphone required | ✅ | ✅ | ❌ | ✅ |
| Sender can revoke after sending | ✅ | ❌ | ❌ | ❌ |
| Sender can modify amount post-send | ✅ | ❌ | ❌ | ❌ |
| MCC / geographic spend controls | ✅ | ❌ | ❌ | ❌ |
| Runs on existing Visa/MC rails | ✅ | ❌ Proprietary | ✅ | ✅ |

## Use Cases

- **Gig economy** — instant contractor payouts without requiring bank accounts
- **Insurance** — claim disbursements with spend category controls
- **Disaster relief** — funds distributed via basic phone or landline
- **Unbanked populations** — 22M+ U.S. adults served without onboarding friction
- **Corporate expense** — controlled per-employee spend with MCC locks

## How It Works

1. Sender deposits funds → system generates a CSPRNG PIN (bcrypt hashed, never stored plaintext)
2. PIN delivered to recipient via SMS, voice call, or email
3. Recipient enters PIN at any standard POS terminal or online
4. Virtual Visa/MC card provisioned just-in-time at PIN validation
5. Sender retains control at every step: freeze, rotate, revoke, or modify amount

## Security Architecture

- CSPRNG PIN generation (Node.js `crypto.randomInt` — NIST SP 800-90A)
- bcrypt hashing at 10+ rounds — PIN plaintext destroyed after single transmission
- PCI-PIN 18-3 compliant architecture — HSM-ready (AWS CloudHSM / Azure / PKCS#11)
- Immutable audit log — DELETE privilege revoked at database level
- Rate limiting on all endpoints; strict brute-force lockout on redemption
- Constant-time PIN comparison (timing attack prevention)
- Always-blocked MCCs: alcohol (5921), gambling (7995), tobacco (5993), adult services

## Tech Stack

```
Backend:    Node.js 20 + Express + PostgreSQL
Frontend:   React 18 + Vite + Tailwind
Auth:       JWT + bcrypt
SMS/Email:  Twilio + SendGrid
Deploy:     Docker + Railway (railway.toml included)
HSM:        AWS KMS / Azure Key Vault / PKCS#11 (configurable)
```

## Quick Start

```bash
git clone https://github.com/foreverforward760-crypto/PinWay
cd PinWay/server
cp ../.env.example .env    # fill in JWT_SECRET + DATABASE_URL (or DB_* vars)
npm install
npm run migrate
npm start
```

**Deploy to Railway in 15 minutes:** see [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)

## Repository Structure

```
/
├── server/              # Node.js API (Express + PostgreSQL)
│   ├── config/          # DB pool, logger, env validation
│   ├── middleware/       # JWT auth
│   ├── migrations/       # PostgreSQL schema
│   ├── routes/           # pins, transactions, auth, contacts
│   └── services/         # PIN crypto, MCC enforcement, notifications
├── src/                 # React 18 frontend
├── railway.toml         # Railway deployment config
├── docker-compose.yml   # Local full-stack dev
└── DEPLOY_RAILWAY.md    # Step-by-step deployment guide
```

## Acquisition / Licensing

This repository represents the full production codebase for a patent-pending payment technology. Available for:

- **Full IP acquisition** — patent rights + codebase + documentation
- **White-label licensing** — exclusive or non-exclusive
- **Strategic partnership** — revenue share or joint venture

**Contact:** LuminarkMeridian@gmail.com
**Represented by:** Richard L. Stanfield — Meridian Axiom Alignment Technologies LLC, St. Petersburg, FL

---

© 2026 Meridian Axiom Alignment Technologies LLC. All rights reserved.
Patent pending. Not licensed for production use without written authorization.
