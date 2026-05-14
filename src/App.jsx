import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import SplashScreen from "@/components/SplashScreen";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import UploadResume from "@/pages/UploadResume";
import AnalysisHistory from "@/pages/AnalysisHistory";
import Jobs from "@/pages/Jobs";
import Profile from "@/pages/Profile";
import AnalysisReport from "@/pages/AnalysisReport";

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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<UploadResume />} />
            <Route path="/history" element={<AnalysisHistory />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/analysis" element={<AnalysisReport />} />
          </Route>

        </Route>

        </Routes>
      </Router>
    </>
  );
}

export default App;
