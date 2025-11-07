// js/core/state.js
export const State = {
  started: false,
  turn: 'you',
  phase: 'hunt',
  readyPhase: null,
  cards: [],
  turnCount: 1,

  you: {
    deck: [],
    archive: [],
    discard: [],
    burn: [],
    hand: [],
    register: [ [], [], [], [], [] ],
    tender: 0
  },

  cpu: {
    deck: [],
    archive: [],
    discard: [],
    burn: [],
    hand: [],
    register: [ [], [], [], [], [] ],
    tender: 0
  },

  sel: {
    // hunt
    monster: null,
    hunters: new Set(),

    // trade
    tradeSupply: new Set(),
    tradeHunters: new Set(),

    // restock
    restock: null
  },

  selectedToDiscard: new Set()
};
