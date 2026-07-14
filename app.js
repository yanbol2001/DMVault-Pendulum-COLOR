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
let treeSelectedId='';
let dexWireMode='wireless';
function uniqueTreeEdges(){
  const seen=new Set(), edges=[];
  for(const e of DATA.evolutions){
    const a=byName(e.from),b=byName(e.to); if(!a||!b||a.id===b.id)continue;
    const key=`${a.id}>${b.id}`;
    if(!seen.has(key)){seen.add(key);edges.push({from:a.id,to:b.id});}
  }
  return edges;
}
function treeRelations(id){
  const edges=uniqueTreeEdges(), parents=new Map(), children=new Map();
  for(const e of edges){
    if(!parents.has(e.to))parents.set(e.to,[]);parents.get(e.to).push(e.from);
    if(!children.has(e.from))children.set(e.from,[]);children.get(e.from).push(e.to);
  }
  const ancestors=new Set(),descendants=new Set();
  const walk=(map,start,set)=>{const q=[start];while(q.length){const cur=q.shift();for(const n of map.get(cur)||[]){if(!set.has(n)){set.add(n);q.push(n);}}}};
  walk(parents,id,ancestors);walk(children,id,descendants);
  return {edges,ancestors,descendants,related:new Set([id,...ancestors,...descendants])};
}
function stageLayout(list){
  const stageGap=100/Math.max(1,stageOrder.length-1);
  const positions=new Map();
  for(const [si,stage] of stageOrder.entries()){
    const ds=list.filter(d=>d.stage===stage).sort((a,b)=>a.dex_no-b.dex_no);
    const gap=ds.length>1?82/(ds.length-1):0;
    ds.forEach((d,i)=>positions.set(d.id,{x:si*stageGap,y:ds.length===1?50:9+i*gap,stageIndex:si,index:i,count:ds.length}));
  }
  return positions;
}
function conditionSummary(e){
  const rows=[];
  if(e.care_mistakes&&e.care_mistakes!=='-')rows.push(`照顧 ${e.care_mistakes}`);
  if(e.effort&&e.effort!=='-')rows.push(`努力 ${e.effort}`);
  if(e.battles&&e.battles!=='-')rows.push(`戰鬥 ${e.battles}`);
  if(e.win_rate&&e.win_rate!=='-')rows.push(`勝率 ${e.win_rate}`);
  if(e.time&&e.time!=='-')rows.push(`時間 ${e.time}`);
  const notes=(e.notes||'').split('/').map(x=>x.trim()).filter(x=>x&&!['照顧','努力','戰鬥','勝率','時間'].includes(x));
  return [...rows,...notes].join('｜')||'進化';
}
function linePath(x1,y1,x2,y2){
  const dx=Math.max(28,Math.abs(x2-x1)*.38);
  return `M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`;
}
function drawTreeLines(){
  const board=$('#dexTreeBoard'),svg=$('#dexTreeLines');if(!board||!svg)return;
  const br=board.getBoundingClientRect();
  svg.setAttribute('viewBox',`0 0 ${br.width} ${br.height}`);svg.innerHTML='';
  const relation=treeSelectedId?treeRelations(treeSelectedId):null;
  for(const edge of uniqueTreeEdges()){
    const a=board.querySelector(`[data-id="${edge.from}"]`),b=board.querySelector(`[data-id="${edge.to}"]`);if(!a||!b)continue;
    const ar=a.getBoundingClientRect(),bb=b.getBoundingClientRect();
    const x1=ar.right-br.left,y1=ar.top+ar.height/2-br.top,x2=bb.left-br.left,y2=bb.top+bb.height/2-br.top;
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',linePath(x1,y1,x2,y2));path.dataset.from=edge.from;path.dataset.to=edge.to;
    if(relation){const active=relation.related.has(edge.from)&&relation.related.has(edge.to);path.classList.add(active?'active':'dimmed');}
    svg.appendChild(path);
  }
}
function applyTreeSelection(id){
  treeSelectedId=id||'';const d=DATA.digimon.find(x=>x.id===treeSelectedId);const relation=d?treeRelations(d.id):null;
  $$('.dex-map-node').forEach(n=>{
    n.classList.remove('selected','related','dimmed');if(!relation)return;
    n.classList.toggle('selected',n.dataset.id===d.id);
    n.classList.toggle('related',n.dataset.id!==d.id&&relation.related.has(n.dataset.id));
    n.classList.toggle('dimmed',!relation.related.has(n.dataset.id));
  });
  $$('.dex-condition').forEach(c=>{
    c.classList.remove('active','dimmed');if(!relation)return;
    const active=relation.related.has(c.dataset.from)&&relation.related.has(c.dataset.to);
    c.classList.add(active?'active':'dimmed');
  });
  const label=$('#treeSelection');if(label)label.textContent=d?`${d.name_zh}：已高亮完整前後路線`:'尚未選擇';
  const go=$('#treeGoEvolution');if(go)go.disabled=!d;const clear=$('#treeClear');if(clear)clear.disabled=!d;
  requestAnimationFrame(drawTreeLines);
}
function renderDex(){
  const list=filteredDigimon();
  if(!list.length){$('#dexView').innerHTML='<div class="empty">找不到符合項目</div>';return;}
  const positions=stageLayout(list);
  const conditions=[];
  if(dexWireMode==='wired'){
    const grouped=new Map();
    DATA.evolutions.forEach((e,idx)=>{
      const a=byName(e.from),b=byName(e.to);if(!a||!b||!positions.has(a.id)||!positions.has(b.id))return;
      const key=`${a.id}>${b.id}`;const n=grouped.get(key)||0;grouped.set(key,n+1);
      const pa=positions.get(a.id),pb=positions.get(b.id);
      const midX=(pa.x+pb.x)/2;
      const midY=(pa.y+pb.y)/2+(n-(Math.min(4,(grouped.get(key)||1))-1)/2)*4.2;
      conditions.push(`<button class="dex-condition" type="button" data-from="${a.id}" data-to="${b.id}" style="--x:${midX};--y:${Math.max(4,Math.min(96,midY))}" title="${esc(e.from)} → ${esc(e.to)}">${esc(conditionSummary(e))}</button>`);
    });
  }
  const nodes=list.map(d=>{const p=positions.get(d.id);return `<button class="dex-map-node attr-${esc(d.attribute)}" data-id="${d.id}" type="button" style="--x:${p.x};--y:${p.y}" title="#${padNo(d.dex_no)} ${esc(d.name_zh)}｜${esc(d.stage)}｜${esc(d.attribute)}">${sprite(d,'dex-map-sprite')}<span>${esc(d.name_zh)}</span></button>`;}).join('');
  const stageLabels=stageOrder.map((stage,i)=>list.some(d=>d.stage===stage)?`<span class="dex-stage-label" style="--x:${i*(100/Math.max(1,stageOrder.length-1))}">${stage}</span>`:'').join('');
  $('#dexView').innerHTML=`<section class="dex-map-shell ${dexWireMode}">
    <div class="dex-tree-toolbar"><strong>進化技能樹</strong><div class="wire-switch" role="group" aria-label="圖鑑顯示模式"><button class="${dexWireMode==='wireless'?'active':''}" data-wire="wireless" type="button">無線</button><button class="${dexWireMode==='wired'?'active':''}" data-wire="wired" type="button">有線</button></div><span id="treeSelection" class="tree-selection">尚未選擇</span><button id="treeClear" type="button" disabled>清除路線</button><button id="treeGoEvolution" type="button" disabled>查看進化條件</button><span class="dex-tree-hint">點數碼獸可高亮完整路線</span></div>
    <div class="dex-map-viewport"><div id="dexTreeBoard" class="dex-map-board"><div class="dex-stage-labels">${stageLabels}</div><svg id="dexTreeLines" class="dex-tree-lines" aria-hidden="true"></svg>${conditions.join('')}${nodes}</div></div>
  </section>`;
  $$('[data-wire]').forEach(b=>b.onclick=()=>{dexWireMode=b.dataset.wire;renderDex();});
  $$('.dex-map-node').forEach(n=>n.onclick=()=>applyTreeSelection(treeSelectedId===n.dataset.id?'':n.dataset.id));
  $$('.dex-condition').forEach(c=>c.onclick=()=>{const id=c.dataset.to;applyTreeSelection(id);});
  $('#treeClear').onclick=()=>applyTreeSelection('');
  $('#treeGoEvolution').onclick=()=>{if(treeSelectedId)jumpToDigimon(treeSelectedId);};
  if(treeSelectedId&&!list.some(d=>d.id===treeSelectedId))treeSelectedId='';
  requestAnimationFrame(()=>{applyTreeSelection(treeSelectedId);setTimeout(drawTreeLines,100);});
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

let treeResizeTimer;addEventListener('resize',()=>{clearTimeout(treeResizeTimer);treeResizeTimer=setTimeout(drawTreeLines,120);});
