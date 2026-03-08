import { EXPRESSION_DEFAULTS } from "../constants.js";

export function splitSyllables(text, withExpression = false) {
  const small = "ぁぃぅぇぉゃゅょァィゥェォャュョー";
  const result = [];
  const wordStartPositions = new Set();
  const phraseBreakPositions = new Set();
  let cleanedChars = [];
  let afterSpace = true;
  let hasContentBefore = false;
  for (const ch of text) {
    if (/[\n\r]/.test(ch)) {
      if (hasContentBefore) phraseBreakPositions.add(cleanedChars.length);
      afterSpace = true; continue;
    }
    if (/[\s\t　]/.test(ch)) { afterSpace = true; continue; }
    if (afterSpace) wordStartPositions.add(cleanedChars.length);
    cleanedChars.push(ch);
    afterSpace = false;
    hasContentBefore = true;
  }
  const cleaned = cleanedChars.join("");

  let currentDynamics = null;
  let inSerif = false;
  let inVibrato = false;
  let pendingWordStart = false;
  let i = 0;

  while (i < cleaned.length) {
    if (withExpression && phraseBreakPositions.has(i)) {
      result.push({ ...EXPRESSION_DEFAULTS, phraseBreak: true });
    }

    if (wordStartPositions.has(i)) pendingWordStart = true;

    const ch = cleaned[i];

    if (ch === "(" && i + 2 < cleaned.length && cleaned[i + 2] === ")") {
      const dyn = cleaned[i + 1];
      if (dyn === "p" || dyn === "ｐ") { currentDynamics = "p"; i += 3; continue; }
      if (dyn === "f" || dyn === "ｆ") { currentDynamics = "f"; i += 3; continue; }
    }

    if (ch === "「") { inSerif = true; i++; continue; }
    if (ch === "」") { inSerif = false; i++; continue; }

    if (ch === "♪") {
      i++;
      let breathBeats = 1;
      let numStr = "";
      while (i < cleaned.length && (/[0-9０-９]/.test(cleaned[i]) || cleaned[i] === "." || cleaned[i] === "．")) {
        const c = cleaned[i];
        numStr += c >= "０" && c <= "９" ? String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30) : c === "．" ? "." : c;
        i++;
      }
      if (numStr) breathBeats = Math.max(0.25, Math.min(8, parseFloat(numStr) || 1));
      if (withExpression) {
        result.push({ text: "♪", ...EXPRESSION_DEFAULTS, breath: true, breathBeats });
      }
      pendingWordStart = false;
      continue;
    }

    if (ch === "~") {
      inVibrato = !inVibrato;
      if (!inVibrato && withExpression && result.length > 0 && typeof result[result.length - 1] === "object") {
        result[result.length - 1].vibrato = true;
      }
      i++; continue;
    }

    let accent = false, shakuri = false, shakuriDepth = 2, fall = false, fallDepth = 2, tension = false, longNote = false;
    const prefixStartPos = i;

    while (i < cleaned.length) {
      const c = cleaned[i];
      if (c === ">") { accent = true; i++; }
      else if (c === "↗") {
        shakuri = true; i++;
        if (i < cleaned.length && /[1-3１-３]/.test(cleaned[i])) {
          const d = cleaned[i]; shakuriDepth = d >= "１" ? d.charCodeAt(0) - 0xFF10 + 0x30 - 48 : parseInt(d); i++;
        }
      }
      else if (c === "!") { tension = true; i++; }
      else break;
    }

    if (i >= cleaned.length) break;
    const sc = cleaned[i];
    const isWordStart = wordStartPositions.has(i) || wordStartPositions.has(prefixStartPos) || pendingWordStart;
    pendingWordStart = false;

    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF66-\uFF9F]/.test(sc)) {
      let syll = sc;
      i++;
      if (i < cleaned.length && small.includes(cleaned[i])) {
        syll += cleaned[i];
        i++;
      }

      while (i < cleaned.length) {
        const s = cleaned[i];
        if (s === "↘") {
          fall = true; i++;
          if (i < cleaned.length && /[1-3１-３]/.test(cleaned[i])) {
            const d = cleaned[i]; fallDepth = d >= "１" ? d.charCodeAt(0) - 0xFF10 + 0x30 - 48 : parseInt(d); i++;
          }
        }
        else if (s === "_") { longNote = true; i++; }
        else break;
      }

      if (withExpression) {
        let intensity = currentDynamics === "p" ? 60 : currentDynamics === "f" ? 127 : 100;
        if (accent) intensity = Math.min(127, intensity + 30);
        if (tension) intensity = Math.min(127, intensity + 20);
        result.push({
          text: syll,
          ...EXPRESSION_DEFAULTS,
          intensity,
          accent,
          shakuri, shakuriDepth,
          fall, fallDepth,
          vibrato: inVibrato,
          longNote,
          serif: inSerif,
          tension,
          dynamics: currentDynamics,
          wordStart: isWordStart,
        });
      } else {
        result.push(syll);
      }
    } else if (/[a-zA-Zａ-ｚＡ-Ｚ]/.test(sc)) {
      if (withExpression) {
        let intensity = currentDynamics === "p" ? 60 : currentDynamics === "f" ? 127 : 100;
        if (accent) intensity = Math.min(127, intensity + 30);
        if (tension) intensity = Math.min(127, intensity + 20);
        result.push({
          text: sc,
          ...EXPRESSION_DEFAULTS,
          intensity,
          accent,
          shakuri,
          fall: false,
          vibrato: inVibrato,
          longNote: false,
          serif: inSerif,
          tension,
          dynamics: currentDynamics,
        });
      } else {
        result.push(sc);
      }
      i++;
    } else {
      i++;
    }
  }
  return result;
}
