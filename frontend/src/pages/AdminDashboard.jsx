import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, Shield, LogOut, Video } from 'lucide-react';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }

    const fetchUsers = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8787/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setUsers(data.users);
        } else {
          setError(data.error || 'Lỗi lấy dữ liệu');
        }
      } catch (err) {
        setError('Lỗi kết nối Server');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [user, token, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-white">Đang tải...</div>;

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white p-8">
      <header className="flex justify-between items-center mb-8 glass-panel p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-purple-500" />
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Xin chào, <span className="text-white font-medium">{user.name}</span></span>
          <button onClick={() => navigate('/home')} className="flex items-center gap-2 px-4 py-2 glass-button rounded-xl hover:bg-gray-800">
            <Video className="w-4 h-4" /> Vào Web App
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 border border-red-500/50 rounded-xl transition-all">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-8 text-red-400 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          {error}
        </div>
      )}

      <main className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-semibold">Quản lý người dùng ({users.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="p-4 font-medium">ID</th>
                <th className="p-4 font-medium">Tên</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Quyền</th>
                <th className="p-4 font-medium">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="p-4 text-sm text-gray-500 font-mono">{u.id ? u.id.slice(0, 8) + '...' : 'N/A'}</td>
                  <td className="p-4 font-medium">{u.name}</td>
                  <td className="p-4 text-gray-400">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-gray-800 text-gray-300'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'Mock'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">Không có dữ liệu người dùng</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
