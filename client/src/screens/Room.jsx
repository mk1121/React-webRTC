import React, { useEffect, useCallback, useState, useRef } from "react";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // My Stream Assignment
// My Stream Assignment
  useEffect(() => {
    if (myVideoRef.current && myStream) {
      console.log("[UI] Assigning myStream to local video...");
      myVideoRef.current.srcObject = myStream;
      myVideoRef.current.play().catch(err => console.error("My video play failed:", err));
    }
  }, [myStream]);

  // Remote Stream Assignment
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log("[UI] Assigning remoteStream to video element...");
      remoteVideoRef.current.srcObject = remoteStream;
      
      // ব্রাউজার যদি অটো-প্লে ব্লক করে, এই লজিকটি সেটি প্লে করতে বাধ্য করবে
      const playPromise = remoteVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log("[UI] Remote video playing successfully!"))
          .catch(err => {
            console.warn("[UI] Auto-play was prevented. Click the screen to play.");
            // যদি অটো-প্লে না হয়, তাহলে মিউট করে প্লে করার চেষ্টা করবে (মিউট থাকলে ব্রাউজার বাধা দেয় না)
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.play();
          });
      }
    }
  }, [remoteStream]);
  // Remote Stream Assignment (Fixed Logic)

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`[SOCKET] User joined: ${email}`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    setMyStream(stream);
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(async ({ from, offer }) => {
    setRemoteSocketId(from);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    setMyStream(stream);
    const ans = await peer.getAnswer(offer);
    socket.emit("call:accepted", { to: from, ans });
  }, [socket]);

  const sendStreams = useCallback(() => {
    if (!myStream) return;
    const senders = peer.peer.getSenders();
    for (const track of myStream.getTracks()) {
      const isTrackAlreadyAdded = senders.find((s) => s.track === track);
      if (!isTrackAlreadyAdded) peer.peer.addTrack(track, myStream);
    }
    console.log("[WEBRTC] My stream sent to peer");
  }, [myStream]);

  const handleCallAccepted = useCallback(async ({ from, ans }) => {
    await peer.peer.setRemoteDescription(new RTCSessionDescription(ans));
    sendStreams();
  }, [sendStreams]);

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(async ({ from, offer }) => {
    const ans = await peer.getAnswer(offer);
    socket.emit("peer:nego:done", { to: from, ans });
  }, [socket]);

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.peer.setRemoteDescription(new RTCSessionDescription(ans));
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("track", (ev) => {
      console.log("[WEBRTC] Remote tracks received!");
      setRemoteStream(ev.streams[0]);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [socket, handleUserJoined, handleIncommingCall, handleCallAccepted, handleNegoNeedIncomming, handleNegoNeedFinal]);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Room Page</h1>
      <h4>Status: {remoteSocketId ? "✅ Connected" : "❌ No one in room"}</h4>
      
      <div style={{ marginBottom: "20px" }}>
        {myStream && <button onClick={sendStreams} style={{ padding: "10px", marginRight: "10px" }}>Send My Video</button>}
        {remoteSocketId && <button onClick={handleCallUser} style={{ padding: "10px", backgroundColor: "green", color: "white" }}>CALL USER</button>}
      </div>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        {/* Local Video - Always in DOM */}
        <div>
          <h3>My Stream (Local)</h3>
          <video
            ref={myVideoRef}
            autoPlay
            playsInline
            muted
            width="300px"
            height="200px"
            style={{ backgroundColor: "black", borderRadius: "10px", border: "2px solid blue" }}
          />
        </div>

        {/* Remote Video - Always in DOM */}
        <div>
          <h3>Remote Stream</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            width="300px"
            height="200px"
            style={{ backgroundColor: "black", borderRadius: "10px", border: "2px solid red" }}
          />
          {!remoteStream && <p>Waiting for video...</p>}
        </div>
      </div>
    </div>
  );
};

export default RoomPage;