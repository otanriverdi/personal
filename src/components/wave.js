import React, {useState, useEffect} from 'react';
import {ethers} from 'ethers';

function Wave() {
  const [hasEthereum, setHasEthereum] = useState(false);
  const [currentAccount, setCurrentAccount] = useState(null);

  useEffect(() => {
    checkEthereumStatus();
  }, [currentAccount]);

  const checkEthereumStatus = async () => {
    try {
      const {ethereum} = window;

      if (!ethereum) return;

      setHasEthereum(true);

      const accounts = await ethereum.request({method: 'eth_accounts'});

      if (accounts.length !== 0) {
        const account = accounts[0];

        setCurrentAccount(account);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const connectWallet = async () => {
    try {
      const {ethereum} = window;

      if (!ethereum) {
        return;
      }

      const accounts = await ethereum.request({method: 'eth_requestAccounts'});

      setCurrentAccount(accounts[0]);
    } catch (error) {
      console.log(error);
    }
  };

  return hasEthereum ? (
    <div className="wave-section">
      <h3>Hello fellow web3 supporter! 👋🏼</h3>
      <p>
        I see you are also a supporter of decentralized web3 revolution! You can
        connect your wallet to my page. Right now it doesn't do anything but we
        have to start somewhere right?
      </p>
      {currentAccount ? (
        <p>
          <strong>Hurray for the little things!</strong>
        </p>
      ) : null}
      <div className="wave-buttons">
        {!currentAccount ? (
          <button onClick={connectWallet} className="wave-connect-button">
            connect account
          </button>
        ) : null}
      </div>
    </div>
  ) : null;
}

export default Wave;
