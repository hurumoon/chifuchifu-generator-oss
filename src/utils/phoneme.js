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

// ローマ字→ひらがな逆変換マップ
// KANA_MAPの単純な逆変換ではない（を→o vs wo→うぉ、ぢ→di vs di→でぃ 等）
export const PHONEME_TO_KANA = {
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',sha:'しゃ',shu:'しゅ',sho:'しょ',
  cha:'ちゃ',chu:'ちゅ',cho:'ちょ',nya:'にゃ',nyu:'にゅ',nyo:'にょ',
  hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',mya:'みゃ',myu:'みゅ',myo:'みょ',
  rya:'りゃ',ryu:'りゅ',ryo:'りょ',gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',
  ja:'じゃ',ju:'じゅ',jo:'じょ',bya:'びゃ',byu:'びゅ',byo:'びょ',
  pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',dya:'でゃ',dyu:'でゅ',dyo:'でょ',
  ti:'てぃ',di:'でぃ',fa:'ふぁ',fi:'ふぃ',fe:'ふぇ',fo:'ふぉ',
  wi:'うぃ',we:'うぇ',wo:'うぉ',tsa:'つぁ',tsi:'つぃ',tse:'つぇ',tso:'つぉ',
  a:'あ',i:'い',u:'う',e:'え',o:'お',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',
  sa:'さ',shi:'し',su:'す',se:'せ',so:'そ',
  ta:'た',chi:'ち',tsu:'つ',te:'て',to:'と',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',
  ha:'は',hi:'ひ',fu:'ふ',he:'へ',ho:'ほ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',
  ya:'や',yu:'ゆ',yo:'よ',
  ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',
  wa:'わ',n:'ん',
  ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',
  za:'ざ',ji:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
  da:'だ',du:'づ',de:'で',do:'ど',
  ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',
  pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  cl:'っ',
};

const PHONEME_KEYS_SORTED = Object.keys(PHONEME_TO_KANA).sort((a, b) => b.length - a.length);

export function phonemeToKana(phoneme) {
  if (!phoneme || phoneme === "-") return "-";
  if (/^[\u3040-\u309F\u30A0-\u30FF]+$/.test(phoneme)) return phoneme;

  let result = "";
  let pos = 0;
  while (pos < phoneme.length) {
    let matched = false;
    for (const key of PHONEME_KEYS_SORTED) {
      if (phoneme.startsWith(key, pos)) {
        result += PHONEME_TO_KANA[key];
        pos += key.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += phoneme[pos];
      pos++;
    }
  }
  return result || phoneme;
}
