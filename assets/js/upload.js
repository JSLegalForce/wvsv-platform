/** upload.js v13 - FASE 1: structuurgedreven parser WvSv - structuurboom first */
const WvSvUpload = (() => {
  const state = {
    currentFile: null, currentSource: null,
    parsedArticles: [], loadedItems: [],
    jsonData: null, filterQuery: '',
    currentPage: 1, pageSize: 50,
    activeBoek: null, structuurData: null, activeTitelNr: null
  };

  function e(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $id(id) { return document.getElementById(id); }

  function logDebug(tekst, isError) {
    let blok = $id('debug-log');
    if (!blok) {
      blok = document.createElement('div');
      blok.id = 'debug-log';
      blok.style.cssText = 'background:#1a1a2e;color:#e0e0e0;font-family:monospace;font-size:0.78rem;padding:12px 16px;border-radius:8px;margin:12px 0;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;';
      const uploadSection = $id('upload-status') || document.querySelector('.upload-sectie') || document.body;
      uploadSection.parentNode.insertBefore(blok, uploadSection.nextSibling);
    }
    const regel = document.createElement('div');
    regel.style.cssText = 'padding:1px 0;border-bottom:1px solid #2a2a4a;' + (isError ? 'color:#ff6b6b;font-weight:bold;' : '');
    const tijd = new Date().toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    regel.textContent = '[' + tijd + '] ' + tekst;
    blok.appendChild(regel);
    blok.scrollTop = blok.scrollHeight;
  }

  function setStatus(t, type) { const el=$id('upload-status'); if(!el)return; el.textContent=t; el.className='upload-status upload-status--'+(type||'info'); }
  function toonLader(aan) { const el=$id('upload-lader'); if(el) el.style.display=aan?'flex':'none'; }

  function resetState() {
    state.currentFile=null; state.currentSource=null; state.parsedArticles=[];
    state.loadedItems=[]; state.jsonData=null; state.filterQuery='';
    state.currentPage=1; state.activeBoek=null; state.structuurData=null; state.activeTitelNr=null;
  }

  function resetUI() {
    ['upload-teller','upload-paginering','upload-stats','upload-structuur'].forEach(function(id){
      var el=$id(id); if(el) el.innerHTML='';
    });
    var r=$id('upload-resultaten');
    if(r) r.innerHTML='<div class="upload-leeg">Kies een structuuronderdeel om artikelen te laden.</div>';
    var g=$id('geladen-lijst');
    if(g) g.innerHTML='<div class="upload-leeg" style="padding:12px 0;">Geen bestanden geladen.</div>';
    var i=$id('upload-bestand'); if(i) i.value='';
    var z=$id('upload-zoek'); if(z) z.value='';
    $id('btn-analyseer')?.setAttribute('disabled','true');
    $id('btn-download')?.setAttribute('disabled','true');
  }

  function volledigeReset() { resetState(); resetUI(); setStatus('Klaar.','info'); }

  function updateBestandenlijst() {
    var lijst=$id('geladen-lijst'); if(!lijst) return;
    if(!state.loadedItems.length) {
      lijst.innerHTML='<div class="upload-leeg" style="padding:12px 0;">Geen bestanden geladen.</div>'; return;
    }
    lijst.innerHTML=state.loadedItems.map(function(item,idx){
      var sc=item.status==='geanalyseerd'?'var(--groen)':item.status==='fout'?'var(--rood)':'var(--blauw)';
      var bs=item.bron==='testdata'?'background:rgba(176,112,0,.12);color:var(--goud);':'background:rgba(26,42,94,.1);color:var(--blauw);';
      return '<div class="geladen-item"><div class="geladen-item-info"><span class="geladen-naam">'+e(item.naam)+'</span>'
        +'<div class="geladen-meta"><span class="geladen-badge" style="background:var(--zilver);">'+e(item.type)+'</span>'
        +'<span class="geladen-badge" style="'+bs+'">'+e(item.bron)+'</span>'
        +'<span class="geladen-type" style="color:'+sc+';font-weight:600;">'+e(item.status)+'</span></div></div>'
        +'<div style="display:flex;gap:8px;">'+(item.bron==='testdata'
          ?'<button class="knop-gevaar-klein" onclick="WvSvUpload.verwijderTestdata()">Verwijder testdata</button>'
          :'<button class="knop-gevaar-klein" onclick="WvSvUpload.verwijderItem('+idx+')">Verwijderen</button>')
        +'</div></div>';
    }).join('');
  }

  function toonStructuurBoom(structuur) {
    var el = $id('upload-structuur');
    if (!el) {
      el = document.createElement('div');
      el.id = 'upload-structuur';
      el.style.cssText = 'background:#f8f9fd;border:1px solid #dde3f0;border-radius:10px;padding:14px 18px;margin:12px 0;';
      var resultSection = $id('upload-resultaten');
      if (resultSection) resultSection.parentNode.insertBefore(el, resultSection);
    }

    if (!structuur || !structuur.boeken || !structuur.boeken.length) {
      el.innerHTML = '<div style="color:#888;font-size:0.85rem;padding:8px 0;">Geen structuurkoppen gevonden in dit bestand.<br><small>Controleer of het bestand de WvSv-indeling bevat.</small></div>';
      return;
    }

    var totHfst  = structuur.boeken.reduce(function(s,b){return s+b.hoofdstukken.length;},0);
    var totTitel = structuur.boeken.reduce(function(s,b){return s+b.hoofdstukken.reduce(function(s2,h){return s2+h.titels.length;},0);},0);

    var html = '<div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;color:var(--blauw);">'
      + '&#9776; STRUCTUUR: ' + structuur.boeken.length + ' boeken &middot; ' + totHfst + ' hoofdstukken &middot; ' + totTitel + ' titels'
      + '</div>';

    html += '<div style="font-family:sans-serif;font-size:0.82rem;line-height:1.8;">';

    structuur.boeken.forEach(function(boek) {
      var totArtBoek = boek.hoofdstukken.reduce(function(s,h){return s+h.titels.reduce(function(s2,t){return s2+t.artikelen.length;},0);},0);
      html += '<div style="margin-bottom:8px;">';
      html += '<div style="font-weight:700;color:#fff;background:var(--blauw);padding:5px 12px;border-radius:6px;display:inline-block;cursor:pointer;margin-bottom:4px;user-select:none;" onclick="WvSvUpload.toggleBoom(this)">';
      html += '&#9660; Boek ' + e(boek.nummer) + ': ' + e(boek.titel);
      html += ' <span style="opacity:0.7;font-weight:400;font-size:0.78rem;">(' + boek.hoofdstukken.length + ' hfst.' + (totArtBoek?' &middot; ~'+totArtBoek+' art.':'') + ')</span></div>';

      html += '<div class="boom-inhoud" style="margin-left:14px;border-left:3px solid #c8d2ec;padding-left:10px;">';

      boek.hoofdstukken.forEach(function(hfst) {
        var totArtHfst = hfst.titels.reduce(function(s,t){return s+t.artikelen.length;},0);
        html += '<div style="margin:3px 0;">';
        html += '<div style="font-weight:600;cursor:pointer;padding:2px 4px;user-select:none;" onclick="WvSvUpload.toggleBoom(this)">';
        html += '&#9660; Hfst. ' + e(hfst.nummer) + ' &mdash; ' + e(hfst.titel);
        html += ' <span style="color:#888;font-weight:400;font-size:0.78rem;">(' + hfst.titels.length + ' titels' + (totArtHfst?' &middot; ~'+totArtHfst+' art.':'') + ')</span></div>';

        html += '<div class="boom-inhoud" style="margin-left:12px;border-left:2px solid #dde3f0;padding-left:8px;">';
        hfst.titels.forEach(function(titel) {
          var nrArt = titel.artikelen.length;
          var tNr = titel.nummer.replace(/'/g, '');
          html += '<div class="boom-titel-link" style="cursor:pointer;padding:2px 6px;color:var(--blauw);text-decoration:underline;font-size:0.8rem;" onclick="WvSvUpload.laadTitel(' + "'" + tNr + "'" + ')">';
          html += '&#9654; Titel ' + e(titel.nummer) + ' &mdash; ' + e(titel.titel);
          html += ' <span style="color:#888;text-decoration:none;font-size:0.75rem;">(' + nrArt + ' art.)</span></div>';
        });
        html += '</div></div>';
      });

      html += '</div></div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  function toggleBoom(el) {
    var volgende = el.nextElementSibling;
    if (!volgende || !volgende.classList.contains('boom-inhoud')) return;
    var gesloten = volgende.style.display === 'none';
    volgende.style.display = gesloten ? '' : 'none';
    el.innerHTML = el.innerHTML.replace(gesloten ? '&#9658;' : '&#9660;', gesloten ? '&#9660;' : '&#9658;');
  }

  function laadTitel(titelNr) {
    if (!state.parsedArticles || !state.parsedArticles.length) {
      logDebug('Nog geen artikelen. Upload en analyseer eerst.', true);
      return;
    }
    state.activeTitelNr = titelNr;
    state.currentPage = 1;
    state.filterQuery = '';
    state.activeBoek = null;
    var z = $id('upload-zoek'); if(z) z.value='';
    toonPagina();
    var res = $id('upload-resultaten');
    if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function _getArtikelenVoorTitel(titelNr) {
    if (!state.structuurData || !state.structuurData.boeken) return null;
    for (var i=0; i<state.structuurData.boeken.length; i++) {
      var boek = state.structuurData.boeken[i];
      for (var j=0; j<boek.hoofdstukken.length; j++) {
        var hfst = boek.hoofdstukken[j];
        for (var k=0; k<hfst.titels.length; k++) {
          if (hfst.titels[k].nummer === titelNr) return hfst.titels[k].artikelen;
        }
      }
    }
    return null;
  }

  function gefilterd() {
    var lijst = state.parsedArticles;
    if (state.activeTitelNr) {
      var titelArtikelen = _getArtikelenVoorTitel(state.activeTitelNr);
      if (titelArtikelen && titelArtikelen.length > 0) {
        var titelSet = {};
        titelArtikelen.forEach(function(nr) { titelSet[nr] = true; });
        lijst = lijst.filter(function(a) { return titelSet[a.artikel]; });
      } else {
        // Fallback: patroonmatch op d[1]+'.'+d[2] === titelNr
        lijst = lijst.filter(function(a) {
          var d = a.artikel.split('.');
          return d.length >= 3 && d[1]+'.'+d[2] === state.activeTitelNr;
        });
      }
    } else if (state.activeBoek) {
      lijst = lijst.filter(function(a) { return (a.artikel.split('.')[0]) === state.activeBoek; });
    }
    var q = state.filterQuery.toLowerCase().trim();
    if (!q) return lijst;
    return lijst.filter(function(a) {
      return a.artikel.toLowerCase().includes(q)
        || (a.titel||'').toLowerCase().includes(q)
        || (a.inhoud||'').toLowerCase().includes(q);
    });
  }

  function toonPagina() {
    var lijst=gefilterd(), totaal=lijst.length, pages=Math.ceil(totaal/state.pageSize)||1;
    if(state.currentPage>pages) state.currentPage=pages;
    var van=(state.currentPage-1)*state.pageSize, tot=Math.min(van+state.pageSize,totaal), deel=lijst.slice(van,tot);
    var container=$id('upload-resultaten'), teller=$id('upload-teller'), pag=$id('upload-paginering');
    var label=state.activeTitelNr?'Titel '+state.activeTitelNr:state.filterQuery||state.activeBoek?'filter':'';

    if(teller) teller.textContent = label
      ? (totaal+' van '+state.parsedArticles.length+' artikelen ('+label+')')
      : (state.parsedArticles.length+' artikel'+(state.parsedArticles.length!==1?'en':'')+' gevonden');

    if(container) {
      if(!deel.length) {
        container.innerHTML = state.activeTitelNr
          ? '<div class="upload-leeg">Geen artikelen gevonden voor Titel '+e(state.activeTitelNr)+'.</div>'
          : '<div class="upload-leeg">Kies een Titel uit de structuurboom hierboven om artikelen te laden.</div>';
      } else {
        container.innerHTML = deel.map(function(art) {
          return '<div class="upload-artikel">'
            +'<div class="upload-artikel-kop">'
            +'<span class="upload-artikel-nr">Art. '+e(art.artikel)+'</span>'
            +(art.titel?'<span class="upload-artikel-titel">'+e(art.titel)+'</span>':'')
            +'</div>'
            +((art.inhoud||'').trim()?'<div class="upload-artikel-preview">'+e((art.inhoud||'').trim())+'</div>':'')
            +'</div>';
        }).join('');
      }
    }

    if(pag) {
      if(pages<=1){pag.innerHTML='';return;}
      var h='<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:12px 0 4px;">'
        +'<span style="font-size:0.8rem;color:var(--tekst-mid);">'+van+'-'+tot+' van '+totaal+'</span>';
      h+='<button onclick="WvSvUpload.naarPagina('+(state.currentPage-1)+')" '+(state.currentPage<=1?'disabled':'')+' class="knop knop-secundair" style="padding:5px 12px;font-size:0.8rem;">&lsaquo;</button>';
      for(var p2=1;p2<=pages;p2++){
        if(pages>10&&Math.abs(p2-state.currentPage)>2&&p2!==1&&p2!==pages){if(p2===2||p2===pages-1)h+='<span>...</span>';continue;}
        h+='<button onclick="WvSvUpload.naarPagina('+p2+')" class="knop '+(p2===state.currentPage?'knop-primair':'knop-secundair')+'" style="padding:5px 12px;font-size:0.8rem;min-width:36px;">'+p2+'</button>';
      }
      h+='<button onclick="WvSvUpload.naarPagina('+(state.currentPage+1)+')" '+(state.currentPage>=pages?'disabled':'')+' class="knop knop-secundair" style="padding:5px 12px;font-size:0.8rem;">&rsaquo;</button></div>';
      pag.innerHTML=h;
    }
  }

  function naarPagina(p2) {
    var pages=Math.ceil(gefilterd().length/state.pageSize)||1;
    state.currentPage=Math.max(1,Math.min(p2,pages));
    toonPagina();
    $id('upload-resultaten')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function filterBoek(boek) {
    state.activeBoek=state.activeBoek===boek?null:boek;
    state.activeTitelNr=null;
    state.currentPage=1;
    toonPagina();
  }

  function verwerkBestand(bestand) {
    if(!bestand) return;
    var ext=bestand.name.split('.').pop().toLowerCase();
    if(!['txt','md','pdf','docx'].includes(ext)){setStatus('Bestandstype niet toegestaan.','fout');return;}
    resetState(); resetUI();
    state.currentFile=bestand; state.currentSource='upload';
    state.loadedItems=[{naam:bestand.name,type:ext.toUpperCase(),bron:'upload',status:'geladen'}];
    updateBestandenlijst();
    $id('btn-analyseer')?.removeAttribute('disabled');
    setStatus('Gekozen: '+bestand.name+' ('+(bestand.size/1024).toFixed(1)+' KB) - klik op Analyseer bestand.','info');
    logDebug('Bestand gekozen: '+bestand.name);
  }

  function onBestandGekozen(ev) { var b=ev.target.files[0]; if(!b) return; verwerkBestand(b); }
  function onDrop(ev) { ev.preventDefault(); ev.stopPropagation(); $id('upload-zone')?.classList.remove('drag-over'); var b=ev.dataTransfer&&ev.dataTransfer.files[0]; if(!b) return; verwerkBestand(b); }
  function onDragOver(ev) { ev.preventDefault(); $id('upload-zone')?.classList.add('drag-over'); }
  function onDragLeave() { $id('upload-zone')?.classList.remove('drag-over'); }

  function leesAlsTekst(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(ev){res(ev.target.result);};r.onerror=function(){rej(new Error('FileReader fout bij tekstbestand.'));};r.readAsText(f,'UTF-8');});}
  function leesAlsPDF(f){if(f.size===0)return Promise.reject(new Error('PDF heeft 0 bytes.'));if(typeof pdfjsLib==='undefined')return Promise.reject(new Error('PDF.js niet geladen.'));return new Promise(function(res,rej){var r=new FileReader();r.onload=function(ev){var data=new Uint8Array(ev.target.result);logDebug('PDF bytes: '+data.length);pdfjsLib.getDocument({data:data}).promise.then(function(pdf){logDebug('PDF paginas: '+pdf.numPages);var tekst='',ps=[];for(var p=1;p<=pdf.numPages;p++)ps.push(p);return ps.reduce(function(keten,p){return keten.then(function(){return pdf.getPage(p).then(function(pg){return pg.getTextContent().then(function(ct){var pt=ct.items.map(function(i){return i.str;}).join(' ');tekst+=pt+'\n';});});});},Promise.resolve()).then(function(){res(tekst);});}).catch(function(err){rej(new Error('PDF.js: '+err.message));});};r.onerror=function(){rej(new Error('FileReader fout bij PDF.'));};r.readAsArrayBuffer(f);});}
  function leesAlsDOCX(f){if(f.size===0)return Promise.reject(new Error('DOCX heeft 0 bytes.'));if(typeof mammoth==='undefined')return Promise.reject(new Error('Mammoth niet geladen.'));return new Promise(function(res,rej){var r=new FileReader();r.onload=function(ev){mammoth.extractRawText({arrayBuffer:ev.target.result}).then(function(result){res(result.value);}).catch(function(err){rej(new Error('DOCX: '+err.message));});};r.onerror=function(){rej(new Error('FileReader fout bij DOCX.'));};r.readAsArrayBuffer(f);});}
  function leesBestand(f){var ext=f.name.split('.').pop().toLowerCase();if(ext==='txt'||ext==='md')return leesAlsTekst(f);if(ext==='pdf')return leesAlsPDF(f);if(ext==='docx')return leesAlsDOCX(f);return Promise.reject(new Error('Bestandstype .'+ext+' niet ondersteund.'));}
  function normalizePdfText(raw){var t=raw;t=t.replace(/[\uFFFD\u25AA\u25A0\u2022\u00B7\u25CF]/g,' ');t=t.replace(new RegExp('(Artikel[\t ]+'+'[0-9]+(?:[.][0-9]+)+)','g'),' $1');t=t.replace(/ {3,}/g,' ');return t.trim();}

  function onAnalyseer() {
    if(!state.currentFile){setStatus('Geen bestand gekozen.','fout');return;}
    logDebug('--- Analyse gestart ---');
    toonLader(true); setStatus('Bestand wordt ingelezen...','info');
    state.parsedArticles=[]; state.jsonData=null; state.structuurData=null;
    ['upload-teller','upload-paginering','upload-structuur'].forEach(function(id){var el=$id(id);if(el)el.innerHTML='';});
    var rc=$id('upload-resultaten');
    if(rc) rc.innerHTML='<div class="upload-leeg">Bezig met analyseren...</div>';
    $id('btn-download')?.setAttribute('disabled','true');

    leesBestand(state.currentFile).then(function(tekst){
      logDebug('Tekst gelezen: '+tekst.length+' tekens');
      if(!tekst||!tekst.trim()){logDebug('FOUT: leeg bestand',true);setStatus('Bestand is leeg.','fout');return;}
      var ext2=state.currentFile.name.split('.').pop().toLowerCase();
      if(ext2==='pdf'){tekst=normalizePdfText(tekst);logDebug('Na normalisatie: '+tekst.length+' tekens');}

      logDebug('Structuuranalyse...');
      var structuur = WvSvParser.parseerStructuur(tekst);
      state.structuurData = structuur;
      var totBoeken = structuur.boeken.length;
      var totHfst   = structuur.boeken.reduce(function(s,b){return s+b.hoofdstukken.length;},0);
      var totTitel  = structuur.boeken.reduce(function(s,b){return s+b.hoofdstukken.reduce(function(s2,h){return s2+h.titels.length;},0);},0);
      logDebug('Structuur: '+totBoeken+' boeken, '+totHfst+' hoofdstukken, '+totTitel+' titels');

      toonStructuurBoom(structuur);

      logDebug('Artikelanalyse...');
      setStatus('Artikelen worden herkend...','info');
      var artikelen = WvSvParser.parseerArtikelen(tekst);
      logDebug('Artikelen: '+artikelen.length);

      state.parsedArticles = artikelen;
      state.jsonData = JSON.stringify(artikelen, null, 2);

      if(artikelen.length>0) {
        $id('btn-download')?.removeAttribute('disabled');
        var teller=$id('upload-teller');
        if(teller) teller.textContent = artikelen.length+' artikel'+(artikelen.length!==1?'en':'')+' geparsed - kies een Titel';
      }

      var rr=$id('upload-resultaten');
      if(rr) rr.innerHTML='<div class="upload-leeg" style="padding:20px;text-align:left;">'
        +'<strong style="color:var(--blauw);">Klik op een Titel in de structuurboom hierboven</strong><br>'
        +'<span style="font-size:0.83rem;color:var(--tekst-mid);">De structuurboom toont alle boeken, hoofdstukken en titels. Klik op een Titel om artikelen te laden.</span>'
        +(artikelen.length>0?'<br><br><span style="font-size:0.78rem;color:var(--zilver);">Totaal geparsed: '+artikelen.length+' artikelen.</span>':'')
        +'</div>';

      if(state.loadedItems[0]) state.loadedItems[0].status=totBoeken>0||artikelen.length>0?'geanalyseerd':'fout';
      updateBestandenlijst();

      var msg = totBoeken>0
        ? 'Klaar - '+totBoeken+' boeken, '+totHfst+' hoofdstukken, '+totTitel+' titels gevonden.'
        : (artikelen.length>0 ? 'Klaar - '+artikelen.length+' artikelen gevonden (geen structuurkoppen).' : 'Geen structuur herkend - zie debug-log.');
      setStatus(msg, totBoeken>0||artikelen.length>0?'succes':'waarschuwing');

    }).catch(function(err){
      logDebug('FOUT: '+err.message, true);
      setStatus('Fout: '+err.message,'fout');
      if(state.loadedItems[0]) state.loadedItems[0].status='fout';
      updateBestandenlijst();
    }).finally(function(){ toonLader(false); });
  }

  function onTestData() {
    logDebug('--- Testdata geladen ---');
    resetState(); resetUI(); state.currentSource='testdata';
    state.loadedItems=[{naam:'testdata.txt',type:'TXT',bron:'testdata',status:'geladen'}];
    updateBestandenlijst();

    var tekst = WvSvParser.TESTDATA;
    var structuur = WvSvParser.parseerStructuur(tekst);
    state.structuurData = structuur;
    toonStructuurBoom(structuur);

    var artikelen = WvSvParser.parseerArtikelen(tekst);
    logDebug('Testdata: '+structuur.boeken.length+' boeken, '+artikelen.length+' artikelen');

    state.parsedArticles = artikelen;
    state.jsonData = JSON.stringify(artikelen, null, 2);

    if(artikelen.length>0) $id('btn-download')?.removeAttribute('disabled');

    var teller=$id('upload-teller');
    if(teller) teller.textContent = artikelen.length+' artikel'+(artikelen.length!==1?'en':'')+' in testdata - kies een Titel';

    var rr=$id('upload-resultaten');
    if(rr) rr.innerHTML='<div class="upload-leeg" style="padding:20px;text-align:left;">'
      +'<strong style="color:var(--blauw);">Klik op een Titel in de structuurboom hierboven</strong><br>'
      +'<span style="font-size:0.83rem;color:var(--tekst-mid);">Testdata geladen. Klik op Titel 5.1 of Titel 5.2 om artikelen te zien.</span>'
      +'</div>';

    if(state.loadedItems[0]) state.loadedItems[0].status='geanalyseerd';
    updateBestandenlijst();
    setStatus('Testdata - '+structuur.boeken.length+' boeken, '+artikelen.length+' artikelen.','succes');
  }

  function onDownload() {
    if(!state.jsonData) return;
    var blob=new Blob([state.jsonData],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download='artikelen.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function onZoek(ev) {
    state.filterQuery=ev.target.value;
    state.currentPage=1;
    state.activeTitelNr=null;
    if(state.parsedArticles.length>0) toonPagina();
  }

  function verwijderItem(idx) {
    var item=state.loadedItems[idx]; if(!item) return;
    state.loadedItems.splice(idx,1);
    if(!state.loadedItems.length){volledigeReset();setStatus('Verwijderd.','info');}
    else updateBestandenlijst();
  }

  function verwijderTestdata() {
    if(state.currentSource!=='testdata') return;
    volledigeReset(); setStatus('Testdata verwijderd.','info');
  }

  function allesWissen() { volledigeReset(); }

  function init() {
    $id('upload-bestand')?.addEventListener('change', onBestandGekozen);
    var zone=$id('upload-zone');
    if(zone){zone.addEventListener('dragover',onDragOver);zone.addEventListener('dragleave',onDragLeave);zone.addEventListener('drop',onDrop);}
    $id('btn-analyseer')?.addEventListener('click', onAnalyseer);
    $id('btn-testdata')?.addEventListener('click', onTestData);
    $id('btn-download')?.addEventListener('click', onDownload);
    $id('btn-alles-wissen')?.addEventListener('click', allesWissen);
    $id('upload-zoek')?.addEventListener('input', onZoek);
    if(typeof pdfjsLib!=='undefined') pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    logDebug('v13 FASE1 klaar - PDF.js: '+(typeof pdfjsLib!=='undefined'?'OK':'ONTBREEKT')+' | Mammoth: '+(typeof mammoth!=='undefined'?'OK':'ONTBREEKT'));
  }

  return { init, onTestData, verwijderItem, verwijderTestdata, allesWissen, naarPagina, filterBoek, toggleBoom, laadTitel };
})();

document.addEventListener('DOMContentLoaded', function(){ WvSvUpload.init(); });
