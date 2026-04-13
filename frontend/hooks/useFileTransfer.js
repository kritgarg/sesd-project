import { useRef, useState } from "react";
import { FileQueue } from "../utils/fileQueue";
import { generateHash } from "../utils/hash";

export function useFileTransfer(dataChannelRef, addLog) {
  const queueRef = useRef(new FileQueue());
  const [currentFile, setCurrentFile] = useState(null);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendSpeedMBps, setSendSpeedMBps] = useState(0);
  const resolveApprovalRef = useRef(null);

  const handleTransferResponse = (type) => {
    if (resolveApprovalRef.current) {
      resolveApprovalRef.current(type);
    }
  };

  const processQueue = async () => {
    if (queueRef.current.isProcessing) return;
    queueRef.current.isProcessing = true;

    while (queueRef.current.hasItems()) {
      const file = queueRef.current.next();
      setCurrentFile(file);
      await sendFile(file);
    }

    queueRef.current.isProcessing = false;
    setCurrentFile(null);
  };

  const sendFile = async (file) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      addLog?.("Channel not open for sending.");
      return;
    }

    const CHUNK_SIZE = 16 * 1024;
    let offset = 0;
    const MAX_BUFFER = 1_000_000;

    addLog?.(`Initiating transfer: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
    channel.send(JSON.stringify({
      type: "transfer-request",
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    }));

    addLog?.(`Awaiting peer approval for ${file.name}...`);
    
    const responseType = await new Promise(resolve => {
       resolveApprovalRef.current = resolve;
    });
    
    resolveApprovalRef.current = null;
    
    if (responseType === "transfer-reject") {
       addLog?.(`❌ Transfer rejected by peer: ${file.name}`);
       return;
    }

    addLog?.(`✅ Transfer accepted! Initiating...`);
    addLog?.(`Computing SHA-256 integrity hash...`);
    
    const fileBuffer = await file.arrayBuffer();
    const hash = await generateHash(fileBuffer);
    addLog?.(`Hash Generated: ${hash.substring(0, 8)}`);

    // send metadata
    channel.send(JSON.stringify({
      type: "metadata",
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hash
    }));

    const sendStartTime = Date.now();

    while (offset < file.size) {
      if (channel.bufferedAmount > MAX_BUFFER) {
         await new Promise((resolve) => {
            const interval = setInterval(() => {
               if (channel.bufferedAmount < MAX_BUFFER) {
                  clearInterval(interval);
                  resolve(true);
               }
            }, 50);
         });
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await chunk.arrayBuffer();

      channel.send(buffer);
      offset += CHUNK_SIZE;

      setSendProgress((offset / file.size) * 100);
      const elapsedSecs = (Date.now() - sendStartTime) / 1000;
      if (elapsedSecs > 0) {
        setSendSpeedMBps((offset / 1024 / 1024) / elapsedSecs);
      }
    }

    channel.send("EOF");
    addLog?.("Transfer complete. Final EOF injected.");
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSendProgress(0);
    setSendSpeedMBps(0);
  };

  const addFiles = (files) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      queueRef.current.add(file);
    });
    processQueue();
  };

  return {
    addFiles,
    sendProgress,
    sendSpeedMBps,
    currentFile,
    queueRaw: queueRef.current.queue,
    handleTransferResponse
  };
}
