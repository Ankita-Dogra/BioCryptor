import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { create } from "ipfs-http-client";
import Web3 from "web3";
import CryptoJS from "crypto-js";
import UserRegistryContract from "../contracts/RegistrationLog.json"; // Compiled contract JSON

// IPFS Client
const ipfs = create({ host: "127.0.0.1", port: 5001, protocol: "http" });

// Contract Address Deployed on Ganache
const contractAddress = "0x1a15F64504F55BeB8a536d945040206F44C66c9d";

const Register = () => {
  const webcamRef = useRef(null);
  const [attributes, setAttributes] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [web3, setWeb3] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);

  // Load Blockchain
  useEffect(() => {
    const loadBlockchainData = async () => {
      try {
        const web3Instance = new Web3("http://127.0.0.1:7545"); // Ganache RPC URL
        const accounts = await web3Instance.eth.getAccounts();
        const contractInstance = new web3Instance.eth.Contract(
          UserRegistryContract.abi,
          contractAddress
        );
        setWeb3(web3Instance);
        setAccount(accounts[0]);
        setContract(contractInstance);
      } catch (error) {
        console.error("Blockchain connection error:", error);
      }
    };
    loadBlockchainData();
  }, []);

  const handleCapture = async () => {
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      const faceEmbedding = CryptoJS.SHA256(imageSrc).toString();
      const generatedSecretKey = CryptoJS.lib.WordArray.random(16).toString();
      setSecretKey(generatedSecretKey);

      const userData = {
        attributes: attributes.split(",").map((attr) => attr.trim()),
        faceEmbedding: faceEmbedding,
        secretKey: generatedSecretKey,
      };

      const userDataString = JSON.stringify(userData);

      const added = await ipfs.add(userDataString);
      const ipfsHash = added.path;

      // Save CID locally
      await fetch("http://localhost:3001/log-cid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: ipfsHash }),
      });

      setIsRegistered(true);

      // ⬇️ ADD this to log on blockchain
      await contract.methods.registerUser(ipfsHash).send({ from: account });
      console.log("✅ User registered successfully on blockchain");

      alert(
        "User registered successfully! Your Secret Key: " + generatedSecretKey
      );
    } catch (error) {
      console.error("Registration error:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-xl font-bold mb-4">Register User</h2>

      <input
        type="text"
        value={attributes}
        onChange={(e) => setAttributes(e.target.value)}
        placeholder="Enter attributes (comma-separated)"
        className="p-2 border rounded w-full mb-4"
      />

      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        className="mb-4 rounded shadow-md"
      />

      <button
        onClick={handleCapture}
        className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
      >
        Register
      </button>

      {isRegistered && (
        <div className="mt-6 p-4 border rounded bg-green-100 text-green-800">
          <h3 className="text-lg font-semibold mb-2">
            Registration Successful!
          </h3>
          <p>
            <strong>Your Secret Key:</strong>
          </p>
          <p className="break-all">{secretKey}</p>
          <p className="text-xs mt-2">
            (Keep this key safe. You'll need it for login.)
          </p>
        </div>
      )}
    </div>
  );
};

export default Register;
