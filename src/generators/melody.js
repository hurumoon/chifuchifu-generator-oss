import { KEYS, CHORD_DEFS, PROGRESSIONS, TPQN, RHYTHM_PATTERNS } from "../constants.js";
import { splitSyllables } from "../utils/syllable.js";

function findNearestScaleIdx(scale, target, low, high) {
  let bestIdx = low;
  let bestDist = 999;
  for (let i = low; i <= Math.min(high, scale.length - 1); i++) {
    const dist = Math.abs(scale[i] - target);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

export function generateMelody(sections, progId, rhythmId = "even", seed = 42, opts = {}) {
  const { vocalRange: vocalRangeOpt = null, leapiness: leapinessOpt = null } = opts;
  const useAutoLeap = leapinessOpt === null;
  const leapFactor = useAutoLeap ? 0 : leapinessOpt / 100; // 0.0(なだらか) ~ 1.0(跳躍)
  const prog = PROGRESSIONS[progId];
  const allNotes = [];
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0x7FFFFFFF; return (seed / 0x7FFFFFFF); };

  const rangeForType = (type, label) => {
    if (label && label.includes("落ち")) return { low: 6, high: 10, startIdx: 7 };
    switch(type) {
      case "A": return { low: 7, high: 11, startIdx: 8 };
      case "B": return { low: 5, high: 11, startIdx: 7 };
      case "chorus": return { low: 8, high: 11, startIdx: 9 };
      case "bridge": return { low: 7, high: 11, startIdx: 8 };
      case "serif": return { low: 5, high: 9, startIdx: 6 };
      default: return null;
    }
  };

  const chorusMelodyCache = new Map();
  let prevSectionLastMidi = null;

  const MUSICAL_LENGTHS = [240, 480, 720, 960, 1440, 1920];
  const quantize = (len) => {
    if (len <= 0) return 240;
    if (len > 1920) return Math.max(240, Math.round(len / 240) * 240);
    let best = MUSICAL_LENGTHS[0], bestDist = Math.abs(len - best);
    for (const ml of MUSICAL_LENGTHS) {
      const dist = Math.abs(len - ml);
      if (dist < bestDist) { best = ml; bestDist = dist; }
    }
    return best;
  };

  const emitNote = (syl, noteNum, length, sectionType) => {
    length = quantize(length);
    const pitchOffset = syl.pitchOffset || 0;
    const adjustedNote = noteNum + pitchOffset;
    if (syl.longNote) {
      const firstLen = Math.floor(length * 0.6);
      const secondLen = length - firstLen;
      allNotes.push({
        type: "note", noteNum: adjustedNote, lyric: syl.text, length: firstLen, section: sectionType,
        intensity: syl.intensity, modulation: syl.vibrato ? 80 : 0,
        vibrato: false, shakuri: syl.shakuri, shakuriDepth: syl.shakuriDepth,
        fall: false, fallDepth: syl.fallDepth,
        accent: syl.accent, serif: syl.serif, tension: syl.tension, dynamics: syl.dynamics,
        wordStart: syl.wordStart,
        singer: syl.singer || null, pitchOffset,
      });
      allNotes.push({
        type: "note", noteNum: adjustedNote, lyric: "-", length: secondLen, section: sectionType,
        intensity: syl.intensity, modulation: syl.vibrato ? 80 : 0,
        vibrato: syl.vibrato, shakuri: false, fall: syl.fall, fallDepth: syl.fallDepth,
        accent: false, serif: syl.serif, tension: false, dynamics: syl.dynamics,
        singer: syl.singer || null, pitchOffset,
      });
    } else {
      allNotes.push({
        type: "note", noteNum: adjustedNote, lyric: syl.text, length, section: sectionType,
        intensity: syl.intensity, modulation: syl.vibrato ? 80 : 0,
        vibrato: syl.vibrato, shakuri: syl.shakuri, shakuriDepth: syl.shakuriDepth,
        fall: syl.fall, fallDepth: syl.fallDepth,
        accent: syl.accent, serif: syl.serif, tension: syl.tension, dynamics: syl.dynamics,
        wordStart: syl.wordStart,
        singer: syl.singer || null, pitchOffset,
      });
    }
  };

  const vocalSections = sections.filter(s => ["A", "B", "chorus", "bridge", "serif"].includes(s.type));
  const vocalSectionCount = vocalSections.length;

  for (let secIdx = 0; secIdx < sections.length; secIdx++) {
    const section = sections[secIdx];
    const sectionKeyId = section.keyId;
    const key = KEYS[sectionKeyId];
    if (!key) {
      for (let m = 0; m < section.measures; m++)
        allNotes.push({ type: "rest", length: TPQN * 4, section: section.type });
      continue;
    }
    const chordNames = section.customChords && section.customChords.length > 0
      ? section.customChords
      : prog.chords[sectionKeyId];
    if (!chordNames) {
      for (let m = 0; m < section.measures; m++)
        allNotes.push({ type: "rest", length: TPQN * 4, section: section.type });
      continue;
    }
    const chordDefs = CHORD_DEFS[sectionKeyId];
    const scale = key.scale;

    const range = rangeForType(section.type, section.label);
    if (!range) {
      for (let m = 0; m < section.measures; m++)
        allNotes.push({ type: "rest", length: TPQN * 4, section: section.type });
      continue;
    }

    // M7: セクション順序に応じた音域中心の動的調整
    const vocalIdx = vocalSections.indexOf(section);
    if (vocalIdx >= 0 && vocalSectionCount > 1) {
      const progress = vocalIdx / (vocalSectionCount - 1); // 0.0 ~ 1.0
      // 曲の中盤(サビ前後)で高く、冒頭・末尾でやや低く
      const curve = Math.sin(progress * Math.PI); // 0→1→0の山型
      const shift = Math.round((curve - 0.5) * 2); // -1 ~ +1
      range.low = Math.max(0, range.low + shift);
      range.high = Math.min(scale.length - 1, range.high + shift);
      range.startIdx = Math.max(range.low, Math.min(range.high, range.startIdx + shift));
    }

    // 音域制限: vocalRangeOptが指定されていればscaleインデックスを絞る
    if (vocalRangeOpt) {
      let vrLow = 0, vrHigh = scale.length - 1;
      for (let i = 0; i < scale.length; i++) {
        if (scale[i] < vocalRangeOpt.min) vrLow = i + 1;
        if (scale[i] <= vocalRangeOpt.max) vrHigh = i;
      }
      vrLow = Math.min(vrLow, scale.length - 1);
      vrHigh = Math.max(vrLow, vrHigh);
      range.low = Math.max(range.low, vrLow);
      range.high = Math.min(range.high, vrHigh);
      range.startIdx = Math.max(range.low, Math.min(range.high, range.startIdx));
    }

    const effHigh = Math.min(range.high, scale.length - 1);
    const effLow = Math.min(range.low, effHigh);
    const isChorus = section.type === "chorus";

    const allSyllables = splitSyllables(section.lyrics, true);
    if (section.type === "serif") {
      for (const syl of allSyllables) { if (!syl.breath && !syl.phraseBreak) syl.serif = true; }
    }

    // D1: noteHintが指定されている場合、自動生成をスキップして直接音程を使用
    if (section.noteHint && Array.isArray(section.noteHint) && section.noteHint.length > 0) {
      const hintLen = section.noteHint.length;
      const hasDurHint = Array.isArray(section.durationHint) && section.durationHint.length > 0;
      const hasLyricHint = Array.isArray(section.lyricHint) && section.lyricHint.length > 0;
      const hasRestHint = Array.isArray(section.restHint) && section.restHint.length > 0;

      // lyricHint+durationHint が揃っている場合: splitSyllablesをバイパスして直接生成
      if (hasLyricHint && hasDurHint) {
        const hasSingerHint = Array.isArray(section.singerHint) && section.singerHint.length > 0;
        // 歌詞からシンガー情報を取得（singerHintがない場合のフォールバック）
        let lyricsBasedSinger = null;
        let lyricsBasedPitchOffset = 0;
        if (!hasSingerHint && section.lyrics) {
          const singerTagMatch = section.lyrics.match(/^\[([^\d+\-]+)([+\-]\d+)?\]/);
          if (singerTagMatch) {
            lyricsBasedSinger = singerTagMatch[1];
            lyricsBasedPitchOffset = singerTagMatch[2] ? parseInt(singerTagMatch[2]) : 0;
          }
        }

        const restMap = new Map();
        if (hasRestHint) {
          for (const r of section.restHint) {
            if (!restMap.has(r.beforeIndex)) restMap.set(r.beforeIndex, 0);
            restMap.set(r.beforeIndex, restMap.get(r.beforeIndex) + r.length);
          }
        }
        for (let vi = 0; vi < hintLen; vi++) {
          // このノートの前に休符があれば挿入
          if (restMap.has(vi)) {
            allNotes.push({ type: "rest", length: restMap.get(vi), section: section.type });
          }
          const lyric = section.lyricHint[vi] || "あ";
          const len = section.durationHint[vi] || TPQN;

          // 「っ」(促音) はノートを生成せず、直前のノートの duration に加算
          if (lyric === "っ") {
            const lastNote = allNotes.length > 0 ? allNotes[allNotes.length - 1] : null;
            if (lastNote && lastNote.type === "note") {
              lastNote.length += len;
            }
            continue;
          }

          const singer = hasSingerHint ? (section.singerHint[vi] || null) : lyricsBasedSinger;
          const pitchOffset = hasSingerHint ? 0 : lyricsBasedPitchOffset;
          const noteNum = section.noteHint[vi] + pitchOffset;
          allNotes.push({
            type: "note", noteNum, lyric, length: len, section: section.type,
            intensity: 100, modulation: 0, vibrato: false,
            shakuri: false, shakuriDepth: 2, fall: false, fallDepth: 2,
            accent: false, serif: false, tension: false, dynamics: null,
            wordStart: true,
            singer, pitchOffset,
          });
        }
        // 末尾の休符
        if (restMap.has(hintLen)) {
          allNotes.push({ type: "rest", length: restMap.get(hintLen), section: section.type });
        }
        if (hintLen > 0) {
          prevSectionLastMidi = section.noteHint[hintLen - 1];
        }
        continue;
      }

      // 従来のnoteHintパス (lyricHintなし: splitSyllablesベース)
      const vocalSylls = allSyllables.filter(s => !s.breath && !s.phraseBreak);
      const measuresTotal = section.measures;
      const ticksPerMeasure = TPQN * 4;
      const totalTicks = measuresTotal * ticksPerMeasure;
      const perNoteTicks = vocalSylls.length > 0 ? Math.floor(totalTicks / vocalSylls.length) : ticksPerMeasure;

      let vi = 0;
      let emittedTicks = 0;
      for (const syl of allSyllables) {
        if (syl.phraseBreak) continue;
        if (syl.breath) {
          const bLen = hasDurHint
            ? Math.round((syl.breathBeats || 1) * TPQN)
            : quantize(Math.round((syl.breathBeats || 1) * TPQN));
          allNotes.push({ type: "rest", length: bLen, section: section.type });
          emittedTicks += bLen;
          continue;
        }
        const noteNum = vi < hintLen ? section.noteHint[vi] : section.noteHint[hintLen - 1];
        let len;
        if (hasDurHint && vi < section.durationHint.length) {
          len = section.durationHint[vi];
        } else {
          const isLast = vi === vocalSylls.length - 1;
          len = isLast ? quantize(perNoteTicks * 1.5) : quantize(perNoteTicks);
        }
        emitNote(syl, noteNum, len, section.type);
        emittedTicks += len;
        vi++;
      }
      // durationHintの合計がセクション長に満たない場合、残りをrestで埋める
      if (hasDurHint) {
        const expectedTicks = section.measures * TPQN * 4;
        const remainder = expectedTicks - emittedTicks;
        if (remainder >= TPQN / 4) {
          allNotes.push({ type: "rest", length: remainder, section: section.type });
        }
      }
      if (vi > 0) {
        prevSectionLastMidi = section.noteHint[Math.min(vi - 1, hintLen - 1)];
      }
      continue;
    }

    const phrases = [];
    let currentPhrase = [];
    for (const syl of allSyllables) {
      if (syl.phraseBreak) {
        if (currentPhrase.length > 0) phrases.push(currentPhrase);
        currentPhrase = [];
      } else {
        currentPhrase.push(syl);
      }
    }
    if (currentPhrase.length > 0) phrases.push(currentPhrase);

    if (phrases.length === 0 || phrases.every(p => p.filter(s => !s.breath).length === 0)) {
      for (let m = 0; m < section.measures; m++)
        allNotes.push({ type: "rest", length: TPQN * 4, section: section.type });
      continue;
    }

    const phraseVocalCounts = phrases.map(p => p.filter(s => !s.breath).length);
    const totalVocalSylls = phraseVocalCounts.reduce((a, b) => a + b, 0);
    let remainMeasures = section.measures;
    const phraseMeasures = [];
    for (let pi = 0; pi < phrases.length; pi++) {
      if (pi === phrases.length - 1) {
        phraseMeasures.push(Math.max(1, remainMeasures));
      } else {
        const m = Math.max(1, Math.round((phraseVocalCounts[pi] / Math.max(1, totalVocalSylls)) * section.measures));
        phraseMeasures.push(m);
        remainMeasures -= m;
      }
    }

    let cachedPitches = null;
    if (isChorus) {
      const labelPfx = section.label.replace(/[0-9０-９]+$/, "").replace(/（.*）$/, "");
      const cacheKey = `${labelPfx}_${totalVocalSylls}`;
      cachedPitches = chorusMelodyCache.get(cacheKey) || null;
    }

    let prevScaleIdx;
    if (prevSectionLastMidi !== null) {
      let bestIdx = range.startIdx, bestDist = 999;
      for (let si = effLow; si <= effHigh; si++) {
        const dist = Math.abs(scale[si] - prevSectionLastMidi);
        if (dist < bestDist) { bestDist = dist; bestIdx = si; }
      }
      if (bestDist > 5) {
        const dir = scale[bestIdx] > prevSectionLastMidi ? -1 : 1;
        for (let si = bestIdx + dir; si >= effLow && si <= effHigh; si += dir) {
          if (Math.abs(scale[si] - prevSectionLastMidi) <= 5) { bestIdx = si; break; }
        }
      }
      prevScaleIdx = bestIdx;
    } else {
      prevScaleIdx = range.startIdx;
    }
    let lastLeapDir = 0;
    let motifIntervals = null;
    let globalMeasureIdx = 0;
    const sectionPitches = [];

    for (let phraseIdx = 0; phraseIdx < phrases.length; phraseIdx++) {
      const phrase = phrases[phraseIdx];
      const measuresForPhrase = phraseMeasures[phraseIdx];
      const vocalSylls = phrase.filter(s => !s.breath);

      if (vocalSylls.length === 0) {
        for (let m = 0; m < measuresForPhrase; m++)
          allNotes.push({ type: "rest", length: TPQN * 4, section: section.type });
        globalMeasureIdx += measuresForPhrase;
        continue;
      }

      const pitchSeq = [];

      const firstChordName = chordNames[globalMeasureIdx % chordNames.length];
      const firstChordTones = chordDefs[firstChordName] || [60, 64, 67];
      let startIdx;
      if (phraseIdx === 0) {
        startIdx = findNearestScaleIdx(scale, firstChordTones[0], effLow, effHigh);
      } else {
        const candidates = firstChordTones.map(ct => findNearestScaleIdx(scale, ct, effLow, effHigh));
        startIdx = candidates.reduce((best, idx) =>
          Math.abs(idx - prevScaleIdx) < Math.abs(best - prevScaleIdx) ? idx : best
        , candidates[0]);
      }
      prevScaleIdx = startIdx;
      lastLeapDir = 0;

      const useMotif = motifIntervals && phraseIdx > 0 && (phraseIdx % 4 !== 2);
      const useCached = cachedPitches !== null;
      const cachedOffset = phraseVocalCounts.slice(0, phraseIdx).reduce((a, b) => a + b, 0);

      for (let vi = 0; vi < vocalSylls.length; vi++) {
        const syl = vocalSylls[vi];
        const syllsPerMeasure = Math.max(1, Math.ceil(vocalSylls.length / measuresForPhrase));
        const localMeasure = Math.min(measuresForPhrase - 1, Math.floor(vi / syllsPerMeasure));
        const gMeasure = globalMeasureIdx + localMeasure;
        const beatPos = vi % syllsPerMeasure;
        const isStrongBeat = beatPos === 0 || (syllsPerMeasure >= 4 && beatPos === Math.floor(syllsPerMeasure / 2));

        const chordName = chordNames[gMeasure % chordNames.length];
        const chordTones = chordDefs[chordName] || [60, 64, 67];

        let targetIdx;

        if (vi === 0) {
          targetIdx = startIdx;
        } else if (useCached && cachedOffset + vi < cachedPitches.length) {
          targetIdx = cachedPitches[cachedOffset + vi];
          targetIdx = Math.max(effLow, Math.min(effHigh, targetIdx));
        } else if (vi === vocalSylls.length - 1) {
          const searchLow = Math.max(effLow, prevScaleIdx - 3);
          const searchHigh = Math.min(effHigh, prevScaleIdx + 3);
          const candidates = chordTones.map(ct => findNearestScaleIdx(scale, ct, searchLow, searchHigh));
          targetIdx = candidates.reduce((best, idx) =>
            Math.abs(idx - prevScaleIdx) < Math.abs(best - prevScaleIdx) ? idx : best
          , candidates[0]);
        } else if (useMotif && vi - 1 < motifIntervals.length) {
          let interval = motifIntervals[vi - 1];
          if (phraseIdx % 2 === 1 && rand() < 0.25) {
            interval += rand() < 0.5 ? 1 : -1;
          }
          targetIdx = prevScaleIdx + interval;
          targetIdx = Math.max(effLow, Math.min(effHigh, targetIdx));
        } else if (syl.serif) {
          targetIdx = prevScaleIdx;
          if (vi >= vocalSylls.length - 2) {
            const endText = vocalSylls.slice(vi).map(s => s.text).join("");
            const isQuestion = /[？\?]/.test(endText) || endText.includes("だれ") || endText.includes("の");
            targetIdx = prevScaleIdx + (isQuestion ? 1 : -1);
          } else if (rand() < 0.15) {
            targetIdx = prevScaleIdx + (rand() < 0.5 ? 1 : -1);
          }
          targetIdx = Math.max(effLow, Math.min(effHigh, targetIdx));
        } else {
          const recentSame = (() => {
            let count = 0;
            for (let k = pitchSeq.length - 1; k >= 0; k--) {
              if (pitchSeq[k] === prevScaleIdx) count++;
              else break;
            }
            return count;
          })();
          const phraseProgress = vocalSylls.length > 1 ? vi / (vocalSylls.length - 1) : 0.5;
          const archBias = phraseProgress < 0.5
            ? Math.round(phraseProgress * 2)
            : Math.round((1 - phraseProgress) * 2) - 1;

          // 跳躍感パラメータに基づく探索半径（自動時は元のハードコード値）
          const leapSearchRadius = useAutoLeap ? 4 : Math.round(2 + leapFactor * 4); // auto:4, manual:2〜6
          const stepSearchRadius = useAutoLeap ? 2 : Math.round(1 + leapFactor * 2); // auto:2, manual:1〜3

          if (lastLeapDir !== 0) {
            const correction = lastLeapDir > 0 ? -1 : 1;
            targetIdx = prevScaleIdx + correction;
            lastLeapDir = 0;
          } else if (recentSame < 2 && rand() < (useAutoLeap ? 0.15 : 0.15 * (1 - leapFactor))) {
            targetIdx = prevScaleIdx;
          } else if (isStrongBeat && rand() < 0.7) {
            const candidates = chordTones.map(ct => findNearestScaleIdx(scale, ct,
              Math.max(effLow, prevScaleIdx - leapSearchRadius), Math.min(effHigh, prevScaleIdx + leapSearchRadius)));
            targetIdx = candidates.reduce((best, idx) =>
              Math.abs(idx - prevScaleIdx) < Math.abs(best - prevScaleIdx) ? idx : best
            , candidates[0]);
            const chordLeap = targetIdx - prevScaleIdx;
            if (Math.abs(chordLeap) >= 3) lastLeapDir = chordLeap > 0 ? 1 : -1;
          } else if (!isStrongBeat && rand() < 0.3) {
            const candidates = chordTones.map(ct => findNearestScaleIdx(scale, ct,
              Math.max(effLow, prevScaleIdx - stepSearchRadius), Math.min(effHigh, prevScaleIdx + stepSearchRadius)));
            targetIdx = candidates.reduce((best, idx) =>
              Math.abs(idx - prevScaleIdx) < Math.abs(best - prevScaleIdx) ? idx : best
            , candidates[0]);
          } else {
            const allowLeap = useAutoLeap
              ? (isChorus && isStrongBeat && rand() < 0.2)
              : (isChorus && isStrongBeat && rand() < 0.2) || rand() < leapFactor * 0.3;
            const maxStep = useAutoLeap
              ? (allowLeap ? 2 : 1)
              : (allowLeap ? Math.round(2 + leapFactor * 2) : Math.max(1, Math.round(1 + leapFactor)));
            let step = Math.floor(rand() * (maxStep * 2 + 1)) - maxStep;
            if (step === 0 && archBias !== 0 && rand() < 0.5) step = archBias;
            targetIdx = prevScaleIdx + step;
            if (Math.abs(step) >= 2) lastLeapDir = step > 0 ? 1 : -1;
          }

          if (section.type === "B") {
            const progress = vi / Math.max(1, vocalSylls.length - 1);
            const dynLow = Math.floor(effLow + progress * 2);
            targetIdx = Math.max(dynLow, targetIdx);
          }

          targetIdx = Math.max(effLow, Math.min(effHigh, targetIdx));
        }

        if (vi > 0) {
          const prevMidi = scale[Math.max(0, Math.min(scale.length - 1, prevScaleIdx))];
          const nextMidi = scale[Math.max(0, Math.min(scale.length - 1, targetIdx))];
          const interval = Math.abs(nextMidi - prevMidi);
          const maxInterval = useAutoLeap ? 5 : Math.round(5 + leapFactor * 7); // auto:5, manual:5〜12
          if (interval > maxInterval) {
            const dir = targetIdx > prevScaleIdx ? 1 : -1;
            let safeIdx = prevScaleIdx;
            for (let s = prevScaleIdx + dir; s >= effLow && s <= effHigh; s += dir) {
              if (Math.abs(scale[s] - prevMidi) <= maxInterval) safeIdx = s;
              else break;
            }
            targetIdx = safeIdx;
          }
        }

        pitchSeq.push(targetIdx);
        sectionPitches.push(targetIdx);
        prevScaleIdx = targetIdx;
      }

      if (phraseIdx === 0 && !motifIntervals) {
        motifIntervals = [];
        for (let i = 1; i < pitchSeq.length; i++) {
          motifIntervals.push(pitchSeq[i] - pitchSeq[i - 1]);
        }
      }

      let phraseAllSyllIdx = 0;
      let phraseVocalIdx = 0;

      for (let m = 0; m < measuresForPhrase; m++) {
        const syllsPerMeasure = Math.ceil(vocalSylls.length / measuresForPhrase);
        const target = Math.min(syllsPerMeasure, vocalSylls.length - phraseVocalIdx);

        if (target <= 0) {
          allNotes.push({ type: "rest", length: TPQN * 4, section: section.type });
          continue;
        }

        const measureSylls = [];
        let collected = 0;
        while (collected < target && phraseAllSyllIdx < phrase.length) {
          const syl = phrase[phraseAllSyllIdx++];
          measureSylls.push(syl);
          if (!syl.breath) collected++;
        }

        const vocalInMeasure = measureSylls.filter(s => !s.breath);
        const breathLengths = measureSylls.filter(s => s.breath).map(s => quantize(Math.round((s.breathBeats || 1) * TPQN)));
        const totalBreathLength = breathLengths.reduce((a, b) => a + b, 0);
        const availableLength = Math.max(TPQN, TPQN * 4 - totalBreathLength);
        const n = vocalInMeasure.length;

        let noteLengths;
        if (n === 0) {
          noteLengths = [];
        } else {
          const rhythmWeights = RHYTHM_PATTERNS[rhythmId]?.weights;
          const isLastMeasureOfPhrase = (m === measuresForPhrase - 1);

          if (!rhythmWeights) {
            const phraseEndLen = isLastMeasureOfPhrase ? TPQN * 2 : TPQN;
            const lastSyl = vocalInMeasure[n - 1];
            const endLen = (isLastMeasureOfPhrase && lastSyl && lastSyl.longNote) ? TPQN * 4 : phraseEndLen;

            if (n === 1) {
              noteLengths = [availableLength];
            } else {
              const reservedEnd = Math.min(endLen, Math.floor(availableLength * 0.6));
              const remainForOthers = availableLength - reservedEnd;
              const perNote = Math.max(TPQN / 2, Math.floor(remainForOthers / (n - 1)));
              noteLengths = vocalInMeasure.map((_, i) => {
                if (i === n - 1) return reservedEnd;
                return perNote;
              });
            }
            const total = noteLengths.reduce((a, b) => a + b, 0);
            if (total < availableLength) {
              const extra = Math.floor((availableLength - total) / Math.max(1, n - 1));
              noteLengths = noteLengths.map((l, i) => i < n - 1 ? l + extra : l);
            } else if (total > availableLength) {
              const ratio = availableLength / total;
              noteLengths = noteLengths.map(l => Math.max(TPQN / 2, Math.round(l * ratio)));
            }
          } else {
            const rawWeights = vocalInMeasure.map((_, i) => {
              let w = rhythmWeights[i % rhythmWeights.length];
              if (isLastMeasureOfPhrase && i === n - 1) w *= 2;
              return w;
            });
            const totalWeight = rawWeights.reduce((a, b) => a + b, 0);
            noteLengths = rawWeights.map(w => quantize(Math.round((w / totalWeight) * availableLength)));
          }
        }

        const longIndices = [];
        for (let li = 0; li < vocalInMeasure.length; li++) {
          if (vocalInMeasure[li].longNote) longIndices.push(li);
        }
        if (longIndices.length > 0) {
          const nonLongIndices = [];
          for (let li = 0; li < vocalInMeasure.length; li++) {
            if (!vocalInMeasure[li].longNote) nonLongIndices.push(li);
          }
          for (const li of longIndices) {
            const extra = Math.floor(noteLengths[li] * 0.5);
            if (nonLongIndices.length > 0) {
              const stealEach = Math.floor(extra / nonLongIndices.length);
              let stolen = 0;
              for (const ni of nonLongIndices) {
                const take = Math.min(stealEach, noteLengths[ni] - TPQN / 4);
                if (take > 0) { noteLengths[ni] -= take; stolen += take; }
              }
              noteLengths[li] += stolen;
            } else {
              noteLengths[li] = Math.floor(noteLengths[li] * 1.5);
            }
          }
        }

        let localVocalIdx = 0;
        let breathIdx = 0;
        let usedLength = 0;

        for (const syl of measureSylls) {
          if (syl.breath) {
            const bLen = breathLengths[breathIdx] || TPQN;
            allNotes.push({ type: "rest", length: bLen, section: section.type });
            breathIdx++;
            usedLength += bLen;
            continue;
          }

          const scaleIdx = pitchSeq[phraseVocalIdx];
          const noteNum = scale[Math.max(0, Math.min(scale.length - 1, scaleIdx))];
          const thisLength = noteLengths[localVocalIdx] || TPQN;

          emitNote(syl, noteNum, thisLength, section.type);
          usedLength += thisLength;

          phraseVocalIdx++;
          localVocalIdx++;
        }

        const remainder = (TPQN * 4) - usedLength;
        if (remainder >= TPQN / 4) {
          allNotes.push({ type: "rest", length: remainder, section: section.type });
        } else if (remainder > 0 && allNotes.length > 0) {
          allNotes[allNotes.length - 1].length += remainder;
        }
      }

      while (phraseVocalIdx < vocalSylls.length && phraseAllSyllIdx < phrase.length) {
        const syl = phrase[phraseAllSyllIdx++];
        if (syl.breath) {
          allNotes.push({ type: "rest", length: TPQN, section: section.type });
          continue;
        }
        const scaleIdx = pitchSeq[phraseVocalIdx];
        const noteNum = scale[Math.max(0, Math.min(scale.length - 1, scaleIdx))];
        emitNote(syl, noteNum, TPQN, section.type);
        phraseVocalIdx++;
      }

      globalMeasureIdx += measuresForPhrase;
    }

    if (isChorus && !cachedPitches && sectionPitches.length > 0) {
      const labelPfx = section.label.replace(/[0-9０-９]+$/, "").replace(/（.*）$/, "");
      const cacheKey = `${labelPfx}_${totalVocalSylls}`;
      chorusMelodyCache.set(cacheKey, [...sectionPitches]);
    }

    if (sectionPitches.length > 0) {
      const lastIdx = sectionPitches[sectionPitches.length - 1];
      prevSectionLastMidi = scale[Math.max(0, Math.min(scale.length - 1, lastIdx))];
    }
  }

  const filtered = [];
  for (let i = 0; i < allNotes.length; i++) {
    const n = allNotes[i];
    if (n.type === "rest" && n.length < 120) {
      if (filtered.length > 0) {
        filtered[filtered.length - 1].length += n.length;
      }
    } else {
      filtered.push(n);
    }
  }

  return filtered;
}
