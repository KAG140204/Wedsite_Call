import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, LogIn, Users, LogOut as LeaveIcon, PhoneCall, X } from 'lucide-react';
import GooeyProfileMenu from '../components/GooeyProfileMenu';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [myRooms, setMyRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  
  const { user, updateUser, token } = useAuth();
  const navigate = useNavigate();

  // Modal States
  const [showNameModal, setShowNameModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    if (!user) navigate('/login');
    else {
      setNewName(user.name);
      fetchMyRooms();
    }
  }, [user, navigate]);

  const fetchMyRooms = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8787/api/user/rooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
      const res = await fetch('http://127.0.0.1:8787/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

  const handleJoinRoomAPI = async (e) => {
    e.preventDefault();
    if (!roomId) return setError('Vui lòng nhập ID phòng');
    
    setIsLoading(true); setError('');
    try {
      const res = await fetch(`http://127.0.0.1:8787/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userName: user.name })
      });
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
      await fetch(`http://127.0.0.1:8787/api/rooms/${roomIdToLeave}/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMyRooms(prev => prev.filter(r => r.roomId !== roomIdToLeave));
    } catch (err) {
      console.error(err);
    }
  };

  const updateProfile = async (bodyData) => {
    setProfileLoading(true); setProfileError(''); setProfileSuccess('');
    try {
      const res = await fetch('http://127.0.0.1:8787/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();
      if (data.success) {
        setProfileSuccess(data.message);
        if (data.name) updateUser({ name: data.name });
        setTimeout(() => {
          setShowNameModal(false);
          setShowPassModal(false);
          setProfileSuccess('');
        }, 1500);
      } else {
        setProfileError(data.error);
      }
    } catch (err) {
      setProfileError('Lỗi kết nối máy chủ');
    } finally {
      setProfileLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-6 relative bg-gray-950">
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
                <div key={room.roomId} className="glass-panel p-6 rounded-2xl border border-gray-800 hover:border-purple-500/50 transition-all group flex flex-col justify-between h-48">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold text-white mb-1 truncate">{room.roomName}</h3>
                      {room.hostId === user.id && <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-md border border-yellow-500/30">Host</span>}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mb-4">ID: {room.roomId}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Users className="w-4 h-4" /> {room.members?.length || 1} thành viên
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => navigate(`/room/${room.roomId}`)}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                      <PhoneCall className="w-4 h-4" /> Tham gia Call
                    </button>
                    <button 
                      onClick={() => handleLeaveGroup(room.roomId)}
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

      {/* Tích hợp Nút Menu Nảy (Gooey Profile Menu) trôi nổi */}
      <GooeyProfileMenu 
        onUpdateName={() => { setShowNameModal(true); setProfileError(''); setProfileSuccess(''); setNewName(user.name); }} 
        onUpdatePassword={() => { setShowPassModal(true); setProfileError(''); setProfileSuccess(''); setOldPass(''); setNewPass(''); }} 
      />

      {/* --- MODALS --- */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-sm relative">
            <button onClick={() => setShowNameModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-white mb-4">Đổi Tên Hiển Thị</h3>
            <div className="space-y-4">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" placeholder="Tên mới..." />
              {profileError && <p className="text-red-400 text-sm">{profileError}</p>}
              {profileSuccess && <p className="text-green-400 text-sm">{profileSuccess}</p>}
              <button onClick={() => updateProfile({ newName })} disabled={profileLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium transition-colors">
                {profileLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-sm relative">
            <button onClick={() => setShowPassModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-white mb-4">Đổi Mật Khẩu</h3>
            <div className="space-y-4">
              <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-pink-500 focus:outline-none" placeholder="Mật khẩu cũ" />
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-pink-500 focus:outline-none" placeholder="Mật khẩu mới" />
              {profileError && <p className="text-red-400 text-sm">{profileError}</p>}
              {profileSuccess && <p className="text-green-400 text-sm">{profileSuccess}</p>}
              <button onClick={() => updateProfile({ oldPassword: oldPass, newPassword: newPass })} disabled={profileLoading} className="w-full bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-xl font-medium transition-colors">
                {profileLoading ? 'Đang lưu...' : 'Cập Nhật Mật Khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
