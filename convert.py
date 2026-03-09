#!/usr/bin/env python3
"""
ボーカルMP3 → ちふちふジェネレーター用 import JSON 変換スクリプト

使い方:
    python convert.py vocal.mp3

依存ライブラリ:
    pip install basic-pitch openai-whisper librosa soundfile numpy
"""

import argparse
import json
import sys
from pathlib import Path

import librosa
import numpy as np


# ── 定数 ──────────────────────────────────────────────
TPQN = 480              # ticks per quarter note
MIDI_MIN = 48           # クランプ下限
MIDI_MAX = 79           # クランプ上限
SILENCE_GAP_SEC = 0.5   # セクション区切りとみなす無音区間(秒)

SECTION_LABELS = [
    ("intro", "イントロ"),
    ("A", "Aメロ"),
    ("B", "Bメロ"),
    ("chorus", "サビ"),
    ("bridge", "ブリッジ"),
    ("outro", "アウトロ"),
]

# キー判定用スケール (ルート=0 からの半音オフセット)
MINOR_SCALE = {0, 2, 3, 5, 7, 8, 10}
MAJOR_SCALE = {0, 2, 4, 5, 7, 9, 11}

KEY_NAMES_MINOR = [
    "Am", "Bbm", "Bm", "Cm", "C#m", "Dm",
    "Ebm", "Em", "Fm", "F#m", "Gm", "G#m",
]
KEY_NAMES_MAJOR = [
    "C", "Db", "D", "Eb", "E", "F",
    "F#", "G", "Ab", "A", "Bb", "B",
]


def clamp_midi(note: int) -> int:
    return max(MIDI_MIN, min(MIDI_MAX, note))


def sec_to_tick(duration_sec: float, bpm: float) -> int:
    """秒をtickに変換"""
    return max(1, int(duration_sec * (bpm / 60) * TPQN))


def detect_key(midi_notes: list[int]) -> str:
    """MIDIノート列からキーを推定する"""
    if not midi_notes:
        return "Am"
    pitch_classes = [n % 12 for n in midi_notes]
    hist = [0] * 12
    for pc in pitch_classes:
        hist[pc] += 1

    best_key = "Am"
    best_score = -1
    for root in range(12):
        minor_score = sum(hist[(root + offset) % 12] for offset in MINOR_SCALE)
        if minor_score > best_score:
            best_score = minor_score
            best_key = KEY_NAMES_MINOR[root]
        major_score = sum(hist[(root + offset) % 12] for offset in MAJOR_SCALE)
        if major_score > best_score:
            best_score = major_score
            best_key = KEY_NAMES_MAJOR[root]
    return best_key


# ── ① ピッチ検出 ────────────────────────────────────────
def extract_notes(audio_path: str):
    """basic-pitchでMIDIノート列を抽出する
    Returns: [(start_sec, end_sec, pitch_midi, velocity), ...]
    """
    from basic_pitch.inference import predict

    print("① ピッチ検出中 (basic-pitch) ...")
    model_output, midi_data, note_events = predict(audio_path)

    notes = []
    for onset, end, pitch, vel, *_ in note_events:
        notes.append((float(onset), float(end), int(round(pitch)), float(vel)))

    notes.sort(key=lambda x: x[0])
    print(f"   {len(notes)} 個のノートを検出")
    return notes


# ── ② 音声認識 ──────────────────────────────────────────
def transcribe_lyrics(audio_path: str):
    """Whisperで歌詞を音節レベルで取得する
    Returns: [(word, start_sec, end_sec), ...]
    """
    import whisper

    print("② 歌詞認識中 (Whisper large) ...")
    model = whisper.load_model("large")
    result = model.transcribe(audio_path, language="ja", word_timestamps=True)

    words = []
    for segment in result["segments"]:
        for w in segment.get("words", []):
            words.append((w["word"].strip(), float(w["start"]), float(w["end"])))

    words = [(w, s, e) for w, s, e in words if w]
    print(f"   {len(words)} 個の音節を認識")
    return words


# ── ③ アライメント ─────────────────────────────────────
def align_notes_and_lyrics(notes, words):
    """音符と歌詞を時刻の重なりベースで対応付ける
    Returns: [(start_sec, end_sec, pitch_midi, lyric), ...]
    """
    print("③ アライメント中 ...")
    aligned = []
    for start, end, pitch, vel in notes:
        note_mid = (start + end) / 2
        best_word = ""
        best_dist = float("inf")
        for word, ws, we in words:
            # 重なりチェック
            overlap_start = max(start, ws)
            overlap_end = min(end, we)
            if overlap_start < overlap_end:
                dist = abs(note_mid - (ws + we) / 2)
                if dist < best_dist:
                    best_dist = dist
                    best_word = word
            else:
                # 重ならない場合は中点の距離
                word_mid = (ws + we) / 2
                dist = abs(note_mid - word_mid)
                if dist < best_dist and dist < 0.5:
                    best_dist = dist
                    best_word = word
        if not best_word:
            best_word = "ら"
        aligned.append((start, end, pitch, best_word))
    print(f"   {len(aligned)} 個のノートをアライメント")
    return aligned


# ── ④ BPM検出・tick変換 ──────────────────────────────────
def detect_bpm(audio_path: str) -> float:
    """librosaでBPMを検出する"""
    print("④ BPM検出中 (librosa) ...")
    y, sr = librosa.load(audio_path, sr=22050)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.round(tempo[0] if hasattr(tempo, '__len__') else tempo))
    print(f"   BPM = {bpm}")
    return bpm


# ── ⑤ セクション分割 & JSON生成 ──────────────────────────
def split_sections(aligned_notes, bpm):
    """無音区間(0.5秒以上)でセクションに分割する"""
    if not aligned_notes:
        return []

    sections = []
    current = [aligned_notes[0]]

    for i in range(1, len(aligned_notes)):
        gap = aligned_notes[i][0] - aligned_notes[i - 1][1]
        if gap >= SILENCE_GAP_SEC:
            sections.append(current)
            current = []
        current.append(aligned_notes[i])
    if current:
        sections.append(current)

    return sections


def build_json(sections_notes, bpm):
    """セクションリストからJSON構造を生成する"""
    print("⑤ JSON生成中 ...")
    all_pitches = [n[2] for sec in sections_notes for n in sec]
    key_id = detect_key(all_pitches)
    print(f"   キー = {key_id}")

    sections = []
    for i, sec_notes in enumerate(sections_notes):
        label_idx = i % len(SECTION_LABELS)
        sec_type, sec_label = SECTION_LABELS[label_idx]

        note_hint = []
        duration_hint = []
        lyric_hint = []
        rest_hint = []

        for start, end, pitch, lyric in sec_notes:
            duration_sec = end - start
            note_hint.append(clamp_midi(pitch))
            duration_hint.append(sec_to_tick(duration_sec, bpm))
            lyric_hint.append(lyric)
            rest_hint.append(False)

        # measures = セクション全体のtick数 / (TPQN * 4) (4拍子)
        total_ticks = sum(duration_hint)
        measures = max(2, round(total_ticks / (TPQN * 4)))

        sections.append({
            "type": sec_type,
            "label": sec_label,
            "measures": measures,
            "noteHint": note_hint,
            "durationHint": duration_hint,
            "lyricHint": lyric_hint,
            "restHint": rest_hint,
        })

    return {
        "bpm": int(bpm),
        "keyId": key_id,
        "sections": sections,
    }


# ── メイン ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="ボーカルMP3からちふちふジェネレーター用JSONを生成する"
    )
    parser.add_argument("input", help="入力MP3ファイルのパス")
    parser.add_argument(
        "-o", "--output", help="出力JSONファイルのパス (デフォルト: 入力ファイル名.json)"
    )
    parser.add_argument(
        "--whisper-model", default="large", help="Whisperモデル名 (デフォルト: large)"
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"エラー: ファイルが見つかりません: {input_path}", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output) if args.output else input_path.with_suffix(".json")

    print(f"入力: {input_path}")
    print(f"出力: {output_path}")
    print()

    # ① ピッチ検出
    notes = extract_notes(str(input_path))

    # ② 歌詞認識
    words = transcribe_lyrics(str(input_path))

    # ③ アライメント
    aligned = align_notes_and_lyrics(notes, words)

    # ④ BPM検出
    bpm = detect_bpm(str(input_path))

    # ⑤ セクション分割 & JSON生成
    sections = split_sections(aligned, bpm)
    if not sections:
        print("エラー: ノートが検出されませんでした。", file=sys.stderr)
        sys.exit(1)

    result = build_json(sections, bpm)

    # 出力
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print()
    print(f"完了! {output_path} に出力しました。")
    total_notes = sum(len(s["noteHint"]) for s in result["sections"])
    print(f"  BPM: {result['bpm']}")
    print(f"  キー: {result['keyId']}")
    print(f"  セクション数: {len(result['sections'])}")
    print(f"  総ノート数: {total_notes}")


if __name__ == "__main__":
    main()
