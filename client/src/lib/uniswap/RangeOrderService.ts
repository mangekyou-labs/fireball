import {
  CurrencyAmount,
  Fraction,
  Percent,
  Price,
  Token,
} from '@uniswap/sdk-core';
import {
  Position,
  Pool,
  nearestUsableTick,
  priceToClosestTick,
  NonfungiblePositionManager,
  MintOptions,
  CollectOptions,
  RemoveLiquidityOptions,
  tickToPrice,
} from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import JSBI from 'jsbi';

// Constants from environment variables
const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = import.meta.env.VITE_UNISWAP_POSITION_MANAGER_ADDRESS;
const RPC_URL = import.meta.env.VITE_RPC_URL;

// Web3 provider
const web3Provider = new ethers.providers.JsonRpcProvider(RPC_URL);

export interface RangeOrder {
  tokenId: number;
  targetPrice: Price<Token, Token>;
  position: Position;
  zeroForOne: boolean; // true if selling token0 for token1
  status: 'pending' | 'filled' | 'cancelled';
}

export class RangeOrderService {
  private provider: ethers.providers.Provider;
  private signer?: ethers.Signer;

  constructor() {
    this.provider = web3Provider;
  }

  connect(signer: ethers.Signer) {
    this.signer = signer;
  }

  async createBuyLimitOrder(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string,
    targetPrice: string,
    poolFee: number,
    slippageTolerance: number = 0.5
  ): Promise<{ success: boolean; orderId?: number; error?: string }> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      const walletAddress = await this.signer.getAddress();

      // Get pool info
      const poolContract = new ethers.Contract(
        await this.getPoolAddress(tokenIn, tokenOut, poolFee),
        [
          'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
          'function liquidity() external view returns (uint128)',
        ],
        this.provider
      );

      const [slot0, liquidity] = await Promise.all([
        poolContract.slot0(),
        poolContract.liquidity(),
      ]);

      // Create pool instance
      const pool = new Pool(
        tokenIn,
        tokenOut,
        poolFee,
        slot0.sqrtPriceX96.toString(),
        liquidity.toString(),
        slot0.tick
      );

      // Calculate target tick
      const targetPriceObj = new Price(
        tokenIn,
        tokenOut,
        ethers.utils.parseUnits('1', tokenIn.decimals).toString(),
        ethers.utils.parseUnits(targetPrice, tokenOut.decimals).toString()
      );

      const targetTick = nearestUsableTick(
        priceToClosestTick(targetPriceObj),
        pool.tickSpacing
      );

      // For a buy limit order, we provide tokenIn below the current price
      const position = Position.fromAmount0({
        pool,
        tickLower: targetTick - pool.tickSpacing,
        tickUpper: targetTick,
        amount0: ethers.utils.parseUnits(amountIn, tokenIn.decimals).toString(),
        useFullPrecision: true,
      });

      // Approve token spending
      const tokenContract = new ethers.Contract(
        tokenIn.address,
        ['function approve(address spender, uint256 amount) external returns (bool)'],
        this.signer
      );

      const { amount0 } = position.mintAmounts;
      await tokenContract.approve(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, amount0.toString());

      // Create mint options
      const mintOptions: MintOptions = {
        recipient: walletAddress,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20,
        slippageTolerance: new Percent(slippageTolerance * 100, 10_000),
      };

      // Get mint parameters
      const { calldata, value } = NonfungiblePositionManager.addCallParameters(
        position,
        mintOptions
      );

      // Send transaction
      const tx = await this.signer.sendTransaction({
        data: calldata,
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        value: ethers.BigNumber.from(value),
        gasLimit: ethers.utils.hexlify(1000000),
      });

      const receipt = await tx.wait();
      
      // Parse position ID from logs
      const positionManagerInterface = new ethers.utils.Interface([
        'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
        'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
      ]);

      const transferLog = receipt.logs.find(
        log => log.address.toLowerCase() === NONFUNGIBLE_POSITION_MANAGER_ADDRESS.toLowerCase() &&
        log.topics[0] === positionManagerInterface.getEventTopic('Transfer')
      );

      if (!transferLog) {
        throw new Error('Could not find position ID in transaction logs');
      }

      const tokenId = ethers.BigNumber.from(transferLog.topics[3]).toNumber();

      return {
        success: true,
        orderId: tokenId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async getPoolAddress(tokenA: Token, tokenB: Token, fee: number): Promise<string> {
    const factoryContract = new ethers.Contract(
      import.meta.env.VITE_UNISWAP_FACTORY_ADDRESS,
      ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'],
      this.provider
    );

    return factoryContract.getPool(tokenA.address, tokenB.address, fee);
  }

  async watchOrder(orderId: number): Promise<void> {
    // TODO: Implement order watching logic
    // This would involve:
    // 1. Monitoring pool price
    // 2. When price crosses the target, remove liquidity
    // 3. Update order status
  }
}

export const rangeOrderService = new RangeOrderService(); 