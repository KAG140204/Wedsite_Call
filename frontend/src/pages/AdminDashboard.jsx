import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Activity, LogOut, ArrowLeft, Database, List } from 'lucide-react';

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('users'); // users, rooms, logs
  
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchData(activeTab);
  }, [user, navigate, activeTab]);

  const fetchData = async (tab) => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8787/api/admin/${tab}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        if (tab === 'users') setUsers(data.users || []);
        if (tab === 'rooms') setRooms(data.rooms || []);
        if (tab === 'logs') setLogs(data.logs || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 glass-panel border-r border-gray-800 flex flex-col p-4 md:h-screen sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Admin Panel</h2>
            <p className="text-xs text-blue-400">CallTeam System</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Users className="w-5 h-5" /> Tài Khoản
          </button>
          
          <button 
            onClick={() => setActiveTab('rooms')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'rooms' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Database className="w-5 h-5" /> Danh sách Nhóm
          </button>

          <button 
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'logs' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Activity className="w-5 h-5" /> Nhật ký (Logs)
          </button>
        </nav>

        <div className="mt-auto space-y-2 pt-4 border-t border-gray-800">
          <button onClick={() => navigate('/home')} className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" /> Về trang chủ
          </button>
          <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {activeTab === 'users' && 'Quản lý Tài Khoản'}
            {activeTab === 'rooms' && 'Danh sách Nhóm Đang Hoạt Động'}
            {activeTab === 'logs' && 'Nhật Ký Hệ Thống'}
          </h1>
          <p className="text-gray-400">
            {activeTab === 'users' && 'Danh sách tất cả người dùng đã đăng ký trên hệ thống.'}
            {activeTab === 'rooms' && 'Theo dõi các phòng/nhóm đang tồn tại và thông tin Host.'}
            {activeTab === 'logs' && 'Giám sát thời gian thực các sự kiện đăng nhập, tạo phòng.'}
          </p>
        </header>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6">{error}</div>}

        <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-10 text-center text-gray-400 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              Đang tải dữ liệu...
            </div>
          ) : (
            <div className="overflow-x-auto">
              {activeTab === 'users' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-sm">
                      <th className="p-4 font-medium">Tên hiển thị</th>
                      <th className="p-4 font-medium">Email</th>
                      <th className="p-4 font-medium">Vai trò</th>
                      <th className="p-4 font-medium">Ngày tham gia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan="4" className="p-4 text-center text-gray-500">Chưa có dữ liệu</td></tr>
                    ) : users.map((u, i) => (
                      <tr key={u.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="p-4 font-medium text-white">{u.name}</td>
                        <td className="p-4 text-gray-300">{u.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium border ${u.role === 'admin' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 text-gray-400 text-sm">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'rooms' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-sm">
                      <th className="p-4 font-medium">Tên Phòng</th>
                      <th className="p-4 font-medium">Mã ID</th>
                      <th className="p-4 font-medium">Người Tạo (Host)</th>
                      <th className="p-4 font-medium">Số Thành Viên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.length === 0 ? (
                      <tr><td colSpan="4" className="p-4 text-center text-gray-500">Chưa có phòng nào được tạo</td></tr>
                    ) : rooms.map((r, i) => (
                      <tr key={r.roomId || i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="p-4 font-medium text-white">{r.roomName}</td>
                        <td className="p-4 text-gray-400 font-mono text-sm">{r.roomId}</td>
                        <td className="p-4 text-purple-300">{r.createdBy || 'Unknown'}</td>
                        <td className="p-4 text-gray-300">{r.members ? r.members.length : 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'logs' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-sm">
                      <th className="p-4 font-medium">Thời gian</th>
                      <th className="p-4 font-medium">Hành động</th>
                      <th className="p-4 font-medium">Tài khoản (Email)</th>
                      <th className="p-4 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr><td colSpan="4" className="p-4 text-center text-gray-500">Chưa có hoạt động nào</td></tr>
                    ) : logs.map((l, i) => (
                      <tr key={l._id || i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="p-4 text-gray-400 text-sm">{new Date(l.timestamp).toLocaleString('vi-VN')}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium border 
                            ${l.action === 'LOGIN' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                              l.action === 'REGISTER' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                              'bg-pink-500/10 text-pink-400 border-pink-500/20'}`}>
                            {l.action}
                          </span>
                        </td>
                        <td className="p-4 text-blue-300">{l.email}</td>
                        <td className="p-4 text-gray-300">{l.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
