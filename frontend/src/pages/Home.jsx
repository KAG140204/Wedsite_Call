import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Video, LogOut, Plus, LogIn } from 'lucide-react';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName) return setError('Vui lòng nhập tên phòng muốn tạo');
    
    setIsLoading(true);
    setError('');
    
    try {
      const res = await fetch('http://127.0.0.1:8787/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, hostId: user.id, hostName: user.name })
      });
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

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomId) return setError('Vui lòng nhập ID phòng');
    navigate(`/room/${roomId}`);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative bg-gray-950">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none"></div>
      
      <div className="absolute top-4 right-4 z-20">
        <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/40 rounded-xl transition-all">
          <LogOut className="w-4 h-4" /> Đăng xuất ({user.name})
        </button>
      </div>

      <div className="glass-panel w-full max-w-4xl rounded-3xl p-8 relative z-10 shadow-2xl flex flex-col md:flex-row gap-8">
        
        {/* Create Room Section */}
        <div className="flex-1 border-r border-gray-700/50 pr-0 md:pr-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Tạo Phòng Mới</h2>
          </div>
          <p className="text-gray-400 mb-6">Bạn sẽ là Chủ Phòng (Host). Bạn có quyền đổi tên phòng và mời/đuổi người khác.</p>
          
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tên phòng (Tùy chọn)</label>
              <input 
                type="text" 
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="VD: Họp dự án cuối năm"
              />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-4 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1">
              {isLoading ? 'Đang tạo...' : 'Tạo Phòng Ngay'}
            </button>
          </form>
        </div>

        {/* Join Room Section */}
        <div className="flex-1 pl-0 md:pl-8 mt-8 md:mt-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shadow-lg">
              <LogIn className="w-6 h-6 text-gray-300" />
            </div>
            <h2 className="text-2xl font-bold text-white">Tham Gia Phòng</h2>
          </div>
          <p className="text-gray-400 mb-6">Nhập Mã phòng (ID) do chủ phòng cung cấp để tham gia họp.</p>
          
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Mã Phòng (Room ID)</label>
              <input 
                type="text" 
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="Nhập mã ID..."
              />
            </div>
            <button type="submit" className="w-full glass-button text-white font-semibold py-4 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1">
              Tham Gia
            </button>
          </form>

          {error && <div className="mt-4 text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</div>}
        </div>

      </div>
    </div>
  );
}
