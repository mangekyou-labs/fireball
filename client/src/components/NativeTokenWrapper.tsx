import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/contexts/WalletContext';
import { Loader2 } from 'lucide-react';

// WETH contract address from environment
const WETH_ADDRESS = import.meta.env.VITE_WETH_ADDRESS;

// WETH9 ABI - only including the functions we need
const WETH9ABI = [
    // Deposit function
    {
        "constant": false,
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "payable": true,
        "stateMutability": "payable",
        "type": "function"
    },
    // Withdraw function
    {
        "constant": false,
        "inputs": [{ "name": "wad", "type": "uint256" }],
        "name": "withdraw",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // BalanceOf function
    {
        "constant": true,
        "inputs": [{ "name": "", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

export function NativeTokenWrapper() {
    const { toast } = useToast();
    const { address, isConnected, provider, signer } = useWallet();
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [balance, setBalance] = useState('0');
    const [wethBalance, setWethBalance] = useState('0');

    // Get native token and WETH balances
    useEffect(() => {
        const fetchBalances = async () => {
            if (isConnected && address && provider) {
                try {
                    // Get native token balance
                    const nativeBalance = await provider.getBalance(address);
                    setBalance(ethers.utils.formatEther(nativeBalance));

                    // Get WETH balance
                    const wethContract = new ethers.Contract(WETH_ADDRESS, WETH9ABI, provider);
                    const wethBal = await wethContract.balanceOf(address);
                    setWethBalance(ethers.utils.formatEther(wethBal));
                } catch (error) {
                    console.error('Error fetching balances:', error);
                }
            }
        };

        fetchBalances();
        // Set up interval to refresh balances
        const interval = setInterval(fetchBalances, 10000);
        return () => clearInterval(interval);
    }, [isConnected, address, provider]);

    const wrapToken = async () => {
        if (!isConnected || !address || !signer) {
            toast({
                title: 'Wallet not connected',
                description: 'Please connect your wallet to wrap tokens.',
                variant: 'destructive',
            });
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            toast({
                title: 'Invalid amount',
                description: 'Please enter a valid amount to wrap.',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        try {
            const wethContract = new ethers.Contract(WETH_ADDRESS, WETH9ABI, signer);
            const weiAmount = ethers.utils.parseEther(amount);

            // Deposit ETH to get WETH
            const tx = await wethContract.deposit({ value: weiAmount });
            await tx.wait();

            toast({
                title: 'Token Wrapped Successfully',
                description: `You have wrapped ${amount} ETH to WETH.`,
            });

            // Reset input
            setAmount('');

            // Refresh balances
            if (provider) {
                const nativeBalance = await provider.getBalance(address);
                setBalance(ethers.utils.formatEther(nativeBalance));

                const wethBal = await wethContract.balanceOf(address);
                setWethBalance(ethers.utils.formatEther(wethBal));
            }
        } catch (error) {
            console.error('Error wrapping token:', error);
            toast({
                title: 'Failed to Wrap Token',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const unwrapToken = async () => {
        if (!isConnected || !address || !signer) {
            toast({
                title: 'Wallet not connected',
                description: 'Please connect your wallet to unwrap tokens.',
                variant: 'destructive',
            });
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            toast({
                title: 'Invalid amount',
                description: 'Please enter a valid amount to unwrap.',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        try {
            const wethContract = new ethers.Contract(WETH_ADDRESS, WETH9ABI, signer);
            const weiAmount = ethers.utils.parseEther(amount);

            // Withdraw WETH to get ETH
            const tx = await wethContract.withdraw(weiAmount);
            await tx.wait();

            toast({
                title: 'Token Unwrapped Successfully',
                description: `You have unwrapped ${amount} WETH to ETH.`,
            });

            // Reset input
            setAmount('');

            // Refresh balances
            if (provider) {
                const nativeBalance = await provider.getBalance(address);
                setBalance(ethers.utils.formatEther(nativeBalance));

                const wethBal = await wethContract.balanceOf(address);
                setWethBalance(ethers.utils.formatEther(wethBal));
            }
        } catch (error) {
            console.error('Error unwrapping token:', error);
            toast({
                title: 'Failed to Unwrap Token',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Wrap/Unwrap Native Token</CardTitle>
                <CardDescription>
                    Convert between ETH and WETH
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                        <span>ETH Balance: {parseFloat(balance).toFixed(4)}</span>
                        <span>WETH Balance: {parseFloat(wethBalance).toFixed(4)}</span>
                    </div>

                    <Input
                        type="number"
                        placeholder="Amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={isLoading}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            onClick={wrapToken}
                            disabled={isLoading || !isConnected}
                            className="w-full"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Wrapping...
                                </>
                            ) : (
                                'Wrap ETH'
                            )}
                        </Button>

                        <Button
                            onClick={unwrapToken}
                            disabled={isLoading || !isConnected}
                            className="w-full"
                            variant="outline"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Unwrapping...
                                </>
                            ) : (
                                'Unwrap WETH'
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 