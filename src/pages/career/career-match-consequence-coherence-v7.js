import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const active=list=>(list||[]).filter(player=>player?.onField&&!player?.red);
const opponentTeam=team=>team==='home'?'away':'home';
const teamPlayers=(engine,team)=>team==='home'?engine.home:engine.away;
const attacksRight=(engine,team)=>team==='home'?engine.homeAttacksRight:!engine.homeAttacksRight;
const progressOf=(engine,team,x)=>attacksRight(engine,team)?Number(x||0):100-Number(x||0);

function putBall(engine,player){if(!player)return;engine.ball.ownerId=player.id;engine.ball.x=player.x;engine.ball.y=player.y;}
function setProgress(engine,player,progress){if(!player)return;const p=clamp(progress,4,96);player.x=attacksRight(engine,player.team)?p:100-p;if(engine.ball?.ownerId===player.id){engine.ball.x=player.x;engine.ball.y=player.y;}}

const KEY_SEMANTICS={
  build_shield:'shield',
  def_contain:'contain',def_track:'track',def_press:'press',def_aerial:'aerial_clear',
  rec_sprint:'recovery_sprint',rec_center:'recovery_center',rec_track:'recovery_track',rec_high:'counter_outlet',rec_foul:'tactical_foul',
  sup_width:'shape_width',sup_drag:'shape_drag',sup_balance:'shape_balance',
  wide_recycle:'recycle_pass',central_hold:'recycle_pass',fk_short:'recycle_pass',
  central_switch:'switch_pass',build_diagonal:'switch_pass',
  build_clear:'clearance',
  sp_intercept_launch:'intercept_launch',sp_aerial_bicycle_clear:'aerial_clear'
};

const CUSTOM_SEMANTICS=new Set(Object.values(KEY_SEMANTICS));
const RESTORE_POSSESSION=new Set(['contain','track','recovery_sprint','recovery_center','recovery_track','counter_outlet','shape_width','shape_drag','shape_balance']);
const SUPPRESS_CORE_DEFENSIVE_FEED=new Set(['contain','track','press','aerial_clear','recovery_sprint','recovery_center','recovery_track','shape_balance']);
const VALID_MODES=new Set(['terminal','immediate_or_terminal','persistent_or_contextual']);

export function careerDecisionSemantic(choice={},sourceSituation=''){
  const key=String(choice.key||'');
  if(KEY_SEMANTICS[key])return KEY_SEMANTICS[key];
  const tags=choice.tags||[];
  if(tags.includes('shot'))return'terminal_shot';
  if(tags.includes('foul'))return'tactical_foul';
  if(tags.includes('risk'))return sourceSituation==='recovery_choice'?'counter_outlet':'risk';
  if(tags.includes('interception'))return'interception';
  if(tags.includes('tackle'))return'tackle';
  if(tags.includes('press'))return'press';
  if(tags.includes('defend'))return'defensive_action';
  if(tags.includes('cross'))return'cross';
  if(tags.includes('dribble'))return'dribble';
  if(tags.includes('pass')&&tags.includes('chance'))return'chance_pass';
  if(tags.includes('pass'))return'pass';
  if(tags.includes('run')||tags.includes('sprint'))return'run';
  if(tags.includes('support'))return'support';
  if(tags.includes('aerial'))return'aerial';
  return'other';
}

export function consequenceModeFor(choice={},sourceSituation=''){
  const semantic=careerDecisionSemantic(choice,sourceSituation);
  if(['terminal_shot','tactical_foul','clearance'].includes(semantic))return'terminal';
  if(['shield','intercept_launch','tackle','interception','press','aerial_clear','dribble','chance_pass','cross'].includes(semantic))return'immediate_or_terminal';
  return'persistent_or_contextual';
}

export function hasCoherentConsequencePolicy(choice={},sourceSituation=''){
  const semantic=careerDecisionSemantic(choice,sourceSituation),mode=consequenceModeFor(choice,sourceSituation);
  return semantic!=='other'&&VALID_MODES.has(mode);
}

function snapshot(engine){
  return{possession:engine.possession,ball:{...engine.ball},user:{x:engine.user?.x,y:engine.user?.y,energy:engine.user?.energy},flow:engine.matchFlow?{...engine.matchFlow}:null};
}
function restoreState(engine,before,{position=true}={}){
  engine.possession=before.possession;engine.ball={...engine.ball,...before.ball};
  if(position&&engine.user){engine.user.x=before.user.x;engine.user.y=before.user.y;}
}
function advanceThreat(engine,amount=0,phase=null){
  engine.playState ||= {advantage:0,pressureBias:0,sequence:0,lastChoice:null,currentContext:null};
  engine.playState.advantage=clamp(Number(engine.playState.advantage||0)+amount,0,40);
  if(engine.userPlayChain)engine.userPlayChain.threat=clamp(Number(engine.userPlayChain.threat||0)+amount,0,60);
  if(engine.matchFlow&&phase){
    engine.matchFlow.previousPhase=engine.matchFlow.phase;engine.matchFlow.phase=phase;engine.matchFlow.possessionTeam=engine.possession;
    if(phase==='counter'){engine.matchFlow.transitionUntil=Math.max(Number(engine.matchFlow.transitionUntil||-1),engine.minute+2);engine.matchFlow.tempoMode='attacking';}
  }
}
function nearestDefensiveMate(engine){
  const team=engine.user?.team||'home',u=engine.user;
  return active(teamPlayers(engine,team)).filter(p=>p.id!==u?.id).sort((a,b)=>{
    const da=Math.hypot(a.x-u.x,a.y-u.y)-(['dm','cm','fb','cb'].includes(a.role)?12:0);
    const db=Math.hypot(b.x-u.x,b.y-u.y)-(['dm','cm','fb','cb'].includes(b.role)?12:0);
    return da-db;
  })[0]||null;
}
function bestMate(engine,mode='support'){
  const team=engine.user?.team||'home',u=engine.user,candidates=active(teamPlayers(engine,team)).filter(p=>p.id!==u?.id&&p.role!=='gk');
  if(!candidates.length)return null;
  const up=progressOf(engine,team,u?.x||50),uy=Number(u?.y||50);
  const score=p=>{
    const pp=progressOf(engine,team,p.x),dist=Math.hypot(p.x-(u?.x||50),p.y-uy);
    if(mode==='back')return-(pp-up)*3-dist*.25+(['dm','cm','fb','cb'].includes(p.role)?18:0);
    if(mode==='switch')return Math.abs(p.y-uy)*2.6-Math.abs(pp-up)*.35+(['wing','fb'].includes(p.role)?18:0);
    if(mode==='forward')return pp*2-dist*.2+(['st','wing','am'].includes(p.role)?18:0);
    return-dist+Number(p.ovr||55)*.2;
  };
  return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
}
function queueSituation(engine,key,title,{chain=0}={}){
  if(!engine.user?.onField||engine.phase==='final'||engine.awaitingDecision)return false;
  engine.pendingDecision={situation:{key,title},options:[],chain};engine.awaitingDecision=true;engine.paused=true;
  engine.emit('decision',{minute:engine.minute,title,options:[],energy:engine.user.energy,rating:engine.rating,instruction:engine.coachInstruction,chain:chain>0,directOpponent:engine.directOpponent?{name:engine.directOpponent.name,position:engine.directOpponent.position,ovr:engine.directOpponent.ovr}:null});
  return true;
}
function materialize(detail,key,title){
  if(!detail?.engine||detail.engine.awaitingDecision)return false;
  if(!queueSituation(detail.engine,key,title,{chain:0}))return false;
  detail.continued=true;detail.result.continuation=true;return true;
}

function postProcess(engine,result,semantic,before){
  if(!result)return;
  result.coherenceSemantic=semantic;
  if(RESTORE_POSSESSION.has(semantic))restoreState(engine,before);

  if(semantic==='shield'){
    restoreState(engine,before,{position:false});
    if(result.success){engine.possession=engine.user.team;putBall(engine,engine.user);advanceThreat(engine,6);}
  }else if(semantic==='shape_width'&&result.success){
    engine.user.y=engine.user.y<50?Math.max(7,engine.user.y-8):Math.min(93,engine.user.y+8);advanceThreat(engine,5);
  }else if(semantic==='shape_drag'&&result.success){
    engine.user.y=engine.user.y<50?Math.max(9,engine.user.y-6):Math.min(91,engine.user.y+6);advanceThreat(engine,7);
  }else if(semantic==='shape_balance'&&result.success){
    engine.user.energy=clamp(Number(engine.user.energy||0)+.8,0,100);
  }else if(semantic==='counter_outlet'&&result.success){
    const p=Math.max(66,progressOf(engine,engine.user.team,engine.user.x));setProgress(engine,engine.user,p);
    engine.__coherentCounterOutlet={untilMinute:engine.minute+6,minProgress:p,createdMinute:engine.minute};
  }else if(['contain','track','recovery_sprint','recovery_center','recovery_track'].includes(semantic)&&result.success){
    if(engine.matchFlow){
      if(engine.matchFlow.phase==='counter')engine.matchFlow.phase='progression';
      if(['contain','recovery_center','recovery_sprint'].includes(semantic))engine.matchFlow.transitionUntil=Math.min(Number(engine.matchFlow.transitionUntil||engine.minute),engine.minute);
    }
    engine.playState ||= {};engine.playState.pressureBias=clamp(Number(engine.playState.pressureBias||0)-4,-20,20);
  }else if(semantic==='press'&&result.success){
    const target=engine.rng()<.62?engine.user:nearestDefensiveMate(engine)||engine.user;engine.possession=engine.user.team;putBall(engine,target);advanceThreat(engine,8,'counter');
  }else if(semantic==='aerial_clear'&&result.success){
    const target=nearestDefensiveMate(engine)||engine.user;engine.possession=engine.user.team;putBall(engine,target);
    if(engine.matchFlow){engine.matchFlow.phase='buildup';engine.matchFlow.transitionUntil=-1;}
  }else if(semantic==='intercept_launch'&&result.success){
    engine.possession=engine.user.team;putBall(engine,engine.user);setProgress(engine,engine.user,Math.max(55,progressOf(engine,engine.user.team,engine.user.x)));advanceThreat(engine,16,'counter');
  }else if(semantic==='recycle_pass'&&result.success){
    const target=bestMate(engine,'back');if(target){engine.possession=engine.user.team;putBall(engine,target);if(engine.matchFlow)engine.matchFlow.phase=progressOf(engine,engine.user.team,target.x)<48?'build':'midfield';}advanceThreat(engine,1);
  }else if(semantic==='switch_pass'&&result.success){
    const target=bestMate(engine,'switch');if(target){engine.possession=engine.user.team;putBall(engine,target);advanceThreat(engine,6,progressOf(engine,engine.user.team,target.x)>67?'progression':'midfield');}
  }else if(semantic==='clearance'&&result.success){
    const target=bestMate(engine,'forward');
    if(target&&engine.rng()<.52){engine.possession=engine.user.team;putBall(engine,target);if(engine.matchFlow)engine.matchFlow.phase='midfield';}
    else{engine.possession=opponentTeam(engine.user.team);const rival=active(teamPlayers(engine,engine.possession)).sort((a,b)=>progressOf(engine,engine.possession,a.x)-progressOf(engine,engine.possession,b.x))[0];if(rival)putBall(engine,rival);if(engine.matchFlow)engine.matchFlow.phase='buildup';}
  }
}

function setOutcome(result,heading,text,tier='success'){
  result.outcomeHeading=heading;result.outcomeText=text;result.outcomeTier=tier;
}
export function applyCareerConsequenceFeedback(detail={}){
  const {engine,result,choice}=detail;if(!engine||!result)return detail;
  const semantic=result.coherenceSemantic||careerDecisionSemantic(choice,result.coherenceSource||result.sourceSituation||'');
  const ok=Boolean(result.success);
  if(semantic==='counter_outlet')setOutcome(result,ok?'POSIÇÃO PARA A TRANSIÇÃO':'POSIÇÃO PERDIDA',ok?'Você ficou alto enquanto o rival ainda tem a bola. Se sua equipe recuperar e sair rápido nos próximos minutos, você será a primeira opção do contra-ataque.':'A jogada obrigou você a abandonar a posição alta antes de poder virar opção de transição.',ok?'success':'fail');
  else if(semantic==='contain')setOutcome(result,ok?'TRANSIÇÃO DESACELERADA':'CONTENÇÃO SUPERADA',ok?'Você fechou a progressão sem se jogar no bote. O rival ainda tem a bola, mas perdeu a rota e a velocidade do contra-ataque.':'O portador conseguiu manter a progressão apesar da sua contenção.',ok?'success':'fail');
  else if(semantic==='track')setOutcome(result,ok?'CORRIDA NEUTRALIZADA':'MARCAÇÃO SUPERADA',ok?'Você acompanhou a corrida e tirou uma opção de passe. A posse segue com o rival, mas aquele movimento deixou de ser ameaça.':'O corredor conseguiu se desprender e continua oferecendo profundidade.',ok?'success':'fail');
  else if(semantic==='recovery_sprint')setOutcome(result,ok?'RECOMPOSIÇÃO CONCLUÍDA':'RECOMPOSIÇÃO ATRASADA',ok?'Você recompôs a tempo e eliminou a vantagem numérica. A bola ainda é do rival, agora contra uma defesa reorganizada.':'Você não chegou a tempo de fechar o espaço antes da transição avançar.',ok?'success':'fail');
  else if(semantic==='recovery_center')setOutcome(result,ok?'CORREDOR FECHADO':'CORREDOR ROMPIDO',ok?'Você fechou o centro e obrigou o rival a procurar uma rota menos perigosa.':'O adversário encontrou passagem por dentro antes do fechamento.',ok?'success':'fail');
  else if(semantic==='recovery_track')setOutcome(result,ok?'OPÇÃO ELIMINADA':'CORREDOR LIVRE',ok?'Você acompanhou quem passava sem bola e eliminou uma opção clara da transição.':'O jogador escapou da marcação e segue livre na transição.',ok?'success':'fail');
  else if(semantic==='press')setOutcome(result,ok?'ERRO FORÇADO':'PRESSÃO SUPERADA',ok?'Sua pressão forçou o erro e sua equipe recuperou a posse. Agora existe uma transição real.':'O portador escapou da pressão e manteve a posse.',ok?'progress':'fail');
  else if(semantic==='aerial_clear')setOutcome(result,ok?'PERIGO AFASTADO':'DUELO AÉREO PERDIDO',ok?'Você venceu a bola pelo alto e tirou o perigo. Sua equipe ficou com a segunda bola.':'O rival venceu pelo alto e manteve o perigo.',ok?'success':'fail');
  else if(semantic==='shield')setOutcome(result,ok?'BOLA PROTEGIDA':'BOLA PERDIDA',ok?'Você segurou o contato, manteve a posse nos pés e deu tempo para o apoio chegar.':'O marcador tirou seu equilíbrio antes de o apoio chegar.',ok?'success':'fail');
  else if(semantic==='shape_width')setOutcome(result,ok?'ESPAÇO CRIADO':'MOVIMENTO LIDO',ok?'Você abriu o campo e prendeu o lateral. A posse continua com o time e agora há mais espaço por dentro.':'O adversário não acompanhou o movimento e a estrutura não mudou como você queria.',ok?'success':'fail');
  else if(semantic==='shape_drag')setOutcome(result,ok?'MARCADOR ARRASTADO':'MOVIMENTO IGNORADO',ok?'Seu deslocamento levou o marcador para longe da bola e abriu uma linha para os companheiros.':'O marcador não comprou o movimento e o espaço não apareceu.',ok?'success':'fail');
  else if(semantic==='shape_balance')setOutcome(result,ok?'ESTRUTURA MANTIDA':'EQUILÍBRIO QUEBRADO',ok?'Você manteve a estrutura e poupou desgaste para a próxima fase da jogada.':'A movimentação rival obrigou você a abandonar a zona que queria proteger.',ok?'success':'fail');
  else if(semantic==='recycle_pass')setOutcome(result,ok?'POSSE REORGANIZADA':'PASSE INTERCEPTADO',ok?'Você escolheu segurança, devolveu a bola e a equipe reinicia o ataque com controle.':'A tentativa de reciclar a posse foi interceptada.',ok?'success':'fail');
  else if(semantic==='switch_pass')setOutcome(result,ok?'CORREDOR INVERTIDO':'INVERSÃO CORTADA',ok?'A bola chegou ao lado oposto e obrigou a defesa a deslocar todo o bloco.':'A defesa leu a inversão e interrompeu a mudança de corredor.',ok?'progress':'fail');
  else if(semantic==='clearance')setOutcome(result,ok?'ZONA DE RISCO LIMPA':'CORTE INCOMPLETO',ok?'Você tirou a bola da zona perigosa. A segunda bola definiu quem ficou com a posse.':'O corte não saiu limpo e o perigo continuou perto da área.',ok?'success':'fail');
  else if(semantic==='intercept_launch')setOutcome(result,ok?'CONTRA-ATAQUE ARMADO':'INTERCEPTAÇÃO INCOMPLETA',ok?'Você antecipou o passe e já transformou a recuperação em contra-ataque. A transição começou de verdade.':'Você leu o passe, mas não conseguiu transformar a interceptação em posse limpa.',ok?'progress':'fail');
  else if(semantic==='tactical_foul'){
    const yellow=Boolean(engine.user?.yellow);setOutcome(result,yellow?'TRANSIÇÃO PARADA · AMARELO':'TRANSIÇÃO PARADA',yellow?'Você interrompeu o contra-ataque, mas recebeu cartão amarelo.':'Você interrompeu o contra-ataque com a falta e deu tempo para o time se reorganizar.',yellow?'partial':'success');
  }

  if(!detail.continued&&result.success){
    if(semantic==='shield')materialize(detail,'build_under_pressure','O apoio chegou; você continua com a bola e escolhe a saída');
    else if(semantic==='intercept_launch')materialize(detail,'off_ball_attack','A interceptação virou contra-ataque e o campo se abriu');
    else if(semantic==='press'&&engine.ball?.ownerId===engine.user?.id)materialize(detail,'central_ball','O erro forçado deixa a recuperação nos seus pés');
  }
  return detail;
}

export function triggerStoredCounterIfReady(engine,beforePossession){
  const stored=engine?.__coherentCounterOutlet;if(!stored)return false;
  if(engine.minute>stored.untilMinute||!engine.user?.onField){delete engine.__coherentCounterOutlet;return false;}
  const team=engine.user.team;
  if(beforePossession===team||engine.possession!==team||engine.awaitingDecision)return false;
  const realTransition=engine.matchFlow?.phase==='counter'||Number(engine.matchFlow?.transitionUntil||-1)>=engine.minute;
  if(!realTransition)return false;
  setProgress(engine,engine.user,Math.max(stored.minProgress,72));advanceThreat(engine,14,'counter');delete engine.__coherentCounterOutlet;
  return queueSituation(engine,'off_ball_attack','Seu posicionamento alto virou a primeira opção do contra-ataque',{chain:0});
}

if(!CareerMatchEngine.prototype.__consequenceCoherenceV7Installed){
  const previousChoose=CareerMatchEngine.prototype.choose;
  const previousOnMinute=CareerMatchEngine.prototype.onMinute;
  const previousAnimate=CareerMatchEngine.prototype.animatePlayers;

  CareerMatchEngine.prototype.choose=function coherentCareerChoiceV7(key){
    const choice=this.pendingDecision?.options?.find(option=>option.key===key);if(!choice)return previousChoose.call(this,key);
    const source=this.pendingDecision?.situation?.key||'',semantic=careerDecisionSemantic(choice,source),before=snapshot(this);
    const originalActionType=choice.actionType,originalTags=[...(choice.tags||[])],originalFeed=this.feed;
    if(CUSTOM_SEMANTICS.has(semantic))choice.actionType=`coherence_${semantic}`;
    if(semantic==='intercept_launch')choice.tags=originalTags.filter(tag=>tag!=='chance'&&tag!=='pass');
    if(SUPPRESS_CORE_DEFENSIVE_FEED.has(semantic))this.feed=(text,type='play',actor=null)=>['tackle','interception'].includes(type)?undefined:originalFeed.call(this,text,type,actor);
    let result;
    try{result=previousChoose.call(this,key);}
    finally{this.feed=originalFeed;choice.actionType=originalActionType;choice.tags=originalTags;}
    if(result){result.coherenceSource=source;postProcess(this,result,semantic,before);}
    return result;
  };

  CareerMatchEngine.prototype.onMinute=function coherentCareerMinuteV7(...args){
    const before=this.possession,result=previousOnMinute.apply(this,args);triggerStoredCounterIfReady(this,before);return result;
  };

  CareerMatchEngine.prototype.animatePlayers=function coherentCounterOutletMovementV7(...args){
    const result=previousAnimate.apply(this,args),stored=this.__coherentCounterOutlet;
    if(stored&&this.user?.onField&&this.possession!==this.user.team&&this.minute<=stored.untilMinute)setProgress(this,this.user,Math.max(stored.minProgress,64));
    return result;
  };

  if(typeof window!=='undefined')window.addEventListener('career:match-choice-resolved-v5',event=>applyCareerConsequenceFeedback(event.detail||{}));
  Object.defineProperty(CareerMatchEngine.prototype,'__consequenceCoherenceV7Installed',{value:true,enumerable:false,configurable:false});
}
