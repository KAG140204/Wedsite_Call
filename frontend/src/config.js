// Cấu hình linh hoạt tự động chuyển đổi giữa Local (Máy cá nhân) và Production (Cloudflare)
// Khi đẩy lên Cloudflare Pages, chúng ta sẽ cung cấp biến VITE_API_URL

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787';

// Tự động chuyển đổi HTTP sang WS (WebSocket)
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
