// js/logic/resupply.js (V5 clean version)

import { State, SIDES } from '../core/state.js';
import { topOf, isSupply } from './utils.js';
import { log } from '../core/log.js';

import {
  discardResupply
} from './discard.js';

// -----------------------------------------------------------
// executeResupply()
// Player chooses 1 or more roster slots containing supply.
//
// Result (V5 rules):
//   - Each selected top Supply card → BACKLOG
//   - Roster slot remains but becomes empty (if only 1 card stack)
//
// -----------------------------------------------------------
export function executeResupply(){
  if (State.turn !== SIDES.YOU) return;

  const picks = Array.from(State.sel.roster);
  if (!picks.length) return;

  const supplyCards = [];

  for (const idx of picks){
    const stack = State.you.roster[idx];
    const top = topOf(stack);

    if (top && isSupply(top)){
      stack.pop();          // remove from roster
      supplyCards.push(top);
    }
  }

  if (!supplyCards.length){
    // nothing actually moved
    return;
  }

  // Apply discard flow: supply → backlog
  discardResupply('you', supplyCards);

    log(`
      <p class="you">
        ➕ Resupply: You sent <em>${supplyCards.length} Supply</em> to your backlog.
      </p>
    `);

  // Cleanup + notify
  State.sel.roster.clear();
  window.dispatchEvent(new CustomEvent('stateChanged'));
}
