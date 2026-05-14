import React, { useState, useRef } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function UploadZone({ onFileSelect, isUploading }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
    }
  };

  const isValidFile = (file) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    return validTypes.includes(file.type) || file.name.endsWith(".pdf") || file.name.endsWith(".docx");
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
          dragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4">
          <div className={`p-4 rounded-2xl transition-colors ${dragOver ? "bg-primary/10" : "bg-muted"}`}>
            <Upload className={`w-8 h-8 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {dragOver ? "Solte seu curriculo aqui" : "Arraste e solte seu curriculo"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">ou clique para procurar • PDF ou DOCX</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button onClick={() => setSelectedFile(null)} className="p-1 hover:bg-muted rounded-md">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isUploading}
              className="w-full mt-3 h-12 text-base font-semibold"
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando curriculo...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Analisar meu curriculo</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
