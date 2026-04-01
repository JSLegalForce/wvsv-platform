/**
 * parser.js — WvSv artikelparser
 * Herkent en splitst wetsartikelen uit platte tekst.
 */

const WvSvParser = (() => {

  function normaliseer(tekst) {
    return tekst
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  function parseerArtikelen(tekst) {
    if (!tekst || tekst.trim().length === 0) return [];
    const genormaliseerd = normaliseer(tekst);
    const resultaten = [];
    const matches = [];
    let match;
    const regex = /(?:^|\n)(Art(?:ikel)?\.?\s+(\d[\d.]*[a-z]?))/gi;
    while ((match = regex.exec(genormaliseerd)) !== null) {
      matches.push({
        positie: match.index + (match[0].startsWith('\n') ? 1 : 0),
        volleMatch: match[1].trim(),
        nummer: match[2].trim()
      });
    }
    if (matches.length === 0) return [];
    for (let i = 0; i < matches.length; i++) {
      const huidig = matches[i];
      const volgend = matches[i + 1];
      const inhoud = genormaliseerd.substring(huidig.positie, volgend ? volgend.positie : undefined).trim();
      const regels = inhoud.split('\n').filter(r => r.trim().length > 0);
      const eerstRegel = regels[0] || '';
      const titelMatch = eerstRegel.replace(huidig.volleMatch, '').trim();
      const titel = titelMatch.length > 0 && titelMatch.length < 120 ? titelMatch : '';
      resultaten.push({ artikel: huidig.nummer, titel: titel, inhoud: inhoud });
    }
    return resultaten;
  }

  const TESTDATA = `Art. 2.5.3 Staandehouding verdachten en getuigen

1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen op de wijze, bedoeld in artikel 1.4.8, eerste lid. Hij onderzoekt tevens een identiteitsbewijs als bedoeld in artikel 1 van de Wet op de identificatieplicht.

2. Iedere opsporingsambtenaar kan de getuige staande houden om zijn identiteit vast te stellen op de wijze, bedoeld in artikel 1.6.1.

Art. 2.5.4 Vasthouding ter plaatse

1. De opsporingsambtenaar die een verdachte aantreft op of in de onmiddellijke nabijheid van de plaats van het strafbaar feit, kan hem gedurende ten hoogste zes uren vasthouden voor verhoor.

2. De tijd tussen middernacht en negen uur telt voor de toepassing van het eerste lid niet mee.

3. De verdachte aan wie zijn vrijheid wordt ontnomen op grond van dit artikel heeft recht op bijstand van een raadsman.`;

  return { parseerArtikelen, normaliseer, TESTDATA };
})();

if (typeof module !== 'undefined') module.exports = WvSvParser;