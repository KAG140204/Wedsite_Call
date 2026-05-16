import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, LogIn, Users, LogOut as LeaveIcon, PhoneCall } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [myRooms, setMyRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  
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
    <div className="min-h-screen w-full flex flex-col items-center p-4 sm:p-6 relative bg-gray-950 overflow-y-auto pb-24">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none"></div>
      
      <div className="absolute top-4 right-4 z-20 flex gap-4">
        {user.role === 'admin' && (
          <button onClick={() => navigate('/admin')} className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/40 rounded-xl transition-all">
            Trang Quản Trị
          </button>
        )}
      </div>

      <div className="w-full max-w-6xl z-10 mt-12 flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: My Groups */}
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
            <Users className="w-8 h-8 text-purple-400" /> Xin chào, {user.name}
          </h2>
          
          {loadingRooms ? (
            <div className="text-gray-400">Đang tải danh sách nhóm...</div>
          ) : myRooms.length === 0 ? (
            <div className="glass-panel p-8 rounded-2xl text-center text-gray-400">
              Bạn chưa tham gia nhóm nào. Hãy tạo hoặc nhập mã ID để tham gia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myRooms.map(room => (
                <div key={room.roomId || room.id} className="glass-panel p-6 rounded-2xl border border-gray-800 hover:border-purple-500/50 transition-all group flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold text-white mb-1 truncate">{room.roomName}</h3>
                      {room.hostId === user.id && <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-md border border-yellow-500/30">Host</span>}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mb-3">ID: {room.roomId || room.id}</p>
                    
                    {/* Hiển thị danh sách thành viên */}
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-gray-400">{room.members?.length || 1} thành viên</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(room.members || []).slice(0, 5).map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-gray-800/80 text-xs text-gray-300 px-2 py-1 rounded-full border border-gray-700">
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
                      className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                      <PhoneCall className="w-4 h-4" /> Tham gia Call
                    </button>
                    <button 
                      onClick={() => handleLeaveGroup(room.roomId || room.id)}
                      className="px-3 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-500/50 rounded-lg transition-colors flex items-center justify-center"
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
          <div className="glass-panel rounded-3xl p-6 relative shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" /> Tạo Nhóm Mới
            </h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <input 
                type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                placeholder="Tên nhóm (VD: Dự án cuối năm)"
              />
              <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1">
                {isLoading ? 'Đang tạo...' : 'Tạo Nhóm'}
              </button>
            </form>
          </div>

          <div className="glass-panel rounded-3xl p-6 relative shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <LogIn className="w-5 h-5 text-blue-400" /> Tham Gia Mã ID
            </h3>
            <form onSubmit={handleJoinRoomAPI} className="space-y-4">
              <input 
                type="text" required value={roomId} onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Nhập mã ID..."
              />
              <button type="submit" className="w-full glass-button text-white font-semibold py-3 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1">
                Gia Nhập
              </button>
            </form>
            {error && <div className="mt-4 text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
