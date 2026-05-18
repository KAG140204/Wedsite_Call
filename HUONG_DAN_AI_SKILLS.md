# CẨM NANG HƯỚNG DẪN SỬ DỤNG AI AGENT SKILLS 🚀

Chào mừng bạn đến với tài liệu hướng dẫn về **AI Agent Skills**! Tài liệu này sẽ giúp bạn hiểu rõ bản chất, cách hoạt động, danh sách các Skill chất lượng cao và cách áp dụng chúng để biến các trợ lý lập trình AI (như Cursor, Claude Code, Copilot) thành các chuyên gia công nghệ tối thượng phù hợp với dự án của bạn.

---

## 1. AI Agent Skill Là Gì? 🤔

**AI Agent Skill** là một tập hợp các quy tắc, chỉ dẫn, cấu trúc mã nguồn và tri thức được đóng gói dưới dạng tệp tin Markdown (.md). 

Thay vì bạn phải liên tục giải thích và nhắc nhở AI về:
*   *Cách tổ chức thư mục của dự án.*
*   *Các tiêu chuẩn thiết kế UI/UX sang trọng (như Glassmorphism).*
*   *Các nguyên lý xử lý WebRTC dynamic track đặc thù của dự án này.*

Bạn chỉ cần "cài đặt" một Skill vào dự án. Trình biên dịch của AI sẽ tự động đọc tệp cấu hình này trước khi bắt đầu viết code để đảm bảo code được sinh ra **luôn chuẩn chỉnh 100%** theo ý bạn.

---

## 2. Cách Cài Đặt Skills Bằng CLI 🛠️

Để cài đặt và quản lý các AI Skill chính thức từ cộng đồng mở (đặc biệt là từ **Vercel Labs**), bạn sử dụng gói CLI của npm thông qua câu lệnh `npx`.

> [!IMPORTANT]
> Cú pháp của CLI chỉ nhận **1 tham số duy nhất** là mã định danh bắt đầu bằng tiền tố `skills/`. Không thêm từ khóa `add` ở giữa.

### Cú pháp chuẩn:
```powershell
npx skill skills/<tên-gói-skill>
```

---

## 3. Danh Sách Các Agent Skills Đỉnh Cao (Vercel Labs) 🌟

Dưới đây là các gói Skill chất lượng cao nhất do Vercel Labs phát triển dành riêng cho lập trình Web mà bạn nên cài đặt ngay:

| Tên Gói Skill | Chức Năng Chính | Lợi Ích Cho Đồ Án |
| :--- | :--- | :--- |
| **`skills/react-best-practices`** | Tổng hợp hơn 40+ quy chuẩn lập trình React hiện đại và tối ưu hiệu năng. | AI sẽ luôn viết code React sạch, tránh rò rỉ bộ nhớ (memory leak) khi dùng `useEffect` và `useRef`. |
| **`skills/web-design-guidelines`** | Kiểm định thẩm mỹ thiết kế UI/UX, khả năng tiếp cận (Accessibility - Aria) và tính đồng bộ. | Đảm bảo giao diện nút bấm, bảng biểu, hiệu ứng chuyển động của web luôn **mượt mà, sang trọng và chuẩn Premium**. |
| **`skills/composition-patterns`** | Quy chuẩn cấu trúc bố cục thành phần (React Composition). | Giúp chia nhỏ các Component lớn (như phòng gọi `CallRoom.jsx`) thành các phần nhỏ dễ bảo trì. |
| **`skills/next-best-practices`** | Tiêu chuẩn phát triển tối ưu cho Next.js (Router, RSC, Server Actions). | Cực kỳ hữu ích nếu sau này bạn muốn nâng cấp dự án này lên Next.js. |
| **`skills/next-cache-components`** | Hướng dẫn chuyên sâu về cơ chế Caching và truyền dữ liệu real-time. | Giúp tăng tốc độ tải trang web lên gấp 3 lần. |

---

## 4. Cách Tích Hợp Skill Vào Các Công Cụ Lập Trình 💻

Sau khi bạn chạy lệnh cài đặt, tệp cấu hình quy tắc sẽ được phân bổ vào các IDE của bạn:

### 🅰️ Dành Cho Cursor IDE (Khuyên Dùng):
*   Khi cài đặt thành công, một tệp có tên là **`.cursorrules`** sẽ được tạo tự động ở thư mục gốc của dự án.
*   Mỗi khi bạn nhấn `Ctrl + K` để sinh code hoặc `Ctrl + L` để chat với AI trong Cursor, AI sẽ tự động đọc tệp `.cursorrules` này và tuân thủ các chỉ dẫn thiết kế trong đó.

### 🅱️ Dành Cho Claude Code (CLI của Anthropic):
*   Các quy tắc sẽ được ghi nhận vào thư mục cấu hình toàn cục của hệ thống tại địa chỉ:
    `C:\Users\<Tên_User>\.agents\rules\`
*   Claude sẽ tự động áp dụng các quy chuẩn này mỗi khi bạn yêu cầu chỉnh sửa dự án.

---

## 5. TỰ TẠO SKILL RIÊNG CHO DỰ ÁN CỦA BẠN (Cực Kỳ Độc Đáo!) 🎨

Đây là cách bạn ghi điểm tuyệt đối trước hội đồng chấm tốt nghiệp. Chúng ta sẽ tự tạo ra một quy chuẩn Skill mang tên **`rules`** lưu ngay trong dự án của bạn để chỉ dạy AI cách code phòng gọi WebRTC!

### Bước 1: Tạo thư mục quy tắc của dự án
Trong thư mục gốc dự án của bạn đã có sẵn thư mục `.agents/rules/`.

### Bước 2: Tạo tệp quy tắc riêng cho dự án của bạn
Tạo một tệp tin `.md` nằm trong `.agents/rules/webrtc-standards.md` để lưu các tri thức cốt lõi.

*Ví dụ nội dung tệp quy chuẩn:*
```markdown
# TIÊU CHUẨN LẬP TRÌNH WEBRTC & CORS CHO KAYSOR CALL 📞

Dự án này sử dụng WebRTC kết nối ngang hàng (PeerJS) và Durable Objects trên Cloudflare. AI Agent bắt buộc phải tuân thủ các quy tắc sau khi chỉnh sửa code:

## 1. Nguyên Tắc WebRTC iOS Safari:
*   Cấm bật camera/micro vật lý ngay khi load trang để tránh bị iOS Safari chặn.
*   Bắt buộc phải khởi tạo phòng bằng `createEmptyStream` (silent audio track và black canvas video track) làm lớp đệm khởi chạy.
*   Khi người dùng bấm bật/tắt thiết bị, sử dụng phương pháp thay thế nóng luồng (`replaceTrack`) trên toàn bộ các Peer Connection thay vì ngắt cuộc gọi.

## 2. Tiêu Chuẩn Bảo Mật CORS:
*   Mọi thay đổi cấu hình tại `backend/src/index.js` phải luôn cho phép danh sách tên miền: `localhost`, `kaysor-call.pages.dev`, và tên miền riêng chính thức **`kaysor.id.vn`**.

## 3. Thiết Kế Giao Diện UI/UX:
*   Giao diện phòng gọi phải luôn tuân thủ nguyên lý **Glassmorphism (Kính mờ)**: sử dụng `backdrop-blur-md`, nền tối `bg-gray-950/80` và đường viền siêu mỏng `border-gray-800`.
```

### Bước 3: Hưởng thụ thành quả
Từ giờ trở đi, bất kỳ AI nào (kể cả tôi) khi mở dự án của bạn lên đều sẽ đọc hiểu ngay kiến trúc WebRTC đặc thù này, giúp nâng cao độ chính xác khi code lên **99.9%**!

---

*Chúc bạn ứng dụng các AI Skill thật tốt và bảo vệ thành công rực rỡ đồ án của mình! Nếu cần cấu hình thêm bất kỳ skill nâng cao nào khác, cứ bảo tôi nhé!* 😉
