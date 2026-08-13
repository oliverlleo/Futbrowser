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

test('real Portuguese football positions produce different fallback defensive profiles',()=>{
  const defender=deriveOpponentRatings({id:'z59',position:'Zagueiro',ovr:59,archetype:'Defensor'});
  const winger=deriveOpponentRatings({id:'p59',position:'Ponta Direita',ovr:59,archetype:'Driblador'});
  assert.ok(defender.defending>winger.defending+8,`zagueiro ${defender.defending.toFixed(1)} vs ponta ${winger.defending.toFixed(1)}`);
});