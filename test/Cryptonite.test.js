const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const parse = (n) => ethers.parseUnits(n.toString(), 18);
const INITIAL = 1_000_000;

async function deploy() {
  const [owner, alice, bob] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("Cryptonite")).deploy(INITIAL);
  await token.waitForDeployment();
  return { token, owner, alice, bob };
}

describe("Cryptonite (XAE)", function () {
  describe("metadata & initial supply", function () {
    it("sets name, symbol, decimals and mints the initial supply to the deployer", async function () {
      const { token, owner } = await deploy();
      expect(await token.name()).to.equal("cryptonite");
      expect(await token.symbol()).to.equal("XAE");
      expect(await token.decimals()).to.equal(18n);
      expect(await token.totalSupply()).to.equal(parse(INITIAL));
      expect(await token.balanceOf(owner.address)).to.equal(parse(INITIAL));
    });
  });

  describe("deflationary burn on transfer", function () {
    it("burns exactly burnRateBps and reduces totalSupply", async function () {
      const { token, owner, alice } = await deploy();
      const amount = parse(1000);
      const supplyBefore = await token.totalSupply();

      await token.transfer(alice.address, amount);

      const fee = (amount * 100n) / 10_000n; // default 1%
      expect(await token.balanceOf(alice.address)).to.equal(amount - fee);
      expect(await token.totalSupply()).to.equal(supplyBefore - fee);
    });

    it("applies the burn on transferFrom too", async function () {
      const { token, owner, alice, bob } = await deploy();
      const amount = parse(500);
      await token.approve(alice.address, amount);

      await token.connect(alice).transferFrom(owner.address, bob.address, amount);

      const fee = (amount * 100n) / 10_000n;
      expect(await token.balanceOf(bob.address)).to.equal(amount - fee);
    });

    it("honors an owner-updated burn rate and rejects a zero-rate transfer having no burn", async function () {
      const { token, owner, alice } = await deploy();
      await token.setBurnRateBps(0);
      const amount = parse(1000);
      const supplyBefore = await token.totalSupply();
      await token.transfer(alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(supplyBefore);
    });

    it("rejects a burn rate above the cap and non-owner updates", async function () {
      const { token, alice } = await deploy();
      await expect(token.setBurnRateBps(1_001)).to.be.revertedWith("burn rate too high");
      await expect(token.connect(alice).setBurnRateBps(50)).to.be.reverted;
    });
  });

  describe("owner mint", function () {
    it("lets the owner mint and raises totalSupply", async function () {
      const { token, alice } = await deploy();
      const supplyBefore = await token.totalSupply();
      await token.mint(alice.address, parse(10_000));
      expect(await token.balanceOf(alice.address)).to.equal(parse(10_000));
      expect(await token.totalSupply()).to.equal(supplyBefore + parse(10_000));
    });

    it("reverts when a non-owner mints", async function () {
      const { token, alice } = await deploy();
      await expect(token.connect(alice).mint(alice.address, parse(1))).to.be.reverted;
    });
  });

  describe("staking", function () {
    it("moves principal into the contract without a burn", async function () {
      const { token, owner } = await deploy();
      const supplyBefore = await token.totalSupply();
      await token.stake(parse(5000));
      expect(await token.stakedBalanceOf(owner.address)).to.equal(parse(5000));
      expect(await token.totalSupply()).to.equal(supplyBefore); // staking does not burn
    });

    it("accrues rewards proportional to time (~10% APY)", async function () {
      const { token, owner } = await deploy();
      await token.stake(parse(10_000));

      await time.increase(365 * 24 * 60 * 60); // one year
      // 10% of 10,000 = ~1,000 XAE
      const pending = await token.pendingReward(owner.address);
      expect(pending).to.be.closeTo(parse(1000), parse(1));
    });

    it("mints the accrued reward on claim and raises supply", async function () {
      const { token, owner } = await deploy();
      await token.stake(parse(10_000));
      await time.increase(365 * 24 * 60 * 60);

      const balBefore = await token.balanceOf(owner.address);
      const supplyBefore = await token.totalSupply();
      await token.claimReward();
      const minted = (await token.balanceOf(owner.address)) - balBefore;

      expect(minted).to.be.closeTo(parse(1000), parse(1));
      expect(await token.totalSupply()).to.equal(supplyBefore + minted);
      // reward resets after claim
      expect(await token.pendingReward(owner.address)).to.be.closeTo(0n, parse(1));
    });

    it("returns principal on unstake without a burn", async function () {
      const { token, owner } = await deploy();
      const balBefore = await token.balanceOf(owner.address);
      await token.stake(parse(5000));
      await token.unstake(parse(5000));
      expect(await token.stakedBalanceOf(owner.address)).to.equal(0n);
      expect(await token.balanceOf(owner.address)).to.equal(balBefore); // full principal back
    });

    it("reverts on claim with no reward and unstake beyond stake", async function () {
      const { token, owner } = await deploy();
      await expect(token.claimReward()).to.be.revertedWith("no reward");
      await expect(token.unstake(parse(1))).to.be.revertedWith("insufficient stake");
    });
  });
});
