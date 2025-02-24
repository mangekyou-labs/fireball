import './App.css';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

import PageButton from './components/PageButton';
import ConnectButton from './components/ConnectButton';
import ConfigModal from './components/ConfigModal';
import CurrencyField from './components/CurrencyField';
import { GearFill } from 'react-bootstrap-icons';
import BeatLoader from 'react-spinners/BeatLoader';

import { getUsdcContract, getWbtcContract, getPrice, runSwap, USDC, WBTC } from './AlphaRouterService';

function App() {
  const [provider, setProvider] = useState(undefined)
  const [signer, setSigner] = useState(undefined)
  const [signerAddress, setSignerAddress] = useState(undefined)

  const [slippageAmount, setSlippageAmount] = useState(2)
  const [deadlineMinutes, setDeadlineMinutes] = useState(10)
  const [showModal, setShowModal] = useState(false)

  const [inputAmount, setInputAmount] = useState(0)
  const [outputAmount, setOutputAmount] = useState(undefined)
  const [transaction, setTransaction] = useState(undefined)
  const [loading, setLoading] = useState(false)
  const [ratio, setRatio] = useState(undefined)

  const [usdcContract, setUsdcContract] = useState(undefined)
  const [wbtcContract, setWbtcContract] = useState(undefined)

  const [usdcAmount, setUsdcAmount] = useState(0)
  const [wbtcAmount, setWbtcAmount] = useState(0)

  // Chain configuration
  const targetNetwork = {
    chainId: `0x${Number(57054).toString(16)}`, // Convert to hex
    chainName: 'Sonic Blaze Testnet',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: [process.env.REACT_APP_RPC_URL_TESTNET],
  };

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
    } catch (switchError) {
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
  const getBalances = async (address) => {
    if (!address || !usdcContract || !wbtcContract) return;

    try {
      const [usdcBalance, wbtcBalance] = await Promise.all([
        usdcContract.balanceOf(address),
        wbtcContract.balanceOf(address)
      ]);

      setUsdcAmount(Number(ethers.utils.formatEther(usdcBalance, USDC.decimals)));
      setWbtcAmount(Number(ethers.utils.formatEther(wbtcBalance, WBTC.decimals)));
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  // Handle account changes
  const accountChangeHandler = async (account) => {
    if (!account) return;

    try {
      // Ensure we're on the correct network first
      const switched = await switchNetwork();
      if (!switched) {
        alert("Please switch to Sonic Blaze network!");
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
      alert("Please install MetaMask!");
      return;
    }

    try {
      // First, ensure we're on the correct network
      const switched = await switchNetwork();
      if (!switched) {
        alert("Please switch to Sonic Blaze network!");
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
        window.ethereum.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            accountChangeHandler(accounts[0]);
          } else {
            // Handle disconnection
            setSigner(undefined);
            setSignerAddress(undefined);
            setUsdcAmount(0);
            setWbtcAmount(0);
          }
        });
      }
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
    }
  };

  const isConnected = () => signer !== undefined && signerAddress !== undefined;

  const getSwapPrice = (inputAmount) => {
    setLoading(true)
    setInputAmount(inputAmount)

    const price = getPrice(
      inputAmount,
      WBTC,
      USDC,
      slippageAmount,
      Math.floor(Date.now() / 1000) + (60 * deadlineMinutes),
      signerAddress
    ).then(
      data => {
        setTransaction(data[0])
        setOutputAmount(data[1])
        setRatio(data[2])
        setLoading(false)
      }
    )
  }

  return (
    <div className="App">
      <div className="appNav">
        <div className="my-2 buttonContainer buttonContainerTop">
          <PageButton name={"Swap"} isBold={true} />
          <PageButton name={"Pool"} />
          <PageButton name={"Vote"} />
          <PageButton name={"Charts"} />
        </div>

        <div className="rightNav">
          <div className="connectButtonContainer">
            <ConnectButton 
              provider={provider}
              isConnected={isConnected}
              signerAddress={signerAddress}
              getSigner={connectWallet}
            />
          </div>

          <div className="my-2 buttonContainer">
            <PageButton name={"..."} isBold={true} />
          </div>
        </div>
      </div>

      <div className="appBody">
        <div className="swapContainer">
          <div className="swapHeader">
            <span className="swapText">Swap</span>
            <span className="gearContainer" onClick={() => setShowModal(true)}>
              <GearFill />
            </span>
            {showModal && (
              <ConfigModal
                onClose={() => setShowModal(false)}
                setDeadlineMinutes={setDeadlineMinutes}
                deadlineMinutes={deadlineMinutes}
                setSlippageAmount={setSlippageAmount}
                slippageAmount={slippageAmount}
              />
            )}
          </div>

          <div className="swapBody">
            <CurrencyField
              field="input"
              tokenName="WBTC"
              getSwapPrice={getSwapPrice}
              signer={signer}
              balance={wbtcAmount}
            />
            <CurrencyField
              field="output"
              tokenName="USDC"
              value={outputAmount}
              signer={signer}
              balance={usdcAmount}
              spinner={BeatLoader}
              loading={loading}
            />
          </div>

          <div className="ratioContainer">
            {ratio && (
              <>
                {`1 WBTC = ${ratio} USDC`}
              </>
            )}
          </div>

          <div className="swapButtonContainer">
            {isConnected() ? (
              <div
                onClick={() => runSwap(transaction, signer)}
                className="swapButton"
              >
                Swap
              </div>
            ) : (
              <div
                className="swapButton"
                onClick={connectWallet}
              >
                Connect Wallet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
