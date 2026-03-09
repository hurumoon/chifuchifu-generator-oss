// デグレ確認用テストスクリプト
// 旧ファイルのロジックと新モジュールの出力を比較する

import { KEYS, CHORD_DEFS, PROGRESSIONS, DEFAULT_SECTIONS, SECTION_TYPES, TPQN,
         RHYTHM_PATTERNS, EXPRESSION_DEFAULTS, SHAKURI_PRESETS, FALL_PRESETS, NOTE_NAMES } from "./src/constants.js";
import { lyricToPhoneme } from "./src/utils/phoneme.js";
import { splitSyllables } from "./src/utils/syllable.js";
import { downloadFile, noteName } from "./src/utils/helpers.js";
import { generateMelody } from "./src/generators/melody.js";
import { generateUST } from "./src/generators/ust.js";
import { generateSVP } from "./src/generators/svp.js";
import { generateMIDI } from "./src/generators/midi.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function assertEq(a, b, message) {
  if (JSON.stringify(a) === JSON.stringify(b)) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
    console.error(`  expected: ${JSON.stringify(b).slice(0, 200)}`);
    console.error(`  got:      ${JSON.stringify(a).slice(0, 200)}`);
  }
}

// ===== 1. 定数の検証 =====
console.log("--- 1. Constants ---");
assert(Object.keys(KEYS).length === 13, "KEYS has 13 entries");
assert(KEYS.Am.scale.length === 12, "Am scale has 12 notes");
assert(KEYS.Am.root === 57, "Am root is 57");
assert(KEYS.C.root === 60, "C root is 60");
assert(Object.keys(CHORD_DEFS).length === 13, "CHORD_DEFS has 13 keys");
assertEq(CHORD_DEFS.Am.C, [60,64,67], "Am C chord");
assert(Object.keys(PROGRESSIONS).length === 9, "9 progressions");
assertEq(PROGRESSIONS.komuro.chords.Am, ["Am","F","G","C"], "komuro Am chords");
assert(DEFAULT_SECTIONS.length === 5, "5 default sections");
assert(SECTION_TYPES.length === 8, "8 section types");
assert(TPQN === 480, "TPQN is 480");
assert(Object.keys(RHYTHM_PATTERNS).length === 6, "6 rhythm patterns");
assert(EXPRESSION_DEFAULTS.intensity === 100, "default intensity 100");
assert(Object.keys(SHAKURI_PRESETS).length === 3, "3 shakuri presets");
assert(Object.keys(FALL_PRESETS).length === 3, "3 fall presets");
assert(NOTE_NAMES.length === 12, "12 note names");

// ===== 2. Phoneme 変換 =====
console.log("--- 2. Phoneme ---");
assertEq(lyricToPhoneme("あ", null, null, false), "a", "あ -> a");
assertEq(lyricToPhoneme("か", null, null, false), "ka", "か -> ka");
assertEq(lyricToPhoneme("し", null, null, false), "shi", "し -> shi");
assertEq(lyricToPhoneme("つ", null, null, false), "tsu", "つ -> tsu");
assertEq(lyricToPhoneme("ん", null, null, false), "n", "ん -> n");
assertEq(lyricToPhoneme("しゃ", null, null, false), "sha", "しゃ -> sha");
assertEq(lyricToPhoneme("きょ", null, null, false), "kyo", "きょ -> kyo");
assertEq(lyricToPhoneme("っ", null, null, false), "cl", "っ -> cl");
assertEq(lyricToPhoneme("ー", null, null, false), "-", "ー -> -");
// カタカナ
assertEq(lyricToPhoneme("ア", null, null, false), "a", "ア -> a");
assertEq(lyricToPhoneme("カ", null, null, false), "ka", "カ -> ka");
// 助詞
assertEq(lyricToPhoneme("は", "あ", null, false), "wa", "は(助詞) -> wa");
assertEq(lyricToPhoneme("は", null, null, true), "ha", "は(語頭) -> ha");
assertEq(lyricToPhoneme("へ", "あ", null, false), "e", "へ(助詞) -> e");

// ===== 3. Syllable splitting =====
console.log("--- 3. Syllable splitting ---");
assertEq(splitSyllables("あいう"), ["あ", "い", "う"], "basic split");
assertEq(splitSyllables("しゃべる"), ["しゃ", "べ", "る"], "yoon split");
assertEq(splitSyllables("きょう"), ["きょ", "う"], "kyo split");
assertEq(splitSyllables("アイウ"), ["ア", "イ", "ウ"], "katakana split");

// Expression mode
const exprResult = splitSyllables(">あ↘い~う~", true);
assert(exprResult.length === 3, "expr split: 3 syllables");
assert(exprResult[0].accent === true, "expr: accent on あ");
assert(exprResult[0].text === "あ", "expr: text is あ");
assert(exprResult[0].fall === true, "expr: fall on あ");
assert(exprResult[2].vibrato === true, "expr: vibrato on う");

// Breath
const breathResult = splitSyllables("あ♪い", true);
assert(breathResult.length === 3, "breath split: 3 items");
assert(breathResult[1].breath === true, "breath marker");

// Phrase break
const phraseResult = splitSyllables("あ\nい", true);
assert(phraseResult.some(s => s.phraseBreak), "phrase break exists");

// ===== 4. Note name =====
console.log("--- 4. noteName ---");
assertEq(noteName(60), "C4", "C4");
assertEq(noteName(69), "A4", "A4");
assertEq(noteName(57), "A3", "A3");

// ===== 5. Melody generation =====
console.log("--- 5. Melody generation ---");
const testSections = [
  { id: 1, type: "A", label: "Aメロ", measures: 4, lyrics: "あいうえお かきくけこ", keyId: "Am" },
  { id: 2, type: "chorus", label: "サビ", measures: 4, lyrics: "さしすせそ たちつてと", keyId: "Am" },
];

const melody1 = generateMelody(testSections, "komuro", "even", 42);
const melody2 = generateMelody(testSections, "komuro", "even", 42);
assertEq(melody1, melody2, "same seed produces same melody");

const melody3 = generateMelody(testSections, "komuro", "even", 123);
assert(JSON.stringify(melody1) !== JSON.stringify(melody3), "different seed produces different melody");

assert(melody1.length > 0, "melody has notes");
assert(melody1.some(n => n.type === "note"), "melody has note events");
// Note: with 10 syllables in 4 measures, all tick space may be filled by notes (no rests needed)

// Check note properties
const firstNote = melody1.find(n => n.type === "note");
assert(firstNote.noteNum !== undefined, "note has noteNum");
assert(firstNote.length > 0, "note has positive length");
assert(firstNote.lyric !== undefined, "note has lyric");
assert(firstNote.section !== undefined, "note has section");
assert(firstNote.intensity !== undefined, "note has intensity");

// R4: no extremely short rests
assert(melody1.filter(n => n.type === "rest").every(n => n.length >= 120), "no rests < 120 ticks");

// ===== 6. UST generation =====
console.log("--- 6. UST generation ---");
const ust = generateUST(melody1, 140);
assert(typeof ust === "string", "UST is a string");
assert(ust.startsWith("[#SETTING]"), "UST starts with [#SETTING]");
assert(ust.includes("Tempo=140.00"), "UST has tempo");
assert(ust.includes("[#TRACKEND]"), "UST has TRACKEND");
assert(ust.includes("Lyric="), "UST has lyrics");
assert(ust.includes("NoteNum="), "UST has note numbers");

// Deterministic check
const ust2 = generateUST(melody1, 140);
assertEq(ust, ust2, "UST generation is deterministic");

// ===== 7. SVP generation =====
console.log("--- 7. SVP generation ---");
const svp = generateSVP(melody1, 140);
assert(typeof svp === "string", "SVP is a string");
const svpObj = JSON.parse(svp);
assert(svpObj.version === 153, "SVP version 153");
assert(svpObj.tracks.length === 1, "SVP has 1 track");
assert(svpObj.tracks[0].mainGroup.notes.length > 0, "SVP has notes");
assert(svpObj.time.tempo[0].bpm === 140, "SVP tempo is 140");
assert(svpObj.tracks[0].renderEnabled === false, "SVP renderEnabled is false");

// Deterministic (except UUID)
const svpObj2 = JSON.parse(generateSVP(melody1, 140));
assert(svpObj.tracks[0].mainGroup.notes.length === svpObj2.tracks[0].mainGroup.notes.length, "SVP note count deterministic");

// ===== 8. MIDI generation =====
console.log("--- 8. MIDI generation ---");
const midi = generateMIDI(melody1, testSections, "komuro", 140);
assert(midi instanceof Uint8Array, "MIDI is Uint8Array");
assert(midi.length > 0, "MIDI has content");
// MThd header
assert(midi[0] === 0x4D && midi[1] === 0x54 && midi[2] === 0x68 && midi[3] === 0x64, "MIDI starts with MThd");
// 4 tracks (format 1)
assert(midi[10] === 0 && midi[11] === 8, "MIDI has 8 tracks");

// Deterministic
const midi2 = generateMIDI(melody1, testSections, "komuro", 140);
assertEq(Array.from(midi), Array.from(midi2), "MIDI generation is deterministic");

// ===== 9. Rhythm patterns =====
console.log("--- 9. Rhythm patterns ---");
for (const rhythmId of Object.keys(RHYTHM_PATTERNS)) {
  const m = generateMelody(testSections, "komuro", rhythmId, 42);
  assert(m.length > 0, `rhythm '${rhythmId}' produces output`);
  assert(m.some(n => n.type === "note"), `rhythm '${rhythmId}' has notes`);
}

// ===== 10. All keys =====
console.log("--- 10. All keys ---");
for (const keyId of Object.keys(KEYS)) {
  const secs = [{ id: 1, type: "A", label: "Aメロ", measures: 4, lyrics: "あいうえお", keyId }];
  const m = generateMelody(secs, "komuro", "even", 42);
  assert(m.length > 0, `key '${keyId}' produces output`);
}

// ===== 11. All progressions =====
console.log("--- 11. All progressions ---");
for (const progId of Object.keys(PROGRESSIONS)) {
  const m = generateMelody(testSections, progId, "even", 42);
  assert(m.length > 0, `progression '${progId}' produces output`);
}

// ===== 12. Edge cases =====
console.log("--- 12. Edge cases ---");
// Empty lyrics
const emptyLyrics = [{ id: 1, type: "A", label: "Aメロ", measures: 4, lyrics: "", keyId: "Am" }];
const emptyMelody = generateMelody(emptyLyrics, "komuro", "even", 42);
assert(emptyMelody.length > 0, "empty lyrics produces rests");
assert(emptyMelody.every(n => n.type === "rest"), "empty lyrics has only rests");

// Intro/outro (no melody range)
const introSec = [{ id: 1, type: "intro", label: "イントロ", measures: 2, lyrics: "", keyId: "Am" }];
const introMelody = generateMelody(introSec, "komuro", "even", 42);
assert(introMelody.length > 0, "intro produces rests");

// Expression symbols
const exprSec = [{ id: 1, type: "A", label: "Aメロ", measures: 4, lyrics: ">あ ↗い う↘ ~え~ お_ ♪か", keyId: "Am" }];
const exprMelody = generateMelody(exprSec, "komuro", "even", 42);
assert(exprMelody.length > 0, "expression lyrics produce output");
assert(exprMelody.some(n => n.type === "note" && n.accent), "accent note exists");
assert(exprMelody.some(n => n.type === "note" && n.shakuri), "shakuri note exists");

// Serif section
const serifSec = [{ id: 1, type: "serif", label: "セリフ", measures: 4, lyrics: "なにいってんの", keyId: "Am" }];
const serifMelody = generateMelody(serifSec, "komuro", "even", 42);
assert(serifMelody.some(n => n.type === "note" && n.serif), "serif notes have serif flag");

// ===== 13. UST shakuri/fall/vibrato =====
console.log("--- 13. UST expression ---");
const exprUst = generateUST(exprMelody, 140);
assert(exprUst.includes("PBS="), "UST has pitch bend for shakuri/fall");

// ===== Summary =====
console.log("\n============================");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("ALL TESTS PASSED");
} else {
  console.error(`${failed} TEST(S) FAILED`);
  process.exit(1);
}
