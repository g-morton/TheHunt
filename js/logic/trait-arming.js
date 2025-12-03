// js/logic/trait-arming.js
// Keeps track of armed traits per card via WeakMap (no IDs needed)

const armedMap = new WeakMap(); // card -> Set(trait)

export function isArmed(card, trait){
  const set = armedMap.get(card);
  return !!(set && set.has(trait));
}

export function toggleArmed(card, trait){
  let set = armedMap.get(card);
  if (!set){ set = new Set(); armedMap.set(card, set); }
  if (set.has(trait)){ set.delete(trait); return false; }
  set.add(trait); return true;
}

// Optional: read all armed traits for a card (if you need later)
export function armedTraits(card){
  const set = armedMap.get(card);
  return set ? Array.from(set) : [];
}
