// Centralized API URL helper
// When frontend is hosted separately (e.g. pxx.app), API calls need to go to the Render backend
export const API_BASE = import.meta.env.VITE_API_URL || "https://quantum-autobot.onrender.com";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
