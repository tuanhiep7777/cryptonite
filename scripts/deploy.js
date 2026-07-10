// Deploys cryptonite (XAE) and writes the address + ABI to frontend/deployment.json
// so the vanilla dApp can pick it up automatically.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const INITIAL_SUPPLY = 1_000_000; // whole tokens minted to the deployer

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const Cryptonite = await hre.ethers.getContractFactory("Cryptonite");
  const token = await Cryptonite.deploy(INITIAL_SUPPLY);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log(`cryptonite (XAE) deployed at: ${address}`);
  console.log(`Initial supply: ${INITIAL_SUPPLY.toLocaleString()} XAE -> ${deployer.address}`);

  // Persist address + ABI for the frontend.
  const artifact = await hre.artifacts.readArtifact("Cryptonite");
  const out = {
    address,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    abi: artifact.abi,
  };
  const outPath = path.join(__dirname, "..", "frontend", "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote deployment info -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
