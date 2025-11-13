// js/logic/hunt.js
import { State, SIDES } from '../core/state.js';
import { log } from '../core/log.js';
import { topOf, num, isMonster, isHunter, checkWin } from './utils.js';
import {
  discardHuntersAfterHunt,
  discardMonsterAfterHunt,
  discardFoiledHunters
} from './discard.js';

function normalizeSide(side){
  // We want literal "you" / "cpu" keys for discard.js
  return (side === SIDES.CPU || side === 'cpu') ? 'cpu' : 'you';
}

// ---------------------------------------------------
// executeHunt()
// - Hunters can be from hand and/or roster
// - Target monster can be on your roster or CPU roster
// - On success: monster removed & burned, hunters → backlog
// - On fail: hunters burned
// - IMPORTANT: roster slots are *not* refilled here; that
//   only happens in endturn.js (V5 rule).
// ---------------------------------------------------
export function executeHunt(){
  if (State.turn !== SIDES.YOU) return;

  const you = State.you;

  // Selected cards
  const selHandIdx   = Array.from(State.sel.hand);
  const selRosterIdx = Array.from(State.sel.roster);

  const handHunters = selHandIdx
    .map(i => ({ i, card: you.hand[i] }))
    .filter(x => isHunter(x.card));

  const rosterSel = selRosterIdx.map(idx => ({
    idx,
    card: topOf(you.roster[idx] || [])
  }));

  const rosterHunters = rosterSel.filter(x => isHunter(x.card));
  const rosterMonsters = rosterSel.filter(x => isMonster(x.card));

  // Basic validity checks
  if (!handHunters.length && !rosterHunters.length){
    log(`<p class="you">You must select at least one Hunter (from hand or roster) to Hunt.</p>`);
    return;
  }
  if (rosterMonsters.length !== 1){
    log(`<p class="you">You must select exactly one Monster in your roster to Hunt.</p>`);
    return;
  }

  const targetMonster = rosterMonsters[0];

  // ----- POWER CHECK FIRST -----
  const allHunters = [
    ...handHunters.map(h => h.card),
    ...rosterHunters.map(h => h.card),
  ];
  const totalPower = allHunters.reduce((sum, h) => sum + (num(h.power) || 0), 0);
  const monsterPower = num(targetMonster.card.power) || 0;

  if (totalPower < monsterPower){
    // ❌ Hunt fails – DO NOTHING to the cards
    log(`
      <p class="you">
        ❌ Hunt failed: your Hunters have <strong>${totalPower} power</strong>, 
        but <strong>${targetMonster.card.name}</strong> has 
        <strong>${monsterPower} power</strong>.<br>
        No cards were lost.
      </p>
    `);
    // leave selection as-is, or clear it if you prefer:
    // State.sel.hand.clear();
    // State.sel.roster.clear();
    // window.dispatchEvent(new CustomEvent('selectionChanged'));
    return;
  }

  // ----- SUCCESSFUL HUNT -----
  // 1) Remove monster from its roster slot -> burn
  const monsterStack = you.roster[targetMonster.idx] || [];
  const monsterPos = monsterStack.indexOf(targetMonster.card);
  if (monsterPos >= 0){
    monsterStack.splice(monsterPos, 1);
  }
  you.burn.push(targetMonster.card);

  // 2) Move all selected Hunters (hand + roster) to backlog
  // Hand hunters
  const handIdxToMove = handHunters.map(h => h.i).sort((a,b)=>b-a);
  const huntedFromHand = [];
  handIdxToMove.forEach(i => {
    const [card] = you.hand.splice(i, 1);
    if (card) huntedFromHand.push(card);
  });

  // Roster hunters
  const huntedFromRoster = [];
  rosterHunters.forEach(h => {
    const stack = you.roster[h.idx] || [];
    const pos = stack.indexOf(h.card);
    if (pos >= 0){
      const [card] = stack.splice(pos, 1);
      if (card) huntedFromRoster.push(card);
    }
  });

  const allSpentHunters = [...huntedFromHand, ...huntedFromRoster];
  you.backlog.push(...allSpentHunters);

  // 3) Gain Tender from monster
  const gain = num(targetMonster.card.tender) || 0;
  you.tender = num(you.tender) + gain;

  log(`
    <p class="you">
      ✅ Hunt success! Your Hunters (${totalPower} power) defeated 
      <strong>${targetMonster.card.name}</strong> (${monsterPower}).<br>
      You gain <strong>${gain} Tender</strong> 💰. 
      Hunters are moved to your backlog, and the Monster is burned.
    </p>
  `);

  // 4) Clear selection, update UI, check win
  State.sel.hand.clear();
  State.sel.roster.clear();
  State.sel.monster = null;

  window.dispatchEvent(new CustomEvent('selectionChanged'));
  window.dispatchEvent(new CustomEvent('stateChanged'));

  const winner = checkWin?.();
  if (winner){
    window.dispatchEvent(new CustomEvent('gameOver', { detail:{ winner }}));
  }
}
