import type { ColorKey } from '../types';

export const PALETTE: Record<ColorKey, string> = {
  violet: '#8b5cf6',
  indigo: '#6366f1',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  green: '#22c55e',
  lime: '#84cc16',
  yellow: '#eab308',
  amber: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  rose: '#f43f5e',
  pink: '#ec4899',
};

export const COLOR_KEYS = Object.keys(PALETTE) as ColorKey[];

/** Alpha hex par niveau de heatmap (0 = vide, géré en CSS). */
const LEVEL_ALPHA = ['00', '4d', '80', 'b3', 'ff'];

export function levelColor(color: ColorKey, level: 0 | 1 | 2 | 3 | 4): string | undefined {
  if (level === 0) return undefined;
  return PALETTE[color] + LEVEL_ALPHA[level];
}

export const EMOJIS = [
  '🍺', '🍷', '🏋️', '🏃', '🚴', '🧘', '📦', '🛒', '💊', '✅', '📚', '💧', '🚭', '☕', '🍔',
  '🎮', '💤', '🧹', '💰', '📱', '🎸', '✍️', '🥗', '🚶', '🧠', '🦷', '🌿', '🎯', '🔥', '⭐',
];
