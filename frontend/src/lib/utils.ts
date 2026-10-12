import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.platform || '');

export const modKey = isMac ? '⌘' : 'Ctrl';
export const modKeyLabel = isMac ? '⌘' : 'Ctrl ';

