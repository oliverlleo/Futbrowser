import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { deriveOpponentRatings } = await import('../src/pages/career/career-match-action-balance-v4.js?v=20260813-1');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('AI player attributes are persisted and synchronized in Supabase migrations',async()=>{
  const core=await read('supabase/migrations/20260813022724_ai_player_action_attributes_core.sql');
  const runtime=await read('supabase/migrations/20260813022742_ai_player_action_attributes_runtime.sql');
  const team=await read('supabase/migrations/20260813022806_career_team_profile_ai_action_attributes.sql');
  const match=await read('supabase/migrations/20260813022832_career_match_context_ai_action_attributes.sql');
  assert.match(core,/private\.base_ai_player_attributes/);
  assert.match(core,/pace integer NOT NULL/);
  assert.match(core,/marking integer NOT NULL/);
  assert.match(runtime,/trg_sync_ai_player_action_attributes/);
  assert.match(runtime,/private\.ai_player_attributes_json/);
  assert.match(team,/'attributes',private\.ai_player_attributes_json\(rb\.id\)/);
  assert.match(match,/'attributes',private\.ai_player_attributes_json\(r\.id\)/);
});

test('persisted defensive attributes matter more than OVR label alone',()=>{
  const defender=deriveOpponentRatings({id:'z59',position:'Zagueiro',ovr:59,archetype:'Defensor',attributes:{Velocidade:56,'Marcação':73,'Físico':67,Passe:56,'Visão de jogo':58,'Finalização':52}});
  const attacker=deriveOpponentRatings({id:'a61',position:'Atacante',ovr:61,archetype:'Finalizador',attributes:{Velocidade:63,'Marcação':48,'Físico':60,Passe:59,'Visão de jogo':63,'Finalização':72}});
  assert.ok(defender.defending>attacker.defending+10,`zagueiro ${defender.defending.toFixed(1)} vs atacante ${attacker.defending.toFixed(1)}`);
});