/**
 * upload.js — WvSv uploadmodule
 * PDF: PDF.js (cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js)
 * DOCX: mammoth (cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js)
 */
const WvSvUpload = (() => {
  let gevondenArtikelen = [];

  function setStatus(tekst, type = 'info') {
    const el = document.getElementById('upload-status');
    if (!el) return;
    el.textContent = tekst;
    el.className = 'upload-status upload-status--' + type;
  }

  function toonLader(zichtbaar) {
    const el = document.getElementById('upload-lader');
    if (el) el.style.display = zichtbaar ? 'flex' : 'none';
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  /**
   * Toon gevonden artikelen als kaartjes.
   * Verbeterd: geen dubbele artikelkop in de preview.
   * Structuur per kaartje:
   *   - badge met artikelnummer
   *   - titel (indien aanwezig)
   *   - eerste 200 tekens van ALLEEN de inhoud (niet de kop)
   */
  function toonResultaten(artikelen) {
    const container = document.getElementById('upload-resultaten');
    const teller = document.getElementById('upload-teller');
    if (!container) return;

    gevondenArtikelen = artikelen;

    if (artikelen.length === 0) {
      container.innerHTML = '<div class="upload-leeg">Geen artikelen gevonden. Controleer of het bestand artikelnummers bevat zoals <strong>Art. 2.5.3</strong> of <strong>Artikel 52</strong>.</div>';
      if (teller) teller.textContent = '';
      document.getElementById('btn-download')?.setAttribute('disabled', 'true');
      return;
    }

    if (teller) teller.textContent = artikelen.length + ' artikel' + (artikelen.length !== 1 ? 'en' : '') + ' gevonden';

    container.innerHTML = artikelen.map(art => {
      // Inhoud bevat nu ALLEEN de tekst na de artikelkop (geen dubbele info)
      const inhoudTekst = art.inhoud || '';
      const preview = inhoudTekst.length > 200
        ? inhoudTekst.substring(0, 200).trim() + '\u2026'
        : inhoudTekst.trim();

      return '<div class="upload-artikel">' +
        '<div class="upload-artikel-kop">' +
          '<span class="upload-artikel-nr">Art. ' + escapeHTML(art.artikel) + '</span>' +
          (art.titel ? '<span class="upload-artikel-titel">' + escapeHTML(art.titel) + '</span>' : '') +
        '</div>' +
        (preview ? '<div class="upload-artikel-preview">' + escapeHTML(preview) + '</div>' : '') +
      '</div>';
    }).join('');

    document.getElementById('btn-download')?.removeAttribute('disabled');
  }

  function leesAlsTekst(bestand) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'));
      reader.readAsText(bestand, 'UTF-8');
    });
  }

  function leesAlsPDF(bestand) {
    return new Promise((resolve, reject) => {
      if (typeof pdfjsLib === 'undefined') { reject(new Error('PDF.js is niet geladen.')); return; }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
          let tekst = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            const pagina = await pdf.getPage(p);
            const content = await pagina.getTextContent();
            tekst += content.items.map(i => i.str).join(' ') + '\n';
          }
          resolve(tekst);
        } catch (err) { reject(new Error('PDF fout: ' + err.message)); }
      };
      reader.onerror = () => reject(new Error('PDF laden mislukt.'));
      reader.readAsArrayBuffer(bestand);
    });
  }

  function leesAlsDOCX(bestand) {
    return new Promise((resolve, reject) => {
      if (typeof mammoth === 'undefined') { reject(new Error('Mammoth.js is niet geladen.')); return; }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          resolve(result.value);
        } catch (err) { reject(new Error('DOCX fout: ' + err.message)); }
      };
      reader.onerror = () => reject(new Error('DOCX laden mislukt.'));
      reader.readAsArrayBuffer(bestand);
    });
  }

  async function leesBestand(bestand) {
    const ext = bestand.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'md') return await leesAlsTekst(bestand);
    if (ext === 'pdf') return await leesAlsPDF(bestand);
    if (ext === 'docx') return await leesAlsDOCX(bestand);
    throw new Error('Bestandstype .' + ext + ' niet ondersteund.');
  }

  function onBestandGekozen(event) {
    const bestand = event.target.files[0];
    if (!bestand) return;
    const ext = bestand.name.split('.').pop().toLowerCase();
    if (!['txt','md','pdf','docx'].includes(ext)) {
      setStatus('Bestandstype .' + ext + ' is niet toegestaan.', 'fout');
      return;
    }
    setStatus('Gekozen: ' + bestand.name + ' (' + ext.toUpperCase() + ', ' + (bestand.size/1024).toFixed(1) + ' KB)', 'info');
    document.getElementById('btn-analyseer')?.removeAttribute('disabled');
    document.getElementById('upload-resultaten').innerHTML = '';
    document.getElementById('upload-teller').textContent = '';
    document.getElementById('btn-download')?.setAttribute('disabled', 'true');
    gevondenArtikelen = [];
  }

  async function onAnalyseer() {
    const bestand = document.getElementById('upload-bestand')?.files[0];
    if (!bestand) { setStatus('Geen bestand gekozen.', 'fout'); return; }
    toonLader(true);
    setStatus('Uitgelezen…', 'info');
    try {
      const tekst = await leesBestand(bestand);
      if (!tekst || !tekst.trim()) { setStatus('Bestand lijkt leeg.', 'waarschuwing'); toonLader(false); return; }
      setStatus('Artikelen worden herkend…', 'info');
      const artikelen = WvSvParser.parseerArtikelen(tekst);
      toonResultaten(artikelen);
      setStatus(
        artikelen.length > 0
          ? 'Klaar — ' + artikelen.length + ' artikel(en) gevonden in ' + bestand.name + '.'
          : 'Geen artikelen herkend. Controleer of het bestand artikelnummers bevat.',
        artikelen.length > 0 ? 'succes' : 'waarschuwing'
      );
    } catch (err) {
      setStatus('Fout: ' + err.message, 'fout');
      console.error('[Upload] Fout:', err);
    } finally { toonLader(false); }
  }

  function onTestData() {
    setStatus('Testdata geladen.', 'info');
    const artikelen = WvSvParser.parseerArtikelen(WvSvParser.TESTDATA);
    toonResultaten(artikelen);
    setStatus('Testdata — ' + artikelen.length + ' voorbeeldartikelen geladen.', 'succes');
  }

  function onDownload() {
    if (!gevondenArtikelen.length) return;
    const blob = new Blob([JSON.stringify(gevondenArtikelen, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'artikelen.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function init() {
    document.getElementById('upload-bestand')?.addEventListener('change', onBestandGekozen);
    document.getElementById('btn-analyseer')?.addEventListener('click', onAnalyseer);
    document.getElementById('btn-testdata')?.addEventListener('click', onTestData);
    document.getElementById('btn-download')?.addEventListener('click', onDownload);
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  return { init, onTestData };
})();

document.addEventListener('DOMContentLoaded', () => WvSvUpload.init());
