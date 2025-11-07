// js/logic/trade.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';

function normalizeReq(req){
  if (!req) return {};
  if (Array.isArray(req)){
    const out = {};
    req.forEach(r => out[r] = (out[r] || 0) + 1);
    return out;
  }
  return { ...req };
}
function combinedRequirements(hunters){
  const total = {};
  hunters.forEach(h => {
    const req = normalizeReq(h.requires);
    for (const [k,v] of Object.entries(req)){
      total[k] = (total[k] || 0) + v;
    }
  });
  return total;
}
function countSupplies(supplies){
  const have = {};
  supplies.forEach(s => {
    const tag = (s.tag || 'any').toLowerCase();
    have[tag] = (have[tag] || 0) + 1;
    have['any'] = (have['any'] || 0) + 1;
  });
  return have;
}
function findSelectedTradeHunters(){
  const regs = State.you.register;
  const out = [];
  (State.sel.tradeHunters || new Set()).forEach(idx => {
    const stack = regs[idx];
    const top = stack && stack[stack.length - 1];
    if (top) out.push({ idx, card: top });
  });
  return out;
}
export function isTradeReady(){
  const selHunters = findSelectedTradeHunters();
  if (!selHunters.length) return false;
  const hunterCards = selHunters.map(h => h.card);
  const reqs = combinedRequirements(hunterCards);
  const supplies = Array.from(State.sel?.tradeSupply || []);
  const have = countSupplies(supplies);

  for (const [type,need] of Object.entries(reqs)){
    if (type === 'any') continue;
    const haveCount = have[type.toLowerCase()] || 0;
    if (haveCount < need) return false;
  }
  if (reqs.any){
    if ((have['any'] || 0) < reqs.any) return false;
  }
  return true;
}
export function executeTrade(){
  const selHunters = findSelectedTradeHunters();
  if (!selHunters.length){
    log("<p class='sys'>Trade failed: no hunters selected.</p>");
    return;
  }
  const hunterCards = selHunters.map(h => h.card);
  const reqs = combinedRequirements(hunterCards);
  const supplies = Array.from(State.sel?.tradeSupply || []);
  const have = countSupplies(supplies);

  // validate again
  let ok = true;
  for (const [type,need] of Object.entries(reqs)){
    if (type === 'any') continue;
    const haveCount = have[type.toLowerCase()] || 0;
    if (haveCount < need) { ok = false; break; }
  }
  if (ok && reqs.any){
    if ((have['any'] || 0) < reqs.any) ok = false;
  }
  if (!ok){
    log("<p class='sys'>Trade failed: selected Supply doesn't meet combined Hunter requirements.</p>");
    return;
  }

  // pay supplies -> discard
  supplies.forEach(s => {
    const ix = State.you.hand.indexOf(s);
    if (ix > -1){
      State.you.hand.splice(ix,1);
      State.you.discard.push(s);
    }
  });

  // move hunters -> discard (per latest rule)
  selHunters.forEach(h => {
    const stack = State.you.register[h.idx];
    stack.pop();
    State.you.discard.push(h.card);
  });

  State.sel.tradeSupply.clear();
  State.sel.tradeHunters.clear();

  log("<p class='you'>Trade successful: Hunters paid for and moved to Discard. Supply discarded.</p>");
}
