import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../supabase/migrations/20260814034033_career_market_pending_agreement_review_guard_v10.sql',import.meta.url),'utf8');

test('signed pending transfer freezes other external approaches until registration',()=>{
  assert.match(source,/player_transfer_agreements/);
  assert.match(source,/a\.status='pending'/);
  assert.match(source,/player_transfer_bids/);
  assert.match(source,/status='expired'/);
  assert.match(source,/player_offers/);
  assert.match(source,/status='withdrawn'/);
  assert.match(source,/blocked_by_pending_transfer',true/);
  assert.match(source,/active_offers>=3/);
  assert.match(source,/interval '45 days'/);
});
