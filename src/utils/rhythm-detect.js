import { RHYTHM_PATTERNS, TPQN } from "../constants.js";

/**
 * インポートされたノートのデュレーション列からリズムパターンを検出する
 * @param {number[]} durations - TPQNティック単位のノート長の配列
 * @param {object} [options]
 * @param {number} [options.bpm] - swing/dotted判別用BPM
 * @returns {string} RHYTHM_PATTERNSのキー
 */
export function detectRhythmId(durations, options = {}) {
  if (!durations || durations.length < 4) return "even";

  // 装飾音（極短ノート）を除外
  const minDur = TPQN / 8;
  const filtered = durations.filter(d => d >= minDur);
  if (filtered.length < 4) return "even";

  // 変動係数チェック — ほぼ均等なら即座に "even"
  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  if (mean === 0) return "even";
  const variance = filtered.reduce((a, d) => a + (d - mean) ** 2, 0) / filtered.length;
  const cv = Math.sqrt(variance) / mean;
  if (cv < 0.1) return "even";

  // 各パターンのスコアを計算
  const candidates = [];

  for (const [id, pat] of Object.entries(RHYTHM_PATTERNS)) {
    if (!pat.weights) continue; // "even" はスキップ

    const ws = pat.weights;
    const windowSize = ws.length;
    const wSum = ws.reduce((a, b) => a + b, 0);
    const expected = ws.map(w => w / wSum);

    // windowSize 個ずつグループ化してスコアを計算
    const numWindows = Math.floor(filtered.length / windowSize);
    if (numWindows === 0) continue;

    let totalScore = 0;
    for (let i = 0; i < numWindows; i++) {
      const slice = filtered.slice(i * windowSize, (i + 1) * windowSize);
      const sliceSum = slice.reduce((a, b) => a + b, 0);
      if (sliceSum === 0) continue;
      const observed = slice.map(d => d / sliceSum);

      // ユークリッド距離 → スコア変換 (0〜1)
      const dist = Math.sqrt(
        observed.reduce((acc, o, j) => acc + (o - expected[j]) ** 2, 0)
      );
      // 最大距離は sqrt(2) だが、比率ベクトルなので実際はもっと小さい
      totalScore += Math.max(0, 1 - dist);
    }

    candidates.push({ id, score: totalScore / numWindows });
  }

  if (candidates.length === 0) return "even";

  // 最高スコアのパターンを選択
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // 閾値未満ならフォールバック
  if (best.score < 0.80) return "even";

  // swing と dotted は同一weights — BPMで判別
  if (best.id === "swing" || best.id === "dotted") {
    const bpm = options.bpm || 120;
    return bpm >= 120 ? "swing" : "dotted";
  }

  return best.id;
}
