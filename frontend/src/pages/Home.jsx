import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, LogIn, Users, LogOut as LeaveIcon, PhoneCall, Copy, Check, Sparkles, Gamepad2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [myRooms, setMyRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate('/login');
    else fetchMyRooms();
  }, [user, navigate]);

  const fetchMyRooms = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/user/rooms`);
      if (!res) return;
      const data = await res.json();
      if (data.success) setMyRooms(data.rooms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName) return setError('Vui lòng nhập tên phòng muốn tạo');
    
    setIsLoading(true); setError('');
    
    try {
      const res = await authFetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, hostId: user.id, hostName: user.name })
      });
      if (!res) return;
      const data = await res.json();
      
      if (data.success) {
        navigate(`/room/${data.room.roomId}`);
      } else {
        setError(data.error || 'Lỗi tạo phòng');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoomAPI = async (e) => {
    e.preventDefault();
    if (!roomId) return setError('Vui lòng nhập ID phòng');
    
    setIsLoading(true); setError('');
    try {
      const res = await authFetch(`${API_BASE_URL}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: user.name })
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        navigate(`/room/${roomId}`);
      } else {
        setError(data.error || 'Lỗi tham gia phòng');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = async (roomIdToLeave) => {
    if (!window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này vĩnh viễn?")) return;
    try {
      await authFetch(`${API_BASE_URL}/api/rooms/${roomIdToLeave}/leave`, {
        method: 'POST'
      });
      setMyRooms(prev => prev.filter(r => r.roomId !== roomIdToLeave));
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-4 sm:p-6 relative bg-gray-950 overflow-y-auto pb-24 noise-overlay">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-5%] left-[30%] w-[600px] h-[400px] bg-purple-600/12 blur-[150px] rounded-full animate-float-orb"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-indigo-600/10 blur-[130px] rounded-full animate-float-orb-reverse"></div>
        <div className="absolute top-[50%] left-[-5%] w-[300px] h-[300px] bg-pink-600/8 blur-[100px] rounded-full animate-float-orb-slow"></div>
      </div>
      
      {/* Grid pattern */}
      <div className="fixed inset-0 pointer-events-none z-[1] grid-pattern opacity-30"></div>
      
      <div className="absolute top-4 right-4 z-20 flex gap-4">
        {user.role === 'admin' && (
          <button onClick={() => navigate('/admin')} className="px-4 py-2 bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 hover:border-blue-500/50 rounded-xl transition-all text-sm font-medium">
            Trang Quản Trị
          </button>
        )}
      </div>

      <div className="w-full max-w-6xl z-10 mt-12 flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: My Groups */}
        <div className="flex-1">
          <div className="animate-fade-in-up">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              Chào mừng trở lại, {user.name}
            </h2>
            <p className="text-gray-400 mb-6 max-w-2xl text-sm">
              Squad đang chờ. Tạo phòng mới hoặc nhập mã để vào call và lên chiến thuật trước giờ combat.
            </p>
          </div>
          
          {loadingRooms ? (
            <div className="glass-panel p-8 rounded-2xl text-center">
              <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-400 text-sm">Đang tải danh sách nhóm...</p>
            </div>
          ) : myRooms.length === 0 ? (
            <div className="animate-fade-in-up delay-200 glass-panel p-10 rounded-3xl text-center shimmer-border">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-5">
                <Gamepad2 className="w-10 h-10 text-purple-400/60" />
              </div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Chưa có phòng nào</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                Tạo một phòng mới hoặc nhập mã phòng để kết nối cùng đồng đội và bắt đầu call.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myRooms.map((room, index) => (
                <div 
                  key={room.roomId || room.id} 
                  className="animate-fade-in-up glass-panel p-6 rounded-2xl card-glow shimmer-border flex flex-col justify-between"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold text-white mb-1 truncate pr-2">{room.roomName}</h3>
                      {room.hostId === user.id && (
                        <span className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 text-xs px-2.5 py-1 rounded-lg border border-yellow-500/30 shrink-0 font-medium">
                          👑 Host
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3 bg-gray-900/50 rounded-lg p-2 w-fit">
                      <p className="text-xs text-gray-400 font-mono truncate max-w-[200px]" title={room.roomId || room.id}>
                        ID: {room.roomId || room.id}
                      </p>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(room.roomId || room.id);
                          setCopiedId(room.roomId || room.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="p-1 hover:bg-gray-700 rounded-md transition-colors shrink-0"
                        title="Sao chép ID phòng"
                      >
                        {copiedId === (room.roomId || room.id) ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500 hover:text-white" />}
                      </button>
                    </div>
                    
                    {/* Hiển thị danh sách thành viên */}
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-gray-400">{room.members?.length || 1} thành viên</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(room.members || []).slice(0, 5).map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-gray-800/80 text-xs text-gray-300 px-2 py-1 rounded-full border border-gray-700/50">
                            <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">
                              {m.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                            {m.name}
                          </span>
                        ))}
                        {(room.members?.length || 0) > 5 && (
                          <span className="text-xs text-gray-500 px-2 py-1">+{room.members.length - 5} người khác</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => navigate(`/room/${room.roomId || room.id}`)}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/15 hover:-translate-y-0.5"
                    >
                      <PhoneCall className="w-4 h-4" /> Tham gia Call
                    </button>
                    <button 
                      onClick={() => handleLeaveGroup(room.roomId || room.id)}
                      className="px-3 bg-gray-800/60 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-gray-700/50 hover:border-red-500/50 rounded-xl transition-all flex items-center justify-center"
                      title="Rời nhóm"
                    >
                      <LeaveIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Create / Join Actions */}
        <div className="w-full lg:w-96 flex flex-col gap-6">
          <div className="animate-fade-in-up delay-200 glass-panel rounded-3xl p-6 relative shadow-2xl shadow-purple-500/5 shimmer-border">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
              Tạo Squad Mới
            </h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <input 
                type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-700/60 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                placeholder="Đặt tên phòng (VD: Rank Kim Cương tối nay)"
              />
              <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-purple-500/15 transition-all transform hover:-translate-y-0.5">
                {isLoading ? 'Đang tạo...' : '🎮 Tạo Phòng Ngay'}
              </button>
            </form>
          </div>

          <div className="animate-fade-in-up delay-400 glass-panel rounded-3xl p-6 relative shadow-2xl shadow-indigo-500/5 shimmer-border">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
                <LogIn className="w-4 h-4 text-white" />
              </div>
              Tham Gia Bằng Mã
            </h3>
            <form onSubmit={handleJoinRoomAPI} className="space-y-4">
              <input 
                type="text" required value={roomId} onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-700/60 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="Nhập mã phòng tại đây..."
              />
              <button type="submit" className="w-full glass-button text-white font-semibold py-3.5 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5">
                🚀 Vào Call
              </button>
            </form>
            {error && <div className="mt-4 text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20 animate-fade-in-up">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
