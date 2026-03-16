import { TPQN, PROGRESSIONS, CHORD_DEFS, ACCOMP_PATTERNS, SECTION_PATTERN_MAP } from "../constants.js";
import { splitMelodyBySinger } from "../utils/singer.js";

function toVLQ(val) {
  if (val < 0) val = 0;
  const bytes = [];
  bytes.push(val & 0x7F);
  val >>= 7;
  while (val > 0) {
    bytes.unshift((val & 0x7F) | 0x80);
    val >>= 7;
  }
  return bytes;
}

function uint16BE(n) { return [(n >> 8) & 0xFF, n & 0xFF]; }
function uint32BE(n) { return [(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]; }

function buildMidiTrack(events) {
  const data = [];
  for (const ev of events) {
    data.push(...toVLQ(ev.delta));
    data.push(...ev.bytes);
  }
  data.push(...toVLQ(0), 0xFF, 0x2F, 0x00);
  const header = [0x4D, 0x54, 0x72, 0x6B, ...uint32BE(data.length)];
  return [...header, ...data];
}

// シード付きPRNG (melody.jsと同じ方式)
function makeRand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0x7FFFFFFF; return s / 0x7FFFFFFF; };
}

// ベロシティにランダム変動を加える
function velJitter(baseVel, rand, amount) {
  const offset = Math.round((rand() - 0.5) * 2 * amount);
  return Math.max(1, Math.min(127, baseVel + offset));
}

// トーン名からMIDIノート番号を解決
function resolveTone(toneName, chordTones, octaveShift) {
  const root = chordTones[0];
  const third = chordTones.length > 1 ? chordTones[1] : root + 4;
  const fifth = chordTones.length > 2 ? chordTones[2] : root + 7;
  const map = { root, third, fifth, octave: root + 12 };
  return (map[toneName] || root) + octaveShift * 12;
}

// パターン定義から1小節分のMIDIイベントを生成 (単音トラック: bass等)
function renderTonalMeasure(outEvents, pattern, chordTones, ch, rand, jitterAmount, octaveShift) {
  // パターンイベントを tick 順でソートして delta-time に変換
  const sorted = [...pattern.events].sort((a, b) => a.tick - b.tick);
  let prevTick = 0;

  for (const ev of sorted) {
    const delta = ev.tick - prevTick;

    if (ev.tone === "all") {
      // コード全音を発音
      const tones = chordTones.map(t => t + octaveShift * 12);
      const vel = velJitter(ev.vel, rand, jitterAmount);
      for (let ti = 0; ti < tones.length; ti++) {
        outEvents.push({ delta: ti === 0 ? delta : 0, bytes: [0x90 | ch, tones[ti], vel] });
      }
      for (let i = 0; i < tones.length; i++) {
        outEvents.push({ delta: i === 0 ? ev.dur : 0, bytes: [0x80 | ch, tones[i], 0] });
      }
      prevTick = ev.tick + ev.dur;
    } else if (ev.tone.startsWith("arp")) {
      // アルペジオ: arp0, arp1, arp2 → chordTones[idx % len]
      const idx = parseInt(ev.tone.slice(3));
      const t = chordTones[idx % chordTones.length];
      const vel = velJitter(ev.vel, rand, jitterAmount);
      outEvents.push({ delta, bytes: [0x90 | ch, t, vel] });
      outEvents.push({ delta: ev.dur, bytes: [0x80 | ch, t, 0] });
      prevTick = ev.tick + ev.dur;
    } else {
      // 単音 (root, third, fifth, octave)
      const noteNum = resolveTone(ev.tone, chordTones, octaveShift);
      const vel = velJitter(ev.vel, rand, jitterAmount);
      outEvents.push({ delta, bytes: [0x90 | ch, noteNum, vel] });
      outEvents.push({ delta: ev.dur, bytes: [0x80 | ch, noteNum, 0] });
      prevTick = ev.tick + ev.dur;
    }
  }

  // 小節末までの残り時間を埋める
  const measureLen = TPQN * 4;
  if (prevTick < measureLen) {
    // 最後のnote-offのdeltaに残り時間を加算する必要はない
    // (次の小節の最初のイベントのdeltaで吸収される)
  }
}

// ドラムパターンの1小節分をレンダリング
const DRUM_NOTES = { kick: 36, snare: 38, hihat: 42, crash: 49 };

function renderDrumMeasure(outEvents, pattern, rand, jitterAmounts) {
  const sorted = [...pattern.events].sort((a, b) => a.tick - b.tick || DRUM_NOTES[a.drum] - DRUM_NOTES[b.drum]);
  let prevTick = 0;

  for (const ev of sorted) {
    const delta = ev.tick - prevTick;
    const noteNum = DRUM_NOTES[ev.drum] || 36;
    const jitter = jitterAmounts[ev.drum] || 8;
    const vel = velJitter(ev.vel, rand, jitter);

    outEvents.push({ delta, bytes: [0x99, noteNum, vel] });
    if (ev.dur) {
      outEvents.push({ delta: ev.dur, bytes: [0x89, noteNum, 0] });
      prevTick = ev.tick + ev.dur;
    } else {
      prevTick = ev.tick;
    }
  }
}

export function generateMIDI(melody, sections, progId, bpm, singers = null) {
  const prog = PROGRESSIONS[progId];
  const usPerBeat = Math.round(60000000 / bpm);
  const tempoBytes = [(usPerBeat >> 16) & 0xFF, (usPerBeat >> 8) & 0xFF, usPerBeat & 0xFF];
  const rand = makeRand(Math.round(bpm * 7919));

  const tempoTrack = buildMidiTrack([
    { delta: 0, bytes: [0xFF, 0x51, 0x03, ...tempoBytes] },
    { delta: 0, bytes: [0xFF, 0x03, 0x05, 0x54, 0x65, 0x6D, 0x70, 0x6F] },
  ]);

  // シンガー別メロディトラック生成
  const hasSingers = singers && singers.length > 0;
  const melodyTracks = [];

  if (hasSingers) {
    const singerNames = singers.map(s => s.name);
    const melodyMap = splitMelodyBySinger(melody, singerNames);

    singers.forEach((singer, idx) => {
      const ch = idx; // ch0, ch1, ...
      const singerMelody = melodyMap.get(singer.name) || [];
      const events = [
        { delta: 0, bytes: [0xC0 | ch, 80] },
      ];
      for (const n of singerMelody) {
        if (n.type === "note") {
          const vel = Math.max(1, Math.min(127, n.intensity ?? 100));
          events.push({ delta: 0, bytes: [0x90 | ch, n.noteNum, vel] });
          events.push({ delta: n.length, bytes: [0x80 | ch, n.noteNum, 0] });
        } else {
          events.push({ delta: n.length, bytes: [0x90 | ch, 60, 0] });
        }
      }
      melodyTracks.push(buildMidiTrack(events));
    });
  } else {
    const melodyEvents = [
      { delta: 0, bytes: [0xC0, 80] },
    ];
    for (const n of melody) {
      if (n.type === "note") {
        const vel = Math.max(1, Math.min(127, n.intensity ?? 100));
        melodyEvents.push({ delta: 0, bytes: [0x90, n.noteNum, vel] });
        melodyEvents.push({ delta: n.length, bytes: [0x80, n.noteNum, 0] });
      } else {
        melodyEvents.push({ delta: n.length, bytes: [0x90, 60, 0] });
      }
    }
    melodyTracks.push(buildMidiTrack(melodyEvents));
  }

  // 伴奏トラックのチャンネルをシンガー数に応じてオフセット
  const accompCh = hasSingers ? singers.length : 1;

  const chCh = accompCh;       // chord channel
  const chBs = accompCh + 1;   // bass channel
  const chGt = accompCh + 2;   // guitar channel
  const chPn = accompCh + 3;   // piano channel
  const chSt = accompCh + 4;   // strings channel
  // drums always ch9

  const defaultMap = SECTION_PATTERN_MAP.A;

  // --- Chord track ---
  const chordEvents = [
    { delta: 0, bytes: [0xC0 | chCh, 81] },
  ];
  for (const sec of sections) {
    const patMap = SECTION_PATTERN_MAP[sec.type] || defaultMap;
    const effectivePatMap = sec.accompPatterns ? { ...patMap, ...sec.accompPatterns } : patMap;
    const pattern = ACCOMP_PATTERNS.chord[effectivePatMap.chord] || ACCOMP_PATTERNS.chord.wholeNote;
    const chordNames = sec.customChords && sec.customChords.length > 0
      ? sec.customChords
      : prog.chords[sec.keyId];
    const chordDefs = CHORD_DEFS[sec.keyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      renderTonalMeasure(chordEvents, pattern, tones, chCh, rand, 5, -1);
    }
  }
  const chordTrack = buildMidiTrack(chordEvents);

  // --- Bass track (Program 33 = Electric Bass Finger) ---
  const bassEvents = [
    { delta: 0, bytes: [0xC0 | chBs, 33] },
  ];
  for (const sec of sections) {
    const patMap = SECTION_PATTERN_MAP[sec.type] || defaultMap;
    const effectivePatMap = sec.accompPatterns ? { ...patMap, ...sec.accompPatterns } : patMap;
    const pattern = ACCOMP_PATTERNS.bass[effectivePatMap.bass] || ACCOMP_PATTERNS.bass.standard;
    const chordNames = sec.customChords && sec.customChords.length > 0
      ? sec.customChords
      : prog.chords[sec.keyId];
    const chordDefs = CHORD_DEFS[sec.keyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      renderTonalMeasure(bassEvents, pattern, tones, chBs, rand, 6, -2);
    }
  }
  const bassTrack = buildMidiTrack(bassEvents);

  // --- Guitar track (Program 25 = Acoustic Guitar Steel) ---
  const guitarEvents = [
    { delta: 0, bytes: [0xC0 | chGt, 25] },
  ];
  for (const sec of sections) {
    const patMap = SECTION_PATTERN_MAP[sec.type] || defaultMap;
    const effectivePatMap = sec.accompPatterns ? { ...patMap, ...sec.accompPatterns } : patMap;
    const pattern = ACCOMP_PATTERNS.guitar[effectivePatMap.guitar] || ACCOMP_PATTERNS.guitar.downOnly;
    const chordNames = sec.customChords && sec.customChords.length > 0
      ? sec.customChords
      : prog.chords[sec.keyId];
    const chordDefs = CHORD_DEFS[sec.keyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      renderTonalMeasure(guitarEvents, pattern, tones, chGt, rand, 10, 0);
    }
  }
  const guitarTrack = buildMidiTrack(guitarEvents);

  // --- Piano track (Program 0 = Acoustic Grand Piano) ---
  const pianoEvents = [
    { delta: 0, bytes: [0xC0 | chPn, 0] },
  ];
  for (const sec of sections) {
    const patMap = SECTION_PATTERN_MAP[sec.type] || defaultMap;
    const effectivePatMap = sec.accompPatterns ? { ...patMap, ...sec.accompPatterns } : patMap;
    const pattern = ACCOMP_PATTERNS.piano[effectivePatMap.piano] || ACCOMP_PATTERNS.piano.blocky;
    const chordNames = sec.customChords && sec.customChords.length > 0
      ? sec.customChords
      : prog.chords[sec.keyId];
    const chordDefs = CHORD_DEFS[sec.keyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      renderTonalMeasure(pianoEvents, pattern, tones, chPn, rand, 8, 0);
    }
  }
  const pianoTrack = buildMidiTrack(pianoEvents);

  // --- Strings track (Program 48 = String Ensemble 1) ---
  const stringsEvents = [
    { delta: 0, bytes: [0xC0 | chSt, 48] },
  ];
  for (const sec of sections) {
    const patMap = SECTION_PATTERN_MAP[sec.type] || defaultMap;
    const effectivePatMap = sec.accompPatterns ? { ...patMap, ...sec.accompPatterns } : patMap;
    const pattern = ACCOMP_PATTERNS.strings[effectivePatMap.strings] || ACCOMP_PATTERNS.strings.wholePad;
    const chordNames = sec.customChords && sec.customChords.length > 0
      ? sec.customChords
      : prog.chords[sec.keyId];
    const chordDefs = CHORD_DEFS[sec.keyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      renderTonalMeasure(stringsEvents, pattern, tones, chSt, rand, 4, 1);
    }
  }
  const stringsTrack = buildMidiTrack(stringsEvents);

  // --- Drum track (ch9) ---
  const drumEvents = [];
  const drumJitter = { kick: 8, snare: 10, hihat: 6, crash: 5 };

  for (const sec of sections) {
    const patMap = SECTION_PATTERN_MAP[sec.type] || defaultMap;
    const effectivePatMap = sec.accompPatterns ? { ...patMap, ...sec.accompPatterns } : patMap;
    const patternName = effectivePatMap.drums || "basic";
    const pattern = ACCOMP_PATTERNS.drums[patternName] || ACCOMP_PATTERNS.drums.basic;
    const isIntense = sec.type === "chorus" || sec.type === "bridge";

    for (let m = 0; m < sec.measures; m++) {
      // セクション末尾でドラムフィルを挿入 (4小節以上のセクション)
      const isLastMeasure = m === sec.measures - 1;
      const useFill = isLastMeasure && sec.measures >= 4;

      if (useFill) {
        const fillPattern = isIntense
          ? ACCOMP_PATTERNS.drums.fillBig
          : ACCOMP_PATTERNS.drums.fillBasic;
        renderDrumMeasure(drumEvents, fillPattern, rand, drumJitter);
      } else {
        renderDrumMeasure(drumEvents, pattern, rand, drumJitter);
      }
    }
  }
  const drumTrack = buildMidiTrack(drumEvents);

  const totalTracks = 1 + melodyTracks.length + 6; // tempo + melody(s) + chord + bass + guitar + piano + strings + drums
  const header = [
    0x4D, 0x54, 0x68, 0x64,
    ...uint32BE(6),
    ...uint16BE(1),
    ...uint16BE(totalTracks),
    ...uint16BE(TPQN),
  ];
  const allTrackData = [
    ...tempoTrack,
    ...melodyTracks.flat(),
    ...chordTrack,
    ...bassTrack,
    ...guitarTrack,
    ...pianoTrack,
    ...stringsTrack,
    ...drumTrack,
  ];
  const midi = new Uint8Array([...header, ...allTrackData]);
  return midi;
}
