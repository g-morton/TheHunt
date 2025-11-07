// js/data.js
export const TYPES = {
  HUNTER: 'HUNTER',
  MONSTER: 'MONSTER',
  SUPPLY: 'SUPPLY'
};


function normalizeCard(c) {
  return {
    ...c,
    traits: Array.isArray(c.traits)
      ? c.traits.map(t => t.toLowerCase())
      : []
  };
}

export async function loadCards() {
  const res = await fetch('./data/cards.json');
  if (!res.ok) throw new Error('Failed to load cards.json');

  const cards = await res.json();
  return cards.map(normalizeCard);
}
