import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const opponent=team=>team==='home'?'away':'home';
const attacksRight=(engine,team)=>team==='home'?engine.homeAttacksRight:!engine.homeAttacksRight;
const dir=(engine,team)=>attacksRight(engine,team)?1:-1;
const progress=(engine,team,x)=>attacksRight(engine,team)?x:100-x;
const active=list=>list.filter(player=>player.onField&&!player.red);
const playersOf=(engine,team)=>team==='home'?engine.home:engine.away;

const EXTRA_LINES={
  overlap:[
    'O lateral passa por fora do ponta e oferece profundidade no corredor.',
    'Ultrapassagem do lateral! A marcação precisa decidir quem acompanha.',
    'O ponta prende o marcador e o lateral dispara nas costas.'
  ],
  underlap:[
    'Enquanto o ponta mantém a amplitude, um meia infiltra por dentro.',
    'Movimento de ruptura por dentro entre lateral e zagueiro.',
    'O meia ataca o espaço interno e cria uma segunda linha de ameaça.'
  ],
  midfield_duel:[
    'O meio-campo vira uma zona de disputa e as duas equipes encurtam o espaço.',
    'Duelos sucessivos no setor central impedem uma progressão limpa.',
    'A bola fica viva no meio e os volantes brigam pela segunda bola.'
  ],
  press_trigger:[
    'Passe para trás é o gatilho: a linha de frente dispara a pressão.',
    'O atacante fecha o zagueiro e o meia salta no volante. Pressão coordenada.',
    'A primeira linha sobe junta e tenta prender a saída perto da área.'
  ],
  counter_killed:[
    'A defesa recompõe em velocidade e mata o contra-ataque antes da área.',
    'O time que perdeu a bola consegue atrasar a transição e reorganizar o bloco.',
    'A vantagem do contra-ataque desaparece; a jogada volta a ser construída.'
  ],
  compact:[
    'Sem a bola, as linhas se aproximam e reduzem o espaço entre defesa e meio.',
    'O bloco defensivo fica curto e empurra o jogo para um dos lados.',
    'A equipe fecha o centro e aceita ceder o corredor externo.'
  ]
};

function say(engine,key,type='play'){
  const flow=engine.matchFlow;
  if(!flow)return;
  flow.recentEvents ||= [];
  if(flow.recentEvents.slice(-4).includes(key))return;
  const list=EXTRA_LINES[key];
  if(!list?.length)return;
  flow.extraNarration ||= {};
  const lastIndex=flow.extraNarration[key]??-1;
  let index=Math.floor(engine.rng()*list.length);
  if(index===lastIndex)index=(index+1)%list.length;
  flow.extraNarration[key]=index;
  flow.recentEvents.push(key);
  while(flow.recentEvents.length>8)flow.recentEvents.shift();
  engine.feed(list[index],type);
}

function nearestForward(engine,team){
  const list=active(playersOf(engine,team)).filter(player=>['st','wing','am'].includes(player.role));
  return list.sort((a,b)=>Math.hypot(a.x-engine.ball.x,a.y-engine.ball.y)-Math.hypot(b.x-engine.ball.x,b.y-engine.ball.y))[0]||null;
}

function applyHighPress(engine){
  const possession=engine.possession;
  const defending=opponent(possession);
  const pressure=engine.teamTactics?.[defending]?.pressure;
  if(pressure!=='high')return;
  const ballProgressForPossession=progress(engine,possession,engine.ball.x);
  if(ballProgressForPossession>48)return;

  const pressers=active(playersOf(engine,defending)).filter(player=>['st','wing','am','cm'].includes(player.role));
  pressers.sort((a,b)=>Math.hypot(a.x-engine.ball.x,a.y-engine.ball.y)-Math.hypot(b.x-engine.ball.x,b.y-engine.ball.y));
  pressers.slice(0,3).forEach((player,index)=>{
    const factor=index===0?.50:index===1?.36:.28;
    player.x+=(engine.ball.x-player.x)*factor;
    player.y+=(engine.ball.y-player.y)*factor;
  });
}

function sameSide(player,ballY){return(player.homeY<50&&ballY<50)||(player.homeY>50&&ballY>50);}

function applyAttackingRotations(engine){
  const team=engine.possession;
  const flow=engine.matchFlow;
  if(!flow||!['progression','final','counter'].includes(flow.phase))return;
  const list=active(playersOf(engine,team));
  const d=dir(engine,team);
  const ballY=engine.ball.y;

  const winger=list.filter(player=>player.role==='wing'&&sameSide(player,ballY)).sort((a,b)=>Math.abs(a.y-ballY)-Math.abs(b.y-ballY))[0];
  const fullback=list.filter(player=>player.role==='fb'&&sameSide(player,ballY)).sort((a,b)=>Math.abs(a.y-ballY)-Math.abs(b.y-ballY))[0];
  if(winger&&fullback){
    const wingP=progress(engine,team,winger.x);
    const fbP=progress(engine,team,fullback.x);
    if(wingP>55&&fbP<wingP+8){
      fullback.x=clamp(fullback.x+d*8,5,95);
      fullback.y=clamp(fullback.y+(fullback.homeY<50?-5:5),5,95);
      winger.y+=(50-winger.y)*.16;
      if(engine.rng()<.025)say(engine,'overlap');
    }
  }

  const am=list.find(player=>player.role==='am')||list.find(player=>player.role==='cm');
  if(winger&&am&&progress(engine,team,engine.ball.x)>62){
    am.x=clamp(am.x+d*6,5,95);
    am.y+=(winger.y-am.y)*.18;
    if(engine.rng()<.018)say(engine,'underlap');
  }
}

function applyDefensiveCompactness(engine){
  const defending=opponent(engine.possession);
  const list=active(playersOf(engine,defending));
  const ballY=engine.ball.y;
  const ballP=progress(engine,engine.possession,engine.ball.x);
  if(ballP<52)return;

  const centerY=50+(ballY-50)*.28;
  for(const player of list){
    if(['cb','fb','dm','cm','am'].includes(player.role))player.y+=(centerY-player.y)*.12;
  }
  if(engine.rng()<.008)say(engine,'compact');
}

function applyCounterRecovery(engine){
  const flow=engine.matchFlow;
  if(!flow||flow.phase!=='counter')return;
  const attacking=engine.possession;
  const defending=opponent(attacking);
  const d=dir(engine,defending);
  const defenders=active(playersOf(engine,defending));
  for(const player of defenders){
    if(['cb','fb','dm','cm'].includes(player.role)){
      player.x=clamp(player.x-d*3.5,4,96);
      player.y+=(50-player.y)*.05;
    }
  }
  const runners=active(playersOf(engine,attacking)).filter(player=>['st','wing','am'].includes(player.role));
  for(const player of runners)player.x=clamp(player.x+dir(engine,attacking)*2.8,4,96);
}

function maybeNarrateTacticalMoment(engine){
  const flow=engine.matchFlow;
  if(!flow||engine.paused)return;
  const team=engine.possession;
  const defending=opponent(team);
  const ballP=progress(engine,team,engine.ball.x);

  if(engine.teamTactics?.[defending]?.pressure==='high'&&ballP<40&&engine.rng()<.06)say(engine,'press_trigger','pressure');
  if(flow.phase==='midfield'&&engine.rng()<.055)say(engine,'midfield_duel');
  if(flow.phase==='counter'&&engine.minute>flow.lastTurnoverMinute+1&&engine.rng()<.14){
    flow.phase='progression';
    flow.transitionUntil=engine.minute-1;
    say(engine,'counter_killed');
  }
}

if(!CareerMatchEngine.prototype.__footballIntelligencePatched){
  const previousAnimate=CareerMatchEngine.prototype.animatePlayers;
  const previousOnMinute=CareerMatchEngine.prototype.onMinute;

  CareerMatchEngine.prototype.animatePlayers=function intelligentMovement(){
    previousAnimate.call(this);
    if(!this.matchFlow)return;
    applyHighPress(this);
    applyAttackingRotations(this);
    applyDefensiveCompactness(this);
    applyCounterRecovery(this);
  };

  CareerMatchEngine.prototype.onMinute=function intelligentMinute(){
    const beforePhase=this.matchFlow?.phase;
    previousOnMinute.call(this);
    if(this.phase==='final'||this.phase==='halftime')return;
    if(!this.paused)maybeNarrateTacticalMoment(this);
    if(this.matchFlow&&beforePhase==='counter'&&this.matchFlow.phase==='counter'&&this.matchFlow.passCount>3){
      this.matchFlow.phase='progression';
      say(this,'counter_killed');
    }
  };

  Object.defineProperty(CareerMatchEngine.prototype,'__footballIntelligencePatched',{value:true,enumerable:false,configurable:false});
}
