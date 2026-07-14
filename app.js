const stageOrder=['幼年期1','幼年期2','成長期','成熟期','完全體','究極體','超究極體'];
let DATA=null, query='', currentView='overview', stageFilter='', attributeFilter='';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const padNo=n=>String(n).padStart(3,'0');
const byName=name=>DATA?.digimon.find(d=>d.name_zh===name);
function sprite(d,cls=''){return `<span class="sprite ${cls}"><img src="${esc(d.image)}" alt="${esc(d.name_zh)}" loading="lazy" onerror="this.remove();this.parentElement.classList.add('sprite-error');this.parentElement.dataset.no='${padNo(d.dex_no)}'"></span>`;}
function haystack(d){
  const incoming=DATA.evolutions.filter(e=>e.to===d.name_zh).map(e=>e.from).join(' ');
  const outgoing=DATA.evolutions.filter(e=>e.from===d.name_zh).map(e=>e.to).join(' ');
  return `${d.dex_no} ${padNo(d.dex_no)} ${d.name_zh} ${d.name_jp} ${d.stage} ${d.attribute} ${incoming} ${outgoing}`.toLowerCase();
}
function matches(d){return (!query||haystack(d).includes(query))&&(!stageFilter||d.stage===stageFilter)&&(!attributeFilter||d.attribute===attributeFilter);}
function filteredDigimon(){return DATA.digimon.filter(matches);}
function showToast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),1800);}
function canonicalHash(view,id=''){return id?`#digimon=${encodeURIComponent(id)}`:`#view=${view}`;}
function jumpToDigimon(id,push=true){
  switchView('evolution',false);
  if(push)history.replaceState(null,'',canonicalHash('evolution',id));
  requestAnimationFrame(()=>{const el=document.getElementById(`evo-${id}`);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1000);}});
}
async function shareDigimon(d){
  const url=new URL(location.href);url.hash=`digimon=${encodeURIComponent(d.id)}`;
  try{if(navigator.share){await navigator.share({title:`${d.name_zh}｜DMVault Pendulum COLOR V0`,url:url.href});return;}await navigator.clipboard.writeText(url.href);showToast('已複製網址');}
  catch(err){if(err?.name!=='AbortError')showToast('無法複製網址');}
}
function displayMinutes(v){
  if(v===''||v==null)return '-';
  const n=Number(v); if(!Number.isFinite(n))return v;
  if(n>=60&&n%60===0)return `${n/60}小時`;
  return `${n}分鐘`;
}
function sourceInfoTable(d){
  const jogress=`${d.can_battle||'X'} / ${d.can_jogress||'X'}`;
  return `<div class="source-panel">
    <div class="source-title-zh">${esc(d.name_zh)}</div>
    <div class="source-title-jp">${esc(d.name_jp)}</div>
    <div class="source-body">
      <div class="source-side">
        ${sprite(d,'source-sprite')}
        <span class="stage-tag">${esc(d.stage)}</span>
        <span class="attribute-tag">${esc(d.attribute)}</span>
        <span class="strength-label">強度</span><strong class="strength-value">${esc(d.strength||'-')}</strong>
        <span class="attack-label">攻擊圖案</span><span class="attack-icon"><img src="${esc(d.attack_image||'')}" alt="攻擊圖案" onerror="this.parentElement.textContent='-'"></span>
      </div>
      <div class="source-stats">
        ${[['圖鑑編號',d.dex_no],['體重',d.minimum_weight],['DP值',d.dp],['基礎照顧心',d.base_care_hearts],['飢餓倒數',d.hunger_strength_timer_min],['大便倒數',d.poop_timer_min],['戰鬥／合體',jogress],['入睡時間',d.sleep_start],['起床時間',d.sleep_end]].map(([k,v])=>`<div class="stat-label">${esc(k)}</div><div class="stat-value">${esc(v??'-')}</div>`).join('')}
      </div>
    </div>
  </div>`;
}
function routeColumn(e){
  const target=byName(e.to);
  const fields=[['照顧',e.care_mistakes],['努力',e.effort],['戰鬥',e.battles],['勝率',e.win_rate],['時間',e.time]];
  const noteParts=(e.notes||'').split('/').map(x=>x.trim()).filter(x=>x&&!['照顧','努力','戰鬥','勝率','時間'].includes(x));
  const extra=noteParts.join('<br>');
  const noteText=noteParts.join(' ');
  const noteClass=noteText.includes('解鎖圖鑑6 前')?'unlock-before':noteText.includes('解鎖圖鑑6 後')?'unlock-after':noteParts.length?'jogress-note':'';
  return `<div class="route-column">
    <button class="route-head ${target?'route-link':''}" ${target?`data-target="${target.id}"`:''} type="button">
      ${target?sprite(target,'route-sprite'):''}
      <strong>${esc(e.to)}</strong>
    </button>
    <div class="route-fields">${fields.map(([k,v])=>`<div class="route-label">${k}</div><div class="route-value ${(!v||v==='-')?'muted':''}">${esc(v||'-')}</div>`).join('')}</div>
    <div class="route-note ${noteClass}">${extra||'&nbsp;'}</div>
  </div>`;
}
function renderOverview(){
  const visible=filteredDigimon();
  $('#overviewView').innerHTML=`<div class="overview-grid"><article class="stat-card"><strong>${visible.length}</strong><span>數碼獸</span></article><article class="stat-card"><strong>${DATA.evolutions.filter(e=>visible.some(d=>d.name_zh===e.from)).length}</strong><span>進化條件</span></article><article class="stat-card"><strong>${stageOrder.filter(s=>visible.some(d=>d.stage===s)).length}</strong><span>階段</span></article></div><section class="overview-section"><h2>依階段瀏覽</h2><div class="overview-stages">${stageOrder.map(stage=>{const count=visible.filter(d=>d.stage===stage).length;return count?`<button class="overview-stage" data-stage="${stage}"><strong>${stage}</strong><span>${count} 隻 →</span></button>`:''}).join('')}</div></section>`;
  $$('#overviewView .overview-stage').forEach(b=>b.onclick=()=>{stageFilter=b.dataset.stage;$('#stageFilter').value=stageFilter;render();switchView('evolution');});
}
function renderStageNav(){
  const available=stageOrder.filter(stage=>DATA.digimon.some(d=>d.stage===stage&&matches(d)));
  $('#stageNav').innerHTML=available.map(stage=>`<button data-stage="${stage}">${stage}</button>`).join('');
  $$('#stageNav button').forEach(b=>b.onclick=()=>document.getElementById(`stage-${b.dataset.stage}`)?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function renderEvolution(){
  let html='';
  for(const stage of stageOrder){
    const list=DATA.digimon.filter(d=>d.stage===stage&&matches(d)); if(!list.length)continue;
    html+=`<section class="stage-section" id="stage-${stage}"><h2 class="stage-heading"><span>${stage}</span><small>${list.length} 隻</small></h2>`;
    for(const d of list){
      const routes=DATA.evolutions.filter(e=>e.from===d.name_zh);
      html+=`<article class="evolution-sheet" id="evo-${d.id}">
        <div class="sheet-scroll"><div class="sheet-row">${sourceInfoTable(d)}<div class="route-area">${routes.length?routes.map(routeColumn).join(''):`<div class="no-route">此階段無後續進化資料</div>`}</div></div></div>
        <div class="sheet-actions"><button type="button" data-share="${d.id}">分享這隻</button></div>
      </article>`;
    }
    html+='</section>';
  }
  $('#evolutionView').innerHTML=html||'<div class="empty">找不到符合項目</div>';
  $$('.route-link').forEach(b=>b.onclick=()=>jumpToDigimon(b.dataset.target));
  $$('[data-share]').forEach(b=>b.onclick=()=>{const d=DATA.digimon.find(x=>x.id===b.dataset.share);if(d)shareDigimon(d);});
  renderStageNav();
}
function renderDex(){
  const list=filteredDigimon();
  const stages=stageOrder.filter(stage=>list.some(d=>d.stage===stage));
  if(!list.length){$('#dexView').innerHTML='<div class="empty">找不到符合項目</div>';return;}
  $('#dexView').innerHTML=`<div class="dex-chart-wrap"><div class="dex-chart">${stages.map(stage=>{
    const ds=list.filter(d=>d.stage===stage);
    return `<section class="dex-stage-row"><h2><span>${stage}</span><small>${ds.length} 隻</small></h2><div class="dex-stage-list">${ds.map(d=>`<button class="dex-mon" data-id="${d.id}" type="button">${sprite(d,'dex-sprite')}<span class="dex-no">#${padNo(d.dex_no)}</span><strong>${esc(d.name_zh)}</strong><small>${esc(d.attribute)}</small></button>`).join('')}</div></section>`;
  }).join('')}</div></div>`;
  $$('.dex-mon').forEach(x=>x.onclick=()=>jumpToDigimon(x.dataset.id));
}
function updateSummary(){
  const visible=filteredDigimon().length,parts=[];
  if(query)parts.push(`搜尋「${$('#searchInput').value.trim()}」`);if(stageFilter)parts.push(stageFilter);if(attributeFilter)parts.push(attributeFilter);
  $('#summary').textContent=parts.length?`${parts.join('／')}：${visible} 隻`:`V0 共 ${DATA.digimon.length} 隻數碼獸／${DATA.evolutions.length} 組進化條件`;
}
function render(){renderOverview();renderEvolution();renderDex();updateSummary();}
function switchView(v,updateHash=true){
  currentView=v;$$('.tab').forEach(b=>{const active=b.dataset.view===v;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  $('#overviewView').classList.toggle('hidden',v!=='overview');$('#evolutionView').classList.toggle('hidden',v!=='evolution');$('#dexView').classList.toggle('hidden',v!=='dex');$('#stageNav').classList.toggle('hidden',v!=='evolution');
  $('.filterbar').classList.toggle('dex-mode',v==='dex');
  if(updateHash)history.replaceState(null,'',canonicalHash(v));
  scrollTo({top:0,behavior:'smooth'});
}
function populateFilters(){
  $('#stageFilter').innerHTML='<option value="">全部階段</option>'+stageOrder.filter(s=>DATA.digimon.some(d=>d.stage===s)).map(s=>`<option>${esc(s)}</option>`).join('');
  const attrs=[...new Set(DATA.digimon.map(d=>d.attribute).filter(Boolean))].sort();$('#attributeFilter').innerHTML='<option value="">全部屬性</option>'+attrs.map(a=>`<option>${esc(a)}</option>`).join('');
}
function parseHash(){const p=new URLSearchParams(location.hash.slice(1));return {view:p.get('view'),id:p.get('digimon')};}
function restoreHash(){const {view,id}=parseHash();if(id&&DATA.digimon.some(d=>d.id===id)){switchView('evolution',false);setTimeout(()=>jumpToDigimon(id,false),80);return;}switchView(['overview','evolution','dex'].includes(view)?view:'overview',false);}
fetch('data/v0.json').then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(d=>{DATA=d;const counts=new Map();for(const e of DATA.evolutions)counts.set(e.from,(counts.get(e.from)||0)+1);const maxRoutes=Math.max(1,...counts.values());document.documentElement.style.setProperty('--route-columns',String(maxRoutes));populateFilters();render();restoreHash();}).catch(err=>{$('#overviewView').innerHTML='<div class="load-error"><strong>資料載入失敗</strong><span>請確認 data/v0.json 已一併上傳。</span></div>';console.error(err);});
$$('.tab').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#searchInput').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
$('#clearSearch').onclick=()=>{$('#searchInput').value='';query='';render();$('#searchInput').focus();};
$('#stageFilter').onchange=e=>{stageFilter=e.target.value;render();};
$('#attributeFilter').onchange=e=>{attributeFilter=e.target.value;render();};
$('#resetFilters').onclick=()=>{$('#searchInput').value='';$('#stageFilter').value='';$('#attributeFilter').value='';query=stageFilter=attributeFilter='';render();};
$('#expandAll').style.display='none';$('#collapseAll').style.display='none';
$('#backToTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
addEventListener('scroll',()=>$('#backToTop').classList.toggle('show',scrollY>500),{passive:true});
addEventListener('hashchange',()=>DATA&&restoreHash());
