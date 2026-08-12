import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const active=players=>players.filter(player=>player.onField&&!player.red);
const randPick=(list,rng)=>list.length?list[Math.floor(rng()*list.length)]:null;
const opponentTeam=team=>team==='home'?'away':'home';
const attacksRight=(engine,team)=>team==='home'?engine.homeAttacksRight:!engine.homeAttacksRight;
const direction=(engine,team)=>attacksRight(engine,team)?1:-1;
const progressOf=(engine,team,x)=>attacksRight(engine,team)?x:100-x;
const teamPlayers=(engine,team)=>team==='home'?engine.home:engine.away;

const FLOW_LINES={
  buildup:[
    '{team} começa por baixo, atraindo a primeira linha de pressão.',
    '{team} abre os zagueiros e chama o volante para iniciar a construção.',
    'A saída de {team} é paciente: zaga e meio tentam criar superioridade.',
    '{team} reinicia desde trás e procura o homem livre no primeiro passe.'
  ],
  midfield:[
    'A bola chega ao meio e {team} tenta acelerar entre as linhas.',
    '{team} ocupa o corredor central e faz o meio-campo participar da jogada.',
    'O jogo passa pelo meio: aproximações curtas para escapar da marcação.',
    '{team} encontra espaço no setor central e começa a empurrar o bloco rival.'
  ],
  recycle:[
    'Sem espaço à frente, {team} volta a bola e reorganiza a jogada.',
    '{team} prefere reciclar a posse a forçar um passe impossível.',
    'A pressão fecha o corredor; a bola volta para trás para começar de novo.',
    'O ataque não encontra passagem e reinicia pelo apoio.'
  ],
  striker_drop:[
    '{player} sai da referência, recua e oferece apoio entre os volantes.',
    '{player} abandona por instantes a última linha para participar da construção.',
    'Pressionado, {team} usa {player} vindo buscar jogo no meio.',
    '{player} recua, arrasta um zagueiro e abre espaço nas costas.'
  ],
  overlap:[
    'O lateral de {team} passa por fora e dá profundidade ao corredor.',
    'Ultrapassagem pelo lado! O lateral aparece além do ponta.',
    '{team} cria superioridade no corredor com a passagem do lateral.',
    'O lateral acelera nas costas da marcação e vira opção de passe.'
  ],
  underlap:[
    'Movimento por dentro: um jogador de {team} ataca o espaço entre lateral e zagueiro.',
    '{team} faz uma infiltração interna enquanto o ponta segura a amplitude.',
    'Corrida por dentro para quebrar a última linha da defesa.'
  ],
  switch:[
    '{team} muda o lado da jogada para atacar onde há mais espaço.',
    'Inversão rápida: a defesa precisa atravessar o campo inteiro.',
    'A bola viaja para o lado oposto e {team} tenta pegar o bloco desequilibrado.'
  ],
  press:[
    '{team} aperta a saída e obriga o adversário a jogar sob pressão.',
    'Pressão coordenada de {team}: atacante e meias fecham as opções curtas.',
    '{team} sobe o bloco inteiro e tenta recuperar a bola ainda no campo rival.'
  ],
  escape_press:[
    '{team} escapa da pressão com uma combinação curta pelo meio.',
    'Boa saída sob pressão: dois passes rápidos tiram a primeira linha do lance.',
    '{team} encontra o volante livre e quebra a pressão adversária.'
  ],
  counter:[
    'Recuperação e aceleração imediata: contra-ataque de {team}!',
    '{team} rouba e sai com campo aberto antes da defesa se reorganizar.',
    'Transição rápida! Poucos jogadores ficaram atrás da linha da bola.',
    '{team} dispara no contra-ataque e força a defesa a correr para o próprio gol.'
  ],
  counter_killed:[
    'A defesa mata o contra-ataque e consegue reorganizar as linhas.',
    'A transição perde velocidade e o rival volta a ocupar seus espaços.',
    'O contra-ataque é desacelerado antes de chegar à área.'
  ],
  midfield_duel:[
    'Disputa forte no meio-campo; ninguém quer ceder o corredor central.',
    'O meio fica congestionado e a posse é decidida no contato.',
    'Duelo no círculo central antes da próxima fase da jogada.'
  ],
  through_ball:[
    'Passe vertical rompe a linha e encontra um atacante em movimento!',
    'Bola enfiada nas costas da defesa. A última linha precisa reagir.',
    'O meio-campo acha o passe entre zagueiro e lateral e acelera o ataque.'
  ],
  final_third:[
    '{team} instala a posse no último terço e cerca a área.',
    'A defesa recua e {team} passa a trabalhar ao redor da área.',
    '{team} empurra o adversário para perto do próprio gol.'
  ],
  turnover:[
    'Passe interceptado no meio e a posse muda de lado.',
    'A bola é perdida na construção. Transição imediata para o outro lado.',
    'Erro sob pressão e o adversário recupera em zona perigosa.'
  ],
  carry:[
    '{player} percebe espaço e conduz alguns metros antes de soltar a bola.',
    '{player} rompe a primeira linha carregando a bola pelo corredor central.',
    'Condução de {player} faz a defesa recuar e abre uma nova linha de passe.'
  ],
  wide_attack:[
    '{team} acelera pelo corredor lateral e coloca a defesa para correr de lado.',
    'A amplitude funciona: {team} consegue chegar ao fundo pelo lado.',
    '{team} encontra o ponta aberto e força o lateral rival ao duelo.'
  ],
  cutback:[
    'Chegou ao fundo e a bola volta para trás, buscando quem vem de frente.',
    'Passe para trás na entrada da área! A defesa estava correndo para o próprio gol.',
    'Em vez do cruzamento alto, vem a bola rasteira para quem chega de trás.'
  ]
};

function flowText(engine,key,data={}){
  const list=FLOW_LINES[key]||FLOW_LINES.midfield;
  engine.matchFlow ||= {};
  engine.matchFlow.recentText ||= [];
  const recent=engine.matchFlow.recentText;
  let candidates=list.filter(text=>!recent.includes(text));
  if(!candidates.length)candidates=list;
  const template=randPick(candidates,engine.rng)||list[0];
  recent.push(template);
  while(recent.length>7)recent.shift();
  return template.replace(/\{(\w+)\}/g,(_,name)=>data[name]??'');
}

function feedFlow(engine,key,data={},type='play',actor=null){
  engine.feed(flowText(engine,key,data),type,actor);
  engine.matchFlow.recentEvents.push(key);
  while(engine.matchFlow.recentEvents.length>8)engine.matchFlow.recentEvents.shift();
}

function ensureFlow(engine){
  if(engine.matchFlow)return engine.matchFlow;
  engine.matchFlow={
    phase:'buildup',
    previousPhase:null,
    possessionTeam:engine.possession,
    possessionStartedMinute:engine.minute,
    lastTurnoverMinute:-99,
    transitionUntil:-1,
    lane:'center',
    passCount:0,
    sequenceId:1,
    recentEvents:[],
    recentText:[],
    lastHolderId:null,
    pressureSide:null,
    tempoMode:'settled'
  };
  return engine.matchFlow;
}

function relativeZone(engine,team,player){
  const p=progressOf(engine,team,player.x);
  if(p<24)return'first';
  if(p<48)return'build';
  if(p<68)return'middle';
  if(p<82)return'final';
  return'box';
}

function rolePriority(role,phase){
  const maps={
    buildup:{gk:9,cb:10,fb:8,dm:9,cm:5,am:2,wing:1,st:0},
    build:{gk:1,cb:7,fb:8,dm:10,cm:9,am:5,wing:4,st:2},
    midfield:{gk:0,cb:3,fb:6,dm:9,cm:10,am:9,wing:7,st:4},
    progression:{gk:0,cb:2,fb:7,dm:6,cm:9,am:10,wing:10,st:7},
    final:{gk:0,cb:1,fb:6,dm:4,cm:7,am:10,wing:10,st:10},
    counter:{gk:0,cb:1,fb:4,dm:5,cm:8,am:10,wing:10,st:10}
  };
  return maps[phase]?.[role]??4;
}

function targetProgressForPhase(phase,current){
  if(phase==='buildup')return Math.min(38,current+16);
  if(phase==='build')return Math.min(54,current+14);
  if(phase==='midfield')return Math.min(68,current+13);
  if(phase==='progression')return Math.min(82,current+12);
  if(phase==='final')return Math.min(92,current+8);
  if(phase==='counter')return Math.min(94,current+22);
  return current+8;
}

function receiverScore(engine,team,from,to,phase){
  const current=progressOf(engine,team,from.x);
  const target=targetProgressForPhase(phase,current);
  const p=progressOf(engine,team,to.x);
  const forwardFit=100-Math.abs(target-p)*2.2;
  const roleFit=rolePriority(to.role,phase)*8;
  const lateralDistance=Math.abs(to.y-from.y);
  const verticalDistance=Math.abs(p-current);
  let score=forwardFit+roleFit+Number(to.ovr||60)*.55+Number(to.chemistry||50)*.18-engine.rng()*18;
  if(to.id===engine.matchFlow.lastHolderId)score-=35;
  if(lateralDistance>48)score-=10;
  if(verticalDistance>38&&phase!=='counter')score-=20;
  if(phase==='buildup'&&['wing','st'].includes(to.role))score-=45;
  if(phase==='final'&&['cb','gk'].includes(to.role))score-=60;
  if(phase==='counter'&&['wing','st','am'].includes(to.role))score+=22;
  return score;
}

function chooseReceiver(engine,team,from,phase){
  const mates=active(teamPlayers(engine,team)).filter(player=>player.id!==from.id);
  return mates.sort((a,b)=>receiverScore(engine,team,from,b,phase)-receiverScore(engine,team,from,a,phase))[0]||null;
}

function nearestByZone(engine,team,x,y,preferredRoles=[]){
  const players=active(teamPlayers(engine,team));
  return players.sort((a,b)=>{
    const da=Math.hypot(a.x-x,a.y-y)-(preferredRoles.includes(a.role)?12:0);
    const db=Math.hypot(b.x-x,b.y-y)-(preferredRoles.includes(b.role)?12:0);
    return da-db;
  })[0]||null;
}

function putBall(engine,player){
  if(!player)return;
  engine.ball.ownerId=player.id;
  engine.ball.x=player.x;
  engine.ball.y=player.y;
}

function completePass(engine,team,from,to,kind='pass'){
  engine.stats[team].passesAttempted=(engine.stats[team].passesAttempted||0)+1;
  engine.stats[team].passesCompleted=(engine.stats[team].passesCompleted||0)+1;
  engine.matchFlow.lastHolderId=from.id;
  engine.matchFlow.passCount++;
  putBall(engine,to);
  const data={from:from.name,to:to.name,team:engine.teamNames[team]};
  if(kind==='switch')feedFlow(engine,'switch',data,'pass',from);
  else if(kind==='through')feedFlow(engine,'through_ball',data,'pass',from);
  else engine.feed(`${from.name} encontra ${to.name} e a jogada continua pelo ${relativeZone(engine,team,to)==='middle'?'meio':'setor seguinte'}.`,'pass',from);
}

function passRisk(engine,team,from,to,phase){
  const opponent=opponentTeam(team);
  const pressure=engine.teamTactics?.[opponent]?.pressure==='high'?10:engine.teamTactics?.[opponent]?.pressure==='medium'?5:0;
  const distance=Math.hypot(to.x-from.x,to.y-from.y);
  const vertical=Math.abs(progressOf(engine,team,to.x)-progressOf(engine,team,from.x));
  const base=8+distance*.22+vertical*.12+pressure-(Number(from.ovr||60)-60)*.25-(Number(to.ovr||60)-60)*.12;
  return clamp(base+(phase==='counter'?4:0),4,38);
}

function turnover(engine,losingTeam,from){
  const winningTeam=opponentTeam(losingTeam);
  engine.stats[losingTeam].passesAttempted=(engine.stats[losingTeam].passesAttempted||0)+1;
  const interceptor=nearestByZone(engine,winningTeam,from.x,from.y,['dm','cm','cb','fb']);
  engine.possession=winningTeam;
  putBall(engine,interceptor);
  const flow=ensureFlow(engine);
  flow.possessionTeam=winningTeam;
  flow.possessionStartedMinute=engine.minute;
  flow.lastTurnoverMinute=engine.minute;
  flow.transitionUntil=engine.minute+2;
  flow.phase='counter';
  flow.passCount=0;
  flow.sequenceId++;
  feedFlow(engine,'turnover',{team:engine.teamNames[winningTeam]},'interception',interceptor);
  if(engine.rng()<.72)feedFlow(engine,'counter',{team:engine.teamNames[winningTeam]},'counter',interceptor);
}

function maybeShoot(engine,team,holder){
  const progress=progressOf(engine,team,holder.x);
  if(progress<78)return false;
  const roleChance={st:.34,wing:.23,am:.24,cm:.12,fb:.08,dm:.05,cb:.02,gk:0}[holder.role]??.1;
  const phaseBoost=engine.matchFlow.phase==='counter'?.14:engine.matchFlow.phase==='final'?.08:0;
  if(engine.rng()>roleChance+phaseBoost)return false;
  const opponent=opponentTeam(team);
  engine.stats[team].shots=(engine.stats[team].shots||0)+1;
  engine.feed(`${holder.name} encontra espaço na entrada da área e finaliza!`,'shot',holder);
  const gk=active(teamPlayers(engine,opponent)).find(player=>player.role==='gk');
  const defenders=active(teamPlayers(engine,opponent)).filter(player=>['cb','fb','dm'].includes(player.role));
  const attack=Number(holder.ovr||60)+engine.rng()*20+(progress-78)*.3;
  const defense=(gk?.ovr||60)*.72+defenders.reduce((sum,player)=>sum+Number(player.ovr||60)*.045,0);
  if(attack-defense>17){
    engine.stats[team].shotsOnTarget=(engine.stats[team].shotsOnTarget||0)+1;
    engine.stats[team].goals=(engine.stats[team].goals||0)+1;
    engine.score[team]++;
    engine.feed(`GOOOL! ${holder.name} conclui a jogada de ${engine.teamNames[team]}!`,'goal',holder);
  }else if(attack-defense>3){
    engine.stats[team].shotsOnTarget=(engine.stats[team].shotsOnTarget||0)+1;
    engine.feed('O goleiro reage e evita o gol.','shot_saved',gk);
  }else if(engine.rng()<.28){
    engine.stats[team].corners=(engine.stats[team].corners||0)+1;
    engine.feed(`A defesa desvia e ${engine.teamNames[team]} ganha escanteio.`,'corner',holder);
  }else engine.feed('A finalização sai sem a direção necessária.','shot_off',holder);

  engine.possession=opponent;
  const restart=active(teamPlayers(engine,opponent)).find(player=>player.role==='gk')||active(teamPlayers(engine,opponent))[0];
  putBall(engine,restart);
  const flow=engine.matchFlow;
  flow.phase='buildup';flow.passCount=0;flow.possessionTeam=opponent;flow.possessionStartedMinute=engine.minute;flow.sequenceId++;
  return true;
}

function maybeWideAction(engine,team,holder){
  const progress=progressOf(engine,team,holder.x);
  if(progress<68||!['wing','fb'].includes(holder.role))return false;
  if(Math.abs(holder.y-50)<18)return false;
  if(engine.rng()>.30)return false;
  feedFlow(engine,'wide_attack',{team:engine.teamNames[team]},'play',holder);
  const boxTargets=active(teamPlayers(engine,team)).filter(player=>['st','am','wing','cm'].includes(player.role)&&player.id!==holder.id);
  const target=boxTargets.sort((a,b)=>progressOf(engine,team,b.x)-progressOf(engine,team,a.x))[0];
  if(!target)return false;
  if(engine.rng()<.45){
    feedFlow(engine,'cutback',{team:engine.teamNames[team]},'pass',holder);
    target.x=clamp(target.x+direction(engine,team)*5,4,96);
    target.y=45+engine.rng()*10;
    completePass(engine,team,holder,target,'pass');
  }else{
    engine.feed(`${holder.name} cruza buscando ${target.name} na área.`,'cross',holder);
    completePass(engine,team,holder,target,'pass');
  }
  engine.matchFlow.phase='final';
  return true;
}

function phaseFromHolder(engine,team,holder){
  const p=progressOf(engine,team,holder.x);
  const flow=engine.matchFlow;
  if(engine.minute<=flow.transitionUntil)return'counter';
  if(p<28)return'buildup';
  if(p<48)return'build';
  if(p<67)return'midfield';
  if(p<82)return'progression';
  return'final';
}

function simulateFootballMinute(engine){
  const flow=ensureFlow(engine);
  const team=engine.possession;
  const opponent=opponentTeam(team);
  const players=active(teamPlayers(engine,team));
  let holder=players.find(player=>player.id===engine.ball.ownerId);
  if(!holder){
    holder=nearestByZone(engine,team,engine.ball.x,engine.ball.y,['cb','dm','cm']);
    putBall(engine,holder);
  }
  if(!holder)return;

  if(flow.possessionTeam!==team){
    flow.possessionTeam=team;flow.possessionStartedMinute=engine.minute;flow.passCount=0;flow.sequenceId++;flow.phase='buildup';
  }

  flow.phase=phaseFromHolder(engine,team,holder);
  engine.stats[team].possessionTicks=(engine.stats[team].possessionTicks||0)+1;

  const opponentPressure=engine.teamTactics?.[opponent]?.pressure;
  if(opponentPressure==='high'&&['gk','cb','fb','dm'].includes(holder.role)&&engine.rng()<.24){
    feedFlow(engine,'press',{team:engine.teamNames[opponent]},'pressure');
    if(engine.rng()<.62)feedFlow(engine,'escape_press',{team:engine.teamNames[team]},'play',holder);
    else if(engine.rng()<.36){turnover(engine,team,holder);return;}
  }

  if(maybeShoot(engine,team,holder))return;
  if(maybeWideAction(engine,team,holder))return;

  if(['st','wing'].includes(holder.role)&&flow.phase!=='final'&&engine.rng()<.22){
    feedFlow(engine,'striker_drop',{player:holder.name,team:engine.teamNames[team]},'play',holder);
    holder.x=clamp(holder.x-direction(engine,team)*(8+engine.rng()*6),4,96);
  }

  if(['cb','dm','cm'].includes(holder.role)&&flow.phase==='midfield'&&engine.rng()<.20){
    feedFlow(engine,'carry',{player:holder.name,team:engine.teamNames[team]},'play',holder);
    holder.x=clamp(holder.x+direction(engine,team)*(4+engine.rng()*5),4,96);
    putBall(engine,holder);
  }

  let nextPhase=flow.phase;
  if(flow.phase==='buildup')nextPhase='build';
  else if(flow.phase==='build')nextPhase=engine.rng()<.80?'midfield':'build';
  else if(flow.phase==='midfield')nextPhase=engine.rng()<.72?'progression':'midfield';
  else if(flow.phase==='progression')nextPhase=engine.rng()<.63?'final':'progression';
  else if(flow.phase==='counter')nextPhase=engine.rng()<.64?'final':'progression';
  else nextPhase='final';

  // Pressure or congestion can force a real backward/recycling pass.
  const congested=(flow.phase==='progression'||flow.phase==='final')&&engine.rng()<.20;
  if(congested){
    const recycleCandidates=players.filter(player=>['cb','fb','dm','cm'].includes(player.role)&&player.id!==holder.id);
    const back=recycleCandidates.sort((a,b)=>progressOf(engine,team,a.x)-progressOf(engine,team,b.x))[0];
    if(back){
      feedFlow(engine,'recycle',{team:engine.teamNames[team]},'pass',holder);
      completePass(engine,team,holder,back,'pass');
      flow.phase=phaseFromHolder(engine,team,back);
      return;
    }
  }

  const receiver=chooseReceiver(engine,team,holder,nextPhase);
  if(!receiver)return;
  const risk=passRisk(engine,team,holder,receiver,nextPhase);
  if(engine.rng()*100<risk){turnover(engine,team,holder);return;}

  const lateralChange=Math.abs(receiver.y-holder.y)>38;
  const verticalGain=progressOf(engine,team,receiver.x)-progressOf(engine,team,holder.x);
  const kind=lateralChange?'switch':verticalGain>24?'through':'pass';
  completePass(engine,team,holder,receiver,kind);
  flow.previousPhase=flow.phase;
  flow.phase=phaseFromHolder(engine,team,receiver);

  if(flow.phase==='midfield'&&flow.previousPhase!=='midfield')feedFlow(engine,'midfield',{team:engine.teamNames[team]},'play',receiver);
  if(flow.phase==='final'&&flow.previousPhase!=='final')feedFlow(engine,'final_third',{team:engine.teamNames[team]},'play',receiver);
}

function dynamicTarget(engine,player){
  const flow=ensureFlow(engine);
  const hasBallTeam=engine.possession===player.team;
  const dir=direction(engine,player.team);
  const teamPhase=hasBallTeam?flow.phase:(flow.phase==='counter'?'defend_counter':'defend');
  const ball=engine.ball;
  let x=player.homeX;
  let y=player.homeY;
  const ballProgress=progressOf(engine,player.team,ball.x);
  const sameSide=Math.abs(ball.y-player.homeY)<22;

  if(hasBallTeam){
    if(player.role==='gk'){
      x+=dir*(teamPhase==='buildup'?2:0);
    }else if(player.role==='cb'){
      x+=dir*(teamPhase==='buildup'?4:teamPhase==='build'?7:10);
      y+=(ball.y-y)*.10;
    }else if(player.role==='dm'){
      if(teamPhase==='buildup')x-=dir*8;
      else x+=dir*(teamPhase==='final'?10:5);
      y+=(ball.y-y)*.22;
    }else if(player.role==='cm'){
      x+=dir*(teamPhase==='buildup'?-5:teamPhase==='build'?2:teamPhase==='midfield'?8:teamPhase==='final'?15:11);
      y+=(ball.y-y)*.18;
    }else if(player.role==='am'){
      x+=dir*(teamPhase==='buildup'?-10:teamPhase==='build'?-5:teamPhase==='midfield'?2:teamPhase==='final'?11:7);
      y+=(ball.y-y)*.12;
    }else if(player.role==='fb'){
      const advance=ballProgress>48?(sameSide?16:9):3;
      x+=dir*advance;
      if(sameSide&&ballProgress>58)y+=(player.homeY<50?-5:5);
    }else if(player.role==='wing'){
      // Winger can come inside or drop to help when buildup is under pressure.
      if(teamPhase==='buildup'||teamPhase==='build')x-=dir*(engine.teamTactics?.[opponentTeam(player.team)]?.pressure==='high'?12:5);
      else x+=dir*(teamPhase==='final'?11:7);
      if(!sameSide&&ballProgress>55)y+=(50-y)*.30;
      if(sameSide&&ballProgress>68)y+=(50-y)*.15;
    }else if(player.role==='st'){
      const pressed=engine.teamTactics?.[opponentTeam(player.team)]?.pressure==='high';
      if(teamPhase==='buildup'||teamPhase==='build')x-=dir*(pressed?15:8);
      else if(teamPhase==='midfield')x-=dir*3;
      else x+=dir*(teamPhase==='counter'?14:8);
      y+=(50-y)*.15;
    }
  }else{
    const counter=flow.phase==='counter';
    if(player.role==='st')x-=dir*(counter?12:7);
    else if(player.role==='wing')x-=dir*(counter?15:9);
    else if(player.role==='am')x-=dir*(counter?14:8);
    else if(player.role==='cm')x-=dir*(counter?12:6);
    else if(player.role==='dm')x-=dir*(counter?9:4);
    else if(player.role==='fb')x-=dir*(counter?8:4);
    else if(player.role==='cb')x-=dir*(counter?10:3);

    const distance=Math.hypot(ball.x-player.x,ball.y-player.y);
    if(distance<22&&player.role!=='gk'){
      x+=(ball.x-x)*.28;
      y+=(ball.y-y)*.32;
    }else if(['cm','dm','am'].includes(player.role))y+=(ball.y-y)*.20;
  }

  // Keep a coherent block, but never glue players to formation dots.
  x=clamp(x,player.role==='gk'?3:5,player.role==='gk'?17:95);
  if(!attacksRight(engine,player.team)&&player.role==='gk')x=clamp(x,83,97);
  y=clamp(y,5,95);
  return{x,y};
}

if(!CareerMatchEngine.prototype.__footballFlowPatched){
  const originalStart=CareerMatchEngine.prototype.start;
  const originalFeed=CareerMatchEngine.prototype.feed;

  CareerMatchEngine.prototype.start=function footballFlowStart(){
    ensureFlow(this);
    const result=originalStart.call(this);
    const initialTeam=this.possession;
    const initialPlayers=active(teamPlayers(this,initialTeam));
    const initial=initialPlayers.find(player=>['cb','dm'].includes(player.role))||initialPlayers[0];
    if(initial)putBall(this,initial);
    this.matchFlow.phase='buildup';
    this.matchFlow.possessionTeam=initialTeam;
    return result;
  };

  CareerMatchEngine.prototype.feed=function nonRepeatingFeed(text,type='play',actor=null){
    const last=this.commentary?.slice(-4)||[];
    const exact=last.some(item=>item.text===text&&item.type===type);
    if(exact&&type!=='goal'&&type!=='final')return;
    return originalFeed.call(this,text,type,actor);
  };

  CareerMatchEngine.prototype.animatePlayers=function footballMovement(){
    ensureFlow(this);
    for(const player of[...this.home,...this.away]){
      if(!player.onField)continue;
      const target=dynamicTarget(this,player);
      const pace=player.isUser?.13:player.role==='wing'||player.role==='st'?.105:.085;
      player.x+=(target.x-player.x)*pace;
      player.y+=(target.y-player.y)*pace;
    }
    const owner=[...this.home,...this.away].find(player=>player.id===this.ball.ownerId&&player.onField);
    if(owner){this.ball.x+=(owner.x-this.ball.x)*.30;this.ball.y+=(owner.y-this.ball.y)*.30;}
  };

  CareerMatchEngine.prototype.onMinute=function footballMinute(){
    if(this.minute===45&&this.phase==='first'){
      this.phase='halftime';this.paused=true;this.feed('Fim do primeiro tempo. As equipes vão para o intervalo.','halftime');this.emit('halftime',this.snapshot());return;
    }
    if(this.minute>=90){this.finish();return;}
    this.updateTactics?.();

    if(this.selection==='bench'&&!this.user&&this.minute>=this.subMinute){this.enterUserFromBench();return;}
    if(this.user?.onField)this.playerStats.minutes++;
    if(this.user?.onField&&this.user.energy>0){
      const phaseCost=this.matchFlow?.phase==='counter'?.12:this.matchFlow?.phase==='final'?.06:0;
      this.user.energy=clamp(this.user.energy-(.20+(this.teamTactics?.home?.tempo||50)/115+phaseCost),0,100);
    }
    if(this.maybeUserSubstitution?.())return;
    if(this.shouldUserMoment?.()){
      this.openUserMoment();
      return;
    }

    simulateFootballMinute(this);
    this.maybeContextualIncident?.();
    this.emit('state',this.snapshot());
  };

  Object.defineProperty(CareerMatchEngine.prototype,'__footballFlowPatched',{value:true,enumerable:false,configurable:false});
}
