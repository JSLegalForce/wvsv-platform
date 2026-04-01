/**
 * parser.js — WvSv artikelparser (verbeterde versie)
 *
 * Aanpak: regel-voor-regel parsing
 * - Elke regel wordt gecontroleerd of het een artikelkop is
 * - Artikelnummer, titel en inhoud worden apart opgeslagen
 * - Inhoud bevat NIET de artikelkop zelf (geen dubbele info)
 */

const WvSvParser = (() => {

  // Patroon: herkent een regel die BEGINT met Art./Artikel + nummer
  // Voorbeelden: "Art. 2.5.3", "Artikel 52", "art. 52a", "Art. 1.4.8"
  const ARTIKEL_KOP_REGEX = /^(Art(?:ikel)?)\.?\s+(\d[\d.]*[a-z]?)\b(.*)/i;

  /**
   * Controleer of een regel een artikelkop is.
   * Geeft null terug als het geen artikelkop is.
   * Geeft { nummer, titel } terug als het wel een artikelkop is.
   */
  function parseArtikelKop(regel) {
    const m = ARTIKEL_KOP_REGEX.exec(regel.trim());
    if (!m) return null;
    return {
      nummer: m[2].trim(),
      titel: m[3].trim()
    };
  }

  /**
   * Hoofd-parserfunctie: lees tekst regel voor regel.
   * Per artikel: sla nummer, titel en alle volgende regels op als inhoud.
   */
  function parseerArtikelen(tekst) {
    if (!tekst || !tekst.trim()) return [];

    const regels = tekst
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n');

    const artikelen = [];
    let huidigArtikel = null;
    let inhoudRegels = [];

    for (let i = 0; i < regels.length; i++) {
      const regel = regels[i];
      const kop = parseArtikelKop(regel);

      if (kop) {
        // Sla vorig artikel op
        if (huidigArtikel) {
          huidigArtikel.inhoud = inhoudRegels.join('\n').trim();
          artikelen.push(huidigArtikel);
          console.debug('[Parser] Artikel opgeslagen:', huidigArtikel.artikel, '| regels inhoud:', inhoudRegels.length);
        }
        // Start nieuw artikel
        huidigArtikel = {
          artikel: kop.nummer,
          titel: kop.titel,
          inhoud: ''
        };
        inhoudRegels = [];
        console.debug('[Parser] Nieuw artikel gevonden op regel', i + 1, '| nummer:', kop.nummer, '| titel:', kop.titel || '(geen)');
      } else if (huidigArtikel) {
        // Voeg regel toe aan huidig artikel
        inhoudRegels.push(regel);
      }
    }

    // Vergeet het laatste artikel niet
    if (huidigArtikel) {
      huidigArtikel.inhoud = inhoudRegels.join('\n').trim();
      artikelen.push(huidigArtikel);
      console.debug('[Parser] Laatste artikel opgeslagen:', huidigArtikel.artikel);
    }

    console.log('[Parser] Totaal gevonden:', artikelen.length, 'artikelen');
    console.log('[Parser] Artikelnummers:', artikelen.map(a => a.artikel).join(', '));

    return artikelen;
  }

  /**
   * Testdata: 2 voorbeeldartikelen voor directe test zonder bestand.
   */
  const TESTDATA = `Art. 2.5.3 Staandehouding verdachten en getuigen

1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen op de wijze, bedoeld in artikel 1.4.8, eerste lid. Hij onderzoekt tevens een identiteitsbewijs als bedoeld in artikel 1 van de Wet op de identificatieplicht.

2. Iedere opsporingsambtenaar kan de getuige staande houden om zijn identiteit vast te stellen op de wijze, bedoeld in artikel 1.6.1.

Art. 2.5.4 Vasthouding ter plaatse

1. De opsporingsambtenaar die een verdachte aantreft op of in de onmiddellijke nabijheid van de plaats van het strafbaar feit, kan hem gedurende ten hoogste zes uren vasthouden voor verhoor.

2. De tijd tussen middernacht en negen uur telt voor de toepassing van het eerste lid niet mee.

3. De verdachte aan wie zijn vrijheid wordt ontnomen op grond van dit artikel heeft recht op bijstand van een raadsman.`;

  return { parseerArtikelen, parseArtikelKop, TESTDATA };

})();

if (typeof module !== 'undefined') module.exports = WvSvParser;
