/**
 * SVP ラウンドトリップ検証スクリプト
 * 使い方: node test-roundtrip.mjs [svpファイルパス] [trackIndex]
 *
 * 検証フロー2つ:
 *   A) 直接: SVP → parseSVP → melody → generateSVP → parseSVP → 比較
 *   B) JSON経由: SVP → svpToProjectJSON → generateMelody(noteHint+durationHint) → generateSVP → parseSVP → 比較
 */
import { readFileSync, writeFileSync } from "fs";
import { parseSVP, compareRoundTrip, svpToProjectJSON } from "./src/generators/svp-import.js";
import { generateSVP } from "./src/generators/svp.js";
import { generateMelody } from "./src/generators/melody.js";

const svpPath = process.argv[2] || "HanaNiNatte_raidergale_tunedSV1.svp";
const trackIndex = parseInt(process.argv[3] || "0", 10);

console.log(`=== SVP Round-Trip Test ===`);
console.log(`File: ${svpPath}`);
console.log(`Track: ${trackIndex}`);

// 元SVPを読み込み
const originalSvp = readFileSync(svpPath, "utf-8");

// ============================================================
// A) 直接ラウンドトリップ: SVP → melody → SVP
// ============================================================
console.log(`\n${"=".repeat(50)}`);
console.log(`[A] Direct: SVP → parseSVP → melody → generateSVP`);
console.log(`${"=".repeat(50)}`);

const { melody, bpm, trackName } = parseSVP(originalSvp, { trackIndex });
const noteCount = melody.filter(n => n.type === "note").length;
const restCount = melody.filter(n => n.type === "rest").length;
console.log(`Track: "${trackName}", BPM: ${bpm}`);
console.log(`Notes: ${noteCount}, Rests: ${restCount}`);

const reExportedA = generateSVP(melody, bpm, trackName + "_direct");
const resultA = compareRoundTrip(originalSvp, reExportedA, { trackIndex: 0 });
printResult(resultA, "A");

const outA = svpPath.replace(/\.svp$/, "_roundtrip_direct.svp");
writeFileSync(outA, reExportedA);
console.log(`Saved: ${outA}`);

// ============================================================
// B) JSON経由ラウンドトリップ: SVP → projectJSON → melody → SVP
// ============================================================
console.log(`\n${"=".repeat(50)}`);
console.log(`[B] Via JSON: SVP → svpToProjectJSON → generateMelody → generateSVP`);
console.log(`${"=".repeat(50)}`);

const projectJSON = svpToProjectJSON(originalSvp, { trackIndex });
console.log(`Sections: ${projectJSON.sections.length}`);
for (const s of projectJSON.sections) {
  const lyricPreview = s.lyrics.length > 40 ? s.lyrics.slice(0, 40) + "..." : s.lyrics;
  console.log(`  [${s.id}] ${s.label} (${s.measures}m) noteHint:${s.noteHint?.length || 0} durHint:${s.durationHint?.length || 0} "${lyricPreview}"`);
}

// プロジェクトJSON保存
const jsonOut = svpPath.replace(/\.svp$/, "_project.json");
writeFileSync(jsonOut, JSON.stringify(projectJSON, null, 2));
console.log(`Project JSON saved: ${jsonOut}`);

// generateMelody経由でmelody生成
const melodyB = generateMelody(projectJSON.sections, projectJSON.progId, projectJSON.rhythmId, 42);
const noteCountB = melodyB.filter(n => n.type === "note").length;
const restCountB = melodyB.filter(n => n.type === "rest").length;
console.log(`Melody via generateMelody: Notes: ${noteCountB}, Rests: ${restCountB}`);

const reExportedB = generateSVP(melodyB, projectJSON.bpm, trackName + "_viaJSON");
const resultB = compareRoundTrip(originalSvp, reExportedB, { trackIndex: 0 });
printResult(resultB, "B");

const outB = svpPath.replace(/\.svp$/, "_roundtrip_viaJSON.svp");
writeFileSync(outB, reExportedB);
console.log(`Saved: ${outB}`);

// ============================================================
function printResult({ summary, noteComparisons }, label) {
  const total = Math.min(summary.originalNoteCount, summary.reExportedNoteCount);
  console.log(`\n--- [${label}] Results ---`);
  console.log(`Original:    ${summary.originalNoteCount} notes`);
  console.log(`Re-exported: ${summary.reExportedNoteCount} notes`);
  console.log(`Count match: ${summary.noteCountMatch ? "OK" : "MISMATCH"}`);
  console.log(`Pitch:       ${summary.pitchMatches}/${total} (${total > 0 ? ((summary.pitchMatches / total) * 100).toFixed(1) : 0}%)`);
  console.log(`Lyric:       ${summary.lyricMatches}/${total} (${total > 0 ? ((summary.lyricMatches / total) * 100).toFixed(1) : 0}%)`);
  console.log(`Dur diffs:   ${summary.durationDiffs.length} (>10 tick)`);

  if (noteComparisons.length > 0) {
    console.log(`Mismatches (first 15):`);
    for (const c of noteComparisons.slice(0, 15)) {
      const parts = [];
      if (!c.pitchMatch) parts.push(`pitch:${c.original.pitch}→${c.reExported.pitch}`);
      if (!c.lyricMatch) parts.push(`lyric:"${c.original.lyric}"→"${c.reExported.lyric}"`);
      if (c.durationDiff > 10) parts.push(`dur:${c.original.length}→${c.reExported.length}(±${c.durationDiff})`);
      console.log(`  [${c.index}] ${parts.join(", ")}`);
    }
    if (noteComparisons.length > 15) console.log(`  ... +${noteComparisons.length - 15} more`);
  } else {
    console.log(`All notes match perfectly!`);
  }
}
