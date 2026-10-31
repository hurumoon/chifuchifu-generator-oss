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

- Node.js 24以降のLTS版
- npm

Python補助ツールを使う場合のみ、Python 3 と `mido` が必要です。

## セットアップ

```powershell
npm.cmd ci
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

画面インポートでも1小節の区間とID `0` を保持します。IDを省略した区間には既存IDと重複しない番号を割り当てます。IDの重複、不正な小節数、音符・長さ・歌詞の配列長の不一致は読み込みエラーにします。`silent` の区間は元の音符指定を残したまま無音で出力します。

`noteHint`・`durationHint`・`lyricHint` が揃っていれば、全文の `lyrics` を省略しても画面から生成できます。別の曲へ切り替えるJSONでは、シンガーなしを `singers: []` で明示してください。項目の省略は、従来どおり現在の設定を保持します。

### コマンドからSVPを出力

```powershell
npm.cmd run render -- --input song.json --out-dir output/take-01
```

初版のコマンドは、他のアプリと音符を共有するための詳細JSON用です。歌唱セクションには同じ配列長の `noteHint`・`durationHint`・`lyricHint` を指定します。自動作曲は既存の画面から行えます。実行例は `tests/fixtures/explicit-timing.json` です。

新しいフォルダーに `song.chifu.json`（補完済みの曲JSON）、`song.svp`、`timeline.json`（480 ticks/拍の音符・休符）、`report.json`（尺と音符数）を出力します。既存フォルダーへの上書きはしません。小節に満たない分は末尾の休符として保持し、超過・配列長の不一致・不正な休符は出力前にエラーにします。

単独の促音「っ」は既存の生成処理で直前の音符へ統合されるため、コマンドでは明示的な変換を求めます。促音の長さを前の音符の `durationHint` に加え、「っ」を各ヒント配列から除いてください。シンガーは `singers` と `singerHint`、移調は確定済みの `noteHint` で指定します。歌詞中のシンガータグだけでの指定は受け付けません。

`npm.cmd test` で既存の自動回帰検査とコマンド・時刻保持の検査を実行できます。実ファイルを要求する `test-roundtrip.mjs` は、対象SVPを指定して別途実行します。

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

既存の回帰検査とCLI・時刻保持の検査は、まとめて次で実行できます。

```powershell
npm.cmd test
```

回帰検査だけを個別に実行する場合:

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

## ライセンス

プログラムと技術文書は[MIT License](./LICENSE)で公開します。**同梱のサンプル楽曲・歌詞`pinchi-koso-danchi-v6.json`はMITの対象外**です。作者hurumoonが権利を保持します。詳細は[SONG_LICENSE.txt](./SONG_LICENSE.txt)を確認してください。

利用者が生成・読み込み・編集する楽曲や歌詞に、ソフトウェアのMITライセンスが自動的に適用されることはありません。

ブラウザの実行用ライブラリの著作権・ライセンス表記は[THIRD_PARTY_LICENSES.txt](./public/THIRD_PARTY_LICENSES.txt)にあります。ビルド時に`dist/`にも含まれるので、配布時はこのファイルを残してください。Python補助ツールは別途インストールする[Mido（MIT）](https://mido.readthedocs.io/en/stable/licenses.html)を利用します。

Synthesizer V、歌声ライブラリ、キャラクターやその音声・画像は、このプログラムのMITライセンスの対象ではありません。本プロジェクトにライブラリ本体は同梱していません。利用時は各製品を別途導入し、その利用条件に従ってください。本プロジェクトは各製品・キャラクターの公式ツールではありません。

## データと開発環境

生成・変換はブラウザ内で行い、楽曲や歌詞をサーバーへアップロードする処理はありません。共有ボタンはページのURLと紹介文をXの投稿画面に渡します。入力内容を永続保存する仕組みはないため、必要な曲構造JSONは画面から書き出してください。

ローカル設定・環境変数・生成物はGit管理から除外しています。開発サーバーはローカルで使用し、Web配布には`npm.cmd run build`で作成した`dist/`を使用してください。
