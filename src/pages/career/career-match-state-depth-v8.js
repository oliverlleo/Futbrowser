import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const active=list=>(list||[]).filter(player=>player?.onField&&!player?.red);
const opponentTeam=team=>team==='home'?'away':'home';
const teamPlayers=(engine,team)=>team==='home'?engine.home:engine.away;
const attacksRight=(engine,team)=>team==='home'?engine.homeAttacksRight:!engine.homeAttacksRight;
const progressOf=(engine,team,x)=>attacksRight(engine,team)?Number(x||0):100-Number(x||0);

const ACTION_EFFECTS={
  pass:{momentum:2,threat:3,label:'Posse reorganizada'},
  chance:{momentum:4,threat:9,label:'Chance construída'},
  dribble:{momentum:4,threat:8,label:'Primeira linha quebrada'},
  cross:{momentum:3,threat:7,label:'Bola colocada na área'},
  run:{momentum:2,threat:5,label:'Espaço atacado'},
  sprint:{momentum:3,threat:7,label:'Profundidade criada'},
  support:{momentum:2,threat:2,label:'Linha de apoio criada'},
  defend:{momentum:3,threat:-5,label:'Bloco protegido'},
  interception:{momentum:5,threat:8,label:'Linha de passe fechada'},
  press:{momentum:5,threat:10,label:'Pressão virou recuperação'},
  tackle:{momentum:4,threat:5,label:'Duelo defensivo vencido'},
  risk:{momentum:-2,threat:3,label:'Saída de contra-ataque'},
  foul:{momentum:0,threat:-8,label:'Transição interrompida'},
  shot:{momentum:4,threat:0,label:'Ataque terminou em finalização'}
};

function ensureState(engine){
  if(engine.matchStateDepth)return engine.matchStateDepth;
  const team=engine.user?.team||'home';
  engine.matchStateDepth={
    momentum:{home:0,away:0},
    threat:{home:0,away:0},
    corridor:{left:0,central:0,right:0},
    possession:engine.possession||team,
    lastAction:null,
    lastImpact:null,
    lastPossessionChange:null,
    transitions:0,
    danger:0,
    minute:engine.minute||0,
    history:[]
  };
  return engine.matchStateDepth;
}

function userTeam(engine){return engine.user?.team||'home';}
function corridorOf(engine,player){
  if(!player)return'central';
  const y=Number(player.y||50);
  return y<34?'left':y>66?'right':'central';
}
function activeOpponent(engine){return active(teamPlayers(engine,opponentTeam(userTeam(engine))));}
function opponentPressure(engine){
  const user=engine.user;if(!user)return 50;
  const nearest=activeOpponent(engine).map(player=>Math.hypot(Number(player.x||50)-Number(user.x||50),Number(player.y||50)-Number(user.y||50))).sort((a,b)=>a-b)[0]??20;
  return clamp(78-nearest*3.8+(engine.playState?.pressureBias||0),5,96);
}
function actionEffect(choice={},success){
  const tags=choice.tags||[];
  const tag=Object.keys(ACTION_EFFECTS).find(key=>tags.includes(key));
  const base=ACTION_EFFECTS[tag||'pass'];
  if(success)return{...base,tag};
  return{momentum:-Math.max(1,Math.round(Math.abs(base.momentum)*.8)),threat:-Math.max(2,Math.round(Math.abs(base.threat||3)*.7)),label:'Rota neutralizada',tag};
}
function updateMomentum(engine,team,delta){
  const state=ensureState(engine);
  state.momentum[team]=clamp(Number(state.momentum[team]||0)+Number(delta||0),-30,30);
}
function updateThreat(engine,team,delta){
  const state=ensureState(engine);
  state.threat[team]=clamp(Number(state.threat[team]||0)+Number(delta||0),0,45);
}
function setCorridor(engine,player,delta){
  const state=ensureState(engine),corridor=corridorOf(engine,player);
  state.corridor[corridor]=clamp(Number(state.corridor[corridor]||0)+Number(delta||0),-20,30);
}
function recomputeDanger(engine){
  const state=ensureState(engine),opp=opponentTeam(userTeam(engine)),oppProgress=active(teamPlayers(engine,opp)).reduce((max,p)=>Math.max(max,progressOf(engine,opp,p.x)),0);
  const userThreat=Number(state.threat[userTeam(engine)]||0),oppThreat=Number(state.threat[opp]||0);
  state.danger=clamp(Math.round(oppThreat*.9+Math.max(0,oppProgress-62)*.42-userThreat*.18),0,100);
  state.possession=engine.possession||state.possession;
  state.minute=engine.minute||0;
  return state.danger;
}
function tacticalWindow(engine){
  const state=ensureState(engine),team=userTeam(engine),opp=opponentTeam(team),possession=engine.possession;
  const transition=engine.matchFlow?.phase==='counter'||Number(engine.matchFlow?.transitionUntil||-1)>=Number(engine.minute||0);
  if(transition&&possession===team)return{key:'counter',label:'Transição aberta',detail:'Você recuperou espaço antes de o rival reorganizar o bloco.'};
  if(possession===team&&state.threat[team]>=22)return{key:'progression',label:'Ataque em progressão',detail:'A posse já atravessou a primeira linha; a próxima escolha pode aumentar o perigo.'};
  if(possession===team)return{key:'rebuild',label:'Posse em reorganização',detail:'O time tem a bola e procura uma rota segura para progredir.'};
  if(state.danger>=52)return{key:'danger',label:'Rival em zona perigosa',detail:'A prioridade é reduzir o perigo antes de tentar recuperar a bola.'};
  return{key:'settled',label:'Bloco se ajustando',detail:'O adversário tem a bola, mas ainda não encontrou uma rota limpa.'};
}
function stateSnapshot(engine){
  const state=ensureState(engine),team=userTeam(engine),opp=opponentTeam(team),window=tacticalWindow(engine),danger=recomputeDanger(engine);
  return{
    ...window,
    danger,
    possession:engine.possession,
    momentum:{home:Math.round(state.momentum.home),away:Math.round(state.momentum.away)},
    userMomentum:Math.round(state.momentum[team]),
    opponentMomentum:Math.round(state.momentum[opp]),
    threat:{home:Math.round(state.threat.home),away:Math.round(state.threat.away)},
    corridor:{...state.corridor},
    transitions:Number(state.transitions||0),
    sequence:Number(engine.playState?.sequence||0),
    lastImpact:state.lastImpact?{...state.lastImpact}:null,
    lastAction:state.lastAction?{...state.lastAction}:null
  };
}
function storeHistory(engine,entry){
  const state=ensureState(engine);state.history.push(entry);if(state.history.length>24)state.history.shift();
}
function impactText(engine,effect,choice,success,before){
  const state=ensureState(engine),team=userTeam(engine),possessionChanged=before.possession!==engine.possession;
  if(!success)return'Você perdeu a disputa e o adversário ganhou tempo para reorganizar ou acelerar.';
  if(choice.tags?.includes('shot'))return'Você encerrou a sequência com finalização; a segunda bola pode definir a próxima posse.';
  if(possessionChanged&&engine.possession===team)return'A ação mudou o dono da bola e abriu uma transição para sua equipe.';
  if(choice.tags?.includes('defend')||choice.tags?.includes('tackle')||choice.tags?.includes('interception'))return'Você reduziu a rota mais perigosa e manteve o time compacto.';
  if(state.threat[team]>=20)return'A equipe manteve a posse em zona útil e aumentou a ameaça do ataque.';
  return'Você alterou o desenho da jogada; a próxima decisão parte de um contexto diferente.';
}
function applyAction(engine,choice,result,before){
  const state=ensureState(engine),team=userTeam(engine),opp=opponentTeam(team),success=Boolean(result?.success),effect=actionEffect(choice,success),possessionChanged=before.possession!==engine.possession;
  updateMomentum(engine,team,effect.momentum);
  updateMomentum(engine,opp,success?-(choice.tags?.includes('defend')||choice.tags?.includes('press')?3:1):2);
  updateThreat(engine,team,effect.threat);
  if(choice.tags?.includes('shot'))updateThreat(engine,team,-12);
  if(choice.tags?.includes('foul'))updateThreat(engine,opp,-5);
  if(choice.tags?.includes('dribble')||choice.tags?.includes('run')||choice.tags?.includes('sprint'))setCorridor(engine,engine.user,success?5:-3);
  if(choice.tags?.includes('cross'))setCorridor(engine,engine.user,success?4:-2);
  if(choice.tags?.includes('defend')||choice.tags?.includes('interception')||choice.tags?.includes('tackle'))setCorridor(engine,engine.user,success?3:-3);
  const transition=engine.matchFlow?.phase==='counter'||Number(engine.matchFlow?.transitionUntil||-1)>=Number(engine.minute||0);
  if(success&&transition&&engine.possession===team)state.transitions=Number(state.transitions||0)+1;
  if(before.possession!==engine.possession)state.lastPossessionChange={minute:engine.minute,from:before.possession,to:engine.possession};
  const impact={
    label:effect.label,
    detail:impactText(engine,effect,choice,success,before),
    success,
    possessionChanged,
    team,
    minute:engine.minute,
    threat:Math.round(state.threat[team]),
    danger:recomputeDanger(engine)
  };
  state.lastImpact=impact;state.lastAction={key:choice.key,label:choice.label,success,minute:engine.minute};
  storeHistory(engine,{...impact,action:choice.key});
  result.tacticalImpact=impact;result.tacticalState=stateSnapshot(engine);
}
function decayState(engine){
  const state=ensureState(engine),team=userTeam(engine),opp=opponentTeam(team);
  state.momentum.home*=.94;state.momentum.away*=.94;state.threat.home=Math.max(0,state.threat.home-1.2);state.threat.away=Math.max(0,state.threat.away-1.2);
  if(state.possession!==engine.possession){state.lastPossessionChange={minute:engine.minute,from:state.possession,to:engine.possession};state.possession=engine.possession;updateMomentum(engine,engine.possession,1);updateMomentum(engine,engine.possession===team?opp:team,-1);}
  if(engine.score?.[team]>engine.score?.[opp]){state.momentum[team]+=0.12;state.threat[opp]=Math.max(0,state.threat[opp]-.2);}else if(engine.score?.[opp]>engine.score?.[team])state.momentum[opp]+=0.12;
  recomputeDanger(engine);state.minute=engine.minute;
}
function choiceEvent(engine,result,choice){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new CustomEvent('career:match-state-updated-v8',{detail:{engine,result,choice,state:stateSnapshot(engine)}}));
}

if(!CareerMatchEngine.prototype.__matchStateDepthV8Installed){
  const previousStart=CareerMatchEngine.prototype.start;
  const previousChoose=CareerMatchEngine.prototype.choose;
  const previousOnMinute=CareerMatchEngine.prototype.onMinute;
  const previousSnapshot=CareerMatchEngine.prototype.snapshot;
  const previousResult=CareerMatchEngine.prototype.result;

  CareerMatchEngine.prototype.start=function(...args){
    ensureState(this);const result=previousStart.apply(this,args);ensureState(this);recomputeDanger(this);return result;
  };
  CareerMatchEngine.prototype.choose=function matchStateDepthChoose(key){
    const choice=this.pendingDecision?.options?.find(option=>option.key===key),before={possession:this.possession,score:{...this.score},energy:Number(this.user?.energy||0)};
    const result=previousChoose.call(this,key);
    if(!choice||!result)return result;
    applyAction(this,choice,result,before);choiceEvent(this,result,choice);return result;
  };
  CareerMatchEngine.prototype.onMinute=function matchStateDepthMinute(...args){
    const result=previousOnMinute.apply(this,args);decayState(this);return result;
  };
  CareerMatchEngine.prototype.snapshot=function matchStateDepthSnapshot(...args){
    const snapshot=previousSnapshot.apply(this,args);return{...snapshot,tacticalState:stateSnapshot(this)};
  };
  CareerMatchEngine.prototype.result=function matchStateDepthResult(...args){
    const result=previousResult.apply(this,args);return{...result,tacticalState:stateSnapshot(this),tacticalTimeline:ensureState(this).history.slice(-24)};
  };
  Object.defineProperty(CareerMatchEngine.prototype,'__matchStateDepthV8Installed',{value:true,enumerable:false,configurable:false});
}

export { stateSnapshot, tacticalWindow };
