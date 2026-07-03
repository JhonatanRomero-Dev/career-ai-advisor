import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 🔥 IMPORTANTE: CSS GLOBAL
import "./index.css";

// 🔥 React Query
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";

// 🔥 (opcional mas comum no Base44/shadcn)
import { Toaster } from "sonner"; 
// ou: import { Toaster } from "@/components/ui/toaster";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClientInstance}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
);
