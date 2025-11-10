// js/ui/controls.js
import { State } from '../core/state.js';
import { updateHuntReadiness, executeHunt, isHuntReady } from '../logic/hunt.js';
import { isTradeReady, executeTrade } from '../logic/trade.js';
import { isRestockReady, executeRestock } from '../logic/restock.js';
import { isbacklogReady, executebacklog } from '../logic/backlog.js';
import { resumeCpuHuntFromInterrupt } from '../logic/cpu.js'; // ← this was missing
import { log } from '../core/log.js';

const PHASE_HINTS = {
  hunt:    'Select one or more hunters, then pick a monster in the roster to hunt.',
  trade:   'Select hunters in your roster and supply in your hand to complete a trade.',
  restock: 'Select a supply card from your roster to restock your hand.',
  backlog: 'You may choose cards in your hand to send to your backlog.',
  refresh: 'Refresh your hand and roster or advance the turn.',
  end:     'Refresh or end your turn when you have completed your actions.',
  default: 'Choose an action to continue.'
};

function byId(id){ return document.getElementById(id); }

// your HTML uses id="btn-end", not btn-refresh
const phaseButtons = {
  hunt:    document.getElementById('btn-hunt'),
  trade:   document.getElementById('btn-trade'),
  restock: document.getElementById('btn-restock'),
  backlog: document.getElementById('btn-backlog'),
  refresh: document.getElementById('btn-end'),
};

// arrows advance phase, BUT NOT from refresh
const arrows = document.querySelectorAll('.arrow');
arrows.forEach(a=>{
  a.addEventListener('click', ()=>{
    if (State.turn === 'you' && State.phase === 'refresh') {
      log("<p class='sys'>🔁 You must complete Refresh to end your turn.</p>");
      return;
    }
    window.dispatchEvent(new CustomEvent('advancePhase'));
  });
});

// HUNT
if (phaseButtons.hunt){
  phaseButtons.hunt.addEventListener('click', ()=>{
    if (State.turn === 'you' && State.phase === 'hunt' && isHuntReady()){
      executeHunt();
      updateHuntReadiness();
      window.dispatchEvent(new CustomEvent('stateChanged'));
    }
  });
}

// TRADE
if (phaseButtons.trade){
  phaseButtons.trade.addEventListener('click', ()=>{
    if (State.turn === 'you' && State.phase === 'trade'){
      if (isTradeReady()){
        executeTrade();
        window.dispatchEvent(new CustomEvent('stateChanged'));
      }
    }
  });
}

// RESTOCK
if (phaseButtons.restock){
  phaseButtons.restock.addEventListener('click', ()=>{
    if (State.turn === 'you' && State.phase === 'restock'){
      if (isRestockReady()){
        executeRestock();
      }
    }
  });
}

// backlog
if (phaseButtons.backlog){
  phaseButtons.backlog.addEventListener('click', ()=>{
    if (State.turn === 'you' && State.phase === 'backlog'){
      if (isbacklogReady()){
        executebacklog();
        window.dispatchEvent(new CustomEvent('stateChanged'));
      }
    }
  });
}

// -----------------------------------------------------
// PHASE UI STATE
// -----------------------------------------------------
export function setPhaseButtons() {
  const phase    = State.phase;
  const yourTurn = State.turn === 'you';

  const readyMap = {
    hunt:    isHuntReady(),
    trade:   isTradeReady(),
    restock: isRestockReady(),
    backlog: isbacklogReady(),
  };

  // if CPU is waiting for player to foil, show the prompt
  showFoilPromptIfNeeded();

  document.querySelectorAll('.phase').forEach(btn => {
    const name = btn.dataset.phase;
    const isActive = (phase === name);
    const isReady  = !!readyMap[name];

    btn.classList.toggle('active', isActive);
    btn.classList.toggle('ready',  isReady);

    btn.disabled = !yourTurn;
  });

  setPhaseHint(phase);
}

export function setPhaseHint(phase) {
  const hintEl = byId('phase-hint');
  if (!hintEl) return;
  const text = PHASE_HINTS[phase] || PHASE_HINTS.default;
  hintEl.textContent = '❛ ' + text + ' ❜';
}

// --- FOIL UI for when CPU is hunting ---------------------------------
const foilPassBtn = (() => {
  let btn = document.getElementById('btn-foil-pass');
  if (!btn) {
    const hint = document.getElementById('phase-hint');
    btn = document.createElement('button');
    btn.id = 'btn-foil-pass';
    btn.textContent = 'PASS?';
    btn.style.display = 'none';
    btn.className = 'phase-foil-pass';
    if (hint && hint.parentNode) {
      hint.parentNode.appendChild(btn);
    } else {
      document.body.appendChild(btn);
    }
  }
  return btn;
})();

// PASS click: resolve CPU hunt and continue CPU turn
foilPassBtn.addEventListener('click', async () => {
  if (!State.interrupt || State.interrupt.type !== 'cpu-hunt-foil') return;
  foilPassBtn.style.display = 'none';
  await resumeCpuHuntFromInterrupt(null);
  window.dispatchEvent(new CustomEvent('stateChanged'));
});

// player-hand click → try foil
// (render.js keeps #player-hand, just clears children, so this listener survives) :contentReference[oaicite:2]{index=2}
const playerHandEl = document.getElementById('player-hand');
if (playerHandEl) {
  playerHandEl.addEventListener('click', async (ev) => {
    if (!State.interrupt || State.interrupt.type !== 'cpu-hunt-foil') return;

    const cardEl = ev.target.closest('.card');
    if (!cardEl) return;

    const idx = Number(cardEl.dataset.handIndex);
    if (Number.isNaN(idx)) return;

    const playerCard = State.you.hand[idx];
    if (!playerCard) return;

    foilPassBtn.style.display = 'none';
    await resumeCpuHuntFromInterrupt(playerCard);
    window.dispatchEvent(new CustomEvent('stateChanged'));
  });
}

export function showFoilPromptIfNeeded() {
  if (State.interrupt && State.interrupt.type === 'cpu-hunt-foil') {
    console.debug('[FOIL] CPU is waiting for player response.');
    foilPassBtn.style.display = 'inline-block';
    const hintEl = document.getElementById('phase-hint');
    if (hintEl) {
      hintEl.textContent = '❛ FOIL or PASS? Choose a hunter in your hand, or click PASS. ❜';
    }
  } else {
    foilPassBtn.style.display = 'none';
  }
}
