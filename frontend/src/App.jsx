import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import CallRoom from './pages/CallRoom';
import AdminDashboard from './pages/AdminDashboard';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import GooeyProfileMenu from './components/GooeyProfileMenu';

// Component bảo vệ: Nếu đã đăng nhập thì chuyển thẳng về /home
const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (user) return <Navigate to="/home" replace />;
  return children;
};

// Component bảo vệ: Nếu chưa đăng nhập thì đẩy về /login
const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  return (
    <>
      <GooeyProfileMenu />
      <Routes>
        {/* Trang công khai */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Trang yêu cầu đăng nhập: Nếu chưa đăng nhập → đẩy về /login */}
        <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/room/:roomId" element={<PrivateRoute><CallRoom /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
