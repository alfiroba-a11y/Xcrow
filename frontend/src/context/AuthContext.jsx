import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, adminApi } from '../api/axios';
import { disconnectSocket } from '../api/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('xcrow_token');
    const adminToken = localStorage.getItem('xcrow_admin_token');

    (async () => {
      try {
        if (token) {
          const { data } = await api.get('/auth/me');
          setUser(data.user);
        }
      } catch {
        localStorage.removeItem('xcrow_token');
      }
      if (adminToken) {
        // Admin identity is trusted from the stored login response;
        // every protected admin call re-validates the token server-side anyway.
        const raw = localStorage.getItem('xcrow_admin_user');
        if (raw) setAdmin(JSON.parse(raw));
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('xcrow_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('xcrow_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('xcrow_token');
    setUser(null);
    disconnectSocket();
  }, []);

  const adminLogin = useCallback(async (email, password) => {
    const { data } = await adminApi.post('/login', { email, password });
    localStorage.setItem('xcrow_admin_token', data.token);
    localStorage.setItem('xcrow_admin_user', JSON.stringify(data.user));
    setAdmin(data.user);
    return data.user;
  }, []);

  const adminLogout = useCallback(() => {
    localStorage.removeItem('xcrow_admin_token');
    localStorage.removeItem('xcrow_admin_user');
    setAdmin(null);
    disconnectSocket();
  }, []);

  return (
    <AuthContext.Provider value={{ user, admin, loading, login, register, logout, adminLogin, adminLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
