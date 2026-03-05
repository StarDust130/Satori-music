import { clsx, type ClassValue } from "clsx";

// Lightweight clsx alternative (no twMerge needed for this project)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Generate a unique client ID for localStorage
export function generateClientId(): string {
  return `gq_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Format seconds to mm:ss
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "…";
}
