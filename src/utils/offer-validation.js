export const MAX_NEGOTIATION_ROUNDS = 3;

export const SQUAD_ROLES = Object.freeze([
  'Promessa',
  'Reserva',
  'Rotação',
  'Titular',
  'Estrela'
]);

function toInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(`${label} deve ser um número inteiro.`);
  }
  return number;
}

export function validateNegotiationRequest(requestedTerms, currentRound = 0) {
  if (Number(currentRound) >= MAX_NEGOTIATION_ROUNDS) {
    throw new Error('Número máximo de rodadas de negociação atingido.');
  }

  if (!requestedTerms || typeof requestedTerms !== 'object' || Array.isArray(requestedTerms)) {
    throw new Error('Termos de negociação inválidos.');
  }

  const requiredKeys = [
    'monthly_wage',
    'duration_seasons',
    'release_clause',
    'squad_role',
    'signing_bonus'
  ];

  for (const key of requiredKeys) {
    if (!(key in requestedTerms)) {
      throw new Error(`Campo obrigatório ausente: ${key}.`);
    }
  }

  const monthlyWage = toInteger(requestedTerms.monthly_wage, 'Salário');
  const durationSeasons = toInteger(requestedTerms.duration_seasons, 'Duração');
  const releaseClause = toInteger(requestedTerms.release_clause, 'Multa rescisória');
  const signingBonus = toInteger(requestedTerms.signing_bonus, 'Bônus de assinatura');
  const squadRole = String(requestedTerms.squad_role || '').trim();

  if (monthlyWage <= 0) throw new Error('Salário deve ser maior que zero.');
  if (durationSeasons < 1 || durationSeasons > 3) {
    throw new Error('Duração deve ser de 1 a 3 temporadas.');
  }
  if (releaseClause <= 0) throw new Error('Multa rescisória deve ser maior que zero.');
  if (signingBonus < 0) throw new Error('Bônus de assinatura não pode ser negativo.');
  if (!SQUAD_ROLES.includes(squadRole)) throw new Error('Função no elenco inválida.');

  return {
    monthly_wage: monthlyWage,
    duration_seasons: durationSeasons,
    release_clause: releaseClause,
    squad_role: squadRole,
    signing_bonus: signingBonus
  };
}

export function normalizeTolerance(value, { emergency = false, fallback = 100 } = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (emergency && parsed <= 0) return 1;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}
