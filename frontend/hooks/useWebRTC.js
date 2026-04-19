import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Manages WebSocket signaling, RTCPeerConnection, and DataChannel lifecycle.
 *
 * Returns connection state and a stable setupDataChannel callback.
 * The onChannelMessage / onChannelOpen callbacks are provided via refs
 * so this hook never re-creates the connection when handlers change.
 */
export function useWebRTC(code, addLog) {
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);

  const [status, setStatus] = useState("Connecting...");
  const [isChannelReady, setIsChannelReady] = useState(false);
  const [role, setRole] = useState(null);

  // External callbacks (set by the page via refs so they're always current)
  const onChannelOpenRef = useRef(null);
  const onChannelMessageRef = useRef(null);

  // ── Restore persisted role ────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`swiftshare_role_${code}`);
      if (stored === "sender" || stored === "receiver") {
        setRole(stored);
      }
    }
  }, [code]);

  // Persist role whenever it changes
  useEffect(() => {
    if (role && typeof window !== "undefined") {
      sessionStorage.setItem(`swiftshare_role_${code}`, role);
    }
  }, [role, code]);

  // ── DataChannel setup (stable) ────────────────────────────
  const setupDataChannel = useCallback(
    (channel) => {
      channel.binaryType = "arraybuffer";

      channel.onopen = () => {
        addLog("DataChannel open");
        setIsChannelReady(true);
        onChannelOpenRef.current?.(channel);
      };

      channel.onclose = () => {
        addLog("DataChannel closed");
        setIsChannelReady(false);
      };

      channel.onerror = (err) => {
        addLog(`DataChannel error: ${err.message || "unknown"}`);
      };

      channel.onmessage = (event) => {
        onChannelMessageRef.current?.(event, channel);
      };
    },
    [addLog]
  );

  // ── WebSocket + WebRTC (runs ONCE per code) ───────────────
  useEffect(() => {
    if (!code) return;

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5001";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog("Signaling connected");
      const stored = sessionStorage.getItem(`swiftshare_role_${code}`);
      ws.send(JSON.stringify({ 
        type: "join-room", 
        roomCode: code,
        preferredRole: stored
      }));
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
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.services.mozilla.com" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject"
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject"
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ],
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

    pc.oniceconnectionstatechange = () => {
      addLog(`ICE: ${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      addLog(`RTC: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        setStatus("Peer connected");
      } else if (pc.connectionState === "failed") {
        setStatus("Connection failed ❌");
        addLog("WebRTC connection failed — troubleshoot NAT/STUN");
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

      if (data.type === "role-assigned") {
        addLog(`Server role: ${data.role}`);
        setRole(data.role);
        setStatus(
          data.role === "sender"
            ? "Waiting for receiver..."
            : "Connected — waiting for files..."
        );
        return;
      }

      if (data.type === "room-full") {
        setStatus("Room is full ❌");
        addLog("Room has 2 users already");
        return;
      }

      if (data.type === "peer-disconnected") {
        setStatus("Peer left ❌");
        setIsChannelReady(false);
        addLog("Peer disconnected");
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
        return;
      }

      if (data.type === "offer") {
        setStatus("Connecting...");
        await pc.setRemoteDescription(data.payload);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(
          JSON.stringify({ type: "answer", roomCode: code, payload: answer })
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

  return {
    wsRef,
    pcRef,
    dataChannelRef,
    status,
    setStatus,
    isChannelReady,
    role,
    setRole,
    onChannelOpenRef,
    onChannelMessageRef,
  };
}
