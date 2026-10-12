import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { ActionTooltip } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <div>
          <ActionTooltip label="Change theme" side="bottom">
            <button
              className="relative p-2 rounded-xl border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-glass)] text-[var(--text-main)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Toggle theme"
            >
              <Sun className="w-4 h-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-[var(--accent)]" />
              <Moon className="absolute top-2 left-2 w-4 h-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-[var(--accent)]" />
              <span className="sr-only">Toggle theme</span>
            </button>
          </ActionTooltip>
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[140px] overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--bg-panel)] p-1 text-[var(--text-main)] shadow-xl backdrop-blur-xl animate-in fade-in-80 zoom-in-95"
          sideOffset={8}
          align="end"
        >
          <DropdownMenu.Item
            className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors hover:bg-[var(--user-tint)] hover:text-[var(--accent)] focus:bg-[var(--user-tint)] focus:text-[var(--accent)]"
            onClick={(e) => setTheme('light', e)}
          >
            <Sun className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="flex-1">Light</span>
            {theme === 'light' && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors hover:bg-[var(--user-tint)] hover:text-[var(--accent)] focus:bg-[var(--user-tint)] focus:text-[var(--accent)]"
            onClick={(e) => setTheme('dark', e)}
          >
            <Moon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="flex-1">Dark</span>
            {theme === 'dark' && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors hover:bg-[var(--user-tint)] hover:text-[var(--accent)] focus:bg-[var(--user-tint)] focus:text-[var(--accent)]"
            onClick={(e) => setTheme('system', e)}
          >
            <Monitor className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="flex-1">System</span>
            {theme === 'system' && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
