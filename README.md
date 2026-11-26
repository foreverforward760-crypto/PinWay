# PinWay — PIN-Controlled Payment Prototype

**Status: prototype / development project. Not a production payment service.**

PinWay explores a sender-controlled, PIN-based disbursement workflow. The repository contains a React frontend and an Express/PostgreSQL backend with account authentication, PIN generation and hashing, contact management, transaction-rule checks, and transaction records.

## What the code currently contains

- User registration and login using bcrypt password hashes and JWTs.
- Generation of 16-digit PINs using Node.js cryptographic random-number functions.
- PIN hashing with bcrypt.
- Optional SMS and email delivery code.
- Local rule checks for merchant category codes (MCC), country restrictions, transaction limits, remaining balance, and PIN-use limits.
- PostgreSQL schema and migration scripts.
- Docker and Railway configuration files.

## Important limitations

This repository does **not** establish that PinWay is connected to Visa, Mastercard, a card issuer, an acquiring bank, a payment processor, or a point-of-sale network. The MCC checks in this project are application-level rules; they do not by themselves authorize or settle real card transactions.

The current code should not be represented as production-ready fintech infrastructure. The payment-network, issuer, processor, settlement, compliance, operational-security, and independent security-review requirements remain unproven. The PIN authorization route and balance updates also require a dedicated security and concurrency review before any real-money use.

The optional HSM code is not a completed production integration. The PKCS#11 adapter contains an explicit implementation stub, and the PIN service can fall back to software-only bcrypt handling if HSM encryption fails.

## Patent and legal status

**No patent application has been filed for PinWay.** Earlier repository text stating “Patent Pending,” “Provisional Application Filed,” or offering patent rights for acquisition was incorrect and has been removed. No patent rights are being represented or offered.

Ownership, AI-assisted contributions, third-party components, licensing, and any protectable human-authored material have not yet been independently reviewed. This README is not a legal opinion or a claim of patentability.

## Local development

Review the environment variables in `.env.example` and the setup instructions in [SETUP.md](./SETUP.md). Do not use real customer funds, payment credentials, or sensitive personal information in this prototype.

## Technology

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: PostgreSQL
- Authentication: JWT and bcrypt
- Notifications: Twilio and SendGrid libraries
- Tests: Jest dependencies are present; test coverage and production security have not been independently established.

## Collaboration

The project may be evaluated for further engineering, security, payment-partner, and regulatory feasibility work. No acquisition valuation or production-readiness claim is made.
