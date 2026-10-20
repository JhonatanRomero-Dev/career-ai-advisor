import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasValidAuthSession } from "@/lib/authSession";
import { base44 } from "@/api/base44Client";

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
  const [status, setStatus] = useState(() =>
    hasValidAuthSession() ? "checking" : "unauthenticated"
  );

  useEffect(() => {
    let cancelled = false;

    if (!hasValidAuthSession()) {
      setStatus("unauthenticated");
      return () => {
        cancelled = true;
      };
    }

    setStatus("checking");

    base44.auth.refreshSession()
      .then(() => {
        if (!cancelled) {
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("unauthenticated");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  if (status === "checking") {
    return fallback;
  }

  if (status !== "authenticated") {
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  return <Outlet />;
}
