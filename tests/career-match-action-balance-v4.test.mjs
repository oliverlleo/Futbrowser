import test from 'node:test';
import assert from 'node:assert/strict';

const { deriveOpponentRatings, estimateNonShotActionOutcome } = await import('../src/pages/career/career-match-action-balance-v4.js?v=20260813-1');

function livePlayer(raw,team='away',x=55,y=50){
  return {id:raw.id,name:raw.name||raw.id,position:raw.position,ovr:raw.ovr,team,onField:true,red:false,x,y};
}
function engineWithOpponent(raw,{energy=85,skill=57,pressure=48,space=52,markers=1}={}){
  const live=livePlayer(raw);
  return {
    user:{id:'user',team:'home',ovr:52,energy,chemistry:50,x:50,y:50},
    userSkills:{dribble:skill,shortPass:54,positioning:56,tactical:54,sprint:60,marking:40},
    userPreparation:80,mentalStability:76,minute:25,score:{home:0,away:0},coachInstruction:'',
    directOpponent:live,away:[live],home:[],duelHistory:{wins:0,losses:0},playState:{advantage:0,currentContext:{pressure,space,markers,angle:75,progress:65}},
    context:{away:{players:[raw]},home:{players:[]}}
  };
}
function dribbleChoice(engine){
  const ctx=engine.playState.currentContext;
  const legacyBase=engine.directOpponent.ovr;
  return {key:'central_carry',label:'Conduzir atacando o espaço',skill:'dribble',skillValue:57,cost:6,energyCost:6,tags:['dribble'],context:ctx,difficulty:legacyBase+4+ctx.pressure*.055+ctx.markers*1.5};
}

test('same OVR does not mean same defensive resistance',()=>{
  const marker=deriveOpponentRatings({id:'marker-59',position:'LD',ovr:59,archetype:'Marcador'});
  const dribbler=deriveOpponentRatings({id:'dribbler-59',position:'PD',ovr:59,archetype:'Driblador'});
  assert.ok(marker.defending>dribbler.defending+8,`marker ${marker.defending.toFixed(1)} should defend materially better than dribbler ${dribbler.defending.toFixed(1)}`);
});

test('dribble 57 is plausible against a 58/59 weak defender but difficult against an 80 defender',()=>{
  const weak={id:'weak-59',name:'Lateral ofensivo',position:'LD',ovr:59,archetype:'Driblador',attributes:{Velocidade:61,'Marcação':50,'Físico':54,Passe:59,'Visão de jogo':57,'Finalização':48}};
  const elite={id:'elite-80',name:'Zagueiro elite',position:'ZAG',ovr:80,archetype:'Marcador',attributes:{Velocidade:76,'Marcação':84,'Físico':83,Passe:70,'Visão de jogo':69,'Finalização':55}};
  const weakEngine=engineWithOpponent(weak);const eliteEngine=engineWithOpponent(elite);
  const weakModel=estimateNonShotActionOutcome(weakEngine,dribbleChoice(weakEngine));
  const eliteModel=estimateNonShotActionOutcome(eliteEngine,dribbleChoice(eliteEngine));
  assert.ok(weakModel.chance>=52,`57 dribble vs weak 59 defender should stay plausible, got ${weakModel.chance.toFixed(1)}%`);
  assert.ok(weakModel.chance<=78,`it should not become automatic, got ${weakModel.chance.toFixed(1)}%`);
  assert.ok(eliteModel.chance<=35,`57 dribble vs elite 80 defender should be difficult, got ${eliteModel.chance.toFixed(1)}%`);
  assert.ok(weakModel.chance>eliteModel.chance+25,`matchup gap should matter: ${weakModel.chance.toFixed(1)} vs ${eliteModel.chance.toFixed(1)}`);
});

test('low energy hurts explosive actions much more than simple support actions',()=>{
  const rival={id:'balanced-59',name:'Rival',position:'LD',ovr:59,archetype:'Equilibrado'};
  const high=engineWithOpponent(rival,{energy:85});
  const low=engineWithOpponent(rival,{energy:18});
  const ctx=high.playState.currentContext;
  const support={key:'sup_short',skill:'positioning',skillValue:56,cost:2,tags:['support'],context:ctx,difficulty:50};
  const sprint={key:'wide_burst',skill:'sprint',skillValue:60,cost:9,tags:['sprint','run'],context:ctx,difficulty:65};
  const supportHigh=estimateNonShotActionOutcome(high,support).chance;
  const supportLow=estimateNonShotActionOutcome(low,support).chance;
  const sprintHigh=estimateNonShotActionOutcome(high,sprint).chance;
  const sprintLow=estimateNonShotActionOutcome(low,sprint).chance;
  assert.ok(supportLow>=65,`simple positioning/support must not collapse at low energy, got ${supportLow.toFixed(1)}%`);
  assert.ok(supportHigh-supportLow<12,`support energy penalty should be modest, got ${(supportHigh-supportLow).toFixed(1)} points`);
  assert.ok(sprintHigh-sprintLow>=8,`explosive sprint should care much more about fatigue, got ${(sprintHigh-sprintLow).toFixed(1)} points`);
});
