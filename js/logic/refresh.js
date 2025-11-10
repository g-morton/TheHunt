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

function leastFilledRosterIndex(board) {
  let idx = 0;
  let min = board.roster[0].length;
  for (let i = 1; i < board.roster.length; i++) {
    if (board.roster[i].length < min) {
      min = board.roster[i].length;
      idx = i;
    }
  }
  return idx;
}

function placeIntoRoster(card, side = 'you') {
  const board = side === 'you' ? State.you : State.cpu;
  const idx = leastFilledRosterIndex(board);
  board.roster[idx].push(card);
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
    placeIntoRoster(card, side);
    log(`<p class='sys'>You drew a Monster (${card.name}) during Refresh — placed into your Roster.</p>`);
  } else {
    board.hand.push(card);
  }
  return true;
}

function drawFromDeckToRoster(side = 'you', count = 5) {
  const board = side === 'you' ? State.you : State.cpu;
  for (let n = 0; n < count; n++) {
    if (!board.deck.length) break;
    const card = board.deck.pop();
    const idx = n % board.roster.length;
    board.roster[idx].push(card);
  }
  log(`<p class='sys'>Roster refreshed with up to ${count} new cards from your Deck.</p>`);
}

function fillEmptyRosterSlotsFromDeck(side = 'you') {
  const board = side === 'you' ? State.you : State.cpu;
  const roster = board.roster;
  for (let i = 0; i < roster.length; i++) {
    const stack = roster[i];
    const isEmpty = !stack || stack.length === 0;
    if (isEmpty && board.deck.length > 0) {
      const card = board.deck.pop();
      roster[i] = [card];
    }
  }
  log(`<p class='sys'>Roster refreshed: only empty slots were filled from your Deck.</p>`);
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

  // 2) refresh your roster
  if (State.refreshDrawEmptyOnly) {
    fillEmptyRosterSlotsFromDeck('you');
  } else {
    drawFromDeckToRoster('you', 5);
  }

  // 3) log
  log(`<p class='you'>🔁 Refresh complete — your hand is now ${board.hand.length} card${board.hand.length === 1 ? '' : 's'}.</p>`);

  // 4) end your turn first, let UI update
  State.turn = 'cpu';
  State.phase = 'hunt';
  log("<p class='sys turn-change'>End of your turn — CPU begins its move.</p>");

  window.dispatchEvent(new CustomEvent('stateChanged'));

  // 5) CPU turn
  runCpuTurn();
}
