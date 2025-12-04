// js/logic/trait-boost-power.js
import { SIDES, State } from '../core/state.js';
import { popArmedTraitsFromHunters } from './trait-arming.js';

function boardFor(side){
  return (side === SIDES.YOU || side === 'you') ? State.you : State.cpu;
}

function isSupplyCard(c){ return c && String(c.t).toUpperCase() === 'SUPPLY'; }

/**
 * Apply armed boostPower traits:
 * - Spend up to X supply (params.x number or "any") of the required tag from HAND -> BACKLOG
 * - Return { spent, tag, boost }
 */
export function applyBoostPower(side, hunters){
  const board = boardFor(side);
  if (!board) return { spent: 0, tag: null, boost: 0 };
  board.hand ||= [];
  board.backlog ||= [];

  // Gather & clear armed traits now (so we don't double-apply)
  const armed = popArmedTraitsFromHunters(hunters, 'boostPower');
  if (!armed.length) return { spent: 0, tag: null, boost: 0 };

  // Aggregate caps per supply tag (usually one trait, but handle many)
  const caps = new Map(); // tag -> allowed count (Infinity if "any")
  for (const { trait } of armed){
    const tag = String(trait?.params?.supply || '').toLowerCase().trim() || null;
    const x   = trait?.params?.x;
    const cap = (x === 'any' || x === 'ALL' || x === '*') ? Infinity
             : (Number.isFinite(x) ? Math.max(0, x) : Infinity);
    const prev = caps.get(tag) ?? 0;
    caps.set(tag, Math.max(prev, cap)); // take the max cap among same-tag traits
  }

  // For each tag, spend up to cap
  let totalSpent = 0;
  let lastTag = null;

  for (const [tag, cap] of caps.entries()){
    const want = tag; // null means "any supply", but here we expect explicit tag
    let spentForTag = 0;

    // count available first (stable order from end -> start to splice safely)
    for (let i = board.hand.length - 1; i >= 0 && spentForTag < cap; i--){
      const c = board.hand[i];
      if (!isSupplyCard(c)) continue;
      if (want && String(c.tag).toLowerCase() !== want) continue;
      const [taken] = board.hand.splice(i, 1);
      board.backlog.push(taken);
      spentForTag++;
    }

    totalSpent += spentForTag;
    if (spentForTag > 0) lastTag = tag || 'supply';
  }

  return { spent: totalSpent, tag: lastTag, boost: totalSpent };
}
