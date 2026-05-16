import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext();

// Giải mã JWT payload để kiểm tra thời hạn
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  return payload.exp > Math.floor(Date.now() / 1000) + 60;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser && isTokenValid(savedToken)) {
      return JSON.parse(savedUser);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  });

  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken && isTokenValid(savedToken)) return savedToken;
    return null;
  });

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = (newUserData) => {
    const updated = { ...user, ...newUserData };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  // FIX: Đọc token TRỰC TIẾP từ localStorage thay vì state để tránh stale closure
  const authFetch = useCallback(async (url, options = {}) => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      logout();
      return null;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          'Authorization': `Bearer ${currentToken}`
        }
      });

      if (res.status === 401) {
        logout();
        return null;
      }

      return res;
    } catch (err) {
      console.error('authFetch error:', err);
      throw err;
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
