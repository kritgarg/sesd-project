import { useRef, useState, useCallback } from "react";
import { generateHash } from "../utils/hash";

/**
 * Handles the receiver side of file transfers:
 * chunk accumulation, SHA-256 verification, and auto-download.
 */
export function useFileReceiver(addLog) {
  const receivedChunksRef = useRef([]);
  const fileMetaRef = useRef(null);
  const receivedSizeRef = useRef(0);
  const receiveStartTimeRef = useRef(0);

  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [fileName, setFileName] = useState("");

  const reset = useCallback(() => {
    receivedChunksRef.current = [];
    fileMetaRef.current = null;
    receivedSizeRef.current = 0;
    receiveStartTimeRef.current = 0;
    setProgress(0);
    setSpeed(0);
    setFileName("");
  }, []);

  /** Called when a "metadata" message arrives */
  const setMeta = useCallback((data) => {
    fileMetaRef.current = data;
    setFileName(data.fileName);
    addLog?.(`Receiving: ${data.fileName}`);
  }, [addLog]);

  /** Called for each binary chunk */
  const addChunk = useCallback((data) => {
    if (receiveStartTimeRef.current === 0) {
      receiveStartTimeRef.current = Date.now();
    }

    receivedChunksRef.current.push(data);
    receivedSizeRef.current += data.byteLength;

    if (fileMetaRef.current?.fileSize) {
      setProgress(
        (receivedSizeRef.current / fileMetaRef.current.fileSize) * 100
      );
    }

    const elapsed = (Date.now() - receiveStartTimeRef.current) / 1000;
    if (elapsed > 0) {
      setSpeed(receivedSizeRef.current / 1024 / 1024 / elapsed);
    }
  }, []);

  /** Called on EOF — verifies integrity and triggers download */
  const finalizeAndDownload = useCallback(async () => {
    addLog?.("EOF — verifying integrity...");

    const totalLen = receivedChunksRef.current.reduce(
      (a, c) => a + c.byteLength,
      0
    );
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const c of receivedChunksRef.current) {
      merged.set(new Uint8Array(c), off);
      off += c.byteLength;
    }

    const hash = await generateHash(merged);

    if (fileMetaRef.current?.hash && hash !== fileMetaRef.current.hash) {
      addLog?.("❌ SHA-256 mismatch");
      reset();
      return;
    }

    addLog?.(`✅ Verified (${hash.substring(0, 12)})`);

    const blob = new Blob([merged], {
      type: fileMetaRef.current?.fileType || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileMetaRef.current?.fileName || "swiftshare_file";
    a.click();
    URL.revokeObjectURL(url);

    addLog?.(`Downloaded: ${fileMetaRef.current?.fileName}`);
    reset();
  }, [addLog, reset]);

  return {
    recvProgress: progress,
    recvSpeed: speed,
    recvFileName: fileName,
    setMeta,
    addChunk,
    finalizeAndDownload,
    resetReceiver: reset,
  };
}
