"use client";

import { useEffect, useRef, useState } from "react";
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
  
  const [status, setStatus] = useState("Connecting to signaling server...");
  const [logs, setLogs] = useState([]);
  const [isChannelReady, setIsChannelReady] = useState(false);
  const receivedChunksRef = useRef([]);
  const fileMetaRef = useRef(null);
  const receivedSizeRef = useRef(0);
  const receiveStartTimeRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [speedMBps, setSpeedMBps] = useState(0);
  const [roomUrl, setRoomUrl] = useState("");
  const [incomingRequest, setIncomingRequest] = useState(null);

  const CHUNK_SIZE = 16 * 1024;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRoomUrl(`${window.location.origin}/room/${code}`);
    }
  }, [code]);

  const addLog = (msg) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const { addFiles, sendProgress, sendSpeedMBps, currentFile, queueRaw, handleTransferResponse } = useFileTransfer(dataChannelRef, addLog);

  const activeProgress = sendProgress > 0 ? sendProgress : progress;
  const activeSpeedMBps = sendSpeedMBps > 0 ? sendSpeedMBps : speedMBps;

  const handleAccept = () => {
    const channel = dataChannelRef.current;
    if (channel) channel.send(JSON.stringify({ type: "transfer-accept" }));
    addLog(`✅ Accepted incoming file transfer.`);
    setIncomingRequest(null);
  };

  const handleReject = () => {
    const channel = dataChannelRef.current;
    if (channel) channel.send(JSON.stringify({ type: "transfer-reject" }));
    addLog(`❌ Rejected incoming file transfer.`);
    setIncomingRequest(null);
  };

  const setupDataChannel = (channel) => {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      addLog("DataChannel open 🚀 Ready for file transfer");
      setIsChannelReady(true);
    };
    
    channel.onclose = () => {
      addLog("DataChannel closed");
      setIsChannelReady(false);
    };

    channel.onmessage = async (event) => {
      // Handle metadata and EOF string messages
      if (typeof event.data === "string") {
        if (event.data === "EOF") {
          addLog("File stream complete. Compiling chunks for integrity verification...");
          
          const totalLength = receivedChunksRef.current.reduce((acc, curr) => acc + curr.byteLength, 0);
          const merged = new Uint8Array(totalLength);

          let offset = 0;
          for (const chunk of receivedChunksRef.current) {
            merged.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }

          const receivedHash = await generateHash(merged);

          if (fileMetaRef.current?.hash && receivedHash !== fileMetaRef.current.hash) {
            addLog("❌ INTEGRITY FAILURE: SHA-256 Hash Mismatch!");
            alert("❌ File corrupted during transfer! Hash mismatch.");
            
            // cleanup
            receivedChunksRef.current = [];
            fileMetaRef.current = null;
            receivedSizeRef.current = 0;
            receiveStartTimeRef.current = 0;
            setProgress(0);
            setSpeedMBps(0);
            return;
          }

          addLog(`✅ Integrity Verified: SHA-256 Match (${receivedHash.substring(0, 8)})`);

          const fileType = fileMetaRef.current?.fileType || "application/octet-stream";
          const fileName = fileMetaRef.current?.fileName || `swiftshare_received_file`;
          const blob = new Blob([merged], { type: fileType });
          const url = URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();

          receivedChunksRef.current = [];
          fileMetaRef.current = null;
          receivedSizeRef.current = 0;
          receiveStartTimeRef.current = 0;
          setProgress(0);
          setSpeedMBps(0);

          addLog(`Download automatically initiated: ${fileName}`);
          URL.revokeObjectURL(url);
          return;
        }

        // Try parsing metadata
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "transfer-request") {
             addLog(`Incoming transfer request: ${data.fileName}`);
             setIncomingRequest(data);
             return;
          }
          
          if (data.type === "transfer-accept" || data.type === "transfer-reject") {
             handleTransferResponse(data.type);
             return;
          }

          if (data.type === "metadata") {
            fileMetaRef.current = data;
            addLog(`Incoming metadata: ${data.fileName}`);
            return;
          }
        } catch (err) {}
      } else {
        // Binary chunk
        if (receiveStartTimeRef.current === 0) receiveStartTimeRef.current = Date.now();
        receivedChunksRef.current.push(event.data);
        receivedSizeRef.current += event.data.byteLength;
        
        if (fileMetaRef.current?.fileSize) {
          const p = (receivedSizeRef.current / fileMetaRef.current.fileSize) * 100;
          setProgress(p);
        }
        
        const elapsedSecs = (Date.now() - receiveStartTimeRef.current) / 1000;
        if (elapsedSecs > 0) {
           setSpeedMBps((receivedSizeRef.current / 1024 / 1024) / elapsedSecs);
        }
      }
    };
  };

  useEffect(() => {
    if (!code) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5001";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("Connected to socket. Waiting for peer to arrive...");
      addLog("WebSocket connection securely established");
      ws.send(
        JSON.stringify({
          type: "join-room",
          roomCode: code,
        })
      );
    };

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    // Receive DataChannel (Receiver Side)
    pc.ondatachannel = (event) => {
      addLog("Receiving incoming DataChannel from peer...");
      const channel = event.channel;
      dataChannelRef.current = channel;
      setupDataChannel(channel);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        addLog("Transmitting ICE candidate route");
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
      addLog(`WebRTC State: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setStatus("Peer connected successfully! P2P pipeline is active.");
      }
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      if (data.error) {
        addLog(`Signaling Error: ${data.error}`);
        return;
      }
      addLog(`Signaling Event: ${data.type?.toUpperCase() || 'UNKNOWN'}`);

      if (data.type === "peer-joined") {
        setStatus("Peer joined. Initiating offer handshake...");
        
        // Create DataChannel (Sender Side)
        addLog("Orchestrating P2P File Data Channel");
        const channel = pc.createDataChannel("file");
        dataChannelRef.current = channel;
        setupDataChannel(channel);

        addLog("Generating Local WebRTC Offer");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        ws.send(
          JSON.stringify({
            type: "offer",
            roomCode: code,
            payload: offer,
          })
        );
      } else if (data.type === "offer") {
        setStatus("Received offer. Calculating answer...");
        addLog("Setting Remote Description (Offer)");
        await pc.setRemoteDescription(data.payload);

        addLog("Drafting WebRTC Answer");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(
          JSON.stringify({
            type: "answer",
            roomCode: code,
            payload: answer,
          })
        );
      } else if (data.type === "answer") {
        addLog("Applying Remote Answer");
        await pc.setRemoteDescription(data.payload);
      } else if (data.type === "ice-candidate") {
        addLog("Adding Remote ICE candidate bypass");
        await pc.addIceCandidate(data.payload);
      }
    };

    return () => {
      ws.close();
      pc.close();
    };
  }, [code]);

  // Send logic migrated to custom hook `useFileTransfer`

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f7] relative px-6">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>

      <div className="z-10 w-full flex flex-col items-center">
        
        {/* Drop Zone (If no files queued) */}
        {(!queueRaw || queueRaw.length === 0) && !currentFile && !incomingRequest && (
          <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl p-10 shadow-sm hover:shadow-md transition-all duration-300 w-[360px] text-center">
             <h2 className="text-xl font-semibold mb-2 text-[#0a0a0a]">You're connected!</h2>
             <p className="text-sm text-[#6b6b6b] mb-8">
                Room Code: <span className="font-mono text-[#0a0a0a] bg-gray-100 px-2 py-1 rounded">{code}</span>
             </p>
             <p className="text-sm text-[#6b6b6b] mb-4">Drop files here to share</p>
             <input type="file" multiple className="hidden" id="fileInput" onChange={(e) => addFiles(e.target.files)} />
             <label
               htmlFor="fileInput"
               className="cursor-pointer text-sm font-medium px-6 py-3 bg-[#111111] text-white rounded-full hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 inline-block"
             >
               Select Files
             </label>
             <p className="text-xs text-[#6b6b6b] mt-6 flex justify-center items-center gap-2">
               <span className={`w-2 h-2 rounded-full inline-block ${status.includes('P2P pipeline is active') ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
               {status.includes('P2P pipeline is active') ? 'Peer Connected' : 'Waiting for receiver...'}
             </p>
          </div>
        )}

        {/* Sender Status Sheet (If files are actively queued) */}
        {((queueRaw && queueRaw.length > 0) || currentFile) && !incomingRequest && (
          <div className="bg-white rounded-2xl p-8 shadow-sm w-[360px] text-center border border-[rgba(0,0,0,0.06)] hover:shadow-md transition-all duration-300">
            <h2 className="text-lg font-medium mb-2 text-[#0a0a0a]">Your link is ready</h2>
            <p className="text-xs text-[#6b6b6b] mb-6">Keep this page open while sharing</p>

            <div className="flex justify-center mb-6">
               <QRCodeCanvas value={roomUrl || code} size={140} bgColor={"#ffffff"} fgColor={"#111111"} />
            </div>

            <div className="bg-gray-100 p-3 rounded-lg text-xs mb-4 text-[#6b6b6b] font-mono break-all border border-[rgba(0,0,0,0.06)]">
              {roomUrl || code}
            </div>

            <button 
              onClick={() => navigator.clipboard.writeText(roomUrl || code)}
              className="bg-[#111111] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 w-full mb-4"
            >
              Copy Link
            </button>

            {activeProgress > 0 && activeProgress < 100 && (
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden border border-[rgba(0,0,0,0.06)]">
                <div
                  className="bg-[#111111] h-full rounded-full transition-all duration-300"
                  style={{ width: `${activeProgress}%` }}
                ></div>
              </div>
            )}
            
            <p className="text-xs text-[#6b6b6b] my-2 truncate">
              {currentFile ? `Sending: ${currentFile.name} (${activeProgress.toFixed(1)}%) - ${activeSpeedMBps.toFixed(2)} MB/s` : ""}
            </p>

            <p className="text-xs text-[#6b6b6b] mt-4 flex justify-center items-center gap-2 pt-4 border-t border-[rgba(0,0,0,0.06)]">
              <span className={`w-2 h-2 rounded-full inline-block ${status.includes('P2P pipeline is active') ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
              {status.includes('P2P pipeline is active') ? "Transferring..." : "Waiting for receiver..."}
            </p>
          </div>
        )}

      </div>
      
      <TransferRequest 
        request={incomingRequest} 
        onAccept={handleAccept} 
        onReject={handleReject} 
      />
    </div>
  );
}
