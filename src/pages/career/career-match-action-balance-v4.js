import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const opponentTeam=team=>team==='home'?'away':'home';
const teamPlayers=(engine,team)=>team==='home'?engine.home:engine.away;

const ROLE_BY_POSITION={
  GOL:'gk',GK:'gk',LD:'fb',LE:'fb',RB:'fb',LB:'fb',ZAG:'cb',CB:'cb',
  VOL:'dm',CDM:'dm',MC:'cm',CM:'cm',MEI:'am',CAM:'am',MD:'wing',ME:'wing',
  RW:'wing',LW:'wing',PD:'wing',PE:'wing',ATA:'st',ST:'st',CA:'st',CF:'st'
};

const ROLE_MODS={
  gk:{pace:-10,passing:-5,finishing:-20,physical:2,vision:-2,marking:-4},
  cb:{pace:-4,passing:-3,finishing:-10,physical:7,vision:-2,marking:9},
  fb:{pace:5,passing:0,finishing:-5,physical:2,vision:0,marking:5},
  dm:{pace:0,passing:1,finishing:-5,physical:4,vision:2,marking:6},
  cm:{pace:0,passing:4,finishing:0,physical:0,vision:4,marking:0},
  am:{pace:2,passing:5,finishing:2,physical:-3,vision:7,marking:-6},
  wing:{pace:7,passing:2,finishing:2,physical:-4,vision:1,marking:-7},
  st:{pace:4,passing:-2,finishing:7,physical:2,vision:0,marking:-9}
};

const ACTION_BASE={
  dribble:65,pass:78,chance:69,cross:72,run:72,sprint:69,
  tackle:62,interception:68,press:64,defend:70,support:87,duel:65,
  risk:93,foul:96,other:72
};
const GAP_WEIGHT={
  dribble:1.65,pass:.88,chance:1.02,cross:.96,run:1.08,sprint:1.22,
  tackle:1.34,interception:1.08,press:1.22,defend:1.05,support:.30,duel:1.35,
  risk:.15,foul:.10,other:.75
};

function roleOf(position){return ROLE_BY_POSITION[String(position||'').trim().toUpperCase()]||'cm';}
function hashNoise(id,key,spread=3){
  const text=`${id||'ai'}:${key}`;let h=2166136261;
  for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  const unit=((h>>>0)%10001)/10000;
  return (unit*2-1)*spread;
}
function readAttribute(player,keys){
  const attrs=player?.attributes||player?.atributos||{};
  for(const key of keys)if(attrs?.[key]!=null)return Number(attrs[key]);
  return null;
}
function archetypeAdjustments(archetype=''){
  const a=String(archetype).toLowerCase();
  const out={pace:0,passing:0,finishing:0,physical:0,vision:0,marking:0};
  if(/defensor|marcador|defensivo|destruidor|xerife|líbero|libero/.test(a)){out.marking+=5;out.physical+=3;out.pace-=1;}
  if(/driblador/.test(a)){out.pace+=3;out.passing+=2;out.marking-=4;out.physical-=1;}
  if(/finalizador|matador/.test(a)){out.finishing+=5;out.marking-=3;}
  if(/técnico|tecnico|maestro|organizador|clássico|classico/.test(a)){out.passing+=4;out.vision+=5;out.physical-=2;}
  if(/apoiador|motorzinho/.test(a)){out.passing+=2;out.vision+=2;out.pace+=1;out.physical+=1;}
  if(/parede|pivô|pivo/.test(a)){out.physical+=5;out.finishing+=2;out.pace-=2;}
  if(/velocista|móvel|movel|infiltrador/.test(a)){out.pace+=5;out.marking-=2;}
  return out;
}

export function deriveOpponentRatings(player={}){
  const ovr=Number(player.ovr||60),role=roleOf(player.position||player.primary_position),roleMods=ROLE_MODS[role]||ROLE_MODS.cm,arch=archetypeAdjustments(player.archetype);
  const aliases={
    pace:['Velocidade','velocidade','Pace','pace'],
    passing:['Passe','passe','Passing','passing'],
    finishing:['Finalização','Finalizacao','finalizacao','finishing'],
    physical:['Físico','Fisico','fisico','physical'],
    vision:['Visão de jogo','Visão','Visao','visao','vision'],
    marking:['Marcação','Marcacao','marcacao','marking']
  };
  const result={ovr,role};
  for(const key of Object.keys(aliases)){
    const explicit=readAttribute(player,aliases[key]);
    result[key]=clamp(explicit??(ovr+(roleMods[key]||0)+(arch[key]||0)+hashNoise(player.id,key,3.5)),20,99);
  }
  result.defending=clamp(result.marking*.55+result.physical*.20+result.pace*.15+ovr*.10,20,99);
  result.control=clamp(result.pace*.30+result.passing*.18+result.vision*.18+result.physical*.14+result.finishing*.08+ovr*.12,20,99);
  result.passingThreat=clamp(result.passing*.52+result.vision*.33+ovr*.15,20,99);
  result.runningThreat=clamp(result.pace*.52+result.physical*.18+result.vision*.10+ovr*.20,20,99);
  result.aerial=clamp(result.physical*.48+result.marking*.22+ovr*.30,20,99);
  return result;
}

function rawPlayer(engine,livePlayer){
  if(!livePlayer)return null;
  const side=livePlayer.team||opponentTeam(engine.user?.team||'home');
  const raw=(engine.context?.[side]?.players||[]).find(player=>String(player.id)===String(livePlayer.id));
  return raw?{...livePlayer,...raw}:livePlayer;
}
function nearestLiveOpponents(engine,limit=3){
  const user=engine.user;if(!user)return[];
  return (teamPlayers(engine,opponentTeam(user.team))||[])
    .filter(player=>player.onField&&!player.red)
    .map(player=>({player,distance:Math.hypot(Number(player.x||50)-Number(user.x||50),Number(player.y||50)-Number(user.y||50))}))
    .sort((a,b)=>a.distance-b.distance)
    .slice(0,limit)
    .map(entry=>rawPlayer(engine,entry.player));
}
function directRawOpponent(engine){return rawPlayer(engine,engine.directOpponent)||nearestLiveOpponents(engine,1)[0]||null;}
function primaryAction(tags=[]){
  for(const key of ['shot','dribble','cross','chance','pass','sprint','run','tackle','interception','press','defend','support','risk','foul','duel'])if(tags.includes(key))return key;
  return 'other';
}
function userSkill(engine,choice){return Number(choice.skillValue??engine.userSkills?.[choice.skill]??engine.user?.ovr??50);}
function legacyOpponentBase(engine){
  const rivals=(teamPlayers(engine,opponentTeam(engine.user?.team||'home'))||[]).filter(player=>player.onField&&!player.red);
  return Number(engine.directOpponent?.ovr||(rivals.reduce((sum,player)=>sum+Number(player.ovr||60),0)/Math.max(1,rivals.length))||60);
}
function inferLegacyOffset(engine,choice,ctx,kind){
  let offset=Number(choice.difficulty||legacyOpponentBase(engine))-legacyOpponentBase(engine);
  const advantage=Number(engine.playState?.advantage||0);
  if(kind==='dribble')offset-=Number(ctx.pressure||0)*.055+Number(ctx.markers||0)*1.5;
  else if(kind==='pass'||kind==='chance')offset-=Number(ctx.pressure||0)*.035+Number(ctx.markers||0)*.8;
  else if(kind==='cross')offset-=Number(ctx.pressure||0)*.03;
  else if(kind==='run'||kind==='sprint')offset-=Number(ctx.pressure||0)*.025;
  if(['dribble','pass','chance','cross','run','sprint'].includes(kind))offset+=advantage*.28;
  return clamp(offset,-14,22);
}
function localResistance(engine,kind){
  const direct=deriveOpponentRatings(directRawOpponent(engine)||{ovr:legacyOpponentBase(engine)});
  const near=nearestLiveOpponents(engine,3).map(deriveOpponentRatings);
  const avg=(key,fallback=direct[key])=>near.length?near.reduce((sum,item)=>sum+Number(item[key]||fallback),0)/near.length:fallback;
  if(kind==='dribble')return direct.defending;
  if(kind==='pass')return avg('defending')*.72+avg('passingThreat')*.08+legacyOpponentBase(engine)*.20;
  if(kind==='chance')return avg('defending')*.80+avg('runningThreat')*.08+legacyOpponentBase(engine)*.12;
  if(kind==='cross')return avg('aerial')*.56+avg('defending')*.34+legacyOpponentBase(engine)*.10;
  if(kind==='run'||kind==='sprint')return direct.runningThreat*.58+direct.defending*.32+direct.ovr*.10;
  if(kind==='tackle'||kind==='press'||kind==='defend'||kind==='duel')return direct.control;
  if(kind==='interception')return direct.passingThreat;
  if(kind==='support'||kind==='risk'||kind==='foul')return legacyOpponentBase(engine)*.45+50*.55;
  return legacyOpponentBase(engine);
}
function energyEffect(kind,energy){
  const e=clamp(energy,0,100);
  const bonus=e>88?Math.min(2,(e-88)*.12):0;
  const thresholds={dribble:60,pass:30,chance:38,cross:40,run:65,sprint:70,tackle:60,interception:48,press:62,defend:55,support:25,duel:60,risk:20,foul:20,other:45};
  const weights={dribble:.13,pass:.07,chance:.09,cross:.10,run:.16,sprint:.20,tackle:.14,interception:.10,press:.15,defend:.12,support:.05,duel:.14,risk:.03,foul:.02,other:.10};
  const threshold=thresholds[kind]??45,weight=weights[kind]??.10;
  return bonus-Math.max(0,threshold-e)*weight;
}
function situationalEffect(kind,ctx,engine){
  const pressure=Number(ctx.pressure??50),space=Number(ctx.space??50),markers=Number(ctx.markers??1),advantage=Number(engine.playState?.advantage||0);
  let effect=0;
  if(kind==='dribble')effect+=(space-50)*.06-(pressure-45)*.14-Math.max(0,markers-1)*7;
  else if(kind==='pass')effect+=(space-50)*.045-(pressure-48)*.09-Math.max(0,markers-1)*2.2;
  else if(kind==='chance')effect+=(space-50)*.04-(pressure-45)*.11-Math.max(0,markers-1)*3.2;
  else if(kind==='cross')effect+=(space-50)*.035-(pressure-48)*.08-Math.max(0,markers-1)*1.8;
  else if(kind==='run'||kind==='sprint')effect+=(space-50)*.07-(pressure-55)*.045-Math.max(0,markers-2)*2.0;
  else if(['tackle','interception','press','defend','duel'].includes(kind))effect+=(50-pressure)*.015;
  else if(kind==='support')effect+=(space-50)*.025;
  if(['dribble','pass','chance','cross','run','sprint'].includes(kind))effect+=advantage*.11;
  return effect;
}
function mentalEffect(engine){
  const preparation=Number(engine.userPreparation??engine.context?.state?.readiness??70);
  const mental=Number(engine.mentalStability??engine.context?.performance?.mental_stability??70);
  return (preparation-70)*.055+(mental-70)*.04;
}
function scoreContext(engine,choice){
  const team=engine.user?.team||'home',opp=opponentTeam(team),diff=Number(engine.score?.[team]||0)-Number(engine.score?.[opp]||0);
  if(engine.minute>=72){
    if(diff<0&&['chance','run','sprint','press'].some(tag=>choice.tags?.includes(tag)))return 3;
    if(diff>0&&['pass','support','defend','interception'].some(tag=>choice.tags?.includes(tag)))return 2;
    if(diff>0&&choice.tags?.includes('risk'))return-4;
  }
  return 0;
}
function instructionContext(engine,choice){
  const instruction=String(engine.coachInstruction||'').toLowerCase();let mod=0;
  if(instruction.includes('recompon')&&['defend','press','sprint'].some(tag=>choice.tags?.includes(tag)))mod+=2;
  if(instruction.includes('um contra um')&&choice.tags?.includes('dribble'))mod+=2;
  if(instruction.includes('passe vertical')&&choice.tags?.includes('chance'))mod+=2;
  if(instruction.includes('prote')&&['defend','interception'].some(tag=>choice.tags?.includes(tag)))mod+=1.5;
  if(instruction.includes('área')&&['run','aerial'].some(tag=>choice.tags?.includes(tag)))mod+=1.5;
  return mod;
}

export function estimateNonShotActionOutcome(engine,choice){
  if(!choice||choice.tags?.includes('shot'))return null;
  const ctx=choice.context||engine.playState?.currentContext||{pressure:50,space:50,markers:1,angle:50,progress:50};
  const kind=primaryAction(choice.tags||[]),skill=userSkill(engine,choice),resistance=localResistance(engine,kind),offset=inferLegacyOffset(engine,choice,ctx,kind);
  const gapWeight=GAP_WEIGHT[kind]??GAP_WEIGHT.other;
  let chance=(ACTION_BASE[kind]??ACTION_BASE.other)+(skill-resistance)*gapWeight-offset*.72;
  chance+=situationalEffect(kind,ctx,engine)+energyEffect(kind,engine.user?.energy??70)+mentalEffect(engine)+scoreContext(engine,choice)+instructionContext(engine,choice);
  if(choice.rare||choice.tags?.includes('special'))chance-=3.5;
  const floor=['support','risk','foul'].includes(kind)?18:5;
  const ceiling=['support','risk','foul'].includes(kind)?97:95;
  chance=clamp(chance,floor,ceiling);
  const opponent=directRawOpponent(engine);
  return{
    chance,
    kind,
    skill,
    resistance,
    legacyOffset:offset,
    opponent:opponent?{id:opponent.id,name:opponent.name,position:opponent.position||opponent.primary_position,ovr:Number(opponent.ovr||0),ratings:deriveOpponentRatings(opponent)}:null
  };
}

function coreDifficultyForTarget(engine,choice,targetChance){
  const skill=userSkill(engine,choice),readiness=(Number(engine.userPreparation||70)/100),energy=(Number(engine.user?.energy||70)/100),mental=(Number(engine.mentalStability||70)/100);
  const chemistry=choice.tags?.includes('pass')?Number(engine.user?.chemistry||0)*.04:0;
  const mods=scoreContext(engine,choice)+instructionContext(engine,choice)+chemistry;
  const desiredDeterministic=40.5+13*(clamp(targetChance,0,100)/100);
  let resolved=(skill*.58+(readiness*.22+energy*.18+mental*.12)*100-Number(choice.cost||0)*.12+mods-desiredDeterministic)/.38;
  if(choice.tags?.includes('dribble')){
    const duelAdjust=Number(engine.duelHistory?.losses||0)*1.8-Number(engine.duelHistory?.wins||0)*.6;
    resolved-=duelAdjust;
  }
  return resolved;
}
function labelForChance(chance){return chance>=76?'Favorável':chance>=52?'Equilibrada':chance>=32?'Difícil':'Muito difícil';}
function tuneDecision(engine,payload){
  const source=engine.pendingDecision?.options||payload.options||[];
  const tuned=source.map(choice=>{
    if(choice.tags?.includes('shot'))return choice;
    const model=estimateNonShotActionOutcome(engine,choice);if(!model)return choice;
    const next={...choice};
    next.difficulty=coreDifficultyForTarget(engine,next,model.chance);
    next.successChance=Math.round(model.chance);
    next.chanceLabel=labelForChance(model.chance);
    next.riskLabel=labelForChance(model.chance);
    next.matchup={kind:model.kind,skill:Math.round(model.skill),opponent_resistance:Math.round(model.resistance),opponent:model.opponent};
    next.balanceModel='action-v4';
    return next;
  });
  if(engine.pendingDecision)engine.pendingDecision.options=tuned;
  return{...payload,options:tuned,actionBalanceModel:'v4'};
}

if(!CareerMatchEngine.prototype.__actionBalanceV4Installed){
  const previousEmit=CareerMatchEngine.prototype.emit;
  CareerMatchEngine.prototype.emit=function(name,payload){
    if(name==='decision'&&payload?.options)payload=tuneDecision(this,payload);
    return previousEmit.call(this,name,payload);
  };
  Object.defineProperty(CareerMatchEngine.prototype,'__actionBalanceV4Installed',{value:true,enumerable:false,configurable:false});
}
