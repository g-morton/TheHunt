// js/logic/startturn.js

import { State, SIDES, GAME } from '../core/state.js';
import { ensureStockFromBacklog, draw, autoRosterMonsters } from './utils.js';
import { log } from '../core/log.js';

// Shared start-of-turn refresh for a given board
function sharedStartOfTurn(board /*, side*/) {
  board.hand    = board.hand    || [];
  board.stock   = board.stock   || [];
  board.backlog = board.backlog || [];
  board.roster  = board.roster  || [];
  board.deck    = board.deck    || [];

  const isYou = (board === State.you);
  const loser  = isYou ? 'you' : 'cpu';
  const winner = isYou ? 'cpu' : 'you';

  // --- 0) LOSS CONDITION ---
  // If the player begins their turn with:
  //   • an empty hand
  //   • AND an empty stock
  // …then they cannot draw new cards and the game must end.
  if (board.hand.length === 0 && board.stock.length === 0 && board.backlog.length === 0) {
    log(`
      <p class="${loser}">
        ❌ <strong>${loser.toUpperCase()}</strong> has no cards in hand,
        and no Stock to draw from.<br>
        They cannot continue the Hunt.<br>
        <strong>GAME OVER.</strong>
      </p>
    `);

    window.dispatchEvent(new CustomEvent('gameOver', {
      detail: { winner }
    }));

    return; // Stop turn setup entirely
  }

  // 1) Move current hand to backlog
  if (board.hand.length) {
    board.backlog.push(...board.hand);
    board.hand.length = 0;
  }

  // 2) Ensure stock is loaded from backlog (if needed)
  ensureStockFromBacklog(board, GAME.HAND_SIZE);

  // 3) Draw fresh hand (up to HAND_SIZE)
  let drawn = draw(board.stock, GAME.HAND_SIZE) || [];

  // 4) Auto-roster any monsters out of the drawn cards
  drawn = autoRosterMonsters(drawn, board);

  // 5) Remaining drawn cards become the new hand
  board.hand.push(...drawn);
}


// PLAYER: start of your turn
export function startPlayerTurn(){
  // Turn header so you can clearly see control has passed back to you
  log(`
    <p class="turn-header you">
      TURN ${State.turnCount} — <strong>YOUR TURN</strong>
    </p>
  `);

  sharedStartOfTurn(State.you, SIDES.YOU);

  // Tell the UI to redraw (hand, roster, piles, buttons)
  window.dispatchEvent(new CustomEvent('stateChanged'));
}

// CPU: start of CPU turn (called from runCpuTurn)
export function startCpuTurn(){
  sharedStartOfTurn(State.cpu);
  State.cullUsed = false;

  // 🔔 Make sure the UI re-renders CPU hand/roster right now
  window.dispatchEvent(new CustomEvent('stateChanged'));
}