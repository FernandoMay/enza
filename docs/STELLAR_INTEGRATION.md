# Stellar Testnet demo

This repository contains a separate sample checkout, not an integration with the production EnZa store. It uses Node.js 22+, Vite, `@stellar/stellar-sdk`, and Freighter. No real money or Pubnet is supported.

1. Install with `npm ci --cache /tmp/enza-npm`.
2. Verify the current official Testnet USDC issuer from Circle/Stellar asset documentation. Set `STELLAR_USDC_TESTNET_ISSUER` to that public key. Do not use a similarly named asset or an example issuer. Set `STELLAR_MERCHANT_ADDRESS` to a Testnet public account that trusts this exact asset. Keep secrets out of `.env` and the repository; this demo does not require the merchant private key.
3. Ensure the customer's Freighter wallet is on Testnet, has enough XLM for reserves and fees, a trustline to the exact USDC issuer, and a funded test USDC balance. The merchant needs the same trustline. Use official Stellar Testnet funding tools; do not use production USDC.
4. Start the API with `npm start` and the web app with `npm run dev`, then open the local Vite address and choose `demo.html`.
5. Choose a sample item, connect Freighter, review the amount, destination, issuer, network and memo in the wallet, sign, and wait for the server to fetch the confirmed Horizon transaction. A successful event order gets a unique **demo** ticket. The transaction link uses Stellar Expert Testnet.

The event shown is a sample ENZA-hosted experience. No capacity management or real booking is implemented.

The backend creates a pending order with a 15-minute expiry and a unique text memo. It builds a single USDC payment operation for the wallet. The submitted XDR is checked against the stored order before broadcast. Confirmation retrieves transaction and operations from Testnet Horizon and checks success, memo, destination, asset code and issuer, exact amount, expiry and hash reuse. The order becomes paid only after that check. Amounts use integer stroops for comparisons.

This is a local single-process demo with a JSON file in `.data/`. It has no authenticated customer accounts, production catalogue, inventory, shipping, refunds, durable multi-process database, wallet recovery or Axess.Zone integration. Do not deploy publicly or connect to production commerce. Vendor payouts are not implemented; any future payout requires verified vendor addresses, explicit operator authorization, funded merchant signing infrastructure and independent settlement checks. A multi-party payout can be handled as separate authorized Testnet payments after allocations reconcile.
