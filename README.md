# ちふちふジェネレーター

歌詞・曲構成からメロディを生成し、OpenUtau / Synthesizer V / DAW で扱えるファイルを書き出すブラウザアプリです。React + Vite で動作し、生成結果は UST / SVP / MIDI としてエクスポートできます。

## 主な機能

- BPM、キー、コード進行、リズム、音域、シード値を指定したメロディ生成
- イントロ、Aメロ、Bメロ、サビ、Cメロ、セリフ、間奏、アウトロのセクション編集
- 歌詞内の表現記号によるアクセント、しゃくり、フォール、ビブラート、強弱、息継ぎ、シンガー指定
- JSON / SVP / UST / MIDI のインポート
- UST / SVP / MIDI / 曲構造JSON のエクスポート
- Web Audio による簡易プレビュー再生
- MIDI出力時のコード、ベース、ギター、ピアノ、ストリングス、ドラム伴奏トラック生成
- マルチシンガー設定と、シンガー別UST出力

## 必要なもの

- Node.js 18 以上
- npm

Python補助ツールを使う場合のみ、Python 3 と `mido` が必要です。

## セットアップ

```powershell
npm.cmd install
```

## 開発サーバー

```powershell
npm.cmd run dev
```

表示されたローカルURLをブラウザで開きます。

## ビルド

```powershell
npm.cmd run build
```

成果物は `dist/` に出力されます。`vite.config.js` で `base: "./"` を指定しているため、静的ホスティングやサブディレクトリ配置にも対応しやすい構成です。

## 基本的な使い方

1. BPM、キー、コード進行、リズム、音域、シード値を設定します。
2. セクションごとに種類、小節数、キー、歌詞を入力します。
3. 「生成」でメロディを作成します。
4. プレビューで確認し、必要に応じて設定や歌詞を調整します。
5. UST / SVP / MIDI のいずれかを書き出します。

キー、コード進行、リズムは「自動」を選ぶと生成時にランダム決定されます。同じシード値と設定なら、同じメロディを再生成できます。

## 入出力

### インポート

画面上部のインポートボタンから次の形式を読み込めます。

- JSON: 曲構造や詳細ヒントを含むプロジェクトデータ
- SVP: Synthesizer V プロジェクト
- UST: OpenUtau / UTAU 系プロジェクト
- MIDI: メロディ抽出用MIDI

JSONインポートは 50MB までに制限されています。

### エクスポート

- `song.ust`: OpenUtau向け
- `song.svp`: Synthesizer V向け
- `song.mid`: DAW向け
- `song-structure.json`: 再編集用の曲構造JSON

MIDIは、メロディに加えてコード、ベース、ギター、ピアノ、ストリングス、ドラムの伴奏トラックを含みます。マルチシンガー設定時はシンガー別メロディトラックも生成されます。

## JSON形式の概要

JSONはすべてのトップレベル項目を省略できます。指定した項目だけが現在の設定に反映されます。

```json
{
  "bpm": 140,
  "keyId": "Am",
  "progId": "komuro",
  "rhythmId": "even",
  "singers": [
    { "name": "Chifuyu", "database": "Hanakuma Chifuyu AI" }
  ],
  "sections": [
    {
      "type": "A",
      "label": "Aメロ",
      "measures": 8,
      "lyrics": "(p)[Chifuyu]かぜの なかで",
      "keyId": "Am"
    },
    {
      "type": "chorus",
      "measures": 8,
      "lyrics": "(f)>ひかりへ とどけ"
    }
  ]
}
```

主なフィールド:

- `bpm`: テンポ
- `keyId`: `Am`、`C` などのキーID
- `progId`: コード進行ID
- `rhythmId`: リズムID
- `singers`: `{ name, database }` の配列
- `sections`: セクション配列
- `sections[].type`: `intro`、`A`、`B`、`chorus`、`bridge`、`serif`、`interlude`、`outro`
- `sections[].measures`: 小節数
- `sections[].lyrics`: 歌詞と表現記号
- `sections[].customChords`: 小節単位で使うコード名配列
- `sections[].noteHint` / `durationHint` / `lyricHint`: ノート単位の音高、長さ、歌詞指定
- `sections[].accompPatterns`: 伴奏プリセットの上書き
- `sections[].bassHint` / `guitarHint` / `pianoHint` / `stringsHint` / `chordHint` / `drumsHint`: 小節単位の伴奏イベント指定

## 歌詞内の主な表現記号

- `(p)` / `(f)`: 弱く / 強く
- `(whisper)`: ささやき寄りの発声
- `>`: アクセント
- `!`: テンション強調
- `~...~`: ビブラート範囲
- `_`: 直前の音を長めに扱う
- `[Singer]`: 指定シンガーで歌わせる
- `[Singer+3]` / `[Singer-2]`: シンガー指定とピッチオフセット
- `[]`: シンガー指定を解除

詳細なJSON項目は、アプリ内の「JSONリファレンス」でも確認できます。

## 検証

`package.json` には専用の `test` スクリプトはありません。リポジトリ内の検証スクリプトは直接実行します。

```powershell
node test-regression.js
node test-coverage.js
```

SVPのラウンドトリップ検証:

```powershell
node test-roundtrip.mjs path\to\input.svp 0
```

第2引数はトラック番号です。省略時は `0` が使われます。

## Python補助ツール

`tools/midi_to_json.py` は、MIDIからプロジェクトJSONを生成する補助スクリプトです。

```powershell
python -m pip install -r tools\requirements.txt
python tools\midi_to_json.py input.mid -o output.json
```

チャンネルやトラックを指定する場合:

```powershell
python tools\midi_to_json.py input.mid --channel 0 -o output.json
python tools\midi_to_json.py input.mid --track 1 -o output.json
```

## ディレクトリ構成

```text
src/
  MusicGenerator.jsx       メインUI
  constants.js             キー、コード進行、リズム、伴奏プリセット
  generators/
    melody.js              メロディ生成
    ust.js                 UST出力
    svp.js                 SVP出力
    midi.js                MIDI出力
    ust-import.js          USTインポート
    svp-import.js          SVPインポート
    midi-import.js         MIDIインポート
  utils/
    syllable.js            歌詞分割と表現記号解析
    phoneme.js             歌詞・音素変換
    preview.js             簡易プレビュー再生
    rhythm-detect.js       リズム推定
    singer.js              マルチシンガー処理
tools/
  midi_to_json.py          MIDIからJSONを作る補助ツール
```

## 注意点

- 生成・変換ロジックはブラウザ上で実行されます。
- インポートしたSVP / UST / MIDIの情報は、アプリ内のプロジェクトJSON構造へ変換されます。元ファイルの全情報を完全保持する用途ではなく、再編集・再出力のための変換です。
- MIDIインポートはメロディ抽出を目的としており、ドラムチャンネルなど一部の情報は対象外です。
- `dist/`、`node_modules/`、生成された `.mid` / `.svp` などの大きな出力ファイルはGit管理対象外です。
