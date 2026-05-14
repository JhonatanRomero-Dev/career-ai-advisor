import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background flex">
      
      <Sidebar />

      <main className="flex-1 ml-64 p-6 lg:p-8">
        <Outlet />
      </main>

    </div>
  );
}