# ENZA agent instructions

Before planning or changing this project, read [`thesis.md`](thesis.md) in full. Treat it as the product, architecture, safety and acceptance source of truth.

“Agent” here means a coding assistant building the project. ENZA is a human-facing product for customers, vendors and an ENZA operator. Do not redesign the checkout as an agent-to-agent payment workflow.

For every Stellar-related task, load the official [Stellar Dev Skill](https://github.com/stellar/stellar-dev-skill) before writing code. Read the task-relevant wallet, assets, RPC/Horizon and standards modules. Use the cross-chain module only when cross-chain USDC is explicitly in scope. Consult current official Stellar documentation when details may have changed.

The MVP must remain on Stellar Testnet, use test USDC, keep signing secrets out of the browser and repository, verify payments server-side, calculate amounts deterministically, and require explicit authorisation for vendor payouts.

Do not mark planned or simulated capabilities as implemented. Do not claim that Stellar guarantees zero total fees, unrestricted global availability or automatic compliance.
