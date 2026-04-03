/** parser.js v10 - verwijzingsfilter + titelreiniging */
const WvSvParser = (() => {

  const REGEL_REGEX = /^\s*(Art(?:ikel)?\.?)\s+(\d+\.\d+(?:\.\d+)*)\s*\.?\s*(.*)/i;

  function isVerwijzing(rest) {
    rest = rest.trim();
    if (!rest) return false;
    if (/^[\s,]*(?:eerste|tweede|derde|vierde|vijfde|zesde|zevende|achtste|negende|tiende|is van|jo\.|en artikel|of artikel)\b/i.test(rest)) return true;
    if (/^[a-z]\s+\S/.test(rest) && !/^\[/.test(rest)) return true;
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

  function isKop(regel) {
    const m = REGEL_REGEX.exec(regel.trim());
    if (!m) return null;
    const rest = m[3].trim();
    if (isVerwijzing(rest)) return null;
    return { nummer: m[2].trim(), rest: rest };
  }

  function splitTitelInhoud(rest) {
    rest = rest.trim();
    if (!rest) return { titel: '', inhoud: '' };
    if (/^\d+\./.test(rest)) return { titel: '', inhoud: rest };
    const match = rest.match(/^(.*?)\s+(?=\d+\.\s)/);
    if (match && match[1].trim()) {
      return { titel: reinigTitel(match[1].trim()), inhoud: rest.substring(match[0].length) };
    }
    return { titel: reinigTitel(rest), inhoud: '' };
  }

  function normaliseer(tekst) {
    return tekst
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/(Art(?:ikel)?\.?\s+\d+\.\d)/g, '\n$1')
      .replace(/((?:Titel|Afdeling|Hoofdstuk|Boek)\s+\d)/g, '\n$1')
      .trim();
  }

  function parseerArtikelen(tekst) {
    const artikelen = [];
    if (!tekst || !tekst.trim()) return artikelen;
    const genormaliseerd = normaliseer(tekst);
    const regels = genormaliseerd.split('\n');
    const geaccepteerd = [];
    const afgewezen = [];
    let huidig = null;
    let buffer = [];

    function opslaan() {
      if (!huidig) return;
      artikelen.push({
        artikel: huidig.nummer,
        titel: huidig.titel,
        inhoud: (huidig.inhoudStart + ' ' + buffer.join(' ')).trim()
      });
      buffer = [];
      huidig = null;
    }

    for (let i = 0; i < regels.length; i++) {
      const m = REGEL_REGEX.exec(regels[i].trim());
      if (m) {
        const rest = m[3].trim();
        if (isVerwijzing(rest)) {
          if (afgewezen.length < 10) afgewezen.push(m[2] + ' [' + rest.substring(0, 40) + ']');
        } else {
          opslaan();
          const ti = splitTitelInhoud(rest);
          huidig = { nummer: m[2].trim(), titel: ti.titel, inhoudStart: ti.inhoud };
          if (geaccepteerd.length < 10) geaccepteerd.push(m[2] + (ti.titel ? ' [' + ti.titel + ']' : ''));
        }
      } else if (huidig) {
        const r = regels[i].trim();
        if (r) buffer.push(r);
      }
    }
    opslaan();

    _toonParserDebug(geaccepteerd, afgewezen, artikelen.length, regels.length);
    return artikelen;
  }

  function _toonParserDebug(geaccepteerd, afgewezen, totaal, aantalRegels) {
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
    voeg('Regels: ' + aantalRegels + ' | Geaccepteerd: ' + totaal + ' | Afgewezen: ' + afgewezen.length);
    voeg('Artikelen gevonden: ' + totaal);
    if (geaccepteerd.length > 0) { voeg('Geaccepteerd (max 10):'); geaccepteerd.forEach(m => voeg('  + ' + m)); }
    if (afgewezen.length > 0) { voeg('Afgewezen (max 10):'); afgewezen.forEach(m => voeg('  - ' + m)); }
    if (totaal === 0) voeg('FOUT: geen koppen herkend', true);
  }

  const TESTDATA = 'Art. 2.5.1 Opsporingsbevoegdheden algemeen 1. De opsporingsambtenaar is bevoegd alle handelingen te verrichten die redelijkerwijs nodig zijn voor de vervulling van zijn taak. 2. Bij de uitoefening van zijn bevoegdheden houdt hij rekening met de grondrechten van de betrokkenen. Art. 2.5.2 Legitimatieplicht opsporingsambtenaar 1. De opsporingsambtenaar is verplicht zich op eerste verzoek te legitimeren. Art. 2.5.3 Staandehouding verdachten en getuigen 1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen. 2. Iedere opsporingsambtenaar kan de getuige staande houden. 3. De staandehouding duurt zo kort als mogelijk is. Art. 2.5.4 [aanhouding bij heterdaad] 1. In geval van ontdekking op heterdaad van een strafbaar feit kan ieder de verdachte aanhouden. 2. De opsporingsambtenaar die een verdachte bij ontdekking op heterdaad aanhoudt, geleidt hem zo spoedig mogelijk voor. 3. Vindt de aanhouding plaats door een ander dan een opsporingsambtenaar, dan levert deze de aangehoudene onverwijld over. Art. 2.5.5 Recht op mededeling 1. De verdachte heeft het recht dat hem zo spoedig mogelijk wordt meegedeeld ter zake van welk strafbaar feit hij als verdachte wordt aangemerkt. Art. 2.5.6 Aanhouding buiten heterdaad 1. In geval van verdenking van een misdrijf waarvoor voorlopige hechtenis is toegelaten, is de officier van justitie bevoegd de verdachte te doen aanhouden. Art. 2.5.7 Voorgeleiding en inverzekeringstelling 1. De aangehouden verdachte wordt zo spoedig mogelijk voorgeleid aan de officier van justitie. 2. De officier van justitie kan de verdachte in verzekering stellen. 3. De inverzekeringstelling duurt ten hoogste drie dagen. 4. De verdachte wordt onverwijld in kennis gesteld van zijn recht op bijstand van een raadsman.';

  return { parseerArtikelen, isKop, TESTDATA };
})();
if (typeof module !== 'undefined') module.exports = WvSvParser;
