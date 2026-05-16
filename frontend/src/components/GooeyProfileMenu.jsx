import { useState } from 'react';
import { Globe, Home, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import './GooeyProfileMenu.css';

export default function GooeyProfileMenu() {
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Không hiển thị Menu ở trang Login hoặc Register hoặc nếu chưa đăng nhập
  if (!user || ['/login', '/register'].includes(location.pathname)) {
    return null;
  }

  const handleToggle = () => setIsOpen(!isOpen);

  const handleNavigate = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <nav className="gooey-menu text-white">
        <input 
          type="checkbox" 
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

        {/* Nút 1: Trang Giới Thiệu */}
        <button onClick={() => handleNavigate('/')} className="menu-item bg-teal-500 hover:bg-teal-400" title="Trang Giới Thiệu">
          <Globe className="w-5 h-5 text-white" />
        </button>
        
        {/* Nút 2: Sảnh Quản Lý Nhóm */}
        <button onClick={() => handleNavigate('/home')} className="menu-item bg-blue-500 hover:bg-blue-400" title="Sảnh Nhóm">
          <Home className="w-5 h-5 text-white" />
        </button>
        
        {/* Nút 3: Hồ sơ Cá Nhân */}
        <button onClick={() => handleNavigate('/profile')} className="menu-item bg-pink-500 hover:bg-pink-400" title="Trang Cá Nhân">
          <User className="w-5 h-5 text-white" />
        </button>
        
        {/* Nút 4: Đăng Xuất */}
        <button onClick={handleLogout} className="menu-item bg-red-500 hover:bg-red-400" title="Đăng Xuất">
          <LogOut className="w-5 h-5 text-white ml-1" />
        </button>
      </nav>

      {/* SVG Filter cho hiệu ứng Gooey */}
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
        </defs>
      </svg>
    </div>
  );
}
