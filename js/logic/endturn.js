// js/logic/endturn.js — V5.1: player end turn → CPU turn

import { State, SIDES, GAME } from '../core/state.js';
import { checkWin } from './utils.js';
import { runCpuTurn } from './cpu.js';
import { log } from '../core/log.js';

// Clean up any player selections so the CPU starts with a clean board
function cleanupSelections(){
  State.sel.hand.clear();
  State.sel.roster.clear();
  State.sel.monster = null;
  if ('enemyMonsterIdx' in State.sel){
    State.sel.enemyMonsterIdx = null;
  }
  window.dispatchEvent(new CustomEvent('selectionChanged'));
}

// Refill empty roster slots for a board from its DECK
function refillRosterFromDeck(board){
  let added = 0;
  const names = [];

  board.roster = board.roster || [];
  for (let i = 0; i < GAME.ROSTER_SLOTS; i++){
    const stack = board.roster[i] || (board.roster[i] = []);
    if (stack.length === 0 && board.deck.length){
      const card = board.deck.pop();
      stack.push(card);
      added++;
      names.push(card.name || 'Card');
    }
  }

  if (added > 0){
    log(`
      <p class="you">
        🧱 Your roster refills ${added} empty slot${added === 1 ? '' : 's'}
        from your deck: ${names.join(', ')}.
      </p>
    `);
  }
}

// Player clicks "I'm done"
export async function endYourTurn(){
  if (State.turn !== SIDES.YOU) return;

  // Clear your selections
  cleanupSelections();

  // ✅ Refill YOUR roster now, at the END of your turn
  refillRosterFromDeck(State.you);
  window.dispatchEvent(new CustomEvent('stateChanged'));

  // Check if game is over before CPU acts
  const winner = checkWin();
  if (winner){
    window.dispatchEvent(new CustomEvent('gameOver', { detail:{ winner }}));
    return;
  }

  // Hand turn to CPU
  State.turn = SIDES.CPU;
  console.log('[EndTurn] Passing turn to CPU');
  window.dispatchEvent(new CustomEvent('stateChanged'));

  // Run CPU turn (CPU will handle its own start-of-turn hand refresh)
  await runCpuTurn();
}
