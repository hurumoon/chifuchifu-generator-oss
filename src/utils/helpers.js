import { NOTE_NAMES } from "../constants.js";

export function downloadFile(content, filename, type = "text/plain") {
  const blob = content instanceof Uint8Array
    ? new Blob([content], { type: "application/octet-stream" })
    : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function noteName(n) { return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`; }
