# Ethereum & Crypto Learning Notes

Full Q&A session in chronological order.

---

**Q: I want to create a cryptocurrency on the Ethereum platform locally. Is it possible (including deployment)?**

Yes, completely possible. The local stack:
- **Hardhat** — local Ethereum node + compilation + deployment scripts (most beginner-friendly)
- **Solidity** — the language for writing your token contract (ERC-20 standard)
- **ethers.js** — interact with your deployed contract from JavaScript
- Optionally **MetaMask** (browser wallet) to interact with it visually

The full flow locally:
1. Write an ERC-20 token contract in Solidity
2. Start a local Hardhat node (simulates Ethereum — no real ETH needed)
3. Deploy the contract to that local node
4. Interact with it (mint tokens, transfer, check balances) via scripts or console

This teaches you: how contracts work, how the EVM executes code, how gas fees are calculated, how wallets/addresses own tokens, and how deployment transactions work.

---

**Q: (chose "Explain first") Walk through how Ethereum/ERC-20 works conceptually before touching any code**

### How Ethereum Works

Ethereum is a **distributed state machine**. Every node in the network holds a copy of the same state: a giant table of addresses and their balances/data.

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

Every state change requires a **transaction** signed by an EOA:

```
Transaction {
  from:     0xYourWallet
  to:       0xSomeContract
  value:    0.1 ETH              ← optional ETH to send
  data:     transfer(0xBob, 50)  ← which function to call + args
  gas:      21000                ← max compute you'll pay for
  gasPrice: 10 gwei              ← price per unit of compute
  nonce:    7                    ← prevents replay attacks
}
```

### What a Smart Contract Is

A contract is just **code + storage deployed at an address**. Written in Solidity, compiled to EVM bytecode:

```solidity
contract MyToken {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 amount) public {
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}
```

`mapping(address => uint256)` is like a hash map that lives permanently on the blockchain.

### The ERC-20 Standard

ERC-20 is just an **agreed interface** — a set of functions every token must implement so wallets, exchanges, and dApps can talk to any token:

```
Required functions:
  totalSupply()                           → how many tokens exist
  balanceOf(address)                      → how many tokens an address holds
  transfer(address to, uint256 amount)    → send your tokens
  approve(address spender, uint256 amt)   → let someone else spend your tokens
  transferFrom(address from, address to)  → spend approved tokens
  allowance(address owner, address spndr) → check approved amount

Required events (logged on-chain):
  Transfer(from, to, amount)
  Approval(owner, spender, amount)
```

### What "Deploying" Means

Deploying = sending a special transaction with no `to` address, and `data` = your compiled bytecode:

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

**Q: How about the other values in the deploy transaction? like value, gas, gasPrice, nonce**

All those fields are still present — nothing is skipped:

```
Transaction {
  from:     0xYourWallet
  to:       (empty / null)     ← this is what signals "deploy"
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
If your constructor isn't `payable` and you send ETH, the transaction reverts.

**`gas`** — Deploying is expensive because the EVM must:
1. Execute your constructor code
2. Store every byte of your contract's bytecode on-chain (200 gas per byte of storage)

A simple ERC-20 might cost 500k–1.5M gas to deploy. A regular ETH transfer costs exactly 21,000.

**`gasPrice`** — Post EIP-1559 (2021) Ethereum splits this into:
- `baseFee` — set by the network, burned (destroyed)
- `maxPriorityFee` — tip to the validator

**`nonce`** — Tracks how many transactions an EOA has ever sent. Also determines the contract's address deterministically:
```
contractAddress = keccak256(deployerAddress + nonce)
```
So deploying from the same wallet at the same nonce always produces the same contract address.

---

**Q1: What is EVM? Is it the application that runs on every node of the Ethereum network? Is a miner/validator a node?**

Yes exactly. The **Ethereum Virtual Machine** is a sandboxed runtime that executes bytecode. Every node runs an identical copy:

```
Ethereum Network
├── Node A  [EVM] ← runs your contract code
├── Node B  [EVM] ← runs the exact same code
├── Node C  [EVM] ← runs the exact same code
└── ...thousands more
```

Every node independently executes every transaction and arrives at the **exact same resulting state**. No central server, yet everyone agrees.

**Yes, a miner/validator is a node.** Distinction:
- **Full nodes** — store the entire blockchain and verify every transaction, but don't produce blocks
- **Miners/Validators** — full nodes that also *produce* new blocks

---

**Q2: What actually is the mining/validation — "after the transaction is mined"?**

Transactions don't go directly into the blockchain. They sit in the **mempool** (memory pool) first:

```
You sign a tx → broadcast to network → lands in mempool (pending)
                                              ↓
                                    Validator picks it up
                                              ↓
                                    Executes it on their EVM
                                              ↓
                                    Bundles it into a block with other txs
                                              ↓
                                    Broadcasts the block to the network
                                              ↓
                                    Other nodes verify & accept the block
                                              ↓
                                    Tx is now "mined" / confirmed
```

What the validator actually does:
- Picks transactions from the mempool (usually highest gas fee first)
- Executes each one on their EVM, recording the state changes
- Packages them into a block with a cryptographic hash linking to the previous block
- Under **Proof of Stake**: validators are chosen randomly, weighted by how much ETH they've staked. Cheating = losing your stake.
- Earns the gas fees from all transactions in their block as reward

"Mined" just means: your transaction was included in a block that the rest of the network accepted as valid.

---

**Q3: "Anyone can call the contract by sending a transaction to 0xNewContractAddress" — does this mean to transfer 10 ABC tokens from 0x123 to 0x456, I send this transaction?**

```
Transaction {
  from:     0x123
  to:       0xabc       ← the ABC token contract address
  value:    0 ETH       ← not sending ETH, sending ABC tokens
  data:     transfer(0x456, 10)
  gas:      ~50,000     ← not 21,000 (see below)
  gasPrice: 10 gwei
  nonce:    7
}
```

Yes, exactly right. The EVM flow:
```
1. EVM loads the bytecode stored at 0xabc
2. Reads data field → "call the transfer function with args (0x456, 10)"
3. Executes:
     balances[0x123] -= 10   ← subtract from sender
     balances[0x456] += 10   ← add to recipient
4. Emits Transfer(0x123, 0x456, 10) event (logged on-chain)
5. State change committed
```

**Correction on gas:** 21,000 is the base cost for a plain ETH transfer (no code execution). Calling a contract function is ~45,000–65,000 gas.

Also: `value: 0 ETH` because ETH and ABC tokens are completely separate. ABC tokens only exist as numbers in `balances[address]` inside the contract's storage. The only ETH involved is the gas fee.

---

**Q1: "Full nodes store the entire blockchain and verify every transaction, but don't produce blocks" — if they verify, why don't they store txs to their copy? And who adds txs to a block?**

That wording was imprecise. Full nodes DO store transactions. Clarified:

```
Full Node job:
  ✓ Receives every new block from validators
  ✓ Verifies every transaction in that block is valid
  ✓ Executes every tx on its own EVM to confirm the resulting state
  ✓ Stores the block (including all txs) to its local copy of the blockchain
  ✗ Does NOT package txs into new blocks
  ✗ Does NOT get to decide which txs go in next
```

Flow:
```
Validator produces block → broadcasts to network
        ↓
Full nodes receive it → verify it → store it
```

Full nodes are the **audience and auditors**. Validators are the **authors**. But everyone ends up with the same blockchain copy.

---

**Q2: Who runs the full nodes and validator nodes? Can I join as an individual? What is the ratio between full nodes and validator nodes?**

**Yes, anyone can run a node.** No permission needed — just download the client software (Geth, Nethermind) and start syncing.

Who actually runs them:
- **Full nodes**: individuals, companies, dApps (Infura, Alchemy run thousands), researchers
- **Validators**: individuals and institutions who have staked **32 ETH minimum** (~$80,000 at current prices). The stake keeps them honest — cheat and lose it.

Current rough numbers (2025):
```
Full nodes:          ~6,000–10,000  (many are private/unlisted)
Validators:          ~1,000,000+    (one person can run multiple slots)
Validator entities:  ~10,000–20,000 unique operators
```

Staking pools (like Lido) let people pool ETH together, splitting the 32 ETH requirement. One operator runs the node but represents thousands of stakers.

---

**Q3: Transferring 10 ABC involves gas fee (calculated in gwei/ETH). Does my address 0x123 need sufficient ETH balance to pay for gas?**

Exactly right. This trips up many beginners:

```
To transfer 10 ABC from 0x123:
  0x123 needs:
    ✓ At least 10 ABC tokens (in the contract's storage)
    ✓ Some ETH (in its native balance) to pay gas
```

These are separate balances:
```
0x123 native account:
  ETH balance: 0.01 ETH   ← pays gas fee to validator

ABC contract storage:
  balances[0x123] = 10    ← the tokens being transferred
```

This is a real UX problem — new users receive tokens but can't move them because they have zero ETH for gas. ERC-4337 ("account abstraction") addresses this.

---

**Q4: Who sets the gas?**

Three different parties set three different things:

**Gas limit** (max units of compute) — set by **you, the sender**:
```
Your wallet estimates: "this transfer will take ~50,000 gas units"
You set limit to 65,000 to be safe
If tx uses less → unused gas is refunded
If tx uses more → tx fails, but you still pay for what was used
```

**Base fee** — set by **the network**:
```
Since EIP-1559 (2021):
  baseFee = automatically adjusted by the network each block
            → goes up when blocks are full (high demand)
            → goes down when blocks are under-used
  baseFee is BURNED (destroyed, not paid to validator)
```

**Priority fee (tip)** — set by **you, the sender**:
```
maxPriorityFee = tip you offer the validator
                 → higher tip = validator picks your tx first
                 → during congestion, people bid up this tip
```

Total cost:
```
Gas cost = gas units used × (baseFee + priorityFee)

Example:
  50,000 gas × (15 gwei baseFee + 2 gwei tip) = 850,000 gwei = 0.00085 ETH
                 ↑ burned                ↑ validator keeps
```

---

**Q1: Why burn the base fee?**

Before EIP-1559, all gas fees went to miners. Problem:
```
Miners could manipulate the network to inflate fees:
  - Artificially fill blocks with their own fake txs
  - Forces real users to bid higher to get included
  - Miners profit from the congestion they created
```

Burning the base fee fixes this:
- Validators only earn the tip, not the base fee
- No incentive to manufacture congestion

Secondary effect: burning creates deflationary pressure. During high-activity periods, more ETH is burned than minted → supply shrinks. Ethereum calls this the "ultrasound money" thesis.

---

**Q2: Mining/validating txs does not cost significant computation like PoW. Will ETH get inflation?**

Two forces pull in opposite directions:

```
ETH supply increases: new ETH minted as validator rewards (~0.3%/year)
ETH supply decreases: base fee burned (depends on network activity)

Low activity:  minted > burned → slight inflation
High activity: burned > minted → deflation (supply shrinks)
```

Since the Merge (2022), ETH has been roughly **net deflationary** during busy periods. PoS uses ~99.95% less energy than PoW, so the protocol doesn't need to mint as many new coins to incentivize validators (~0.3% vs Bitcoin's ~1.7% issuance).

---

**Q3: Can I take profit from staking (validating) in ETH like mining in BTC? It seems weird since PoS doesn't require hardware investment — just deposit ETH and get it back eventually.**

Yes, ~3-4% APY in ETH rewards. Not "free money" though:

```
Risk 1: ETH price risk
  Your 32 ETH could drop in USD value while locked.

Risk 2: Slashing
  Misbehavior (double-signing, excessive downtime) → network destroys
  part of your staked ETH as punishment. Capital is at real risk.

Risk 3: Lock-up period
  Unstaking takes days to weeks depending on the exit queue.

Risk 4: Technical operation
  Validator node must run 24/7. Frequent downtime = small penalties.
```

PoS replaces *physical* capital expenditure (hardware/electricity) with *financial* capital at risk. The "skin in the game" principle is the same — you have something real to lose if you cheat.

---

**Q4: "ERC-4337 lets you pay gas in the token itself" — does this only apply to IPO'd coins with real value?**

Not exactly. The constraint is whether a **Paymaster** exists that accepts the token:

```
Normal flow:
  You (0x123) → pay gas in ETH directly to validator

ERC-4337 flow:
  You (0x123) → pay gas in ABC token
                      ↓
               Paymaster contract (middleman)
                      ↓
               Paymaster holds ETH, pays validator on your behalf
               Charges you ABC tokens in return
```

- Works for USDC, USDT, DAI — paymasters exist for these
- Works for your own app token **if you run your own paymaster**
- You could deploy UCoin + your own Paymaster with zero market value, as long as *you* front the ETH

Many dApps offer "gasless" UX by sponsoring gas on behalf of users entirely — this is the same mechanism.

---

**Q1: Why "low activity = inflation, high activity = deflation"?**

The fixed mint is ~1,750 ETH/day regardless of activity. The burn varies:

```
Quiet day (few transactions):
  Minted: +1,750 ETH
  Burned:   -500 ETH   ← low traffic, low fees, low burn
  Net:    +1,250 ETH   → supply grows → inflation

Busy day (NFT drop, market crash, DeFi frenzy):
  Minted:  +1,750 ETH
  Burned: -15,000 ETH  ← high traffic, high baseFee, massive burn
  Net:   -13,250 ETH   → supply shrinks → deflation
```

The base fee also rises automatically when blocks are full (EIP-1559 design), so high activity → higher baseFee → more burned per tx. It compounds.

---

**Q2: List all major changes in ETH and BTC history**

### Bitcoin History

| Year | Event | Description |
|------|-------|-------------|
| 2009 | Genesis | PoW (SHA-256), block reward = 50 BTC, 10 min blocks, 21M cap hardcoded |
| 2012 | 1st Halving | Block reward: 50 → 25 BTC |
| 2016 | 2nd Halving | Block reward: 25 → 12.5 BTC |
| 2017 | SegWit (BIP141) | Fixed tx malleability, increased effective capacity, enabled Lightning Network |
| 2017 | Bitcoin Cash Fork | Community split over block size; BCH raised to 8MB, BTC kept 1MB + SegWit. Two separate chains. |
| 2018 | Lightning Network mainnet | Layer 2 payment channels — off-chain instant transfers, settle on-chain when channel closes |
| 2020 | 3rd Halving | Block reward: 12.5 → 6.25 BTC |
| 2021 | Taproot (BIP340/341/342) | Schnorr signatures, better privacy, more efficient multi-sig, foundation for advanced scripts |
| 2024 | 4th Halving | Block reward: 6.25 → 3.125 BTC |

### Ethereum History

| Year | Event | Description |
|------|-------|-------------|
| 2015 | Frontier (Genesis) | PoW (Ethash), block reward = 5 ETH, ~15s blocks, command line only for developers |
| 2016 | Homestead | First stable public release, minor protocol improvements |
| 2016 | The DAO Hack + Hard Fork | $60M stolen from a smart contract; community voted to hard fork and reverse the hack. Minority refused → chain split: ETH (forked) vs ETC (Ethereum Classic, original). Broke "code is law" principle. |
| 2017 | Byzantium + Constantinople | Block reward reduced: 5 → 3 → 2 ETH; EVM improvements, groundwork for PoS |
| 2019 | Istanbul | Gas cost repricing (underpriced opcodes = DoS risk), Zcash compatibility |
| 2020 | Berlin | More gas repricing, EVM efficiency fixes |
| 2021 | **London (EIP-1559)** | Introduced baseFee + burn mechanism; ETH became potentially deflationary for the first time |
| 2022 | **The Merge** | PoW completely replaced by PoS; energy use dropped ~99.95%; new ETH issuance dropped from ~13,000/day to ~1,700/day |
| 2023 | Shanghai / Capella (EIP-4895) | Enabled validator withdrawals — staked ETH finally unlockable (was locked for years with no exit) |
| 2024 | Dencun (EIP-4844) | Introduced "blobs" — cheap temporary data storage; Layer 2 fees dropped 10-100x |
| 2025 | Pectra | Deeper ERC-4337 integration; validator stake limit raised 32 → 2048 ETH max |

---

**Q3: Explain "net deflationary" and "purely inflationary". What is the purpose of halving?**

**Purely inflationary (Bitcoin):**
```
New BTC is minted every block → forever (until ~2140 when supply hits 21M)
Nothing is ever destroyed
Supply only ever goes up (just slower and slower)
= purely inflationary, always
```

**Net deflationary (Ethereum):**
```
"Net" = combined result of two opposing forces:
  Force A: new ETH minted (+)
  Force B: base fee burned (-)

Net result can go either direction.
"Net deflationary" means Force B > Force A.
Supply actually fell after the Merge during active periods.
```

**Halving purpose:**

Bitcoin's total supply is hardcoded at **21 million BTC**. The block reward is cut in half every 210,000 blocks (~4 years):

```
Purpose 1: Controlled supply schedule
  Mimics gold mining — early miners get more, reward diminishes over time
  Total supply asymptotically approaches 21M, never exceeds it

Purpose 2: Prevent early exhaustion of rewards
  If reward stayed at 50 BTC forever, all 21M mined in ~8 years
  Halving stretches it out to ~2140

Purpose 3: Deflationary monetary policy by design
  Less new BTC entering circulation over time
  If demand stays constant or grows → price should rise (scarcity)
```

Halving schedule:
```
2009: 50 BTC/block   → 7,200 BTC/day new supply
2012: 25 BTC/block   → 3,600 BTC/day
2016: 12.5           → 1,800 BTC/day
2020: 6.25           → 900 BTC/day
2024: 3.125          → 450 BTC/day
2028: 1.5625         → 225 BTC/day
~2140: 0             → miners paid only by tx fees, zero new BTC
```

Open question: when the reward reaches near-zero, will transaction fees alone be enough to incentivize miners to secure the network?

---

**Q1: "Fixed mint is ~1,750 ETH/day regardless of activity" — why same on busy vs quiet days? More txs = more validation work = more minting?**

Minting is **per block, not per transaction**:

```
Each block produced → validator earns a fixed base reward (~0.033 ETH/block)
Transactions inside → validator earns the TIPS from each tx (variable)
```

```
Quiet day:
  7,200 blocks/day × 0.033 ETH = ~1,700 ETH minted  ← fixed
  Tips earned: small (few txs, low tips)              ← variable

Busy day:
  7,200 blocks/day × 0.033 ETH = ~1,700 ETH minted  ← same fixed amount
  Tips earned: large (many txs, high tips)            ← variable
```

Tips are **not newly minted ETH** — they come from users' existing ETH wallets. Only the base block reward creates new ETH. No matter how busy the network is, the daily ETH creation from minting stays constant.

---

**Q2: Whenever a block is not receiving txs anymore, will it be appended to the blockchain? Is the scenario when the block reaches its tx limit?**

Blocks are **time-driven, not fill-driven**. There is no "block is full → seal it" trigger:

```
Bitcoin:  target = 1 block every 10 minutes
Ethereum: target = 1 block every 12 seconds (called a "slot")
```

For Ethereum PoS:
- Time is divided into fixed 12-second slots
- Each slot: one validator is randomly selected to propose a block
- They collect pending txs from mempool up to the **gas limit**
- Block closes when gas limit is hit (or proposer decides to broadcast)
- The 12-second clock doesn't wait for the block to fill

Block gas limit: ~30,000,000 gas
```
Simple ETH transfer: 21,000 gas  → fits ~1,428 txs max
Token transfer: ~50,000 gas      → fits ~600 txs max
Complex DeFi: ~300,000 gas       → fits ~100 txs max
```

A sparse block (quiet period) goes out with fewer txs — the slot ends and the next validator takes over regardless.

---

**Q3: Is the default blocks per day of BTC 144? If yes, how about ETH?**

```
Bitcoin:
  Target: 1 block per 10 minutes
  Per day: 86,400s / 600s = 144 blocks/day ✓
  Difficulty adjusts every 2,016 blocks (~2 weeks) to maintain this target

Ethereum:
  Target: 1 block per 12 seconds (fixed slot time since the Merge)
  Per day: 86,400s / 12s = 7,200 blocks/day
  No difficulty adjustment — slot time is protocol-enforced
```

Key difference: Bitcoin's 10-minute target is **probabilistic** (miners race, sometimes 2 min, sometimes 25 min). Ethereum's 12-second slot is a **hard schedule** — a slot either has a block or it's "missed" (validator offline), but the next slot starts at exactly 12s regardless.

---

**Q4: Regarding "when the reward reaches near-zero, will transaction fees alone be enough?" — is there any proposal/discussion? Where to read more?**

This is called the **"security budget problem"** — search that exact phrase.

**Key people and positions:**
- **Paul Sztorc** — argues fees will never be enough, proposes "Drivechain" (merge-mined sidechains as a fee source). Search: *"Paul Sztorc security budget"*
- **Nic Carter** — more optimistic, argues fee markets will develop naturally. Blog: castle island ventures + *"bitcoin security budget"*
- **Dan Held** — bullish, argues high BTC price compensates for low rewards
- **Peter Todd** — pessimistic, views this as an unsolved protocol-level flaw

**Articles to search for by title:**
- "Bitcoin's Security Budget in the Long Run"
- "The Bitcoin Security Budget Problem" — Jameson Lopp
- "How Bitcoin Could Fail" — various authors on LessWrong or Medium
- "The Inevitable Rise of Demurrage on Bitcoin" — pessimist view

**Forums:**
- https://bitcoin.stackexchange.com (search: "security budget")
- https://bitcointalk.org
- https://github.com/bitcoin/bitcoin/issues (search: "fee market")

**Academic paper:**
Search Google Scholar for: **"On the Instability of Bitcoin Without the Block Reward"** — Carlsten et al. (Princeton, 2019). Most cited academic treatment of this topic.

---

**Q1: What is the purpose of gas limit per block? What happens if the 12s slot hasn't ended but gas hits the limit — does the proposer stop and wait?**

**Purpose of gas limit:**

```
No gas limit scenario:
  Someone submits 1 tx that loops forever
  → EVM runs forever
  → Block never finishes executing
  → Network halts

With gas limit:
  Every EVM operation costs gas
  Block cap = 30M gas
  → Any tx that hits the cap mid-execution → reverts, not included
  → Block execution time is mathematically bounded
```

Also a **throughput throttle** — prevents state from growing so fast that only data centers can sync → network centralizes.

**When gas limit is hit before 12s:**

The proposer **immediately broadcasts the block — does not wait**:

```
t=0s    Slot begins, proposer selected
t=2s    Block fills to 30M gas limit
t=2s    Block broadcast immediately (don't wait for 12s)
t=2–12s Other validators attest (vote to confirm)
t=12s   Next slot begins
```

Proposer incentive reasoning is exactly right: they already collected all the tips they can fit. Adding more is impossible (protocol rejects it). Optimal strategy: fill the block as fast as possible, broadcast early. In practice a proposer can build and broadcast a block in under 1 second.

Proposers prioritize **highest tip/gas txs first** from the mempool — not arrival order. That's why during congestion you pay a higher tip to jump the queue.

---

**Q2: Bitcoin needs to adjust its difficulty to "regression" its mined time per block to the target (10 mins), doesn't it?**

Yes. Bitcoin has an **automatic difficulty adjustment** every 2,016 blocks (~2 weeks):

```
new_difficulty = old_difficulty × (target_time / actual_time)

target_time = 2,016 × 10 min = 20,160 min

Scenario A: miners got faster (more hashrate joined)
  actual_time = 8,000 min
  new_difficulty = old × (20,160 / 8,000) = old × 2.52 → harder

Scenario B: miners got slower (hashrate left, e.g. China mining ban 2021)
  actual_time = 35,000 min
  new_difficulty = old × (20,160 / 35,000) = old × 0.576 → easier
```

"Difficulty" = the block hash must start with a certain number of leading zeros. More zeros = exponentially harder to find by chance. Miners roll dice billions of times per second until they find a number below the target threshold.

This is why Bitcoin's 10 min/block has held for 16 years despite hashrate growing by orders of magnitude. The only lag is the 2-week adjustment window.
