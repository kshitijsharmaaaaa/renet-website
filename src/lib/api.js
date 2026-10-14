// Base URL of the RENET backend. Empty in development (Vite proxies /api);
// set VITE_CHAT_API_URL in production if the API lives on another domain.
export const API_BASE = (import.meta.env.VITE_CHAT_API_URL || "").replace(/\/$/, "");
