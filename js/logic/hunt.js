// js/logic/hunt.js
import { State, SIDES } from '../core/state.js';
import { topOf, num, isMonster, isHunter, checkWin, isRegimented  } from './utils.js';
import { log } from '../core/log.js';
import { playSfx } from '../core/sound.js';

// Player Hunt: can target either your own roster OR the CPU's roster.
// - Hunters come from your hand and/or your roster.
// - If target is on your roster: you gain Tender equal to monster.tender.
// - If target is on CPU roster: you gain NO Tender (pure disruption).
export function executeHunt(){
  if (State.turn !== SIDES.YOU) return;

  playSfx('huntStart');

  const you = State.you;
  const cpu = State.cpu;

  // ---- 1) Gather selected hunters ----
  const selHandIdx   = Array.from(State.sel.hand || []);
  const selRosterIdx = Array.from(State.sel.roster || []);

  const handHunters = selHandIdx
    .map(i => ({ loc:'hand', idx:i, card: you.hand[i] }))
    .filter(x => isHunter(x.card));

  const rosterSel = selRosterIdx.map(idx => ({
    loc: 'roster',
    idx,
    card: topOf(you.roster[idx] || [])
  }));

  const rosterHunters = rosterSel.filter(x => isHunter(x.card));
  const rosterMonstersOnYou = rosterSel.filter(x => isMonster(x.card));

  const allHunters = [...handHunters, ...rosterHunters];

  if (!allHunters.length){
    log(`<p class="you">You must select at least one Hunter (from hand or roster) to Hunt.</p>`);
    return;
  }

    // Regimented rule: if any Regimented Hunters are present,
  // there must be at least TWO of them in the attacking group.
  const regimentedHunters = allHunters.filter(h => isRegimented(h.card));
  if (regimentedHunters.length === 1){
    const lone = regimentedHunters[0].card;
    playSfx('huntFoiled');
    log(`
      <p class="you">
        ⚠️ <strong>${lone.name}</strong> is <strong>Regimented</strong> and will not
        hunt alone. You must send at least 
        <strong>two Regimented Hunters</strong> on a Hunt.
      </p>
    `);
    return;
  }

  // ---- 2) Resolve target monster: own roster OR CPU roster ----
  let targetBoard = null;  // you or cpu
  let targetSide  = null;  // 'you' or 'cpu'
  let targetIdx   = -1;
  let targetCard  = null;

  const enemyIdx = State.sel.enemyMonsterIdx ?? null;

  // Case A: exactly one monster on YOUR roster, and no enemy target selected
  if (rosterMonstersOnYou.length === 1 && enemyIdx == null){
    const t = rosterMonstersOnYou[0];
    targetBoard = you;
    targetSide  = SIDES.YOU;
    targetIdx   = t.idx;
    targetCard  = t.card;
  }
  // Case B: no monster on your roster, but one CPU roster slot chosen
  else if (rosterMonstersOnYou.length === 0 && enemyIdx != null){
    const stack = cpu.roster[enemyIdx] || [];
    const top   = topOf(stack);
    if (!top || !isMonster(top)){
      log(`<p class="you">Selected CPU slot does not contain a Monster.</p>`);
      return;
    }
    targetBoard = cpu;
    targetSide  = SIDES.CPU;
    targetIdx   = enemyIdx;
    targetCard  = top;
  }
  // Case C: ambiguous selection (both own and enemy, or multiple own monsters)
  else {
    log(`<p class="you">You must choose exactly one Monster to Hunt (either yours or the CPU's).</p>`);
    return;
  }

  // Safety
  if (!targetBoard || !targetCard){
    log(`<p class="you">No valid Monster found to Hunt.</p>`);
    return;
  }

  // ---- 3) Power check BEFORE moving any cards ----
  const totalPower = allHunters.reduce((sum, h) => sum + (num(h.card.power) || 0), 0);
  const monsterPower = num(targetCard.power) || 0;

  if (totalPower < monsterPower){
    // ❌ Hunt fails – no movement, clear selection to avoid weird follow-on
    log(`
      <p class="you">
        ❌ Hunt failed: your Hunters have <strong>${totalPower} power</strong>, 
        but <strong>${targetCard.name}</strong> has 
        <strong>${monsterPower} power</strong>.<br>
        No cards were lost.
      </p>
    `);

    clearSelection();
    return;
  }

  // ---- 4) SUCCESSFUL HUNT ----
  // 4a) Remove monster from its owner's roster and burn it
  const monsterStack = targetBoard.roster[targetIdx] || [];
  const monsterPos   = monsterStack.indexOf(targetCard);
  if (monsterPos >= 0){
    monsterStack.splice(monsterPos, 1);
  }
  targetBoard.burn.push(targetCard);

  // 4b) Move all selected Hunters (hand + roster) into YOUR backlog
  const huntedFromHand = [];
  const handIdxToMove = handHunters.map(h => h.idx).sort((a,b)=>b-a);
  handIdxToMove.forEach(i => {
    const [card] = you.hand.splice(i, 1);
    if (card) huntedFromHand.push(card);
  });

  const huntedFromRoster = [];
  rosterHunters.forEach(h => {
    const stack = you.roster[h.idx] || [];
    const pos   = stack.indexOf(h.card);
    if (pos >= 0){
      const [card] = stack.splice(pos, 1);
      if (card) huntedFromRoster.push(card);
    }
  });

  const allSpentHunters = [...huntedFromHand, ...huntedFromRoster];
  you.backlog.push(...allSpentHunters);

  // 4c) Tender gain ONLY if target is on YOUR roster
  let gain = 0;
  if (targetSide === SIDES.YOU){
    gain = num(targetCard.tender) || 0;
    you.tender = num(you.tender) + gain;
  }

  playSfx('huntWin');

  log(`
    <p class="you">
      ✅ Hunt success! Your Hunters (${totalPower} power) defeated 
      <strong>${targetCard.name}</strong> (${monsterPower}).<br>
      ${
        targetSide === SIDES.YOU
          ? (gain
              ? `You gain <strong>${gain} Tender</strong> 💰. `
              : `This Monster yielded no Tender. `
            )
          : `You gain <strong>no Tender</strong> for disrupting the CPU's ranks. `
      }
      Your Hunters are moved to your backlog, and the Monster is burned.
    </p>
  `);

  // ---- 5) Clear selection & notify ----
  clearSelection();
  window.dispatchEvent(new CustomEvent('stateChanged'));

  // ---- 6) Win check ----
  const winner = checkWin?.();
  if (winner){
    window.dispatchEvent(new CustomEvent('gameOver', { detail: { winner } }));
  }
}

function clearSelection(){
  State.sel.hand?.clear?.();
  State.sel.roster?.clear?.();
  State.sel.monster = null;
  if ('enemyMonsterIdx' in State.sel){
    State.sel.enemyMonsterIdx = null;
  }
  window.dispatchEvent(new CustomEvent('selectionChanged'));
}
