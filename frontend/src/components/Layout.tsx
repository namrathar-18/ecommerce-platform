import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { logout } from "../features/auth/authSlice";
import { api } from "../lib/api";

export default function Layout() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link
            to="/"
            className="font-extrabold text-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent"
          >
            ShopMesh
          </Link>
          <nav className="flex gap-4 text-sm text-slate-600">
            <Link to="/" className="hover:text-indigo-600">Shop</Link>
            {user?.role === "customer" && <Link to="/cart" className="hover:text-indigo-600">Cart</Link>}
            {user?.role === "customer" && <Link to="/orders" className="hover:text-indigo-600">Orders</Link>}
            {user?.role === "vendor" && <Link to="/vendor" className="hover:text-indigo-600">Vendor</Link>}
            {user?.role === "admin" && <Link to="/admin" className="hover:text-indigo-600">Admin</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-slate-500">{user.role}</span>
                <button onClick={handleLogout} className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200">
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="px-3 py-1 rounded bg-indigo-600 text-white">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
