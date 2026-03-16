import { TPQN, SECTION_TYPES, KEYS } from "../constants.js";
import { detectRhythmId } from "../utils/rhythm-detect.js";
import { phonemeToKana } from "../utils/phoneme.js";

const SVP_TPQN = 705600000;
const SVP_SCALE = SVP_TPQN / TPQN;
const MEASURE_BLICKS = SVP_TPQN * 4; // 1小節 = 4拍

// svp.jsと同じ定数を使用（ラウンドトリップ検出用）
const SHAKURI_CENTS = { 1: -50, 2: -100, 3: -200 };
const FALL_CENTS = { 1: -50, 2: -100, 3: -200 };
const SECTION_PARAMS = {
  A:      { tension: -0.10, breathiness: 0.15, loudness: -1.0 },
  B:      { tension:  0.00, breathiness: 0.08, loudness:  0.0 },
  chorus: { tension:  0.30, breathiness: -0.05, loudness:  2.0 },
  bridge: { tension:  0.10, breathiness: 0.05, loudness:  0.5 },
  serif:  { tension: -0.20, breathiness: 0.20, loudness: -2.0 },
};
const DYNAMICS_OFFSET = {
  p: { loudness: -4.0, tension: -0.15, breathiness: 0.3 },
  f: { loudness:  3.0, tension:  0.15, breathiness: -0.2 },
};

function phonemeToLyric(phoneme) {
  if (phoneme === "br" || phoneme === "AP" || phoneme === "SP") return null; // ブレス/無音→休符扱い
  return phonemeToKana(phoneme);
}

/**
 * パラメータカーブの平坦配列 [x1,y1,x2,y2,...] から指定位置の値を線形補間で取得
 */
function sampleCurveAt(points, position) {
  if (!points || points.length < 2) return 0;
  // points は [x1, y1, x2, y2, ...] 形式
  const count = points.length / 2;
  if (count === 0) return 0;

  // 最初のポイントより前
  if (position <= points[0]) return points[1];
  // 最後のポイントより後
  if (position >= points[(count - 1) * 2]) return points[(count - 1) * 2 + 1];

  // 線形補間
  for (let i = 0; i < count - 1; i++) {
    const x0 = points[i * 2];
    const y0 = points[i * 2 + 1];
    const x1 = points[(i + 1) * 2];
    const y1 = points[(i + 1) * 2 + 1];
    if (position >= x0 && position <= x1) {
      if (x1 === x0) return y0;
      const t = (position - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 0;
}

/**
 * パラメータカーブの指定範囲内での平均値を計算
 */
function averageCurveInRange(points, startPos, endPos, samples = 8) {
  if (!points || points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const pos = startPos + (endPos - startPos) * i / (samples - 1);
    sum += sampleCurveAt(points, pos);
  }
  return sum / samples;
}

/**
 * パラメータカーブからノートごとの表現属性を検出
 * @param {object} parameterSource - SVPのparametersオブジェクト
 * @param {Array} sortedNotes - onsetでソート済みのSVPノート配列
 * @returns {Array} ノートごとの表現属性 { shakuri, shakuriDepth, fall, fallDepth, dynamics, tension }
 */
function analyzeNoteExpressions(parameterSource, sortedNotes) {
  if (!parameterSource || sortedNotes.length === 0) {
    return sortedNotes.map(() => ({
      shakuri: false, shakuriDepth: 2, fall: false, fallDepth: 2,
      dynamics: null, tension: false, accent: false,
    }));
  }

  const pitchPoints = parameterSource.pitchDelta?.points || [];
  const loudPoints = parameterSource.loudness?.points || [];
  const tensionPoints = parameterSource.tension?.points || [];
  const breathPoints = parameterSource.breathiness?.points || [];
  const voicingPoints = parameterSource.voicing?.points || [];

  const riseBlicks = Math.round(TPQN * 0.15 * SVP_SCALE);
  const fallDuration = Math.round(TPQN * 0.3 * SVP_SCALE);

  return sortedNotes.map(note => {
    const onset = note.onset;
    const noteEnd = onset + note.duration;
    const expr = {
      shakuri: false, shakuriDepth: 2,
      fall: false, fallDepth: 2,
      dynamics: null, tension: false, accent: false,
    };

    // しゃくり検出: ノート先頭のpitchDelta が負値で、riseBlicks後に0に戻るパターン
    if (pitchPoints.length >= 2) {
      const pitchAtOnset = sampleCurveAt(pitchPoints, onset);
      const pitchAfterRise = sampleCurveAt(pitchPoints, onset + riseBlicks);
      if (pitchAtOnset < -20 && Math.abs(pitchAfterRise) < 20) {
        expr.shakuri = true;
        // 深さ判定
        if (pitchAtOnset <= SHAKURI_CENTS[3] + 30) expr.shakuriDepth = 3;
        else if (pitchAtOnset <= SHAKURI_CENTS[2] + 15) expr.shakuriDepth = 2;
        else expr.shakuriDepth = 1;
      }

      // フォール検出: ノート末尾でpitchDelta が0→負値に下降するパターン
      const fallStart = noteEnd - fallDuration;
      const pitchBeforeFall = sampleCurveAt(pitchPoints, fallStart);
      const pitchAtEnd = sampleCurveAt(pitchPoints, noteEnd);
      if (Math.abs(pitchBeforeFall) < 20 && pitchAtEnd < -20) {
        expr.fall = true;
        if (pitchAtEnd <= FALL_CENTS[3] + 30) expr.fallDepth = 3;
        else if (pitchAtEnd <= FALL_CENTS[2] + 15) expr.fallDepth = 2;
        else expr.fallDepth = 1;
      }
    }

    // ダイナミクス検出: loudness値がセクション基準から大きくずれている場合
    if (loudPoints.length >= 2) {
      const loudness = sampleCurveAt(loudPoints, onset);
      // セクション基準値の推定は難しいので、絶対値ベースで判定
      // DYNAMICS_OFFSET: p = -4.0, f = +3.0
      if (loudness < -3.0) expr.dynamics = "p";
      else if (loudness > 1.5) expr.dynamics = "f";
    }

    // テンション検出: tension値が高い場合
    if (tensionPoints.length >= 2) {
      const tensionVal = sampleCurveAt(tensionPoints, onset);
      if (tensionVal > 0.15) expr.tension = true;
    }

    // breathiness検出: カーブ値を記録（セクションベースラインとの差分はsvpToProjectJSON側で計算）
    if (breathPoints.length >= 2) {
      expr.breathinessValue = sampleCurveAt(breathPoints, onset);
    }

    // voicing検出: カーブ値からvoicingModeに逆変換
    if (voicingPoints.length >= 2) {
      const voicingVal = sampleCurveAt(voicingPoints, onset);
      if (voicingVal < 0.45) expr.voicingMode = "whisper";       // ~0.3
      else if (voicingVal < 0.75) expr.voicingMode = "talk";     // ~0.6
      else if (voicingVal < 0.93) expr.voicingMode = "p";        // ~0.85
      else expr.voicingMode = null;                               // 1.0 = normal
    }

    return expr;
  });
}

/**
 * ノート配列からキー（調）を検出
 * @param {Array} notes - SVPノート配列 (pitch, duration プロパティ必須)
 * @returns {string} 検出されたkeyId (例: "Am", "C")
 */
function detectKey(notes) {
  if (!notes || notes.length === 0) return "Am";

  // ピッチクラスごとの重み（音長で重み付け）
  const pitchClassWeights = new Array(12).fill(0);
  for (const note of notes) {
    const pc = note.pitch % 12;
    pitchClassWeights[pc] += note.duration;
  }

  let bestKey = "Am";
  let bestScore = -1;

  for (const [keyId, keyDef] of Object.entries(KEYS)) {
    // スケール音のピッチクラスを抽出
    const scaleClasses = new Set(keyDef.scale.map(n => n % 12));
    let score = 0;
    let total = 0;
    for (let pc = 0; pc < 12; pc++) {
      if (scaleClasses.has(pc)) {
        score += pitchClassWeights[pc];
      }
      total += pitchClassWeights[pc];
    }
    // スケール一致率（音長で重み付け）
    const matchRate = total > 0 ? score / total : 0;
    if (matchRate > bestScore) {
      bestScore = matchRate;
      bestKey = keyId;
    }
  }

  return bestKey;
}

/**
 * パラメータカーブの平均値からセクションタイプを推定
 * @param {object} parameterSource - SVPのparametersオブジェクト
 * @param {number} startBlick - フレーズ開始位置
 * @param {number} endBlick - フレーズ終了位置
 * @returns {string} 推定されたセクションタイプ
 */
function inferSectionType(parameterSource, startBlick, endBlick) {
  if (!parameterSource) return "A";

  const tensionPoints = parameterSource.tension?.points || [];
  const breathPoints = parameterSource.breathiness?.points || [];
  const loudPoints = parameterSource.loudness?.points || [];

  // カーブが空の場合はデフォルト
  if (tensionPoints.length < 2 && breathPoints.length < 2 && loudPoints.length < 2) {
    return "A";
  }

  const avgTension = averageCurveInRange(tensionPoints, startBlick, endBlick);
  const avgBreath = averageCurveInRange(breathPoints, startBlick, endBlick);
  const avgLoud = averageCurveInRange(loudPoints, startBlick, endBlick);

  // SECTION_PARAMS とのユークリッド距離で最近傍マッチ
  let bestType = "A";
  let bestDist = Infinity;
  for (const [type, params] of Object.entries(SECTION_PARAMS)) {
    const dist = Math.sqrt(
      (avgTension - params.tension) ** 2 +
      (avgBreath - params.breathiness) ** 2 +
      (avgLoud - params.loudness) ** 2
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestType = type;
    }
  }
  return bestType;
}

/**
 * 複数のグループからノートとパラメータソースをマージ
 */
function mergeGroups(track, library) {
  let allNotes = [];
  let mergedParams = null;

  // mainGroup のノートを取得
  const mainNotes = track.mainGroup?.notes || [];
  if (mainNotes.length > 0) {
    allNotes = [...mainNotes];
    mergedParams = track.mainGroup?.parameters || null;
  }

  // groups からlibrary参照でノートを取得（全グループ）
  if (track.groups?.length > 0) {
    for (const group of track.groups) {
      const groupId = group.groupID;
      const libEntry = library?.find(l => l.uuid === groupId);
      if (!libEntry) continue;

      const groupNotes = libEntry.notes || [];
      const offset = group.blickOffset || 0;

      // ノートにオフセットを適用してマージ
      for (const n of groupNotes) {
        allNotes.push(offset !== 0 ? { ...n, onset: n.onset + offset } : n);
      }

      // パラメータカーブもマージ（オフセット適用）
      if (libEntry.parameters && offset !== 0) {
        if (!mergedParams) {
          mergedParams = { pitchDelta: { mode: "cubic", points: [] }, loudness: { mode: "cubic", points: [] }, tension: { mode: "cubic", points: [] }, breathiness: { mode: "cubic", points: [] }, vibratoEnv: { mode: "cubic", points: [] }, voicing: { mode: "cubic", points: [] } };
        }
        for (const paramName of ["pitchDelta", "loudness", "tension", "breathiness", "vibratoEnv", "voicing"]) {
          const srcPoints = libEntry.parameters[paramName]?.points || [];
          if (srcPoints.length > 0) {
            const destPoints = mergedParams[paramName]?.points || [];
            // x座標にオフセットを加算
            for (let i = 0; i < srcPoints.length; i += 2) {
              destPoints.push(srcPoints[i] + offset, srcPoints[i + 1]);
            }
            if (!mergedParams[paramName]) mergedParams[paramName] = { mode: "cubic", points: destPoints };
            else mergedParams[paramName].points = destPoints;
          }
        }
      } else if (libEntry.parameters && !mergedParams) {
        mergedParams = libEntry.parameters;
      }
    }
  }

  return { notes: allNotes, parameterSource: mergedParams };
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

  // ノートを取得: mainGroupおよびlibrary経由のgroups（複数グループ対応）
  const merged = mergeGroups(track, svp.library);
  let notes = merged.notes;
  const parameterSource = merged.parameterSource;

  if (notes.length === 0) {
    return { melody: [], bpm, trackName: track.name || "Unknown" };
  }

  // onsetでソート
  const sorted = [...notes].sort((a, b) => a.onset - b.onset);

  // パラメータカーブから表現属性を検出
  const vocNotes = sorted.filter(n => {
    const lyric = phonemeToLyric(n.lyrics);
    return lyric !== null;
  });
  const expressions = analyzeNoteExpressions(parameterSource, vocNotes);

  const melody = [];
  let currentPos = sorted[0].onset; // 最初のノートの位置から開始
  let exprIdx = 0;

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
      const expr = expressions[exprIdx] || {};
      exprIdx++;
      melody.push({
        type: "note",
        noteNum: note.pitch,
        lyric,
        length,
        section: "A", // SVPにはセクション情報がないのでデフォルト
        intensity: 100,
        modulation: 0,
        vibrato: false,
        shakuri: expr.shakuri || false,
        shakuriDepth: expr.shakuriDepth || 2,
        fall: expr.fall || false,
        fallDepth: expr.fallDepth || 2,
        accent: expr.accent || false,
        serif: false,
        tension: expr.tension || false,
        dynamics: expr.dynamics || null,
        wordStart: true,
        detune: note.detune || 0,
        systemAttributes: note.systemAttributes || undefined,
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
    shakuriMatches: 0,
    shakuriMismatches: 0,
    fallMatches: 0,
    fallMismatches: 0,
    dynamicsMatches: 0,
    dynamicsMismatches: 0,
    tensionMatches: 0,
    tensionMismatches: 0,
    detuneMatches: 0,
    detuneMismatches: 0,
    systemAttributesMatches: 0,
    systemAttributesMismatches: 0,
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

    // 表現プロパティの比較
    const shakuriMatch = (orig.shakuri || false) === (re.shakuri || false);
    const fallMatch = (orig.fall || false) === (re.fall || false);
    const dynamicsMatch = (orig.dynamics || null) === (re.dynamics || null);
    const tensionMatch = (orig.tension || false) === (re.tension || false);
    const detuneMatch = (orig.detune || 0) === (re.detune || 0);

    // systemAttributes比較: F0制御パラメータ6個
    const origSA = orig.systemAttributes || {};
    const reSA = re.systemAttributes || {};
    const saKeys = ["tF0Offset", "tF0Left", "tF0Right", "dF0Left", "dF0Right", "dF0Vbr"];
    const saMatch = saKeys.every(k => Math.abs((origSA[k] || 0) - (reSA[k] || 0)) < 0.001);

    if (shakuriMatch) summary.shakuriMatches++; else summary.shakuriMismatches++;
    if (fallMatch) summary.fallMatches++; else summary.fallMismatches++;
    if (dynamicsMatch) summary.dynamicsMatches++; else summary.dynamicsMismatches++;
    if (tensionMatch) summary.tensionMatches++; else summary.tensionMismatches++;
    if (detuneMatch) summary.detuneMatches++; else summary.detuneMismatches++;
    if (saMatch) summary.systemAttributesMatches++; else summary.systemAttributesMismatches++;

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
 * SVPのノート列から内部で使うSVP rawノート配列とパラメータソースを取得
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
  const meter = svp.time?.meter?.[0] || { index: 0, numerator: 4, denominator: 4 };
  const track = svp.tracks[trackIndex];
  if (!track) return { notes: [], bpm, parameterSource: null, meter };

  const merged = mergeGroups(track, svp.library);
  return {
    notes: [...merged.notes].sort((a, b) => a.onset - b.onset),
    bpm,
    parameterSource: merged.parameterSource,
    meter,
  };
}

/**
 * SVPファイルをプロジェクトJSON形式に変換
 * @param {string} svpJson - SVPファイル内容
 * @param {object} options - { trackIndex, sectionBreakBeats }
 * @returns {{ bpm, keyId, progId, rhythmId, sections }}
 */
export function svpToProjectJSON(svpJson, options = {}) {
  const { trackIndex = 0, sectionBreakBeats = 6 } = options;
  const { notes, bpm, parameterSource, meter } = extractSvpNotes(svpJson, trackIndex);
  const beatsPerMeasure = (meter.numerator || 4) * (4 / (meter.denominator || 4));
  const measureBlicks = SVP_TPQN * beatsPerMeasure;

  // マルチトラックSVPからsingers情報を抽出
  let singers = [];
  try {
    const cleanJson = svpJson.replace(/\0+$/, "");
    const svp = JSON.parse(cleanJson);
    const tracks = svp.tracks || [];
    if (tracks.length > 1) {
      singers = tracks
        .filter(t => !t.mainRef?.isInstrumental)
        .map(t => ({
          name: t.name || "",
          database: t.mainRef?.database?.name || "",
        }))
        .filter(s => s.name);
    }
  } catch { /* ignore parse errors, already handled below */ }

  // キー検出
  const detectedKey = detectKey(notes);

  if (notes.length === 0) {
    const result = { bpm, keyId: detectedKey, progId: "komuro", rhythmId: "even", sections: [], meter: { numerator: meter.numerator || 4, denominator: meter.denominator || 4 } };
    if (singers.length > 0) result.singers = singers;
    return result;
  }

  // パラメータカーブからノートごとの表現属性を検出
  const vocNotes = notes.filter(n => {
    const lyric = phonemeToLyric(n.lyrics);
    return lyric !== null;
  });
  const allExpressions = analyzeNoteExpressions(parameterSource, vocNotes);

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
  let globalVocIdx = 0; // allExpressions との同期用

  for (let pi = 0; pi < phrases.length; pi++) {
    const { startIdx, endIdx } = phrases[pi];
    const phraseNotes = notes.slice(startIdx, endIdx + 1);
    const firstOnset = phraseNotes[0].onset;
    const lastEnd = phraseNotes[phraseNotes.length - 1].onset + phraseNotes[phraseNotes.length - 1].duration;
    const durationBlicks = lastEnd - firstOnset;
    const measures = Math.max(2, Math.round(durationBlicks / measureBlicks));

    // noteHint/durationHint/lyricHint/restHint/expressionHint/detuneHint を構築
    const noteHint = [];
    const durationHint = [];
    const lyricHint = [];
    const restHint = []; // { beforeIndex, length } ノート前の休符
    const expressionHint = [];
    const detuneHint = [];
    const systemAttributesHint = [];
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
        // globalVocIdx は進めない（vocNotesではnull歌詞はフィルタ済み）
      } else {
        noteHint.push(note.pitch);
        durationHint.push(Math.round(note.duration / SVP_SCALE));
        lyricHint.push(lyric);
        expressionHint.push(allExpressions[globalVocIdx] || {});
        detuneHint.push(note.detune || 0);
        systemAttributesHint.push(note.systemAttributes || null);
        displayLyrics.push(lyric === "-" ? "ー" : lyric);
        globalVocIdx++;
        noteIdx++;
      }

      prevEnd = note.onset + note.duration;
    }

    // セクションタイプ推定: パラメータカーブがあれば推定、なければ位置ベース
    let sType;
    if (parameterSource) {
      sType = inferSectionType(parameterSource, firstOnset, lastEnd);
    } else {
      sType = sectionTypeOrder[pi % sectionTypeOrder.length] || "A";
    }
    const sLabel = SECTION_TYPES.find(t => t.type === sType)?.label || "Aメロ";

    // vibratoEnvHint: セクション範囲のビブラートカーブを抽出（セクション相対座標）
    let vibratoEnvHint = [];
    const vibratoPoints = parameterSource?.vibratoEnv?.points || [];
    if (vibratoPoints.length >= 2) {
      for (let vi = 0; vi < vibratoPoints.length; vi += 2) {
        const x = vibratoPoints[vi];
        const y = vibratoPoints[vi + 1];
        if (x >= firstOnset && x <= lastEnd) {
          vibratoEnvHint.push(x - firstOnset, y); // セクション相対座標
        }
      }
    }

    // breathinessOffset: セクションベースラインとの差分を計算
    const sectionBreathBaseline = (SECTION_PARAMS[sType] || SECTION_PARAMS.A).breathiness;
    for (const expr of expressionHint) {
      if (expr.breathinessValue !== undefined) {
        expr.breathinessOffset = expr.breathinessValue - sectionBreathBaseline;
        delete expr.breathinessValue; // 中間値は除去
      }
    }

    sections.push({
      id: sectionId++,
      type: sType,
      label: sLabel,
      measures,
      lyrics: displayLyrics.join(""),
      keyId: detectedKey,
      noteHint,
      durationHint,
      lyricHint,
      restHint,
      expressionHint,
      detuneHint,
      systemAttributesHint,
      vibratoEnvHint,
    });
  }

  const allDurations = sections.flatMap(s => s.durationHint || []);
  const rhythmId = detectRhythmId(allDurations, { bpm });
  const result = { bpm, keyId: detectedKey, progId: "komuro", rhythmId, sections, meter: { numerator: meter.numerator || 4, denominator: meter.denominator || 4 } };
  if (singers.length > 0) result.singers = singers;
  return result;
}
