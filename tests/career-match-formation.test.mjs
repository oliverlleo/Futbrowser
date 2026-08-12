import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRoleFormation, FORMATION_ROLE_SLOTS, resolveFormationKey } from '../src/pages/career/career-match-engine-v3.js';

function piece(id,role,ovr=60){return{id,role,ovr,onField:true,red:false,x:50,y:50,homeX:50,homeY:50,isUser:false};}

const shuffled=[
  piece('st','st',70),piece('wing-r','wing',66),piece('cb-1','cb',63),piece('cm-1','cm',65),piece('gk','gk',62),
  piece('fb-1','fb',64),piece('dm','dm',67),piece('wing-l','wing',65),piece('cb-2','cb',64),piece('fb-2','fb',63),piece('cm-2','cm',64)
];

test('formation resolver understands formation labels with extra descriptive text',()=>{
  assert.equal(resolveFormationKey('4-3-3 Ofensivo'),'4-3-3');
  assert.equal(resolveFormationKey('bloco 4-2-3-1 compacto'),'4-2-3-1');
  assert.equal(resolveFormationKey('desconhecida'),'4-3-3');
});

test('role-aware formation never assigns shuffled striker to goalkeeper slot',()=>{
  const players=structuredClone(shuffled);
  applyRoleFormation(players,'4-3-3',true);
  const gk=players.find(p=>p.id==='gk');
  const st=players.find(p=>p.id==='st');
  const cbs=players.filter(p=>p.role==='cb');
  assert.equal(gk.tacticalSlot,'gk');
  assert.ok(gk.x<12,'goalkeeper must remain close to own goal');
  assert.equal(st.tacticalSlot,'st');
  assert.ok(st.x>70,'striker must occupy advanced central slot');
  assert.ok(cbs.every(p=>p.x<30),'centre-backs must form the defensive line');
});

test('halftime orientation inversion puts every tactical slot on the opposite x side',()=>{
  const first=structuredClone(shuffled);
  const second=structuredClone(shuffled);
  applyRoleFormation(first,'4-3-3',true);
  applyRoleFormation(second,'4-3-3',false);
  for(const p of first){
    const mirror=second.find(x=>x.id===p.id);
    assert.equal(Math.round(p.x+mirror.x),100,`${p.id} should mirror its x coordinate`);
    assert.equal(p.y,mirror.y,`${p.id} should keep lateral lane after side change`);
  }
});

test('every supported formation declares exactly eleven tactical roles',()=>{
  for(const [formation,roles] of Object.entries(FORMATION_ROLE_SLOTS))assert.equal(roles.length,11,formation);
});
