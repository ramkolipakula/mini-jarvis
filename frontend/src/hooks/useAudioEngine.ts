import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { formatFriendlyError, type FormattedError } from '@/lib/api';

export interface RecordingResult {
  blob: Blob | null;
  durationMs: number;
  peakLevel: number;
  avgLevel: number;
  deviceLabel: string;
}

export interface UseAudioEngineOptions {
  onAutoStop?: () => void;
}

export interface UseAudioEngineReturn {
  isListening: boolean;
  isSpeaking: boolean;
  energyRef: MutableRefObject<number>;
  micSupported: boolean;
  ttsSupported: boolean;
  warmStream: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  cancelRecording: () => void;
  playAudio: (base64Audio: string) => Promise<void>;
  speakFallback: (text: string) => void;
  cancelPlayback: () => void;
  error: FormattedError | null;
  clearError: () => void;
  cleanupNodes: () => void;
}

export function useAudioEngine(options?: UseAudioEngineOptions): UseAudioEngineReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<FormattedError | null>(null);

  const energyRef = useRef<number>(0);

  // Web Audio Context & Analyser
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Microphone state & guards
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const autoStopTimeoutRef = useRef<any>(null);
  const stopResolverRef = useRef<((res: RecordingResult | null) => void) | null>(null);
  const peakLevelRef = useRef<number>(0);
  const totalEnergySumRef = useRef<number>(0);
  const totalEnergyCountRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);
  const stopRecordingRef = useRef<(() => Promise<RecordingResult | null>) | null>(null);

  const onAutoStopRef = useRef<(() => void) | undefined>(options?.onAutoStop);
  useEffect(() => {
    onAutoStopRef.current = options?.onAutoStop;
  }, [options?.onAutoStop]);

  // Audio Playback
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Helper: check if jarvis-debug-audio flag is set
  const isDebugAudio = useCallback(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('jarvis-debug-audio') === '1';
    } catch {
      return false;
    }
  }, []);

  // Initialize or resume AudioContext strictly on user gesture
  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return null;

    if (!audioContextRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;

      const ctx = new AudioCtxClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
    }

    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (err) {
        console.warn('Failed to resume AudioContext:', err);
      }
    }

    // Attach HTMLAudioElement once
    if (!audioElRef.current) {
      const audioEl = new Audio();
      audioEl.crossOrigin = 'anonymous';
      audioElRef.current = audioEl;

      if (!mediaElementSourceRef.current && audioContextRef.current && analyserRef.current) {
        try {
          const source = audioContextRef.current.createMediaElementSource(audioEl);
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          mediaElementSourceRef.current = source;
        } catch (e) {
          console.warn('Could not create MediaElementSource:', e);
        }
      }
    }

    return audioContextRef.current;
  }, []);

  // Pre-warmed microphone stream: opened once and kept alive with track.enabled
  const getOrCreateStream = useCallback(async (): Promise<MediaStream> => {
    if (micStreamRef.current) {
      const tracks = micStreamRef.current.getAudioTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        return micStreamRef.current;
      }
    }

    await ensureAudioContext();

    // Specific constraints: echoCancellation: true, noiseSuppression: false, autoGainControl: false, mono (channelCount: 1)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });

    micStreamRef.current = stream;

    // Connect mic to analyser for visualizer and energy/peak measurements
    if (audioContextRef.current && analyserRef.current) {
      if (micSourceRef.current) {
        try {
          micSourceRef.current.disconnect();
        } catch {}
      }
      const micSource = audioContextRef.current.createMediaStreamSource(stream);
      micSource.connect(analyserRef.current);
      micSourceRef.current = micSource;
    }

    const deviceLabel = stream.getAudioTracks()[0]?.label || 'Default microphone';
    console.log(
      `[VOICE] Microphone stream acquired (${deviceLabel}), mono, echoCancellation=true, noiseSuppression=false, AGC=false`
    );

    return stream;
  }, [ensureAudioContext]);

  // Warm stream on demand (e.g. entering Voice mode or on initial render)
  const warmStream = useCallback(async () => {
    if (!micSupported) return;
    try {
      const stream = await getOrCreateStream();
      // Keep tracks disabled between recordings so no audio leaks
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      console.log('[VOICE] Stream pre-warmed and ready');
    } catch (err) {
      console.warn('[VOICE] Pre-warming stream deferred to user tap:', err);
    }
  }, [micSupported, getOrCreateStream]);

  // Visualizer loop for energyRef (used by AIOrb & SiriWave) and peak/average detection
  const startVisualizer = useCallback(() => {
    if (rafIdRef.current) return;

    const tick = () => {
      const analyser = analyserRef.current;
      if (analyser) {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buffer);

        let sum = 0;
        let max = 0;
        for (let i = 0; i < buffer.length; i++) {
          const val = buffer[i];
          sum += val;
          if (val > max) max = val;
        }
        const avg = sum / buffer.length / 255;
        const peak = max / 255;

        // Boost amplitude to 0..1 dynamic range
        energyRef.current = Math.min(1.0, avg * 2.4);

        // Accumulate running statistics
        totalEnergySumRef.current += avg;
        totalEnergyCountRef.current += 1;

        // Track peak audio level across recording session
        if (peak > peakLevelRef.current) {
          peakLevelRef.current = peak;
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const stopVisualizer = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Smoothly decay energy to 0
    let current = energyRef.current;
    if (current > 0.05) {
      const decay = () => {
        current *= 0.8;
        energyRef.current = current;
        if (current > 0.02) {
          requestAnimationFrame(decay);
        } else {
          energyRef.current = 0;
        }
      };
      requestAnimationFrame(decay);
    } else {
      energyRef.current = 0;
    }
  }, []);

  // Completely release hardware mic stream (e.g. unmount)
  const releaseStream = useCallback(() => {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }

    if (micSourceRef.current) {
      try {
        micSourceRef.current.disconnect();
      } catch {}
      micSourceRef.current = null;
    }

    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      micStreamRef.current = null;
    }
  }, []);

  // Cleanup on unmount or mode switch
  const cleanupNodes = useCallback(() => {
    isStoppingRef.current = false;
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;

    // Between sessions: mute track to preserve privacy, keep stream alive
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsListening(false);
    setIsSpeaking(false);
    stopVisualizer();
  }, [stopVisualizer]);

  // Stop recording with 500ms trailing tail and return RecordingResult
  const stopRecording = useCallback((): Promise<RecordingResult | null> => {
    if (isStoppingRef.current) {
      return Promise.resolve(null);
    }
    isStoppingRef.current = true;

    return new Promise((resolve) => {
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        if (micStreamRef.current) {
          micStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
        }
        setIsListening(false);
        stopVisualizer();
        isStoppingRef.current = false;
        resolve(null);
        return;
      }

      // TAIL: Keep recording ~500ms after the stop tap, so the end of the sentence is not cut off
      setTimeout(() => {
        try {
          if (recorder.state === 'recording') {
            // Request any pending data to guarantee final chunk is in recordedChunks
            try {
              recorder.requestData();
            } catch {}

            stopResolverRef.current = (res: RecordingResult | null) => {
              isStoppingRef.current = false;
              resolve(res);
            };

            recorder.stop();
          } else {
            isStoppingRef.current = false;
            resolve(null);
          }
        } catch {
          isStoppingRef.current = false;
          resolve(null);
        }
      }, 500);
    });
  }, [stopVisualizer]);

  // Keep stopRecordingRef in sync
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  // Start recording microphone
  const startRecording = useCallback(async () => {
    setError(null);
    if (!micSupported) {
      setError({ friendly: 'Microphone access is not supported in this browser.' });
      return;
    }

    try {
      const stream = await getOrCreateStream();

      // Enable track immediately from pre-warmed stream
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      // Brief pre-roll settling delay (~80ms) to ensure track buffer is streaming
      await new Promise((r) => setTimeout(r, 80));

      // Verify track is live and enabled
      const liveTrack = stream.getAudioTracks().find((t) => t.readyState === 'live' && t.enabled);
      if (!liveTrack) {
        throw new Error('Microphone track is not live or enabled');
      }

      // Check supported mime type for MediaRecorder
      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      peakLevelRef.current = 0;
      totalEnergySumRef.current = 0;
      totalEnergyCountRef.current = 0;
      recordingStartTimeRef.current = performance.now();
      isStoppingRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Between recordings: mute track to preserve privacy, keep stream alive
        if (micStreamRef.current) {
          micStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
        }
        setIsListening(false);
        stopVisualizer();

        const blobType = recorder.mimeType || 'audio/webm';
        const finalBlob = new Blob(recordedChunksRef.current, { type: blobType });

        const durationMs = performance.now() - recordingStartTimeRef.current;
        const peakLevel = peakLevelRef.current;
        const avgLevel =
          totalEnergyCountRef.current > 0
            ? totalEnergySumRef.current / totalEnergyCountRef.current
            : 0;
        const deviceLabel = micStreamRef.current?.getAudioTracks()[0]?.label || 'Default microphone';

        // Log blob size and duration
        console.log(
          `[VOICE] Recorded blob built: ${(finalBlob.size / 1024).toFixed(1)} KB, ${(
            durationMs / 1000
          ).toFixed(2)}s, peak: ${peakLevel.toFixed(3)}, avg: ${avgLevel.toFixed(3)}`
        );

        // Debug mode handling: play back exact blob and log telemetry
        if (isDebugAudio()) {
          console.log(`[VOICE] Device: ${deviceLabel}`);
          console.log(
            `[VOICE] Duration: ${(durationMs / 1000).toFixed(2)}s | Size: ${(
              finalBlob.size / 1024
            ).toFixed(1)} KB (${finalBlob.size} bytes)`
          );
          console.log(
            `[VOICE] Peak level: ${peakLevel.toFixed(3)} | Avg level: ${avgLevel.toFixed(3)}`
          );
          try {
            const url = URL.createObjectURL(finalBlob);
            const debugAudio = new Audio(url);
            debugAudio.onended = () => URL.revokeObjectURL(url);
            debugAudio.play().catch((err) => console.warn('[VOICE] Playback error:', err));
          } catch (e) {
            console.warn('[VOICE] Playback error:', e);
          }
        }

        if (stopResolverRef.current) {
          stopResolverRef.current({
            blob: finalBlob,
            durationMs,
            peakLevel,
            avgLevel,
            deviceLabel,
          });
          stopResolverRef.current = null;
        }
      };

      // Start MediaRecorder with 250ms timeslice
      recorder.start(250);

      // Show LISTENING (and speak now cue) ONLY from this moment
      setIsListening(true);
      startVisualizer();

      // Auto-stop recording after 20 seconds
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
      }
      autoStopTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          if (onAutoStopRef.current) {
            onAutoStopRef.current();
          } else if (stopRecordingRef.current) {
            stopRecordingRef.current();
          }
        }
      }, 20000);
    } catch (err: any) {
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsListening(false);
      stopVisualizer();
      isStoppingRef.current = false;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError({
          friendly: 'Microphone access was denied. Please allow microphone permissions in browser settings.',
          details: err.message,
        });
      } else {
        setError(formatFriendlyError(err));
      }
      throw err;
    }
  }, [micSupported, getOrCreateStream, stopVisualizer, startVisualizer, stopRecording, isDebugAudio]);

  // Cancel recording without returning blob
  const cancelRecording = useCallback(() => {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    stopResolverRef.current = null;
    isStoppingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    setIsListening(false);
    stopVisualizer();
  }, [stopVisualizer]);

  // Play ElevenLabs base64 MP3 audio
  const playAudio = useCallback(
    async (base64Audio: string) => {
      if (!base64Audio) return;

      try {
        await ensureAudioContext();
        const audioEl = audioElRef.current;
        if (!audioEl) return;

        // Cancel previous audio if playing
        audioEl.pause();
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        audioEl.src = `data:audio/mp3;base64,${base64Audio}`;
        setIsSpeaking(true);
        startVisualizer();

        audioEl.onended = () => {
          setIsSpeaking(false);
          stopVisualizer();
        };

        audioEl.onerror = () => {
          setIsSpeaking(false);
          stopVisualizer();
        };

        await audioEl.play();
      } catch (err: any) {
        setIsSpeaking(false);
        stopVisualizer();
        console.warn('Audio playback error:', err);
      }
    },
    [ensureAudioContext, startVisualizer, stopVisualizer]
  );

  // Fallback to browser SpeechSynthesis when audio is null (quota / error)
  const speakFallback = useCallback(
    (text: string) => {
      if (!ttsSupported || !text) return;

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 0.85;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en')) ||
          voices.find((v) => v.name.toLowerCase().includes('male') && v.lang.startsWith('en')) ||
          voices.find((v) => v.lang.startsWith('en'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          energyRef.current = 0.8;
          startVisualizer();
        };

        utterance.onboundary = () => {
          energyRef.current = 1.0;
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          stopVisualizer();
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
          stopVisualizer();
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('SpeechSynthesis error:', e);
        setIsSpeaking(false);
        stopVisualizer();
      }
    },
    [ttsSupported, startVisualizer, stopVisualizer]
  );

  // Cancel playback or speech synthesis
  const cancelPlayback = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    stopVisualizer();
  }, [stopVisualizer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupNodes();
      releaseStream();
    };
  }, [cleanupNodes, releaseStream]);

  return {
    isListening,
    isSpeaking,
    energyRef,
    micSupported,
    ttsSupported,
    warmStream,
    startRecording,
    stopRecording,
    cancelRecording,
    playAudio,
    speakFallback,
    cancelPlayback,
    error,
    clearError: () => setError(null),
    cleanupNodes,
  };
}
