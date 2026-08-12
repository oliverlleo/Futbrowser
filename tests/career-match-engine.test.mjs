import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CareerMatchEngine, FORMATIONS, NARRATOR_LIBRARY } from '../src/pages/career/career-match-engine-v2.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function context(selection='starter') {
  const teammates = ['GOL','LD','ZAG','ZAG','LE','VOL','MC','MEI','PD','ATA','PE'].map((position,index)=>({
    id:`h${index}`,name:`Casa ${index+1}`,position,ovr:62+index%4,number:index+1,probable_starter:true,chemistry:55
  }));
  const opponents = ['GOL','LD','ZAG','ZAG','LE','VOL','MC','MEI','PD','ATA','PE'].map((position,index)=>({
    id:`a${index}`,name:`Fora ${index+1}`,position,ovr:61+index%5,number:index+1,probable_starter:true
  }));
  return {
    seed:1357911,
    matchDate:'2026-08-11',
    competition:'Liga de Base',
    selection:{status:selection},
    player:{
      id:'player-1',name:'Jogador',nickname:'Oliver',position:'PD',ovr:67,shirt_number:17,archetype:'Driblador',
      attributes:{Velocidade:72,Passe:66,'Finalização':65,'Físico':61,'Visão':68,'Marcação':48},
      skills:[
        {key:'dribbling',level:74},{key:'sprint',level:76},{key:'short_pass',level:69},{key:'long_pass',level:63},
        {key:'crossing',level:70},{key:'positioning',level:73},{key:'tactical_awareness',level:68},{key:'stamina',level:65},
        {key:'strength',level:60},{key:'penalties',level:71},{key:'free_kicks',level:72}
      ]
    },
    state:{energy:86,fatigue:18,readiness:84},
    performance:{preparation_score:84,mental_stability:79,injury_risk_multiplier:1},
    club:{name:'União Litorânea Sub-18',formation:'4-3-3',play_style:'Posse agressiva'},
    home:{name:'União Litorânea Sub-18',formation:'4-3-3',players:teammates},
    away:{name:'Real Horizonte Sub-18',formation:'4-2-3-1',players:opponents}
  };
}

test('all supported formations contain eleven on-field coordinates', () => {
  for (const [name,coords] of Object.entries(FORMATIONS)) {
    assert.equal(coords.length,11,`${name} must contain 11 positions`);
    for (const [x,y] of coords) {
      assert.ok(x>=0&&x<=100,`${name} x out of bounds`);
      assert.ok(y>=0&&y<=100,`${name} y out of bounds`);
    }
  }
});

test('narrator has a large varied football-specific phrase library', () => {
  const lines = Object.values(NARRATOR_LIBRARY).flat();
  assert.ok(lines.length >= 100, `expected >=100 narration lines, found ${lines.length}`);
  for (const category of ['kickoff','possession','pressure','pass','long_pass','dribble_success','dribble_fail','shot','goal','corner','foul','yellow','red','tackle','interception','cross','counter','penalty','free_kick','halftime','restart','sub','injury','final']) {
    assert.ok(NARRATOR_LIBRARY[category]?.length>=3,`missing narration depth for ${category}`);
  }
});

test('starter match runs with decisions, halftime side swap, live stats and final rating', () => {
  const engine = new CareerMatchEngine(context('starter'));
  let decisions=0,halftimes=0,sidechanges=0,final=null;
  engine.on('decision',payload=>{decisions++;engine.choose(payload.options[0].key);});
  engine.on('halftime',()=>{halftimes++;engine.startSecondHalf();});
  engine.on('sidechange',()=>{sidechanges++;});
  engine.on('substitution',()=>engine.resume());
  engine.on('user_subbed',()=>engine.resume());
  engine.on('final',payload=>{final=payload;});
  engine.start();
  for(let i=0;i<2600&&!final;i++)engine.tick(.5);
  assert.ok(final,'match should finish');
  assert.equal(halftimes,1);
  assert.equal(sidechanges,1);
  assert.ok(decisions>=5,`expected several player decisions, found ${decisions}`);
  assert.ok(final.rating>=1&&final.rating<=10);
  assert.ok(final.stats.home.passesAttempted>0);
  assert.ok(final.stats.away.passesAttempted>0);
  assert.ok(final.playerStats.minutes>0);
  assert.equal(engine.homeAttacksRight,false,'teams must change sides after halftime');
});

test('bench player can enter later without pretending to have started', () => {
  const engine = new CareerMatchEngine(context('bench'));
  let entered=false,final=null;
  engine.on('decision',payload=>engine.choose(payload.options[0].key));
  engine.on('halftime',()=>engine.startSecondHalf());
  engine.on('substitution',()=>{entered=true;});
  engine.on('user_subbed',()=>engine.resume());
  engine.on('final',payload=>{final=payload;});
  engine.start();
  for(let i=0;i<2600&&!final;i++){
    engine.tick(.5);
    if(entered&&engine.paused&&!engine.awaitingDecision&&engine.phase!=='halftime')engine.resume();
  }
  assert.ok(final);
  assert.equal(final.started,false);
  assert.ok(entered,'bench player should receive a substitution entry in this seeded match');
  assert.ok(final.playerStats.minutes>0);
});

test('active match runtime contains animated pitch, pass visualization, player decisions, narration and live statistics', async () => {
  const runtime = await read('src/pages/career/career-match-runtime-v3.js');
  const css = await read('src/pages/career/career-match.css');
  const effects = await read('src/pages/career/career-match-effects.css');
  for (const token of ['matchPitch','matchPlayers','matchBall','matchPassLayer','matchDecision','matchCommentary','matchStats','matchPlayerStats','matchDirectOpponent','user_subbed','recordCareerMatchGameplay']) assert.match(runtime,new RegExp(token));
  for (const token of ['match-piece','match-pitch','match-ball','match-decision','match-commentary-panel','match-action-pulse']) assert.match(css,new RegExp(token));
  assert.match(effects,/pass-trail/);
  assert.match(effects,/decision-rival/);
});

test('match backend creates context, real opponent roster, one active session and persists enriched history metadata', async () => {
  const sql = await read('supabase/migrations/20260811193000_career_match_gameplay_engine.sql');
  for (const token of ['career_match_sessions','get_career_match_context','career_match_opponent','record_career_match_gameplay','player_match_history','engine','selection_status','opponent_club_id']) assert.match(sql,new RegExp(token));
  assert.match(sql,/base_ai_players/);
  assert.match(sql,/probable_starter/);
  assert.match(sql,/status='active'/);
});

test('safe Career Hub loader mounts hardened v3 runtime and realistic football flow patch', async () => {
  const loader = await read('src/pages/career/career-loader-v3.js');
  assert.match(loader,/career-match-football-flow-patch\.js/);
  assert.match(loader,/career-match-runtime-v3\.js/);
  assert.doesNotMatch(loader,/career-match-runtime-v2\.js/);
});
