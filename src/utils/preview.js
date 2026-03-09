import { TPQN } from "../constants.js";

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

export async function playPreview(melody, bpm, onProgress = null) {
  stopPreview();
  stopRequested = false;

  const ctx = new AudioContext();
  currentCtx = ctx;

  const secPerTick = 60 / (bpm * TPQN);
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.15;
  masterGain.connect(ctx.destination);

  let time = ctx.currentTime + 0.05;
  const events = [];

  for (const n of melody) {
    const duration = n.length * secPerTick;
    if (n.type === "note" && n.lyric !== "-") {
      events.push({ time, noteNum: n.noteNum, duration, section: n.section });
    }
    time += duration;
  }

  const totalDuration = time - ctx.currentTime;

  for (const ev of events) {
    if (stopRequested) break;

    const freq = 440 * Math.pow(2, (ev.noteNum - 69) / 12);
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = ev.section === "chorus" ? "square" : "triangle";
    osc.frequency.value = freq;

    // ADSR envelope
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
    noteGain.connect(masterGain);
    osc.start(ev.time);
    osc.stop(ev.time + ev.duration + 0.01);
  }

  // 進捗コールバック
  if (onProgress) {
    const startTime = ctx.currentTime;
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (stopRequested || !currentCtx || currentCtx !== ctx) {
        clearInterval(progressInterval);
        progressInterval = null;
        onProgress(1);
        return;
      }
      const progress = Math.min(1, (ctx.currentTime - startTime) / totalDuration);
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
