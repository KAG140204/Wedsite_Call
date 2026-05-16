import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import CallRoom from './pages/CallRoom';
import AdminDashboard from './pages/AdminDashboard';
import Home from './pages/Home';
import Landing from './pages/Landing';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/home" element={<Home />} />
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
