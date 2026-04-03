/** upload.js v7 - fixes: geen afbreking, klikbare boek-badges */
const WvSvUpload = (() => {
  const state = {
    currentFile:null,currentSource:null,parsedArticles:[],loadedItems:[],
    jsonData:null,filterQuery:'',currentPage:1,pageSize:50,activeBoek:null
  };
  function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function $id(id){return document.getElementById(id);}
  function setStatus(t,type){const el=$id('upload-status');if(!el)return;el.textContent=t;el.className='upload-status upload-status--'+(type||'info');console.log('[Upload]',t);}
  function toonLader(aan){const el=$id('upload-lader');if(el)el.style.display=aan?'flex':'none';}
  function resetState(){state.currentFile=null;state.currentSource=null;state.parsedArticles=[];state.loadedItems=[];state.jsonData=null;state.filterQuery='';state.currentPage=1;state.activeBoek=null;console.log('[Upload] Reset.');}
  function resetUI(){
    const r=$id('upload-resultaten'),t=$id('upload-teller'),g=$id('geladen-lijst'),i=$id('upload-bestand'),z=$id('upload-zoek'),p=$id('upload-paginering'),s=$id('upload-stats');
    if(r)r.innerHTML='<div class="upload-leeg">Nog geen artikelen — analyseer een bestand of laad de testdata.</div>';
    if(t)t.textContent='';if(g)g.innerHTML='<div class="upload-leeg" style="padding:12px 0;">Geen bestanden geladen.</div>';
    if(i)i.value='';if(z)z.value='';if(p)p.innerHTML='';if(s)s.innerHTML='';
    $id('btn-analyseer')?.setAttribute('disabled','true');$id('btn-download')?.setAttribute('disabled','true');
  }
  function volledigeReset(){resetState();resetUI();setStatus('Klaar — kies een bestand of laad testdata.','info');}
  function updateBestandenlijst(){
    const lijst=$id('geladen-lijst');if(!lijst)return;
    if(!state.loadedItems.length){lijst.innerHTML='<div class="upload-leeg" style="padding:12px 0;">Geen bestanden geladen.</div>';return;}
    lijst.innerHTML=state.loadedItems.map(function(item,idx){
      const sc=item.status==='geanalyseerd'?'var(--groen)':item.status==='fout'?'var(--rood)':'var(--blauw)';
      const bs=item.bron==='testdata'?'background:rgba(176,112,0,.12);color:var(--goud);':'background:rgba(26,42,94,.1);color:var(--blauw);';
      return '<div class="geladen-item"><div class="geladen-item-info"><span class="geladen-naam">'+e(item.naam)+'</span>'
        +'<div class="geladen-meta"><span class="geladen-badge" style="background:var(--zilver);">'+e(item.type)+'</span>'
        +'<span class="geladen-badge" style="'+bs+'">'+e(item.bron)+'</span>'
        +'<span class="geladen-type" style="color:'+sc+';font-weight:600;">'+e(item.status)+'</span></div></div>'
        +'<div style="display:flex;gap:8px;">'
        +(item.bron==='testdata'?'<button class="knop-gevaar-klein" onclick="WvSvUpload.verwijderTestdata()">Verwijder testdata</button>'
          :'<button class="knop-gevaar-klein" onclick="WvSvUpload.verwijderItem('+idx+')">Verwijderen</button>')
        +'</div></div>';
    }).join('');
  }
  function toonStats(artikelen){
    const el=$id('upload-stats');if(!el||!artikelen.length){if(el)el.innerHTML='';return;}
    const boeken={};
    artikelen.forEach(function(a){const b=(a.artikel.split('.')[0])||'?';boeken[b]=(boeken[b]||0)+1;});
    const html=Object.keys(boeken).sort(function(a,b){return +a - +b;}).map(function(b){
      const act=state.activeBoek===b;
      return '<span onclick="WvSvUpload.filterBoek(\'' +b+ '\')" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:6px;font-size:0.78rem;font-weight:600;user-select:none;'
        +(act?'background:var(--blauw);color:#fff;':'background:#eef1f9;color:var(--blauw);')+'">Boek '+e(b)+': <strong>'+boeken[b]+'</strong></span>';
    }).join('');
    el.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 0 4px;"><span style="font-size:0.8rem;color:var(--tekst-mid);font-weight:600;">Verdeling:</span>'+html+'</div>';
  }
  function gefilterd(){
    let lijst=state.parsedArticles;
    if(state.activeBoek)lijst=lijst.filter(function(a){return(a.artikel.split('.')[0])===state.activeBoek;});
    const q=state.filterQuery.toLowerCase().trim();
    if(!q)return lijst;
    return lijst.filter(function(a){return a.artikel.toLowerCase().includes(q)||(a.titel||'').toLowerCase().includes(q)||(a.inhoud||'').toLowerCase().includes(q);});
  }
  function toonPagina(){
    const lijst=gefilterd(),totaal=lijst.length,pages=Math.ceil(totaal/state.pageSize)||1;
    if(state.currentPage>pages)state.currentPage=pages;
    const van=(state.currentPage-1)*state.pageSize,tot=Math.min(van+state.pageSize,totaal),deel=lijst.slice(van,tot);
    const container=$id('upload-resultaten'),teller=$id('upload-teller'),pag=$id('upload-paginering');
    if(teller)teller.textContent=(state.filterQuery||state.activeBoek)?totaal+' van '+state.parsedArticles.length+' artikelen (filter)':state.parsedArticles.length+' artikel'+(state.parsedArticles.length!==1?'en':'')+' gevonden';
    if(container){
      if(!deel.length){container.innerHTML='<div class="upload-leeg">Geen artikelen gevonden.</div>';}
      else{container.innerHTML=deel.map(function(art){
        const inhoud=(art.inhoud||'').trim();
        return '<div class="upload-artikel"><div class="upload-artikel-kop">'
          +'<span class="upload-artikel-nr">Art. '+e(art.artikel)+'</span>'
          +(art.titel?'<span class="upload-artikel-titel">'+e(art.titel)+'</span>':'')
          +'</div>'+(inhoud?'<div class="upload-artikel-preview">'+e(inhoud)+'</div>':'')+'</div>';
      }).join('');}
    }
    if(pag){
      if(pages<=1){pag.innerHTML='';return;}
      let h='<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:12px 0 4px;">';
      h+='<span style="font-size:0.8rem;color:var(--tekst-mid);">'+van+'-'+tot+' van '+totaal+'</span>';
      h+='<button onclick="WvSvUpload.naarPagina('+(state.currentPage-1)+')" '+(state.currentPage<=1?'disabled':'')+' class="knop knop-secundair" style="padding:5px 12px;font-size:0.8rem;">&lsaquo;</button>';
      for(var p2=1;p2<=pages;p2++){
        if(pages>10&&Math.abs(p2-state.currentPage)>2&&p2!==1&&p2!==pages){if(p2===2||p2===pages-1)h+='<span>…</span>';continue;}
        h+='<button onclick="WvSvUpload.naarPagina('+p2+')" class="knop '+(p2===state.currentPage?'knop-primair':'knop-secundair')+'" style="padding:5px 12px;font-size:0.8rem;min-width:36px;">'+p2+'</button>';
      }
      h+='<button onclick="WvSvUpload.naarPagina('+(state.currentPage+1)+')" '+(state.currentPage>=pages?'disabled':'')+' class="knop knop-secundair" style="padding:5px 12px;font-size:0.8rem;">&rsaquo;</button></div>';
      pag.innerHTML=h;
    }
  }
  function naarPagina(p2){const pages=Math.ceil(gefilterd().length/state.pageSize)||1;state.currentPage=Math.max(1,Math.min(p2,pages));toonPagina();$id('upload-resultaten')?.scrollIntoView({behavior:'smooth',block:'start'});}
  function filterBoek(boek){state.activeBoek=state.activeBoek===boek?null:boek;state.currentPage=1;toonStats(state.parsedArticles);toonPagina();}
  function toonResultaten(artikelen){
    state.parsedArticles=artikelen;state.jsonData=JSON.stringify(artikelen,null,2);state.currentPage=1;state.filterQuery='';state.activeBoek=null;
    const z=$id('upload-zoek');if(z)z.value='';
    if(!artikelen.length){
      const c=$id('upload-resultaten');if(c)c.innerHTML='<div class="upload-leeg">Geen artikelen gevonden.</div>';
      const t=$id('upload-teller');if(t)t.textContent='';const p=$id('upload-paginering');if(p)p.innerHTML='';const s=$id('upload-stats');if(s)s.innerHTML='';return;
    }
    $id('btn-download')?.removeAttribute('disabled');toonStats(artikelen);toonPagina();
  }
  function leesAlsTekst(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(ev){res(ev.target.result);};r.onerror=function(){rej(new Error('Leesfout.'));};r.readAsText(f,'UTF-8');});}
  function leesAlsPDF(f){return new Promise(function(res,rej){if(typeof pdfjsLib==='undefined'){rej(new Error('PDF.js niet geladen.'));return;}var r=new FileReader();r.onload=function(ev){pdfjsLib.getDocument({data:new Uint8Array(ev.target.result)}).promise.then(function(pdf){var tekst='',ps=[];for(var p2=1;p2<=pdf.numPages;p2++)ps.push(p2);return ps.reduce(function(ch,p2){return ch.then(function(){return pdf.getPage(p2).then(function(pg){return pg.getTextContent().then(function(ct){tekst+=ct.items.map(function(i){return i.str;}).join(' ')+' ';});});});},Promise.resolve()).then(function(){res(tekst);});}).catch(function(err){rej(new Error('PDF: '+err.message));});};r.onerror=function(){rej(new Error('PDF laden mislukt.'));};r.readAsArrayBuffer(f);});}
  function leesAlsDOCX(f){return new Promise(function(res,rej){if(typeof mammoth==='undefined'){rej(new Error('Mammoth niet geladen.'));return;}var r=new FileReader();r.onload=function(ev){mammoth.extractRawText({arrayBuffer:ev.target.result}).then(function(result){res(result.value);}).catch(function(err){rej(new Error('DOCX: '+err.message));});};r.onerror=function(){rej(new Error('DOCX laden mislukt.'));};r.readAsArrayBuffer(f);});}
  function leesBestand(f){var ext=f.name.split('.').pop().toLowerCase();if(ext==='txt'||ext==='md')return leesAlsTekst(f);if(ext==='pdf')return leesAlsPDF(f);if(ext==='docx')return leesAlsDOCX(f);return Promise.reject(new Error('Bestandstype .'+ext+' niet ondersteund.'));}
  function verwerkBestand(bestand){if(!bestand)return;var ext=bestand.name.split('.').pop().toLowerCase();if(!['txt','md','pdf','docx'].includes(ext)){setStatus('Bestandstype .'+ext+' niet toegestaan.','fout');return;}resetState();resetUI();state.currentFile=bestand;state.currentSource='upload';state.loadedItems=[{naam:bestand.name,type:ext.toUpperCase(),bron:'upload',status:'geladen'}];updateBestandenlijst();$id('btn-analyseer')?.removeAttribute('disabled');setStatus('Gekozen: '+bestand.name+' ('+(bestand.size/1024).toFixed(1)+' KB) — klik op "Analyseer bestand".','info');}
  function onBestandGekozen(ev){var b=ev.target.files[0];if(!b)return;verwerkBestand(b);}
  function onDrop(ev){ev.preventDefault();ev.stopPropagation();$id('upload-zone')?.classList.remove('drag-over');var b=ev.dataTransfer&&ev.dataTransfer.files[0];if(!b)return;verwerkBestand(b);}
  function onDragOver(ev){ev.preventDefault();$id('upload-zone')?.classList.add('drag-over');}
  function onDragLeave(){$id('upload-zone')?.classList.remove('drag-over');}
  function onAnalyseer(){
    if(!state.currentFile){setStatus('Geen bestand gekozen.','fout');return;}
    toonLader(true);setStatus('Bestand wordt ingelezen…','info');
    state.parsedArticles=[];state.jsonData=null;
    ['upload-resultaten','upload-teller','upload-paginering','upload-stats'].forEach(function(id){var el=$id(id);if(el)el.innerHTML='';});
    $id('btn-download')?.setAttribute('disabled','true');
    leesBestand(state.currentFile).then(function(tekst){
      if(!tekst||!tekst.trim()){setStatus('Bestand is leeg.','waarschuwing');if(state.loadedItems[0])state.loadedItems[0].status='fout';updateBestandenlijst();return;}
      setStatus('Artikelen worden herkend…','info');
      var artikelen=WvSvParser.parseerArtikelen(tekst);
      toonResultaten(artikelen);
      if(state.loadedItems[0])state.loadedItems[0].status=artikelen.length>0?'geanalyseerd':'fout';
      updateBestandenlijst();
      setStatus(artikelen.length>0?'Klaar — '+artikelen.length+' artikelen gevonden.':'Geen artikelen herkend.',artikelen.length>0?'succes':'waarschuwing');
    }).catch(function(err){setStatus('Fout: '+err.message,'fout');if(state.loadedItems[0])state.loadedItems[0].status='fout';updateBestandenlijst();console.error('[Upload]',err);}).finally(function(){toonLader(false);});
  }
  function onTestData(){console.log('[Upload] Testdata laden...');resetState();resetUI();state.currentSource='testdata';state.loadedItems=[{naam:'testdata.txt',type:'TXT',bron:'testdata',status:'geladen'}];updateBestandenlijst();setStatus('Testdata laden…','info');var artikelen=WvSvParser.parseerArtikelen(WvSvParser.TESTDATA);toonResultaten(artikelen);if(state.loadedItems[0])state.loadedItems[0].status='geanalyseerd';updateBestandenlijst();setStatus('Testdata — '+artikelen.length+' artikelen geladen.','succes');}
  function onDownload(){if(!state.jsonData)return;var blob=new Blob([state.jsonData],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='artikelen.json';a.click();URL.revokeObjectURL(url);}
  function onZoek(ev){state.filterQuery=ev.target.value;state.currentPage=1;toonPagina();}
  function verwijderItem(idx){var item=state.loadedItems[idx];if(!item)return;state.loadedItems.splice(idx,1);if(!state.loadedItems.length){volledigeReset();setStatus('Bestand verwijderd.','info');}else updateBestandenlijst();}
  function verwijderTestdata(){if(state.currentSource!=='testdata')return;volledigeReset();setStatus('Testdata verwijderd.','info');}
  function allesWissen(){volledigeReset();}
  function init(){
    $id('upload-bestand')?.addEventListener('change',onBestandGekozen);
    var zone=$id('upload-zone');
    if(zone){zone.addEventListener('dragover',onDragOver);zone.addEventListener('dragleave',onDragLeave);zone.addEventListener('drop',onDrop);}
    $id('btn-analyseer')?.addEventListener('click',onAnalyseer);
    $id('btn-testdata')?.addEventListener('click',onTestData);
    $id('btn-download')?.addEventListener('click',onDownload);
    $id('btn-alles-wissen')?.addEventListener('click',allesWissen);
    $id('upload-zoek')?.addEventListener('input',onZoek);
    if(typeof pdfjsLib!=='undefined')pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    console.log('[Upload] Module v7 geinitialiseerd.');
  }
  return {init,onTestData,verwijderItem,verwijderTestdata,allesWissen,naarPagina,filterBoek};
})();
document.addEventListener('DOMContentLoaded',function(){WvSvUpload.init();});
