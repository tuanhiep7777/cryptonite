# Ethereum & Crypto Learning Notes

A full Q&A session covering how Ethereum, Bitcoin, and blockchain mechanics work — from first principles to economic design.

---

## Session 1 — Overview & Conceptual Explanation

**Q: I want to create a cryptocurrency on the Ethereum platform locally. Is it possible (including deployment)?**

Yes, completely possible. The local stack:
- **Hardhat** — local Ethereum node + compilation + deployment scripts
- **Solidity** — the language for writing your token contract (ERC-20 standard)
- **ethers.js** — interact with your deployed contract from JavaScript
- Optionally **MetaMask** (browser wallet) to interact with it visually

The full flow locally:
1. Write an ERC-20 token contract in Solidity
2. Start a local Hardhat node (simulates Ethereum — no real ETH needed)
3. Deploy the contract to that local node
4. Interact with it (mint tokens, transfer, check balances) via scripts or console

---

## Session 2 — How Ethereum Works (Conceptual)

### How Ethereum Works

Ethereum is a **distributed state machine**. Every node holds a copy of the same state: a giant table of addresses and their balances/data.

```
Address (20 bytes)  →  Account
─────────────────────────────────────────
0xABC...           →  { balance: 5 ETH, nonce: 3 }
0xDEF...           →  { balance: 0 ETH, code: [...], storage: {...} }
```

Two types of accounts:
- **Externally Owned Accounts (EOA)** — controlled by a private key (your wallet). Can send transactions.
- **Contract Accounts** — controlled by code. No private key. Only runs when called.

### What a Transaction Is

```
Transaction {
  from:     0xYourWallet
  to:       0xSomeContract
  value:    0.1 ETH
  data:     transfer(0xBob, 50)
  gas:      21000
  gasPrice: 10 gwei
  nonce:    7
}
```

### What a Smart Contract Is

```solidity
contract MyToken {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 amount) public {
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}
```

### The ERC-20 Standard

Required functions:
- `totalSupply()` — how many tokens exist
- `balanceOf(address)` — how many tokens an address holds
- `transfer(address to, uint256 amount)` — send your tokens
- `approve(address spender, uint256 amt)` — let someone else spend your tokens
- `transferFrom(address from, address to)` — spend approved tokens
- `allowance(address owner, address spender)` — check approved amount

Required events:
- `Transfer(from, to, amount)`
- `Approval(owner, spender, amount)`

### What "Deploying" Means

```
Deploy transaction:
  from:  0xYourWallet
  to:    (empty)
  data:  0x6080604052...  ← compiled Solidity

Result:
  Contract now lives at 0xNewContractAddress
  Constructor ran → initial supply minted to your wallet
```

---

## Session 3 — Deploy Transaction Fields

**Q: How about the other values in a deploy transaction? like value, gas, gasPrice, nonce**

```
Transaction {
  from:     0xYourWallet
  to:       (empty / null)     ← this signals "deploy"
  value:    0 ETH              ← usually 0, unless constructor is payable
  data:     0x6080604052...    ← compiled bytecode + ABI-encoded constructor args
  gas:      ~500,000–3,000,000 ← deploying costs more than a simple transfer
  gasPrice: 10 gwei
  nonce:    7
}
```

**`value`** — Almost always `0`. Exception: constructor marked `payable`:
```solidity
constructor() payable {
    // someone can send ETH when deploying
}
```

**`gas`** — Deploying is expensive because the EVM must:
1. Execute your constructor code
2. Store every byte of your contract's bytecode on-chain (200 gas per byte)

**`gasPrice`** — Post EIP-1559 Ethereum splits this into:
- `baseFee` — set by the network, burned (destroyed)
- `maxPriorityFee` — tip to the validator

**`nonce`** — Tracks how many transactions an EOA has sent. Also determines the contract's address deterministically:
```
contractAddress = keccak256(deployerAddress + nonce)
```

---

## Session 4 — EVM, Mining, Token Transfers

**Q1: What is EVM? Is it the application that runs on every node? Is a miner/validator a node?**

Yes. The **Ethereum Virtual Machine** is a sandboxed runtime that executes bytecode. Every node runs an identical copy:

```
Ethereum Network
├── Node A  [EVM]
├── Node B  [EVM]
├── Node C  [EVM]
└── ...thousands more
```

Node types:
- **Full nodes** — store the entire blockchain, verify every transaction, do not produce blocks
- **Miners/Validators** — full nodes that also produce new blocks

**Q2: What is mining/validation?**

Transactions don't go directly into the blockchain — they wait in the **mempool** (memory pool):

```
You sign a tx → broadcast to network → lands in mempool (pending)
                                              ↓
                                    Validator picks it up
                                              ↓
                                    Executes it on their EVM
                                              ↓
                                    Bundles it into a block
                                              ↓
                                    Broadcasts the block
                                              ↓
                                    Other nodes verify & accept
                                              ↓
                                    Tx is now "mined" / confirmed
```

Under **Proof of Stake**: validators are chosen randomly, weighted by how much ETH they've staked. Cheating = losing your stake.

**Q3: Calling a token contract — is this correct?**

```
Transaction {
  from:     0x123
  to:       0xabc       ← the ABC token contract address
  value:    0 ETH
  data:     transfer(0x456, 10)
  gas:      ~50,000     ← NOT 21,000 (that's only for plain ETH transfers)
  gasPrice: 10 gwei
  nonce:    7
}
```

Yes, exactly right. The EVM flow:
1. Loads bytecode stored at `0xabc`
2. Reads data field → "call transfer with args (0x456, 10)"
3. Executes: `balances[0x123] -= 10` and `balances[0x456] += 10`
4. Emits `Transfer(0x123, 0x456, 10)` event

Correction: gas for a token transfer is ~45,000–65,000, not 21,000. 21,000 is only for plain ETH transfers.

---

## Session 5 — Full Nodes, Staking, Gas Fees

**Q1: If full nodes verify transactions, why don't they store them? Who adds the tx to a block?**

Full nodes DO store transactions — the wording was imprecise. Clarified:

```
Full Node job:
  ✓ Receives every new block from validators
  ✓ Verifies every transaction in that block is valid
  ✓ Executes every tx on its own EVM to confirm the resulting state
  ✓ Stores the block (including all txs) to its local copy
  ✗ Does NOT package txs into new blocks
  ✗ Does NOT decide which txs go in next
```

Validators produce blocks → broadcast → full nodes receive, verify, store.

**Q2: Who runs nodes? Can I join?**

Yes, anyone can run a node — no permission needed. Current numbers (2025):
```
Full nodes:         ~6,000–10,000
Validators:         ~1,000,000+ slots
Validator entities: ~10,000–20,000 unique operators
```

Validator requirement: **32 ETH minimum staked**. Staking pools (like Lido) let people pool ETH together.

**Q3: Do I need ETH in my wallet to pay gas for token transfers?**

Yes. These are separate balances:
```
0x123 native account:
  ETH balance: 0.01 ETH   ← pays gas fee to validator

ABC contract storage:
  balances[0x123] = 10    ← the tokens being transferred
```

New users receiving tokens but having zero ETH can't move them — this is a real UX problem. ERC-4337 (account abstraction) addresses this.

**Q4: Who sets the gas?**

Three parties:

- **Gas limit** — set by the sender (you, or your wallet estimates it)
- **Base fee** — set by the network automatically, burned
- **Priority fee (tip)** — set by the sender, goes to the validator

```
Gas cost = gas units used × (baseFee + priorityFee)

Example:
  50,000 gas × (15 gwei baseFee + 2 gwei tip) = 850,000 gwei = 0.00085 ETH
                 ↑ burned                ↑ validator keeps
```

---

## Session 6 — Burning, Inflation/Deflation, Staking Profit, ERC-4337

**Q1: Why burn the base fee?**

Before EIP-1559, all gas fees went to miners — creating an incentive to manufacture congestion:
- Miners fill blocks with fake txs → real users bid higher → miners profit

Burning fixes this: validators only earn the tip, not the base fee. They gain nothing from congestion they create.

Secondary effect: burning creates deflationary pressure. During high activity, more ETH is burned than minted.

**Q2: Will ETH inflate since PoS doesn't require as much computational cost?**

Two opposing forces:
```
ETH supply increases: new ETH minted as validator rewards (~0.3%/year)
ETH supply decreases: base fee burned (depends on network activity)
```

Since the Merge (2022), ETH has been roughly net deflationary during busy periods. PoS uses ~99.95% less energy than PoW, so the protocol doesn't need to mint as many new coins.

**Q3: Can I profit from staking like mining in BTC? Isn't it weird since PoS doesn't require hardware investment?**

Yes, you can profit (~3-4% APY). It's not "free money" due to:

```
Risk 1: ETH price risk — your 32 ETH may lose USD value while locked
Risk 2: Slashing — misbehavior destroys part of your staked ETH
Risk 3: Lock-up — unstaking takes days to weeks
Risk 4: Technical — node must stay online 24/7, downtime = small penalties
```

PoS replaces *physical* capital expenditure (hardware/electricity) with *financial* capital at risk. Different mechanism, same "skin in the game" principle.

**Q4: ERC-4337 gas payment in tokens — only for listed/valued coins?**

Not exactly. The constraint is whether a **Paymaster** exists that accepts the token:

```
ERC-4337 flow:
  You (0x123) → pay gas in ABC token
                      ↓
               Paymaster contract (middleman)
                      ↓
               Paymaster holds ETH, pays validator
               Charges you ABC tokens in return
```

- Works for USDC, USDT, DAI — paymasters exist for these
- Works for your own token IF you run your own paymaster
- You could deploy UCoin + your own Paymaster even with zero market value — as long as you front the ETH

---

## Session 7 — Inflation Math, ETH/BTC History, Deflation Concepts

**Q1: Why does low activity = inflation, high activity = deflation?**

The fixed mint is ~1,750 ETH/day regardless of activity. The burn varies:

```
Quiet day:
  Minted: +1,750 ETH
  Burned:   -500 ETH   ← low traffic, low fees
  Net:    +1,250 ETH   → inflation

Busy day:
  Minted:  +1,750 ETH
  Burned: -15,000 ETH  ← high traffic, high baseFee
  Net:   -13,250 ETH   → deflation
```

The base fee also rises automatically when blocks are full (EIP-1559), so high activity → higher baseFee → more burned per tx. It compounds.

**Q2: List all major changes in ETH and BTC history**

### Bitcoin History

| Year | Event | Description |
|------|-------|-------------|
| 2009 | Genesis | PoW (SHA-256), block reward = 50 BTC, 21M cap hardcoded |
| 2012 | 1st Halving | 50 → 25 BTC/block |
| 2016 | 2nd Halving | 25 → 12.5 BTC/block |
| 2017 | SegWit (BIP141) | Fixed tx malleability, increased effective capacity, enabled Lightning Network |
| 2017 | Bitcoin Cash Fork | Community split over block size; BCH raised to 8MB, BTC kept 1MB + SegWit |
| 2018 | Lightning Network mainnet | Layer 2 payment channels, off-chain instant transfers |
| 2020 | 3rd Halving | 12.5 → 6.25 BTC/block |
| 2021 | Taproot (BIP340/341/342) | Schnorr signatures, better privacy, more efficient multi-sig |
| 2024 | 4th Halving | 6.25 → 3.125 BTC/block |

### Ethereum History

| Year | Event | Description |
|------|-------|-------------|
| 2015 | Frontier (Genesis) | PoW (Ethash), block reward = 5 ETH, ~15s blocks, dev-only |
| 2016 | Homestead | First stable public release |
| 2016 | The DAO Hack + Hard Fork | $60M stolen; community forked to reverse it. Chain split: ETH (forked) vs ETC (original) |
| 2017 | Byzantium + Constantinople | Block reward: 5 → 3 → 2 ETH; EVM improvements |
| 2019 | Istanbul | Gas cost repricing, fixed DoS risk from underpriced opcodes |
| 2020 | Berlin | More gas repricing, EVM efficiency fixes |
| 2021 | **London (EIP-1559)** | Introduced baseFee + burn; ETH became potentially deflationary |
| 2022 | **The Merge** | PoW → PoS; energy use -99.95%; new ETH issuance dropped from ~13,000/day to ~1,700/day |
| 2023 | Shanghai / Capella (EIP-4895) | Enabled validator withdrawals (staked ETH finally unlockable) |
| 2024 | Dencun (EIP-4844) | "Blobs" — cheap temporary data storage; L2 fees dropped 10-100x |
| 2025 | Pectra | Deeper ERC-4337 integration; validator stake limit raised 32 → 2048 ETH max |

**Q3: What is "net deflationary" and "purely inflationary"? What is halving's purpose?**

**Purely inflationary (Bitcoin):**
- New BTC is minted every block, nothing is destroyed
- Supply only ever goes up (just slower over time)

**Net deflationary (Ethereum):**
- "Net" = combined result of minting (+) and burning (-)
- Net result can go either direction depending on activity

**Halving purpose:**
```
Purpose 1: Controlled supply schedule
  Mimics gold — early miners get more, reward diminishes
  Total supply approaches 21M asymptotically, never exceeds it

Purpose 2: Prevent early exhaustion
  At 50 BTC forever, all 21M would be mined in ~8 years
  Halving stretches it to ~2140

Purpose 3: Deflationary monetary policy
  Less new BTC entering circulation over time
  If demand stays constant → price should rise (scarcity)
```

Halving schedule:
```
2009: 50 BTC/block   → 7,200 BTC/day
2012: 25 BTC/block   → 3,600 BTC/day
2016: 12.5           → 1,800 BTC/day
2020: 6.25           → 900 BTC/day
2024: 3.125          → 450 BTC/day
2028: 1.5625         → 225 BTC/day
~2140: 0             → miners paid only by tx fees
```

---

## Session 8 — Block Mechanics, Nodes, Security Budget

**Q1: What is the purpose of gas limit per block? What happens when gas limit is hit before the 12s slot ends?**

**Purpose of gas limit:**
- Bounds how long a block takes to execute (prevents infinite loops halting the network)
- Throttles throughput to keep full node requirements manageable
- Without it, one malicious tx could loop forever and halt the network

**When gas limit is hit before 12s:**

The proposer broadcasts immediately — does not wait:
```
t=0s   Slot begins, proposer selected
t=2s   Block fills to 30M gas limit
t=2s   Block broadcast immediately (don't wait for 12s)
t=2–12s  Other validators attest
t=12s  Next slot begins
```

Proposer incentive: fill block as fast as possible, collect all tips, broadcast early. The 12s is a ceiling, not a target. In practice a proposer can build and broadcast a block in under 1 second.

Proposers prioritize **highest tip/gas txs first** from the mempool — not arrival order. That's why during congestion you pay more tip to jump the queue.

**Q2: Bitcoin adjusts difficulty to maintain 10 min/block target, right?**

Yes. Bitcoin's **automatic difficulty adjustment** runs every 2,016 blocks (~2 weeks):

```
new_difficulty = old_difficulty × (target_time / actual_time)

target_time = 2,016 × 10 min = 20,160 min

Scenario A: miners got faster
  actual_time = 8,000 min
  new_difficulty = old × (20,160 / 8,000) = old × 2.52 → harder

Scenario B: miners got slower
  actual_time = 35,000 min
  new_difficulty = old × (20,160 / 35,000) = old × 0.576 → easier
```

"Difficulty" = the block hash must start with a certain number of leading zeros. More zeros = exponentially harder to find by chance.

This is why Bitcoin's 10 min/block has held for 16 years despite hashrate growing by orders of magnitude. The only lag is the 2-week adjustment window.

---

## Session 9 — Minting, Block Timing, Security Budget References

**Q1: Why is minted ETH the same on busy vs quiet days? More txs = more validation = more minting?**

Minting is **per block, not per transaction**:

```
Each block produced → validator earns fixed base reward (~0.033 ETH/block)
Transactions inside → validator earns the TIPS (variable)
```

```
Quiet day:
  7,200 blocks/day × 0.033 ETH = ~1,700 ETH minted (fixed)
  Tips earned: small

Busy day:
  7,200 blocks/day × 0.033 ETH = ~1,700 ETH minted (same fixed amount)
  Tips earned: large
```

Tips are **not newly minted ETH** — they come from users' existing wallets. Only the base block reward creates new ETH.

**Q2: What triggers a block to close — is it when the block reaches its tx limit?**

Blocks are **time-driven, not fill-driven**. No "block is full → seal it" trigger.

```
Bitcoin:  target = 1 block every 10 minutes
Ethereum: target = 1 block every 12 seconds (called a "slot")
```

For Ethereum PoS:
- Time is divided into fixed 12-second slots
- Each slot: one validator is randomly selected to propose a block
- They collect pending txs from mempool up to the **gas limit**
- Block closes and broadcasts when gas limit is hit OR the proposer decides to broadcast
- The 12-second clock doesn't wait

Block gas limit: ~30,000,000 gas
```
Simple ETH transfer: 21,000 gas    → fits ~1,428 txs max
Token transfer: ~50,000 gas        → fits ~600 txs max
Complex DeFi: ~300,000 gas         → fits ~100 txs max
```

**Q3: Is Bitcoin's default 144 blocks/day? How about ETH?**

```
Bitcoin:
  Target: 1 block per 10 minutes
  Per day: 86,400s / 600s = 144 blocks/day ✓
  Difficulty adjusts every 2,016 blocks (~2 weeks)

Ethereum:
  Target: 1 block per 12 seconds (fixed slot time since The Merge)
  Per day: 86,400s / 12s = 7,200 blocks/day
  No difficulty adjustment — slot time is protocol-enforced
```

Key difference: Bitcoin's 10-minute target is probabilistic (miners race, sometimes 2 min, sometimes 25 min). Ethereum's 12-second slot is a hard schedule — a slot either has a block or it's "missed" (validator offline), but the next slot starts at exactly 12s regardless.

**Q4: Is there any proposal/discussion about Bitcoin's long-term security budget problem? Where to read more?**

This is called the **"security budget problem"** — search that exact phrase.

**Key people:**
- **Paul Sztorc** — argues fees will never be enough, proposes "Drivechain". Search: *"Paul Sztorc security budget"*
- **Nic Carter** — more optimistic, argues fee markets develop naturally. Blog: castle island ventures
- **Dan Held** — bullish, high BTC price compensates for low rewards
- **Peter Todd** — pessimistic, views it as an unsolved protocol-level flaw

**Articles to search for:**
- "Bitcoin's Security Budget in the Long Run"
- "The Bitcoin Security Budget Problem" — Jameson Lopp
- "How Bitcoin Could Fail" — various authors on LessWrong or Medium

**Forums:**
- https://bitcoin.stackexchange.com (search: "security budget")
- https://bitcointalk.org
- https://github.com/bitcoin/bitcoin/issues (search: "fee market")

**Academic paper:**
Search Google Scholar for: **"On the Instability of Bitcoin Without the Block Reward"** — Carlsten et al. (Princeton, 2019). Most cited academic treatment of this topic.
