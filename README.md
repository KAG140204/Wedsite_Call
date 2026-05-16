# 🚀 Kaysor Call - Nền tảng Đàm thoại Trực tuyến Thời gian thực

![Kaysor Call Banner](https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop)

## 📖 Giới thiệu dự án
**Kaysor Call** là một hệ thống đàm thoại video và âm thanh theo thời gian thực (Real-time Video/Audio Conferencing) được phát triển dựa trên kiến trúc hiện đại. Dự án hướng tới việc cung cấp một môi trường gọi nhóm ổn định, bảo mật và hiệu suất cao, tận dụng công nghệ **WebRTC** cho việc truyền thông đa phương tiện và **WebSocket** cho hệ thống tín hiệu (Signaling).

Dự án được thiết kế đặc biệt để tối ưu hóa tài nguyên mạng, hỗ trợ đa nền tảng (Desktop & Mobile) và có khả năng xử lý đồng thời nhiều phòng gọi nhờ vào sức mạnh của hạ tầng phân tán **Cloudflare Edge Network**.

---

## ✨ Các tính năng nổi bật

### 🎥 Giao tiếp đa phương tiện (Real-time Communication)
- **Video & Audio Call**: Truyền phát hình ảnh và âm thanh chất lượng cao, độ trễ cực thấp thông qua giao thức P2P (WebRTC/PeerJS).
- **Chia sẻ màn hình (Screen Sharing)**: Cho phép host và người tham gia trình chiếu, chia sẻ cửa sổ làm việc.
- **Tối ưu hóa chạy ngầm (Mobile Optimization)**: Tích hợp thuật toán tự động đình chỉ phần cứng Camera khi ứng dụng bị thu nhỏ (Background) để bảo toàn luồng âm thanh, chống ngắt kết nối trên iOS Safari và tiết kiệm pin.

### 🏠 Quản lý Phòng họp (Room Management)
- **Tạo và Tham gia phòng dễ dàng**: Mã ID phòng độc nhất, tích hợp nút "Copy to Clipboard" một chạm.
- **Hệ thống phân quyền**: Chủ phòng (Host) có đặc quyền quản trị: đổi tên phòng trực tiếp và kích (kick) thành viên vi phạm khỏi phòng.
- **Giao diện thích ứng (Responsive Flexbox)**: Khung video tự động tính toán, co giãn và duy trì tỷ lệ chuẩn 16:9, đảm bảo hiển thị hoàn hảo từ 1 đến 20+ người cùng lúc mà không bị vỡ bố cục trên mọi kích cỡ màn hình.

### 💬 Tương tác & Thông báo
- **Live Chat**: Tích hợp khung chat thời gian thực với hiệu ứng trượt (Slide-in) mượt mà, tự động ẩn hoàn toàn khỏi cấu trúc DOM khi đóng để giải phóng không gian.
- **Auto-Sync Participants**: Tự động đồng bộ và hiển thị chính xác danh sách người tham gia theo thời gian thực ngay khi vừa vào phòng.

---

## 🛠 Công nghệ & Kiến trúc (Tech Stack)

### Frontend (Client-side)
- **Core**: React.js 19, Vite.
- **Styling**: Tailwind CSS v4, thiết kế theo hướng Mobile-first & Glassmorphism.
- **WebRTC**: PeerJS.
- **Icons**: Lucide-react.

### Backend (Server-side)
- **Core**: Hono.js (Siêu nhẹ, tối ưu cho môi trường Edge).
- **Infrastructure**: Cloudflare Workers.
- **Signaling Server**: Cloudflare Durable Objects (duy trì state của WebSocket).
- **Database**: Cloudflare D1 (Serverless SQLite).

### DevOps & Deployment
- **Containerization**: Docker, Docker Compose (Frontend Nginx, Backend Wrangler).
- **CI/CD**: Tích hợp triển khai tự động qua Cloudflare Pages & Workers.

---

## 📂 Cấu trúc thư mục (Folder Structure)

```text
Wedsite_Call/
├── frontend/                 # Ứng dụng Frontend (React + Vite)
│   ├── src/
│   │   ├── components/       # Các UI Component tái sử dụng
│   │   ├── context/          # State toàn cục (AuthContext)
│   │   ├── pages/            # Các trang chính (Home, Login, CallRoom, Admin)
│   │   ├── index.css         # Reset CSS và thiết lập Tailwind
│   │   ├── App.jsx           # Cấu hình Routing
│   │   └── config.js         # Các biến môi trường và Endpoint API
│   ├── package.json
│   ├── Dockerfile            # Cấu hình build Docker với Nginx
│   └── vite.config.js
│
├── backend/                  # Ứng dụng Backend (Hono + Cloudflare)
│   ├── src/
│   │   └── index.js          # API Routes & WebSockets (Durable Objects)
│   ├── package.json
│   ├── Dockerfile            # Cấu hình build Docker giả lập Worker (Wrangler)
│   └── wrangler.toml         # Cấu hình môi trường Cloudflare D1, DO
│
├── docker-compose.yml        # Orchestration quản lý khởi chạy đồng thời Front & Back
├── .gitignore
└── README.md                 # Tài liệu dự án
```

---

## 🚀 Hướng dẫn khởi chạy bằng Docker (Dành cho môi trường Dev)

Dự án đã được đóng gói hoàn chỉnh bằng Docker. Để khởi chạy toàn bộ hệ thống trên máy tính local, bạn chỉ cần thực hiện 1 câu lệnh duy nhất:

```bash
# Build và chạy ngầm toàn bộ dịch vụ
docker-compose up -d
```

- **Frontend** sẽ chạy tại: `http://localhost:3000`
- **Backend API** sẽ chạy tại: `http://localhost:8787`

---
*Dự án được thiết kế và phát triển nhằm mục đích nghiên cứu, ứng dụng công nghệ mạng WebRTC P2P và kiến trúc Serverless Edge Computing.*
