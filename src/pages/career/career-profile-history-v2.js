import { getCareerPlayerHistory } from './career-meta-service.js?v=20260811-6';

const esc = value => String(value ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');

function datePt(value){
  if(!value)return '—';
  const d=new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('pt-BR').format(d);
}

function ensureStyles(){
  if(document.getElementById('careerHistoryV2Styles'))return;
  const style=document.createElement('style');
  style.id='careerHistoryV2Styles';
  style.textContent=`
    .history-stage-stack{display:grid;gap:14px}.history-stage{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:rgba(127,127,127,.02)}
    .history-stage-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:linear-gradient(90deg,rgba(56,201,31,.07),transparent)}
    .history-stage-head div{display:flex;align-items:center;gap:9px}.history-stage-head svg{width:18px;color:var(--green-2)}.history-stage-head h3{font-size:13px}.history-stage-head span{font-size:8px;color:var(--muted);font-weight:900;text-transform:uppercase}
    .history-stage-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}.history-subcard{padding:12px;border:1px solid var(--line);border-radius:11px;background:rgba(127,127,127,.018)}
    .history-subcard h4{font-size:10px;display:flex;align-items:center;gap:7px}.history-subcard h4 svg{width:14px;color:var(--green-2)}.history-mini-list{display:grid;gap:7px;margin-top:9px}
    .history-mini-item{display:grid;grid-template-columns:32px 1fr auto;gap:8px;align-items:center;padding:8px;border-radius:9px;background:rgba(127,127,127,.035)}.history-mini-item>span{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:rgba(56,201,31,.08);color:var(--green-2)}.history-mini-item strong{display:block;font-size:9px}.history-mini-item small{display:block;color:var(--muted);font-size:7px;margin-top:2px}.history-mini-item em{font-style:normal;color:var(--muted);font-size:7px}
    .season-history{display:grid;gap:8px;margin-top:10px}.season-row{display:grid;grid-template-columns:auto 1fr repeat(3,auto);gap:10px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:10px}.season-row>strong{font-size:12px;color:var(--green-2)}.season-row div strong{display:block;font-size:9px;color:var(--text)}.season-row div span{display:block;font-size:7px;color:var(--muted);margin-top:2px}.season-row>span{text-align:center;font-size:7px;color:var(--muted)}.season-row>span b{display:block;color:var(--text);font-size:11px}.history-callups{display:grid;gap:7px;margin-top:9px}.history-callup{padding:9px 10px;border-left:3px solid var(--green-2);background:rgba(56,201,31,.04);border-radius:0 9px 9px 0}.history-callup strong{font-size:9px}.history-callup span{display:block;margin-top:2px;color:var(--muted);font-size:7px}.history-empty{padding:13px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:8px;text-align:center}
    @media(max-width:720px){.history-stage-body{grid-template-columns:1fr}.season-row{grid-template-columns:auto 1fr repeat(2,auto)}.season-row>span:last-child{display:none}}
  `;
  document.head.appendChild(style);
}

function honoursOf(history,stage,type){
  return (history.honours||[]).filter(h=>h.career_stage===stage&&h.honour_type===type);
}

function listHonours(items,icon){
  if(!items.length)return '<div class="history-empty">Nenhuma conquista registrada ainda.</div>';
  return `<div class="history-mini-list">${items.map(item=>`<div class="history-mini-item"><span><i data-lucide="${icon}"></i></span><div><strong>${esc(item.title)}</strong><small>${esc(item.competition||item.club_name||'')}</small></div><em>${esc(item.season_label||datePt(item.awarded_on))}</em></div>`).join('')}</div>`;
}

function stageBlock(history,stage,title,icon,subtitle){
  const titles=honoursOf(history,stage,'team_title');
  const awards=honoursOf(history,stage,'individual_award');
  return `<section class="history-stage"><header class="history-stage-head"><div><i data-lucide="${icon}"></i><h3>${esc(title)}</h3></div><span>${esc(subtitle)}</span></header><div class="history-stage-body"><article class="history-subcard"><h4><i data-lucide="trophy"></i>Títulos</h4>${listHonours(titles,'trophy')}</article><article class="history-subcard"><h4><i data-lucide="medal"></i>Prêmios individuais</h4>${listHonours(awards,'medal')}</article></div></section>`;
}

function seasons(history){
  const rows=history.seasons||[];
  if(!rows.length)return '<div class="history-empty">A temporada ainda não possui partidas registradas.</div>';
  return `<div class="season-history">${rows.map(row=>`<div class="season-row"><strong>${esc(row.season_label||'—')}</strong><div><strong>${esc(row.club_name||(row.context==='national_team'?'Seleção':'Clube'))}</strong><span>${row.career_stage==='academy'?'Base':row.career_stage==='professional'?'Profissional':`Seleção ${String(row.level||'').toUpperCase()}`}</span></div><span><b>${Number(row.games||0)}</b>Jogos</span><span><b>${Number(row.goals||0)}</b>Gols</span><span><b>${Number(row.assists||0)}</b>Assist.</span></div>`).join('')}</div>`;
}

function callups(history){
  const rows=history.callups||[];
  if(!rows.length)return '<div class="history-empty">Ainda não houve convocação para seleção.</div>';
  return `<div class="history-callups">${rows.map(row=>`<div class="history-callup"><strong>Seleção ${esc(String(row.level||'').toUpperCase())}</strong><span>${esc(row.competition||row.reason||'Convocação')} · ${datePt(row.callup_date)}</span></div>`).join('')}</div>`;
}

async function renderRichHistory(){
  const active=document.querySelector('#playerProfileContent [data-player-tab="history"].active');
  const host=document.querySelector('#playerProfileContent .meta-tab-content');
  if(!active||!host)return false;
  const history=await getCareerPlayerHistory();
  if(!history)return false;
  if(!document.querySelector('#playerProfileContent [data-player-tab="history"].active'))return false;
  host.innerHTML=`<div class="history-stage-stack">
    ${stageBlock(history,'academy','Base','shield','histórico preservado')}
    ${stageBlock(history,'professional','Profissional','badge-check','carreira principal')}
    ${stageBlock(history,'national','Seleções','flag','Sub-15 · Sub-17 · Sub-20 · Principal')}
    <section class="meta-card"><h3><i data-lucide="history"></i>Temporadas e clubes</h3>${seasons(history)}</section>
    <section class="meta-card"><h3><i data-lucide="flag"></i>Convocações</h3>${callups(history)}</section>
  </div>`;
  if(window.lucide)window.lucide.createIcons({strokeWidth:1.8});
  return true;
}

function renderWhenHistoryReady(attempt=0){
  if(attempt>30)return;
  const active=document.querySelector('#playerProfileContent [data-player-tab="history"].active');
  if(!active){setTimeout(()=>renderWhenHistoryReady(attempt+1),50);return;}
  renderRichHistory().catch(error=>console.error('Falha no histórico rico:',error));
}

ensureStyles();
document.addEventListener('click',event=>{
  if(!event.target.closest('[data-player-tab="history"]'))return;
  setTimeout(()=>renderWhenHistoryReady(),0);
});
