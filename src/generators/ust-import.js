import { TPQN, SECTION_TYPES } from "../constants.js";
import { detectRhythmId } from "../utils/rhythm-detect.js";
import { phonemeToKana } from "../utils/phoneme.js";

function phonemeToLyric(phoneme) {
  if (phoneme === "R" || phoneme === "r") return null; // 休符
  return phonemeToKana(phoneme);
}

/**
 * USTファイルのテキストをパースしてセクション配列を返す
 * @param {string} ustText - USTファイルの内容
 * @returns {{ sections: Array<{tag: string, props: Object}> }}
 */
function parseUSTSections(ustText) {
  const sections = [];
  const lines = ustText.split(/\r?\n/);
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const tagMatch = trimmed.match(/^\[(.+)\]$/);
    if (tagMatch) {
      if (current) sections.push(current);
      current = { tag: tagMatch[1], props: {} };
      continue;
    }
    if (current && trimmed.includes("=")) {
      const eqIdx = trimmed.indexOf("=");
      const key = trimmed.substring(0, eqIdx);
      const value = trimmed.substring(eqIdx + 1);
      current.props[key] = value;
    }
  }
  if (current) sections.push(current);
  return sections;
}

/**
 * USTファイルを解析して内部melody配列を返す
 * @param {string} ustText - USTファイルの内容
 * @returns {{ melody: Array, bpm: number }}
 */
export function parseUST(ustText) {
  if (ustText == null || typeof ustText !== "string") {
    throw new Error("USTファイルの内容が不正です（文字列ではありません）");
  }
  const sections = parseUSTSections(ustText);

  // BPMを取得
  const settingSection = sections.find(s => s.tag === "#SETTING");
  const bpm = settingSection?.props.Tempo ? parseFloat(settingSection.props.Tempo) : 120;

  // ノートセクションを取得 (#0000, #0001, ... 形式)
  const noteSections = sections.filter(s => /^#\d{4}$/.test(s.tag));

  const melody = [];

  for (const sec of noteSections) {
    const length = parseInt(sec.props.Length, 10) || 480;
    const lyricRaw = sec.props.Lyric || "R";
    const noteNum = parseInt(sec.props.NoteNum, 10) || 60;
    const intensity = parseInt(sec.props.Intensity, 10) || 100;
    const modulation = parseInt(sec.props.Modulation, 10) || 0;

    if (lyricRaw === "R" || lyricRaw === "r") {
      melody.push({ type: "rest", length });
    } else {
      const lyric = phonemeToLyric(lyricRaw);
      if (lyric === null) {
        melody.push({ type: "rest", length });
      } else {
        melody.push({
          type: "note",
          noteNum,
          lyric,
          length,
          section: "A",
          intensity,
          modulation,
          vibrato: !!sec.props.VBR,
          shakuri: false,
          shakuriDepth: 2,
          fall: false,
          fallDepth: 2,
          accent: false,
          serif: false,
          tension: false,
          dynamics: null,
          wordStart: true,
        });
      }
    }
  }

  return { melody, bpm };
}

/**
 * USTファイルをプロジェクトJSON形式に変換
 * @param {string} ustText - USTファイル内容
 * @param {object} options - { sectionBreakBeats }
 * @returns {{ bpm, keyId, progId, rhythmId, sections }}
 */
export function ustToProjectJSON(ustText, options = {}) {
  const { sectionBreakBeats = 6 } = options;
  const { melody, bpm } = parseUST(ustText);

  const notes = melody.filter(n => n.type === "note");
  if (notes.length === 0) {
    return { bpm, keyId: "Am", progId: "komuro", rhythmId: "even", sections: [] };
  }

  // メロディ配列からノート位置を計算してフレーズ分割
  // 各ノート/休符の開始位置をtick単位で追跡
  const positions = []; // { index, onset, duration, item }
  let pos = 0;
  for (let i = 0; i < melody.length; i++) {
    positions.push({ index: i, onset: pos, duration: melody[i].length, item: melody[i] });
    pos += melody[i].length;
  }

  const notePositions = positions.filter(p => p.item.type === "note");
  if (notePositions.length === 0) {
    return { bpm, keyId: "Am", progId: "komuro", rhythmId: "even", sections: [] };
  }

  // フレーズ分割: 大きなギャップでセクション境界を検出
  const sectionBreakTicks = sectionBreakBeats * TPQN;
  const phrases = [];
  let phraseStart = 0;

  for (let i = 1; i < notePositions.length; i++) {
    const prevEnd = notePositions[i - 1].onset + notePositions[i - 1].duration;
    const gap = notePositions[i].onset - prevEnd;
    if (gap > sectionBreakTicks) {
      phrases.push({ startIdx: phraseStart, endIdx: i - 1 });
      phraseStart = i;
    }
  }
  phrases.push({ startIdx: phraseStart, endIdx: notePositions.length - 1 });

  // 各フレーズからセクションを構築
  const sectionTypeOrder = ["A", "B", "chorus", "A", "B", "chorus", "bridge", "chorus"];
  const resultSections = [];
  let sectionId = 1;
  const measureTicks = TPQN * 4;

  for (let pi = 0; pi < phrases.length; pi++) {
    const { startIdx, endIdx } = phrases[pi];
    const phraseNotes = notePositions.slice(startIdx, endIdx + 1);
    const firstOnset = phraseNotes[0].onset;
    const lastEnd = phraseNotes[phraseNotes.length - 1].onset + phraseNotes[phraseNotes.length - 1].duration;
    const durationTicks = lastEnd - firstOnset;
    const measures = Math.max(2, Math.round(durationTicks / measureTicks));

    const noteHint = [];
    const durationHint = [];
    const lyricHint = [];
    const restHint = [];
    const displayLyrics = [];
    let prevEnd = firstOnset;
    let noteIdx = 0;

    for (const np of phraseNotes) {
      // ノート前のギャップ → 休符
      const gap = np.onset - prevEnd;
      if (gap > TPQN * 0.3) {
        restHint.push({ beforeIndex: noteIdx, length: gap });
        displayLyrics.push("♪");
      }

      noteHint.push(np.item.noteNum);
      durationHint.push(np.item.length);
      lyricHint.push(np.item.lyric);
      displayLyrics.push(np.item.lyric === "-" ? "ー" : np.item.lyric);
      noteIdx++;

      prevEnd = np.onset + np.duration;
    }

    const sType = sectionTypeOrder[pi % sectionTypeOrder.length] || "A";
    const sLabel = SECTION_TYPES.find(t => t.type === sType)?.label || "Aメロ";

    resultSections.push({
      id: sectionId++,
      type: sType,
      label: sLabel,
      measures,
      lyrics: displayLyrics.join(""),
      keyId: "Am",
      noteHint,
      durationHint,
      lyricHint,
      restHint,
    });
  }

  const allDurations = resultSections.flatMap(s => s.durationHint || []);
  const rhythmId = detectRhythmId(allDurations, { bpm });
  return { bpm, keyId: "Am", progId: "komuro", rhythmId, sections: resultSections };
}
