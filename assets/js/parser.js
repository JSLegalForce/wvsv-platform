/** parser.js v17 - structuurparser Boek/Hoofdstuk/Titel + artikelen */
const WvSvParser = (() => {
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
  function splitTitelInhoud(segment) {
    let s = segment.trim();
    if (!s) return { titel: '', inhoud: '' };
    if (/^\d+\./.test(s)) return { titel: '', inhoud: s };
    const lm = s.match(/^(.*?)\s+(?=\d+\.\s)/);
    if (lm && lm[1].trim()) { return { titel: reinigTitel(lm[1].trim()), inhoud: s.substring(lm[0].length) }; }
    return { titel: reinigTitel(s), inhoud: '' };
  }
  function normaliseer(tekst) {
    return tekst
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/((?:Boek|Hoofdstuk|Titel|Afdeling|§)\s+\d)/g, '\n\n$1')
      .replace(/(^|\n|\.)\s*Art\.\s+(\d)/g, '$1\nArtikel $2')
      .replace(/\bArtikel\s+(\d)/g, '\nArtikel $1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
    function zoekWettekstZone(tekst) {
    var regels = tekst.split('\n');
    var n = regels.length;
    var b1pos = [];
    for (var i = 0; i < n; i++) {
      if (/^\s*Boek\s+1\b/i.test(regels[i])) b1pos.push(i);
    }
    function isInhoudsopgave(pos) {
      for (var j = pos+1; j < Math.min(pos+6,n); j++) {
        if (/^\s*Boek\s+[2-9]/i.test(regels[j])) return true;
      }
      return false;
    }
    var startRegel = -1;
    for (var k = 0; k < b1pos.length; k++) {
      if (!isInhoudsopgave(b1pos[k])) { startRegel = b1pos[k]; break; }
    }
    if (startRegel < 0) {
      for (var i2 = 0; i2 < n; i2++) {
        if (/^\s*Artikel\s+1\.1\.1\b/i.test(regels[i2])) { startRegel = i2; break; }
      }
    }
    if (startRegel < 0 && b1pos.length > 0) startRegel = b1pos[b1pos.length-1];
    if (startRegel < 0) { _logZone('START niet gevonden', tekst); return tekst; }
    var reEinde = /^\s*(Transponeringstabel|Bijlage\b)/i;
    var eindRegel = n;
    for (var m = startRegel+1; m < n; m++) {
      if (reEinde.test(regels[m])) { eindRegel = m; break; }
    }
    var zone = regels.slice(startRegel, eindRegel).join('\n');
    _logZone('Zone: regel '+startRegel+'-'+eindRegel+' | '+zone.length+' tekens', zone);
    return zone;
  }
  function _logZone(label, zone) {
    setTimeout(function() {
      var blok = document.getElementById('debug-log');
      if (!blok) return;
      var tijd = new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      var voeg = function(t) {
        var d = document.createElement('div');
        d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;color:#7ec8e3;';
        d.textContent = '['+tijd+'] [Zone] '+t;
        blok.appendChild(d); blok.scrollTop = blok.scrollHeight;
      };
      voeg(label);
      voeg('Eerste 300: '+zone.substring(0,300).replace(/\n/g,' '));
      voeg('Laatste 300: '+zone.substring(Math.max(0,zone.length-300)).replace(/\n/g,' '));
    }, 0);
  }

  function parseerStructuur(tekst) {
    if (!tekst || !tekst.trim()) return { boeken: [] };
    const zone = zoekWettekstZone(tekst);
    const t = normaliseer(zone);
    const regels = t.split('\n');
    const reBoek = /^Boek\s+(\d+)(?:\s+(.*))?$/i;
    const reHoofdstuk = /^Hoofdstuk\s+(\d+)(?:\s+(.*))?$/i;
    const reTitel = /^Titel\s+(\d+\.\d+)(?:\s+(.*))?$/i;
    const reArtikel = new RegExp('^Artikel\\s+([\\d]+(?:[\\s.]+[\\d]+)*)(?:\\s+(.*))?$');
    const structuurItems = [];
    for (let i = 0; i < regels.length; i++) {
      const r = regels[i].trim();
      if (!r) continue;
      let m;
      if ((m = reBoek.exec(r))) {
        structuurItems.push({ type: 'boek', nummer: m[1], titel: (m[2]||'Boek '+m[1]).trim(), pos: i });
      } else if ((m = reHoofdstuk.exec(r))) {
        structuurItems.push({ type: 'hoofdstuk', nummer: m[1], titel: (m[2]||'Hoofdstuk '+m[1]).trim(), pos: i });
      } else if ((m = reTitel.exec(r))) {
        structuurItems.push({ type: 'titel', nummer: m[1], titel: (m[2]||'Titel '+m[1]).trim(), pos: i });
      } else if ((m = reArtikel.exec(r))) {
        const nr = m[1].trim().replace(/\s+/g, '.').replace(/\.+/g, '.');
        structuurItems.push({ type: 'artikel', nummer: nr, titel: (m[2]||'Artikel '+nr).trim(), pos: i });
      }
    }
    const boeken = [];
    let huidigBoek = null, huidigHoofdstuk = null, huidigTitel = null;
    for (const item of structuurItems) {
      if (item.type === 'boek') {
        huidigBoek = { nummer: item.nummer, titel: item.titel, hoofdstukken: [] };
        huidigHoofdstuk = null; huidigTitel = null;
        boeken.push(huidigBoek);
      } else if (item.type === 'hoofdstuk') {
        if (!huidigBoek) { huidigBoek = { nummer: '?', titel: 'Onbekend boek', hoofdstukken: [] }; boeken.push(huidigBoek); }
        huidigHoofdstuk = { nummer: item.nummer, titel: item.titel, titels: [] };
        huidigTitel = null;
        huidigBoek.hoofdstukken.push(huidigHoofdstuk);
      } else if (item.type === 'titel') {
        if (!huidigHoofdstuk) {
          if (!huidigBoek) { huidigBoek = { nummer: '?', titel: 'Onbekend boek', hoofdstukken: [] }; boeken.push(huidigBoek); }
          huidigHoofdstuk = { nummer: '?', titel: 'Onbekend hoofdstuk', titels: [] };
          huidigBoek.hoofdstukken.push(huidigHoofdstuk);
        }
        huidigTitel = { nummer: item.nummer, titel: item.titel, artikelen: [] };
        huidigHoofdstuk.titels.push(huidigTitel);
      } else if (item.type === 'artikel') {
        if (huidigTitel) { huidigTitel.artikelen.push(item.nummer); }
      }
    }
    const debugItems = structuurItems.slice(0, 10);
    _toonStructuurDebug(boeken, debugItems);
    return { boeken };
  }
  function _toonStructuurDebug(boeken, debugItems) {
    const blok = document.getElementById('debug-log');
    if (!blok) return;
    const tijd = new Date().toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const voeg = (tekst, rood) => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' + (rood ? 'color:#ff6b6b;font-weight:bold;' : '');
      d.textContent = '[' + tijd + '] [Struct] ' + tekst;
      blok.appendChild(d);
      blok.scrollTop = blok.scrollHeight;
    };
    const totHfst = boeken.reduce(function(s,b){return s+b.hoofdstukken.length;},0);
    const totTitel = boeken.reduce(function(s,b){return s+b.hoofdstukken.reduce(function(s2,h){return s2+h.titels.length;},0);},0);
    voeg('Boeken: ' + boeken.length + ' | Hoofdstukken: ' + totHfst + ' | Titels: ' + totTitel);
    if (debugItems.length > 0) {
      voeg('Eerste 10 structuurkoppen:');
      debugItems.forEach(i => voeg(' [' + i.type.toUpperCase() + '] ' + i.nummer + ' — ' + i.titel.substring(0,50)));
    }
    if (boeken.length === 0) voeg('Geen structuurkoppen gevonden', true);
  }
  function parseerArtikelen(tekst) {
    const artikelen = [];
    if (!tekst || !tekst.trim()) return artikelen;
    const zone2 = zoekWettekstZone(tekst);
    const t = normaliseer(zone2);
    const re = /(?:^|(?<=\n))\s*Artikel\s+([\d]+(?:[\s.]+[\d]+)*)/g;
    const matches = [];
    let m;
    while ((m = re.exec(t)) !== null) {
      const nummer = m[1].trim().replace(/\s+/g, '.').replace(/\.+/g, '.');
      const pos = m.index;
      const restStart = m.index + m[0].length;
      matches.push({ nummer, pos, restStart });
    }
    const debugStarts = [];
    const debugSegmenten = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i];
      let einde = (i + 1 < matches.length) ? matches[i + 1].pos : t.length;
      let segment = t.substring(start.restStart, einde);
      const grens = segment.search(/\n\n(?:Boek|Hoofdstuk|Titel|Afdeling|§)\s+\d/);
      if (grens >= 0) segment = segment.substring(0, grens);
      segment = segment.replace(/\s+/g, ' ').trim();
      const ti = splitTitelInhoud(segment);
      artikelen.push({ artikel: start.nummer, titel: ti.titel, inhoud: ti.inhoud });
      if (debugStarts.length < 20) debugStarts.push({ nummer: start.nummer, pos: start.pos });
      if (debugSegmenten.length < 10) debugSegmenten.push({ nr: start.nummer, titel: ti.titel, inhoudStart: (ti.inhoud || '').substring(0, 120) });
    }
    _toonParserDebug(debugStarts, debugSegmenten, artikelen.length, matches.length);
    return artikelen;
  }
  function _toonParserDebug(starts, segmenten, totaal, totaalKandidaten) {
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
    voeg('Artikel-koppen: ' + totaalKandidaten + ' | Artikelen: ' + totaal);
    if (starts.length > 0) { voeg('Eerste 20 artikelkoppen:'); starts.forEach(s => voeg(' pos=' + s.pos + ' Art. ' + s.nummer)); }
    if (segmenten.length > 0) { voeg('Eerste 10 segmenten:'); segmenten.forEach(s => voeg(' ' + s.nr + (s.titel ? ' [' + s.titel + ']' : '') + ' -> ' + s.inhoudStart.substring(0, 80))); }
    if (totaal === 0) voeg('FOUT: geen artikelen gevonden', true);
  }
  const TESTDATA = 'Art. 2.5.1 Opsporingsbevoegdheden algemeen 1. De opsporingsambtenaar is bevoegd alle handelingen te verrichten die redelijkerwijs nodig zijn voor de vervulling van zijn taak. 2. Bij de uitoefening van zijn bevoegdheden houdt hij rekening met de grondrechten van de betrokkenen. Art. 2.5.2 Legitimatieplicht opsporingsambtenaar 1. De opsporingsambtenaar is verplicht zich op eerste verzoek te legitimeren. Art. 2.5.3 Staandehouding verdachten en getuigen 1. Iedere opsporingsambtenaar kan de verdachte staande houden om zijn identiteit vast te stellen. 2. Iedere opsporingsambtenaar kan de getuige staande houden. 3. De staandehouding duurt zo kort als mogelijk is. Art. 2.5.4 [aanhouding bij heterdaad] 1. In geval van ontdekking op heterdaad van een strafbaar feit kan ieder de verdachte aanhouden. 2. De opsporingsambtenaar die een verdachte bij ontdekking op heterdaad aanhoudt, geleidt hem zo spoedig mogelijk voor. 3. Vindt de aanhouding plaats door een ander dan een opsporingsambtenaar, dan levert deze de aangehoudene onverwijld over. Art. 2.5.5 Recht op mededeling 1. De verdachte heeft het recht dat hem zo spoedig mogelijk wordt meegedeeld ter zake van welk strafbaar feit hij als verdachte wordt aangemerkt. Art. 2.5.6 Aanhouding buiten heterdaad 1. In geval van verdenking van een misdrijf waarvoor voorlopige hechtenis is toegelaten, is de officier van justitie bevoegd de verdachte te doen aanhouden. Art. 2.5.7 Voorgeleiding en inverzekeringstelling 1. De aangehouden verdachte wordt zo spoedig mogelijk voorgeleid aan de officier van justitie. 2. De officier van justitie kan de verdachte in verzekering stellen. 3. De inverzekeringstelling duurt ten hoogste drie dagen. 4. De verdachte wordt onverwijld in kennis gesteld van zijn recht op bijstand van een raadsman.';
  return { parseerArtikelen, parseerStructuur, normaliseer, zoekWettekstZone, isKop: function(r){const m=/^\s*Artikel\s+(\d+\.\d+(?:\.\d+)*)\s*\.?\s*(.*)/i.exec(r.trim());if(!m)return null;return{nummer:m[1].trim(),rest:m[2].trim()};}, TESTDATA };
})();
if (typeof module !== 'undefined') module.exports = WvSvParser;
