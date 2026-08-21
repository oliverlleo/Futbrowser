import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

function boxShot(engine,payload){
  const ctx=payload?.gameplayContext||engine.playState?.currentContext||{pressure:50,space:50,markers:1,progress:82,angle:65};
  const prepared=Number(ctx.pressure||50)<55&&Number(ctx.space||50)>38;
  return{
    key:prepared?'box_set':'box_finish',
    label:prepared?'Ajeitar o corpo e escolher o canto':'Finalizar no primeiro espaço',
    skill:'finishing',
    difficulty:Number(engine.directOpponent?.ovr||55)+(prepared?3:5),
    cost:prepared?3:4,
    energyCost:prepared?3:4,
    tags:['shot'],
    description:prepared?'Você tem um instante para preparar a batida antes da marcação fechar.':'Finalização rápida antes de o bloqueio chegar.',
    context:ctx,
    skillValue:Math.round(Number(engine.userSkills?.finishing||engine.user?.ovr||50)),
    forcedByContext:true
  };
}

if(!CareerMatchEngine.prototype.__decisionOptionGuardInstalled){
  const previousEmit=CareerMatchEngine.prototype.emit;
  CareerMatchEngine.prototype.emit=function decisionOptionGuardEmit(name,payload){
    if(name==='decision'&&payload?.situationKey==='box_ball'&&Array.isArray(payload.options)&&this.user?.onField&&this.ball?.ownerId===this.user.id){
      const hasShot=payload.options.some(option=>option.tags?.includes('shot'));
      if(!hasShot){
        const replacement=boxShot(this,payload);
        const regularIndexes=payload.options.map((option,index)=>({option,index})).filter(entry=>!entry.option.rare).map(entry=>entry.index);
        const index=regularIndexes.at(-1)??Math.max(0,payload.options.length-1);
        const options=[...payload.options];options[index]=replacement;payload={...payload,options};
        if(this.pendingDecision)this.pendingDecision.options=options;
      }
    }
    return previousEmit.call(this,name,payload);
  };
  Object.defineProperty(CareerMatchEngine.prototype,'__decisionOptionGuardInstalled',{value:true,enumerable:false,configurable:false});
}
