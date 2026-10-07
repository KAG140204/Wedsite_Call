// AdminDashboard.jsx – Free WebRTC call (no paid TURN)
import React, { useEffect, useRef, useState } from "react";

// ==== Configuration (update if you host the worker/server elsewhere) ====
const SIGNALING_URL = "wss://your-domain.com/ws"; // Cloudflare Workers WebSocket proxy
// We use Cloudflare‑provided STUN; no TURN to stay free
const ICE_SERVERS = [{ urls: "stun:stun.cloudflare.com:3478" }];
// ====================================================================

let pc = null; // RTCPeerConnection instance (single global for simplicity)
let ws = null; // signaling WebSocket

export default function AdminDashboard() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [roomId] = useState(() => `room-${Date.now()}`);
  const [status, setStatus] = useState("Idle");

  // -------------------------------------------------------------------
  // 1️⃣ Initialise signalling + WebRTC when component mounts
  // -------------------------------------------------------------------
  useEffect(() => {
    // ---- Connect signalling websocket ----
    ws = new WebSocket(SIGNALING_URL);
    ws.onopen = () => {
      console.log("🔗 Signalling WS open");
      setStatus("Signalling connected");
    };
    ws.onmessage = async ev => {
      const msg = JSON.parse(ev.data);
      const { type, payload } = msg;
      if (!pc) return; // safety
      switch (type) {
        case "offer":
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", payload: answer, room: roomId }));
          break;
        case "answer":
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          break;
        case "candidate":
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload));
          } catch (e) {
            console.warn("Failed to add ICE candidate", e);
          }
          break;
        default:
          console.warn("Unknown signalling type", type);
      }
    };
    ws.onerror = err => console.error("WS error", err);
    ws.onclose = () => console.log("WS closed");

    // ---- Create RTCPeerConnection (STUN only) ----
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = ev => {
      if (ev.candidate) {
        ws.send(
          JSON.stringify({ type: "candidate", payload: ev.candidate, room: roomId })
        );
      }
    };
    pc.ontrack = ev => {
      // Remote stream – attach to remote video element
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = ev.streams[0];
      }
    };
    pc.onconnectionstatechange = () => {
      setStatus(`Connection: ${pc.connectionState}`);
    };

    // ---- Get local media (camera + mic) ----
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        // Add tracks to peer connection
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
      } catch (e) {
        console.error("getUserMedia error", e);
        setStatus("Media error");
      }
    })();

    // Cleanup on unmount
    return () => {
      ws && ws.close();
      pc && pc.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------
  // 2️⃣ Start call – send OFFER to the same room (peer will answer)
  // -------------------------------------------------------------------
  const startCall = async () => {
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", payload: offer, room: roomId }));
    setStatus("Offer sent – waiting for answer");
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", background: "#f5f5f5" }}>
      <h1 style={{ color: "#2e7d32" }}>Wedsite Call – Free‑tier (no TURN)</h1>
      <p>Status: <code>{status}</code></p>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "48%", borderRadius: "8px", background: "#111" }}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: "48%", borderRadius: "8px", background: "#111" }}
        />
      </div>
      <button
        onClick={startCall}
        style={{
          padding: "0.8rem 1.5rem",
          background: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        📞 Bắt đầu cuộc gọi
      </button>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#555" }}>
        Phòng (room) ID: <code>{roomId}</code> – dùng để đồng bộ giữa hai thiết bị.
      </p>
    </div>
  );
}
