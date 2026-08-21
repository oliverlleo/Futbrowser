import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('dashboard routes the Manager path and renders data-backed resources', () => {
  const dashboard = read('src/pages/dashboard/dashboard.js');
  const html = read('dashboard.html');

  assert.match(dashboard, /\["jogador", "manager", "tecnico", "presidente"\]/);
  assert.match(dashboard, /window\.location\.href = 'manager\.html'/);
  assert.match(dashboard, /manager_careers/);
  assert.match(dashboard, /cash_balance/);
  assert.match(dashboard, /window\.location\.replace\('career\.html'\)/);
  assert.doesNotMatch(dashboard, /await showFinalSplash\(\)/);
  assert.match(html, /id="resourceClubValue"/);
  assert.match(html, /id="resourceEnergyValue"/);
  assert.match(html, /id="resourceCashValue"/);
});

test('accepted initial offers remain visible and actionable until signing', () => {
  const service = read('src/services/offer-service.js');
  const ui = read('src/pages/dashboard/offers-ui.js');

  assert.match(service, /'countered', 'accepted'/);
  const acceptedAction = ui.split('\n').find(line => line.includes("offer.status === 'accepted'") && line.includes('btnAccept')) || '';
  assert.match(acceptedAction, /id="btnAccept"/);
  assert.doesNotMatch(acceptedAction, /disabled|Contrato Assinado/);
  assert.doesNotMatch(ui, /Tempo de jogo.*<strong>Regular<\/strong>/s);
  assert.doesNotMatch(ui, /Início previsto.*<strong>Imediato<\/strong>/s);
  assert.match(ui, /window\.location\.replace\('career\.html'\)/);
});

test('password recovery has a real update destination', () => {
  const resetPage = read('reset-password.html');
  const auth = read('src/services/auth-service.js');

  assert.match(auth, /reset-password\.html/);
  assert.match(resetPage, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(resetPage, /PASSWORD_RECOVERY/);
});

test('database migrations preserve accepted state and contract lineage', () => {
  const negotiation = read('supabase/migrations/20260821150000_fix_initial_offer_acceptance_and_onboarding.sql');
  const contract = read('supabase/migrations/20260821150100_fix_contract_lineage_and_terms.sql');
  const hardening = read('supabase/migrations/20260821150200_manager_path_and_rls_hardening.sql');

  assert.match(negotiation, /status = 'accepted', current_terms = v_response_terms/);
  assert.match(negotiation, /status IN \('new', 'reviewed', 'negotiating', 'countered', 'accepted'\)/);
  assert.match(contract, /source_offer_id/);
  assert.match(contract, /row_number\(\) OVER/);
  assert.match(hardening, /usuarios_caminho_domain_check/);
  assert.match(hardening, /competition_definitions ENABLE ROW LEVEL SECURITY/);
  assert.match(hardening, /player_sponsor_performance_rewards ENABLE ROW LEVEL SECURITY/);
});
