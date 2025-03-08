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
  IncreaseOptions,
  TickMath,
} from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import JSBI from 'jsbi';

// Constants from environment variables
const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = import.meta.env.VITE_UNISWAP_POSITION_MANAGER_ADDRESS;
const RPC_URL = import.meta.env.VITE_RPC_URL;

// Web3 provider
const web3Provider = new ethers.providers.JsonRpcProvider(RPC_URL);

export interface PositionInfo {
  tokenId: number;
  tickLower: number;
  tickUpper: number;
  liquidity: ethers.BigNumber;
  token0: string;
  token1: string;
  fee: number;
  feeGrowthInside0LastX128: ethers.BigNumber;
  feeGrowthInside1LastX128: ethers.BigNumber;
  tokensOwed0: ethers.BigNumber;
  tokensOwed1: ethers.BigNumber;
}

export class PoolService {
  private provider: ethers.providers.Provider;
  private signer?: ethers.Signer;

  constructor() {
    this.provider = web3Provider;
  }

  connect(signer: ethers.Signer) {
    this.signer = signer;
  }

  async getPool(tokenA: Token, tokenB: Token, fee: number): Promise<Pool> {
    const poolAddress = await this.getPoolAddress(tokenA, tokenB, fee);
    const poolContract = new ethers.Contract(
      poolAddress,
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

    return new Pool(
      tokenA,
      tokenB,
      fee,
      slot0.sqrtPriceX96.toString(),
      liquidity.toString(),
      slot0.tick
    );
  }

  async createPosition(
    tokenA: Token,
    tokenB: Token,
    fee: number,
    amount0: string,
    amount1: string,
    tickLower: number,
    tickUpper: number,
    slippageTolerance: number = 0.5
  ): Promise<{ success: boolean; positionId?: number; error?: string }> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      const walletAddress = await this.signer.getAddress();
      const pool = await this.getPool(tokenA, tokenB, fee);

      // Ensure ticks are spaced correctly
      const tickSpacing = pool.tickSpacing;
      const adjustedTickLower = nearestUsableTick(tickLower, tickSpacing);
      const adjustedTickUpper = nearestUsableTick(tickUpper, tickSpacing);

      if (adjustedTickLower >= adjustedTickUpper) {
        throw new Error('Invalid tick range - lower tick must be less than upper tick');
      }

      // Create position using fromAmounts
      const position = Position.fromAmounts({
        pool,
        tickLower: adjustedTickLower,
        tickUpper: adjustedTickUpper,
        amount0,
        amount1,
        useFullPrecision: true,
      });

      // Get exact amounts needed for position
      const { amount0: amount0Required, amount1: amount1Required } = position.mintAmounts;

      // Approve tokens
      await this.approveToken(tokenA, amount0Required.toString());
      await this.approveToken(tokenB, amount1Required.toString());

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

      const positionId = ethers.BigNumber.from(transferLog.topics[3]).toNumber();

      return {
        success: true,
        positionId,
      };
    } catch (error) {
      console.error('Error creating position:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async increaseLiquidity(
    positionId: number,
    amount0: string,
    amount1: string,
    slippageTolerance: number = 0.5
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      console.log(`Increasing liquidity for position ${positionId} with amounts: ${amount0} and ${amount1}`);

      const position = await this.getPosition(positionId);
      const walletAddress = await this.signer.getAddress();

      console.log(`Position details: 
        Token0: ${position.pool.token0.symbol} (${position.pool.token0.address})
        Token1: ${position.pool.token1.symbol} (${position.pool.token1.address})
        Fee: ${position.pool.fee}
        Tick Lower: ${position.tickLower}
        Tick Upper: ${position.tickUpper}
        Current Liquidity: ${position.liquidity}
      `);

      // Get current pool price and check if it's in range
      const currentTick = position.pool.tickCurrent;
      const currentPrice = position.pool.token0Price;
      console.log(`Current pool tick: ${currentTick}`);
      console.log(`Current pool price: ${currentPrice.toFixed(6)} ${position.pool.token1.symbol} per ${position.pool.token0.symbol}`);

      const inRange = currentTick >= position.tickLower && currentTick < position.tickUpper;
      console.log(`Position is ${inRange ? 'in' : 'out of'} range`);

      if (!inRange) {
        if (currentTick < position.tickLower) {
          console.log(`Current price is below range - position will be 100% ${position.pool.token1.symbol}`);
        } else {
          console.log(`Current price is above range - position will be 100% ${position.pool.token0.symbol}`);
        }
      }

      // Approve tokens
      await this.approveToken(position.pool.token0, amount0);
      await this.approveToken(position.pool.token1, amount1);

      // Create a new position with the increased amounts
      const newPosition = Position.fromAmounts({
        pool: position.pool,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        amount0,
        amount1,
        useFullPrecision: true,
      });

      console.log(`New position liquidity: ${newPosition.liquidity.toString()}`);
      console.log(`Calculated amounts needed: token0=${newPosition.amount0.toFixed()} token1=${newPosition.amount1.toFixed()}`);

      // Check if one of the tokens is not being used
      if (newPosition.amount0.equalTo(0)) {
        console.log(`Note: No ${position.pool.token0.symbol} will be used (single-sided liquidity)`);
      }
      if (newPosition.amount1.equalTo(0)) {
        console.log(`Note: No ${position.pool.token1.symbol} will be used (single-sided liquidity)`);
      }

      // Create increase options
      const increaseOptions: IncreaseOptions = {
        deadline: Math.floor(Date.now() / 1000) + 60 * 20,
        slippageTolerance: new Percent(slippageTolerance * 100, 10_000),
        tokenId: positionId,
      };

      // Get increase parameters
      const { calldata, value } = NonfungiblePositionManager.addCallParameters(
        newPosition,
        increaseOptions
      );

      console.log(`Transaction value: ${value}`);

      // Send transaction with higher gas limit for complex operations
      const tx = await this.signer.sendTransaction({
        data: calldata,
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        value: ethers.BigNumber.from(value),
        gasLimit: ethers.utils.hexlify(2000000), // Increased gas limit
      });

      console.log(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`Transaction confirmed: ${receipt.transactionHash}`);

      // Verify the transaction was successful
      if (receipt.status === 0) {
        throw new Error('Transaction failed');
      }

      return { success: true };
    } catch (error) {
      console.error('Error increasing liquidity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async decreaseLiquidity(
    positionId: number,
    liquidityPercentage: number,
    slippageTolerance: number = 0.5
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      const position = await this.getPosition(positionId);
      const walletAddress = await this.signer.getAddress();

      // Create decrease options
      const decreaseOptions: RemoveLiquidityOptions = {
        deadline: Math.floor(Date.now() / 1000) + 60 * 20,
        slippageTolerance: new Percent(slippageTolerance * 100, 10_000),
        tokenId: positionId,
        liquidityPercentage: new Percent(liquidityPercentage * 100, 10_000),
        collectOptions: {
          expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(position.pool.token0, 0),
          expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(position.pool.token1, 0),
          recipient: walletAddress,
        },
      };

      // Get decrease parameters
      const { calldata, value } = NonfungiblePositionManager.removeCallParameters(
        position,
        decreaseOptions
      );

      // Send transaction
      const tx = await this.signer.sendTransaction({
        data: calldata,
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        value: ethers.BigNumber.from(value),
        gasLimit: ethers.utils.hexlify(1000000),
      });

      await tx.wait();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async collectFees(
    positionId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      const position = await this.getPosition(positionId);
      const walletAddress = await this.signer.getAddress();

      // Create collect options
      const collectOptions: CollectOptions = {
        tokenId: positionId,
        expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(position.pool.token0, 0),
        expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(position.pool.token1, 0),
        recipient: walletAddress,
      };

      // Get collect parameters
      const { calldata, value } = NonfungiblePositionManager.collectCallParameters(collectOptions);

      // Send transaction
      const tx = await this.signer.sendTransaction({
        data: calldata,
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        value: ethers.BigNumber.from(value),
        gasLimit: ethers.utils.hexlify(1000000),
      });

      await tx.wait();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getPositions(walletAddress: string): Promise<PositionInfo[]> {
    const positionManagerContract = new ethers.Contract(
      NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
      [
        'function balanceOf(address owner) view returns (uint256)',
        'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
        'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
      ],
      this.provider
    );

    const balance = await positionManagerContract.balanceOf(walletAddress);
    const positions: PositionInfo[] = [];

    for (let i = 0; i < balance.toNumber(); i++) {
      const tokenId = await positionManagerContract.tokenOfOwnerByIndex(walletAddress, i);
      const position = await positionManagerContract.positions(tokenId);

      positions.push({
        tokenId: tokenId.toNumber(),
        token0: position.token0,
        token1: position.token1,
        fee: position.fee,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        liquidity: position.liquidity,
        feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
        feeGrowthInside1LastX128: position.feeGrowthInside1LastX128,
        tokensOwed0: position.tokensOwed0,
        tokensOwed1: position.tokensOwed1,
      });
    }

    return positions;
  }

  private async getPoolAddress(tokenA: Token, tokenB: Token, fee: number): Promise<string> {
    const factoryContract = new ethers.Contract(
      import.meta.env.VITE_UNISWAP_FACTORY_ADDRESS,
      ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'],
      this.provider
    );

    return factoryContract.getPool(tokenA.address, tokenB.address, fee);
  }

  private async approveToken(token: Token, amount: string): Promise<void> {
    if (!this.signer) throw new Error('Wallet not connected');

    const walletAddress = await this.signer.getAddress();
    const tokenContract = new ethers.Contract(
      token.address,
      [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function allowance(address owner, address spender) external view returns (uint256)'
      ],
      this.signer
    );

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(
      walletAddress,
      NONFUNGIBLE_POSITION_MANAGER_ADDRESS
    );

    // Only approve if current allowance is less than needed amount
    if (ethers.BigNumber.from(currentAllowance).lt(ethers.BigNumber.from(amount))) {
      console.log(`Approving ${token.symbol} for amount ${amount}`);
      const tx = await tokenContract.approve(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, amount);
      await tx.wait();
    } else {
      console.log(`Sufficient allowance exists for ${token.symbol}: ${currentAllowance.toString()}`);
    }
  }

  private async getPosition(positionId: number): Promise<Position> {
    const positionManagerContract = new ethers.Contract(
      NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
      ['function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'],
      this.provider
    );

    const position = await positionManagerContract.positions(positionId);

    // Get the correct token decimals based on the token address
    const token0Decimals = this.getTokenDecimals(position.token0);
    const token1Decimals = this.getTokenDecimals(position.token1);

    const pool = await this.getPool(
      new Token(parseInt(import.meta.env.VITE_CHAIN_ID), position.token0, token0Decimals),
      new Token(parseInt(import.meta.env.VITE_CHAIN_ID), position.token1, token1Decimals),
      position.fee
    );

    return new Position({
      pool,
      liquidity: position.liquidity.toString(),
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
    });
  }

  // Helper function to get token decimals based on token address
  private getTokenDecimals(tokenAddress: string): number {
    // Convert addresses to lowercase for comparison
    const lowerCaseAddress = tokenAddress.toLowerCase();
    const usdcAddress = import.meta.env.VITE_USDC_ADDRESS.toLowerCase();
    const usdtAddress = import.meta.env.VITE_USDT_ADDRESS.toLowerCase();
    const wbtcAddress = import.meta.env.VITE_WBTC_ADDRESS.toLowerCase();
    const wethAddress = import.meta.env.VITE_WETH_ADDRESS.toLowerCase();

    // Return the correct decimals for each token
    if (lowerCaseAddress === usdcAddress) {
      return 18; // Using 18 for testnet USDC as defined in AlphaRouterService
    } else if (lowerCaseAddress === usdtAddress) {
      return 18; // Using 18 for testnet USDT as defined in AlphaRouterService
    } else if (lowerCaseAddress === wbtcAddress) {
      return 18; // Using 18 for testnet WBTC as defined in AlphaRouterService
    } else if (lowerCaseAddress === wethAddress) {
      return 18; // WETH has 18 decimals
    }

    // Default to 18 decimals for unknown tokens
    return 18;
  }
}

export const poolService = new PoolService(); 