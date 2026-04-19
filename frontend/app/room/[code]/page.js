"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWebRTC } from "../../../hooks/useWebRTC";
import { useFileTransfer } from "../../../hooks/useFileTransfer";
import { useFileReceiver } from "../../../hooks/useFileReceiver";
import { useToast, ToastContainer } from "../../../components/Room/Toast";
import Confetti from "../../../components/Room/Confetti";
import { motion, AnimatePresence } from "framer-motion";
import SenderView from "../../../components/Room/SenderView";
import ReceiverView from "../../../components/Room/ReceiverView";
import TransferRequest from "../../../components/Room/TransferRequest";

export default function RoomPage() {
  const { code } = useParams();
  const [roomUrl, setRoomUrl] = useState("");
  const [incomingManifest, setIncomingManifest] = useState(null);
  const [showConfetti, setShowConfetti] = useState(0);
  const lastTransferIdRef = useRef(null);
  const prevSessionStateRef = useRef(null);

  // ── Toast ─────────────────────────────────────────────────
  const { toasts, addToast, removeToast } = useToast();

  // Stable logger
  const logsRef = useRef([]);
  const addLog = useCallback((msg) => {
    const entry = `${new Date().toLocaleTimeString()} — ${msg}`;
    logsRef.current = [...logsRef.current, entry];
  }, []);

  // ── Hooks ─────────────────────────────────────────────────
  const {
    dataChannelRef,
    status,
    isChannelReady,
    role,
    setRole,
    onChannelOpenRef,
    onChannelMessageRef,
  } = useWebRTC(code, addLog);

  const {
    stagedFiles,
    stageFiles,
    sendManifest,
    handleManifestResponse,
    waitForApprovalAndSend,
    currentFile,
    sessionState,
    resetTransfer,
    getSyncState,
    STATES,
  } = useFileTransfer(dataChannelRef, addLog);

  const {
    recvProgress,
    recvSpeed,
    recvFileName,
    setMeta,
    addChunk,
    finalizeAndDownload,
  } = useFileReceiver(addLog);

  // ── Refs for channel callbacks ────────────────────────────
  const roleRef = useRef(role);
  const stagedFilesRef = useRef(stagedFiles);
  const sessionStateRef = useRef(sessionState);
  const sendManifestRef = useRef(sendManifest);
  const waitForApprovalRef = useRef(waitForApprovalAndSend);
  const handleManifestResponseRef = useRef(handleManifestResponse);
  const getSyncStateRef = useRef(getSyncState);
  const resetTransferRef = useRef(resetTransfer);

  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { stagedFilesRef.current = stagedFiles; }, [stagedFiles]);
  useEffect(() => { sessionStateRef.current = sessionState; }, [sessionState]);
  useEffect(() => { sendManifestRef.current = sendManifest; }, [sendManifest]);
  useEffect(() => { waitForApprovalRef.current = waitForApprovalAndSend; }, [waitForApprovalAndSend]);
  useEffect(() => { handleManifestResponseRef.current = handleManifestResponse; }, [handleManifestResponse]);
  useEffect(() => { getSyncStateRef.current = getSyncState; }, [getSyncState]);
  useEffect(() => { resetTransferRef.current = resetTransfer; }, [resetTransfer]);

  // ── Build room URL ────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRoomUrl(`${window.location.origin}/room/${code}`);
    }
  }, [code]);

  // ── Pick up files from landing page ───────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && window.__swiftshare_files) {
      stageFiles(window.__swiftshare_files);
      setRole("sender");
      sessionStorage.setItem(`swiftshare_role_${code}`, "sender");
      window.__swiftshare_files = null;
    }
  }, [stageFiles, setRole, code]);

  // ── Auto-trigger manifest sending when ready ─────────────
  useEffect(() => {
    if (
      isChannelReady &&
      stagedFiles.length > 0 &&
      (sessionState === STATES.WAITING_FOR_PEER || sessionState === STATES.STAGED)
    ) {
      addLog("Connection ready — sending manifest...");
      sendManifest();
      waitForApprovalAndSend();
    }
  }, [
    isChannelReady,
    stagedFiles.length,
    sessionState,
    role,
    sendManifest,
    waitForApprovalAndSend,
    addLog
  ]);

  // ── Toast on state transitions ────────────────────────────
  useEffect(() => {
    const prev = prevSessionStateRef.current;
    prevSessionStateRef.current = sessionState;
    if (!prev) return;

    if (sessionState === STATES.COMPLETED && prev === STATES.TRANSFERRING) {
      addToast("All files sent successfully!", "success");
      setShowConfetti((c) => c + 1);
    }
  }, [sessionState, STATES, addToast]);

  // ── Toast on genuine errors (ignore transient disconnects) ──
  const lastToastedRef = useRef("");
  useEffect(() => {
    if (status.includes("❌")) {
      // Ignore normal lifecycle disconnections from toasting as scary red errors
      if (status.includes("Disconnected") || status.includes("Peer left") || status.includes("Peer disconnected")) {
        return;
      }
      
      if (lastToastedRef.current !== status) {
        addToast(status, "error", 5000);
        lastToastedRef.current = status;
      }
    } else {
      lastToastedRef.current = "";
    }
  }, [status, addToast]);

  // ── Channel open handler ──────────────────────────────────
  onChannelOpenRef.current = (channel) => {
    const isSender =
      roleRef.current === "sender" || stagedFilesRef.current.length > 0;

    if (!isSender) {
      setTimeout(() => {
        if (channel.readyState === "open") {
          channel.send(JSON.stringify({ type: "request-sync" }));
        }
      }, 500);
    }
  };

  // ── Channel message handler ───────────────────────────────
  onChannelMessageRef.current = async (event, channel) => {
    if (typeof event.data === "string") {
      if (event.data === "EOF") {
        await finalizeAndDownload();
        addToast("File received!", "success");
        setShowConfetti((c) => c + 1);
        return;
      }

      try {
        const data = JSON.parse(event.data);

        if (data.type === "request-sync") {
          if (sessionStateRef.current === "COMPLETED") {
            resetTransferRef.current();
          }
          setTimeout(() => {
            const state = getSyncStateRef.current();
            if (channel.readyState === "open") {
              channel.send(JSON.stringify(state));
            }
          }, 100);
          return;
        }

        if (data.type === "sync-state") {
          setRole("receiver");
          if (
            data.sessionState === "WAITING_FOR_PEER" &&
            data.files?.length > 0
          ) {
            lastTransferIdRef.current = data.transferId;
            setIncomingManifest({
              type: "file-list",
              transferId: data.transferId,
              files: data.files,
            });
          }
          return;
        }

        if (data.type === "file-list") {
          if (
            data.transferId &&
            data.transferId === lastTransferIdRef.current
          ) return;
          lastTransferIdRef.current = data.transferId;
          setRole("receiver");
          setIncomingManifest(data);
          return;
        }

        if (
          data.type === "manifest-accept" ||
          data.type === "manifest-reject"
        ) {
          handleManifestResponseRef.current(data);
          if (data.type === "manifest-reject") {
            addToast("Receiver declined the files", "error");
          }
          return;
        }

        if (data.type === "metadata") {
          setMeta(data);
          return;
        }
      } catch {}
    } else {
      addChunk(event.data);
    }
  };

  // ── Manifest handlers ─────────────────────────────────────
  const handleManifestAccept = (acceptedIds) => {
    const ch = dataChannelRef.current;
    if (ch?.readyState === "open") {
      ch.send(JSON.stringify({ type: "manifest-accept", acceptedIds }));
    }
    addToast(`Accepted ${acceptedIds.length} file(s)`, "success", 2000);
    setIncomingManifest(null);
  };

  const handleManifestReject = () => {
    const ch = dataChannelRef.current;
    if (ch?.readyState === "open") {
      ch.send(JSON.stringify({ type: "manifest-reject" }));
    }
    addToast("Files declined", "info", 2000);
    setIncomingManifest(null);
  };

  // ── Derived ───────────────────────────────────────────────
  const isConnected = isChannelReady || status === "Peer connected";
  const isSender = role === "sender" || stagedFiles.length > 0;

  const getStatusMessage = () => {
    if (sessionState === STATES.COMPLETED) return "Transfer complete ✓";
    if (sessionState === STATES.TRANSFERRING) return "Transferring...";
    if (sessionState === STATES.WAITING_FOR_PEER)
      return "Waiting for approval...";
    if (
      sessionState === STATES.CONNECTED &&
      stagedFiles.length > 0 &&
      stagedFiles.every((f) => f.status === "rejected")
    )
      return "Files declined — select new files";
    if (recvProgress > 0 && recvProgress < 100)
      return `Receiving: ${recvFileName}`;
    if (isChannelReady) return "Peer connected";
    return status;
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121210] relative px-6 w-full font-oswald overflow-hidden">
      {/* Background blobs matching theme */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 100% 10%, transparent 60%, rgba(255, 230, 0, 1) 61%, transparent 62%), radial-gradient(circle at 0% 80%, transparent 40%, rgba(255, 230, 0, 1) 41%, transparent 42%)', backgroundSize: '100% 100%, 100% 100%' }} />

      <div className="z-10 w-full flex flex-col items-center">
        <AnimatePresence mode="wait">
          {isSender ? (
            <motion.div
              key="sender"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SenderView
                code={code}
                roomUrl={roomUrl}
                sessionState={sessionState}
                STATES={STATES}
                stagedFiles={stagedFiles}
                currentFile={currentFile}
                stageFiles={stageFiles}
                isConnected={isConnected}
                statusMessage={getStatusMessage()}
                status={status}
                onToast={addToast}
              />
            </motion.div>
          ) : (
            <motion.div
              key="receiver"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ReceiverView
                code={code}
                isConnected={isConnected}
                status={status}
                recvProgress={recvProgress}
                recvSpeed={recvSpeed}
                recvFileName={recvFileName}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {incomingManifest && (
          <TransferRequest
            key={incomingManifest.transferId}
            manifest={incomingManifest}
            onAccept={handleManifestAccept}
            onReject={handleManifestReject}
          />
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <Confetti trigger={showConfetti} />
    </div>
  );
}
