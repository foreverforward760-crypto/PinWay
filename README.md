# PinWay — Secure PIN-Based Fund Disbursement Platform

> **Controlled payouts for anyone, anywhere.**
> Issue a 16-digit PIN, lock it to specific merchants, a geographic region, and a daily spend cap — then send it via SMS or email in seconds.

---

## What Is PinWay?

PinWay is a **white-label fintech platform** for issuing controlled, rule-based payment PINs without a physical card or bank account. Think of it as a programmable prepaid card delivered as a number.

**Example use cases:**
- Nonprofits distributing disaster relief funds (groceries + pharmacy only, US only)
- Employers paying gig workers (ATM + gas + dining, expires in 12 hours)
- Parents sending money to college students (dining + transport, $50/day cap)
- Travel advances (hotels + transport + ATM, worldwide, 72-hour window)

---

## Security Architecture

### PIN Generation
PINs are generated using Node.js `crypto.randomInt` — a cryptographically secure random number generator (CSPRNG). `Math.random` is never used anywhere in the codebase.

### PIN Storage
PINs are **never stored in plaintext.** The flow is:

```
Raw PIN → bcrypt hash (cost factor 10) → [optional HSM encryption] → Database
```

The raw PIN is returned to the issuer exactly **once** at creation time and is never recoverable from the database thereafter. To re-issue a PIN, the Rotate endpoint generates a brand-new one.

### Hardware Security Module (HSM) Support

PinWay is HSM-ready out of the box. Set `HSM_PROVIDER` in your environment to activate:

| Value | Provider | Notes |
|-------|----------|-------|
| `software` | bcrypt only | Default — suitable for development |
| `aws` | AWS KMS + CloudHSM | Recommended for AWS-hosted deployments |
| `azure` | Azure Key Vault (Dedicated HSM) | Recommended for Azure-hosted deployments |
| `pkcs11` | Any on-prem HSM | Thales, SafeNet, nCipher, etc. |

In HSM mode, the bcrypt hash is additionally encrypted under a hardware-resident master key before being written to the database. This satisfies **PCI PIN Security Requirement 18-3**.

### Fraud Controls
Every transaction is evaluated against:
- **MCC whitelist** — 12 spending categories mapped to 50+ real Merchant Category Codes
- **Geographic restriction** — US-only, US+LatAm, US+Europe, or Worldwide
- **Per-transaction limit** — single charge cap
- **Daily spend limit** — rolling 24-hour cap
- **Use count limit** — PIN auto-locks after N uses
- **Expiration** — PIN becomes void after a configurable number of hours
- **Global blocklist** — alcohol (5921), gambling (7995), tobacco (5993), adult services always blocked regardless of category settings

### Authentication
- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens signed with HS256, configurable expiry
- Constant-time password comparison (prevents timing attacks)
- Aggressive rate limiting on auth endpoints (20 requests / 15 minutes)
- JWT secret validated at startup — server refuses to start with weak or missing secrets

### Audit Logging
Every PIN lifecycle event is written to an append-only `pin_audit_log` table:

```
PIN_CREATED · PIN_ROTATED · PIN_FROZEN · PIN_REVOKED · PIN_EXPIRED
TX_APPROVED · TX_DECLINED · AUTH_LOGIN · AUTH_FAILED
PIN_DELIVERY_SMS · PIN_DELIVERY_EMAIL
```

The `DELETE` privilege on this table is revoked from the application user. Audit rows cannot be purged by application code.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20 + Express 4 |
| Database | PostgreSQL 16 |
| Auth | JWT (jsonwebtoken) + bcrypt |
| PIN Crypto | Node.js crypto.randomInt + bcrypt + HSM |
| SMS | Twilio |
| Email | SendGrid |
| Frontend | React 18 + Vite + Tailwind CSS |
| Containerization | Docker + Docker Compose |
| Web Server | Nginx (production) |

---

## API Reference

All protected endpoints require: `Authorization: Bearer <token>`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in, receive JWT |
| `GET` | `/api/auth/me` | Get current user profile |
| `POST` | `/api/auth/change-password` | Update password |

### PIN Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pins` | List all PINs |
| `POST` | `/api/pins` | Create a new PIN (returns raw PIN once) |
| `GET` | `/api/pins/:id` | Get PIN details + health score |
| `PATCH` | `/api/pins/:id/freeze` | Toggle freeze / unfreeze |
| `PATCH` | `/api/pins/:id/revoke` | Permanently revoke |
| `POST` | `/api/pins/:id/rotate` | Issue a new PIN number |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/transactions` | List transactions (filterable by PIN, type) |
| `POST` | `/api/transactions/authorize` | POS terminal authorization endpoint |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/contacts` | List contacts |
| `POST` | `/api/contacts` | Add contact |
| `PUT` | `/api/contacts/:id` | Update contact |
| `DELETE` | `/api/contacts/:id` | Remove contact |

---

## Compliance Posture

| Requirement | Status |
|-------------|--------|
| PINs stored in plaintext | ✅ Never — bcrypt + optional HSM |
| CSPRNG for PIN generation | ✅ crypto.randomInt |
| PCI PIN 18-3 (HSM key protection) | ✅ AWS/Azure/PKCS#11 adapters included |
| Audit log immutability | ✅ DELETE revoked from app user |
| Rate limiting on auth | ✅ 20 req/15min |
| Weak-secret startup guard | ✅ Server refuses to start |
| HTTPS enforcement | ✅ Validated in production mode |
| Blocklist (alcohol/gambling/tobacco) | ✅ Always-on, not configurable off |
| JWT expiry | ✅ Configurable, default 7 days |

> **Note:** Full PCI-PIN certification requires a third-party Qualified Security Assessor (QSA) audit. This codebase is architected to pass that audit — contact a QSA before processing live transactions at scale.

---

## License & IP

All source code is original and owned by the creator. No third-party licensed components with viral (GPL) licenses are included. All dependencies are MIT or Apache 2.0 licensed.

---

## Quick Start

```bash
cp .env.example .env     # Fill in your secrets
docker-compose up --build
```

See `SETUP.md` for detailed deployment instructions.
