const stageOrder=['幼年期1','幼年期2','成長期','成熟期','完全體','究極體','超究極體'];
let DATA, query='', currentView='evolution';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const byName=name=>DATA?.digimon.find(d=>d.name_zh===name);
function sprite(d,small=false){
  const no=String(d.dex_no).padStart(3,'0');
  return `<div class="sprite${small?' sprite-small':''}"><img src="${esc(d.image)}" alt="${esc(d.name_zh)}" loading="lazy" onerror="this.remove();this.parentElement.classList.add('sprite-error');this.parentElement.dataset.no='${no}'"></div>`;
}
function conditionRows(e){
  const items=[['照顧',e.care_mistakes],['努力',e.effort],['戰鬥',e.battles],['勝率',e.win_rate],['時間',e.time]].filter(x=>x[1]&&x[1]!=='-');
  return items.map(x=>`<div class="condition"><span>${x[0]}</span><strong>${esc(x[1])}</strong></div>`).join('')||'<div class="condition"><span>條件</span><strong>-</strong></div>';
}
function notesText(notes){
  if(!notes)return '';
  return notes.split('/').map(x=>x.trim()).filter(x=>!['照顧','努力','戰鬥','勝率','時間'].includes(x)).join('／');
}
function matches(d){
  if(!query)return true;
  const incoming=DATA.evolutions.filter(e=>e.to===d.name_zh).map(e=>e.from).join(' ');
  const outgoing=DATA.evolutions.filter(e=>e.from===d.name_zh).map(e=>e.to).join(' ');
  const t=`${d.dex_no} ${String(d.dex_no).padStart(3,'0')} ${d.name_zh} ${d.name_jp} ${d.stage} ${d.attribute} ${incoming} ${outgoing}`.toLowerCase();
  return t.includes(query);
}
function detailRows(d){
  const rows=[
    ['最低體重',d.minimum_weight],['力量',d.strength],['DP',d.dp],['基礎照顧心',d.base_care_hearts],
    ['照顧心',d.care_hearts],['進化時間（分鐘）',d.evolution_time_min],['飢餓／力量計時（分鐘）',d.hunger_strength_timer_min],
    ['便便計時（分鐘）',d.poop_timer_min],['可合體',d.can_jogress],['可戰鬥',d.can_battle]
  ].filter(x=>x[1]!==''&&x[1]!=null);
  return rows.map(([k,v])=>`<div class="detail-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
}
function jumpToDigimon(id){
  switchView('evolution',false);
  history.replaceState(null,'',`#${id}`);
  requestAnimationFrame(()=>document.getElementById(`evo-${id}`)?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function routeCard(e){
  const target=byName(e.to), note=notesText(e.notes);
  return `<article class="route">
    <button class="route-target${target?' route-link':''}" ${target?`data-target="${target.id}"`:''}>
      ${target?sprite(target,true):''}
      <span><small>進化至</small><strong>${esc(e.to)}</strong>${target?`<em>#${String(target.dex_no).padStart(3,'0')}　${esc(target.stage)}</em>`:''}</span>
    </button>
    <div class="conditions">${conditionRows(e)}</div>
    ${note?`<div class="notes">${esc(note)}</div>`:''}
  </article>`;
}
function incomingBlock(d){
  const list=DATA.evolutions.filter(e=>e.to===d.name_zh);
  if(!list.length)return '';
  return `<details class="incoming"><summary>可由 ${list.length} 條路線進化而來</summary><div class="incoming-list">${list.map(e=>{const src=byName(e.from);return `<button class="incoming-link" data-target="${src?.id||''}">${src?sprite(src,true):''}<span>${esc(e.from)}</span></button>`}).join('')}</div></details>`;
}
function renderStageNav(){
  const available=stageOrder.filter(stage=>DATA.digimon.some(d=>d.stage===stage&&matches(d)));
  $('#stageNav').innerHTML=available.map(stage=>`<button data-stage="${stage}">${stage}</button>`).join('');
  $('#stageNav').querySelectorAll('button').forEach(b=>b.onclick=()=>document.getElementById(`stage-${b.dataset.stage}`)?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function renderEvolution(){
  const root=$('#evolutionView');let html='';
  for(const stage of stageOrder){
    const list=DATA.digimon.filter(d=>d.stage===stage&&matches(d));if(!list.length)continue;
    html+=`<section class="stage" id="stage-${stage}"><h2 class="stage-title"><span>${stage}</span><small>${list.length} 隻</small></h2>`;
    for(const d of list){
      const routes=DATA.evolutions.filter(e=>e.from===d.name_zh);
      html+=`<article class="source-card" id="evo-${d.id}">
        <div class="source-head">${sprite(d)}<div class="name"><h3>#${String(d.dex_no).padStart(3,'0')} ${esc(d.name_zh)}</h3><p>${esc(d.name_jp)}</p></div><div class="badges"><span class="badge">${esc(d.attribute)}</span><span class="badge">睡眠 ${esc(d.sleep_start)}–${esc(d.sleep_end)}</span></div></div>
        <details class="details"><summary>基本資料</summary><div class="detail-grid">${detailRows(d)}</div></details>
        ${incomingBlock(d)}
        <div class="route-heading">可進化數碼獸 <span>${routes.length} 條</span></div>
        <div class="routes">${routes.length?routes.map(routeCard).join(''):'<div class="no-route">此階段無後續進化資料</div>'}</div>
      </article>`;
    }
    html+='</section>';
  }
  root.innerHTML=html||'<div class="empty">找不到符合項目</div>';
  root.querySelectorAll('.route-link,.incoming-link').forEach(b=>b.onclick=()=>b.dataset.target&&jumpToDigimon(b.dataset.target));
  renderStageNav();
}
function renderDex(){
  const list=DATA.digimon.filter(matches);
  $('#dexView').innerHTML=list.length?`<div class="dex-grid">${list.map(d=>`<article class="dex-card" data-id="${d.id}">${sprite(d)}<h3>#${String(d.dex_no).padStart(3,'0')} ${esc(d.name_zh)}</h3><p>${esc(d.name_jp)}</p><div class="dex-meta"><span class="badge">${esc(d.stage)}</span><span class="badge">${esc(d.attribute)}</span></div></article>`).join('')}</div>`:'<div class="empty">找不到符合項目</div>';
  document.querySelectorAll('.dex-card').forEach(x=>x.onclick=()=>jumpToDigimon(x.dataset.id));
}
function updateSummary(){
  const visible=DATA.digimon.filter(matches).length;
  $('#summary').textContent=query?`搜尋結果：${visible} 隻（同時搜尋進化來源與目標）`:`V0 共 ${DATA.digimon.length} 隻數碼獸／${DATA.evolutions.length} 組進化條件`;
}
function render(){renderEvolution();renderDex();updateSummary();}
function switchView(v,updateHash=true){
  currentView=v;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  $('#evolutionView').classList.toggle('hidden',v!=='evolution');
  $('#dexView').classList.toggle('hidden',v!=='dex');
  $('#stageNav').classList.toggle('hidden',v!=='evolution');
  if(updateHash)history.replaceState(null,'',v==='dex'?'#dex':'#evolution');
}
function restoreHash(){
  const h=location.hash.slice(1);
  if(h==='dex')return switchView('dex',false);
  if(h==='evolution'||!h)return switchView('evolution',false);
  const d=DATA.digimon.find(x=>x.id===h);
  if(d){switchView('evolution',false);setTimeout(()=>document.getElementById(`evo-${h}`)?.scrollIntoView({block:'start'}),60);}
}
fetch('data/v0.json').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{DATA=d;render();restoreHash();}).catch(()=>{$('#evolutionView').innerHTML='<div class="empty">資料載入失敗，請以網站伺服器方式開啟。</div>';});
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#searchInput').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
$('#clearSearch').onclick=()=>{$('#searchInput').value='';query='';render();$('#searchInput').focus();};
$('#backToTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
addEventListener('scroll',()=>$('#backToTop').classList.toggle('show',scrollY>500),{passive:true});
addEventListener('hashchange',()=>DATA&&restoreHash());
