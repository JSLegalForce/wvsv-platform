/**
 * parser.js — WvSv artikelparser v5
 * Regel-voor-regel aanpak. Altijd verse state. Geen globale variabelen.
 * Fix v5: ruimere kop-herkenning, volledige inhoud per artikel,
 *         uitgebreide testdata met 7 artikelen.
 */
const WvSvParser = (() => {

  // Herkent: Art. 2.5.3 | Artikel 52 | Art 1.1a | Art. 1 Titel...
  const KOP_REGEX = /^(Art(?:ikel)?\.?)\s+(\d[\d.]*[a-z]?)(?:\s*[.:]\s*|\s+|$)(.*)/i;

  function isKop(regel) {
    const trimmed = regel.trim();
    const m = KOP_REGEX.exec(trimmed);
    if (!m) return null;
    return { nummer: m[2].trim(), titel: m[3].trim() };
  }

  function parseerArtikelen(tekst) {
    const artikelen = [];
    if (!tekst || !tekst.trim()) {
      console.warn('[Parser] Lege invoer.');
      return artikelen;
    }
    const regels = tekst.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    console.log('[Parser] Start | regels:', regels.length);

    let huidig = null;
    let buffer = [];

    function opslaan() {
      if (!huidig) return;
      artikelen.push({
        artikel: huidig.nummer,
        titel:   huidig.titel,
        inhoud:  buffer.join('\n').trim()
      });
      console.log('[Parser] Opgeslagen: Art.' + huidig.nummer +
        (huidig.titel ? ' — ' + huidig.titel : '') + ' | ' + buffer.length + ' regels');
      buffer = [];
      huidig = null;
    }

    for (let i = 0; i < regels.length; i++) {
      const kop = isKop(regels[i]);
      if (kop) {
        opslaan();
        huidig = { nummer: kop.nummer, titel: kop.titel };
        console.log('[Parser] Nieuw artikel op regel ' + (i + 1) + ': Art.' + kop.nummer +
          (kop.titel ? ' | ' + kop.titel : ''));
      } else if (huidig) {
        buffer.push(regels[i]);
      }
    }
    opslaan(); // laatste artikel

    console.log('[Parser] Klaar | gevonden:', artikelen.length,
      '| nummers:', artikelen.map(a => a.artikel).join(', '));
    return artikelen;
  }

  // ── Testdata: 7 volledige artikelen ──────────────────────────────────
  const TESTDATA = `Art. 2.5.1 Opsporingsbevoegdheden algemeen
1. De opsporingsambtenaar is bevoegd alle handelingen te verrichten die redelijkerwijs
   nodig zijn voor de vervulling van zijn taak.
2. Bij de uitoefening van zijn bevoegdheden houdt hij rekening met de grondrechten
   van de betrokkenen.
3. Van elke ingrijpende handeling wordt een schriftelijk verslag opgemaakt.

Art. 2.5.2 Legitimatieplicht opsporingsambtenaar
1. De opsporingsambtenaar is verplicht zich op eerste verzoek te legitimeren met een
   dienstpas waarop naam, rang en dienstaanduiding zijn vermeld.
2. In spoedeisende gevallen kan legitimatie plaatsvinden direct na de handeling.

Art. 2.5.3 Staandehouding verdachten en getuigen
1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast
   te stellen op de wijze, bedoeld in artikel 1.4.8, eerste lid.
   Hij onderzoekt tevens een identiteitsbewijs als bedoeld in artikel 1 van de
   Wet op de identificatieplicht.
2. Iedere opsporingsambtenaar kan de getuige staande houden om zijn identiteit vast
   te stellen op de wijze, bedoeld in artikel 1.6.1.
3. De staandehouding duurt zo kort als mogelijk is.

Art. 2.5.4 Vasthouding ter plaatse
1. De opsporingsambtenaar die een verdachte aantreft op of in de onmiddellijke
   nabijheid van de plaats van het strafbaar feit, kan hem gedurende ten hoogste
   zes uren vasthouden voor verhoor.
2. De tijd tussen middernacht en negen uur telt voor de toepassing van het eerste
   lid niet mee.
3. De verdachte aan wie zijn vrijheid wordt ontnomen op grond van dit artikel heeft
   recht op bijstand van een raadsman.
4. De opsporingsambtenaar stelt de raadsman zo spoedig mogelijk in kennis van de vasthouding.

Art. 2.5.5 Recht op mededeling
1. De verdachte heeft het recht dat hem zo spoedig mogelijk wordt meegedeeld ter
   zake van welk strafbaar feit hij als verdachte wordt aangemerkt.
2. Dit recht geldt zowel bij staandehouding als bij aanhouding.
3. De mededeling geschiedt in een taal die de verdachte begrijpt of redelijkerwijze
   geacht wordt te begrijpen.

Art. 2.5.6 Aanhouding buiten heterdaad
1. In geval van verdenking van een misdrijf waarvoor voorlopige hechtenis is
   toegelaten, is de officier van justitie bevoegd de verdachte te doen aanhouden.
2. De hulpofficier van justitie heeft dezelfde bevoegdheid bij dringende noodzaak
   als onverwijlde aanhouding vereist is.
3. Van de aanhouding wordt onverwijld proces-verbaal opgemaakt.

Art. 2.5.7 Voorgeleiding en inverzekeringstelling
1. De aangehouden verdachte wordt zo spoedig mogelijk voorgeleid aan de officier
   van justitie of de hulpofficier van justitie.
2. De officier van justitie kan de verdachte in verzekering stellen indien het
   belang van het onderzoek dit vordert.
3. De inverzekeringstelling duurt ten hoogste drie dagen en kan eenmaal worden
   verlengd met ten hoogste drie dagen.
4. De verdachte wordt onverwijld in kennis gesteld van zijn recht op bijstand
   van een raadsman en van zijn zwijgrecht.`;

  return { parseerArtikelen, isKop, TESTDATA };
})();

if (typeof module !== 'undefined') module.exports = WvSvParser;
