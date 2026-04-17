"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { generateHash } from "../../../utils/hash";
import { useFileTransfer } from "../../../hooks/useFileTransfer";
import FileQueueUI from "../../../components/Room/FileQueueUI";
import TransferRequest from "../../../components/Room/TransferRequest";

export default function RoomPage() {
  const { code } = useParams();
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);

  const [status, setStatus] = useState("Connecting...");
  const [logs, setLogs] = useState([]);
  const [isChannelReady, setIsChannelReady] = useState(false);
  const [roomUrl, setRoomUrl] = useState("");
  const [incomingManifest, setIncomingManifest] = useState(null);
  const [role, setRole] = useState(null); // "sender" | "receiver"

  // Receiver state
  const receivedChunksRef = useRef([]);
  const fileMetaRef = useRef(null);
  const receivedSizeRef = useRef(0);
  const receiveStartTimeRef = useRef(0);
  const [recvProgress, setRecvProgress] = useState(0);
  const [recvSpeed, setRecvSpeed] = useState(0);
  const [recvFileName, setRecvFileName] = useState("");
  const lastTransferIdRef = useRef(null);

  // Stable log function
  const logsRef = useRef([]);
  const addLog = useCallback((msg) => {
    const entry = `${new Date().toLocaleTimeString()} — ${msg}`;
    logsRef.current = [...logsRef.current, entry];
    setLogs([...logsRef.current]);
  }, []);

  const {
    stagedFiles,
    stageFiles,
    sendManifest,
    handleManifestResponse,
    waitForApprovalAndSend,
    currentFile,
    sessionState,
    setSessionState,
    transferId,
    totalStagedSize,
    formatSize,
    resetTransfer,
    getSyncState,
    STATES,
  } = useFileTransfer(dataChannelRef, addLog);

  // ── Refs for values channel handler needs ─────────────────
  const roleRef = useRef(role);
  const sendManifestRef = useRef(sendManifest);
  const waitForApprovalRef = useRef(waitForApprovalAndSend);
  const handleManifestResponseRef = useRef(handleManifestResponse);
  const getSyncStateRef = useRef(getSyncState);
  const stagedFilesRef = useRef(stagedFiles);
  const sessionStateRef = useRef(sessionState);
  const resetTransferRef = useRef(resetTransfer);

  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { sendManifestRef.current = sendManifest; }, [sendManifest]);
  useEffect(() => { waitForApprovalRef.current = waitForApprovalAndSend; }, [waitForApprovalAndSend]);
  useEffect(() => { handleManifestResponseRef.current = handleManifestResponse; }, [handleManifestResponse]);
  useEffect(() => { getSyncStateRef.current = getSyncState; }, [getSyncState]);
  useEffect(() => { stagedFilesRef.current = stagedFiles; }, [stagedFiles]);
  useEffect(() => { sessionStateRef.current = sessionState; }, [sessionState]);
  useEffect(() => { resetTransferRef.current = resetTransfer; }, [resetTransfer]);

  // Build room URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRoomUrl(`${window.location.origin}/room/${code}`);
    }
  }, [code]);

  // Pick up files from the landing page
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Restore role from sessionStorage
      const storedRole = sessionStorage.getItem(`swiftshare_role_${code}`);
      if (storedRole === "sender" || storedRole === "receiver") {
        setRole(storedRole);
      }

      // Pick up staged files
      if (window.__swiftshare_files) {
        stageFiles(window.__swiftshare_files);
        setRole("sender");
        sessionStorage.setItem(`swiftshare_role_${code}`, "sender");
        window.__swiftshare_files = null;
      }
    }
  }, [stageFiles, code]);

  // Auto-trigger approval wait when manifest is sent from stageFiles
  useEffect(() => {
    if (
      sessionState === STATES.WAITING_FOR_PEER &&
      isChannelReady &&
      role === "sender"
    ) {
      waitForApprovalAndSend();
    }
  }, [sessionState, isChannelReady, role, waitForApprovalAndSend, STATES]);

  // ── Receiver: reset helper ────────────────────────────────
  const resetReceiverState = useCallback(() => {
    receivedChunksRef.current = [];
    fileMetaRef.current = null;
    receivedSizeRef.current = 0;
    receiveStartTimeRef.current = 0;
    setRecvProgress(0);
    setRecvSpeed(0);
    setRecvFileName("");
  }, []);

  // ── DataChannel setup (stable — only depends on addLog) ──
  const setupDataChannel = useCallback(
    (channel) => {
      channel.binaryType = "arraybuffer";

      channel.onopen = () => {
        addLog("DataChannel open");
        setIsChannelReady(true);

        const isSender =
          roleRef.current === "sender" ||
          stagedFilesRef.current.length > 0;

        const state = sessionStateRef.current;

        // Sender: only auto-send manifest if we're in STAGED or WAITING_FOR_PEER
        // NOT if COMPLETED (old transfer is done)
        if (isSender && state !== "COMPLETED" && state !== "CONNECTED" && state !== "IDLE") {
          setTimeout(() => {
            sendManifestRef.current();
            waitForApprovalRef.current();
          }, 300);
        } else if (!isSender) {
          // Receiver: request state sync from sender
          setTimeout(() => {
            if (channel.readyState === "open") {
              channel.send(JSON.stringify({ type: "request-sync" }));
              addLog("Requesting session sync...");
            }
          }, 500);
        }
      };

      channel.onclose = () => {
        addLog("DataChannel closed");
        setIsChannelReady(false);
      };

      channel.onerror = (err) => {
        addLog(`DataChannel error: ${err.message || "unknown"}`);
      };

      channel.onmessage = async (event) => {
        if (typeof event.data === "string") {
          if (event.data === "EOF") {
            addLog("EOF — verifying integrity...");

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

            if (
              fileMetaRef.current?.hash &&
              hash !== fileMetaRef.current.hash
            ) {
              addLog("❌ SHA-256 mismatch");
              resetReceiverState();
              return;
            }

            addLog(`✅ Verified (${hash.substring(0, 12)})`);

            const blob = new Blob([merged], {
              type:
                fileMetaRef.current?.fileType ||
                "application/octet-stream",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download =
              fileMetaRef.current?.fileName || "swiftshare_file";
            a.click();
            URL.revokeObjectURL(url);

            addLog(`Downloaded: ${fileMetaRef.current?.fileName}`);
            resetReceiverState();
            return;
          }

          try {
            const data = JSON.parse(event.data);

            // ── Sync: receiver asks sender for state ───
            if (data.type === "request-sync") {
              addLog("Peer requested sync");

              // If transfer is already completed, auto-reset to
              // let the sender see "Send more files" instead of
              // being stuck in WAITING_FOR_PEER
              const curState = sessionStateRef.current;
              if (curState === "COMPLETED") {
                addLog("Transfer was completed — resetting for new session");
                resetTransferRef.current();
              }

              // Small delay so resetTransfer state propagates to getSyncState
              setTimeout(() => {
                const state = getSyncStateRef.current();
                if (channel.readyState === "open") {
                  channel.send(JSON.stringify(state));
                  addLog(`Sync sent (state: ${state.sessionState})`);
                }
              }, 100);
              return;
            }

            // ── Sync: receiver gets state from sender ──
            if (data.type === "sync-state") {
              addLog(`Sync received (state: ${data.sessionState})`);
              setRole("receiver");

              // If sender is waiting for approval, re-show the manifest
              if (
                data.sessionState === "WAITING_FOR_PEER" &&
                data.files &&
                data.files.length > 0
              ) {
                lastTransferIdRef.current = data.transferId;
                setIncomingManifest({
                  type: "file-list",
                  transferId: data.transferId,
                  files: data.files,
                });
                addLog("Re-showing file approval dialog");
              }
              return;
            }

            // ── File manifest ──────────────────────────
            if (data.type === "file-list") {
              // Duplicate check
              if (
                data.transferId &&
                data.transferId === lastTransferIdRef.current
              ) {
                addLog("Duplicate manifest — ignoring");
                return;
              }
              lastTransferIdRef.current = data.transferId;

              addLog(
                `Manifest: ${data.files.length} file(s)`
              );
              setRole("receiver");
              setIncomingManifest(data);
              return;
            }

            // ── Manifest response (for sender) ─────────
            if (
              data.type === "manifest-accept" ||
              data.type === "manifest-reject"
            ) {
              handleManifestResponseRef.current(data);
              return;
            }

            // ── File metadata ──────────────────────────
            if (data.type === "metadata") {
              fileMetaRef.current = data;
              setRecvFileName(data.fileName);
              addLog(`Receiving: ${data.fileName}`);
              return;
            }
          } catch {}
        } else {
          // Binary chunk
          if (receiveStartTimeRef.current === 0)
            receiveStartTimeRef.current = Date.now();

          receivedChunksRef.current.push(event.data);
          receivedSizeRef.current += event.data.byteLength;

          if (fileMetaRef.current?.fileSize) {
            setRecvProgress(
              (receivedSizeRef.current /
                fileMetaRef.current.fileSize) *
                100
            );
          }

          const elapsed =
            (Date.now() - receiveStartTimeRef.current) / 1000;
          if (elapsed > 0) {
            setRecvSpeed(
              receivedSizeRef.current / 1024 / 1024 / elapsed
            );
          }
        }
      };
    },
    [addLog, resetReceiverState]
  );

  // ── WebSocket + WebRTC (runs ONCE per code) ──────────────
  useEffect(() => {
    if (!code) return;

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5001";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog("Signaling connected");
      ws.send(JSON.stringify({ type: "join-room", roomCode: code }));
    };

    ws.onerror = () => {
      setStatus("Connection error ❌");
      addLog("WebSocket error");
    };

    ws.onclose = () => {
      setStatus("Disconnected ❌");
      addLog("WebSocket closed");
    };

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.ondatachannel = (event) => {
      addLog("DataChannel received");
      dataChannelRef.current = event.channel;
      setupDataChannel(event.channel);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "ice-candidate",
            roomCode: code,
            payload: event.candidate,
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      addLog(`RTC: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        setStatus("Peer connected");
      } else if (pc.connectionState === "failed") {
        setStatus("Connection failed ❌");
        addLog("WebRTC connection failed");
      } else if (pc.connectionState === "disconnected") {
        setStatus("Peer disconnected ❌");
      }
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);

      if (data.error) {
        addLog(`Error: ${data.error}`);
        setStatus(data.error);
        return;
      }

      // ── Role assigned by server ──────────────────────
      if (data.type === "role-assigned") {
        addLog(`Server role: ${data.role}`);
        // Only use server role if we don't have a persisted one
        const storedRole = sessionStorage.getItem(`swiftshare_role_${code}`);
        if (!storedRole) {
          setRole(data.role);
          sessionStorage.setItem(`swiftshare_role_${code}`, data.role);
        }
        if (data.role === "sender" || storedRole === "sender") {
          setStatus("Waiting for receiver...");
        } else {
          setStatus("Connected — waiting for files...");
        }
        return;
      }

      // ── Room full ────────────────────────────────────
      if (data.type === "room-full") {
        setStatus("Room is full ❌");
        addLog("Room has 2 users already");
        return;
      }

      // ── Peer disconnected ────────────────────────────
      if (data.type === "peer-disconnected") {
        setStatus("Peer left ❌");
        setIsChannelReady(false);
        addLog("Peer disconnected");
        return;
      }

      // ── Peer joined → ONLY sender creates offer ─────
      if (data.type === "peer-joined") {
        setStatus("Peer joined — connecting...");

        // Only the first peer (sender) creates the offer
        const channel = pc.createDataChannel("file");
        dataChannelRef.current = channel;
        setupDataChannel(channel);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(
          JSON.stringify({
            type: "offer",
            roomCode: code,
            payload: offer,
          })
        );
        return;
      }

      if (data.type === "offer") {
        setStatus("Connecting...");
        await pc.setRemoteDescription(data.payload);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(
          JSON.stringify({
            type: "answer",
            roomCode: code,
            payload: answer,
          })
        );
        return;
      }

      if (data.type === "answer") {
        await pc.setRemoteDescription(data.payload);
        return;
      }

      if (data.type === "ice-candidate") {
        await pc.addIceCandidate(data.payload);
        return;
      }
    };

    return () => {
      ws.close();
      pc.close();
    };
  }, [code, addLog, setupDataChannel]);

  // ── Manifest handlers ────────────────────────────────────
  const handleManifestAccept = (acceptedIds) => {
    const ch = dataChannelRef.current;
    if (ch && ch.readyState === "open") {
      ch.send(
        JSON.stringify({ type: "manifest-accept", acceptedIds })
      );
    }
    addLog(`Accepted ${acceptedIds.length} file(s)`);
    setIncomingManifest(null);
  };

  const handleManifestReject = () => {
    const ch = dataChannelRef.current;
    if (ch && ch.readyState === "open") {
      ch.send(JSON.stringify({ type: "manifest-reject" }));
    }
    addLog("Declined all files");
    setIncomingManifest(null);
  };

  // ── Send Again (reset + re-stage) ────────────────────────
  const handleSendAgain = () => {
    resetTransfer();
    addLog("Ready for new transfer");
  };

  // ── Status message ───────────────────────────────────────
  const getStatusMessage = () => {
    if (sessionState === STATES.COMPLETED) return "Transfer complete ✓";
    if (sessionState === STATES.TRANSFERRING) return "Transferring...";
    if (sessionState === STATES.WAITING_FOR_PEER)
      return "Waiting for approval...";
    if (recvProgress > 0 && recvProgress < 100)
      return `Receiving: ${recvFileName}`;
    if (isChannelReady) return "Peer connected";
    return status;
  };

  const isConnected = isChannelReady || status === "Peer connected";
  const isSender = role === "sender" || stagedFiles.length > 0;
  const showReceiverProgress = role === "receiver" && recvProgress > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f7] relative px-6">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>

      <div className="z-10 w-full flex flex-col items-center">
        {/* ── SENDER VIEW ─────────────────────────────── */}
        {isSender && (
          <div className="bg-white rounded-2xl p-8 shadow-sm w-[380px] text-center border border-[rgba(0,0,0,0.06)] hover:shadow-md transition-all duration-300">
            <h2 className="text-lg font-semibold mb-1 text-[#0a0a0a]">
              {sessionState === STATES.COMPLETED
                ? "Transfer complete"
                : "Your link is ready"}
            </h2>
            <p className="text-xs text-[#6b6b6b] mb-6">
              {sessionState === STATES.COMPLETED
                ? "All files sent successfully"
                : "Share this link to start transfer"}
            </p>

            {sessionState !== STATES.COMPLETED && (
              <>
                <div className="flex justify-center mb-6">
                  <QRCodeCanvas
                    value={roomUrl || code}
                    size={140}
                    bgColor="#ffffff"
                    fgColor="#111111"
                  />
                </div>

                <div className="bg-[#f7f7f7] p-3 rounded-lg text-xs mb-4 text-[#6b6b6b] font-mono break-all border border-[rgba(0,0,0,0.06)]">
                  {roomUrl || code}
                </div>

                <button
                  onClick={() =>
                    navigator.clipboard.writeText(roomUrl || code)
                  }
                  className="bg-[#111111] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 w-full mb-4"
                >
                  Copy Link
                </button>
              </>
            )}

            <FileQueueUI
              stagedFiles={stagedFiles}
              currentFile={currentFile}
            />

            {/* Send Again / Select Files when no files staged */}
            {(sessionState === STATES.COMPLETED || 
              (sessionState === STATES.CONNECTED && stagedFiles.length === 0)) && (
              <>
                <p className="text-sm text-[#6b6b6b] mt-4 mb-3">
                  Select files to send
                </p>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  id="senderFileInput"
                  onChange={(e) => {
                    stageFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor="senderFileInput"
                  className="w-full inline-block cursor-pointer bg-[#111111] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 text-center"
                >
                  Select Files
                </label>
              </>
            )}

            <p className="text-xs text-[#6b6b6b] mt-6 flex justify-center items-center gap-2 pt-4 border-t border-[rgba(0,0,0,0.06)]">
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  isConnected
                    ? "bg-green-500"
                    : status.includes("❌")
                    ? "bg-red-500"
                    : "bg-yellow-500 animate-pulse"
                }`}
              ></span>
              {getStatusMessage()}
            </p>
          </div>
        )}

        {/* ── RECEIVER VIEW ───────────────────────────── */}
        {!isSender && !showReceiverProgress && (
          <div className="bg-white rounded-2xl p-8 shadow-sm w-[360px] text-center border border-[rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-semibold mb-2 text-[#0a0a0a]">
              SwiftShare
            </h2>
            <p className="text-sm text-[#6b6b6b] mb-1">
              Room:{" "}
              <span className="font-mono text-[#0a0a0a]">{code}</span>
            </p>
            <p className="text-xs text-[#6b6b6b] mt-4 flex justify-center items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  isConnected
                    ? "bg-green-500"
                    : status.includes("❌")
                    ? "bg-red-500"
                    : "bg-yellow-500 animate-pulse"
                }`}
              ></span>
              {isConnected
                ? "Connected — waiting for files..."
                : status}
            </p>
          </div>
        )}

        {/* ── RECEIVER DOWNLOAD PROGRESS ──────────────── */}
        {showReceiverProgress && (
          <div className="bg-white rounded-2xl p-8 shadow-sm w-[360px] text-center border border-[rgba(0,0,0,0.06)]">
            <p className="text-sm text-[#6b6b6b] mb-2">Receiving</p>
            <h2 className="text-lg font-semibold text-[#0a0a0a] mb-1 truncate">
              {recvFileName}
            </h2>
            <p className="text-xs text-[#6b6b6b] mb-4">
              {recvProgress.toFixed(0)}% · {recvSpeed.toFixed(1)} MB/s
            </p>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-[rgba(0,0,0,0.06)]">
              <div
                className="bg-[#111111] h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(recvProgress, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        )}
      </div>

      <TransferRequest
        manifest={incomingManifest}
        onAccept={handleManifestAccept}
        onReject={handleManifestReject}
      />
    </div>
  );
}
