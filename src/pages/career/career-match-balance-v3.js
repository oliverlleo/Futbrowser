import { CareerMatchEngine, narrate } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const active=list=>(list||[]).filter(player=>player?.onField&&!player?.red);
const average=list=>list.length?list.reduce((sum,value)=>sum+Number(value||0),0)/list.length:0;
const attacksRight=(engine,team)=>team==='home'?engine.homeAttacksRight:!engine.homeAttacksRight;
const progressOf=(engine,team,x)=>attacksRight(engine,team)?x:100-x;
const opponentTeam=team=>team==='home'?'away':'home';

const SHOT_PROFILES={
  penalty:{label:'Pênalti',onTarget:.92,finish:.78,pressure:.00015,markers:0,angle:.00010,blockBase:0,minTarget:.70,minFinish:.48},
  free_kick:{label:'Falta direta',onTarget:.49,finish:.31,pressure:.00045,markers:.004,angle:.00055,blockBase:.04,minTarget:.24,minFinish:.12},
  clear:{label:'Chance clara',onTarget:.80,finish:.56,pressure:.00060,markers:.010,angle:.00055,blockBase:.02,minTarget:.52,minFinish:.30},
  controlled_box:{label:'Finalização preparada',onTarget:.72,finish:.47,pressure:.00085,markers:.016,angle:.00085,blockBase:.04,minTarget:.38,minFinish:.22},
  quick_box:{label:'Finalização rápida',onTarget:.65,finish:.43,pressure:.00100,markers:.020,angle:.00100,blockBase:.05,minTarget:.31,minFinish:.19},
  chip:{label:'Cavadinha',onTarget:.61,finish:.43,pressure:.00085,markers:.013,angle:.00085,blockBase:.03,minTarget:.34,minFinish:.20},
  header:{label:'Cabeceio',onTarget:.50,finish:.36,pressure:.00105,markers:.019,angle:.00095,blockBase:.06,minTarget:.24,minFinish:.14},
  volley:{label:'Voleio',onTarget:.47,finish:.35,pressure:.00105,markers:.017,angle:.00105,blockBase:.05,minTarget:.21,minFinish:.13},
  acrobatic:{label:'Finalização acrobática',onTarget:.34,finish:.27,pressure:.00110,markers:.018,angle:.00100,blockBase:.05,minTarget:.12,minFinish:.08},
  finesse:{label:'Finalização técnica',onTarget:.55,finish:.38,pressure:.00095,markers:.016,angle:.00090,blockBase:.04,minTarget:.28,minFinish:.16},
  long:{label:'Longa distância',onTarget:.39,finish:.27,pressure:.00075,markers:.012,angle:.00075,blockBase:.06,minTarget:.18,minFinish:.10}
};

function contextForShot(engine,choice={}){
  if(choice.context)return choice.context;
  const user=engine.user;
  if(!user)return{pressure:50,space:50,angle:50,markers:1,progress:50};
  const rivals=active(user.team==='home'?engine.away:engine.home);
  const distances=rivals.map(player=>Math.hypot(player.x-user.x,player.y-user.y)).sort((a,b)=>a-b);
  const nearest=distances[0]??18,markers=distances.filter(distance=>distance<13).length;
  const pressure=clamp((78-nearest*4.2+markers*7)/100,.05,.96)*100;
  const progress=progressOf(engine,user.team,user.x);
  const angle=clamp((100-Math.abs(user.y-50)*1.45-(progress<70?(70-progress)*.35:0))/100,.08,1)*100;
  return{pressure,space:clamp((100-pressure)/100,.04,.98)*100,angle,markers,progress};
}

function defensiveContext(engine){
  const team=engine.user?.team||'home';
  const rivals=active(team==='home'?engine.away:engine.home);
  const keeper=rivals.find(player=>player.role==='gk');
  const defenders=rivals.filter(player=>['cb','fb','dm'].includes(player.role));
  const backline=average(defenders.map(player=>player.ovr))||average(rivals.map(player=>player.ovr))||55;
  const direct=Number(engine.directOpponent?.ovr||backline);
  const outfield=direct*.55+backline*.45;
  return{keeperOvr:Number(keeper?.ovr||average(rivals.map(player=>player.ovr))||55),outfieldOvr:outfield,backlineOvr:backline};
}

function profileKey(choice,ctx){
  const key=String(choice?.key||'');
  const tags=choice?.tags||[];
  if(tags.includes('penalty')||key.startsWith('pen_')||key==='sp_panenka')return'penalty';
  if(tags.includes('free_kick')||key.startsWith('fk_')||['sp_knuckle','sp_underwall'].includes(key))return'free_kick';
  if(['sp_bicycle','sp_bicycle_cross','sp_scissor'].includes(key))return'acrobatic';
  if(['sp_volley','sp_chest_volley','sp_first_time_volley'].includes(key))return'volley';
  if(key==='off_header_finish'||key==='sp_diving_header'||tags.includes('header'))return'header';
  if(key==='sp_chip')return'chip';
  if(['sp_heel_finish','sp_trivela_finish'].includes(key))return'finesse';
  if(key==='central_shot'||key==='sp_long_knuckle'||Number(ctx.progress||0)<76)return'long';
  if(Number(ctx.progress||0)>=86&&Number(ctx.pressure||0)<=34&&Number(ctx.markers||0)===0&&Number(ctx.angle||0)>=68)return'clear';
  if(key==='box_set')return'controlled_box';
  return'quick_box';
}

export function estimateShotOutcome(engine,choice={}){
  const ctx=contextForShot(engine,choice),profileName=profileKey(choice,ctx),profile=SHOT_PROFILES[profileName];
  const defense=defensiveContext(engine);
  const user=engine.user||{};
  const skillKey=profileName==='header'?'heading':choice.skill||'finishing';
  const skill=Number(engine.userSkills?.[skillKey]??engine.userSkills?.finishing??user.ovr??50);
  const userOvr=Number(user.ovr||engine.context?.player?.ovr||50);
  const energy=Number(user.energy??70),readiness=Number(engine.userPreparation??70),mental=Number(engine.mentalStability??70);
  const pressure=Number(ctx.pressure||0),markers=Math.max(0,Number(ctx.markers||0)),angle=Number(ctx.angle||50),space=Number(ctx.space||50);
  const skillDelta=skill-50;
  const ovrDelta=userOvr-defense.outfieldOvr;
  const ovrFactor=clamp(ovrDelta/20,-1,1);
  const keeperFactor=clamp((skill-defense.keeperOvr)/30,-1,1);
  const condition=clamp((energy-65)*.00075+(readiness-70)*.00055+(mental-70)*.00045,-.065,.065);
  const anglePenalty=Math.max(0,100-angle);

  let onTarget=profile.onTarget+skillDelta*.0040+ovrFactor*.035+condition-pressure*profile.pressure-markers*profile.markers-anglePenalty*profile.angle+(space-50)*.00035;
  let finish=profile.finish+skillDelta*.0030+keeperFactor*.10+ovrFactor*.045+condition*.45-pressure*.00042-markers*.010-anglePenalty*.00055;
  let block=profileName==='penalty'?0:profile.blockBase+markers*.045+pressure*.00075-Math.max(0,space-45)*.00035;

  if(profileName==='clear'){onTarget+=.025;finish+=.025;block-=.015;}
  if(profileName==='long'){finish-=Math.max(0,78-Number(ctx.progress||0))*.0012;}
  if(profileName==='header')finish+=Number(engine.userSkills?.heading||skill)-50>.01?Math.max(-.025,Math.min(.05,(Number(engine.userSkills?.heading||skill)-50)*.0012)):0;

  onTarget=clamp(onTarget,profile.minTarget,.96);
  finish=clamp(finish,profile.minFinish,.88);
  block=clamp(block,0,.34);
  const goalChance=(1-block)*onTarget*finish;
  const matchupLabel=ovrDelta>=8?'Vantagem de OVR':ovrDelta<=-8?'Defesa com OVR superior':'Mesma faixa de OVR';

  return{
    profile:profileName,profileLabel:profile.label,
    goalChance:clamp(goalChance,.015,.86),onTargetChance:onTarget,goalGivenTarget:finish,blockChance:block,
    skill,skillKey,userOvr,keeperOvr:defense.keeperOvr,defenseOvr:defense.outfieldOvr,ovrDelta,matchupLabel,context:ctx
  };
}

function ratingDelta(engine,value,reason){
  engine.rating=clamp(Math.round((Number(engine.rating||6)+value)*10)/10,.1,10);
  engine.ratingLog.push({minute:engine.minute,value,reason,rating:engine.rating});
}
function stat(engine,team,key,inc=1){engine.stats[team][key]=(engine.stats[team][key]||0)+inc;}

function resolveBalancedShot(engine,choice){
  const user=engine.user,team=user.team,opp=opponentTeam(team),model=estimateShotOutcome(engine,choice);
  user.energy=clamp((Number(user.energy||0)-Number(choice.cost||choice.energyCost||0))/100,0,1)*100;
  engine.playerStats.shots++;stat(engine,team,'shots');
  if(choice.tags?.includes('penalty'))engine.feed(narrate('penalty',{},engine.rng),'penalty',user);
  else if(choice.tags?.includes('free_kick'))engine.feed(narrate('free_kick',{},engine.rng),'free_kick',user);
  engine.feed(narrate('shot',{player:user.name},engine.rng),'shot',user);

  const blocked=engine.rng()<model.blockChance;
  const onTarget=!blocked&&engine.rng()<model.onTargetChance;
  const goal=onTarget&&engine.rng()<model.goalGivenTarget;
  const result={success:onTarget,score:Math.round(model.goalChance*1000)/10,choice,followUp:null,shotOutcome:{...model,blocked,onTarget,goal}};

  if(goal){
    engine.score[team]++;stat(engine,team,'shotsOnTarget');stat(engine,team,'goals');engine.playerStats.goals++;
    engine.feed(narrate('goal',{player:user.name},engine.rng),'goal',user);ratingDelta(engine,1.25,'Gol');engine.possession=opp;
  }else if(onTarget){
    stat(engine,team,'shotsOnTarget');engine.feed(narrate('shot_saved',{},engine.rng),'shot',user);ratingDelta(engine,.08,'Finalização no alvo');engine.possession=opp;
  }else if(blocked){
    engine.feed(narrate('block',{},engine.rng),'block',user);ratingDelta(engine,-.04,'Finalização bloqueada');
    if(engine.rng()<.28){engine.possession=team;engine.ball.ownerId=user.id;}else engine.possession=opp;
  }else{
    engine.feed(narrate('shot_off',{},engine.rng),'shot',user);ratingDelta(engine,-.10,'Finalização desperdiçada');engine.possession=opp;
  }
  return result;
}

function maybeContextualHeader(engine,payload){
  if(payload?.situationKey!=='off_ball_attack'||!Array.isArray(payload.options)||payload.options.some(option=>option.tags?.includes('shot')))return;
  const title=String(payload.title||'').toLowerCase();
  if(!/(cruzamento|segunda trave|chega ao fundo|bola vai para o lado)/.test(title))return;
  if(engine.rng()>.58)return;
  const ctx=payload.gameplayContext||contextForShot(engine,{});
  const choice={key:'off_header_finish',label:'Atacar a bola e cabecear buscando o canto',skill:'heading',difficulty:Number(engine.directOpponent?.ovr||55)+7,cost:6,energyCost:6,tags:['shot','aerial','header'],description:'Cabeceio exige tempo de bola, posicionamento e disputa aérea.',context:ctx,skillValue:Math.round(Number(engine.userSkills?.heading||engine.user?.ovr||50))};
  const regular=payload.options.filter(option=>!option.rare);
  if(regular.length>=3){const replace=regular[regular.length-1],index=payload.options.indexOf(replace);payload.options[index]=choice;if(engine.pendingDecision?.options)engine.pendingDecision.options[index]=choice;}
}

function decorateShotProbabilities(engine,payload){
  maybeContextualHeader(engine,payload);
  for(const option of payload?.options||[]){
    if(!option.tags?.includes('shot'))continue;
    const model=estimateShotOutcome(engine,option);
    option.successChance=Math.round(model.goalChance*100);
    option.chanceLabel='Gol';
    option.shotProfile=model.profile;
    option.shotProfileLabel=model.profileLabel;
    option.onTargetChance=Math.round(model.onTargetChance*100);
    option.matchupLabel=model.matchupLabel;
    option.description=`${option.description||'Finalização.'} ${model.profileLabel} · ${model.matchupLabel.toLowerCase()}.`;
  }
}

function nudgeAttackerOpportunity(engine){
  const user=engine.user;if(!user?.onField||!['st','wing','am'].includes(user.role)||engine.possession!==user.team)return;
  const current=progressOf(engine,user.team,user.x);if(current<58||current>84)return;
  const positioning=Number(engine.userSkills?.positioning||engine.user?.ovr||50),defense=defensiveContext(engine),ovrDelta=Number(user.ovr||50)-defense.outfieldOvr;
  const chance=clamp(.045+(positioning-50)*.0017+ovrDelta*.0012,.025,.15);
  if(engine.rng()>=chance)return;
  const dir=attacksRight(engine,user.team)?1:-1,nudge=4+clamp((positioning-55)/35,0,1)*4;
  user.x=clamp((user.x+dir*nudge)/100,.04,.96)*100;
  user.y=50+(user.y-50)*.82;
  if(engine.ball.ownerId===user.id){engine.ball.x=user.x;engine.ball.y=user.y;}
}

function buildDevelopmentTips(engine,result){
  const ps=result?.playerStats||{},history=engine.decisionHistory||[];
  const shots=history.filter(item=>String(item?.key||'').match(/finish|shot|volley|chip|bicycle|scissor|header|panenka|knuckle|underwall|fk_|pen_/));
  const avgShotChance=shots.length?average(shots.map(item=>Number(item.chance||0))):0;
  const tips=[];
  const add=(skill,label,title,detail)=>{if(!tips.some(item=>item.skill===skill))tips.push({skill,label,title,detail});};

  if(Number(ps.shots||0)>=2&&Number(ps.goals||0)===0){
    if(avgShotChance>0&&avgShotChance<22)add('positioning','Posicionamento','Chegar em condições melhores',`Suas finalizações tiveram em média ${Math.round(avgShotChance)}% de chance. Melhor posicionamento ajuda a receber com menos pressão e ângulo melhor.`);
    else add('finishing_touch','Conclusão','Transformar chances em gol',`Você finalizou ${ps.shots} vez(es) sem marcar. Trabalhar conclusão aumenta a execução quando a oportunidade já foi construída.`);
  }
  if(Number(ps.dribblesAttempted||0)>=2){const rate=Number(ps.dribblesCompleted||0)/Math.max(1,Number(ps.dribblesAttempted||0));if(rate<.5)add('dribbling','Drible','Melhorar o um contra um',`Você completou ${ps.dribblesCompleted||0}/${ps.dribblesAttempted} dribles. Evoluir Drible aumenta sua capacidade de criar espaço sem tornar a ação automática.`);}
  const startEnergy=Number(ps.start_match_energy??engine.context?.state?.energy??80),endEnergy=Number(ps.end_match_energy??engine.user?.energy??0);
  if(endEnergy<28||startEnergy-endEnergy>62)add('stamina','Resistência','Sustentar qualidade até o fim',`Sua energia terminou em ${Math.round(endEnergy)}. Resistência permite manter mais qualidade nas decisões finais sem eliminar o custo das ações intensas.`);
  if(Number(ps.passesAttempted||0)>=5){const rate=Number(ps.passesCompleted||0)/Math.max(1,Number(ps.passesAttempted||0));if(rate<.72)add('short_pass','Passe curto','Dar mais continuidade às jogadas',`A precisão de passe ficou em ${Math.round(rate*100)}%. Passe curto ajuda a conservar ataques e criar novas decisões.`);}
  if(Number(ps.duelsLost||0)>Number(ps.duelsWon||0)+1)add('strength','Força','Competir melhor no contato',`Você perdeu ${ps.duelsLost} duelos e ganhou ${ps.duelsWon}. Força ajuda a proteger a bola e resistir ao contato, principalmente sob pressão.`);
  if(['st','wing','am'].includes(engine.user?.role)&&Number(ps.shots||0)===0&&Number(engine.userMoments||0)>=12)add('positioning','Posicionamento','Aparecer mais para finalizar','Você participou bastante, mas não encontrou finalizações. Posicionamento aumenta a frequência de boas zonas sem garantir uma chance clara em toda partida.');

  if(!tips.length)add('positioning','Posicionamento','Refinar a leitura dos espaços','Sua partida não mostrou uma fraqueza dominante. Posicionamento é uma evolução útil para transformar participação em situações mais vantajosas.');
  return tips.slice(0,3);
}

function renderPostgameEnhancements(engine,result){
  if(typeof document==='undefined')return;
  const render=()=>{
    const post=document.getElementById('matchPostgame');if(!post||post.classList.contains('hidden'))return false;
    if(post.querySelector('.postgame-development-advice'))return true;
    const tips=result?.playerStats?.development_tips||buildDevelopmentTips(engine,result);
    const anchor=post.querySelector('#postgameSave')||post.querySelector('.postgame-actions');if(!anchor)return false;
    const section=document.createElement('section');section.className='postgame-development-advice';
    section.innerHTML=`<div class="postgame-dev-head"><span>RELATÓRIO DA PARTIDA</span><strong>O que vale desenvolver agora</strong><small>São sugestões baseadas no que aconteceu hoje, não uma resposta obrigatória.</small></div><div class="postgame-dev-grid">${tips.map(tip=>`<article><span>${tip.label}</span><strong>${tip.title}</strong><p>${tip.detail}</p></article>`).join('')}</div><div class="postgame-xp-note">Partidas e atividades agora geram XP de carreira. Subir de nível concede pontos de evolução; cada ponto adiciona <b>12%</b> de progresso ao atributo escolhido, nunca +1 automático.</div>`;
    anchor.parentElement.insertBefore(section,anchor);return true;
  };
  if(!render())queueMicrotask(render);
}

if(typeof document!=='undefined'&&!document.querySelector('link[data-career-match-balance-css]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='src/pages/career/career-match-balance-v3.css?v=20260812-1';link.dataset.careerMatchBalanceCss='1';document.head.appendChild(link);
}

if(!CareerMatchEngine.prototype.__balancedFinishingV3Installed){
  const previousChoose=CareerMatchEngine.prototype.choose;
  const previousEmit=CareerMatchEngine.prototype.emit;
  const previousOpenMoment=CareerMatchEngine.prototype.openUserMoment;
  const previousResult=CareerMatchEngine.prototype.result;

  CareerMatchEngine.prototype.emit=function balancedMatchEmit(name,payload){
    if(name==='decision'&&payload?.options)decorateShotProbabilities(this,payload);
    const response=previousEmit.call(this,name,payload);
    if(name==='final')renderPostgameEnhancements(this,payload);
    return response;
  };

  CareerMatchEngine.prototype.choose=function balancedMatchChoose(key){
    const choice=this.pendingDecision?.options?.find(option=>option.key===key);
    if(!choice?.tags?.includes('shot')||this.pendingDecision?.goalkeeper||!this.user?.onField)return previousChoose.call(this,key);
    if(!this.awaitingDecision)return null;
    const result=resolveBalancedShot(this,choice);
    this.emit('choice',{...result,minute:this.minute,rating:this.rating,energy:this.user?.energy});
    this.pendingDecision=null;this.awaitingDecision=false;this.paused=false;this.emit('state',this.snapshot());return result;
  };

  CareerMatchEngine.prototype.openUserMoment=function balancedOpportunityMoment(...args){
    nudgeAttackerOpportunity(this);
    return previousOpenMoment.apply(this,args);
  };

  CareerMatchEngine.prototype.result=function balancedMatchResult(...args){
    const result=previousResult.apply(this,args);
    if(result?.playerStats)result.playerStats.development_tips=buildDevelopmentTips(this,result);
    return result;
  };

  Object.defineProperty(CareerMatchEngine.prototype,'__balancedFinishingV3Installed',{value:true,enumerable:false,configurable:false});
}
