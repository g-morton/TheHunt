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

// Add to existing file:

export function armedForMechanic(card, mechanic){
  const set = armedMap.get(card);
  if (!set) return [];
  return Array.from(set).filter(tr => tr?.mechanic === mechanic);
}

// Consume (clear) a specific armed trait on this card
export function clearArmed(card, trait){
  const set = armedMap.get(card);
  if (!set) return;
  set.delete(trait);
  if (!set.size) armedMap.delete(card);
}

// Consume & return all armed traits for a given mechanic from a hunter list
export function popArmedTraitsFromHunters(hunters, mechanic){
  const armed = [];
  for (const h of (hunters || [])){
    const card = h?.card || h;
    if (!card) continue;
    const list = armedForMechanic(card, mechanic);
    if (list.length){
      for (const tr of list){
        armed.push({ card, trait: tr });
        clearArmed(card, tr);
      }
    }
  }
  return armed;
}
