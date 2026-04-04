/** parser.js v16 - FASE 1: structuurgedreven parser WvSv - wettekstzone v2 */
const WvSvParser = (() => {

  /* ── helpers ─────────────────────────────────────────────────── */
  function reinigTitel(titel) {
    if (!titel) return '';
    let t = titel.trim();
    t = t.replace(/^[[a-z]s+/i, '');
    t = t.replace(/^[a-z]s+(?=[A-Z[])/, '');
    let open = (t.match(/[/g) || []).length;
    let sluit = (t.match(/]/g) || []).length;
    while (sluit > open && t.endsWith(']')) { t = t.slice(0,-1).trim(); sluit--; }
    t = t.replace(/[s*]/g, '').trim();
    return t;
  }

  function splitTitelInhoud(segment) {
    let s = segment.trim();
    if (!s) return { titel: '', inhoud: '' };
    if (/^d+./.test(s)) return { titel: '', inhoud: s };
    const lm = s.match(/^(.*?)s+(?=d+.s)/);
    if (lm && lm[1].trim()) {
      return { titel: reinigTitel(lm[1].trim()), inhoud: s.substring(lm[0].length) };
    }
    return { titel: reinigTitel(s), inhoud: '' };
  }

  function normaliseer(tekst) {
    return tekst
      .replace(/

/g, '
').replace(/
/g, '
')
      .replace(/[^S
]+/g, ' ')
      .replace(/(?<=[^
])s*(Boeks+d)/g, '

$1')
      .replace(/(?<=[^
])s*(Hoofdstuks+d)/g, '

$1')
      .replace(/(?<=[^
])s*(Titels+d+.d)/g, '

$1')
      .replace(/(^|
|.)s*Art.s+(d)/g, '$1
Artikel $2')
      .replace(/Artikels+(d)/g, '
Artikel $1')
      .replace(/
{3,}/g, '

')
      .trim();
  }

  /* ── wettekstzone-afbakening v2 ──────────────────────────────── */
  /*
   * START: eerste "Boek 1" waarbij "Boek 2" NIET binnen 5 regels staat.
   *        Inhoudsopgave: "Boek 1
Boek 2
Boek 3" staan dicht op elkaar.
   *        Echte wettekst: "Boek 1" heeft hoofdstukken/artikelen ertussen.
   *
   * Fallback volgorde:
   *   1. Boek 1 zonder Boek 2 binnen 5 regels  (echte wettekst)
   *   2. Artikel 1.1.1                          (als geen Boek 1 gevonden)
   *   3. Laatste Boek 1                         (noodgeval)
   *   4. Volledige tekst                        (niets gevonden)
   *
   * EINDE: eerste regel die begint met:
   *   "Transponeringstabel" | "TRANSPONERINGSTABEL" | "Bijlage" | "BIJLAGE"
   */
  function zoekWettekstZone(tekst) {
    const regels = tekst.split('
');
    const n = regels.length;

    /* stap 1 – verzamel alle Boek 1 posities */
    const boek1Posities = [];
    for (let i = 0; i < n; i++) {
      if (/^s*Boeks+1/i.test(regels[i])) boek1Posities.push(i);
    }

    /* stap 2 – vind eerste ECHTE Boek 1:
       inhoudsopgave heeft Boek 2 binnen 5 regels, echte wettekst niet */
    function isInhoudsopgave(pos) {
      for (let j = pos + 1; j < Math.min(pos + 6, n); j++) {
        if (/^s*Boeks+[2-9]/i.test(regels[j])) return true;
      }
      return false;
    }

    let startRegel = -1;
    for (const pos of boek1Posities) {
      if (!isInhoudsopgave(pos)) { startRegel = pos; break; }
    }

    /* stap 3 – fallback op Artikel 1.1.1 */
    if (startRegel < 0) {
      for (let i = 0; i < n; i++) {
        if (/^s*Artikels+1.1.1/i.test(regels[i])) { startRegel = i; break; }
      }
    }

    /* stap 4 – noodgeval: neem de laatste Boek 1 */
    if (startRegel < 0 && boek1Posities.length > 0) {
      startRegel = boek1Posities[boek1Posities.length - 1];
    }

    /* stap 5 – niets gevonden: volledige tekst */
    if (startRegel < 0) {
      _logZone('START niet gevonden – volledige tekst gebruikt', tekst, 0, tekst.length);
      return tekst;
    }

    /* stap 6 – zoek einde (transponeringstabel / bijlage) */
    const reEinde = /^s*(Transponeringstabel|TRANSPONERINGSTABEL|Bijlage|BIJLAGE)/i;
    let eindRegel = n;
    for (let i = startRegel + 1; i < n; i++) {
      if (reEinde.test(regels[i])) { eindRegel = i; break; }
    }

    /* stap 7 – bouw zone */
    const zone = regels.slice(startRegel, eindRegel).join('
');
    const startTeken = regels.slice(0, startRegel).join('
').length;
    const eindTeken  = startTeken + zone.length;
    _logZone(
      'Zone: regel ' + startRegel + '-' + eindRegel +
      ' | tekens ' + startTeken + '-' + eindTeken,
      zone, startTeken, eindTeken
    );
    return zone;
  }

  function _logZone(label, zone, startTeken, eindTeken) {
    setTimeout(function() {
      const blok = document.getElementById('debug-log');
      if (!blok) return;
      const tijd = new Date().toLocaleTimeString('nl-NL',
        { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      const voeg = (tekst) => {
        const d = document.createElement('div');
        d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;color:#7ec8e3;';
        d.textContent = '[' + tijd + '] [Zone] ' + tekst;
        blok.appendChild(d); blok.scrollTop = blok.scrollHeight;
      };
      voeg(label);
      voeg('Zone: ' + zone.length + ' tekens | start: ' + startTeken + ' | eind: ' + eindTeken);
      voeg('Eerste 300: ' + zone.substring(0, 300).replace(/
/g,' '));
      voeg('Laatste 300: ' + zone.substring(Math.max(0, zone.length-300)).replace(/
/g,' '));
    }, 0);
  }

  /* ── structuurparser ─────────────────────────────────────────── */
  function parseerStructuur(tekst) {
    if (!tekst || !tekst.trim()) return { boeken: [] };

    const zone = zoekWettekstZone(tekst);
    const t = normaliseer(zone);
    const regels = t.split('
');

    const reBoek      = /^Boeks+(d+)s*(.*)$/i;
    const reHoofdstuk = /^Hoofdstuks+(d+)s*(.*)$/i;
    const reTitel     = /^Titels+(d+.d+)s*(.*)$/i;
    const reArtikel   = /^Artikels+([d]+(?:[s.][d]+[a-z]?)*)s*(.*)$/i;

    const structuurItems = [];
    for (let i = 0; i < regels.length; i++) {
      const r = regels[i].trim();
      if (!r) continue;
      let m;
      if ((m = reBoek.exec(r))) {
        structuurItems.push({ type:'boek', nummer:m[1].trim(), titel:(m[2]||'').trim(), pos:i });
      } else if ((m = reHoofdstuk.exec(r))) {
        structuurItems.push({ type:'hoofdstuk', nummer:m[1].trim(), titel:(m[2]||'').trim(), pos:i });
      } else if ((m = reTitel.exec(r))) {
        structuurItems.push({ type:'titel', nummer:m[1].trim(), titel:(m[2]||'').trim(), pos:i });
      } else if ((m = reArtikel.exec(r))) {
        const nr = m[1].trim().replace(/s+/g,'.').replace(/.+/g,'.');
        structuurItems.push({ type:'artikel', nummer:nr, titel:(m[2]||'').trim(), pos:i });
      }
    }

    const boeken = [];
    let huidigBoek = null, huidigHoofdstuk = null, huidigTitel = null;
    for (const item of structuurItems) {
      if (item.type === 'boek') {
        huidigBoek = { nummer:item.nummer, titel:item.titel||('Boek '+item.nummer), hoofdstukken:[] };
        huidigHoofdstuk = null; huidigTitel = null;
        boeken.push(huidigBoek);
      } else if (item.type === 'hoofdstuk') {
        if (!huidigBoek) { huidigBoek = { nummer:'?', titel:'Onbekend boek', hoofdstukken:[] }; boeken.push(huidigBoek); }
        huidigHoofdstuk = { nummer:item.nummer, titel:item.titel||('Hoofdstuk '+item.nummer), titels:[] };
        huidigTitel = null;
        huidigBoek.hoofdstukken.push(huidigHoofdstuk);
      } else if (item.type === 'titel') {
        if (!huidigBoek) { huidigBoek = { nummer:'?', titel:'Onbekend boek', hoofdstukken:[] }; boeken.push(huidigBoek); }
        if (!huidigHoofdstuk) { huidigHoofdstuk = { nummer:'?', titel:'Onbekend hoofdstuk', titels:[] }; huidigBoek.hoofdstukken.push(huidigHoofdstuk); }
        huidigTitel = { nummer:item.nummer, titel:item.titel||('Titel '+item.nummer), artikelen:[] };
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

    const zone = zoekWettekstZone(tekst);
    const t = normaliseer(zone);

    const re = /(?:^|(?<=
))s*Artikels+([d]+(?:[s.]+[d]+[a-z]?)*)s*/g;
    const matches = [];
    let m;
    while ((m = re.exec(t)) !== null) {
      const nummer = m[1].trim().replace(/s+/g,'.').replace(/.+/g,'.');
      matches.push({ nummer, pos:m.index, restStart:m.index+m[0].length });
    }

    const debugStarts = [], debugSegmenten = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i];
      let einde = (i+1 < matches.length) ? matches[i+1].pos : t.length;
      let segment = t.substring(start.restStart, einde);
      const grens = segment.search(/

(?:Boek|Hoofdstuk|Titel|Afdeling|§)s+d/);
      if (grens >= 0) segment = segment.substring(0, grens);
      segment = segment.replace(/s+/g,' ').trim();
      const ti = splitTitelInhoud(segment);
      artikelen.push({ artikel:start.nummer, titel:ti.titel, inhoud:ti.inhoud });
      if (debugStarts.length < 20)    debugStarts.push({ nummer:start.nummer, pos:start.pos });
      if (debugSegmenten.length < 10) debugSegmenten.push({ nr:start.nummer, titel:ti.titel, inhoudStart:(ti.inhoud||'').substring(0,120) });
    }
    _toonParserDebug(debugStarts, debugSegmenten, artikelen.length, matches.length);
    return artikelen;
  }

  /* ── debug helpers ───────────────────────────────────────────── */
  function _toonStructuurDebug(boeken, debugItems) {
    const blok = document.getElementById('debug-log');
    if (!blok) return;
    const tijd = new Date().toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const voeg = (tekst, rood) => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' + (rood ? 'color:#ff6b6b;font-weight:bold;' : '');
      d.textContent = '[' + tijd + '] [Struct] ' + tekst;
      blok.appendChild(d); blok.scrollTop = blok.scrollHeight;
    };
    const totHfst = boeken.reduce((s,b)=>s+b.hoofdstukken.length,0);
    const totTitel = boeken.reduce((s,b)=>s+b.hoofdstukken.reduce((s2,h)=>s2+h.titels.length,0),0);
    const totArt   = boeken.reduce((s,b)=>s+b.hoofdstukken.reduce((s2,h)=>s2+h.titels.reduce((s3,t)=>s3+t.artikelen.length,0),0),0);
    voeg('Boeken: '+boeken.length+' | Hoofdstukken: '+totHfst+' | Titels: '+totTitel+' | Artikelrefs: '+totArt);
    if (debugItems.length > 0) {
      voeg('Eerste 10 structuurkoppen:');
      debugItems.forEach(i => voeg('  ['+i.type.toUpperCase()+'] '+i.nummer+(i.titel?' - '+i.titel.substring(0,50):'')+' (pos:'+i.pos+')'));
    }
    if (boeken.length === 0) voeg('Geen structuurkoppen gevonden - controleer invoerformaat', true);
  }

  function _toonParserDebug(starts, segmenten, totaal, totaalKandidaten) {
    const blok = document.getElementById('debug-log');
    if (!blok) return;
    const tijd = new Date().toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const voeg = (tekst, rood) => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' + (rood ? 'color:#ff6b6b;font-weight:bold;' : '');
      d.textContent = '[' + tijd + '] [Parser] ' + tekst;
      blok.appendChild(d); blok.scrollTop = blok.scrollHeight;
    };
    voeg('Artikel-koppen: '+totaalKandidaten+' | Artikelen: '+totaal);
    if (starts.length > 0) {
      voeg('Eerste 20 artikelkoppen:');
      starts.forEach(s => voeg('  pos='+s.pos+' Art. '+s.nummer));
    }
    if (segmenten.length > 0) {
      voeg('Eerste 10 segmenten:');
      segmenten.forEach(s => voeg('  '+s.nr+(s.titel?' ['+s.titel+']':'')+' -> '+s.inhoudStart.substring(0,80)));
    }
    if (totaal === 0) voeg('FOUT: geen artikelen gevonden', true);
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
      const m = /^s*Artikels+(d+.d+(?:.d+[a-z?]?)*)s*.?s*(.*)/i.exec(r.trim());
      if (!m) return null;
      return { nummer: m[1].trim(), rest: m[2].trim() };
    },
    TESTDATA
  };
})();
if (typeof module !== 'undefined') module.exports = WvSvParser;
