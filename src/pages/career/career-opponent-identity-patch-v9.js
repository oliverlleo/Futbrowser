import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';
import { applyOpponentPlan, deriveOpponentIdentity } from './career-opponent-identity-v9.js?v=20260821-1';

if(!CareerMatchEngine.prototype.__opponentIdentityV9Installed){
  const previousStart=CareerMatchEngine.prototype.start;
  const previousUpdateTactics=CareerMatchEngine.prototype.updateTactics;
  const previousSnapshot=CareerMatchEngine.prototype.snapshot;
  const previousResult=CareerMatchEngine.prototype.result;

  CareerMatchEngine.prototype.start=function(...args){
    this.opponentIdentity=this.context?.opponentIdentity||deriveOpponentIdentity(this.context||{});
    const result=previousStart.apply(this,args);
    applyOpponentPlan(this);
    return result;
  };
  CareerMatchEngine.prototype.updateTactics=function(...args){
    const result=previousUpdateTactics.apply(this,args);
    applyOpponentPlan(this);
    return result;
  };
  CareerMatchEngine.prototype.snapshot=function(...args){
    const snapshot=previousSnapshot.apply(this,args);
    return{...snapshot,opponentIdentity:this.opponentIdentity?{...this.opponentIdentity,strengths:this.opponentIdentity.strengths?.map(item=>({...item}),),weakness:this.opponentIdentity.weakness?{...this.opponentIdentity.weakness}:null}:null};
  };
  CareerMatchEngine.prototype.result=function(...args){
    const result=previousResult.apply(this,args);
    return{...result,opponentIdentity:this.opponentIdentity?{...this.opponentIdentity}:null};
  };
  Object.defineProperty(CareerMatchEngine.prototype,'__opponentIdentityV9Installed',{value:true,enumerable:false,configurable:false});
}
