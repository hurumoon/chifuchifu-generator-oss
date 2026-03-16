---
name: chifu-json-gen
description: "Generate import JSON for the ちふちふジェネレーター (chifu-chifu generator), a browser-based tool that creates UST/SVP vocal synthesis files for SynthesizerV. Use this skill whenever the user asks to create a song JSON, make a chifu-chifu JSON, generate vocal data for SynthV, transcribe a melody into the generator format, or mentions ちふちふ, SVP, UST, SynthesizerV song creation. Also trigger when the user provides song lyrics with a melody request, asks for MIDI note mapping of a known tune, or wants to convert sheet music / chord charts into the generator's import format."
---

# ちふちふジェネレーター JSON生成スキル

This skill generates well-structured import JSON for the ちふちふジェネレーター — a React/Vite
app that produces SVP (SynthesizerV project) files from a high-level song description.

## When to use

- User asks to create JSON for ちふちふジェネレーター
- User wants to transcribe a known melody (e.g. nursery rhyme, folk song) into the generator format
- User provides lyrics and asks for SVP/UST generation data
- User mentions「ちふちふ」「花隈千冬」「SynthesizerV」in a song-creation context

## JSON Schema

### Top-level (all fields optional)

| Field | Type | Description |
|-------|------|-------------|
| `bpm` | number | Tempo (beats per minute) |
| `keyId` | string | Key signature (see Key Reference below). Use `"auto"` for random selection. |
| `progId` | string | Chord progression preset ID (see Progression Reference below). Use `"auto"` for random. |
| `rhythmId` | string | Rhythm pattern ID (see Rhythm Reference below). Use `"auto"` for random. |
| `singers` | array | Multi-singer config (see below). Omit for single-singer mode. |
| `sections` | array | Array of section objects (see below) |

### Key Reference (`keyId`)

**Major (12):** `"C"`, `"Db"`, `"D"`, `"Eb"`, `"E"`, `"F"`, `"F#"`, `"G"`, `"Ab"`, `"A"`, `"Bb"`, `"B"`
**Minor (12):** `"Am"`, `"Bbm"`, `"Bm"`, `"Cm"`, `"C#m"`, `"Dm"`, `"Ebm"`, `"Em"`, `"Fm"`, `"F#m"`, `"Gm"`, `"G#m"`
**Auto:** `"auto"` - ランダムに選択

### Chord Progression Reference (`progId`)

| ID | Name | Description |
|----|------|-------------|
| `"komuro"` | 小室進行 | 疾走感・ボカロ王道 |
| `"oudou"` | 王道進行 | エモい・泣ける |
| `"canon"` | カノン進行 | 壮大・感動系 |
| `"jttou"` | Just the Two of Us | おしゃれ・チル |
| `"pop4"` | 丸サ進行 | 丸の内サディスティック・おしゃれ |
| `"threechord"` | スリーコード | シンプル・ロック |
| `"halftime"` | ハーフタイム | 切ない・浮遊感 |
| `"descent"` | 下降進行 | ドラマチック・J-POP |
| `"yorunikakeru"` | 夜に駆ける進行 | 疾走・エモーショナル |
| `"auto"` | 自動 | ランダムに選択 |

### Rhythm Pattern Reference (`rhythmId`)

| ID | Name | Description |
|----|------|-------------|
| `"even"` | 均等 | すべて同じ長さ |
| `"swing"` | スウィング | 長-短の繰り返し |
| `"march"` | マーチ | 短-短-長 |
| `"synco"` | シンコペ | 短-長-短 |
| `"dotted"` | 付点 | 付点8分+16分の繰り返し |
| `"gallop"` | ギャロップ | 短-短-長（疾走感） |
| `"shuffle"` | シャッフル | 跳ねるリズム |
| `"ballad"` | バラード | ゆったり長短 |
| `"chouaku"` | 跳躍型 | 大跳躍のドラマチックなメロディ |
| `"nagare"` | 流れ型 | 穏やかな順次進行メロディ |
| `"shissou"` | 疾走型 | 細かいジグザグの疾走メロディ |
| `"auto"` | 自動 | ランダムに選択 |

### Accompaniment Pattern Reference (`accompPatterns`)

Per-section override of accompaniment instrument patterns. Keys are instrument types, values are pattern names.

| Instrument | Available Patterns | Description |
|------------|-------------------|-------------|
| `"bass"` | `"standard"`, `"walking"`, `"halftime"`, `"syncopated"` | ベースライン |
| `"guitar"` | `"fullStrum"`, `"downOnly"`, `"sparse"`, `"syncopated"` | ギターストローク |
| `"piano"` | `"arpeggio8th"`, `"blocky"`, `"arpeggioUp"`, `"sparse"` | ピアノ伴奏 |
| `"strings"` | `"wholePad"`, `"halfPad"`, `"swellPad"` | ストリングスパッド |
| `"chord"` | `"wholeNote"`, `"halfHalf"`, `"rhythmic"` | コードバッキング |
| `"drums"` | `"basic"`, `"driving"`, `"halftime"`, `"sparse"`, `"fillBasic"`, `"fillBig"` | ドラムパターン |

**Default patterns by section type:**

| Section | bass | guitar | piano | strings | drums | chord |
|---------|------|--------|-------|---------|-------|-------|
| intro | halftime | sparse | sparse | wholePad | halftime | wholeNote |
| A | standard | downOnly | blocky | wholePad | basic | wholeNote |
| B | syncopated | syncopated | arpeggioUp | halfPad | basic | halfHalf |
| chorus | walking | fullStrum | arpeggio8th | halfPad | driving | halfHalf |
| bridge | syncopated | syncopated | arpeggioUp | swellPad | basic | rhythmic |
| serif | halftime | sparse | sparse | wholePad | sparse | wholeNote |
| interlude | halftime | sparse | blocky | wholePad | sparse | wholeNote |
| outro | halftime | sparse | sparse | wholePad | halftime | wholeNote |

Only specify instruments you want to override; unspecified instruments use the section-type default.

**Example:**
```json
{
  "type": "chorus",
  "accompPatterns": {
    "drums": "halftime",
    "bass": "syncopated"
  }
}
```

### Singer object (for `singers` array)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Singer identifier used in lyrics tags (e.g. `"千冬"`) |
| `database` | string | - | SynthesizerV voice database name (e.g. `"Hanakuma Chifuyu AI"`) |

When `singers` is provided:
- SVP export creates one track per singer with the specified database
- MIDI export assigns each singer to a separate channel
- UST export allows per-singer selection
- Lyrics use `[name]` tags to assign phrases to specific singers

### Section object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | - | Section identifier (auto-assigned if omitted) |
| `type` | string | **Yes** | `"intro"`, `"A"`, `"B"`, `"chorus"`, `"bridge"`, `"serif"`, `"interlude"`, `"outro"` |
| `label` | string | - | Display name (e.g. `"Aメロ"`, `"サビ"`, `"アウトロ"`) |
| `measures` | number | - | Measure count, 2-32 (default 8) |
| `lyrics` | string | - | Lyrics text with expression markup (see notation below) |
| `keyId` | string | - | Per-section key override |
| `rhythmId` | string | - | Per-section rhythm pattern override |
| `noteHint` | number[] | - | MIDI note numbers for each syllable |
| `durationHint` | number[] | - | Duration of each note in ticks |
| `lyricHint` | string[] | - | Per-syllable lyrics |
| `restHint` | object[] | - | Rest specs: `{beforeIndex, length}` (see below) |
| `customChords` | string[] | - | Chord progression for this section (one per measure) |
| `accompPatterns` | object | - | Per-section accompaniment pattern overrides (see Accompaniment Pattern Reference below) |
| `singerHint` | string[] | - | Per-note singer name assignments (multi-singer) |
| `detuneHint` | number[] | - | Per-note detune values |
| `expressionHint` | object[] | - | Per-note expression attributes (see below) |
| `systemAttributesHint` | object[] | - | Per-note system attributes (advanced) |
| `vibratoEnvHint` | array | - | Vibrato envelope control points (for first note) |

**Important:** `noteHint`, `durationHint`, `lyricHint` must all have the same length.
If omitted, the generator auto-creates them from `lyrics`.

### restHint format

Each element specifies a rest to insert:
```json
{ "beforeIndex": 3, "length": 480 }
```
- `beforeIndex`: Insert rest before the note at this index
- `length`: Rest duration in ticks

### expressionHint format

Each element is an object with optional fields:
```json
{
  "vibrato": true,
  "shakuri": 2,
  "fall": 2,
  "dynamics": 100,
  "voicingMode": "talk",
  "breathinessOffset": 0,
  "accent": true,
  "tension": true
}
```
- `vibrato` (boolean) - Enable vibrato
- `shakuri` (number 1-3) - Pitch scoop depth
- `fall` (number 1-3) - Fall-off depth
- `dynamics` (number 0-127) - Note intensity
- `voicingMode` (`"talk"`, `"whisper"`, `"p"`, or null) - Voice style
- `breathinessOffset` (number) - Breathiness adjustment
- `accent` (boolean) - Accent flag
- `tension` (boolean) - Tension flag

### Section types

| Type | Label | Description |
|------|-------|-------------|
| `"intro"` | イントロ | 楽曲の導入部分 |
| `"A"` | Aメロ | メインのヴァース |
| `"B"` | Bメロ | 展開部・対比セクション |
| `"chorus"` | サビ | メインフック・リフレイン |
| `"bridge"` | Cメロ | ブリッジ・転換部 |
| `"serif"` | セリフ | 語り・トークスタイル（フラットピッチ） |
| `"interlude"` | 間奏 | 楽器間奏 |
| `"outro"` | アウトロ | エンディング |

## Tick Duration Reference

At any BPM, tick values are relative to the beat (quarter note = 480 ticks).

| Note value | Ticks | Japanese |
|-----------|-------|----------|
| Whole note | 1920 | 全音符 |
| Dotted half | 1440 | 付点二分音符 |
| Half note | 960 | 二分音符 |
| Dotted quarter | 720 | 付点四分音符 |
| Quarter note | 480 | 四分音符 |
| Dotted eighth | 360 | 付点八分音符 |
| Eighth note | 240 | 八分音符 |
| Sixteenth note | 120 | 十六分音符 |
| Triplet quarter | 320 | 三連四分音符 |
| Triplet eighth | 160 | 三連八分音符 |

## Lyrics Notation

The `lyrics` field supports rich expression markup. This is the primary way to add musical expression
without manually specifying every noteHint value.

### Rests & Breaths

| Symbol | Meaning | Example |
|--------|---------|---------|
| `♪` | 1-beat rest | `あい♪うえお` |
| `♪2` | N-beat rest | `♪2` (2 beats), `♪0.5` (half beat) |

### Pre-syllable expression (placed BEFORE the syllable)

| Symbol | Effect |
|--------|--------|
| `>` | Accent (intensity +30) |
| `↗` | Pitch scoop (しゃくり) from below |
| `↗1`-`↗3` | Scoop depth (default 2) |
| `!` | Tension (intensity +20) |

### Post-syllable expression (placed AFTER the syllable)

| Symbol | Effect |
|--------|--------|
| `↘` | Fall-off (語尾下げ) |
| `↘1`-`↘3` | Fall depth (default 2) |
| `_` | Long note (sustain) |

### Dynamics

| Symbol | Meaning |
|--------|---------|
| `(p)` or `(ｐ)` | Piano - soft (intensity=60) |
| `(f)` or `(ｆ)` | Forte - loud (intensity=127) |

### Voicing modes

| Symbol | Meaning |
|--------|---------|
| `...` or `…` | トーク風 (talk mode, Voicing down) |
| `(whisper)` | ささやき (whisper mode, Voicing very low) |

### Range markers

| Symbol | Meaning |
|--------|---------|
| `~...~` | Vibrato over enclosed range |
| `「...」` | Spoken/talk style (flat pitch) |

### Singer tags (multi-singer mode)

| Symbol | Meaning | Example |
|--------|---------|---------|
| `[name]` | Switch to named singer | `[千冬]きみと [立花]ぼくの` |
| `[name+N]` | Switch with pitch offset (+N semitones) | `[立花+3]うたをうたおう` |
| `[name-N]` | Switch with pitch offset (-N semitones) | `[千冬-2]ひくいこえで` |
| `[]` | Return to all singers (unison) | `[千冬]ソロ []みんなで` |

Singer tags require the `singers` array to be defined at the top level.
Lyrics without any singer tag are sung by all singers (unison).
Singer assignments persist until the next tag or `[]` reset.

### Phrase control

| Symbol | Meaning |
|--------|---------|
| Newline | Phrase break |
| Space | Word boundary (`wordStart` flag) |

### Example

```
(p)~かぜ~が ♪ >ふいて↘ ↗さくら_ ♪2 (f)!はなが さく
```

Soft vibrato "かぜ" -> 1-beat rest -> accented "ふいて" with fall -> scooped long "さくら" -> 2-beat rest -> forte tension "はなが さく"

## Vocal Range Presets

The generator supports vocal range selection:

| Preset | Name | Range | MIDI |
|--------|------|-------|------|
| `"low"` | 低め | A3-A4 | 57-69 |
| `"mid"` | 普通 | D4-D5 | 62-74 |
| `"high"` | 高め | G4-G5 | 67-79 |
| `"auto"` | 自動 | キーに合わせて自動選択 | - |

## MIDI Note Reference (for noteHint)

Common vocal range for SynthV voices like 花隈千冬:

```
C3=48  D3=50  E3=52  F3=53  G3=55  A3=57  B3=59
C4=60  D4=62  E4=64  F4=65  G4=67  A4=69  B4=71
C5=72  D5=74  E5=76  F5=77  G5=79  A5=81  B5=83
```

Comfortable range is roughly **A3 (57) - G5 (79)**. Stay within this for best results.

Sharp/flat: Each semitone is +1/-1 from the natural note.
Example: F#4 = 66, Bb4 = 70, Eb4 = 63.

## Best Practices

### 1. Array consistency
`noteHint`, `durationHint`, and `lyricHint` must have exactly the same number of elements.
Count carefully - each syllable of Japanese text is one element.

### 2. Measure alignment
The sum of `durationHint` values in a section should roughly equal `measures x 4 x 480` (since
each measure has 4 beats at 480 ticks/beat). Rests between phrases are handled by `restHint` or
by the `lyrics` notation.

**Example:** 8 measures = 8 x 4 x 480 = 15,360 ticks total.

### 3. Section design
- Use `type: "intro"` for an introductory section
- Use `type: "A"` for verses with the same melody but different lyrics
- Use `type: "B"` for contrasting sections (bridge, chorus variant)
- Use `type: "chorus"` for the main hook/refrain
- Use `type: "bridge"` for a transitional section before the final chorus
- Use `type: "serif"` for spoken/talk-style sections (flat pitch, no melody contour)
- Use `type: "interlude"` for instrumental breaks
- Use `type: "outro"` for the ending section
- Label sections descriptively: "1番", "2番", "サビ", "ラスサビ", "アウトロ"

### 4. Musical expression in lyrics
Use the notation system generously - it is the easiest way to add life to the vocal:
- `(p)` at song start, `(f)` at climax sections
- `~...~` vibrato on sustained notes
- `↗` scoops on emotionally emphasized syllables
- `>` accents on rhythmically strong beats
- `_` on the final note of phrases for sustain
- `♪` between phrases for natural breathing
- `...` or `(whisper)` for intimate or spoken-word sections

### 5. Chord progressions
`customChords` should have one chord per measure. Common progressions:
- Pop: `["C", "G", "Am", "F"]`
- Ballad: `["C", "Am", "F", "G"]`
- Japanese pop (小室進行): `["Am", "F", "G", "C"]`

Or use a `progId` preset to let the generator handle it automatically.

### 6. Known melodies
When transcribing well-known melodies, be precise with the MIDI note mapping. Write out the melody
note-by-note, matching each syllable to its correct pitch. Double-check by "singing" through the
noteHint array mentally.

### 7. Multi-singer songs (duets, trios)
- Define `singers` array with each singer name and optional SynthV database
- Use `[name]` tags in lyrics to assign phrases; untagged lyrics = unison (all singers)
- Use `[name+N]` for per-singer transposition (e.g. harmony parts)
- Use `[]` to return to unison after a solo section
- Singer assignments carry across words until the next tag
- Each singer gets their own SVP track with the specified voice database
- MIDI channels are assigned per singer (ch0, ch1, ...), with accompaniment offset accordingly
- Practical limit: ~10 singers (due to MIDI 16-channel constraint)

## Output Checklist

Before finalizing the JSON, verify:

- [ ] `noteHint`, `durationHint`, `lyricHint` have equal length
- [ ] Duration ticks sum matches measure count (approximately)
- [ ] `lyricHint` syllable count matches the actual lyrics
- [ ] MIDI notes are within comfortable vocal range (57-79)
- [ ] `customChords` array length matches `measures` count
- [ ] Section `type` values are valid (`"intro"`, `"A"`, `"B"`, `"chorus"`, `"bridge"`, `"serif"`, `"interlude"`, `"outro"`)
- [ ] `lyrics` field uses proper notation syntax
- [ ] If `accompPatterns` specified: instrument keys and pattern names are valid (see Accompaniment Pattern Reference)
- [ ] JSON is valid (no trailing commas, proper quoting)
- [ ] If multi-singer: `singers` array defined, singer names in `[tags]` match `singers[].name`
- [ ] If multi-singer: `[name+N]` offsets are reasonable (typically +/-1 to +/-7 semitones)

## Example: Simple single-singer section

```json
{
  "bpm": 120,
  "keyId": "C",
  "rhythmId": "even",
  "sections": [
    {
      "type": "A",
      "label": "Aメロ",
      "measures": 8,
      "lyrics": "(p)~きらきら~ ひかる♪ おそらの ほしよ_",
      "noteHint": [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60],
      "durationHint": [480, 480, 480, 480, 480, 480, 960, 480, 480, 480, 480, 480, 480, 960],
      "lyricHint": ["き", "ら", "き", "ら", "ひ", "か", "る", "お", "そ", "ら", "の", "ほ", "し", "よ"],
      "customChords": ["C", "C", "F", "C", "F", "C", "G", "C"]
    }
  ]
}
```

## Example: Multi-singer duet

```json
{
  "bpm": 140,
  "keyId": "Am",
  "progId": "komuro",
  "singers": [
    { "name": "千冬", "database": "Hanakuma Chifuyu AI" },
    { "name": "立花", "database": "Koharu Rikka AI" }
  ],
  "sections": [
    {
      "type": "A",
      "label": "1番 Aメロ",
      "measures": 8,
      "lyrics": "(p)[千冬]かぜがふいて はなびらが♪ [立花+3]まいおちる よるに"
    },
    {
      "type": "chorus",
      "label": "サビ",
      "measures": 8,
      "lyrics": "(f)[]!きみとぼくの うたをうたおう♪ ~そらにひびけ~"
    }
  ]
}
```

In the duet example:
- Section A: 千冬 sings the first phrase, then 立花 takes over (+3 semitones up)
- Chorus: `[]` resets to unison - both singers sing together
- SVP output creates 2 tracks: one for 千冬 (Chifuyu AI) and one for 立花 (Rikka AI)
