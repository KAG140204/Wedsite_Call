import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

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
      const res = await fetch('http://127.0.0.1:8787/api/auth/register', {
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative">
      <div className="glass-panel w-full max-w-md rounded-2xl p-8 relative z-10 shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-white mb-2">Tạo Tài Khoản</h1>
        <p className="text-gray-400 text-center mb-8">Nền tảng gọi Video nhóm chất lượng cao</p>
        
        {error && (
          <div className="mb-4 text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Họ Tên</label>
            <input 
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="VD: Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input 
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Mật Khẩu</label>
            <input 
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="******"
            />
          </div>
          
          <button 
            type="submit" disabled={isLoading}
            className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-4 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1 disabled:opacity-50"
          >
            {isLoading ? 'Đang xử lý...' : 'Đăng Ký'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Đã có tài khoản? <Link to="/login" className="text-purple-400 hover:text-purple-300">Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
}
