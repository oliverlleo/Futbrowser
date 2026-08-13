import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const active=list=>(list||[]).filter(player=>player?.onField&&!player?.red);
const opponentTeam=team=>team==='home'?'away':'home';
const teamPlayers=(engine,team)=>team==='home'?engine.home:engine.away;
const attacksRight=(engine,team)=>team==='home'?engine.homeAttacksRight:!engine.homeAttacksRight;
const progressOf=(engine,team,x)=>attacksRight(engine,team)?Number(x||0):100-Number(x||0);
const setProgress=(engine,player,progress)=>{if(!player)return;const p=clamp(progress,4,96);player.x=attacksRight(engine,player.team)?p:100-p;if(engine.ball?.ownerId===player.id){engine.ball.x=player.x;engine.ball.y=player.y;}};
const putBall=(engine,player)=>{if(!player)return;engine.ball.ownerId=player.id;engine.ball.x=player.x;engine.ball.y=player.y;};
const owner=(engine,id=engine.ball?.ownerId)=>[...engine.home,...engine.away].find(player=>String(player.id)===String(id)&&player.onField)||null;

const SEMANTIC_BY_KEY={
  build_shield:'shield',
  def_contain:'contain',def_track:'track',def_press:'press',def_aerial:'aerial_clear',
  rec_sprint:'recovery_sprint',rec_center:'recovery_center',rec_track:'recovery_track',rec_high:'counter_outlet',rec_foul:'tactical_foul',
  sup_width:'shape_width',sup_drag:'shape_drag',sup_balance:'shape_balance',
  wide_recycle:'recycle_pass',central_hold:'recycle_pass',fk_short:'recycle_pass',
  central_switch:'switch_pass',build_diagonal:'switch_pass',
  build_clear:'clearance',
  sp_intercept_launch:'intercept_launch',
  sp_aerial_bicycle_clear:'aerial_clear'
};

const V5_BYPASS=new Set(['shield','contain','track','press','aerial_clear','recovery_sprint','recovery_center','recovery_track','counter_outlet','tactical_foul','shape_width','shape_drag','shape_balance','recycle_pass','switch_pass','clearance','intercept_launch']);
const RESTORE_DEFENSIVE=new Set(['contain','track','recovery_sprint','recovery_center','recovery_track','shape_balance']);
const SUPPRESS_DEFENSIVE_FEED=new Set(['contain','track','press','aerial_clear','recovery_sprint','recovery_center','recovery_track','shape_balance']);

export function careerDecisionSemantic(choice={},sourceSituation=''){
  const key=String(choice.key||'');
  if(SEMANTIC_BY_KEY[key])return SEMANTIC_BY_KEY[key];
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
  return'other';
}

export function consequenceModeFor(choice={},sourceSituation=''){
  const semantic=careerDecisionSemantic(choice,sourceSituation);
  if(['terminal_shot','tactical_foul','clearance'].includes(semantic))return'terminal';
  if(['shield','intercept_launch','tackle','interception','dribble','chance_pass','cross'].includes(semantic))return'immediate_or_terminal';
  if(['counter_outlet','contain','track','press','aerial_clear','recovery_sprint','recovery_center','recovery_track','shape_width','shape_drag','shape_balance','recycle_pass','switch_pass','pass','run','support','defensive_action','risk','other'].includes(semantic))return'persistent_or_contextual';
  return'persistent_or_contextual';
}

function snapshot(engine){return{possession:engine.possession,ball:{...engine.ball},user:{x:engine.user?.x,y:engine.user?.y,homeX:engine.user?.homeX,homeY:engine.user?.homeY,energy:engine.user?.energy},flow:engine.matchFlow?{...engine.matchFlow}:null,commentaryLength:engine.commentary?.length||0};}
function restorePossession(engine,before,{position=true}={}){
  engine.possession=before.possession;
  engine.ball={...engine.ball,...before.ball};
  if(position&&engine.user){engine.user.x=before.user.x;engine.user.y=before.user.y;}
}
function advanceThreat(engine,amount=0,phase=null){
  engine.playState ||= {advantage:0,pressureBias:0,sequence:0,lastChoice:null,currentContext:null};
  engine.playState.advantage=clamp(Number(engine.playState.advantage||0)+amount,0,40);
  if(engine.userPlayChain)engine.userPlayChain.threat=clamp(Number(engine.userPlayChain.threat||0)+amount,0,60);
  if(engine.matchFlow&&phase){engine.matchFlow.previousPhase=engine.matchFlow.phase;engine.matchFlow.phase=phase;engine.matchFlow.possessionTeam=engine.possession;if(phase==='counter'){engine.matchFlow.transitionUntil=Math.max(Number(engine.matchFlow.transitionUntil||-1),engine.minute+2);engine.matchFlow.tempoMode='attacking';}}
}
function bestMate(engine,mode='support'){
  const team=engine.user?.team||'home',user=engine.user,candidates=active(teamPlayers(engine,team)).filter(player=>player.id!==user?.id&&player.role!=='gk');
  if(!candidates.length)return null;
  const up=progressOf(engine,team,user?.x||50),uy=Number(user?.y||50);
  return candidates.sort((a,b)=>{
    const ap=progressOf(engine,team,a.x),bp=progressOf(engine,team,b.x);
    const ad=Math.hypot(a.x-(user?.x||50),a.y-uy),bd=Math.hypot(b.x-(user?.x||50),b.y-uy);
    const score=p=>{
      const pp=progressOf(engine,team,p.x),dist=Math.hypot(p.x-(user?.x||50),p.y-uy);
      if(mode==='back')return -(pp-up)*3-dist*.25+(['dm','cm','fb','cb'].includes(p.role)?18:0);
      if(mode==='switch')return Math.abs(p.y-uy)*2.6-Math.abs(pp-up)*.35+(['wing','fb'].includes(p.role)?18:0);
      if(mode==='forward')return pp*2-dist*.2+(['st','wing','am'].includes(p.role)?18:0);
      return -dist+Number(p.ovr||55)*.2;
    };
    return score(b)-score(a);
  })[0]||null;
}
function queueSituation(engine,key,title,{chain=0}={}){
  if(!engine.user?.onField||engine.phase==='final'||engine.awaitingDecision)return false;
  engine.pendingDecision={situation:{key,title},options:[],chain};
  engine.awaitingDecision=true;engine.paused=true;
  engine.emit('decision',{minute:engine.minute,title,options:[],energy:engine.user.energy,rating:engine.rating,instruction:engine.coachInstruction,chain:chain>0,directOpponent:engine.directOpponent?{name:engine.directOpponent.name,position:engine.directOpponent.position,ovr:engine.directOpponent.ovr}:null});
  return true;
}
function makeContinuation(detail,key,title){
  const engine=detail.engine;if(!engine||engine.awaitingDecision)return false;
  const created=queueSituation(engine,key,title,{chain:0});
  if(created){detail.continued=true;detail.result.continuation=true;}
  return created;
}
function nearestDefensiveMate(engine){
  const team=engine.user?.team||'home',u=engine.user;
  return active(teamPlayers(engine,team)).filter(p=>p.id!==u?.id).sort((a,b)=>{
    const ar=['dm','cm','fb','cb'].includes(a.role)?-12:0,br=['dm','cm','fb','cb'].includes(b.role)?-12:0;
    return Math.hypot(a.x-u.x,a.y-u.y)+ar-(Math.hypot(b.x-u.x,b.y-u.y)+br);
  })[0]||null;
}

function postProcessImmediate(engine,result,choice,semantic,before){
  if(!result)return;
  result.coherenceSemantic=semantic;
  if(RESTORE_DEFENSIVE.has(semantic))restorePossession(engine,before);

  if(semantic==='shield'){
    restorePossession(engine,before,{position:false});
    if(result.success){engine.possession=engine.user.team;putBall(engine,engine.user);setProgress(engine,engine.user,Math.max(8,progressOf(engine,engine.user.team,before.user.x)+1));advanceThreat(engine,7);}
  }
  if(semantic==='shape_width'&&result.success){restorePossession(engine,before);engine.user.y=engine.user.y<50?Math.max(7,engine.user.y-8):Math.min(93,engine.user.y+8);advanceThreat(engine,5);}
  if(semantic==='shape_drag'&&result.success){restorePossession(engine,before);engine.user.y=engine.user.y<50?Math.max(9,engine.user.y-6):Math.min(91,engine.user.y+6);advanceThreat(engine,7);}
  if(semantic==='shape_balance'){restorePossession(engine,before);if(result.success&&engine.user)engine.user.energy=clamp(Number(engine.user.energy||0)+.8,0,100);}
  if(semantic==='counter_outlet'){
    restorePossession(engine,before);
    if(result.success){const p=Math.max(66,progressOf(engine,engine.user.team,engine.user.x));setProgress(engine,engine.user,p);engine.__coherentCounterOutlet={untilMinute:engine.minute+6,minProgress:p,createdMinute:engine.minute};advanceThreat(engine,5);}
  }
  if(['contain','track','recovery_sprint','recovery_center','recovery_track'].includes(semantic)&&result.success){
    if(engine.matchFlow){if(engine.matchFlow.phase==='counter')engine.matchFlow.phase='progression';if(['contain','recovery_center','recovery_sprint'].includes(semantic))engine.matchFlow.transitionUntil=Math.min(Number(engine.matchFlow.transitionUntil||engine.minute),engine.minute);}
    engine.playState ||= {};engine.playState.pressureBias=clamp(Number(engine.playState.pressureBias||0)-4,-20,20);
  }
  if(semantic==='press'&&result.success){
    const team=engine.user.team,receiver=engine.rng()<.62?engine.user:nearestDefensiveMate(engine)||engine.user;
    engine.possession=team;putBall(engine,receiver);advanceThreat(engine,8,'counter');
  }
  if(semantic==='aerial_clear'&&result.success){
    const team=engine.user.team,target=nearestDefensiveMate(engine)||engine.user;engine.possession=team;putBall(engine,target);if(engine.matchFlow){engine.matchFlow.phase='buildup';engine.matchFlow.transitionUntil=-1;}
  }
  if(semantic==='intercept_launch'&&result.success){
    const team=engine.user.team;engine.possession=team;putBall(engine,engine.user);setProgress(engine,engine.user,Math.max(55,progressOf(engine,team,engine.user.x)));advanceThreat(engine,16,'counter');
  }
  if(semantic==='recycle_pass'&&result.success){
    const target=bestMate(engine,'back');if(target){engine.possession=engine.user.team;putBall(engine,target);if(engine.matchFlow)engine.matchFlow.phase=progressOf(engine,engine.user.team,target.x)<48?'build':'midfield';}advanceThreat(engine,1);
  }
  if(semantic==='switch_pass'&&result.success){
    const target=bestMate(engine,'switch');if(target){engine.possession=engine.user.team;putBall(engine,target);advanceThreat(engine,6,progressOf(engine,engine.user.team,target.x)>67?'progression':'midfield');}
  }
  if(semantic==='clearance'&&result.success){
    const target=bestMate(engine,'forward');if(target&&engine.rng()<.52){engine.possession=engine.user.team;putBall(engine,target);if(engine.matchFlow)engine.matchFlow.phase='midfield';}else{engine.possession=opponentTeam(engine.user.team);const rival=active(teamPlayers(engine,engine.possession)).sort((a,b)=>progressOf(engine,engine.possession,a.x)-progressOf(engine,engine.possession,b.x))[0];if(rival)putBall(engine,rival);if(engine.matchFlow)engine.matchFlow.phase='buildup';}
  }
}

function rewriteOutcome(detail){
  const {engine,result,choice}=detail,semantic=result?.coherenceSemantic||careerDecisionSemantic(choice,result?.sourceSituation||'');if(!engine||!result)return;
  const success=Boolean(result.success);
  if(semantic==='counter_outlet'){
    result.outcomeTier=success?'progress':'fail';result.outcomeText=success?'Você fica alto enquanto o time ainda defende. Se a recuperação virar transição rápida nos próximos minutos, você será a primeira opção do contra-ataque.':'A defesa rival e o contexto da jogada obrigam você a abandonar a posição alta.';return;
  }
  if(semantic==='contain'){result.outcomeText=success?'Você fecha a progressão sem se jogar no bote. O contra-ataque perde velocidade, mas a bola continua com o rival.':'O portador consegue manter a progressão apesar da contenção.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='track'){result.outcomeText=success?'Você acompanha a corrida e tira a opção de passe. A posse segue com o rival, mas a ameaça daquele movimento foi neutralizada.':'O corredor consegue se desprender e continua oferecendo profundidade.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='recovery_sprint'){result.outcomeText=success?'Você recompõe a tempo e ajuda a matar a vantagem numérica do contra-ataque. A bola ainda é do rival.':'Você não consegue fechar o espaço antes da transição avançar.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='recovery_center'){result.outcomeText=success?'Você fecha o corredor central e obriga o contra-ataque a perder a rota mais perigosa.':'O rival encontra passagem por dentro antes do seu fechamento.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='recovery_track'){result.outcomeText=success?'Você acompanha quem passa sem bola e elimina uma opção clara da transição.':'O corredor escapa da marcação e continua livre na transição.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='press'){result.outcomeText=success?'Sua pressão força o erro e sua equipe recupera a posse para tentar acelerar a transição.':'O portador escapa da pressão e mantém a posse.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='aerial_clear'){result.outcomeText=success?'Você vence a disputa pelo alto e tira o perigo da zona defensiva. A equipe fica com a segunda bola.':'O rival leva vantagem na bola aérea e mantém o perigo.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='shield'){result.outcomeText=success?'Você protege a bola, segura o contato e ganha tempo para o apoio chegar. A posse continua nos seus pés.':'O marcador consegue tirar seu equilíbrio antes do apoio chegar.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='shape_width'){result.outcomeText=success?'Você abre o campo e prende o lateral, criando mais espaço por dentro para a sequência da posse.':'O rival não acompanha seu movimento e a abertura não muda a estrutura do lance.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='shape_drag'){result.outcomeText=success?'Seu movimento leva o marcador para longe da bola e abre uma linha para os companheiros.':'O marcador não compra o movimento e o espaço não aparece.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='shape_balance'){result.outcomeText=success?'Você mantém a estrutura, reduz o desgaste e fica preparado para a próxima fase da jogada.':'A movimentação do rival obriga você a sair da zona que queria proteger.';result.outcomeTier=success?'success':'fail';return;}
  if(semantic==='recycle_pass'){result.outcomeText=success?'Você escolhe segurança, devolve a posse para trás e a equipe reorganiza o ataque com controle.':'A tentativa de reciclar a posse é interceptada.';result.outcomeTier=success?'success':'fail';return;}
  if(semantic==='switch_pass'){result.outcomeText=success?'A inversão chega ao corredor oposto e obriga a defesa a deslocar o bloco inteiro.':'A defesa lê a inversão e interrompe a mudança de corredor.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='clearance'){result.outcomeText=success?'Você tira a bola da zona de risco. A segunda bola define quem fica com a posse.':'O corte não sai limpo e o perigo continua perto da sua área.';result.outcomeTier=success?'success':'fail';return;}
  if(semantic==='intercept_launch'){result.outcomeText=success?'Você antecipa o passe e já transforma a recuperação em contra-ataque. A transição começa imediatamente.':'A leitura é boa, mas você não consegue dominar a interceptação para lançar a transição.';result.outcomeTier=success?'progress':'fail';return;}
  if(semantic==='tactical_foul'){
    const yellow=Boolean(engine.user?.yellow);result.outcomeText=yellow?'Você interrompe a transição com falta, mas recebe cartão amarelo pela ação.':'Você interrompe a transição com falta e dá tempo para sua equipe se reorganizar.';result.outcomeTier=yellow?'partial':'success';return;
  }
}

function materializeCoherentContinuation(detail){
  const {engine,result}=detail,semantic=result?.coherenceSemantic;if(!engine||!result?.success||detail.continued)return;
  if(semantic==='shield')makeContinuation(detail,'build_under_pressure','O apoio chegou; você continua com a bola e pode escolher a saída');
  else if(semantic==='intercept_launch')makeContinuation(detail,'off_ball_attack','A interceptação virou transição e o campo se abriu para o contra-ataque');
  else if(semantic==='press'&&engine.ball?.ownerId===engine.user?.id)makeContinuation(detail,'central_ball','O erro forçado deixa a recuperação nos seus pés');
}

function maybeTriggerStoredCounter(engine,beforePossession){
  const stored=engine.__coherentCounterOutlet;if(!stored)return false;
  if(engine.minute>stored.untilMinute||!engine.user?.onField){delete engine.__coherentCounterOutlet;return false;}
  const team=engine.user.team;
  if(beforePossession===team||engine.possession!==team||engine.awaitingDecision)return false;
  const realTransition=engine.matchFlow?.phase==='counter'||Number(engine.matchFlow?.transitionUntil||-1)>=engine.minute;
  if(!realTransition)return false;
  setProgress(engine,engine.user,Math.max(stored.minProgress,72));advanceThreat(engine,14,'counter');
  delete engine.__coherentCounterOutlet;
  return queueSituation(engine,'off_ball_attack','Seu posicionamento alto virou a primeira opção do contra-ataque',{chain:0});
}

if(!CareerMatchEngine.prototype.__consequenceCoherenceV6Installed){
  const previousChoose=CareerMatchEngine.prototype.choose;
  const previousOnMinute=CareerMatchEngine.prototype.onMinute;
  const previousAnimate=CareerMatchEngine.prototype.animatePlayers;

  CareerMatchEngine.prototype.choose=function coherentCareerChoice(key){
    const choice=this.pendingDecision?.options?.find(option=>option.key===key);if(!choice)return previousChoose.call(this,key);
    const source=this.pendingDecision?.situation?.key||'',semantic=careerDecisionSemantic(choice,source),before=snapshot(this),originalActionType=choice.actionType;
    if(V5_BYPASS.has(semantic))choice.actionType=`coherence_${semantic}`;
    let originalFeed=null;
    if(SUPPRESS_DEFENSIVE_FEED.has(semantic)){
      originalFeed=this.feed;
      this.feed=(text,type='play',actor=null)=>['tackle','interception'].includes(type)?undefined:originalFeed.call(this,text,type,actor);
    }
    if(semantic==='intercept_launch')choice.tags=(choice.tags||[]).filter(tag=>tag!=='chance');
    const result=previousChoose.call(this,key);
    if(originalFeed)this.feed=originalFeed;
    choice.actionType=originalActionType;
    postProcessImmediate(this,result,choice,semantic,before);
    return result;
  };

  CareerMatchEngine.prototype.onMinute=function coherentCareerMinute(...args){
    const before=this.possession,result=previousOnMinute.apply(this,args);maybeTriggerStoredCounter(this,before);return result;
  };

  CareerMatchEngine.prototype.animatePlayers=function coherentCounterOutletMovement(...args){
    const result=previousAnimate.apply(this,args),stored=this.__coherentCounterOutlet;
    if(stored&&this.user?.onField&&this.possession!==this.user.team&&this.minute<=stored.untilMinute)setProgress(this,this.user,Math.max(stored.minProgress,64));
    return result;
  };

  if(typeof window!=='undefined')window.addEventListener('career:match-choice-resolved-v5',event=>{
    const detail=event.detail||{};rewriteOutcome(detail);materializeCoherentContinuation(detail);
  });

  Object.defineProperty(CareerMatchEngine.prototype,'__consequenceCoherenceV6Installed',{value:true,enumerable:false,configurable:false});
}
