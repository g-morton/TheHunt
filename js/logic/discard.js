// js/logic/discard.js
//
// Centralised card movement helpers for The Hunt V5.
// Ensures consistent behaviour everywhere.

import { State } from '../core/state.js';

export function sendToBacklog(side, cards){
  if (!cards || cards.length === 0) return;
  State[side].backlog.push(...cards);
}

export function burnCards(side, cards){
  if (!cards || cards.length === 0) return;
  State[side].burn.push(...cards);
}

export function discardHuntersAfterHunt(side, hunters){
  // Hunt success → Hunters go to BACKLOG
  sendToBacklog(side, hunters);
}

export function discardMonsterAfterHunt(side, monster){
  // Monster is always BURNED on success
  burnCards(side, [monster]);
}

export function discardFoiledHunters(side, hunters){
  // Hunt fail → Foiled Hunters are burned
  burnCards(side, hunters);
}

export function discardTrade(side, hunter, supplyCards){
  // Both go to Backlog
  sendToBacklog(side, [hunter, ...supplyCards]);
}

export function discardResupply(side, supplyCards){
  // Supply pulled from roster → Backlog
  sendToBacklog(side, supplyCards);
}

export function discardCull(side, card){
  // Cull always burns
  burnCards(side, [card]);
}

export function endTurnMoveHandToBacklog(side){
  const hand = State[side].hand.splice(0);
  sendToBacklog(side, hand);
}
