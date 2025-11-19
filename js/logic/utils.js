// js/logic/utils.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';
import { playSfx } from '../core/sound.js';

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


export function ensureStockFromBacklog(board, min = 1){
  // If we already have at least `min` cards in stock, do nothing
  if (board.stock.length >= min) return;
  if (!board.backlog.length) return;

  // Shuffle backlog into stock
  shuffle(board.backlog);
  board.stock.push(...board.backlog);
  board.backlog.length = 0;

    playSfx('cardShuffle');
}

export function autoRosterMonsters(cards, board){
  const keep = [];
  let placedCount = 0;

  for (const c of cards){
    if (isMonster(c)){

      // --- Your existing distribution logic (unchanged) ---
      let target = 0, best = board.roster[0].length;
      for (let i = 1; i < board.roster.length; i++){
        if (board.roster[i].length < best){
          best = board.roster[i].length;
          target = i;
        }
      }

      board.roster[target].push(c);
      placedCount++;

      // --- NEW: Logging for transparency ---
      const sideLabel = (board === State.you) ? 'you' : 'cpu';
      const colorDot  = (board === State.you) ? '🟩' : '🟥';

      log(`
        <p class="${sideLabel}">
          ${colorDot}
          <strong>${c.name}</strong>
          moves to ${sideLabel === 'you' ? 'your' : 'CPU’s'}
          <strong>Roster Slot ${target + 1}</strong>.
        </p>
      `);

    } else {
      keep.push(c);
    }
  }

  // 🔊 NEW: Play placement sound *once* after all monsters placed
  if (placedCount > 0){
    playSfx('cardPlaced');
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


export function isRegimented(card){
  if (!card) return false;

  // Support a few possible shapes: trait, traits[], tags, tags[]
  if (Array.isArray(card.traits) &&
      card.traits.some(t => String(t).toLowerCase() === 'regimented')){
    return true;
  }

  if (typeof card.trait === 'string' &&
      card.trait.toLowerCase() === 'regimented'){
    return true;
  }

  if (Array.isArray(card.tags) &&
      card.tags.some(t => String(t).toLowerCase() === 'regimented')){
    return true;
  }

  if (typeof card.tags === 'string' &&
      card.tags.toLowerCase().includes('regimented')){
    return true;
  }

  return false;
}

