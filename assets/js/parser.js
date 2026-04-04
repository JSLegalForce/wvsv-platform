/** parser.js v15 - FASE 1: structuurgedreven parser WvSv - met wettekstzone-afbakening */
const WvSvParser = (() => {

  /* ── helpers ─────────────────────────────────────────────────── */
  function reinigTitel(titel) {
    if (!titel) return '';
    let t = titel.trim();
    t = t.replace(/^\[[a-z]\s+/i, '');
    t = t.replace(/^[a-z]\s+(?=[A-Z\[])/, '');
    let open = (t.match(/\[/g) || []).length;
    let sluit = (t.match(/\]/g) || []).length;
    while (sluit > open && t.endsWith(']')) { t = t.slice(0,-1).trim(); sluit--; }
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

  function normaliseer(tekst) {
    return tekst
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/(?<=[^\n])\s*(Boek\s+\d)/g, '\n\n$1')
      .replace(/(?<=[^\n])\s*(Hoofdstuk\s+\d)/g, '\n\n$1')
      .replace(/(?<=[^\n])\s*(Titel\s+\d+\.\d)/g, '\n\n$1')
      .replace(/(^|\n|\.)\s*Art\.\s+(\d)/g, '$1\nArtikel $2')
      .replace(/\bArtikel\s+(\d)/g, '\nArtikel $1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /* ── wettekstzone-afbakening ─────────────────────────────────── */
  /*
   * Strategie:
   *   START: de LAATSTE positie vóór of op "Boek 1" of "Artikel 1.1.1"
   *          die na een paginablok met inhoud staat én niet in de
   *          inhoudsopgave zit.
   *          We zoeken naar "Boek 1" gevolgd door content op de volgende
   *          regels (niet meteen opnieuw "Boek" / "Hoofdstuk" / nummers).
   *
   *   EINDE: de eerste positie van een slotsectie:
   *          - "Transponeringstabel"
   *          - "Bijlage" (op eigen regel)
   *          - "BIJLAGE"
   *          - "Toelichting" (op eigen regel, alleen als na uitgebreide tekst)
   *
   *   Detectie inhoudsopgave:
   *          Een "Boek 1" is waarschijnlijk inhoudsopgave als op dezelfde
   *          of de volgende 1-3 regels ook "Boek 2", "Boek 3" etc. staan
   *          zonder tussenliggende inhoudstekst (>100 tekens).
   */
  function zoekWettekstZone(tekst) {
    const regels = tekst.split('\n');
    const n = regels.length;

    /* -- stap 1: zoek kandidaat-startregels "Boek 1" ── */
    const reBoek1   = /^\s*Boek\s+1\b/i;
    const reBoekN   = /^\s*Boek\s+\d+\b/i;
    const reArt111  = /^\s*Artikel\s+1\.1\.1\b/i;

    // Verzamel alle regelnummers waar "Boek 1" voorkomt
    const boek1Posities = [];
    for (let i = 0; i < n; i++) {
      if (reBoek1.test(regels[i])) boek1Posities.push(i);
    }

    /* -- stap 2: onderscheid echte Boek 1 van inhoudsopgave ── */
    // In de inhoudsopgave staan Boek 1, Boek 2, Boek 3 ... vlak achter elkaar
    // (binnen 20 regels). In de echte wettekst is tussen Boek 1 en Boek 2
    // veel content (hoofdstukken, titels, artikelen).
    function isInhoudsopgaveBoek1(pos) {
      // Kijk of binnen 30 regels na pos ook "Boek 2" of "Boek 3" staat
      // én er geen "Artikel" staat in die 30 regels
      let heeftBoek2 = false, heeftArtikel = false;
      for (let j = pos + 1; j < Math.min(pos + 30, n); j++) {
        if (/^\s*Boek\s+[2-9]/i.test(regels[j])) heeftBoek2 = true;
        if (/^\s*Artikel\s+/i.test(regels[j])) heeftArtikel = true;
      }
      return heeftBoek2 && !heeftArtikel;
    }

    // Vind de eerste "echte" Boek 1 (niet in inhoudsopgave)
    let startRegel = -1;
    for (const pos of boek1Posities) {
      if (!isInhoudsopgaveBoek1(pos)) {
        startRegel = pos;
        break;
      }
    }

    // Fallback: zoek op Artikel 1.1.1 als Boek 1 niet gevonden/onderscheiden
    if (startRegel < 0) {
      for (let i = 0; i < n; i++) {
        if (reArt111.test(regels[i])) { startRegel = i; break; }
      }
    }

    // Fallback 2: eerste echte "Boek X" ongeacht positie
    if (startRegel < 0 && boek1Posities.length > 0) {
      startRegel = boek1Posities[boek1Posities.length - 1]; // neem de laatste
    }

    // Niets gevonden → geef volledige tekst terug
    if (startRegel < 0) {
      _logZone('START niet gevonden – volledige tekst gebruikt', tekst.length, tekst);
      return tekst;
    }

    /* -- stap 3: zoek einde wettekst ── */
    const reEinde = /^\s*(Transponeringstabel|TRANSPONERINGSTABEL|Bijlage\b|BIJLAGE\b)/i;
    let eindRegel = n; // standaard: tot het einde
    for (let i = startRegel + 1; i < n; i++) {
      if (reEinde.test(regels[i])) {
        eindRegel = i;
        break;
      }
    }

    /* -- stap 4: bouw zone ── */
    const zone = regels.slice(startRegel, eindRegel).join('\n');
    const startTeken = regels.slice(0, startRegel).join('\n').length;
    const eindTeken  = startTeken + zone.length;

    _logZone(
      'Zone: regel ' + startRegel + '-' + eindRegel +
      ' | tekens ' + startTeken + '-' + eindTeken,
      zone.length,
      zone
    );

    return zone;
  }

  function _logZone(label, zoneLen, zone) {
    // Wacht tot DOM beschikbaar is
    setTimeout(function() {
      let blok = document.getElementById('debug-log');
      if (!blok) return;
      const tijd = new Date().toLocaleTimeString('nl-NL',
        { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      const voeg = (tekst, rood) => {
        const d = document.createElement('div');
        d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' +
          (rood ? 'color:#ff6b6b;font-weight:bold;' : 'color:#7ec8e3;');
        d.textContent = '[' + tijd + '] [Zone] ' + tekst;
        blok.appendChild(d);
        blok.scrollTop = blok.scrollHeight;
      };
      voeg(label);
      voeg('Zone lengte: ' + zoneLen + ' tekens');
      voeg('Eerste 300 tekens: ' + zone.substring(0, 300).replace(/\n/g,' '));
      voeg('Laatste 300 tekens: ' + zone.substring(Math.max(0, zone.length - 300)).replace(/\n/g,' '));
    }, 0);
  }

  /* ── structuurparser ─────────────────────────────────────────── */
  function parseerStructuur(tekst) {
    if (!tekst || !tekst.trim()) return { boeken: [] };

    // Stap 1: afbakenen op wettekstzone
    const zone = zoekWettekstZone(tekst);

    const t = normaliseer(zone);
    const regels = t.split('\n');
    const reBoek      = /^Boek\s+(\d+)\s*(.*)$/i;
    const reHoofdstuk = /^Hoofdstuk\s+(\d+)\s*(.*)$/i;
    const reTitel     = /^Titel\s+(\d+\.\d+)\s*(.*)$/i;
    const reArtikel   = /^Artikel\s+([\d]+(?:[\s.][\d]+[a-z]?)*)\s*(.*)$/i;

    const structuurItems = [];
    for (let i = 0; i < regels.length; i++) {
      const r = regels[i].trim();
      if (!r) continue;
      let m;
      if ((m = reBoek.exec(r))) {
        structuurItems.push({ type:'boek', nummer:m[1].trim(),
          titel:(m[2]||'').trim(), pos:i });
      } else if ((m = reHoofdstuk.exec(r))) {
        structuurItems.push({ type:'hoofdstuk', nummer:m[1].trim(),
          titel:(m[2]||'').trim(), pos:i });
      } else if ((m = reTitel.exec(r))) {
        structuurItems.push({ type:'titel', nummer:m[1].trim(),
          titel:(m[2]||'').trim(), pos:i });
      } else if ((m = reArtikel.exec(r))) {
        const nr = m[1].trim().replace(/\s+/g,'.').replace(/\.+/g,'.');
        structuurItems.push({ type:'artikel', nummer:nr,
          titel:(m[2]||'').trim(), pos:i });
      }
    }

    const boeken = [];
    let huidigBoek = null, huidigHoofdstuk = null, huidigTitel = null;
    for (const item of structuurItems) {
      if (item.type === 'boek') {
        huidigBoek = { nummer:item.nummer,
          titel:item.titel||('Boek '+item.nummer), hoofdstukken:[] };
        huidigHoofdstuk = null; huidigTitel = null;
        boeken.push(huidigBoek);
      } else if (item.type === 'hoofdstuk') {
        if (!huidigBoek) {
          huidigBoek = { nummer:'?', titel:'Onbekend boek', hoofdstukken:[] };
          boeken.push(huidigBoek);
        }
        huidigHoofdstuk = { nummer:item.nummer,
          titel:item.titel||('Hoofdstuk '+item.nummer), titels:[] };
        huidigTitel = null;
        huidigBoek.hoofdstukken.push(huidigHoofdstuk);
      } else if (item.type === 'titel') {
        if (!huidigBoek) {
          huidigBoek = { nummer:'?', titel:'Onbekend boek', hoofdstukken:[] };
          boeken.push(huidigBoek);
        }
        if (!huidigHoofdstuk) {
          huidigHoofdstuk = { nummer:'?', titel:'Onbekend hoofdstuk', titels:[] };
          huidigBoek.hoofdstukken.push(huidigHoofdstuk);
        }
        huidigTitel = { nummer:item.nummer,
          titel:item.titel||('Titel '+item.nummer), artikelen:[] };
        huidigHoofdstuk.titels.push(huidigTitel);
      } else if (item.type === 'artikel') {
        if (huidigTitel) huidigTitel.artikelen.push(item.nummer);
      }
    }

    _toonStructuurDebug(boeken, structuurItems.slice(0,10));
    return { boeken };
  }

  /* ── artikelparser ───────────────────────────────────────────── */
  function parseerArtikelen(tekst) {
    const artikelen = [];
    if (!tekst || !tekst.trim()) return artikelen;

    // Stap 1: afbakenen op wettekstzone
    const zone = zoekWettekstZone(tekst);

    const t = normaliseer(zone);
    const re = /(?:^|(?<=\n))\s*Artikel\s+([\d]+(?:[\s.]+[\d]+[a-z]?)*)\s*/g;
    const matches = [];
    let m;
    while ((m = re.exec(t)) !== null) {
      const nummer = m[1].trim().replace(/\s+/g,'.').replace(/\.+/g,'.');
      matches.push({ nummer, pos:m.index, restStart:m.index+m[0].length });
    }

    const debugStarts = [], debugSegmenten = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i];
      let einde = (i+1 < matches.length) ? matches[i+1].pos : t.length;
      let segment = t.substring(start.restStart, einde);
      const grens = segment.search(/\n\n(?:Boek|Hoofdstuk|Titel|Afdeling|§)\s+\d/);
      if (grens >= 0) segment = segment.substring(0, grens);
      segment = segment.replace(/\s+/g,' ').trim();
      const ti = splitTitelInhoud(segment);
      artikelen.push({ artikel:start.nummer, titel:ti.titel, inhoud:ti.inhoud });
      if (debugStarts.length < 20)   debugStarts.push({ nummer:start.nummer, pos:start.pos });
      if (debugSegmenten.length < 10) debugSegmenten.push({
        nr:start.nummer, titel:ti.titel, inhoudStart:(ti.inhoud||'').substring(0,120) });
    }
    _toonParserDebug(debugStarts, debugSegmenten, artikelen.length, matches.length);
    return artikelen;
  }

  /* ── debug helpers ───────────────────────────────────────────── */
  function _toonStructuurDebug(boeken, debugItems) {
    const blok = document.getElementById('debug-log');
    if (!blok) return;
    const tijd = new Date().toLocaleTimeString('nl-NL',
      { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const voeg = (tekst, rood) => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' +
        (rood ? 'color:#ff6b6b;font-weight:bold;' : '');
      d.textContent = '[' + tijd + '] [Struct] ' + tekst;
      blok.appendChild(d); blok.scrollTop = blok.scrollHeight;
    };
    const totHfst = boeken.reduce((s,b)=>s+b.hoofdstukken.length,0);
    const totTitel = boeken.reduce((s,b)=>s+b.hoofdstukken.reduce((s2,h)=>s2+h.titels.length,0),0);
    const totArt   = boeken.reduce((s,b)=>s+b.hoofdstukken.reduce((s2,h)=>s2+h.titels.reduce((s3,t)=>s3+t.artikelen.length,0),0),0);
    voeg('Boeken: '+boeken.length+' | Hoofdstukken: '+totHfst+' | Titels: '+totTitel+' | Artikelrefs: '+totArt);
    if (debugItems.length>0) {
      voeg('Eerste 10 structuurkoppen:');
      debugItems.forEach(i=>voeg('  ['+i.type.toUpperCase()+'] '+i.nummer+(i.titel?' - '+i.titel.substring(0,50):'')+' (pos:'+i.pos+')'));
    }
    if (boeken.length===0) voeg('Geen structuurkoppen gevonden - controleer invoerformaat', true);
  }

  function _toonParserDebug(starts, segmenten, totaal, totaalKandidaten) {
    const blok = document.getElementById('debug-log');
    if (!blok) return;
    const tijd = new Date().toLocaleTimeString('nl-NL',
      { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const voeg = (tekst, rood) => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' +
        (rood ? 'color:#ff6b6b;font-weight:bold;' : '');
      d.textContent = '[' + tijd + '] [Parser] ' + tekst;
      blok.appendChild(d); blok.scrollTop = blok.scrollHeight;
    };
    voeg('Artikel-koppen: '+totaalKandidaten+' | Artikelen: '+totaal);
    if (starts.length>0) {
      voeg('Eerste 20 artikelkoppen:');
      starts.forEach(s=>voeg('  pos='+s.pos+' Art. '+s.nummer));
    }
    if (segmenten.length>0) {
      voeg('Eerste 10 segmenten:');
      segmenten.forEach(s=>voeg('  '+s.nr+(s.titel?' ['+s.titel+']':'')+' -> '+s.inhoudStart.substring(0,80)));
    }
    if (totaal===0) voeg('FOUT: geen artikelen gevonden', true);
  }

  /* ── testdata ────────────────────────────────────────────────── */
  const TESTDATA = `Boek 2 Het opsporingsonderzoek Hoofdstuk 5 Bevoegdheden tot vrijheidsbeperking en vrijheidsbeneming Titel 5.1 Algemene bepalingen Artikel 2.5.1 Opsporingsbevoegdheden algemeen 1. De opsporingsambtenaar is bevoegd alle handelingen te verrichten die redelijkerwijs nodig zijn voor de vervulling van zijn taak. 2. Bij de uitoefening van zijn bevoegdheden houdt hij rekening met de grondrechten van de betrokkenen. Titel 5.2 Staandehouding en aanhouding Artikel 2.5.2 Legitimatieplicht opsporingsambtenaar 1. De opsporingsambtenaar is verplicht zich op eerste verzoek te legitimeren. Artikel 2.5.3 Staandehouding verdachten en getuigen 1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen. 2. Iedere opsporingsambtenaar kan de getuige staande houden. 3. De staandehouding duurt zo kort als mogelijk is. Artikel 2.5.4 Aanhouding bij heterdaad 1. In geval van ontdekking op heterdaad van een strafbaar feit kan ieder de verdachte aanhouden. 2. De opsporingsambtenaar die een verdachte bij ontdekking op heterdaad aanhoudt, geleidt hem zo spoedig mogelijk voor. 3. Vindt de aanhouding plaats door een ander dan een opsporingsambtenaar, dan levert deze de aangehoudene onverwijld over. Artikel 2.5.5 Recht op mededeling 1. De verdachte heeft het recht dat hem zo spoedig mogelijk wordt meegedeeld ter zake van welk strafbaar feit hij als verdachte wordt aangemerkt. Artikel 2.5.6 Aanhouding buiten heterdaad 1. In geval van verdenking van een misdrijf waarvoor voorlopige hechtenis is toegelaten, is de officier van justitie bevoegd de verdachte te doen aanhouden. Artikel 2.5.7 Voorgeleiding en inverzekeringstelling 1. De aangehouden verdachte wordt zo spoedig mogelijk voorgeleid aan de officier van justitie. 2. De officier van justitie kan de verdachte in verzekering stellen. 3. De inverzekeringstelling duurt ten hoogste drie dagen. 4. De verdachte wordt onverwijld in kennis gesteld van zijn recht op bijstand van een raadsman.`;

  /* ── publieke API ────────────────────────────────────────────── */
  return {
    parseerArtikelen,
    parseerStructuur,
    normaliseer,
    zoekWettekstZone,
    isKop: function(r) {
      const m = /^\s*Artikel\s+(\d+\.\d+(?:\.\d+[a-z?]?)*)\s*\.?\s*(.*)/i.exec(r.trim());
      if (!m) return null;
      return { nummer: m[1].trim(), rest: m[2].trim() };
    },
    TESTDATA
  };
})();
if (typeof module !== 'undefined') module.exports = WvSvParser;
