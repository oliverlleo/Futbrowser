import assert from 'node:assert/strict';
import test from 'node:test';

const { deriveOpponentIdentity }=await import('../src/pages/career/career-opponent-identity-v9.js?v=20260821-1');
await import('../src/pages/career/career-match-gameplay-depth-v2.js?v=20260812-2');
const { CareerMatchEngine }=await import('../src/pages/career/career-match-engine-v2.js?v=20260811-1');
await import('../src/pages/career/career-opponent-identity-patch-v9.js?v=20260821-1');

const players=Array.from({length:11},(_,index)=>({id:`p-${index}`,name:`Rival ${index}`,position:index<4?'ZAG':index<7?'VOL':'ATA',ovr:60+index}));
function base(away){return{seed:'identity',matchDate:'2026-10-10',player:{id:'user',name:'Oliver',position:'ATA',ovr:65,attributes:{Velocidade:65,Passe:65,'Finalização':65,'Físico':65,'Visão de jogo':65,'Marcação':55}},state:{energy:90,fatigue:10,readiness:80},selection:{status:'starter'},club:{name:'Casa',formation:'4-3-3',play_style:'equilibrado'},home:{name:'Casa',formation:'4-3-3',players:players},away:{name:'Rival',players, ...away}};}

test('high press opponent exposes a specific risk and exploit',()=>{
  const identity=deriveOpponentIdentity(base({formation:'4-3-3',play_style:'pressão alta'}));
  assert.equal(identity.key,'high_press');
  assert.match(identity.label,/Pressão/);
  assert.match(identity.risk,/costas/i);
  assert.match(identity.exploit,/toque|apoio/i);
  assert.equal(identity.pressure,'high');
});

test('low block opponent changes line and suggests a different attack',()=>{
  const identity=deriveOpponentIdentity(base({formation:'4-4-2',play_style:'bloco baixo'}));
  assert.equal(identity.key,'low_block');
  assert.equal(identity.line,-5);
  assert.equal(identity.pressure,'normal');
  assert.match(identity.exploit,/corredor|linha de fundo/i);
});

test('engine persists the opponent plan in tactics and snapshot',()=>{
  const context=base({formation:'4-3-3',play_style:'transição direta'});
  const engine=new CareerMatchEngine(context);
  engine.start();
  assert.equal(engine.opponentIdentity.key,'direct_transition');
  assert.equal(engine.teamTactics.away.pressure,'medium');
  assert.equal(engine.teamTactics.away.tempo,66);
  assert.equal(engine.snapshot().opponentIdentity.key,'direct_transition');
  assert.equal(engine.result().opponentIdentity.key,'direct_transition');
});
