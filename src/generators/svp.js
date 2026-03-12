import { TPQN } from "../constants.js";
import { lyricToPhoneme } from "../utils/phoneme.js";
import { splitMelodyBySinger } from "../utils/singer.js";

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

// シンガーごとのカラーパレット
const SINGER_COLORS = [
  "ff7db235", "ffff6347", "ff4da6ff", "ffffd700",
  "ffff69b4", "ff00ced1", "ffff8c00", "ff9370db",
];

/**
 * メロディ配列からSVPトラック用のノートとパラメータカーブを構築
 */
function buildTrackData(melody) {
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
      detune: n.detune || 0,
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
      const transitionBlicks = Math.round(TPQN * 2 * SVP_SCALE);

      if (prevSection !== null) {
        const prevParams = SECTION_PARAMS[prevSection] || { tension: 0, breathiness: 0, loudness: 0 };
        tensionPoints.push([currentOnset - transitionBlicks, prevParams.tension]);
        breathinessPoints.push([currentOnset - transitionBlicks, prevParams.breathiness]);
        loudnessPoints.push([currentOnset - transitionBlicks, prevParams.loudness]);
      }

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
      const riseBlicks = Math.round(TPQN * 0.15 * SVP_SCALE);
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

  return { notes, tensionPoints, breathinessPoints, loudnessPoints, pitchDeltaPoints };
}

function buildParam(mode, points) {
  if (points.length === 0) return { mode, points: [] };
  points.sort((a, b) => a[0] - b[0]);
  const flat = [];
  for (const [x, y] of points) {
    flat.push(x, y);
  }
  return { mode, points: flat };
}

function buildMainGroup(trackData) {
  const uuid = crypto.randomUUID();
  return {
    mainGroup: {
      name: "main",
      uuid,
      parameters: {
        pitchDelta: buildParam("cubic", trackData.pitchDeltaPoints),
        vibratoEnv: { mode: "cubic", points: [] },
        loudness: buildParam("cubic", trackData.loudnessPoints),
        tension: buildParam("cubic", trackData.tensionPoints),
        breathiness: buildParam("cubic", trackData.breathinessPoints),
        voicing: { mode: "cubic", points: [] },
        gender: { mode: "cubic", points: [] },
        toneShift: { mode: "cubic", points: [] },
      },
      vocalModes: {},
      notes: trackData.notes,
    },
    uuid,
  };
}

function buildMainRef(groupUUID, singer) {
  return {
    groupID: groupUUID,
    blickAbsoluteBegin: 0,
    blickAbsoluteEnd: -1,
    blickOffset: 0,
    pitchOffset: 0,
    isInstrumental: false,
    database: {
      name: singer?.database || "",
      language: "japanese",
      phoneset: "romaji",
      languageOverride: "",
      phonesetOverride: "",
      backendType: "SVR2AI",
    },
    dictionary: "",
    voice: {
      renderMode: "modePreferQuality",
      vocalModeInherited: true,
      vocalModePreset: "",
      vocalModeParams: {},
    },
    pitchTakes: { activeTakeId: 0, takes: [{ id: 0, expr: 0.0, liked: false }] },
    timbreTakes: { activeTakeId: 0, takes: [{ id: 0, expr: 0.0, liked: false }] },
  };
}

/**
 * SVPファイルを生成
 * @param {Array} melody - generateMelody() の出力
 * @param {number} bpm
 * @param {string} projectName
 * @param {Array|null} singers - [{name, database}] マルチシンガー設定（nullで従来互換）
 */
export function generateSVP(melody, bpm, projectName = "Generated", singers = null) {
  const hasSingers = singers && singers.length > 0;

  let tracks;

  if (hasSingers) {
    const singerNames = singers.map(s => s.name);
    const melodyMap = splitMelodyBySinger(melody, singerNames);

    tracks = singers.map((singer, idx) => {
      const singerMelody = melodyMap.get(singer.name) || [];
      const trackData = buildTrackData(singerMelody);
      const { mainGroup, uuid } = buildMainGroup(trackData);

      return {
        name: singer.name,
        dispColor: SINGER_COLORS[idx % SINGER_COLORS.length],
        dispOrder: idx,
        renderEnabled: true,
        mixer: { gainDecibel: 0.0, pan: 0.0, mute: false, solo: false, display: true },
        mainGroup,
        mainRef: buildMainRef(uuid, singer),
        groups: [],
      };
    });
  } else {
    // 従来の単一トラック出力
    const trackData = buildTrackData(melody);
    const { mainGroup, uuid } = buildMainGroup(trackData);

    tracks = [{
      name: projectName,
      dispColor: "ff7db235",
      dispOrder: 0,
      renderEnabled: false,
      mixer: { gainDecibel: 0.0, pan: 0.0, mute: false, solo: false, display: true },
      mainGroup,
      mainRef: buildMainRef(uuid, null),
      groups: [],
    }];
  }

  const svp = {
    version: 153,
    time: {
      meter: [{ index: 0, numerator: 4, denominator: 4 }],
      tempo: [{ position: 0, bpm }],
    },
    library: [],
    tracks,
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
