import { CareerMatchEngine } from './career-match-engine.js?v=20260811-1';
import { getCareerMetaHub, getCareerTeamProfile, getCareerMatchContext, recordCareerMatchGameplay } from './career-meta-service.js?v=20260811-13';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
let engine=null;
let timer=null;
let currentHub=null;
let speed=1;
let mounted=false;

function injectCss(){
  if(document.querySelector('link[data-career-match-css]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='src/pages/career/career-match.css?v=20260811-1';link.dataset.careerMatchCss='1';document.head.appendChild(link);
}

function mount(){
  if(mounted)return;mounted=true;injectCss();
  document.body.insertAdjacentHTML('beforeend',`
  <div id="careerMatchOverlay" class="career-match-overlay hidden" aria-hidden="true">
    <section class="career-match-shell" role="dialog" aria-modal="true" aria-label="Partida">
      <div id="matchPregame" class="match-pregame"></div>
      <div id="matchGame" class="match-game hidden">
        <header class="match-scorebar">
          <div class="match-team match-team-home"><img id="matchHomeCrest" alt=""><div><strong id="matchHomeName">Seu time</strong><small id="matchHomeFormation">—</small></div></div>
          <div class="match-score-center"><span id="matchClock">0'</span><strong><b id="matchHomeScore">0</b><i>×</i><b id="matchAwayScore">0</b></strong><small id="matchPhase">1º tempo</small></div>
          <div class="match-team match-team-away"><div><strong id="matchAwayName">Adversário</strong><small id="matchAwayFormation">—</small></div><img id="matchAwayCrest" alt=""></div>
        </header>

        <div class="match-layout">
          <section class="match-left-rail">
            <article class="match-mini-card match-player-live">
              <span>SEU JOGO</span><strong id="matchPlayerRating">6,0</strong><small>Nota</small>
              <div class="match-energy"><em><b id="matchEnergyBar"></b></em><span id="matchEnergyText">Energia —</span></div>
            </article>
            <article class="match-mini-card"><span>INSTRUÇÃO</span><p id="matchInstruction">—</p></article>
            <article class="match-mini-card match-speed-card"><span>VELOCIDADE</span><div class="match-speed-buttons"><button data-match-speed="1" class="active">1×</button><button data-match-speed="2">2×</button><button data-match-speed="4">4×</button></div></article>
          </section>

          <section class="match-stage">
            <div id="matchPitch" class="match-pitch" aria-label="Campo de futebol animado">
              <div class="pitch-markings"><span class="pitch-half"></span><span class="pitch-circle"></span><span class="pitch-box pitch-box-left"></span><span class="pitch-box pitch-box-right"></span><span class="pitch-goal pitch-goal-left"></span><span class="pitch-goal pitch-goal-right"></span><span class="pitch-six pitch-six-left"></span><span class="pitch-six pitch-six-right"></span></div>
              <div id="matchPlayers"></div>
              <div id="matchBall" class="match-ball" aria-hidden="true"></div>
              <div id="matchActionPulse" class="match-action-pulse hidden"></div>
            </div>
            <div id="matchDecision" class="match-decision hidden"></div>
            <div id="matchIntermission" class="match-intermission hidden"></div>
          </section>

          <aside class="match-right-rail">
            <article class="match-stats-card"><header><span>ESTATÍSTICAS</span><small>ao vivo</small></header><div id="matchStats"></div></article>
            <article class="match-player-stats-card"><header><span>SUA PARTIDA</span></header><div id="matchPlayerStats"></div></article>
          </aside>
        </div>

        <section class="match-commentary-panel">
          <header><div><span class="match-live-dot"></span><strong>NARRAÇÃO AO VIVO</strong></div><small id="matchLastEvent">Bola rolando</small></header>
          <div id="matchCommentary" class="match-commentary"></div>
        </section>
      </div>
      <div id="matchPostgame" class="match-postgame hidden"></div>
    </section>
  </div>`);
  bindStatic();
}

function bindStatic(){
  document.querySelectorAll('[data-match-speed]').forEach(btn=>btn.addEventListener('click',()=>{speed=Number(btn.dataset.matchSpeed)||1;document.querySelectorAll('[data-match-speed]').forEach(b=>b.classList.toggle('active',b===btn));}));
}

function crestFor(name,explicit){
  if(explicit)return explicit;
  const map={
    'Academia Aurora Sub-18':'img/clubs/academia_aurora_sub_18.png','Atlético do Vale Sub-18':'img/clubs/atletico_do_vale_sub_18.png','Ferroviário Central Sub-18':'img/clubs/ferroviario_central_sub_18.png','Real Horizonte Sub-18':'img/clubs/real_horizonte_sub_18.png','União Litorânea Sub-18':'img/clubs/uniao_litoranea_sub_18.png',
    'Academia Aurora':'img/clubs/academia_aurora_sub_18.png','Atlético do Vale':'img/clubs/atletico_do_vale_sub_18.png','Ferroviário Central':'img/clubs/ferroviario_central_sub_18.png','Real Horizonte':'img/clubs/real_horizonte_sub_18.png','União Litorânea':'img/clubs/uniao_litoranea_sub_18.png'
  };return map[name]||'img/logo.png';
}

async function buildContext(){
  try{
    const ctx=await getCareerMatchContext();
    if(ctx)return ctx;
  }catch(error){console.warn('Contexto dedicado de partida indisponível; usando contexto do Career Hub.',error);}
  const [hub,team]=await Promise.all([getCareerMetaHub(),getCareerTeamProfile()]);
  const roster=(team?.roster||[]).filter(p=>p.availability_status!=='out');
  const opponentName=['Academia Aurora Sub-18','Atlético do Vale Sub-18','Ferroviário Central Sub-18','Real Horizonte Sub-18','União Litorânea Sub-18'].find(n=>n!==hub?.club?.name)||'Adversário';
  return {
    matchDate:hub?.state?.date,
    competition:hub?.state?.career_stage==='professional'?'Campeonato':'Liga de Base',
    club:{...hub?.club},
    player:{...hub?.player,skills:hub?.skills},
    state:{...hub?.state},
    selection:hub?.selection,
    home:{name:hub?.club?.name,formation:hub?.club?.formation,crest:hub?.club?.shield_url,players:roster},
    away:{name:opponentName,formation:'4-3-3',crest:crestFor(opponentName),players:[]},
    performance:hub?.gameplay_advice?.performance||hub?.performance||{}
  };
}

function renderMatchLock(hub){
  const lock=$('matchLock');if(!lock||!hub?.match_locked)return;
  lock.classList.remove('hidden');
  const existing=$('startCareerMatchBtn');if(existing)return;
  const copy=lock.querySelector('div');
  if(copy){
    const selection=hub.selection?.status;
    const status=selection==='starter'?'Você começa como titular.':selection==='bench'?'Você começa no banco e pode ser chamado.':selection==='out'?'Você não foi relacionado. Ainda pode acompanhar a partida.':'A escalação será confirmada ao entrar.';
    copy.querySelector('h2')?.replaceChildren(document.createTextNode('É dia de jogo.'));
    const p=copy.querySelector('p');if(p)p.textContent=status;
    const button=document.createElement('button');button.id='startCareerMatchBtn';button.className='primary-action career-match-launch';button.type='button';button.innerHTML='<i data-lucide="play"></i><span>Entrar na partida</span>';
    button.addEventListener('click',openPregame);copy.appendChild(button);
    window.lucide?.createIcons({strokeWidth:1.8});
  }
}

async function openPregame(){
  mount();const overlay=$('careerMatchOverlay');overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');document.body.classList.add('match-open');
  $('matchPregame').innerHTML='<div class="match-loading"><span></span><strong>Preparando vestiário e escalações...</strong></div>';
  $('matchPregame').classList.remove('hidden');$('matchGame').classList.add('hidden');$('matchPostgame').classList.add('hidden');
  try{const context=await buildContext();renderPregame(context);}catch(error){$('matchPregame').innerHTML=`<div class="match-error"><strong>Não foi possível preparar a partida.</strong><p>${esc(error.message||error)}</p><button id="closeMatchError">Voltar</button></div>`;$('closeMatchError')?.addEventListener('click',closeMatch);}
}

function renderPregame(ctx){
  const selection=ctx.selection?.status||'starter';
  const status=selection==='starter'?'TITULAR':selection==='bench'?'BANCO':'FORA DA LISTA';
  const player=ctx.player||{};const st=ctx.state||{};
  $('matchPregame').innerHTML=`
    <div class="pregame-hero">
      <div class="pregame-kicker">DIA DE JOGO · ${esc(ctx.competition||'Competição')}</div>
      <div class="pregame-versus">
        <div class="pregame-club"><img src="${esc(crestFor(ctx.home?.name,ctx.home?.crest))}" alt=""><strong>${esc(ctx.home?.name||ctx.club?.name)}</strong><small>${esc(ctx.home?.formation||ctx.club?.formation||'4-3-3')}</small></div>
        <div class="pregame-vs"><span>${esc(new Date(`${ctx.matchDate||st.date}T12:00:00`).toLocaleDateString('pt-BR'))}</span><b>×</b><em>${status}</em></div>
        <div class="pregame-club"><img src="${esc(crestFor(ctx.away?.name,ctx.away?.crest))}" alt=""><strong>${esc(ctx.away?.name||'Adversário')}</strong><small>${esc(ctx.away?.formation||'4-3-3')}</small></div>
      </div>
      <div class="pregame-panels">
        <article><span>VOCÊ</span><strong>${esc(player.nickname||player.name||'Jogador')} · ${esc(player.position||'—')}</strong><p>OVR ${esc(player.ovr||'—')} · Camisa ${esc(player.shirt_number||'—')}</p></article>
        <article><span>CONDIÇÃO</span><strong>Prontidão ${esc(st.readiness??'—')}</strong><p>Energia ${esc(st.energy??'—')} · Estafa ${esc(st.fatigue??'—')}</p></article>
        <article><span>COMISSÃO TÉCNICA</span><strong id="pregameInstruction">A instrução aparece ao entrar em campo.</strong><p>Seu comportamento será avaliado além de gols e assistências.</p></article>
      </div>
      <div class="pregame-note">A partida corre continuamente e para nos momentos em que seu jogador precisa decidir. Suas escolhas usam posição real no campo, atributos, preparação, adversário, desgaste, placar e contexto.</div>
      <div class="pregame-actions"><button id="closePregameBtn" class="match-secondary">Voltar</button><button id="beginMatchBtn" class="match-primary">${selection==='out'?'Acompanhar partida':'Entrar em campo'}</button></div>
    </div>`;
  $('closePregameBtn').addEventListener('click',closeMatch);$('beginMatchBtn').addEventListener('click',()=>beginMatch(ctx));
}

function beginMatch(ctx){
  engine=new CareerMatchEngine(ctx);wireEngine(engine,ctx);$('matchPregame').classList.add('hidden');$('matchGame').classList.remove('hidden');
  $('matchHomeName').textContent=engine.teamNames.home;$('matchAwayName').textContent=engine.teamNames.away;
  $('matchHomeFormation').textContent=ctx.home?.formation||ctx.club?.formation||'4-3-3';$('matchAwayFormation').textContent=ctx.away?.formation||'4-3-3';
  $('matchHomeCrest').src=crestFor(ctx.home?.name,ctx.home?.crest);$('matchAwayCrest').src=crestFor(ctx.away?.name,ctx.away?.crest);$('matchInstruction').textContent=engine.coachInstruction;
  renderFrame(engine.snapshot());engine.start();
  clearInterval(timer);timer=setInterval(()=>{if(!engine)return;engine.tick(.5*speed);},100);
}

function wireEngine(e,ctx){
  e.on('frame',renderFrame);e.on('state',renderFrame);e.on('commentary',appendCommentary);e.on('decision',showDecision);e.on('choice',showChoiceFeedback);
  e.on('halftime',showHalftime);e.on('sidechange',snap=>{flashPitch('2º TEMPO · LADOS INVERTIDOS');renderFrame(snap);});
  e.on('substitution',info=>showSubstitution(info));e.on('injury',info=>showInjury(info));e.on('final',result=>showPostgame(result,ctx));
}

function playerNode(p){
  let el=document.querySelector(`[data-match-player="${CSS.escape(String(p.id))}"]`);
  if(!el){el=document.createElement('div');el.dataset.matchPlayer=String(p.id);el.className=`match-piece ${p.team} ${p.isUser?'user':''}`;el.innerHTML='<span class="piece-ring"></span><b></b><small></small>'; $('matchPlayers').appendChild(el);}
  el.classList.toggle('off',!p.onField);el.classList.toggle('yellow',Boolean(p.yellow));el.classList.toggle('red',Boolean(p.red));el.style.left=`${p.x}%`;el.style.top=`${p.y}%`;el.querySelector('b').textContent=p.isUser?'★':String(p.number||'');el.querySelector('small').textContent=p.isUser?(p.name||'VOCÊ'):'';return el;
}

function renderFrame(s){
  if(!s)return;$('matchClock').textContent=`${Math.min(90,s.minute)}'`;$('matchHomeScore').textContent=s.score.home;$('matchAwayScore').textContent=s.score.away;
  $('matchPhase').textContent=s.phase==='second'?'2º tempo':s.phase==='halftime'?'Intervalo':s.phase==='final'?'Fim':'1º tempo';
  for(const p of [...s.home,...s.away])playerNode(p);
  const ball=$('matchBall');ball.style.left=`${s.ball.x}%`;ball.style.top=`${s.ball.y}%`;
  $('matchPlayerRating').textContent=Number(s.rating||6).toFixed(1).replace('.',',');$('matchEnergyText').textContent=s.userEnergy==null?'Fora de campo':`Energia ${Math.round(s.userEnergy)}%`;$('matchEnergyBar').style.width=`${Math.max(0,s.userEnergy??0)}%`;
  renderStats(s);renderPlayerStats();
}

function renderStats(s){
  const h=s.stats.home,a=s.stats.away;const row=(label,hv,av)=>`<div class="match-stat-row"><b>${hv}</b><span>${label}</span><b>${av}</b></div>`;
  $('matchStats').innerHTML=row('Posse',`${s.possession.home}%`,`${s.possession.away}%`)+row('Passes',`${h.passesCompleted}/${h.passesAttempted}`,`${a.passesCompleted}/${a.passesAttempted}`)+row('Finalizações',h.shots,a.shots)+row('No alvo',h.shotsOnTarget,a.shotsOnTarget)+row('Escanteios',h.corners,a.corners)+row('Faltas',h.fouls,a.fouls)+row('Amarelos',h.yellow,a.yellow);
}

function renderPlayerStats(){
  if(!engine)return;const p=engine.playerStats;const rate=p.passesAttempted?Math.round(p.passesCompleted/p.passesAttempted*100):0;
  $('matchPlayerStats').innerHTML=`<div><span>Gols</span><b>${p.goals}</b></div><div><span>Assist.</span><b>${p.assists}</b></div><div><span>Passes</span><b>${p.passesCompleted}/${p.passesAttempted}</b></div><div><span>Precisão</span><b>${rate}%</b></div><div><span>Dribles</span><b>${p.dribblesCompleted}/${p.dribblesAttempted}</b></div><div><span>Duelos</span><b>${p.duelsWon}G · ${p.duelsLost}P</b></div>`;
}

function appendCommentary(item){
  const box=$('matchCommentary');if(!box)return;const line=document.createElement('div');line.className=`commentary-line ${item.type||''}`;line.innerHTML=`<b>${item.minute}'</b><span>${esc(item.text)}</span>`;box.prepend(line);while(box.children.length>18)box.lastElementChild.remove();$('matchLastEvent').textContent=item.text;flashPitch(item.type==='goal'?'GOOOL!':item.type==='yellow'?'CARTÃO!':item.type==='sub'?'SUBSTITUIÇÃO':'');
}

function showDecision(data){
  const panel=$('matchDecision');panel.classList.remove('hidden');
  panel.innerHTML=`<div class="decision-minute">${data.minute}' · DECISÃO</div><h2>${esc(data.title)}</h2><p class="decision-context">${esc(data.instruction||'')}</p><div class="match-choice-grid">${data.options.map((o,i)=>`<button data-match-choice="${esc(o.key)}" class="${o.tags?.includes('special')?'special':''}"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(o.label)}</strong>${o.tags?.includes('special')?'<em>Leitura especial</em>':''}</button>`).join('')}</div><div class="decision-live"><span>Energia ${Math.round(data.energy??0)}%</span><span>Nota ${Number(data.rating||6).toFixed(1).replace('.',',')}</span></div>`;
  panel.querySelectorAll('[data-match-choice]').forEach(btn=>btn.addEventListener('click',()=>{panel.querySelectorAll('button').forEach(b=>b.disabled=true);engine.choose(btn.dataset.matchChoice);}));
}

function showChoiceFeedback(info){
  const panel=$('matchDecision');if(!panel)return;panel.classList.toggle('success',Boolean(info.success));panel.classList.toggle('fail',!info.success);
  if(!engine?.awaitingDecision){setTimeout(()=>{panel.className='match-decision hidden';panel.innerHTML='';},420);}
}

function showHalftime(s){
  const box=$('matchIntermission');box.classList.remove('hidden');box.innerHTML=`<div class="intermission-card"><span>INTERVALO</span><h2>${s.score.home} × ${s.score.away}</h2><p>As equipes trocam de lado. O posicionamento e as referências ofensivas serão invertidos.</p><button id="startSecondHalfBtn">Começar 2º tempo</button></div>`;$('startSecondHalfBtn').addEventListener('click',()=>{box.classList.add('hidden');engine.startSecondHalf();});
}

function showSubstitution(info){
  const box=$('matchIntermission');box.classList.remove('hidden');box.innerHTML=`<div class="intermission-card substitution"><span>${info.minute}' · O TREINADOR CHAMA VOCÊ</span><h2>Você vai entrar.</h2><p>${esc(info.instruction)}</p><strong>Sai ${esc(info.out?.name)} · entra ${esc(info.in?.name)}</strong><button id="enterMatchBtn">Entrar em campo</button></div>`;$('enterMatchBtn').addEventListener('click',()=>{box.classList.add('hidden');engine.resume();});
}

function showInjury(info){flashPitch(`${info.player} SENTIU!`);}
function flashPitch(text){if(!text)return;const el=$('matchActionPulse');el.textContent=text;el.classList.remove('hidden');requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.classList.add('hidden'),250);},900);}

async function showPostgame(result,ctx){
  clearInterval(timer);timer=null;$('matchGame').classList.add('hidden');const post=$('matchPostgame');post.classList.remove('hidden');
  const ps=result.playerStats;const resultLabel=result.score.home>result.score.away?'VITÓRIA':result.score.home===result.score.away?'EMPATE':'DERROTA';
  post.innerHTML=`<div class="postgame-head"><span>FIM DE JOGO · ${resultLabel}</span><h1>${esc(engine.teamNames.home)} <b>${result.score.home} × ${result.score.away}</b> ${esc(engine.teamNames.away)}</h1></div><div class="postgame-grid"><article><span>SUA NOTA</span><strong>${Number(result.rating).toFixed(1).replace('.',',')}</strong><p>${ps.minutes} min · ${ps.goals} gol(s) · ${ps.assists} assistência(s)</p></article><article><span>COM A BOLA</span><strong>${ps.passesCompleted}/${ps.passesAttempted} passes</strong><p>${ps.dribblesCompleted}/${ps.dribblesAttempted} dribles · ${ps.crosses} cruzamentos</p></article><article><span>SEM A BOLA</span><strong>${ps.duelsWon} duelos ganhos</strong><p>${ps.duelsLost} duelos perdidos</p></article></div><div id="postgameSave" class="postgame-save">Registrando a partida na carreira...</div><button id="finishMatchBtn" class="match-primary" disabled>Voltar para a carreira</button>`;
  try{
    await recordCareerMatchGameplay({opponent:engine.teamNames.away,competition:ctx.competition||'Competição',played:result.appeared,started:result.started,minutes:ps.minutes,goals:ps.goals,assists:ps.assists,rating:result.rating,teamGoals:result.score.home,opponentGoals:result.score.away,metadata:{live_stats:result.stats,player_stats:ps,commentary:result.commentary.slice(-30),possession:result.possession}});
    $('postgameSave').textContent='Partida registrada. Estatísticas, forma e histórico foram atualizados.';$('finishMatchBtn').disabled=false;
  }catch(error){console.error(error);$('postgameSave').textContent=`A partida terminou, mas o registro no banco falhou: ${error.message||error}`;$('finishMatchBtn').disabled=false;}
  $('finishMatchBtn').addEventListener('click',()=>{closeMatch();window.location.reload();});
}

function closeMatch(){clearInterval(timer);timer=null;engine=null;const overlay=$('careerMatchOverlay');overlay?.classList.add('hidden');overlay?.setAttribute('aria-hidden','true');document.body.classList.remove('match-open');}

document.addEventListener('career:hub-rendered',event=>{currentHub=event.detail;if(currentHub?.match_locked){mount();renderMatchLock(currentHub);}});

export function mountCareerMatchRuntime(){mount();if(currentHub?.match_locked)renderMatchLock(currentHub);}
