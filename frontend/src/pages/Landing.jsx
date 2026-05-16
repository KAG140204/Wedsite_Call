import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Headphones, Shield, Zap, Users, ArrowRight, Gamepad2, Rocket, Clock, Globe, UserCheck } from 'lucide-react';

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white font-sans overflow-y-auto">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-purple-600/25 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-600/15 blur-[120px] rounded-full"></div>
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-pink-600/10 blur-[100px] rounded-full"></div>
      </div>
      
      {/* Navbar */}
      <nav className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Kaysor</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          {user ? (
            <Link to="/home" className="glass-button px-5 sm:px-6 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors">
              Vào Sảnh <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-gray-300 hover:text-white font-medium text-sm transition-colors hidden sm:inline">Đăng nhập</Link>
              <Link to="/register" className="bg-white text-black px-5 sm:px-6 py-2.5 rounded-full font-medium text-sm hover:bg-gray-200 transition-transform transform hover:scale-105">Đăng ký</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-32 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-6 sm:mb-8">
          <Gamepad2 className="w-4 h-4" />
          Tích hợp Voice Chat thời gian thực
        </div>
        
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight mb-4 leading-[1.1]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">Kaysor</span>
        </h1>
        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-200 mb-6 sm:mb-8">
          Call Team. Vào Trận. <span className="text-purple-400">Gánh Kèo.</span>
        </p>
        
        <p className="text-sm sm:text-base md:text-lg text-gray-400 max-w-2xl mb-8 sm:mb-12 px-2 leading-relaxed">
          Tạo phòng call siêu nhanh dành riêng cho game thủ.
          Âm thanh ổn định, độ trễ thấp, kết nối tức thì để team combat, chiến thuật và... đổ lỗi đúng người.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          {user ? (
            <Link to="/home" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-lg shadow-[0_0_40px_rgba(168,85,247,0.4)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2">
              <Headphones className="w-5 h-5" /> Vào phòng ngay <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <>
              <Link to="/register" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 text-white font-semibold text-lg shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2">
                <Headphones className="w-5 h-5" /> Tạo phòng ngay
              </Link>
              <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-full glass-button font-semibold text-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                <Rocket className="w-5 h-5" /> Tham gia phòng
              </Link>
            </>
          )}
        </div>
      </main>

      {/* Features Section */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-20 sm:pb-32 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-all duration-300 group hover:-translate-y-1">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-yellow-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">Kết nối tức thì</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Vào phòng chỉ bằng vài cú nhấp chuột. Không tải app rườm rà, không thiết lập dài dòng. Vì trước khi vào trận, chẳng ai muốn đánh boss cuối mang tên "cài đặt".
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-all duration-300 group hover:-translate-y-1">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">Chủ phòng toàn quyền</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Mời thành viên, kick người phá game, khóa phòng hoặc quản lý quyền dễ dàng. Trưởng team cuối cùng cũng có quyền lực ngoài việc ping liên tục.
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-all duration-300 group hover:-translate-y-1">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6 text-pink-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">Tối ưu đội hình</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Hiển thị và xử lý mượt nhiều người cùng lúc. Dù squad 5 người hay cả bang hội kéo nhau vào call lúc nửa đêm.
          </p>
        </div>
      </section>

      {/* Stats / "Made for Gamers" Section */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-gray-800 text-center relative overflow-hidden">
          {/* Glow effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-purple-600/10 blur-[80px] rounded-full pointer-events-none"></div>
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 relative">
            Được tạo cho <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">game thủ thật sự</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10 sm:mb-14 text-sm sm:text-base relative">
            Tập trung vào trải nghiệm chơi game: độ trễ thấp, voice rõ, giao diện tối hiện đại và hoạt động ổn định trên PC lẫn điện thoại.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 relative">
            <div className="bg-gray-900/60 rounded-2xl p-5 sm:p-6 border border-gray-800 hover:border-purple-500/30 transition-colors">
              <div className="flex items-center justify-center mb-2">
                <Zap className="w-5 h-5 text-yellow-400 mr-1" />
                <span className="text-2xl sm:text-3xl font-black text-white">&lt;50ms</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Độ trễ thấp</p>
            </div>
            <div className="bg-gray-900/60 rounded-2xl p-5 sm:p-6 border border-gray-800 hover:border-purple-500/30 transition-colors">
              <div className="flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-green-400 mr-1" />
                <span className="text-2xl sm:text-3xl font-black text-white">24/7</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Hoạt động liên tục</p>
            </div>
            <div className="bg-gray-900/60 rounded-2xl p-5 sm:p-6 border border-gray-800 hover:border-purple-500/30 transition-colors">
              <div className="flex items-center justify-center mb-2">
                <UserCheck className="w-5 h-5 text-blue-400 mr-1" />
                <span className="text-2xl sm:text-3xl font-black text-white">20+</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Người / phòng</p>
            </div>
            <div className="bg-gray-900/60 rounded-2xl p-5 sm:p-6 border border-gray-800 hover:border-purple-500/30 transition-colors">
              <div className="flex items-center justify-center mb-2">
                <Globe className="w-5 h-5 text-purple-400 mr-1" />
                <span className="text-2xl sm:text-3xl font-black text-white">100%</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Trình duyệt hỗ trợ</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-gray-800/60 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center">
              <Gamepad2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">Kaysor</span>
          </div>
          <p className="text-gray-500 text-sm max-w-xl mx-auto mb-3">
            Kết nối đồng đội. Chia sẻ chiến thuật. Cùng nhau thắng trận.<br className="hidden sm:block" /> Hoặc cùng nhau đổ tại mạng lag. Nhân loại rất giỏi khoản này.
          </p>
          <p className="text-gray-600 text-xs">Kaysor © 2026</p>
        </div>
      </footer>
    </div>
  );
}
