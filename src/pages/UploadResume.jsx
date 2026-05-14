import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Sparkles, Shield, Clock } from "lucide-react";
import { motion } from "framer-motion";
import UploadZone from "@/components/upload/UploadZone";
import { saveResumeHistoryEntry } from "@/lib/resumeHistory";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BASE44_APP_BASE_URL ||
  "http://localhost:3000";

export default function UploadResume() {
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleFileSelect = async (file) => {
    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch(`${API_BASE_URL}/api/analysis`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      console.log("ANÁLISE:", data);

      localStorage.setItem("analysisResult", JSON.stringify(data));
      saveResumeHistoryEntry({
        file,
        analysis: data.analysis,
      });

      navigate("/dashboard");

    } 
    catch (error) {
  console.error("ERRO COMPLETO:", error);

  if (error.response) {
    console.log(await error.response.json());
  }

  alert("Erro ao enviar currículo");
}
     finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pt-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Envie seu curriculo
          </h1>

          <p className="text-muted-foreground mt-2">
            Nossa IA vai analisar cada detalhe em segundos
          </p>
        </div>

        <Card className="p-8 border-border/50">
          <UploadZone
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
          />
        </Card>

        <div className="grid grid-cols-3 gap-4 mt-8">
          {[
            { icon: Sparkles, text: "Analise com IA" },
            { icon: Shield, text: "100% privado e seguro" },
            { icon: Clock, text: "Resultado em segundos" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center gap-2 py-4"
            >
              <div className="p-2 rounded-lg bg-muted">
                <item.icon className="w-4 h-4 text-muted-foreground" />
              </div>

              <span className="text-xs text-muted-foreground font-medium">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
