import { useRef, useState, useCallback } from "react";
import { generateHash } from "../utils/hash";

const generateId = () => crypto.randomUUID();

// ── Session States ──────────────────────────────────────────
const STATES = {
  IDLE: "IDLE",
  STAGED: "STAGED",
  WAITING_FOR_PEER: "WAITING_FOR_PEER",
  CONNECTED: "CONNECTED",
  TRANSFERRING: "TRANSFERRING",
  COMPLETED: "COMPLETED",
};

export function useFileTransfer(dataChannelRef, addLog) {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [sessionState, setSessionState] = useState(STATES.IDLE);
  const [transferId, setTransferId] = useState(null);

  const resolveApprovalRef = useRef(null);
  const stagedFilesRef = useRef([]);
  const transferIdRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // ── Stage files (no connection needed) ────────────────────
  const stageFiles = useCallback(
    (files) => {
      if (!files) return;
      const fileArray = Array.from(files).map((file, idx) => ({
        id: `${Date.now()}-${idx}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "staged",
        progress: 0,
        speed: 0,
      }));
      setStagedFiles((prev) => [...prev, ...fileArray]);
      stagedFilesRef.current = [...stagedFilesRef.current, ...fileArray];

      // Generate new transfer ID
      if (!transferIdRef.current) {
        const id = generateId();
        transferIdRef.current = id;
        setTransferId(id);
      }

      setSessionState(STATES.STAGED);
      addLog?.(`${fileArray.length} file(s) staged`);

      // If channel is already open, auto-send manifest
      const ch = dataChannelRef.current;
      if (ch && ch.readyState === "open") {
        setTimeout(() => {
          // Re-read refs since we just updated them
          const manifest = {
            type: "file-list",
            transferId: transferIdRef.current,
            files: stagedFilesRef.current.map((f) => ({
              id: f.id,
              name: f.name,
              size: f.size,
              type: f.type,
            })),
          };
          ch.send(JSON.stringify(manifest));
          setSessionState(STATES.WAITING_FOR_PEER);
          addLog?.(`Manifest auto-sent (${manifest.files.length} files)`);
        }, 200);
      }
    },
    [addLog, dataChannelRef]
  );

  // ── Send manifest ────────────────────────────────────────
  const sendManifest = useCallback(() => {
    const ch = dataChannelRef.current;
    if (!ch || ch.readyState !== "open") return;
    if (stagedFilesRef.current.length === 0) return;

    const manifest = {
      type: "file-list",
      transferId: transferIdRef.current,
      files: stagedFilesRef.current.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
      })),
    };

    ch.send(JSON.stringify(manifest));
    setSessionState(STATES.WAITING_FOR_PEER);
    addLog?.(
      `Manifest sent (${manifest.files.length} files, ${formatSize(
        manifest.files.reduce((a, f) => a + f.size, 0)
      )})`
    );
  }, [dataChannelRef, addLog]);

  // ── Handle manifest response from receiver ───────────────
  const handleManifestResponse = useCallback((data) => {
    if (resolveApprovalRef.current) {
      resolveApprovalRef.current(data);
    }
  }, []);

  // ── Begin transfer (after approval) ──────────────────────
  const beginTransfer = useCallback(
    async (acceptedIds) => {
      const ch = dataChannelRef.current;
      if (!ch || ch.readyState !== "open") {
        addLog?.("Channel not open — cannot transfer.");
        return;
      }

      setSessionState(STATES.TRANSFERRING);

      const filesToSend = stagedFilesRef.current.filter((f) =>
        acceptedIds.includes(f.id)
      );
      const rejectedIds = stagedFilesRef.current
        .filter((f) => !acceptedIds.includes(f.id))
        .map((f) => f.id);

      if (rejectedIds.length > 0) {
        setStagedFiles((prev) =>
          prev.map((f) =>
            rejectedIds.includes(f.id) ? { ...f, status: "rejected" } : f
          )
        );
        addLog?.(`${rejectedIds.length} file(s) declined`);
      }

      addLog?.(`Transferring ${filesToSend.length} file(s)...`);

      for (const sf of filesToSend) {
        setCurrentFile(sf);
        setStagedFiles((prev) =>
          prev.map((f) =>
            f.id === sf.id ? { ...f, status: "sending" } : f
          )
        );

        await sendSingleFile(sf);

        setStagedFiles((prev) =>
          prev.map((f) =>
            f.id === sf.id ? { ...f, status: "complete", progress: 100 } : f
          )
        );
      }

      setCurrentFile(null);
      setSessionState(STATES.COMPLETED);
      addLog?.("All transfers complete.");
    },
    [dataChannelRef, addLog]
  );

  // ── Send a single file (chunked + hashed) ────────────────
  const sendSingleFile = async (stagedFile) => {
    const file = stagedFile.file;
    const CHUNK = 16 * 1024;
    const MAX_BUF = 1_000_000;
    let offset = 0;

    const ch = dataChannelRef.current;
    if (!ch || ch.readyState !== "open") {
      addLog?.(`Skipping ${file.name} — channel closed`);
      return;
    }

    addLog?.(`Hashing: ${file.name}...`);
    const buf = await file.arrayBuffer();
    const hash = await generateHash(buf);
    addLog?.(`SHA-256: ${hash.substring(0, 12)}`);

    ch.send(
      JSON.stringify({
        type: "metadata",
        transferId: transferIdRef.current,
        id: stagedFile.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        hash,
      })
    );

    const t0 = Date.now();

    while (offset < file.size) {
      // Backpressure
      if (ch.bufferedAmount > MAX_BUF) {
        await new Promise((resolve) => {
          const iv = setInterval(() => {
            if (ch.readyState !== "open") {
              clearInterval(iv);
              resolve(true);
              return;
            }
            if (ch.bufferedAmount < MAX_BUF) {
              clearInterval(iv);
              resolve(true);
            }
          }, 50);
        });
      }

      if (ch.readyState !== "open") {
        addLog?.(`Channel closed during ${file.name}`);
        return;
      }

      const chunk = file.slice(offset, offset + CHUNK);
      const ab = await chunk.arrayBuffer();
      ch.send(ab);
      offset += CHUNK;

      const pct = Math.min((offset / file.size) * 100, 100);
      const elapsed = (Date.now() - t0) / 1000;
      const speed = elapsed > 0 ? offset / 1024 / 1024 / elapsed : 0;

      setStagedFiles((prev) =>
        prev.map((f) =>
          f.id === stagedFile.id ? { ...f, progress: pct, speed } : f
        )
      );
    }

    if (ch.readyState === "open") ch.send("EOF");
    addLog?.(`Done: ${file.name}`);
    await new Promise((r) => setTimeout(r, 400));
  };

  // ── Wait for approval → transfer ─────────────────────────
  const waitForApprovalAndSend = useCallback(async () => {
    setSessionState(STATES.WAITING_FOR_PEER);

    const response = await new Promise((resolve) => {
      resolveApprovalRef.current = resolve;
    });
    resolveApprovalRef.current = null;

    if (response.type === "manifest-reject") {
      addLog?.("Receiver declined all files.");
      setSessionState(STATES.CONNECTED);
      return;
    }

    if (response.type === "manifest-accept") {
      await beginTransfer(response.acceptedIds || []);
    }
  }, [addLog, beginTransfer]);

  // ── Reset for new transfer (keeps connection alive) ──────
  const resetTransfer = useCallback(() => {
    setStagedFiles([]);
    setCurrentFile(null);
    stagedFilesRef.current = [];
    const newId = generateId();
    transferIdRef.current = newId;
    setTransferId(newId);
    setSessionState(STATES.CONNECTED);
    resolveApprovalRef.current = null;
    addLog?.("Session reset — ready for new transfer");
  }, [addLog]);

  // ── Get current state snapshot for sync ────────────────
  const getSyncState = useCallback(() => {
    return {
      type: "sync-state",
      sessionState,
      transferId: transferIdRef.current,
      files: stagedFilesRef.current.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        status: f.status,
      })),
    };
  }, [sessionState]);

  const totalStagedSize = stagedFiles.reduce((a, f) => a + f.size, 0);

  return {
    stagedFiles,
    stageFiles,
    sendManifest,
    handleManifestResponse,
    waitForApprovalAndSend,
    currentFile,
    sessionState,
    setSessionState,
    transferId,
    transferPhase: sessionState,
    totalStagedSize,
    formatSize,
    resetTransfer,
    getSyncState,
    STATES,
  };
}
