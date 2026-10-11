import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Zap,
  RotateCcw,
  Trash2,
  Sliders,
  Volume2,
  Eye,
  AlertTriangle,
  Headphones,
} from 'lucide-react';
import type { JarvisSettings, ThemeSetting, EffectsQuality, MotionSetting } from '@/hooks/useSettings';
import { ActionTooltip } from './ui/tooltip';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: JarvisSettings;
  onUpdateSetting: <K extends keyof JarvisSettings>(key: K, value: JarvisSettings[K]) => void;
  onReplayIntro: () => void;
  onClearConversations: () => void;
  onShowToast: (message: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSetting,
  onReplayIntro,
  onClearConversations,
  onShowToast,
}: SettingsModalProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [debugAudio, setDebugAudio] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('jarvis-debug-audio') === '1';
    } catch {
      return false;
    }
  });

  const toggleDebugAudio = () => {
    const next = !debugAudio;
    setDebugAudio(next);
    try {
      localStorage.setItem('jarvis-debug-audio', next ? '1' : '0');
    } catch {}
    onShowToast(next ? 'Audio debug mode enabled ([VOICE] logs + playback)' : 'Audio debug mode disabled');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--hairline-bright)] bg-[var(--bg-panel)] p-6 shadow-2xl backdrop-blur-2xl z-10 text-[var(--text-main)]"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-dialog-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--hairline)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[var(--user-tint)] border border-[var(--hairline)]">
                <Sliders className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div>
                <h2 id="settings-dialog-title" className="font-display font-semibold text-base tracking-wide text-[var(--text-main)]">
                  System Settings
                </h2>
                <p className="text-[11px] font-mono text-[var(--text-muted)]">
                  Configure visual engine & interaction preferences
                </p>
              </div>
            </div>

            <ActionTooltip label="Close (Esc)" side="bottom">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-glass)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </ActionTooltip>
          </div>

          {/* Settings Body */}
          <div className="py-4 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Theme */}
            <div>
              <label className="block text-xs font-mono font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Interface Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'dark', label: 'Dark', icon: Moon },
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'system', label: 'System', icon: Monitor },
                  ] as { id: ThemeSetting; label: string; icon: any }[]
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      onUpdateSetting('theme', id);
                      onShowToast(`Theme set to ${label}`);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      settings.theme === id
                        ? 'border-[var(--accent)] bg-[var(--user-tint)] text-[var(--accent)] shadow-sm'
                        : 'border-[var(--hairline)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--hairline-bright)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Effects Quality */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Visual Fidelity
                </label>
                <span className="text-[10px] font-mono text-[var(--accent)]">
                  {settings.effects.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'full', label: 'Full', desc: 'All shaders & 7K pts' },
                    { id: 'balanced', label: 'Balanced', desc: 'Standard 60fps' },
                    { id: 'reduced', label: 'Reduced', desc: 'DPR 1.5, 3.5K pts' },
                  ] as { id: EffectsQuality; label: string; desc: string }[]
                ).map(({ id, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => {
                      onUpdateSetting('effects', id);
                      onShowToast(`Visual fidelity set to ${label}`);
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl border text-center transition-all ${
                      settings.effects === id
                        ? 'border-[var(--accent)] bg-[var(--user-tint)] text-[var(--accent)] shadow-sm'
                        : 'border-[var(--hairline)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--hairline-bright)]'
                    }`}
                  >
                    <span className="text-xs font-medium">{label}</span>
                    <span className="text-[9px] opacity-75 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>
              {settings.effects === 'reduced' && (
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1.5">
                  Reduced mode caps DPR at 1.5, disables ambient sparkles & backdrop, and halves orb particle density.
                </p>
              )}
            </div>

            {/* Feature Toggles */}
            <div className="space-y-3 pt-1 border-t border-[var(--hairline)]">
              <label className="block text-xs font-mono font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Effects & Audio
              </label>

              {/* Ambient Sparkles */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <div className="text-xs font-medium text-[var(--text-main)]">Ambient Sparkles</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Subtle particle field behind the hero orb</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !settings.sparkles;
                    onUpdateSetting('sparkles', next);
                    onShowToast(next ? 'Sparkles enabled' : 'Sparkles disabled');
                  }}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    settings.sparkles ? 'bg-[var(--accent)]' : 'bg-slate-700'
                  }`}
                  aria-pressed={settings.sparkles}
                  aria-label="Toggle ambient sparkles"
                >
                  <motion.div
                    className="bg-white w-4 h-4 rounded-full shadow-md"
                    animate={{ x: settings.sparkles ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Pixel Stars Backdrop */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-2.5">
                  <Eye className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <div className="text-xs font-medium text-[var(--text-main)]">Pixel Stars Backdrop</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Atmospheric background depth stars</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !settings.backdrop;
                    onUpdateSetting('backdrop', next);
                    onShowToast(next ? 'Backdrop enabled' : 'Backdrop disabled');
                  }}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    settings.backdrop ? 'bg-[var(--accent)]' : 'bg-slate-700'
                  }`}
                  aria-pressed={settings.backdrop}
                  aria-label="Toggle pixel stars backdrop"
                >
                  <motion.div
                    className="bg-white w-4 h-4 rounded-full shadow-md"
                    animate={{ x: settings.backdrop ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Auto Voice Responses */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <div className="text-xs font-medium text-[var(--text-main)]">Auto Voice Responses</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Automatically speak simulated assistant replies</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !settings.autoVoice;
                    onUpdateSetting('autoVoice', next);
                    onShowToast(next ? 'Auto voice enabled' : 'Auto voice disabled');
                  }}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    settings.autoVoice ? 'bg-[var(--accent)]' : 'bg-slate-700'
                  }`}
                  aria-pressed={settings.autoVoice}
                  aria-label="Toggle auto voice responses"
                >
                  <motion.div
                    className="bg-white w-4 h-4 rounded-full shadow-md"
                    animate={{ x: settings.autoVoice ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Audio Debug Mode */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-2.5">
                  <Headphones className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <div className="text-xs font-medium text-[var(--text-main)]">Audio Debug Mode</div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      Plays back recorded audio blob & logs [VOICE] telemetry
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleDebugAudio}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    debugAudio ? 'bg-[var(--accent)]' : 'bg-slate-700'
                  }`}
                  aria-pressed={debugAudio}
                  aria-label="Toggle audio debug mode"
                >
                  <motion.div
                    className="bg-white w-4 h-4 rounded-full shadow-md"
                    animate={{ x: debugAudio ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Reduced Motion Override */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <div className="text-xs font-medium text-[var(--text-main)]">Reduced Motion</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Minimize transitions & shader velocity</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(['system', 'on', 'off'] as MotionSetting[]).map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        onUpdateSetting('reducedMotion', val);
                        onShowToast(`Reduced motion set to ${val}`);
                      }}
                      className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono capitalize transition-all ${
                        settings.reducedMotion === val
                          ? 'border-[var(--accent)] bg-[var(--user-tint)] text-[var(--accent)]'
                          : 'border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions: Replay Intro & Clear History */}
            <div className="space-y-2 pt-2 border-t border-[var(--hairline)]">
              <label className="block text-xs font-mono font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Demonstration & Management
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onReplayIntro();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-glass)] text-xs font-medium text-[var(--text-main)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Replay Intro Sequence</span>
                </button>

                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[var(--hairline)] hover:border-red-500/50 bg-[var(--bg-elevated)] hover:bg-red-500/10 text-xs font-medium text-[var(--text-muted)] hover:text-red-400 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[var(--hairline)] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[#05080e] font-semibold text-xs tracking-wider uppercase hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Done
            </button>
          </div>

          {/* Clear Conversations Confirmation Modal */}
          <AnimatePresence>
            {showClearConfirm && (
              <motion.div
                className="absolute inset-0 bg-[var(--bg-panel)]/95 backdrop-blur-xl p-6 rounded-2xl flex flex-col justify-center items-center text-center z-20"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="p-3 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="font-display font-semibold text-base text-[var(--text-main)] mb-1">
                  Clear All Conversations?
                </h3>
                <p className="text-xs text-[var(--text-muted)] max-w-xs mb-5 font-mono">
                  This will permanently delete all stored chat sessions. This action cannot be undone.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-4 py-2 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-glass)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onClearConversations();
                      setShowClearConfirm(false);
                      onShowToast('All conversations deleted');
                    }}
                    className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors"
                  >
                    Yes, Clear All
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
