import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

// Giải mã JWT payload (phần giữa) để kiểm tra thời hạn
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Kiểm tra token còn hiệu lực không
function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  // Còn hạn nếu thời gian hết hạn > thời gian hiện tại (trừ 60s buffer)
  return payload.exp > Math.floor(Date.now() / 1000) + 60;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken && isTokenValid(savedToken)) {
      return JSON.parse(savedUser);
    }
    // Token hết hạn hoặc không hợp lệ → xóa sạch
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  });

  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken && isTokenValid(savedToken)) return savedToken;
    localStorage.removeItem('token');
    return null;
  });

  const login = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const updateUser = (newUserData) => {
    const updated = { ...user, ...newUserData };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  // Hàm fetch thông minh: Tự động logout nếu API trả 401
  const authFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      logout();
      return null; // Trả null để component biết là đã bị đá ra
    }

    return res;
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
