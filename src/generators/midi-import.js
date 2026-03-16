import { TPQN, SECTION_TYPES, KEYS } from "../constants.js";
import { detectRhythmId } from "../utils/rhythm-detect.js";

/**
 * VLQ (Variable Length Quantity) をデコード
 * @param {DataView} dataView
 * @param {number} offset
 * @returns {{ value: number, bytesRead: number }}
 */
function readVLQ(dataView, offset) {
  let value = 0;
  let bytesRead = 0;
  let byte;
  do {
    byte = dataView.getUint8(offset + bytesRead);
    value = (value << 7) | (byte & 0x7F);
    bytesRead++;
  } while (byte & 0x80);
  return { value, bytesRead };
}

/**
 * バイナリMIDIファイルを解析
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{ format: number, ticksPerQuarterNote: number, tracks: Array }}
 */
function parseMIDI(arrayBuffer) {
  if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error("MIDIファイルのデータが不正です");
  }
  if (arrayBuffer.byteLength < 14) {
    throw new Error("MIDIファイルが小さすぎます（ヘッダーが不完全）");
  }
  const view = new DataView(arrayBuffer);
  let offset = 0;

  // --- MThd ヘッダー ---
  const headerMagic = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
  );
  if (headerMagic !== "MThd") {
    throw new Error("有効なMIDIファイルではありません");
  }
  offset = 4;
  const headerLength = view.getUint32(offset); offset += 4;
  const format = view.getUint16(offset); offset += 2;
  const numTracks = view.getUint16(offset); offset += 2;
  const division = view.getUint16(offset); offset += 2;

  // SMPTE タイミングは非対応
  if (division & 0x8000) {
    throw new Error("SMPTEタイミングのMIDIファイルには対応していません");
  }
  const ticksPerQuarterNote = division;

  // ヘッダーの残りをスキップ（通常は0）
  offset = 8 + headerLength;

  // --- MTrk トラック ---
  const tracks = [];
  for (let t = 0; t < numTracks; t++) {
    if (offset + 8 > arrayBuffer.byteLength) break;

    const trackMagic = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
    offset += 4;
    const trackLength = view.getUint32(offset); offset += 4;

    if (trackMagic !== "MTrk") {
      // 不明なチャンクはスキップ
      offset += trackLength;
      continue;
    }

    const trackEnd = offset + trackLength;
    const events = [];
    let runningStatus = 0;

    while (offset < trackEnd) {
      // デルタタイム
      const vlq = readVLQ(view, offset);
      offset += vlq.bytesRead;
      const deltaTime = vlq.value;

      // ステータスバイト
      let statusByte = view.getUint8(offset);

      if (statusByte < 0x80) {
        // Running status: ステータスバイト省略
        statusByte = runningStatus;
      } else {
        offset++;
        if (statusByte < 0xF0) {
          runningStatus = statusByte;
        }
      }

      const eventType = statusByte & 0xF0;
      const channel = statusByte & 0x0F;

      if (statusByte === 0xFF) {
        // メタイベント
        const metaType = view.getUint8(offset); offset++;
        const metaVlq = readVLQ(view, offset); offset += metaVlq.bytesRead;
        const metaLength = metaVlq.value;
        const data = new Uint8Array(arrayBuffer, offset, metaLength);
        offset += metaLength;

        events.push({ deltaTime, type: "meta", metaType, data: Array.from(data) });
      } else if (statusByte === 0xF0 || statusByte === 0xF7) {
        // SysEx
        const sysVlq = readVLQ(view, offset); offset += sysVlq.bytesRead;
        offset += sysVlq.value;
      } else if (eventType === 0x80) {
        // Note Off
        const noteNumber = view.getUint8(offset); offset++;
        const velocity = view.getUint8(offset); offset++;
        events.push({ deltaTime, type: "noteOff", channel, noteNumber, velocity });
      } else if (eventType === 0x90) {
        // Note On (velocity 0 = Note Off)
        const noteNumber = view.getUint8(offset); offset++;
        const velocity = view.getUint8(offset); offset++;
        if (velocity === 0) {
          events.push({ deltaTime, type: "noteOff", channel, noteNumber, velocity: 0 });
        } else {
          events.push({ deltaTime, type: "noteOn", channel, noteNumber, velocity });
        }
      } else if (eventType === 0xA0) {
        // Polyphonic aftertouch
        offset += 2;
      } else if (eventType === 0xB0) {
        // Control Change
        offset += 2;
      } else if (eventType === 0xC0) {
        // Program Change
        offset += 1;
      } else if (eventType === 0xD0) {
        // Channel Pressure
        offset += 1;
      } else if (eventType === 0xE0) {
        // Pitch Bend
        offset += 2;
      } else {
        // 不明なイベント — 安全のためスキップ
        break;
      }
    }

    // トラック終端に合わせる
    offset = trackEnd;
    tracks.push({ events });
  }

  return { format, ticksPerQuarterNote, tracks };
}

/**
 * パースしたMIDIからメロディノートを抽出
 * @param {{ format: number, ticksPerQuarterNote: number, tracks: Array }} parsedMidi
 * @returns {{ notes: Array<{ pitch: number, onset: number, duration: number, lyric: string }>, bpm: number }}
 */
function extractMelodyNotes(parsedMidi) {
  const scaleFactor = TPQN / parsedMidi.ticksPerQuarterNote;
  let bpm = 120; // デフォルト

  // 全トラックからテンポと歌詞を収集
  const lyrics = []; // { absoluteTick, text }
  const channelNotes = new Map(); // channel → [{ pitch, onset, duration }]

  for (const track of parsedMidi.tracks) {
    let absoluteTick = 0;

    // NoteOn/Off ペアリング用: key = "channel-noteNumber"
    const activeNotes = new Map();

    for (const event of track.events) {
      absoluteTick += event.deltaTime;

      if (event.type === "meta") {
        if (event.metaType === 0x51 && event.data.length === 3) {
          // テンポ (最初のテンポのみ使用)
          const usPerBeat = (event.data[0] << 16) | (event.data[1] << 8) | event.data[2];
          if (usPerBeat > 0) {
            bpm = Math.round(60000000 / usPerBeat);
          }
        } else if (event.metaType === 0x05) {
          // 歌詞メタイベント
          const text = event.data.map(b => String.fromCharCode(b)).join("").trim();
          if (text) {
            lyrics.push({ absoluteTick: Math.round(absoluteTick * scaleFactor), text });
          }
        }
      } else if (event.type === "noteOn") {
        // ドラムチャンネル (ch9) を除外
        if (event.channel === 9) continue;
        const key = `${event.channel}-${event.noteNumber}`;
        // 同じピッチのノートが既にアクティブな場合は先に終了
        if (activeNotes.has(key)) {
          const prev = activeNotes.get(key);
          const duration = Math.round((absoluteTick - prev.onset) * scaleFactor);
          if (duration > 0) {
            if (!channelNotes.has(event.channel)) channelNotes.set(event.channel, []);
            channelNotes.get(event.channel).push({
              pitch: event.noteNumber,
              onset: Math.round(prev.onset * scaleFactor),
              duration,
              velocity: prev.velocity,
            });
          }
        }
        activeNotes.set(key, { onset: absoluteTick, velocity: event.velocity });
      } else if (event.type === "noteOff") {
        if (event.channel === 9) continue;
        const key = `${event.channel}-${event.noteNumber}`;
        if (activeNotes.has(key)) {
          const noteStart = activeNotes.get(key);
          const duration = Math.round((absoluteTick - noteStart.onset) * scaleFactor);
          if (duration > 0) {
            if (!channelNotes.has(event.channel)) channelNotes.set(event.channel, []);
            channelNotes.get(event.channel).push({
              pitch: event.noteNumber,
              onset: Math.round(noteStart.onset * scaleFactor),
              duration,
              velocity: noteStart.velocity,
            });
          }
          activeNotes.delete(key);
        }
      }
    }
  }

  // メロディチャンネル選択: ノート数最多の非ドラムチャンネル
  let bestChannel = -1;
  let bestCount = 0;
  for (const [channel, notes] of channelNotes) {
    if (notes.length > bestCount) {
      bestCount = notes.length;
      bestChannel = channel;
    }
  }

  if (bestChannel === -1) {
    return { notes: [], bpm };
  }

  // ノートを開始時間でソート
  const melodyNotes = channelNotes.get(bestChannel).sort((a, b) => a.onset - b.onset);

  // 歌詞の割り当て
  if (lyrics.length > 0) {
    let lyricIdx = 0;
    for (const note of melodyNotes) {
      if (lyricIdx < lyrics.length) {
        note.lyric = lyrics[lyricIdx].text;
        lyricIdx++;
      } else {
        note.lyric = "ら";
      }
    }
  } else {
    for (const note of melodyNotes) {
      note.lyric = "ら";
    }
  }

  return { notes: melodyNotes, bpm };
}

/**
 * ノート配列からキー（調）を検出
 * @param {Array} notes - { pitch, duration } プロパティ必須
 * @returns {string} 検出されたkeyId
 */
function detectKey(notes) {
  if (!notes || notes.length === 0) return "Am";

  const pitchClassWeights = new Array(12).fill(0);
  for (const note of notes) {
    const pc = note.pitch % 12;
    pitchClassWeights[pc] += note.duration;
  }

  let bestKey = "Am";
  let bestScore = -1;

  for (const [keyId, keyDef] of Object.entries(KEYS)) {
    const scaleClasses = new Set(keyDef.scale.map(n => n % 12));
    let score = 0;
    let total = 0;
    for (let pc = 0; pc < 12; pc++) {
      if (scaleClasses.has(pc)) {
        score += pitchClassWeights[pc];
      }
      total += pitchClassWeights[pc];
    }
    const matchRate = total > 0 ? score / total : 0;
    if (matchRate > bestScore) {
      bestScore = matchRate;
      bestKey = keyId;
    }
  }

  return bestKey;
}

/**
 * MIDIファイル(ArrayBuffer)をプロジェクトJSON形式に変換
 * @param {ArrayBuffer} arrayBuffer - MIDIファイルのバイナリデータ
 * @param {object} options - { sectionBreakBeats }
 * @returns {{ bpm, keyId, progId, rhythmId, sections }}
 */
export function midiToProjectJSON(arrayBuffer, options = {}) {
  const { sectionBreakBeats = 6 } = options;

  const parsedMidi = parseMIDI(arrayBuffer);
  const { notes, bpm } = extractMelodyNotes(parsedMidi);

  if (notes.length === 0) {
    return { bpm, keyId: "Am", progId: "komuro", rhythmId: "even", sections: [] };
  }

  const keyId = detectKey(notes);

  // フレーズ分割: 大きなギャップでセクション境界を検出
  const sectionBreakTicks = sectionBreakBeats * TPQN;
  const phrases = [];
  let phraseStart = 0;

  for (let i = 1; i < notes.length; i++) {
    const prevEnd = notes[i - 1].onset + notes[i - 1].duration;
    const gap = notes[i].onset - prevEnd;
    if (gap > sectionBreakTicks) {
      phrases.push({ startIdx: phraseStart, endIdx: i - 1 });
      phraseStart = i;
    }
  }
  phrases.push({ startIdx: phraseStart, endIdx: notes.length - 1 });

  // 各フレーズからセクションを構築
  const sectionTypeOrder = ["A", "B", "chorus", "A", "B", "chorus", "bridge", "chorus"];
  const resultSections = [];
  let sectionId = 1;
  const measureTicks = TPQN * 4;

  for (let pi = 0; pi < phrases.length; pi++) {
    const { startIdx, endIdx } = phrases[pi];
    const phraseNotes = notes.slice(startIdx, endIdx + 1);
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

    for (const n of phraseNotes) {
      // ノート前のギャップ → 休符
      const gap = n.onset - prevEnd;
      if (gap > TPQN * 0.3) {
        restHint.push({ beforeIndex: noteIdx, length: gap });
        displayLyrics.push("♪");
      }

      noteHint.push(n.pitch);
      durationHint.push(n.duration);
      lyricHint.push(n.lyric);
      displayLyrics.push(n.lyric === "-" ? "ー" : n.lyric);
      noteIdx++;

      prevEnd = n.onset + n.duration;
    }

    const sType = sectionTypeOrder[pi % sectionTypeOrder.length] || "A";
    const sLabel = SECTION_TYPES.find(t => t.type === sType)?.label || "Aメロ";

    resultSections.push({
      id: sectionId++,
      type: sType,
      label: sLabel,
      measures,
      lyrics: displayLyrics.join(""),
      keyId,
      noteHint,
      durationHint,
      lyricHint,
      restHint,
    });
  }

  const allDurations = resultSections.flatMap(s => s.durationHint || []);
  const rhythmId = detectRhythmId(allDurations, { bpm });
  return { bpm, keyId, progId: "komuro", rhythmId, sections: resultSections };
}
