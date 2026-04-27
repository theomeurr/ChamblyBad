
/* =================================================================
   RENCONTRES — Calendrier Top 12 & Nationale 2 (pilotable Sheets)
   -----------------------------------------------------------------
   Colonnes attendues (onglet "rencontres") :
     equipe,date,date_affichage,adversaire,domicile,tag,actif
   - equipe         : "top12" ou "n2"
   - date           : YYYY-MM-DD (tri chronologique)
   - date_affichage : texte libre ("18 Oct", "28 Mars")
   - adversaire     : nom du club adverse
   - domicile       : "x" si Chambly recoit, vide = deplacement
   - tag            : libellé à droite ("Domicile", "Extérieur", "J2"…)
   - actif          : "x" pour publier, vide = brouillon
================================================================== */
const RENCONTRES_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT3-ayE8HElh223upJFcBehISgF1EQHh4A9rY3bVH8T27yscS-rfQCS4yjDoe3LyZJLfMfo0e130Yz/pub?gid=1314308939&single=true&output=csv';
const RENCONTRES_FALLBACK = 'data/rencontres.csv';

(async function loadRencontres(){
  const topEl = document.getElementById('matches-top12');
  const n2El = document.getElementById('matches-n2');
  if(!topEl && !n2El) return;

  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function parseCSV(text){
    if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
    const rows=[]; let i=0, f='', r=[], inQ=false;
    while(i<text.length){
      const c=text[i];
      if(inQ){ if(c==='"'&&text[i+1]==='"'){f+='"';i+=2;continue;} if(c==='"'){inQ=false;i++;continue;} f+=c;i++;continue; }
      if(c==='"'){inQ=true;i++;continue;}
      if(c===','){r.push(f);f='';i++;continue;}
      if(c==='\n'||c==='\r'){ if(f.length||r.length){r.push(f);rows.push(r);} r=[];f=''; if(c==='\r'&&text[i+1]==='\n')i+=2; else i++; continue; }
      f+=c;i++;
    }
    if(f.length||r.length){r.push(f);rows.push(r);}
    if(!rows.length) return [];
    const h=rows[0].map(x=>x.trim());
    return rows.slice(1).filter(x=>x.some(v=>v&&v.trim())).map(x=>{ const o={}; h.forEach((k,idx)=>o[k]=(x[idx]||'').trim()); return o; });
  }
  // Fetch avec timeout + retries (Google Sheets est parfois lent à répondre)
  async function fetchCSV(url, { timeout = 7000, retries = 2 } = {}){
    const busted = url + (url.includes('?')?'&':'?') + 't=' + Date.now();
    let lastErr;
    for(let attempt=0; attempt<=retries; attempt++){
      const ctrl = new AbortController();
      const timer = setTimeout(()=>ctrl.abort(), timeout);
      try{
        const res = await fetch(busted,{cache:'no-cache', signal: ctrl.signal});
        clearTimeout(timer);
        if(!res.ok) throw new Error('HTTP '+res.status);
        return res.text();
      }catch(e){
        clearTimeout(timer);
        lastErr = e;
        if(attempt<retries) await new Promise(r=>setTimeout(r, 400*(attempt+1)));
      }
    }
    throw lastErr;
  }
  const RENCONTRES_CACHE_KEY = 'bcco_rencontres_cache_v1';
  async function loadData(){
    const urls=[];
    if(RENCONTRES_URL) urls.push(RENCONTRES_URL);
    if(RENCONTRES_FALLBACK) urls.push(RENCONTRES_FALLBACK);
    for(const url of urls){
      try{
        const t=await fetchCSV(url);
        const rs=parseCSV(t);
        if(rs.length){
          if(url===RENCONTRES_URL){
            try{ sessionStorage.setItem(RENCONTRES_CACHE_KEY, t); }catch(_){}
          }
          return rs;
        }
      }
      catch(e){ console.warn('Rencontres source inaccessible :',url,e); }
    }
    // Dernier recours : cache sessionStorage
    try{
      const cached = sessionStorage.getItem(RENCONTRES_CACHE_KEY);
      if(cached){ console.info('Rencontres : utilisation du cache session.'); return parseCSV(cached); }
    }catch(_){}
    return [];
  }
  function isActive(v){ return /^(x|1|true|oui|yes)$/i.test(String(v||'').trim()); }
  function parseD(s){
    if(!s) return null;
    const m=String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) return new Date(+m[1], +m[2]-1, +m[3]);
    const m2=String(s).match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/);
    if(m2) return new Date(+m2[3], +m2[2]-1, +m2[1]);
    return null;
  }

  function renderList(el, items, emptyMsg){
    if(!el) return;
    if(!items.length){
      el.innerHTML = `<div style="padding:14px;text-align:center;color:var(--muted);font-size:13px">${emptyMsg}</div>`;
      return;
    }
    el.innerHTML = items.map(it => {
      const home = isActive(it.domicile);
      const opp = escapeHtml(it.adversaire || '—');
      const chambly = 'Chambly';
      const line = home
        ? `${chambly} <span class="vs">vs</span> ${opp}`
        : `${opp} <span class="vs">vs</span> ${chambly}`;
      const tag = escapeHtml(it.tag || (home ? 'Domicile' : 'Extérieur'));
      const date = escapeHtml(it.date_affichage || '');
      return `<div class="match"><span class="date">${date}</span><span class="opp">${line}</span><span class="tag">${tag}</span></div>`;
    }).join('');
  }

  try{
    const raw = await loadData();
    const today = new Date(); today.setHours(0,0,0,0);
    const items = raw
      .filter(r => !('actif' in r) || !r.actif || isActive(r.actif))
      .map(r => ({ ...r, _d: parseD(r.date) }))
      .sort((a,b) => {
        const da=a._d, db=b._d;
        if(!da&&!db) return 0;
        if(!da) return 1;
        if(!db) return -1;
        // Futur asc, puis passé desc
        const af=da>=today, bf=db>=today;
        if(af&&!bf) return -1;
        if(!af&&bf) return 1;
        if(af&&bf) return da-db;
        return db-da;
      });

    const top = items.filter(r => /^top\s*12?$/i.test(r.equipe) || r.equipe?.toLowerCase()==='top12');
    const n2  = items.filter(r => /^n\s*2$/i.test(r.equipe) || r.equipe?.toLowerCase()==='n2' || /nationale\s*2/i.test(r.equipe));

    renderList(topEl, top, 'Aucune rencontre programmée pour l\'Équipe 1.');
    renderList(n2El, n2, 'Aucune rencontre programmée pour l\'Équipe 2.');

    // ===== Export ICS (calendrier) =====
    function icsEscape(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
    function pad(n){ return String(n).padStart(2,'0'); }
    function toICSDate(d){ return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate()); }
    function toICSStamp(d){ return toICSDate(d)+'T'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())+'Z'; }
    function buildICS(items, calName){
      const now = new Date();
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BCCO//Calendrier rencontres//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:'+icsEscape(calName),
        'X-WR-TIMEZONE:Europe/Paris'
      ];
      items.forEach(it => {
        if(!it._d) return;
        const home = isActive(it.domicile);
        const opp = it.adversaire || '—';
        const title = home ? ('BCCO vs '+opp) : (opp+' vs BCCO');
        const loc = home
          ? 'Halle Marie-Amélie Le Fur, Rue des Grands Prés, 60230 Chambly'
          : opp;
        // Évènement journée (DTSTART;VALUE=DATE) — l'horaire exact n'est pas toujours fiable dans le CSV
        const start = toICSDate(it._d);
        const endDate = new Date(it._d.getTime() + 24*3600*1000);
        const end = toICSDate(endDate);
        const uid = 'bcco-'+(it.equipe||'')+'-'+start+'-'+(opp.replace(/\W+/g,'').toLowerCase())+'@chamblybadminton.fr';
        lines.push(
          'BEGIN:VEVENT',
          'UID:'+uid,
          'DTSTAMP:'+toICSStamp(now),
          'DTSTART;VALUE=DATE:'+start,
          'DTEND;VALUE=DATE:'+end,
          'SUMMARY:'+icsEscape(title),
          'LOCATION:'+icsEscape(loc),
          'DESCRIPTION:'+icsEscape('Rencontre '+(it.equipe||'').toUpperCase()+' — '+(it.tag||(home?'Domicile':'Extérieur'))),
          'END:VEVENT'
        );
      });
      lines.push('END:VCALENDAR');
      return lines.join('\r\n');
    }
    function downloadICS(items, filename, calName){
      if(!items.length) return;
      const blob = new Blob([buildICS(items, calName)], { type:'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
    }
    document.querySelectorAll('.ics-btn').forEach(btn => {
      const which = btn.dataset.ics;
      const list = which === 'top12' ? top : n2;
      if(!list.length) return;
      btn.style.display = 'block';
      btn.addEventListener('click', () => {
        const label = which === 'top12' ? 'BCCO Top 12' : 'BCCO Nationale 2';
        downloadICS(list, 'bcco-'+which+'.ics', label);
      });
    });
  } catch (err){
    console.error('Erreur chargement rencontres :', err);
    const msg = `<div style="padding:14px;text-align:center;color:var(--muted);font-size:13px">Impossible de charger le calendrier.</div>`;
    if(topEl) topEl.innerHTML = msg;
    if(n2El) n2El.innerHTML = msg;
  }
})();
