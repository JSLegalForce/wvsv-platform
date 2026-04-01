/**
 * upload.js - WvSv uploadmodule v4
 *
 * State-gebaseerde aanpak:
 *   state.currentFile    - het actieve bestand (File object)
 *   state.currentSource  - 'upload' of 'testdata'
 *   state.parsedArticles - gevonden artikelen (altijd verse array)
 *   state.loadedItems    - lijst van geladen items voor weergave
 *   state.jsonData       - JSON string voor download
 *
 * Fixes:
 *   - Bestand wordt direct opgeslagen in state bij kiezen EN drag-drop
 *   - Testdata en echte bestanden lopen nooit door elkaar
 *   - Volledige reset bij elke actie
 *   - Verwijder-knoppen per item + "Alles wissen"
 */

const WvSvUpload = (() => {

  // ── Centrale state ─────────────────────────────────────────────────────
  const state = {
    currentFile:    null,   // File object
    currentSource:  null,   // 'upload' | 'testdata' | null
    parsedArticles: [],
    loadedItems:    [],
    jsonData:       null
  };

  // ── Hulpfuncties ────────────────────────────────────────────────────────

  function e(str) {
    return String(str||'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setStatus(tekst, type) {
    const el = document.getElementById('upload-status');
    if (!el) return;
    el.textContent = tekst;
    el.className = 'upload-status upload-status--' + (type||'info');
    console.log('[Upload] Status (' + (type||'info') + '):', tekst);
  }

  function toonLader(aan) {
    const el = document.getElementById('upload-lader');
    if (el) el.style.display = aan ? 'flex' : 'none';
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  function resetState() {
    state.currentFile    = null;
    state.currentSource  = null;
    state.parsedArticles = [];
    state.loadedItems    = [];
    state.jsonData       = null;
    console.log('[Upload] State volledig gereset.');
  }

  function resetUI() {
    const resultaten = document.getElementById('upload-resultaten');
    const teller     = document.getElementById('upload-teller');
    const bestandslijst = document.getElementById('upload-bestandenlijst');
    const input      = document.getElementById('upload-bestand');

    if (resultaten)    resultaten.innerHTML = '<div class="upload-leeg">Nog geen resultaten.</div>';
    if (teller)        teller.textContent = '';
    if (bestandslijst) bestandslijst.innerHTML = '<div class="upload-leeg-items">Geen bestanden geladen.</div>';
    if (input)         input.value = '';

    document.getElementById('btn-analyseer')?.setAttribute('disabled','true');
    document.getElementById('btn-download')?.setAttribute('disabled','true');
    document.getElementById('btn-verwijder-testdata')?.setAttribute('disabled','true');
    console.log('[Upload] UI gereset.');
  }

  function volledigeReset() {
    resetState();
    resetUI();
    setStatus('Klaar — kies een bestand of laad testdata.', 'info');
    console.log('[Upload] Alles gewist.');
  }

  // ── Bestandenlijst ──────────────────────────────────────────────────────

  function updateBestandenlijst() {
    const lijst = document.getElementById('upload-bestandenlijst');
    if (!lijst) return;

    if (state.loadedItems.length === 0) {
      lijst.innerHTML = '<div class="upload-leeg-items">Geen bestanden geladen.</div>';
      return;
    }

    lijst.innerHTML = state.loadedItems.map((item, idx) => {
      const statusKleur = item.status === 'geanalyseerd' ? 'groen' :
                          item.status === 'fout'         ? 'rood'  : 'blauw';
      return '<div class="upload-item" id="item-' + idx + '">' +
        '<div class="upload-item-info">' +
          '<span class="upload-item-naam">' + e(item.naam) + '</span>' +
          '<span class="upload-item-meta">' +
            e(item.type) + ' &middot; ' +
            '<span class="upload-item-bron">' + e(item.bron) + '</span>' +
            ' &middot; <span class="upload-item-status upload-item-status--' + statusKleur + '">' + e(item.status) + '</span>' +
          '</span>' +
        '</div>' +
        '<button class="knop knop-klein knop-rood" onclick="WvSvUpload.verwijderItem(' + idx + ')">Verwijderen</button>' +
      '</div>';
    }).join('');
  }

  // ── Resultaten ──────────────────────────────────────────────────────────

  function toonResultaten(artikelen) {
    state.parsedArticles = artikelen;
    state.jsonData       = JSON.stringify(artikelen, null, 2);

    const container = document.getElementById('upload-resultaten');
    const teller    = document.getElementById('upload-teller');

    if (!artikelen || artikelen.length === 0) {
      if (container) container.innerHTML =
        '<div class="upload-leeg">Geen artikelen gevonden.<br>' +
        'Controleer of het bestand artikelnummers bevat zoals <strong>Art. 2.5.3</strong> of <strong>Artikel 52</strong>.</div>';
      if (teller) teller.textContent = '';
      return;
    }

    if (teller) teller.textContent = artikelen.length + ' artikel' + (artikelen.length !== 1 ? 'en' : '') + ' gevonden';

    if (container) {
      container.innerHTML = artikelen.map(art => {
        const preview = (art.inhoud||'').length > 200
          ? (art.inhoud).substring(0,200).trim() + '\u2026'
          : (art.inhoud||'').trim();
        return '<div class="upload-artikel">' +
          '<div class="upload-artikel-kop">' +
            '<span class="upload-artikel-nr">Art. ' + e(art.artikel) + '</span>' +
            (art.titel ? '<span class="upload-artikel-titel">' + e(art.titel) + '</span>' : '') +
          '</div>' +
          (preview ? '<div class="upload-artikel-preview">' + e(preview) + '</div>' : '') +
        '</div>';
      }).join('');
    }

    document.getElementById('btn-download')?.removeAttribute('disabled');
  }

  // ── Bestand inlezen ─────────────────────────────────────────────────────

  function leesAlsTekst(bestand) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = ev => res(ev.target.result);
      r.onerror = () => rej(new Error('Bestand kon niet worden gelezen.'));
      r.readAsText(bestand, 'UTF-8');
    });
  }

  function leesAlsPDF(bestand) {
    return new Promise((res, rej) => {
      if (typeof pdfjsLib === 'undefined') { rej(new Error('PDF.js niet geladen.')); return; }
      const r = new FileReader();
      r.onload = async ev => {
        try {
          const pdf = await pdfjsLib.getDocument({data: new Uint8Array(ev.target.result)}).promise;
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
      r.onload = async ev => {
        try { res((await mammoth.extractRawText({arrayBuffer: ev.target.result})).value); }
        catch(err) { rej(new Error('DOCX fout: ' + err.message)); }
      };
      r.onerror = () => rej(new Error('DOCX laden mislukt.'));
      r.readAsArrayBuffer(bestand);
    });
  }

  async function leesBestand(bestand) {
    const ext = bestand.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'md')  return await leesAlsTekst(bestand);
    if (ext === 'pdf')                   return await leesAlsPDF(bestand);
    if (ext === 'docx')                  return await leesAlsDOCX(bestand);
    throw new Error('Bestandstype .' + ext + ' niet ondersteund.');
  }

  // ── Bestand verwerken ───────────────────────────────────────────────────

  function verwerkBestand(bestand) {
    if (!bestand) return;
    const ext = bestand.name.split('.').pop().toLowerCase();
    if (!['txt','md','pdf','docx'].includes(ext)) {
      setStatus('Bestandstype .' + ext + ' is niet toegestaan.', 'fout');
      return;
    }

    // Reset alles — testdata en oud resultaat weggooien
    resetState();
    resetUI();

    // Sla bestand op in state
    state.currentFile   = bestand;
    state.currentSource = 'upload';

    // Voeg toe aan geladen items
    state.loadedItems = [{
      naam:   bestand.name,
      type:   ext.toUpperCase(),
      bron:   'upload',
      status: 'geladen'
    }];

    updateBestandenlijst();
    document.getElementById('btn-analyseer')?.removeAttribute('disabled');
    setStatus('Gekozen: ' + bestand.name + ' (' + ext.toUpperCase() + ', ' + (bestand.size/1024).toFixed(1) + ' KB)', 'info');
    console.log('[Upload] Bestand opgeslagen in state:', bestand.name, '| bron: upload');
  }

  // ── Event handlers ──────────────────────────────────────────────────────

  function onBestandGekozen(event) {
    const bestand = event.target.files[0];
    if (!bestand) return;
    console.log('[Upload] Bestand gekozen via input:', bestand.name);
    verwerkBestand(bestand);
  }

  function onDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('upload-zone')?.classList.remove('drag-over');
    const bestand = event.dataTransfer?.files[0];
    if (!bestand) return;
    console.log('[Upload] Bestand gekozen via drag-drop:', bestand.name);
    verwerkBestand(bestand);
  }

  function onDragOver(event) {
    event.preventDefault();
    document.getElementById('upload-zone')?.classList.add('drag-over');
  }

  function onDragLeave() {
    document.getElementById('upload-zone')?.classList.remove('drag-over');
  }

  async function onAnalyseer() {
    if (!state.currentFile) {
      setStatus('Geen bestand gekozen. Kies eerst een bestand.', 'fout');
      return;
    }

    console.log('[Upload] Analyse gestart:', state.currentFile.name);
    toonLader(true);
    setStatus('Bestand wordt ingelezen…', 'info');

    // Reset alleen de resultaten — bestand en state blijven
    state.parsedArticles = [];
    state.jsonData = null;
    document.getElementById('upload-resultaten').innerHTML = '';
    document.getElementById('upload-teller').textContent = '';
    document.getElementById('btn-download')?.setAttribute('disabled','true');

    try {
      const tekst = await leesBestand(state.currentFile);

      if (!tekst || !tekst.trim()) {
        setStatus('Bestand is leeg of kon niet worden uitgelezen.', 'waarschuwing');
        if (state.loadedItems[0]) state.loadedItems[0].status = 'fout';
        updateBestandenlijst();
        return;
      }

      console.log('[Upload] Tekst ingelezen | lengte:', tekst.length);
      setStatus('Artikelen worden herkend…', 'info');

      const artikelen = WvSvParser.parseerArtikelen(tekst);
      toonResultaten(artikelen);

      // Update status in lijst
      if (state.loadedItems[0]) state.loadedItems[0].status = 'geanalyseerd';
      updateBestandenlijst();

      setStatus(
        artikelen.length > 0
          ? 'Klaar — ' + artikelen.length + ' artikel' + (artikelen.length!==1?'en':'') + ' gevonden in ' + state.currentFile.name + '.'
          : 'Geen artikelen herkend in ' + state.currentFile.name + '.',
        artikelen.length > 0 ? 'succes' : 'waarschuwing'
      );
      console.log('[Upload] Analyse klaar | artikelen:', artikelen.length);

    } catch(err) {
      setStatus('Fout bij inlezen: ' + err.message, 'fout');
      if (state.loadedItems[0]) state.loadedItems[0].status = 'fout';
      updateBestandenlijst();
      console.error('[Upload] Fout:', err);
    } finally {
      toonLader(false);
    }
  }

  function onTestData() {
    console.log('[Upload] Testdata laden...');

    // Reset ALLES — ook eerder gekozen bestanden
    resetState();
    resetUI();

    state.currentSource = 'testdata';
    state.loadedItems = [{
      naam:   'testdata.txt',
      type:   'TXT',
      bron:   'testdata',
      status: 'geladen'
    }];
    updateBestandenlijst();
    document.getElementById('btn-verwijder-testdata')?.removeAttribute('disabled');

    setStatus('Testdata wordt geladen…', 'info');

    const artikelen = WvSvParser.parseerArtikelen(WvSvParser.TESTDATA);
    toonResultaten(artikelen);

    if (state.loadedItems[0]) state.loadedItems[0].status = 'geanalyseerd';
    updateBestandenlijst();

    setStatus('Testdata — ' + artikelen.length + ' voorbeeldartikelen geladen.', 'succes');
    console.log('[Upload] Testdata geladen | artikelen:', artikelen.length);
  }

  function onDownload() {
    if (!state.jsonData) return;
    const blob = new Blob([state.jsonData], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'artikelen.json'; a.click();
    URL.revokeObjectURL(url);
    console.log('[Upload] JSON gedownload |', state.parsedArticles.length, 'artikelen');
  }

  // ── Verwijder functies (publiek) ────────────────────────────────────────

  function verwijderItem(idx) {
    const item = state.loadedItems[idx];
    if (!item) return;
    console.log('[Upload] Item verwijderd:', item.naam);

    state.loadedItems.splice(idx, 1);

    if (state.loadedItems.length === 0) {
      volledigeReset();
      setStatus('Alle bestanden verwijderd.', 'info');
    } else {
      updateBestandenlijst();
    }
  }

  function verwijderTestdata() {
    if (state.currentSource !== 'testdata') return;
    console.log('[Upload] Testdata verwijderd.');
    volledigeReset();
    setStatus('Testdata verwijderd.', 'info');
  }

  function allesWissen() {
    volledigeReset();
    console.log('[Upload] Alles gewist door gebruiker.');
  }

  // ── Initialisatie ────────────────────────────────────────────────────────

  function init() {
    // File input
    document.getElementById('upload-bestand')
      ?.addEventListener('change', onBestandGekozen);

    // Drag-drop op de upload zone
    const zone = document.getElementById('upload-zone');
    if (zone) {
      zone.addEventListener('dragover',  onDragOver);
      zone.addEventListener('dragleave', onDragLeave);
      zone.addEventListener('drop',      onDrop);
    }

    // Knoppen
    document.getElementById('btn-analyseer')        ?.addEventListener('click', onAnalyseer);
    document.getElementById('btn-testdata')          ?.addEventListener('click', onTestData);
    document.getElementById('btn-download')          ?.addEventListener('click', onDownload);
    document.getElementById('btn-alles-wissen')      ?.addEventListener('click', allesWissen);
    document.getElementById('btn-verwijder-testdata')?.addEventListener('click', verwijderTestdata);

    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    console.log('[Upload] Module geinitialiseerd.');
  }

  // Publieke API
  return { init, onTestData, verwijderItem, verwijderTestdata, allesWissen };

})();

document.addEventListener('DOMContentLoaded', () => WvSvUpload.init());
