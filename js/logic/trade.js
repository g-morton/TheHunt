// js/logic/trade.js (V5 clean version)

import { State, SIDES } from '../core/state.js';
import { topOf, isSupply, isHunter } from './utils.js';
import { log } from '../core/log.js';


import {
  discardTrade
} from './discard.js';


function getSupplyType(card){
  if (!card) return null;
  // Use tag/name and normalise to lowercase for comparison
  const raw = card.tag || card.name || null;
  return raw ? String(raw).trim().toLowerCase() : null;
}

/**
 * Normalise a hunter's requires field into a canonical form:
 *  - case-insensitive keys
 *  - supports shorthand numeric: requires: 2  => { any: 2 }
 *  - supports "Any", "ANY", etc.: all treated as "any".
 *
 * Returns an object: { any: number, types: { kit: n, script: m, ... } }
 */
function normaliseRequires(rawReq){
  const norm = { any: 0, types: {} };

  if (rawReq == null){
    return norm; // no explicit requirement
  }

  if (typeof rawReq === 'number'){
    norm.any = rawReq;
    return norm;
  }

  if (typeof rawReq !== 'object'){
    return norm;
  }

  for (const [key, val] of Object.entries(rawReq)){
    const amount = Number(val) || 0;
    if (amount <= 0) continue;

    const k = String(key).trim().toLowerCase();
    if (k === 'any'){
      norm.any += amount;
    } else {
      norm.types[k] = (norm.types[k] || 0) + amount;
    }
  }

  return norm;
}

/**
 * Do the given supply cards satisfy this hunter's requires?
 *
 * Rules:
 *  - Specific type keys (e.g. "kit", "script") are matched case-insensitively
 *  - "any" can be fulfilled by ANY remaining supplies after specific ones
 *  - Extra supply is allowed (overpaying is fine)
 *  - If requires is absent/empty, we just require at least 1 Supply
 */
export function suppliesMeetRequirements(hunter, supplies){
  const rawReq = hunter?.requires;
  const normReq = normaliseRequires(rawReq);

  // If no specific requirement at all, just need at least one Supply
  if (normReq.any === 0 && Object.keys(normReq.types).length === 0){
    return supplies.length > 0;
  }

  // Count supplies by (lowercased) type
  const counts = {};
  for (const card of supplies){
    const t = getSupplyType(card);
    if (!t) continue;
    counts[t] = (counts[t] || 0) + 1;
  }

  // First, meet specific type requirements
  let usedSpecific = 0;
  for (const [typeKey, needed] of Object.entries(normReq.types)){
    const have = counts[typeKey] || 0;
    if (have < needed){
      return false; // not enough of a specific type
    }
    usedSpecific += needed;
  }

  // Then, check "any" requirement against leftover supplies
  if (normReq.any > 0){
    const totalSelected = supplies.length;
    const remaining = totalSelected - usedSpecific;
    if (remaining < normReq.any){
      return false;
    }
  }

  // Passed all checks; also ensure we used at least one Supply
  return supplies.length > 0;
}

// -----------------------------------------------------
// executeTrade()
// Player chooses:
//   - 1 Hunter from roster
//   - 1 or more Supply from hand
//
// Result (V5 rules):
//   - Hunter + Supply → BACKLOG
//   - Roster slot becomes empty
//
// (Optional future enhancement: enforce costs from hunter.requires)
// -----------------------------------------------------
export function executeTrade(){
  if (State.turn !== SIDES.YOU) return;

  // 1) Selected supplies in HAND
  const handSupplyIdx = Array.from(State.sel.hand)
    .filter(i => isSupply(State.you.hand[i]));

  // 2) Selected hunters in ROSTER (top card only)
  const rosterHunters = Array.from(State.sel.roster)
    .map(i => ({ i, card: topOf(State.you.roster[i]) }))
    .filter(x => isHunter(x.card));

  if (!handSupplyIdx.length || rosterHunters.length !== 1) return;

  const { i: hunterSlot, card: hunterCard } = rosterHunters[0];

  // Actual supply card objects for cost check
  const supplyCards = handSupplyIdx.map(i => State.you.hand[i]);

  // 3) Enforce requirements
  if (!suppliesMeetRequirements(hunterCard, supplyCards)){
    log(`<p class="you">Trade failed: selected Supply does not meet <strong>${hunterCard.name}</strong>'s requirements.</p>`);
    return;
  }

  // 4) Move supplies from hand → backlog
  const movedSupply = [];
  handSupplyIdx.sort((a,b)=>b-a).forEach(i => {
    movedSupply.push(State.you.hand.splice(i,1)[0]);
  });

  // 5) Remove hunter from roster slot → backlog
  const stack = State.you.roster[hunterSlot] || [];
  if (stack.length && stack[stack.length - 1] === hunterCard){
    stack.pop();
  } else {
    const pos = stack.indexOf(hunterCard);
    if (pos >= 0) stack.splice(pos, 1);
  }

  State.you.backlog.push(hunterCard, ...movedSupply);

  log(`
    <p class="you">
      💱 Trade: You cycled <strong>${hunterCard.name}</strong> and 
      ${movedSupply.length} Supply to your backlog.
    </p>
  `);

  // 6) Clear selection + refresh UI
  State.sel.hand.clear();
  State.sel.roster.clear();
  window.dispatchEvent(new CustomEvent('selectionChanged'));
  window.dispatchEvent(new CustomEvent('stateChanged'));
}
