/**
 * upload.js — WvSv uploadmodule v5
 *
 * Fix v5:
 *   - ID gesynchroniseerd met HTML: geladen-lijst (was: upload-bestandenlijst)
 *   - Bestand direct opgeslagen bij input EN drag-drop
 *   - Testdata wist bestand en vice versa
 *   - Volledige reset bij elke analyse
 *   - Verwijder-knoppen inline in geladen-lijst
 */
const WvSvUpload = (() => {

  const state = {
    currentFile:    null,
    currentSource:  null,
    parsedArticles: [],
    loadedItems:    [],
    jsonData:       null
  };

  function e(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setStatus(tekst, type) {
    const el = document.getElementById('upload-status');
    if (!el) return;
    el.textContent = tekst;
    el.className = 'upload-status upload-status--' + (type || 'info');
    console.log('[Upload] Status (' + (type||'info') + '):', tekst);
  }

  function toonLader(aan) {
    const el = document.getElementById('upload-lader');
    if (el) el.style.display = aan ? 'flex' : 'none';
  }

  function $id(id) { return document.getElementById(id); }

  function resetState() {
    state.currentFile    = null;
    state.currentSource  = null;
    state.parsedArticles = [];
    state.loadedItems    = [];
    state.jsonData       = null;
    console.log('[Upload] State gereset.');
  }

  function resetUI() {
    const r = $id('upload-resultaten');
    const t = $id('upload-teller');
    const g = $id('geladen-lijst');
    const i = $id('upload-bestand');
    if (r) r.innerHTML = '<div class="upload-leeg">Nog geen artikelen &mdash; analyseer een bestand of laad de testdata.</div>';
    if (t) t.textContent = '';
    if (g) g.innerHTML  = '<div class="upload-leeg" style="padding:12px 0;">Geen bestanden geladen.</div>';
    if (i) i.value = '';
    $id('btn-analyseer')?.setAttribute('disabled','true');
    $id('btn-download')?.setAttribute('disabled','true');
    console.log('[Upload] UI gereset.');
  }

  function volledigeReset() {
    resetState(); resetUI();
    setStatus('Klaar \u2014 kies een bestand of laad testdata.','info');
    console.log('[Upload] Alles gewist.');
  }

  function updateBestandenlijst() {
    const lijst = $id('geladen-lijst');
    if (!lijst) return;
    if (state.loadedItems.length === 0) {
      lijst.innerHTML = '<div class="upload-leeg" style="padding:12px 0;">Geen bestanden geladen.</div>';
      return;
    }
    lijst.innerHTML = state.loadedItems.map(function(item, idx) {
      const statusKleur = item.status === 'geanalyseerd' ? 'var(--groen)'
        : item.status === 'fout' ? 'var(--rood)' : 'var(--blauw)';
      const bronStijl = item.bron === 'testdata'
        ? 'background:rgba(176,112,0,0.12);color:var(--goud);'
        : 'background:rgba(26,42,94,0.10);color:var(--blauw);';
      return '<div class="geladen-item" id="geladen-item-' + idx + '">'
        + '<div class="geladen-item-info">'
          + '<span class="geladen-naam">' + e(item.naam) + '</span>'
          + '<div class="geladen-meta">'
            + '<span class="geladen-badge" style="background:var(--zilver);">' + e(item.type) + '</span>'
            + '<span class="geladen-badge" style="' + bronStijl + '">' + e(item.bron) + '</span>'
            + '<span class="geladen-type" style="color:' + statusKleur + ';font-weight:600;">' + e(item.status) + '</span>'
          + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;align-items:center;">'
          + (item.bron === 'testdata'
            ? '<button class="knop-gevaar-klein" onclick="WvSvUpload.verwijderTestdata()">Verwijder testdata</button>'
            : '<button class="knop-gevaar-klein" onclick="WvSvUpload.verwijderItem(' + idx + ')">Verwijderen</button>')
        + '</div>'
      + '</div>';
    }).join('');
  }

  function toonResultaten(artikelen) {
    state.parsedArticles = artikelen;
    state.jsonData = JSON.stringify(artikelen, null, 2);
    const container = $id('upload-resultaten');
    const teller    = $id('upload-teller');
    if (!artikelen || artikelen.length === 0) {
      if (container) container.innerHTML = '<div class="upload-leeg">Geen artikelen gevonden.<br>Controleer of het bestand artikelnummers bevat zoals <strong>Art. 2.5.3</strong> of <strong>Artikel 52</strong>.</div>';
      if (teller) teller.textContent = '';
      return;
    }
    if (teller) teller.textContent = artikelen.length + ' artikel' + (artikelen.length !== 1 ? 'en' : '') + ' gevonden';
    if (container) {
      container.innerHTML = artikelen.map(function(art) {
        const inhoud  = (art.inhoud || '').trim();
        const preview = inhoud.length > 300 ? inhoud.substring(0,300).trim() + '\u2026' : inhoud;
        return '<div class="upload-artikel">'
          + '<div class="upload-artikel-kop">'
            + '<span class="upload-artikel-nr">Art. ' + e(art.artikel) + '</span>'
            + (art.titel ? '<span class="upload-artikel-titel">' + e(art.titel) + '</span>' : '')
          + '</div>'
          + (preview ? '<div class="upload-artikel-preview">' + e(preview) + '</div>' : '')
        + '</div>';
      }).join('');
    }
    $id('btn-download')?.removeAttribute('disabled');
  }

  function leesAlsTekst(bestand) {
    return new Promise(function(res, rej) {
      var r = new FileReader();
      r.onload  = function(ev) { res(ev.target.result); };
      r.onerror = function()   { rej(new Error('Bestand kon niet worden gelezen.')); };
      r.readAsText(bestand, 'UTF-8');
    });
  }

  function leesAlsPDF(bestand) {
    return new Promise(function(res, rej) {
      if (typeof pdfjsLib === 'undefined') { rej(new Error('PDF.js niet geladen.')); return; }
      var r = new FileReader();
      r.onload = function(ev) {
        pdfjsLib.getDocument({data: new Uint8Array(ev.target.result)}).promise.then(function(pdf) {
          var tekst = ''; var paginas = [];
          for (var p = 1; p <= pdf.numPages; p++) paginas.push(p);
          return paginas.reduce(function(chain, p) {
            return chain.then(function() {
              return pdf.getPage(p).then(function(pg) {
                return pg.getTextContent().then(function(ct) {
                  tekst += ct.items.map(function(i) { return i.str; }).join(' ') + '\n';
                });
              });
            });
          }, Promise.resolve()).then(function() { res(tekst); });
        }).catch(function(err) { rej(new Error('PDF fout: ' + err.message)); });
      };
      r.onerror = function() { rej(new Error('PDF laden mislukt.')); };
      r.readAsArrayBuffer(bestand);
    });
  }

  function leesAlsDOCX(bestand) {
    return new Promise(function(res, rej) {
      if (typeof mammoth === 'undefined') { rej(new Error('Mammoth.js niet geladen.')); return; }
      var r = new FileReader();
      r.onload = function(ev) {
        mammoth.extractRawText({arrayBuffer: ev.target.result})
          .then(function(result) { res(result.value); })
          .catch(function(err)   { rej(new Error('DOCX fout: ' + err.message)); });
      };
      r.onerror = function() { rej(new Error('DOCX laden mislukt.')); };
      r.readAsArrayBuffer(bestand);
    });
  }

  function leesBestand(bestand) {
    var ext = bestand.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'md') return leesAlsTekst(bestand);
    if (ext === 'pdf')                 return leesAlsPDF(bestand);
    if (ext === 'docx')                return leesAlsDOCX(bestand);
    return Promise.reject(new Error('Bestandstype .' + ext + ' niet ondersteund.'));
  }

  function verwerkBestand(bestand) {
    if (!bestand) return;
    var ext = bestand.name.split('.').pop().toLowerCase();
    if (!['txt','md','pdf','docx'].includes(ext)) {
      setStatus('Bestandstype .' + ext + ' is niet toegestaan.','fout'); return;
    }
    resetState(); resetUI();
    state.currentFile   = bestand;
    state.currentSource = 'upload';
    state.loadedItems   = [{ naam: bestand.name, type: ext.toUpperCase(), bron: 'upload', status: 'geladen' }];
    updateBestandenlijst();
    $id('btn-analyseer')?.removeAttribute('disabled');
    setStatus('Gekozen: ' + bestand.name + ' (' + ext.toUpperCase() + ', ' + (bestand.size/1024).toFixed(1) + ' KB) \u2014 klik op "Analyseer bestand".','info');
    console.log('[Upload] Bestand opgeslagen:', bestand.name);
  }

  function onBestandGekozen(event) {
    var bestand = event.target.files[0];
    if (!bestand) return;
    console.log('[Upload] Gekozen via input:', bestand.name);
    verwerkBestand(bestand);
  }

  function onDrop(event) {
    event.preventDefault(); event.stopPropagation();
    $id('upload-zone')?.classList.remove('drag-over');
    var bestand = event.dataTransfer && event.dataTransfer.files[0];
    if (!bestand) return;
    console.log('[Upload] Gekozen via drop:', bestand.name);
    verwerkBestand(bestand);
  }

  function onDragOver(event) { event.preventDefault(); $id('upload-zone')?.classList.add('drag-over'); }
  function onDragLeave()     { $id('upload-zone')?.classList.remove('drag-over'); }

  function onAnalyseer() {
    if (!state.currentFile) { setStatus('Geen bestand gekozen.','fout'); return; }
    console.log('[Upload] Analyse gestart:', state.currentFile.name);
    toonLader(true);
    setStatus('Bestand wordt ingelezen\u2026','info');
    state.parsedArticles = []; state.jsonData = null;
    var res = $id('upload-resultaten'); if (res) res.innerHTML = '';
    var tel = $id('upload-teller');     if (tel) tel.textContent = '';
    $id('btn-download')?.setAttribute('disabled','true');

    leesBestand(state.currentFile).then(function(tekst) {
      if (!tekst || !tekst.trim()) {
        setStatus('Bestand is leeg.','waarschuwing');
        if (state.loadedItems[0]) state.loadedItems[0].status = 'fout';
        updateBestandenlijst(); return;
      }
      console.log('[Upload] Tekst ingelezen | lengte:', tekst.length);
      setStatus('Artikelen worden herkend\u2026','info');
      var artikelen = WvSvParser.parseerArtikelen(tekst);
      toonResultaten(artikelen);
      if (state.loadedItems[0]) state.loadedItems[0].status = artikelen.length > 0 ? 'geanalyseerd' : 'fout';
      updateBestandenlijst();
      setStatus(
        artikelen.length > 0
          ? 'Klaar \u2014 ' + artikelen.length + ' artikel' + (artikelen.length!==1?'en':'') + ' gevonden in ' + state.currentFile.name + '.'
          : 'Geen artikelen herkend in ' + state.currentFile.name + '.',
        artikelen.length > 0 ? 'succes' : 'waarschuwing'
      );
      console.log('[Upload] Klaar | artikelen:', artikelen.length);
    }).catch(function(err) {
      setStatus('Fout bij inlezen: ' + err.message,'fout');
      if (state.loadedItems[0]) state.loadedItems[0].status = 'fout';
      updateBestandenlijst();
      console.error('[Upload] Fout:', err);
    }).finally(function() { toonLader(false); });
  }

  function onTestData() {
    console.log('[Upload] Testdata laden...');
    resetState(); resetUI();
    state.currentSource = 'testdata';
    state.loadedItems   = [{ naam: 'testdata.txt', type: 'TXT', bron: 'testdata', status: 'geladen' }];
    updateBestandenlijst();
    setStatus('Testdata wordt geladen\u2026','info');
    var artikelen = WvSvParser.parseerArtikelen(WvSvParser.TESTDATA);
    toonResultaten(artikelen);
    if (state.loadedItems[0]) state.loadedItems[0].status = 'geanalyseerd';
    updateBestandenlijst();
    setStatus('Testdata \u2014 ' + artikelen.length + ' voorbeeldartikelen geladen.','succes');
    console.log('[Upload] Testdata geladen | artikelen:', artikelen.length);
  }

  function onDownload() {
    if (!state.jsonData) return;
    var blob = new Blob([state.jsonData], {type:'application/json'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'artikelen.json'; a.click();
    URL.revokeObjectURL(url);
    console.log('[Upload] JSON gedownload | artikelen:', state.parsedArticles.length);
  }

  function verwijderItem(idx) {
    var item = state.loadedItems[idx]; if (!item) return;
    console.log('[Upload] Verwijderd:', item.naam);
    state.loadedItems.splice(idx, 1);
    if (state.loadedItems.length === 0) { volledigeReset(); setStatus('Bestand verwijderd.','info'); }
    else updateBestandenlijst();
  }

  function verwijderTestdata() {
    if (state.currentSource !== 'testdata') return;
    console.log('[Upload] Testdata verwijderd.');
    volledigeReset(); setStatus('Testdata verwijderd.','info');
  }

  function allesWissen() { volledigeReset(); console.log('[Upload] Alles gewist.'); }

  function init() {
    $id('upload-bestand')?.addEventListener('change', onBestandGekozen);
    var zone = $id('upload-zone');
    if (zone) {
      zone.addEventListener('dragover',  onDragOver);
      zone.addEventListener('dragleave', onDragLeave);
      zone.addEventListener('drop',      onDrop);
    }
    $id('btn-analyseer')?.addEventListener('click',    onAnalyseer);
    $id('btn-testdata')?.addEventListener('click',     onTestData);
    $id('btn-download')?.addEventListener('click',     onDownload);
    $id('btn-alles-wissen')?.addEventListener('click', allesWissen);
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    console.log('[Upload] Module v5 geinitialiseerd.');
  }

  return { init, onTestData, verwijderItem, verwijderTestdata, allesWissen };
})();

document.addEventListener('DOMContentLoaded', function() { WvSvUpload.init(); });
