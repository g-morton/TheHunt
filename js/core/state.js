// js/core/state.js
//
// V5 State: no phases, free-order actions.
// Keep selections generic so UI can light buttons based on what’s selected.
// DO NOT import any UI here; this file should be pure data/state.

export const GAME = {
  HAND_SIZE: 5,
  TENDER_TO_WIN: 20,
  ROSTER_SLOTS: 5
};

export const SIDES = {
  YOU: 'you',
  CPU: 'cpu'
};

// Factory for a player's board/piles
function makeBoard() {
  return {
    deck:    [],   // the deep pile that feeds roster refreshes etc.
    stock:   [],   // draw pile for hand
    backlog: [],   // discard/collect pile; gets shuffled into stock
    burn:    [],   // permanently removed
    hand:    [],   // current hand
    roster:  Array.from({ length: GAME.ROSTER_SLOTS }, () => []), // 5 visible stacks (top card matters)
    tender:  0     // score
  };
}

// The single source of truth
export const State = {
  started: false,
  turn: SIDES.YOU,   // 'you' | 'cpu'
  turnCount: 1,

  you: makeBoard(),
  cpu: makeBoard(),

  // Generic selection model:
  // - hand: indexes of cards in your hand
  // - roster: indexes of roster stacks (the UI acts on the TOP card of each stack)
  // - monster: optional explicit target (useful if your UI lets users mark a specific monster stack)
  sel: {
    hand:   new Set(),            // indices into State.you.hand
    roster: new Set(),            // indices into State.you.roster
    monster: null                 // { side: 'you'|'cpu', idx: number } or null
  },

  // Per-turn flags
  cullUsed: false
};

// --- helpers kept local to state to avoid duplication elsewhere ---

export function resetSelections() {
  State.sel.hand.clear();
  State.sel.roster.clear();
  State.sel.monster = null;
}

export function resetBoards() {
  State.you = makeBoard();
  State.cpu = makeBoard();
}

export function newGameState() {
  State.started   = true;
  State.turn      = SIDES.YOU;
  State.turnCount = 1;
  State.cullUsed  = false;
  resetBoards();
  resetSelections();
}
