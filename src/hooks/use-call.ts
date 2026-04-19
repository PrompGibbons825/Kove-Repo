"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type CallState = "idle" | "connecting" | "ringing" | "active" | "ending";

interface CallOptions {
  onCallStarted?: () => void;
  onCallEnded?: (info: { duration: number; localTranscript: string }) => void;
}

/** Normalize a phone number to E.164 format for Telnyx */
function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
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
  const optionsRef = useRef(options);
  // Guard: prevent onCallEnded from firing more than once per call
  const endedRef = useRef(false);
  optionsRef.current = options;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (clientRef.current) {
        try { clientRef.current.disconnect(); } catch {}
      }
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallState("idle");
    setMuted(false);
    setRemoteStream(null);
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    callRef.current = null;
    if (clientRef.current) {
      try { clientRef.current.disconnect(); } catch {}
      clientRef.current = null;
    }
    // Reset ended guard for next call
    endedRef.current = false;
  }, []);

  const startCall = useCallback(async (destinationNumber: string) => {
    if (callState !== "idle") return;
    setCallState("connecting");

    try {
      // Fetch WebRTC token
      const tokenRes = await fetch("/api/comms/call/token");
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        console.error("Token fetch failed:", err);
        throw new Error(err.error ?? "Failed to get call token");
      }
      const { token, callerNumber: cn } = await tokenRes.json();
      if (!token) throw new Error("Empty token returned");
      setCallerNumber(cn);

      const dest = toE164(destinationNumber);
      console.log("[useCall] dialing", dest, "from", cn);

      // Dynamic import to avoid SSR issues
      const { TelnyxRTC } = await import("@telnyx/webrtc");

      const client = new TelnyxRTC({ login_token: token });
      clientRef.current = client;

      client.on("telnyx.ready", () => {
        console.log("[useCall] TelnyxRTC ready, placing call");
        const call = client.newCall({
          destinationNumber: dest,
          callerNumber: cn ?? undefined,
          audio: true,
          video: false,
        });
        callRef.current = call;
        setCallState("ringing");
      });

      client.on("telnyx.notification", (notification: any) => {
        // Some notification events (media, session) don't carry a call object — guard it
        const state = notification?.call?.state;
        console.log("[useCall] notification state:", state, "type:", notification?.type);

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
            if (!audioRef.current) {
              audioRef.current = new Audio();
              audioRef.current.autoplay = true;
            }
            audioRef.current.srcObject = stream;
          }

          optionsRef.current?.onCallStarted?.();
        } else if (state === "early" || state === "ringing") {
          // Voicemail / ringback early media — keep UI in ringing state, don't crash
          setCallState("ringing");
        } else if (state === "hangup" || state === "destroy" || state === "purge") {
          // Guard: only fire onCallEnded once per call even if Telnyx sends hangup+destroy
          if (!endedRef.current) {
            endedRef.current = true;
            optionsRef.current?.onCallEnded?.({
              duration: durationRef.current,
              localTranscript: "",
            });
          }
          cleanup();
        }
      });

      client.on("telnyx.error", (error: any) => {
        console.error("[useCall] TelnyxRTC error:", error);
        cleanup();
      });

      client.connect();
    } catch (err) {
      console.error("[useCall] Call failed:", err);
      setCallState("idle");
    }
  }, [callState, cleanup]);

  const endCall = useCallback(() => {
    if (callRef.current) {
      try { callRef.current.hangup(); } catch {}
    }
    if (!endedRef.current) {
      endedRef.current = true;
      optionsRef.current?.onCallEnded?.({
        duration: durationRef.current,
        localTranscript: "",
      });
    }
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    if (muted) {
      callRef.current.unmuteAudio();
    } else {
      callRef.current.muteAudio();
    }
    setMuted(!muted);
  }, [muted]);

  const sendDtmf = useCallback((digit: string) => {
    if (!callRef.current) return;
    try { callRef.current.dtmf(digit); } catch {}
  }, []);

  return {
    callState,
    muted,
    duration,
    callerNumber,
    remoteStream,
    startCall,
    endCall,
    toggleMute,
    sendDtmf,
  };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
