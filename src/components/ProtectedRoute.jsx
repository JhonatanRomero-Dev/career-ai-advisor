import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasValidAuthSession } from "@/lib/authSession";

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({
  fallback = <DefaultFallback />
}) {

  const location = useLocation();
  const nextPath = `${location.pathname}${location.search || ""}`;

  if (!hasValidAuthSession()) {
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  return <Outlet />;
}
