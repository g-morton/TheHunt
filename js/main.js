// js/main.js
import { State } from './core/state.js';
import { render } from './ui/render.js';
import { setPhaseButtons } from './ui/controls.js';
import { loadCards, TYPES } from './data.js';
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

function leastFilledRegisterIndex(board){
  let idx = 0, min = board.register[0].length;
  for (let i = 1; i < board.register.length; i++){
    if (board.register[i].length < min){
      min = board.register[i].length;
      idx = i;
    }
  }
  return idx;
}
function placeIntoRegister(card, side='you'){
  const board = side === 'you' ? State.you : State.cpu;
  const idx = leastFilledRegisterIndex(board);
  board.register[idx].push(card);
}
function buildRegisterFromDeck(side='you', n=5){
  const board = side === 'you' ? State.you : State.cpu;
  const take = draw(board.deck, n);
  take.forEach(card => placeIntoRegister(card, side));
}
function autoRegisterMonsters(cards, side='you'){
  const rest = [];
  cards.forEach(card => {
    if (card.t === TYPES.MONSTER){
      placeIntoRegister(card, side);
      log(`<p class='sys'>${side.toUpperCase()} drew a monster (${card.name}) — sent to REGISTER.</p>`);
    } else {
      rest.push(card);
    }
  });
  return rest;
}

async function boot(){
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

export function startNewGame(){
  clearStepLog();

  const bar = document.querySelector('.actionbar');
  if (bar) bar.classList.add('show');

  // reset state
  State.started = true;
  State.turn = 'you';
  State.phase = 'hunt';
  State.readyPhase = null;
  State.you = { deck:[], archive:[], discard:[], burn:[], hand:[], register:[[],[],[],[],[]], tender:0 };
  State.cpu = { deck:[], archive:[], discard:[], burn:[], hand:[], register:[[],[],[],[],[]], tender:0 };
  State.sel = {
    monster: null,
    hunters: new Set(),
    tradeSupply: new Set(),
    tradeHunters: new Set(),
    restock: null
  };
  State.selectedToDiscard = new Set();

  const catalog  = State.cards.slice();
  const YOU_COUNTS = { monsters: 20, hunters: 26, supplies: 14 }; // 60
  const CPU_COUNTS = { monsters: 30, hunters: 20, supplies: 10 }; // 60

  State.you.deck = buildDeck(catalog, YOU_COUNTS);
  State.cpu.deck = buildDeck(catalog, CPU_COUNTS);


  log(`
    <p class='log-line rule-bottom'>
      <strong>Welcome to <em>The Hunt</em></strong><br>
      <br>
      With a deck of random 60 cards, you defeat Monsters to earn 🥇, first to 20 wins.<br>
      <br>
      <strong>How to play</strong><br>
      1️⃣ <strong>Hunt</strong> - Select Hunters, then a Monster to hunt, ensuring you have enough⚡to win.<br>
      2️⃣ <strong>Trade</strong> - Use Supply, Kit, Script & Treacle to buy Hunters.<br>
      3️⃣ <strong>Restock</strong> - Choose 1 Supply from Register to keep.<br>
      4️⃣ <strong>Discard</strong> - Drop what you don’t need.<br>
      5️⃣ <strong>Refresh</strong> - Refresh your Hand and Register, then begin again.<br>
      <br>
      <strong>CAREFUL!:</strong> <br>
      Players can burn Hunters with ❌ to Foil an opponent's Hunt.<br>
      <br>
      Good luck — the Hunt begins!
    </p>
  `);


  log("<p class='log-line'><strong>Draw cards...</strong></p>");
  // 1) 5 to register each
  buildRegisterFromDeck('you', 5);
  buildRegisterFromDeck('cpu', 5);
  log("<p class='log-line' 5 cards drawn into each player's Register.</p>");

  // 2) player 10 to archive
  State.you.archive.push(...draw(State.you.deck, 10));
  log("<p class='log-line you'>→ 10 cards drawn into your Archive.</p>");

  // 3) player 5 to hand (monsters auto-register)
  const firstFive = draw(State.you.deck, 5);
  const before = firstFive.length;
  State.you.hand.push(...autoRegisterMonsters(firstFive, 'you'));
  const after = State.you.hand.length;
  const moved = before - after;
  if (moved > 0){
    log(`<p class='log-line you'>→ ${moved} Monster${moved>1?'s':''} auto-moved from Hand into your Register.</p>`);
  } else {
    log("<p class='log-line you'>→ No Monsters were drawn into your Hand.</p>");
  }

  // ✅ CPU: 10 to archive, 5 to hand (monsters jump to its register too)
  State.cpu.archive.push(...draw(State.cpu.deck, 10));
  const cpuFirstFive = draw(State.cpu.deck, 5);
  State.cpu.hand.push(...autoRegisterMonsters(cpuFirstFive, 'cpu'));
  log("<p class='log-line cpu'>→ CPU drew its Archive and starting Hand.</p>");

  log("<p class='sys'><strong>Setup complete.</strong></p>");

  State.turnCount = 1;
  log(`<p class='turn-header you'>TURN 1 — <strong>YOUR TURN</strong></p>`);

  render();
  setPhaseButtons();
}


export function nextPhase(){
  const order = ['hunt','trade','restock','discard','refresh'];
  const i = order.indexOf(State.phase);

  // clear selections when leaving a phase
  State.sel.monster = null;
  State.sel.hunters?.clear?.();
  State.sel.tradeSupply?.clear?.();
  State.sel.tradeHunters?.clear?.();
  State.sel.restock = null;
  State.selectedToDiscard?.clear?.();
  State.readyPhase = null;

  State.phase = order[(i+1) % order.length];

  render();
  setPhaseButtons();
}

document.addEventListener('DOMContentLoaded', boot);
