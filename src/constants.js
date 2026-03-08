export const KEYS = {
  Am:  { name: "Aマイナー（かっこいい系）", scale: [57,59,60,62,64,65,67,69,71,72,74,76], root: 57 },
  Cm:  { name: "Cマイナー（ダーク・重め）", scale: [60,62,63,65,67,68,70,72,74,75,77,79], root: 60 },
  Em:  { name: "Eマイナー（クール・疾走）", scale: [52,54,55,57,59,60,62,64,66,67,69,71], root: 64 },
  Bbm: { name: "B♭マイナー（深い・妖艶）", scale: [58,60,61,63,65,66,68,70,72,73,75,77], root: 58 },
  Dm:  { name: "Dマイナー（憂い・幻想）", scale: [62,64,65,67,69,70,72,74,76,77,79,81], root: 62 },
  Bm:  { name: "Bマイナー（切ない・壮大）", scale: [59,61,62,64,66,67,69,71,73,74,76,78], root: 59 },
  C:   { name: "Cメジャー（明るい・爽やか）", scale: [48,50,52,53,55,57,59,60,62,64,65,67], root: 60 },
  G:   { name: "Gメジャー（開放感・ポップ）", scale: [55,57,59,60,62,64,66,67,69,71,72,74], root: 67 },
  D:   { name: "Dメジャー（華やか・躍動）", scale: [50,52,54,55,57,59,61,62,64,66,67,69], root: 62 },
  F:   { name: "Fメジャー（温かい・優しい）", scale: [53,55,57,58,60,62,64,65,67,69,70,72], root: 65 },
  A:   { name: "Aメジャー（煌びやか・前向き）", scale: [57,59,61,62,64,66,68,69,71,73,74,76], root: 69 },
  E:   { name: "Eメジャー（透明感・爽快）", scale: [52,54,56,57,59,61,63,64,66,68,69,71], root: 64 },
  Bb:  { name: "B♭メジャー（柔らか・ジャズ）", scale: [58,60,62,63,65,67,69,70,72,74,75,77], root: 70 },
};

export const CHORD_DEFS = {
  Am:  { C: [60,64,67], Dm: [62,65,69], Em: [64,67,71], F: [65,69,72], G: [67,71,74], Am: [69,72,76], E7: [64,68,71] },
  Cm:  { Eb: [63,67,70], Fm: [65,68,72], Gm: [67,70,74], Ab: [68,72,75], Bb: [70,74,77], Cm: [72,75,79], G7: [67,71,74] },
  Em:  { G: [55,59,62], Am: [57,60,64], Bm: [59,62,66], C: [60,64,67], D: [62,66,69], Em: [64,67,71], B7: [59,63,66] },
  Bbm: { Db: [61,65,68], Ebm: [63,66,70], Fm: [65,68,72], Gb: [66,70,73], Ab: [68,72,75], Bbm: [70,73,77], F7: [65,69,72] },
  Dm:  { F: [65,69,72], Gm: [67,70,74], Am: [69,72,76], Bb: [70,74,77], C: [72,76,79], Dm: [62,65,69], A7: [69,73,76] },
  Bm:  { D: [62,66,69], Em: [64,67,71], "F#m": [66,69,73], G: [67,71,74], A: [69,73,76], Bm: [71,74,78], "F#7": [66,70,73] },
  C:   { C: [60,64,67], Dm: [62,65,69], Em: [64,67,71], F: [65,69,72], G: [67,71,74], Am: [69,72,76] },
  G:   { G: [67,71,74], Am: [69,72,76], Bm: [71,74,78], C: [60,64,67], D: [62,66,69], Em: [64,67,71], D7: [62,66,72] },
  D:   { D: [62,66,69], Em: [64,67,71], "F#m": [66,69,73], G: [67,71,74], A: [69,73,76], Bm: [71,74,78], A7: [69,73,76] },
  F:   { F: [65,69,72], Gm: [67,70,74], Am: [69,72,76], Bb: [70,74,77], C: [60,64,67], Dm: [62,65,69], C7: [60,64,70] },
  A:   { A: [69,73,76], Bm: [71,74,78], "C#m": [61,64,68], D: [62,66,69], E: [64,68,71], "F#m": [66,69,73], E7: [64,68,71] },
  E:   { E: [64,68,71], "F#m": [66,69,73], "G#m": [68,71,75], A: [69,73,76], B: [71,75,78], "C#m": [61,64,68], B7: [59,63,66] },
  Bb:  { Bb: [70,74,77], Cm: [72,75,79], Dm: [62,65,69], Eb: [63,67,70], F: [65,69,72], Gm: [67,70,74], F7: [65,69,72] },
};

export const PROGRESSIONS = {
  komuro: {
    name: "小室進行",
    desc: "疾走感・ボカロ王道",
    chords: { Am: ["Am","F","G","C"], Cm: ["Cm","Ab","Bb","Eb"], Em: ["Em","C","D","G"],
              Bbm: ["Bbm","Gb","Ab","Db"], Dm: ["Dm","Bb","C","F"], Bm: ["Bm","G","A","D"],
              C: ["Am","F","G","C"],
              G: ["Em","C","D","G"], D: ["Bm","G","A","D"], F: ["Dm","Bb","C","F"],
              A: ["F#m","D","E","A"], E: ["C#m","A","B","E"], Bb: ["Gm","Eb","F","Bb"] }
  },
  oudou: {
    name: "王道進行",
    desc: "エモい・泣ける",
    chords: { Am: ["F","G","Em","Am"], Cm: ["Ab","Bb","Gm","Cm"], Em: ["C","D","Bm","Em"],
              Bbm: ["Gb","Ab","Fm","Bbm"], Dm: ["Bb","C","Am","Dm"], Bm: ["G","A","F#m","Bm"],
              C: ["F","G","Em","Am"],
              G: ["C","D","Bm","Em"], D: ["G","A","F#m","Bm"], F: ["Bb","C","Am","Dm"],
              A: ["D","E","C#m","F#m"], E: ["A","B","G#m","C#m"], Bb: ["Eb","F","Dm","Gm"] }
  },
  canon: {
    name: "カノン進行",
    desc: "壮大・感動系",
    chords: { Am: ["C","G","Am","Em"], Cm: ["Eb","Bb","Cm","Gm"], Em: ["G","D","Em","Bm"],
              Bbm: ["Db","Ab","Bbm","Fm"], Dm: ["F","C","Dm","Am"], Bm: ["D","A","Bm","F#m"],
              C: ["C","G","Am","Em"],
              G: ["G","D","Em","Bm"], D: ["D","A","Bm","F#m"], F: ["F","C","Dm","Am"],
              A: ["A","E","F#m","C#m"], E: ["E","B","C#m","G#m"], Bb: ["Bb","F","Gm","Dm"] }
  },
  jttou: {
    name: "Just the Two of Us",
    desc: "おしゃれ・チル",
    chords: { Am: ["F","E7","Am","Am"], Cm: ["Ab","G7","Cm","Cm"], Em: ["C","B7","Em","Em"],
              Bbm: ["Gb","F7","Bbm","Bbm"], Dm: ["Bb","A7","Dm","Dm"], Bm: ["G","F#7","Bm","Bm"],
              C: ["F","E7","Am","Am"],
              G: ["C","D7","G","G"], D: ["G","A7","D","D"], F: ["Bb","C7","F","F"],
              A: ["D","E7","A","A"], E: ["A","B7","E","E"], Bb: ["Eb","F7","Bb","Bb"] }
  },
  pop4: {
    name: "丸サ進行",
    desc: "丸の内サディスティック・おしゃれ",
    chords: { Am: ["C","E7","Am","F"], Cm: ["Eb","G7","Cm","Ab"], Em: ["G","B7","Em","C"],
              Bbm: ["Db","F7","Bbm","Gb"], Dm: ["F","A7","Dm","Bb"], Bm: ["D","F#7","Bm","G"],
              C: ["C","E7","Am","F"],
              G: ["G","B7","Em","C"], D: ["D","F#7","Bm","G"], F: ["F","A7","Dm","Bb"],
              A: ["A","C#m","F#m","D"], E: ["E","G#m","C#m","A"], Bb: ["Bb","Dm","Gm","Eb"] }
  },
  threechord: {
    name: "スリーコード",
    desc: "シンプル・ロック",
    chords: { Am: ["Am","Dm","Em","Am"], Cm: ["Cm","Fm","Gm","Cm"], Em: ["Em","Am","Bm","Em"],
              Bbm: ["Bbm","Ebm","Fm","Bbm"], Dm: ["Dm","Gm","Am","Dm"], Bm: ["Bm","Em","F#m","Bm"],
              C: ["C","F","G","C"],
              G: ["G","C","D","G"], D: ["D","G","A","D"], F: ["F","Bb","C","F"],
              A: ["A","D","E","A"], E: ["E","A","B","E"], Bb: ["Bb","Eb","F","Bb"] }
  },
  halftime: {
    name: "ハーフタイム",
    desc: "切ない・浮遊感",
    chords: { Am: ["Am","Em","F","C"], Cm: ["Cm","Gm","Ab","Eb"], Em: ["Em","Bm","C","G"],
              Bbm: ["Bbm","Fm","Gb","Db"], Dm: ["Dm","Am","Bb","F"], Bm: ["Bm","F#m","G","D"],
              C: ["Am","Em","F","C"],
              G: ["Em","Bm","C","G"], D: ["Bm","F#m","G","D"], F: ["Dm","Am","Bb","F"],
              A: ["F#m","C#m","D","A"], E: ["C#m","G#m","A","E"], Bb: ["Gm","Dm","Eb","Bb"] }
  },
  descent: {
    name: "下降進行",
    desc: "ドラマチック・J-POP",
    chords: { Am: ["Am","G","F","Em"], Cm: ["Cm","Bb","Ab","Gm"], Em: ["Em","D","C","Bm"],
              Bbm: ["Bbm","Ab","Gb","Fm"], Dm: ["Dm","C","Bb","Am"], Bm: ["Bm","A","G","F#m"],
              C: ["C","G","Am","Em"],
              G: ["G","D","Em","Bm"], D: ["D","A","Bm","F#m"], F: ["F","C","Dm","Am"],
              A: ["A","E","F#m","C#m"], E: ["E","B","C#m","G#m"], Bb: ["Bb","F","Gm","Dm"] }
  },
  yorunikakeru: {
    name: "夜に駆ける進行",
    desc: "疾走・エモーショナル",
    chords: { Am: ["Am","G","F","G"], Cm: ["Cm","Bb","Ab","Bb"], Em: ["Em","D","C","D"],
              Bbm: ["Bbm","Ab","Gb","Ab"], Dm: ["Dm","C","Bb","C"], Bm: ["Bm","A","G","A"],
              C: ["Am","G","F","G"],
              G: ["Em","D","C","D"], D: ["Bm","A","G","A"], F: ["Dm","C","Bb","C"],
              A: ["F#m","E","D","E"], E: ["C#m","B","A","B"], Bb: ["Gm","F","Eb","F"] }
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
  gallop: { name: "ギャロップ", desc: "短-短-長（疾走感）",  weights: [1, 1, 3] },
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
