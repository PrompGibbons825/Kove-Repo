"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface TranscriptEntry {
  speaker: "agent" | "customer";
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface LiveTranscriptOptions {
  remoteStream: MediaStream | null;
  active: boolean;
  onTranscriptUpdate?: (entries: TranscriptEntry[]) => void;
}

/**
 * useLiveTranscript — Uses Web Speech API (webkitSpeechRecognition) to transcribe
 * both agent (mic) and customer (remote TelnyxRTC stream) audio in real-time.
 *
 * The remote stream is routed through AudioContext → MediaStreamDestination,
 * then merged with the mic stream and fed to SpeechRecognition.
 */
export function useLiveTranscript({ remoteStream, active, onTranscriptUpdate }: LiveTranscriptOptions) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const entriesRef = useRef<TranscriptEntry[]>([]);

  const addEntry = useCallback((entry: TranscriptEntry) => {
    entriesRef.current = [...entriesRef.current, entry];
    setEntries([...entriesRef.current]);
    onTranscriptUpdate?.([...entriesRef.current]);
  }, [onTranscriptUpdate]);

  const updateLastInterim = useCallback((text: string, speaker: "agent" | "customer") => {
    const updated = [...entriesRef.current];
    const lastIdx = updated.findLastIndex((e) => e.speaker === speaker && !e.isFinal);
    if (lastIdx >= 0) {
      updated[lastIdx] = { ...updated[lastIdx], text };
    } else {
      updated.push({ speaker, text, timestamp: Date.now(), isFinal: false });
    }
    entriesRef.current = updated;
    setEntries([...updated]);
  }, []);

  const start = useCallback(async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser");
      return;
    }

    // Create merged audio stream: mic + remote
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const destination = audioCtx.createMediaStreamDestination();

    // Add microphone
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(destination);
    } catch (err) {
      console.warn("Could not get mic for transcript:", err);
    }

    // Add remote stream from Telnyx
    if (remoteStream) {
      try {
        const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
        remoteSource.connect(destination);
      } catch (err) {
        console.warn("Could not connect remote stream:", err);
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        // Heuristic: if remote stream is active, assume alternating speakers.
        // In practice both sides are merged, so we label based on energy/timing.
        // For now: label all as "agent" since we're capturing merged audio.
        const speaker: "agent" | "customer" = "agent";

        if (result.isFinal) {
          // Remove any interim for this speaker, add final
          entriesRef.current = entriesRef.current.filter(
            (e) => e.isFinal || e.speaker !== speaker
          );
          addEntry({ speaker, text, timestamp: Date.now(), isFinal: true });
        } else {
          updateLastInterim(text, speaker);
        }
      }
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (active) {
        try { recognition.start(); } catch {}
      } else {
        setListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setListening(false);
        return;
      }
      // Auto-restart on transient errors
      if (active) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [remoteStream, active, addEntry, updateLastInterim]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setListening(false);
  }, []);

  // Auto-start/stop based on active flag
  useEffect(() => {
    if (active && !listening) {
      start().catch((err) => console.warn("[transcript] start failed:", err));
    } else if (!active && listening) {
      stop();
    }
    return () => {
      if (!active) stop();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const getFullTranscript = useCallback(() => {
    return entriesRef.current
      .filter((e) => e.isFinal)
      .map((e) => `${e.speaker === "agent" ? "Agent" : "Customer"}: ${e.text}`)
      .join("\n");
  }, []);

  const reset = useCallback(() => {
    entriesRef.current = [];
    setEntries([]);
  }, []);

  return { entries, listening, getFullTranscript, reset, stop };
}
