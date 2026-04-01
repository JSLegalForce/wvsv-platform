/**
 * upload.js — WvSv uploadmodule v4
 * Correcte state, volledige reset, drag-drop, verwijder-knoppen.
 */
const WvSvUpload = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    currentFile:    null,   // File object
    currentSource:  null,   // 'upload' | 'testdata' | null
    parsedArticles: [],
    loadedItems:    [],     // { id, naam, type, bron, status }
    jsonData:       null
  };
  let _nextId = 1;

  // ── Helpers ────────────────────────────────────────────────────────────
  function setStatus(tekst, type) {
    const el = document.getElementById('upload-status');
    if (!el) return;
    el.textContent = tekst;
    el.className = 'upload-status upload-status--' + (type || 'info');
  }

  function toonLader(aan) {
    const el = document.getElementById('upload-lader');
    if (el) el.style.display = aan ? 'flex' : 'none';
  }

  function escHTML(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── State reset ────────────────────────────────────────────────────────
  function resetAlles() {
    state.currentFile    = null;
    state.currentSource  = null;
    state.parsedArticles = [];
    state.loadedItems    = [];
    state.jsonData       = null;

    const input = document.getElementById('upload-bestand');
    if (input) input.value = '';

    const container = document.getElementById('upload-resultaten');
    if (container) container.innerHTML = '<div class="upload-leeg">Nog geen artikelen — analyseer een bestand of laad de testdata.</div>';

    const teller = document.getElementById('upload-teller');
    if (teller) teller.textContent = '';

    document.getElementById('btn-download')?.setAttribute('disabled','true');
    document.getElementById('btn-analyseer')?.setAttribute('disabled','true');

    renderGeladen();
    setStatus('Alles gewist — klaar voor nieuwe analyse.', 'info');
    console.log('[Upload] Alles gewist.');
  }

  function resetResultaten() {
    state.parsedArticles = [];
    state.jsonData       = null;
    const container = document.getElementById('upload-resultaten');
    if (container) container.innerHTML = '<div class="upload-leeg">Bezig…</div>';
    const teller = document.getElementById('upload-teller');
    if (teller) teller.textContent = '';
    document.getElementById('btn-download')?.setAttribute('disabled','true');
  }

  // ── Geladen bestanden weergave ─────────────────────────────────────────
  function renderGeladen() {
    const el = document.getElementById('geladen-lijst');
    if (!el) return;

    if (state.loadedItems.length === 0) {
      el.innerHTML = '<div class="upload-leeg" style="padding:12px;">Geen bestanden geladen.</div>';
      return;
    }

    el.innerHTML = state.loadedItems.map(item => {
      const bronKleur = item.bron === 'testdata' ? '#1a7a4a' : '#1a2a5e';
      const statusKleur = item.status === 'geanalyseerd' ? '#1a7a4a' : item.status === 'fout' ? '#b52a2a' : '#b07000';
      return '<div class="geladen-item" data-id="' + item.id + '">' +
        '<div class="geladen-item-info">' +
          '<span class="geladen-naam">' + escHTML(item.naam) + '</span>' +
          '<span class="geladen-meta">' +
            '<span class="geladen-badge" style="background:' + bronKleur + '">' + escHTML(item.bron) + '</span>' +
            '<span class="geladen-badge" style="background:' + statusKleur + '">' + escHTML(item.status) + '</span>' +
            (item.type ? '<span class="geladen-type">.' + escHTML(item.type) + '</span>' : '') +
          '</span>' +
        '</div>' +
        '<button type="button" class="knop knop-gevaar-klein" onclick="WvSvUpload.verwijderItem(' + item.id + ')">' +
          (item.bron === 'testdata' ? 'Verwijder testdata' : 'Verwijderen') +
        '</button>' +
      '</div>';
    }).join('');
  }

  function voegItemToe(naam, type, bron) {
    const id = _nextId++;
    state.loadedItems.push({ id, naam, type, bron, status: 'geladen' });
    renderGeladen();
    return id;
  }

  function updateItemStatus(id, status) {
    const item = state.loadedItems.find(i => i.id === id);
    if (item) { item.status = status; renderGeladen(); }
  }

  function verwijderItem(id) {
    state.loadedItems = state.loadedItems.filter(i => i.id !== id);
    const item = state.loadedItems.find(i => i.id === id);
    // Als het het actieve item was, reset resultaten
    if (state.currentSource) {
      resetResultaten();
      state.currentFile = null;
      state.currentSource = null;
      document.getElementById('btn-analyseer')?.setAttribute('disabled','true');
    }
    if (state.loadedItems.length === 0) {
      resetResultaten();
      document.getElementById('upload-resultaten').innerHTML =
        '<div class="upload-leeg">Nog geen artikelen — analyseer een bestand of laad de testdata.</div>';
    }
    renderGeladen();
    setStatus('Item verwijderd.', 'info');
    console.log('[Upload] Item verwijderd, id:', id);
  }

  // ── Bestand lezen ──────────────────────────────────────────────────────
  function leesAlsTekst(bestand) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = e => res(e.target.result);
      r.onerror = () => rej(new Error('Bestand kon niet worden gelezen.'));
      r.readAsText(bestand, 'UTF-8');
    });
  }

  function leesAlsPDF(bestand) {
    return new Promise((res, rej) => {
      if (typeof pdfjsLib === 'undefined') { rej(new Error('PDF.js niet geladen.')); return; }
      const r = new FileReader();
      r.onload = async (e) => {
        try {
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
          let tekst = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            const pg = await pdf.getPage(p);
            const ct = await pg.getTextContent();
            tekst += ct.items.map(i => i.str).join(' ') + '\n';
          }
          res(tekst);
        } catch(err) { rej(new Error('PDF fout: ' + err.message)); }
      };
      r.onerror = () => rej(new Error('PDF laden mislukt.'));
      r.readAsArrayBuffer(bestand);
    });
  }

  function leesAlsDOCX(bestand) {
    return new Promise((res, rej) => {
      if (typeof mammoth === 'undefined') { rej(new Error('Mammoth.js niet geladen.')); return; }
      const r = new FileReader();
      r.onload = async (e) => {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          res(result.value);
        } catch(err) { rej(new Error('DOCX fout: ' + err.message)); }
      };
      r.onerror = () => rej(new Error('DOCX laden mislukt.'));
      r.readAsArrayBuffer(bestand);
    });
  }

  async function leesBestand(bestand) {
    const ext = bestand.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'md') return await leesAlsTekst(bestand);
    if (ext === 'pdf')                  return await leesAlsPDF(bestand);
    if (ext === 'docx')                 return await leesAlsDOCX(bestand);
    throw new Error('Bestandstype .' + ext + ' niet ondersteund.');
  }

  // ── Resultaten tonen ───────────────────────────────────────────────────
  function toonResultaten(artikelen) {
    state.parsedArticles = artikelen;
    state.jsonData = JSON.stringify(artikelen, null, 2);

    const container = document.getElementById('upload-resultaten');
    const teller    = document.getElementById('upload-teller');

    if (!artikelen || artikelen.length === 0) {
      if (container) container.innerHTML =
        '<div class="upload-leeg">Geen artikelen gevonden.<br>' +
        'Controleer of de tekst patronen bevat zoals <strong>Art. 2.5.3</strong> of <strong>Artikel 52</strong>.</div>';
      if (teller) teller.textContent = '';
      return;
    }

    if (teller) teller.textContent = artikelen.length + ' artikel' + (artikelen.length !== 1 ? 'en' : '') + ' gevonden';

    if (container) {
      container.innerHTML = artikelen.map(art => {
        const preview = (art.inhoud || '').length > 200
          ? art.inhoud.substring(0,200).trim() + '…'
          : (art.inhoud || '').trim();
        return '<div class="upload-artikel">' +
          '<div class="upload-artikel-kop">' +
            '<span class="upload-artikel-nr">Art. ' + escHTML(art.artikel) + '</span>' +
            (art.titel ? '<span class="upload-artikel-titel">' + escHTML(art.titel) + '</span>' : '') +
          '</div>' +
          (preview ? '<div class="upload-artikel-preview">' + escHTML(preview) + '</div>' : '') +
        '</div>';
      }).join('');
    }

    document.getElementById('btn-download')?.removeAttribute('disabled');
  }

  // ── Bestand kiezen (click + drag-drop) ────────────────────────────────
  function verwerkBestand(bestand) {
    if (!bestand) return;
    const ext = bestand.name.split('.').pop().toLowerCase();
    if (!['txt','md','pdf','docx'].includes(ext)) {
      setStatus('Bestandstype .' + ext + ' is niet toegestaan.', 'fout');
      return;
    }

    // Wis testdata uit state als die actief was
    if (state.currentSource === 'testdata') {
      state.loadedItems = state.loadedItems.filter(i => i.bron !== 'testdata');
    }

    // Sla het bestand direct op in state
    state.currentFile   = bestand;
    state.currentSource = 'upload';

    // Reset resultaten voor nieuw bestand
    resetResultaten();

    // Voeg toe aan geladen lijst
    voegItemToe(bestand.name, ext, 'upload');

    setStatus('Gekozen: ' + bestand.name + ' (' + ext.toUpperCase() + ', ' + (bestand.size/1024).toFixed(1) + ' KB) — klik op "Analyseer bestand".', 'info');
    document.getElementById('btn-analyseer')?.removeAttribute('disabled');
    console.log('[Upload] Bestand gekozen:', bestand.name, '| grootte:', bestand.size);
  }

  function onBestandGekozen(event) {
    const bestand = event.target.files[0];
    if (bestand) verwerkBestand(bestand);
  }

  // ── Analyseer ─────────────────────────────────────────────────────────
  async function onAnalyseer() {
    // Gebruik het bestand direct uit state (niet opnieuw uit input)
    const bestand = state.currentFile;

    if (!bestand || state.currentSource !== 'upload') {
      setStatus('Geen bestand gekozen. Kies eerst een bestand.', 'fout');
      return;
    }

    resetResultaten();
    toonLader(true);
    setStatus('Bestand wordt ingelezen…', 'info');
    console.log('[Upload] Analyse gestart:', bestand.name);

    // Update status in lijst
    const item = state.loadedItems.find(i => i.naam === bestand.name && i.bron === 'upload');
    const itemId = item ? item.id : null;

    try {
      const tekst = await leesBestand(bestand);

      if (!tekst || !tekst.trim()) {
        setStatus('Bestand is leeg of onleesbaar.', 'waarschuwing');
        if (itemId) updateItemStatus(itemId, 'fout');
        toonLader(false);
        return;
      }

      console.log('[Upload] Tekst ingelezen | lengte:', tekst.length);
      setStatus('Artikelen worden herkend…', 'info');

      const artikelen = WvSvParser.parseerArtikelen(tekst);
      toonResultaten(artikelen);

      if (itemId) updateItemStatus(itemId, 'geanalyseerd');

      setStatus(
        artikelen.length > 0
          ? 'Klaar — ' + artikelen.length + ' artikel(en) gevonden in ' + bestand.name + '.'
          : 'Geen artikelen herkend. Controleer de bestandsinhoud.',
        artikelen.length > 0 ? 'succes' : 'waarschuwing'
      );
      console.log('[Upload] Analyse klaar | gevonden:', artikelen.length);

    } catch(err) {
      setStatus('Fout: ' + err.message, 'fout');
      if (itemId) updateItemStatus(itemId, 'fout');
      console.error('[Upload] Fout:', err);
    } finally {
      toonLader(false);
    }
  }

  // ── Testdata ───────────────────────────────────────────────────────────
  function onTestData() {
    // Wis echt bestand uit state
    state.currentFile   = null;
    state.currentSource = 'testdata';

    // Verwijder bestaande testdata-items
    state.loadedItems = state.loadedItems.filter(i => i.bron !== 'testdata');

    resetResultaten();
    voegItemToe('testdata.txt', 'txt', 'testdata');

    console.log('[Upload] Testdata laden...');
    setStatus('Testdata wordt geladen…', 'info');

    const artikelen = WvSvParser.parseerArtikelen(WvSvParser.TESTDATA);
    toonResultaten(artikelen);

    // Update status
    const item = state.loadedItems.find(i => i.bron === 'testdata');
    if (item) updateItemStatus(item.id, 'geanalyseerd');

    setStatus('Testdata — ' + artikelen.length + ' voorbeeldartikelen geladen.', 'succes');
    document.getElementById('btn-analyseer')?.setAttribute('disabled','true');
    console.log('[Upload] Testdata geladen | artikelen:', artikelen.length);
  }

  // ── Verwijderen ────────────────────────────────────────────────────────
  function verwijderTestdata() {
    state.loadedItems = state.loadedItems.filter(i => i.bron !== 'testdata');
    if (state.currentSource === 'testdata') {
      state.currentSource = null;
      resetResultaten();
      document.getElementById('upload-resultaten').innerHTML =
        '<div class="upload-leeg">Testdata verwijderd. Kies een bestand of laad testdata opnieuw.</div>';
      setStatus('Testdata verwijderd.', 'info');
    }
    renderGeladen();
    console.log('[Upload] Testdata verwijderd.');
  }

  // ── Download JSON ──────────────────────────────────────────────────────
  function onDownload() {
    if (!state.jsonData) return;
    const blob = new Blob([state.jsonData], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'artikelen.json'; a.click();
    URL.revokeObjectURL(url);
    console.log('[Upload] JSON gedownload | artikelen:', state.parsedArticles.length);
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────
  function initDragDrop() {
    const zone = document.getElementById('upload-zone');
    if (!zone) return;

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const bestand = e.dataTransfer?.files[0];
      if (bestand) verwerkBestand(bestand);
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────
  function init() {
    document.getElementById('upload-bestand')?.addEventListener('change', onBestandGekozen);
    document.getElementById('btn-analyseer')?.addEventListener('click', onAnalyseer);
    document.getElementById('btn-testdata')?.addEventListener('click', onTestData);
    document.getElementById('btn-download')?.addEventListener('click', onDownload);
    document.getElementById('btn-alles-wissen')?.addEventListener('click', resetAlles);

    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    initDragDrop();
    renderGeladen();
    console.log('[Upload] Module geinitialiseerd.');
  }

  return { init, verwijderItem, verwijderTestdata, resetAlles };

})();

document.addEventListener('DOMContentLoaded', () => WvSvUpload.init());
