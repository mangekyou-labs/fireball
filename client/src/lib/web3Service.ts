import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';
import { testWalletService } from './testWalletService';
import { getPrice, runSwap, WETH, WBTC, USDC, USDT } from './uniswap/AlphaRouterService';
import { Token } from '@uniswap/sdk-core';

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
  private isTestMode: boolean = false;

  constructor(isTestMode: boolean = false) {
    this.isTestMode = isTestMode;
  }

  async connect(): Promise<boolean> {
    try {
      if (this.isTestMode) {
        return true;
      }

      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.signer = this.provider.getSigner();

      return true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      return false;
    }
  }

  async getAddress(): Promise<string | null> {
    try {
      if (this.isTestMode) {
        return "0xTestAddress";
      }

      if (!this.signer) {
        throw new Error("Wallet not connected");
      }

      return await this.signer.getAddress();
    } catch (error) {
      console.error('Failed to get address:', error);
      return null;
    }
  }

  async executeSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber,
    slippage: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (this.isTestMode) {
        return testWalletService.executeTestSwap(tokenIn, tokenOut, amountIn);
      }

      if (!this.signer) {
        throw new Error("Wallet not connected");
      }

      // Get the appropriate token objects
      let inputToken: Token;
      let outputToken: Token;

      switch (tokenIn.toLowerCase()) {
        case import.meta.env.VITE_WETH_ADDRESS.toLowerCase():
          inputToken = WETH;
          break;
        case import.meta.env.VITE_WBTC_ADDRESS.toLowerCase():
          inputToken = WBTC;
          break;
        case import.meta.env.VITE_USDC_ADDRESS.toLowerCase():
          inputToken = USDC;
          break;
        case import.meta.env.VITE_USDT_ADDRESS.toLowerCase():
          inputToken = USDT;
          break;
        default:
          throw new Error("Unsupported input token");
      }

      switch (tokenOut.toLowerCase()) {
        case import.meta.env.VITE_WETH_ADDRESS.toLowerCase():
          outputToken = WETH;
          break;
        case import.meta.env.VITE_WBTC_ADDRESS.toLowerCase():
          outputToken = WBTC;
          break;
        case import.meta.env.VITE_USDC_ADDRESS.toLowerCase():
          outputToken = USDC;
          break;
        case import.meta.env.VITE_USDT_ADDRESS.toLowerCase():
          outputToken = USDT;
          break;
        default:
          throw new Error("Unsupported output token");
      }

      const walletAddress = await this.getAddress();
      if (!walletAddress) {
        throw new Error("Could not get wallet address");
      }

      // Get the swap transaction
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      const [transaction] = await getPrice(
        ethers.utils.formatUnits(amountIn, inputToken.decimals),
        inputToken,
        outputToken,
        slippage,
        deadline,
        walletAddress
      );

      if (!transaction) {
        throw new Error("Failed to get swap transaction");
      }

      // Execute the swap
      const tx = await runSwap(transaction, this.signer, inputToken);
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

  async getBalance(tokenAddress: string): Promise<ethers.BigNumber> {
    try {
      if (this.isTestMode) {
        return testWalletService.getTestBalance(tokenAddress);
      }

      if (!this.signer) {
        throw new Error("Wallet not connected");
      }

      const address = await this.getAddress();
      if (!address) {
        throw new Error("Could not get wallet address");
      }

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ["function balanceOf(address) view returns (uint256)"],
        this.provider!
      );

      return await tokenContract.balanceOf(address);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return ethers.BigNumber.from(0);
    }
  }
}

export const web3Service = new Web3Service();