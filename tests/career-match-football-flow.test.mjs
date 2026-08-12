import test from 'node:test';
import assert from 'node:assert/strict';
import { CareerMatchEngine } from '../src/pages/career/career-match-engine-v2.js?v=20260811-1';
import '../src/pages/career/career-match-formation-patch.js?v=20260811-2';
import '../src/pages/career/career-match-goalkeeper-patch.js?v=20260811-1';
import '../src/pages/career/career-match-football-flow-patch.js?v=20260811-1';
import '../src/pages/career/career-match-football-intelligence-patch.js?v=20260811-1';

function context(selection='out'){
  const positions=['Goleiro','Lateral Direito','Zagueiro','Zagueiro','Lateral Esquerdo','Volante','Meia','Meia','Ponta Direita','Atacante','Ponta Esquerda'];
  const build=(prefix,base)=>positions.map((position,index)=>({
    id:`${prefix}-${index}`,name:`${prefix}${index}`,position,ovr:base+(index%5),number:index+1,probable_starter:true,chemistry:58
  }));
  return{
    seed:771922,
    matchDate:'2026-08-11',selection:{status:selection},
    player:{id:'user',name:'User',nickname:'User',position:'Meia',ovr:67,shirt_number:8,attributes:{Velocidade:66,Passe:72,'Finalização':64,'Físico':64,'Visão':73,'Marcação':59},skills:[]},
    state:{energy:88,fatigue:15,readiness:84},performance:{preparation_score:84,mental_stability:76,injury_risk_multiplier:1},
    club:{name:'União Litorânea Sub-18',formation:'4-3-3',play_style:'Posse'},
    home:{name:'União Litorânea Sub-18',formation:'4-3-3',players:build('H',62)},
    away:{name:'Real Horizonte Sub-18',formation:'4-2-3-1',players:build('A',61)}
  };
}

function ownerRole(engine){
  return [...engine.home,...engine.away].find(player=>player.id===engine.ball.ownerId)?.role||null;
}

test('normal possession uses defenders and midfield before repeatedly jumping straight to attackers',()=>{
  const engine=new CareerMatchEngine(context('out'));
  const roles=[];
  let final=null;
  engine.on('state',()=>roles.push(ownerRole(engine)));
  engine.on('halftime',()=>engine.startSecondHalf());
  engine.on('final',value=>{final=value;});
  engine.start();
  for(let i=0;i<800&&!final;i++)engine.tick(.5);
  const seen=new Set(roles.filter(Boolean));
  assert.ok(seen.has('cb')||seen.has('fb'),'defensive line should participate in circulation');
  assert.ok(seen.has('dm')||seen.has('cm')||seen.has('am'),'midfield must receive the ball during normal build-up');
  assert.ok(seen.has('wing')||seen.has('st'),'attackers must also participate later in the sequence');
  const midfieldTouches=roles.filter(role=>['dm','cm','am'].includes(role)).length;
  assert.ok(midfieldTouches>=3,`expected recurring midfield involvement, found ${midfieldTouches}`);
});

test('high pressure makes striker and winger drop instead of staying glued to formation dots',()=>{
  const engine=new CareerMatchEngine(context('starter'));
  engine.start();
  engine.teamTactics.away.pressure='high';
  engine.possession='home';
  engine.matchFlow.phase='buildup';
  const striker=engine.home.find(player=>player.role==='st');
  const winger=engine.home.find(player=>player.role==='wing');
  assert.ok(striker&&winger);
  const strikerStart=striker.x;
  const wingerStart=winger.x;
  for(let i=0;i<40;i++)engine.animatePlayers();
  assert.ok(striker.x<strikerStart-3,`striker should drop under pressure: ${strikerStart} -> ${striker.x}`);
  assert.ok(winger.x<wingerStart-2,`winger should help build-up: ${wingerStart} -> ${winger.x}`);
});

test('defending forwards actually jump to press the ball during a high press',()=>{
  const engine=new CareerMatchEngine(context('out'));
  engine.start();
  engine.possession='home';
  engine.matchFlow.phase='buildup';
  engine.teamTactics.away.pressure='high';
  const holder=engine.home.find(player=>player.role==='cb');
  const presser=engine.away.find(player=>player.role==='st');
  engine.ball.ownerId=holder.id;engine.ball.x=holder.x;engine.ball.y=holder.y;
  const before=Math.hypot(presser.x-holder.x,presser.y-holder.y);
  for(let i=0;i<25;i++)engine.animatePlayers();
  const after=Math.hypot(presser.x-holder.x,presser.y-holder.y);
  assert.ok(after<before-8,`pressing forward should close distance: ${before} -> ${after}`);
});

test('counterattack stretches attacking team forward while defending team recovers toward own goal',()=>{
  const engine=new CareerMatchEngine(context('out'));
  engine.start();
  engine.possession='home';
  engine.matchFlow.phase='counter';
  engine.matchFlow.transitionUntil=engine.minute+3;
  const homeStriker=engine.home.find(player=>player.role==='st');
  const awayStriker=engine.away.find(player=>player.role==='st');
  const homeStart=homeStriker.x;
  const awayStart=awayStriker.x;
  for(let i=0;i<40;i++)engine.animatePlayers();
  assert.ok(homeStriker.x>homeStart+5,'home striker should attack depth on counter');
  assert.ok(awayStriker.x>awayStart+5,'away striker should recover toward own right-side goal when defending the counter');
});

test('fullback leaves formation reference to overlap the winger in advanced possession',()=>{
  const engine=new CareerMatchEngine(context('out'));
  engine.start();
  engine.possession='home';
  engine.matchFlow.phase='final';
  const winger=engine.home.filter(player=>player.role==='wing').sort((a,b)=>a.y-b.y)[0];
  const fullback=engine.home.filter(player=>player.role==='fb').sort((a,b)=>a.y-b.y)[0];
  winger.x=72;winger.y=18;engine.ball.ownerId=winger.id;engine.ball.x=winger.x;engine.ball.y=winger.y;
  const homeReference=fullback.homeX;
  for(let i=0;i<35;i++)engine.animatePlayers();
  assert.ok(fullback.x>homeReference+8,`fullback should overlap beyond formation reference: ${homeReference} -> ${fullback.x}`);
});

test('football flow contains multiple distinct phases and anti-repetition memory',async()=>{
  const {readFile}=await import('node:fs/promises');
  const flow=await readFile(new URL('../src/pages/career/career-match-football-flow-patch.js',import.meta.url),'utf8');
  const intelligence=await readFile(new URL('../src/pages/career/career-match-football-intelligence-patch.js',import.meta.url),'utf8');
  for(const phase of ['buildup','midfield','recycle','striker_drop','switch','press','escape_press','counter','through_ball','final_third','turnover','carry','wide_attack','cutback']){
    assert.match(flow,new RegExp(`${phase}:|['\"]${phase}['\"]`),`missing football phase ${phase}`);
  }
  for(const phase of ['overlap','underlap','midfield_duel','press_trigger','counter_killed','compact'])assert.match(intelligence,new RegExp(`${phase}:|['\"]${phase}['\"]`));
  assert.match(flow,/recentText/);
  assert.match(flow,/recentEvents/);
  assert.match(flow,/!recent\.includes\(text\)/);
  assert.match(intelligence,/recentEvents\.slice\(-4\)/);
});
