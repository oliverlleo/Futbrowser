import assert from 'node:assert/strict';
import {
  MAX_NEGOTIATION_ROUNDS,
  normalizeTolerance,
  validateNegotiationRequest
} from '../src/utils/offer-validation.js';

const valid = {
  monthly_wage: 1200,
  duration_seasons: 2,
  release_clause: 50000,
  squad_role: 'Rotação'
};

assert.deepEqual(validateNegotiationRequest(valid, 0), valid);
assert.deepEqual(
  validateNegotiationRequest({ ...valid, signing_bonus: 999999 }, 0),
  valid
);
assert.equal(MAX_NEGOTIATION_ROUNDS, 3);
assert.equal(normalizeTolerance(0, { emergency: true }), 1);
assert.equal(normalizeTolerance(0), 0);
assert.equal(normalizeTolerance(null), 100);
assert.throws(() => validateNegotiationRequest({ ...valid, monthly_wage: 0 }, 0), /maior que zero/);
assert.throws(() => validateNegotiationRequest({ ...valid, release_clause: 0 }, 0), /maior que zero/);
assert.throws(() => validateNegotiationRequest({ ...valid, duration_seasons: 4 }, 0), /1 a 3/);
assert.throws(() => validateNegotiationRequest({ ...valid, squad_role: 'Dono' }, 0), /inválida/);
assert.throws(() => validateNegotiationRequest({ ...valid, extra: 1 }, 0), /inválido/);
assert.throws(() => validateNegotiationRequest(valid, 3), /máximo/);

await import('./career-match-consequence-coherence-v7.test.mjs');

console.log('offer-validation: ok');
