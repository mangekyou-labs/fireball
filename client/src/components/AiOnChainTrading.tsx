import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTitle, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useWallet } from '@/contexts/WalletContext';
import { aiTradingService } from '@/lib/aiTradingService';
import { LockClosedIcon, PlayIcon, PauseIcon, ReloadIcon } from "@radix-ui/react-icons";
import { ArrowRight } from "lucide-react";
import { apiRequest } from '@/lib/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ethers } from 'ethers';
import { getContractsForChain } from '@/lib/constants';
import { web3Service } from '@/lib/web3Service';

// Define the AIWallet interface
interface AIWallet {
    id: number;
    userAddress: string;
    aiWalletAddress: string;
    allocatedAmount: string;
    createdAt: string;
    isActive: boolean;
}

export const AiOnChainTrading: React.FC = () => {
    const { toast } = useToast();
    const { isConnected, address } = useWallet();
    const [isStarted, setIsStarted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [confidenceThreshold, setConfidenceThreshold] = useState(50);
    const [tradeAmount, setTradeAmount] = useState(1);
    const [logs, setLogs] = useState<string[]>([]);
    const [wallets, setWallets] = useState<AIWallet[]>([]);
    const [selectedWalletId, setSelectedWalletId] = useState<string>("");
    const [isWalletsLoading, setIsWalletsLoading] = useState(false);
    const [isFundDialogOpen, setIsFundDialogOpen] = useState(false);
    const [fundAmount, setFundAmount] = useState("1");
    const [nativeTokenAmount, setNativeTokenAmount] = useState("0.01");
    const [isFunding, setIsFunding] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
    const [isBalanceLoading, setIsBalanceLoading] = useState(false);
    const logsInterval = React.useRef<NodeJS.Timeout | null>(null);

    // Fetch AI wallets on component mount and when address changes
    useEffect(() => {
        if (isConnected && address) {
            // Ensure web3Service is properly initialized
            const initializeWeb3 = async () => {
                console.log("Initializing web3 service for AiOnChainTrading component");
                if (!web3Service.provider || !web3Service.signer) {
                    console.log("Provider or signer not available, connecting...");
                    await web3Service.connect();
                    console.log(`After connect - Provider: ${web3Service.provider ? 'YES' : 'NO'}, Signer: ${web3Service.signer ? 'YES' : 'NO'}`);
                }
            };

            initializeWeb3().then(() => {
                fetchAIWallets();
            }).catch(error => {
                console.error("Failed to initialize web3:", error);
                toast({
                    title: "Connection Error",
                    description: "Failed to connect to blockchain. Please refresh and try again.",
                    variant: "destructive",
                });
            });
        }
    }, [isConnected, address]);

    // Update logs from the service
    useEffect(() => {
        const interval = setInterval(() => {
            if (isStarted) {
                setLogs(aiTradingService.getLogs());
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [isStarted]);

    // Add this useEffect hook to update logs periodically and clean up on unmount
    useEffect(() => {
        // Only set up interval if trading is started
        if (isStarted && !logsInterval.current) {
            logsInterval.current = setInterval(() => {
                setLogs(aiTradingService.getLogs());
            }, 3000);

            // Initial log fetch
            setLogs(aiTradingService.getLogs());
        }

        // Clean up on unmount
        return () => {
            if (logsInterval.current) {
                clearInterval(logsInterval.current);
                logsInterval.current = null;
            }
        };
    }, [isStarted]);

    // Fetch AI wallets for the current user
    const fetchAIWallets = async () => {
        try {
            if (!address) return;

            setIsWalletsLoading(true);

            const response = await apiRequest<AIWallet[]>('/api/wallets', {
                method: 'GET',
                params: { userAddress: address }
            });

            if (response && Array.isArray(response) && response.length > 0) {
                setWallets(response);
                // Auto-select the first wallet or active wallet if available
                const activeWallet = response.find(w => w.isActive);
                if (activeWallet) {
                    setSelectedWalletId(activeWallet.id.toString());
                    // Check balance for the selected wallet
                    checkSelectedWalletBalance(activeWallet.id.toString());
                } else {
                    setSelectedWalletId(response[0].id.toString());
                    // Check balance for the selected wallet
                    checkSelectedWalletBalance(response[0].id.toString());
                }
            } else {
                setWallets([]);
                setSelectedWalletId("");
                setUsdcBalance(null);
            }
        } catch (error) {
            console.error("Error fetching AI wallets:", error);
            toast({
                title: "Error",
                description: "Failed to fetch AI wallets",
                variant: "destructive",
            });
            setWallets([]);
            setSelectedWalletId("");
            setUsdcBalance(null);
        } finally {
            setIsWalletsLoading(false);
        }
    };

    // Handle wallet selection change
    const handleWalletChange = (walletId: string) => {
        setSelectedWalletId(walletId);
        checkSelectedWalletBalance(walletId);
    };

    // Check balance for the selected wallet
    const checkSelectedWalletBalance = async (walletId: string) => {
        try {
            if (!address || !walletId) return;

            setIsBalanceLoading(true);
            setUsdcBalance(null);

            // Get AI wallet private key from the server
            const response = await apiRequest<{ privateKey: string }>('/api/ai-wallet/key', {
                method: 'POST',
                body: {
                    userAddress: address,
                    walletId: walletId
                }
            });

            if (!response?.privateKey) {
                throw new Error('Failed to get AI wallet private key');
            }

            // Use the aiTradingService to check the balance
            const balance = await aiTradingService.checkAiWalletUsdcBalance(response.privateKey);
            setUsdcBalance(balance);
        } catch (error) {
            console.error("Error checking wallet balance:", error);
            toast({
                title: "Balance Check Failed",
                description: error instanceof Error ? error.message : "Failed to check wallet balance",
                variant: "destructive",
            });
            setUsdcBalance(null);
        } finally {
            setIsBalanceLoading(false);
        }
    };

    // Handle start trading
    const handleStartTrading = async () => {
        if (!isConnected || !address) {
            toast({
                title: "Wallet Not Connected",
                description: "Please connect your wallet first.",
                variant: "destructive",
            });
            return;
        }

        if (wallets.length === 0 || !selectedWalletId) {
            toast({
                title: "AI Wallet Required",
                description: "You need to set up an AI wallet first.",
                variant: "destructive",
            });
            return;
        }

        // Make sure we have direct access to MetaMask
        if (typeof window.ethereum === 'undefined') {
            toast({
                title: "MetaMask Required",
                description: "Please install MetaMask to use AI trading features.",
                variant: "destructive",
            });
            return;
        }

        // Force a direct connection to MetaMask
        try {
            console.log("Requesting direct connection to MetaMask...");
            await window.ethereum.request({ method: 'eth_requestAccounts' });
        } catch (error) {
            console.error("Failed to connect to MetaMask:", error);
            toast({
                title: "Connection Error",
                description: "Failed to connect to MetaMask. Please try again.",
                variant: "destructive",
            });
            return;
        }

        // Create a fresh provider directly
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();

        // Log the current chain ID to help debug network issues
        const currentChainId = network.chainId;
        console.log(`Starting trading on chain ID: ${currentChainId}`);

        // Clear any existing logs and show initial message
        const initialLogs = [
            `Initializing AI trading on chain ${currentChainId}...`,
            "Requesting AI wallet private key from server...",
            `Selected wallet ID: ${selectedWalletId}`,
            `Connected with address: ${address}`,
            `Current ETH balance: ${await provider.getBalance(address).then(b => ethers.utils.formatEther(b))} ETH`,
        ];

        setLogs(initialLogs);
        setIsLoading(true);

        try {
            // Get AI wallet private key from the server
            console.log("Requesting private key for wallet ID:", selectedWalletId);

            const startTime = Date.now();
            console.log("Sending private key request at:", new Date(startTime).toISOString());

            const response = await apiRequest<{ privateKey: string }>('/api/ai-wallet/key', {
                method: 'POST',
                body: {
                    userAddress: address,
                    walletId: selectedWalletId
                }
            });

            console.log(`Received response after ${Date.now() - startTime}ms`);

            if (!response || !response.privateKey) {
                throw new Error('Failed to get AI wallet private key from server');
            }

            // To help with debugging, try to verify the key first
            console.log("Verifying private key format...");
            try {
                // Just create a wallet to test if the key format is valid
                // This won't expose the key on the console
                const testWallet = new ethers.Wallet(response.privateKey);
                const testAddress = await testWallet.getAddress();
                console.log(`Private key is valid and corresponds to address: ${testAddress}`);
                setLogs(prev => [...prev, "Private key verified successfully"]);
            } catch (keyError) {
                console.error("Invalid private key format:", keyError);
                setLogs(prev => [...prev, "WARNING: Private key format is invalid!"]);
            }

            console.log("Private key received, initializing trading service...");
            setLogs(prev => [...prev, "Private key received, initializing trading..."]);

            // Log all the steps clearly
            setLogs(prev => [...prev, "Setting confidence threshold to " + (confidenceThreshold / 100)]);
            setLogs(prev => [...prev, "Setting trade amount to " + tradeAmount + " USDC"]);
            setLogs(prev => [...prev, "Initializing AI trading service..."]);

            // Start the trading with aiTradingService
            const startServiceTime = Date.now();
            console.log(`Starting AI trading service at ${new Date(startServiceTime).toISOString()}`);

            const success = await aiTradingService.startTrading(
                response.privateKey,
                confidenceThreshold / 100, // Convert from percentage to decimal
                tradeAmount
            );

            console.log(`AI trading service responded after ${Date.now() - startServiceTime}ms with success=${success}`);

            if (success) {
                setIsStarted(true);
                const serviceLogs = aiTradingService.getLogs();
                setLogs(serviceLogs.length > 0 ? serviceLogs : [...initialLogs, "AI trading service started, waiting for first trade iteration..."]);

                toast({
                    title: "AI Trading Started",
                    description: "On-chain trading is now active",
                });

                // Set up periodic log updates
                if (logsInterval.current) {
                    clearInterval(logsInterval.current);
                    logsInterval.current = null;
                }

                logsInterval.current = setInterval(() => {
                    const currentLogs = aiTradingService.getLogs();
                    if (currentLogs.length > 0) {
                        setLogs(currentLogs);
                    }
                }, 3000);

            } else {
                // Get logs even if startup failed to see what went wrong
                const errorLogs = aiTradingService.getLogs();
                if (errorLogs.length > 0) {
                    setLogs(errorLogs);
                } else {
                    setLogs(prev => [...prev, "Trading service failed to start but provided no error logs"]);
                }

                throw new Error("Failed to start trading service. See logs for details.");
            }
        } catch (error) {
            console.error("Error starting AI trading:", error);

            // Try to get any logs that might explain the error
            const errorLogs = aiTradingService.getLogs();
            if (errorLogs.length > 0) {
                setLogs(prev => [...prev, "--- ERROR LOGS ---", ...(errorLogs.slice(-10))]);
            } else {
                setLogs(prev => [...prev,
                    "--- ERROR ---",
                error instanceof Error ? error.message : "Unknown error",
                    "No additional error logs available from the trading service"
                ]);
            }

            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to start AI trading",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Handle stop trading
    const handleStopTrading = () => {
        const stopped = aiTradingService.stopTrading();
        if (stopped) {
            setIsStarted(false);

            // Clear logs interval
            if (logsInterval.current) {
                clearInterval(logsInterval.current);
                logsInterval.current = null;
            }

            toast({
                title: "AI Trading Stopped",
                description: "On-chain trading has been deactivated",
            });
        }
    };

    // Format the AI wallet address for display
    const formatAddress = (address: string) => {
        if (!address) return "";
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    // Get the selected wallet
    const selectedWallet = wallets.find(w => w.id.toString() === selectedWalletId);

    // Calculate the USDC allocation amount for display
    const formattedAllocation = selectedWallet
        ? parseFloat(selectedWallet.allocatedAmount).toFixed(2)
        : "0.00";

    // Function to fund the AI wallet with USDC and native tokens
    const fundAIWallet = async () => {
        try {
            if (!isConnected || !address || !selectedWallet) {
                toast({
                    title: "Error",
                    description: "Please connect your wallet and select an AI wallet first.",
                    variant: "destructive",
                });
                return;
            }

            setIsFunding(true);
            setTxHash(null);

            // Make very sure we have a fresh provider connection
            if (typeof window.ethereum === 'undefined') {
                throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
            }

            // Force MetaMask to connect using the low-level API
            console.log("Requesting MetaMask accounts directly...");
            try {
                await window.ethereum.request({
                    method: 'eth_requestAccounts'
                });
                console.log("Successfully connected to MetaMask");
            } catch (connError) {
                console.error("Failed direct MetaMask connection:", connError);
                throw new Error("Failed to connect to MetaMask. Please try again or refresh the page.");
            }

            // Now use the web3Service to create a provider with the active connection
            console.log("Creating provider from connected MetaMask...");
            try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();

                // Verify we can get the address (this will fail if connection failed)
                const connectedAddress = await signer.getAddress();
                console.log("Successfully connected with address:", connectedAddress);

                // Get the current chain contracts
                const network = await provider.getNetwork();
                const currentChainId = network.chainId;
                const contracts = getContractsForChain(currentChainId);

                console.log(`Connected to chain: ${currentChainId}`);
                console.log(`Sending funds to AI wallet: ${selectedWallet.aiWalletAddress}`);

                // Transfer native token (ETH) for gas - we'll do this directly with the provider we just created
                if (parseFloat(nativeTokenAmount) > 0) {
                    try {
                        console.log("Getting ETH balance...");
                        const balance = await provider.getBalance(connectedAddress);
                        console.log(`User ETH balance: ${ethers.utils.formatEther(balance)} ETH`);

                        if (balance.lt(ethers.utils.parseEther(nativeTokenAmount))) {
                            throw new Error(`Insufficient ETH balance for gas. You have ${ethers.utils.formatEther(balance)} ETH.`);
                        }

                        console.log(`Sending ${nativeTokenAmount} ETH to ${selectedWallet.aiWalletAddress}`);

                        // This should trigger MetaMask popup - using the local provider/signer
                        const tx = await signer.sendTransaction({
                            to: selectedWallet.aiWalletAddress,
                            value: ethers.utils.parseEther(nativeTokenAmount)
                        });

                        console.log("Transaction submitted:", tx.hash);
                        setTxHash(tx.hash);

                        toast({
                            title: "Transaction Submitted",
                            description: "Your ETH transfer is being processed. Please wait for confirmation.",
                        });

                        // Wait for transaction to be mined
                        console.log("Waiting for transaction confirmation...");
                        await tx.wait();
                        console.log("Transaction confirmed!");

                        toast({
                            title: "ETH Transfer Successful",
                            description: `Successfully transferred ${nativeTokenAmount} ETH to AI wallet for gas`,
                        });

                        setIsFundDialogOpen(false);
                    } catch (error) {
                        console.error("Error transferring ETH:", error);
                        const errorMessage = error instanceof Error ? error.message : String(error);

                        // Show more helpful message based on common errors
                        if (errorMessage.includes("user rejected") || errorMessage.includes("User denied")) {
                            throw new Error("Transaction was rejected in MetaMask. Please try again.");
                        } else {
                            throw new Error(`ETH transfer failed: ${errorMessage}`);
                        }
                    }
                }

                // Only transfer USDC if amount > 0
                if (parseFloat(fundAmount) > 0) {
                    // Use the local provider and signer we just created
                    console.log(`Funding AI wallet on chain ID: ${currentChainId}`);
                    console.log(`Using USDC address: ${contracts.USDC}`);

                    try {
                        // Create USDC contract instance
                        const usdcContract = new ethers.Contract(
                            contracts.USDC,
                            ['function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
                            signer
                        );

                        // Log USDC contract address again to ensure it's correct
                        console.log(`USDC contract address: ${usdcContract.address}`);

                        // Get USDC decimals
                        const decimals = await usdcContract.decimals();
                        console.log(`USDC decimals: ${decimals}`);

                        // Check user's USDC balance with the exact contract address
                        const balance = await usdcContract.balanceOf(connectedAddress);
                        const formattedBalance = ethers.utils.formatUnits(balance, decimals);
                        console.log(`USDC balance for ${connectedAddress}: ${formattedBalance} (raw: ${balance.toString()})`);

                        if (parseFloat(formattedBalance) < parseFloat(fundAmount)) {
                            throw new Error(`Insufficient USDC balance. You have ${formattedBalance} USDC.`);
                        }

                        // Convert amount to proper decimal representation
                        const amount = ethers.utils.parseUnits(fundAmount, decimals);
                        console.log(`Transferring ${fundAmount} USDC (${amount.toString()} in wei)`);

                        // Transfer USDC to AI wallet
                        const tx = await usdcContract.transfer(selectedWallet.aiWalletAddress, amount);
                        setTxHash(tx.hash);
                        console.log(`USDC transfer tx hash: ${tx.hash}`);

                        toast({
                            title: "USDC Transaction Submitted",
                            description: "Your USDC transfer is being processed. Please wait for confirmation.",
                        });

                        // Wait for transaction to be mined
                        console.log(`Waiting for transaction to be mined...`);
                        await tx.wait();
                        console.log(`USDC transfer confirmed!`);

                        toast({
                            title: "USDC Transfer Successful",
                            description: `Successfully transferred ${fundAmount} USDC to AI wallet`,
                        });

                        // Refresh the AI wallet's USDC balance
                        if (selectedWalletId) {
                            console.log(`Refreshing AI wallet USDC balance...`);
                            setTimeout(() => checkSelectedWalletBalance(selectedWalletId), 2000);
                        }
                    } catch (tokenError) {
                        console.error(`USDC transfer error:`, tokenError);
                        throw new Error(`USDC transfer failed: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`);
                    }
                }

                setIsFundDialogOpen(false);
            } catch (providerError) {
                console.error("Error creating provider:", providerError);
                throw new Error(`Failed to connect to wallet provider: ${providerError instanceof Error ? providerError.message : String(providerError)}`);
            }
        } catch (error) {
            console.error("Error funding AI wallet:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to fund AI wallet",
                variant: "destructive",
            });
        } finally {
            setIsFunding(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">AI On-Chain Trading</CardTitle>
                    {isStarted ?
                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge> :
                        <Badge variant="outline">Inactive</Badge>
                    }
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {!isConnected && (
                    <p className="text-amber-500 text-sm">
                        Please connect your wallet to use AI trading features.
                    </p>
                )}

                {isConnected && wallets.length === 0 && !isWalletsLoading && (
                    <p className="text-amber-500 text-sm">
                        You need to set up an AI wallet before you can start trading. Please visit the AI Wallet section.
                    </p>
                )}

                {isWalletsLoading && (
                    <p className="text-sm text-muted-foreground">
                        Loading AI wallets...
                    </p>
                )}

                {wallets.length > 0 && (
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="wallet-select">AI Wallet</Label>
                                {selectedWallet && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setIsFundDialogOpen(true)}
                                        className="flex items-center space-x-1"
                                    >
                                        <ArrowRight className="h-3 w-3 mr-1" />
                                        <span>Fund Wallet</span>
                                    </Button>
                                )}
                            </div>
                            <Select
                                value={selectedWalletId}
                                onValueChange={handleWalletChange}
                                disabled={isStarted}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select AI wallet" />
                                </SelectTrigger>
                                <SelectContent>
                                    {wallets.map((wallet) => (
                                        <SelectItem key={wallet.id} value={wallet.id.toString()}>
                                            {formatAddress(wallet.aiWalletAddress)} ({parseFloat(wallet.allocatedAmount).toFixed(2)} USDC)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedWallet && (
                                <div className="flex flex-col gap-1">
                                    <p className="text-xs text-muted-foreground">
                                        Selected wallet has {formattedAllocation} USDC allocated for trading
                                    </p>
                                    <div className="flex items-center">
                                        <p className="text-xs font-medium flex-1">
                                            {isBalanceLoading ? (
                                                "Checking current USDC balance..."
                                            ) : usdcBalance !== null ? (
                                                <span className={parseFloat(usdcBalance) > 0 ? "text-green-600" : "text-amber-600"}>
                                                    Current USDC balance: {usdcBalance} USDC
                                                    {parseFloat(usdcBalance) < tradeAmount && (
                                                        <span className="ml-1 text-red-500">(Insufficient for trading)</span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-amber-600">Could not retrieve current balance</span>
                                            )}
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            disabled={isBalanceLoading || !selectedWalletId}
                                            onClick={() => checkSelectedWalletBalance(selectedWalletId)}
                                        >
                                            <ReloadIcon className="h-3 w-3" />
                                            <span className="sr-only">Refresh balance</span>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="confidence-threshold">Confidence Threshold</Label>
                            <div className="flex items-center space-x-2">
                                <Slider
                                    id="confidence-threshold"
                                    value={[confidenceThreshold]}
                                    min={10}
                                    max={90}
                                    step={5}
                                    disabled={isStarted}
                                    onValueChange={(value) => setConfidenceThreshold(value[0])}
                                    className="flex-1"
                                />
                                <span className="w-12 text-sm">{confidenceThreshold}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                AI will trade when confidence exceeds this threshold
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="trade-amount">Trade Amount (USDC)</Label>
                            <div className="flex items-center space-x-2">
                                <Input
                                    id="trade-amount"
                                    type="number"
                                    value={tradeAmount}
                                    onChange={(e) => setTradeAmount(Number(e.target.value))}
                                    min={0.1}
                                    max={parseFloat(formattedAllocation) || 100}
                                    step={0.1}
                                    disabled={isStarted}
                                    className="w-24"
                                />
                                <span className="text-sm">USDC</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Amount to trade per transaction
                            </p>
                        </div>

                        <div className="pt-4">
                            <h4 className="text-sm font-medium mb-2">Trading Logs</h4>
                            <div className="h-60 overflow-y-auto rounded-md border p-2 text-sm">
                                {logs.length > 0 ? logs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`pb-1 ${log.includes("Error") ? "text-red-500" :
                                            log.includes("BUY") ? "text-green-500" :
                                                log.includes("SELL") ? "text-amber-500" : ""
                                            }`}
                                    >
                                        {log}
                                    </div>
                                )) : (
                                    <div className="text-muted-foreground">No trading activity yet</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Funding dialog */}
            <Dialog open={isFundDialogOpen} onOpenChange={setIsFundDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogTitle>Fund AI Wallet</DialogTitle>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="usdc-amount" className="text-right">
                                USDC Amount
                            </Label>
                            <Input
                                id="usdc-amount"
                                type="number"
                                value={fundAmount}
                                onChange={(e) => setFundAmount(e.target.value)}
                                min="0"
                                step="0.1"
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="eth-amount" className="text-right">
                                ETH for Gas
                            </Label>
                            <Input
                                id="eth-amount"
                                type="number"
                                value={nativeTokenAmount}
                                onChange={(e) => setNativeTokenAmount(e.target.value)}
                                min="0"
                                step="0.001"
                                className="col-span-3"
                            />
                        </div>
                        {txHash && (
                            <div className="px-2 py-1 text-xs text-green-600 bg-green-50 rounded">
                                Transaction submitted: {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 4)}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFundDialogOpen(false)} disabled={isFunding}>
                            Cancel
                        </Button>
                        <Button
                            onClick={fundAIWallet}
                            disabled={isFunding}
                            className={isFunding ? "animate-pulse" : ""}
                        >
                            {isFunding ? (
                                <span className="flex items-center">
                                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                                    {txHash ? "Processing..." : "Waiting for wallet..."}
                                </span>
                            ) : "Fund Wallet"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CardFooter className="flex justify-end">
                {isStarted ? (
                    <Button
                        variant="destructive"
                        className="flex items-center space-x-1"
                        onClick={handleStopTrading}
                        disabled={isLoading}
                    >
                        <PauseIcon className="h-4 w-4" />
                        <span>Stop Trading</span>
                    </Button>
                ) : (
                    <Button
                        variant="default"
                        className="flex items-center space-x-1"
                        onClick={handleStartTrading}
                        disabled={isLoading || !isConnected || wallets.length === 0 || !selectedWalletId}
                    >
                        {isLoading ? (
                            <span>Loading...</span>
                        ) : (
                            <>
                                <PlayIcon className="h-4 w-4" />
                                <span>Start Trading</span>
                            </>
                        )}
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}; 