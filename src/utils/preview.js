import { TPQN, PROGRESSIONS, CHORD_DEFS } from "../constants.js";
import { splitMelodyBySinger } from "./singer.js";

let currentCtx = null;
let stopRequested = false;
let progressInterval = null;
let activeNodes = null;
let schedulerTimer = null;

export function stopPreview() {
  stopRequested = true;
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  activeNodes = null;
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

// イベントデータを構築（AudioNodeは作成しない）
function buildAllEvents(melody, sections, progId, secPerTick, singers = null) {
  const events = [];
  const beatDur = TPQN * secPerTick;
  const measureDur = TPQN * 4 * secPerTick;

  // メロディ（マルチシンガー対応）
  const hasSingers = singers && singers.length > 0;
  if (hasSingers) {
    const singerNames = singers.map(s => s.name);
    const melodyMap = splitMelodyBySinger(melody, singerNames);
    singers.forEach((singer, idx) => {
      const singerMelody = melodyMap.get(singer.name) || [];
      let mTime = 0;
      for (const n of singerMelody) {
        const duration = n.length * secPerTick;
        if (n.type === "note" && n.lyric !== "-") {
          events.push({ track: "melody", relTime: mTime, noteNum: n.noteNum, duration, section: n.section, singerIdx: idx });
        }
        mTime += duration;
      }
    });
  } else {
    let mTime = 0;
    for (const n of melody) {
      const duration = n.length * secPerTick;
      if (n.type === "note" && n.lyric !== "-") {
        events.push({ track: "melody", relTime: mTime, noteNum: n.noteNum, duration, section: n.section, singerIdx: 0 });
      }
      mTime += duration;
    }
  }

  // ベース
  const prog = PROGRESSIONS[progId];
  if (prog) {
    let bTime = 0;
    for (const sec of sections) {
      const chordNames = prog.chords[sec.keyId];
      const chordDefs = CHORD_DEFS[sec.keyId];
      if (!chordNames || !chordDefs) { bTime += sec.measures * 4 * beatDur; continue; }
      for (let m = 0; m < sec.measures; m++) {
        const chordName = chordNames[m % chordNames.length];
        const tones = chordDefs[chordName] || [60, 64, 67];
        const root = tones[0] - 24;
        const fifth = root + 7;
        for (const note of [root, root, fifth, root]) {
          events.push({ track: "bass", relTime: bTime, noteNum: note, duration: beatDur * 0.8 });
          bTime += beatDur;
        }
      }
    }
  }

  // コード
  if (prog) {
    let cTime = 0;
    for (const sec of sections) {
      const chordNames = prog.chords[sec.keyId];
      const chordDefs = CHORD_DEFS[sec.keyId];
      if (!chordNames || !chordDefs) { cTime += sec.measures * measureDur; continue; }
      for (let m = 0; m < sec.measures; m++) {
        const chordName = chordNames[m % chordNames.length];
        const tones = chordDefs[chordName] || [60, 64, 67];
        for (const noteNum of tones) {
          events.push({ track: "chord", relTime: cTime, noteNum, duration: measureDur });
        }
        cTime += measureDur;
      }
    }
  }

  // ドラム
  const totalMeasures = sections.reduce((a, s) => a + s.measures, 0);
  for (let m = 0; m < totalMeasures; m++) {
    for (let beat = 0; beat < 4; beat++) {
      const bt = (m * 4 + beat) * beatDur;
      events.push({ track: "kick", relTime: bt });
      if (beat === 1 || beat === 3) {
        events.push({ track: "snare", relTime: bt });
      }
      for (let sub = 0; sub < 2; sub++) {
        events.push({ track: "hihat", relTime: bt + sub * (beatDur / 2), sub });
      }
    }
  }

  events.sort((a, b) => a.relTime - b.relTime);
  return events;
}

// 個別イベントからAudioNodeを生成
function renderEvent(ctx, ev, gains, noiseBuffer, startTime) {
  const t = ev.relTime + startTime;

  switch (ev.track) {
    case "melody": {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = ev.section === "chorus" ? "square" : "triangle";
      osc.frequency.value = noteToFreq(ev.noteNum);
      // マルチシンガー時: シンガーごとにdetuneで区別
      if (ev.singerIdx > 0) {
        osc.detune.value = ev.singerIdx * 8; // 8cent刻みでずらす
      }
      const attack = 0.02, decay = 0.05, sustain = 0.7;
      const release = Math.min(0.08, ev.duration * 0.2);
      const sustainEnd = t + ev.duration - release;
      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(1, t + attack);
      noteGain.gain.linearRampToValueAtTime(sustain, t + attack + decay);
      noteGain.gain.setValueAtTime(sustain, Math.max(t + attack + decay, sustainEnd));
      noteGain.gain.linearRampToValueAtTime(0, t + ev.duration);
      osc.connect(noteGain);
      noteGain.connect(gains.melodyGain);
      osc.start(t);
      osc.stop(t + ev.duration + 0.01);
      break;
    }
    case "bass": {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.value = noteToFreq(ev.noteNum);
      filter.type = "lowpass";
      filter.frequency.value = 500;
      const noteDur = ev.duration;
      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(1, t + 0.01);
      noteGain.gain.setValueAtTime(1, t + noteDur - 0.05);
      noteGain.gain.linearRampToValueAtTime(0, t + noteDur);
      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(gains.bassGain);
      osc.start(t);
      osc.stop(t + noteDur + 0.01);
      break;
    }
    case "chord": {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = noteToFreq(ev.noteNum);
      const attack = 0.05, release = 0.08, dur = ev.duration;
      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(1, t + attack);
      noteGain.gain.setValueAtTime(1, t + dur - release);
      noteGain.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(noteGain);
      noteGain.connect(gains.chordGain);
      osc.start(t);
      osc.stop(t + dur + 0.01);
      break;
    }
    case "kick": {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.connect(g);
      g.connect(gains.drumGain);
      osc.start(t);
      osc.stop(t + 0.12);
      break;
    }
    case "snare": {
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 200;
      og.gain.setValueAtTime(0.7, t);
      og.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      osc.connect(og);
      og.connect(gains.drumGain);
      osc.start(t);
      osc.stop(t + 0.1);
      const ns = ctx.createBufferSource();
      const nf = ctx.createBiquadFilter();
      const ng = ctx.createGain();
      ns.buffer = noiseBuffer;
      nf.type = "bandpass";
      nf.frequency.value = 3000;
      ng.gain.setValueAtTime(0.8, t);
      ng.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      ns.connect(nf);
      nf.connect(ng);
      ng.connect(gains.drumGain);
      ns.start(t);
      ns.stop(t + 0.15);
      break;
    }
    case "hihat": {
      const ns = ctx.createBufferSource();
      const hf = ctx.createBiquadFilter();
      const hg = ctx.createGain();
      ns.buffer = noiseBuffer;
      hf.type = "highpass";
      hf.frequency.value = 8000;
      const vol = ev.sub === 0 ? 0.5 : 0.3;
      hg.gain.setValueAtTime(vol, t);
      hg.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      ns.connect(hf);
      hf.connect(hg);
      hg.connect(gains.drumGain);
      ns.start(t);
      ns.stop(t + 0.08);
      break;
    }
  }
}

export function playPreview(melody, bpm, sections, progId, onProgress = null, singers = null) {
  stopPreview();
  stopRequested = false;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  currentCtx = ctx;

  // ユーザージェスチャー内で即座にresumeを呼ぶ
  ctx.resume();

  const secPerTick = 60 / (bpm * TPQN);

  // ゲインノード作成（同期、GC防止のため参照保持）
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(ctx.destination);
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
  activeNodes = { masterGain, melodyGain, bassGain, chordGain, drumGain };

  const gains = { melodyGain, bassGain, chordGain, drumGain };

  // イベントデータを事前構築（AudioNode未作成、軽量）
  const allEvents = buildAllEvents(melody, sections, progId, secPerTick, singers);
  const totalMeasures = sections.reduce((a, s) => a + s.measures, 0);
  const audioDuration = totalMeasures * 4 * TPQN * secPerTick;
  const noiseBuffer = createNoiseBuffer(ctx, 0.3);

  // Look-ahead スケジューラ：少しずつAudioNodeを作成
  const LOOKAHEAD = 1.0; // 1秒先まで先読み
  const SCHEDULE_INTERVAL = 200; // 200msごとにチェック
  let nextIdx = 0;
  let startTime = null;

  function scheduleUpcoming() {
    if (stopRequested || currentCtx !== ctx) return;
    if (ctx.state === "suspended") { ctx.resume(); return; }

    // 初回：コンテキスト起動後にstartTimeを確定
    if (startTime === null) {
      startTime = ctx.currentTime + 0.2;
    }

    const horizon = ctx.currentTime + LOOKAHEAD;
    while (nextIdx < allEvents.length && (allEvents[nextIdx].relTime + startTime) < horizon) {
      renderEvent(ctx, allEvents[nextIdx], gains, noiseBuffer, startTime);
      nextIdx++;
    }
  }

  // 即座に1回スケジュール（コンテキストが既にrunningの場合に対応）
  scheduleUpcoming();

  // 定期的に先読みスケジュール
  schedulerTimer = setInterval(scheduleUpcoming, SCHEDULE_INTERVAL);

  // 進捗コールバック
  if (onProgress) {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (stopRequested || !currentCtx || currentCtx !== ctx) {
        clearInterval(progressInterval);
        progressInterval = null;
        onProgress(1);
        return;
      }
      if (ctx.state === "suspended") ctx.resume();
      if (startTime === null) { onProgress(0); return; }
      const elapsed = ctx.currentTime - startTime;
      const progress = Math.max(0, Math.min(1, elapsed / audioDuration));
      onProgress(progress);
      if (progress >= 1) {
        clearInterval(progressInterval);
        progressInterval = null;
        stopPreview();
      }
    }, 100);
  }

  // 自動停止（余裕を持たせる）
  setTimeout(() => {
    if (currentCtx === ctx) stopPreview();
  }, (audioDuration + 2) * 1000);
}
