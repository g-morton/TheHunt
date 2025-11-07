// js/logic/restock.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';

export function isRestockReady(){
  return !!State.sel.restock;
}
export function executeRestock(){
  const sel = State.sel.restock;
  if (!sel) return;
  const stack = State.you.register[sel.idx];
  const card  = stack && stack[stack.length - 1];
  if (!card){
    State.sel.restock = null;
    return;
  }
  stack.pop();
  State.you.discard.push(card);

  log(`<p class='you'>Restock: took <strong>${card.name}</strong> from your Register and moved it to Discard.</p>`);

  State.sel.restock = null;

  // auto-advance to Discard
  window.dispatchEvent(new CustomEvent('advancePhase'));
}
