import React, { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes = 0) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function UploadZone({
  onFileSelect,
  isUploading,
  disabled = false,
  disabledMessage = "Envio indisponível",
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef(null);

  const isValidFile = (file) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const fileName = String(file.name || "").toLowerCase();

    return validTypes.includes(file.type) || fileName.endsWith(".pdf") || fileName.endsWith(".docx");
  };

  const selectFile = (file) => {
    setFileError("");

    if (disabled || isUploading || !file) {
      return;
    }

    if (!isValidFile(file)) {
      setSelectedFile(null);
      setFileError("Envie um arquivo PDF ou DOCX.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setFileError("O arquivo deve ter no máximo 10 MB.");
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);

    if (disabled || isUploading) {
      return;
    }

    selectFile(event.dataTransfer.files[0]);
  };

  const handleChange = (event) => {
    selectFile(event.target.files[0]);
    event.target.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isUploading || disabled || !selectedFile) {
      return;
    }

    await onFileSelect(selectedFile);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();

          if (!disabled && !isUploading) {
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !isUploading) {
            inputRef.current?.click();
          }
        }}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-colors duration-300 ${
          disabled || isUploading ? "cursor-not-allowed opacity-70" : "cursor-pointer"
        } ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={handleChange}
          disabled={disabled || isUploading}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          <div className={`rounded-2xl p-4 transition-colors ${dragOver ? "bg-primary/10" : "bg-muted"}`}>
            <Upload className={`h-8 w-8 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {disabled ? disabledMessage : dragOver ? "Solte seu currículo aqui" : "Arraste e solte seu currículo"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">PDF ou DOCX até 10 MB</p>
          </div>
        </div>
      </div>

      {fileError && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fileError}
        </p>
      )}

      <AnimatePresence>
        {selectedFile && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={handleSubmit}
          >
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/50 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
                className="rounded-md p-1 hover:bg-muted disabled:opacity-50"
                aria-label="Remover arquivo"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <Button
              type="submit"
              disabled={isUploading || disabled || !selectedFile}
              className="mt-3 h-12 w-full text-base font-semibold"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando currículo...
                </>
              ) : disabled ? (
                disabledMessage
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Analisar meu currículo
                </>
              )}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
