const KANA_MAP = {
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo','しゃ':'sha','しゅ':'shu','しょ':'sho',
  'ちゃ':'cha','ちゅ':'chu','ちょ':'cho','にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo','みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja','じゅ':'ju','じょ':'jo','びゃ':'bya','びゅ':'byu','びょ':'byo',
  'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo','でゃ':'dya','でゅ':'dyu','でょ':'dyo',
  'てぃ':'ti','でぃ':'di','ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo',
  'うぃ':'wi','うぇ':'we','うぉ':'wo','つぁ':'tsa','つぃ':'tsi','つぇ':'tse','つぉ':'tso',
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','を':'o','ん':'n',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
  'だ':'da','ぢ':'di','づ':'du','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
  'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'っ':'cl','ー':'-',
};

const KATA_OFFSET = 0x30A0 - 0x3040;

function kataToHira(ch) {
  const code = ch.charCodeAt(0);
  if (code >= 0x30A1 && code <= 0x30F6) return String.fromCharCode(code - KATA_OFFSET);
  if (ch === 'ヴ') return 'ゔ';
  return ch;
}

export function lyricToPhoneme(lyric, prevLyric, nextLyric, wordStart) {
  let hira = '';
  for (const ch of lyric) hira += kataToHira(ch);
  if (hira === 'は' && prevLyric && prevLyric !== '♪' && !wordStart) return 'wa';
  if (hira === 'へ' && prevLyric && prevLyric !== '♪' && !wordStart) return 'e';
  if (hira.length >= 2 && KANA_MAP[hira]) return KANA_MAP[hira];
  let result = '';
  for (let i = 0; i < hira.length; i++) {
    const two = hira.substring(i, i + 2);
    if (i + 1 < hira.length && KANA_MAP[two]) {
      result += KANA_MAP[two];
      i++;
    } else if (KANA_MAP[hira[i]]) {
      result += KANA_MAP[hira[i]];
    } else {
      result += hira[i];
    }
  }
  return result || lyric;
}
