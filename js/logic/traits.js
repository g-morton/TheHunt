export function traitsOf(card){
  const arr = Array.isArray(card?.traits) ? card.traits : [];
  return arr.filter(t => t && typeof t === 'object' && typeof t.mechanic === 'string');
}

export function findTraits(card, mechanic){
  return traitsOf(card).filter(t => t.mechanic === mechanic);
}

export function getParam(trait, key, fallback = 0){
  const v = trait?.params?.[key];
  return Number.isFinite(v) ? v : (v ?? fallback);
}

// Passive vs active: keep this tiny list in one place
export function isPassive(mechanic){
  return mechanic === 'sap' || mechanic === 'regimented';
}

const ACTIVE_MECHANICS = new Set([
  'boostPower',
  'boostFoil',
  'burnMonster',
  'multiAttack',
  'deckDrawOnHuntSuccess',
  'handMillRandom',
  'boostPowerAndHandMillCoinFlip',
]);

export function isActive(mechanic){
  return ACTIVE_MECHANICS.has(mechanic);
}