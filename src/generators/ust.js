import { TPQN, SHAKURI_PRESETS, FALL_PRESETS } from "../constants.js";
import { lyricToPhoneme } from "../utils/phoneme.js";
import { splitMelodyBySinger } from "../utils/singer.js";

/**
 * UST生成
 * @param {Array} melody - メロディ配列
 * @param {number} bpm
 * @param {string} projectName
 * @param {string|null} singerName - マルチシンガー時、出力するシンガー名（nullで全ノート）
 * @param {Array|null} singers - シンガー設定配列
 */
export function generateUST(melody, bpm, projectName = "Generated", singerName = null, singers = null) {
  // シンガー指定時はそのシンガーのメロディだけ抽出
  if (singerName && singers && singers.length > 0) {
    const singerNames = singers.map(s => s.name);
    const melodyMap = splitMelodyBySinger(melody, singerNames);
    melody = melodyMap.get(singerName) || melody;
  }
  let ust = `[#SETTING]\nTempo=${bpm.toFixed(2)}\nTracks=1\nProjectName=${projectName}\nVoiceDir=\nOutFile=output.wav\nCacheDir=cache\nTool1=\nTool2=\nMode2=True\n\n`;
  let noteIdx = 0;
  const lyricList = [];
  const noteIndexMap = new Map();
  let noteCount = 0;
  for (const n of melody) {
    if (n.type === "note") {
      noteIndexMap.set(n, noteCount);
      lyricList.push(n.lyric);
      noteCount++;
    }
  }

  for (const n of melody) {
    const tag = `[#${String(noteIdx).padStart(4, "0")}]`;
    if (n.type === "rest") {
      ust += `${tag}\nLength=${n.length}\nLyric=R\nNoteNum=60\nIntensity=100\nModulation=0\n\n`;
    } else {
      const intensity = n.intensity ?? 100;
      const isLongNote = n.length >= TPQN * 2;
      const modulation = (n.modulation ?? 0) || (isLongNote ? 50 : 0);
      let extra = "";

      if (n.shakuri && n.fall) {
        const sp = SHAKURI_PRESETS[n.shakuriDepth] || SHAKURI_PRESETS[2];
        const fp = FALL_PRESETS[n.fallDepth] || FALL_PRESETS[2];
        extra += `PBS=${sp.pbs}\nPBW=${sp.pbw},${fp.pbw}\nPBY=0,${fp.pby}\n`;
      } else if (n.shakuri) {
        const sp = SHAKURI_PRESETS[n.shakuriDepth] || SHAKURI_PRESETS[2];
        extra += `PBS=${sp.pbs}\nPBW=${sp.pbw}\nPBY=${sp.pby}\n`;
      } else if (n.fall) {
        const fp = FALL_PRESETS[n.fallDepth] || FALL_PRESETS[2];
        extra += `PBS=${fp.pbs}\nPBW=${fp.pbw}\nPBY=${fp.pby}\n`;
      }
      if (n.vibrato) {
        extra += "VBR=65,180,50,20,20,0,0\n";
      } else if (isLongNote) {
        extra += "VBR=65,120,35,15,15,0,0\n";
      }

      const noteListIdx = noteIndexMap.get(n) ?? -1;
      const prevLyric = noteListIdx > 0 ? lyricList[noteListIdx - 1] : null;
      const nextLyric = noteListIdx < lyricList.length - 1 ? lyricList[noteListIdx + 1] : null;
      const phoneme = n.lyric === "-" ? "-" : lyricToPhoneme(n.lyric, prevLyric, nextLyric, n.wordStart);

      ust += `${tag}\nLength=${n.length}\nLyric=${phoneme}\nNoteNum=${n.noteNum}\nIntensity=${intensity}\nModulation=${modulation}\n${extra}\n`;
    }
    noteIdx++;
  }
  ust += "[#TRACKEND]\n";
  return ust;
}
