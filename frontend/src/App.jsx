import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import CallRoom from './pages/CallRoom';
import AdminDashboard from './pages/AdminDashboard';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import GooeyProfileMenu from './components/GooeyProfileMenu';

function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Gooey Profile Menu sẽ luôn hiển thị ở góc dưới màn hình trên toàn hệ thống (nếu đã đăng nhập) */}
        <GooeyProfileMenu />
        
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/home" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/room/:roomId" element={<CallRoom />} />
          <Route path="/admin" element={<AdminDashboard />} />
          
          {/* Mặc định chuyển hướng về trang chủ nếu nhập sai link */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
