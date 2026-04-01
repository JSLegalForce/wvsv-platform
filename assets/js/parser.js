/**
 * parser.js — WvSv artikelparser v4
 * Regel-voor-regel aanpak. Altijd verse array. Geen globale state.
 */
const WvSvParser = (() => {

  const KOP_REGEX = /^(Art(?:ikel)?\.?)\s+(\d[\d.]*[a-z]?)\b(.*)/i;

  function isArtikelKop(regel) {
    const m = KOP_REGEX.exec(regel.trim());
    if (!m) return null;
    return { nummer: m[2].trim(), titel: m[3].trim() };
  }

  function parseerArtikelen(tekst) {
    const artikelen = [];
    if (!tekst || !tekst.trim()) {
      console.warn('[Parser] Lege invoer.');
      return artikelen;
    }
    const regels = tekst.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    console.log('[Parser] Start | regels:', regels.length);

    let huidig = null;
    let buffer = [];

    function opslaan() {
      if (!huidig) return;
      const obj = { artikel: huidig.nummer, titel: huidig.titel, inhoud: buffer.join('\n').trim() };
      artikelen.push(obj);
      console.log('[Parser] Opgeslagen Art.' + obj.artikel + ' | ' + obj.inhoud.length + ' tekens');
    }

    for (let i = 0; i < regels.length; i++) {
      const kop = isArtikelKop(regels[i]);
      if (kop) {
        opslaan();
        huidig = { nummer: kop.nummer, titel: kop.titel };
        buffer = [];
        console.log('[Parser] Nieuw artikel regel ' + (i+1) + ': ' + kop.nummer + (kop.titel ? ' - ' + kop.titel : ''));
      } else if (huidig) {
        buffer.push(regels[i]);
      }
    }
    opslaan();

    console.log('[Parser] Klaar | gevonden:', artikelen.length, '| nummers:', artikelen.map(a=>a.artikel).join(', '));
    return artikelen;
  }

  const TESTDATA = `Art. 2.5.3 Staandehouding verdachten en getuigen

1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen op de wijze, bedoeld in artikel 1.4.8, eerste lid. Hij onderzoekt tevens een identiteitsbewijs als bedoeld in artikel 1 van de Wet op de identificatieplicht.

2. Iedere opsporingsambtenaar kan de getuige staande houden om zijn identiteit vast te stellen op de wijze, bedoeld in artikel 1.6.1.

Art. 2.5.4 Vasthouding ter plaatse

1. De opsporingsambtenaar die een verdachte aantreft op of in de onmiddellijke nabijheid van de plaats van het strafbaar feit, kan hem gedurende ten hoogste zes uren vasthouden voor verhoor.

2. De tijd tussen middernacht en negen uur telt voor de toepassing van het eerste lid niet mee.

3. De verdachte aan wie zijn vrijheid wordt ontnomen op grond van dit artikel heeft recht op bijstand van een raadsman.

Art. 2.5.5 Recht op mededeling

1. De verdachte heeft het recht dat hem zo spoedig mogelijk wordt meegedeeld ter zake van welk strafbaar feit hij als verdachte wordt aangemerkt.

2. Dit recht geldt zowel bij staandehouding als bij aanhouding.`;

  return { parseerArtikelen, isArtikelKop, TESTDATA };
})();

if (typeof module !== 'undefined') module.exports = WvSvParser;
