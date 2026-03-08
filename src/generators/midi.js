import { TPQN, PROGRESSIONS, CHORD_DEFS } from "../constants.js";

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

export function generateMIDI(melody, sections, progId, bpm) {
  const prog = PROGRESSIONS[progId];
  const usPerBeat = Math.round(60000000 / bpm);
  const tempoBytes = [(usPerBeat >> 16) & 0xFF, (usPerBeat >> 8) & 0xFF, usPerBeat & 0xFF];

  const tempoTrack = buildMidiTrack([
    { delta: 0, bytes: [0xFF, 0x51, 0x03, ...tempoBytes] },
    { delta: 0, bytes: [0xFF, 0x03, 0x05, 0x54, 0x65, 0x6D, 0x70, 0x6F] },
  ]);

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
  const melodyTrack = buildMidiTrack(melodyEvents);

  const chordEvents = [
    { delta: 0, bytes: [0xC1, 81] },
  ];

  for (const sec of sections) {
    const sectionKeyId = sec.keyId;
    const chordNames = prog.chords[sectionKeyId];
    const chordDefs = CHORD_DEFS[sectionKeyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      const lowTones = tones.map(t => t - 12);
      for (const t of lowTones) {
        chordEvents.push({ delta: 0, bytes: [0x91, t, 80] });
      }
      for (let i = 0; i < lowTones.length; i++) {
        chordEvents.push({ delta: i === 0 ? TPQN * 4 : 0, bytes: [0x81, lowTones[i], 0] });
      }
    }
  }
  const chordTrack = buildMidiTrack(chordEvents);

  // --- Bass track (ch2, Program 33 = Electric Bass Finger) ---
  const bassEvents = [
    { delta: 0, bytes: [0xC2, 33] },
  ];
  for (const sec of sections) {
    const sectionKeyId = sec.keyId;
    const chordNames = prog.chords[sectionKeyId];
    const chordDefs = CHORD_DEFS[sectionKeyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      const root = tones[0] - 24; // 2 octaves below chord voicing
      // Beat 1: root, Beat 3: root or fifth
      const fifth = root + 7;
      bassEvents.push({ delta: 0, bytes: [0x92, root, 90] });
      bassEvents.push({ delta: TPQN, bytes: [0x82, root, 0] });
      bassEvents.push({ delta: TPQN - TPQN, bytes: [0x92, root, 70] });
      bassEvents.push({ delta: TPQN, bytes: [0x82, root, 0] });
      bassEvents.push({ delta: 0, bytes: [0x92, fifth, 85] });
      bassEvents.push({ delta: TPQN, bytes: [0x82, fifth, 0] });
      bassEvents.push({ delta: 0, bytes: [0x92, root, 75] });
      bassEvents.push({ delta: TPQN, bytes: [0x82, root, 0] });
    }
  }
  const bassTrack = buildMidiTrack(bassEvents);

  // --- Guitar track (ch3, Program 25 = Acoustic Guitar Steel) ---
  const guitarEvents = [
    { delta: 0, bytes: [0xC3, 25] },
  ];
  for (const sec of sections) {
    const sectionKeyId = sec.keyId;
    const chordNames = prog.chords[sectionKeyId];
    const chordDefs = CHORD_DEFS[sectionKeyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      // Strumming pattern: down on beats 1,2,3,4 with 8th note upstrokes
      for (let beat = 0; beat < 4; beat++) {
        // Downstroke - full chord
        for (const t of tones) {
          guitarEvents.push({ delta: 0, bytes: [0x93, t, 75] });
        }
        // Release after 8th note, then upstroke
        for (let i = 0; i < tones.length; i++) {
          guitarEvents.push({ delta: i === 0 ? TPQN / 2 : 0, bytes: [0x83, tones[i], 0] });
        }
        // Upstroke (softer)
        for (const t of tones) {
          guitarEvents.push({ delta: 0, bytes: [0x93, t, 55] });
        }
        for (let i = 0; i < tones.length; i++) {
          guitarEvents.push({ delta: i === 0 ? TPQN / 2 : 0, bytes: [0x83, tones[i], 0] });
        }
      }
    }
  }
  const guitarTrack = buildMidiTrack(guitarEvents);

  // --- Piano track (ch4, Program 0 = Acoustic Grand Piano) ---
  const pianoEvents = [
    { delta: 0, bytes: [0xC4, 0] },
  ];
  for (const sec of sections) {
    const sectionKeyId = sec.keyId;
    const chordNames = prog.chords[sectionKeyId];
    const chordDefs = CHORD_DEFS[sectionKeyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      // Arpeggio pattern: 8th notes cycling through chord tones
      for (let beat = 0; beat < 4; beat++) {
        for (let sub = 0; sub < 2; sub++) {
          const idx = (beat * 2 + sub) % tones.length;
          const t = tones[idx];
          pianoEvents.push({ delta: 0, bytes: [0x94, t, 70] });
          pianoEvents.push({ delta: TPQN / 2, bytes: [0x84, t, 0] });
        }
      }
    }
  }
  const pianoTrack = buildMidiTrack(pianoEvents);

  // --- Strings track (ch5, Program 48 = String Ensemble 1) ---
  const stringsEvents = [
    { delta: 0, bytes: [0xC5, 48] },
  ];
  for (const sec of sections) {
    const sectionKeyId = sec.keyId;
    const chordNames = prog.chords[sectionKeyId];
    const chordDefs = CHORD_DEFS[sectionKeyId];
    for (let m = 0; m < sec.measures; m++) {
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      // Whole note pad - soft sustained chord
      const highTones = tones.map(t => t + 12);
      for (const t of highTones) {
        stringsEvents.push({ delta: 0, bytes: [0x95, t, 50] });
      }
      for (let i = 0; i < highTones.length; i++) {
        stringsEvents.push({ delta: i === 0 ? TPQN * 4 : 0, bytes: [0x85, highTones[i], 0] });
      }
    }
  }
  const stringsTrack = buildMidiTrack(stringsEvents);

  const drumEvents = [];
  const KICK = 36, SNARE = 38, HIHAT = 42;
  const totalMeasures = sections.reduce((a, s) => a + s.measures, 0);
  for (let m = 0; m < totalMeasures; m++) {
    for (let beat = 0; beat < 4; beat++) {
      drumEvents.push({ delta: 0, bytes: [0x99, KICK, 100] });
      if (beat === 1 || beat === 3) {
        drumEvents.push({ delta: 0, bytes: [0x99, SNARE, 90] });
      }
      drumEvents.push({ delta: 0, bytes: [0x99, HIHAT, 70] });
      drumEvents.push({ delta: TPQN / 2, bytes: [0x89, HIHAT, 0] });
      drumEvents.push({ delta: 0, bytes: [0x99, HIHAT, 60] });
      drumEvents.push({ delta: TPQN / 2, bytes: [0x89, HIHAT, 0] });
    }
  }
  const drumTrack = buildMidiTrack(drumEvents);

  const header = [
    0x4D, 0x54, 0x68, 0x64,
    ...uint32BE(6),
    ...uint16BE(1),
    ...uint16BE(8),
    ...uint16BE(TPQN),
  ];
  const midi = new Uint8Array([...header, ...tempoTrack, ...melodyTrack, ...chordTrack, ...bassTrack, ...guitarTrack, ...pianoTrack, ...stringsTrack, ...drumTrack]);
  return midi;
}
