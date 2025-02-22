import './App.css';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

import PageButton from './components/PageButton';
import ConnectButton from './components/ConnectButton';
import ConfigModal from './components/ConfigModal';
import CurrencyField from './components/CurrencyField';
import { GearFill } from 'react-bootstrap-icons';
import BeatLoader from 'react-spinners/BeatLoader';

import { getWethContract, getWbtcContract, getPrice, runSwap } from './AlphaRouterService';

function App() {
  const [provider, setProvider] = useState(undefined)
  const [signer, setSigner] = useState(undefined)
  const [signerAddress, setSignerAddress] = useState(undefined)

  const [slippageAmount, setSlippageAmount] = useState(2)
  const [deadlineMinutes, setDeadlineMinutes] = useState(10)
  const [showModal, setShowModal] = useState(false)

  const [inputAmount, setInputAmount] = useState(undefined)
  const [outputAmount, setOutputAmount] = useState(undefined)
  const [transaction, setTransaction] = useState(undefined)
  const [loading, setLoading] = useState(false)
  const [ratio, setRatio] = useState(undefined)

  const [wethContract, setWethContract] = useState(undefined)
  const [wbtcContract, setWbtcContract] = useState(undefined)

  const [wethAmount, setWethAmount] = useState(undefined)
  const [wbtcAmount, setWbtcAmount] = useState(undefined)

  useEffect(() => {
    const onLoad = async () => {
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      setProvider(provider)

      const wethContract = getWethContract()
      setWethContract(wethContract)

      const wbtcContract = getWbtcContract()
      setWbtcContract(wbtcContract)
    }
    onLoad()
  }, [])

  const getSigner = async provider => {
    await provider.send('eth_requestAccounts', [])
    const signer = provider.getSigner()
    setSigner(signer)
  }

  const isConnected = () => signer !== undefined

  const refreshWalletAddress = () => {
    signer.getAddress()
      .then(address => {
        setSignerAddress(address)

        wethContract.balanceOf(address)
          .then(balance => setWethAmount(Number(ethers.utils.formatEther(balance))))

        wbtcContract.balanceOf(address)
          .then(balance => setWbtcAmount(Number(ethers.utils.formatEther(balance))))
      })
  }

  if (signer !== undefined) {
    refreshWalletAddress()
  }

  const getSwapPrice = (inputAmount) => {
    setLoading(true)
    setInputAmount(inputAmount)

    const price = getPrice(
      inputAmount,
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
              getSigner={getSigner}
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
              tokenName="WETH"
              getSwapPrice={getSwapPrice}
              signer={signer}
              balance={wethAmount}
            />
            <CurrencyField
              field="output"
              tokenName="WBTC"
              value={outputAmount}
              signer={signer}
              balance={wbtcAmount}
              spinner={BeatLoader}
              loading={loading}
            />
          </div>

          <div className="ratioContainer">
            {ratio && (
              <>
                {`1 WBTC = ${ratio} WETH`}
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
                  onClick={() => getSigner(provider)}
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
