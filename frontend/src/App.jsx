import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateEscrow from './pages/CreateEscrow.jsx';
import JoinEscrow from './pages/JoinEscrow.jsx';
import EscrowRoom from './pages/EscrowRoom.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import { ProtectedRoute, AdminProtectedRoute } from './components/ProtectedRoute.jsx';

const adminPath = import.meta.env.VITE_ADMIN_PATH;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/escrow/new" element={<ProtectedRoute><CreateEscrow /></ProtectedRoute>} />
      <Route path="/escrow/:id" element={<ProtectedRoute><EscrowRoom /></ProtectedRoute>} />
      <Route path="/join" element={<JoinEscrow />} />
      <Route path="/join/:token" element={<JoinEscrow />} />

      {/* Hidden admin portal — not linked from anywhere in the public UI. */}
      <Route path={`/${adminPath}/login`} element={<AdminLogin />} />
      <Route path={`/${adminPath}`} element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
