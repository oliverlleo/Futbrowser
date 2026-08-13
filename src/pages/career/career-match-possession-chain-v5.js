import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';
import { deriveOpponentRatings } from './career-match-action-balance-v4.js?v=20260813-1';

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const active=list=>(list||[]).filter(player=>player?.onField&&!player?.red);
const opponentTeam=team=>team==='home'?'away':'home';
const teamPlayers=(engine,team)=>team==='home'?engine.home:engine.away;
const attacksRight=(engine,team)=>team==='home'?engine.homeAttacksRight:!engine.homeAttacksRight;
const direction=(engine,team)=>attacksRight(engine,team)?1:-1;
const progressOf=(engine,team,x)=>attacksRight(engine,team)?Number(x||0):100-Number(x||0);

const PHASE_RANK={buildup:0,build:1,midfield:2,progression:3,final:4,counter:3};
const OFF_BALL_RUN=new Set(['off_near','off_far','off_cutback','off_depth','off_blind','sup_late','sup_second','attack_second']);
const SECOND_BALL=new Set(['off_edge','hold_edge']);
const SUPPORT_RECEIVE=new Set(['off_short','sup_short']);
const ONE_TWO=new Set(['central_wall','wide_wall']);
const CHANCE_PASS=new Set(['central_killer','box_square']);
const PROGRESSIVE_PASS=new Set(['central_vertical','build_draw','build_diagonal']);
const LAYOFF=new Set(['box_layoff']);

function rawProfile(engine,livePlayer){
  if(!livePlayer)return null;
  const side=livePlayer.team||engine.user?.team||'home';
  const raw=(engine.context?.[side]?.players||[]).find(player=>String(player.id)===String(livePlayer.id));
  return raw?{...livePlayer,...raw}:livePlayer;
}
function ratingsFor(engine,livePlayer){return deriveOpponentRatings(rawProfile(engine,livePlayer)||{ovr:55});}
function putBall(engine,player){
  if(!player)return;
  engine.ball.ownerId=player.id;
  engine.ball.x=player.x;
  engine.ball.y=player.y;
}
function liveOwner(engine,id){return[...engine.home,...engine.away].find(player=>String(player.id)===String(id)&&player.onField)||null;}
function nearestOpponent(engine,player){
  if(!player)return null;
  return active(teamPlayers(engine,opponentTeam(player.team))).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0]||null;
}
function bestAttackingReceiver(engine,team,excludeId=null){
  const candidates=active(teamPlayers(engine,team)).filter(player=>player.id!==excludeId&&player.role!=='gk');
  return candidates.sort((a,b)=>{
    const pa=progressOf(engine,team,a.x),pb=progressOf(engine,team,b.x);
    const ra=['st','wing','am'].includes(a.role)?8:0,rb=['st','wing','am'].includes(b.role)?8:0;
    return(pb+rb+Number(b.ovr||55)*.08)-(pa+ra+Number(a.ovr||55)*.08);
  })[0]||null;
}
function setProgress(engine,player,target){
  if(!player)return;
  const p=clamp(target,4,96);
  player.x=attacksRight(engine,player.team)?p:100-p;
  if(engine.ball?.ownerId===player.id){engine.ball.x=player.x;engine.ball.y=player.y;}
}
function phaseForProgress(progress){if(progress>=80)return'final';if(progress>=64)return'progression';if(progress>=45)return'midfield';if(progress>=28)return'build';return'buildup';}

export function classifyCareerAction(choice={}){
  const key=String(choice.key||''),tags=choice.tags||[];
  if(tags.includes('shot'))return'shot';
  if(ONE_TWO.has(key))return'one_two';
  if(OFF_BALL_RUN.has(key))return'off_ball_run';
  if(SECOND_BALL.has(key))return'second_ball';
  if(SUPPORT_RECEIVE.has(key))return'support_receive';
  if(CHANCE_PASS.has(key))return'chance_pass';
  if(PROGRESSIVE_PASS.has(key))return'progressive_pass';
  if(LAYOFF.has(key))return'layoff';
  if(tags.includes('cross'))return'cross';
  if(tags.includes('dribble'))return'dribble';
  if(tags.includes('pass'))return'pass';
  if(tags.includes('tackle'))return'tackle';
  if(tags.includes('interception'))return'interception';
  if(tags.includes('press'))return'press';
  if(tags.includes('defend'))return'defend';
  if(tags.includes('run')||tags.includes('sprint'))return'run';
  if(tags.includes('support'))return'support';
  if(tags.includes('foul'))return'foul';
  if(tags.includes('risk'))return'risk';
  return'other';
}

export function normalizeCareerChoice(choice={}){
  const actionType=classifyCareerAction(choice),tags=[...(choice.tags||[])];
  let normalized=tags;
  if(actionType==='off_ball_run'){
    normalized=tags.filter(tag=>tag!=='chance'&&tag!=='pass'&&tag!=='support');
    if(!normalized.includes('run'))normalized.push('run');
  }else if(actionType==='second_ball'){
    normalized=tags.filter(tag=>tag!=='chance'&&tag!=='pass'&&tag!=='run');
    if(!normalized.includes('support'))normalized.push('support');
  }else if(actionType==='support_receive'){
    normalized=tags.filter(tag=>tag!=='chance'&&tag!=='pass'&&tag!=='run');
    if(!normalized.includes('support'))normalized.push('support');
  }
  return{...choice,actionType,tags:[...new Set(normalized)]};
}

function ensureChain(engine){
  const team=engine.user?.team||'home';
  if(!engine.userPlayChain||engine.userPlayChain.possessionTeam!==engine.possession){
    engine.userPlayChain={
      possessionTeam:engine.possession,
      phase:engine.matchFlow?.phase||'buildup',
      threat:0,
      actions:0,
      startedMinute:engine.minute,
      lastOutcome:null,
      sequenceId:Number(engine.matchFlow?.sequenceId||1)
    };
  }
  if(engine.possession!==team)engine.userPlayChain.threat=0;
  return engine.userPlayChain;
}
function resetChain(engine,reason='possession_end'){
  engine.userPlayChain={possessionTeam:engine.possession,phase:engine.matchFlow?.phase||'buildup',threat:0,actions:0,startedMinute:engine.minute,lastOutcome:reason,sequenceId:Number(engine.matchFlow?.sequenceId||1)};
}
function advanceFlow(engine,phase,threat=0){
  const chain=ensureChain(engine),current=engine.matchFlow?.phase||chain.phase||'buildup';
  const target=(PHASE_RANK[phase]??0)>=(PHASE_RANK[current]??0)?phase:current;
  chain.phase=target;chain.threat=clamp(chain.threat+threat,0,60);chain.actions++;
  if(engine.matchFlow){
    engine.matchFlow.phase=target;
    engine.matchFlow.possessionTeam=engine.possession;
    if(target==='final')engine.matchFlow.tempoMode='attacking';
  }
  return chain;
}
function ratingDelta(engine,value,reason){
  engine.rating=clamp(Math.round((Number(engine.rating||6)+value)*10)/10,1,10);
  engine.ratingLog ||= [];
  engine.ratingLog.push({minute:engine.minute,value,reason,rating:engine.rating});
}
function stat(engine,team,key,inc=1){engine.stats[team][key]=(engine.stats[team][key]||0)+inc;}

function contextOf(choice){return choice?.context||{pressure:50,space:50,markers:1,progress:50,angle:50};}
function localDefense(engine){
  const user=engine.user;if(!user)return55;
  const defenders=active(teamPlayers(engine,opponentTeam(user.team))).map(player=>({player,distance:Math.hypot(player.x-user.x,player.y-user.y)})).sort((a,b)=>a.distance-b.distance).slice(0,3).map(entry=>ratingsFor(engine,entry.player).defending);
  return defenders.length?defenders.reduce((sum,value)=>sum+value,0)/defenders.length:Number(engine.directOpponent?.ovr||55);
}

export function estimateServiceChance(engine,choice,passer=null){
  const ctx=contextOf(choice),owner=passer||liveOwner(engine,engine.ball?.ownerId),r=ratingsFor(engine,owner||{ovr:55}),chain=ensureChain(engine);
  const passing=r.passing*.54+r.vision*.34+r.ovr*.12;
  const defense=localDefense(engine);
  let chance=.71+(passing-55)*.0046+(Number(ctx.space||50)-50)*.0018-(Number(ctx.pressure||50)-50)*.0017-Math.max(0,Number(ctx.markers||1)-1)*.035-(defense-55)*.0018+chain.threat*.0014;
  if(String(choice?.key||'')==='off_depth')chance-=.045;
  if(String(choice?.key||'')==='off_cutback')chance+=.035;
  return clamp(chance,.48,.94);
}
function estimateReturnChance(engine,choice,receiver){
  const ctx=contextOf(choice),r=ratingsFor(engine,receiver||{ovr:55}),defense=localDefense(engine);
  return clamp(.78+(r.passing-55)*.004+(r.vision-55)*.002+(Number(ctx.space||50)-50)*.0015-(Number(ctx.pressure||50)-50)*.0013-(defense-55)*.0015,.52,.95);
}
function estimateSecondBallChance(engine,choice){
  const ctx=contextOf(choice),positioning=Number(engine.userSkills?.positioning||engine.user?.ovr||50),defense=localDefense(engine);
  return clamp(.64+(positioning-55)*.005+(Number(ctx.space||50)-50)*.0015-(defense-55)*.002-Math.max(0,Number(ctx.markers||1)-1)*.035,.42,.90);
}

function directOpponentProfile(engine){
  const live=nearestOpponent(engine,engine.user)||engine.directOpponent;
  return ratingsFor(engine,live||{ovr:55});
}
function chooseKeeper(engine,team){return active(teamPlayers(engine,opponentTeam(team))).find(player=>player.role==='gk')||null;}
function resetAfterShot(engine,team){
  const opponent=opponentTeam(team),keeper=chooseKeeper(engine,team)||active(teamPlayers(engine,opponent))[0];
  engine.possession=opponent;if(keeper)putBall(engine,keeper);
  if(engine.matchFlow){engine.matchFlow.phase='buildup';engine.matchFlow.passCount=0;engine.matchFlow.possessionTeam=opponent;engine.matchFlow.possessionStartedMinute=engine.minute;engine.matchFlow.sequenceId=(engine.matchFlow.sequenceId||0)+1;}
  resetChain(engine,'shot');
}

function resolveTeammateShot(engine,shooter,choice,{assist=true,qualityBoost=0,label=''}={}){
  if(!shooter)return{shot:false,goal:false,onTarget:false,text:'A defesa consegue fechar antes da finalização.'};
  const team=engine.user.team,ctx=contextOf(choice),ratings=ratingsFor(engine,shooter),keeper=chooseKeeper(engine,team),keeperOvr=Number(rawProfile(engine,keeper)?.ovr||keeper?.ovr||55),defense=directOpponentProfile(engine);
  const pressure=Number(ctx.pressure||50),space=Number(ctx.space||50),markers=Number(ctx.markers||1);
  const onTargetChance=clamp(.49+(ratings.finishing-55)*.006+(space-50)*.0015-(pressure-50)*.0018-Math.max(0,markers-1)*.028-(defense.defending-58)*.0015+qualityBoost,.20,.86);
  const goalGivenTarget=clamp(.29+(ratings.finishing-keeperOvr)*.006+(space-50)*.0013-(pressure-50)*.0012+qualityBoost*.55,.10,.68);
  stat(engine,team,'shots');engine.playerStats.chancesCreated=(engine.playerStats.chancesCreated||0)+1;
  engine.feed(`${label||'A jogada encontra'} ${shooter.name} em condição de finalizar!`,'shot',shooter);
  const onTarget=engine.rng()<onTargetChance,goal=onTarget&&engine.rng()<goalGivenTarget;
  if(goal){
    stat(engine,team,'shotsOnTarget');stat(engine,team,'goals');engine.score[team]++;
    if(assist){engine.playerStats.assists=(engine.playerStats.assists||0)+1;ratingDelta(engine,.75,'Assistência');}
    engine.feed(`GOOOL! ${shooter.name} aproveita a jogada criada por ${engine.user.name}!`,'goal',shooter);
    resetAfterShot(engine,team);
    return{shot:true,goal:true,onTarget:true,text:`Seu lance deixou ${shooter.name} em condição real e ele marcou.`};
  }
  if(onTarget){stat(engine,team,'shotsOnTarget');engine.feed('O goleiro salva a finalização criada pela jogada.','shot_saved',keeper);}
  else engine.feed('A finalização criada pela jogada sai para fora.','shot_off',shooter);
  resetAfterShot(engine,team);
  return{shot:true,goal:false,onTarget,text:`Seu lance gerou a finalização de ${shooter.name}, mas o gol não saiu.`};
}

function plan(key,title,{chainZero=false}={}){return{key,title,chainZero};}
function moveForRun(engine,choice){
  const user=engine.user,now=progressOf(engine,user.team,user.x),key=String(choice.key||'');
  let gain=key==='off_depth'?12:key==='off_near'||key==='off_far'?8:key==='off_cutback'?6:key==='sup_late'?9:key==='sup_second'?6:7;
  const ctx=contextOf(choice);gain+=Math.max(0,(Number(ctx.space||50)-55)*.03);
  setProgress(engine,user,Math.min(94,now+gain));
  if(key==='off_cutback'||key==='sup_late')user.y=50+(user.y-50)*.55;
}
function moveForOneTwo(engine,choice){
  const user=engine.user,now=progressOf(engine,user.team,user.x),gain=String(choice.key||'')==='wide_wall'?8:9;
  setProgress(engine,user,Math.min(94,now+gain));
  if(String(choice.key||'')==='wide_wall')user.y+=(50-user.y)*.20;
}
function continuationForUserBall(engine,title){
  const p=progressOf(engine,engine.user.team,engine.user.x);
  return plan(p>=79?'box_ball':Math.abs(engine.user.y-50)>18&&p>52?'wide_ball':'central_ball',title);
}

function applyConsequence(engine,choice,result,before){
  const type=choice.actionType||classifyCareerAction(choice),team=engine.user?.team||'home',ctx=contextOf(choice);
  result.actionType=type;result.outcomeTier=result.success?'success':'fail';result.outcomeText=null;result.continuation=false;
  if(!result.success){
    if(engine.possession!==team)resetChain(engine,'turnover');
    result.outcomeText=engine.possession===team?'A tentativa não criou vantagem e a jogada segue pressionada.':'A tentativa foi neutralizada e a posse mudou de lado.';
    return null;
  }

  if(type==='shot'){
    result.outcomeText=result.shotOutcome?.goal?'Você concluiu a jogada em gol.':result.shotOutcome?.onTarget?'A finalização foi no alvo, mas o goleiro defendeu.':result.shotOutcome?.blocked?'A defesa bloqueou a finalização.':'A finalização não encontrou o alvo.';
    resetChain(engine,'shot');return null;
  }

  if(type==='dribble'){
    if(engine.possession===team&&engine.ball?.ownerId===engine.user.id){
      const phase=phaseForProgress(progressOf(engine,team,engine.user.x));advanceFlow(engine,phase,15);
      result.outcomeText='Você eliminou o marcador, ganhou terreno e continua com a bola.';result.continuation=true;
      return continuationForUserBall(engine,'Você venceu o duelo e a jogada ganhou uma nova vantagem');
    }
    return null;
  }

  if(type==='off_ball_run'){
    const passer=liveOwner(engine,before.ballOwner)||bestAttackingReceiver(engine,team,engine.user.id),service=estimateServiceChance(engine,choice,passer);
    moveForRun(engine,choice);advanceFlow(engine,phaseForProgress(progressOf(engine,team,engine.user.x)),13);
    if(engine.rng()<service){
      engine.possession=team;putBall(engine,engine.user);advanceFlow(engine,phaseForProgress(progressOf(engine,team,engine.user.x)),7);
      result.serviceChance=Math.round(service*100);result.outcomeText='Sua movimentação venceu a marcação e o passe encontrou você em uma zona melhor.';result.continuation=true;
      return continuationForUserBall(engine,'A movimentação funcionou e você recebe para continuar o ataque');
    }
    engine.possession=team;if(passer)putBall(engine,passer);
    result.serviceChance=Math.round(service*100);result.outcomeTier='partial';result.outcomeText='Você escapou da marcação, mas o companheiro não conseguiu colocar o passe no seu caminho.';
    return null;
  }

  if(type==='support_receive'){
    const passer=liveOwner(engine,before.ballOwner)||bestAttackingReceiver(engine,team,engine.user.id),service=clamp(estimateServiceChance(engine,choice,passer)+.05,.55,.96);
    setProgress(engine,engine.user,Math.min(88,progressOf(engine,team,engine.user.x)+3));advanceFlow(engine,phaseForProgress(progressOf(engine,team,engine.user.x)),5);
    if(engine.rng()<service){engine.possession=team;putBall(engine,engine.user);result.outcomeText='Você ofereceu a linha de passe e recebeu para dar sequência.';result.continuation=true;return continuationForUserBall(engine,'Você recebe no apoio e pode acelerar ou reorganizar');}
    engine.possession=team;if(passer)putBall(engine,passer);result.outcomeTier='partial';result.outcomeText='Você deu a linha de passe correta, mas a circulação seguiu por outro companheiro.';return null;
  }

  if(type==='second_ball'){
    const chance=estimateSecondBallChance(engine,choice);advanceFlow(engine,'final',8);
    if(engine.rng()<chance){setProgress(engine,engine.user,Math.max(78,progressOf(engine,team,engine.user.x)));engine.possession=team;putBall(engine,engine.user);result.outcomeText='Você leu a sobra e ficou com a segunda bola perto da área.';result.continuation=true;return continuationForUserBall(engine,'A segunda bola sobra para você na zona de decisão');}
    result.outcomeTier='partial';result.outcomeText='Seu posicionamento foi correto, mas a sobra caiu em outra zona.';return null;
  }

  if(type==='one_two'){
    const receiver=liveOwner(engine,engine.ball?.ownerId)||bestAttackingReceiver(engine,team,engine.user.id),returnChance=estimateReturnChance(engine,choice,receiver);moveForOneTwo(engine,choice);advanceFlow(engine,phaseForProgress(progressOf(engine,team,engine.user.x)),12);
    if(receiver&&engine.rng()<returnChance){engine.possession=team;putBall(engine,engine.user);result.returnChance=Math.round(returnChance*100);result.outcomeText='A tabela funcionou: você passou, ultrapassou a marcação e recebeu de volta.';result.continuation=true;return continuationForUserBall(engine,'A devolução chega e você rompe a linha');}
    result.returnChance=Math.round(returnChance*100);result.outcomeTier='partial';result.outcomeText='O primeiro passe entrou e você atacou o espaço, mas a devolução não conseguiu voltar.';return null;
  }

  if(type==='chance_pass'){
    const receiver=liveOwner(engine,engine.ball?.ownerId)||bestAttackingReceiver(engine,team,engine.user.id);advanceFlow(engine,'final',18);
    const shot=resolveTeammateShot(engine,receiver,choice,{assist:true,qualityBoost:String(choice.key||'')==='box_square'?.10:.07,label:'Seu passe encontra'});
    result.createdShot=shot.shot;result.createdGoal=shot.goal;result.outcomeText=shot.text;result.outcomeTier=shot.goal?'success':'progress';return null;
  }

  if(type==='layoff'){
    const receiver=liveOwner(engine,engine.ball?.ownerId)||bestAttackingReceiver(engine,team,engine.user.id);advanceFlow(engine,'final',11);
    const shotChance=clamp(.52+(Number(ctx.space||50)-50)*.003-(Number(ctx.pressure||50)-50)*.002,.30,.78);
    if(receiver&&engine.rng()<shotChance){const shot=resolveTeammateShot(engine,receiver,choice,{assist:true,qualityBoost:.035,label:'Sua escorada deixa'});result.createdShot=shot.shot;result.createdGoal=shot.goal;result.outcomeText=shot.text;result.outcomeTier=shot.goal?'success':'progress';return null;}
    result.outcomeText='A escorada manteve o ataque instalado perto da área e você gira para participar de novo.';result.outcomeTier='progress';result.continuation=true;return plan('off_ball_attack','Depois da escorada, você volta a atacar o espaço');
  }

  if(type==='cross'){
    const target=bestAttackingReceiver(engine,team,engine.user.id);advanceFlow(engine,'final',12);
    const shotChance=clamp(.62+(Number(ctx.space||50)-50)*.002-(Number(ctx.pressure||50)-50)*.002,.38,.82);
    if(target&&engine.rng()<shotChance){const shot=resolveTeammateShot(engine,target,choice,{assist:true,qualityBoost:.015,label:'Seu cruzamento encontra'});result.createdShot=shot.shot;result.createdGoal=shot.goal;result.outcomeText=shot.text;result.outcomeTier=shot.goal?'success':'progress';return null;}
    if(target){engine.possession=team;putBall(engine,target);}result.outcomeText='O cruzamento venceu a primeira marcação e manteve a bola viva dentro do último terço.';result.outcomeTier='progress';
    if(engine.rng()<.38){result.continuation=true;return plan('off_ball_attack','A defesa afasta mal e você se prepara para a segunda bola');}
    return null;
  }

  if(type==='progressive_pass'||type==='pass'){
    const receiver=liveOwner(engine,engine.ball?.ownerId),receiverProgress=receiver?progressOf(engine,team,receiver.x):Number(ctx.progress||50),beforeProgress=Number(before.userProgress||50),gain=receiverProgress-beforeProgress;
    const progressive=type==='progressive_pass'||gain>8;
    advanceFlow(engine,phaseForProgress(Math.max(receiverProgress,beforeProgress+(progressive?6:0))),progressive?8:2);
    if(progressive){
      result.outcomeText='O passe quebrou uma linha e empurrou a posse para uma zona mais perigosa.';result.outcomeTier='progress';
      const chain=ensureChain(engine),role=engine.user.role,followChance=clamp(.26+chain.threat*.006+(['st','wing','am'].includes(role)?.12:0),.22,.62);
      if(engine.possession===team&&engine.rng()<followChance){setProgress(engine,engine.user,Math.min(92,progressOf(engine,team,engine.user.x)+5));result.continuation=true;return plan('off_ball_attack','Depois do passe vertical, você continua a movimentação para receber de novo');}
    }else result.outcomeText='O passe manteve a posse sem forçar uma jogada que não existia.';
    return null;
  }

  if(['tackle','interception','defend','press'].includes(type)){
    if(engine.possession===team&&engine.ball?.ownerId===engine.user.id){advanceFlow(engine,'build',5);result.outcomeText='Você recuperou a bola e agora pode transformar a ação defensiva em saída.';result.continuation=true;return continuationForUserBall(engine,'A recuperação é sua e a transição começa nos seus pés');}
    result.outcomeText='A ação defensiva funcionou e sua equipe reorganizou a posse.';return null;
  }

  if(type==='run'&&engine.possession===team&&engine.ball?.ownerId===engine.user.id){advanceFlow(engine,phaseForProgress(progressOf(engine,team,engine.user.x)),7);result.outcomeText='A corrida ganhou metros e você continua com a bola.';result.continuation=true;return continuationForUserBall(engine,'Você ganhou terreno e encontra uma nova decisão');}

  if(type==='support'){advanceFlow(engine,engine.matchFlow?.phase||'midfield',2);result.outcomeText='Seu apoio deu continuidade à posse e ajudou a equipe a manter a estrutura.';}
  return null;
}

function emitContinuation(engine,next,sourceChain){
  if(!next||!engine.user?.onField||engine.phase==='final')return false;
  const team=engine.user.team;if(engine.possession!==team&&next.key!=='defensive_read'&&next.key!=='recovery_choice')return false;
  engine.pendingDecision={situation:{key:next.key,title:next.title},options:[],chain:next.chainZero?0:Number(sourceChain||0)+1};
  engine.awaitingDecision=true;engine.paused=true;
  engine.emit('decision',{minute:engine.minute,title:next.title,options:[],energy:engine.user.energy,rating:engine.rating,instruction:engine.coachInstruction,chain:true,directOpponent:engine.directOpponent?{name:engine.directOpponent.name,position:engine.directOpponent.position,ovr:engine.directOpponent.ovr}:null});
  return true;
}

function alignAttackerWithFlow(engine){
  const user=engine.user;if(!user?.onField||!['st','wing','am'].includes(user.role)||engine.possession!==user.team)return;
  const phase=engine.matchFlow?.phase||ensureChain(engine).phase,positioning=Number(engine.userSkills?.positioning||user.ovr||50),current=progressOf(engine,user.team,user.x);
  const base=phase==='final'?80:phase==='counter'?76:phase==='progression'?68:null;if(base==null)return;
  const target=base+clamp((positioning-50)*.10,0,6)+clamp((ensureChain(engine).threat||0)*.08,0,4);
  if(current<target){setProgress(engine,user,Math.min(target,current+8));if(engine.ball?.ownerId===user.id){engine.ball.x=user.x;engine.ball.y=user.y;}}
}

if(!CareerMatchEngine.prototype.__possessionChainV5Installed){
  const previousEmit=CareerMatchEngine.prototype.emit;
  const previousChoose=CareerMatchEngine.prototype.choose;
  const previousStart=CareerMatchEngine.prototype.start;
  const previousOnMinute=CareerMatchEngine.prototype.onMinute;
  const previousOpenMoment=CareerMatchEngine.prototype.openUserMoment;

  CareerMatchEngine.prototype.emit=function possessionChainEmit(name,payload){
    if(name==='decision'&&payload?.options){
      const options=payload.options.map(normalizeCareerChoice);
      payload={...payload,options};
      if(this.pendingDecision)this.pendingDecision.options=options;
    }
    return previousEmit.call(this,name,payload);
  };

  CareerMatchEngine.prototype.start=function possessionChainStart(...args){
    const result=previousStart.apply(this,args);ensureChain(this);return result;
  };

  CareerMatchEngine.prototype.openUserMoment=function possessionChainMoment(...args){alignAttackerWithFlow(this);return previousOpenMoment.apply(this,args);};

  CareerMatchEngine.prototype.onMinute=function possessionChainMinute(...args){
    const before=this.possession,result=previousOnMinute.apply(this,args);
    if(before!==this.possession)resetChain(this,'possession_change');
    return result;
  };

  CareerMatchEngine.prototype.choose=function possessionChainChoose(key){
    const pending=this.pendingDecision,choice=pending?.options?.find(option=>option.key===key);
    if(!choice)return previousChoose.call(this,key);
    const sourceSituation=pending?.situation?.key||null,sourceTitle=pending?.situation?.title||null,sourceChain=Number(pending?.chain||0),team=this.user?.team||'home';
    const before={ballOwner:this.ball?.ownerId,ballX:this.ball?.x,ballY:this.ball?.y,possession:this.possession,userProgress:this.user?progressOf(this,team,this.user.x):50,goals:Number(this.playerStats?.goals||0),assists:Number(this.playerStats?.assists||0)};
    const originalTags=[...(choice.tags||[])],type=choice.actionType||classifyCareerAction(choice);

    // The old core creates its own two-step follow-up and routes any `chance` tag
    // through the pass resolver. V5 owns continuity, so suppress only those legacy
    // mechanics while preserving the displayed/action-balance metadata.
    if(this.pendingDecision)this.pendingDecision.chain=99;
    if(type==='chance_pass')choice.tags=originalTags.filter(tag=>tag!=='chance');

    const result=previousChoose.call(this,key);
    choice.tags=originalTags;
    if(!result)return result;
    result.choice=choice;result.sourceSituation=sourceSituation;
    const next=applyConsequence(this,choice,result,before);

    // Keep the source situation alive until gameplay-depth records the resolved
    // decision. This also blocks its legacy 3-action continuation. The real next
    // situation is materialized in a microtask after every wrapper has finished.
    this.pendingDecision={situation:{key:sourceSituation,title:sourceTitle},options:[],chain:sourceChain,__v5ResolvedPlaceholder:true};
    this.awaitingDecision=true;this.paused=true;

    queueMicrotask(()=>{
      let continued=false;
      if(next)continued=emitContinuation(this,next,sourceChain);
      if(!continued){this.pendingDecision=null;this.awaitingDecision=false;}
      result.continuation=continued;
      if(typeof window!=='undefined'){
        window.dispatchEvent(new CustomEvent('career:match-choice-resolved-v5',{detail:{engine:this,result,choice,sourceSituation,continued}}));
        clearTimeout(this.__v5FeedbackFallback);
        this.__v5FeedbackFallback=setTimeout(()=>{if(!this.awaitingDecision&&this.paused)this.paused=false;},4200);
      }else if(!continued)this.paused=false;
    });
    return result;
  };

  Object.defineProperty(CareerMatchEngine.prototype,'__possessionChainV5Installed',{value:true,enumerable:false,configurable:false});
}
