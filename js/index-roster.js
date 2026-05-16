/* =================================================================
   ROSTER + STATS — Effectif Top 12 (depuis data/palmares.csv)
   -----------------------------------------------------------------
   Colonnes attendues : equipe,nom,prenom,nationalite,palmares,headline
   - equipe : "top12" filtre ici
   - nationalite : code 3 lettres (FRA, ESP, BUL, GBR, ENG, FIN, CZE…)
   - headline : phrase courte affichée sur la card
   - palmares : texte long (title sur la card)
================================================================== */
(async function loadRoster(){
  const grid = document.querySelector('#team-roster-top12 [data-roster-grid]');
  const wrap = document.getElementById('team-roster-top12');
  const countEl = document.querySelector('[data-roster-count]');
  const internatEl = document.querySelector('[data-internat-count]');
  if(!grid && !countEl && !internatEl) return;

  const URL_PRIMARY  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT3-ayE8HElh223upJFcBehISgF1EQHh4A9rY3bVH8T27yscS-rfQCS4yjDoe3LyZJLfMfo0e130Yz/pub?gid=449906991&single=true&output=csv';
  const URL_FALLBACK = 'data/palmares.csv';

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
  async function fetchText(url){
    const busted = url + (url.includes('?')?'&':'?') + 't=' + Date.now();
    const res = await fetch(busted, { cache: 'no-cache' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res.text();
  }
  async function loadData(){
    for(const u of [URL_PRIMARY, URL_FALLBACK]){
      try{
        const t = await fetchText(u);
        const rs = parseCSV(t);
        if(rs.length) return rs;
      }catch(e){ console.warn('Palmarès source inaccessible :', u, e); }
    }
    return [];
  }

  // === Mapping nationalité → drapeau emoji ===
  const FLAGS = {
    FRA:'🇫🇷', ESP:'🇪🇸', BUL:'🇧🇬', CAN:'🇨🇦',
    GBR:'🇬🇧', ENG:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', FIN:'🇫🇮', CZE:'🇨🇿',
    NED:'🇳🇱', BEL:'🇧🇪', GER:'🇩🇪', DEN:'🇩🇰'
  };
  function flagFor(code){ return FLAGS[String(code||'').toUpperCase()] || '🌍'; }

  // === Avatar : initiales sur dégradé déterministe selon le nom ===
  function initials(prenom, nom){
    const p = (prenom||'').trim()[0] || '';
    const n = (nom||'').trim()[0] || '';
    return (p+n).toUpperCase() || '?';
  }
  function gradientFor(str){
    let h = 0;
    for(let i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i)) | 0;
    const hue1 = Math.abs(h) % 360;
    const hue2 = (hue1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue1} 70% 55%), hsl(${hue2} 65% 45%))`;
  }

  try {
    const all = await loadData();
    const roster = all.filter(r => /^top\s*12?$/i.test(r.equipe||'') || (r.equipe||'').toLowerCase() === 'top12');

    // === Stats ===
    if(countEl) countEl.textContent = String(roster.length || 0);
    if(internatEl){
      const internat = roster.filter(r => (r.nationalite||'').toUpperCase() !== 'FRA').length;
      internatEl.textContent = String(internat);
    }

    if(!grid || !wrap) return;
    if(!roster.length){ wrap.hidden = true; return; }

    // Tri : femmes d'abord (prénoms féminins courants), puis hommes — à défaut, alphabétique nom
    roster.sort((a,b) => (a.nom||'').localeCompare(b.nom||'', 'fr'));

    wrap.hidden = false;
    grid.innerHTML = roster.map(p => {
      const fullname = escapeHtml(`${(p.prenom||'').trim()} ${(p.nom||'').trim()}`.trim());
      const head = escapeHtml(p.headline || '');
      const pal  = escapeHtml(p.palmares || '');
      const flag = flagFor(p.nationalite);
      const ini  = escapeHtml(initials(p.prenom, p.nom));
      const grad = gradientFor((p.nom||'') + (p.prenom||''));
      const isToValidate = /à valider/i.test(p.headline || '');
      return `
        <article class="tr-card${isToValidate ? ' is-todo' : ''}" title="${pal}">
          <div class="tr-avatar" style="background:${grad}" aria-hidden="true">
            <span class="tr-initials">${ini}</span>
            <span class="tr-flag" aria-label="${escapeHtml(p.nationalite||'')}">${flag}</span>
          </div>
          <div class="tr-body">
            <div class="tr-name">${fullname}</div>
            <div class="tr-headline">${head || '—'}</div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err){
    console.warn('Roster: erreur de chargement', err);
    if(wrap) wrap.hidden = true;
  }
})();
