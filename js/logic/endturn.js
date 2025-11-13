// js/logic/endturn.js — V5: player end turn → CPU turn

import { State, SIDES, GAME } from '../core/state.js';
import { shuffle, autoRosterMonsters, checkWin } from './utils.js';
import { runCpuTurn } from './cpu.js';
import { log } from '../core/log.js';

// Fill empty roster slots from DECK for a given player (you only here)
function refillRosterFromDeck(player){
  player.roster = player.roster || [];
  for (let i = 0; i < GAME.ROSTER_SLOTS; i++){
    const stack = player.roster[i] || (player.roster[i] = []);
    if (stack.length === 0 && player.deck.length){
      const card = player.deck.pop();
      stack.push(card);
    }
  }
}

function cleanupSelections(){
  State.sel.hand.clear();
  State.sel.roster.clear();
  State.sel.monster = null;
  window.dispatchEvent(new CustomEvent('selectionChanged'));
}

/**
 * Draw up to GAME.HAND_SIZE cards for a board (you),
 * reshuffling backlog into stock if stock runs out mid-draw.
 * Returns the array of cards drawn (before auto-roster).
 */
function drawWithReshuffle(board){
  const target = GAME.HAND_SIZE;
  const drawn = [];

  board.stock   = board.stock   || [];
  board.backlog = board.backlog || [];

  while (drawn.length < target){
    // If stock is empty, try to reshuffle backlog into stock
    if (!board.stock.length){
      if (!board.backlog.length){
        // No cards left anywhere; cannot continue drawing
        break;
      }
      // Shuffle backlog into stock
      board.stock.push(...board.backlog);
      board.backlog.length = 0;
      shuffle(board.stock);
      console.log('[EndTurn] Stock empty, reshuffled backlog into stock for player');
    }

    const card = board.stock.pop();
    if (!card) break;
    drawn.push(card);
  }

  return drawn;
}

// ---------------------------------------------------------------------
// endYourTurn
// ---------------------------------------------------------------------
// 1) Finish YOUR turn (hand → backlog, new hand, roster refill from deck)
// 2) Check if YOU already won
// 3) Pass turn to CPU
// 4) Let CPU run its own turn via runCpuTurn()
// ---------------------------------------------------------------------
export async function endYourTurn(){
  if (State.turn !== SIDES.YOU) return;

  console.log('[EndTurn] Player ending turn, turn =', State.turnCount);

  // ---------- 1) Player cleanup ----------
  // Hand → backlog
  if (State.you.hand.length){
    State.you.backlog.push(...State.you.hand);
    State.you.hand.length = 0;
  }

  // Draw up to a full hand, reshuffling backlog into stock if needed
  let drawn = drawWithReshuffle(State.you);

  // If we still couldn't draw a full hand, let the player know
  if (drawn.length < GAME.HAND_SIZE){
    log(
      `<p class='you'>❗ You could only draw ` +
      `${drawn.length}/${GAME.HAND_SIZE} cards — your stock and backlog are running low.</p>`
    );
  }

  // Any monsters from drawn cards may auto-roster
  drawn = autoRosterMonsters(drawn, State.you);

  // Refill empty roster slots from DECK
  refillRosterFromDeck(State.you);

  // Remaining drawn cards become your new hand
  State.you.hand.push(...drawn);

  // Reset per-turn flags
  State.cullUsed = false;

  // Clear selections (so CPU starts with a clean board)
  cleanupSelections();

  // ---------- 2) Check if player already won ----------
  const winner = checkWin();
  if (winner){
    window.dispatchEvent(new CustomEvent('gameOver', { detail:{ winner }}));
    return;
  }

  // ---------- 3) Hand turn to CPU ----------
  State.turn = SIDES.CPU;
  console.log('[EndTurn] Passing turn to CPU');

  // Let UI update to show CPU turn state
  window.dispatchEvent(new CustomEvent('stateChanged'));

  // ---------- 4) Run CPU turn ----------
  await runCpuTurn();
}
