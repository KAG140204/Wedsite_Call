import { useState } from 'react';
import { User, Edit3, Key, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './GooeyProfileMenu.css'; // Sẽ tạo file CSS riêng để xử lý hiệu ứng

export default function GooeyProfileMenu({ onUpdateName, onUpdatePassword }) {
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Xử lý đóng mở Menu
  const handleToggle = () => setIsOpen(!isOpen);

  const handleAction = (action) => {
    setIsOpen(false);
    if (action === 'logout') {
      logout();
      window.location.href = '/login';
    } else if (action === 'name') {
      onUpdateName();
    } else if (action === 'password') {
      onUpdatePassword();
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <nav className="gooey-menu text-white">
        {/* Checkbox ẩn để quản lý State đóng/mở bằng CSS thuần (giữ nguyên gốc) */}
        <input 
          type="checkbox" 
          href="#" 
          className="menu-open" 
          name="menu-open" 
          id="menu-open" 
          checked={isOpen}
          onChange={handleToggle}
        />
        
        <label className="menu-open-button bg-purple-600 hover:bg-purple-500 shadow-xl shadow-purple-500/40" htmlFor="menu-open">
          <span className="lines line-1"></span>
          <span className="lines line-2"></span>
          <span className="lines line-3"></span>
        </label>

        <button onClick={() => handleAction('name')} className="menu-item bg-blue-500 hover:bg-blue-400" title="Đổi Tên Hiển Thị">
          <Edit3 className="w-5 h-5 text-white" />
        </button>
        <button onClick={() => handleAction('password')} className="menu-item bg-pink-500 hover:bg-pink-400" title="Đổi Mật Khẩu">
          <Key className="w-5 h-5 text-white" />
        </button>
        <button onClick={() => handleAction('logout')} className="menu-item bg-red-500 hover:bg-red-400" title="Đăng Xuất">
          <LogOut className="w-5 h-5 text-white ml-1" />
        </button>
      </nav>

      {/* SVG Filter bắt buộc phải có để tạo hiệu ứng "Chất Lỏng" (Gooey Effect) */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="shadowed-goo">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feGaussianBlur in="goo" stdDeviation="3" result="shadow" />
            <feColorMatrix in="shadow" mode="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 -0.2" result="shadow" />
            <feOffset in="shadow" dx="1" dy="1" result="shadow" />
            <feComposite in2="shadow" in="goo" result="goo" />
            <feComposite in2="goo" in="SourceGraphic" result="mix" />
          </filter>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feComposite in2="goo" in="SourceGraphic" result="mix" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
