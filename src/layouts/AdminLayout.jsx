import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  X,
} from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { getAdminSystemStatus } from "../services/adminApi";

const navigation = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Siparişler", icon: ShoppingCart },
  { to: "/admin/products", label: "Ürünler", icon: Package },
  { to: "/admin/settings", label: "Ayarlar", icon: Settings },
];

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const { admin, token, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function checkConnection() {
      try {
        const status = await getAdminSystemStatus(token);
        if (!cancelled) setIsApiConnected(Boolean(status.api?.ok && status.database?.connected));
      } catch {
        if (!cancelled) setIsApiConnected(false);
      }
    }

    checkConnection();
    const timer = window.setInterval(checkConnection, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token]);

  async function handleLogout() {
    await logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="admin-shell">
      <button
        className={`admin-backdrop ${isSidebarOpen ? "is-visible" : ""}`}
        type="button"
        aria-label="Menüyü kapat"
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className={`admin-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
        <div className="admin-brand">
          <div className="admin-brand-mark">M</div>
          <div>
            <strong>Rotavoy</strong>
            <span>Command Center</span>
          </div>
          <button
            className="admin-icon-button admin-sidebar-close"
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Admin navigasyonu">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-nav-link ${isActive ? "is-active" : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <a className="admin-store-link" href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={17} />
            Mağazayı aç
          </a>
          <div className="admin-account">
            <div className="admin-avatar">A</div>
            <div>
              <strong>Administrator</strong>
              <span>{admin?.email || "admin"}</span>
            </div>
          </div>
          <button className="admin-logout-button" type="button" onClick={handleLogout}>
            <LogOut size={18} />
            Çıkış yap
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-icon-button admin-menu-button"
            type="button"
            aria-label="Menüyü aç"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div>
            <p>Rotavoy yönetim paneli</p>
            <span>Operasyonu tek ekrandan yönet.</span>
          </div>
          <div className={`admin-live-pill ${isApiConnected ? "" : "is-offline"}`}>
            <span /> {isApiConnected ? "API ve veritabanı bağlı" : "Bağlantı kontrol ediliyor"}
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
