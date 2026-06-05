import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Mail, Lock, User } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        navigate('/login', { state: { message: 'Đăng ký thành công! Hãy đăng nhập.' } });
      } else {
        setError(data.error || 'Đăng ký thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối tới máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative noise-overlay">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[15%] right-[20%] w-[500px] h-[400px] bg-indigo-600/15 blur-[150px] rounded-full animate-float-orb"></div>
        <div className="absolute bottom-[15%] left-[10%] w-[400px] h-[400px] bg-purple-600/12 blur-[130px] rounded-full animate-float-orb-reverse"></div>
        <div className="absolute top-[40%] right-[50%] w-[300px] h-[300px] bg-pink-600/8 blur-[100px] rounded-full animate-float-orb-slow"></div>
      </div>
      
      {/* Grid pattern */}
      <div className="fixed inset-0 pointer-events-none z-[1] grid-pattern opacity-30"></div>

      <div className="animate-fade-in-scale w-full max-w-md relative z-10">
        {/* Animated gradient border wrapper */}
        <div className="gradient-border-animated rounded-2xl p-[1px]">
          <div className="glass-panel w-full rounded-2xl p-8 shadow-2xl shadow-purple-500/5">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors text-sm font-medium group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Quay về trang chủ
            </button>
            
            <div className="flex items-center justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/30 animate-pulse-glow">
                <Gamepad2 className="w-7 h-7 text-white" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-center text-white mb-1">Tạo Tài Khoản</h1>
            <p className="text-gray-400 text-center mb-8 text-sm">Gia nhập đội ngũ game thủ Kaysor</p>
            
            {error && (
              <div className="mb-4 text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20 animate-fade-in-up">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Họ Tên</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <input 
                    type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-700/60 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-gray-500" />
                  </div>
                  <input 
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-700/60 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Mật Khẩu</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-gray-500" />
                  </div>
                  <input 
                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-700/60 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    placeholder="••••••"
                  />
                </div>
              </div>
              
              <button 
                type="submit" disabled={isLoading}
                className="w-full mt-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold py-4 rounded-xl shadow-lg shadow-pink-500/20 transition-all transform hover:-translate-y-0.5 hover:shadow-pink-500/30 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Đang xử lý...
                  </div>
                ) : 'Đăng Ký'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              Đã có tài khoản? <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">Đăng nhập ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
