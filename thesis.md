# ENZA Web2-to-Web3 Payment Thesis

## One-sentence thesis

ENZA will add a Stellar-based USDC payment and vendor-payout plugin to its existing Web2 ecommerce business so customers can pay across borders and local vendors can receive transparent, verifiable payouts, while ENZA measures whether the complete transaction route costs less than its current payment process.

## Context

ENZA is already a functioning Web2 conscious-lifestyle marketplace. It connects customers with curated products, independent makers and holistic-wellbeing solutions. The hackathon project does not replace the store or rebuild the entire marketplace. It adds a Web3 payment layer to the commerce that already exists.

The business problem is operational: international payments can create card fees, foreign-exchange spreads, settlement delays, payout fees and manual reconciliation. These costs make it harder for a small marketplace to serve global customers and pay local vendors efficiently.

Our hypothesis is that Stellar USDC can improve this flow by providing a shared settlement asset, fast finality, low network fees and a verifiable transaction record. This is a hypothesis to test, not a promise of zero-cost or unrestricted global payments. The comparison must include the complete cost of acquiring USDC, network fees, conversion, custody, compliance and fiat off-ramping.

## Hackathon objective

Deliver one working end-to-end testnet journey:

1. A customer chooses an ENZA order in the existing Web2 experience.
2. The ENZA payment plugin creates a time-bound USDC payment request linked to that order.
3. The customer connects a compatible Stellar wallet and reviews the exact asset, amount and destination.
4. The customer signs the transaction in the wallet. ENZA never receives the customer's secret key.
5. The application submits or observes the transaction and verifies it on Stellar Testnet.
6. The order changes to `paid` only after deterministic server-side verification.
7. ENZA calculates the vendor allocation from the recorded order.
8. An authorised testnet payout sends USDC to one or more vendor wallets.
9. The dashboard records the network, asset, transaction hash, ledger status and vendor payout status.

Testnet assets have no monetary value. Every testnet screen and receipt must say so.

## The product

The deliverable is a payment plugin or adapter for ENZA's Web2 storefront, supported by a small backend service and an operator dashboard.

### Customer checkout

- Offer `Pay with USDC on Stellar` as an additional checkout method.
- Show the exact USDC amount, network, destination and expiry before signature.
- Connect to a supported wallet or use a standards-based delegated signing flow.
- Present clear pending, confirmed, expired and failed states.
- Preserve the familiar Web2 order and fulfilment experience.

### ENZA payment service

- Create an immutable payment intent for each order.
- Store monetary values deterministically; never use floating-point arithmetic for ledger amounts.
- Build the intended Stellar payment transaction without exposing signing secrets.
- Verify the transaction against the stored intent before marking an order paid.
- Make webhook, polling and retry handling idempotent.
- Prevent a transaction hash from paying more than one order.

### Vendor payout service

- Store a vendor's verified Stellar public address and supported payout asset.
- Confirm that every classic Stellar recipient can receive the configured USDC asset, including the required trustline.
- Calculate vendor amounts and ENZA fees from the order ledger.
- Require explicit operator authorisation for the hackathon payout.
- Execute a separate payout transaction after the order payment is confirmed. Multiple payment operations may be grouped atomically when that is the clearest safe design.
- Reconcile the final transaction result to each vendor balance.

## Required verification rules

An order must not become `paid` merely because a transaction hash exists. Server-side verification must confirm:

- the intended Stellar network and network passphrase;
- a successful final transaction;
- the exact destination account;
- the exact asset code and issuer, not the symbol `USDC` alone;
- the exact amount expected by the payment intent;
- the order identifier or other unique correlation value;
- that the payment has not expired or already been consumed;
- that the transaction is recorded once, even when callbacks or retries repeat.

Asset identifiers and contract addresses must come from current official sources and environment-specific configuration. Do not copy an issuer or contract address from an unverified example.

## Stellar implementation direction

Start with Stellar's classic payment operations and the official JavaScript SDK. A Soroban smart contract is not required for the MVP unless the Stellar skill identifies a concrete need that cannot be met safely with classic transactions.

Use these components as appropriate:

- `@stellar/stellar-sdk` for accounts, assets, transaction construction, submission and verification.
- A supported Stellar wallet integration covered by the official Frontend & Wallets skill.
- Stellar RPC or Horizon, selected according to the official skill guidance, for transaction status and ledger data.
- USDC as an issued Stellar asset. Recipients need the correct trustline when using classic accounts.
- A fee-bump or sponsorship approach only if the prototype intentionally removes the customer's need to hold XLM for fees.
- Stellar Lab and official faucets for isolated Testnet setup and inspection.

The MVP is a Stellar-native checkout and payout. Fiat on/off-ramps through anchors (SEP-6/24/31/38), cross-chain USDC through Circle CCTP, and automated wallet recovery are future or stretch work. Add them only after the core Stellar Testnet payment is complete and verified.

## Mandatory agent bootstrap

Any coding agent working in this repository must read this file before proposing architecture or writing payment code.

Before implementing Stellar functionality, the agent must load the official [Stellar Dev Skill](https://github.com/stellar/stellar-dev-skill), maintained by Stellar. If it is not already available in the agent environment, install it using the method supported by that environment. For OpenAI Codex, the official documentation currently identifies `~/.codex/skills/` as the skills directory and provides this installation route:

```bash
git clone https://github.com/stellar/stellar-dev-skill ~/.codex/skills/stellar-dev-skill
```

An Agent Skills-compatible alternative documented by Stellar is:

```bash
npx skills add https://github.com/stellar/stellar-dev-skill
```

The agent must then read the relevant skill modules before coding:

1. **Frontend & Wallets** — wallet connection, transaction signing and delegated-signing patterns.
2. **Stellar Assets & SAC** — USDC identity, trustlines, asset handling and amount representation.
3. **RPC & Horizon APIs** — submission, observation, verification and reconciliation.
4. **SEPs, CAPs & Ecosystem** — applicable payment and interoperability standards.
5. **Cross-chain** — only if CCTP or payments originating on another chain enter scope.

Use the **Agent Payments** skill only if the product later sells paid APIs to agents through x402 or MPP. It is not the default architecture for this ecommerce checkout.

For current information, query the official Stellar documentation or its public documentation MCP server. Official current documentation takes precedence over cached examples, blog posts and model memory.

## Security boundaries

- Never commit seed phrases, private keys, API keys or wallet recovery material.
- Never put a secret signing key in browser code.
- Use environment variables or an approved secret manager for server-side secrets.
- Use separate Testnet and Pubnet configuration and make the active network visible.
- Require human authorisation for payouts in the hackathon build.
- Validate destination addresses and asset support before building transactions.
- Use least-privilege operational accounts, limits, idempotency keys and audit logs.
- Do not use real money or Pubnet until the Testnet flow, threat model and operational controls have been reviewed.

## Data model

At minimum, preserve these records:

- `Order`: ecommerce order ID, currency, total and fulfilment state.
- `PaymentIntent`: order ID, amount, asset code, asset issuer, network, destination, correlation value, expiry and status.
- `PaymentTransaction`: transaction hash, ledger, source, destination, asset, amount, observed status and timestamps.
- `Vendor`: vendor ID, verified wallet address, payout asset and onboarding status.
- `VendorAllocation`: order ID, vendor ID, gross amount, ENZA fee, adjustments and net amount.
- `Payout`: allocation IDs, authoriser, transaction hash, status, failure reason and timestamps.

Payment and payout state changes must be auditable and monotonic. A failed or expired intent must never silently become paid without a newly verified transaction.

## Demo scenario

Use one simple, legible example:

- Customer order: 100 USDC.
- Vendor A allocation: 55 USDC.
- Vendor B allocation: 25 USDC.
- Vendor C allocation: 10 USDC.
- ENZA marketplace fee: 10 USDC.

The allocation must equal the order total. Shipping, taxes, refunds and off-ramp fees must either be represented explicitly or marked outside the demo calculation.

## Definition of done

The hackathon MVP is complete when:

- a user can create an ENZA test order and choose Stellar USDC;
- a compatible wallet can sign the exact payment request;
- a real Testnet transaction confirms successfully;
- the backend independently verifies the payment before updating the order;
- the interface links to verifiable transaction evidence;
- the allocation engine produces vendor balances that reconcile to the order;
- an authorised Testnet vendor payout completes and is reconciled;
- incorrect asset, amount, destination, duplicate and expired-payment cases are rejected;
- setup, architecture, assumptions and demo steps are documented;
- no secret keys or real customer payment data are committed.

## Business success test

The technical demo proves feasibility. The business thesis is supported only if a later pilot shows an improvement over the current Web2 payment route.

For each route, measure:

- customer payment success rate;
- total customer cost;
- ENZA processing and foreign-exchange cost;
- vendor payout and off-ramp cost;
- time from payment to usable vendor funds;
- manual reconciliation time;
- refund and support burden;
- availability for the chosen customer and vendor countries.

The central claim should therefore be: **ENZA is testing whether a Stellar USDC payment and payout layer can reduce the total cost and friction of global marketplace transactions.** Do not claim savings until the end-to-end numbers demonstrate them.

## Non-goals for the hackathon

- Rebuilding the entire ENZA ecommerce platform.
- Launching a token or speculative currency.
- Holding production customer funds.
- Automatic tax or regulatory compliance.
- Supporting every wallet, currency, country or blockchain.
- Production custody, refunds or dispute resolution.
- An autonomous AI agent moving money without explicit controls.

## Official references

- [Stellar: Building with AI and official skills](https://developers.stellar.org/docs/build/building-with-ai)
- [Official Stellar Dev Skill repository](https://github.com/stellar/stellar-dev-skill)
- [Stellar developer documentation](https://developers.stellar.org/)
- [Stellar wallet SDK guide](https://developers.stellar.org/docs/build/apps/wallet/stellar)
- [Stellar path payments guide](https://developers.stellar.org/docs/build/guides/transactions/path-payments)
- [Stellar Ecosystem Proposals](https://developers.stellar.org/docs/learn/fundamentals/stellar-ecosystem-proposals)
- [Circle: CCTP on Stellar](https://developers.circle.com/cctp/references/stellar)
