import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/pages/career/career-match-football-flow-patch.js?v=20260811-2');
await import('../src/pages/career/career-match-balance-v3.js?v=20260812-1');
await import('../src/pages/career/career-match-action-balance-v4.js?v=20260813-1');
const { classifyCareerAction, normalizeCareerChoice, estimateServiceChance } = await import('../src/pages/career/career-match-possession-chain-v5.js?v=20260813-1');
await import('../src/pages/career/career-match-gameplay-depth-v2.js?v=20260812-2');
const { CareerMatchEngine } = await import('../src/pages/career/career-match-engine-v2.js?v=20260811-1');

const positions=['GOL','LD','ZAG','ZAG','LE','VOL','MC','MEI','PD','ATA','PE'];
function roster(prefix,base=58){
  return positions.map((position,index)=>{
    const isDef=['LD','LE','ZAG','VOL'].includes(position),isCreator=['MC','MEI'].includes(position),isAtt=['PD','PE','ATA'].includes(position);
    const ovr=base+(isCreator?2:isAtt?1:0);
    return{
      id:`${prefix}-${index}`,name:`${prefix} ${index}`,position,ovr,probable_starter:true,chemistry:62,
      attributes:{
        Velocidade:ovr+(isAtt?5:0),Passe:ovr+(isCreator?6:0),'Finalização':ovr+(isAtt?5:-5),'Físico':ovr+(isDef?5:0),'Visão de jogo':ovr+(isCreator?7:0),'Marcação':ovr+(isDef?8:-8)
      }
    };
  });
}
function context(seed='chain'){
  return{
    seed,matchDate:'2026-10-10',
    player:{
      id:'user',name:'Oliver',nickname:'Oliver',position:'ATA',ovr:58,
      attributes:{Velocidade:63,Passe:55,'Finalização':57,'Físico':50,'Visão de jogo':58,'Marcação':34},
      skills:{dribbling:57,positioning:60,stamina:52,short_pass:56,long_pass:54,crossing:53,heading:55,tactical_awareness:57}
    },
    state:{energy:94,fatigue:8,readiness:84},selection:{status:'starter'},performance:{preparation_score:84,mental_stability:78},
    club:{name:'União Litorânea Sub-17',formation:'4-3-3',play_style:'equilibrado'},
    home:{name:'União Litorânea Sub-17',formation:'4-3-3',players:roster('Casa',60)},
    away:{name:'Rival Sub-17',formation:'4-3-3',players:roster('Fora',58)}
  };
}
function engineFor(seed='chain'){
  const engine=new CareerMatchEngine(context(seed));engine.start();engine.user.energy=90;return engine;
}
function teammate(engine){return engine.home.find(player=>player.onField&&!player.isUser&&['am','cm','wing'].includes(player.role))||engine.home.find(player=>player.onField&&!player.isUser&&player.role!=='gk');}
function setBall(engine,player){engine.possession=player.team;engine.ball.ownerId=player.id;engine.ball.x=player.x;engine.ball.y=player.y;}
function prepare(engine,choice,{situation='central_ball',withBall=true,progress=70}={}){
  engine.user.x=progress;engine.user.y=50;
  const owner=withBall?engine.user:teammate(engine);setBall(engine,owner);
  const normalized=normalizeCareerChoice({energyCost:choice.cost??3,context:{pressure:25,space:75,markers:1,progress,angle:82},...choice});
  engine.pendingDecision={situation:{key:situation,title:'Teste'},options:[normalized],chain:0};engine.awaitingDecision=true;engine.paused=true;
  return normalized;
}

const flush=()=>new Promise(resolve=>queueMicrotask(resolve));

test('off-ball chance actions are explicit runs instead of being misrouted through the pass resolver',()=>{
  const choice=normalizeCareerChoice({key:'off_cutback',label:'Frear e aparecer para o passe para trás',skill:'positioning',difficulty:25,cost:4,tags:['run','chance']});
  assert.equal(classifyCareerAction(choice),'off_ball_run');
  assert.ok(choice.tags.includes('run'));
  assert.ok(!choice.tags.includes('chance'));
  assert.ok(!choice.tags.includes('pass'));
});

test('similar-level teammate service is normally plausible after a correct attacking movement',()=>{
  const engine=engineFor('service');const passer=teammate(engine);setBall(engine,passer);engine.user.x=73;engine.user.y=50;
  const choice=normalizeCareerChoice({key:'off_cutback',skill:'positioning',difficulty:30,cost:4,tags:['run','chance'],context:{pressure:38,space:62,markers:1,progress:73,angle:82}});
  const chance=estimateServiceChance(engine,choice,passer);
  assert.ok(chance>=.64,`service should be realistically available, got ${(chance*100).toFixed(1)}%`);
  assert.ok(chance<=.94,'service still cannot be automatic');
});

test('off-ball movement no longer counts as a fake pass when it resolves',async()=>{
  const engine=engineFor('off-run-resolve');
  prepare(engine,{key:'off_cutback',label:'Frear e aparecer para o passe para trás',skill:'positioning',difficulty:18,cost:4,tags:['run','chance']},{situation:'off_ball_attack',withBall:false,progress:74});
  const before=engine.playerStats.passesAttempted;
  const result=engine.choose('off_cutback');await flush();
  assert.equal(result.actionType,'off_ball_run');
  assert.equal(engine.playerStats.passesAttempted,before,'off-ball movement must not execute the pass resolver');
});

test('a successful one-two can really return the ball and continue the same attack',async()=>{
  let found=false;
  for(let i=0;i<30&&!found;i++){
    const engine=engineFor(`wall-${i}`);
    prepare(engine,{key:'central_wall',label:'Tabela curta para ultrapassar a marcação',skill:'shortPass',difficulty:12,cost:3,tags:['pass','run']},{withBall:true,progress:69});
    const result=engine.choose('central_wall');await flush();
    if(result.success&&result.continuation&&engine.ball.ownerId===engine.user.id&&engine.awaitingDecision)found=true;
  }
  assert.ok(found,'at least one deterministic seed should complete the return pass and create the next decision');
});

test('a killer pass that succeeds creates an actual teammate shot instead of a dead success message',async()=>{
  const engine=engineFor('killer');
  prepare(engine,{key:'central_killer',label:'Enfiar a bola nas costas da zaga',skill:'vision',difficulty:8,cost:5,tags:['pass','chance']},{withBall:true,progress:75});
  const before=engine.stats.home.shots;
  const result=engine.choose('central_killer');await flush();
  assert.ok(result.success,'favorable test pass should succeed');
  assert.equal(result.actionType,'chance_pass');
  assert.equal(result.createdShot,true);
  assert.ok(engine.stats.home.shots>before,'successful killer pass must produce a real shot attempt');
  assert.ok((engine.playerStats.chancesCreated||0)>=1);
});

test('successful dribble still creates a continuation even when the old sequence counter is already above three',async()=>{
  const engine=engineFor('no-three-cap');engine.playState.sequence=8;
  prepare(engine,{key:'central_carry',label:'Conduzir atacando o espaço',skill:'dribble',difficulty:8,cost:6,tags:['dribble']},{withBall:true,progress:72});
  const result=engine.choose('central_carry');await flush();
  assert.ok(result.success);
  assert.equal(result.actionType,'dribble');
  assert.equal(result.continuation,true,'continuity must end for football reasons, not because sequence reached three');
  assert.equal(engine.awaitingDecision,true);
  assert.ok(engine.pendingDecision?.options?.length>=3);
});

test('a successful progressive pass advances the football-flow phase instead of disappearing from the match state',async()=>{
  const engine=engineFor('progress-pass');engine.matchFlow.phase='midfield';
  prepare(engine,{key:'central_vertical',label:'Passe vertical entre as linhas',skill:'shortPass',difficulty:10,cost:3,tags:['pass']},{withBall:true,progress:61});
  const result=engine.choose('central_vertical');await flush();
  assert.ok(result.success);
  assert.equal(result.actionType,'progressive_pass');
  assert.ok(['progression','final'].includes(engine.matchFlow.phase),`expected progressed phase, got ${engine.matchFlow.phase}`);
});
