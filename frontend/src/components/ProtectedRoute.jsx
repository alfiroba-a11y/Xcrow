import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function AdminProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  const adminPath = import.meta.env.VITE_ADMIN_PATH;
  if (loading) return <FullPageLoader />;
  if (!admin) return <Navigate to={`/${adminPath}/login`} replace />;
  return children;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
    </div>
  );
}
