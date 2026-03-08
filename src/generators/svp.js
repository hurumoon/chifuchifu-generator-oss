import { TPQN } from "../constants.js";
import { lyricToPhoneme } from "../utils/phoneme.js";

const SVP_TPQN = 705600000;
const SVP_SCALE = SVP_TPQN / TPQN;

// O1: セクションタイプごとのデフォルトパラメータ値
const SECTION_PARAMS = {
  A:      { tension: -0.05, breathiness: 0.15, loudness: -1.0 },
  B:      { tension: 0.05,  breathiness: 0.08, loudness: 0.0 },
  chorus: { tension: 0.20,  breathiness: -0.05, loudness: 2.0 },
  bridge: { tension: 0.10,  breathiness: 0.05, loudness: 0.5 },
  serif:  { tension: -0.10, breathiness: 0.20, loudness: -2.0 },
};

// O2: (p)(f) ダイナミクスのパラメータオフセット
const DYNAMICS_OFFSET = {
  p: { loudness: -4.0, tension: -0.15 },
  f: { loudness: 3.0,  tension: 0.15 },
};

// O3: しゃくり/フォールのピッチベンド量 (cent)
const SHAKURI_CENTS = { 1: -50, 2: -100, 3: -200 };
const FALL_CENTS = { 1: -50, 2: -100, 3: -200 };

export function generateSVP(melody, bpm, projectName = "Generated") {
  const lyricList = [];
  const noteIndexMap = new Map();
  let noteCount = 0;
  for (const n of melody) {
    if (n.type === "note") {
      noteIndexMap.set(n, noteCount);
      lyricList.push(n.lyric);
      noteCount++;
    }
  }

  const notes = [];
  let currentOnset = 0;

  // パラメータカーブ用ポイント収集
  const tensionPoints = [];
  const breathinessPoints = [];
  const loudnessPoints = [];
  const pitchDeltaPoints = [];

  let prevSection = null;
  let prevDynamics = null;

  for (const n of melody) {
    const blickDuration = Math.round(n.length * SVP_SCALE);
    if (n.type === "rest") {
      currentOnset += blickDuration;
      continue;
    }

    const noteListIdx = noteIndexMap.get(n) ?? -1;
    const prevLyric = noteListIdx > 0 ? lyricList[noteListIdx - 1] : null;
    const nextLyric = noteListIdx < lyricList.length - 1 ? lyricList[noteListIdx + 1] : null;
    const phoneme = n.lyric === "-" ? "-" : lyricToPhoneme(n.lyric, prevLyric, nextLyric, n.wordStart);

    const svpNote = {
      musicalType: "singing",
      onset: currentOnset,
      duration: blickDuration,
      lyrics: phoneme,
      phonemes: "",
      accent: "",
      pitch: n.noteNum,
      detune: 0,
      instantMode: true,
      attributes: { evenSyllableDuration: true },
      systemAttributes: {
        tF0Offset: -0.0,
        tF0Left: 0.1000000014901161,
        tF0Right: 0.1000000014901161,
        dF0Left: 0.0,
        dF0Right: 0.0,
        dF0Vbr: 0.0,
        evenSyllableDuration: true,
      },
      pitchTakes: { activeTakeId: 0, takes: [{ id: 0, expr: 0.0, liked: false }] },
      timbreTakes: { activeTakeId: 0, takes: [{ id: 0, expr: 0.0, liked: false }] },
    };
    notes.push(svpNote);

    // O1: セクション変化時にパラメータカーブポイントを追加
    const sectionType = n.section;
    if (sectionType !== prevSection) {
      const params = SECTION_PARAMS[sectionType] || { tension: 0, breathiness: 0, loudness: 0 };
      const transitionBlicks = Math.round(TPQN * 2 * SVP_SCALE); // 2拍かけて遷移

      if (prevSection !== null) {
        // 遷移開始点: 前セクションの値を維持
        const prevParams = SECTION_PARAMS[prevSection] || { tension: 0, breathiness: 0, loudness: 0 };
        tensionPoints.push([currentOnset - transitionBlicks, prevParams.tension]);
        breathinessPoints.push([currentOnset - transitionBlicks, prevParams.breathiness]);
        loudnessPoints.push([currentOnset - transitionBlicks, prevParams.loudness]);
      }

      // 遷移先の値
      tensionPoints.push([currentOnset, params.tension]);
      breathinessPoints.push([currentOnset, params.breathiness]);
      loudnessPoints.push([currentOnset, params.loudness]);

      prevSection = sectionType;
    }

    // O2: (p)(f) ダイナミクス変化をパラメータカーブに反映
    const dynamics = n.dynamics;
    if (dynamics !== prevDynamics) {
      const baseParams = SECTION_PARAMS[sectionType] || { tension: 0, breathiness: 0, loudness: 0 };
      const dynOffset = dynamics ? (DYNAMICS_OFFSET[dynamics] || { loudness: 0, tension: 0 }) : { loudness: 0, tension: 0 };

      // スムーズ遷移: 1拍前から変化開始
      const transBlicks = Math.round(TPQN * SVP_SCALE);
      if (prevDynamics !== null) {
        const prevDynOffset = prevDynamics ? (DYNAMICS_OFFSET[prevDynamics] || { loudness: 0, tension: 0 }) : { loudness: 0, tension: 0 };
        loudnessPoints.push([currentOnset - transBlicks, baseParams.loudness + prevDynOffset.loudness]);
        tensionPoints.push([currentOnset - transBlicks, baseParams.tension + prevDynOffset.tension]);
      }
      loudnessPoints.push([currentOnset, baseParams.loudness + dynOffset.loudness]);
      tensionPoints.push([currentOnset, baseParams.tension + dynOffset.tension]);

      prevDynamics = dynamics;
    }

    // O3: しゃくりのピッチカーブ
    if (n.shakuri) {
      const cents = SHAKURI_CENTS[n.shakuriDepth] || SHAKURI_CENTS[2];
      const riseBlicks = Math.round(TPQN * 0.15 * SVP_SCALE); // 立ち上がり時間
      pitchDeltaPoints.push([currentOnset, cents]);
      pitchDeltaPoints.push([currentOnset + riseBlicks, 0]);
    }

    // O3: フォールのピッチカーブ
    if (n.fall) {
      const cents = FALL_CENTS[n.fallDepth] || FALL_CENTS[2];
      const noteEnd = currentOnset + blickDuration;
      const fallStart = noteEnd - Math.round(TPQN * 0.3 * SVP_SCALE);
      pitchDeltaPoints.push([fallStart, 0]);
      pitchDeltaPoints.push([noteEnd, cents]);
    }

    currentOnset += blickDuration;
  }

  const buildParam = (mode, points) => {
    if (points.length === 0) return { mode, points: [] };
    // SVPのpointsフォーマット: フラット配列 [x1, y1, x2, y2, ...]
    points.sort((a, b) => a[0] - b[0]);
    const flat = [];
    for (const [x, y] of points) {
      flat.push(x, y);
    }
    return { mode, points: flat };
  };

  const svp = {
    version: 153,
    time: {
      meter: [{ index: 0, numerator: 4, denominator: 4 }],
      tempo: [{ position: 0, bpm }],
    },
    library: [],
    tracks: [{
      name: projectName,
      dispColor: "ff7db235",
      dispOrder: 0,
      renderEnabled: false,
      mixer: { gainDecibel: 0.0, pan: 0.0, mute: false, solo: false, display: true },
      mainGroup: {
        name: "main",
        uuid: crypto.randomUUID(),
        parameters: {
          pitchDelta: buildParam("cubic", pitchDeltaPoints),
          vibratoEnv: { mode: "cubic", points: [] },
          loudness: buildParam("cubic", loudnessPoints),
          tension: buildParam("cubic", tensionPoints),
          breathiness: buildParam("cubic", breathinessPoints),
          voicing: { mode: "cubic", points: [] },
          gender: { mode: "cubic", points: [] },
          toneShift: { mode: "cubic", points: [] },
        },
        vocalModes: {},
        notes,
      },
      groups: [],
    }],
    renderConfig: {
      destination: "./output.wav",
      filename: projectName,
      numChannels: 1,
      aspirationFormat: "noAspiration",
      bitDepth: 16,
      sampleRate: 44100,
      exportMixDown: true,
    },
  };

  return JSON.stringify(svp);
}
