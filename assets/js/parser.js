/**
 * parser.js — WvSv artikelparser v3
 *
 * Aanpak: strikt regel-voor-regel
 * - Elke analyse start met een LEGE array (geen state tussen aanroepen)
 * - Artikelkop wordt herkend op basis van regex per regel
 * - Artikelnummer, titel en inhoud strikt gescheiden
 * - Inhoud bevat NOOIT de artikelkop zelf
 * - Verwerkt het VOLLEDIGE document tot de laatste regel
 */

const WvSvParser = (() => {

  // Herkent een regel die BEGINT met Art./Artikel + nummer
  // Voorbeelden: "Art. 2.5.3 Titel", "Artikel 52", "art. 52a Naam"
  const ARTIKEL_KOP_REGEX = /^(Art(?:ikel)?\.?)\s+(\d[\d.]*[a-z]?)\b(.*)/i;

  /**
   * Controleer of een regel een artikelkop is.
   * Geeft { nummer, titel } of null terug.
   */
  function isArtikelKop(regel) {
    const m = ARTIKEL_KOP_REGEX.exec(regel.trim());
    if (!m) return null;
    return {
      nummer: m[2].trim(),
      titel:  m[3].trim()
    };
  }

  /**
   * Hoofd-parserfunctie.
   * Maakt ALTIJD een nieuwe lege array — geen hergebruik van state.
   * Verwerkt ALLE regels tot het einde van het document.
   */
  function parseerArtikelen(tekst) {
    // Altijd verse array — geen risico op hergebruik
    const artikelen = [];

    if (!tekst || !tekst.trim()) {
      console.warn('[Parser] Lege of ongeldige invoer.');
      return artikelen;
    }

    // Normaliseer regeleinden
    const regels = tekst
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n');

    console.log('[Parser] Start analyse | totaal regels:', regels.length);

    let huidigArtikel = null;
    let inhoudBuffer  = [];

    function slaArtikelOp() {
      if (!huidigArtikel) return;
      huidigArtikel.inhoud = inhoudBuffer.join('\n').trim();
      artikelen.push({ ...huidigArtikel }); // spread: altijd nieuw object
      console.log('[Parser] Opgeslagen: Art.' + huidigArtikel.artikel +
        ' | inhoud ' + huidigArtikel.inhoud.length + ' tekens');
    }

    for (let i = 0; i < regels.length; i++) {
      const regel = regels[i];
      const kop   = isArtikelKop(regel);

      if (kop) {
        // Sla vorig artikel op vóór we beginnen met het nieuwe
        slaArtikelOp();

        // Begin nieuw artikel — altijd een nieuw object
        huidigArtikel = {
          artikel: kop.nummer,
          titel:   kop.titel,
          inhoud:  ''
        };
        inhoudBuffer = [];

        console.log('[Parser] Nieuw artikel op regel ' + (i + 1) +
          ' | nummer: ' + kop.nummer +
          (kop.titel ? ' | titel: ' + kop.titel : ' | (geen titel)'));
      } else if (huidigArtikel) {
        // Voeg regel toe aan inhoud van huidig artikel
        inhoudBuffer.push(regel);
      }
      // Regels vóór het eerste artikel worden genegeerd
    }

    // Laatste artikel opslaan (wordt niet gevolgd door een nieuw artikel)
    slaArtikelOp();

    console.log('[Parser] Klaar | gevonden: ' + artikelen.length +
      ' | nummers: ' + artikelen.map(a => a.artikel).join(', '));

    return artikelen;
  }

  /**
   * Testdata: 3 artikelen voor directe test zonder bestand.
   * Bewust 3 artikelen zodat zichtbaar is dat de parser meer dan 2 aankan.
   */
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
