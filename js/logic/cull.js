// js/logic/cull.js (V5 clean rewrite)

import { State, SIDES } from '../core/state.js';
import { discardCull } from './discard.js';
import { log } from '../core/log.js';

// -----------------------------------------------------------
// executeCull()
// Player selects EXACTLY 1 card in hand.
// Result: selected card → BURN
// -----------------------------------------------------------
export function executeCull(){
  if (State.turn !== SIDES.YOU) return;
  if (State.cullUsed) return;       // optional V5 rule

  const handSel = Array.from(State.sel.hand);
  if (handSel.length !== 1) return;

  const idx = handSel[0];
  const card = State.you.hand[idx];
  if (!card) return;

  // Remove from hand
  State.you.hand.splice(idx, 1);

  // Apply discard flow: card → burn
  discardCull('you', card);

  // Optional per-turn limiter
  State.cullUsed = true;


  log(`
    <p class="you">
      🔥 Cull: You burned <strong>${card.name}.
    </p>
  `);

  // Cleanup + notify UI
  State.sel.hand.clear();
  window.dispatchEvent(new CustomEvent('stateChanged'));
}
