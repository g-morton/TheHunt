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

  // ---------- HUNT ----------
  const huntersSelected = [
    ...handCards.filter(isHunter),
    ...rosterTop.filter(x => isHunter(x.card)).map(x => x.card)
  ];
  const monstersSelected = rosterTop.filter(x => isMonster(x.card));

  if (!huntersSelected.length){
    reasons.hunt = 'Select one or more Hunters (hand or roster).';
  } else if (!monstersSelected.length){
    reasons.hunt = 'Also select a Monster in your roster.';
  } else {
    result.hunt = true;
  }

  // ---------- TRADE ----------
  const rosterHunters = rosterTop.filter(x => isHunter(x.card));
  const supplyCardsSel = handCards.filter(isSupply);

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

  // ---------- RESUPPLY ----------
  const rosterSupplies = rosterTop.filter(x => isSupply(x.card));
  if (!rosterSupplies.length){
    reasons.resupply = 'Select Supply cards in your roster to resupply.';
  } else {
    result.resupply = true;
  }

  // ---------- CULL ----------
  if (State.cullUsed){
    reasons.cull = 'You can only Cull once per turn.';
  } else if (selHandIdx.length !== 1){
    reasons.cull = 'Select exactly one card in your hand to Cull.';
  } else {
    result.cull = true;
  }

  return result;
}
