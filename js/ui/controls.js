// js/ui/controls.js

import { State, SIDES } from '../core/state.js';
import { computeActionHints } from '../logic/actions.js';
import { executeHunt } from '../logic/hunt.js';
import { executeTrade } from '../logic/trade.js';
import { executeResupply } from '../logic/resupply.js';
import { executeCull } from '../logic/cull.js';
import { endYourTurn } from '../logic/endturn.js';

// ---------- DOM helpers ----------
function $(id){ return document.getElementById(id); }

const BTN = {
  hunt:     () => $('btn-hunt'),
  trade:    () => $('btn-trade'),
  resupply: () => $('btn-resupply'),
  cull:     () => $('btn-cull'),
  endturn:  () => $('btn-endturn')
};

function setBtn(el, { enabled, highlighted, title }){
  if (!el) return;
  el.disabled = !enabled;
  el.classList.toggle('highlight', !!highlighted);
  if (typeof title === 'string') el.title = title;
}


// ---------- Hint helpers ----------
const PHASE_HINTS = {
  hunt: 'Hunt: Select 1+ Hunters and 1 Monster in your roster to try to defeat it and gain Tender.',
  trade: 'Trade: Select 1 Hunter in your roster and Supply in your hand to trade for a new opportunity.',
  resupply: 'Resupply: Select Supply in your roster to send it to your backlog for future use.',
  cull: 'Cull: Select 1 card in your hand to burn it permanently from your deck.',
  endturn: "End turn: Move your hand to backlog, refill empty roster slots, and draw a new hand."
};

function isBeginnerMode(){
  const cb = document.getElementById('beginner-mode');
  return !cb || cb.checked;
}

function setPhaseHint(key){
  const el = document.getElementById('phase-hint');
  if (!el){
    return;
  }

  // No hint if nothing hovered or beginner mode is off
  if (!key || !isBeginnerMode()){
    el.textContent = '';
    return;
  }

  el.textContent = PHASE_HINTS[key] || '';
}




// ---------- Public: refresh highlights ----------
export function refreshActionHighlights(){
  const h = computeActionHints();
  const yourTurn = (State.turn === SIDES.YOU);

  setBtn(BTN.hunt(),     { enabled: h.hunt,     highlighted: h.hunt,     title: h.hunt ? '' : (h.reasons?.hunt     || '') });
  setBtn(BTN.trade(),    { enabled: h.trade,    highlighted: h.trade,    title: h.trade ? '' : (h.reasons?.trade    || '') });
  setBtn(BTN.resupply(), { enabled: h.resupply, highlighted: h.resupply, title: h.resupply ? '' : (h.reasons?.resupply || '') });
  setBtn(BTN.cull(),     { enabled: h.cull,     highlighted: h.cull,     title: h.cull ? '' : (h.reasons?.cull     || '') });

  // End Turn: enabled whenever it's your turn; keep highlighted for UX clarity
  setBtn(BTN.endturn(),  { enabled: yourTurn,   highlighted: yourTurn,   title: h.endturn ? '' : (h.reasons?.endturn || '') });
}

// ---------- Optional: idempotent wiring ----------
function safeBind(el, type, handler){
  if (!el) return;
  const key = `__bound_${type}`;
  if (el[key]) return;     // already bound
  el.addEventListener(type, handler);
  el[key] = true;
}

export function wireControls(){
  const btnHunt     = BTN.hunt();
  const btnTrade    = BTN.trade();
  const btnResupply = BTN.resupply();
  const btnCull     = BTN.cull();
  const btnEndturn  = BTN.endturn();

  // Primary actions (click)
  safeBind(btnHunt,     'click', executeHunt);
  safeBind(btnTrade,    'click', executeTrade);
  safeBind(btnResupply, 'click', executeResupply);
  safeBind(btnCull,     'click', executeCull);
  safeBind(btnEndturn,  'click', endYourTurn);

  // Hover / focus hints
  const bindHint = (btn, key) => {
    if (!btn) return;
    safeBind(btn, 'mouseenter', () => setPhaseHint(key));
    safeBind(btn, 'mouseleave', () => setPhaseHint(null));
    // keyboard-friendly too
    safeBind(btn, 'focus',      () => setPhaseHint(key));
    safeBind(btn, 'blur',       () => setPhaseHint(null));
  };

  bindHint(btnHunt,     'hunt');
  bindHint(btnTrade,    'trade');
  bindHint(btnResupply, 'resupply');
  bindHint(btnCull,     'cull');
  bindHint(btnEndturn,  'endturn');

  // Global refresh triggers (as you already had)
  window.addEventListener('stateChanged',      refreshActionHighlights);
  window.addEventListener('selectionChanged',  refreshActionHighlights);

  // Initial paint for buttons
  refreshActionHighlights();
}
