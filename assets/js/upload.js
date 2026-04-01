/**
 * upload.js - WvSv uploadmodule v3
 *
 * Fixes:
 * - Volledige reset (array + DOM + file input) bij ELKE nieuwe actie
 * - File input wordt na analyse geleegd zodat hetzelfde bestand opnieuw kiest
 * - Reset ook bij "Laad testdata"
 * - Duidelijke foutmelding als bestand leeg of onleesbaar is
 *
 * PDF:  PDF.js  (cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js)
 * DOCX: mammoth (cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js)
 */

const WvSvUpload = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  // Geen globale data tussen analyses — altijd vers starten
  let gevondenArtikelen = [];

  // ── Reset ──────────────────────────────────────────────────────────────

  /**
   * Leeg ALLES: array, DOM, knoppen, file input.
   * Wordt aangeroepen vóór elke nieuwe analyse of testdata-lading.
   */
  function volledigeReset() {
    // 1. Array leegmaken
    gevondenArtikelen = [];

    // 2. Resultaten DOM leegmaken
    const container = document.getElementById('upload-resultaten');
    if (container) container.innerHTML = '<div class="upload-leeg">Bezig met analyseren…</div>';

    // 3. Teller leegmaken
    const teller = document.getElementById('upload-teller');
    if (teller) teller.textContent = '';

    // 4. Download knop uitschakelen
    document.getElementById('btn-download')?.setAttribute('disabled', 'true');

    // 5. File input leegmaken zodat hetzelfde bestand opnieuw gekozen kan worden
    const input = document.getElementById('upload-bestand');
    if (input) input.value = '';

    console.log('[Upload] Reset uitgevoerd — klaar voor nieuwe analyse.');
  }

  // ── Status ──────────────────────────────────────────────────────────────

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

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Weergave ────────────────────────────────────────────────────────────

  /**
   * Toon gevonden artikelen als kaartjes.
   * - Badge met artikelnummer
   * - Titel (indien aanwezig)
   * - Eerste 200 tekens van de inhoud (NIET de artikelkop zelf)
   */
  function toonResultaten(artikelen) {
    const container = document.getElementById('upload-resultaten');
    const teller = document.getElementById('upload-teller');

    // Sla op in module state
    gevondenArtikelen = artikelen;

    if (!artikelen || artikelen.length === 0) {
      if (container) container.innerHTML =
        '<div class="upload-leeg">Geen artikelen gevonden.<br>' +
        'Controleer of het bestand artikelnummers bevat zoals <strong>Art. 2.5.3</strong> of <strong>Artikel 52</strong>.</div>';
      if (teller) teller.textContent = '';
      return;
    }

    if (teller) {
      teller.textContent = artikelen.length + ' artikel' +
        (artikelen.length !== 1 ? 'en' : '') + ' gevonden';
    }

    if (container) {
      container.innerHTML = artikelen.map(art => {
        const inhoud  = art.inhoud || '';
        const preview = inhoud.length > 200
          ? inhoud.substring(0, 200).trim() + '…'
          : inhoud.trim();

        return '<div class="upload-artikel">' +
          '<div class="upload-artikel-kop">' +
            '<span class="upload-artikel-nr">Art. ' + escapeHTML(art.artikel) + '</span>' +
            (art.titel
              ? '<span class="upload-artikel-titel">' + escapeHTML(art.titel) + '</span>'
              : '') +
          '</div>' +
          (preview
            ? '<div class="upload-artikel-preview">' + escapeHTML(preview) + '</div>'
            : '') +
        '</div>';
      }).join('');
    }

    document.getElementById('btn-download')?.removeAttribute('disabled');
  }

  // ── Bestand inlezen ─────────────────────────────────────────────────────

  function leesAlsTekst(bestand) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'));
      reader.readAsText(bestand, 'UTF-8');
    });
  }

  function leesAlsPDF(bestand) {
    return new Promise((resolve, reject) => {
      if (typeof pdfjsLib === 'undefined') {
        reject(new Error('PDF.js is niet geladen. Controleer CDN-verbinding.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
          let tekst = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            const pagina  = await pdf.getPage(p);
            const content = await pagina.getTextContent();
            tekst += content.items.map(i => i.str).join(' ') + '\n';
          }
          resolve(tekst);
        } catch (err) {
          reject(new Error('PDF uitlezen mislukt: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('PDF laden mislukt.'));
      reader.readAsArrayBuffer(bestand);
    });
  }

  function leesAlsDOCX(bestand) {
    return new Promise((resolve, reject) => {
      if (typeof mammoth === 'undefined') {
        reject(new Error('Mammoth.js is niet geladen. Controleer CDN-verbinding.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          resolve(result.value);
        } catch (err) {
          reject(new Error('DOCX uitlezen mislukt: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('DOCX laden mislukt.'));
      reader.readAsArrayBuffer(bestand);
    });
  }

  async function leesBestand(bestand) {
    const ext = bestand.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'md')  return await leesAlsTekst(bestand);
    if (ext === 'pdf')                   return await leesAlsPDF(bestand);
    if (ext === 'docx')                  return await leesAlsDOCX(bestand);
    throw new Error('Bestandstype .' + ext + ' wordt niet ondersteund. Gebruik .txt, .md, .pdf of .docx.');
  }

  // ── Event handlers ──────────────────────────────────────────────────────

  function onBestandGekozen(event) {
    const bestand = event.target.files[0];
    if (!bestand) return;

    const ext = bestand.name.split('.').pop().toLowerCase();
    if (!['txt', 'md', 'pdf', 'docx'].includes(ext)) {
      setStatus('Bestandstype .' + ext + ' is niet toegestaan.', 'fout');
      return;
    }

    // Reset ALLES bij nieuw bestand
    volledigeReset();

    setStatus(
      'Gekozen: ' + bestand.name +
      ' (' + ext.toUpperCase() + ', ' + (bestand.size / 1024).toFixed(1) + ' KB)' +
      ' — klik op "Analyseer bestand".',
      'info'
    );
    document.getElementById('btn-analyseer')?.removeAttribute('disabled');

    console.log('[Upload] Bestand gekozen:', bestand.name, '| grootte:', bestand.size, 'bytes');
  }

  async function onAnalyseer() {
    const input   = document.getElementById('upload-bestand');
    const bestand = input?.files[0];

    if (!bestand) {
      setStatus('Geen bestand gekozen. Kies eerst een bestand.', 'fout');
      return;
    }

    // Reset ALLES vóór nieuwe analyse
    volledigeReset();
    toonLader(true);
    setStatus('Bestand wordt ingelezen…', 'info');

    console.log('[Upload] Start analyse:', bestand.name);

    try {
      const tekst = await leesBestand(bestand);

      if (!tekst || !tekst.trim()) {
        setStatus(
          'Het bestand is leeg of kon niet worden uitgelezen. ' +
          'Probeer een ander bestand of formaat.',
          'waarschuwing'
        );
        toonLader(false);
        return;
      }

      console.log('[Upload] Tekst ingelezen | lengte:', tekst.length, 'tekens');
      setStatus('Artikelen worden herkend…', 'info');

      // Parseer — altijd verse array vanuit parser
      const artikelen = WvSvParser.parseerArtikelen(tekst);

      toonResultaten(artikelen);

      if (artikelen.length > 0) {
        setStatus(
          'Klaar — ' + artikelen.length + ' artikel' +
          (artikelen.length !== 1 ? 'en' : '') + ' gevonden in ' + bestand.name + '.',
          'succes'
        );
      } else {
        setStatus(
          'Geen artikelen herkend in ' + bestand.name + '. ' +
          'Controleer of de tekst artikelnummers bevat zoals "Art. 2.5.3" of "Artikel 52".',
          'waarschuwing'
        );
      }

      // Leeg de file input zodat hetzelfde bestand opnieuw gekozen kan worden
      if (input) input.value = '';

    } catch (err) {
      setStatus('Fout bij inlezen: ' + err.message, 'fout');
      console.error('[Upload] Fout:', err);
    } finally {
      toonLader(false);
    }
  }

  function onTestData() {
    // Reset ALLES vóór testdata laden
    volledigeReset();

    console.log('[Upload] Testdata laden...');
    setStatus('Testdata wordt geladen…', 'info');

    const artikelen = WvSvParser.parseerArtikelen(WvSvParser.TESTDATA);
    toonResultaten(artikelen);

    setStatus(
      'Testdata — ' + artikelen.length + ' voorbeeldartikelen geladen.',
      'succes'
    );
  }

  function onDownload() {
    if (!gevondenArtikelen || gevondenArtikelen.length === 0) return;
    const json = JSON.stringify(gevondenArtikelen, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'artikelen.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log('[Upload] JSON gedownload |', gevondenArtikelen.length, 'artikelen');
  }

  // ── Initialisatie ────────────────────────────────────────────────────────

  function init() {
    document.getElementById('upload-bestand')
      ?.addEventListener('change', onBestandGekozen);
    document.getElementById('btn-analyseer')
      ?.addEventListener('click', onAnalyseer);
    document.getElementById('btn-testdata')
      ?.addEventListener('click', onTestData);
    document.getElementById('btn-download')
      ?.addEventListener('click', onDownload);

    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    console.log('[Upload] Module geinitialiseerd.');
  }

  return { init, onTestData };

})();

document.addEventListener('DOMContentLoaded', () => WvSvUpload.init());
