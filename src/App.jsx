import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import SplashScreen from "@/components/SplashScreen";
import PageNotFound from "@/lib/PageNotFound";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const UploadResume = lazy(() => import("@/pages/UploadResume"));
const AnalysisHistory = lazy(() => import("@/pages/AnalysisHistory"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const Profile = lazy(() => import("@/pages/Profile"));
const AnalysisReport = lazy(() => import("@/pages/AnalysisReport"));
const Support = lazy(() => import("@/pages/Support"));

function PageLoader() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return sessionStorage.getItem("career-ai-splash-seen") !== "true";
  });

  useEffect(() => {
    if (!showSplash) {
      return undefined;
    }

    sessionStorage.setItem("career-ai-splash-seen", "true");

    const timeout = window.setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [showSplash]);

  return (
    <>
      <AnimatePresence>{showSplash && <SplashScreen />}</AnimatePresence>

      <Router>
        <Routes>

        {/* Página inicial */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Rotas protegidas */}
        <Route element={<ProtectedRoute />}>

          {/* Layout com Sidebar */}
          <Route element={<AppLayout />}>
            <Route path="/upload" element={<Suspense fallback={<PageLoader />}><UploadResume /></Suspense>} />
            <Route path="/analysis" element={<Suspense fallback={<PageLoader />}><AnalysisReport /></Suspense>} />
            <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
            <Route path="/history" element={<Suspense fallback={<PageLoader />}><AnalysisHistory /></Suspense>} />
            <Route path="/jobs" element={<Suspense fallback={<PageLoader />}><Jobs /></Suspense>} />
            <Route path="/profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
            <Route path="/support" element={<Suspense fallback={<PageLoader />}><Support /></Suspense>} />
          </Route>

        </Route>
        <Route path="*" element={<PageNotFound />} />

        </Routes>
      </Router>
    </>
  );
}

export default App;
