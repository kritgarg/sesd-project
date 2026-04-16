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

  // Stable log function using ref to avoid dependency issues
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
    transferPhase,
    totalStagedSize,
    formatSize,
  } = useFileTransfer(dataChannelRef, addLog);

  // Keep refs for values the channel handler needs (avoids stale closures)
  const roleRef = useRef(role);
  const sendManifestRef = useRef(sendManifest);
  const waitForApprovalRef = useRef(waitForApprovalAndSend);
  const handleManifestResponseRef = useRef(handleManifestResponse);
  const stagedFilesRef = useRef(stagedFiles);

  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { sendManifestRef.current = sendManifest; }, [sendManifest]);
  useEffect(() => { waitForApprovalRef.current = waitForApprovalAndSend; }, [waitForApprovalAndSend]);
  useEffect(() => { handleManifestResponseRef.current = handleManifestResponse; }, [handleManifestResponse]);
  useEffect(() => { stagedFilesRef.current = stagedFiles; }, [stagedFiles]);

  // Build room URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRoomUrl(`${window.location.origin}/room/${code}`);
    }
  }, [code]);

  // Pick up files from the landing page
  useEffect(() => {
    if (typeof window !== "undefined" && window.__swiftshare_files) {
      const files = window.__swiftshare_files;
      stageFiles(files);
      setRole("sender");
      window.__swiftshare_files = null;
    }
  }, [stageFiles]);

  // ── DataChannel setup (uses REFS only — no reactive deps) ────
  const setupDataChannel = useCallback((channel) => {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      addLog("DataChannel open — ready for transfers");
      setIsChannelReady(true);

      // If sender has staged files, send manifest after a short delay
      if (roleRef.current === "sender" || stagedFilesRef.current.length > 0) {
        setTimeout(() => {
          sendManifestRef.current();
          waitForApprovalRef.current();
        }, 300);
      }
    };

    channel.onclose = () => {
      addLog("DataChannel closed");
      setIsChannelReady(false);
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === "string") {
        // EOF → assemble and verify file
        if (event.data === "EOF") {
          addLog("EOF received — verifying integrity...");

          const totalLength = receivedChunksRef.current.reduce(
            (acc, curr) => acc + curr.byteLength, 0
          );
          const merged = new Uint8Array(totalLength);
          let off = 0;
          for (const chunk of receivedChunksRef.current) {
            merged.set(new Uint8Array(chunk), off);
            off += chunk.byteLength;
          }

          const receivedHash = await generateHash(merged);

          if (fileMetaRef.current?.hash && receivedHash !== fileMetaRef.current.hash) {
            addLog("❌ SHA-256 mismatch — file corrupted");
            receivedChunksRef.current = [];
            fileMetaRef.current = null;
            receivedSizeRef.current = 0;
            receiveStartTimeRef.current = 0;
            setRecvProgress(0);
            setRecvSpeed(0);
            return;
          }

          addLog(`✅ Integrity verified (${receivedHash.substring(0, 12)})`);

          const blob = new Blob([merged], {
            type: fileMetaRef.current?.fileType || "application/octet-stream",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileMetaRef.current?.fileName || "swiftshare_file";
          a.click();
          URL.revokeObjectURL(url);

          addLog(`Downloaded: ${fileMetaRef.current?.fileName || "file"}`);

          // Reset for next file
          receivedChunksRef.current = [];
          fileMetaRef.current = null;
          receivedSizeRef.current = 0;
          receiveStartTimeRef.current = 0;
          setRecvProgress(0);
          setRecvSpeed(0);
          setRecvFileName("");
          return;
        }

        // JSON messages
        try {
          const data = JSON.parse(event.data);

          if (data.type === "file-list") {
            addLog(`Manifest received: ${data.files.length} file(s)`);
            setRole("receiver");
            setIncomingManifest(data);
            return;
          }

          if (data.type === "manifest-accept" || data.type === "manifest-reject") {
            handleManifestResponseRef.current(data);
            return;
          }

          if (data.type === "metadata") {
            fileMetaRef.current = data;
            setRecvFileName(data.fileName);
            addLog(`Receiving: ${data.fileName}`);
            return;
          }
        } catch (err) {}
      } else {
        // Binary chunk
        if (receiveStartTimeRef.current === 0) {
          receiveStartTimeRef.current = Date.now();
        }

        receivedChunksRef.current.push(event.data);
        receivedSizeRef.current += event.data.byteLength;

        if (fileMetaRef.current?.fileSize) {
          setRecvProgress(
            (receivedSizeRef.current / fileMetaRef.current.fileSize) * 100
          );
        }

        const elapsed = (Date.now() - receiveStartTimeRef.current) / 1000;
        if (elapsed > 0) {
          setRecvSpeed(receivedSizeRef.current / 1024 / 1024 / elapsed);
        }
      }
    };
  }, [addLog]); // Only depends on addLog (which is stable via useCallback([]))

  // ── WebSocket + WebRTC setup (runs ONCE per code) ────────────
  useEffect(() => {
    if (!code) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5001";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("Waiting for receiver...");
      addLog("Signaling connected");
      ws.send(JSON.stringify({ type: "join-room", roomCode: code }));
    };

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.ondatachannel = (event) => {
      addLog("DataChannel received from peer");
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
      addLog(`RTC state: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        setStatus("Peer connected");
      }
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      if (data.error) {
        addLog(`Error: ${data.error}`);
        return;
      }

      if (data.type === "peer-joined") {
        setStatus("Peer joined — connecting...");
        const channel = pc.createDataChannel("file");
        dataChannelRef.current = channel;
        setupDataChannel(channel);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(
          JSON.stringify({ type: "offer", roomCode: code, payload: offer })
        );
      } else if (data.type === "offer") {
        setStatus("Connecting...");
        await pc.setRemoteDescription(data.payload);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(
          JSON.stringify({ type: "answer", roomCode: code, payload: answer })
        );
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(data.payload);
      } else if (data.type === "ice-candidate") {
        await pc.addIceCandidate(data.payload);
      }
    };

    return () => {
      ws.close();
      pc.close();
    };
  }, [code, addLog, setupDataChannel]);

  // ── Manifest accept/reject handlers ──────────────────────────
  const handleManifestAccept = (acceptedIds) => {
    const channel = dataChannelRef.current;
    if (channel && channel.readyState === "open") {
      channel.send(JSON.stringify({ type: "manifest-accept", acceptedIds }));
    }
    addLog(`Accepted ${acceptedIds.length} file(s)`);
    setIncomingManifest(null);
  };

  const handleManifestReject = () => {
    const channel = dataChannelRef.current;
    if (channel && channel.readyState === "open") {
      channel.send(JSON.stringify({ type: "manifest-reject" }));
    }
    addLog("Declined all files");
    setIncomingManifest(null);
  };

  // ── Status message logic ─────────────────────────────────────
  const getStatusMessage = () => {
    if (transferPhase === "complete") return "Transfer complete";
    if (transferPhase === "transferring") return "Transferring...";
    if (transferPhase === "waiting-approval") return "Waiting for approval...";
    if (recvProgress > 0 && recvProgress < 100) return `Receiving: ${recvFileName}`;
    if (isChannelReady) return "Peer connected";
    return status;
  };

  const isConnected = isChannelReady || status === "Peer connected";
  const isSender = role === "sender" || stagedFiles.length > 0;
  const isReceiver = role === "receiver";
  const showReceiverProgress = isReceiver && recvProgress > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f7] relative px-6">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>

      <div className="z-10 w-full flex flex-col items-center">
        {/* ── SENDER VIEW ─────────────────────────────── */}
        {isSender && (
          <div className="bg-white rounded-2xl p-8 shadow-sm w-[380px] text-center border border-[rgba(0,0,0,0.06)] hover:shadow-md transition-all duration-300">
            <h2 className="text-lg font-semibold mb-1 text-[#0a0a0a]">
              Your link is ready
            </h2>
            <p className="text-xs text-[#6b6b6b] mb-6">
              Share this link to start transfer
            </p>

            <div className="flex justify-center mb-6">
              <QRCodeCanvas value={roomUrl || code} size={140} bgColor="#ffffff" fgColor="#111111" />
            </div>

            <div className="bg-[#f7f7f7] p-3 rounded-lg text-xs mb-4 text-[#6b6b6b] font-mono break-all border border-[rgba(0,0,0,0.06)]">
              {roomUrl || code}
            </div>

            <button
              onClick={() => navigator.clipboard.writeText(roomUrl || code)}
              className="bg-[#111111] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 w-full mb-4"
            >
              Copy Link
            </button>

            <FileQueueUI stagedFiles={stagedFiles} currentFile={currentFile} />

            <p className="text-xs text-[#6b6b6b] mt-6 flex justify-center items-center gap-2 pt-4 border-t border-[rgba(0,0,0,0.06)]">
              <span className={`w-2 h-2 rounded-full inline-block ${isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}></span>
              {getStatusMessage()}
            </p>
          </div>
        )}

        {/* ── RECEIVER VIEW ───────────────────────────── */}
        {!isSender && !showReceiverProgress && (
          <div className="bg-white rounded-2xl p-8 shadow-sm w-[360px] text-center border border-[rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-semibold mb-2 text-[#0a0a0a]">SwiftShare</h2>
            <p className="text-sm text-[#6b6b6b] mb-1">
              Room: <span className="font-mono text-[#0a0a0a]">{code}</span>
            </p>
            <p className="text-xs text-[#6b6b6b] mt-4 flex justify-center items-center gap-2">
              <span className={`w-2 h-2 rounded-full inline-block ${isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}></span>
              {isConnected ? "Connected — waiting for files..." : "Connecting..."}
            </p>
          </div>
        )}

        {/* ── RECEIVER DOWNLOAD PROGRESS ──────────────── */}
        {showReceiverProgress && (
          <div className="bg-white rounded-2xl p-8 shadow-sm w-[360px] text-center border border-[rgba(0,0,0,0.06)]">
            <p className="text-sm text-[#6b6b6b] mb-2">Receiving</p>
            <h2 className="text-lg font-semibold text-[#0a0a0a] mb-1 truncate">{recvFileName}</h2>
            <p className="text-xs text-[#6b6b6b] mb-4">
              {recvProgress.toFixed(0)}% · {recvSpeed.toFixed(1)} MB/s
            </p>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-[rgba(0,0,0,0.06)]">
              <div
                className="bg-[#111111] h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.min(recvProgress, 100)}%` }}
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
