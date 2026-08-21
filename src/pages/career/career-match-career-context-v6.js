import { CareerMatchEngine, narrate } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const PHYSICAL_LABEL={overload:'Sobrecarga muscular',minor:'Distensão leve',moderate:'Lesão muscular moderada',severe:'Lesão muscular grave'};

function chemistryBonus(engine){
  return Number(engine.context?.performance?.team_chemistry_modifier||0);
}

function applyCareerContextToDecision(engine,payload){
  if(!payload?.options?.length)return payload;
  const bonus=chemistryBonus(engine);
  if(Math.abs(bonus)<.05)return payload;
  const weights={pass:1,chance:.9,cross:.7,support:.55};
  const tune=choice=>{
    if(choice?.tags?.includes('shot'))return choice;
    const key=Object.keys(weights).find(tag=>choice?.tags?.includes(tag));
    if(!key)return choice;
    const next={...choice};
    const delta=bonus*weights[key];
    next.skillValue=clamp(Number(next.skillValue??engine.userSkills?.[next.skill]??engine.user?.ovr??50)+delta,1,99);
    next.careerContext={...(next.careerContext||{}),lockerRoomBonus:Math.round(delta*10)/10};
    return next;
  };
  const options=payload.options.map(tune);
  if(engine.pendingDecision?.options)engine.pendingDecision.options=engine.pendingDecision.options.map(tune);
  return{...payload,options};
}

function dynamicPhysicalRisk(engine){
  const load=clamp(engine.context?.performance?.physical_load||0);
  const fatigue=clamp(engine.context?.state?.fatigue||0);
  const energy=clamp(engine.user?.energy??70);
  let risk=.00003;
  risk+=Math.max(0,load-35)/65*.00050;
  risk+=Math.max(0,fatigue-35)/65*.00045;
  risk+=Math.max(0,45-energy)/45*.00080;
  if(String(engine.context?.performance?.physical_risk||'')==='Sobrecarga')risk+=.00035;
  const mode=engine.matchIntensity||'moderate';
  risk*=mode==='light'?.68:mode==='intense'?1.45:1;
  return Math.max(.00002,Math.min(.00165,risk));
}

function riskBand(engine){
  const risk=dynamicPhysicalRisk(engine);
  if(risk>=.00105)return'Muito alto';
  if(risk>=.00062)return'Alto';
  if(risk>=.00028)return'Moderado';
  return'Baixo';
}

function chooseSeverity(engine,risk){
  const load=clamp(engine.context?.performance?.physical_load||0);
  const fatigue=clamp(engine.context?.state?.fatigue||0);
  const roll=engine.rng();
  if(risk<.00045&&load<55&&fatigue<50){
    if(roll<.80)return'overload';
    if(roll<.99)return'minor';
    return'moderate';
  }
  if(risk<.0010&&load<78&&fatigue<70){
    if(roll<.65)return'overload';
    if(roll<.93)return'minor';
    if(roll<.995)return'moderate';
    return'severe';
  }
  if(roll<.50)return'overload';
  if(roll<.85)return'minor';
  if(roll<.98)return'moderate';
  return'severe';
}

function injuryDays(engine,status){
  if(status==='overload')return 1+Math.floor(engine.rng()*2);
  if(status==='minor')return 2+Math.floor(engine.rng()*4);
  if(status==='moderate')return 7+Math.floor(engine.rng()*15);
  return 30+Math.floor(engine.rng()*61);
}

function replacementFor(engine,user){
  return{
    id:`injury-sub-${engine.minute}-${Math.floor(engine.rng()*99999)}`,
    name:'Reserva',position:user.position,ovr:Math.max(40,Number(user.ovr||55)-3),number:98,
    team:user.team,role:user.role,energy:92,yellow:false,red:false,onField:true,isUser:false,
    chemistry:50,relation:50,rivalry:false,x:user.x,y:user.y,homeX:user.homeX,homeY:user.homeY
  };
}

function forceInjurySubstitution(engine,status,label){
  const user=engine.user;
  if(!user?.onField)return;
  const incoming=replacementFor(engine,user);
  user.onField=false;
  engine.userSubbed=true;
  engine.home.push(incoming);
  engine.feed(narrate('sub',{out:user.name,in:incoming.name},engine.rng),'sub',incoming);
  engine.emit('injury',{minute:engine.minute,player:user.name,status,label});
  engine.emit('user_subbed',{minute:engine.minute,out:user,in:incoming,reason:`lesão · ${label}`});
}

function maybeCareerPhysicalIncident(engine){
  if(!engine.user?.onField||engine.playerStats?.match_injury||engine.minute<8)return;
  const risk=dynamicPhysicalRisk(engine);
  if(engine.rng()>=risk)return;
  const status=chooseSeverity(engine,risk),days=injuryDays(engine,status),label=PHYSICAL_LABEL[status];
  engine.playerStats.match_injury={status,label,days,minute:engine.minute,risk_band:riskBand(engine)};
  engine.feed(narrate('injury',{player:engine.user.name},engine.rng),'injury',engine.user);
  if(status==='overload'){
    engine.user.energy=clamp(Number(engine.user.energy||0)-6,0,100);
    engine.userPreparation=clamp(Number(engine.userPreparation||70)-4,0,100);
    engine.feed(`${engine.user.name} consegue continuar, mas reduz o ritmo depois do incômodo.`,'injury',engine.user);
    engine.emit('physical_warning',{minute:engine.minute,status,label,days});
    return;
  }
  forceInjurySubstitution(engine,status,label);
}

function ensureRiskHint(engine){
  const card=document.getElementById('matchIntensityControl');
  if(!card)return;
  let hint=document.getElementById('matchPhysicalRiskHint');
  if(!hint){
    hint=document.createElement('div');
    hint.id='matchPhysicalRiskHint';
    hint.className='match-physical-risk-hint';
    card.appendChild(hint);
  }
  const band=riskBand(engine);
  hint.dataset.risk=band.toLowerCase().replaceAll(' ','-');
  hint.innerHTML=`<span>Risco físico</span><strong>${band}</strong>`;
}

if(!CareerMatchEngine.prototype.__careerContextV6Installed){
  const previousEmit=CareerMatchEngine.prototype.emit;
  const previousIncident=CareerMatchEngine.prototype.maybeContextualIncident;
  CareerMatchEngine.prototype.emit=function careerContextEmit(name,payload){
    if(name==='decision'&&payload?.options)payload=applyCareerContextToDecision(this,payload);
    return previousEmit.call(this,name,payload);
  };
  CareerMatchEngine.prototype.maybeContextualIncident=function careerPhysicalIncident(...args){
    const result=previousIncident?.apply(this,args);
    if(this.user?.onField)maybeCareerPhysicalIncident(this);
    return result;
  };
  Object.defineProperty(CareerMatchEngine.prototype,'__careerContextV6Installed',{value:true,enumerable:false});
}

window.addEventListener('career:match-engine-ready',event=>{
  const engine=event.detail?.engine;
  if(!engine)return;
  setTimeout(()=>ensureRiskHint(engine),0);
  engine.on?.('state',()=>ensureRiskHint(engine));
  window.addEventListener('career:match-intensity-changed',()=>ensureRiskHint(engine));
});
