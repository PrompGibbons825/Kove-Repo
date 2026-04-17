"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type CallState = "idle" | "connecting" | "ringing" | "active" | "ending";

interface CallOptions {
  onCallStarted?: () => void;
  onCallEnded?: (info: { duration: number; localTranscript: string }) => void;
}

export function useCall(options?: CallOptions) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [callerNumber, setCallerNumber] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (clientRef.current) {
        try { clientRef.current.disconnect(); } catch {}
      }
    };
  }, []);

  const startCall = useCallback(async (destinationNumber: string) => {
    if (callState !== "idle") return;
    setCallState("connecting");

    try {
      // Fetch WebRTC token
      const tokenRes = await fetch("/api/comms/call/token");
      if (!tokenRes.ok) throw new Error("Failed to get call token");
      const { token, callerNumber: cn } = await tokenRes.json();
      setCallerNumber(cn);

      // Dynamic import to avoid SSR issues
      const { TelnyxRTC } = await import("@telnyx/webrtc");

      const client = new TelnyxRTC({ login_token: token });
      clientRef.current = client;

      client.on("telnyx.ready", () => {
        // Place the call
        const call = client.newCall({
          destinationNumber,
          callerNumber: cn,
          audio: true,
          video: false,
        });
        callRef.current = call;
        setCallState("ringing");
      });

      client.on("telnyx.notification", (notification: any) => {
        const state = notification?.call?.state;
        if (state === "active") {
          setCallState("active");
          durationRef.current = 0;
          setDuration(0);
          timerRef.current = setInterval(() => {
            durationRef.current += 1;
            setDuration(durationRef.current);
          }, 1000);

          // Capture remote audio stream
          const stream = notification.call.remoteStream ?? notification.call.options?.remoteStream;
          if (stream) {
            setRemoteStream(stream);
            // Play remote audio
            if (!audioRef.current) {
              audioRef.current = new Audio();
              audioRef.current.autoplay = true;
            }
            audioRef.current.srcObject = stream;
          }

          options?.onCallStarted?.();
        } else if (state === "hangup" || state === "destroy") {
          handleCallEnd();
        }
      });

      client.on("telnyx.error", () => {
        setCallState("idle");
      });

      client.connect();
    } catch (err) {
      console.error("Call failed:", err);
      setCallState("idle");
    }
  }, [callState, options]);

  const handleCallEnd = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallState("idle");
    setRemoteStream(null);
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    options?.onCallEnded?.({
      duration: durationRef.current,
      localTranscript: "", // transcript comes from useLiveTranscript hook
    });

    callRef.current = null;
    if (clientRef.current) {
      try { clientRef.current.disconnect(); } catch {}
      clientRef.current = null;
    }
  }, [options]);

  const endCall = useCallback(() => {
    if (callRef.current) {
      try { callRef.current.hangup(); } catch {}
    }
    handleCallEnd();
  }, [handleCallEnd]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    if (muted) {
      callRef.current.unmuteAudio();
    } else {
      callRef.current.muteAudio();
    }
    setMuted(!muted);
  }, [muted]);

  return {
    callState,
    muted,
    duration,
    callerNumber,
    remoteStream,
    startCall,
    endCall,
    toggleMute,
  };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
