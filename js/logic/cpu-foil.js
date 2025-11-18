// js/logic/cpu-foil.js
// FOIL helpers used by CPU hunts (and later CPU foiling player hunts).

import { State, SIDES } from '../core/state.js';
import { log } from '../core/log.js';
import { isHunter, num } from './utils.js';
import { showFoilPrompt } from '../ui/foil.js';

// Does the player have any Hunters available to Foil with?
export function playerHasFoilHunters(){
  const you = State.you;
  if (!you) return false;

  // Hunters in hand
  const handHasHunters = (you.hand || []).some(c => isHunter(c));

  // Hunters on top of roster stacks
  const rosterHasHunters = (you.roster || []).some(stack => {
    const top = stack && stack[stack.length - 1];
    return isHunter(top);
  });

  return handHasHunters || rosterHasHunters;
}

// Read the player's current selection (hand + roster) as Foil Hunters
export function collectPlayerFoilSelection(){
  const you = State.you;
  const selHandIdx   = Array.from(State.sel.hand || []);
  const selRosterIdx = Array.from(State.sel.roster || []);
  const result = [];

  selHandIdx.forEach(i => {
    const card = you.hand[i];
    if (card && isHunter(card)){
      result.push({ loc:'hand', idx:i, card });
    }
  });

  selRosterIdx.forEach(i => {
    const stack = you.roster[i] || [];
    const card  = stack[stack.length - 1];
    if (card && isHunter(card)){
      result.push({ loc:'roster', idx:i, card });
    }
  });

  return result;
}

// Given CPU hunters and a "Foil budget" (sum of your Hunters' power),
// decide which CPU hunters are neutralised (partial FOIL allowed).
export function computeFoilAgainstHunters(hunters, foilBudget){
  let remaining = foilBudget;

  // Sort by descending power so we foil the biggest threats first
  const sorted = hunters.slice().sort((a, b) => num(b.power) - num(a.power));
  const foiled = [];

  for (const h of sorted){
    const p = num(h.power);
    if (p <= 0) continue;
    if (remaining <= 0) break;

    if (p <= remaining){
      foiled.push(h);
      remaining -= p;
    }
  }

  const survivors    = hunters.filter(h => !foiled.includes(h));
  const removedPower = foiled.reduce((sum, h) => sum + num(h.power), 0);

  return { foiled, survivors, removedPower };
}

// Move the player's chosen Foil Hunters from hand/roster → burn
export function applyPlayerFoilCardMovement(selection){
  const you = State.you;
  if (!you) return;

  selection.forEach(sel => {
    if (sel.loc === 'hand'){
      const ix = you.hand.indexOf(sel.card);
      if (ix >= 0) you.hand.splice(ix, 1);
    } else if (sel.loc === 'roster'){
      const stack = you.roster[sel.idx] || [];
      const pos   = stack.indexOf(sel.card);
      if (pos >= 0) stack.splice(pos, 1);
    }
    you.burn.push(sel.card);
  });
}

// Burn foiled CPU hunters (they never go to backlog)
export function discardFoiledHunters(side, foiled){
  const isCpu = (side === 'cpu' || side === SIDES.CPU);
  const board = isCpu ? State.cpu : State.you;
  if (!board) return;

  foiled.forEach(card => {
    const ix = board.hand.indexOf(card);
    if (ix >= 0){
      board.hand.splice(ix, 1);
    }
    board.burn.push(card);
  });
}

// Show the FOIL overlay and resolve to 'foil' or 'pass'
export function promptPlayerFoil(monster, attackHunters){
  return new Promise(resolve => {
    showFoilPrompt(
      {
        monsterName:  monster.name,
        monsterPower: num(monster.power),
        attackHunters: attackHunters || []
      },
      ({ decision }) => {
        resolve(decision); // 'foil' | 'pass'
      }
    );
  });
}
