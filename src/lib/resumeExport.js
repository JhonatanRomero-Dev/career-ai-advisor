import { resumeLines } from "./resumeDocument.js";

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// OOXML is a ZIP package. Stored entries keep this small text-only export dependency-free.
function zipFiles(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  let centralSize = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = encoder.encode(path);
    const data = encoder.encode(text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true); view.setUint16(12, 33, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true); local.set(name, 30);
    locals.push(local, data);
    const directory = new Uint8Array(46 + name.length);
    const entry = new DataView(directory.buffer);
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true); entry.setUint16(14, 33, true);
    entry.setUint32(16, crc, true); entry.setUint32(20, data.length, true); entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true); directory.set(name, 46);
    central.push(directory); centralSize += directory.length; offset += local.length + data.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, central.length, true); view.setUint16(10, central.length, true);
  view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
  return new Blob([...locals, ...central, end], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

const xml = (text) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function createResumeDocx(content) {
  const paragraphs = resumeLines(content).map(({ text, heading }) => `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr>${heading ? '<w:b/><w:sz w:val="28"/>' : '<w:sz w:val="22"/>'}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`).join("");
  return zipFiles({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`,
  });
}

export async function createResumePdf(content) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 20;
  for (const { text, heading } of resumeLines(content)) {
    doc.setFont("helvetica", heading ? "bold" : "normal");
    doc.setFontSize(heading ? 14 : 11);
    const lines = doc.splitTextToSize(text || " ", 170);
    for (const line of lines) {
      if (y > 277) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += heading ? 7 : 5.5;
    }
    y += 1.5;
  }
  return doc.output("blob");
}

export function downloadResume(blob, name, extension) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${String(name || "curriculo").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 120) || "curriculo"}.${extension}`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
