import { State } from './core/state.js';
import { render } from './ui/render.js';
import { setPhaseButtons } from './ui/controls.js';
import { loadCards, TYPES, loadDecks, buildDeckFromDef } from './data.js';   // ✅ include both here once
import { clearStepLog, log } from './core/log.js';
import { executeRefresh } from './logic/refresh.js';

let CARD_SEQ = 1;
function makeCardInstance(proto){
  return { ...proto, _cid: CARD_SEQ++ };
}

function shuffle(a){
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// build deck to exact counts (with replacement)
function buildDeck(catalog, counts){
  const make = (pred, n) => {
    const pool = catalog.filter(pred);
    const out = [];
    for (let i = 0; i < n; i++){
      const proto = pool[Math.floor(Math.random() * pool.length)];
      out.push(makeCardInstance(proto));
    }
    return out;
  };
  const hunters  = make(c => c.t === TYPES.HUNTER,  counts.hunters);
  const monsters = make(c => c.t === TYPES.MONSTER, counts.monsters);
  const supplies = make(c => c.t === TYPES.SUPPLY,  counts.supplies);
  return shuffle([...hunters, ...monsters, ...supplies]);
}

function draw(deck, n){
  const out = [];
  for (let i = 0; i < n && deck.length; i++){
    out.push(deck.pop());
  }
  return out;
}

function leastFilledRosterIndex(board){
  let idx = 0, min = board.roster[0].length;
  for (let i = 1; i < board.roster.length; i++){
    if (board.roster[i].length < min){
      min = board.roster[i].length;
      idx = i;
    }
  }
  return idx;
}
function placeIntoRoster(card, side='you'){
  const board = side === 'you' ? State.you : State.cpu;
  const idx = leastFilledRosterIndex(board);
  board.roster[idx].push(card);
}
function buildRosterFromDeck(side='you', n=5){
  const board = side === 'you' ? State.you : State.cpu;
  const take = draw(board.deck, n);
  take.forEach(card => placeIntoRoster(card, side));
}
function autoRosterMonsters(cards, side='you'){
  const rest = [];
  cards.forEach(card => {
    if (card.t === TYPES.MONSTER){
      placeIntoRoster(card, side);
      log(`<p class='sys'>${side.toUpperCase()} drew a monster (${card.name}) — sent to ROSTER.</p>`);
    } else {
      rest.push(card);
    }
  });
  return rest;
}

async function boot() {
  const cards = await loadCards();
  State.cards = cards;
  bindUI();
  render();
  setPhaseButtons();
}

function bindUI(){
  document.getElementById('btn-newgame')?.addEventListener('click', startNewGame);

  // refresh button
  document.getElementById('btn-refresh')?.addEventListener('click', ()=>{
    if (State.turn === 'you' && State.phase === 'refresh'){
      executeRefresh();
    }
  });
}

// global advance
window.addEventListener('advancePhase', ()=> nextPhase());
window.addEventListener('stateChanged', ()=> { render(); setPhaseButtons(); });



export async function startNewGame(){
  clearStepLog();

  // 1) beginner toggle
  const beginnerCb = document.getElementById('beginner-mode');
  State.beginner = !!(beginnerCb && beginnerCb.checked);

  // 2) show action bar
  const bar = document.querySelector('.actionbar');
  if (bar) bar.classList.add('show');

  // 3) reset core state FIRST
  State.started = true;
  State.turn = 'you';
  State.phase = 'hunt';
  State.readyPhase = null;
  State.turnCount = 1;
  State.refreshDrawEmptyOnly = true;

  State.you = {
    deck: [],
    stock: [],
    backlog: [],
    burn: [],
    hand: [],
    roster: [[],[],[],[],[]],
    tender: 0
  };
  State.cpu = {
    deck: [],
    stock: [],
    backlog: [],
    burn: [],
    hand: [],
    roster: [[],[],[],[],[]],
    tender: 0
  };

  State.sel = {
    monster: null,
    hunters: new Set(),
    tradeSupply: new Set(),
    tradeHunters: new Set(),
    restock: null
  };
  State.selectedTobacklog = new Set();

  // 4) load data
  const cards = await loadCards();
  const decks = await loadDecks();

  // keep cards around if you need them elsewhere
  State.cards = cards;

  //const cardById = Object.fromEntries(cards.map(c => [c.id, c]));
  const cardByKey = Object.fromEntries(cards.map(c => [c.key, c]));
  const deckKeys = Object.keys(decks);

  const playerKey = deckKeys[Math.floor(Math.random() * deckKeys.length)];
  let cpuKey;
  do {
    cpuKey = deckKeys[Math.floor(Math.random() * deckKeys.length)];
  } while (cpuKey === playerKey);

  const playerDeckDef = decks[playerKey];
  const cpuDeckDef    = decks[cpuKey];

  State.you.deck = buildDeckFromDef(playerDeckDef, cardByKey);
  State.cpu.deck = buildDeckFromDef(cpuDeckDef, cardByKey);

  log(`<p class='sys'>🎴 You are playing with the <strong>${playerDeckDef.name}</strong>.</p>`);
  log(`<p class='sys'>🤖 CPU is playing with the <strong>${cpuDeckDef.name}</strong>.</p>`);


  // optional shuffle
  shuffle(State.you.deck);
  shuffle(State.cpu.deck);

  // 6) tutorial / intro log
  log(`
    <p class='log-line rule-bottom'>
      <strong>Welcome to <em>The Hunt</em></strong><br><br>
      🎯 Hunt monsters to gain Tender 💰.<br>
      ⚔️ Add your hunters’ Power (P) — if it meets the monster’s Power, the hunt succeeds.<br>
      🪖 Regimented hunters must hunt with another regimented hunter.<br>
      ${State.beginner ? '❌ Beginner mode: Foil is disabled for both sides.<br>' : ''}
      <br>
      Good luck — the Hunt begins!
    </p>
  `);

  // 7) deal/opening setup (your original steps)

  // 1) 5 to roster each
  buildRosterFromDeck('you', 5);
  buildRosterFromDeck('cpu', 5);
  log("<p class='log-line'>5 cards drawn into each player's Roster.</p>");

  // 2) player 10 to stock
  State.you.stock.push(...draw(State.you.deck, 10));
  log("<p class='log-line you'>→ 10 cards drawn into your stock.</p>");

  // 3) player 5 to hand (monsters auto-roster)
  const firstFive = draw(State.you.deck, 5);
  State.you.hand.push(...autoRosterMonsters(firstFive, 'you'));

  // CPU: 10 to stock, 5 to hand (monsters auto-roster)
  State.cpu.stock.push(...draw(State.cpu.deck, 10));
  const cpuFirstFive = draw(State.cpu.deck, 5);
  State.cpu.hand.push(...autoRosterMonsters(cpuFirstFive, 'cpu'));
  log("<p class='log-line cpu'>→ CPU drew its Stock and starting Hand.</p>");

  // 8) turn header
  log(`<p class='turn-header you'>TURN 1 — <strong>YOUR TURN</strong></p>`);

  // 9) render UI
  render();
  setPhaseButtons();
}


export function nextPhase(){
  const order = ['hunt','trade','restock','backlog','refresh'];
  const i = order.indexOf(State.phase);

  // clear selections when leaving a phase
  State.sel.monster = null;
  State.sel.hunters?.clear?.();
  State.sel.tradeSupply?.clear?.();
  State.sel.tradeHunters?.clear?.();
  State.sel.restock = null;
  State.selectedTobacklog?.clear?.();
  State.readyPhase = null;

  State.phase = order[(i+1) % order.length];

  render();
  setPhaseButtons();
}

document.addEventListener('DOMContentLoaded', boot);
