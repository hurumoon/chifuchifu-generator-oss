#!/usr/bin/env python3
"""
MIDI → ちふちふジェネレーター JSON 変換スクリプト

MIDIファイルを読み込み、noteHint / durationHint / lyricHint 配列を含む
プロジェクトJSONを生成する。mido を使用。

使い方:
  python midi_to_json.py input.mid -o output.json
  python midi_to_json.py input.mid --track 1 --no-sections
"""

import argparse
import json
import sys

import mido

TPQN = 480  # ちふちふジェネレーターの基準tick/quarter note

# --- キー定義 (constants.js と同一) ---
# scale は pitch class (0-11) のセットで保持
KEYS = {
    # マイナーキー
    "Am":   {"scale": {9, 11, 0, 2, 4, 5, 7}},
    "Bbm":  {"scale": {10, 0, 1, 3, 5, 6, 8}},
    "Bm":   {"scale": {11, 1, 2, 4, 6, 7, 9}},
    "Cm":   {"scale": {0, 2, 3, 5, 7, 8, 10}},
    "C#m":  {"scale": {1, 3, 4, 6, 8, 9, 11}},
    "Dm":   {"scale": {2, 4, 5, 7, 9, 10, 0}},
    "Ebm":  {"scale": {3, 5, 6, 8, 10, 11, 1}},
    "Em":   {"scale": {4, 6, 7, 9, 11, 0, 2}},
    "Fm":   {"scale": {5, 7, 8, 10, 0, 1, 3}},
    "F#m":  {"scale": {6, 8, 9, 11, 1, 2, 4}},
    "Gm":   {"scale": {7, 9, 10, 0, 2, 3, 5}},
    "G#m":  {"scale": {8, 10, 11, 1, 3, 4, 6}},
    # メジャーキー
    "C":    {"scale": {0, 2, 4, 5, 7, 9, 11}},
    "Db":   {"scale": {1, 3, 5, 6, 8, 10, 0}},
    "D":    {"scale": {2, 4, 6, 7, 9, 11, 1}},
    "Eb":   {"scale": {3, 5, 7, 8, 10, 0, 2}},
    "E":    {"scale": {4, 6, 8, 9, 11, 1, 3}},
    "F":    {"scale": {5, 7, 9, 10, 0, 2, 4}},
    "F#":   {"scale": {6, 8, 10, 11, 1, 3, 5}},
    "G":    {"scale": {7, 9, 11, 0, 2, 4, 6}},
    "Ab":   {"scale": {8, 10, 0, 1, 3, 5, 7}},
    "A":    {"scale": {9, 11, 1, 2, 4, 6, 8}},
    "Bb":   {"scale": {10, 0, 2, 3, 5, 7, 9}},
    "B":    {"scale": {11, 1, 3, 4, 6, 8, 10}},
}

SECTION_TYPES = [
    {"type": "A", "label": "Aメロ"},
    {"type": "B", "label": "Bメロ"},
    {"type": "chorus", "label": "サビ"},
    {"type": "A", "label": "Aメロ"},
    {"type": "B", "label": "Bメロ"},
    {"type": "chorus", "label": "サビ"},
    {"type": "bridge", "label": "Cメロ"},
    {"type": "chorus", "label": "ラスサビ"},
]


def detect_key(notes):
    """ピッチクラスの重み付きマッチングでキーを検出する。"""
    if not notes:
        return "Am"

    pc_weights = [0.0] * 12
    for n in notes:
        pc = n["pitch"] % 12
        pc_weights[pc] += n["duration"]

    total = sum(pc_weights)
    if total == 0:
        return "Am"

    best_key = "Am"
    best_score = -1.0

    for key_id, key_def in KEYS.items():
        score = sum(pc_weights[pc] for pc in key_def["scale"])
        match_rate = score / total
        if match_rate > best_score:
            best_score = match_rate
            best_key = key_id

    return best_key


def parse_midi(midi_path):
    """mido でMIDIファイルを解析し、トラック別のノートと歌詞・テンポを返す。

    Returns:
        ticks_per_beat: MIDIファイルの resolution
        bpm: 最初のテンポ（デフォルト120）
        tracks: list of {"notes": [...], "is_drum": bool}
        lyrics: list of {"tick": int, "text": str}
    """
    mid = mido.MidiFile(midi_path)
    ticks_per_beat = mid.ticks_per_beat
    bpm = 120
    lyrics = []

    # 全トラックからテンポと歌詞を収集（メタイベントは通常トラック0に集中）
    for track in mid.tracks:
        abs_tick = 0
        for msg in track:
            abs_tick += msg.time
            if msg.type == "set_tempo":
                bpm = round(mido.tempo2bpm(msg.tempo))
            elif msg.type == "lyrics":
                text = msg.text.strip() if hasattr(msg, "text") else ""
                if text:
                    lyrics.append({"tick": abs_tick, "text": text})

    # 各トラックからノートを抽出
    tracks = []
    for track in mid.tracks:
        abs_tick = 0
        # channel → noteNumber → onset_tick のマップ
        active_notes = {}
        track_notes = []
        is_drum = False

        for msg in track:
            abs_tick += msg.time

            if msg.type == "note_on" and msg.velocity > 0:
                ch = msg.channel
                if ch == 9:
                    is_drum = True
                    continue
                key = (ch, msg.note)
                # 同じキーが既にアクティブなら先に閉じる
                if key in active_notes:
                    onset = active_notes[key]
                    dur = abs_tick - onset
                    if dur > 0:
                        track_notes.append({
                            "pitch": msg.note,
                            "onset": onset,
                            "duration": dur,
                            "channel": ch,
                        })
                active_notes[key] = abs_tick

            elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
                ch = msg.channel
                if ch == 9:
                    continue
                key = (ch, msg.note)
                if key in active_notes:
                    onset = active_notes[key]
                    dur = abs_tick - onset
                    if dur > 0:
                        track_notes.append({
                            "pitch": msg.note,
                            "onset": onset,
                            "duration": dur,
                            "channel": ch,
                        })
                    del active_notes[key]

        if track_notes:
            tracks.append({"notes": track_notes, "is_drum": is_drum})

    return ticks_per_beat, bpm, tracks, lyrics


def select_melody_track(tracks, track_index=None):
    """メロディトラック（ノートリスト）を選択する。"""
    non_drum = [(i, t) for i, t in enumerate(tracks) if not t["is_drum"]]

    if not non_drum:
        raise ValueError("メロディトラックが見つかりません（非ドラムトラックがありません）")

    if track_index is not None:
        if track_index < 0 or track_index >= len(tracks):
            raise ValueError(
                f"トラック番号 {track_index} は範囲外です（0-{len(tracks) - 1}）"
            )
        t = tracks[track_index]
        if t["is_drum"]:
            raise ValueError(f"トラック {track_index} はドラムトラックです")
        return t["notes"]

    # ノート数最多の非ドラムトラック
    best = max(non_drum, key=lambda x: len(x[1]["notes"]))
    return best[1]["notes"]


def rescale_ticks(notes, src_tpqn):
    """ノートのtick値をソースTPQNから480TPQNにスケーリングする。"""
    if src_tpqn == TPQN:
        return notes

    scale = TPQN / src_tpqn
    for n in notes:
        n["onset"] = round(n["onset"] * scale)
        n["duration"] = max(round(n["duration"] * scale), 1)
    return notes


def rescale_lyrics(lyrics, src_tpqn):
    """歌詞のtick値をスケーリングする。"""
    if src_tpqn == TPQN:
        return lyrics
    scale = TPQN / src_tpqn
    for l in lyrics:
        l["tick"] = round(l["tick"] * scale)
    return lyrics


def midi_to_json(midi_path, track_index=None, section_break_beats=6,
                 default_lyric="ら", no_sections=False):
    """MIDIファイルをちふちふジェネレーターJSON形式に変換する。"""
    ticks_per_beat, bpm, tracks, lyrics = parse_midi(midi_path)

    if not tracks:
        return {"bpm": bpm, "keyId": "Am", "progId": "komuro", "rhythmId": "auto", "sections": []}

    # メロディトラック選択
    melody_notes = select_melody_track(tracks, track_index)

    # TPQ変換 (MIDI resolution → 480)
    melody_notes = rescale_ticks(melody_notes, ticks_per_beat)
    lyrics = rescale_lyrics(lyrics, ticks_per_beat)

    # 開始時間でソート
    melody_notes.sort(key=lambda n: n["onset"])

    if not melody_notes:
        return {"bpm": bpm, "keyId": "Am", "progId": "komuro", "rhythmId": "auto", "sections": []}

    # 歌詞をノートに割り当て
    if lyrics:
        lyric_idx = 0
        for note in melody_notes:
            if lyric_idx < len(lyrics):
                note["lyric"] = lyrics[lyric_idx]["text"]
                lyric_idx += 1
            else:
                note["lyric"] = default_lyric
    else:
        for note in melody_notes:
            note["lyric"] = default_lyric

    # キー検出
    key_id = detect_key(melody_notes)

    # セクション分割
    if no_sections:
        phrases = [{"start": 0, "end": len(melody_notes) - 1}]
    else:
        section_break_ticks = section_break_beats * TPQN
        phrases = []
        phrase_start = 0
        for i in range(1, len(melody_notes)):
            prev_end = melody_notes[i - 1]["onset"] + melody_notes[i - 1]["duration"]
            gap = melody_notes[i]["onset"] - prev_end
            if gap > section_break_ticks:
                phrases.append({"start": phrase_start, "end": i - 1})
                phrase_start = i
        phrases.append({"start": phrase_start, "end": len(melody_notes) - 1})

    # 各フレーズからセクションを構築
    measure_ticks = TPQN * 4
    sections = []
    section_id = 1

    for pi, phrase in enumerate(phrases):
        phrase_notes = melody_notes[phrase["start"]:phrase["end"] + 1]
        first_onset = phrase_notes[0]["onset"]
        last_end = phrase_notes[-1]["onset"] + phrase_notes[-1]["duration"]
        duration_ticks = last_end - first_onset
        measures = max(2, round(duration_ticks / measure_ticks))

        note_hint = []
        duration_hint = []
        lyric_hint = []
        rest_hint = []
        display_lyrics = []
        prev_end = first_onset
        note_idx = 0

        for n in phrase_notes:
            # ノート前のギャップ → 休符
            gap = n["onset"] - prev_end
            if gap > TPQN * 0.3:
                rest_hint.append({"beforeIndex": note_idx, "length": gap})
                display_lyrics.append("♪")

            note_hint.append(n["pitch"])
            duration_hint.append(n["duration"])
            lyric_hint.append(n["lyric"])
            display_lyrics.append("ー" if n["lyric"] == "-" else n["lyric"])
            note_idx += 1

            prev_end = n["onset"] + n["duration"]

        # セクションタイプ決定
        st = SECTION_TYPES[pi % len(SECTION_TYPES)]

        section = {
            "id": section_id,
            "type": st["type"],
            "label": st["label"],
            "measures": measures,
            "lyrics": "".join(display_lyrics),
            "keyId": key_id,
            "noteHint": note_hint,
            "durationHint": duration_hint,
            "lyricHint": lyric_hint,
        }
        if rest_hint:
            section["restHint"] = rest_hint

        sections.append(section)
        section_id += 1

    return {
        "bpm": bpm,
        "keyId": key_id,
        "progId": "komuro",
        "rhythmId": "auto",
        "sections": sections,
    }


def main():
    parser = argparse.ArgumentParser(
        description="MIDI → ちふちふジェネレーター JSON 変換",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
例:
  python midi_to_json.py song.mid -o song.json
  python midi_to_json.py song.mid --track 0 --no-sections
  python midi_to_json.py song.mid --section-break-beats 8 --default-lyric あ
""",
    )
    parser.add_argument("midi_file", help="入力MIDIファイルのパス")
    parser.add_argument("-o", "--output", help="出力JSONファイルのパス（省略時はstdout）")
    parser.add_argument(
        "-t", "--track", type=int, default=None,
        help="トラック番号（省略時はノート数最多の非ドラムトラック）",
    )
    parser.add_argument(
        "--section-break-beats", type=float, default=6,
        help="セクション分割の閾値（拍数、デフォルト: 6）",
    )
    parser.add_argument(
        "--default-lyric", default="ら",
        help="歌詞がない場合のデフォルト文字（デフォルト: ら）",
    )
    parser.add_argument(
        "--no-sections", action="store_true",
        help="セクション分割せず全ノートを1セクションに",
    )

    args = parser.parse_args()

    result = midi_to_json(
        args.midi_file,
        track_index=args.track,
        section_break_beats=args.section_break_beats,
        default_lyric=args.default_lyric,
        no_sections=args.no_sections,
    )

    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
            f.write("\n")
        print(f"出力: {args.output}", file=sys.stderr)
        # サマリー表示
        for sec in result["sections"]:
            n = len(sec["noteHint"])
            print(
                f"  セクション{sec['id']} [{sec['label']}]: "
                f"{n}ノート, {sec['measures']}小節",
                file=sys.stderr,
            )
    else:
        print(output)


if __name__ == "__main__":
    main()
