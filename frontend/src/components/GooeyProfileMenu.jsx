import { useState, useEffect, useRef } from 'react';
import { Gamepad2, Home, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import './GooeyProfileMenu.css';

export default function GooeyProfileMenu() {
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // --- DRAGGABLE PROFILE MENU STATE & LOGIC ---
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0 });
  const dragStartCoords = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastTouchTime = useRef(0);

  const handleDragStart = (e) => {
    // Chỉ xử lý click chuột trái hoặc touch chạm tay
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.menu-item')) return;
    
    // Ngăn chặn xung đột đúp chuột khi trình duyệt mobile giả lập mousedown sau touchstart
    if (e.type === 'touchstart') {
      lastTouchTime.current = Date.now();
    } else if (e.type === 'mousedown') {
      if (Date.now() - lastTouchTime.current < 600) {
        return;
      }
    }
    
    isDraggingRef.current = true;
    setIsDragging(true);
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    dragStartCoords.current = { x: clientX, y: clientY };
    dragStartRef.current = {
      startX: clientX - menuPos.x,
      startY: clientY - menuPos.y
    };
  };

  useEffect(() => {
    const handleDragMove = (e) => {
      if (!isDraggingRef.current) return;
      
      if (e.cancelable) {
        e.preventDefault();
      }
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const newX = clientX - dragStartRef.current.startX;
      const newY = clientY - dragStartRef.current.startY;
      
      setMenuPos({ x: newX, y: newY });
    };

    const handleDragEnd = (e) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      const dx = clientX - dragStartCoords.current.x;
      const dy = clientY - dragStartCoords.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Nếu khoảng cách di chuyển nhỏ (< 5px), coi như click nhẹ để đóng/mở menu
      if (distance < 5) {
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [menuPos]);

  // Không hiển thị Menu ở trang Login hoặc Register hoặc nếu chưa đăng nhập
  if (!user || ['/login', '/register'].includes(location.pathname)) {
    return null;
  }

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
    <div 
      style={{
        transform: `translate(${menuPos.x}px, ${menuPos.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className="fixed bottom-8 right-8 z-50 select-none touch-none"
    >
      <nav className="gooey-menu text-white">
        <input 
          type="checkbox" 
          className="menu-open" 
          name="menu-open" 
          id="menu-open" 
          checked={isOpen}
          readOnly
        />
        
        <label 
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          className="menu-open-button bg-purple-600 hover:bg-purple-500 shadow-xl shadow-purple-500/40"
        >
          <span className="lines line-1"></span>
          <span className="lines line-2"></span>
          <span className="lines line-3"></span>
        </label>

        {/* Nút 1: Trang Giới Thiệu */}
        <button onClick={() => handleNavigate('/')} className="menu-item bg-teal-500 hover:bg-teal-400" title="Trang Giới Thiệu">
          <Gamepad2 className="w-5 h-5 text-white" />
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
