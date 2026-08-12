import assert from 'node:assert/strict';
import fs from 'node:fs';

const monograms = fs.readFileSync('supabase/migrations/20260812103010_competition_distinct_club_monograms.sql','utf8');
const canonical = fs.readFileSync('supabase/migrations/20260812103520_canonical_club_crests.sql','utf8');
const rounds = fs.readFileSync('supabase/migrations/20260812103530_competition_keep_last_played_round.sql','utf8');
const loader = fs.readFileSync('src/pages/career/career-loader-v3.js','utf8');
const crestSync = fs.readFileSync('src/pages/career/career-club-crest-sync.js','utf8');

assert.ok(monograms.includes("nullif(btrim(shield_url),'') IS NULL"));
assert.match(canonical, /Academia Aurora Sub-18[\s\S]*academia_aurora_sub_18\.png/);
assert.match(canonical, /Atlético do Vale Sub-18[\s\S]*atletico_do_vale_sub_18\.png/);
assert.match(canonical, /Ferroviário Central Sub-18[\s\S]*ferroviario_central_sub_18\.png/);
assert.match(canonical, /Real Horizonte Sub-18[\s\S]*real_horizonte_sub_18\.png/);
assert.match(canonical, /União Litorânea Sub-18[\s\S]*uniao_litoranea_sub_18\.png/);
assert.ok(canonical.includes("AND nullif(btrim(shield_url),'') IS NULL"));

assert.match(crestSync, /club\.shield_url/);
assert.match(crestSync, /career:hub-rendered/);
assert.match(loader, /career-club-crest-sync\.js\?v=20260812-1/);

assert.match(rounds, /RENAME TO get_career_competition_hub_core/);
assert.match(rounds, /item->>'status'='completed'/);
assert.match(rounds, /v_last_played_round/);
assert.match(rounds, /p_round IS NULL/);

console.log('competition crest + last played round regression: ok');
