import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Lock, Save, ArrowLeft, Camera } from 'lucide-react';

import { API_BASE_URL } from '../config';

export default function Profile() {
  const { user, updateUser, authFetch } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [newName, setNewName] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      setNewName(user.name);
    }
  }, [user, navigate]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await authFetch(`${API_BASE_URL}/api/user/avatar`, {
        method: 'POST',
        body: formData
      });
      if (!res) return; // 401 → auto logout
      const data = await res.json();
      if (data.success) {
        updateUser({ avatarUrl: data.avatarUrl });
      } else {
        alert(data.error || 'Lỗi tải ảnh');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const bodyData = {};
    if (newName && newName !== user.name) bodyData.newName = newName;
    if (newPass) {
      if (!oldPass) {
        setError('Vui lòng nhập mật khẩu cũ để đổi mật khẩu mới.');
        setLoading(false);
        return;
      }
      bodyData.oldPassword = oldPass;
      bodyData.newPassword = newPass;
    }

    if (Object.keys(bodyData).length === 0) {
      setError('Không có thay đổi nào để lưu.');
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      if (!res) return; // 401 → auto logout
      const data = await res.json();
      
      if (data.success) {
        setSuccess('Cập nhật thành công!');
        if (data.user?.name) updateUser({ name: data.user.name });
        setOldPass('');
        setNewPass('');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center p-4 sm:p-6 relative text-white overflow-y-auto pb-24">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none"></div>

      <div className="w-full max-w-4xl z-10 mt-10">
        <button onClick={() => navigate('/home')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" /> ← Quay về Kaysor
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Cột trái: Avatar & Thông tin chung */}
          <div className="glass-panel p-8 rounded-3xl flex flex-col items-center text-center">
            
            <div className="relative group mb-6">
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-5xl font-bold shadow-xl border-4 border-gray-800 overflow-hidden">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <div 
                onClick={() => fileInputRef.current.click()}
                className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
              >
                <Camera className="w-8 h-8 text-white" />
              </div>
              <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-t-white border-white/30 rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            <h2 className="text-2xl font-bold">{user.name}</h2>
            <p className="text-gray-400 mb-6">{user.email}</p>
            
            <div className="w-full space-y-3 text-left">
              <div className="bg-gray-800/50 p-4 rounded-xl flex items-center gap-3 border border-gray-700">
                <Shield className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-xs text-gray-500">Vai trò</p>
                  <p className="font-medium text-blue-200 capitalize">Game Member</p>
                  <p className="text-gray-500 text-xs mt-1">Luôn sẵn sàng vào trận.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải: Form cập nhật */}
          <div className="md:col-span-2 glass-panel p-8 rounded-3xl">
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <User className="w-6 h-6 text-purple-400" /> 🎧 Hồ sơ Kaysor
            </h3>
            <p className="text-gray-400 mb-6 text-sm">Quản lý thông tin tài khoản và tùy chỉnh hồ sơ của bạn.</p>

            {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}
            {success && <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">{success}</div>}

            <form onSubmit={handleUpdate} className="space-y-6">
              {/* Đổi tên */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400 ml-1">Tên đồng đội sẽ nhìn thấy</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div className="h-px bg-gray-800 my-6"></div>

              {/* Đổi mật khẩu */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium flex items-center gap-2">
                  <Lock className="w-5 h-5 text-pink-400" /> Đổi mật khẩu
                </h4>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400 ml-1">Mật khẩu cũ</label>
                  <input 
                    type="password" 
                    value={oldPass} 
                    onChange={(e) => setOldPass(e.target.value)}
                    placeholder="Nhập để xác nhận (Nếu muốn đổi pass)"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400 ml-1">Mật khẩu mới</label>
                  <input 
                    type="password" 
                    value={newPass} 
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mật khẩu mới"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
                {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
              <p className="text-gray-500 text-xs text-center mt-4">Thông tin luôn được bảo vệ để bạn tập trung call team và chiến game. Vì thứ duy nhất nên bị lộ là vị trí địch, không phải tài khoản.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
