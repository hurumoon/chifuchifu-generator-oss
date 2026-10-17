import { KEYS, PROGRESSIONS, SECTION_TYPES, TPQN } from "../constants.js";
import { generateMelody } from "./melody.js";
import { generateSVP } from "./svp.js";

const vocalTypes = new Set(["A", "B", "chorus", "bridge", "serif"]);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;

// The command entry uses explicit notes so another app cannot regenerate a
// different melody from the same lyrics. Browser auto-composition is unchanged.
export function renderExplicitProject(data, name = "song") {
  const fail = message => { throw new Error(message); };
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("曲JSONはオブジェクトで指定してください。");
  if (!Array.isArray(data.sections) || data.sections.length === 0) fail("sections にセクションを指定してください。");
  const bpm = data.bpm ?? 120;
  const keyId = data.keyId ?? "C";
  const progId = data.progId ?? "canon";
  if (!Number.isFinite(bpm) || bpm <= 0) fail("bpm は正の数で指定してください。");
  if (!Object.hasOwn(KEYS, keyId)) fail(`未対応の keyId: ${keyId}`);
  if (!Object.hasOwn(PROGRESSIONS, progId)) fail(`未対応の progId: ${progId}`);
  const singers = data.singers ?? [];
  if (!Array.isArray(singers) || singers.some(s => !s || typeof s.name !== "string" || !s.name.trim())) fail("singers には空でない name が必要です。");
  if (new Set(singers.map(s => s.name)).size !== singers.length) fail("singers の name が重複しています。");
  const sections = data.sections.map((source, index) => {
    const prefix = `sections[${index}]`;
    if (!source || !SECTION_TYPES.some(s => s.type === source.type)) fail(`${prefix}.type が不正です。`);
    const section = { ...source, id: source.id ?? index, keyId: source.keyId ?? keyId,
      label: source.label ?? source.type, lyrics: source.lyrics ?? "" };
    if (!Object.hasOwn(KEYS, section.keyId)) fail(`${prefix}.keyId が不正です。`);
    if (!positiveInteger(section.measures)) fail(`${prefix}.measures は正の整数で指定してください。`);
    if (typeof section.lyrics !== "string") fail(`${prefix}.lyrics は文字列で指定してください。`);
    const fields = ["noteHint", "durationHint", "lyricHint"];
    const hasHints = fields.some(field => section[field] !== undefined);
    if (!vocalTypes.has(section.type)) {
      if (hasHints) fail(`${prefix}: この種類のセクションでは音符が出力されません。歌唱用の type を指定してください。`);
      return section;
    }
    if (!fields.every(field => Array.isArray(section[field]))) fail(`${prefix}: 音符を共有するため noteHint・durationHint・lyricHint をすべて指定してください。`);
    const count = section.noteHint.length;
    if (count === 0) fail(`${prefix}: 歌唱セクションには1音以上指定してください。休符だけの区間は interlude などで指定してください。`);
    if (!fields.every(field => section[field].length === count)) fail(`${prefix}: 音符・長さ・歌詞の配列長が一致していません。`);
    if (section.noteHint.some(n => !Number.isInteger(n) || n < 0 || n > 127)) fail(`${prefix}.noteHint は 0〜127 の整数で指定してください。`);
    if (section.durationHint.some(n => !positiveInteger(n))) fail(`${prefix}.durationHint は正の整数で指定してください。`);
    if (section.lyricHint.some(s => typeof s !== "string" || !s)) fail(`${prefix}.lyricHint に空でない文字列を指定してください。`);
    // The existing generator merges っ into the preceding note. Require its
    // authored duration to be explicit instead of changing note counts silently.
    if (section.lyricHint.some(lyric => lyric === "っ" || lyric === "ッ")) fail(`${prefix}: 促音「っ」の長さを前の音符の durationHint に含め、lyricHint から単独の「っ」を除いてください。`);
    for (const field of ["singerHint", "detuneHint", "expressionHint", "systemAttributesHint"]) {
      if (section[field] !== undefined && (!Array.isArray(section[field]) || section[field].length !== count)) fail(`${prefix}.${field} は音符と同じ配列長で指定してください。`);
    }
    if (section.singerHint?.some(s => typeof s !== "string" || (s && !singers.some(singer => singer.name === s)))) fail(`${prefix}.singerHint のシンガーが singers にありません。`);
    // Inline tags add pitch offsets only on the SynthV path. Use resolved hints.
    if (!section.singerHint?.length && /\[[^\]]+\]/.test(section.lyrics)) fail(`${prefix}: シンガータグを singerHint と確定済みの noteHint に変換してください。`);
    const rests = section.restHint ?? [];
    if (!Array.isArray(rests) || rests.some(r => !r || !Number.isInteger(r.beforeIndex) || r.beforeIndex < 0 || r.beforeIndex > count || !positiveInteger(r.length))) fail(`${prefix}.restHint の位置または長さが不正です。`);
    const ticks = section.durationHint.reduce((sum, n) => sum + n, 0) + rests.reduce((sum, r) => sum + r.length, 0);
    if (ticks > section.measures * TPQN * 4) fail(`${prefix}: 音符と休符が小節数を超えています（${ticks} ticks）。`);
    return section;
  });
  const project = { ...data, bpm, keyId, progId, sections };
  const melody = generateMelody(sections, progId, data.rhythmId ?? "even", 42);
  let tick = 0;
  const timeline = melody.map(event => {
    const entry = { tick, ...event };
    tick += event.length;
    return entry;
  });
  const expectedTicks = sections.reduce((sum, s) => sum + s.measures * TPQN * 4, 0);
  if (tick !== expectedTicks) fail(`出力の尺が一致しません（${tick} / ${expectedTicks} ticks）。`);
  return { project, timeline, svp: generateSVP(melody, bpm, name, singers.length ? singers : null),
    summary: { bpm, totalTicks: tick, durationSeconds: tick / TPQN * 60 / bpm,
      notes: melody.filter(n => n.type === "note").length, sections: sections.length } };
}
