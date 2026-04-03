/** parser.js v6 - fix Art. 2.5.4 correct tekst */
const WvSvParser = (() => {
  const KOP_REGEX = /^(Art(?:ikel)?\.?)\s+(\d[\d.]*[a-z]?)(?:\s*[.:]\s*|\s+|$)(.*)/i;
  function isKop(regel) {
    const m = KOP_REGEX.exec(regel.trim());
    if (!m) return null;
    return { nummer: m[2].trim(), titel: m[3].trim() };
  }
  function parseerArtikelen(tekst) {
    const artikelen = [];
    if (!tekst || !tekst.trim()) { console.warn('[Parser] Lege invoer.'); return artikelen; }
    const regels = tekst.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    console.log('[Parser] Start | regels:', regels.length);
    let huidig = null, buffer = [];
    function opslaan() {
      if (!huidig) return;
      artikelen.push({ artikel: huidig.nummer, titel: huidig.titel, inhoud: buffer.join('\n').trim() });
      buffer = []; huidig = null;
    }
    for (let i = 0; i < regels.length; i++) {
      const kop = isKop(regels[i]);
      if (kop) { opslaan(); huidig = { nummer: kop.nummer, titel: kop.titel }; }
      else if (huidig) { buffer.push(regels[i]); }
    }
    opslaan();
    console.log('[Parser] Klaar | gevonden:', artikelen.length);
    return artikelen;
  }
  const TESTDATA = `Art. 2.5.1 Opsporingsbevoegdheden algemeen
1. De opsporingsambtenaar is bevoegd alle handelingen te verrichten die redelijkerwijs nodig zijn voor de vervulling van zijn taak.
2. Bij de uitoefening van zijn bevoegdheden houdt hij rekening met de grondrechten van de betrokkenen.
3. Van elke ingrijpende handeling wordt een schriftelijk verslag opgemaakt.
Art. 2.5.2 Legitimatieplicht opsporingsambtenaar
1. De opsporingsambtenaar is verplicht zich op eerste verzoek te legitimeren met een dienstpas waarop naam, rang en dienstaanduiding zijn vermeld.
2. In spoedeisende gevallen kan legitimatie plaatsvinden direct na de handeling.
Art. 2.5.3 Staandehouding verdachten en getuigen
1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen op de wijze, bedoeld in artikel 1.4.8, eerste lid. Hij onderzoekt tevens een identiteitsbewijs als bedoeld in artikel 1 van de Wet op de identificatieplicht.
2. Iedere opsporingsambtenaar kan de getuige staande houden om zijn identiteit vast te stellen op de wijze, bedoeld in artikel 1.6.1.
3. De staandehouding duurt zo kort als mogelijk is.
Art. 2.5.4 [aanhouding bij heterdaad]
1. In geval van ontdekking op heterdaad van een strafbaar feit kan ieder de verdachte aanhouden.
2. De opsporingsambtenaar die een verdachte bij ontdekking op heterdaad aanhoudt, geleidt hem zo spoedig mogelijk voor aan de officier van justitie of de hulpofficier van justitie.
3. Vindt de aanhouding plaats door een ander dan een opsporingsambtenaar, dan levert deze de aangehoudene onverwijld over aan een opsporingsambtenaar.
Art. 2.5.5 Recht op mededeling
1. De verdachte heeft het recht dat hem zo spoedig mogelijk wordt meegedeeld ter zake van welk strafbaar feit hij als verdachte wordt aangemerkt.
2. Dit recht geldt zowel bij staandehouding als bij aanhouding.
3. De mededeling geschiedt in een taal die de verdachte begrijpt of redelijkerwijze geacht wordt te begrijpen.
Art. 2.5.6 Aanhouding buiten heterdaad
1. In geval van verdenking van een misdrijf waarvoor voorlopige hechtenis is toegelaten, is de officier van justitie bevoegd de verdachte te doen aanhouden.
2. De hulpofficier van justitie heeft dezelfde bevoegdheid bij dringende noodzaak als onverwijlde aanhouding vereist is.
3. Van de aanhouding wordt onverwijld proces-verbaal opgemaakt.
Art. 2.5.7 Voorgeleiding en inverzekeringstelling
1. De aangehouden verdachte wordt zo spoedig mogelijk voorgeleid aan de officier van justitie of de hulpofficier van justitie.
2. De officier van justitie kan de verdachte in verzekering stellen indien het belang van het onderzoek dit vordert.
3. De inverzekeringstelling duurt ten hoogste drie dagen en kan eenmaal worden verlengd met ten hoogste drie dagen.
4. De verdachte wordt onverwijld in kennis gesteld van zijn recht op bijstand van een raadsman en van zijn zwijgrecht.`;
  return { parseerArtikelen, isKop, TESTDATA };
})();
if (typeof module !== 'undefined') module.exports = WvSvParser;
