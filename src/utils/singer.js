/**
 * マルチシンガー用ユーティリティ
 * メロディ配列をシンガー別に分割する
 */

/**
 * メロディからユニークなシンガー名を抽出
 * @param {Array} melody - generateMelody() の出力
 * @returns {string[]} シンガー名の配列（出現順）
 */
export function extractSingerNames(melody) {
  const seen = new Set();
  const names = [];
  for (const n of melody) {
    if (n.singer && !seen.has(n.singer)) {
      seen.add(n.singer);
      names.push(n.singer);
    }
  }
  return names;
}

/**
 * メロディをシンガー別に分割
 * - singer===null のノートは全シンガーにコピー
 * - 他シンガーのノートは同じ長さの rest に変換
 * - 隣接する rest はマージ
 *
 * @param {Array} melody - generateMelody() の出力
 * @param {string[]} singerNames - シンガー名リスト
 * @returns {Map<string, Array>} シンガー名 → メロディ配列
 */
export function splitMelodyBySinger(melody, singerNames) {
  const result = new Map();

  for (const name of singerNames) {
    const filtered = [];
    for (const n of melody) {
      if (n.type === "rest") {
        filtered.push({ ...n });
      } else if (n.singer === null || n.singer === name) {
        filtered.push({ ...n });
      } else {
        // 他シンガーのノート → rest に変換
        filtered.push({ type: "rest", length: n.length, section: n.section });
      }
    }

    // 隣接 rest をマージ
    const merged = [];
    for (const n of filtered) {
      if (n.type === "rest" && merged.length > 0 && merged[merged.length - 1].type === "rest") {
        merged[merged.length - 1].length += n.length;
      } else {
        merged.push(n);
      }
    }

    result.set(name, merged);
  }

  return result;
}
