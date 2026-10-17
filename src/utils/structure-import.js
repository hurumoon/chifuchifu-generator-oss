import { KEYS, RHYTHM_PATTERNS, SECTION_TYPES, ACCOMP_PATTERNS } from "../constants.js";

/** Validate before changing React state, preserving authored IDs and timing. */
export function normalizeImportedSections(sections, keyId = "Am") {
  const used = new Set();
  for (const section of sections) {
    if (!section || typeof section !== "object" || Array.isArray(section)) throw new Error("セクションはオブジェクトで指定してください。");
    if (section.id == null) continue;
    if (!Number.isSafeInteger(section.id) || section.id < 0 || used.has(section.id)) throw new Error("セクションIDは重複しない0以上の整数で指定してください。");
    used.add(section.id);
  }
  let nextId = 1;
  return sections.map((s, index) => {
    let id = s.id;
    if (id == null) {
      while (used.has(nextId)) nextId++;
      id = nextId++;
      used.add(id);
    }
    const measures = s.measures == null ? 8 : Number(s.measures);
    if (!Number.isSafeInteger(measures) || measures < 1) throw new Error(`セクション${index + 1}: 小節数は1以上の整数で指定してください。`);
    const result = {
      ...s, id,
      type: SECTION_TYPES.some(t => t.type === s.type) ? s.type : "A",
      label: s.label ?? SECTION_TYPES.find(t => t.type === s.type)?.label ?? "Aメロ",
      measures, lyrics: typeof s.lyrics === "string" ? s.lyrics : "",
      keyId: KEYS[s.keyId] ? s.keyId : (KEYS[keyId] ? keyId : "Am"),
    };
    if (s.rhythmId != null && !RHYTHM_PATTERNS[s.rhythmId]) delete result.rhythmId;
    for (const field of ["noteHint", "durationHint", "detuneHint"]) {
      if (s[field] == null) continue;
      if (!Array.isArray(s[field])) throw new Error(`${field} は配列で指定してください。`);
      result[field] = s[field].map(Number);
      if (result[field].some(n => !Number.isFinite(n))) throw new Error(`${field} に不正な数値があります。`);
      if (field === "noteHint" && result[field].some(n => !Number.isInteger(n) || n < 0 || n > 127)) throw new Error("noteHint は0〜127の整数で指定してください。");
      if (field === "durationHint" && result[field].some(n => !Number.isSafeInteger(n) || n <= 0)) throw new Error("durationHint は正の整数で指定してください。");
    }
    if (s.lyricHint != null && (!Array.isArray(s.lyricHint) || s.lyricHint.some(lyric => typeof lyric !== "string" || !lyric))) throw new Error("lyricHint は空でない文字列の配列で指定してください。");
    for (const field of ["durationHint", "lyricHint"]) {
      if (result.noteHint && result[field] && result[field].length !== result.noteHint.length) throw new Error("音符・長さ・歌詞の配列長が一致していません。");
    }
    if (s.accompPatterns && typeof s.accompPatterns === "object") {
      result.accompPatterns = Object.fromEntries(Object.entries(s.accompPatterns).filter(([instrument, value]) => {
        if (!ACCOMP_PATTERNS[instrument]) return false;
        return typeof value === "string" ? !!ACCOMP_PATTERNS[instrument][value]
          : Array.isArray(value) && value.every(pattern => typeof pattern === "string" && ACCOMP_PATTERNS[instrument][pattern]);
      }));
    }
    return result;
  });
}
