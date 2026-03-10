import { TPQN, SECTION_TYPES } from "../constants.js";

const SVP_TPQN = 705600000;
const SVP_SCALE = SVP_TPQN / TPQN;
const MEASURE_BLICKS = SVP_TPQN * 4; // 1小節 = 4拍

// ローマ字→ひらがな逆変換マップ
const PHONEME_TO_KANA = {
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',sha:'しゃ',shu:'しゅ',sho:'しょ',
  cha:'ちゃ',chu:'ちゅ',cho:'ちょ',nya:'にゃ',nyu:'にゅ',nyo:'にょ',
  hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',mya:'みゃ',myu:'みゅ',myo:'みょ',
  rya:'りゃ',ryu:'りゅ',ryo:'りょ',gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',
  ja:'じゃ',ju:'じゅ',jo:'じょ',bya:'びゃ',byu:'びゅ',byo:'びょ',
  pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',dya:'でゃ',dyu:'でゅ',dyo:'でょ',
  ti:'てぃ',di:'でぃ',fa:'ふぁ',fi:'ふぃ',fe:'ふぇ',fo:'ふぉ',
  wi:'うぃ',we:'うぇ',wo:'うぉ',tsa:'つぁ',tsi:'つぃ',tse:'つぇ',tso:'つぉ',
  a:'あ',i:'い',u:'う',e:'え',o:'お',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',
  sa:'さ',shi:'し',su:'す',se:'せ',so:'そ',
  ta:'た',chi:'ち',tsu:'つ',te:'て',to:'と',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',
  ha:'は',hi:'ひ',fu:'ふ',he:'へ',ho:'ほ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',
  ya:'や',yu:'ゆ',yo:'よ',
  ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',
  wa:'わ',n:'ん',
  ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',
  za:'ざ',ji:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
  da:'だ',du:'づ',de:'で',do:'ど',
  ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',
  pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  cl:'っ',
};

// 長いキーを先にマッチさせるためソート
const PHONEME_KEYS_SORTED = Object.keys(PHONEME_TO_KANA).sort((a, b) => b.length - a.length);

function phonemeToLyric(phoneme) {
  if (!phoneme || phoneme === "-") return "-";
  if (phoneme === "br" || phoneme === "AP" || phoneme === "SP") return null; // ブレス/無音→休符扱い

  let result = "";
  let pos = 0;
  while (pos < phoneme.length) {
    let matched = false;
    for (const key of PHONEME_KEYS_SORTED) {
      if (phoneme.startsWith(key, pos)) {
        result += PHONEME_TO_KANA[key];
        pos += key.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += phoneme[pos];
      pos++;
    }
  }
  return result || phoneme;
}

/**
 * SVP JSONを解析して内部melody配列を返す
 * @param {string} svpJson - SVPファイルの内容(JSON文字列)
 * @param {object} options - { trackIndex: 0 } 使用するトラックインデックス
 * @returns {{ melody: Array, bpm: number, trackName: string }}
 */
export function parseSVP(svpJson, options = {}) {
  const { trackIndex = 0 } = options;

  // SVPは末尾にnullバイトがある場合がある
  const cleanJson = svpJson.replace(/\0+$/, "");
  let svp;
  try {
    svp = JSON.parse(cleanJson);
  } catch (e) {
    throw new Error(`SVPファイルのJSON解析に失敗しました: ${e.message}`);
  }

  const bpm = svp.time?.tempo?.[0]?.bpm || 120;

  const track = svp.tracks[trackIndex];
  if (!track) throw new Error(`Track ${trackIndex} not found`);

  // ノートを取得: mainGroupまたはlibrary経由のgroups
  let notes = [];
  let parameterSource = null;

  const mainNotes = track.mainGroup?.notes || [];
  if (mainNotes.length > 0) {
    notes = mainNotes;
    parameterSource = track.mainGroup?.parameters;
  } else if (track.groups?.length > 0) {
    // groupsからlibrary参照でノートを取得
    const group = track.groups[0];
    const groupId = group.groupID;
    const libEntry = svp.library?.find(l => l.uuid === groupId);
    if (libEntry) {
      notes = libEntry.notes || [];
      parameterSource = libEntry.parameters;
      // blickOffsetを考慮
      const offset = group.blickOffset || 0;
      if (offset !== 0) {
        notes = notes.map(n => ({ ...n, onset: n.onset + offset }));
      }
    }
  }

  if (notes.length === 0) {
    return { melody: [], bpm, trackName: track.name || "Unknown" };
  }

  // onsetでソート
  const sorted = [...notes].sort((a, b) => a.onset - b.onset);

  const melody = [];
  let currentPos = sorted[0].onset; // 最初のノートの位置から開始

  for (let i = 0; i < sorted.length; i++) {
    const note = sorted[i];
    const noteOnset = note.onset;

    // ノート間のギャップを休符として挿入
    const gap = noteOnset - currentPos;
    if (gap > SVP_SCALE * 60) { // 最小休符閾値: 32分音符程度
      const restLength = Math.round(gap / SVP_SCALE);
      melody.push({ type: "rest", length: restLength });
    }

    const lyric = phonemeToLyric(note.lyrics);
    if (lyric === null) {
      // ブレス/無音ノートは休符として扱う
      const restLength = Math.round(note.duration / SVP_SCALE);
      melody.push({ type: "rest", length: restLength });
    } else {
      const length = Math.round(note.duration / SVP_SCALE);
      melody.push({
        type: "note",
        noteNum: note.pitch,
        lyric,
        length,
        section: "A", // SVPにはセクション情報がないのでデフォルト
        intensity: 100,
        modulation: 0,
        vibrato: false,
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

    currentPos = noteOnset + note.duration;
  }

  return { melody, bpm, trackName: track.name || "Unknown" };
}

/**
 * ラウンドトリップ比較: SVP→import→export→SVPで差分を検出
 * @param {string} originalSvpJson - 元のSVPファイル内容
 * @param {string} reExportedSvpJson - 再エクスポートしたSVP内容
 * @param {object} options - { trackIndex: 0 }
 * @returns {{ summary: object, noteComparisons: Array }}
 */
export function compareRoundTrip(originalSvpJson, reExportedSvpJson, options = {}) {
  const { trackIndex = 0 } = options;

  const origParsed = parseSVP(originalSvpJson, options);
  const reParsed = parseSVP(reExportedSvpJson, options);

  const origNotes = origParsed.melody.filter(n => n.type === "note");
  const reNotes = reParsed.melody.filter(n => n.type === "note");

  const summary = {
    originalNoteCount: origNotes.length,
    reExportedNoteCount: reNotes.length,
    noteCountMatch: origNotes.length === reNotes.length,
    pitchMatches: 0,
    pitchMismatches: 0,
    lyricMatches: 0,
    lyricMismatches: 0,
    durationDiffs: [], // 顕著な差のみ
  };

  const compareCount = Math.min(origNotes.length, reNotes.length);
  const noteComparisons = [];

  for (let i = 0; i < compareCount; i++) {
    const orig = origNotes[i];
    const re = reNotes[i];
    const pitchMatch = orig.noteNum === re.noteNum;
    const lyricMatch = orig.lyric === re.lyric;
    const durationDiff = Math.abs(orig.length - re.length);

    if (pitchMatch) summary.pitchMatches++;
    else summary.pitchMismatches++;

    if (lyricMatch) summary.lyricMatches++;
    else summary.lyricMismatches++;

    if (!pitchMatch || !lyricMatch || durationDiff > 10) {
      noteComparisons.push({
        index: i,
        original: { pitch: orig.noteNum, lyric: orig.lyric, length: orig.length },
        reExported: { pitch: re.noteNum, lyric: re.lyric, length: re.length },
        pitchMatch,
        lyricMatch,
        durationDiff,
      });
    }

    if (durationDiff > 10) {
      summary.durationDiffs.push({ index: i, orig: orig.length, re: re.length, diff: durationDiff });
    }
  }

  return { summary, noteComparisons };
}

/**
 * SVPのノート列から内部で使うSVP rawノート配列を取得
 */
function extractSvpNotes(svpJson, trackIndex = 0) {
  const cleanJson = svpJson.replace(/\0+$/, "");
  let svp;
  try {
    svp = JSON.parse(cleanJson);
  } catch (e) {
    throw new Error(`SVPファイルのJSON解析に失敗しました: ${e.message}`);
  }
  const bpm = svp.time?.tempo?.[0]?.bpm || 120;
  const track = svp.tracks[trackIndex];
  if (!track) return { notes: [], bpm };

  let notes = [];
  const mainNotes = track.mainGroup?.notes || [];
  if (mainNotes.length > 0) {
    notes = mainNotes;
  } else if (track.groups?.length > 0) {
    const group = track.groups[0];
    const libEntry = svp.library?.find(l => l.uuid === group.groupID);
    if (libEntry) {
      notes = libEntry.notes || [];
      const offset = group.blickOffset || 0;
      if (offset !== 0) notes = notes.map(n => ({ ...n, onset: n.onset + offset }));
    }
  }
  return { notes: [...notes].sort((a, b) => a.onset - b.onset), bpm };
}

/**
 * SVPファイルをプロジェクトJSON形式に変換
 * @param {string} svpJson - SVPファイル内容
 * @param {object} options - { trackIndex, sectionBreakBeats }
 * @returns {{ bpm, keyId, progId, rhythmId, sections }}
 */
export function svpToProjectJSON(svpJson, options = {}) {
  const { trackIndex = 0, sectionBreakBeats = 6 } = options;
  const { notes, bpm } = extractSvpNotes(svpJson, trackIndex);

  if (notes.length === 0) {
    return { bpm, keyId: "Am", progId: "komuro", rhythmId: "even", sections: [] };
  }

  // フレーズ分割: 大きなギャップでセクション境界を検出
  const phrases = []; // { startIdx, endIdx, startBlick, endBlick }
  let phraseStart = 0;
  for (let i = 1; i < notes.length; i++) {
    const prevEnd = notes[i - 1].onset + notes[i - 1].duration;
    const gap = notes[i].onset - prevEnd;
    if (gap > sectionBreakBeats * SVP_TPQN) {
      phrases.push({ startIdx: phraseStart, endIdx: i - 1 });
      phraseStart = i;
    }
  }
  phrases.push({ startIdx: phraseStart, endIdx: notes.length - 1 });

  // 各フレーズからセクションを構築
  const sectionTypeOrder = ["A", "B", "chorus", "A", "B", "chorus", "bridge", "chorus"];
  const sections = [];
  let sectionId = 1;

  for (let pi = 0; pi < phrases.length; pi++) {
    const { startIdx, endIdx } = phrases[pi];
    const phraseNotes = notes.slice(startIdx, endIdx + 1);
    const firstOnset = phraseNotes[0].onset;
    const lastEnd = phraseNotes[phraseNotes.length - 1].onset + phraseNotes[phraseNotes.length - 1].duration;
    const durationBlicks = lastEnd - firstOnset;
    const measures = Math.max(2, Math.round(durationBlicks / MEASURE_BLICKS));

    // noteHint/durationHint/lyricHint/restHint を構築
    const noteHint = [];
    const durationHint = [];
    const lyricHint = [];
    const restHint = []; // { beforeIndex, length } ノート前の休符
    const displayLyrics = [];
    let prevEnd = firstOnset;
    let noteIdx = 0;

    for (const note of phraseNotes) {
      // ノート前のギャップ → 休符
      const gap = note.onset - prevEnd;
      if (gap > SVP_TPQN * 0.3) {
        const restLen = Math.round(gap / SVP_SCALE);
        restHint.push({ beforeIndex: noteIdx, length: restLen });
        displayLyrics.push("♪");
      }

      const lyric = phonemeToLyric(note.lyrics);
      if (lyric === null) {
        // ブレス/無音 → 休符
        const restLen = Math.round(note.duration / SVP_SCALE);
        restHint.push({ beforeIndex: noteIdx, length: restLen });
        displayLyrics.push("♪");
      } else {
        noteHint.push(note.pitch);
        durationHint.push(Math.round(note.duration / SVP_SCALE));
        lyricHint.push(lyric);
        displayLyrics.push(lyric === "-" ? "ー" : lyric);
        noteIdx++;
      }

      prevEnd = note.onset + note.duration;
    }

    const sType = sectionTypeOrder[pi % sectionTypeOrder.length] || "A";
    const sLabel = SECTION_TYPES.find(t => t.type === sType)?.label || "Aメロ";

    sections.push({
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

  return { bpm, keyId: "Am", progId: "komuro", rhythmId: "even", sections };
}
