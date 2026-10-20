import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import SplashScreen from "@/components/SplashScreen";
import MaintenancePage from "@/components/MaintenancePage";
import PageNotFound from "@/lib/PageNotFound";
import { base44 } from "@/api/base44Client";

const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const DemoLogin = lazy(() => import("@/pages/DemoLogin"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const UploadResume = lazy(() => import("@/pages/UploadResume"));
const AnalysisHistory = lazy(() => import("@/pages/AnalysisHistory"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const Profile = lazy(() => import("@/pages/Profile"));
const AnalysisReport = lazy(() => import("@/pages/AnalysisReport"));
const Support = lazy(() => import("@/pages/Support"));
const Admin = lazy(() => import("@/pages/Admin"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const Feedback = lazy(() => import("@/pages/Feedback"));
const ResumeEditor = lazy(() => import("@/pages/ResumeEditor"));

function PageLoader() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

function App() {
  const [maintenance, setMaintenance] = useState(null);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem("career-ai-splash-seen") !== "true";
  });

  useEffect(() => {
    base44.analytics.track("app_opened", {
      route: window.location.pathname,
      device_class: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    });
  }, []);

  useEffect(() => {
    let active = true;

    const checkMaintenance = async () => {
      try {
        const response = await fetch(`/maintenance.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Maintenance config unavailable");
        const config = await response.json();
        if (active) setMaintenance(config);
      } catch {
        if (active) setMaintenance({ enabled: false });
      }
    };

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") {
        checkMaintenance();
      }
    };

    checkMaintenance();
    const interval = window.setInterval(checkWhenVisible, 60000);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!showSplash) {
      return undefined;
    }

    localStorage.setItem("career-ai-splash-seen", "true");

    const timeout = window.setTimeout(() => {
      setShowSplash(false);
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [showSplash]);

  if (maintenance?.enabled) {
    return (
      <MaintenancePage
        title={maintenance.title || "Estamos fazendo algumas melhorias"}
        message={maintenance.message || "Voltamos em breve!"}
      />
    );
  }

  if (maintenance === null) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <>
      <AnimatePresence>{showSplash && <SplashScreen />}</AnimatePresence>

      <Router>
        <Routes>

        {/* Página inicial */}
        <Route path="/" element={<Suspense fallback={<PageLoader />}><Landing /></Suspense>} />
        <Route path="/login" element={<Suspense fallback={<PageLoader />}>{import.meta.env.VITE_DEMO_EMAIL_LOGIN === "true" ? <DemoLogin /> : <Login />}</Suspense>} />
        <Route path="/p/:publicId" element={<Suspense fallback={<PageLoader />}><PublicProfile /></Suspense>} />

        {/* Rotas protegidas */}
        <Route element={<ProtectedRoute />}>

          {/* Layout com Sidebar */}
          <Route element={<AppLayout />}>
            <Route path="/upload" element={<Suspense fallback={<PageLoader />}><UploadResume /></Suspense>} />
            <Route path="/analysis" element={<Suspense fallback={<PageLoader />}><AnalysisReport /></Suspense>} />
            <Route path="/resume" element={<Suspense fallback={<PageLoader />}><ResumeEditor /></Suspense>} />
            <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
            <Route path="/history" element={<Suspense fallback={<PageLoader />}><AnalysisHistory /></Suspense>} />
            <Route path="/jobs" element={<Suspense fallback={<PageLoader />}><Jobs /></Suspense>} />
            <Route path="/profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
            <Route path="/support" element={<Suspense fallback={<PageLoader />}><Support /></Suspense>} />
            <Route path="/feedback" element={<Suspense fallback={<PageLoader />}><Feedback /></Suspense>} />
            <Route path="/admin" element={<Suspense fallback={<PageLoader />}><Admin /></Suspense>} />
          </Route>

        </Route>
        <Route path="*" element={<PageNotFound />} />

        </Routes>
      </Router>
    </>
  );
}

export default App;
