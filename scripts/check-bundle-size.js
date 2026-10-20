import fs from "node:fs";
import path from "node:path";

const assetsDirectory = path.resolve("dist", "assets");
const maxChunkBytes = Number(process.env.BUNDLE_MAX_CHUNK_BYTES || 400_000);
const maxTotalJavaScriptBytes = Number(process.env.BUNDLE_MAX_TOTAL_JS_BYTES || 1_750_000);

if (!fs.existsSync(assetsDirectory)) {
  throw new Error("A pasta dist/assets não existe. Execute o build antes de verificar o bundle.");
}

const chunks = fs.readdirSync(assetsDirectory)
  .filter((fileName) => fileName.endsWith(".js"))
  .map((fileName) => ({
    fileName,
    bytes: fs.statSync(path.join(assetsDirectory, fileName)).size
  }))
  .sort((left, right) => right.bytes - left.bytes);

const totalBytes = chunks.reduce((total, chunk) => total + chunk.bytes, 0);
const oversizedChunks = chunks.filter((chunk) => chunk.bytes > maxChunkBytes);
const failures = [];

if (oversizedChunks.length > 0) {
  failures.push(
    `Chunks acima de ${maxChunkBytes} bytes: ${oversizedChunks
      .map((chunk) => `${chunk.fileName} (${chunk.bytes})`)
      .join(", ")}`
  );
}

if (totalBytes > maxTotalJavaScriptBytes) {
  failures.push(
    `JavaScript total acima de ${maxTotalJavaScriptBytes} bytes: ${totalBytes}`
  );
}

console.log(JSON.stringify({
  chunks: chunks.length,
  largest_chunk: chunks[0] || null,
  total_javascript_bytes: totalBytes,
  limits: {
    max_chunk_bytes: maxChunkBytes,
    max_total_javascript_bytes: maxTotalJavaScriptBytes
  }
}, null, 2));

if (failures.length > 0) {
  throw new Error(`Orçamento de bundle excedido. ${failures.join(" | ")}`);
}
