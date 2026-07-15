const ACTIVE_VERSION=(new URLSearchParams(location.search).get('version')||'v0').toLowerCase();
const VERSION_LABELS={v0:'V0 病毒剋星',v1:'V1 自然靈魂'};
const stageOrder=['幼年期1','幼年期2','成長期','成熟期','完全體','究極體','超究極體'];
let DATA=null, query='', currentView='overview', stageFilter='', attributeFilter='';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const padNo=n=>String(n).padStart(3,'0');
const byName=name=>DATA?.digimon.find(d=>d.name_zh===name);

const TIMER_STORAGE_KEY=`dmvault-penc-${ACTIVE_VERSION}-timers-v2`;
const RAISED_STORAGE_KEY=`dmvault-penc-${ACTIVE_VERSION}-raised`;
let timerTickHandle=null;
function loadTimers(){try{return JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY)||'{}')}catch{return {}}}
function saveTimers(v){localStorage.setItem(TIMER_STORAGE_KEY,JSON.stringify(v));}
function loadRaised(){try{return new Set(JSON.parse(localStorage.getItem(RAISED_STORAGE_KEY)||'[]'))}catch{return new Set()}}
function saveRaised(set){localStorage.setItem(RAISED_STORAGE_KEY,JSON.stringify([...set]));}
function isRaised(id){return loadRaised().has(id)}
function toggleRaised(id){const set=loadRaised();set.has(id)?set.delete(id):set.add(id);saveRaised(set);render();}
function parseDurationMs(text){
  const value=String(text||'').trim();
  let m=value.match(/^(\d+(?:\.\d+)?)\s*小時$/);if(m)return Number(m[1])*60*60*1000;
  m=value.match(/^(\d+(?:\.\d+)?)\s*分鐘$/);if(m)return Number(m[1])*60*1000;
  return 0;
}
function timerKey(e){return `${ACTIVE_VERSION}:${e.id||`${e.from}>${e.to}:${e.target_column||''}`}`;}
function normalizeTimer(state){
  if(!state)return null;
  if(state.endAt&&!state.status)return {status:'running',endAt:state.endAt,duration:Math.max(0,state.endAt-Date.now())};
  return state;
}
function timerState(e){return normalizeTimer(loadTimers()[timerKey(e)]||null);}
function timerRemaining(state){
  if(!state)return 0;
  if(state.status==='running')return Math.max(0,Number(state.endAt)-Date.now());
  return Math.max(0,Number(state.remainingMs)||0);
}
function formatRemaining(ms){
  if(ms<=0)return '可進化';
  const total=Math.ceil(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function timerStatusInfo(state){
  if(!state)return {key:'idle',label:'未開始'};
  const remaining=timerRemaining(state);
  if(remaining<=0||state.status==='done')return {key:'done',label:'可進化'};
  if(state.status==='frozen'||state.status==='paused')return {key:'frozen',label:'已冷凍'};
  return {key:'running',label:'培養中'};
}
function evolutionByTimerKey(key){
  return DATA?.evolutions.find(e=>timerKey(e)===key)||null;
}
function activeCultivations(){
  const timers=loadTimers(), rows=[];
  for(const [key,raw] of Object.entries(timers)){
    const state=normalizeTimer(raw),e=evolutionByTimerKey(key);if(!state||!e)continue;
    const info=timerStatusInfo(state);if(info.key==='idle')continue;
    rows.push({key,state,e,info,remaining:timerRemaining(state)});
  }
  return rows.sort((a,b)=>{
    const order={done:0,running:1,frozen:2};
    return (order[a.info.key]??9)-(order[b.info.key]??9)||a.remaining-b.remaining;
  });
}
function timerMarkup(e,isJogress){
  const duration=parseDurationMs(e.time);
  if(isJogress||!duration)return '';
  const key=timerKey(e),state=timerState(e);
  if(!state)return `<div class="route-timer" data-timer-key="${esc(key)}"><button class="timer-start" type="button" data-timer-start="${esc(key)}" data-duration="${duration}">開始培養</button></div>`;
  const remaining=timerRemaining(state),done=remaining<=0||state.status==='done';
  if(done)return `<div class="route-timer timer-done" data-timer-key="${esc(key)}"><span class="timer-status">可進化</span><strong class="timer-countdown">完成</strong><button class="timer-reset" type="button" data-timer-reset="${esc(key)}">重新開始</button></div>`;
  // v0.27: 暫停與冷凍合併為同一個操作。舊版 paused 狀態視同 frozen。
  const frozen=state.status==='frozen'||state.status==='paused';
  const label=frozen?'已冷凍':'培養中';
  const cls=frozen?'timer-frozen':'timer-running';
  const mainAction=state.status==='running'
    ?`<button type="button" data-timer-freeze="${esc(key)}">冷凍</button>`
    :`<button type="button" data-timer-resume="${esc(key)}">解除冷凍</button>`;
  const endAttr=state.status==='running'?`data-timer-end="${state.endAt}"`:'';
  return `<div class="route-timer ${cls}" data-timer-key="${esc(key)}"><span class="timer-status">${label}</span><strong class="timer-countdown" ${endAttr}>${formatRemaining(remaining)}</strong><div class="timer-actions">${mainAction}<button class="timer-reset" type="button" data-timer-reset="${esc(key)}">重設</button></div></div>`;
}
function updateTimer(key,fn){const timers=loadTimers(),state=normalizeTimer(timers[key]);timers[key]=fn(state);if(timers[key])saveTimers(timers);else{delete timers[key];saveTimers(timers)}renderEvolution();renderOverview();}
function pauseTimer(key,status='paused'){updateTimer(key,state=>state?{...state,status,remainingMs:timerRemaining(state),endAt:null}:state)}
function resumeTimer(key){updateTimer(key,state=>state?{...state,status:'running',endAt:Date.now()+timerRemaining(state)}:state)}
function bindEvolutionTimers(){
  $$('[data-timer-start]').forEach(b=>b.onclick=()=>{const timers=loadTimers();timers[b.dataset.timerStart]={status:'running',endAt:Date.now()+Number(b.dataset.duration),duration:Number(b.dataset.duration)};saveTimers(timers);renderEvolution();renderOverview();});
  $$('[data-timer-freeze]').forEach(b=>b.onclick=()=>pauseTimer(b.dataset.timerFreeze,'frozen'));
  $$('[data-timer-resume]').forEach(b=>b.onclick=()=>resumeTimer(b.dataset.timerResume));
  $$('[data-timer-reset]').forEach(b=>b.onclick=()=>{const timers=loadTimers();delete timers[b.dataset.timerReset];saveTimers(timers);renderEvolution();renderOverview();});
  clearInterval(timerTickHandle);
  timerTickHandle=setInterval(()=>{
    let needsRender=false;
    $$('[data-timer-end]').forEach(el=>{const left=Number(el.dataset.timerEnd)-Date.now();el.textContent=formatRemaining(left);if(left<=0)needsRender=true;});
    if(needsRender){const timers=loadTimers();for(const [k,v0] of Object.entries(timers)){const v=normalizeTimer(v0);if(v?.status==='running'&&timerRemaining(v)<=0)timers[k]={...v,status:'done',remainingMs:0,endAt:null};}saveTimers(timers);renderEvolution();renderOverview();}
  },1000);
}
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
  try{if(navigator.share){await navigator.share({title:`${d.name_zh}｜DMVault Pendulum COLOR ${DATA?.meta?.version||ACTIVE_VERSION.toUpperCase()}`,url:url.href});return;}await navigator.clipboard.writeText(url.href);showToast('已複製網址');}
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
    <div class="source-title-zh"><span>${esc(d.name_zh)}</span><span class="stage-pill stage-${esc(d.stage)}">${esc(d.stage)}</span></div>
    <div class="source-title-jp">${esc(d.name_jp)}</div>
    <div class="source-body">
      <div class="source-side">
        ${sprite(d,'source-sprite')}
        <button class="raised-corner-button ${isRaised(d.id)?'is-raised':''}" type="button" data-raised-action="${d.id}" aria-pressed="${isRaised(d.id)?'true':'false'}" title="${isRaised(d.id)?'取消已養過':'標記已養過'}">✓</button><span class="stage-tag">${esc(d.stage)}</span>
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
  const extra=noteParts.map(part=>`<div class="jogress-note-row">${esc(part)}</div>`).join('');
  const noteText=noteParts.join(' ');
  const isJogress=!fields.some(([,v])=>String(v||'').trim()&&String(v).trim()!=='-') && /(幼年期|成長期|成熟期|完全體|究極體|超究極體)的/.test(noteText) && /(疫苗種|資料種|病毒種|自由種)/.test(noteText);
  const noteClass=noteText.includes('解鎖圖鑑6 前')?'unlock-before':noteText.includes('解鎖圖鑑6 後')?'unlock-after':noteParts.length?'jogress-note':'';
  return `<div class="route-column ${isJogress?'route-column-jogress':''}">
    <button class="route-head ${target?'route-link':''}" ${target?`data-target="${target.id}"`:''} type="button">
      ${target?sprite(target,'route-sprite'):''}
      ${target?`<span class="route-raised-toggle ${isRaised(target.id)?'is-raised':''}" data-raised-action="${target.id}" role="button" tabindex="0" aria-pressed="${isRaised(target.id)?'true':'false'}" title="${isRaised(target.id)?'取消已養過':'標記已養過'}">✓</span>`:''}
      <strong>${esc(e.to)}</strong>${target?`<span class="route-stage">${esc(target.stage)}</span>`:''}
    </button>
    ${isJogress
      ? `<div class="jogress-condition"><img src="images/ui/jogres.png" alt="JOGRES"></div>`
      : `<div class="route-fields">${fields.map(([k,v])=>`<div class="route-label">${k}</div><div class="route-value ${(!v||v==='-')?'muted':''}">${esc(v||'-')}</div>`).join('')}</div>`}
    <div class="route-note ${noteClass}">${extra||'&nbsp;'}</div>
    ${timerMarkup(e,isJogress)}
  </div>`;
}
function renderOverview(){
  const visible=filteredDigimon();
  const raised=loadRaised();
  const active=activeCultivations();
  const cultivationRows=active.length?active.map(item=>{
    const target=byName(item.e.to),source=byName(item.e.from);
    const countdown=item.info.key==='done'?'可進化':formatRemaining(item.remaining);
    return `<button class="cultivation-item status-${item.info.key}" type="button" data-cultivation-target="${target?.id||''}">
      <span class="cultivation-state">${item.info.label}</span>
      <strong>${esc(item.e.to)}</strong>
      <small>${esc(item.e.from)} → ${esc(item.e.to)}</small>
      <span class="cultivation-time">${countdown}</span>
    </button>`;
  }).join(''):'<div class="cultivation-empty">目前沒有培養中的進化計時。</div>';
  $('#overviewView').innerHTML=`
    <div class="overview-grid">
      <article class="stat-card"><strong>${visible.length}</strong><span>數碼獸</span></article>
      <article class="stat-card"><strong>${DATA.evolutions.filter(e=>visible.some(d=>d.name_zh===e.from)).length}</strong><span>進化條件</span></article>
      <article class="stat-card"><strong>${raised.size} / ${DATA.digimon.length}</strong><span>已養過</span></article>
    </div>
    <section class="overview-section cultivation-overview"><div class="overview-title-row"><h2>目前培養</h2><span>${active.length} 項</span></div><div class="cultivation-list">${cultivationRows}</div></section>
    <section class="overview-section"><h2>依階段瀏覽</h2><div class="overview-stages">${stageOrder.map(stage=>{const count=visible.filter(d=>d.stage===stage).length;return count?`<button class="overview-stage" data-stage="${stage}"><strong>${stage}</strong><span>${count} 隻 →</span></button>`:''}).join('')}</div></section>`;
  $$('#overviewView .overview-stage').forEach(b=>b.onclick=()=>{stageFilter=b.dataset.stage;$('#stageFilter').value=stageFilter;render();switchView('evolution');});
  $$('[data-cultivation-target]').forEach(b=>b.onclick=()=>b.dataset.cultivationTarget&&jumpToDigimon(b.dataset.cultivationTarget));
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
  bindEvolutionTimers();
  $$('[data-raised-action]').forEach(el=>{
    const activate=ev=>{ev.preventDefault();ev.stopPropagation();toggleRaised(el.dataset.raisedAction)};
    el.onclick=activate;
    el.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){activate(ev)}};
  });
  renderStageNav();
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
  });
  viewport.addEventListener('pointermove',e=>{
    if(!pointerActive||e.pointerId!==pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(!dragging&&Math.hypot(dx,dy)>=DRAG_THRESHOLD){dragging=true;suppressClick=true;viewport.classList.add('dragging');try{viewport.setPointerCapture(e.pointerId)}catch{}}
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
  viewport.addEventListener('click',e=>{
    if(suppressClick){e.preventDefault();e.stopPropagation();return;}
    const node=e.target.closest('.dex-map-node');
    if(node){e.preventDefault();jumpToDigimon(node.dataset.id);}
  });
  viewport.addEventListener('dblclick',e=>{if(!suppressClick)return;e.preventDefault();e.stopPropagation();},true);
  viewport.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();const r=viewport.getBoundingClientRect();setDexScale(dexScale+(e.deltaY<0?DEX_SCALE_STEP:-DEX_SCALE_STEP),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
}
function renderDex(){
  const list=filteredDigimon();
  if(!list.length){$('#dexView').innerHTML='<div class="empty">找不到符合項目</div>';return;}
  const positions=stageLayout(list);
  const nodes=list.map(d=>{const p=positions.get(d.id);const raised=isRaised(d.id);return `<button class="dex-map-node attr-${esc(d.attribute)} ${raised?'raised':''}" data-id="${d.id}" type="button" style="--x:${p.x};--y:${p.y}" title="#${padNo(d.dex_no)} ${esc(d.name_zh)}｜點一下前往進化條件">${sprite(d,'dex-map-sprite')}<span>${esc(d.name_zh)}</span>${raised?'<span class="raised-mark">✓</span>':''}</button>`;}).join('');
  const stageLabels=stageOrder.map((stage,i)=>list.some(d=>d.stage===stage)?`<span class="dex-stage-label" style="--x:${i*(100/Math.max(1,stageOrder.length-1))}">${stage}</span>`:'').join('');
  $('#dexView').innerHTML=`<section class="dex-map-shell ${dexWireMode}">
    <div class="dex-tree-toolbar"><strong>進化技能樹</strong><div class="wire-switch" role="group" aria-label="圖鑑顯示模式"><button class="${dexWireMode==='wireless'?'active':''}" data-wire="wireless" type="button">無線</button><button class="${dexWireMode==='wired'?'active':''}" data-wire="wired" type="button">有線</button></div>
      <div class="tree-actions"><button id="dexZoomOut" type="button" aria-label="縮小">−</button><output id="dexZoomValue">${Math.round(dexScale*100)}%</output><button id="dexZoomIn" type="button" aria-label="放大">＋</button><button id="dexZoomReset" type="button">重設視圖</button><button id="treeClear" type="button" ${treeSelectedId?'':'disabled'}>清除高亮</button><button id="treeGoEvolution" type="button" ${treeSelectedId?'':'disabled'}>查看進化條件</button></div>
      <span id="treeSelection" class="dex-tree-hint">${treeSelectedId?(DATA.digimon.find(d=>d.id===treeSelectedId)?.name_zh+'：已高亮完整前後路線'):'滑過可預覽路線；點一下圖片前往進化條件'}</span></div>
    <div class="dex-map-viewport"><div id="dexMapCanvas" class="dex-map-canvas"><div id="dexTreeBoard" class="dex-map-board"><div class="dex-stage-labels">${stageLabels}</div><svg id="dexTreeLines" class="dex-tree-lines" aria-hidden="true"></svg>${nodes}</div></div></div>
  </section>`;
  $$('[data-wire]').forEach(b=>b.onclick=()=>{dexWireMode=b.dataset.wire;renderDex();});
  $$('.dex-map-node').forEach(n=>{
    n.ondblclick=null;
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

function searchSuggestionItems(){
  const raw=$('#searchInput')?.value.trim().toLowerCase()||'';
  if(!raw)return [];
  return DATA.digimon.filter(d=>haystack(d).includes(raw)).slice(0,8);
}
function renderSearchSuggestions(){
  const box=$('#searchSuggestions');if(!box||!DATA)return;
  const items=searchSuggestionItems();
  if(!$('#searchInput').value.trim()||!items.length){box.classList.add('hidden');box.innerHTML='';return;}
  box.innerHTML=items.map(d=>`<button type="button" role="option" data-search-target="${d.id}">${sprite(d,'suggestion-sprite')}<span><strong>${esc(d.name_zh)}</strong><small>#${padNo(d.dex_no)}｜${esc(d.stage)}｜${esc(d.attribute)}</small></span></button>`).join('');
  box.classList.remove('hidden');
  $$('[data-search-target]').forEach(b=>b.onclick=()=>{box.classList.add('hidden');jumpToDigimon(b.dataset.searchTarget);});
}
function updateSummary(){
  const visible=filteredDigimon().length,parts=[];
  if(query)parts.push(`搜尋「${$('#searchInput').value.trim()}」`);if(stageFilter)parts.push(stageFilter);if(attributeFilter)parts.push(attributeFilter);
  $('#summary').textContent=parts.length?`${parts.join('／')}：${visible} 隻`:`${DATA.meta?.version||ACTIVE_VERSION.toUpperCase()} ${DATA.meta?.version_name||''}｜${DATA.digimon.length} 隻數碼獸${DATA.evolutions.length?`／${DATA.evolutions.length} 組進化條件`:'／進化條件待加入'}`;
}
function render(){renderOverview();renderEvolution();renderDex();updateSummary();renderSearchSuggestions();}
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
fetch(`data/${ACTIVE_VERSION}.json`).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(d=>{DATA=d;document.title=`DMVault｜Pendulum COLOR ${DATA.meta?.version||ACTIVE_VERSION.toUpperCase()} ${DATA.meta?.version_name||''}`;document.querySelectorAll('.version[data-version]').forEach(b=>{const active=b.dataset.version===ACTIVE_VERSION;b.classList.toggle('active',active);b.toggleAttribute('aria-current',active);});const counts=new Map();for(const e of DATA.evolutions)counts.set(e.from,(counts.get(e.from)||0)+1);const maxRoutes=Math.max(1,...counts.values());document.documentElement.style.setProperty('--route-columns',String(maxRoutes));populateFilters();render();restoreHash();}).catch(err=>{$('#overviewView').innerHTML=`<div class="load-error"><strong>資料載入失敗</strong><span>請確認 data/${ACTIVE_VERSION}.json 已一併上傳。</span></div>`;console.error(err);});
$$('.tab').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#searchInput').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();renderSearchSuggestions();});
$('#searchInput').addEventListener('focus',renderSearchSuggestions);
document.addEventListener('click',e=>{if(!e.target.closest('.search-box'))$('#searchSuggestions')?.classList.add('hidden');});
$('#clearSearch').onclick=()=>{$('#searchInput').value='';query='';render();$('#searchSuggestions').classList.add('hidden');$('#searchInput').focus();};
$('#stageFilter').onchange=e=>{stageFilter=e.target.value;render();};
$('#attributeFilter').onchange=e=>{attributeFilter=e.target.value;render();};
$('#resetFilters').onclick=()=>{$('#searchInput').value='';$('#stageFilter').value='';$('#attributeFilter').value='';query=stageFilter=attributeFilter='';render();};
$('#expandAll').style.display='none';$('#collapseAll').style.display='none';
$('#backToTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
addEventListener('scroll',()=>$('#backToTop').classList.toggle('show',scrollY>500),{passive:true});
addEventListener('hashchange',()=>DATA&&restoreHash());

let treeResizeTimer;addEventListener('resize',()=>{clearTimeout(treeResizeTimer);treeResizeTimer=setTimeout(drawTreeLines,120);});

$$('.version[data-version]').forEach(b=>b.onclick=()=>{const u=new URL(location.href);u.searchParams.set('version',b.dataset.version);u.hash=currentView==='dex'?'view=dex':'view=overview';location.href=u.href;});
