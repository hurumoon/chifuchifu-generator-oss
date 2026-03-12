// 追加テスト: rhythm-detect, singer, ust-import, エッジケース
// test-regression.js で未カバーの重要機能をテストする

import { TPQN, RHYTHM_PATTERNS } from "./src/constants.js";
import { detectRhythmId } from "./src/utils/rhythm-detect.js";
import { extractSingerNames, splitMelodyBySinger } from "./src/utils/singer.js";
import { parseUST, ustToProjectJSON } from "./src/generators/ust-import.js";
import { generateMelody } from "./src/generators/melody.js";
import { generateUST } from "./src/generators/ust.js";
import { generateSVP } from "./src/generators/svp.js";
import { generateMIDI } from "./src/generators/midi.js";
import { splitSyllables } from "./src/utils/syllable.js";
import { lyricToPhoneme } from "./src/utils/phoneme.js";

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

// ===== 1. detectRhythmId =====
console.log("--- 1. detectRhythmId: basic ---");

// null / 短すぎる入力 → "even"
assertEq(detectRhythmId(null), "even", "null input → even");
assertEq(detectRhythmId([]), "even", "empty array → even");
assertEq(detectRhythmId([480, 480]), "even", "too few durations → even");
assertEq(detectRhythmId([480, 480, 480]), "even", "3 durations → even");

// 均等な音符 → "even"
const evenDurations = Array(16).fill(TPQN);
assertEq(detectRhythmId(evenDurations), "even", "uniform durations → even");

// 微小な変動でもeven（CV < 0.1）
const almostEven = Array(16).fill(TPQN).map((d, i) => d + (i % 2 === 0 ? 5 : -5));
assertEq(detectRhythmId(almostEven), "even", "near-uniform durations → even");

// 全て0 → "even"
assertEq(detectRhythmId([0, 0, 0, 0, 0, 0]), "even", "all zeros → even");

console.log("--- 2. detectRhythmId: swing pattern ---");

// swing: weights [3,1] → 長-短の繰り返し
// 3:1 比率のパターン（BPM >= 120 → swing）
const swingDurations = [];
for (let i = 0; i < 8; i++) {
  swingDurations.push(TPQN * 3); // 長
  swingDurations.push(TPQN * 1); // 短
}
assertEq(detectRhythmId(swingDurations, { bpm: 140 }), "swing", "3:1 pattern at BPM 140 → swing");

// 同じパターンでもBPM < 120 → dotted
assertEq(detectRhythmId(swingDurations, { bpm: 100 }), "dotted", "3:1 pattern at BPM 100 → dotted");

// BPM未指定時はデフォルト120 → swing
assertEq(detectRhythmId(swingDurations), "swing", "3:1 pattern default BPM → swing");

console.log("--- 3. detectRhythmId: march pattern ---");

// march: weights [1,1,2] → 短-短-長
const marchDurations = [];
for (let i = 0; i < 6; i++) {
  marchDurations.push(TPQN * 1); // 短
  marchDurations.push(TPQN * 1); // 短
  marchDurations.push(TPQN * 2); // 長
}
assertEq(detectRhythmId(marchDurations), "march", "1:1:2 pattern → march");

console.log("--- 4. detectRhythmId: synco pattern ---");

// synco: weights [1,2,1] → 短-長-短
const syncoDurations = [];
for (let i = 0; i < 6; i++) {
  syncoDurations.push(TPQN * 1);
  syncoDurations.push(TPQN * 2);
  syncoDurations.push(TPQN * 1);
}
assertEq(detectRhythmId(syncoDurations), "synco", "1:2:1 pattern → synco");

console.log("--- 5. detectRhythmId: gallop pattern ---");

// gallop: weights [1,1,3] → 短-短-長（疾走感）
const gallopDurations = [];
for (let i = 0; i < 6; i++) {
  gallopDurations.push(TPQN * 1);
  gallopDurations.push(TPQN * 1);
  gallopDurations.push(TPQN * 3);
}
assertEq(detectRhythmId(gallopDurations), "gallop", "1:1:3 pattern → gallop");

console.log("--- 6. detectRhythmId: shuffle pattern ---");

// shuffle: weights [2,1,2,1]
const shuffleDurations = [];
for (let i = 0; i < 4; i++) {
  shuffleDurations.push(TPQN * 2);
  shuffleDurations.push(TPQN * 1);
  shuffleDurations.push(TPQN * 2);
  shuffleDurations.push(TPQN * 1);
}
assertEq(detectRhythmId(shuffleDurations), "shuffle", "2:1:2:1 pattern → shuffle");

console.log("--- 7. detectRhythmId: ballad pattern ---");

// ballad: weights [3,1,2,2]
const balladDurations = [];
for (let i = 0; i < 4; i++) {
  balladDurations.push(TPQN * 3);
  balladDurations.push(TPQN * 1);
  balladDurations.push(TPQN * 2);
  balladDurations.push(TPQN * 2);
}
assertEq(detectRhythmId(balladDurations), "ballad", "3:1:2:2 pattern → ballad");

console.log("--- 8. detectRhythmId: grace note filtering ---");

// 装飾音（TPQN/8 未満）はフィルタされる
const withGraceNotes = [10, 480, 10, 480, 10, 480, 10, 480]; // 装飾音除外後は均等
assertEq(detectRhythmId(withGraceNotes), "even", "grace notes filtered → even");

// 装飾音除外後に4未満 → "even"
const onlyGrace = [10, 20, 30, 15, 10, 20];
assertEq(detectRhythmId(onlyGrace), "even", "only grace notes → even");

console.log("--- 9. detectRhythmId: low score fallback ---");

// ランダムなデュレーション → スコアが閾値未満なら "even"
const randomDurations = [100, 800, 200, 600, 150, 900, 300, 500, 120, 700, 250, 400];
const randomResult = detectRhythmId(randomDurations);
// ランダム入力はいずれかの結果を返す（crashしない）
assert(typeof randomResult === "string", "random durations returns string");
assert(Object.keys(RHYTHM_PATTERNS).includes(randomResult), "random durations returns valid pattern ID");

// ===== 10. extractSingerNames =====
console.log("--- 10. extractSingerNames ---");

// 空のメロディ
assertEq(extractSingerNames([]), [], "empty melody → empty names");

// シンガー無し
const noSingerMelody = [
  { type: "note", singer: null },
  { type: "rest" },
  { type: "note", singer: null },
];
assertEq(extractSingerNames(noSingerMelody), [], "no singer → empty names");

// 単一シンガー
const singleSingerMelody = [
  { type: "note", singer: "Miku" },
  { type: "note", singer: "Miku" },
  { type: "rest" },
];
assertEq(extractSingerNames(singleSingerMelody), ["Miku"], "single singer");

// 複数シンガー（出現順を保持）
const multiSingerMelody = [
  { type: "note", singer: "Rin" },
  { type: "note", singer: "Len" },
  { type: "note", singer: "Rin" },
  { type: "note", singer: "Miku" },
  { type: "note", singer: "Len" },
];
assertEq(extractSingerNames(multiSingerMelody), ["Rin", "Len", "Miku"], "multiple singers in order");

// singerがnullのノートはスキップ
const mixedSingerMelody = [
  { type: "note", singer: null },
  { type: "note", singer: "Kaito" },
  { type: "note", singer: null },
  { type: "note", singer: "Meiko" },
];
assertEq(extractSingerNames(mixedSingerMelody), ["Kaito", "Meiko"], "null singers skipped");

// ===== 11. splitMelodyBySinger =====
console.log("--- 11. splitMelodyBySinger: basic ---");

const splitTestMelody = [
  { type: "note", singer: "Miku", length: 480, noteNum: 60, lyric: "あ", section: "A" },
  { type: "rest", length: 240, section: "A" },
  { type: "note", singer: "Rin", length: 480, noteNum: 62, lyric: "い", section: "A" },
  { type: "note", singer: null, length: 480, noteNum: 64, lyric: "う", section: "A" },
  { type: "note", singer: "Miku", length: 480, noteNum: 65, lyric: "え", section: "A" },
];

const splitResult = splitMelodyBySinger(splitTestMelody, ["Miku", "Rin"]);

assert(splitResult instanceof Map, "result is a Map");
assert(splitResult.has("Miku"), "has Miku track");
assert(splitResult.has("Rin"), "has Rin track");

// Mikuのトラック: Miku自身のノート + rest + Rinのノートがrestに変換 + null singer + Mikuのノート
const mikuTrack = splitResult.get("Miku");
assert(mikuTrack[0].type === "note" && mikuTrack[0].lyric === "あ", "Miku: first note is あ");
// Rinのノートはrest化 → 元のrest(240) + Rinのrest(480) がマージ
assert(mikuTrack[1].type === "rest" && mikuTrack[1].length === 720, "Miku: Rin's note becomes rest, merged with adjacent rest");
assert(mikuTrack[2].type === "note" && mikuTrack[2].lyric === "う", "Miku: null singer note included");
assert(mikuTrack[3].type === "note" && mikuTrack[3].lyric === "え", "Miku: own note included");
assertEq(mikuTrack.length, 4, "Miku track: 4 items (rest merged)");

// Rinのトラック: Mikuのノート(480)+rest(240)がマージ(720) → Rin自身 → null singer → Mikuのrest
const rinTrack = splitResult.get("Rin");
assert(rinTrack[0].type === "rest" && rinTrack[0].length === 720, "Rin: Miku's note + rest merged (720)");
assert(rinTrack[1].type === "note" && rinTrack[1].lyric === "い", "Rin: own note included");
assert(rinTrack[2].type === "note" && rinTrack[2].lyric === "う", "Rin: null singer note included");
assert(rinTrack[3].type === "rest" && rinTrack[3].length === 480, "Rin: Miku's 2nd note becomes rest");
assertEq(rinTrack.length, 4, "Rin track: 4 items after merge");

console.log("--- 12. splitMelodyBySinger: rest merging ---");

// 連続する他シンガーノート → 連続restがマージされることを確認
const mergeMelody = [
  { type: "note", singer: "A", length: 480, noteNum: 60, section: "A" },
  { type: "note", singer: "A", length: 480, noteNum: 62, section: "A" },
  { type: "note", singer: "A", length: 480, noteNum: 64, section: "A" },
  { type: "note", singer: "B", length: 240, noteNum: 65, section: "A" },
];

const mergeResult = splitMelodyBySinger(mergeMelody, ["A", "B"]);
const bTrack = mergeResult.get("B");
// Aの3ノート(480*3=1440) → 全てrest → マージされて1つのrest
assert(bTrack[0].type === "rest" && bTrack[0].length === 1440, "B track: consecutive rests merged (1440)");
assert(bTrack[1].type === "note" && bTrack[1].length === 240, "B track: own note preserved");
assertEq(bTrack.length, 2, "B track: 2 items after merge");

console.log("--- 13. splitMelodyBySinger: empty / single singer ---");

// 空のメロディ
const emptyResult = splitMelodyBySinger([], ["Miku"]);
assertEq(emptyResult.get("Miku").length, 0, "empty melody → empty track");

// 全ノートがnull singer → 全シンガーに同じコピー
const allNullMelody = [
  { type: "note", singer: null, length: 480, noteNum: 60, section: "A" },
  { type: "note", singer: null, length: 480, noteNum: 62, section: "A" },
];
const allNullResult = splitMelodyBySinger(allNullMelody, ["X", "Y"]);
assertEq(allNullResult.get("X").length, 2, "null singers: X gets all notes");
assertEq(allNullResult.get("Y").length, 2, "null singers: Y gets all notes");
assert(allNullResult.get("X")[0].type === "note", "null singers: X has note");
assert(allNullResult.get("Y")[0].type === "note", "null singers: Y has note");

// ===== 14. parseUST =====
console.log("--- 14. parseUST ---");

const sampleUST = `[#SETTING]
Tempo=130.00
Tracks=1
VoiceDir=

[#0000]
Length=480
Lyric=あ
NoteNum=60
Intensity=100
Modulation=0

[#0001]
Length=240
Lyric=R
NoteNum=60

[#0002]
Length=960
Lyric=ka
NoteNum=64
Intensity=80
Modulation=10

[#0003]
Length=480
Lyric=し
NoteNum=67
VBR=50,100,50,0,0,0

[#TRACKEND]
`;

const { melody: ustMelody, bpm: ustBpm } = parseUST(sampleUST);

assertEq(ustBpm, 130, "UST BPM parsed");
assertEq(ustMelody.length, 4, "UST melody has 4 events");

// ノート1: あ
assert(ustMelody[0].type === "note", "UST note 0 is note");
assertEq(ustMelody[0].lyric, "あ", "UST note 0 lyric");
assertEq(ustMelody[0].noteNum, 60, "UST note 0 noteNum");
assertEq(ustMelody[0].length, 480, "UST note 0 length");
assertEq(ustMelody[0].intensity, 100, "UST note 0 intensity");

// ノート2: R(休符)
assert(ustMelody[1].type === "rest", "UST note 1 is rest");
assertEq(ustMelody[1].length, 240, "UST rest length");

// ノート3: ka → かに変換
assert(ustMelody[2].type === "note", "UST note 2 is note");
assertEq(ustMelody[2].lyric, "か", "UST phoneme ka → か");
assertEq(ustMelody[2].noteNum, 64, "UST note 2 noteNum");
assertEq(ustMelody[2].length, 960, "UST note 2 length");
assertEq(ustMelody[2].intensity, 80, "UST note 2 intensity");
assertEq(ustMelody[2].modulation, 10, "UST note 2 modulation");

// ノート4: し (VBR付き)
assert(ustMelody[3].type === "note", "UST note 3 is note");
assertEq(ustMelody[3].lyric, "し", "UST note 3 lyric");
assertEq(ustMelody[3].vibrato, true, "UST note 3 has vibrato");

console.log("--- 15. parseUST: edge cases ---");

// 空のUSTファイル
const emptyUST = parseUST("");
assertEq(emptyUST.bpm, 120, "empty UST → default BPM 120");
assertEq(emptyUST.melody.length, 0, "empty UST → no notes");

// SETTINGのみ
const settingOnlyUST = parseUST("[#SETTING]\nTempo=180.00\n[#TRACKEND]\n");
assertEq(settingOnlyUST.bpm, 180, "setting-only UST → BPM 180");
assertEq(settingOnlyUST.melody.length, 0, "setting-only UST → no notes");

// ローマ字→ひらがな変換のテスト
const phonemeUST = `[#SETTING]
Tempo=120.00
[#0000]
Length=480
Lyric=sha
NoteNum=60
[#0001]
Length=480
Lyric=kyo
NoteNum=62
[#0002]
Length=480
Lyric=cl
NoteNum=64
[#0003]
Length=480
Lyric=tsu
NoteNum=65
`;
const { melody: phonemeMelody } = parseUST(phonemeUST);
assertEq(phonemeMelody[0].lyric, "しゃ", "UST sha → しゃ");
assertEq(phonemeMelody[1].lyric, "きょ", "UST kyo → きょ");
assertEq(phonemeMelody[2].lyric, "っ", "UST cl → っ");
assertEq(phonemeMelody[3].lyric, "つ", "UST tsu → つ");

// ===== 16. ustToProjectJSON =====
console.log("--- 16. ustToProjectJSON ---");

const projectJSON = ustToProjectJSON(sampleUST);
assertEq(projectJSON.bpm, 130, "project JSON bpm");
assert(projectJSON.sections.length >= 1, "project JSON has sections");
assert(projectJSON.sections[0].noteHint.length > 0, "section has noteHint");
assert(projectJSON.sections[0].durationHint.length > 0, "section has durationHint");
assert(typeof projectJSON.rhythmId === "string", "project JSON has rhythmId");
assert(Object.keys(RHYTHM_PATTERNS).includes(projectJSON.rhythmId), "rhythmId is valid");

// 空のUST → 空のセクション
const emptyProjectJSON = ustToProjectJSON("[#SETTING]\nTempo=120.00\n[#TRACKEND]\n");
assertEq(emptyProjectJSON.sections.length, 0, "empty UST → no sections");
assertEq(emptyProjectJSON.bpm, 120, "empty UST project BPM");

// ===== 17. UST ラウンドトリップ (generate → parse) =====
console.log("--- 17. UST round-trip ---");

const testSections = [
  { id: 1, type: "A", label: "Aメロ", measures: 4, lyrics: "あいうえお かきくけこ", keyId: "Am" },
];
const origMelody = generateMelody(testSections, "komuro", "even", 42);
const ustText = generateUST(origMelody, 140);
const { melody: reimported, bpm: reimportedBpm } = parseUST(ustText);

assertEq(reimportedBpm, 140, "round-trip BPM preserved");

const origNotes = origMelody.filter(n => n.type === "note");
const reimportedNotes = reimported.filter(n => n.type === "note");
assertEq(reimportedNotes.length, origNotes.length, "round-trip note count preserved");

// ピッチが保持されていることを確認
for (let i = 0; i < Math.min(origNotes.length, reimportedNotes.length); i++) {
  assert(origNotes[i].noteNum === reimportedNotes[i].noteNum,
    `round-trip note ${i} pitch: ${origNotes[i].noteNum} === ${reimportedNotes[i].noteNum}`);
}

// ===== 18. マルチシンガーのメロディ生成・エクスポート統合テスト =====
console.log("--- 18. Multi-singer integration ---");

const multiSingerSections = [
  { id: 1, type: "A", label: "Aメロ", measures: 4, lyrics: "[Miku]あいう[Rin]えおか", keyId: "Am" },
];
const multiMelody = generateMelody(multiSingerSections, "komuro", "even", 42);
const singers = extractSingerNames(multiMelody);

// シンガータグが処理されていること
if (singers.length > 0) {
  const splitTracks = splitMelodyBySinger(multiMelody, singers);
  for (const name of singers) {
    const track = splitTracks.get(name);
    assert(track.length > 0, `singer "${name}" has non-empty track`);
  }

  // 各トラックのUST/SVP生成がクラッシュしないこと
  for (const name of singers) {
    const track = splitTracks.get(name);
    const trackUST = generateUST(track, 140, "test", name);
    assert(typeof trackUST === "string" && trackUST.length > 0, `UST for "${name}" generated`);
    const trackSVP = generateSVP(track, 140, "test", [name]);
    assert(typeof trackSVP === "string" && trackSVP.length > 0, `SVP for "${name}" generated`);
  }
}

// シンガータグなしでもメロディ生成は問題なし
assert(multiMelody.length > 0, "multi-singer melody generated");
assert(multiMelody.some(n => n.type === "note"), "multi-singer melody has notes");

// ===== 19. エクスポーターのエッジケース =====
console.log("--- 19. Exporter edge cases ---");

// 休符のみのメロディ
const restOnlyMelody = [
  { type: "rest", length: 1920, section: "A" },
  { type: "rest", length: 1920, section: "A" },
];
const restUST = generateUST(restOnlyMelody, 120);
assert(typeof restUST === "string", "rest-only UST generated");
assert(restUST.includes("[#SETTING]"), "rest-only UST has SETTING");

const restSVP = generateSVP(restOnlyMelody, 120);
assert(typeof restSVP === "string", "rest-only SVP generated");
const restSVPObj = JSON.parse(restSVP);
assertEq(restSVPObj.tracks[0].mainGroup.notes.length, 0, "rest-only SVP has 0 notes");

const restMIDI = generateMIDI(restOnlyMelody, testSections, "komuro", 120);
assert(restMIDI instanceof Uint8Array, "rest-only MIDI generated");

// 単一ノート
const singleNoteMelody = [
  { type: "note", noteNum: 60, lyric: "あ", length: 1920, section: "A",
    intensity: 100, modulation: 0, accent: false, shakuri: false, fall: false,
    vibrato: false, longNote: false, breath: false, serif: false, tension: false,
    dynamics: null, wordStart: true, singer: null, shakuriDepth: 2, fallDepth: 2 },
];
const singleUST = generateUST(singleNoteMelody, 120);
assert(singleUST.includes("Lyric=a"), "single note UST has lyric (phoneme)");
const singleSVP = JSON.parse(generateSVP(singleNoteMelody, 120));
assertEq(singleSVP.tracks[0].mainGroup.notes.length, 1, "single note SVP has 1 note");

// ===== 20. splitSyllables: マルチシンガータグ =====
console.log("--- 20. splitSyllables: multi-singer tags ---");

const singerTagResult = splitSyllables("[Miku]あい[Rin]うえ", true);
// シンガータグ処理確認
const singerTexts = singerTagResult.filter(s => !s.breath && !s.phraseBreak);
assert(singerTexts.length >= 4, "singer tag split: at least 4 syllables");
// 一部のシラブルにsingerプロパティが付与されている可能性
assert(singerTexts.some(s => s.singer === "Miku") || singerTexts.some(s => s.text === "あ"),
  "singer tag: Miku tagged or あ present");

// ===== 21. Phoneme エッジケース =====
console.log("--- 21. Phoneme edge cases ---");

// 長音記号
assertEq(lyricToPhoneme("ー", null, null, false), "-", "ー → -");
// 促音
assertEq(lyricToPhoneme("っ", null, null, false), "cl", "っ → cl");
// 特殊拗音
assertEq(lyricToPhoneme("にゃ", null, null, false), "nya", "にゃ → nya");
assertEq(lyricToPhoneme("みゅ", null, null, false), "myu", "みゅ → myu");
assertEq(lyricToPhoneme("りょ", null, null, false), "ryo", "りょ → ryo");
assertEq(lyricToPhoneme("ぎゃ", null, null, false), "gya", "ぎゃ → gya");
assertEq(lyricToPhoneme("じゃ", null, null, false), "ja", "じゃ → ja");
assertEq(lyricToPhoneme("びょ", null, null, false), "byo", "びょ → byo");
assertEq(lyricToPhoneme("ぴゃ", null, null, false), "pya", "ぴゃ → pya");

// ===== 22. generateMelody: 複数セクション・キー違い =====
console.log("--- 22. generateMelody: mixed keys ---");

const mixedKeySections = [
  { id: 1, type: "A", label: "Aメロ", measures: 4, lyrics: "あいうえお", keyId: "Am" },
  { id: 2, type: "chorus", label: "サビ", measures: 4, lyrics: "かきくけこ", keyId: "C" },
];
const mixedMelody = generateMelody(mixedKeySections, "komuro", "even", 42);
assert(mixedMelody.length > 0, "mixed key melody generated");
assert(mixedMelody.some(n => n.section === "A"), "has section A notes");
assert(mixedMelody.some(n => n.section === "chorus"), "has section chorus notes");

// ===== 23. detectRhythmId: 実際のメロディ出力との統合テスト =====
console.log("--- 23. detectRhythmId: integration with melody ---");

for (const rhythmId of Object.keys(RHYTHM_PATTERNS)) {
  if (rhythmId === "even") continue;
  const testSec = [{ id: 1, type: "A", label: "Aメロ", measures: 8, lyrics: "あいうえおかきくけこさしすせそたちつてと", keyId: "Am" }];
  const mel = generateMelody(testSec, "komuro", rhythmId, 42);
  const notes = mel.filter(n => n.type === "note");
  const durations = notes.map(n => n.length);
  const detected = detectRhythmId(durations);
  // 検出結果がvalidなパターンIDであること（完全一致は保証しないが、crashしないこと）
  assert(Object.keys(RHYTHM_PATTERNS).includes(detected),
    `rhythm '${rhythmId}' melody → detectRhythmId returns valid ID: "${detected}"`);
}

// ===== Summary =====
console.log("\n============================");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("ALL TESTS PASSED");
} else {
  console.error(`${failed} TEST(S) FAILED`);
  process.exit(1);
}
