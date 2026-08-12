import { CareerMatchEngine as BaseCareerMatchEngine, FORMATIONS, NARRATOR_LIBRARY, narrate } from './career-match-engine-v2.js?v=20260811-1';

export { FORMATIONS, NARRATOR_LIBRARY, narrate };

export const FORMATION_ROLE_SLOTS={
  '4-3-3':['gk','fb','cb','cb','fb','cm','dm','cm','wing','st','wing'],
  '4-2-3-1':['gk','fb','cb','cb','fb','dm','dm','wing','am','wing','st'],
  '4-4-2':['gk','fb','cb','cb','fb','wing','cm','cm','wing','st','st'],
  '4-1-4-1':['gk','fb','cb','cb','fb','dm','wing','cm','cm','wing','st'],
  '3-5-2':['gk','cb','cb','cb','fb','cm','dm','cm','fb','st','st'],
  '3-4-3':['gk','cb','cb','cb','wing','cm','cm','wing','wing','st','wing'],
  '5-3-2':['gk','fb','cb','cb','cb','fb','cm','dm','cm','st','st']
};

const COMPATIBLE={
  gk:['gk'],
  cb:['cb','dm','fb'],
  fb:['fb','wing','cb','dm'],
  dm:['dm','cm','cb','am'],
  cm:['cm','dm','am','wing'],
  am:['am','cm','wing','st'],
  wing:['wing','fb','am','st','cm'],
  st:['st','wing','am']
};

export function resolveFormationKey(value){
  const raw=String(value||'').replace(/\s+/g,' ').trim();
  if(FORMATIONS[raw])return raw;
  return Object.keys(FORMATIONS).find(key=>raw.includes(key))||'4-3-3';
}

function candidateScore(player,slotRole){
  const order=COMPATIBLE[slotRole]||[slotRole];
  const compatibility=order.indexOf(player.role);
  const roleScore=compatibility<0?-100:100-(compatibility*18);
  const userBonus=player.isUser&&player.role===slotRole?8:0;
  return roleScore+Number(player.ovr||50)*.08+userBonus;
}

export function applyRoleFormation(players,formation,attacksRight=true){
  const key=resolveFormationKey(formation);
  const coords=FORMATIONS[key];
  const slots=FORMATION_ROLE_SLOTS[key];
  const available=players.filter(player=>player.onField&&!player.red);
  const used=new Set();

  slots.forEach((slotRole,index)=>{
    let candidate=available
      .filter(player=>!used.has(player.id))
      .sort((a,b)=>candidateScore(b,slotRole)-candidateScore(a,slotRole))[0];
    if(!candidate)return;
    used.add(candidate.id);
    let[x,y]=coords[index];
    if(!attacksRight)x=100-x;
    candidate.homeX=x;
    candidate.homeY=y;
    candidate.x=x;
    candidate.y=y;
    candidate.tacticalSlot=slotRole;
    candidate.tacticalSlotIndex=index;
  });
  return players;
}

export class CareerMatchEngine extends BaseCareerMatchEngine{
  constructor(context={}){
    super(context);
    this.homeFormation=resolveFormationKey(context.home?.formation||context.club?.formation);
    this.awayFormation=resolveFormationKey(context.away?.formation||context.opponent?.formation);
    applyRoleFormation(this.home,this.homeFormation,true);
    applyRoleFormation(this.away,this.awayFormation,false);
    if(this.user)this.user=this.home.find(player=>player.isUser)||this.user;
    this.directOpponent=this.resolveDirectOpponent();
  }

  startSecondHalf(){
    if(this.phase!=='halftime')return;
    this.homeAttacksRight=!this.homeAttacksRight;
    this.phase='second';
    applyRoleFormation(this.home,this.homeFormation,this.homeAttacksRight);
    applyRoleFormation(this.away,this.awayFormation,!this.homeAttacksRight);
    if(this.user)this.user=this.home.find(player=>player.isUser)||this.user;
    this.minute=45;
    this.second=0;
    this.paused=false;
    this.feed(narrate('restart',{},this.rng),'restart');
    this.emit('sidechange',this.snapshot());
  }
}
