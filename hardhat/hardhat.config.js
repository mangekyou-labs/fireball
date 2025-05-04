require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000,
        details: { yul: false },
      },
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sonicBlazeTestnet: {
      url: "https://rpc.blaze.soniclabs.com",
      chainId: 57054,
      accounts: [process.env.PRIVATE_KEY, process.env.SECOND_PRIVATE_KEY],
    },
    abcTestnet: {
      url: "https://rpc.abc.t.raas.gelato.cloud",
      chainId: 112,
      accounts: [process.env.PRIVATE_KEY, process.env.SECOND_PRIVATE_KEY],
      explorer: "https://explorer.abc.t.raas.gelato.cloud/",
    },
    espressoRollup: {
      url: "http://13.239.65.206:8547",
      chainId: 42169,
      accounts: [process.env.PRIVATE_KEY, process.env.SECOND_PRIVATE_KEY],
      explorer: "https://explorer.decaf.testnet.espresso.network/",
    },
    iotaEvmTestnet: {
      url: "https://json-rpc.evm.testnet.iotaledger.net",
      chainId: 1075,
      accounts: [process.env.PRIVATE_KEY, process.env.SECOND_PRIVATE_KEY],
      explorer: "https://explorer.evm.testnet.iotaledger.net/",
    }
  },
};