// js/logic/supply.js
import { State, SIDES } from '../core/state.js';

function boardFor(side){
  return (side === SIDES.YOU || side === 'you') ? State.you : State.cpu;
}

export function countSupplyInHand(side, tag){
  const b = boardFor(side);
  if (!b || !Array.isArray(b.hand)) return 0;
  const want = tag ? String(tag).toLowerCase() : null;
  let n = 0;
  for (const c of b.hand){
    if (!c || String(c.t).toUpperCase() !== 'SUPPLY') continue;
    if (want && String(c.tag).toLowerCase() !== want) continue;
    n++;
  }
  return n;
}
