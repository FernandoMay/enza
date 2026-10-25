# ENZA Movement implementation plan

## Audit, 25 October 2026

This repository is a static strategy presentation (`index.html`, `README.md`, `thesis.md`). It has no package manifest, application backend, database, catalogue, cart, authentication, checkout, payment provider, order lifecycle, CI, or deployment configuration. `enza.in` is linked as an external existing store; its implementation and APIs are not present here. There is no ENZA-managed experience inventory or booking system. The intended product direction is ENZA arranging wellness and cultural experiences itself; the session in this demo is synthetic. The presentation is the only existing site feature to preserve.

Consequently, this repository cannot add a checkout *alongside the existing store's payment methods* or reuse its orders without access to that store's source/API. A distinct, clearly marked testnet demo is the safe vertical slice here. No live commerce or ticket integration should be claimed.

## Files and dependencies

- Preserve `index.html`; add a link to a separate ENZA Movement demo if implemented.
- Add a small Node.js service and local demo page for sample product and event checkout, order persistence, Stellar payment intents, server verification, and demo fulfillment.
- Add `@stellar/stellar-sdk` and `@stellar/freighter-api` with a committed lockfile; use Node.js 22 or later.
- Add `.env.example`, `docs/STELLAR_INTEGRATION.md`, and `docs/HACKATHON_DEMO.md`.
- Add tests for verification invariants, retries, duplicate hashes, and fulfillment idempotency.

## Boundaries and risks

Testnet only. USDC code and issuer must be checked against a current authoritative source before configuration. Merchant and vendor public keys are configuration; private signing keys never enter the browser. A wallet must hold XLM for fees and USDC trustline. Demo catalogues and tickets are synthetic. Server storage needs durable, atomic writes or a database before a shared/public deployment. Merchant payout signing and a real transaction require a funded operator wallet and explicit operator authorization. External store integration depends on its architecture and access. Axess.Zone integration depends on a verified API and authorization.

## MVP acceptance

A human can select a labelled sample product or event, create a pending order, connect Freighter on Testnet, review and sign an exact USDC payment, and see a server-verified confirmation or a clear pending/failure state. Server verification checks network, success, destination, asset issuer, amount, order memo, expiry, and unique hash. Repeated callbacks produce one confirmation and at most one demo ticket. Vendor allocation reconciles exactly. Existing presentation remains usable. Any capabilities not actually working must be documented as such.
