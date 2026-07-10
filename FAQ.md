# cryptonite (XAE) — FAQ

Common questions that come up while running the demo. Most "bugs" here turn out to be
Ethereum working exactly as designed — cross-referenced with
[`ethereum-learning-notes.md`](./ethereum-learning-notes.md).

---

## 1. `npm run compile` says "Nothing to compile" — is that an error?

No, that's normal. Hardhat caches compiled output in `artifacts/` and `cache/`. If
`contracts/Cryptonite.sol` hasn't changed since the last compile, there's nothing new to build,
so it short-circuits.

You only see "Compiled N Solidity files successfully" when a source file changed. To force a
fresh rebuild:

```bash
npx hardhat clean && npm run compile
```

---

## 2. What does "Configure MetaMask to talk to the local node" mean?

`npm run node` starts a **real (but local) Ethereum blockchain** on your machine at
`http://127.0.0.1:8545`. It's a genuine chain — same JSON-RPC interface as mainnet — that only
exists on your laptop and resets when you stop it.

MetaMask can point at **any** Ethereum network. By default it only knows the public ones, so you
**add your local node as a custom network**:

```
  MetaMask (browser)  ──RPC──▶  http://127.0.0.1:8545   (your `npm run node`)
       │                                 │
   signs your txs               holds the blockchain state
   with a private key           (balances, your XAE contract)
```

Fields to enter:

| Field | Value | Meaning |
| --- | --- | --- |
| RPC URL | `http://127.0.0.1:8545` | Where the local node listens |
| Chain ID | `31337` | Hardhat's network identifier (mainnet is `1`) |
| Currency | `ETH` | Cosmetic label for the native gas token |

**Then import a test account.** Your normal MetaMask account has 0 ETH on this fresh chain. When
`npm run node` starts it prints 20 pre-funded accounts with their private keys — import the first
one (Account #0) via **Import Account**. It has 10,000 test ETH and is the **contract owner**, so
the Mint panel appears only for it.

> ⚠️ These private keys are public and hardcoded in Hardhat. **Only use them on the local `31337`
> network.** Never send real funds to them.

---

## 3. On transfer, MetaMask shows amount 0 and "to" = the contract address, not my recipient. Is the UI broken?

No — this is correct ERC-20 behavior (see **Session 4, Q3** in the notes). A token transfer is
**not** an ETH transfer:

```
Transaction {
  from:   0xYou
  to:     0x…contract…                     ← the XAE CONTRACT, not the recipient
  value:  0 ETH                            ← the "amount" MetaMask shows — always 0 for tokens
  data:   transfer(0xRecipient, 100e18)    ← recipient + amount live HERE
}
```

| What MetaMask shows | Why |
| --- | --- |
| **Amount = 0** | `value` is native **ETH**, and a token transfer moves **zero ETH**. Your 100 XAE is an instruction in the `data` field, not ETH. |
| **To = contract** | To move tokens you must *call the token contract*, so `to` is the contract address. The real recipient is inside `data`. |

Analogy: like a bank check — the envelope (`to`) is addressed to the **bank** (the contract); the
payee and amount are written on the **check inside** (the `data`). The bank updates its ledger.

The contract then runs (from `Cryptonite.sol`):

```
_burn(you, 1)                  // 1% of 100 burned
_transfer(you, recipient, 99)  // recipient gets 99 XAE
```

No ETH moves — only the `balances` mapping changes. After you approve, the dApp UI updates: your
balance drops by 100, the recipient's rises by 99, total supply drops by 1 (the burn).

> MetaMask *sometimes* decodes the `data` and shows "Transfer 100 XAE to 0x…", but on a fresh
> local chain it often just shows the raw contract call. That's cosmetic — the transaction is
> correct.

---

## 4. MetaMask shows ~0.07 ETH gas, but my balance wasn't deducted by 0.07. Where did it go?

The `0.07 ETH` is a **maximum reservation, not the actual charge** (see **Session 5, Q4** and
**Session 6**). You only pay for gas *actually used*, at the *actual* price — the rest is never
taken.

```
displayed fee  =  gas LIMIT  ×  maxFeePerGas     ← the max you authorize
actual charge  =  gas USED   ×  (baseFee + tip)  ← what you really pay
```

Two reasons the real cost is far lower:

1. **Gas limit ≫ gas used.** MetaMask reserves a padded limit, but a token transfer only *uses*
   ~50,000–70,000 gas. You aren't charged for the headroom.
2. **maxFeePerGas ≫ actual base fee.** Your fresh Hardhat node has almost no congestion, so the
   base fee is tiny. The gap between "max price" and "real price" is refunded, not spent.

So your balance *was* reduced — just by a fraction, not 0.07. Against 10,000 ETH it's easy to miss.

**Confirm the exact balance:**

```bash
npx hardhat console --network localhost
```
```js
ethers.formatEther(await ethers.provider.getBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"))
// → e.g. "9999.9997…", down by a fraction
```

**Or read the receipt** — the `npm run node` terminal logs every tx with `Gas used: 51234 of
70000`. Actual fee = `Gas used × effectiveGasPrice`, far below 0.07.

Mapping to the EIP-1559 model from the notes:

- **Gas limit** — set by you/MetaMask; a cap so a runaway tx can't drain you. Unused portion returns.
- **Base fee** — set by the network, low here because the chain is idle. Burned.
- **Priority tip** — set by you; goes to the validator (here, the Hardhat node).

---

## 5. Why does the contract address change when I redeploy?

A contract's address is derived from the deployer's address + **nonce** (transaction count) — see
**Session 3**. Every time Account #0 deploys, its nonce increments, so the new contract lands at a
different address:

```
nonce 0 → 0x5FbDB2315678afecb367f032d93F642f64180aa3
nonce 1 → 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
...
```

`scripts/deploy.js` rewrites `frontend/deployment.json` with the latest address each time, so the
dApp always targets the current deployment. If you restart `npm run node`, the chain resets and
nonces start over — redeploy so `deployment.json` is fresh.

---

## 6. I restarted `npm run node` and the balances look identical — is data persisted?

No. Hardhat's node is **in-memory and ephemeral** — every start is a brand-new chain from
genesis, and stopping it discards everything. What looks identical is **determinism**, not
surviving data:

| What you see | Why it repeats every restart |
| --- | --- |
| Same 20 addresses | Derived from the same fixed test mnemonic |
| Each with 10,000 ETH | Hardhat funds them at genesis, always |
| Contract at the same address | Address = deployer + nonce; the first deploy is always the same |
| Owner has 1,000,000 XAE after deploy | `deploy.js` always mints 1,000,000 to the owner |

So any transfers/mints you did before restarting are **gone** — you're seeing fresh, identical
starting state, not restored state.

**To get a clean chain:**

- Just restart `npm run node` (already fresh), **or**
- `npm run reset` — resets the *running* node to genesis without killing the process (re-funds
  accounts, removes contracts, deletes the stale `deployment.json`). Then `npm run deploy` again.

> **MetaMask caches per-chain state.** After a reset or node restart, MetaMask may show stale
> balances (e.g. an old ETH balance) or throw a "nonce too high" error — even though the node is
> fresh (verify with `block number: 0`, `nonce: 0`, `balance: 10000`). The cache lives only in
> MetaMask; the chain is fine. To force MetaMask to reconnect and re-fetch, cheapest first:
> 1. Settings → Developer tools → **Delete activity and nonce data** (older UI: Advanced →
>    *Clear activity tab data*) — clears the cached nonce/history.
> 2. Switch to another network and back, or lock/unlock MetaMask.
> 3. **Restart the browser** — the reliable sledgehammer; always forces a clean re-fetch.
>
> Also, after any fresh chain: `npm run deploy` again (block 0 means no contract), and re-import
> the XAE token if its address changed.

---

## 7. Why does the deployer account have 9,999.9988 ETH instead of exactly 10,000?

Because that account **paid gas to deploy the contract**. It started at exactly 10,000 ETH on the
fresh chain, and the deploy transaction cost gas:

```
10,000.0000  ETH   starting balance (genesis)
-   0.0012  ETH   gas to deploy the Cryptonite contract
─────────────────
 9,999.9988  ETH   current balance
```

Account #0 (`0xf39F…2266`) is the **deployer**, so it sent the deploy tx and paid for it.
Deploying is the most expensive kind of transaction (**Session 3** in the notes): the EVM runs your
constructor *and* stores every byte of bytecode on-chain (200 gas/byte), so it costs more than a
plain transfer.

Only account #0 is below 10,000 — the other 19 are untouched, because only #0 has sent a
transaction. Confirm it:

```bash
TOKEN=ETH npm run balance   # #0 shows 9,999.9988; everyone else shows 10,000
```

This is the **real** on-chain balance (not a MetaMask cache glitch like #6) — the 0.0012 ETH
wasn't lost, it was the fee for putting your contract on the blockchain. Every further tx from an
account (deploy, transfer, mint, stake) nudges its ETH down a little more as it pays gas. Want all
accounts back at a clean 10,000? `npm run reset` (or restart the node) wipes to genesis — then
`npm run deploy` spends that ~0.0012 ETH again.
