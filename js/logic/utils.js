// js/logic/utils.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';

export function topOf(stack){ return stack?.[stack.length - 1] || null; }
export function num(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }

export function isType(card, t){ return !!card && String(card.t || '').toLowerCase() === t; }
export function isHunter(c){ return !!c && (isType(c,'hunter') || c?.kind === 'hunter'); }
export function isSupply(c){
  const t = String(c?.t || '').toLowerCase();
  return !!c && (t === 'supply' || t === 'kit' || t === 'script' || t === 'treacle');
}
export function isMonster(c){
  if (!c) return false;
  if (isType(c,'monster')) return true;
  if (isHunter(c) || isSupply(c)) return false;
  return (c.power != null && c.tender != null);
}

export function shuffle(a){ for (let i=a.length-1;i>0;i--){const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
export function draw(pile, n){ const out = []; while(n-- > 0 && pile.length) out.push(pile.pop()); return out; }

export function ensureStockFromBacklog(board){
  if (board.stock.length) return;
  if (!board.backlog.length) return;
  shuffle(board.backlog);
  board.stock.push(...board.backlog);
  board.backlog.length = 0;
}

export function autoRosterMonsters(cards, board){
  const keep = [];
  for (const c of cards){
    if (isMonster(c)){
      let target = 0, best = board.roster[0].length;
      for (let i=1;i<board.roster.length;i++){
        if (board.roster[i].length < best){ best = board.roster[i].length; target = i; }
      }
      board.roster[target].push(c);
    } else keep.push(c);
  }
  return keep;
}

export function checkWin(){
  // 1) Tender win: first to 20+ Tender
  if (State.you.tender >= 20) return 'you';
  if (State.cpu.tender >= 20) return 'cpu';

  // 2) Deck/pile exhaustion:
  //    if one side has *no way* to keep playing (no deck, stock, backlog or hand),
  //    the other side wins by endurance.
  const youOut =
    !State.you.deck.length &&
    !State.you.stock.length &&
    !State.you.backlog.length &&
    !State.you.hand.length;

  const cpuOut =
    !State.cpu.deck.length &&
    !State.cpu.stock.length &&
    !State.cpu.backlog.length &&
    !State.cpu.hand.length;

  if (youOut && !cpuOut) return 'cpu';
  if (cpuOut && !youOut) return 'you';

  return null;
}
