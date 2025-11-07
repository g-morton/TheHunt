// js/logic/discard.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';

export function isDiscardReady(){
  return State.selectedToDiscard && State.selectedToDiscard.size > 0;
}

export function executeDiscard(){
  if (!isDiscardReady()) return;
  const toDiscard = Array.from(State.selectedToDiscard);
  toDiscard.forEach(c => {
    const ix = State.you.hand.indexOf(c);
    if (ix > -1){
      State.you.hand.splice(ix,1);
      State.you.discard.push(c);
    }
  });
  const n = toDiscard.length;
  log(`<p class='you'>Discarded ${n} card${n===1?'':'s'} from hand.</p>`);
  State.selectedToDiscard.clear();
}
