import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';

export class TestWalletService {
  private wallet: ethers.Wallet | null = null;
  private testBalances: Map<string, ethers.BigNumber>;

  constructor() {
    this.testBalances = new Map();
  }

  generateTestWallet(): string {
    // Generate a new random wallet
    this.wallet = ethers.Wallet.createRandom();
    
    // Initialize with test balances
    this.testBalances.set(
      import.meta.env.VITE_USDC_ADDRESS,
      ethers.utils.parseUnits("10000", 6) // 10,000 USDC
    );
    this.testBalances.set(
      import.meta.env.VITE_WBTC_ADDRESS,
      ethers.utils.parseUnits("1", 8) // 1 WBTC
    );

    return this.wallet.address;
  }

  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }

  async getTestBalance(tokenAddress: string): Promise<ethers.BigNumber> {
    return this.testBalances.get(tokenAddress) || ethers.constants.Zero;
  }

  async executeTestSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Check if we have enough balance
      const balance = await this.getTestBalance(tokenIn);
      if (balance.lt(amountIn)) {
        throw new Error("Insufficient test token balance");
      }

      // Update test balances
      this.testBalances.set(tokenIn, balance.sub(amountIn));
      
      // Simulate some price impact
      const outAmount = amountIn.mul(98).div(100); // 2% slippage
      const currentOutBalance = await this.getTestBalance(tokenOut);
      this.testBalances.set(tokenOut, currentOutBalance.add(outAmount));

      // Generate a fake transaction hash
      const txHash = ethers.utils.hexlify(ethers.utils.randomBytes(32));

      return {
        success: true,
        txHash
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test swap failed";
      return {
        success: false,
        error: message
      };
    }
  }
}

export const testWalletService = new TestWalletService();
