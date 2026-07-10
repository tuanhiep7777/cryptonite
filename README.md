# cryptonite (XAE) — a local token demonstration

A runnable, fully local demo that turns the theory in
[`ethereum-learning-notes.md`](./ethereum-learning-notes.md) into working code. **cryptonite**
(ticker **XAE**) is an ERC-20 token that you can watch behave the way the notes describe:
supply going **up** when it's minted, **down** when it's burned, and yield accruing over time
from staking.

Stack (exactly the one from the notes): **Hardhat + Solidity + ethers.js + MetaMask**.

> Hitting something confusing (0 ETH transfers, gas fees, MetaMask setup)? See [`FAQ.md`](./FAQ.md) —
> most surprises are Ethereum working as designed.

---

## What it demonstrates

| Concept (from the notes)                       | Where it lives in the code                                   |
| ---------------------------------------------- | ------------------------------------------------------------ |
| Core ERC-20 (Session 2)                        | `contracts/Cryptonite.sol` — extends OpenZeppelin `ERC20`    |
| Deflationary burn / EIP-1559 (Sessions 6–7)    | `_transferWithBurn()` — 1% of each transfer is `_burn`ed     |
| Owner mint / issuance (Session 8)              | `mint()` — owner-only `_mint`, raises `totalSupply`          |
| Staking & "skin in the game" (Session 6, Q3)   | `stake()` / `pendingReward()` / `claimReward()` / `unstake()`|

Everything is deliberately minimal and commented for learning, not gas-optimized.

---

## Project layout

```
contracts/Cryptonite.sol     ERC-20 + burn-on-transfer + owner mint + staking
scripts/deploy.js            deploy + write frontend/deployment.json (address + ABI)
scripts/demo.js              narrated end-to-end terminal walkthrough
scripts/balance.js           print XAE balance / staked / pending for accounts
scripts/reset.js             wipe the running node back to genesis
test/Cryptonite.test.js      unit tests for every feature
frontend/                    vanilla HTML/JS dApp (MetaMask + ethers v6)
hardhat.config.js            solidity 0.8.24, localhost network (chainId 31337)
```

---

## Quick start

```bash
npm install          # once
npm run compile      # compile the contract
npm test             # run the test suite (12 tests)
```

### See it run in the terminal

The fastest way to watch all the mechanics at once:

```bash
npm run node         # terminal A — starts a local Ethereum node at 127.0.0.1:8545
npm run demo         # terminal B — deploys + narrates mint / transfer+burn / stake / claim / unstake
```

### Use the dApp with MetaMask

```bash
npm run node         # terminal A — local node (keep running)
npm run deploy       # terminal B — deploys and writes frontend/deployment.json
npm run frontend     # terminal C — serves the dApp (prints a http://localhost:… URL)
```

Then in the browser:

1. **Configure MetaMask** to talk to the local node:
   - Add a network → RPC URL `http://127.0.0.1:8545`, Chain ID `31337`, currency `ETH`.
2. **Import a test account.** When `npm run node` starts it prints 20 accounts and their private
   keys. Copy the first account's private key into MetaMask (Import Account). Account #0 is the
   contract **owner**, so the mint panel will appear for it.
3. Open the served page, click **Connect MetaMask**, and try it:
   - **Transfer** to another address → your balance and `totalSupply` both drop (the 1% burn).
   - **Stake**, wait (or re-deploy after the demo's time-jump), then **Claim** → supply rises.
   - As the owner, **Mint** new XAE to any address.

> Tip: the demo script fast-forwards chain time to make staking rewards visible. In MetaMask the
> wall clock is real, so rewards accrue slowly — stake a large amount to see `pendingReward` move,
> or use `npm run demo` to see the time-jump version.

### Utility scripts

Both talk to the node **currently running** at `localhost:8545`, so keep `npm run node` up.

#### `npm run balance` — check holdings

By default prints each address with its **XAE balance**, **staked** amount, and **pending reward**.
Two optional env vars (`hardhat run` can't take positional args, so config goes through env vars):

- **`TOKEN`** — what to check: `XAE` (default), `ETH` (native balance), or any ERC-20 contract
  address (`0x…`).
- **`ADDRESS`** — limit output to a single address instead of all 20 demo accounts.

```bash
# XAE for all 20 demo accounts (default):
npm run balance

# Native ETH balances:
TOKEN=ETH npm run balance

# Any other ERC-20 token by its contract address:
TOKEN=0xTokenAddress… npm run balance

# One specific address (combine with TOKEN as needed):
ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC npm run balance
TOKEN=ETH ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC npm run balance
```

The default XAE mode reads the contract address from `frontend/deployment.json`, so run
`npm run deploy` first (and redeploy if the chain was reset). `TOKEN=ETH` needs no deployment.
The staked/pending columns are XAE-specific; ETH and other tokens show a balance column only.

#### `npm run reset` — wipe the chain to genesis

Resets the **running** node back to genesis without restarting the process: re-funds the 20 demo
accounts to 10,000 ETH, removes all deployed contracts/transactions, and deletes the stale
`frontend/deployment.json`.

```bash
npm run reset        # clean slate
npm run deploy       # redeploy XAE (the contract no longer exists after a reset)
```

A plain `npm run node` restart already gives you a fresh chain — use `reset` when you want a clean
slate but don't want to restart the node and reconfigure MetaMask.

> After a reset **or** a node restart, MetaMask still caches the old balance/nonce. Force a
> refresh (switch networks and back, or restart the browser) and re-import the XAE token if its
> address changed. See [`FAQ.md`](./FAQ.md) #6.

---

## How the burn stays correct

The 1% burn is applied only in the **public** `transfer` / `transferFrom` entry points. Minting,
burning, and all staking movements go through OpenZeppelin's internal `_transfer` / `_mint` /
`_burn`, so they are naturally fee-exempt — you never lose principal when you stake or unstake,
and rewards are minted in full. See the comments in `contracts/Cryptonite.sol`.

---

## Stretch goals (intentionally not built yet)

- **ERC-4337 paymaster** (Session 6, Q4) — pay gas in XAE instead of ETH. This needs an
  EntryPoint + bundler running locally and is the natural next step once the basics click.
- **Burn-rate slider in the UI** — an owner-only control to change the deflationary burn live and
  watch its effect on `totalSupply`. No contract changes needed: `Cryptonite.sol` already exposes
  `setBurnRateBps(uint256)` (owner-only, capped at `MAX_BURN_RATE_BPS` = 1000 bps / 10%) and emits
  `BurnRateUpdated`. Implementation is frontend-only, mirroring the existing owner mint panel:
  - Add a range `<input>` (0–1000 bps, i.e. 0–10%) to the owner-only card in `frontend/index.html`,
    shown via the same `owner === account` check already in `frontend/app.js` (`refresh()`), with a
    label displaying the current `burnRateBps / 100` as a percentage.
  - On change, call `token.setBurnRateBps(value)` through the existing `withTx()` helper, then let
    `refresh()` update the displayed rate.
  - Optionally subscribe to the `BurnRateUpdated` event (like the existing `Transfer`/`Staked`
    subscriptions) so the slider reflects changes made from other sessions/scripts.
- Move staking into its own contract to demonstrate cross-contract `approve` + `transferFrom`.
- A real reward treasury (cap emissions) instead of minting rewards on demand.
