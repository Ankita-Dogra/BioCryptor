// https://ipfs.io/ipfs/QmYourCIDHere
// http://127.0.0.1:8080/ipfs/<CID>

import React, { useState, useEffect } from "react";
import Web3 from "web3";
import CryptoJS from "crypto-js";
import { create } from "ipfs-http-client";
import CPABEEncrypt from "/biocryptor - Copy/client/src/contracts/EncryptionLog.json"; // Replace with actual ABI

const ipfs = create({ host: "127.0.0.1", port: 5001, protocol: "http" }); // Connect to local IPFS node
const contractAddress = "0xD5f5d158b2abccd754555c0EDA643372e167DecD"; // Replace with actual contract address

function Encrypt() {
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [data, setData] = useState("");
  const [accessPolicy, setAccessPolicy] = useState("");
  const [aesKey, setAesKey] = useState(null);
  const [ipfsCid, setIpfsCid] = useState("");

  useEffect(() => {
    const loadBlockchainData = async () => {
      const web3Instance = new Web3("http://127.0.0.1:7545"); // Ganache local blockchain
      const accounts = await web3Instance.eth.getAccounts();
      setAccount(accounts[0]);
      const contractInstance = new web3Instance.eth.Contract(
        CPABEEncrypt.abi,
        contractAddress
      );
      setWeb3(web3Instance);
      setContract(contractInstance);
      generateAesKey();
    };
    loadBlockchainData();
  }, []);

  const generateAesKey = () => {
    const key = CryptoJS.lib.WordArray.random(32); // 256-bit key
    const keyBase64 = key.toString(CryptoJS.enc.Base64);
    setAesKey(keyBase64);
    console.log("Generated AES-256 Key (Base64):", keyBase64);
  };

  const encryptData = (plainText, base64Key) => {
    const key = CryptoJS.enc.Base64.parse(base64Key);
    const iv = CryptoJS.lib.WordArray.random(16); // 128-bit IV

    const encrypted = CryptoJS.AES.encrypt(plainText, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return {
      ciphertext: encrypted.toString(),
      iv: iv.toString(CryptoJS.enc.Hex),
    };
  };

  const uploadToIPFS = async (jsonData) => {
    try {
      const { path } = await ipfs.add(jsonData);
      console.log("IPFS CID:", path);
      setIpfsCid(path);
      return path;
    } catch (error) {
      console.error("IPFS Upload Error:", error);
      throw new Error("Failed to upload to IPFS");
    }
  };

  const handleEncrypt = async () => {
    if (!web3 || !contract) {
      alert("Web3 or contract is not initialized.");
      return;
    }
    if (!aesKey) {
      alert("AES key not generated.");
      return;
    }

    try {
      const { ciphertext, iv } = encryptData(data, aesKey);

      const jsonData = JSON.stringify({
        encryptedData: ciphertext,
        iv: iv,
        aesKey: aesKey, // Storing AES key in plaintext
        accessPolicy: accessPolicy, // Storing access policy in plaintext
      });

      const ipfsHash = await uploadToIPFS(jsonData);
      console.log("Encrypted Data Stored on IPFS:", ipfsHash);
      await handleContractCall(ipfsHash);
      alert("Encryption logged successfully.");
    } catch (error) {
      console.error("Encryption failed:", error);
      alert("Encryption failed.");
    }
  };

  const logCidToBackend = async (cid) => {
    try {
      const response = await fetch("http://localhost:5000/log-cid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid }),
      });

      if (!response.ok) {
        throw new Error("Failed to log CID");
      }

      console.log("CID logged to backend.");
    } catch (err) {
      console.error("CID Logging Error:", err);
    }
  };

  const handleContractCall = async (ipfsHash) => {
    try {
      const gasEstimate = await contract.methods
        .logEncryption(ipfsHash)
        .estimateGas({ from: account });

      const receipt = await contract.methods
        .logEncryption(ipfsHash)
        .send({ from: account, gas: gasEstimate });

      console.log(`Transaction hash: ${receipt.transactionHash}`);
      console.log(`Gas used: ${receipt.gasUsed}`);
    } catch (error) {
      console.error("Error in contract call:", error);
    }
    await logCidToBackend(ipfsHash);
  };

  return (
    <div>
      <h1>Encrypt Data</h1>
      <div>
        <textarea
          value={data}
          onChange={(e) => setData(e.target.value)}
          placeholder="Enter data to encrypt"
        />
      </div>
      <div>
        <label>Enter the roles (comma-separated):</label>
        <input
          type="text"
          value={accessPolicy}
          onChange={(e) => setAccessPolicy(e.target.value)}
          placeholder="e.g., role:admin, location:NY"
        />
      </div>
      <button onClick={handleEncrypt}>Encrypt & Upload</button>
      {ipfsCid && (
        <div>
          <h2>IPFS CID for stored data:</h2>
          <p>{ipfsCid}</p>
        </div>
      )}
    </div>
  );
}

export default Encrypt;
