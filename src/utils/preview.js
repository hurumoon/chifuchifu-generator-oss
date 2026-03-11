import { TPQN, PROGRESSIONS, CHORD_DEFS } from "../constants.js";

let currentCtx = null;
let stopRequested = false;
let progressInterval = null;

export function stopPreview() {
  stopRequested = true;
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (currentCtx) {
    currentCtx.close().catch(() => {});
    currentCtx = null;
  }
}

export function isPlaying() {
  return currentCtx !== null && currentCtx.state === "running";
}

function noteToFreq(noteNum) {
  return 440 * Math.pow(2, (noteNum - 69) / 12);
}

function createNoiseBuffer(ctx, duration) {
  const size = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function scheduleMelody(ctx, gain, events) {
  for (const ev of events) {
    if (stopRequested) break;

    const freq = noteToFreq(ev.noteNum);
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = ev.section === "chorus" ? "square" : "triangle";
    osc.frequency.value = freq;

    const attack = 0.02;
    const decay = 0.05;
    const sustain = 0.7;
    const release = Math.min(0.08, ev.duration * 0.2);
    const sustainEnd = ev.time + ev.duration - release;

    noteGain.gain.setValueAtTime(0, ev.time);
    noteGain.gain.linearRampToValueAtTime(1, ev.time + attack);
    noteGain.gain.linearRampToValueAtTime(sustain, ev.time + attack + decay);
    noteGain.gain.setValueAtTime(sustain, Math.max(ev.time + attack + decay, sustainEnd));
    noteGain.gain.linearRampToValueAtTime(0, ev.time + ev.duration);

    osc.connect(noteGain);
    noteGain.connect(gain);
    osc.start(ev.time);
    osc.stop(ev.time + ev.duration + 0.01);
  }
}

function scheduleBass(ctx, gain, sections, progId, secPerTick, startTime) {
  const prog = PROGRESSIONS[progId];
  if (!prog) return;

  let time = startTime;
  const beatDur = TPQN * secPerTick;

  for (const sec of sections) {
    const chordNames = prog.chords[sec.keyId];
    const chordDefs = CHORD_DEFS[sec.keyId];
    if (!chordNames || !chordDefs) { time += sec.measures * 4 * beatDur; continue; }

    for (let m = 0; m < sec.measures; m++) {
      if (stopRequested) return;
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];
      const root = tones[0] - 24;
      const fifth = root + 7;

      const bassNotes = [
        { note: root, dur: beatDur },
        { note: root, dur: beatDur },
        { note: fifth, dur: beatDur },
        { note: root, dur: beatDur },
      ];

      for (const bn of bassNotes) {
        const freq = noteToFreq(bn.note);
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "sawtooth";
        osc.frequency.value = freq;
        filter.type = "lowpass";
        filter.frequency.value = 500;

        const noteDur = bn.dur * 0.8;
        noteGain.gain.setValueAtTime(0, time);
        noteGain.gain.linearRampToValueAtTime(1, time + 0.01);
        noteGain.gain.setValueAtTime(1, time + noteDur - 0.05);
        noteGain.gain.linearRampToValueAtTime(0, time + noteDur);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(gain);
        osc.start(time);
        osc.stop(time + noteDur + 0.01);

        time += bn.dur;
      }
    }
  }
}

function scheduleChords(ctx, gain, sections, progId, secPerTick, startTime) {
  const prog = PROGRESSIONS[progId];
  if (!prog) return;

  let time = startTime;
  const measureDur = TPQN * 4 * secPerTick;

  for (const sec of sections) {
    const chordNames = prog.chords[sec.keyId];
    const chordDefs = CHORD_DEFS[sec.keyId];
    if (!chordNames || !chordDefs) { time += sec.measures * measureDur; continue; }

    for (let m = 0; m < sec.measures; m++) {
      if (stopRequested) return;
      const chordName = chordNames[m % chordNames.length];
      const tones = chordDefs[chordName] || [60, 64, 67];

      for (const t of tones) {
        const freq = noteToFreq(t);
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.value = freq;

        const attack = 0.05;
        const release = 0.08;
        const dur = measureDur;

        noteGain.gain.setValueAtTime(0, time);
        noteGain.gain.linearRampToValueAtTime(1, time + attack);
        noteGain.gain.setValueAtTime(1, time + dur - release);
        noteGain.gain.linearRampToValueAtTime(0, time + dur);

        osc.connect(noteGain);
        noteGain.connect(gain);
        osc.start(time);
        osc.stop(time + dur + 0.01);
      }
      time += measureDur;
    }
  }
}

function scheduleDrums(ctx, gain, sections, secPerTick, startTime) {
  const beatDur = TPQN * secPerTick;
  const noiseBuffer = createNoiseBuffer(ctx, 0.3);
  let time = startTime;
  const totalMeasures = sections.reduce((a, s) => a + s.measures, 0);

  for (let m = 0; m < totalMeasures; m++) {
    for (let beat = 0; beat < 4; beat++) {
      if (stopRequested) return;
      const t = time + m * 4 * beatDur + beat * beatDur;

      // Kick: sine wave with pitch drop
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = "sine";
      kickOsc.frequency.setValueAtTime(150, t);
      kickOsc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
      kickGain.gain.setValueAtTime(1, t);
      kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      kickOsc.connect(kickGain);
      kickGain.connect(gain);
      kickOsc.start(t);
      kickOsc.stop(t + 0.12);

      // Snare on beats 2 and 4
      if (beat === 1 || beat === 3) {
        // Snare body: triangle oscillator
        const snareOsc = ctx.createOscillator();
        const snareOscGain = ctx.createGain();
        snareOsc.type = "triangle";
        snareOsc.frequency.value = 200;
        snareOscGain.gain.setValueAtTime(0.7, t);
        snareOscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        snareOsc.connect(snareOscGain);
        snareOscGain.connect(gain);
        snareOsc.start(t);
        snareOsc.stop(t + 0.1);

        // Snare noise
        const snareNoise = ctx.createBufferSource();
        const snareFilter = ctx.createBiquadFilter();
        const snareNoiseGain = ctx.createGain();
        snareNoise.buffer = noiseBuffer;
        snareFilter.type = "bandpass";
        snareFilter.frequency.value = 3000;
        snareNoiseGain.gain.setValueAtTime(0.8, t);
        snareNoiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        snareNoise.connect(snareFilter);
        snareFilter.connect(snareNoiseGain);
        snareNoiseGain.connect(gain);
        snareNoise.start(t);
        snareNoise.stop(t + 0.15);
      }

      // Hi-hat: 8th notes
      for (let sub = 0; sub < 2; sub++) {
        const ht = t + sub * (beatDur / 2);
        const hhNoise = ctx.createBufferSource();
        const hhFilter = ctx.createBiquadFilter();
        const hhGain = ctx.createGain();
        hhNoise.buffer = noiseBuffer;
        hhFilter.type = "highpass";
        hhFilter.frequency.value = 8000;
        const vol = sub === 0 ? 0.5 : 0.3;
        hhGain.gain.setValueAtTime(vol, ht);
        hhGain.gain.exponentialRampToValueAtTime(0.01, ht + 0.05);
        hhNoise.connect(hhFilter);
        hhFilter.connect(hhGain);
        hhGain.connect(gain);
        hhNoise.start(ht);
        hhNoise.stop(ht + 0.08);
      }
    }
  }
}

export async function playPreview(melody, bpm, sections, progId, onProgress = null) {
  stopPreview();
  stopRequested = false;

  const ctx = new AudioContext();
  currentCtx = ctx;

  const secPerTick = 60 / (bpm * TPQN);
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(ctx.destination);

  // Per-track gain nodes
  const melodyGain = ctx.createGain();
  melodyGain.gain.value = 0.15;
  melodyGain.connect(masterGain);

  const bassGain = ctx.createGain();
  bassGain.gain.value = 0.10;
  bassGain.connect(masterGain);

  const chordGain = ctx.createGain();
  chordGain.gain.value = 0.06;
  chordGain.connect(masterGain);

  const drumGain = ctx.createGain();
  drumGain.gain.value = 0.08;
  drumGain.connect(masterGain);

  const startTime = ctx.currentTime + 0.05;
  let time = startTime;
  const events = [];

  for (const n of melody) {
    const duration = n.length * secPerTick;
    if (n.type === "note" && n.lyric !== "-") {
      events.push({ time, noteNum: n.noteNum, duration, section: n.section });
    }
    time += duration;
  }

  const totalDuration = time - ctx.currentTime;

  // Schedule all tracks
  scheduleMelody(ctx, melodyGain, events);
  scheduleBass(ctx, bassGain, sections, progId, secPerTick, startTime);
  scheduleChords(ctx, chordGain, sections, progId, secPerTick, startTime);
  scheduleDrums(ctx, drumGain, sections, secPerTick, startTime);

  // 進捗コールバック
  if (onProgress) {
    const progressStart = ctx.currentTime;
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (stopRequested || !currentCtx || currentCtx !== ctx) {
        clearInterval(progressInterval);
        progressInterval = null;
        onProgress(1);
        return;
      }
      const progress = Math.min(1, (ctx.currentTime - progressStart) / totalDuration);
      onProgress(progress);
      if (progress >= 1) {
        clearInterval(progressInterval);
        progressInterval = null;
        stopPreview();
      }
    }, 100);
  }

  // 自動停止
  setTimeout(() => {
    if (currentCtx === ctx) stopPreview();
  }, totalDuration * 1000 + 500);
}
