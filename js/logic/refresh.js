// js/logic/refresh.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';
import { runCpuTurn } from './cpu.js';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function reshufflebacklogIntostock(side = 'you') {
  const board = side === 'you' ? State.you : State.cpu;
  if (!board.backlog.length) return false;
  board.stock.push(...board.backlog);
  board.backlog.length = 0;
  shuffle(board.stock);
  log("<p class='sys'>stock was empty — backlog was shuffled back into stock.</p>");
  return true;
}

function leastFilledRegisterIndex(board) {
  let idx = 0;
  let min = board.register[0].length;
  for (let i = 1; i < board.register.length; i++) {
    if (board.register[i].length < min) {
      min = board.register[i].length;
      idx = i;
    }
  }
  return idx;
}

function placeIntoRegister(card, side = 'you') {
  const board = side === 'you' ? State.you : State.cpu;
  const idx = leastFilledRegisterIndex(board);
  board.register[idx].push(card);
}

function drawOneFromstockToHand(side = 'you') {
  const board = side === 'you' ? State.you : State.cpu;

  if (!board.stock.length) {
    const ok = reshufflebacklogIntostock(side);
    if (!ok) return false;
  }

  const card = board.stock.pop();
  if (!card) return false;

  if (card.t && card.t.toLowerCase() === 'monster') {
    placeIntoRegister(card, side);
    log(`<p class='sys'>You drew a Monster (${card.name}) during Refresh — placed into your Register.</p>`);
  } else {
    board.hand.push(card);
  }
  return true;
}

function drawFromDeckToRegister(side = 'you', count = 5) {
  const board = side === 'you' ? State.you : State.cpu;
  for (let n = 0; n < count; n++) {
    if (!board.deck.length) break;
    const card = board.deck.pop();
    const idx = n % board.register.length;
    board.register[idx].push(card);
  }
  log(`<p class='sys'>Register refreshed with up to ${count} new cards from your Deck.</p>`);
}

export function executeRefresh() {
  // must be in refresh
  if (State.phase !== 'refresh') {
    log("<p class='sys'>⚠️ You must complete the Refresh phase before ending your turn.</p>");
    return;
  }

  const board = State.you;

  // 1) hand to 5
  while (board.hand.length < 5) {
    const ok = drawOneFromstockToHand('you');
    if (!ok) break;
  }

  // 2) refresh your register
  drawFromDeckToRegister('you', 5);

  // 3) log
  log(`<p class='you'>🔁 Refresh complete — your hand is now ${board.hand.length} card${board.hand.length === 1 ? '' : 's'}.</p>`);

  // 4) end your turn first, let UI update
  State.turn = 'cpu';
  State.phase = 'hunt'; // optional: we can park CPU at hunt
  log("<p class='sys turn-change'>End of your turn — CPU begins its move.</p>");

  // 🔑 force UI to re-render NOW so your Refresh button loses its blue state
  window.dispatchEvent(new CustomEvent('stateChanged'));

  // 5) now run the animated CPU turn (with highlights)
  runCpuTurn();
}
