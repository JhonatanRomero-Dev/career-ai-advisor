export function resumeParagraphs(content) {
  return [...content.matchAll(/[^\r\n]+(?:\r?\n(?!\r?\n)[^\r\n]+)*/g)]
    .map((match) => ({ text: match[0], start: match.index, end: match.index + match[0].length }))
    .filter((part) => part.text.trim());
}

export function replaceResumeExcerpt(content, excerpt, replacement) {
  if (!excerpt || content.slice(excerpt.start, excerpt.end) !== excerpt.text) {
    throw new Error("O trecho mudou. Selecione-o novamente antes de aplicar a revisão.");
  }
  return content.slice(0, excerpt.start) + replacement + content.slice(excerpt.end);
}

export function resumeLines(content) {
  return String(content || "").replace(/\r\n?/g, "\n").split("\n").map((line) => ({
    heading: /^(#{1,6})\s/.test(line),
    text: line.replace(/^#{1,6}\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)"),
  }));
}
