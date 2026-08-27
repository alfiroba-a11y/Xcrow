import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('xcrow_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const adminApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/${import.meta.env.VITE_ADMIN_PATH}`,
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('xcrow_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export { api, adminApi };
