import { useState, useCallback, useMemo, useEffect } from "react";
import { KEYS, PROGRESSIONS, RHYTHM_PATTERNS, DEFAULT_SECTIONS, SECTION_TYPES, VOCAL_RANGES, ACCOMP_PATTERNS } from "./constants.js";
import { splitSyllables } from "./utils/syllable.js";
import { downloadFile, noteName } from "./utils/helpers.js";
import { generateMelody } from "./generators/melody.js";
import { generateUST } from "./generators/ust.js";
import { generateSVP } from "./generators/svp.js";
import { generateMIDI } from "./generators/midi.js";
import { playPreview, stopPreview, isPlaying } from "./utils/preview.js";
import { svpToProjectJSON } from "./generators/svp-import.js";
import { ustToProjectJSON } from "./generators/ust-import.js";
import { midiToProjectJSON } from "./generators/midi-import.js";

const THEMES = {
  dark: {
    bgMain: "linear-gradient(135deg, #0a0f0a 0%, #0d1510 50%, #0a0f0a 100%)",
    bgHeader: "linear-gradient(90deg, rgba(124,179,66,0.12), rgba(197,225,165,0.08))",
    bgTab: "#0d1a0d",
    bgPanel: "#0d1a0d",
    bgInput: "#112211",
    bgSummary: "linear-gradient(135deg, #0d1a0d, #1a2e1a)",
    bgGenBtn: null,
    text: "#e0e0e0",
    textMuted: "#888",
    textDim: "#666",
    textFaint: "#555",
    textGhost: "#444",
    textDisabled: "#333",
    border: "#1a2e1a",
    borderInput: "#224422",
    borderSummary: "#1a3e1a",
    accent1: "#7cb342",
    accent2: "#c5e1a5",
    accent3: "#aed581",
    accent4: "#558b2f",
    accent5: "#66bb6a",
    gridBlack: "#0a150a",
    gridWhite: "#0d1a0d",
    error: "#ff4444",
    errorBg: "#441111",
    errorText: "#ff6666",
    genBtnText: "#000",
    noteText: "#000",
    progressBg: "linear-gradient(90deg, #66bb6a, #7cb342)",
    svpImport: "#4caf50",
    ustImport: "#ff9800",
    midiImport: "#2196f3",
  },
  light: {
    bgMain: "linear-gradient(135deg, #f5f9f0 0%, #eaf2e0 50%, #f5f9f0 100%)",
    bgHeader: "linear-gradient(90deg, rgba(124,179,66,0.08), rgba(85,139,47,0.06))",
    bgTab: "#e8f0e0",
    bgPanel: "#f0f5ea",
    bgInput: "#e0ebd5",
    bgSummary: "linear-gradient(135deg, #e8f0e0, #d5e5c0)",
    bgGenBtn: null,
    text: "#2d3a2d",
    textMuted: "#556655",
    textDim: "#778877",
    textFaint: "#889988",
    textGhost: "#99aa99",
    textDisabled: "#bbccbb",
    border: "#c5d8b5",
    borderInput: "#b0c8a0",
    borderSummary: "#a5c890",
    accent1: "#558b2f",
    accent2: "#33691e",
    accent3: "#689f38",
    accent4: "#2e7d32",
    accent5: "#43a047",
    gridBlack: "#dde8d5",
    gridWhite: "#eaf2e0",
    error: "#c62828",
    errorBg: "#ffebee",
    errorText: "#b71c1c",
    genBtnText: "#fff",
    noteText: "#fff",
    progressBg: "linear-gradient(90deg, #43a047, #558b2f)",
    svpImport: "#2e7d32",
    ustImport: "#e65100",
    midiImport: "#1565c0",
  },
};

export default function MusicGenerator() {
  const [bpm, setBpm] = useState(140);
  const [keyId, setKeyId] = useState("Am");
  const [progId, setProgId] = useState("komuro");
  const [rhythmId, setRhythmId] = useState("even");
  const [sections, setSections] = useState(JSON.parse(JSON.stringify(DEFAULT_SECTIONS)));
  const [generated, setGenerated] = useState(null);
  const [activeTab, setActiveTab] = useState("settings");
  const [seed, setSeed] = useState(42);
  const [playing, setPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [theme, setTheme] = useState("light"); // "light" | "dark" | "auto"
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [showAbout, setShowAbout] = useState(false);
  const [vocalRange, setVocalRange] = useState("auto");
  const [leapiness, setLeapiness] = useState(null); // null = 自動
  const [singers, setSingers] = useState([]); // [{name, database}]
  const [meter, setMeter] = useState(null); // SVPインポート時の拍子情報 {numerator, denominator}
  const [ustSingerIdx, setUstSingerIdx] = useState(0); // UST出力時のシンガー選択
  const [resolvedIds, setResolvedIds] = useState({ progId: "komuro", sections }); // auto解決後の値

  const isDark = theme === "dark" || (theme === "auto" && systemDark);
  const t = isDark ? THEMES.dark : THEMES.light;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const updateSection = useCallback((id, field, value) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    setGenerated(null);
  }, []);

  const addSection = useCallback(() => {
    setSections(prev => {
      const newId = Math.max(...prev.map(s => s.id), 0) + 1;
      return [...prev, { id: newId, type: "A", label: "Aメロ", measures: 8, lyrics: "", keyId }];
    });
    setGenerated(null);
  }, [keyId]);

  const removeSection = useCallback((id) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setGenerated(null);
  }, []);

  const moveSectionUp = useCallback((idx) => {
    if (idx <= 0) return;
    setSections(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    setGenerated(null);
  }, []);

  const moveSectionDown = useCallback((idx) => {
    setSections(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    setGenerated(null);
  }, []);

  const handleExportStructure = useCallback(() => {
    const data = { bpm, keyId, progId, rhythmId, sections };
    if (singers.length > 0) data.singers = singers;
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, "song-structure.json", "application/json");
  }, [bpm, keyId, progId, rhythmId, sections, singers]);

  const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50MB

  const handleImportStructure = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_SIZE) {
        alert("ファイルサイズが大きすぎます（上限: 50MB）");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.bpm != null) setBpm(Number(data.bpm));
          if (data.keyId && KEYS[data.keyId]) setKeyId(data.keyId);
          if (data.progId && PROGRESSIONS[data.progId]) setProgId(data.progId);
          if (data.rhythmId && RHYTHM_PATTERNS[data.rhythmId]) setRhythmId(data.rhythmId);
          if (Array.isArray(data.sections)) {
            const validated = data.sections.map((s, i) => ({
              id: s.id || i + 1,
              type: SECTION_TYPES.some(t => t.type === s.type) ? s.type : "A",
              label: s.label || SECTION_TYPES.find(t => t.type === s.type)?.label || "Aメロ",
              measures: Math.max(2, Math.min(32, Number(s.measures) || 8)),
              lyrics: typeof s.lyrics === "string" ? s.lyrics : "",
              keyId: KEYS[s.keyId] ? s.keyId : (data.keyId || "Am"),
              ...(typeof s.rhythmId === "string" && RHYTHM_PATTERNS[s.rhythmId] ? { rhythmId: s.rhythmId } : {}),
              ...(Array.isArray(s.customChords) && s.customChords.length > 0 ? { customChords: s.customChords } : {}),
              ...(Array.isArray(s.noteHint) && s.noteHint.length > 0 ? { noteHint: s.noteHint.map(Number) } : {}),
              ...(Array.isArray(s.durationHint) && s.durationHint.length > 0 ? { durationHint: s.durationHint.map(Number) } : {}),
              ...(Array.isArray(s.lyricHint) && s.lyricHint.length > 0 ? { lyricHint: s.lyricHint } : {}),
              ...(Array.isArray(s.restHint) && s.restHint.length > 0 ? { restHint: s.restHint } : {}),
              ...(Array.isArray(s.singerHint) && s.singerHint.length > 0 ? { singerHint: s.singerHint } : {}),
              ...(Array.isArray(s.detuneHint) && s.detuneHint.length > 0 ? { detuneHint: s.detuneHint.map(Number) } : {}),
              ...(Array.isArray(s.expressionHint) && s.expressionHint.length > 0 ? { expressionHint: s.expressionHint } : {}),
              ...(Array.isArray(s.systemAttributesHint) && s.systemAttributesHint.length > 0 ? { systemAttributesHint: s.systemAttributesHint } : {}),
              ...(Array.isArray(s.vibratoEnvHint) && s.vibratoEnvHint.length > 0 ? { vibratoEnvHint: s.vibratoEnvHint } : {}),
              ...(s.accompPatterns && typeof s.accompPatterns === "object" ? {
                accompPatterns: Object.fromEntries(
                  Object.entries(s.accompPatterns)
                    .filter(([k, v]) => ACCOMP_PATTERNS[k] && ACCOMP_PATTERNS[k][v])
                )
              } : {}),
            }));
            if (validated.length > 0) setSections(validated);
          }
          if (Array.isArray(data.singers)) {
            setSingers(data.singers.map(s => ({
              name: s.name || "",
              database: s.database || "",
            })).filter(s => s.name));
          }
          setGenerated(null);
        } catch (err) {
          alert("JSONファイルの読み込みに失敗しました: " + (err.message || "不明なエラー"));
        }
      };
      reader.onerror = () => alert("ファイルの読み込みに失敗しました。");
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleImportSVP = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svp";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_SIZE) {
        alert("ファイルサイズが大きすぎます（上限: 50MB）");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = svpToProjectJSON(ev.target.result);
          if (data.bpm != null) setBpm(Number(data.bpm));
          if (data.keyId && KEYS[data.keyId]) setKeyId(data.keyId);
          if (Array.isArray(data.sections) && data.sections.length > 0) {
            setSections(data.sections);
          }
          if (Array.isArray(data.singers) && data.singers.length > 0) {
            setSingers(data.singers.map(s => ({
              name: s.name || "",
              database: s.database || "",
            })).filter(s => s.name));
          }
          if (data.meter) setMeter(data.meter);
          setGenerated(null);
        } catch (err) {
          alert("SVPファイルの読み込みに失敗しました: " + err.message);
        }
      };
      reader.onerror = () => alert("SVPファイルの読み込みに失敗しました。");
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleImportUST = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ust";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_SIZE) {
        alert("ファイルサイズが大きすぎます（上限: 50MB）");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = ustToProjectJSON(ev.target.result);
          if (data.bpm != null) setBpm(Number(data.bpm));
          if (data.keyId && KEYS[data.keyId]) setKeyId(data.keyId);
          if (Array.isArray(data.sections) && data.sections.length > 0) {
            setSections(data.sections);
          }
          setGenerated(null);
        } catch (err) {
          alert("USTファイルの読み込みに失敗しました: " + err.message);
        }
      };
      reader.onerror = () => alert("USTファイルの読み込みに失敗しました。");
      reader.readAsText(file, "Shift_JIS");
    };
    input.click();
  }, []);

  const handleImportMIDI = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mid,.midi";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_SIZE) {
        alert("ファイルサイズが大きすぎます（上限: 50MB）");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = midiToProjectJSON(ev.target.result);
          if (data.bpm != null) setBpm(Number(data.bpm));
          if (data.keyId && KEYS[data.keyId]) setKeyId(data.keyId);
          if (Array.isArray(data.sections) && data.sections.length > 0) {
            setSections(data.sections);
          }
          setGenerated(null);
        } catch (err) {
          alert("MIDIファイルの読み込みに失敗しました: " + err.message);
        }
      };
      reader.onerror = () => alert("MIDIファイルの読み込みに失敗しました。");
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }, []);

  const totalMeasures = useMemo(() => sections.reduce((a, s) => a + s.measures, 0), [sections]);
  const estDuration = useMemo(() => {
    const secs = (totalMeasures * 4 * 60) / bpm;
    return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
  }, [totalMeasures, bpm]);

  const allLyricsEmpty = useMemo(
    () => sections.every(s => !s.lyrics || s.lyrics.trim() === ""),
    [sections]
  );

  const resolveAuto = useCallback(() => {
    const keyIds = Object.keys(KEYS);
    const progIds = Object.keys(PROGRESSIONS);
    const rhythmIds = Object.keys(RHYTHM_PATTERNS);
    const resolvedKeyId = keyId === "auto" ? keyIds[Math.floor(Math.random() * keyIds.length)] : keyId;
    const resolvedProgId = progId === "auto" ? progIds[Math.floor(Math.random() * progIds.length)] : progId;
    const resolvedRhythmId = rhythmId === "auto" ? rhythmIds[Math.floor(Math.random() * rhythmIds.length)] : rhythmId;
    return { resolvedKeyId, resolvedProgId, resolvedRhythmId };
  }, [keyId, progId, rhythmId]);

  const handleGenerate = useCallback(() => {
    if (allLyricsEmpty) return;
    const { resolvedKeyId, resolvedProgId, resolvedRhythmId } = resolveAuto();
    // auto選択時はセクションのkeyIdも解決済みの値に差し替え
    const resolvedSections = keyId === "auto"
      ? sections.map(s => ({ ...s, keyId: resolvedKeyId }))
      : sections;
    const rangeSpec = VOCAL_RANGES[vocalRange];
    const melody = generateMelody(resolvedSections, resolvedProgId, resolvedRhythmId, seed, {
      vocalRange: rangeSpec.min != null ? { min: rangeSpec.min, max: rangeSpec.max } : null,
      leapiness,
    });
    setGenerated(melody);
    setResolvedIds({ progId: resolvedProgId, sections: resolvedSections });
  }, [allLyricsEmpty, sections, keyId, progId, rhythmId, seed, vocalRange, leapiness, resolveAuto]);

  const handleExportUST = useCallback(() => {
    if (!generated) return;
    const singerName = singers.length > 0 ? singers[ustSingerIdx]?.name || null : null;
    const ust = generateUST(generated, bpm, "Generated", singerName, singers.length > 0 ? singers : null);
    const filename = singerName ? `song_${singerName}.ust` : "song.ust";
    downloadFile(ust, filename);
  }, [generated, bpm, singers, ustSingerIdx]);

  const handleExportMIDI = useCallback(() => {
    if (!generated) return;
    const midi = generateMIDI(generated, resolvedIds.sections, resolvedIds.progId, bpm, singers.length > 0 ? singers : null);
    downloadFile(midi, "song.mid");
  }, [generated, resolvedIds, bpm, singers]);

  const handlePreview = useCallback(() => {
    if (!generated) return;
    if (playing) {
      stopPreview();
      setPlaying(false);
      setPlayProgress(0);
      return;
    }
    setPlaying(true);
    setPlayProgress(0);
    playPreview(generated, bpm, resolvedIds.sections, resolvedIds.progId, (progress) => {
      setPlayProgress(progress);
      if (progress >= 1) setPlaying(false);
    }, singers.length > 0 ? singers : null);
  }, [generated, bpm, resolvedIds, playing, singers]);

  const handleExportSVP = useCallback(() => {
    if (!generated) return;
    const svp = generateSVP(generated, bpm, "Generated", singers.length > 0 ? singers : null, { meter });
    downloadFile(svp, "song.svp", "application/json");
  }, [generated, bpm, singers, meter]);

  const chordPreview = useMemo(() => {
    if (progId === "auto") return "（自動選択 - 生成時にランダムで決定）";
    const previewKeyId = sections.length > 0 ? sections[0].keyId : keyId;
    if (previewKeyId === "auto") return "（キーが自動のためプレビュー不可）";
    const names = PROGRESSIONS[progId]?.chords[previewKeyId];
    if (!names) return "";
    return names.join(" → ");
  }, [progId, keyId, sections]);

  const sectionColorMap = useMemo(() => ({
    A: t.accent1, B: t.accent4, chorus: t.accent2, bridge: t.accent3,
    serif: isDark ? "#e0e0e0" : "#546e7a", interlude: t.accent5, intro: "#546e7a", outro: "#546e7a",
  }), [t, isDark]);

  const pianoRoll = useMemo(() => {
    if (!generated) return null;
    const notes = generated.filter(n => n.type === "note");
    if (notes.length === 0) return null;
    const minNote = Math.min(...notes.map(n => n.noteNum)) - 2;
    const maxNote = Math.max(...notes.map(n => n.noteNum)) + 2;
    let x = 0;
    const rects = [];
    for (const n of generated) {
      if (n.type === "note") {
        rects.push({ x, w: n.length, y: n.noteNum, color: sectionColorMap[n.section] || t.accent1, lyric: n.lyric });
      }
      x += n.length;
    }
    const totalWidth = x;
    return { rects, minNote, maxNote, totalWidth };
  }, [generated, sectionColorMap, t]);

  return (
    <div style={{ minHeight: "100vh", background: t.bgMain, color: t.text, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", padding: "0" }}>
      {/* Header */}
      <div style={{ background: t.bgHeader, borderBottom: `1px solid ${t.accent1}33`, padding: "20px 24px", textAlign: "center", position: "relative" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, letterSpacing: "2px" }}>
          ちふちふジェネレーター
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: "12px", color: t.textDim, letterSpacing: "3px" }}>chifuchifu generator</p>
        <div style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "8px" }}>
          <button
            onClick={() => setShowAbout(true)}
            style={{
              padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontFamily: "inherit",
              background: `${t.accent1}22`, border: `1px solid ${t.accent1}66`, color: t.accent1,
              fontSize: "13px", fontWeight: 700, transition: "all 0.2s",
            }}
          >About</button>
          <button
            onClick={() => setTheme(v => v === "light" ? "dark" : v === "dark" ? "auto" : "light")}
            style={{
              padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontFamily: "inherit",
              background: `${t.accent1}22`, border: `1px solid ${t.accent1}66`, color: t.accent1,
              fontSize: "13px", fontWeight: 700, transition: "all 0.2s",
            }}
          >{{ light: "🌙 Dark", dark: "💻 Auto", auto: "☀ Light" }[theme]}</button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, background: t.bgTab }}>
        {[
          { id: "settings", label: "⚙ 設定" },
          { id: "lyrics", label: "✎ 構成 & 歌詞" },
          { id: "export", label: "↓ 生成 & 出力" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: "14px", border: "none", cursor: "pointer",
              background: activeTab === tab.id ? t.border : "transparent",
              color: activeTab === tab.id ? t.accent1 : t.textFaint,
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: "14px", fontFamily: "inherit",
              borderBottom: activeTab === tab.id ? `2px solid ${t.accent1}` : "2px solid transparent",
              transition: "all 0.2s",
            }}
          >{tab.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 20px" }}>
        {/* ===== SETTINGS TAB ===== */}
        {activeTab === "settings" && (
          <div>
            {/* BPM */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "12px", color: t.accent1, letterSpacing: "2px", marginBottom: "10px", fontWeight: 700 }}>
                TEMPO (BPM)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <input
                  type="range" min={80} max={220} value={bpm}
                  onChange={e => { setBpm(Number(e.target.value)); setGenerated(null); }}
                  style={{ flex: 1, accentColor: t.accent1, height: "6px" }}
                />
                <input
                  type="number" min={80} max={220} value={bpm}
                  onChange={e => { setBpm(Math.max(80, Math.min(220, Number(e.target.value)))); setGenerated(null); }}
                  style={{ width: "70px", background: t.bgInput, border: `1px solid ${t.accent1}44`, borderRadius: "6px", color: t.accent1, fontSize: "20px", fontWeight: 900, textAlign: "center", padding: "8px", fontFamily: "inherit" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: t.textGhost, marginTop: "4px" }}>
                <span>80 (スロー)</span><span>140 (ボカロ標準)</span><span>220 (超高速)</span>
              </div>
            </div>

            {/* Seed */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "12px", color: t.accent1, letterSpacing: "2px", marginBottom: "10px", fontWeight: 700 }}>
                SEED（乱数シード）
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="number" min={0} max={999999} value={seed}
                  onChange={e => { setSeed(Math.max(0, Math.min(999999, Number(e.target.value)))); setGenerated(null); }}
                  style={{ width: "120px", background: t.bgInput, border: `1px solid ${t.accent1}44`, borderRadius: "6px", color: t.accent1, fontSize: "20px", fontWeight: 900, textAlign: "center", padding: "8px", fontFamily: "inherit" }}
                />
                <button
                  onClick={() => { setSeed(Math.floor(Math.random() * 999999)); setGenerated(null); }}
                  style={{ padding: "8px 16px", background: `${t.accent1}22`, border: `1px solid ${t.accent1}66`, borderRadius: "6px", color: t.accent1, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >🎲 ランダム</button>
                <span style={{ fontSize: "11px", color: t.textFaint }}>同じシード＝同じメロディ</span>
              </div>
            </div>

            {/* Key */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "12px", color: t.accent1, letterSpacing: "2px", marginBottom: "10px", fontWeight: 700 }}>KEY（調）</label>
              <div style={{ marginBottom: "8px" }}>
                <button
                  onClick={() => { setKeyId("auto"); setGenerated(null); }}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", textAlign: "center",
                    background: keyId === "auto" ? `${t.accent1}22` : t.bgInput,
                    border: keyId === "auto" ? `2px solid ${t.accent1}` : `2px solid ${t.border}`,
                    color: keyId === "auto" ? t.accent1 : t.textMuted,
                    fontWeight: keyId === "auto" ? 700 : 400,
                    transition: "all 0.15s"
                  }}
                >自動（ランダム）</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {Object.entries(KEYS).map(([id, k]) => (
                  <button
                    key={id} onClick={() => { setKeyId(id); setSections(prev => prev.map(s => ({ ...s, keyId: id }))); setGenerated(null); }}
                    style={{
                      padding: "12px 16px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", textAlign: "left",
                      background: keyId === id ? `${t.accent1}22` : t.bgInput,
                      border: keyId === id ? `2px solid ${t.accent1}` : `2px solid ${t.border}`,
                      color: keyId === id ? t.accent1 : t.textMuted,
                      fontWeight: keyId === id ? 700 : 400,
                      transition: "all 0.15s"
                    }}
                  >{k.name}</button>
                ))}
              </div>
            </div>

            {/* Chord Progression */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "12px", color: t.accent1, letterSpacing: "2px", marginBottom: "10px", fontWeight: 700 }}>コード進行</label>
              <div style={{ marginBottom: "8px" }}>
                <button
                  onClick={() => { setProgId("auto"); setGenerated(null); }}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                    background: progId === "auto" ? `${t.accent2}15` : t.bgInput,
                    border: progId === "auto" ? `2px solid ${t.accent2}` : `2px solid ${t.border}`,
                    color: progId === "auto" ? (isDark ? "#fff" : "#2d3a2d") : t.textMuted,
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "14px", color: progId === "auto" ? t.accent2 : (isDark ? "#aaa" : "#667766") }}>自動（ランダム）</div>
                  <div style={{ fontSize: "11px", marginTop: "3px", color: progId === "auto" ? t.textMuted : t.textFaint }}>生成時にランダムで選択</div>
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {Object.entries(PROGRESSIONS).map(([id, p]) => (
                  <button
                    key={id} onClick={() => { setProgId(id); setGenerated(null); }}
                    style={{
                      padding: "14px 16px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                      background: progId === id ? `${t.accent2}15` : t.bgInput,
                      border: progId === id ? `2px solid ${t.accent2}` : `2px solid ${t.border}`,
                      color: progId === id ? (isDark ? "#fff" : "#2d3a2d") : t.textMuted,
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "14px", color: progId === id ? t.accent2 : (isDark ? "#aaa" : "#667766") }}>{p.name}</div>
                    <div style={{ fontSize: "11px", marginTop: "3px", color: progId === id ? t.textMuted : t.textFaint }}>{p.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: "12px", padding: "12px 16px", background: t.bgInput, borderRadius: "8px", fontSize: "13px", borderLeft: `3px solid ${t.accent2}` }}>
                <span style={{ color: t.textDim }}>プレビュー: </span>
                <span style={{ color: t.accent2, fontWeight: 700 }}>{chordPreview}</span>
              </div>
            </div>

            {/* Rhythm Pattern */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "12px", color: t.accent1, letterSpacing: "2px", marginBottom: "10px", fontWeight: 700 }}>リズムパターン</label>
              <div style={{ marginBottom: "8px" }}>
                <button
                  onClick={() => { setRhythmId("auto"); setGenerated(null); }}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                    background: rhythmId === "auto" ? `${t.accent3}15` : t.bgInput,
                    border: rhythmId === "auto" ? `2px solid ${t.accent3}` : `2px solid ${t.border}`,
                    color: rhythmId === "auto" ? (isDark ? "#fff" : "#2d3a2d") : t.textMuted,
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", color: rhythmId === "auto" ? t.accent3 : (isDark ? "#aaa" : "#667766") }}>自動（ランダム）</div>
                  <div style={{ fontSize: "10px", marginTop: "2px", color: rhythmId === "auto" ? t.textMuted : t.textFaint }}>生成時にランダムで選択</div>
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {Object.entries(RHYTHM_PATTERNS).map(([id, r]) => (
                  <button
                    key={id} onClick={() => { setRhythmId(id); setGenerated(null); }}
                    style={{
                      padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                      background: rhythmId === id ? `${t.accent3}15` : t.bgInput,
                      border: rhythmId === id ? `2px solid ${t.accent3}` : `2px solid ${t.border}`,
                      color: rhythmId === id ? (isDark ? "#fff" : "#2d3a2d") : t.textMuted,
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "13px", color: rhythmId === id ? t.accent3 : (isDark ? "#aaa" : "#667766") }}>{r.name}</div>
                    <div style={{ fontSize: "10px", marginTop: "2px", color: rhythmId === id ? t.textMuted : t.textFaint }}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Vocal Range */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "12px", color: t.accent1, letterSpacing: "2px", marginBottom: "10px", fontWeight: 700 }}>音域</label>
              <div style={{ marginBottom: "8px" }}>
                <button
                  onClick={() => { setVocalRange("auto"); setGenerated(null); }}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                    background: vocalRange === "auto" ? `${t.accent3}15` : t.bgInput,
                    border: vocalRange === "auto" ? `2px solid ${t.accent3}` : `2px solid ${t.border}`,
                    color: vocalRange === "auto" ? (isDark ? "#fff" : "#2d3a2d") : t.textMuted,
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", color: vocalRange === "auto" ? t.accent3 : (isDark ? "#aaa" : "#667766") }}>{VOCAL_RANGES.auto.name}</div>
                  <div style={{ fontSize: "10px", marginTop: "2px", color: vocalRange === "auto" ? t.textMuted : t.textFaint }}>{VOCAL_RANGES.auto.desc}</div>
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {Object.entries(VOCAL_RANGES).filter(([id]) => id !== "auto").map(([id, r]) => (
                  <button
                    key={id} onClick={() => { setVocalRange(id); setGenerated(null); }}
                    style={{
                      padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                      background: vocalRange === id ? `${t.accent3}15` : t.bgInput,
                      border: vocalRange === id ? `2px solid ${t.accent3}` : `2px solid ${t.border}`,
                      color: vocalRange === id ? (isDark ? "#fff" : "#2d3a2d") : t.textMuted,
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "13px", color: vocalRange === id ? t.accent3 : (isDark ? "#aaa" : "#667766") }}>{r.name}</div>
                    <div style={{ fontSize: "10px", marginTop: "2px", color: vocalRange === id ? t.textMuted : t.textFaint }}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Leapiness */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "12px", color: t.accent1, letterSpacing: "2px", marginBottom: "10px", fontWeight: 700 }}>
                メロディの跳躍感
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <button
                  onClick={() => { setLeapiness(null); setGenerated(null); }}
                  style={{
                    padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700,
                    background: leapiness === null ? `${t.accent1}22` : t.bgInput,
                    border: leapiness === null ? `2px solid ${t.accent1}` : `2px solid ${t.border}`,
                    color: leapiness === null ? t.accent1 : t.textMuted,
                  }}
                >自動</button>
                <button
                  onClick={() => { setLeapiness(50); setGenerated(null); }}
                  style={{
                    padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700,
                    background: leapiness !== null ? `${t.accent1}22` : t.bgInput,
                    border: leapiness !== null ? `2px solid ${t.accent1}` : `2px solid ${t.border}`,
                    color: leapiness !== null ? t.accent1 : t.textMuted,
                  }}
                >手動</button>
              </div>
              {leapiness !== null && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "11px", color: t.textFaint, whiteSpace: "nowrap" }}>なだらか</span>
                    <input
                      type="range" min={0} max={100} value={leapiness}
                      onChange={e => { setLeapiness(Number(e.target.value)); setGenerated(null); }}
                      style={{ flex: 1, accentColor: t.accent1, height: "6px" }}
                    />
                    <span style={{ fontSize: "11px", color: t.textFaint, whiteSpace: "nowrap" }}>跳躍</span>
                    <span style={{ fontSize: "14px", color: t.accent1, fontWeight: 900, minWidth: "32px", textAlign: "center" }}>{leapiness}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: t.textGhost, marginTop: "4px" }}>
                    低い＝隣の音に動きやすい　高い＝離れた音に飛びやすい
                  </div>
                </>
              )}
              {leapiness === null && (
                <div style={{ fontSize: "10px", color: t.textGhost }}>
                  セクションタイプに応じて自動調整
                </div>
              )}
            </div>

            {/* Multi-Singer */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "12px", color: t.accent1, letterSpacing: "2px", marginBottom: "10px", fontWeight: 700 }}>
                マルチシンガー
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <button
                  onClick={() => { if (singers.length === 0) setSingers([{ name: "", database: "" }, { name: "", database: "" }]); else setSingers([]); setGenerated(null); }}
                  style={{
                    padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700,
                    background: singers.length > 0 ? `${t.accent1}22` : t.bgInput,
                    border: singers.length > 0 ? `2px solid ${t.accent1}` : `2px solid ${t.border}`,
                    color: singers.length > 0 ? t.accent1 : t.textMuted,
                  }}
                >{singers.length > 0 ? "ON" : "OFF"}</button>
                <span style={{ fontSize: "11px", color: t.textFaint }}>デュエット・トリオ対応</span>
              </div>
              {singers.length > 0 && (
                <div style={{ background: t.bgInput, borderRadius: "8px", padding: "12px", border: `1px solid ${t.border}` }}>
                  {singers.map((singer, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: idx < singers.length - 1 ? "8px" : 0 }}>
                      <span style={{ fontSize: "11px", color: t.textFaint, minWidth: "16px" }}>{idx + 1}.</span>
                      <input
                        type="text" placeholder="シンガー名"
                        value={singer.name}
                        onChange={e => { const next = [...singers]; next[idx] = { ...next[idx], name: e.target.value }; setSingers(next); setGenerated(null); }}
                        style={{ flex: 1, padding: "6px 10px", background: t.bgPanel, border: `1px solid ${t.borderInput}`, borderRadius: "4px", color: t.text, fontFamily: "inherit", fontSize: "13px" }}
                      />
                      <input
                        type="text" placeholder="SynthV DB名 (任意)"
                        value={singer.database}
                        onChange={e => { const next = [...singers]; next[idx] = { ...next[idx], database: e.target.value }; setSingers(next); }}
                        style={{ flex: 1.5, padding: "6px 10px", background: t.bgPanel, border: `1px solid ${t.borderInput}`, borderRadius: "4px", color: t.text, fontFamily: "inherit", fontSize: "12px" }}
                      />
                      <button
                        onClick={() => { setSingers(prev => prev.filter((_, i) => i !== idx)); setGenerated(null); }}
                        style={{ padding: "4px 8px", background: `${t.error}22`, border: `1px solid ${t.error}44`, borderRadius: "4px", color: t.error, cursor: "pointer", fontFamily: "inherit", fontSize: "12px" }}
                      >x</button>
                    </div>
                  ))}
                  <button
                    onClick={() => setSingers(prev => [...prev, { name: "", database: "" }])}
                    style={{ marginTop: "8px", padding: "4px 12px", background: `${t.accent1}15`, border: `1px solid ${t.accent1}44`, borderRadius: "4px", color: t.accent1, cursor: "pointer", fontFamily: "inherit", fontSize: "12px" }}
                  >+ シンガー追加</button>
                  <div style={{ marginTop: "10px", fontSize: "10px", color: t.textGhost, lineHeight: "1.6" }}>
                    歌詞で [シンガー名] タグを使用<br/>
                    例: [千冬]きみと [六花]ぼくの []そらに<br/>
                    タグなし(先頭) / [] = 全員で歌唱<br/>
                    [千冬+3] = 千冬パート +3半音
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{ padding: "16px", background: t.bgSummary, borderRadius: "10px", border: `1px solid ${t.borderSummary}` }}>
              <div style={{ fontSize: "11px", color: t.textDim, letterSpacing: "2px", marginBottom: "8px" }}>SUMMARY</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
                <div><div style={{ color: t.accent1, fontSize: "22px", fontWeight: 900 }}>{bpm}</div><div style={{ fontSize: "10px", color: t.textFaint }}>BPM</div></div>
                <div><div style={{ color: t.accent2, fontSize: "22px", fontWeight: 900 }}>{keyId}</div><div style={{ fontSize: "10px", color: t.textFaint }}>KEY</div></div>
                <div><div style={{ color: t.accent3, fontSize: "22px", fontWeight: 900 }}>{estDuration}</div><div style={{ fontSize: "10px", color: t.textFaint }}>推定</div></div>
              </div>
            </div>
          </div>
        )}

        {/* ===== LYRICS TAB ===== */}
        {activeTab === "lyrics" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "12px", color: t.textDim }}>全 {totalMeasures} 小節 ≈ {estDuration}</div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleImportStructure}
                  style={{ padding: "8px 12px", background: `${t.accent3}15`, border: `1px solid ${t.accent3}66`, borderRadius: "6px", color: t.accent3, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >↑ JSON</button>
                <button
                  onClick={handleImportSVP}
                  style={{ padding: "8px 12px", background: `${t.svpImport}15`, border: `1px solid ${t.svpImport}66`, borderRadius: "6px", color: t.svpImport, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >↑ SVP</button>
                <button
                  onClick={handleImportUST}
                  style={{ padding: "8px 12px", background: `${t.ustImport}15`, border: `1px solid ${t.ustImport}66`, borderRadius: "6px", color: t.ustImport, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >↑ UST</button>
                <button
                  onClick={handleImportMIDI}
                  style={{ padding: "8px 12px", background: `${t.midiImport}15`, border: `1px solid ${t.midiImport}66`, borderRadius: "6px", color: t.midiImport, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >↑ MIDI</button>
                <button
                  onClick={handleExportStructure}
                  style={{ padding: "8px 12px", background: `${t.accent4}15`, border: `1px solid ${t.accent4}66`, borderRadius: "6px", color: t.accent4, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >↓ エクスポート</button>
                <button
                  onClick={addSection}
                  style={{ padding: "8px 12px", background: `${t.accent1}22`, border: `1px solid ${t.accent1}66`, borderRadius: "6px", color: t.accent1, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >+ 追加</button>
              </div>
            </div>

            {/* Expression Symbol Reference */}
            <div style={{ marginBottom: "16px", background: t.bgPanel, borderRadius: "10px", border: `1px solid ${t.border}`, overflow: "hidden" }}>
              <details>
                <summary style={{ padding: "12px 16px", cursor: "pointer", fontSize: "12px", color: t.accent3, letterSpacing: "1px", fontWeight: 700, userSelect: "none" }}>
                  🎤 発声記号リファレンス（クリックで展開）
                </summary>
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}`, fontSize: "12px", lineHeight: 2.2, color: t.textMuted }}>
                  <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: "2px 12px" }}>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>&gt;</span><span>アクセント（強調）</span><span style={{ color: t.textFaint }}>&gt;かげにそっとかくれ</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>↗(1-3)</span><span>しゃくり（深さ指定可）</span><span style={{ color: t.textFaint }}>↗2はなに ↗3なって</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>↘(1-3)</span><span>フォール（深さ指定可）</span><span style={{ color: t.textFaint }}>さいてる↘3</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>~...~</span><span>ビブラート</span><span style={{ color: t.textFaint }}>はなになって~</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>_</span><span>長音（音を伸ばす）</span><span style={{ color: t.textFaint }}>そ_っと</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>♪(n)</span><span>ブレス（拍数指定可）</span><span style={{ color: t.textFaint }}>♪ =1拍 ♪2 =2拍 ♪0.5</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>「」</span><span>セリフ（喋り調）</span><span style={{ color: t.textFaint }}>「ねっ あいたいあいたい」</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>!</span><span>テンション上げ</span><span style={{ color: t.textFaint }}>!つつんであげるから</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>(p)(f)</span><span>強弱指定</span><span style={{ color: t.textFaint }}>(p)かげにそっとかくれ</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>...</span><span>トーク風（Voicing↓）</span><span style={{ color: t.textFaint }}>...そうだよね きっと</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>(whisper)</span><span>ささやき（Voicing↓↓）</span><span style={{ color: t.textFaint }}>(whisper)ねえ きこえてる</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>[名前]</span><span>シンガー切替</span><span style={{ color: t.textFaint }}>[千冬]きみと [六花]ぼくの</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>[名前±N]</span><span>シンガー+移調</span><span style={{ color: t.textFaint }}>[六花+3]うたをうたおう</span>
                    <span style={{ color: t.accent1, fontWeight: 700 }}>[]</span><span>全員に戻す</span><span style={{ color: t.textFaint }}>[千冬]ソロ []ユニゾン</span>
                  </div>
                </div>
              </details>
            </div>

            <div style={{ marginBottom: "16px", background: t.bgPanel, borderRadius: "10px", border: `1px solid ${t.border}`, overflow: "hidden" }}>
              <details>
                <summary style={{ padding: "12px 16px", cursor: "pointer", fontSize: "12px", color: t.accent3, letterSpacing: "1px", fontWeight: 700, userSelect: "none" }}>
                  👓️ JSONリファレンス（クリックで展開）
                </summary>
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}`, fontSize: "12px", lineHeight: 1.8, color: t.textMuted }}>
                  <p style={{ margin: "0 0 8px", color: t.accent2, fontWeight: 700 }}>インポート用JSONの書き方</p>
                  <p style={{ margin: "0 0 12px", fontSize: "11px", color: t.textDim }}>
                    「↑JSON」ボタンで読み込めるファイルの形式です。すべてのフィールドは省略可能で、指定した項目だけが反映されます。
                  </p>

                  {/* トップレベル設定 */}
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ color: t.accent1, fontWeight: 700, marginBottom: "4px", fontSize: "11px" }}>■ 全体設定（すべて省略可）</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: "2px 12px", fontSize: "11px", paddingLeft: "8px" }}>
                      <span style={{ color: t.accent3 }}>bpm</span><span style={{ color: t.textFaint }}>数値</span><span>テンポ（例: 120）</span>
                      <span style={{ color: t.accent3 }}>keyId</span><span style={{ color: t.textFaint }}>文字列</span>
                      <span>キー（{Object.keys(KEYS).map((k, i) => <span key={k}>{i > 0 && ", "}<code style={{ color: t.accent2, fontSize: "10px" }}>{k}</code></span>)}）</span>
                      <span style={{ color: t.accent3 }}>progId</span><span style={{ color: t.textFaint }}>文字列</span>
                      <span>コード進行（{Object.entries(PROGRESSIONS).map(([k, v], i) => <span key={k}>{i > 0 && ", "}<code style={{ color: t.accent2, fontSize: "10px" }}>{k}</code>={v.name}</span>)}）</span>
                      <span style={{ color: t.accent3 }}>rhythmId</span><span style={{ color: t.textFaint }}>文字列</span>
                      <span>リズム（{Object.entries(RHYTHM_PATTERNS).map(([k, v], i) => <span key={k}>{i > 0 && ", "}<code style={{ color: t.accent2, fontSize: "10px" }}>{k}</code>={v.name}</span>)}）</span>
                      <span style={{ color: t.accent3 }}>singers</span><span style={{ color: t.textFaint }}>配列</span>
                      <span>マルチシンガー設定（[{"{"}name, database{"}"}]）省略時はシングルモード</span>
                    </div>
                  </div>

                  {/* sections配列 */}
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ color: t.accent1, fontWeight: 700, marginBottom: "4px", fontSize: "11px" }}>■ sections（セクション配列）</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto auto auto 1fr", gap: "2px 10px", fontSize: "11px", paddingLeft: "8px" }}>
                      <span style={{ color: t.accent3 }}>type</span><span style={{ color: t.textFaint }}>文字列</span><span style={{ color: t.error, fontSize: "10px" }}>必須</span>
                      <span>種別（{SECTION_TYPES.map((st, i) => <span key={st.type}>{i > 0 && ", "}<code style={{ color: t.accent2, fontSize: "10px" }}>{st.type}</code>={st.label}</span>)}）</span>
                      <span style={{ color: t.accent3 }}>label</span><span style={{ color: t.textFaint }}>文字列</span><span></span>
                      <span>表示名（省略時はtypeから自動設定）</span>
                      <span style={{ color: t.accent3 }}>measures</span><span style={{ color: t.textFaint }}>数値</span><span></span>
                      <span>小節数（2〜32、省略時は8）</span>
                      <span style={{ color: t.accent3 }}>lyrics</span><span style={{ color: t.textFaint }}>文字列</span><span></span>
                      <span>歌詞テキスト（発声記号も使えます）</span>
                      <span style={{ color: t.accent3 }}>keyId</span><span style={{ color: t.textFaint }}>文字列</span><span></span>
                      <span>セクション個別のキー（省略時は全体設定を使用）</span>
                      <span style={{ color: t.accent3 }}>rhythmId</span><span style={{ color: t.textFaint }}>文字列</span><span></span>
                      <span>セクション個別のリズム（省略時はグローバル設定を使用）</span>
                      <span style={{ color: t.accent3 }}>customChords</span><span style={{ color: t.textFaint }}>文字列[]</span><span></span>
                      <span>カスタムコード進行（例: ["Am","F","G","C"]）</span>
                    </div>
                  </div>

                  {/* ノート詳細制御 */}
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ color: t.accent1, fontWeight: 700, marginBottom: "4px", fontSize: "11px" }}>■ ノート単位の詳細制御（上級・すべて省略可）</div>
                    <p style={{ margin: "0 0 4px", fontSize: "10px", color: t.textDim, paddingLeft: "8px" }}>
                      1音ごとの音高・長さ・歌詞・休符を細かく指定できます。省略すれば自動生成されます。
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: "2px 12px", fontSize: "11px", paddingLeft: "8px" }}>
                      <span style={{ color: t.accent3 }}>noteHint</span><span style={{ color: t.textFaint }}>数値[]</span>
                      <span>MIDIノート番号の配列（60=C4, 69=A4 など）</span>
                      <span style={{ color: t.accent3 }}>durationHint</span><span style={{ color: t.textFaint }}>数値[]</span>
                      <span>各ノートの長さ（480=四分音符, 960=二分音符）</span>
                      <span style={{ color: t.accent3 }}>lyricHint</span><span style={{ color: t.textFaint }}>文字列[]</span>
                      <span>音節単位の歌詞（例: ["か","ぜ","が"]）</span>
                      <span style={{ color: t.accent3 }}>restHint</span><span style={{ color: t.textFaint }}>真偽値[]</span>
                      <span>休符フラグ（trueで休符、falseで通常ノート）</span>
                      <span style={{ color: t.accent3 }}>expressionHint</span><span style={{ color: t.textFaint }}>配列</span>
                      <span>表現属性（voicingMode: "talk"/"whisper"/"p"/null 等）</span>
                    </div>
                  </div>

                  {/* 例 */}
                  <div>
                    <div style={{ color: t.accent1, fontWeight: 700, marginBottom: "4px", fontSize: "11px" }}>■ 記述例</div>
                    <pre style={{ margin: 0, padding: "8px 12px", background: t.bgInput, borderRadius: "6px", border: `1px solid ${t.borderInput}`, fontSize: "10px", lineHeight: 1.6, color: t.accent2, overflowX: "auto", whiteSpace: "pre-wrap" }}>{
`{
  "bpm": 120,
  "keyId": "Am",
  "progId": "komuro",
  "singers": [
    { "name": "千冬", "database": "Hanakuma Chifuyu AI" },
    { "name": "六花", "database": "Koharu Rikka AI" }
  ],
  "sections": [
    {
      "type": "A",
      "measures": 8,
      "lyrics": "(p)[千冬]~かぜが~ ♪ [六花+3]>ふいて↘"
    },
    {
      "type": "chorus",
      "measures": 8,
      "lyrics": "(f)[]!さくらが さく"
    }
  ]
}`
                    }</pre>
                    <div style={{ marginTop: "10px", padding: "8px 12px", background: "transparent", borderRadius: "6px", border: `1px solid ${t.borderInput}` }}>
                      <div style={{ color: t.accent1, fontWeight: 700, marginBottom: "4px", fontSize: "11px" }}>■Claudeスキル</div>
                      <div style={{ fontSize: "10px", lineHeight: 1.8, color: t.text }}>
                        Claudeスキルを使いJSONの生成を依頼することで、変換という工程は挟むものの実質自然言語で千冬に曲を歌わせられる。<br />
                        <a href="https://pixelpassion.jp/chifuchifu/chifu-json-gen.skill" target="_blank" rel="noopener noreferrer" style={{ color: t.accent2 }}>chifu-json-gen.skill</a>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {sections.map((sec, idx) => {
              const isVocal = ["A", "B", "chorus", "bridge", "serif"].includes(sec.type);
              const syllables = splitSyllables(sec.lyrics);
              const recommended = sec.measures * 6;
              const col = sectionColorMap[sec.type] || t.accent1;

              return (
                <div key={sec.id} style={{ marginBottom: "16px", background: t.bgPanel, borderRadius: "10px", border: `1px solid ${col}33`, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderBottom: `1px solid ${col}22`, background: `${col}08` }}>
                    <select
                      value={sec.type}
                      onChange={e => {
                        const st = SECTION_TYPES.find(t => t.type === e.target.value);
                        updateSection(sec.id, "type", e.target.value);
                        updateSection(sec.id, "label", st ? st.label : sec.label);
                      }}
                      style={{ background: t.bgInput, border: `1px solid ${col}44`, borderRadius: "4px", color: col, padding: "6px 10px", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                    >
                      {SECTION_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                    </select>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <label style={{ fontSize: "11px", color: t.textFaint }}>Key:</label>
                      <select
                        value={sec.keyId}
                        onChange={e => updateSection(sec.id, "keyId", e.target.value)}
                        style={{ background: t.bgInput, border: `1px solid ${col}44`, borderRadius: "4px", color: col, padding: "6px 10px", fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        {Object.keys(KEYS).map(id => <option key={id} value={id}>{id}</option>)}
                      </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                      <label style={{ fontSize: "11px", color: t.textFaint }}>小節:</label>
                      <input
                        type="number" min={2} max={32} value={sec.measures}
                        onChange={e => updateSection(sec.id, "measures", Math.max(2, Math.min(32, Number(e.target.value))))}
                        style={{ width: "50px", background: t.bgInput, border: `1px solid ${col}33`, borderRadius: "4px", color: col, textAlign: "center", padding: "6px", fontFamily: "inherit", fontSize: "13px" }}
                      />
                    </div>

                    <button onClick={() => moveSectionUp(idx)} disabled={idx === 0}
                      style={{ padding: "4px 8px", background: "transparent", border: `1px solid ${t.textDisabled}`, borderRadius: "4px", color: idx === 0 ? t.textDisabled : t.textMuted, cursor: idx === 0 ? "default" : "pointer", fontSize: "12px" }}>↑</button>
                    <button onClick={() => moveSectionDown(idx)} disabled={idx === sections.length - 1}
                      style={{ padding: "4px 8px", background: "transparent", border: `1px solid ${t.textDisabled}`, borderRadius: "4px", color: idx === sections.length - 1 ? t.textDisabled : t.textMuted, cursor: idx === sections.length - 1 ? "default" : "pointer", fontSize: "12px" }}>↓</button>
                    <button onClick={() => removeSection(sec.id)} disabled={sections.length <= 1}
                      style={{ padding: "4px 8px", background: "transparent", border: `1px solid ${t.errorBg}`, borderRadius: "4px", color: sections.length <= 1 ? t.textDisabled : t.error, cursor: sections.length <= 1 ? "default" : "pointer", fontSize: "12px" }}>✕</button>
                  </div>

                  {isVocal ? (
                    <div style={{ padding: "16px" }}>
                      <textarea
                        value={sec.lyrics}
                        onChange={e => updateSection(sec.id, "lyrics", e.target.value)}
                        placeholder={sec.type === "serif" ? "セリフを入力（例: あはっ しらないわ）" : "ここに歌詞を入力（ひらがな・カタカナ推奨）"}
                        rows={3}
                        style={{ width: "100%", boxSizing: "border-box", background: t.bgInput, border: `1px solid ${t.borderInput}`, borderRadius: "6px", color: isDark ? "#ddd" : "#333", padding: "12px", fontSize: "14px", fontFamily: "'Noto Sans JP', sans-serif", resize: "vertical", lineHeight: 1.8 }}
                      />
                      {(() => {
                        const minSylls = sec.measures * 2;
                        const maxSylls = sec.measures * 8;
                        const tooFew = syllables.length > 0 && syllables.length < minSylls;
                        const tooMany = syllables.length > maxSylls;
                        return (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px" }}>
                              <span style={{ color: (tooFew || tooMany) ? t.error : syllables.length > 0 ? col : t.textGhost }}>
                                音節数: {syllables.length}
                              </span>
                              <span style={{ color: t.textGhost }}>目安: {sec.measures * 4}〜{recommended}音節 ({sec.measures}小節)</span>
                            </div>
                            {tooFew && (
                              <div style={{ marginTop: "4px", padding: "4px 8px", background: t.errorBg, borderRadius: "4px", fontSize: "10px", color: t.errorText }}>
                                音節数が少なすぎます（最低{minSylls}音節推奨）。1音が極端に長くなる可能性があります。
                              </div>
                            )}
                            {tooMany && (
                              <div style={{ marginTop: "4px", padding: "4px 8px", background: t.errorBg, borderRadius: "4px", fontSize: "10px", color: t.errorText }}>
                                音節数が多すぎます（最大{maxSylls}音節推奨）。早口で詰め込みすぎる可能性があります。
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {sec.type === "serif" && (
                        <div style={{ marginTop: "6px", fontSize: "10px", color: t.textDim, background: t.bgInput, padding: "6px 10px", borderRadius: "4px", borderLeft: "2px solid #e0e0e0" }}>
                          セリフ調: ピッチ変動を抑えたフラットな喋り風メロディを生成します。セクション全体がセリフ扱いのため「」記号は不要です。
                        </div>
                      )}
                      {/* D2: カスタムコード進行 */}
                      <details style={{ marginTop: "8px" }}>
                        <summary style={{ fontSize: "10px", color: t.textFaint, cursor: "pointer", userSelect: "none" }}>
                          カスタムコード（オプション）
                        </summary>
                        <input
                          type="text"
                          value={(sec.customChords || []).join(" ")}
                          onChange={e => {
                            const val = e.target.value.trim();
                            const chords = val ? val.split(/[\s,]+/).filter(Boolean) : [];
                            updateSection(sec.id, "customChords", chords.length > 0 ? chords : undefined);
                          }}
                          placeholder="例: Am F G C（スペース区切り）"
                          style={{ width: "100%", boxSizing: "border-box", marginTop: "4px", background: t.bgInput, border: `1px solid ${t.borderInput}`, borderRadius: "4px", color: t.textMuted, padding: "6px 10px", fontSize: "12px", fontFamily: "inherit" }}
                        />
                        <div style={{ fontSize: "9px", color: t.textGhost, marginTop: "2px" }}>空欄の場合はグローバル設定のコード進行を使用</div>
                      </details>
                      <details style={{ marginTop: "8px" }}>
                        <summary style={{ fontSize: "10px", color: sec.rhythmId ? t.accent3 : t.textFaint, cursor: "pointer", userSelect: "none" }}>
                          リズムパターン（オプション）{sec.rhythmId ? ` — ${RHYTHM_PATTERNS[sec.rhythmId]?.name}` : ""}
                        </summary>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                          <button
                            onClick={() => updateSection(sec.id, "rhythmId", undefined)}
                            style={{
                              padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px",
                              background: !sec.rhythmId ? `${t.accent3}15` : t.bgInput,
                              border: !sec.rhythmId ? `1.5px solid ${t.accent3}` : `1px solid ${t.borderInput}`,
                              color: !sec.rhythmId ? t.accent3 : t.textMuted,
                            }}
                          >グローバル</button>
                          {Object.entries(RHYTHM_PATTERNS).map(([id, r]) => (
                            <button
                              key={id}
                              onClick={() => updateSection(sec.id, "rhythmId", id)}
                              style={{
                                padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px",
                                background: sec.rhythmId === id ? `${t.accent3}15` : t.bgInput,
                                border: sec.rhythmId === id ? `1.5px solid ${t.accent3}` : `1px solid ${t.borderInput}`,
                                color: sec.rhythmId === id ? t.accent3 : t.textMuted,
                              }}
                            >{r.name}</button>
                          ))}
                        </div>
                        <div style={{ fontSize: "9px", color: t.textGhost, marginTop: "4px" }}>「グローバル」選択時は⚙設定タブのリズムパターンを使用</div>
                      </details>
                    </div>
                  ) : (
                    <div style={{ padding: "16px", textAlign: "center", color: t.textDisabled, fontSize: "12px" }}>
                      インストゥルメンタル区間（歌詞なし）
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== EXPORT TAB ===== */}
        {activeTab === "export" && (
          <div>
            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={allLyricsEmpty}
              style={{
                width: "100%", padding: "18px", marginBottom: "24px",
                background: allLyricsEmpty
                  ? t.border
                  : `linear-gradient(135deg, ${t.accent1}, ${t.accent2})`,
                border: "none", borderRadius: "10px",
                cursor: allLyricsEmpty ? "not-allowed" : "pointer",
                color: allLyricsEmpty ? t.textFaint : t.genBtnText,
                fontSize: "18px", fontWeight: 900, fontFamily: "inherit",
                letterSpacing: "2px",
                boxShadow: allLyricsEmpty ? "none" : `0 0 30px ${t.accent1}33`,
                transition: "transform 0.1s",
                opacity: allLyricsEmpty ? 0.6 : 1,
              }}
              onMouseDown={e => !allLyricsEmpty && (e.target.style.transform = "scale(0.98)")}
              onMouseUp={e => e.target.style.transform = "scale(1)"}
            >
              {allLyricsEmpty ? "歌詞を入力してください" : "▶ メロディ生成"}
            </button>

            {generated && (
              <>
                {/* D3: Preview Playback */}
                <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    onClick={handlePreview}
                    style={{
                      padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit",
                      background: playing ? `${t.accent2}22` : `${t.accent5}22`,
                      border: `2px solid ${playing ? t.accent2 : t.accent5}`,
                      color: playing ? t.accent2 : t.accent5,
                      fontSize: "14px", fontWeight: 700, transition: "all 0.15s",
                    }}
                  >{playing ? "■ 停止" : "▶ プレビュー再生"}</button>
                  {playing && (
                    <div style={{ flex: 1, height: "6px", background: t.border, borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${playProgress * 100}%`, height: "100%", background: t.progressBg, borderRadius: "3px", transition: "width 0.1s" }} />
                    </div>
                  )}
                  <span style={{ fontSize: "10px", color: t.textFaint }}>簡易プレビュー（音程・リズム確認用）</span>
                </div>

                {/* Piano Roll */}
                {pianoRoll && (
                  <div style={{ marginBottom: "24px", background: t.bgPanel, borderRadius: "10px", border: `1px solid ${t.border}`, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`, fontSize: "12px", color: t.textDim, letterSpacing: "2px" }}>PIANO ROLL PREVIEW</div>
                    <div style={{ overflowX: "auto", padding: "16px" }}>
                      <svg
                        width={Math.max(600, pianoRoll.totalWidth / 20)}
                        height={(pianoRoll.maxNote - pianoRoll.minNote + 1) * 10 + 20}
                        style={{ display: "block" }}
                      >
                        {/* Grid lines */}
                        {Array.from({ length: pianoRoll.maxNote - pianoRoll.minNote + 1 }, (_, i) => {
                          const noteN = pianoRoll.maxNote - i;
                          const isBlack = [1,3,6,8,10].includes(noteN % 12);
                          return (
                            <g key={i}>
                              <rect x={0} y={i * 10} width="100%" height={10} fill={isBlack ? t.gridBlack : t.gridWhite} />
                              {noteN % 12 === 0 && <line x1={0} y1={i * 10} x2="100%" y2={i * 10} stroke={isDark ? "#222" : "#bbb"} strokeWidth={0.5} />}
                            </g>
                          );
                        })}
                        {/* Notes */}
                        {pianoRoll.rects.map((r, i) => {
                          const xPos = (r.x / pianoRoll.totalWidth) * Math.max(600, pianoRoll.totalWidth / 20);
                          const w = Math.max(2, (r.w / pianoRoll.totalWidth) * Math.max(600, pianoRoll.totalWidth / 20) - 1);
                          const yPos = (pianoRoll.maxNote - r.y) * 10;
                          return (
                            <g key={i}>
                              <rect x={xPos} y={yPos} width={w} height={9} rx={2} fill={r.color} opacity={0.85} />
                              {w > 14 && (
                                <text x={xPos + 3} y={yPos + 8} fontSize={7} fill={t.noteText} fontWeight={700}>{r.lyric}</text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                )}

                {/* Note List */}
                <div style={{ marginBottom: "24px", background: t.bgPanel, borderRadius: "10px", border: `1px solid ${t.border}`, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`, fontSize: "12px", color: t.textDim, letterSpacing: "2px" }}>
                    GENERATED NOTES ({generated.filter(n => n.type === "note").length}音)
                  </div>
                  <div style={{ maxHeight: "200px", overflowY: "auto", padding: "8px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {generated.filter(n => n.type === "note").map((n, i) => {
                        const nc = sectionColorMap[n.section] || t.textDim;
                        return (
                          <span key={i} style={{
                            display: "inline-block", padding: "3px 8px", borderRadius: "4px", fontSize: "11px",
                            background: `${nc}15`, color: nc, border: `1px solid ${nc}33`
                          }}>
                            {n.accent && <span title="アクセント" style={{ color: isDark ? "#ff0" : "#b8860b" }}>&gt;</span>}
                            {n.shakuri && <span title="しゃくり" style={{ color: isDark ? "#0f0" : "#2e7d32" }}>↗</span>}
                            {n.lyric}:{noteName(n.noteNum)}
                            {n.fall && <span title="フォール" style={{ color: isDark ? "#f80" : "#e65100" }}>↘</span>}
                            {n.vibrato && <span title="ビブラート" style={{ color: isDark ? "#f0f" : "#7b1fa2" }}>~</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Singer select for UST export */}
                {singers.length > 0 && (
                  <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", color: t.textMuted }}>UST出力シンガー:</span>
                    <select
                      value={ustSingerIdx}
                      onChange={e => setUstSingerIdx(Number(e.target.value))}
                      style={{ padding: "6px 10px", background: t.bgInput, border: `1px solid ${t.borderInput}`, borderRadius: "6px", color: t.text, fontFamily: "inherit", fontSize: "13px" }}
                    >
                      {singers.map((s, i) => (
                        <option key={i} value={i}>{s.name || `シンガー${i + 1}`}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: "10px", color: t.textFaint }}>SVP・MIDIは全シンガー一括出力</span>
                  </div>
                )}

                {/* Export Buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <button
                    onClick={handleExportUST}
                    style={{
                      padding: "20px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit",
                      background: `${t.accent1}15`, border: `2px solid ${t.accent1}66`,
                      color: t.accent1, fontSize: "15px", fontWeight: 700,
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>📄</div>
                    <div>UST 出力</div>
                    <div style={{ fontSize: "10px", color: t.textFaint, marginTop: "4px" }}>→ OpenUtau{singers.length > 0 ? ` (${singers[ustSingerIdx]?.name || ""})` : ""}</div>
                  </button>
                  <button
                    onClick={handleExportSVP}
                    style={{
                      padding: "20px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit",
                      background: `${t.accent4}15`, border: `2px solid ${t.accent4}66`,
                      color: t.accent4, fontSize: "15px", fontWeight: 700,
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎤</div>
                    <div>SVP 出力</div>
                    <div style={{ fontSize: "10px", color: t.textFaint, marginTop: "4px" }}>→ Synthesizer V</div>
                  </button>
                  <button
                    onClick={handleExportMIDI}
                    style={{
                      padding: "20px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit",
                      background: `${t.accent2}15`, border: `2px solid ${t.accent2}66`,
                      color: t.accent2, fontSize: "15px", fontWeight: 700,
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎹</div>
                    <div>MIDI 出力</div>
                    <div style={{ fontSize: "10px", color: t.textFaint, marginTop: "4px" }}>→ DAW</div>
                  </button>
                </div>

                {/* Usage Instructions */}
                <div style={{ marginTop: "24px", padding: "16px 20px", background: t.bgInput, borderRadius: "10px", borderLeft: `3px solid ${t.accent3}`, fontSize: "12px", lineHeight: 2, color: t.textMuted }}>
                  <div style={{ color: t.accent3, fontWeight: 700, marginBottom: "6px", fontSize: "13px" }}>📋 使い方</div>
                  <div><span style={{ color: t.accent1 }}>UST</span> → OpenUtau で開く。</div>
                  <div><span style={{ color: t.accent4 }}>SVP</span> → Synthesizer V で開く。</div>
                  <div><span style={{ color: t.accent2 }}>MIDI</span> → DAW で開く。Tr2=メロディ, Tr3=コード, Tr4=ベース, Tr5=ギター, Tr6=ピアノ, Tr7=ストリングス, Tr8=ドラム。</div>
                  <div style={{ color: t.textFaint, marginTop: "4px" }}>※ メロディが気に入らなければシード値を調整して再生成</div>
                </div>
              </>
            )}

            {!generated && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: t.textDisabled }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎵</div>
                <div style={{ fontSize: "14px" }}>設定と歌詞を入れたら「メロディ生成」押してください</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* About Modal */}
      {showAbout && (
        <div
          onClick={() => setShowAbout(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark ? "#111" : "#fff", color: t.text,
              border: `1px solid ${t.accent1}66`, borderRadius: "12px",
              padding: "32px", maxWidth: "480px", width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowAbout(false)}
              style={{
                position: "absolute", top: "12px", right: "12px",
                background: "transparent", border: "none", cursor: "pointer",
                color: t.textMuted, fontSize: "20px", lineHeight: 1,
                padding: "4px 8px", borderRadius: "4px",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.target.style.color = t.text; e.target.style.background = `${t.accent1}22`; }}
              onMouseLeave={e => { e.target.style.color = t.textMuted; e.target.style.background = "transparent"; }}
            >✕</button>

            <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 900, color: t.accent1 }}>
              ちふちふジェネレーター
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: t.textDim, letterSpacing: "2px" }}>
              chifuchifu generator
            </p>
            <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.7 }}>
              UST / SVP / MIDI ファイルを自動生成するWebアプリです。
              歌詞とコード進行からメロディを生成し、OpenUtau / Synthesizer V / DAW で使える形式で出力できます。
            </p>

            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: "12px", marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: t.textDim, letterSpacing: "2px", marginBottom: "6px", fontWeight: 700 }}>作者</div>
              <div style={{ fontSize: "14px", color: t.text }}>hurumoon</div>
            </div>

            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: "12px", marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: t.textDim, letterSpacing: "2px", marginBottom: "6px", fontWeight: 700 }}>共有</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => {
                    const text = "ちふちふジェネレーター - UST/MIDI/SVPファイルを自動生成するWebアプリ";
                    const url = window.location.href;
                    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                    window.open(xUrl, "_blank");
                  }}
                  style={{
                    padding: "6px 14px", borderRadius: "6px", cursor: "pointer",
                    fontFamily: "inherit", fontSize: "12px", fontWeight: 700,
                    background: "transparent", border: `1px solid ${t.accent1}66`, color: t.text,
                    display: "flex", alignItems: "center", gap: "6px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${t.accent1}22`; e.currentTarget.style.borderColor = t.accent1; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${t.accent1}66`; }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Xで共有
                </button>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: "12px", marginBottom: "12px", fontSize: "12px", color: t.textMuted, lineHeight: 1.8 }}>
              「Synthesizer V」はDreamtonics株式会社が開発した歌声合成ソフトウェアです。<br/>「花隈千冬」は合同会社TOKYO6 ENTERTAINMENTが展開するキャラクターおよびSynthesizer V専用歌唱データベースです。
            </div>

            <div style={{ fontSize: "13px", color: t.textMuted, lineHeight: 1.8 }}>
              <div>Version: 1.0.0</div>
              <div>Stack: React + Vite</div>
              <div>License: MIT</div>
            </div>
            <button
              onClick={() => setShowAbout(false)}
              style={{
                marginTop: "20px", padding: "8px 24px", borderRadius: "6px", cursor: "pointer",
                fontFamily: "inherit", fontSize: "13px", fontWeight: 700,
                background: `${t.accent1}`, border: "none", color: t.genBtnText,
                transition: "all 0.2s",
              }}
            >閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
