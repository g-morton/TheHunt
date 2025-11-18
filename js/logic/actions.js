// js/logic/actions.js
import { State, SIDES } from '../core/state.js';
import { topOf, isHunter, isMonster, isSupply } from './utils.js';
import { suppliesMeetRequirements } from './trade.js';

export function computeActionHints(){
  const reasons = {};
  const yourTurn = (State.turn === SIDES.YOU);

  const result = {
    hunt: false,
    trade: false,
    resupply: false,
    cull: false,
    reasons
  };

  // Not your turn? nothing is allowed.
  if (!yourTurn){
    reasons.hunt     = 'Wait for your turn.';
    reasons.trade    = 'Wait for your turn.';
    reasons.resupply = 'Wait for your turn.';
    reasons.cull     = 'Wait for your turn.';
    return result;
  }

  const selHandIdx   = Array.from(State.sel.hand);
  const selRosterIdx = Array.from(State.sel.roster);

  const handCards = selHandIdx.map(i => State.you.hand[i]);
  const rosterTop = selRosterIdx.map(idx => ({
    idx,
    card: topOf(State.you.roster[idx]) || null
  }));

/* -------------------------------------------------------------------------- */
  /* HUNT                                                                        */
  /* -------------------------------------------------------------------------- */

  // 1) Hunters selected? (from hand or your roster)
  const huntersSelected = [
    ...handCards.filter(isHunter),
    ...rosterTop.filter(x => isHunter(x.card)).map(x => x.card)
  ];

  // 2) Monster target: several ways:
  //    - State.sel.monster  => explicit { side, idx }
  //    - State.sel.enemyMonsterIdx => CPU roster slot
  //    - or exactly one monster in your own selected roster slot
  let targetMonster = null;
  let targetSide    = null;

  // Primary: explicit monster selection object { side, idx }
  if (State.sel.monster && typeof State.sel.monster.idx === 'number'){
    const side  = State.sel.monster.side;
    const idx   = State.sel.monster.idx;
    const board = (side === SIDES.CPU) ? State.cpu : State.you;
    const m = topOf(board.roster[idx] || []);
    if (isMonster(m)){
      targetMonster = m;
      targetSide    = side;
    }
  }
  // Secondary: CPU roster index from enemyMonsterIdx
  else if (typeof State.sel.enemyMonsterIdx === 'number'
        && State.sel.enemyMonsterIdx >= 0){
    const idx   = State.sel.enemyMonsterIdx;
    const board = State.cpu;
    const m = topOf(board.roster[idx] || []);
    if (isMonster(m)){
      targetMonster = m;
      targetSide    = SIDES.CPU;
    }
  }
  // Fallback: look at monsters in *your* selected roster slots
  else {
    const monstersSelected = rosterTop.filter(x => isMonster(x.card));
    if (monstersSelected.length === 1){
      targetMonster = monstersSelected[0].card;
      targetSide    = SIDES.YOU;
    } else if (monstersSelected.length > 1){
      // multiple monsters but no explicit target; treat as invalid
      reasons.hunt = 'Select exactly one Monster (your roster or CPU roster).';
    }
  }

  if (!huntersSelected.length){
    reasons.hunt ||= 'Select one or more Hunters (hand or roster).';
  } else if (!targetMonster){
    // only overwrite if we didn’t already set a more specific message
    reasons.hunt ||= 'Select a Monster in your roster or click a Monster in the CPU roster.';
  } else {
    // 3) Power check – only allow Hunt if total Hunter power >= Monster power
    const huntersPower = huntersSelected.reduce(
      (sum, c) => sum + (Number(c.power) || 0),
      0
    );
    const need = Number(targetMonster.power || 0);

    if (huntersPower < need){
      reasons.hunt = `Hunters total P${huntersPower} is less than ${targetMonster.name} (P${need}).`;
    } else {
      result.hunt = true;
    }
  }

  /* -------------------------------------------------------------------------- */
  /* TRADE                                                                       */
  /* -------------------------------------------------------------------------- */

  const rosterHunters   = rosterTop.filter(x => isHunter(x.card));
  const supplyCardsSel  = handCards.filter(isSupply);

  if (!rosterHunters.length){
    reasons.trade = 'Select a Hunter in your roster.';
  } else if (rosterHunters.length > 1){
    reasons.trade = 'Select only one Hunter in your roster to trade.';
  } else if (!supplyCardsSel.length){
    reasons.trade = 'Select one or more Supply cards in your hand.';
  } else {
    const hunterCard = rosterHunters[0].card;
    if (!suppliesMeetRequirements(hunterCard, supplyCardsSel)){
      reasons.trade = 'Selected Supply does not meet this Hunter’s requirements.';
    } else {
      result.trade = true;
    }
  }

  /* -------------------------------------------------------------------------- */
  /* RESUPPLY                                                                    */
  /* -------------------------------------------------------------------------- */

  const rosterSupplies = rosterTop.filter(x => isSupply(x.card));
  if (!rosterSupplies.length){
    reasons.resupply = 'Select Supply cards in your roster to resupply.';
  } else {
    result.resupply = true;
  }

  /* -------------------------------------------------------------------------- */
  /* CULL                                                                        */
  /* -------------------------------------------------------------------------- */

  if (State.cullUsed){
    reasons.cull = 'You can only Cull once per turn.';
  } else if (selHandIdx.length !== 1){
    reasons.cull = 'Select exactly one card in your hand to Cull.';
  } else {
    result.cull = true;
  }

  return result;
}
