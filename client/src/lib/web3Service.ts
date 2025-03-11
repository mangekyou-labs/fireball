import { ethers } from 'ethers';
import { getPrice, runSwap, WETH, WBTC, USDC, USDT, getRouterContract } from './uniswap/AlphaRouterService';
import { apiRequest } from "./api";
import type { Token as SDKToken } from "@uniswap/sdk-core";
import { CHAIN_IDS, getContractsForChain } from '@/lib/constants';

// Local storage key for the selected chain
const SELECTED_CHAIN_KEY = 'selectedChainId';

// Get the saved chain ID from local storage or use the default
const getSavedChainId = (): number => {
  try {
    const savedChainId = localStorage.getItem(SELECTED_CHAIN_KEY);
    if (savedChainId) {
      const chainId = parseInt(savedChainId);
      return chainId;
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
  }
  return parseInt(import.meta.env.VITE_CHAIN_ID); // Default to env chain ID if no saved chain or error
};

// Add window.ethereum type declaration if not already defined
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

// Add these interfaces for the API responses
interface WalletRegistrationResponse {
  success: boolean;
  wallet?: {
    id: number;
    userAddress: string;
    aiWalletAddress: string;
    allocatedAmount: string;
    isActive: boolean;
    createdAt: string;
  };
  message?: string;
}

interface SecureKeyTransferResponse {
  success: boolean;
  message?: string;
}

export class Web3Service {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private isTestMode: boolean = false;
  private aiWallets: Map<string, string> = new Map(); // Map user addresses to their AI wallet addresses
  private aiWalletSigners: Map<string, ethers.Wallet> = new Map(); // Store AI wallet signers
  private currentChainId: number = getSavedChainId();
  private currentContracts = getContractsForChain(getSavedChainId());

  constructor(isTestMode: boolean = false) {
    this.isTestMode = isTestMode;
    this.loadAIWalletsFromStorage();

    // If window is available (browser), set up provider from Ethereum object
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);

      // Listen for chain changes
      window.ethereum.on('chainChanged', (chainIdHex: string) => {
        const chainId = parseInt(chainIdHex, 16);
        this.updateChain(chainId);
      });
    }
  }

  // Update the current chain
  private updateChain(chainId: number) {
    this.currentChainId = chainId;
    this.currentContracts = getContractsForChain(chainId);
    console.log(`Web3Service: Switched to chain ID ${chainId}`);
  }

  // Load AI wallets from localStorage
  private loadAIWalletsFromStorage() {
    try {
      const storedWallets = localStorage.getItem('aiWallets');
      if (storedWallets) {
        const walletEntries = JSON.parse(storedWallets);
        this.aiWallets = new Map(walletEntries);
        console.log("Loaded AI wallets from storage:", this.aiWallets);
      }
    } catch (error) {
      console.error("Failed to load AI wallets from storage:", error);
    }
  }

  // Save AI wallets to localStorage
  private saveAIWalletsToStorage() {
    try {
      const walletEntries = Array.from(this.aiWallets.entries());
      localStorage.setItem('aiWallets', JSON.stringify(walletEntries));
      console.log("Saved AI wallets to storage");
    } catch (error) {
      console.error("Failed to save AI wallets to storage:", error);
    }
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

      // Get the current chain ID and update
      const network = await this.provider.getNetwork();
      this.updateChain(network.chainId);

      return true;
    } catch (error) {
      console.error("Failed to connect to wallet:", error);
      return false;
    }
  }

  async getAddress(): Promise<string | null> {
    try {
      if (this.isTestMode) {
        return "0xTestAddress";
      }

      // If not connected, try to connect up to 3 times
      if (!this.signer) {
        console.log("Wallet not connected, attempting to connect...");

        let connected = false;
        for (let i = 0; i < 3; i++) {
          connected = await this.connect();
          if (connected && this.signer) {
            console.log(`Connected on attempt ${i + 1}`);
            break;
          }
          console.log(`Connection attempt ${i + 1} failed, retrying...`);
          // Short delay between attempts
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!connected || !this.signer) {
          throw new Error("Failed to connect wallet after multiple attempts");
        }
      }

      // At this point we should have a signer
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
  ): Promise<{ success: boolean; txHash?: string; outputAmount?: string; error?: string }> {
    try {
      console.log(`Executing swap: ${tokenIn} -> ${tokenOut}, amount: ${amountIn.toString()}, slippage: ${slippage}%`);

      if (this.isTestMode) {
        console.log("Running in test mode, using simulated swaps");
        // Simple test mode implementation
        try {
          // Safety check for extremely small amounts that could cause errors
          if (amountIn.eq(0) || amountIn.lt(ethers.utils.parseUnits("0.0001", 1))) {
            console.error("Amount too small for test swap, rejecting operation");
            return {
              success: false,
              error: "Amount too small to process safely"
            };
          }

          // Simulate some price impact
          const outAmount = amountIn.mul(98).div(100); // 2% slippage

          // Find the appropriate token definitions for formatting
          let inputToken: SDKToken;
          let outputToken: SDKToken;

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

          // Format output amount with correct decimals from token definitions
          const formattedOutput = ethers.utils.formatUnits(outAmount, outputToken.decimals);

          console.log(`Test swap executed: ${ethers.utils.formatUnits(amountIn, inputToken.decimals)} of token ${tokenIn} for ${formattedOutput} of token ${tokenOut}`);

          // Create a fake transaction hash
          const txHash = ethers.utils.hexlify(ethers.utils.randomBytes(32));

          return {
            success: true,
            txHash,
            outputAmount: formattedOutput
          };
        } catch (formatError) {
          console.error("Error in test swap:", formatError);
          return {
            success: false,
            error: "Error in test swap"
          };
        }
      }

      if (!this.signer) {
        throw new Error("Wallet not connected");
      }

      // Get the appropriate token objects
      let inputToken: SDKToken;
      let outputToken: SDKToken;

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
      const [transaction, outputAmount, ratio] = await getPrice(
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
      console.log(`Executing swap: ${inputToken.symbol} -> ${outputToken.symbol}`);
      console.log(`Input amount: ${ethers.utils.formatUnits(amountIn, inputToken.decimals)} ${inputToken.symbol}`);
      console.log(`Expected output: ${outputAmount} ${outputToken.symbol} (ratio: ${ratio})`);

      const tx = await runSwap(transaction, this.signer, inputToken);
      console.log(`Swap transaction sent: ${tx.hash}`);

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log(`Swap transaction confirmed in block ${receipt.blockNumber}`);

      // Return success with transaction hash and expected output amount
      return {
        success: true,
        txHash: tx.hash,
        outputAmount: outputAmount
      };
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.error('Swap failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async getBalance(tokenAddress: string): Promise<ethers.BigNumber> {
    try {
      if (this.isTestMode) {
        // In test mode, return simulated balances
        if (tokenAddress.toLowerCase() === import.meta.env.VITE_USDC_ADDRESS.toLowerCase()) {
          return ethers.utils.parseUnits("10000", USDC.decimals); // 10,000 USDC
        } else if (tokenAddress.toLowerCase() === import.meta.env.VITE_WBTC_ADDRESS.toLowerCase()) {
          return ethers.utils.parseUnits("1", WBTC.decimals); // 1 WBTC
        } else if (tokenAddress.toLowerCase() === import.meta.env.VITE_WETH_ADDRESS.toLowerCase()) {
          return ethers.utils.parseUnits("5", WETH.decimals); // 5 WETH
        } else {
          return ethers.BigNumber.from(0);
        }
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

  // Get the AI wallet signer for a user
  async getAIWalletSigner(userAddress: string): Promise<ethers.Wallet | null> {
    if (!userAddress) {
      console.error("Cannot get AI wallet signer: no user address provided");
      return null;
    }

    // Check if we already have the signer cached
    const existingSigner = this.aiWalletSigners.get(userAddress);
    if (existingSigner) {
      return existingSigner;
    }

    // Get the AI wallet address
    const aiWalletAddress = this.aiWallets.get(userAddress);
    if (!aiWalletAddress) {
      console.error("No AI wallet found for user:", userAddress);
      return null;
    }

    try {
      // Try to load wallet from localStorage
      const storedWalletData = localStorage.getItem(`aiWallet_${userAddress}`);

      if (storedWalletData) {
        // Parse the stored wallet data
        const walletData = JSON.parse(storedWalletData);

        if (walletData && walletData.encryptedKey) {
          // Decrypt the private key
          const privateKey = this.decryptWalletData(walletData.encryptedKey, userAddress);

          // Create wallet from private key
          const wallet = new ethers.Wallet(privateKey);

          // Verify the address matches
          if (wallet.address.toLowerCase() === aiWalletAddress.toLowerCase()) {
            // Connect the wallet to the provider if available
            if (this.provider) {
              const connectedWallet = wallet.connect(this.provider);
              this.aiWalletSigners.set(userAddress, connectedWallet);
              return connectedWallet;
            }

            this.aiWalletSigners.set(userAddress, wallet);
            return wallet;
          } else {
            console.error("Wallet address mismatch, recreating wallet");
          }
        }
      }

      // If we couldn't load from storage or address mismatch, create a new deterministic wallet
      console.log("Creating a new deterministic wallet for the user");
      const aiWallet = ethers.Wallet.createRandom({
        extraEntropy: userAddress
      });

      // Connect the wallet to the provider if available
      if (this.provider) {
        const connectedWallet = aiWallet.connect(this.provider);
        this.aiWalletSigners.set(userAddress, connectedWallet);

        // Save the new wallet
        this.aiWallets.set(userAddress, connectedWallet.address);
        const encryptedPrivateKey = this.encryptWalletData(aiWallet.privateKey, userAddress);
        localStorage.setItem(`aiWallet_${userAddress}`, JSON.stringify({
          address: aiWallet.address,
          encryptedKey: encryptedPrivateKey
        }));
        this.saveAIWalletsToStorage();

        return connectedWallet;
      }

      this.aiWalletSigners.set(userAddress, aiWallet);
      return aiWallet;
    } catch (error) {
      console.error("Failed to get or create AI wallet signer:", error);
      return null;
    }
  }

  async getOrCreateAIWallet(userAddress: string): Promise<string> {
    // First check if we already have an AI wallet for this user
    const existingWallet = this.aiWallets.get(userAddress);
    if (existingWallet) {
      console.log("Using existing AI wallet for user:", userAddress, existingWallet);
      return existingWallet;
    }

    console.log("No existing AI wallet found, creating a new one");

    // Create a new deterministic wallet for the AI
    // We use the user's address + a random salt as entropy to generate a secure wallet
    const salt = ethers.utils.randomBytes(16);
    console.log("Generated random salt for wallet entropy");

    try {
      const aiWallet = ethers.Wallet.createRandom({
        extraEntropy: ethers.utils.concat([ethers.utils.arrayify(userAddress), salt])
      });
      console.log("Successfully created new AI wallet with address:", aiWallet.address);

      // Store the wallet
      this.aiWallets.set(userAddress, aiWallet.address);
      this.aiWalletSigners.set(userAddress, aiWallet);

      // Encrypt and store the private key locally
      const encryptedPrivateKey = this.encryptWalletData(aiWallet.privateKey, userAddress);
      console.log("Encrypted private key for local storage");

      // Save to localStorage with encryption
      try {
        localStorage.setItem(`aiWallet_${userAddress}`, JSON.stringify({
          address: aiWallet.address,
          encryptedKey: encryptedPrivateKey,
          salt: ethers.utils.hexlify(salt) // Store salt for future recovery
        }));
        console.log("Saved encrypted wallet data to localStorage");
      } catch (error) {
        console.error("Failed to save encrypted wallet to storage:", error);
      }

      this.saveAIWalletsToStorage(); // Save address mapping to localStorage

      // Request server to register the AI wallet
      try {
        console.log("Sending wallet registration request to server");
        const response = await apiRequest<WalletRegistrationResponse>('/api/wallets/register', {
          method: 'POST',
          body: {
            userAddress: userAddress,
            aiWalletAddress: aiWallet.address,
            allocatedAmount: "0" // Initial amount is zero, will be updated when user allocates funds
          }
        });
        console.log("Server registration response:", response);

        if (response && response.success && response.wallet && response.wallet.id) {
          // Now that we have a registered wallet, send the private key securely
          console.log("Transferring private key to server for wallet ID:", response.wallet.id);
          await this.transferPrivateKeyToServer(
            response.wallet.id,
            aiWallet.privateKey,
            userAddress
          );
        }

        console.log("AI wallet registered with server successfully");
      } catch (serverError) {
        console.error("Failed to register AI wallet with server:", serverError);
        // Continue anyway as the wallet is created locally
      }

      return aiWallet.address;
    } catch (walletCreationError) {
      console.error("Error creating AI wallet:", walletCreationError);
      throw new Error("Failed to create AI wallet: " +
        (walletCreationError instanceof Error ? walletCreationError.message : "Unknown error"));
    }
  }

  // New method to create an AI wallet and return both the address and private key
  async createAIWalletWithPrivateKey(userAddress: string): Promise<{ address: string; privateKey: string }> {
    // First check if we already have an AI wallet for this user
    const existingWallet = this.aiWallets.get(userAddress);
    if (existingWallet) {
      console.log("Using existing AI wallet for user:", userAddress, existingWallet);

      // Try to get the private key from local storage
      try {
        const storedWalletData = localStorage.getItem(`aiWallet_${userAddress}`);
        if (storedWalletData) {
          const walletData = JSON.parse(storedWalletData);
          if (walletData && walletData.encryptedKey) {
            const privateKey = this.decryptWalletData(walletData.encryptedKey, userAddress);
            return { address: existingWallet, privateKey };
          }
        }
      } catch (error) {
        console.error("Error retrieving private key for existing wallet:", error);
      }

      // If we couldn't get the private key, create a new wallet
      console.log("Could not retrieve private key for existing wallet, creating a new one");
    }

    console.log("Creating a new AI wallet with private key");

    // Create a new deterministic wallet for the AI
    // We use the user's address + a random salt as entropy to generate a secure wallet
    const salt = ethers.utils.randomBytes(16);
    console.log("Generated random salt for wallet entropy");

    try {
      const aiWallet = ethers.Wallet.createRandom({
        extraEntropy: ethers.utils.concat([ethers.utils.arrayify(userAddress), salt])
      });
      console.log("Successfully created new AI wallet with address:", aiWallet.address);

      // Store the wallet
      this.aiWallets.set(userAddress, aiWallet.address);
      this.aiWalletSigners.set(userAddress, aiWallet);

      // Encrypt and store the private key locally
      const encryptedPrivateKey = this.encryptWalletData(aiWallet.privateKey, userAddress);
      console.log("Encrypted private key for local storage");

      // Save to localStorage with encryption
      try {
        localStorage.setItem(`aiWallet_${userAddress}`, JSON.stringify({
          address: aiWallet.address,
          encryptedKey: encryptedPrivateKey,
          salt: ethers.utils.hexlify(salt) // Store salt for future recovery
        }));
        console.log("Saved encrypted wallet data to localStorage");
      } catch (error) {
        console.error("Failed to save encrypted wallet to storage:", error);
      }

      this.saveAIWalletsToStorage(); // Save address mapping to localStorage

      return { address: aiWallet.address, privateKey: aiWallet.privateKey };
    } catch (walletCreationError) {
      console.error("Error creating AI wallet with private key:", walletCreationError);
      throw new Error("Failed to create AI wallet: " +
        (walletCreationError instanceof Error ? walletCreationError.message : "Unknown error"));
    }
  }

  // Add a new method to securely transfer private keys to the server
  private async transferPrivateKeyToServer(sessionId: number, privateKey: string, userAddress: string): Promise<boolean> {
    try {
      // Re-encrypt the private key for transfer
      const encryptedPrivateKey = this.encryptWalletData(privateKey, userAddress);

      // Send the encrypted key to the server
      const response = await apiRequest<SecureKeyTransferResponse>('/api/wallets/secure-key', {
        method: 'POST',
        body: {
          sessionId,
          encryptedPrivateKey
        }
      });

      return response && response.success;
    } catch (error) {
      console.error("Failed to transfer private key to server:", error);
      return false;
    }
  }

  // Register an existing AI wallet for a user
  registerAIWallet(userAddress: string, aiWalletAddress: string): void {
    if (!userAddress || !aiWalletAddress) {
      console.error("Cannot register AI wallet: missing user address or AI wallet address");
      return;
    }

    console.log("Registering existing AI wallet for user:", userAddress, aiWalletAddress);
    this.aiWallets.set(userAddress, aiWalletAddress);
    this.saveAIWalletsToStorage();
  }

  // Get all AI wallets for a user
  getAIWallets(): Map<string, string> {
    return this.aiWallets;
  }

  async createTestWallet(): Promise<string> {
    console.log("Creating a test wallet");
    this.isTestMode = true;

    // Generate a new random wallet
    const wallet = ethers.Wallet.createRandom();
    console.log("Created test wallet:", wallet.address);

    // Save the wallet address for use with the AI
    this.signer = wallet;
    this.saveAIWalletsToStorage(); // Save to localStorage

    return wallet.address;
  }

  // Execute a swap using the AI wallet
  async executeAISwap(
    userAddress: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber,
    slippage: number
  ): Promise<{ success: boolean; txHash?: string; outputAmount?: string; error?: string }> {
    try {
      console.log(`Executing AI swap: ${tokenIn} -> ${tokenOut}, amount: ${amountIn.toString()}, slippage: ${slippage}%`);

      // Get the AI wallet signer
      let aiSigner = await this.getAIWalletSigner(userAddress);
      if (!aiSigner) {
        return {
          success: false,
          error: "AI wallet not available"
        };
      }

      if (this.isTestMode) {
        // Test mode simulation code (unchanged)
        console.log("Running in test mode with AI wallet, using simulated swaps");
        try {
          // Safety check for extremely small amounts that could cause errors
          if (amountIn.eq(0) || amountIn.lt(ethers.utils.parseUnits("0.0001", 1))) {
            console.error("Amount too small for test swap, rejecting operation");
            return {
              success: false,
              error: "Amount too small to process safely"
            };
          }

          // Simulate some price impact
          const outAmount = amountIn.mul(98).div(100); // 2% slippage

          // Find the appropriate token definitions for formatting
          let inputToken: SDKToken;
          let outputToken: SDKToken;

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

          // Format output amount with correct decimals from token definitions
          const formattedOutput = ethers.utils.formatUnits(outAmount, outputToken.decimals);

          console.log(`AI test swap executed: ${ethers.utils.formatUnits(amountIn, inputToken.decimals)} of token ${tokenIn} for ${formattedOutput} of token ${tokenOut}`);

          // Create a fake transaction hash
          const txHash = ethers.utils.hexlify(ethers.utils.randomBytes(32));

          return {
            success: true,
            txHash,
            outputAmount: formattedOutput
          };
        } catch (formatError) {
          console.error("Error in AI test swap:", formatError);
          return {
            success: false,
            error: "Error in AI test swap"
          };
        }
      }

      // For real transactions, implement the swap using the AI wallet signer
      // Get the appropriate token objects
      let inputToken: SDKToken;
      let outputToken: SDKToken;

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

      // Make sure aiSigner is connected to provider
      if (!aiSigner.provider && this.provider) {
        console.log("Connecting AI wallet to provider");
        aiSigner = aiSigner.connect(this.provider);
      }

      const aiWalletAddress = await aiSigner.getAddress();
      console.log(`AI wallet address: ${aiWalletAddress}`);

      // Get the swap transaction
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      console.log(`Getting price for AI swap, input amount: ${ethers.utils.formatUnits(amountIn, inputToken.decimals)} ${inputToken.symbol}`);

      // Convert BigNumber to string for getPrice function
      const inputAmountString = ethers.utils.formatUnits(amountIn, inputToken.decimals);

      const [transaction, outputAmount, ratio] = await getPrice(
        inputAmountString,
        inputToken,
        outputToken,
        slippage,
        deadline,
        aiWalletAddress
      );

      if (!transaction) {
        throw new Error("Failed to get swap transaction for AI wallet");
      }

      // Execute the swap
      console.log(`AI executing swap: ${inputToken.symbol} -> ${outputToken.symbol}`);
      console.log(`Input amount: ${ethers.utils.formatUnits(amountIn, inputToken.decimals)} ${inputToken.symbol}`);
      console.log(`Expected output: ${outputAmount} ${outputToken.symbol} (ratio: ${ratio})`);

      // Run the actual on-chain swap
      const tx = await runSwap(transaction, aiSigner, inputToken);
      console.log(`AI swap transaction sent: ${tx.hash}`);

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log(`AI swap transaction confirmed in block ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: tx.hash,
        outputAmount: outputAmount
      };
    } catch (error) {
      console.error("AI swap execution error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error executing AI swap"
      };
    }
  }

  // Add a helper method to securely store wallet private keys with encryption
  private encryptWalletData(privateKey: string, userAddress: string): string {
    try {
      // Use a salt based on the user's address (or could use a constant server-side salt)
      const salt = ethers.utils.id(userAddress + "FIREBALL_SALT").slice(0, 16);

      // Simple encryption for demo purposes
      // In production, use a proper encryption library with secure parameters
      let encrypted = '';
      for (let i = 0; i < privateKey.length; i++) {
        encrypted += String.fromCharCode(privateKey.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
      }

      // Convert to base64 for storage
      return Buffer.from(encrypted).toString('base64');
    } catch (error) {
      console.error("Error encrypting wallet data:", error);
      throw new Error("Failed to secure wallet data");
    }
  }

  // Helper method to decrypt wallet private keys
  private decryptWalletData(encryptedData: string, userAddress: string): string {
    try {
      // Use the same salt as in encryption
      const salt = ethers.utils.id(userAddress + "FIREBALL_SALT").slice(0, 16);

      // Decode from base64
      const encrypted = Buffer.from(encryptedData, 'base64').toString();

      // Decrypt
      let privateKey = '';
      for (let i = 0; i < encrypted.length; i++) {
        privateKey += String.fromCharCode(encrypted.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
      }

      return privateKey;
    } catch (error) {
      console.error("Error decrypting wallet data:", error);
      throw new Error("Failed to access wallet data");
    }
  }

  // Add a method to ensure the private key is transferred
  async ensurePrivateKeyTransferred(userAddress: string, aiWalletAddress: string, sessionId: number): Promise<boolean> {
    try {
      // First check if this wallet exists in our local storage
      let aiWallet: ethers.Wallet | null = this.aiWalletSigners.get(userAddress) || null;

      if (!aiWallet) {
        // Try to recover from localStorage
        try {
          const storedData = localStorage.getItem(`aiWallet_${userAddress}`);
          if (storedData) {
            const walletData = JSON.parse(storedData);
            if (walletData.address === aiWalletAddress && walletData.encryptedKey) {
              // Decrypt the private key
              const privateKey = this.decryptWalletData(walletData.encryptedKey, userAddress);
              // Create wallet from private key
              aiWallet = new ethers.Wallet(privateKey);

              // Verify that the address matches
              if (aiWallet.address !== aiWalletAddress) {
                console.error("Recovered wallet address doesn't match expected address");
                return false;
              }

              // Store in memory for future use
              this.aiWalletSigners.set(userAddress, aiWallet);
            }
          }
        } catch (storageError) {
          console.error("Error recovering wallet from storage:", storageError);
          return false;
        }
      }

      // If we still don't have the wallet, we can't transfer the key
      if (!aiWallet) {
        console.error("Could not find AI wallet private key");
        return false;
      }

      // Transfer the private key securely to the server
      return await this.transferPrivateKeyToServer(sessionId, aiWallet.privateKey, userAddress);
    } catch (error) {
      console.error("Error ensuring private key transfer:", error);
      return false;
    }
  }
}

export const web3Service = new Web3Service();