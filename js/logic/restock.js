// js/logic/restock.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';

export function isRestockReady(){
  return !!State.sel.restock;
}
export function executeRestock(){
  const sel = State.sel.restock;
  if (!sel) return;
  const stack = State.you.roster[sel.idx];
  const card  = stack && stack[stack.length - 1];
  if (!card){
    State.sel.restock = null;
    return;
  }
  stack.pop();
  State.you.backlog.push(card);

  log(`<p class='you'>Restock: took <strong>${card.name}</strong> from your Roster and sent it to backlog.</p>`);

  State.sel.restock = null;

  // auto-advance to backlog
  window.dispatchEvent(new CustomEvent('advancePhase'));
}
