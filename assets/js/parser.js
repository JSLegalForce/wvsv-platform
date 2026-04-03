/** parser.js v8 - robuust voor PDF-tekst, correcte normalisatie */
const WvSvParser = (() => {
  const REGEL_REGEX = /^\s*(Art(?:ikel)?\.?)\s+(\d+\.\d+(?:\.\d+)*)\s*\.?\s*(.*)/i;

  function isKop(regel) {
    const m = REGEL_REGEX.exec(regel.trim());
    if (!m) return null;
    return { nummer: m[2].trim(), titel: m[3].trim() };
  }

  function normaliseer(tekst) {
    return tekst
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/(Art(?:ikel)?\.?\s+\d+\.\d)/g, '\n$1')
      .trim();
  }

  function parseerArtikelen(tekst) {
    const artikelen = [];
    if (!tekst || !tekst.trim()) return artikelen;

    const genormaliseerd = normaliseer(tekst);
    const regels = genormaliseerd.split('\n');
    const debugMatches = [];
    let huidig = null, buffer = [];

    function opslaan() {
      if (!huidig) return;
      artikelen.push({ artikel: huidig.nummer, titel: huidig.titel, inhoud: buffer.join('\n').trim() });
      buffer = []; huidig = null;
    }

    for (let i = 0; i < regels.length; i++) {
      const kop = isKop(regels[i]);
      if (kop) {
        opslaan();
        huidig = { nummer: kop.nummer, titel: kop.titel };
        if (debugMatches.length < 10) debugMatches.push('Art. ' + kop.nummer + (kop.titel ? ' --- ' + kop.titel : ''));
      } else if (huidig) {
        buffer.push(regels[i]);
      }
    }
    opslaan();
    _toonParserDebug(debugMatches, artikelen.length, regels.length);
    return artikelen;
  }

  function _toonParserDebug(matches, totaal, aantalRegels) {
    const blok = document.getElementById('debug-log');
    if (!blok) return;
    const tijd = new Date().toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const voeg = (tekst, rood) => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' + (rood ? 'color:#ff6b6b;font-weight:bold;' : '');
      d.textContent = '[' + tijd + '] [Parser] ' + tekst;
      blok.appendChild(d); blok.scrollTop = blok.scrollHeight;
    };
    voeg('Regels na normalisatie: ' + aantalRegels);
    voeg('Artikelen gevonden: ' + totaal);
    if (matches.length > 0) {
      voeg('Eerste ' + matches.length + ' koppen:');
      matches.forEach(m => voeg('  ' + m));
    } else {
      voeg('FOUT: geen koppen herkend na normalisatie', true);
      voeg('Verwacht: "Artikel 2.5.4" of "Art. 2.5.4"', true);
    }
  }

  const TESTDATA = `Art. 2.5.1 Opsporingsbevoegdheden algemeen
1. De opsporingsambtenaar is bevoegd alle handelingen te verrichten die redelijkerwijs nodig zijn voor de vervulling van zijn taak.
2. Bij de uitoefening van zijn bevoegdheden houdt hij rekening met de grondrechten van de betrokkenen.
Art. 2.5.2 Legitimatieplicht opsporingsambtenaar
1. De opsporingsambtenaar is verplicht zich op eerste verzoek te legitimeren.
Art. 2.5.3 Staandehouding verdachten en getuigen
1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen.
2. Iedere opsporingsambtenaar kan de getuige staande houden.
3. De staandehouding duurt zo kort als mogelijk is.
Art. 2.5.4 [aanhouding bij heterdaad]
1. In geval van ontdekking op heterdaad van een strafbaar feit kan ieder de verdachte aanhouden.
2. De opsporingsambtenaar die een verdachte bij ontdekking op heterdaad aanhoudt, geleidt hem zo spoedig mogelijk voor.
3. Vindt de aanhouding plaats door een ander dan een opsporingsambtenaar, dan levert deze de aangehoudene onverwijld over.
Art. 2.5.5 Recht op mededeling
1. De verdachte heeft het recht dat hem zo spoedig mogelijk wordt meegedeeld ter zake van welk strafbaar feit hij als verdachte wordt aangemerkt.
Art. 2.5.6 Aanhouding buiten heterdaad
1. In geval van verdenking van een misdrijf waarvoor voorlopige hechtenis is toegelaten, is de officier van justitie bevoegd de verdachte te doen aanhouden.
Art. 2.5.7 Voorgeleiding en inverzekeringstelling
1. De aangehouden verdachte wordt zo spoedig mogelijk voorgeleid aan de officier van justitie.
2. De officier van justitie kan de verdachte in verzekering stellen.
3. De inverzekeringstelling duurt ten hoogste drie dagen.
4. De verdachte wordt onverwijld in kennis gesteld van zijn recht op bijstand van een raadsman.`;

  return { parseerArtikelen, isKop, TESTDATA };
})();
if (typeof module !== 'undefined') module.exports = WvSvParser;
