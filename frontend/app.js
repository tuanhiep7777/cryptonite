// cryptonite (XAE) demo dApp — vanilla JS + ethers v6 + MetaMask.
// Reads the deployed address + ABI from deployment.json (written by scripts/deploy.js).

const EXPECTED_CHAIN_ID = 31337n; // Hardhat local node

let provider; // BrowserProvider (MetaMask)
let signer;
let token; // read/write contract bound to the signer
let account;
let deployment;

const $ = (id) => document.getElementById(id);
const fmt = (v) => Number(ethers.formatUnits(v, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });

function status(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.classList.toggle("error", isError);
  if (!isError) setTimeout(() => el.classList.add("hidden"), 4000);
}

async function loadDeployment() {
  const res = await fetch("deployment.json", { cache: "no-store" });
  if (!res.ok) throw new Error("deployment.json not found — run `npm run deploy` first.");
  return res.json();
}

async function connect() {
  if (!window.ethereum) {
    status("MetaMask not found. Install it to use this demo.", true);
    return;
  }
  try {
    deployment = await loadDeployment();
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    token = new ethers.Contract(deployment.address, deployment.abi, signer);

    $("account").textContent = account;
    await checkNetwork();
    await refresh();
    subscribe();
  } catch (err) {
    status(err.message || String(err), true);
  }
}

async function checkNetwork() {
  const net = await provider.getNetwork();
  $("networkWarn").classList.toggle("hidden", net.chainId === EXPECTED_CHAIN_ID);
}

async function refresh() {
  if (!token) return;
  const [name, symbol, supply, bal, burn, reward, staked, pending, owner] = await Promise.all([
    token.name(),
    token.symbol(),
    token.totalSupply(),
    token.balanceOf(account),
    token.burnRateBps(),
    token.rewardRateBps(),
    token.stakedBalanceOf(account),
    token.pendingReward(account),
    token.owner(),
  ]);

  $("tokenName").textContent = name;
  $("tokenSymbol").textContent = symbol;
  $("totalSupply").textContent = `${fmt(supply)} ${symbol}`;
  $("balance").textContent = `${fmt(bal)} ${symbol}`;
  $("burnRate").textContent = `${Number(burn) / 100}%`;
  $("rewardRate").textContent = `${Number(reward) / 100}%`;
  $("staked").textContent = `${fmt(staked)} ${symbol}`;
  $("pending").textContent = `${fmt(pending)} ${symbol}`;

  // Owner-only mint panel
  $("ownerCard").classList.toggle("hidden", owner.toLowerCase() !== account.toLowerCase());
}

function subscribe() {
  // Live-update on any relevant contract event that touches our balances.
  const rerender = () => refresh().catch(() => {});
  token.on("Transfer", rerender);
  token.on("Staked", rerender);
  token.on("Unstaked", rerender);
  token.on("RewardClaimed", rerender);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function withTx(label, fn) {
  try {
    status(`${label}…`);
    const tx = await fn();
    await tx.wait();
    status(`${label} confirmed.`);
    await refresh();
  } catch (err) {
    status(err.shortMessage || err.message || String(err), true);
  }
}

async function doTransfer() {
  const to = $("transferTo").value.trim();
  const amount = $("transferAmount").value;
  if (!ethers.isAddress(to) || !amount) return status("Enter a valid address and amount.", true);
  await withTx("Transfer", () => token.transfer(to, ethers.parseUnits(amount, 18)));
}

async function doStake() {
  const amount = $("stakeAmount").value;
  if (!amount) return status("Enter an amount to stake.", true);
  await withTx("Stake", () => token.stake(ethers.parseUnits(amount, 18)));
}

async function doUnstake() {
  const amount = $("stakeAmount").value;
  if (!amount) return status("Enter an amount to unstake.", true);
  await withTx("Unstake", () => token.unstake(ethers.parseUnits(amount, 18)));
}

async function doClaim() {
  await withTx("Claim", () => token.claimReward());
}

async function doMint() {
  const to = $("mintTo").value.trim();
  const amount = $("mintAmount").value;
  if (!ethers.isAddress(to) || !amount) return status("Enter a valid address and amount.", true);
  await withTx("Mint", () => token.mint(to, ethers.parseUnits(amount, 18)));
}

// ── Wire up ──────────────────────────────────────────────────────────────

$("connectBtn").addEventListener("click", connect);
$("transferBtn").addEventListener("click", doTransfer);
$("stakeBtn").addEventListener("click", doStake);
$("unstakeBtn").addEventListener("click", doUnstake);
$("claimBtn").addEventListener("click", doClaim);
$("mintBtn").addEventListener("click", doMint);

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());
}
