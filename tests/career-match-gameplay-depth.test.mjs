import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

await import('../src/pages/career/career-match-gameplay-depth-v2.js?v=20260812-2');
const { CareerMatchEngine } = await import('../src/pages/career/career-match-engine-v2.js?v=20260811-1');

const roster=(prefix,ovr=62)=>[
  ['GOL','gk'],['LD','fb'],['ZAG','cb'],['ZAG','cb'],['LE','fb'],['VOL','dm'],['MC','cm'],['MEI','am'],['PD','wing'],['ATA','st'],['PE','wing']
].map(([position],index)=>({id:`${prefix}-${index}`,name:`${prefix} ${index}`,position,ovr,probable_starter:true,chemistry:60}));

function context(seed='depth-test',energy=90){
  return{
    seed,matchDate:'2026-08-30',
    player:{id:'user',name:'Oliver',nickname:'Oliver',position:'ATA',ovr:68,attributes:{Velocidade:70,Passe:64,'Finalização':72,'Físico':66,'Visão':65,'Marcação':45},skills:{dribbling:70,positioning:72,stamina:67}},
    state:{energy,fatigue:10,readiness:82},selection:{status:'starter'},performance:{preparation_score:82,mental_stability:78},
    club:{name:'União Litorânea Sub-17',formation:'4-3-3',play_style:'equilibrado'},
    home:{name:'União Litorânea Sub-17',formation:'4-3-3',players:roster('Casa',66)},
    away:{name:'Rival Sub-17',formation:'4-3-3',players:roster('Fora',65)}
  };
}

function boxDecision(seed,energy){
  const engine=new CareerMatchEngine(context(seed,energy));
  let payload=null;engine.on('decision',data=>{payload=data;});engine.start();
  engine.user.energy=energy;engine.user.x=86;engine.user.y=50;engine.ball.ownerId=engine.user.id;engine.ball.x=engine.user.x;engine.ball.y=engine.user.y;engine.possession='home';engine.openUserMoment();
  return{engine,payload};
}

function playScheduledMoments(seed,mode='moderate',minutes=90){
  const engine=new CareerMatchEngine(context(seed,92));
  const situations=[];let dribbleOffers=0;
  engine.on('decision',payload=>{if(!payload?.chain){situations.push(payload.situationKey);if(payload.options?.some(option=>option.tags?.includes('dribble')))dribbleOffers++;}});
  engine.start();engine.setMatchIntensity(mode);
  for(let minute=1;minute<=minutes;minute++){
    engine.minute=minute;
    if(!engine.shouldUserMoment())continue;
    engine.openUserMoment();
    let guard=0;
    while(engine.awaitingDecision&&engine.pendingDecision?.options?.length&&guard++<5){
      const choices=engine.pendingDecision.options.filter(option=>!option.rare);
      const selected=[...choices].sort((a,b)=>(a.energyCost??99)-(b.energyCost??99))[0]||engine.pendingDecision.options[0];
      engine.choose(selected.key);
    }
  }
  return{engine,situations,dribbleOffers};
}

const average=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);

test('normal decisions expose exactly three choices plus an optional rare fourth choice',()=>{
  const{payload}=boxDecision('three-options',85);
  assert.ok(payload);
  assert.ok(payload.options.length===3||payload.options.length===4);
  assert.equal(payload.options.slice(0,3).length,3);
  if(payload.options.length===4)assert.ok(payload.options[3].tags.includes('special'));
  for(const option of payload.options){
    assert.equal(typeof option.successChance,'number');
    assert.equal(typeof option.energyCost,'number');
    assert.ok(option.successChance>=1&&option.successChance<=99);
  }
});

test('low energy materially lowers the displayed probability for the same shot context',()=>{
  let pair=null;
  for(let i=0;i<60&&!pair;i++){
    const seed=`same-shot-${i}`;
    const high=boxDecision(seed,90).payload;
    const low=boxDecision(seed,20).payload;
    const highShot=high.options.find(option=>option.tags.includes('shot'));
    const lowShot=highShot&&low.options.find(option=>option.key===highShot.key);
    if(highShot&&lowShot)pair={highShot,lowShot};
  }
  assert.ok(pair,'at least one seeded box scenario should expose the same shot choice');
  assert.ok(pair.highShot.successChance>pair.lowShot.successChance,`${pair.highShot.successChance} should be greater than ${pair.lowShot.successChance}`);
});

test('match intensity is a live gameplay setting instead of presentation-only state',()=>{
  const engine=new CareerMatchEngine(context('intensity'));
  engine.start();
  assert.equal(engine.matchIntensity,'moderate');
  assert.equal(engine.setMatchIntensity('light'),'light');
  assert.equal(engine.matchIntensity,'light');
  assert.equal(engine.setMatchIntensity('intense'),'intense');
  assert.equal(engine.matchIntensity,'intense');
});

test('starter involvement has a healthy variable baseline instead of the old 10-16 hard ceiling',()=>{
  const moderate=[];
  for(let i=0;i<120;i++)moderate.push(playScheduledMoments(`moderate-${i}`,'moderate').engine.userMoments);
  const mean=average(moderate);
  assert.ok(mean>=16&&mean<=21,`moderate average should stay in a playable range, got ${mean.toFixed(2)}`);
  assert.ok(Math.min(...moderate)<Math.max(...moderate),'different matches must produce different involvement totals');
  assert.ok(Math.max(...moderate)>=20,'some matches should naturally be high-involvement');
});

test('light, moderate and intense change involvement without making every match identical',()=>{
  const light=[],moderate=[],intense=[];
  for(let i=0;i<80;i++){
    light.push(playScheduledMoments(`light-${i}`,'light').engine.userMoments);
    moderate.push(playScheduledMoments(`moderate-mode-${i}`,'moderate').engine.userMoments);
    intense.push(playScheduledMoments(`intense-${i}`,'intense').engine.userMoments);
  }
  const l=average(light),m=average(moderate),h=average(intense);
  assert.ok(l<m,`light ${l.toFixed(2)} should be below moderate ${m.toFixed(2)}`);
  assert.ok(m<h,`moderate ${m.toFixed(2)} should be below intense ${h.toFixed(2)}`);
  assert.ok(Math.max(...light)>Math.min(...light));
  assert.ok(Math.max(...intense)>Math.min(...intense));
});

test('attacker receives meaningful on-ball and dribble opportunities across matches without forcing them every moment',()=>{
  let total=0,onBall=0,dribble=0;
  for(let i=0;i<60;i++){
    const run=playScheduledMoments(`variety-${i}`,'moderate');
    total+=run.situations.length;
    onBall+=run.situations.filter(key=>['box_ball','wide_ball','build_under_pressure','central_ball','penalty_pressure','free_kick'].includes(key)).length;
    dribble+=run.dribbleOffers;
  }
  const onBallRate=onBall/Math.max(1,total),dribbleRate=dribble/Math.max(1,total);
  assert.ok(onBallRate>=.38,`expected a meaningful on-ball share, got ${(onBallRate*100).toFixed(1)}%`);
  assert.ok(onBallRate<=.78,`on-ball moments should not dominate every action, got ${(onBallRate*100).toFixed(1)}%`);
  assert.ok(dribbleRate>=.12,`dribble should be offered sometimes, got ${(dribbleRate*100).toFixed(1)}%`);
  assert.ok(dribbleRate<=.60,`dribble should not be offered all the time, got ${(dribbleRate*100).toFixed(1)}%`);
});

test('substitution is probabilistic instead of a fixed minute trigger',()=>{
  let substitutions=0;
  for(let i=0;i<120;i++){
    const engine=new CareerMatchEngine(context(`sub-${i}`));engine.start();engine.minute=76;engine.user.energy=44;engine.rating=6.2;engine.score={home:0,away:0};
    if(engine.maybeUserSubstitution())substitutions++;
  }
  assert.ok(substitutions>0,'some players should be substituted');
  assert.ok(substitutions<120,'substitution must not happen every time at the same minute');
});

test('gameplay catalog contains broad regular variation, anti-repeat selection and a large rare-action pool',async()=>{
  const source=await readFile(new URL('../src/pages/career/career-match-gameplay-depth-v2.js',import.meta.url),'utf8');
  const regularKeys=[...source.matchAll(/\['(?:box|wide|build|central|off|def|rec|sup)_[a-z_]+',/g)];
  const rareKeys=[...source.matchAll(/\['sp_[a-z_]+',/g)];
  assert.ok(regularKeys.length>=40,`expected at least 40 regular actions, got ${regularKeys.length}`);
  assert.ok(rareKeys.length>=20,`expected at least 20 rare actions, got ${rareKeys.length}`);
  assert.match(source,/offeredActionHistory/);
  assert.match(source,/situationHistory/);
  assert.match(source,/rareChance\(engine,key\)/);
  assert.match(source,/Math\.max\(0,ovr-55\)/);
  assert.match(source,/Math\.abs\(user\.y-50\)>18/);
});