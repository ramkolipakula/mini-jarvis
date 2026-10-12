import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';

import { AIOrb } from '@/components/AIOrb';
import { CommandBar } from '@/components/CommandBar';
import { TranscriptMessage } from '@/components/TranscriptMessage';
import { ThinkingIndicator } from '@/components/ThinkingIndicator';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { SiriWave } from '@/components/SiriWave';
import { VoiceMode } from '@/components/VoiceMode';
import { IntroSequence } from '@/components/IntroSequence';
import { SparklesCore } from '@/components/ui/sparkles';
import { PixelStars } from '@/components/ui/pixel-stars';
import { SettingsModal } from '@/components/SettingsModal';
import { CommandPalette } from '@/components/CommandPalette';
import type { OrbParticlesHandle } from '@/components/OrbParticles';
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useSettings } from '@/hooks/useSettings';
import { checkHealth, isMockMode, transcribeAudio, formatFriendlyError, type FormattedError } from '@/lib/api';
import type { OrbState } from '@/types';

function getDateLabel(timestamp: number) {
  const d = new Date(timestamp);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'TODAY';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [uiRevealed, setUiRevealed] = useState(false);
  const [firstSendBrighten, setFirstSendBrighten] = useState(false);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isScrolledTop, setIsScrolledTop] = useState(false);
  const [isIdleBreathing, setIsIdleBreathing] = useState(false);

  // Backend connection status
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'mock'>('online');

  // Voice transcript & state
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<FormattedError | null>(null);
  const [lastVoiceBlob, setLastVoiceBlob] = useState<Blob | null>(null);

  const { settings, updateSetting, isReducedMotion } = useSettings();
  const [autoSpeak, setAutoSpeak] = useState(settings.autoVoice);

  // Synchronize autoVoice setting
  useEffect(() => {
    setAutoSpeak(settings.autoVoice);
  }, [settings.autoVoice]);

  const handleToggleMicRef = useRef<() => void>(() => {});

  // Audio Engine (Web Audio AnalyserNode, MediaRecorder, Base64 MP3, SpeechSynthesis fallback)
  const audioEngine = useAudioEngine({
    onAutoStop: () => {
      handleToggleMicRef.current();
    },
  });

  const {
    conversations,
    activeConversation,
    activeId,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    togglePinConversation,
    updateMessages,
    setBackendConversationId,
    clearAllConversations,
  } = useConversations();

  // Assistant reply callback: automatically triggers TTS playback if autoSpeak or voice mode
  const handleAssistantReply = useCallback(
    ({ text, audio }: { text: string; audio: string | null; messageId: string }) => {
      if (autoSpeak || mode === 'voice') {
        if (audio) {
          audioEngine.playAudio(audio);
        } else {
          // If audio is null (quota / error), gracefully fall back to browser speech synthesis
          audioEngine.speakFallback(text);
        }
      }
    },
    [autoSpeak, mode, audioEngine]
  );

  const {
    messages,
    isThinking,
    error: chatError,
    lastFailedMessage,
    sendMessage,
    retry,
    clearError: clearChatError,
    setMessages,
  } = useChat(activeConversation?.messages ?? [], {
    backendConversationId: activeConversation?.backendId,
    onBackendIdReceived: (backendId) => {
      if (activeId) setBackendConversationId(activeId, backendId);
    },
    onAssistantReply: handleAssistantReply,
  });

  // Health check polling
  useEffect(() => {
    if (isMockMode()) {
      setBackendStatus('mock');
      return;
    }

    let isMounted = true;
    const check = async () => {
      const ok = await checkHealth();
      if (isMounted) {
        setBackendStatus(ok ? 'online' : 'offline');
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Update backend status if chat encounters network failure
  useEffect(() => {
    if (!chatError) return;
    const errorText = `${chatError.friendly} ${chatError.details || ''}`.toLowerCase();
    if (
      errorText.includes("can't reach jarvis core") ||
      errorText.includes('unable to connect') ||
      errorText.includes('failed to fetch') ||
      errorText.includes('network')
    ) {
      setBackendStatus('offline');
    }
  }, [chatError]);

  // Determine if user has initiated conversation in this session
  const hasUserMessages = messages.some((m) => m.role === 'user');
  const [isPinned, setIsPinned] = useState(hasUserMessages);

  useEffect(() => {
    if (!hasUserMessages) {
      setIsPinned(false);
    } else {
      setIsPinned(true);
    }
  }, [hasUserMessages]);

  // Smooth 600ms orb morphing between hero (220px), voice mode (260px) and pinned top (110px)
  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
  const heroSize = isDesktop ? 220 : 180;
  const pinnedSize = isDesktop ? 110 : 90;
  const voiceSize = isDesktop ? 352 : 288;
  const targetSize = mode === 'voice' ? voiceSize : isPinned ? pinnedSize : heroSize;

  const [animatedOrbSize, setAnimatedOrbSize] = useState(targetSize);

  useEffect(() => {
    if (animatedOrbSize === targetSize) return;
    const startSize = animatedOrbSize;
    const diff = targetSize - startSize;
    const startTime = performance.now();
    const duration = isReducedMotion ? 200 : 600;
    let animId = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setAnimatedOrbSize(Math.round(startSize + diff * ease));
      if (t < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [targetSize, isReducedMotion]);

  const orbParticlesRef = useRef<OrbParticlesHandle>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastInteractionRef = useRef(performance.now());

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Idle 20-second breathing glow on the orb
  useEffect(() => {
    const markInteraction = () => {
      lastInteractionRef.current = performance.now();
      setIsIdleBreathing(false);
    };

    window.addEventListener('pointermove', markInteraction, { passive: true });
    window.addEventListener('keydown', markInteraction, { passive: true });
    window.addEventListener('touchstart', markInteraction, { passive: true });
    window.addEventListener('focus', markInteraction, { passive: true });

    const interval = setInterval(() => {
      const now = performance.now();
      if (
        now - lastInteractionRef.current >= 20000 &&
        !audioEngine.isSpeaking &&
        !audioEngine.isListening &&
        !isThinking &&
        !isTranscribing
      ) {
        setIsIdleBreathing(true);
      }
    }, 1000);

    return () => {
      window.removeEventListener('pointermove', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('touchstart', markInteraction);
      window.removeEventListener('focus', markInteraction);
      clearInterval(interval);
    };
  }, [audioEngine.isSpeaking, audioEngine.isListening, isThinking, isTranscribing]);

  // Cursor-follow spotlight: update CSS variables --mouse-x, --mouse-y
  useEffect(() => {
    let rafId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        rafId = null;
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Global hotkeys (Ctrl+K, F, Esc)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key.toLowerCase() === 'f' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (e.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (sidebarOpen) setSidebarOpen(false);
        else if (mode === 'voice') handleSwitchMode('chat');
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [paletteOpen, settingsOpen, sidebarOpen, toggleFullscreen, mode]);

  // Sync messages from useChat back into conversation storage
  useEffect(() => {
    if (activeId && messages.length > 0) {
      updateMessages(activeId, messages);
    }
  }, [messages, activeId, updateMessages]);

  // When switching conversations, load their messages into the chat hook
  useEffect(() => {
    if (activeConversation) {
      setMessages(activeConversation.messages);
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine orb state
  const isTyping = inputValue.trim().length > 0;
  const orbState: OrbState = useMemo(() => {
    if (audioEngine.isListening) return 'listening';
    if (isThinking || isTranscribing) return 'thinking';
    if (audioEngine.isSpeaking) return 'speaking';
    if (isTyping && mode === 'chat') return 'listening';
    return 'idle';
  }, [audioEngine.isListening, isThinking, isTranscribing, audioEngine.isSpeaking, isTyping, mode]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (isPinned && mode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, isPinned, mode]);

  const handleTranscriptScroll = () => {
    const el = transcriptContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBottom(!isNearBottom);
    setIsScrolledTop(el.scrollTop > 10);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isThinking || isTranscribing) return;

    if (!hasUserMessages) {
      setFirstSendBrighten(true);
      setTimeout(() => {
        setFirstSendBrighten(false);
        setIsPinned(true);
      }, 1000);
    } else {
      setIsPinned(true);
    }

    orbParticlesRef.current?.burst(1.0);
    sendMessage(text);
    if (!textToSend) setInputValue('');
  };

  // Microphone toggle lock to prevent rapid double-clicks
  const isTogglingMicRef = useRef(false);

  // Unified microphone toggle handler for both Voice mode and Chat mode
  const handleToggleMic = useCallback(async () => {
    if (isTogglingMicRef.current) return;
    isTogglingMicRef.current = true;

    try {
      if (audioEngine.isListening) {
        orbParticlesRef.current?.burst(0.33);
        const result = await audioEngine.stopRecording();
        if (!result || !result.blob) {
          isTogglingMicRef.current = false;
          return;
        }

        const { blob, durationMs, peakLevel } = result;

        // GUARD 1: If recording is shorter than 0.8s, or peak level stayed below threshold (silent/empty), do not send
        if (durationMs < 800 || peakLevel < 0.04 || blob.size < 1500) {
          const promptMsg = "I didn't hear anything. Try again?";
          showToast(promptMsg);
          setVoiceTranscript(promptMsg);
          setVoiceError({ friendly: promptMsg });
          setLastVoiceBlob(null);
          isTogglingMicRef.current = false;
          return;
        }

        setLastVoiceBlob(blob);
        setIsTranscribing(true);
        setVoiceError(null);
        setVoiceTranscript('Transcribing audio...');

        let transcriptText = '';
        if (isMockMode()) {
          transcriptText = 'Hello JARVIS, run diagnostic telemetry check';
        } else {
          const res = await transcribeAudio(blob);
          transcriptText = (res.text || '').trim();
        }

        setIsTranscribing(false);

        // GUARD 2: Whisper hallucination guard
        // If transcript is "Thank you." or "Thanks for watching." and peak level was low, treat as empty
        const normalized = transcriptText.toLowerCase().replace(/[.,!?;:]+$/, '').trim();
        const isHallucination =
          (normalized === 'thank you' ||
            normalized === 'thanks for watching' ||
            normalized === 'thank you for watching' ||
            normalized === 'thanks') &&
          peakLevel < 0.14;

        if (!transcriptText || isHallucination) {
          const promptMsg = "I didn't hear anything. Try again?";
          showToast(promptMsg);
          setVoiceTranscript(promptMsg);
          setVoiceError({ friendly: promptMsg });
          setLastVoiceBlob(null);
          isTogglingMicRef.current = false;
          return;
        }

        setVoiceTranscript(transcriptText);

        if (mode === 'chat') {
          setInputValue(transcriptText);
          handleSend(transcriptText);
        } else {
          handleSend(transcriptText);
        }
      } else {
        setVoiceError(null);
        setVoiceTranscript('');
        await audioEngine.startRecording();
      }
    } catch (err: any) {
      setIsTranscribing(false);
      const formatted = formatFriendlyError(err);
      setVoiceError(formatted);
      showToast(formatted.friendly);
    } finally {
      isTogglingMicRef.current = false;
    }
  }, [audioEngine, mode, handleSend, showToast]);

  // Keep ref up to date for 20s auto-stop
  useEffect(() => {
    handleToggleMicRef.current = handleToggleMic;
  }, [handleToggleMic]);

  // Retry voice transcription or restart recording
  const handleRetryVoice = async () => {
    if (lastVoiceBlob) {
      try {
        setIsTranscribing(true);
        setVoiceError(null);
        setVoiceTranscript('Retrying transcription...');
        const res = await transcribeAudio(lastVoiceBlob);
        setIsTranscribing(false);
        const cleanText = (res.text || '').trim();
        const normalized = cleanText.toLowerCase().replace(/[.,!?;:]+$/, '').trim();
        const isHallucination =
          normalized === 'thank you' ||
          normalized === 'thanks for watching' ||
          normalized === 'thank you for watching' ||
          normalized === 'thanks';

        if (cleanText && !isHallucination) {
          setVoiceTranscript(cleanText);
          handleSend(cleanText);
        } else {
          const promptMsg = "I didn't hear anything. Try again?";
          setVoiceTranscript(promptMsg);
          setVoiceError({ friendly: promptMsg });
          setLastVoiceBlob(null);
        }
      } catch (err: any) {
        setIsTranscribing(false);
        setVoiceError(formatFriendlyError(err));
      }
    } else {
      handleToggleMic();
    }
  };

  // Interrupt speech playback
  const handleCancelSpeech = () => {
    audioEngine.cancelPlayback();
    showToast('Speech interrupted');
  };

  // Clean mode switcher (prevents leaks)
  const handleSwitchMode = (newMode: 'chat' | 'voice') => {
    if (newMode === mode) return;
    audioEngine.cleanupNodes();
    setVoiceTranscript('');
    setVoiceError(null);
    setMode(newMode);
    if (newMode === 'voice') {
      audioEngine.warmStream();
    }
    showToast(`Switched to ${newMode.toUpperCase()} mode`);
  };

  // Pre-warm microphone stream if starting in Voice mode
  useEffect(() => {
    if (mode === 'voice') {
      audioEngine.warmStream();
    }
  }, [mode, audioEngine]);

  const handleSpeak = (text: string, audio?: string | null) => {
    if (audio) {
      audioEngine.playAudio(audio);
    } else {
      audioEngine.speakFallback(text);
    }
  };

  const handleRegenerate = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  };

  // Active error across chat, audio, and voice
  const activeError = chatError || audioEngine.error || voiceError;

  // Single shared orb node across Chat and Voice modes
  const orbNode = (
    <AIOrb
      state={orbState}
      size={animatedOrbSize}
      particlesRef={orbParticlesRef}
      inputLevel={audioEngine.isListening ? audioEngine.energyRef.current : 0}
      outputLevel={audioEngine.isSpeaking ? audioEngine.energyRef.current : 0}
      showHousing={uiRevealed}
      brighten={firstSendBrighten}
      idleGlow={isIdleBreathing}
      quality={settings.effects}
    />
  );

  return (
    <>
      {/* Cinematic Intro overlay */}
      <AnimatePresence>
        {!uiRevealed && (
          <IntroSequence
            onComplete={() => setUiRevealed(true)}
            onSwirlToOrb={() => orbParticlesRef.current?.playIntro()}
          />
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl glass-surface-strong border border-[var(--hairline-bright)] text-xs font-mono text-[var(--accent)] shadow-2xl flex items-center gap-2 pointer-events-none ${
              mode === 'voice' ? 'bottom-28' : 'top-16'
            }`}
            initial={{ opacity: 0, y: mode === 'voice' ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: mode === 'voice' ? 10 : -10 }}
            transition={{ duration: 0.18 }}
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Atmospheric Pixel Stars Backdrop */}
      <PixelStars
        active={uiRevealed && settings.backdrop && settings.effects !== 'reduced'}
        opacity={0.28}
      />

      {/* Ambient sparkles layer behind orb stage */}
      {settings.sparkles && settings.effects !== 'reduced' && (
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
          style={{
            opacity: uiRevealed ? (audioEngine.isSpeaking ? 0.95 : 0.7) : 0,
            WebkitMaskImage:
              'radial-gradient(circle 420px at 50% 28%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 60%, transparent 85%)',
            maskImage:
              'radial-gradient(circle 420px at 50% 28%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 60%, transparent 85%)',
          }}
        >
          <SparklesCore
            id="jarvis-sparkles-ambient"
            background="transparent"
            minSize={0.6}
            maxSize={1.6}
            particleDensity={38}
            className="w-full h-full"
            particleColor={settings.theme === 'light' ? '#0891b2' : '#38bdf8'}
            speed={0.5}
          />
        </div>
      )}

      {/* Immersive Voice Mode */}
      <AnimatePresence>
        {mode === 'voice' && (
          <VoiceMode
            orbElement={orbNode}
            state={orbState}
            isListening={audioEngine.isListening}
            isSpeaking={audioEngine.isSpeaking}
            transcript={voiceTranscript}
            lastAssistantMessage={
              [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? ''
            }
            energyRef={audioEngine.energyRef}
            onToggleMic={handleToggleMic}
            onCancelSpeech={handleCancelSpeech}
            onExit={() => handleSwitchMode('chat')}
            micSupported={audioEngine.micSupported}
            errorMessage={voiceError || activeError}
            onRetry={lastVoiceBlob ? handleRetryVoice : lastFailedMessage ? retry : handleToggleMic}
          />
        )}
      </AnimatePresence>

      {/* Application Shell */}
      <div
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--bg)] text-[var(--text-main)] transition-opacity duration-250 spotlight-surface"
        style={{ opacity: uiRevealed ? 1 : 0, pointerEvents: uiRevealed ? 'auto' : 'none' }}
      >
        {/* Sidebar */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          conversations={conversations}
          activeId={activeId}
          onNewChat={() => {
            newConversation();
            setIsPinned(false);
            setSidebarOpen(false);
          }}
          onSelect={(id) => {
            selectConversation(id);
            setSidebarOpen(false);
          }}
          onDelete={(id) => {
            deleteConversation(id);
            showToast('Conversation deleted');
          }}
          onRename={renameConversation}
          onTogglePin={togglePinConversation}
          onOpenSettings={() => setSettingsOpen(true)}
          backendStatus={backendStatus}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 h-[100dvh] max-h-[100dvh] overflow-hidden pb-2 sm:pb-3">
          {/* Header */}
          <Header
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            sidebarOpen={sidebarOpen}
            mode={mode}
            onToggleMode={handleSwitchMode}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            backendStatus={backendStatus}
          />

          {/* Middle Stage: Orb Stage + Transcript */}
          {mode === 'chat' && (
            <div
              className={`flex flex-col items-center justify-center shrink-0 w-full transition-all duration-500 ease-out select-none ${
                isPinned ? 'pt-2 pb-1' : 'flex-1 min-h-0 py-6 justify-center'
              }`}
            >
              {orbNode}

              {/* Siri wave & auto-voice toggle under orb */}
              <div className="flex flex-col items-center w-full mt-2">
                <SiriWave
                  state={orbState}
                  active={audioEngine.isSpeaking || audioEngine.isListening}
                  energyRef={audioEngine.energyRef}
                  height={isPinned ? 44 : 56}
                  className="max-w-[360px]"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => {
                      const next = !autoSpeak;
                      setAutoSpeak(next);
                      updateSetting('autoVoice', next);
                      showToast(next ? 'Auto voice enabled' : 'Auto voice disabled');
                    }}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono tracking-wider uppercase transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      autoSpeak
                        ? 'border-[var(--accent)] bg-[var(--user-tint)] text-[var(--accent)] shadow-sm'
                        : 'border-[var(--hairline)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--hairline-bright)]'
                    }`}
                    aria-label="Toggle automatic voice responses"
                    aria-pressed={autoSpeak}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        autoSpeak
                          ? 'bg-[var(--accent)] animate-pulse shadow-[0_0_6px_var(--accent-glow)]'
                          : 'bg-[var(--text-muted)]'
                      }`}
                    />
                    Auto Voice
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transcript region */}
          {isPinned && mode === 'chat' && (
            <div className="relative flex-1 min-h-0 w-full max-w-[760px] mx-auto px-4 md:px-6">
              <div
                ref={transcriptContainerRef}
                onScroll={handleTranscriptScroll}
                className="h-full overflow-y-auto pt-8 pb-6 space-y-3 focus-visible:ring-0"
                style={
                  isScrolledTop
                    ? {
                        WebkitMaskImage:
                          'linear-gradient(to bottom, transparent 0%, black 28px, black calc(100% - 24px), transparent 100%)',
                        maskImage:
                          'linear-gradient(to bottom, transparent 0%, black 28px, black calc(100% - 24px), transparent 100%)',
                      }
                    : {
                        WebkitMaskImage:
                          'linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)',
                        maskImage:
                          'linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)',
                      }
                }
                tabIndex={0}
                aria-label="Conversation transcript"
              >
                {messages.map((msg, index) => {
                  const prevMsg = messages[index - 1];
                  const showDateSeparator =
                    !prevMsg ||
                    new Date(prevMsg.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();

                  const isLatestAssistant =
                    msg.role === 'assistant' && index === messages.length - 1;

                  return (
                    <div key={msg.id}>
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-4 select-none">
                          <span className="px-3 py-0.5 rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)] font-mono text-[9px] tracking-widest text-[var(--text-muted)] uppercase font-semibold">
                            {getDateLabel(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      <TranscriptMessage
                        message={msg}
                        isLatestAssistant={isLatestAssistant}
                        onSpeak={handleSpeak}
                        onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
                        onCopyToast={showToast}
                      />
                    </div>
                  );
                })}

                {/* Orbiting micro-orb while thinking or transcribing */}
                <AnimatePresence>
                  {(isThinking || isTranscribing) && <ThinkingIndicator />}
                </AnimatePresence>

                {/* In-transcript error message with Retry action */}
                {activeError && (
                  <div className="flex justify-center my-3">
                    <div className="px-4 py-2.5 rounded-xl bg-[var(--user-tint)] border border-rose-500/50 text-rose-300 text-xs font-mono flex flex-col gap-1.5 shadow-md max-w-[560px] w-full">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{activeError.friendly}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              if (lastVoiceBlob) handleRetryVoice();
                              else if (lastFailedMessage) retry();
                              else handleToggleMic();
                            }}
                            className="px-2.5 py-1 rounded-md border border-rose-400 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold transition-colors"
                          >
                            Retry
                          </button>
                          <button
                            onClick={() => {
                              clearChatError();
                              audioEngine.clearError();
                              setVoiceError(null);
                            }}
                            className="underline opacity-70 hover:opacity-100 text-[11px]"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                      {activeError.details && (
                        <details className="text-[10px] text-rose-400/80 cursor-pointer pt-0.5 border-t border-rose-500/20 mt-0.5">
                          <summary className="hover:underline select-none">Details</summary>
                          <div className="mt-1 p-1.5 rounded bg-black/40 font-mono break-all text-[9px] text-rose-200/90 max-h-24 overflow-y-auto">
                            {activeError.details}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Scroll to bottom button */}
              <AnimatePresence>
                {showScrollBottom && (
                  <motion.button
                    onClick={scrollToBottom}
                    className="absolute right-8 bottom-6 p-2 rounded-full border border-[var(--hairline-bright)] bg-[var(--bg-glass-strong)] hover:bg-[var(--user-tint)] text-[var(--accent)] shadow-lg backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    aria-label="Scroll to newest message"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Command Bar */}
          {mode === 'chat' && (
            <CommandBar
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSend}
              disabled={isThinking || isTranscribing}
              micSupported={audioEngine.micSupported}
              isListening={audioEngine.isListening}
              onToggleMic={handleToggleMic}
              onSwitchToVoice={() => handleSwitchMode('voice')}
              showSuggestions={!isPinned}
              backendStatus={backendStatus}
            />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSetting={updateSetting}
        onReplayIntro={() => {
          setUiRevealed(false);
          showToast('Replaying intro sequence');
        }}
        onClearConversations={() => {
          clearAllConversations();
          setMessages([]);
          setIsPinned(false);
        }}
        onShowToast={showToast}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewChat={() => {
          newConversation();
          setIsPinned(false);
          showToast('New conversation started');
        }}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onToggleTheme={() => {
          const next = settings.theme === 'dark' ? 'light' : 'dark';
          updateSetting('theme', next);
          showToast(`Theme changed to ${next}`);
        }}
        currentMode={mode}
        onToggleMode={handleSwitchMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onReplayIntro={() => {
          setUiRevealed(false);
          showToast('Replaying intro sequence');
        }}
        onToggleFullscreen={toggleFullscreen}
        conversations={conversations}
        onSelectConversation={(id) => {
          selectConversation(id);
          setIsPinned(true);
        }}
      />
    </>
  );
}

export default App;
