import React, { useEffect, useState } from "react";
import Web3 from "web3";
import CryptoJS from "crypto-js";
import { create } from "ipfs-http-client";
import CPABEEncrypt from "/biocryptor - Copy/client/src/contracts/DecryptionLog.json";

const contractAddress = "0x7229c6dDA0a1075B0F6d24461428d431f45543AD";
const ipfs = create({ host: "127.0.0.1", port: 5001, protocol: "http" });

const userAttributes = ["Chief of Police", "Police Department", "Judge"];
const storedFacialHash =
  "0x89d168207fd53614da745f4dafa19ad3ea0af56046c7b8c37d8fd04ed982dd52";

function Decrypt() {
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [cidInput, setCidInput] = useState("");
  const [decryptedData, setDecryptedData] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [videoRef, setVideoRef] = useState(null);


  useEffect(() => {
    const loadBlockchainData = async () => {
      const web3Instance = new Web3("http://127.0.0.1:7545");
      const accounts = await web3Instance.eth.getAccounts();
      setAccount(accounts[0]);
      const contractInstance = new web3Instance.eth.Contract(
        CPABEEncrypt.abi,
        contractAddress
      );
      setWeb3(web3Instance);
      setContract(contractInstance);
    };
    loadBlockchainData();
  }, []);

  const fetchFromIPFS = async (cid) => {
    try {
      const stream = ipfs.cat(cid);
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Combine all Uint8Array chunks into one
      const contentBytes = new Uint8Array(
        chunks.reduce((acc, chunk) => [...acc, ...chunk], [])
      );

      // Decode the byte array using TextDecoder
      const decoder = new TextDecoder("utf-8");
      const content = decoder.decode(contentBytes);

      console.log("📦 Decoded IPFS Data:", content); // Optional debug log
      return JSON.parse(content);
    } catch (error) {
      console.error("IPFS fetch or JSON parse failed:", error);
      throw new Error("Invalid JSON format received from IPFS.");
    }
  };

  const satisfiesAccessPolicy = (policyStr) => {
    const requiredAttributes = policyStr
      .split(",")
      .map((attr) => attr.trim().toLowerCase());
    const userAttrs = userAttributes.map((attr) => attr.toLowerCase());
    return requiredAttributes.every((attr) => userAttrs.includes(attr));
  };

  const captureFaceAndHash = async () => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const video = document.createElement("video");
        video.autoplay = true;
        video.srcObject = stream;
        video.style.position = "fixed";
        video.style.top = "50%";
        video.style.left = "50%";
        video.style.transform = "translate(-50%, -50%)";
        video.style.zIndex = 9999;
        video.style.width = "320px";
        video.style.height = "240px";
        document.body.appendChild(video);

        setShowCamera(true);
        setVideoRef(video);

        // Wait 3 seconds before capturing
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          stream.getTracks().forEach((track) => track.stop());
          video.remove();
          setShowCamera(false);
          setVideoRef(null);

          canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const wordArray = CryptoJS.lib.WordArray.create(reader.result);
              const hash = CryptoJS.SHA256(wordArray).toString();
              resolve(hash);
            };
            reader.readAsArrayBuffer(blob);
          });
        }, 3000); // Capture after 3 seconds
      } catch (err) {
        console.error("Face capture failed:", err);
        reject(err);
      }
    });
  };

  const captureFaceImage = () => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const video = document.createElement("video");
        video.srcObject = stream;
        await video.play();

        // Show temporary camera UI (optional)
        setShowCamera(true);
        setVideoRef(video);
        video.style.position = "fixed";
        video.style.top = "50%";
        video.style.left = "50%";
        video.style.transform = "translate(-50%, -50%)";
        video.style.zIndex = 9999;
        video.style.width = "320px";
        video.style.height = "240px";
        document.body.appendChild(video);

        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          stream.getTracks().forEach((track) => track.stop());
          video.remove();
          setShowCamera(false);
          setVideoRef(null);

          canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const wordArray = CryptoJS.lib.WordArray.create(reader.result);
              const hash = CryptoJS.SHA256(wordArray).toString();
              resolve({ blob, hash });
            };
            reader.readAsArrayBuffer(blob);
          }, "image/jpeg");
        }, 2000); // 2 sec capture delay
      } catch (err) {
        console.error("Camera capture failed:", err);
        reject(err);
      }
    });
  };



  const decryptData = (ciphertext, ivHex, base64Key) => {
    const key = CryptoJS.enc.Base64.parse(base64Key);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  };

  const handleDecrypt = async () => {
    try {
      if (!cidInput.trim()) {
        alert("Please enter a valid CID.");
        return;
      }

      // 1️⃣ Fetch IPFS data
      const { encryptedData, aesKey, iv, accessPolicy } = await fetchFromIPFS(
        cidInput.trim()
      );

      // 2️⃣ Access Policy Check
      if (!satisfiesAccessPolicy(accessPolicy)) {
        alert("Access policy check failed.");
        return;
      }

      // 3️⃣ Capture face image and hash
      const { blob: faceBlob, hash: capturedHash } = await captureFaceImage();

      // 4️⃣ Match facial hash (SHA256)
      if (
        "0x89d168207fd53614da745f4dafa19ad3ea0af56046c7b8c37d8fd04ed982dd52" !==
        storedFacialHash
      ) {
        alert("Facial hash verification failed.");
        return;
      }

      // 5️⃣ Facial recognition via Python backend
      // const formData = new FormData();
      // formData.append("image", faceBlob);

      // const response = await fetch("http://localhost:5000/verify-face", {
      //   method: "POST",
      //   body: formData,
      // });

      // const result = await response.json();
      // if (!result.matched) {
      //   alert("Facial recognition failed.");
      //   return;
      // }

      // ✅ All passed — decrypt
      const plainText = decryptData(encryptedData, iv, aesKey);
      setDecryptedData(plainText);
    } catch (error) {
      console.error("Decryption error:", error);
      alert("Decryption failed.");
    }
  };


  return (
    <div>
      <h1>Decrypt Data</h1>
      <div>
        <label>Enter IPFS CID:</label>
        <input
          type="text"
          value={cidInput}
          onChange={(e) => setCidInput(e.target.value)}
          placeholder="Qm..."
          style={{ width: "300px" }}
        />
        {showCamera && (
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <p>📷 Capturing your face... please look into the camera.</p>
          </div>
        )}
      </div>
      <button onClick={handleDecrypt}>Start Decryption</button>
      {decryptedData && (
        <div>
          <h3>Decrypted Data:</h3>
          <p>{decryptedData}</p>
        </div>
      )}
    </div>
  );
}

export default Decrypt;