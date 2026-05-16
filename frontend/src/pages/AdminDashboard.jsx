import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Activity, LogOut, ArrowLeft, Database, List, Search, Trash2, ShieldCheck, ShieldOff, BarChart3, TrendingUp, UserCheck, Gamepad2, FileText, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../config';
import '../components/AdminGooeyMenu.css';

// ========== MINI CHART COMPONENT ==========
function MiniChart({ data }) {
  if (!data || data.length === 0) return null;
  
  const maxVal = Math.max(...data.map(d => d.logins + d.registers + d.rooms), 1);
  const barHeight = 120;
  
  return (
    <div className="glass-panel rounded-2xl p-6 border border-gray-800 mb-8">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-400" /> Hoạt động 7 ngày gần nhất
      </h3>
      <div className="flex items-end justify-between gap-2" style={{ height: barHeight + 30 }}>
        {data.map((day, i) => {
          const total = day.logins + day.registers + day.rooms;
          const h = total > 0 ? (total / maxVal) * barHeight : 4;
          const loginH = day.logins > 0 ? (day.logins / maxVal) * barHeight : 0;
          const regH = day.registers > 0 ? (day.registers / maxVal) * barHeight : 0;
          const roomH = day.rooms > 0 ? (day.rooms / maxVal) * barHeight : 0;
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute -top-8 bg-gray-800 text-xs text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-gray-700 shadow-lg pointer-events-none">
                Đăng nhập: {day.logins} | Đăng ký: {day.registers} | Tạo phòng: {day.rooms}
              </div>
              {/* Stacked Bar */}
              <div className="w-full flex flex-col items-center justify-end" style={{ height: barHeight }}>
                <div className="w-full max-w-[40px] flex flex-col-reverse rounded-t-md overflow-hidden transition-all duration-500">
                  {loginH > 0 && <div className="bg-gradient-to-t from-blue-600 to-blue-400" style={{ height: loginH }} />}
                  {regH > 0 && <div className="bg-gradient-to-t from-green-600 to-green-400" style={{ height: regH }} />}
                  {roomH > 0 && <div className="bg-gradient-to-t from-purple-600 to-purple-400" style={{ height: roomH }} />}
                  {total === 0 && <div className="bg-gray-700 rounded-t-md" style={{ height: 4 }} />}
                </div>
              </div>
              <span className="text-[11px] text-gray-500 mt-1">{day.label}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Đăng nhập</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500" /> Đăng ký</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500" /> Tạo phòng</span>
      </div>
    </div>
  );
}

// ========== STAT CARD COMPONENT ==========
function StatCard({ icon: Icon, label, value, color, gradient }) {
  return (
    <div className={`glass-panel rounded-2xl p-5 border border-gray-800 flex items-center gap-4 relative overflow-hidden group hover:border-${color}-500/50 transition-all`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className={`w-12 h-12 rounded-xl bg-${color}-500/20 flex items-center justify-center relative z-10`}>
        <Icon className={`w-6 h-6 text-${color}-400`} />
      </div>
      <div className="relative z-10">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );
}

// ========== MAIN COMPONENT ==========
export default function AdminDashboard() {
  const { user, authFetch, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalRooms: 0, todayActivity: 0, activeRooms: 0 });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');
  
  // Report state
  const [report, setReport] = useState(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchStats();
    fetchChart();
    if (activeTab !== 'reports') {
      fetchData(activeTab);
    }
  }, [user, navigate, activeTab]);

  const fetchStats = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/stats`);
      if (!res) return;
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) { console.error(err); }
  };

  const fetchChart = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/chart`);
      if (!res) return;
      const data = await res.json();
      if (data.success) setChartData(data.chart);
    } catch (err) { console.error(err); }
  };

  const fetchData = async (tab) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/${tab}`);
      if (!res) return;
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

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/report?from=${dateFrom}&to=${dateTo}`);
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Lỗi lấy báo cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') fetchReport();
  }, [activeTab, dateFrom, dateTo]);

  // --- DELETE USER ---
  const handleDeleteUser = async (userId, email) => {
    if (!window.confirm(`Bạn chắc chắn muốn xóa tài khoản "${email}"? Hành động này không thể hoàn tác.`)) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        fetchStats();
      } else {
        alert(data.error || 'Lỗi xóa tài khoản');
      }
    } catch (err) { alert('Lỗi kết nối'); }
  };

  // --- DELETE ROOM ---
  const handleDeleteRoom = async (roomId, roomName) => {
    if (!window.confirm(`Xóa phòng "${roomName}"? Hành động này không thể hoàn tác.`)) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/rooms/${roomId}`, { method: 'DELETE' });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        setRooms(prev => prev.filter(r => r.roomId !== roomId));
        fetchStats();
      } else {
        alert(data.error || 'Lỗi xóa phòng');
      }
    } catch (err) { alert('Lỗi kết nối'); }
  };

  // --- TOGGLE ROLE ---
  const handleToggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Đổi role thành "${newRole.toUpperCase()}"?`)) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        alert(data.error || 'Lỗi đổi role');
      }
    } catch (err) { alert('Lỗi kết nối'); }
  };

  // --- FILTER LOGIC ---
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredRooms = rooms.filter(r =>
    r.roomName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.roomId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.hostName?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredLogs = logs.filter(l => {
    const matchSearch = l.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.details?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = logFilter === 'ALL' || l.action === logFilter;
    return matchSearch && matchFilter;
  });

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-32 overflow-y-auto flex flex-col items-center">
      <main className="w-full max-w-7xl p-4 md:p-8">
        
        {/* --- HEADER --- */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-2xl leading-tight">Admin Panel</h2>
            <p className="text-sm text-blue-400">Kaysor System</p>
          </div>
        </div>

        {/* ====== ADMIN GOOEY MENU ====== */}
        <div className="fixed bottom-8 left-8 z-50">
          <nav className="admin-gooey-menu text-white">
            <input 
              type="checkbox" 
              className="admin-menu-open" 
              name="admin-menu-open" 
              id="admin-menu-open" 
            />
            <label className="admin-menu-open-button bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/40" htmlFor="admin-menu-open">
              <span className="admin-lines admin-line-1"></span>
              <span className="admin-lines admin-line-2"></span>
              <span className="admin-lines admin-line-3"></span>
            </label>

            <button onClick={() => { setActiveTab('users'); setSearchQuery(''); document.getElementById('admin-menu-open').checked = false; }} className={`admin-menu-item bg-blue-500 hover:bg-blue-400 ${activeTab === 'users' ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''}`} title="Tài Khoản">
              <Users className="w-5 h-5 text-white" />
            </button>
            
            <button onClick={() => { setActiveTab('rooms'); setSearchQuery(''); document.getElementById('admin-menu-open').checked = false; }} className={`admin-menu-item bg-purple-500 hover:bg-purple-400 ${activeTab === 'rooms' ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''}`} title="Danh sách Phòng">
              <Database className="w-5 h-5 text-white" />
            </button>

            <button onClick={() => { setActiveTab('logs'); setSearchQuery(''); setLogFilter('ALL'); document.getElementById('admin-menu-open').checked = false; }} className={`admin-menu-item bg-pink-500 hover:bg-pink-400 ${activeTab === 'logs' ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''}`} title="Nhật ký">
              <Activity className="w-5 h-5 text-white" />
            </button>

            <button onClick={() => { setActiveTab('reports'); document.getElementById('admin-menu-open').checked = false; }} className={`admin-menu-item bg-orange-500 hover:bg-orange-400 ${activeTab === 'reports' ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''}`} title="Báo Cáo">
              <FileText className="w-5 h-5 text-white" />
            </button>
          </nav>
        </div>
        
        {/* --- STATS CARDS --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Tổng người dùng" value={stats.totalUsers} color="blue" gradient="from-blue-600/10 to-transparent" />
          <StatCard icon={Gamepad2} label="Tổng phòng" value={stats.totalRooms} color="purple" gradient="from-purple-600/10 to-transparent" />
          <StatCard icon={TrendingUp} label="Hoạt động hôm nay" value={stats.todayActivity} color="green" gradient="from-green-600/10 to-transparent" />
          <StatCard icon={UserCheck} label="Phòng đang hoạt động" value={stats.activeRooms} color="yellow" gradient="from-yellow-600/10 to-transparent" />
        </div>

        {/* --- MINI CHART --- */}
        <MiniChart data={chartData} />

        {/* --- TAB HEADER --- */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {activeTab === 'users' && 'Quản lý Tài Khoản'}
                {activeTab === 'rooms' && 'Quản lý Phòng'}
                {activeTab === 'logs' && 'Nhật Ký Hệ Thống'}
                {activeTab === 'reports' && 'Báo Cáo Tổng Hợp'}
              </h1>
              <p className="text-gray-400">
                {activeTab === 'users' && `Hiển thị ${filteredUsers.length}/${users.length} tài khoản`}
                {activeTab === 'rooms' && `Hiển thị ${filteredRooms.length}/${rooms.length} phòng`}
                {activeTab === 'logs' && `Hiển thị ${filteredLogs.length}/${logs.length} bản ghi`}
                {activeTab === 'reports' && 'Xem thống kê chi tiết theo khoảng thời gian tùy chọn.'}
              </p>
            </div>
            
            {/* Date Picker for Reports */}
            {activeTab === 'reports' && (
              <div className="flex flex-wrap items-center gap-2 bg-gray-900 border border-gray-700 p-2 rounded-xl w-full md:w-auto">
                <div className="flex items-center gap-2 px-2 flex-1 min-w-[130px]">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none w-full" />
                </div>
                <span className="text-gray-500 hidden sm:block">-</span>
                <div className="px-2 flex-1 min-w-[130px]">
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none w-full" />
                </div>
              </div>
            )}
          </div>
        </header>

        {/* --- SEARCH & FILTER BAR --- */}
        {activeTab !== 'reports' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
            <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'users' ? 'Tìm theo tên hoặc email...' : activeTab === 'rooms' ? 'Tìm theo tên phòng, ID hoặc Host...' : 'Tìm theo email hoặc chi tiết...'}
              className="w-full bg-gray-900/80 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          {activeTab === 'logs' && (
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Tất cả</option>
              <option value="LOGIN">Đăng nhập</option>
              <option value="REGISTER">Đăng ký</option>
              <option value="CREATE_ROOM">Tạo phòng</option>
              <option value="UPDATE_PROFILE">Cập nhật hồ sơ</option>
              <option value="UPDATE_AVATAR">Đổi avatar</option>
              <option value="ADMIN_DELETE_USER">Xóa user</option>
              <option value="ADMIN_DELETE_ROOM">Xóa phòng</option>
              <option value="ADMIN_CHANGE_ROLE">Đổi role</option>
            </select>
          )}
        </div>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6">{error}</div>}

        {/* --- TABLE --- */}
        <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-10 text-center text-gray-400 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              Đang tải dữ liệu...
            </div>
          ) : (
            <div className="overflow-x-auto">
              
              {/* ====== USERS TABLE ====== */}
              {activeTab === 'users' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-sm">
                      <th className="p-4 font-medium">Tên hiển thị</th>
                      <th className="p-4 font-medium">Email</th>
                      <th className="p-4 font-medium">Vai trò</th>
                      <th className="p-4 font-medium">Ngày tham gia</th>
                      <th className="p-4 font-medium text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan="5" className="p-4 text-center text-gray-500">Không tìm thấy kết quả</td></tr>
                    ) : filteredUsers.map((u, i) => (
                      <tr key={u.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="p-4 font-medium text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
                              {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : u.name?.charAt(0)?.toUpperCase()}
                            </div>
                            {u.name}
                          </div>
                        </td>
                        <td className="p-4 text-gray-300">{u.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium border ${u.role === 'admin' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                            {u.role?.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 text-gray-400 text-sm">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* Không cho đổi role / xóa chính mình */}
                            {u.id !== user.id && (
                              <>
                                <button
                                  onClick={() => handleToggleRole(u.id, u.role)}
                                  className={`p-2 rounded-lg transition-colors ${u.role === 'admin' ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
                                  title={u.role === 'admin' ? 'Hạ xuống User' : 'Nâng lên Admin'}
                                >
                                  {u.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                  title="Xóa tài khoản"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {u.id === user.id && <span className="text-xs text-gray-600 italic">Bạn</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ====== ROOMS TABLE ====== */}
              {activeTab === 'rooms' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-sm">
                      <th className="p-4 font-medium">Tên Phòng</th>
                      <th className="p-4 font-medium">Mã ID</th>
                      <th className="p-4 font-medium">Người Tạo (Host)</th>
                      <th className="p-4 font-medium">Số Thành Viên</th>
                      <th className="p-4 font-medium text-center">Ngày tạo</th>
                      <th className="p-4 font-medium text-center">Cập nhật cuối</th>
                      <th className="p-4 font-medium text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRooms.length === 0 ? (
                      <tr><td colSpan="7" className="p-4 text-center text-gray-500">Không tìm thấy kết quả</td></tr>
                    ) : filteredRooms.map((r, i) => (
                      <tr key={r.roomId || i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="p-4 font-medium text-white">{r.roomName}</td>
                        <td className="p-4 text-gray-400 font-mono text-sm max-w-[150px] truncate">{r.roomId}</td>
                        <td className="p-4 text-purple-300 max-w-[150px] truncate">{r.hostName || 'Unknown'}</td>
                        <td className="p-4 text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-4 h-4 text-purple-400" />
                            {r.members ? r.members.length : 1}
                          </span>
                        </td>
                        <td className="p-4 text-center text-gray-400 text-sm">{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'N/A'}</td>
                        <td className="p-4 text-center text-gray-400 text-sm">{r.updatedAt ? new Date(r.updatedAt).toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'N/A'}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteRoom(r.roomId, r.roomName)}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            title="Xóa phòng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ====== LOGS TABLE ====== */}
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
                    {filteredLogs.length === 0 ? (
                      <tr><td colSpan="4" className="p-4 text-center text-gray-500">Không tìm thấy kết quả</td></tr>
                    ) : filteredLogs.map((l, i) => (
                      <tr key={l._id || i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="p-4 text-gray-400 text-sm whitespace-nowrap">{new Date(l.timestamp).toLocaleString('vi-VN')}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium border whitespace-nowrap
                            ${l.action === 'LOGIN' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                              l.action === 'REGISTER' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                              l.action?.startsWith('ADMIN') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              'bg-pink-500/10 text-pink-400 border-pink-500/20'}`}>
                            {l.action}
                          </span>
                        </td>
                        <td className="p-4 text-blue-300">{l.email}</td>
                        <td className="p-4 text-gray-300 max-w-[300px] truncate">{l.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ====== REPORTS UI ====== */}
              {activeTab === 'reports' && report && (
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gray-900/50 p-4 sm:p-6 rounded-2xl border border-gray-800 text-center">
                      <p className="text-gray-400 mb-1 text-sm sm:text-base">Tài khoản mới</p>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-400">+{report.newUsers}</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 sm:p-6 rounded-2xl border border-gray-800 text-center">
                      <p className="text-gray-400 mb-1 text-sm sm:text-base">Phòng đã tạo</p>
                      <p className="text-2xl sm:text-3xl font-bold text-purple-400">+{report.newRooms}</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 sm:p-6 rounded-2xl border border-gray-800 text-center">
                      <p className="text-gray-400 mb-1 text-sm sm:text-base">Lượt đăng nhập</p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-400">{report.totalLogins}</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 sm:p-6 rounded-2xl border border-gray-800 text-center">
                      <p className="text-gray-400 mb-1 text-sm sm:text-base">Tổng Action logs</p>
                      <p className="text-2xl sm:text-3xl font-bold text-orange-400">{report.totalActions}</p>
                    </div>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Chi tiết theo ngày</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-sm">
                        <th className="p-4 font-medium">Ngày</th>
                        <th className="p-4 font-medium text-blue-400">Đăng nhập</th>
                        <th className="p-4 font-medium text-green-400">Đăng ký</th>
                        <th className="p-4 font-medium text-purple-400">Tạo phòng</th>
                        <th className="p-4 font-medium text-gray-500">Hoạt động khác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.daily.length === 0 ? (
                        <tr><td colSpan="5" className="p-4 text-center text-gray-500">Không có dữ liệu trong khoảng thời gian này</td></tr>
                      ) : report.daily.map((d, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                          <td className="p-4 font-medium text-white">{new Date(d.date).toLocaleDateString('vi-VN')}</td>
                          <td className="p-4 text-gray-300">{d.logins}</td>
                          <td className="p-4 text-gray-300">{d.registers}</td>
                          <td className="p-4 text-gray-300">{d.rooms}</td>
                          <td className="p-4 text-gray-500">{d.others}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
