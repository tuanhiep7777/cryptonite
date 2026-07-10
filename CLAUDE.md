# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **local-only teaching demonstration** of a custom ERC-20 token, **cryptonite (XAE)**, that makes
the concepts in `ethereum-learning-notes.md` observable: a deflationary burn, owner minting, and
staking rewards. Everything runs against a local Hardhat node — no testnet, no real funds. When
explaining behavior, cross-reference the relevant "Session" in `ethereum-learning-notes.md`;
`FAQ.md` already answers the common "is this a bug?" questions (it usually isn't — it's Ethereum
working as designed).

## Commands

```bash
npm install            # once
npm run compile        # compile contracts (Hardhat caches — "Nothing to compile" is normal)
npm test               # run the full test suite (Hardhat + chai, in-process network)
npm run node           # start the standalone local node at 127.0.0.1:8545 (keep running)
npm run deploy         # deploy to the running node + regenerate frontend/deployment.json
npm run demo           # narrated end-to-end walkthrough (deploys its own instance)
npm run frontend       # serve the dApp (npx serve frontend)
npm run balance        # print balances (see env vars below)
npm run reset          # wipe the running node to genesis (then redeploy)
```

Run a single test by name:

```bash
npx hardhat test --grep "accrues rewards"
```

`deploy`, `demo`, `balance`, `reset` all target the node **currently running** on
`localhost:8545` (chainId 31337) — start `npm run node` first, or they fail to connect.

### Script env vars (hardhat run can't take positional args)

- `balance.js` — `TOKEN` selects what to read: `XAE` (default, shows balance/staked/pending),
  `ETH` (native), or any ERC-20 contract address. `ADDRESS` limits output to one address instead
  of all 20 demo accounts. e.g. `TOKEN=ETH ADDRESS=0x… npm run balance`.

## Architecture

**Single contract, three layered mechanics.** `contracts/Cryptonite.sol` extends OpenZeppelin v5
`ERC20` + `Ownable` and keeps staking *inside the same contract* (no separate staking contract, to
avoid cross-contract approvals). The reward math settles into `rewardDebt` before any change to a
user's staked balance.

**The burn is applied in the public `transfer`/`transferFrom` overrides — deliberately NOT in
`_update`.** This is the load-bearing design decision: minting, burning, and all staking movements
go through OpenZeppelin's internal `_transfer`/`_mint`/`_burn`, so they are automatically
fee-exempt. If you move the burn into `_update` you will incorrectly tax staking and reward
minting, and risk recursion. Keep peer-transfer fees at the public entry points only.

**`frontend/deployment.json` is the contract between backend and frontend.** `scripts/deploy.js`
writes `{ address, chainId, abi }` there from the compiled artifact; `frontend/app.js` fetches it
at runtime to know where the contract lives and how to call it. It is gitignored and regenerated
on every deploy. **The contract address changes on every deploy** (address = deployer + nonce), so
after any redeploy the frontend auto-updates but a manually-imported MetaMask token must be
re-added.

**The frontend is dependency-free vanilla JS.** `frontend/app.js` uses ethers v6 vendored at
`frontend/lib/ethers.umd.min.js` (copied from `node_modules`, loaded via a `<script>` tag) — no
build step, no framework. It expects MetaMask on chainId 31337 and live-updates by subscribing to
the contract's `Transfer`/`Staked`/`RewardClaimed` events.

**The local chain is ephemeral.** `npm run node` is in-memory; stopping it discards all state, and
restarting gives a deterministic fresh chain (same 20 accounts, same 10,000 ETH, same first-deploy
address). `npm run reset` (via the `hardhat_reset` RPC) wipes the running node without restarting
the process and deletes the stale `deployment.json`. After any reset/restart: redeploy, and clear
MetaMask's cached balance/nonce (it does not notice the chain was swapped).

## Notes

- Solidity `^0.8.24`, optimizer on; both the `hardhat` (in-process test) and `localhost`
  (standalone node) networks are pinned to chainId 31337 in `hardhat.config.js`.
- ERC-4337 paymaster (pay gas in XAE) is intentionally out of scope — see the stretch goals in
  `README.md`.
