// Reset the *running* local node back to genesis without restarting the process.
//
//   npm run reset
//
// This wipes all deployed contracts and transactions and re-funds the 20 demo accounts
// with their initial 10,000 ETH. After a reset the XAE contract no longer exists, so
// run `npm run deploy` again to put it back on-chain.
//
// Note: a plain `npm run node` restart already gives you a fresh chain — use this only
// when you want a clean slate while keeping the same node process alive.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  await hre.network.provider.send("hardhat_reset", []);

  // The old deployment.json now points at a contract that no longer exists — drop it
  // so the dApp / balance script don't read a stale address.
  const deploymentPath = path.join(__dirname, "..", "frontend", "deployment.json");
  if (fs.existsSync(deploymentPath)) {
    fs.rmSync(deploymentPath);
    console.log("Removed stale frontend/deployment.json");
  }

  console.log("Local chain reset to genesis — all deployments, balances, and txs wiped.");
  console.log("Next: run `npm run deploy` to redeploy cryptonite (XAE).");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
