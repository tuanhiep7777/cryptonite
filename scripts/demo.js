// A narrated, end-to-end walkthrough of every cryptonite (XAE) feature.
// Run against a local node:  npm run node   (terminal A)
//                            npm run demo   (terminal B)
const hre = require("hardhat");
const { ethers } = hre;

const fmt = (v) => ethers.formatUnits(v, 18);
const line = () => console.log("─".repeat(64));

async function showSupply(token, label) {
  console.log(`   ${label} totalSupply: ${fmt(await token.totalSupply())} XAE`);
}

async function main() {
  const [owner, alice, bob] = await ethers.getSigners();

  line();
  console.log("DEPLOY — mint initial supply to the owner");
  line();
  const token = await (await ethers.getContractFactory("Cryptonite")).deploy(1_000_000);
  await token.waitForDeployment();
  console.log(`   Deployed at ${await token.getAddress()}`);
  console.log(`   owner = ${owner.address}`);
  await showSupply(token, "initial");
  console.log(`   owner balance: ${fmt(await token.balanceOf(owner.address))} XAE`);

  line();
  console.log("MINT — owner issues new supply to Alice (inflation / validator-reward analogy)");
  line();
  await (await token.mint(alice.address, ethers.parseUnits("10000", 18))).wait();
  console.log(`   Alice balance: ${fmt(await token.balanceOf(alice.address))} XAE`);
  await showSupply(token, "after mint");

  line();
  console.log("TRANSFER — Alice sends 1,000 XAE to Bob; 1% is burned (deflation / EIP-1559 analogy)");
  line();
  const supplyBefore = await token.totalSupply();
  const sendAmount = ethers.parseUnits("1000", 18);
  await (await token.connect(alice).transfer(bob.address, sendAmount)).wait();
  const bobBal = await token.balanceOf(bob.address);
  const supplyAfter = await token.totalSupply();
  console.log(`   Alice sent:      ${fmt(sendAmount)} XAE`);
  console.log(`   Bob received:    ${fmt(bobBal)} XAE   (1% burned in transit)`);
  console.log(`   Supply burned:   ${fmt(supplyBefore - supplyAfter)} XAE`);
  await showSupply(token, "after transfer");

  line();
  console.log("STAKE — Alice stakes 5,000 XAE, then we fast-forward 180 days");
  line();
  await (await token.connect(alice).stake(ethers.parseUnits("5000", 18))).wait();
  console.log(`   Alice staked:    ${fmt(await token.stakedBalanceOf(alice.address))} XAE`);
  console.log(`   reward rate:     ${(await token.rewardRateBps())}bps (~10% APY)`);

  await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60]);
  await ethers.provider.send("evm_mine", []);
  console.log(`   ...advanced chain time by 180 days...`);
  console.log(`   pending reward:  ${fmt(await token.pendingReward(alice.address))} XAE`);

  line();
  console.log("CLAIM — Alice mints her accrued reward (new supply enters here)");
  line();
  const beforeClaim = await token.balanceOf(alice.address);
  await (await token.connect(alice).claimReward()).wait();
  const afterClaim = await token.balanceOf(alice.address);
  console.log(`   reward minted:   ${fmt(afterClaim - beforeClaim)} XAE`);
  await showSupply(token, "after claim");

  line();
  console.log("UNSTAKE — Alice withdraws her 5,000 XAE principal (no burn on unstake)");
  line();
  await (await token.connect(alice).unstake(ethers.parseUnits("5000", 18))).wait();
  console.log(`   Alice staked:    ${fmt(await token.stakedBalanceOf(alice.address))} XAE`);
  console.log(`   Alice balance:   ${fmt(await token.balanceOf(alice.address))} XAE`);

  line();
  console.log("Done. Supply went UP on mint & claim, DOWN on transfer — exactly as the notes describe.");
  line();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
