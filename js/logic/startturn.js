// js/logic/startturn.js

import { State, SIDES, GAME } from '../core/state.js';
import { ensureStockFromBacklog, draw, autoRosterMonsters } from './utils.js';
import { log } from '../core/log.js';

// Shared start-of-turn refresh for a given board
function sharedStartOfTurn(board /*, side*/){
  board.hand    = board.hand    || [];
  board.stock   = board.stock   || [];
  board.backlog = board.backlog || [];
  board.roster  = board.roster  || [];
  board.deck    = board.deck    || [];

  // 1) Move current hand to backlog
  if (board.hand.length){
    board.backlog.push(...board.hand);
    board.hand.length = 0;
  }

  // 2) Ensure stock is loaded from backlog if needed
  //    (extra arguments are ignored if ensureStockFromBacklog only expects 1)
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