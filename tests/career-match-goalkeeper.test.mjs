import test from 'node:test';
import assert from 'node:assert/strict';
import { CareerMatchEngine } from '../src/pages/career/career-match-engine-v2.js';
import '../src/pages/career/career-match-formation-patch.js';
import '../src/pages/career/career-match-goalkeeper-patch.js';

function context(){
  const positions=['Goleiro','Lateral Direito','Zagueiro','Zagueiro','Lateral Esquerdo','Volante','Meia','Meia','Ponta Direita','Atacante','Ponta Esquerda'];
  const home=positions.map((position,index)=>({id:`h-${index}`,name:`Casa ${index}`,position,ovr:60+index%5,number:index+1,probable_starter:index!==0,chemistry:55}));
  const away=positions.map((position,index)=>({id:`a-${index}`,name:`Fora ${index}`,position,ovr:61+index%4,number:index+1,probable_starter:true}));
  return{
    seed:221188,
    matchDate:'2026-08-11',
    selection:{status:'starter'},
    player:{id:'keeper',name:'Goleiro',nickname:'Muralha',position:'Goleiro',ovr:67,shirt_number:1,archetype:'Raçudo',attributes:{Velocidade:58,Passe:65,'Finalização':35,'Físico':70,'Visão':68,'Marcação':72},skills:[{key:'positioning',level:74},{key:'tactical_awareness',level:73},{key:'short_pass',level:67},{key:'long_pass',level:69},{key:'strength',level:71},{key:'heading',level:68}]},
    state:{energy:90,fatigue:12,readiness:88},performance:{preparation_score:88,mental_stability:82,injury_risk_multiplier:1},
    club:{name:'União Litorânea Sub-18',formation:'4-3-3',play_style:'Saída apoiada'},
    home:{name:'União Litorânea Sub-18',formation:'4-3-3',players:home},away:{name:'Real Horizonte Sub-18',formation:'4-2-3-1',players:away}
  };
}

test('goalkeeper uses a real goalkeeper slot and dedicated decisions instead of midfielder gameplay',()=>{
  const engine=new CareerMatchEngine(context());
  let keeperDecisions=0,final=null;
  engine.on('decision',payload=>{
    keeperDecisions++;
    assert.match(payload.title,/bola|cruzamento|atacante|finalizar|jogada|reiniciar/i);
    engine.choose(payload.options[0].key);
  });
  engine.on('halftime',()=>engine.startSecondHalf());
  engine.on('user_subbed',()=>engine.resume());
  engine.on('final',payload=>{final=payload;});
  engine.start();
  assert.equal(engine.user.role,'gk');
  assert.equal(engine.user.tacticalSlot,'gk');
  assert.ok(engine.user.x<12);
  for(let i=0;i<2800&&!final;i++)engine.tick(.5);
  assert.ok(final);
  assert.ok(keeperDecisions>=4,`expected goalkeeper decisions, found ${keeperDecisions}`);
  assert.ok((final.playerStats.keeperActions||0)>=4);
  assert.ok('saves' in final.playerStats);
  assert.ok('claims' in final.playerStats);
});

test('goalkeeper patch exposes football-specific live and post-game statistics',async()=>{
  const {readFile}=await import('node:fs/promises');
  const code=await readFile(new URL('../src/pages/career/career-match-goalkeeper-patch.js',import.meta.url),'utf8');
  for(const token of ['Defesas','Saídas altas','JOGO COM OS PÉS','gk_claim','gk_rush','gk_react','gk_short','gk_long','keeperErrors'])assert.match(code,new RegExp(token));
});
