// js/logic/backlog.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';

export function isbacklogReady(){
  return State.selectedTobacklog && State.selectedTobacklog.size > 0;
}

export function executebacklog(){
  if (!isbacklogReady()) return;
  const tobacklog = Array.from(State.selectedTobacklog);
  tobacklog.forEach(c => {
    const ix = State.you.hand.indexOf(c);
    if (ix > -1){
      State.you.hand.splice(ix,1);
      State.you.backlog.push(c);
    }
  });
  const n = tobacklog.length;
  log(`<p class='you'>backloged ${n} card${n===1?'':'s'} from hand.</p>`);
  State.selectedTobacklog.clear();
}
