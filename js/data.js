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

  // Keep display casing but add lowercase key for lookups
  return cards.map(c => ({
    ...c,
    id: c.id || c.name,                  // original case for UI
    key: (c.id || c.name).toLowerCase()  // normalized lowercase key for lookups
  }));
}


export async function loadDecks() {
  const res = await fetch('./data/decks.json');
  if (!res.ok) throw new Error('Failed to load decks.json');
  return res.json();
}


export function buildDeckFromDef(def, cardMap) {
  if (!def || !Array.isArray(def.cards)) return [];

  return def.cards
    .map(rawId => {
      const key = rawId.toLowerCase();   // normalize deck ID
      const card = cardMap[key];         // look up safely
      if (!card) console.warn(`⚠️ Unknown card id in deck: ${rawId}`);
      return card ? { ...card } : null;  // clone per instance
    })
    .filter(Boolean);
}
