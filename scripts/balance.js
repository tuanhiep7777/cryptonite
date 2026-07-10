// Print token balances for accounts on the running local node.
//
// Choose what to check with the TOKEN env var (default: XAE):
//   XAE (default): npx hardhat run scripts/balance.js --network localhost
//   Native ETH:    TOKEN=ETH npx hardhat run scripts/balance.js --network localhost
//   Any ERC-20:    TOKEN=0xTokenAddress… npx hardhat run scripts/balance.js --network localhost
//
// Limit to one address with the ADDRESS env var (hardhat run can't take positional args):
//   ADDRESS=0x3C44… TOKEN=ETH npx hardhat run scripts/balance.js --network localhost
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

// Minimal read-only interface that works for any ERC-20 token.
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

const num = (v, decimals) =>
  Number(ethers.formatUnits(v, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 });

const line = () => console.log("─".repeat(96));
const idxCol = (i) => `${i}`.padStart(3) + "  "; // "  1  ", width 5
const addrCol = (a) => a.padEnd(44);
const amtCol = (s) => s.padStart(18);

function targetAddresses() {
  return process.env.ADDRESS
    ? [process.env.ADDRESS]
    : hre.ethers.getSigners().then((signers) => signers.map((s) => s.address));
}

function xaeAddress() {
  const p = path.join(__dirname, "..", "frontend", "deployment.json");
  if (!fs.existsSync(p)) {
    throw new Error("frontend/deployment.json not found — run `npm run deploy` first.");
  }
  return JSON.parse(fs.readFileSync(p, "utf8")).address;
}

// XAE gets the richer view (balance + staked + pending); everything else is balance-only.
async function reportXae(targets) {
  const address = xaeAddress();
  const token = await ethers.getContractAt("Cryptonite", address);
  const symbol = await token.symbol();

  console.log(`Token: ${symbol} (cryptonite)   Contract: ${address}`);
  line();
  console.log(idxCol("#") + addrCol("Address") + amtCol(`${symbol} balance`) + "staked".padStart(16) + "pending".padStart(16));
  line();
  for (let i = 0; i < targets.length; i++) {
    const addr = targets[i];
    if (!ethers.isAddress(addr)) {
      console.log(idxCol(i + 1) + `${addr}  — invalid address, skipped`);
      continue;
    }
    const [bal, staked, pending] = await Promise.all([
      token.balanceOf(addr),
      token.stakedBalanceOf(addr),
      token.pendingReward(addr),
    ]);
    console.log(idxCol(i + 1) + addrCol(addr) + amtCol(num(bal, 18)) + num(staked, 18).padStart(16) + num(pending, 18).padStart(16));
  }
  line();
}

async function reportEth(targets) {
  console.log(`Token: ETH (native)`);
  line();
  console.log(idxCol("#") + addrCol("Address") + amtCol("ETH balance"));
  line();
  for (let i = 0; i < targets.length; i++) {
    const addr = targets[i];
    if (!ethers.isAddress(addr)) {
      console.log(idxCol(i + 1) + `${addr}  — invalid address, skipped`);
      continue;
    }
    const bal = await ethers.provider.getBalance(addr);
    console.log(idxCol(i + 1) + addrCol(addr) + amtCol(num(bal, 18)));
  }
  line();
}

async function reportErc20(tokenAddr, targets) {
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, ethers.provider);
  let symbol, decimals;
  try {
    [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
  } catch {
    throw new Error(`No ERC-20 token found at ${tokenAddr} on this network.`);
  }

  console.log(`Token: ${symbol}   Contract: ${tokenAddr}`);
  line();
  console.log(idxCol("#") + addrCol("Address") + amtCol(`${symbol} balance`));
  line();
  for (let i = 0; i < targets.length; i++) {
    const addr = targets[i];
    if (!ethers.isAddress(addr)) {
      console.log(idxCol(i + 1) + `${addr}  — invalid address, skipped`);
      continue;
    }
    const bal = await token.balanceOf(addr);
    console.log(idxCol(i + 1) + addrCol(addr) + amtCol(num(bal, decimals)));
  }
  line();
}

async function main() {
  const token = (process.env.TOKEN || "XAE").trim();
  const targets = await targetAddresses();

  if (token.toUpperCase() === "ETH") {
    await reportEth(targets);
  } else if (token.toUpperCase() === "XAE") {
    await reportXae(targets);
  } else if (ethers.isAddress(token)) {
    await reportErc20(token, targets);
  } else {
    throw new Error(
      `Unknown TOKEN '${token}'. Use ETH, XAE (default), or an ERC-20 contract address (0x…).`
    );
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
