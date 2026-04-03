/** parser.js v11 - positie-gebaseerde segmentatie */
const WvSvParser = (() => {

  const ART_RE = /\bArt(?:ikel)?\.?\s+(\d+\.\d+(?:\.\d+)*)\s*\.?\s*/gi;

  function isVerwijzing(directNa) {
    if (!directNa) return false;
    if (/^[\s,]*(?:eerste|tweede|derde|vierde|vijfde|zesde|zevende|achtste|negende|tiende|is van|jo\.|en artikel|of artikel)\b/i.test(directNa)) return true;
    if (/^[a-z]\s+\S/.test(directNa) && !/^\[/.test(directNa)) return true;
    return false;
  }

  function reinigTitel(titel) {
    if (!titel) return '';
    let t = titel.trim();
    t = t.replace(/^\[[a-z]\s+/i, '');
    t = t.replace(/^[a-z]\s+(?=[A-Z\[])/, '');
    let open = (t.match(/\[/g) || []).length;
    let sluit = (t.match(/\]/g) || []).length;
    while (sluit > open && t.endsWith(']')) { t = t.slice(0, -1).trim(); sluit--; }
    t = t.replace(/\[\s*\]/g, '').trim();
    return t;
  }

  function splitTitelInhoud(segment) {
    let s = segment.trim();
    if (!s) return { titel: '', inhoud: '' };
    if (/^\d+\./.test(s)) return { titel: '', inhoud: s };
    const lm = s.match(/^(.*?)\s+(?=\d+\.\s)/);
    if (lm && lm[1].trim()) {
      return { titel: reinigTitel(lm[1].trim()), inhoud: s.substring(lm[0].length) };
    }
    return { titel: reinigTitel(s), inhoud: '' };
  }

  function isKop(regel) {
    const m = /^\s*(Art(?:ikel)?\.?)\s+(\d+\.\d+(?:\.\d+)*)\s*\.?\s*(.*)/i.exec(regel.trim());
    if (!m) return null;
    const rest = m[3].trim();
    if (isVerwijzing(rest)) return null;
    return { nummer: m[2].trim(), rest: rest };
  }

  function parseerArtikelen(tekst) {
    const artikelen = [];
    if (!tekst || !tekst.trim()) return artikelen;
    let t = tekst
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .trim();
    t = t.replace(/((?:Boek|Hoofdstuk|Titel|Afdeling|§)\s+\d)/g, '\n\n$1');
    const re = new RegExp(ART_RE.source, 'gi');
    const matches = [];
    let m;
    while ((m = re.exec(t)) !== null) {
      const nummer = m[1];
      const pos = m.index;
      const restStart = m.index + m[0].length;
      const directNa = t.substring(restStart, restStart + 80).trim();
      matches.push({ nummer, pos, restStart, directNa });
    }
    const echteStarts = [];
    const afgewezen = [];
    for (let i = 0; i < matches.length; i++) {
      if (isVerwijzing(matches[i].directNa)) {
        if (afgewezen.length < 10) afgewezen.push(matches[i].nummer + ' [' + matches[i].directNa.substring(0, 40) + ']');
      } else {
        echteStarts.push(matches[i]);
      }
    }
    const debugSegmenten = [];
    for (let i = 0; i < echteStarts.length; i++) {
      const start = echteStarts[i];
      let einde = (i + 1 < echteStarts.length) ? echteStarts[i + 1].pos : t.length;
      let segment = t.substring(start.restStart, einde);
      const grens = segment.search(/\n\n(?:Boek|Hoofdstuk|Titel|Afdeling|§)\s+\d/);
      if (grens >= 0) segment = segment.substring(0, grens);
      segment = segment.replace(/\s+/g, ' ').trim();
      const ti = splitTitelInhoud(segment);
      artikelen.push({ artikel: start.nummer, titel: ti.titel, inhoud: ti.inhoud });
      if (debugSegmenten.length < 10) {
        debugSegmenten.push({ nr: start.nummer, pos: start.pos, titel: ti.titel, inhoudStart: (ti.inhoud || '').substring(0, 120) });
      }
    }
    _toonParserDebug(echteStarts, afgewezen, debugSegmenten, artikelen.length, matches.length);
    return artikelen;
  }

  function _toonParserDebug(starts, afgewezen, segmenten, totaal, totaalMatches) {
    const blok = document.getElementById('debug-log');
    if (!blok) return;
    const tijd = new Date().toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const voeg = (tekst, rood) => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' + (rood ? 'color:#ff6b6b;font-weight:bold;' : '');
      d.textContent = '[' + tijd + '] [Parser] ' + tekst;
      blok.appendChild(d);
      blok.scrollTop = blok.scrollHeight;
    };
    voeg('Totaal matches: ' + totaalMatches + ' | Geaccepteerd: ' + totaal + ' | Afgewezen: ' + afgewezen.length);
    if (starts.length > 0) {
      voeg('Eerste 20 artikelstarts:');
      starts.slice(0, 20).forEach(s => voeg('  pos=' + s.pos + ' Art. ' + s.nummer));
    }
    if (segmenten.length > 0) {
      voeg('Eerste 10 segmenten:');
      segmenten.forEach(s => voeg('  ' + s.nr + (s.titel ? ' [' + s.titel + ']' : '') + ' -> ' + s.inhoudStart.substring(0, 80)));
    }
    if (afgewezen.length > 0) { voeg('Afgewezen (max 10):'); afgewezen.forEach(a => voeg('  - ' + a)); }
    if (totaal === 0) voeg('FOUT: geen artikelen gevonden', true);
  }

  const TESTDATA = 'Art. 2.5.1 Opsporingsbevoegdheden algemeen 1. De opsporingsambtenaar is bevoegd alle handelingen te verrichten die redelijkerwijs nodig zijn voor de vervulling van zijn taak. 2. Bij de uitoefening van zijn bevoegdheden houdt hij rekening met de grondrechten van de betrokkenen. Art. 2.5.2 Legitimatieplicht opsporingsambtenaar 1. De opsporingsambtenaar is verplicht zich op eerste verzoek te legitimeren. Art. 2.5.3 Staandehouding verdachten en getuigen 1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen. 2. Iedere opsporingsambtenaar kan de getuige staande houden. 3. De staandehouding duurt zo kort als mogelijk is. Art. 2.5.4 [aanhouding bij heterdaad] 1. In geval van ontdekking op heterdaad van een strafbaar feit kan ieder de verdachte aanhouden. 2. De opsporingsambtenaar die een verdachte bij ontdekking op heterdaad aanhoudt, geleidt hem zo spoedig mogelijk voor. 3. Vindt de aanhouding plaats door een ander dan een opsporingsambtenaar, dan levert deze de aangehoudene onverwijld over. Art. 2.5.5 Recht op mededeling 1. De verdachte heeft het recht dat hem zo spoedig mogelijk wordt meegedeeld ter zake van welk strafbaar feit hij als verdachte wordt aangemerkt. Art. 2.5.6 Aanhouding buiten heterdaad 1. In geval van verdenking van een misdrijf waarvoor voorlopige hechtenis is toegelaten, is de officier van justitie bevoegd de verdachte te doen aanhouden. Art. 2.5.7 Voorgeleiding en inverzekeringstelling 1. De aangehouden verdachte wordt zo spoedig mogelijk voorgeleid aan de officier van justitie. 2. De officier van justitie kan de verdachte in verzekering stellen. 3. De inverzekeringstelling duurt ten hoogste drie dagen. 4. De verdachte wordt onverwijld in kennis gesteld van zijn recht op bijstand van een raadsman.';

  return { parseerArtikelen, isKop, TESTDATA };
})();
if (typeof module !== 'undefined') module.exports = WvSvParser;
