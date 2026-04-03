/** upload.js v8 - volledige logging in analyseketen */
const WvSvUpload = (() => {
  const state = {currentFile:null,currentSource:null,parsedArticles:[],loadedItems:[],jsonData:null,filterQuery:'',currentPage:1,pageSize:50,activeBoek:null};
  function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function $id(id){return document.getElementById(id);}
  function log(){console.log('[Upload]',...arguments);}
  function setStatus(t,type){const el=$id('upload-status');if(!el)return;el.textContent=t;el.className='upload-status upload-status--'+(type||'info');log('STATUS:',t);}
  function toonLader(aan){const el=$id('upload-lader');if(el)el.style.display=aan?'flex':'none';}
  function resetState(){state.currentFile=null;state.currentSource=null;state.parsedArticles=[];state.loadedItems=[];state.jsonData=null;state.filterQuery='';state.currentPage=1;state.activeBoek=null;}
  function resetUI(){
    ['upload-teller','upload-paginering','upload-stats'].forEach(function(id){var el=$id(id);if(el)el.innerHTML='';});
    var r=$id('upload-resultaten');if(r)r.innerHTML='<div class="upload-leeg">Nog geen artikelen.</div>';
    var g=$id('geladen-lijst');if(g)g.innerHTML='<div class="upload-leeg" style="padding:12px 0;">Geen bestanden geladen.</div>';
    var i=$id('upload-bestand');if(i)i.value='';
    var z=$id('upload-zoek');if(z)z.value='';
    $id('btn-analyseer')?.setAttribute('disabled','true');$id('btn-download')?.setAttribute('disabled','true');
  }
  function volledigeReset(){resetState();resetUI();setStatus('Klaar.','info');}
  function updateBestandenlijst(){
    var lijst=$id('geladen-lijst');if(!lijst)return;
    if(!state.loadedItems.length){lijst.innerHTML='<div class="upload-leeg" style="padding:12px 0;">Geen bestanden geladen.</div>';return;}
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
  function toonStats(artikelen){
    var el=$id('upload-stats');if(!el||!artikelen.length){if(el)el.innerHTML='';return;}
    var boeken={};artikelen.forEach(function(a){var b=(a.artikel.split('.')[0])||'?';boeken[b]=(boeken[b]||0)+1;});
    var html=Object.keys(boeken).sort(function(a,b){return +a - +b;}).map(function(b){
      var act=state.activeBoek===b;
      return '<span onclick="WvSvUpload.filterBoek(\'' +b+ '\')" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:6px;font-size:0.78rem;font-weight:600;user-select:none;'+(act?'background:var(--blauw);color:#fff;':'background:#eef1f9;color:var(--blauw);')+'">Boek '+e(b)+': <strong>'+boeken[b]+'</strong></span>';
    }).join('');
    el.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 0 4px;"><span style="font-size:0.8rem;color:var(--tekst-mid);font-weight:600;">Verdeling:</span>'+html+'</div>';
  }
  function gefilterd(){
    var lijst=state.parsedArticles;
    if(state.activeBoek)lijst=lijst.filter(function(a){return(a.artikel.split('.')[0])===state.activeBoek;});
    var q=state.filterQuery.toLowerCase().trim();
    if(!q)return lijst;
    return lijst.filter(function(a){return a.artikel.toLowerCase().includes(q)||(a.titel||'').toLowerCase().includes(q)||(a.inhoud||'').toLowerCase().includes(q);});
  }
  function toonPagina(){
    var lijst=gefilterd(),totaal=lijst.length,pages=Math.ceil(totaal/state.pageSize)||1;
    if(state.currentPage>pages)state.currentPage=pages;
    var van=(state.currentPage-1)*state.pageSize,tot=Math.min(van+state.pageSize,totaal),deel=lijst.slice(van,tot);
    var container=$id('upload-resultaten'),teller=$id('upload-teller'),pag=$id('upload-paginering');
    if(teller)teller.textContent=(state.filterQuery||state.activeBoek)?totaal+' van '+state.parsedArticles.length+' artikelen (filter)':state.parsedArticles.length+' artikel'+(state.parsedArticles.length!==1?'en':'')+' gevonden';
    if(container){if(!deel.length){container.innerHTML='<div class="upload-leeg">Geen artikelen gevonden.</div>';}
    else{container.innerHTML=deel.map(function(art){return '<div class="upload-artikel"><div class="upload-artikel-kop"><span class="upload-artikel-nr">Art. '+e(art.artikel)+'</span>'+(art.titel?'<span class="upload-artikel-titel">'+e(art.titel)+'</span>':'')+'</div>'+((art.inhoud||'').trim()?'<div class="upload-artikel-preview">'+e((art.inhoud||'').trim())+'</div>':'')+'</div>';}).join('');}}
    if(pag){if(pages<=1){pag.innerHTML='';return;}
    var h='<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:12px 0 4px;"><span style="font-size:0.8rem;color:var(--tekst-mid);">'+van+'-'+tot+' van '+totaal+'</span>';
    h+='<button onclick="WvSvUpload.naarPagina('+(state.currentPage-1)+')" '+(state.currentPage<=1?'disabled':'')+' class="knop knop-secundair" style="padding:5px 12px;font-size:0.8rem;">&lsaquo;</button>';
    for(var p2=1;p2<=pages;p2++){if(pages>10&&Math.abs(p2-state.currentPage)>2&&p2!==1&&p2!==pages){if(p2===2||p2===pages-1)h+='<span>...</span>';continue;}h+='<button onclick="WvSvUpload.naarPagina('+p2+')" class="knop '+(p2===state.currentPage?'knop-primair':'knop-secundair')+'" style="padding:5px 12px;font-size:0.8rem;min-width:36px;">'+p2+'</button>';}
    h+='<button onclick="WvSvUpload.naarPagina('+(state.currentPage+1)+')" '+(state.currentPage>=pages?'disabled':'')+' class="knop knop-secundair" style="padding:5px 12px;font-size:0.8rem;">&rsaquo;</button></div>';pag.innerHTML=h;}
  }
  function naarPagina(p2){var pages=Math.ceil(gefilterd().length/state.pageSize)||1;state.currentPage=Math.max(1,Math.min(p2,pages));toonPagina();$id('upload-resultaten')?.scrollIntoView({behavior:'smooth',block:'start'});}
  function filterBoek(boek){state.activeBoek=state.activeBoek===boek?null:boek;state.currentPage=1;toonStats(state.parsedArticles);toonPagina();}
  function toonResultaten(artikelen){
    state.parsedArticles=artikelen;state.jsonData=JSON.stringify(artikelen,null,2);state.currentPage=1;state.filterQuery='';state.activeBoek=null;
    var z=$id('upload-zoek');if(z)z.value='';
    if(!artikelen.length){var c=$id('upload-resultaten');if(c)c.innerHTML='<div class="upload-leeg">Geen artikelen gevonden.<br><small>Open de console (F12) om de ruwe tekst te zien en te controleren welk patroon er staat.</small></div>';['upload-teller','upload-paginering','upload-stats'].forEach(function(id){var el=$id(id);if(el)el.innerHTML='';});return;}
    $id('btn-download')?.removeAttribute('disabled');toonStats(artikelen);toonPagina();
  }
  function leesAlsTekst(f){
    log('leesAlsTekst | naam:',f.name,'| grootte:',f.size,'bytes');
    return new Promise(function(res,rej){var r=new FileReader();r.onload=function(ev){var t=ev.target.result;log('Tekst gelezen | tekens:',t.length,'| start:',t.substring(0,100));res(t);};r.onerror=function(){rej(new Error('Leesfout tekstbestand.'));};r.readAsText(f,'UTF-8');});
  }
  function leesAlsPDF(f){
    log('leesAlsPDF | naam:',f.name,'| grootte:',f.size,'bytes');
    if(f.size===0)return Promise.reject(new Error('PDF is 0 bytes. Bestand niet correct geladen door de browser.'));
    if(typeof pdfjsLib==='undefined')return Promise.reject(new Error('PDF.js niet geladen.'));
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(ev){
        var data=new Uint8Array(ev.target.result);
        log('PDF bytes gelezen:',data.length);
        pdfjsLib.getDocument({data:data}).promise.then(function(pdf){
          log('PDF geopend | paginas:',pdf.numPages);
          var tekst='',ps=[];for(var p2=1;p2<=pdf.numPages;p2++)ps.push(p2);
          return ps.reduce(function(ch,p2){return ch.then(function(){return pdf.getPage(p2).then(function(pg){return pg.getTextContent().then(function(ct){var pt=ct.items.map(function(i){return i.str;}).join(' ');log('Pagina',p2,'tekens:',pt.length);tekst+=pt+'\n';});});});},Promise.resolve()).then(function(){log('PDF klaar | totaal tekens:',tekst.length,'| start:',tekst.substring(0,200));res(tekst);});
        }).catch(function(err){rej(new Error('PDF.js: '+err.message));});
      };
      r.onerror=function(){rej(new Error('FileReader fout bij PDF.'));};
      r.readAsArrayBuffer(f);
    });
  }
  function leesAlsDOCX(f){
    log('leesAlsDOCX | naam:',f.name,'| grootte:',f.size,'bytes');
    if(f.size===0)return Promise.reject(new Error('DOCX is 0 bytes.'));
    if(typeof mammoth==='undefined')return Promise.reject(new Error('Mammoth niet geladen.'));
    return new Promise(function(res,rej){var r=new FileReader();r.onload=function(ev){mammoth.extractRawText({arrayBuffer:ev.target.result}).then(function(result){log('DOCX gelezen | tekens:',result.value.length);res(result.value);}).catch(function(err){rej(new Error('DOCX: '+err.message));});};r.onerror=function(){rej(new Error('FileReader fout bij DOCX.'));};r.readAsArrayBuffer(f);});
  }
  function leesBestand(f){
    var ext=f.name.split('.').pop().toLowerCase();
    log('leesBestand | ext:',ext,'| grootte:',f.size,'bytes');
    if(ext==='txt'||ext==='md')return leesAlsTekst(f);
    if(ext==='pdf')return leesAlsPDF(f);
    if(ext==='docx')return leesAlsDOCX(f);
    return Promise.reject(new Error('Bestandstype .'+ext+' niet ondersteund.'));
  }
  function verwerkBestand(bestand){
    if(!bestand)return;
    var ext=bestand.name.split('.').pop().toLowerCase();
    log('Bestand gekozen:',bestand.name,'| type:',ext,'| grootte:',bestand.size,'bytes');
    if(!['txt','md','pdf','docx'].includes(ext)){setStatus('Bestandstype .'+ext+' niet toegestaan.','fout');return;}
    resetState();resetUI();state.currentFile=bestand;state.currentSource='upload';
    state.loadedItems=[{naam:bestand.name,type:ext.toUpperCase(),bron:'upload',status:'geladen'}];
    updateBestandenlijst();$id('btn-analyseer')?.removeAttribute('disabled');
    setStatus('Gekozen: '+bestand.name+' ('+(bestand.size/1024).toFixed(1)+' KB) — klik op "Analyseer bestand".','info');
  }
  function onBestandGekozen(ev){var b=ev.target.files[0];if(!b){log('Geen bestand in event');return;}log('onBestandGekozen:',b.name,'|',b.size,'bytes');verwerkBestand(b);}
  function onDrop(ev){ev.preventDefault();ev.stopPropagation();$id('upload-zone')?.classList.remove('drag-over');var b=ev.dataTransfer&&ev.dataTransfer.files[0];if(!b)return;log('onDrop:',b.name,'|',b.size,'bytes');verwerkBestand(b);}
  function onDragOver(ev){ev.preventDefault();$id('upload-zone')?.classList.add('drag-over');}
  function onDragLeave(){$id('upload-zone')?.classList.remove('drag-over');}
  function onAnalyseer(){
    if(!state.currentFile){setStatus('Geen bestand gekozen.','fout');return;}
    log('=== ANALYSE GESTART | bestand:',state.currentFile.name,'| grootte:',state.currentFile.size,'bytes ===');
    toonLader(true);setStatus('Bestand wordt ingelezen…','info');
    state.parsedArticles=[];state.jsonData=null;
    ['upload-teller','upload-paginering','upload-stats'].forEach(function(id){var el=$id(id);if(el)el.innerHTML='';});
    $id('btn-download')?.setAttribute('disabled','true');
    leesBestand(state.currentFile).then(function(tekst){
      log('Tekst ontvangen | lengte:',tekst.length,'tekens');
      if(!tekst||!tekst.trim()){setStatus('Bestand is leeg of kon niet worden gelezen. Zie console (F12).','fout');if(state.loadedItems[0])state.loadedItems[0].status='fout';updateBestandenlijst();return;}
      log('Parser aanroepen...');setStatus('Artikelen worden herkend…','info');
      var artikelen=WvSvParser.parseerArtikelen(tekst);
      log('Parser klaar | gevonden:',artikelen.length,'artikelen');
      if(artikelen.length>0){log('Eerste artikel:',JSON.stringify(artikelen[0]));}
      else{log('GEEN artikelen. Eerste 500 tekens ruwe tekst:',tekst.substring(0,500));log('Verwacht patroon: "Art. 1.2.3 Titel" of "Artikel 1.2.3 Titel"');}
      toonResultaten(artikelen);
      if(state.loadedItems[0])state.loadedItems[0].status=artikelen.length>0?'geanalyseerd':'fout';
      updateBestandenlijst();
      setStatus(artikelen.length>0?'Klaar — '+artikelen.length+' artikel'+(artikelen.length!==1?'en':'')+' gevonden.':'Geen artikelen herkend. Zie console (F12) voor de ruwe tekst.',artikelen.length>0?'succes':'waarschuwing');
    }).catch(function(err){
      log('FOUT:',err.message);
      setStatus('Fout: '+err.message,'fout');
      if(state.loadedItems[0])state.loadedItems[0].status='fout';updateBestandenlijst();
    }).finally(function(){toonLader(false);log('=== ANALYSE KLAAR ===');});
  }
  function onTestData(){
    log('Testdata laden...');resetState();resetUI();state.currentSource='testdata';
    state.loadedItems=[{naam:'testdata.txt',type:'TXT',bron:'testdata',status:'geladen'}];updateBestandenlijst();
    var artikelen=WvSvParser.parseerArtikelen(WvSvParser.TESTDATA);
    log('Testdata | artikelen:',artikelen.length);toonResultaten(artikelen);
    if(state.loadedItems[0])state.loadedItems[0].status='geanalyseerd';updateBestandenlijst();
    setStatus('Testdata — '+artikelen.length+' artikelen geladen.','succes');
  }
  function onDownload(){if(!state.jsonData)return;var blob=new Blob([state.jsonData],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='artikelen.json';a.click();URL.revokeObjectURL(url);}
  function onZoek(ev){state.filterQuery=ev.target.value;state.currentPage=1;toonPagina();}
  function verwijderItem(idx){var item=state.loadedItems[idx];if(!item)return;state.loadedItems.splice(idx,1);if(!state.loadedItems.length){volledigeReset();setStatus('Verwijderd.','info');}else updateBestandenlijst();}
  function verwijderTestdata(){if(state.currentSource!=='testdata')return;volledigeReset();setStatus('Testdata verwijderd.','info');}
  function allesWissen(){volledigeReset();}
  function init(){
    $id('upload-bestand')?.addEventListener('change',onBestandGekozen);
    var zone=$id('upload-zone');if(zone){zone.addEventListener('dragover',onDragOver);zone.addEventListener('dragleave',onDragLeave);zone.addEventListener('drop',onDrop);}
    $id('btn-analyseer')?.addEventListener('click',onAnalyseer);$id('btn-testdata')?.addEventListener('click',onTestData);
    $id('btn-download')?.addEventListener('click',onDownload);$id('btn-alles-wissen')?.addEventListener('click',allesWissen);
    $id('upload-zoek')?.addEventListener('input',onZoek);
    if(typeof pdfjsLib!=='undefined')pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    log('v8 klaar. PDF.js:',(typeof pdfjsLib!=='undefined'?'OK':'ONTBREEKT'),'Mammoth:',(typeof mammoth!=='undefined'?'OK':'ONTBREEKT'));
  }
  return {init,onTestData,verwijderItem,verwijderTestdata,allesWissen,naarPagina,filterBoek};
})();
document.addEventListener('DOMContentLoaded',function(){WvSvUpload.init();});
