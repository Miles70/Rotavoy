import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";

function AdminProtectedRoute() {
  const { token, isChecking } = useAdminAuth();
  const location = useLocation();

  if (isChecking) {
    return (
      <div className="admin-loading-screen">
        <div className="admin-spinner" />
        <p>Admin oturumu kontrol ediliyor...</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default AdminProtectedRoute;
