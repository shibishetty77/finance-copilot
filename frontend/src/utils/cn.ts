/**
 * Class name merger — combines clsx and tailwind-merge.
 * Use for conditional + conflict-free Tailwind class strings.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
