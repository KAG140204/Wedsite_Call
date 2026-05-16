import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Video, Shield, Zap, Users, ArrowRight } from 'lucide-react';

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white font-sans overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/30 blur-[120px] rounded-full pointer-events-none"></div>
      
      {/* Navbar */}
      <nav className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">CallTeam</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <Link to="/home" className="glass-button px-6 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors">
              Vào Sảnh <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-gray-300 hover:text-white font-medium text-sm transition-colors">Đăng nhập</Link>
              <Link to="/register" className="bg-white text-black px-6 py-2.5 rounded-full font-medium text-sm hover:bg-gray-200 transition-transform transform hover:scale-105">Đăng ký</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
          Đã tích hợp WebRTC & PeerJS
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Họp trực tuyến <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Không giới hạn.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12">
          Trải nghiệm video call đỉnh cao với độ trễ bằng 0. Hoạt động trên nền tảng Cloudflare Edge siêu tốc. Dành riêng cho đội nhóm của bạn.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {user ? (
            <Link to="/home" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-lg shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2">
              Vào trang quản lý phòng <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <>
              <Link to="/register" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-lg shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2">
                Bắt đầu miễn phí
              </Link>
              <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-full glass-button font-semibold text-lg hover:bg-gray-800 transition-all flex items-center justify-center">
                Đăng nhập ngay
              </Link>
            </>
          )}
        </div>
      </main>

      {/* Features Section */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-32 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-panel p-8 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-colors group">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">Tốc độ siêu tốc</h3>
          <p className="text-gray-400">Kết nối P2P mạng lưới phân tán trực tiếp giữa các người dùng, mang lại độ trễ video dưới 50ms.</p>
        </div>

        <div className="glass-panel p-8 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-colors group">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">Quyền Chủ Phòng</h3>
          <p className="text-gray-400">Quản lý toàn quyền: Mời, đuổi người dùng (Kick) hoặc khóa phòng chỉ với một cú click chuột.</p>
        </div>

        <div className="glass-panel p-8 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-colors group">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6 text-pink-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">Lưới 20 Người</h3>
          <p className="text-gray-400">Tối ưu hóa UI/UX với chuẩn CSS Grid tự động thay đổi kích thước lên tới 20 Camera cùng lúc.</p>
        </div>
      </section>
    </div>
  );
}
