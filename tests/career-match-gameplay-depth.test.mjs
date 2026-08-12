import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

await import('../src/pages/career/career-match-gameplay-depth.js?v=20260812-1');
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
  const high=boxDecision('same-seed',90).payload;
  const low=boxDecision('same-seed',20).payload;
  const highShot=high.options.find(option=>option.tags.includes('shot'));
  const lowShot=low.options.find(option=>option.key===highShot?.key);
  assert.ok(highShot&&lowShot,'same seeded decision should include the same shot option');
  assert.ok(highShot.successChance>lowShot.successChance,`${highShot.successChance} should be greater than ${lowShot.successChance}`);
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

test('substitution is probabilistic instead of a fixed minute trigger',()=>{
  let substitutions=0;
  for(let i=0;i<120;i++){
    const engine=new CareerMatchEngine(context(`sub-${i}`));engine.start();engine.minute=76;engine.user.energy=44;engine.rating=6.2;engine.score={home:0,away:0};
    if(engine.maybeUserSubstitution())substitutions++;
  }
  assert.ok(substitutions>0,'some players should be substituted');
  assert.ok(substitutions<120,'substitution must not happen every time at the same minute');
});

test('gameplay catalog contains broad regular variation and a large rare-action pool',async()=>{
  const source=await readFile(new URL('../src/pages/career/career-match-gameplay-depth.js',import.meta.url),'utf8');
  const regularKeys=[...source.matchAll(/\['(?:box|wide|build|central|off|def|rec|sup)_[a-z_]+',/g)];
  const rareKeys=[...source.matchAll(/\['sp_[a-z_]+',/g)];
  assert.ok(regularKeys.length>=40,`expected at least 40 regular actions, got ${regularKeys.length}`);
  assert.ok(rareKeys.length>=20,`expected at least 20 rare actions, got ${rareKeys.length}`);
  assert.match(source,/rareChance\(engine,key\)/);
  assert.match(source,/Math\.max\(0,ovr-55\)/);
});
