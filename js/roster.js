/* =================================================================
   ROSTER — Effectif Top 12
   Charge data/palmares.csv (ou Google Sheets) et :
   - met à jour les compteurs stats
   - injecte le headline CSV dans .player-role de chaque .player-card
   Colonnes attendues : equipe,nom,prenom,nationalite,palmares,headline
================================================================== */
(async function loadRoster(){
  const countEl    = document.querySelector('[data-roster-count]');
  const internatEl = document.querySelector('[data-internat-count]');
  const playerCards = Array.from(document.querySelectorAll('#roster .player-card'));
  if(!countEl && !internatEl && !playerCards.length) return;

  const URL_PRIMARY  = ''; // données locales — éditer data/palmares.csv
  const URL_FALLBACK = 'data/palmares.csv';

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
    const res = await fetch(url + (url.includes('?')?'&':'?') + 't=' + Date.now(), { cache:'no-cache' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res.text();
  }
  async function loadData(){
    for(const u of [URL_PRIMARY, URL_FALLBACK]){
      try{ const t=await fetchText(u); const rs=parseCSV(t); if(rs.length) return rs; }
      catch(e){ console.warn('Palmarès source inaccessible :', u, e); }
    }
    return [];
  }

  try {
    const all    = await loadData();
    const roster = all.filter(r => (r.equipe||'').toLowerCase().replace(/\s/g,'') === 'top12');

    // Stats
    if(countEl)    countEl.textContent    = String(roster.length || 0);
    if(internatEl) internatEl.textContent = String(roster.filter(r=>(r.nationalite||'').toUpperCase()!=='FRA').length);

    // Injecte le headline + la photo CSV dans chaque card photo (match sur prénom + nom)
    playerCards.forEach(card => {
      const h4 = card.querySelector('.player-body h4');
      if(!h4) return;
      const cardName = h4.textContent.trim().toLowerCase();
      const match = roster.find(p => {
        const csvFull = `${(p.prenom||'').trim()} ${(p.nom||'').trim()}`.trim().toLowerCase();
        if(csvFull === cardName) return true;
        // fallback : premier prénom + nom (gère "Kalle Juhani KOLJONEN" → "Kalle Koljonen")
        const csvShort = `${(p.prenom||'').trim().split(' ')[0]} ${(p.nom||'').trim()}`.toLowerCase();
        return csvShort === cardName;
      });
      if(!match) return;

      // Headline (titre)
      if(match.headline){
        const roleEl = card.querySelector('.player-role');
        if(roleEl) roleEl.textContent = match.headline;
      }

      // Photo (si la colonne CSV "photo" est renseignée → on swap l'img.src
      //  un suffixe ?v= est utile pour invalider le cache après upload)
      if(match.photo){
        const img = card.querySelector('.player-photo img');
        if(img){
          // Petite préchauffe : on précharge avant de swap pour éviter le flash blanc
          const tmp = new Image();
          tmp.onload = () => { img.src = match.photo; };
          tmp.src = match.photo;
        }
      }
    });
  } catch(err){
    console.warn('Roster: erreur de chargement', err);
  }
})();
