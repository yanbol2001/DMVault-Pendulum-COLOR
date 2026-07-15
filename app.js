const stageOrder=['幼年期1','幼年期2','成長期','成熟期','完全體','究極體','超究極體'];
let DATA=null, query='', currentView='overview', stageFilter='', attributeFilter='', currentEvolutionId='';
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
  if(!DATA?.digimon.some(d=>d.id===id))return;
  currentEvolutionId=id;
  switchView('evolution',false);
  renderEvolution();
  if(push)history.replaceState(null,'',canonicalHash('evolution',id));
  requestAnimationFrame(()=>{document.querySelector('.evo-detail-page')?.scrollIntoView({behavior:'smooth',block:'start'});});
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
function detailStatRows(d){
  const jogress=`${d.can_battle||'X'} / ${d.can_jogress||'X'}`;
  return [
    ['圖鑑編號',padNo(d.dex_no)],['階段',d.stage],['屬性',d.attribute],['強度',d.strength||'-'],
    ['體重',d.minimum_weight],['DP值',d.dp],['基礎照顧心',d.base_care_hearts],
    ['飢餓倒數',d.hunger_strength_timer_min],['大便倒數',d.poop_timer_min],
    ['戰鬥／合體',jogress],['入睡時間',d.sleep_start],['起床時間',d.sleep_end]
  ];
}
function miniDigimonCard(d,kind='outgoing'){
  return `<button class="mini-digimon-card" type="button" data-detail-target="${d.id}">
    ${sprite(d,'mini-card-sprite')}<strong>${esc(d.name_zh)}</strong><small>#${padNo(d.dex_no)}｜${esc(d.stage)}</small>
  </button>`;
}
function conditionAccordion(e,index){
  const target=byName(e.to);
  const fields=[['照顧',e.care_mistakes],['努力',e.effort],['戰鬥',e.battles],['勝率',e.win_rate],['時間',e.time]];
  const notes=(e.notes||'').split('/').map(x=>x.trim()).filter(x=>x&&!['照顧','努力','戰鬥','勝率','時間'].includes(x));
  const noteText=notes.join(' '), noteClass=noteText.includes('解鎖圖鑑6 前')?'unlock-before':noteText.includes('解鎖圖鑑6 後')?'unlock-after':'';
  return `<details class="condition-accordion" ${index===0?'open':''}>
    <summary>${target?sprite(target,'accordion-sprite'):''}<span><strong>${esc(e.to)}</strong><small>查看原攻略條件</small></span></summary>
    <div class="condition-body">
      <div class="condition-grid">${fields.map(([k,v])=>`<div class="condition-label">${k}</div><div class="condition-value ${(!v||v==='-')?'muted':''}">${esc(v||'-')}</div>`).join('')}</div>
      ${notes.length?`<div class="condition-note ${noteClass}">${notes.map(esc).join('<br>')}</div>`:''}
      ${target?`<button class="condition-go" type="button" data-detail-target="${target.id}">切換到 ${esc(target.name_zh)}</button>`:''}
    </div>
  </details>`;
}
function incomingCard(e){
  const source=byName(e.from); if(!source)return '';
  return `<button class="incoming-card" type="button" data-detail-target="${source.id}">${sprite(source,'incoming-sprite')}<span><strong>${esc(source.name_zh)}</strong><small>${esc(conditionSummary(e))}</small></span></button>`;
}
function renderEvolution(){
  const list=filteredDigimon().sort((a,b)=>a.dex_no-b.dex_no);
  if(!list.length){$('#evolutionView').innerHTML='<div class="empty">找不到符合項目</div>';return;}
  if(!currentEvolutionId||!list.some(d=>d.id===currentEvolutionId))currentEvolutionId=list[0].id;
  const d=list.find(x=>x.id===currentEvolutionId)||list[0];
  const allIndex=DATA.digimon.slice().sort((a,b)=>a.dex_no-b.dex_no);
  const globalIndex=allIndex.findIndex(x=>x.id===d.id);
  const prev=allIndex[(globalIndex-1+allIndex.length)%allIndex.length];
  const next=allIndex[(globalIndex+1)%allIndex.length];
  const routes=DATA.evolutions.filter(e=>e.from===d.name_zh);
  const incoming=DATA.evolutions.filter(e=>e.to===d.name_zh);
  const targets=[...new Map(routes.map(e=>[e.to,byName(e.to)])).values()].filter(Boolean);
  $('#evolutionView').innerHTML=`<article class="evo-detail-page" id="evo-${d.id}">
    <header class="detail-nav">
      <button type="button" data-detail-target="${prev.id}">← ${esc(prev.name_zh)}</button>
      <div><small>${globalIndex+1} / ${allIndex.length}</small><strong>#${padNo(d.dex_no)} ${esc(d.name_zh)}</strong></div>
      <button type="button" data-detail-target="${next.id}">${esc(next.name_zh)} →</button>
    </header>
    <div class="detail-hero">
      <aside class="detail-profile">
        <div class="profile-name"><h1>${esc(d.name_zh)}</h1><p>${esc(d.name_jp)}</p></div>
        <div class="profile-sprite">${sprite(d,'detail-main-sprite')}</div>
        <div class="profile-attack"><span>攻擊圖案</span><img src="${esc(d.attack_image||'')}" alt="攻擊圖案" onerror="this.parentElement.classList.add('no-attack');this.remove()"></div>
        <div class="profile-actions"><button type="button" id="detailShowDex">在圖鑑中查看</button><button type="button" data-share="${d.id}">分享這隻</button></div>
      </aside>
      <section class="detail-info"><h2>基本資料</h2><div class="detail-stat-grid">${detailStatRows(d).map(([k,v])=>`<div class="detail-stat-label">${esc(k)}</div><div class="detail-stat-value">${esc(v??'-')}</div>`).join('')}</div></section>
    </div>
    <section class="detail-section"><div class="section-title"><h2>可進化</h2><span>${targets.length} 隻／${routes.length} 組條件</span></div><div class="mini-card-grid">${targets.length?targets.map(miniDigimonCard).join(''):'<p class="empty-inline">此階段無後續進化資料</p>'}</div></section>
    <section class="detail-section"><div class="section-title"><h2>進化條件</h2><span>保留原試算表格式</span></div><div class="condition-list">${routes.length?routes.map(conditionAccordion).join(''):'<p class="empty-inline">無進化條件</p>'}</div></section>
    <section class="detail-section"><div class="section-title"><h2>可由哪些數碼獸進化</h2><span>${incoming.length} 組來源</span></div><div class="incoming-grid">${incoming.length?incoming.map(incomingCard).join(''):'<p class="empty-inline">沒有前一階資料</p>'}</div></section>
  </article>`;
  $$('[data-detail-target]').forEach(b=>b.onclick=()=>jumpToDigimon(b.dataset.detailTarget));
  $$('[data-share]').forEach(b=>b.onclick=()=>shareDigimon(d));
  $('#detailShowDex').onclick=()=>{treeSelectedId=d.id;switchView('dex');setTimeout(()=>applyTreeSelection(d.id),120);};
  $('#stageNav').innerHTML='';
}

let treeSelectedId='';
let treeHoverId='';
let dexWireMode='wireless';
let dexScale=1;
let dexPanX=0,dexPanY=0;
const DEX_SCALE_MIN=.65,DEX_SCALE_MAX=1.8,DEX_SCALE_STEP=.15;
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
function jogressAttributeLabel(e){
  const notes=String(e.notes||'');
  if(!/(成熟期的|完全體的|究極體的|超究極體的)/.test(notes))return '';
  const labels=[];
  if(notes.includes('疫苗種'))labels.push('Va');
  if(notes.includes('資料種'))labels.push('Da');
  if(notes.includes('病毒種'))labels.push('Vi');
  if(notes.includes('自由種'))labels.push('Fr');
  return [...new Set(labels)].join('/');
}
function linePath(x1,y1,x2,y2){
  const dx=Math.max(28,Math.abs(x2-x1)*.38);
  return `M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`;
}
function svgEl(name,attrs={}){
  const el=document.createElementNS('http://www.w3.org/2000/svg',name);
  for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
  return el;
}
function targetColor(targetId,index){
  let hash=0;for(const ch of targetId)hash=((hash<<5)-hash)+ch.charCodeAt(0)|0;
  const hue=(Math.abs(hash)+index*37)%360;
  return `hsl(${hue} 78% 43%)`;
}
function drawTreeLines(){
  const board=$('#dexTreeBoard'),svg=$('#dexTreeLines');if(!board||!svg)return;
  const boardW=board.offsetWidth,boardH=board.offsetHeight;
  svg.setAttribute('viewBox',`0 0 ${boardW} ${boardH}`);svg.innerHTML='';

  const grouped=new Map();
  for(const evo of DATA.evolutions){
    const from=byName(evo.from),to=byName(evo.to);if(!from||!to||from.id===to.id)continue;
    if(!grouped.has(to.id))grouped.set(to.id,{to,items:[]});
    grouped.get(to.id).items.push({from,to,evo});
  }

  const labelLayer=svgEl('g',{'class':'evo-label-layer'});
  let groupIndex=0;
  for(const group of grouped.values()){
    const targetNode=board.querySelector(`[data-id="${group.to.id}"]`);if(!targetNode)continue;
    const tx=targetNode.offsetLeft-targetNode.offsetWidth/2;
    const targetCenterY=targetNode.offsetTop;

    const valid=group.items.map(item=>{
      const node=board.querySelector(`[data-id="${item.from.id}"]`);if(!node)return null;
      return {...item,x:node.offsetLeft+node.offsetWidth/2,y:node.offsetTop};
    }).filter(Boolean).sort((a,b)=>a.y-b.y);
    if(!valid.length)continue;

    const color=targetColor(group.to.id,groupIndex++);
    const n=valid.length;

    // v0.16：每條引導線至少相隔 30px，避免 Va / Da / Vi 標籤上下重疊。
    // 單一路線仍置中；多路線則在目標前垂直展開，最後才匯入目標。
    const slotGap=n>1?30:0;
    const slotStart=targetCenterY-((n-1)*slotGap)/2;
    const mergeX=tx-14;
    const labelX=tx-62;
    const maxSourceX=Math.max(...valid.map(v=>v.x));
    const available=Math.max(72,labelX-maxSourceX);
    const baseLaneX=maxSourceX+Math.max(30,available*.46);

    valid.forEach((item,i)=>{
      const slotY=slotStart+i*slotGap;
      // 各來源先走獨立車道，再進入靠近目標的平行區；不在標籤前合流。
      const laneOffset=(i-(n-1)/2)*7;
      const laneX=Math.min(labelX-46,baseLaneX+laneOffset);
      const d=`M ${item.x} ${item.y} H ${laneX} V ${slotY} H ${mergeX}`;
      const path=svgEl('path',{d,'class':'evo-route'});
      path.style.setProperty('--edge-color',color);
      path.dataset.from=item.from.id;path.dataset.to=group.to.id;
      svg.appendChild(path);

      const label=jogressAttributeLabel(item.evo);
      if(label){
        const width=Math.max(30,label.length*9+16);
        const lx=labelX;
        const ly=slotY;
        const g=svgEl('g',{'class':'evo-line-label','data-from':item.from.id,'data-to':group.to.id});
        const rect=svgEl('rect',{x:lx-width/2,y:ly-12,width,height:24,rx:5,ry:5});
        rect.style.setProperty('--edge-color',color);
        const text=svgEl('text',{x:lx,y:ly+4,'text-anchor':'middle'});text.textContent=label;
        g.append(rect,text);labelLayer.appendChild(g);
      }
    });

    // 每條短引導線維持自己的高度，進入目標前才各自彎向中心。
    valid.forEach((item,i)=>{
      const slotY=slotStart+i*slotGap;
      const bendX=tx-8;
      const finalD=slotY===targetCenterY
        ?`M ${mergeX} ${slotY} H ${tx}`
        :`M ${mergeX} ${slotY} H ${bendX} Q ${tx} ${slotY} ${tx} ${targetCenterY}`;
      const final=svgEl('path',{d:finalD,'class':'evo-target-guide'});
      final.style.setProperty('--edge-color',color);
      final.dataset.from=item.from.id;final.dataset.to=group.to.id;
      svg.appendChild(final);
    });
  }
  svg.appendChild(labelLayer);
  applyTreeHighlight(treeHoverId||treeSelectedId,false);
}
function applyTreeHighlight(id,updateText=true){
  const d=DATA.digimon.find(x=>x.id===id);const relation=d?treeRelations(d.id):null;
  $$('.dex-map-node').forEach(n=>{
    n.classList.remove('selected','hovered','related','dimmed');if(!relation)return;
    n.classList.toggle(treeHoverId?'hovered':'selected',n.dataset.id===d.id);
    n.classList.toggle('related',n.dataset.id!==d.id&&relation.related.has(n.dataset.id));
    n.classList.toggle('dimmed',!relation.related.has(n.dataset.id));
  });
  $$('#dexTreeLines [data-from][data-to]').forEach(el=>{
    el.classList.remove('active','dimmed');if(!relation)return;
    const active=relation.related.has(el.dataset.from)&&relation.related.has(el.dataset.to);
    el.classList.add(active?'active':'dimmed');
  });
  if(updateText){const label=$('#treeSelection');if(label)label.textContent=d?`${d.name_zh}：已高亮完整前後路線`:'尚未選擇';}
}
function applyTreeSelection(id){
  treeSelectedId=id||'';treeHoverId='';
  const d=DATA.digimon.find(x=>x.id===treeSelectedId);
  applyTreeHighlight(treeSelectedId,true);
  const go=$('#treeGoEvolution');if(go)go.disabled=!d;
  const clear=$('#treeClear');if(clear)clear.disabled=!d;
}
function applyDexTransform(){
  const board=$('#dexTreeBoard');
  if(!board)return;
  board.style.transform=`translate(${dexPanX}px, ${dexPanY}px) scale(${dexScale})`;
  const out=$('#dexZoomValue');if(out)out.textContent=`${Math.round(dexScale*100)}%`;
}
function setDexScale(next,anchor=null){
  const viewport=$('.dex-map-viewport');if(!viewport)return;
  const old=dexScale;
  const updated=Math.max(DEX_SCALE_MIN,Math.min(DEX_SCALE_MAX,Math.round(next*100)/100));
  const ax=anchor?.x??viewport.clientWidth/2, ay=anchor?.y??viewport.clientHeight/2;
  const worldX=(ax-dexPanX)/old, worldY=(ay-dexPanY)/old;
  dexScale=updated;
  dexPanX=ax-worldX*dexScale;dexPanY=ay-worldY*dexScale;
  applyDexTransform();
}
function bindDexPanZoom(){
  const viewport=$('.dex-map-viewport');if(!viewport)return;
  let pointerActive=false,dragging=false,suppressClick=false,startX=0,startY=0,startPanX=0,startPanY=0,pointerId=null;
  const DRAG_THRESHOLD=4;
  viewport.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    pointerActive=true;dragging=false;suppressClick=false;pointerId=e.pointerId;
    startX=e.clientX;startY=e.clientY;startPanX=dexPanX;startPanY=dexPanY;
    try{viewport.setPointerCapture(e.pointerId)}catch{}
  });
  viewport.addEventListener('pointermove',e=>{
    if(!pointerActive||e.pointerId!==pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(!dragging&&Math.hypot(dx,dy)>=DRAG_THRESHOLD){dragging=true;suppressClick=true;viewport.classList.add('dragging');}
    if(!dragging)return;
    e.preventDefault();
    dexPanX=startPanX+dx;dexPanY=startPanY+dy;
    applyDexTransform();
  });
  const stop=e=>{
    if(pointerId!==null&&e.pointerId!==pointerId)return;
    pointerActive=false;dragging=false;viewport.classList.remove('dragging');
    try{viewport.releasePointerCapture(e.pointerId)}catch{}
    pointerId=null;
    setTimeout(()=>{suppressClick=false},0);
  };
  viewport.addEventListener('pointerup',stop);viewport.addEventListener('pointercancel',stop);
  viewport.addEventListener('click',e=>{if(!suppressClick)return;e.preventDefault();e.stopPropagation();},true);
  viewport.addEventListener('dblclick',e=>{if(!suppressClick)return;e.preventDefault();e.stopPropagation();},true);
  viewport.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();const r=viewport.getBoundingClientRect();setDexScale(dexScale+(e.deltaY<0?DEX_SCALE_STEP:-DEX_SCALE_STEP),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
}
function renderDex(){
  const list=filteredDigimon();
  if(!list.length){$('#dexView').innerHTML='<div class="empty">找不到符合項目</div>';return;}
  const positions=stageLayout(list);
  const nodes=list.map(d=>{const p=positions.get(d.id);return `<button class="dex-map-node attr-${esc(d.attribute)}" data-id="${d.id}" type="button" style="--x:${p.x};--y:${p.y}" title="#${padNo(d.dex_no)} ${esc(d.name_zh)}｜點一下高亮，連點前往進化條件">${sprite(d,'dex-map-sprite')}<span>${esc(d.name_zh)}</span></button>`;}).join('');
  const stageLabels=stageOrder.map((stage,i)=>list.some(d=>d.stage===stage)?`<span class="dex-stage-label" style="--x:${i*(100/Math.max(1,stageOrder.length-1))}">${stage}</span>`:'').join('');
  $('#dexView').innerHTML=`<section class="dex-map-shell ${dexWireMode}">
    <div class="dex-tree-toolbar"><strong>進化技能樹</strong><div class="wire-switch" role="group" aria-label="圖鑑顯示模式"><button class="${dexWireMode==='wireless'?'active':''}" data-wire="wireless" type="button">無線</button><button class="${dexWireMode==='wired'?'active':''}" data-wire="wired" type="button">有線</button></div>
      <div class="tree-actions"><button id="dexZoomOut" type="button" aria-label="縮小">−</button><output id="dexZoomValue">${Math.round(dexScale*100)}%</output><button id="dexZoomIn" type="button" aria-label="放大">＋</button><button id="dexZoomReset" type="button">重設視圖</button><button id="treeClear" type="button" ${treeSelectedId?'':'disabled'}>清除高亮</button><button id="treeGoEvolution" type="button" ${treeSelectedId?'':'disabled'}>查看進化條件</button></div>
      <span id="treeSelection" class="dex-tree-hint">${treeSelectedId?(DATA.digimon.find(d=>d.id===treeSelectedId)?.name_zh+'：已高亮完整前後路線'):'滑過可預覽；點一下固定高亮；連點前往進化條件'}</span></div>
    <div class="dex-map-viewport"><div id="dexMapCanvas" class="dex-map-canvas"><div id="dexTreeBoard" class="dex-map-board"><div class="dex-stage-labels">${stageLabels}</div><svg id="dexTreeLines" class="dex-tree-lines" aria-hidden="true"></svg>${nodes}</div></div></div>
  </section>`;
  $$('[data-wire]').forEach(b=>b.onclick=()=>{dexWireMode=b.dataset.wire;renderDex();});
  $$('.dex-map-node').forEach(n=>{
    n.onclick=()=>applyTreeSelection(n.dataset.id);
    n.ondblclick=()=>jumpToDigimon(n.dataset.id);
    n.onmouseenter=()=>{treeHoverId=n.dataset.id;applyTreeHighlight(treeHoverId,false)};
    n.onmouseleave=()=>{treeHoverId='';applyTreeHighlight(treeSelectedId,false)};
    n.onfocus=()=>{treeHoverId=n.dataset.id;applyTreeHighlight(treeHoverId,false)};
    n.onblur=()=>{treeHoverId='';applyTreeHighlight(treeSelectedId,false)};
  });
  $('#treeClear').onclick=()=>applyTreeSelection('');
  $('#treeGoEvolution').onclick=()=>treeSelectedId&&jumpToDigimon(treeSelectedId);
  $('#dexZoomIn').onclick=()=>setDexScale(dexScale+DEX_SCALE_STEP);
  $('#dexZoomOut').onclick=()=>setDexScale(dexScale-DEX_SCALE_STEP);
  $('#dexZoomReset').onclick=()=>{dexScale=1;dexPanX=0;dexPanY=0;applyDexTransform();};
  bindDexPanZoom();
  requestAnimationFrame(()=>setTimeout(()=>{drawTreeLines();applyDexTransform();applyTreeSelection(treeSelectedId);},80));
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
fetch('data/v0.json').then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(d=>{DATA=d;const counts=new Map();for(const e of DATA.evolutions)counts.set(e.from,(counts.get(e.from)||0)+1);const maxRoutes=Math.max(1,...counts.values());document.documentElement.style.setProperty('--route-columns',String(maxRoutes));populateFilters();currentEvolutionId=DATA.digimon.slice().sort((a,b)=>a.dex_no-b.dex_no)[0]?.id||'';render();restoreHash();}).catch(err=>{$('#overviewView').innerHTML='<div class="load-error"><strong>資料載入失敗</strong><span>請確認 data/v0.json 已一併上傳。</span></div>';console.error(err);});
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
