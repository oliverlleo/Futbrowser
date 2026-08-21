import assert from 'node:assert/strict';
import test from 'node:test';

await import('../src/pages/career/career-match-football-flow-patch.js?v=20260811-2');
await import('../src/pages/career/career-match-balance-v3.js?v=20260812-1');
await import('../src/pages/career/career-match-action-balance-v4.js?v=20260813-1');
await import('../src/pages/career/career-match-possession-chain-v5.js?v=20260813-1');
await import('../src/pages/career/career-match-consequence-coherence-v7.js?v=20260813-1');
await import('../src/pages/career/career-match-decision-option-guard.js?v=20260813-1');
await import('../src/pages/career/career-match-gameplay-depth-v2.js?v=20260812-2');
const { CareerMatchEngine }=await import('../src/pages/career/career-match-engine-v2.js?v=20260811-1');
const { stateSnapshot, tacticalWindow }=await import('../src/pages/career/career-match-state-depth-v8.js?v=20260821-1');

const positions=['GOL','LD','ZAG','ZAG','LE','VOL','MC','MEI','PD','ATA','PE'];
function roster(prefix,base=62){return positions.map((position,index)=>({id:`${prefix}-${index}`,name:`${prefix} ${index}`,position,ovr:base+(index%3),probable_starter:true,chemistry:68,attributes:{Velocidade:base+4,Passe:base+4,'Finalização':base,'Físico':base,'Visão de jogo':base+5,'Marcação':base+3},skills:{short_pass:base+3,long_pass:base,stamina:base,tactical_awareness:base+4}}));}
function context(seed='state-depth'){return{seed,matchDate:'2026-10-10',player:{id:'user',name:'Oliver',nickname:'Oliver',position:'MC',ovr:66,attributes:{Velocidade:66,Passe:72,'Finalização':61,'Físico':64,'Visão de jogo':75,'Marcação':61},skills:{short_pass:72,long_pass:68,stamina:64,tactical_awareness:72}},state:{energy:94,fatigue:8,readiness:88},selection:{status:'starter'},performance:{preparation_score:88,mental_stability:82},club:{name:'União Litorânea Sub-17',formation:'4-3-3',play_style:'equilibrado'},home:{name:'União Litorânea Sub-17',formation:'4-3-3',players:roster('Casa')},away:{name:'Rival Sub-17',formation:'4-3-3',players:roster('Fora',64)}};}
function makeEngine(seed='state-depth'){const engine=new CareerMatchEngine(context(seed));engine.start();engine.paused=true;engine.user.energy=90;return engine;}
function prepare(engine,choice,situation='central_ball'){
  engine.user.x=62;engine.user.y=50;engine.possession='home';engine.ball.ownerId=engine.user.id;engine.ball.x=engine.user.x;engine.ball.y=engine.user.y;
  engine.pendingDecision={situation:{key:situation,title:'Teste'},options:[{...choice,difficulty:choice.forceFailure?180:1,context:{pressure:18,space:82,markers:0,progress:62,angle:88},successChance:choice.forceFailure?1:88,energyCost:choice.cost??2}],chain:0};
  engine.awaitingDecision=true;engine.paused=true;
}
const flush=()=>new Promise(resolve=>queueMicrotask(resolve));

test('state snapshot exposes a readable tactical window from the current match',()=>{
  const engine=makeEngine('window');
  const snapshot=stateSnapshot(engine);
  assert.equal(snapshot.possession,'home');
  assert.ok(['rebuild','progression','settled','danger','counter'].includes(snapshot.key));
  assert.equal(snapshot.label.length>0,true);
  assert.ok(Number.isFinite(snapshot.danger));
  assert.deepEqual(Object.keys(snapshot.corridor).sort(),['central','left','right']);
  assert.equal(tacticalWindow(engine).key,snapshot.key);
});

test('a successful progressive action produces a distinct tactical impact',async()=>{
  const engine=makeEngine('progressive');
  const choice={key:'central_vertical',label:'Passe vertical entre as linhas',skill:'shortPass',cost:3,tags:['pass']};
  prepare(engine,choice);
  const before=stateSnapshot(engine);
  const result=engine.choose(choice.key);
  await flush();
  assert.equal(result.success,true);
  assert.equal(result.tacticalImpact.success,true);
  assert.equal(result.tacticalImpact.label,'Posse reorganizada');
  assert.ok(result.tacticalState);
  assert.ok(result.tacticalState.threat.home>=before.threat.home);
  assert.equal(engine.matchStateDepth.lastAction.key,choice.key);
  assert.match(result.tacticalImpact.detail,/alterou|manteve|mudou/i);
});

test('a failed dribble records a real loss of momentum and possession change',async()=>{
  const engine=makeEngine('failed-dribble');
  const choice={key:'wide_inside',label:'Cortar para dentro conduzindo',skill:'dribble',cost:6,tags:['dribble'],forceFailure:true};
  prepare(engine,choice,'wide_ball');
  engine.user.x=70;engine.user.y=20;
  const result=engine.choose(choice.key);
  await flush();
  assert.equal(result.success,false);
  assert.equal(result.tacticalImpact.possessionChanged,true);
  assert.equal(result.tacticalImpact.success,false);
  assert.ok(result.tacticalState.momentum.home<0||result.tacticalState.momentum.away>0);
  assert.equal(engine.matchStateDepth.lastAction.key,choice.key);
});

test('match result keeps the tactical timeline for postgame feedback',()=>{
  const engine=makeEngine('result');
  engine.matchStateDepth.lastImpact={label:'Teste',detail:'Impacto persistente',success:true};
  engine.matchStateDepth.history=[{minute:12,action:'central_vertical',label:'Posse reorganizada',success:true}];
  const result=engine.result();
  assert.ok(result.tacticalState);
  assert.equal(result.tacticalTimeline.length,1);
  assert.equal(result.tacticalTimeline[0].action,'central_vertical');
});
