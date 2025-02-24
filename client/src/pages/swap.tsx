import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUsdcContract, getWbtcContract, getPrice, runSwap, USDC, WBTC } from '@/lib/uniswap/AlphaRouterService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Chain configuration
const targetNetwork = {
  chainId: `0x${Number(57054).toString(16)}`, // Convert to hex
  chainName: 'Sonic Blaze Testnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: [import.meta.env.VITE_RPC_URL],
};

export default function Swap() {
  const { toast } = useToast();
  const [provider, setProvider] = useState<ethers.providers.Web3Provider>();
  const [signer, setSigner] = useState<ethers.Signer>();
  const [signerAddress, setSignerAddress] = useState<string>();

  const [slippageAmount, setSlippageAmount] = useState(2);
  const [deadlineMinutes, setDeadlineMinutes] = useState(10);
  const [showSettings, setShowSettings] = useState(false);

  const [inputAmount, setInputAmount] = useState('0');
  const [outputAmount, setOutputAmount] = useState<string>();
  const [transaction, setTransaction] = useState<any>();
  const [loading, setLoading] = useState(false);
  const [ratio, setRatio] = useState<string>();

  const [usdcContract, setUsdcContract] = useState<ethers.Contract>();
  const [wbtcContract, setWbtcContract] = useState<ethers.Contract>();

  const [usdcBalance, setUsdcBalance] = useState('0');
  const [wbtcBalance, setWbtcBalance] = useState('0');

  // Switch to the correct network
  const switchNetwork = async () => {
    if (!window.ethereum) return false;

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetNetwork.chainId }],
      });
      return true;
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [targetNetwork],
          });
          return true;
        } catch (addError) {
          console.error('Error adding chain:', addError);
          toast({
            title: "Network Error",
            description: "Failed to add network to MetaMask",
            variant: "destructive"
          });
          return false;
        }
      }
      console.error('Error switching chain:', switchError);
      return false;
    }
  };

  // Initialize contracts once
  useEffect(() => {
    const usdcContract = getUsdcContract();
    const wbtcContract = getWbtcContract();
    setUsdcContract(usdcContract);
    setWbtcContract(wbtcContract);
  }, []);

  // Get token balances
  const getBalances = async (address: string) => {
    if (!address || !usdcContract || !wbtcContract) return;

    try {
      const [usdcBalance, wbtcBalance] = await Promise.all([
        usdcContract.balanceOf(address),
        wbtcContract.balanceOf(address)
      ]);

      setUsdcBalance(ethers.utils.formatUnits(usdcBalance, USDC.decimals));
      setWbtcBalance(ethers.utils.formatUnits(wbtcBalance, WBTC.decimals));
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  // Handle account changes
  const accountChangeHandler = async (account: string) => {
    if (!account) return;

    try {
      // Ensure we're on the correct network first
      const switched = await switchNetwork();
      if (!switched) {
        toast({
          title: "Network Error",
          description: "Please switch to Sonic Blaze network!",
          variant: "destructive"
        });
        return;
      }

      // Update signer and address
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      setProvider(provider);
      setSigner(signer);
      setSignerAddress(account);

      // Get token balances
      await getBalances(account);
    } catch (error) {
      console.error("Error in account change:", error);
    }
  };

  // Connect wallet button handler
  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        title: "Wallet Error",
        description: "Please install MetaMask!",
        variant: "destructive"
      });
      return;
    }

    try {
      // First, ensure we're on the correct network
      const switched = await switchNetwork();
      if (!switched) {
        toast({
          title: "Network Error",
          description: "Please switch to Sonic Blaze network!",
          variant: "destructive"
        });
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: "eth_requestAccounts" 
      });
      
      // Handle the first account
      if (accounts.length > 0) {
        await accountChangeHandler(accounts[0]);

        // Setup account change listener
        window.ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            accountChangeHandler(accounts[0]);
          } else {
            // Handle disconnection
            setSigner(undefined);
            setSignerAddress(undefined);
            setUsdcBalance('0');
            setWbtcBalance('0');
          }
        });
      }
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
    }
  };

  const getSwapPrice = async (value: string) => {
    if (!signerAddress) return;

    setLoading(true);
    setInputAmount(value);

    try {
      const [transaction, outputAmount, ratio] = await getPrice(
        value,
        WBTC,
        USDC,
        slippageAmount,
        Math.floor(Date.now() / 1000) + (60 * deadlineMinutes),
        signerAddress
      );

      setTransaction(transaction);
      setOutputAmount(outputAmount);
      setRatio(ratio);
    } catch (error) {
      console.error("Error getting swap price:", error);
      toast({
        title: "Swap Error",
        description: "Failed to get swap price",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!signer || !transaction) return;

    setLoading(true);
    try {
      const tx = await runSwap(transaction, signer, WBTC);
      await tx.wait();

      toast({
        title: "Success",
        description: "Swap executed successfully!",
      });

      // Refresh balances
      if (signerAddress) {
        await getBalances(signerAddress);
      }
    } catch (error) {
      console.error("Swap failed:", error);
      toast({
        title: "Swap Failed",
        description: "Failed to execute swap",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Swap</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>

          {/* Settings Modal */}
          {showSettings && (
            <div className="mb-6 p-4 border rounded-lg">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Slippage Tolerance (%)
                  </label>
                  <Input
                    type="number"
                    value={slippageAmount}
                    onChange={(e) => setSlippageAmount(Number(e.target.value))}
                    min="0.1"
                    max="50"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Transaction Deadline (minutes)
                  </label>
                  <Input
                    type="number"
                    value={deadlineMinutes}
                    onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
                    min="1"
                    max="60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* WBTC Input */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span>From</span>
              <span>Balance: {Number(wbtcBalance).toFixed(6)} WBTC</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={inputAmount}
                onChange={(e) => getSwapPrice(e.target.value)}
                disabled={loading || !signerAddress}
              />
              <div className="w-24 flex items-center justify-center font-medium bg-secondary rounded">
                WBTC
              </div>
            </div>
          </div>

          {/* USDC Output */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between">
              <span>To</span>
              <span>Balance: {Number(usdcBalance).toFixed(6)} USDC</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={outputAmount}
                disabled={true}
              />
              <div className="w-24 flex items-center justify-center font-medium bg-secondary rounded">
                USDC
              </div>
            </div>
          </div>

          {/* Connect/Swap Button */}
          {!signerAddress ? (
            <Button 
              className="w-full" 
              onClick={connectWallet}
            >
              Connect Wallet
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={executeSwap}
              disabled={loading || !transaction}
            >
              {loading ? "Loading..." : "Swap"}
            </Button>
          )}

          {/* Exchange Rate */}
          {ratio && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              1 WBTC = {ratio} USDC
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
