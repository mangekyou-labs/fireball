import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';

// Add window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}

// ABI for a basic ERC20 token - add more functions as needed
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// DEX Router ABI - example using Uniswap V2 style interface
const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"
];

// Contract addresses from environment variables
const ROUTER_ADDRESS = import.meta.env.VITE_ROUTER_ADDRESS;

export class Web3Service {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private router: ethers.Contract | null = null;

  async connect(): Promise<boolean> {
    try {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        toast({
          title: "MetaMask Required",
          description: "Please install MetaMask to use this feature",
          variant: "destructive",
        });
        return false;
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.signer = this.provider.getSigner();
      this.router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, this.signer);

      // Get connected account to verify
      const address = await this.signer.getAddress();
      console.log("Connected to address:", address);

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to connect wallet";
      toast({
        title: "Connection Error",
        description: message,
        variant: "destructive",
      });
      return false;
    }
  }

  async executeSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippage: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.signer || !this.router) {
        throw new Error("Wallet not connected");
      }

      // Get token contracts
      const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, this.signer);

      // Approve router to spend tokens
      const approvalTx = await tokenInContract.approve(ROUTER_ADDRESS, amountIn);
      await approvalTx.wait();

      // Get expected output amount
      const amounts = await this.router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
      const amountOutMin = amounts[1].mul(ethers.BigNumber.from(1000 - slippage * 10)).div(1000);

      // Execute swap
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      const tx = await this.router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        [tokenIn, tokenOut],
        await this.signer.getAddress(),
        deadline
      );

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.transactionHash
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Swap failed";
      return {
        success: false,
        error: message
      };
    }
  }

  async getTokenBalance(tokenAddress: string): Promise<string> {
    try {
      if (!this.signer) {
        throw new Error("Wallet not connected");
      }

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const address = await this.signer.getAddress();
      const balance = await token.balanceOf(address);

      return balance.toString();
    } catch (error: unknown) {
      console.error("Failed to get token balance:", error);
      return "0";
    }
  }
}

export const web3Service = new Web3Service();