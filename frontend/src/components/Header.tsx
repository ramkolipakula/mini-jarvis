import {
  PanelLeft,
  Settings,
  MessageSquare,
  AudioLines,
  Maximize2,
  Minimize2,
  Search,
} from 'lucide-react';
import { isMac } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ActionTooltip } from './ui/tooltip';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  mode: 'chat' | 'voice';
  onToggleMode: (newMode: 'chat' | 'voice') => void;
  onOpenSettings?: () => void;
  onOpenPalette?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  backendStatus?: 'online' | 'offline' | 'mock';
}

export function Header({
  onToggleSidebar,
  sidebarOpen,
  mode,
  onToggleMode,
  onOpenSettings,
  onOpenPalette,
  isFullscreen = false,
  onToggleFullscreen,
  backendStatus = 'online',
}: HeaderProps) {
  return (
    <header className="shrink-0 h-14 border-b border-[var(--hairline)] bg-[var(--bg-panel)] backdrop-blur-xl px-4 md:px-6 flex items-center justify-between z-30 transition-colors duration-300">
      {/* Left section: Hamburger + Wordmark + Status chip */}
      <div className="flex items-center gap-3 md:gap-4">
        <ActionTooltip label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} side="bottom">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-glass)] text-[var(--text-main)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <PanelLeft className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--accent)]" />
          </button>
        </ActionTooltip>

        <div className="flex items-center gap-3">
          <span className="font-display font-semibold text-sm md:text-base tracking-[0.35em] text-[var(--accent)] text-glow select-none">
            J.A.R.V.I.S
          </span>
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendStatus === 'offline'
                  ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)] animate-pulse'
                  : backendStatus === 'mock'
                  ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                  : 'bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)] animate-pulse'
              }`}
            />
            <span
              className={`font-mono text-[9px] tracking-widest uppercase font-semibold ${
                backendStatus === 'offline'
                  ? 'text-rose-400'
                  : backendStatus === 'mock'
                  ? 'text-amber-400'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {backendStatus === 'offline' ? 'OFFLINE' : backendStatus === 'mock' ? 'MOCK' : 'ONLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Right section: Mode toggle + Theme toggle + Settings */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Chat / Voice mode toggle */}
        <div className="flex items-center p-0.5 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] text-xs">
          <ActionTooltip label="Chat mode" side="bottom">
            <button
              onClick={() => onToggleMode('chat')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                mode === 'chat'
                  ? 'bg-[var(--bg-panel)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              aria-label="Switch to Chat mode"
              aria-pressed={mode === 'chat'}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Chat</span>
            </button>
          </ActionTooltip>

          <ActionTooltip label="Voice mode" side="bottom">
            <button
              onClick={() => onToggleMode('voice')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                mode === 'voice'
                  ? 'bg-[var(--bg-panel)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              aria-label="Switch to Voice mode"
              aria-pressed={mode === 'voice'}
            >
              <AudioLines className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Voice</span>
            </button>
          </ActionTooltip>
        </div>

        {/* Command Palette trigger */}
        {onOpenPalette && (
          <ActionTooltip
            label={`Command palette (${isMac ? '⌘K' : 'Ctrl+K'})`}
            side="bottom"
          >
            <button
              onClick={onOpenPalette}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-glass)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all duration-200 text-xs font-mono"
              aria-label="Open command palette"
            >
              <Search className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[10px] tracking-wider">{isMac ? '⌘K' : 'Ctrl K'}</span>
            </button>
          </ActionTooltip>
        )}

        {/* Fullscreen toggle button */}
        {onToggleFullscreen && (
          <ActionTooltip
            label={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
            side="bottom"
          >
            <button
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-glass)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </ActionTooltip>
        )}

        {/* Theme Toggle dropdown */}
        <ThemeToggle />

        {/* Settings gear */}
        <ActionTooltip label="Settings" side="bottom">
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-glass)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </ActionTooltip>
      </div>
    </header>
  );
}
