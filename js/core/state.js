// js/core/state.js
export const State = {
  started: false,
  turn: 'you',
  phase: 'hunt',
  readyPhase: null,
  cards: [],
  turnCount: 0,
  beginner: true,

  you: { deck: [], stock: [], backlog: [], burn: [], hand: [], roster: [[],[],[],[],[]], tender: 0 },
  cpu: { deck: [], stock: [], backlog: [], burn: [], hand: [], roster: [[],[],[],[],[]], tender: 0 },

  sel: {
    monster: null,
    hunters: new Set(),
    tradeSupply: new Set(),
    tradeHunters: new Set(),
    restock: null
  },

  selectedTobacklog: new Set()
};