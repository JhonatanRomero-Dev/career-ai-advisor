import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 🔥 IMPORTANTE: CSS GLOBAL
import "./index.css";

// 🔥 React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// 🔥 (opcional mas comum no Base44/shadcn)
import { Toaster } from "sonner"; 
// ou: import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
);