import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { estimateShotOutcome } = await import('../src/pages/career/career-match-balance-v3.js?v=20260812-1');
await import('../src/pages/career/career-match-gameplay-depth-v2.js?v=20260812-2');
const { CareerMatchEngine } = await import('../src/pages/career/career-match-engine-v2.js?v=20260811-1');

const rolePositions=['GOL','LD','ZAG','ZAG','LE','VOL','MC','MEI','PD','ATA','PE'];
function roster(prefix,{gk=57,defense=54,mid=54,attack=56}={}){
  return rolePositions.map((position,index)=>{
    let ovr=mid;
    if(position==='GOL')ovr=gk;
    else if(['LD','LE','ZAG','VOL'].includes(position))ovr=defense;
    else if(['PD','PE','ATA'].includes(position))ovr=attack;
    return{id:`${prefix}-${index}`,name:`${prefix} ${index}`,position,ovr,probable_starter:true,chemistry:58};
  });
}

function context({seed='balance',ovr=50,finishing=55,heading=47,gk=57,defense=54,energy=86}={}){
  return{
    seed,matchDate:'2026-09-12',
    player:{
      id:'user',name:'Oliver',nickname:'Oliver',position:'ATA',ovr,
      attributes:{Velocidade:62,Passe:50,'Finalização':finishing,'Físico':46,'Visão de jogo':56,'Marcação':34},
      skills:{finishing_touch:finishing,heading,dribbling:56,positioning:57,stamina:46,short_pass:50}
    },
    state:{energy,fatigue:12,readiness:82},selection:{status:'starter'},
    performance:{preparation_score:82,mental_stability:78},
    club:{name:'União Litorânea Sub-17',formation:'4-3-3',play_style:'equilibrado'},
    home:{name:'União Litorânea Sub-17',formation:'4-3-3',players:roster('Casa',{gk:55,defense:53,mid:54,attack:56})},
    away:{name:'Paraná Futuro Sub-17',formation:'4-3-3',players:roster('Fora',{gk,defense,mid:defense,attack:defense})}
  };
}

function engineFor(options={}){
  const engine=new CareerMatchEngine(context(options));
  engine.start();
  engine.user.energy=options.energy??86;
  return engine;
}

const shot=(key,ctx,extra={})=>({key,label:key,skill:'finishing',difficulty:55,cost:4,energyCost:4,tags:['shot'],context:ctx,...extra});
const clearCtx={progress:91,pressure:20,markers:0,angle:86,space:82};
const boxCtx={progress:84,pressure:45,markers:1,angle:66,space:50};
const longCtx={progress:69,pressure:35,markers:1,angle:70,space:55};
const aerialCtx={progress:86,pressure:42,markers:1,angle:72,space:48};

test('a 55 finisher in a clear chance against similar U17 opposition is viable, not a 1 percent lottery',()=>{
  const model=estimateShotOutcome(engineFor(),shot('box_finish',clearCtx));
  assert.equal(model.profile,'clear');
  assert.ok(model.goalChance>=.30,`clear chance should be genuinely convertible, got ${(model.goalChance*100).toFixed(1)}%`);
  assert.ok(model.goalChance<=.68,`55 finishing must not become automatic, got ${model.goalChance}`);
  assert.equal(model.matchupLabel,'Mesma faixa de OVR');
});

test('shot difficulty follows football context: prepared box chance beats long shot, header and volley',()=>{
  const engine=engineFor();
  const controlled=estimateShotOutcome(engine,shot('box_set',boxCtx));
  const long=estimateShotOutcome(engine,shot('central_shot',longCtx));
  const header=estimateShotOutcome(engine,shot('off_header_finish',aerialCtx,{skill:'heading',cost:6,tags:['shot','aerial','header']}));
  const volley=estimateShotOutcome(engine,shot('sp_volley',aerialCtx,{cost:7,tags:['shot','aerial','special']}));
  assert.equal(controlled.profile,'controlled_box');
  assert.equal(long.profile,'long');
  assert.equal(header.profile,'header');
  assert.equal(volley.profile,'volley');
  assert.ok(controlled.goalChance>long.goalChance,`${controlled.goalChance} should beat long ${long.goalChance}`);
  assert.ok(controlled.goalChance>header.goalChance,`${controlled.goalChance} should beat header ${header.goalChance}`);
  assert.ok(controlled.goalChance>volley.goalChance,`${controlled.goalChance} should beat volley ${volley.goalChance}`);
  assert.ok(long.goalChance>=.04,'long shots must remain possible instead of hard-zeroing');
  assert.ok(header.goalChance>=.05,'headers must remain possible for developing players');
});

test('elite finishing is rewarded strongly but does not turn a clear chance into a guaranteed goal',()=>{
  const normal=estimateShotOutcome(engineFor({ovr:50,finishing:55}),shot('box_finish',clearCtx));
  const elite=estimateShotOutcome(engineFor({ovr:90,finishing:90}),shot('box_finish',clearCtx));
  assert.ok(elite.goalChance>normal.goalChance+.15,`elite ${elite.goalChance} should clearly beat normal ${normal.goalChance}`);
  assert.ok(elite.goalChance<.88,`even elite players must still miss/save sometimes, got ${elite.goalChance}`);
});

test('stronger defense and goalkeeper reduce scoring probability softly instead of making finishing impossible',()=>{
  const weak=estimateShotOutcome(engineFor({gk:48,defense:48}),shot('box_finish',clearCtx));
  const strong=estimateShotOutcome(engineFor({gk:76,defense:76}),shot('box_finish',clearCtx));
  assert.ok(weak.goalChance>strong.goalChance+.06,`weak ${weak.goalChance} should exceed strong ${strong.goalChance}`);
  assert.ok(strong.goalChance>.15,`a clear chance must remain alive against a stronger defense, got ${strong.goalChance}`);
  assert.equal(strong.matchupLabel,'Defesa com OVR superior');
});

test('actual shot resolution uses the same balanced model exposed to the decision UI',()=>{
  const engine=engineFor({seed:'actual-shot'});
  const choice=shot('box_finish',clearCtx);
  engine.pendingDecision={situation:{key:'box_ball',title:'Chance clara'},options:[choice],chain:0};
  engine.awaitingDecision=true;engine.paused=true;
  const expected=estimateShotOutcome(engine,choice);
  const result=engine.choose(choice.key);
  assert.ok(result?.shotOutcome,'shot must be resolved by the balanced shot model');
  assert.equal(result.shotOutcome.profile,expected.profile);
  assert.ok(result.shotOutcome.goalChance>=.30);
  assert.equal(typeof result.shotOutcome.onTarget,'boolean');
  assert.equal(typeof result.shotOutcome.goal,'boolean');
});

test('postgame result carries simple development advice based on what actually happened',()=>{
  const engine=engineFor({seed:'tips'});
  engine.playerStats.shots=3;engine.playerStats.goals=0;
  engine.playerStats.dribblesAttempted=4;engine.playerStats.dribblesCompleted=1;
  engine.playerStats.dribblesFailed=3;engine.playerStats.passesAttempted=8;engine.playerStats.passesCompleted=5;
  engine.decisionHistory=[{key:'box_finish',chance:24},{key:'central_shot',chance:9},{key:'box_set',chance:27}];
  const result=engine.result();
  assert.ok(Array.isArray(result.playerStats.development_tips));
  assert.ok(result.playerStats.development_tips.length>=1&&result.playerStats.development_tips.length<=3);
  assert.ok(result.playerStats.development_tips.some(tip=>['positioning','finishing_touch','dribbling','short_pass'].includes(tip.skill)));
});

test('career progression keeps idempotent XP and adds bracket-priced direct upgrades for attributes and specialties',async()=>{
  const base=await readFile(new URL('../supabase/migrations/20260812235052_career_level_xp_and_match_development.sql',import.meta.url),'utf8');
  const upgrade=await readFile(new URL('../supabase/migrations/20260813012636_evolution_points_direct_upgrades.sql',import.meta.url),'utf8');
  const security=await readFile(new URL('../supabase/migrations/20260813012736_restrict_evolution_upgrade_rpc.sql',import.meta.url),'utf8');
  const header=await readFile(new URL('../supabase/migrations/20260812235523_career_match_header_development_mapping.sql',import.meta.url),'utf8');
  assert.match(base,/private\.player_career_progression/);
  assert.match(base,/UNIQUE \(player_id, source_type, source_key\)/);
  assert.match(base,/career_xp_to_next/);
  assert.match(base,/trg_after_activity_career_xp/);
  assert.match(base,/trg_after_match_career_progression/);
  assert.match(base,/apply_match_gameplay_development/);
  assert.match(base,/LEAST\(8,SUM\(amount\)\)/);
  assert.match(upgrade,/career_evolution_upgrade_cost/);
  assert.match(upgrade,/COALESCE\(p_value,0\) < 50 THEN 1/);
  assert.match(upgrade,/p_value < 65 THEN 2/);
  assert.match(upgrade,/p_value < 75 THEN 3/);
  assert.match(upgrade,/p_value < 85 THEN 4/);
  assert.match(upgrade,/p_value < 90 THEN 5/);
  assert.match(upgrade,/p_value < 95 THEN 8/);
  assert.match(upgrade,/ELSE 10/);
  assert.match(upgrade,/MOD\(p_level,10\)=0 THEN 6/);
  assert.match(upgrade,/MOD\(p_level,10\)=5 THEN 3/);
  assert.match(upgrade,/ELSE 2/);
  assert.match(upgrade,/spend_career_evolution_upgrade/);
  assert.match(upgrade,/v_type NOT IN \('attribute','skill'\)/);
  assert.match(upgrade,/SET level=v_after_value,progress=v_after_progress/);
  assert.match(upgrade,/jsonb_set\(atributos,ARRAY\[p_target_key\],to_jsonb\(v_after_value\),true\)/);
  assert.match(upgrade,/'progress_preserved',v_after_value<99/);
  assert.match(upgrade,/evolution_points=evolution_points-v_cost/);
  assert.doesNotMatch(upgrade,/add_attribute_progress\(v_player,p_target_key,12\)/);
  assert.match(security,/REVOKE EXECUTE ON FUNCTION public\.spend_career_evolution_upgrade\(text,text\) FROM PUBLIC, anon/);
  assert.match(security,/GRANT EXECUTE ON FUNCTION public\.spend_career_evolution_upgrade\(text,text\) TO authenticated/);
  assert.match(header,/off_header_finish/);
  assert.match(header,/THEN 'heading'/);
});

test('development UI exposes direct +1 purchases and keeps a persistent integrated level summary outside the modal',async()=>{
  const source=await readFile(new URL('../src/pages/career/career-development-loop.js',import.meta.url),'utf8');
  const summary=await readFile(new URL('../src/pages/career/career-level-summary-v8.js',import.meta.url),'utf8');
  const loader=await readFile(new URL('../src/pages/career/career-loader-v3.js',import.meta.url),'utf8');
  const page=await readFile(new URL('../career.html',import.meta.url),'utf8');
  assert.match(source,/get_career_progression/);
  assert.match(source,/NÍVEL DE CARREIRA/);
  assert.match(source,/Pontos de evolução/);
  assert.match(source,/career-level-card/);
  assert.match(source,/spend_career_evolution_upgrade/);
  assert.match(source,/data-evolution-type/);
  assert.match(source,/upgradeButton\('attribute'/);
  assert.match(source,/upgradeButton\('skill'/);
  assert.match(source,/Como ganho pontos\?/);
  assert.doesNotMatch(source,/profileCareerLevel/);
  assert.doesNotMatch(source,/profile-level-xp/);
  assert.doesNotMatch(source,/installProfileLevelObserver/);
  assert.doesNotMatch(source,/Níveis normais dão 2 pts;/);
  assert.match(source,/O progresso ganho em treino e partida é preservado/);
  assert.doesNotMatch(source,/pointPercent/);
  assert.doesNotMatch(source,/spend_career_evolution_point/);
  assert.match(summary,/const badge=document\.getElementById\('careerLevelBadge'\)/);
  assert.match(summary,/host=player\?\.children\?\.\[1\]/);
  assert.match(summary,/host\.appendChild\(badge\)/);
  assert.match(summary,/event=>event\.stopPropagation\(\)/);
  assert.match(summary,/career-level-track/);
  assert.match(summary,/career-level-rank/);
  assert.match(summary,/career-level-summary-strip/);
  assert.match(summary,/career-level-xp/);
  assert.match(summary,/classList\.remove\('career-level-badge'\)/);
  assert.match(summary,/classList\.add\('career-level-summary-strip'\)/);
  assert.match(summary,/var\(--green-2\)/);
  assert.match(summary,/% para o nível/);
  assert.match(summary,/summarySignature/);
  assert.doesNotMatch(summary,/identity-player > div:last-child/);
  assert.match(loader,/career-development-loop\.js\?v=20260814-2/);
  assert.match(loader,/career-level-summary-v8\.js\?v=20260814-5/);
  assert.match(loader,/career-ui-usability-v6\.js\?v=20260814-9/);
  assert.match(page,/career-loader-v3\.js\?v=20260814-11/);
  assert.match(page,/career-level-summary-v8\.js\?v=20260814-5/);
});