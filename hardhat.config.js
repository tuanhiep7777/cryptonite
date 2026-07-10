require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // The in-process Hardhat network used by `hardhat test`.
    hardhat: {
      chainId: 31337,
    },
    // The standalone node started with `npm run node` (hardhat node).
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
};
