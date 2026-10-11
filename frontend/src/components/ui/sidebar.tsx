import React, { createContext, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>> | ((open: boolean) => void);
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>> | ((open: boolean) => void);
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  // Handle Escape key to close sidebar
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>> | ((open: boolean) => void);
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof motion.aside>, 'children'> & {
  children?: React.ReactNode;
}) => {
  const { open, setOpen, animate } = useSidebar();

  return (
    <>
      {/* Mobile & click-outside backdrop overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar slide panel - hover expand intentionally disabled per requirement */}
      <motion.aside
        className={cn(
          'fixed md:relative z-40 h-full overflow-hidden shrink-0 transition-opacity',
          open ? 'pointer-events-auto' : 'pointer-events-none',
          className
        )}
        initial={false}
        animate={{
          width: animate ? (open ? 280 : 0) : 280,
          opacity: open ? 1 : 0,
          x: typeof window !== 'undefined' && window.innerWidth < 768 ? (open ? 0 : -280) : 0,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: open ? 280 : 0 }}
        aria-hidden={!open}
        {...props}
      >
        <div
          style={{ width: 280 }}
          className="glass-panel hud-frame h-full flex flex-col m-3 rounded-2xl overflow-hidden bg-jarvis-card/90 backdrop-blur-xl border border-jarvis-border/60"
        >
          {children}
        </div>
      </motion.aside>
    </>
  );
};

export const SidebarLink = ({
  label,
  icon,
  active = false,
  onClick,
  onDelete,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-jarvis-cyan/60',
        active
          ? 'bg-jarvis-cyan/10 border border-jarvis-cyan/35 text-jarvis-cyan-bright shadow-[0_0_12px_rgba(34,211,238,0.12)]'
          : 'border border-transparent hover:bg-jarvis-cyan/5 hover:border-jarvis-cyan/20 text-jarvis-slate hover:text-white',
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Select conversation: ${label}`}
    >
      <div className={cn('shrink-0 transition-colors duration-200', active ? 'text-jarvis-cyan-bright' : 'text-jarvis-slate-dim group-hover:text-jarvis-cyan')}>
        {icon}
      </div>
      <span className={cn('flex-1 text-sm truncate font-body transition-colors duration-200', active ? 'text-jarvis-cyan-bright font-medium' : 'text-jarvis-slate group-hover:text-white')}>
        {label}
      </span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-jarvis-slate-dim hover:text-jarvis-cyan-bright hover:bg-jarvis-cyan/20 border border-transparent hover:border-jarvis-cyan/30 transition-all duration-200 focus-visible:opacity-100"
          aria-label={`Delete conversation ${label}`}
        >
          <svg
            className="w-3.5 h-3.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
};
