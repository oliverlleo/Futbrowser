// ============================================================
// Futbrowser — Validators
// ============================================================

export function parseHeightMeters(value) {
  const normalized = String(value || '').replace(',', '.').replace(/[^0-9.]/g, '');
  const meters = Number(normalized);
  return Number.isFinite(meters) && meters >= 1.1 && meters <= 2.3 ? meters : null;
}

export function parseWeightKg(value) {
  const kg = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(kg) && kg >= 35 && kg <= 160 ? kg : null;
}

// Futuras validações
export function validatePlayerName(name) {
  return name && name.trim().length >= 3;
}
