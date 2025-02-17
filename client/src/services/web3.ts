import { ethers } from "ethers";

class Web3Service {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private routerAddress: string;

  constructor() {
    this.routerAddress = import.meta.env.VITE_ROUTER_ADDRESS;
  }

  async connect(useTestWallet: boolean = false): Promise<boolean> {
    try {
      if (useTestWallet) {
        // Use a test wallet with predefined private key for testing
        const testProvider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/demo");
        const testWallet = ethers.Wallet.createRandom();
        this.signer = testWallet.connect(testProvider);
        return true;
      }

      if (typeof window.ethereum === "undefined") {
        throw new Error("MetaMask not installed");
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.signer = this.provider.getSigner();
      return true;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      return false;
    }
  }

  getCurrentWalletAddress(): string | null {
    if (!this.signer) return null;
    return this.signer.getAddress();
  }

  async executeSwap(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: ethers.BigNumber,
    slippagePercentage: number
  ): Promise<{ success: boolean; txHash?: string; error?: string; status?: string }> {
    try {
      // This is a mock implementation for testing
      // In production, this would interact with the actual Uniswap Router contract
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate blockchain delay
      
      const mockTxHash = "0x" + Array(64).fill("0").map(() => Math.floor(Math.random() * 16).toString(16)).join("");
      
      return {
        success: true,
        txHash: mockTxHash,
        status: "completed"
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        status: "failed"
      };
    }
  }
}

export const web3Service = new Web3Service();
