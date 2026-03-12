export const KEYS = {
  // マイナーキー
  Am:    { name: "Aマイナー（かっこいい系）", scale: [57,59,60,62,64,65,67,69,71,72,74,76], root: 57 },
  Bbm:   { name: "B♭マイナー（深い・妖艶）", scale: [58,60,61,63,65,66,68,70,72,73,75,77], root: 58 },
  Bm:    { name: "Bマイナー（切ない・壮大）", scale: [59,61,62,64,66,67,69,71,73,74,76,78], root: 59 },
  Cm:    { name: "Cマイナー（ダーク・重め）", scale: [60,62,63,65,67,68,70,72,74,75,77,79], root: 60 },
  "C#m": { name: "C♯マイナー（切ない・繊細）", scale: [49,51,52,54,56,57,59,61,63,64,66,68], root: 61 },
  Dm:    { name: "Dマイナー（憂い・幻想）", scale: [62,64,65,67,69,70,72,74,76,77,79,81], root: 62 },
  Ebm:   { name: "E♭マイナー（深い・陰鬱）", scale: [51,53,54,56,58,59,61,63,65,66,68,70], root: 63 },
  Em:    { name: "Eマイナー（クール・疾走）", scale: [52,54,55,57,59,60,62,64,66,67,69,71], root: 64 },
  Fm:    { name: "Fマイナー（哀愁・情熱）", scale: [53,55,56,58,60,61,63,65,67,68,70,72], root: 65 },
  "F#m": { name: "F♯マイナー（繊細・透明）", scale: [54,56,57,59,61,62,64,66,68,69,71,73], root: 66 },
  Gm:    { name: "Gマイナー（渋い・重厚）", scale: [55,57,58,60,62,63,65,67,69,70,72,74], root: 67 },
  "G#m": { name: "G♯マイナー（暗い・妖しい）", scale: [56,58,59,61,63,64,66,68,70,71,73,75], root: 68 },
  // メジャーキー
  C:     { name: "Cメジャー（明るい・爽やか）", scale: [48,50,52,53,55,57,59,60,62,64,65,67], root: 60 },
  Db:    { name: "D♭メジャー（神秘的・幻想）", scale: [49,51,53,54,56,58,60,61,63,65,66,68], root: 61 },
  D:     { name: "Dメジャー（華やか・躍動）", scale: [50,52,54,55,57,59,61,62,64,66,67,69], root: 62 },
  Eb:    { name: "E♭メジャー（温かい・柔らか）", scale: [51,53,55,56,58,60,62,63,65,67,68,70], root: 63 },
  E:     { name: "Eメジャー（透明感・爽快）", scale: [52,54,56,57,59,61,63,64,66,68,69,71], root: 64 },
  F:     { name: "Fメジャー（温かい・優しい）", scale: [53,55,57,58,60,62,64,65,67,69,70,72], root: 65 },
  "F#":  { name: "F♯メジャー（鮮やか・煌びやか）", scale: [54,56,58,59,61,63,65,66,68,70,71,73], root: 66 },
  G:     { name: "Gメジャー（開放感・ポップ）", scale: [55,57,59,60,62,64,66,67,69,71,72,74], root: 67 },
  Ab:    { name: "A♭メジャー（落ち着き・深い）", scale: [56,58,60,61,63,65,67,68,70,72,73,75], root: 68 },
  A:     { name: "Aメジャー（煌びやか・前向き）", scale: [57,59,61,62,64,66,68,69,71,73,74,76], root: 69 },
  Bb:    { name: "B♭メジャー（柔らか・ジャズ）", scale: [58,60,62,63,65,67,69,70,72,74,75,77], root: 70 },
  B:     { name: "Bメジャー（輝き・力強い）", scale: [59,61,63,64,66,68,70,71,73,75,76,78], root: 71 },
};

export const CHORD_DEFS = {
  // マイナーキー
  Am:    { C: [60,64,67], Dm: [62,65,69], Em: [64,67,71], F: [65,69,72], G: [67,71,74], Am: [69,72,76], E7: [64,68,71] },
  Bbm:   { Db: [61,65,68], Ebm: [63,66,70], Fm: [65,68,72], Gb: [66,70,73], Ab: [68,72,75], Bbm: [70,73,77], F7: [65,69,72] },
  Bm:    { D: [62,66,69], Em: [64,67,71], "F#m": [66,69,73], G: [67,71,74], A: [69,73,76], Bm: [71,74,78], "F#7": [66,70,73] },
  Cm:    { Eb: [63,67,70], Fm: [65,68,72], Gm: [67,70,74], Ab: [68,72,75], Bb: [70,74,77], Cm: [72,75,79], G7: [67,71,74] },
  "C#m": { E: [64,68,71], "F#m": [66,69,73], "G#m": [68,71,75], A: [69,73,76], B: [71,75,78], "C#m": [61,64,68], "G#7": [68,72,78] },
  Dm:    { F: [65,69,72], Gm: [67,70,74], Am: [69,72,76], Bb: [70,74,77], C: [72,76,79], Dm: [62,65,69], A7: [69,73,76] },
  Ebm:   { Gb: [66,70,73], Abm: [68,71,75], Bbm: [70,73,77], B: [71,75,78], Db: [61,65,68], Ebm: [63,66,70], Bb7: [70,74,80] },
  Em:    { G: [55,59,62], Am: [57,60,64], Bm: [59,62,66], C: [60,64,67], D: [62,66,69], Em: [64,67,71], B7: [59,63,66] },
  Fm:    { Ab: [68,72,75], Bbm: [70,73,77], Cm: [72,75,79], Db: [61,65,68], Eb: [63,67,70], Fm: [65,68,72], C7: [60,64,70] },
  "F#m": { A: [69,73,76], Bm: [71,74,78], "C#m": [61,64,68], D: [62,66,69], E: [64,68,71], "F#m": [66,69,73], "C#7": [61,65,71] },
  Gm:    { Bb: [70,74,77], Cm: [72,75,79], Dm: [62,65,69], Eb: [63,67,70], F: [65,69,72], Gm: [67,70,74], D7: [62,66,72] },
  "G#m": { B: [71,75,78], "C#m": [61,64,68], "D#m": [63,66,70], E: [64,68,71], "F#": [66,70,73], "G#m": [68,71,75], "D#7": [63,67,73] },
  // メジャーキー
  C:     { C: [60,64,67], Dm: [62,65,69], Em: [64,67,71], F: [65,69,72], G: [67,71,74], Am: [69,72,76] },
  Db:    { Db: [61,65,68], Ebm: [63,66,70], Fm: [65,68,72], Gb: [66,70,73], Ab: [68,72,75], Bbm: [70,73,77], Ab7: [68,72,78] },
  D:     { D: [62,66,69], Em: [64,67,71], "F#m": [66,69,73], G: [67,71,74], A: [69,73,76], Bm: [71,74,78], A7: [69,73,76] },
  Eb:    { Eb: [63,67,70], Fm: [65,68,72], Gm: [67,70,74], Ab: [68,72,75], Bb: [70,74,77], Cm: [72,75,79], Bb7: [70,74,80] },
  E:     { E: [64,68,71], "F#m": [66,69,73], "G#m": [68,71,75], A: [69,73,76], B: [71,75,78], "C#m": [61,64,68], B7: [59,63,66] },
  F:     { F: [65,69,72], Gm: [67,70,74], Am: [69,72,76], Bb: [70,74,77], C: [60,64,67], Dm: [62,65,69], C7: [60,64,70] },
  "F#":  { "F#": [66,70,73], "G#m": [68,71,75], "A#m": [70,73,77], B: [71,75,78], "C#": [61,65,68], "D#m": [63,66,70], "C#7": [61,65,71] },
  G:     { G: [67,71,74], Am: [69,72,76], Bm: [71,74,78], C: [60,64,67], D: [62,66,69], Em: [64,67,71], D7: [62,66,72] },
  Ab:    { Ab: [68,72,75], Bbm: [70,73,77], Cm: [72,75,79], Db: [61,65,68], Eb: [63,67,70], Fm: [65,68,72], Eb7: [63,67,73] },
  A:     { A: [69,73,76], Bm: [71,74,78], "C#m": [61,64,68], D: [62,66,69], E: [64,68,71], "F#m": [66,69,73], E7: [64,68,71] },
  Bb:    { Bb: [70,74,77], Cm: [72,75,79], Dm: [62,65,69], Eb: [63,67,70], F: [65,69,72], Gm: [67,70,74], F7: [65,69,72] },
  B:     { B: [71,75,78], "C#m": [61,64,68], "D#m": [63,66,70], E: [64,68,71], "F#": [66,70,73], "G#m": [68,71,75], "F#7": [66,70,76] },
};

export const PROGRESSIONS = {
  komuro: {
    name: "小室進行",
    desc: "疾走感・ボカロ王道",
    chords: { Am: ["Am","F","G","C"], Bbm: ["Bbm","Gb","Ab","Db"], Bm: ["Bm","G","A","D"],
              Cm: ["Cm","Ab","Bb","Eb"], "C#m": ["C#m","A","B","E"], Dm: ["Dm","Bb","C","F"],
              Ebm: ["Ebm","B","Db","Gb"], Em: ["Em","C","D","G"], Fm: ["Fm","Db","Eb","Ab"],
              "F#m": ["F#m","D","E","A"], Gm: ["Gm","Eb","F","Bb"], "G#m": ["G#m","E","F#","B"],
              C: ["Am","F","G","C"], Db: ["Bbm","Gb","Ab","Db"], D: ["Bm","G","A","D"],
              Eb: ["Cm","Ab","Bb","Eb"], E: ["C#m","A","B","E"], F: ["Dm","Bb","C","F"],
              "F#": ["D#m","B","C#","F#"], G: ["Em","C","D","G"], Ab: ["Fm","Db","Eb","Ab"],
              A: ["F#m","D","E","A"], Bb: ["Gm","Eb","F","Bb"], B: ["G#m","E","F#","B"] }
  },
  oudou: {
    name: "王道進行",
    desc: "エモい・泣ける",
    chords: { Am: ["F","G","Em","Am"], Bbm: ["Gb","Ab","Fm","Bbm"], Bm: ["G","A","F#m","Bm"],
              Cm: ["Ab","Bb","Gm","Cm"], "C#m": ["A","B","G#m","C#m"], Dm: ["Bb","C","Am","Dm"],
              Ebm: ["B","Db","Bbm","Ebm"], Em: ["C","D","Bm","Em"], Fm: ["Db","Eb","Cm","Fm"],
              "F#m": ["D","E","C#m","F#m"], Gm: ["Eb","F","Dm","Gm"], "G#m": ["E","F#","D#m","G#m"],
              C: ["F","G","Em","Am"], Db: ["Gb","Ab","Fm","Bbm"], D: ["G","A","F#m","Bm"],
              Eb: ["Ab","Bb","Gm","Cm"], E: ["A","B","G#m","C#m"], F: ["Bb","C","Am","Dm"],
              "F#": ["B","C#","A#m","D#m"], G: ["C","D","Bm","Em"], Ab: ["Db","Eb","Cm","Fm"],
              A: ["D","E","C#m","F#m"], Bb: ["Eb","F","Dm","Gm"], B: ["E","F#","D#m","G#m"] }
  },
  canon: {
    name: "カノン進行",
    desc: "壮大・感動系",
    chords: { Am: ["C","G","Am","Em"], Bbm: ["Db","Ab","Bbm","Fm"], Bm: ["D","A","Bm","F#m"],
              Cm: ["Eb","Bb","Cm","Gm"], "C#m": ["E","B","C#m","G#m"], Dm: ["F","C","Dm","Am"],
              Ebm: ["Gb","Db","Ebm","Bbm"], Em: ["G","D","Em","Bm"], Fm: ["Ab","Eb","Fm","Cm"],
              "F#m": ["A","E","F#m","C#m"], Gm: ["Bb","F","Gm","Dm"], "G#m": ["B","F#","G#m","D#m"],
              C: ["C","G","Am","Em"], Db: ["Db","Ab","Bbm","Fm"], D: ["D","A","Bm","F#m"],
              Eb: ["Eb","Bb","Cm","Gm"], E: ["E","B","C#m","G#m"], F: ["F","C","Dm","Am"],
              "F#": ["F#","C#","D#m","A#m"], G: ["G","D","Em","Bm"], Ab: ["Ab","Eb","Fm","Cm"],
              A: ["A","E","F#m","C#m"], Bb: ["Bb","F","Gm","Dm"], B: ["B","F#","G#m","D#m"] }
  },
  jttou: {
    name: "Just the Two of Us",
    desc: "おしゃれ・チル",
    chords: { Am: ["F","E7","Am","Am"], Bbm: ["Gb","F7","Bbm","Bbm"], Bm: ["G","F#7","Bm","Bm"],
              Cm: ["Ab","G7","Cm","Cm"], "C#m": ["A","G#7","C#m","C#m"], Dm: ["Bb","A7","Dm","Dm"],
              Ebm: ["B","Bb7","Ebm","Ebm"], Em: ["C","B7","Em","Em"], Fm: ["Db","C7","Fm","Fm"],
              "F#m": ["D","C#7","F#m","F#m"], Gm: ["Eb","D7","Gm","Gm"], "G#m": ["E","D#7","G#m","G#m"],
              C: ["F","E7","Am","Am"], Db: ["Gb","Ab7","Db","Db"], D: ["G","A7","D","D"],
              Eb: ["Ab","Bb7","Eb","Eb"], E: ["A","B7","E","E"], F: ["Bb","C7","F","F"],
              "F#": ["B","C#7","F#","F#"], G: ["C","D7","G","G"], Ab: ["Db","Eb7","Ab","Ab"],
              A: ["D","E7","A","A"], Bb: ["Eb","F7","Bb","Bb"], B: ["E","F#7","B","B"] }
  },
  pop4: {
    name: "丸サ進行",
    desc: "丸の内サディスティック・おしゃれ",
    chords: { Am: ["C","E7","Am","F"], Bbm: ["Db","F7","Bbm","Gb"], Bm: ["D","F#7","Bm","G"],
              Cm: ["Eb","G7","Cm","Ab"], "C#m": ["E","G#7","C#m","A"], Dm: ["F","A7","Dm","Bb"],
              Ebm: ["Gb","Bb7","Ebm","B"], Em: ["G","B7","Em","C"], Fm: ["Ab","C7","Fm","Db"],
              "F#m": ["A","C#7","F#m","D"], Gm: ["Bb","D7","Gm","Eb"], "G#m": ["B","D#7","G#m","E"],
              C: ["C","E7","Am","F"], Db: ["Db","Fm","Bbm","Gb"], D: ["D","F#7","Bm","G"],
              Eb: ["Eb","Gm","Cm","Ab"], E: ["E","G#m","C#m","A"], F: ["F","A7","Dm","Bb"],
              "F#": ["F#","A#m","D#m","B"], G: ["G","B7","Em","C"], Ab: ["Ab","Cm","Fm","Db"],
              A: ["A","C#m","F#m","D"], Bb: ["Bb","Dm","Gm","Eb"], B: ["B","D#m","G#m","E"] }
  },
  threechord: {
    name: "スリーコード",
    desc: "シンプル・ロック",
    chords: { Am: ["Am","Dm","Em","Am"], Bbm: ["Bbm","Ebm","Fm","Bbm"], Bm: ["Bm","Em","F#m","Bm"],
              Cm: ["Cm","Fm","Gm","Cm"], "C#m": ["C#m","F#m","G#m","C#m"], Dm: ["Dm","Gm","Am","Dm"],
              Ebm: ["Ebm","Abm","Bbm","Ebm"], Em: ["Em","Am","Bm","Em"], Fm: ["Fm","Bbm","Cm","Fm"],
              "F#m": ["F#m","Bm","C#m","F#m"], Gm: ["Gm","Cm","Dm","Gm"], "G#m": ["G#m","C#m","D#m","G#m"],
              C: ["C","F","G","C"], Db: ["Db","Gb","Ab","Db"], D: ["D","G","A","D"],
              Eb: ["Eb","Ab","Bb","Eb"], E: ["E","A","B","E"], F: ["F","Bb","C","F"],
              "F#": ["F#","B","C#","F#"], G: ["G","C","D","G"], Ab: ["Ab","Db","Eb","Ab"],
              A: ["A","D","E","A"], Bb: ["Bb","Eb","F","Bb"], B: ["B","E","F#","B"] }
  },
  halftime: {
    name: "ハーフタイム",
    desc: "切ない・浮遊感",
    chords: { Am: ["Am","Em","F","C"], Bbm: ["Bbm","Fm","Gb","Db"], Bm: ["Bm","F#m","G","D"],
              Cm: ["Cm","Gm","Ab","Eb"], "C#m": ["C#m","G#m","A","E"], Dm: ["Dm","Am","Bb","F"],
              Ebm: ["Ebm","Bbm","B","Gb"], Em: ["Em","Bm","C","G"], Fm: ["Fm","Cm","Db","Ab"],
              "F#m": ["F#m","C#m","D","A"], Gm: ["Gm","Dm","Eb","Bb"], "G#m": ["G#m","D#m","E","B"],
              C: ["Am","Em","F","C"], Db: ["Bbm","Fm","Gb","Db"], D: ["Bm","F#m","G","D"],
              Eb: ["Cm","Gm","Ab","Eb"], E: ["C#m","G#m","A","E"], F: ["Dm","Am","Bb","F"],
              "F#": ["D#m","A#m","B","F#"], G: ["Em","Bm","C","G"], Ab: ["Fm","Cm","Db","Ab"],
              A: ["F#m","C#m","D","A"], Bb: ["Gm","Dm","Eb","Bb"], B: ["G#m","D#m","E","B"] }
  },
  descent: {
    name: "下降進行",
    desc: "ドラマチック・J-POP",
    chords: { Am: ["Am","G","F","Em"], Bbm: ["Bbm","Ab","Gb","Fm"], Bm: ["Bm","A","G","F#m"],
              Cm: ["Cm","Bb","Ab","Gm"], "C#m": ["C#m","B","A","G#m"], Dm: ["Dm","C","Bb","Am"],
              Ebm: ["Ebm","Db","B","Bbm"], Em: ["Em","D","C","Bm"], Fm: ["Fm","Eb","Db","Cm"],
              "F#m": ["F#m","E","D","C#m"], Gm: ["Gm","F","Eb","Dm"], "G#m": ["G#m","F#","E","D#m"],
              C: ["C","G","Am","Em"], Db: ["Db","Ab","Bbm","Fm"], D: ["D","A","Bm","F#m"],
              Eb: ["Eb","Bb","Cm","Gm"], E: ["E","B","C#m","G#m"], F: ["F","C","Dm","Am"],
              "F#": ["F#","C#","D#m","A#m"], G: ["G","D","Em","Bm"], Ab: ["Ab","Eb","Fm","Cm"],
              A: ["A","E","F#m","C#m"], Bb: ["Bb","F","Gm","Dm"], B: ["B","F#","G#m","D#m"] }
  },
  yorunikakeru: {
    name: "夜に駆ける進行",
    desc: "疾走・エモーショナル",
    chords: { Am: ["Am","G","F","G"], Bbm: ["Bbm","Ab","Gb","Ab"], Bm: ["Bm","A","G","A"],
              Cm: ["Cm","Bb","Ab","Bb"], "C#m": ["C#m","B","A","B"], Dm: ["Dm","C","Bb","C"],
              Ebm: ["Ebm","Db","B","Db"], Em: ["Em","D","C","D"], Fm: ["Fm","Eb","Db","Eb"],
              "F#m": ["F#m","E","D","E"], Gm: ["Gm","F","Eb","F"], "G#m": ["G#m","F#","E","F#"],
              C: ["Am","G","F","G"], Db: ["Bbm","Ab","Gb","Ab"], D: ["Bm","A","G","A"],
              Eb: ["Cm","Bb","Ab","Bb"], E: ["C#m","B","A","B"], F: ["Dm","C","Bb","C"],
              "F#": ["D#m","C#","B","C#"], G: ["Em","D","C","D"], Ab: ["Fm","Eb","Db","Eb"],
              A: ["F#m","E","D","E"], Bb: ["Gm","F","Eb","F"], B: ["G#m","F#","E","F#"] }
  },
};

export const DEFAULT_SECTIONS = [
  { id: 1, type: "intro", label: "イントロ", measures: 4, lyrics: "", keyId: "Am" },
  { id: 2, type: "A", label: "Aメロ", measures: 8, lyrics: "", keyId: "Am" },
  { id: 3, type: "B", label: "Bメロ", measures: 8, lyrics: "", keyId: "Am" },
  { id: 4, type: "chorus", label: "サビ", measures: 8, lyrics: "", keyId: "Am" },
  { id: 5, type: "outro", label: "アウトロ", measures: 4, lyrics: "", keyId: "Am" },
];

export const SECTION_TYPES = [
  { type: "intro", label: "イントロ" },
  { type: "A", label: "Aメロ" },
  { type: "B", label: "Bメロ" },
  { type: "chorus", label: "サビ" },
  { type: "bridge", label: "Cメロ" },
  { type: "serif", label: "セリフ" },
  { type: "interlude", label: "間奏" },
  { type: "outro", label: "アウトロ" },
];

export const TPQN = 480;

export const RHYTHM_PATTERNS = {
  even:   { name: "均等",       desc: "すべて同じ長さ",     weights: null },
  swing:  { name: "スウィング", desc: "長-短の繰り返し",     weights: [3, 1] },
  march:  { name: "マーチ",     desc: "短-短-長",            weights: [1, 1, 2] },
  synco:  { name: "シンコペ",   desc: "短-長-短",            weights: [1, 2, 1] },
  dotted: { name: "付点",       desc: "付点8分+16分の繰り返し", weights: [3, 1] },
  gallop:  { name: "ギャロップ", desc: "短-短-長（疾走感）",  weights: [1, 1, 3] },
  shuffle: { name: "シャッフル", desc: "跳ねるリズム",        weights: [2, 1, 2, 1] },
  ballad:  { name: "バラード",   desc: "ゆったり長短",        weights: [3, 1, 2, 2] },
};

// マルコフ連鎖ベースのメロディ遷移確率行列
// 各配列: 相対音程(-4〜+4スケールステップ)に対する重み [index 0 = -4, index 4 = 0(同音), index 8 = +4]
export const MELODY_TRANSITIONS = {
  A:      [1, 2, 5, 8, 12, 8, 5, 2, 1],
  B:      [1, 3, 5, 6,  6, 8, 6, 3, 1],
  chorus: [2, 3, 5, 5,  4, 6, 7, 4, 2],
  bridge: [1, 3, 5, 7,  8, 7, 5, 3, 1],
  serif:  [0, 1, 2, 5, 15, 5, 2, 1, 0],
};

export const EXPRESSION_DEFAULTS = { intensity: 100, modulation: 0, accent: false, shakuri: false, fall: false, vibrato: false, longNote: false, breath: false, serif: false, tension: false, dynamics: null };

export const SHAKURI_PRESETS = {
  1: { pbs: "-20;-5",  pbw: "50",  pby: "0" },
  2: { pbs: "-40;-10", pbw: "80",  pby: "0" },
  3: { pbs: "-80;-20", pbw: "120", pby: "0" },
};

export const FALL_PRESETS = {
  1: { pbs: "0;0", pbw: "60",  pby: "-4" },
  2: { pbs: "0;0", pbw: "80",  pby: "-8" },
  3: { pbs: "0;0", pbw: "120", pby: "-15" },
};

export const VOCAL_RANGES = {
  low:    { name: "低め", desc: "A3〜D4", min: 57, max: 62 },
  mid:    { name: "普通", desc: "A4〜D5", min: 69, max: 74 },
  high:   { name: "高め", desc: "C5〜G5", min: 72, max: 79 },
  auto:   { name: "自動", desc: "キーに合わせて自動", min: null, max: null },
};

export const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
