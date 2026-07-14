const stageOrder=['幼年期1','幼年期2','成長期','成熟期','完全體','究極體','超究極體'];
let DATA=null, query='', currentView='overview', stageFilter='', attributeFilter='';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const byName=name=>DATA?.digimon.find(d=>d.name_zh===name);
const padNo=n=>String(n).padStart(3,'0');
function sprite(d,small=false){return `<div class="sprite${small?' sprite-small':''}"><img src="${esc(d.image)}" alt="${esc(d.name_zh)}" loading="lazy" onerror="this.remove();this.parentElement.classList.add('sprite-error');this.parentElement.dataset.no='${padNo(d.dex_no)}'"></div>`;}
function conditionRows(e){
  const items=[['照顧',e.care_mistakes],['努力',e.effort],['戰鬥',e.battles],['勝率',e.win_rate],['時間',e.time]].filter(x=>x[1]&&x[1]!=='-');
  return items.map(([k,v])=>`<div class="condition"><span>${k}</span><strong>${esc(v)}</strong></div>`).join('')||'<div class="condition"><span>條件</span><strong>-</strong></div>';
}
function notesText(notes){if(!notes)return '';return notes.split('/').map(x=>x.trim()).filter(x=>!['照顧','努力','戰鬥','勝率','時間'].includes(x)).join('／');}
function haystack(d){
  const incoming=DATA.evolutions.filter(e=>e.to===d.name_zh).map(e=>e.from).join(' ');
  const outgoing=DATA.evolutions.filter(e=>e.from===d.name_zh).map(e=>e.to).join(' ');
  return `${d.dex_no} ${padNo(d.dex_no)} ${d.name_zh} ${d.name_jp} ${d.stage} ${d.attribute} ${incoming} ${outgoing}`.toLowerCase();
}
function matches(d){return (!query||haystack(d).includes(query))&&(!stageFilter||d.stage===stageFilter)&&(!attributeFilter||d.attribute===attributeFilter);}
function filteredDigimon(){return DATA.digimon.filter(matches);}
function detailRows(d){
  const rows=[['最低體重',d.minimum_weight],['力量',d.strength],['DP',d.dp],['基礎照顧心',d.base_care_hearts],['照顧心',d.care_hearts],['進化時間（分鐘）',d.evolution_time_min],['飢餓／力量計時（分鐘）',d.hunger_strength_timer_min],['便便計時（分鐘）',d.poop_timer_min],['可合體',d.can_jogress],['可戰鬥',d.can_battle]].filter(x=>x[1]!==''&&x[1]!=null);
  return rows.map(([k,v])=>`<div class="detail-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
}
function showToast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),1800);}
function canonicalHash(view,id=''){return id?`#digimon=${encodeURIComponent(id)}`:`#view=${view}`;}
function jumpToDigimon(id,push=true){
  switchView('evolution',false);
  if(push)history.replaceState(null,'',canonicalHash('evolution',id));
  requestAnimationFrame(()=>{const el=document.getElementById(`evo-${id}`);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),900);}});
}
async function shareDigimon(d){
  const url=new URL(location.href);url.hash=`digimon=${encodeURIComponent(d.id)}`;
  const text=`${d.name_zh}｜DMVault Pendulum COLOR V0`;
  try{if(navigator.share){await navigator.share({title:text,url:url.href});return;}await navigator.clipboard.writeText(url.href);showToast('已複製這隻數碼獸的網址');}
  catch(err){if(err?.name!=='AbortError')showToast('無法複製網址');}
}
function routeCard(e){
  const target=byName(e.to),note=notesText(e.notes);
  return `<article class="route"><button class="route-target${target?' route-link':''}" ${target?`data-target="${target.id}"`:''}>${target?sprite(target,true):''}<span><small>進化至</small><strong>${esc(e.to)}</strong>${target?`<em>#${padNo(target.dex_no)}　${esc(target.stage)}</em>`:''}</span></button><div class="conditions">${conditionRows(e)}</div>${note?`<div class="notes">${esc(note)}</div>`:''}</article>`;
}
function incomingBlock(d){
  const list=DATA.evolutions.filter(e=>e.to===d.name_zh);if(!list.length)return '';
  return `<details class="incoming"><summary>可由 ${list.length} 條路線進化而來</summary><div class="incoming-list">${list.map(e=>{const src=byName(e.from);return `<button class="incoming-link" data-target="${src?.id||''}">${src?sprite(src,true):''}<span>${esc(e.from)}</span></button>`}).join('')}</div></details>`;
}
function renderOverview(){
  const visible=filteredDigimon();const routes=DATA.evolutions.filter(e=>visible.some(d=>d.name_zh===e.from));
  const attributes=[...new Set(visible.map(d=>d.attribute).filter(Boolean))];
  $('#overviewView').innerHTML=`<div class="overview-grid"><article class="stat-card"><strong>${visible.length}</strong><span>數碼獸</span></article><article class="stat-card"><strong>${routes.length}</strong><span>進化條件</span></article><article class="stat-card"><strong>${stageOrder.filter(s=>visible.some(d=>d.stage===s)).length}</strong><span>階段</span></article><article class="stat-card"><strong>${attributes.length}</strong><span>屬性</span></article></div><section class="overview-section"><h2>依階段瀏覽</h2><div class="overview-stages">${stageOrder.map(stage=>{const count=visible.filter(d=>d.stage===stage).length;if(!count)return '';return `<button class="overview-stage" data-stage="${stage}"><strong>${stage}</strong><span>${count} 隻 →</span></button>`}).join('')}</div></section>`;
  $$('#overviewView .overview-stage').forEach(b=>b.onclick=()=>{stageFilter=b.dataset.stage;$('#stageFilter').value=stageFilter;render();switchView('evolution');});
}
function renderStageNav(){
  const available=stageOrder.filter(stage=>DATA.digimon.some(d=>d.stage===stage&&matches(d)));
  $('#stageNav').innerHTML=available.map(stage=>`<button data-stage="${stage}">${stage}</button>`).join('');
  $$('#stageNav button').forEach(b=>b.onclick=()=>document.getElementById(`stage-${b.dataset.stage}`)?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function renderEvolution(){
  const root=$('#evolutionView');let html='';
  for(const stage of stageOrder){
    const list=DATA.digimon.filter(d=>d.stage===stage&&matches(d));if(!list.length)continue;
    html+=`<section class="stage" id="stage-${stage}"><h2 class="stage-title"><span>${stage}</span><small>${list.length} 隻</small></h2>`;
    for(const d of list){
      const routes=DATA.evolutions.filter(e=>e.from===d.name_zh);
      html+=`<article class="source-card" id="evo-${d.id}"><div class="source-head">${sprite(d)}<div class="name"><h3>#${padNo(d.dex_no)} ${esc(d.name_zh)}</h3><p>${esc(d.name_jp)}</p></div><div class="source-actions"><div class="badges"><span class="badge">${esc(d.attribute)}</span><span class="badge">睡眠 ${esc(d.sleep_start)}–${esc(d.sleep_end)}</span></div><button class="share-button" data-share="${d.id}" type="button">分享</button></div></div><details class="details"><summary>基本資料</summary><div class="detail-grid">${detailRows(d)}</div></details>${incomingBlock(d)}<div class="route-heading">可進化數碼獸 <span class="route-count">${routes.length} 條</span></div><div class="routes">${routes.length?routes.map(routeCard).join(''):'<div class="no-route">此階段無後續進化資料</div>'}</div></article>`;
    }html+='</section>';
  }
  root.innerHTML=html||'<div class="empty">找不到符合項目</div>';
  $$('.route-link,.incoming-link').forEach(b=>b.onclick=()=>b.dataset.target&&jumpToDigimon(b.dataset.target));
  $$('[data-share]').forEach(b=>b.onclick=e=>{e.stopPropagation();const d=DATA.digimon.find(x=>x.id===b.dataset.share);if(d)shareDigimon(d);});
  renderStageNav();
}
function renderDex(){
  const list=filteredDigimon();
  $('#dexView').innerHTML=list.length?`<div class="dex-grid">${list.map(d=>`<article class="dex-card" data-id="${d.id}" tabindex="0" role="button" aria-label="查看 ${esc(d.name_zh)} 進化資料">${sprite(d)}<h3>#${padNo(d.dex_no)} ${esc(d.name_zh)}</h3><p>${esc(d.name_jp)}</p><div class="dex-meta"><span class="badge">${esc(d.stage)}</span><span class="badge">${esc(d.attribute)}</span></div></article>`).join('')}</div>`:'<div class="empty">找不到符合項目</div>';
  $$('.dex-card').forEach(x=>{x.onclick=()=>jumpToDigimon(x.dataset.id);x.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jumpToDigimon(x.dataset.id);}}});
}
function updateSummary(){
  const visible=filteredDigimon().length;const parts=[];if(query)parts.push(`搜尋「${$('#searchInput').value.trim()}」`);if(stageFilter)parts.push(stageFilter);if(attributeFilter)parts.push(attributeFilter);
  $('#summary').textContent=parts.length?`${parts.join('／')}：${visible} 隻`:`V0 共 ${DATA.digimon.length} 隻數碼獸／${DATA.evolutions.length} 組進化條件`;
}
function render(){renderOverview();renderEvolution();renderDex();updateSummary();}
function switchView(v,updateHash=true){
  currentView=v;$$('.tab').forEach(b=>{const active=b.dataset.view===v;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  $('#overviewView').classList.toggle('hidden',v!=='overview');$('#evolutionView').classList.toggle('hidden',v!=='evolution');$('#dexView').classList.toggle('hidden',v!=='dex');$('#stageNav').classList.toggle('hidden',v!=='evolution');
  $('.filterbar').classList.toggle('hidden',false);
  if(updateHash)history.replaceState(null,'',canonicalHash(v));
  scrollTo({top:0,behavior:'smooth'});
}
function populateFilters(){
  $('#stageFilter').innerHTML='<option value="">全部階段</option>'+stageOrder.filter(s=>DATA.digimon.some(d=>d.stage===s)).map(s=>`<option>${esc(s)}</option>`).join('');
  const attrs=[...new Set(DATA.digimon.map(d=>d.attribute).filter(Boolean))].sort();$('#attributeFilter').innerHTML='<option value="">全部屬性</option>'+attrs.map(a=>`<option>${esc(a)}</option>`).join('');
}
function parseHash(){const raw=location.hash.slice(1);const p=new URLSearchParams(raw);return {view:p.get('view'),id:p.get('digimon')};}
function restoreHash(){
  const {view,id}=parseHash();if(id&&DATA.digimon.some(d=>d.id===id)){switchView('evolution',false);setTimeout(()=>jumpToDigimon(id,false),80);return;}switchView(['overview','evolution','dex'].includes(view)?view:'overview',false);
}
function setAllDetails(open){$$('#evolutionView details').forEach(d=>d.open=open);}
fetch('data/v0.json').then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(d=>{DATA=d;populateFilters();render();restoreHash();}).catch(err=>{$('#overviewView').innerHTML=`<div class="load-error"><strong>資料載入失敗</strong><span>請確認 data/v0.json 已一併上傳，並透過 GitHub Pages 開啟。</span></div>`;console.error(err);});
$$('.tab').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#searchInput').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
$('#clearSearch').onclick=()=>{$('#searchInput').value='';query='';render();$('#searchInput').focus();};
$('#stageFilter').onchange=e=>{stageFilter=e.target.value;render();};
$('#attributeFilter').onchange=e=>{attributeFilter=e.target.value;render();};
$('#resetFilters').onclick=()=>{$('#searchInput').value='';$('#stageFilter').value='';$('#attributeFilter').value='';query=stageFilter=attributeFilter='';render();};
$('#expandAll').onclick=()=>setAllDetails(true);$('#collapseAll').onclick=()=>setAllDetails(false);
$('#backToTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
addEventListener('scroll',()=>$('#backToTop').classList.toggle('show',scrollY>500),{passive:true});
addEventListener('hashchange',()=>DATA&&restoreHash());
