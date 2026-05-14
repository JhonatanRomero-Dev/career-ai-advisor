import { Navigate, Outlet, useLocation } from "react-router-dom";

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({
  fallback = <DefaultFallback />
}) {

  const logged = localStorage.getItem("logged");
  const location = useLocation();

  // loading fake opcional
  if (logged === null) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <Outlet />;
}
