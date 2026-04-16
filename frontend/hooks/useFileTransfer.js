import { useRef, useState, useCallback } from "react";
import { generateHash } from "../utils/hash";

export function useFileTransfer(dataChannelRef, addLog) {
  // Staged files (selected but not yet sent)
  const [stagedFiles, setStagedFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileProgressMap, setFileProgressMap] = useState({});
  const [transferPhase, setTransferPhase] = useState("idle");
  // idle | staged | waiting-approval | transferring | complete

  const resolveApprovalRef = useRef(null);
  const stagedFilesRef = useRef([]);

  // Format file size for display
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // Stage files locally (NO sending, NO connection needed)
  const stageFiles = useCallback((files) => {
    if (!files) return;
    const fileArray = Array.from(files).map((file, idx) => ({
      id: `${Date.now()}-${idx}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "staged", // staged | sending | complete | rejected
      progress: 0,
      speed: 0,
    }));
    setStagedFiles((prev) => [...prev, ...fileArray]);
    stagedFilesRef.current = [...stagedFilesRef.current, ...fileArray];
    setTransferPhase("staged");
    addLog?.(`${fileArray.length} file(s) staged for transfer`);
  }, [addLog]);

  // Send manifest to receiver (called when DataChannel opens)
  const sendManifest = useCallback(() => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return;
    if (stagedFilesRef.current.length === 0) return;

    const manifest = {
      type: "file-list",
      files: stagedFilesRef.current.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
      })),
    };

    channel.send(JSON.stringify(manifest));
    setTransferPhase("waiting-approval");
    addLog?.(`Manifest sent: ${manifest.files.length} file(s), ${formatSize(manifest.files.reduce((a, f) => a + f.size, 0))} total`);
  }, [dataChannelRef, addLog]);

  // Handle receiver's approval response
  const handleManifestResponse = useCallback((data) => {
    // data = { type: "manifest-accept", acceptedIds: [...] }
    // or   = { type: "manifest-reject" }
    if (resolveApprovalRef.current) {
      resolveApprovalRef.current(data);
    }
  }, []);

  // Start the actual transfer (called after approval)
  const beginTransfer = useCallback(async (acceptedIds) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      addLog?.("Channel unavailable for transfer.");
      return;
    }

    setTransferPhase("transferring");
    const filesToSend = stagedFilesRef.current.filter((f) =>
      acceptedIds.includes(f.id)
    );

    // Mark rejected files
    const rejectedIds = stagedFilesRef.current
      .filter((f) => !acceptedIds.includes(f.id))
      .map((f) => f.id);

    if (rejectedIds.length > 0) {
      setStagedFiles((prev) =>
        prev.map((f) =>
          rejectedIds.includes(f.id) ? { ...f, status: "rejected" } : f
        )
      );
      addLog?.(`${rejectedIds.length} file(s) declined by receiver`);
    }

    addLog?.(`Starting transfer of ${filesToSend.length} file(s)...`);

    for (const stagedFile of filesToSend) {
      setCurrentFile(stagedFile);
      setStagedFiles((prev) =>
        prev.map((f) =>
          f.id === stagedFile.id ? { ...f, status: "sending" } : f
        )
      );

      await sendSingleFile(stagedFile, channel);

      setStagedFiles((prev) =>
        prev.map((f) =>
          f.id === stagedFile.id
            ? { ...f, status: "complete", progress: 100 }
            : f
        )
      );
    }

    setCurrentFile(null);
    setTransferPhase("complete");
    addLog?.("All transfers complete.");
  }, [dataChannelRef, addLog]);

  // Send a single file with chunking, backpressure, and hash
  const sendSingleFile = async (stagedFile, channel) => {
    const file = stagedFile.file;
    const CHUNK_SIZE = 16 * 1024;
    const MAX_BUFFER = 1_000_000;
    let offset = 0;

    // Always re-read channel from ref in case the passed one is stale
    const ch = dataChannelRef.current;
    if (!ch || ch.readyState !== "open") {
      addLog?.(`Channel not open — skipping ${file.name}`);
      return;
    }

    addLog?.(`Hashing: ${file.name}...`);
    const fileBuffer = await file.arrayBuffer();
    const hash = await generateHash(fileBuffer);
    addLog?.(`SHA-256: ${hash.substring(0, 12)}...`);

    // Send metadata (receiver needs this for reassembly)
    ch.send(
      JSON.stringify({
        type: "metadata",
        id: stagedFile.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        hash,
      })
    );

    const startTime = Date.now();

    while (offset < file.size) {
      if (ch.bufferedAmount > MAX_BUFFER) {
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            if (ch.readyState !== "open") {
              clearInterval(interval);
              resolve(true);
              return;
            }
            if (ch.bufferedAmount < MAX_BUFFER) {
              clearInterval(interval);
              resolve(true);
            }
          }, 50);
        });
      }

      if (ch.readyState !== "open") {
        addLog?.(`Channel closed during transfer of ${file.name}`);
        return;
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await chunk.arrayBuffer();
      ch.send(buffer);
      offset += CHUNK_SIZE;

      const pct = Math.min((offset / file.size) * 100, 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? offset / 1024 / 1024 / elapsed : 0;

      // Update per-file progress
      setFileProgressMap((prev) => ({
        ...prev,
        [stagedFile.id]: { progress: pct, speed },
      }));

      setStagedFiles((prev) =>
        prev.map((f) =>
          f.id === stagedFile.id ? { ...f, progress: pct, speed } : f
        )
      );
    }

    if (ch.readyState === "open") ch.send("EOF");
    addLog?.(`Transfer complete: ${file.name}`);
    await new Promise((r) => setTimeout(r, 500));
  };

  // Orchestrator: waits for approval then sends
  const waitForApprovalAndSend = useCallback(async () => {
    setTransferPhase("waiting-approval");

    const response = await new Promise((resolve) => {
      resolveApprovalRef.current = resolve;
    });
    resolveApprovalRef.current = null;

    if (response.type === "manifest-reject") {
      addLog?.("Receiver declined all files.");
      setTransferPhase("idle");
      return;
    }

    if (response.type === "manifest-accept") {
      await beginTransfer(response.acceptedIds || []);
    }
  }, [addLog, beginTransfer]);

  // Get total size of staged files
  const totalStagedSize = stagedFiles.reduce((a, f) => a + f.size, 0);

  return {
    stagedFiles,
    stageFiles,
    sendManifest,
    handleManifestResponse,
    waitForApprovalAndSend,
    currentFile,
    fileProgressMap,
    transferPhase,
    totalStagedSize,
    formatSize,
  };
}
