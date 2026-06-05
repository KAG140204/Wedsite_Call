import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Gamepad2, Mail, Lock } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        login(data.token, data.user);
        if (data.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/home');
        }
      } else {
        setError(data.error || 'Đăng nhập thất bại');
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
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[400px] bg-purple-600/15 blur-[150px] rounded-full animate-float-orb"></div>
        <div className="absolute bottom-[10%] right-[15%] w-[400px] h-[400px] bg-indigo-600/12 blur-[130px] rounded-full animate-float-orb-reverse"></div>
        <div className="absolute top-[50%] left-[60%] w-[300px] h-[300px] bg-pink-600/8 blur-[100px] rounded-full animate-float-orb-slow"></div>
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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse-glow">
                <Gamepad2 className="w-7 h-7 text-white" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-center text-white mb-1">Đăng Nhập</h1>
            <p className="text-gray-400 text-center mb-8 text-sm">Chào mừng trở lại, đồng đội!</p>
            
            {message && (
              <div className="mb-4 text-green-400 text-sm text-center bg-green-500/10 p-3 rounded-xl border border-green-500/20 animate-fade-in-up">
                {message}
              </div>
            )}

            {error && (
              <div className="mb-4 text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20 animate-fade-in-up">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
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
                className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-4 rounded-xl shadow-lg shadow-purple-500/20 transition-all transform hover:-translate-y-0.5 hover:shadow-purple-500/30 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Đang xác thực...
                  </div>
                ) : 'Đăng Nhập'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              Chưa có tài khoản? <Link to="/register" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">Tạo tài khoản mới</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
