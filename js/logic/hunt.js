// js/logic/hunt.js
import { State } from '../core/state.js';
import { TYPES } from '../data.js';
import { log } from '../core/log.js';


function hasTrait(card, name) {
  if (!card || !Array.isArray(card.traits)) return false;
  return card.traits.map(t => t.toLowerCase()).includes(name.toLowerCase());
}

export function isHuntReady() {
  const sel = State.sel || {};
  const monster = sel.monster;

  const hunters = Array.isArray(sel.hunters)
    ? sel.hunters
    : Array.from(sel.hunters || []);

  if (!monster) return false;
  if (hunters.length === 0) return false;

  // ✅ Regimented rule: must be 2+ regimented hunters
  const regimentedCount = hunters.filter(h => hasTrait(h, 'regimented')).length;
  if (regimentedCount > 0 && regimentedCount < 2) {
    // optional message:
    log("<p class='sys'>🚫 Regimented hunters will only hunt with another regimented ally.</p>");
    return false;
  }

  return true;
}

export function updateHuntReadiness() {
  if (!State.ready) State.ready = {};
  State.ready.hunt = isHuntReady();
}

export function executeHunt() {
  if (State.turn !== 'you') return;
  if (!isHuntReady()) return;

  const hunterSet  = State.sel.hunters;
  const hunters    = Array.from(hunterSet);
  const monsterSel = State.sel.monster;

  // 1) CPU FOIL CHECK stays the same...
  const foilResult = tryCpuFoil(hunters);
  if (foilResult) {
    const { chosen: cpuHunter, targetFoil } = foilResult;
    const playerFoiled = findPlayerFoiledHunter(hunters, targetFoil);

    if (playerFoiled) {
      const idx = State.you.hand.indexOf(playerFoiled);
      if (idx >= 0) State.you.hand.splice(idx, 1);
      State.you.burn.push(playerFoiled);
      State.sel.hunters.delete(playerFoiled);
    }

    log(`
      <p class='sys'>
        ❌ <strong>FOIL!</strong><br>
        CPU burned <strong>${cpuHunter.name}</strong> (Foil ${cpuHunter.foil || 0})<br>
        to block your <strong>${playerFoiled ? playerFoiled.name : 'hunter'}</strong> (Foil ${targetFoil}).<br>
        Your foiled hunter was also burned.<br>
        You may try again with your remaining hunters.
      </p>
    `);
    updateHuntReadiness();
    return;
  }

  // 2) Normal hunt resolution
  const monsterStack =
    monsterSel.side === 'you'
      ? State.you.register[monsterSel.idx]
      : State.cpu.register[monsterSel.idx];

  const monsterCard = monsterStack[monsterStack.length - 1];

  // move your hunters out of hand
  hunters.forEach(h => {
    const idx = State.you.hand.indexOf(h);
    if (idx >= 0) State.you.hand.splice(idx, 1);
    State.you.discard.push(h);
  });

  // remove monster from board
  monsterStack.pop();
  State.you.burn.push(monsterCard);

  // ⭐ ADD TENDER HERE
const gain = Number(monsterCard.tender || 0);
if (gain > 0) {
  State.you.tender = Number(State.you.tender || 0) + gain;
}

  log(`<p class='sys'>🎯 You successfully hunted ${monsterCard.name}.</p>`);

  // clear selection
  State.sel.hunters.clear();
  State.sel.monster = null;

  updateHuntReadiness();

  // let UI re-render tender
  window.dispatchEvent(new CustomEvent('stateChanged'));
}

/* ---------------------- helpers ---------------------- */

function tryCpuFoil(playerHunters) {
  if (!playerHunters || playerHunters.length === 0) return false;

  let targetFoil = Infinity;
  for (const h of playerHunters) {
    const f = Number(h.foil || 0);
    if (f < targetFoil) targetFoil = f;
  }
  if (targetFoil === Infinity) targetFoil = 0;

  const cpuHandHunters = (State.cpu.hand || []).filter(c => c.t === TYPES.HUNTER);
  if (cpuHandHunters.length < 2) return false;

  const candidates = cpuHandHunters.filter(c => Number(c.foil || 0) >= targetFoil);
  if (candidates.length === 0) return false;

  candidates.sort((a, b) => (a.foil || 0) - (b.foil || 0));
  const chosen = candidates[0];

  const idx = State.cpu.hand.indexOf(chosen);
  if (idx >= 0) {
    State.cpu.hand.splice(idx, 1);
    State.cpu.burn.push(chosen);
  }

  return { chosen, targetFoil };
}

function findPlayerFoiledHunter(playerHunters, targetFoil) {
  if (!playerHunters || !playerHunters.length) return null;
  const exact = playerHunters.find(h => Number(h.foil || 0) === targetFoil);
  if (exact) return exact;
  let lowest = playerHunters[0];
  let lowestVal = Number(lowest.foil || 0);
  for (const h of playerHunters) {
    const f = Number(h.foil || 0);
    if (f < lowestVal) {
      lowest = h;
      lowestVal = f;
    }
  }
  return lowest;
}
