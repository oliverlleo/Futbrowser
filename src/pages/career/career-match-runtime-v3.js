import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';
import {
  getCareerMetaHub,
  getCareerTeamProfile,
  getCareerMatchContext,
  recordCareerMatchGameplay,
  reconcileCareerMatchProgression
} from './career-meta-service.js?v=20260811-14';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

let engine=null;
let timer=null;
let currentHub=null;
let speed=1;
let mounted=false;
let lastBall=null;
let fastForwarding=false;
let savingResult=false;

function injectCss(){
  const sheets=[
    ['base','src/pages/career/career-match.css?v=20260811-1'],
    ['fx','src/pages/career/career-match-effects.css?v=20260811-1'],
    ['v3','src/pages/career/career-match-runtime-v3.css?v=20260811-1']
  ];
  for(const[key,href]of sheets){
    if(document.querySelector(`link[data-career-match-css="${key}"]`))continue;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=href;link.dataset.careerMatchCss=key;
    document.head.appendChild(link);
  }
}

function mount(){
  if(mounted)return;
  mounted=true;
  injectCss();
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
              <article id="matchDirectOpponentCard" class="match-mini-card"><span>DUELO DIRETO</span><p id="matchDirectOpponent">—</p><small id="matchDuelScore">0 × 0</small></article>
              <article class="match-mini-card match-speed-card">
                <span>VELOCIDADE</span>
                <div class="match-speed-buttons">
                  <button type="button" data-match-speed="1" class="active">1×</button>
                  <button type="button" data-match-speed="2">2×</button>
                  <button type="button" data-match-speed="4">4×</button>
                </div>
                <small id="matchSpeedState">1× · normal</small>
              </article>
            </section>

            <section class="match-stage">
              <div id="matchPitch" class="match-pitch" aria-label="Campo de futebol animado">
                <div class="pitch-markings"><span class="pitch-half"></span><span class="pitch-circle"></span><span class="pitch-box pitch-box-left"></span><span class="pitch-box pitch-box-right"></span><span class="pitch-goal pitch-goal-left"></span><span class="pitch-goal pitch-goal-right"></span><span class="pitch-six pitch-six-left"></span><span class="pitch-six pitch-six-right"></span></div>
                <div id="matchPassLayer" class="match-pass-layer"></div>
                <div id="matchPlayers"></div>
                <div id="matchBall" class="match-ball" aria-hidden="true"></div>
                <div id="matchActionPulse" class="match-action-pulse hidden"></div>
              </div>
              <div id="matchDecision" class="match-decision hidden"></div>
              <div id="matchChoiceFeedback" class="match-choice-feedback hidden" aria-live="polite"></div>
              <div id="matchIntermission" class="match-intermission hidden"></div>
            </section>

            <aside class="match-right-rail">
              <article class="match-stats-card"><header><span>ESTATÍSTICAS</span><small>ao vivo</small></header><div id="matchStats"></div></article>
              <article class="match-player-stats-card"><header><span>SUA PARTIDA</span></header><div id="matchPlayerStats"></div></article>
              <article class="match-mini-card"><span>LEITURA TÁTICA</span><p id="matchTacticalState">Equipes estudando o jogo.</p></article>
            </aside>
          </div>

          <section class="match-commentary-panel match-commentary-v3">
            <header><div><span class="match-live-dot"></span><strong>NARRAÇÃO AO VIVO</strong></div><small id="matchLastEvent">Bola rolando</small></header>
            <div id="matchCommentary" class="match-commentary"></div>
          </section>
        </div>
        <div id="matchPostgame" class="match-postgame hidden"></div>
      </section>
    </div>`);

  const overlay=$('careerMatchOverlay');
  overlay.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-match-speed]');
    if(!button)return;
    setSpeed(Number(button.dataset.matchSpeed)||1);
  });
}

function setSpeed(value){
  speed=[1,2,4].includes(value)?value:1;
  document.querySelectorAll('[data-match-speed]').forEach(button=>button.classList.toggle('active',Number(button.dataset.matchSpeed)===speed));
  const label=$('matchSpeedState');
  if(label)label.textContent=speed===1?'1× · normal':speed===2?'2× · acelerado':'4× · muito rápido';
}

function startLoop(){
  clearInterval(timer);
  timer=setInterval(()=>{
    if(!engine||fastForwarding)return;
    // Multiple fixed simulation steps make 2× and 4× visibly faster while
    // keeping onMinute(), decisions and movement deterministic.
    for(let step=0;step<speed;step++){
      if(!engine||engine.paused||engine.phase==='final')break;
      engine.tick(.5);
    }
  },100);
}

function crestFor(name,explicit){
  if(explicit)return explicit;
  const map={
    'Academia Aurora Sub-18':'img/clubs/academia_aurora_sub_18.png','Atlético do Vale Sub-18':'img/clubs/atletico_do_vale_sub_18.png','Ferroviário Central Sub-18':'img/clubs/ferroviario_central_sub_18.png','Real Horizonte Sub-18':'img/clubs/real_horizonte_sub_18.png','União Litorânea Sub-18':'img/clubs/uniao_litoranea_sub_18.png',
    'Academia Aurora':'img/clubs/academia_aurora_sub_18.png','Atlético do Vale':'img/clubs/atletico_do_vale_sub_18.png','Ferroviário Central':'img/clubs/ferroviario_central_sub_18.png','Real Horizonte':'img/clubs/real_horizonte_sub_18.png','União Litorânea':'img/clubs/uniao_litoranea_sub_18.png'
  };
  return map[name]||'img/logo.png';
}

async function buildContext(){
  try{
    const ctx=await getCareerMatchContext();
    if(ctx)return ctx;
  }catch(error){
    console.warn('Contexto dedicado de partida indisponível; usando contexto do Career Hub.',error);
  }

  const[hub,team]=await Promise.all([getCareerMetaHub(),getCareerTeamProfile()]);
  const roster=(team?.roster||[]).filter(player=>player.availability_status!=='out');
  const names=['Academia Aurora Sub-18','Atlético do Vale Sub-18','Ferroviário Central Sub-18','Real Horizonte Sub-18','União Litorânea Sub-18'];
  const opponentName=names.find(name=>name!==hub?.club?.name)||'Adversário';
  return{
    matchDate:hub?.state?.date,
    competition:hub?.state?.career_stage==='professional'?'Campeonato Profissional':'Liga de Base',
    club:{...hub?.club},player:{...hub?.player,skills:hub?.skills},state:{...hub?.state},selection:hub?.selection,
    home:{name:hub?.club?.name,formation:hub?.club?.formation,crest:hub?.club?.shield_url,players:roster},
    away:{name:opponentName,formation:'4-3-3',crest:crestFor(opponentName),players:[]},
    performance:hub?.gameplay_advice?.performance||hub?.performance||{}
  };
}

function placeMatchLock(){
  const lock=$('matchLock');
  const center=document.querySelector('.activity-column');
  if(!lock||!center)return;
  if(lock.parentElement!==center)center.prepend(lock);
  lock.classList.add('match-lock-centered');
}

function renderMatchLock(hub){
  const lock=$('matchLock');
  if(!lock||!hub?.match_locked)return;
  placeMatchLock();
  lock.classList.remove('hidden');
  if($('startCareerMatchBtn'))return;
  const copy=lock.querySelector('div');
  if(!copy)return;
  const selection=hub.selection?.status;
  const status=selection==='starter'?'Você começa como titular.':selection==='bench'?'Você começa no banco e pode ser chamado.':selection==='out'?'Você não foi relacionado. A partida será resolvida sem participação em campo.':'A escalação será confirmada ao entrar.';
  copy.querySelector('h2')?.replaceChildren(document.createTextNode('É dia de jogo.'));
  const p=copy.querySelector('p');if(p)p.textContent=status;
  const button=document.createElement('button');
  button.id='startCareerMatchBtn';button.className='primary-action career-match-launch';button.type='button';
  button.innerHTML='<i data-lucide="play"></i><span>Entrar na partida</span>';
  button.addEventListener('click',openPregame);
  copy.appendChild(button);
  window.lucide?.createIcons({strokeWidth:1.8});
}

async function reconcileStuckMatch(hub){
  if(!hub?.match_locked)return false;
  try{
    const result=await reconcileCareerMatchProgression();
    if(result?.advanced){window.location.reload();return true;}
  }catch(error){console.warn('Reconciliação pós-partida não disponível.',error);}
  return false;
}

async function openPregame(){
  mount();
  const overlay=$('careerMatchOverlay');
  overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');document.body.classList.add('match-open');
  $('matchPregame').innerHTML='<div class="match-loading"><span></span><strong>Preparando escalações, adversário e instruções...</strong></div>';
  $('matchPregame').classList.remove('hidden');$('matchGame').classList.add('hidden');$('matchPostgame').classList.add('hidden');
  try{renderPregame(await buildContext());}
  catch(error){
    $('matchPregame').innerHTML=`<div class="match-error"><strong>Não foi possível preparar a partida.</strong><p>${esc(error.message||error)}</p><button id="closeMatchError">Voltar</button></div>`;
    $('closeMatchError')?.addEventListener('click',closeMatch);
  }
}

function renderPregame(ctx){
  const selection=ctx.selection?.status||'starter';
  const status=selection==='starter'?'TITULAR':selection==='bench'?'BANCO':'FORA DA LISTA';
  const player=ctx.player||{},state=ctx.state||{};
  $('matchPregame').innerHTML=`
    <div class="pregame-hero">
      <div class="pregame-kicker">DIA DE JOGO · ${esc(ctx.competition||'Competição')}</div>
      <div class="pregame-versus">
        <div class="pregame-club"><img src="${esc(crestFor(ctx.home?.name,ctx.home?.crest))}" alt=""><strong>${esc(ctx.home?.name||ctx.club?.name)}</strong><small>${esc(ctx.home?.formation||ctx.club?.formation||'4-3-3')}</small></div>
        <div class="pregame-vs"><span>${esc(new Date(`${ctx.matchDate||state.date}T12:00:00`).toLocaleDateString('pt-BR'))}</span><b>×</b><em>${status}</em></div>
        <div class="pregame-club"><img src="${esc(crestFor(ctx.away?.name,ctx.away?.crest))}" alt=""><strong>${esc(ctx.away?.name||'Adversário')}</strong><small>${esc(ctx.away?.formation||'4-3-3')}</small></div>
      </div>
      <div class="pregame-panels">
        <article><span>VOCÊ</span><strong>${esc(player.nickname||player.name||'Jogador')} · ${esc(player.position||'—')}</strong><p>OVR ${esc(player.ovr||'—')} · Camisa ${esc(player.shirt_number||'—')}</p></article>
        <article><span>CONDIÇÃO</span><strong>Prontidão ${esc(state.readiness??'—')}</strong><p>Energia ${esc(state.energy??'—')} · Estafa ${esc(state.fatigue??'—')}</p></article>
        <article><span>GAMEPLAY</span><strong>Você controla as decisões do seu jogador.</strong><p>Posição, adversário, desgaste, placar e atributos mudam os lances.</p></article>
      </div>
      <div class="pregame-note">A partida corre continuamente e para quando seu jogador precisa decidir. Se você for substituído, pode ir direto ao resultado final sem assistir aos minutos restantes.</div>
      <div class="pregame-actions"><button id="closePregameBtn" class="match-secondary">Voltar</button><button id="beginMatchBtn" class="match-primary">${selection==='out'?'Resolver partida':'Começar partida'}</button></div>
    </div>`;
  $('closePregameBtn').addEventListener('click',closeMatch);
  $('beginMatchBtn').addEventListener('click',()=>beginMatch(ctx));
}

function beginMatch(ctx){
  engine=new CareerMatchEngine(ctx);
  wireEngine(engine,ctx);
  $('matchPregame').classList.add('hidden');$('matchGame').classList.remove('hidden');
  $('matchPlayers').innerHTML='';$('matchPassLayer').innerHTML='';$('matchCommentary').innerHTML='';
  hideDecision();hideFeedback();
  lastBall=null;fastForwarding=false;savingResult=false;setSpeed(1);
  $('matchHomeName').textContent=engine.teamNames.home;$('matchAwayName').textContent=engine.teamNames.away;
  $('matchHomeFormation').textContent=ctx.home?.formation||ctx.club?.formation||'4-3-3';$('matchAwayFormation').textContent=ctx.away?.formation||'4-3-3';
  $('matchHomeCrest').src=crestFor(ctx.home?.name,ctx.home?.crest);$('matchAwayCrest').src=crestFor(ctx.away?.name,ctx.away?.crest);
  $('matchInstruction').textContent=engine.coachInstruction;
  renderFrame(engine.snapshot());engine.start();startLoop();

  if((ctx.selection?.status||'starter')==='out'){
    fastForwardToEnd();
  }
}

function wireEngine(match,ctx){
  match.on('frame',snapshot=>{if(!fastForwarding)renderFrame(snapshot);});
  match.on('state',snapshot=>{if(!fastForwarding)renderFrame(snapshot);});
  match.on('commentary',item=>{if(!fastForwarding)appendCommentary(item);});
  match.on('decision',showDecision);
  match.on('halftime',showHalftime);
  match.on('sidechange',snapshot=>{if(!fastForwarding){flashPitch('2º TEMPO · LADOS INVERTIDOS');renderFrame(snapshot);}});
  match.on('substitution',showSubstitution);
  match.on('user_subbed',showUserSubbed);
  match.on('injury',info=>{if(!fastForwarding)flashPitch(`${info.player} SENTIU!`);});
  match.on('final',result=>showPostgame(result,ctx));
}

function playerNode(player){
  let node=document.querySelector(`[data-match-player="${CSS.escape(String(player.id))}"]`);
  if(!node){
    node=document.createElement('div');node.dataset.matchPlayer=String(player.id);node.className=`match-piece ${player.team} ${player.isUser?'user':''}`;
    node.innerHTML='<span class="piece-ring"></span><b></b><small></small>';$('matchPlayers').appendChild(node);
  }
  node.classList.toggle('off',!player.onField);node.classList.toggle('yellow',Boolean(player.yellow));node.classList.toggle('red',Boolean(player.red));
  node.style.left=`${player.x}%`;node.style.top=`${player.y}%`;node.querySelector('b').textContent=player.isUser?'★':String(player.number||'');node.querySelector('small').textContent=player.isUser?(player.name||'VOCÊ'):'';
  return node;
}

function drawPassTrail(from,to,team='home'){
  if(!from||!to)return;
  const layer=$('matchPassLayer');if(!layer)return;
  const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
  const line=document.createElement('span');line.className=`pass-trail ${team}`;line.style.left=`${from.x}%`;line.style.top=`${from.y}%`;line.style.width=`${len}%`;line.style.transform=`rotate(${angle}deg)`;
  layer.appendChild(line);requestAnimationFrame(()=>line.classList.add('show'));setTimeout(()=>line.remove(),460);
}

function renderFrame(snapshot){
  if(!snapshot)return;
  $('matchClock').textContent=`${Math.min(90,snapshot.minute)}'`;$('matchHomeScore').textContent=snapshot.score.home;$('matchAwayScore').textContent=snapshot.score.away;
  $('matchPhase').textContent=snapshot.phase==='second'?'2º tempo':snapshot.phase==='halftime'?'Intervalo':snapshot.phase==='final'?'Fim':'1º tempo';
  for(const player of[...snapshot.home,...snapshot.away])playerNode(player);
  if(lastBall&&snapshot.ball.ownerId!==lastBall.ownerId&&snapshot.ball.ownerId){const owner=[...snapshot.home,...snapshot.away].find(player=>player.id===snapshot.ball.ownerId);drawPassTrail(lastBall,snapshot.ball,owner?.team||'home');}
  lastBall={x:snapshot.ball.x,y:snapshot.ball.y,ownerId:snapshot.ball.ownerId};
  $('matchBall').style.left=`${snapshot.ball.x}%`;$('matchBall').style.top=`${snapshot.ball.y}%`;
  $('matchPlayerRating').textContent=Number(snapshot.rating||6).toFixed(1).replace('.',',');
  $('matchEnergyText').textContent=snapshot.userEnergy==null?'Fora de campo':`Energia ${Math.round(snapshot.userEnergy)}%`;
  $('matchEnergyBar').style.width=`${Math.max(0,snapshot.userEnergy??0)}%`;
  if(snapshot.directOpponent){$('matchDirectOpponent').textContent=`${snapshot.directOpponent.name} · ${snapshot.directOpponent.position||'—'} · OVR ${snapshot.directOpponent.ovr}`;$('matchDuelScore').textContent=`Você ${engine?.duelHistory?.wins||0} × ${engine?.duelHistory?.losses||0} rival`;}
  else $('matchDirectOpponent').textContent='Sem duelo direto definido.';
  const own=snapshot.teamTactics?.home,opp=snapshot.teamTactics?.away;
  $('matchTacticalState').textContent=own?.pressure==='high'?'Seu time subiu a pressão e adiantou as linhas.':opp?.pressure==='high'?'O adversário pressiona alto; sua equipe precisa escapar.':snapshot.minute>=74&&snapshot.score.home>snapshot.score.away?'Seu time reduz o ritmo e protege espaços.':'As linhas se ajustam conforme posse, placar e momento do jogo.';
  renderStats(snapshot);renderPlayerStats();
}

function renderStats(snapshot){
  const home=snapshot.stats.home,away=snapshot.stats.away;
  const row=(label,h,a)=>`<div class="match-stat-row"><b>${h}</b><span>${label}</span><b>${a}</b></div>`;
  $('matchStats').innerHTML=row('Posse',`${snapshot.possession.home}%`,`${snapshot.possession.away}%`)+row('Passes',`${home.passesCompleted}/${home.passesAttempted}`,`${away.passesCompleted}/${away.passesAttempted}`)+row('Finalizações',home.shots,away.shots)+row('No alvo',home.shotsOnTarget,away.shotsOnTarget)+row('Escanteios',home.corners,away.corners)+row('Faltas',home.fouls,away.fouls)+row('Amarelos',home.yellow,away.yellow)+row('Vermelhos',home.red,away.red);
}

function renderPlayerStats(){
  if(!engine)return;
  const p=engine.playerStats,rate=p.passesAttempted?Math.round(p.passesCompleted/p.passesAttempted*100):0;
  $('matchPlayerStats').innerHTML=`<div><span>Gols</span><b>${p.goals}</b></div><div><span>Assist.</span><b>${p.assists}</b></div><div><span>Chutes</span><b>${p.shots}</b></div><div><span>Passes</span><b>${p.passesCompleted}/${p.passesAttempted}</b></div><div><span>Precisão</span><b>${rate}%</b></div><div><span>Dribles</span><b>${p.dribblesCompleted}/${p.dribblesAttempted}</b></div><div><span>Duelos</span><b>${p.duelsWon}G · ${p.duelsLost}P</b></div>`;
}

function appendCommentary(item){
  const box=$('matchCommentary');if(!box)return;
  const line=document.createElement('div');line.className=`commentary-line ${item.type||''}`;line.innerHTML=`<b>${item.minute}'</b><span>${esc(item.text)}</span>`;
  box.appendChild(line);
  while(box.children.length>6)box.firstElementChild.remove();
  box.scrollTop=box.scrollHeight;
  const latest=$('matchLastEvent');if(latest)latest.textContent=item.text;
  if(item.type==='goal')flashPitch('GOOOL!');else if(item.type==='yellow'||item.type==='red')flashPitch('CARTÃO!');else if(item.type==='sub')flashPitch('SUBSTITUIÇÃO');
}

function hideDecision(){const panel=$('matchDecision');if(panel){panel.className='match-decision hidden';panel.innerHTML='';}}
function hideFeedback(){const node=$('matchChoiceFeedback');if(node){node.className='match-choice-feedback hidden';node.innerHTML='';}}

function outcomeText(result,beforeCount){
  const newItems=engine?.commentary?.slice(beforeCount)||[];
  const meaningful=[...newItems].reverse().find(item=>item?.text);
  if(meaningful)return meaningful.text;
  return result?.success?'A jogada funcionou e a partida continua.':'O adversário neutralizou sua tentativa.';
}

function showOutcome(result,label,beforeCount){
  const node=$('matchChoiceFeedback');if(!node)return;
  const success=Boolean(result?.success);const rating=Number(engine?.rating||6).toFixed(1).replace('.',',');const energy=engine?.user?.energy==null?'Fora de campo':`Energia ${Math.round(engine.user.energy)}%`;
  node.className=`match-choice-feedback ${success?'success':'fail'}`;
  node.innerHTML=`<span>${success?'AÇÃO BEM-SUCEDIDA':'A JOGADA NÃO FUNCIONOU'}</span><strong>${esc(label)}</strong><p>${esc(outcomeText(result,beforeCount))}</p><div><b>Nota ${rating}</b><b>${energy}</b></div>`;
  requestAnimationFrame(()=>node.classList.add('show'));
  clearTimeout(node.__hideTimer);
  node.__hideTimer=setTimeout(()=>{node.classList.remove('show');setTimeout(()=>node.classList.add('hidden'),180);},1250);
}

function showDecision(data){
  hideFeedback();
  const panel=$('matchDecision');panel.className='match-decision';
  const rival=data.directOpponent?`Duelo: ${esc(data.directOpponent.name)} · ${esc(data.directOpponent.position||'—')} · OVR ${esc(data.directOpponent.ovr)}`:'';
  panel.innerHTML=`<div class="decision-minute">${data.minute}' · SUA DECISÃO</div><h2>${esc(data.title)}</h2><p class="decision-context">${esc(data.instruction||'')}</p>${rival?`<p class="decision-rival">${rival}</p>`:''}<div class="match-choice-grid">${data.options.map((option,index)=>`<button type="button" data-match-choice="${esc(option.key)}" class="${option.tags?.includes('special')?'special':''}"><span>${String(index+1).padStart(2,'0')}</span><strong>${esc(option.label)}</strong>${option.tags?.includes('special')?'<em>Opção desbloqueada</em>':''}</button>`).join('')}</div><div class="decision-live"><span>Energia ${Math.round(data.energy??0)}%</span><span>Nota ${Number(data.rating||6).toFixed(1).replace('.',',')}</span><span>O jogo está pausado para sua escolha</span></div>`;
  panel.querySelectorAll('[data-match-choice]').forEach(button=>button.addEventListener('click',()=>{
    const label=button.querySelector('strong')?.textContent?.trim()||button.textContent.trim();
    const beforeCount=engine?.commentary?.length||0;
    panel.querySelectorAll('button').forEach(item=>item.disabled=true);
    const result=engine.choose(button.dataset.matchChoice);
    // A chained play already rendered the next decision synchronously.
    if(engine?.awaitingDecision&&engine?.pendingDecision)return;
    hideDecision();showOutcome(result,label,beforeCount);
  }));
}

function showHalftime(snapshot){
  hideDecision();hideFeedback();
  if(fastForwarding){engine.startSecondHalf();return;}
  const box=$('matchIntermission');box.classList.remove('hidden');
  box.innerHTML=`<div class="intermission-card"><span>INTERVALO</span><h2>${snapshot.score.home} × ${snapshot.score.away}</h2><p>As equipes trocam de lado. Formação, corredores e referências ofensivas são invertidos.</p><button id="startSecondHalfBtn">Começar 2º tempo</button></div>`;
  $('startSecondHalfBtn').addEventListener('click',()=>{box.classList.add('hidden');engine.startSecondHalf();});
}

function showSubstitution(info){
  hideDecision();hideFeedback();
  if(fastForwarding){engine.resume();return;}
  const box=$('matchIntermission');box.classList.remove('hidden');
  box.innerHTML=`<div class="intermission-card substitution"><span>${info.minute}' · O TREINADOR CHAMA VOCÊ</span><h2>Você vai entrar.</h2><p>${esc(info.instruction)}</p><strong>Sai ${esc(info.out?.name)} · entra ${esc(info.in?.name)}</strong><button id="enterMatchBtn">Entrar em campo</button></div>`;
  $('enterMatchBtn').addEventListener('click',()=>{box.classList.add('hidden');engine.resume();});
}

function showUserSubbed(info){
  engine.pause();hideDecision();hideFeedback();
  const box=$('matchIntermission');box.classList.remove('hidden');
  box.innerHTML=`<div class="intermission-card substitution match-sub-exit"><span>${info.minute}' · SUBSTITUIÇÃO</span><h2>Seu jogo termina aqui.</h2><p>Motivo da comissão: ${esc(info.reason)}.</p><strong>Você sai · entra ${esc(info.in?.name||'reserva')}</strong><div class="match-sub-actions"><button id="skipRestBtn" class="match-primary">Ir direto para o resultado</button><button id="watchRestBtn" class="match-secondary">Assistir o restante</button></div></div>`;
  $('watchRestBtn').addEventListener('click',()=>{box.classList.add('hidden');engine.resume();});
  $('skipRestBtn').addEventListener('click',()=>fastForwardToEnd());
}

function fastForwardToEnd(){
  if(!engine||engine.phase==='final')return;
  fastForwarding=true;clearInterval(timer);timer=null;hideDecision();hideFeedback();
  const box=$('matchIntermission');
  if(box){box.classList.remove('hidden');box.innerHTML='<div class="intermission-card match-fast-forward"><span>SEU JOGO TERMINOU</span><h2>Calculando o resultado final…</h2><p>Você não precisa assistir aos minutos restantes.</p><div class="match-fast-spinner"></div></div>';}
  engine.resume();
  let guard=0;
  const runChunk=()=>{
    if(!engine||engine.phase==='final'){fastForwarding=false;return;}
    for(let i=0;i<20&&engine&&engine.phase!=='final';i++){
      if(engine.phase==='halftime')engine.startSecondHalf();
      if(engine.awaitingDecision&&engine.pendingDecision?.options?.length){engine.choose(engine.pendingDecision.options[0].key);}
      if(engine.paused&&engine.phase!=='halftime')engine.resume();
      engine.tick(5);
      guard++;
      if(guard>3000){console.error('Fast-forward excedeu limite de segurança.');engine.finish();break;}
    }
    if(engine&&engine.phase!=='final')setTimeout(runChunk,0);
  };
  setTimeout(runChunk,30);
}

function flashPitch(text){
  if(!text||fastForwarding)return;
  const node=$('matchActionPulse');if(!node)return;
  node.textContent=text;node.classList.remove('hidden');requestAnimationFrame(()=>node.classList.add('show'));
  clearTimeout(node.__hideTimer);node.__hideTimer=setTimeout(()=>{node.classList.remove('show');setTimeout(()=>node.classList.add('hidden'),180);},620);
}

async function confirmCareerAdvanced(matchDate){
  try{
    const reconciliation=await reconcileCareerMatchProgression();
    const hub=await getCareerMetaHub();
    const sameDate=String(hub?.state?.date||'')===String(matchDate||'');
    return{confirmed:Boolean(hub&&!hub.match_locked&&!sameDate),hub,reconciliation};
  }catch(error){return{confirmed:false,error};}
}

async function persistFinalResult(result,ctx){
  if(savingResult)return null;
  savingResult=true;
  const ps=result.playerStats;
  try{
    const save=await recordCareerMatchGameplay({
      opponent:engine.teamNames.away,competition:ctx.competition||'Competição',played:result.appeared,started:result.started,
      minutes:ps.minutes,goals:ps.goals,assists:ps.assists,rating:result.rating,teamGoals:result.score.home,opponentGoals:result.score.away,
      metadata:{live_stats:result.stats,player_stats:ps,commentary:result.commentary.slice(-40),possession:result.possession,rating_log:result.ratingLog,duel_history:result.duelHistory,engine_version:'career-match-v3'}
    });
    const verification=await confirmCareerAdvanced(ctx.matchDate||ctx.state?.date);
    return{save,verification};
  }finally{savingResult=false;}
}

async function showPostgame(result,ctx){
  clearInterval(timer);timer=null;fastForwarding=false;
  $('matchIntermission')?.classList.add('hidden');hideDecision();hideFeedback();
  $('matchGame').classList.add('hidden');
  const post=$('matchPostgame');post.classList.remove('hidden');
  const ps=result.playerStats,resultLabel=result.score.home>result.score.away?'VITÓRIA':result.score.home===result.score.away?'EMPATE':'DERROTA';
  post.innerHTML=`<div class="postgame-head"><span>FIM DE JOGO · ${resultLabel}</span><h1>${esc(engine.teamNames.home)} <b>${result.score.home} × ${result.score.away}</b> ${esc(engine.teamNames.away)}</h1></div><div class="postgame-grid"><article><span>SUA NOTA</span><strong>${Number(result.rating).toFixed(1).replace('.',',')}</strong><p>${ps.minutes} min · ${ps.goals} gol(s) · ${ps.assists} assistência(s)</p></article><article><span>COM A BOLA</span><strong>${ps.passesCompleted}/${ps.passesAttempted} passes</strong><p>${ps.dribblesCompleted}/${ps.dribblesAttempted} dribles · ${ps.shots} finalizações</p></article><article><span>SEM A BOLA</span><strong>${ps.duelsWon} duelos ganhos</strong><p>${ps.duelsLost} duelos perdidos · duelo direto ${result.duelHistory?.wins||0}×${result.duelHistory?.losses||0}</p></article></div><div id="postgameSave" class="postgame-save">Salvando resultado e avançando o calendário…</div><div class="postgame-actions"><button id="retryMatchSyncBtn" class="match-secondary hidden">Tentar confirmar avanço</button><button id="finishMatchBtn" class="match-primary" disabled>Voltar para a carreira</button></div>`;

  try{
    const persisted=await persistFinalResult(result,ctx);
    if(persisted?.verification?.confirmed){
      $('postgameSave').textContent='Partida registrada e calendário avançado. A próxima rotina já está liberada.';
      $('finishMatchBtn').disabled=false;
    }else{
      $('postgameSave').innerHTML='<strong>O resultado foi salvo, mas o calendário ainda não confirmou o avanço.</strong><br>Não vou marcar a partida como concluída no navegador até o backend confirmar.';
      $('retryMatchSyncBtn').classList.remove('hidden');
      $('finishMatchBtn').disabled=true;
    }
  }catch(error){
    console.error(error);
    $('postgameSave').innerHTML=`<strong>Não foi possível concluir o registro da partida.</strong><br>${esc(error.message||error)}`;
    $('retryMatchSyncBtn').classList.remove('hidden');$('finishMatchBtn').disabled=true;
  }

  $('retryMatchSyncBtn')?.addEventListener('click',async()=>{
    const button=$('retryMatchSyncBtn');button.disabled=true;$('postgameSave').textContent='Confirmando avanço do calendário…';
    const verification=await confirmCareerAdvanced(ctx.matchDate||ctx.state?.date);
    if(verification.confirmed){$('postgameSave').textContent='Calendário confirmado. A partida foi consumida e a carreira avançou.';button.classList.add('hidden');$('finishMatchBtn').disabled=false;}
    else{$('postgameSave').textContent='O backend ainda não confirmou o avanço da carreira.';button.disabled=false;}
  });
  $('finishMatchBtn')?.addEventListener('click',()=>{closeMatch();window.location.reload();});
}

function closeMatch(){
  clearInterval(timer);timer=null;engine=null;lastBall=null;fastForwarding=false;savingResult=false;
  const overlay=$('careerMatchOverlay');overlay?.classList.add('hidden');overlay?.setAttribute('aria-hidden','true');document.body.classList.remove('match-open');
}

document.addEventListener('career:hub-rendered',async event=>{
  currentHub=event.detail;
  if(!currentHub?.match_locked)return;
  mount();placeMatchLock();
  if(await reconcileStuckMatch(currentHub))return;
  renderMatchLock(currentHub);
});

export function mountCareerMatchRuntime(){
  mount();placeMatchLock();
  if(currentHub?.match_locked)renderMatchLock(currentHub);
}
