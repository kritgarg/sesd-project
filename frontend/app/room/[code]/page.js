"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";

async function generateHash(buffer) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

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

  const CHUNK_SIZE = 16 * 1024;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRoomUrl(`${window.location.origin}/room/${code}`);
    }
  }, [code]);

  const addLog = (msg) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
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
      addLog(`Signaling Event: ${data.type.toUpperCase()}`);

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

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      alert("No connection yet");
      return;
    }

    addLog(`Initiating transfer: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    addLog(`Computing SHA-256 integrity hash...`);
    
    const fileBuffer = await file.arrayBuffer();
    const hash = await generateHash(fileBuffer);
    addLog(`Hash Generated: ${hash.substring(0, 8)}`);
    
    // SEND METADATA FIRST
    channel.send(JSON.stringify({
      type: "metadata",
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      hash
    }));
    
    let offset = 0;
    const MAX_BUFFER = 1_000_000; // 1MB
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
      
      setProgress((offset / file.size) * 100);
      const elapsedSecs = (Date.now() - sendStartTime) / 1000;
      if (elapsedSecs > 0) {
        setSpeedMBps((offset / 1024 / 1024) / elapsedSecs);
      }
    }

    channel.send("EOF");
    addLog("Transfer complete. Final EOF injected.");
    setTimeout(() => {
      setProgress(0);
      setSpeedMBps(0);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center p-8 font-sans relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="z-10 w-full max-w-4xl flex flex-col gap-6 mt-10">
        
        {/* Status Header & QR Generator */}
        <div className="flex flex-col md:flex-row items-center justify-between bg-neutral-900/60 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl gap-8">
          <div className="flex-1">
             <div className="flex items-center gap-4 mb-5">
               <h1 className="text-4xl font-black text-white bg-gradient-to-tr from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent">
                 SwiftShare
               </h1>
               <div className="h-6 w-[2px] bg-white/10 hidden md:block"></div>
               <span className="font-mono bg-neutral-950/50 border border-white/10 text-indigo-400 px-5 py-2 rounded-xl tracking-widest select-all shadow-inner uppercase text-xl hidden md:block">
                 {code}
               </span>
             </div>
            
            <p className="text-neutral-300 font-medium flex items-center gap-3 text-lg">
              <span className={`w-3.5 h-3.5 rounded-full ${status.includes('P2P pipeline is active') ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]' : 'bg-amber-400 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.6)]'}`}></span>
              Status: <span className="font-bold">{status.includes('P2P pipeline is active') ? "Connected ✅" : status}</span>
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg">
            {roomUrl ? (
               <div className="bg-white p-2 rounded-xl">
                 <QRCodeCanvas value={roomUrl} size={110} bgColor={"#ffffff"} fgColor={"#000000"} />
               </div>
            ) : (
               <div className="w-[126px] h-[126px] bg-white/10 rounded-xl animate-pulse" />
            )}
            <button 
              onClick={() => navigator.clipboard.writeText(roomUrl || code)} 
              className="w-full px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-xl transition-all font-bold text-xs hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] active:scale-95 text-indigo-300 uppercase tracking-wider"
            >
              Copy Link
            </button>
          </div>
        </div>

        {/* File Transfer Actions */}
        <div className="bg-neutral-900/40 backdrop-blur-3xl border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
          
          {progress > 0 && progress < 100 && (
            <div className="absolute top-0 left-0 h-1 bg-indigo-500 transition-all duration-300 z-50" style={{ width: `${progress}%` }}></div>
          )}

          <label className={`w-full flex items-center justify-center py-10 px-4 border-2 border-dashed ${isChannelReady ? 'border-indigo-500/50 hover:bg-indigo-500/10 cursor-pointer' : 'border-neutral-700 bg-neutral-950/50 opacity-50 cursor-not-allowed'} rounded-2xl transition-all duration-300 relative overflow-hidden group`}>
            
            <div className="text-center z-10 transition-transform duration-300 group-hover:scale-105">
              <span className={`block text-xl font-bold mb-2 ${isChannelReady ? 'text-indigo-400' : 'text-neutral-500'}`}>
                {progress > 0 ? `${progress.toFixed(1)}%` : isChannelReady ? "🚀 Select File to Transmit" : "Awaiting RTC Data Channel..."}
              </span>
              
              {progress > 0 ? (
                <span className="text-indigo-300 text-sm font-medium block">
                  Speed: {speedMBps.toFixed(2)} MB/s
                </span>
              ) : (
                <span className="text-neutral-500 text-sm font-medium block">
                  Directly via raw WebRTC Buffer logic
                </span>
              )}
            </div>
            
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFile}
              disabled={!isChannelReady || progress > 0}
            />
          </label>
        </div>

        {/* Console / Logs Window */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex-1 max-h-[40vh] flex flex-col relative">
          <div className="border-b border-white/5 bg-neutral-900/80 px-6 py-4 flex items-center justify-between">
            <div className="flex gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-red-500"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500"></div>
            </div>
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest font-bold">Signaling Diagnostics</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-3">
             {logs.map((log, i) => (
                <div key={i} className="flex gap-4 group">
                  <span className="text-neutral-700 select-none group-hover:text-indigo-400/50 transition-colors w-8 text-right block">[{i + 1}]</span>
                  <span className={`${log.includes('active') ? 'text-emerald-400 font-bold' : log.includes('open') || log.includes('download') || log.includes('Download') ? 'text-green-400 font-bold' : log.includes('Event:') ? 'text-indigo-300 font-medium' : log.includes('WebSocket') ? 'text-blue-400' : 'text-neutral-400'}`}>
                    {log}
                  </span>
                </div>
             ))}
             {logs.length === 0 && <div className="text-neutral-600 flex items-center justify-center h-full italic">Waiting for events to populate...</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
