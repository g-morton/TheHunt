// js/logic/cpu.js — V5 CPU turn logic (no phases, no FOIL)

import { State, SIDES, GAME } from '../core/state.js';
import { log } from '../core/log.js';
import {
  isMonster,
  isHunter,
  isSupply,
  num,
  ensureStockFromBacklog,
  draw,
  autoRosterMonsters,
  checkWin 
} from './utils.js';
import { suppliesMeetRequirements } from './trade.js'
import {
  discardHuntersAfterHunt,
  discardMonsterAfterHunt,
  discardResupply,
  discardCull
} from './discard.js';

const CPU_DELAY = 500; // ms between actions — tweak to taste

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function sleep(ms){
  return new Promise(res => setTimeout(res, ms));
}

function randomPick(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function ensureCpuPersona(){
  if (!State.cpuPersona){
    const personas = ['offensive','defensive','balanced'];
    State.cpuPersona = randomPick(personas);
    log(`<p class="sys">🤖 CPU temperament set to <strong>${State.cpuPersona}</strong>.</p>`);
  }
  return State.cpuPersona;
}

// Find least-filled roster slot for a side
function leastFilledRosterIndex(board){
  let bestIdx = 0;
  let bestCount = Infinity;
  board.roster.forEach((stack, i)=>{
    const len = stack ? stack.length : 0;
    if (len < bestCount){
      bestCount = len;
      bestIdx = i;
    }
  });
  return bestIdx;
}

// Refill empty roster slots from DECK (CPU side)
function refillCpuRosterFromDeck(){
  const cpu = State.cpu;
  cpu.roster = cpu.roster || [];
  for (let i = 0; i < GAME.ROSTER_SLOTS; i++){
    const stack = cpu.roster[i] || (cpu.roster[i] = []);
    if (stack.length === 0 && cpu.deck.length){
      const card = cpu.deck.pop();
      stack.push(card);
    }
  }
}

// ---------------------------------------------------------------------------
// CPU HUNT LOGIC (simple, no FOIL)
// ---------------------------------------------------------------------------

// Find the "best" hunt target and hunter group
function planCpuHunt(){
  const cpu = State.cpu;
  const hunters = cpu.hand.filter(c => isHunter(c));
  if (!hunters.length) return null;

  const huntersPower = hunters.reduce((sum,c)=>sum + num(c.power), 0);

  // Collect all visible monsters (prefer player's)
  const candidateMonsters = [];

  State.you.roster.forEach((stack, i)=>{
    if (!stack || !stack.length) return;
    const top = stack[stack.length - 1];
    if (isMonster(top)){
      candidateMonsters.push({ side: 'you', idx: i, card: top });
    }
  });

  State.cpu.roster.forEach((stack, i)=>{
    if (!stack || !stack.length) return;
    const top = stack[stack.length - 1];
    if (isMonster(top)){
      candidateMonsters.push({ side: 'cpu', idx: i, card: top });
    }
  });

  if (!candidateMonsters.length) return null;

  // Only consider monsters we can actually beat
  const winnable = candidateMonsters.filter(m =>
    huntersPower >= num(m.card.power)
  );
  if (!winnable.length) return null;

  // Pick best: highest tender, then lowest power
  winnable.sort((a,b)=>{
    const ta = num(a.card.tender);
    const tb = num(b.card.tender);
    if (ta !== tb) return tb - ta;
    const pa = num(a.card.power);
    const pb = num(b.card.power);
    return pa - pb;
  });

  const target = winnable[0];
  return {
    hunters,
    target,
    huntersPower
  };
}

async function cpuDoHunt(){
  const cpu = State.cpu;
  const plan = planCpuHunt();
  if (!plan) return false;

  const { hunters, target, huntersPower } = plan;
  const monster = target.card;

  log(`
    <p class="phase-step cpu">
      🗡️ CPU attempts a hunt on <strong>${monster.name}</strong>
      (P${monster.power}, 💰${monster.tender || 0}) with 
      ${hunters.length} hunters (total P${huntersPower}).
    </p>
  `);

  // Remove hunters from CPU hand
  hunters.forEach(h => {
    const ix = cpu.hand.indexOf(h);
    if (ix >= 0){
      cpu.hand.splice(ix, 1);
    }
  });

  // Remove monster from appropriate roster stack
  const defender = (target.side === 'you') ? State.you : State.cpu;
  const stack = defender.roster[target.idx] || [];
  const pos = stack.lastIndexOf(monster);
  if (pos >= 0){
    stack.splice(pos, 1);
  }

  // Discards
  discardMonsterAfterHunt(target.side, monster);
  discardHuntersAfterHunt('cpu', hunters);

  // Award tender to CPU
  const gain = num(monster.tender);
  if (gain > 0){
    cpu.tender = num(cpu.tender) + gain;
  }

  log(`
    <p class="phase-step cpu">
      ⚔️ CPU <strong>succeeds</strong> in the hunt and gains 
      <strong>${gain}</strong> Tender.
    </p>
  `);

  window.dispatchEvent(new CustomEvent('stateChanged'));
  await sleep(CPU_DELAY);
  return true;
}

// ---------------------------------------------------------------------------
// CPU TRADE (simplified)
// ---------------------------------------------------------------------------

// Very simple trade: if CPU has 2+ supplies, move one supply + one hunter
// from roster to backlog, simulating "setting up" future draws.
async function cpuDoTrade(){
  const cpu = State.cpu;

  const suppliesInHand = cpu.hand.filter(isSupply);
  if (!suppliesInHand.length) return false;

  const hunters = [];
  cpu.roster.forEach((stack, idx)=>{
    const top = stack && stack[stack.length - 1];
    if (isHunter(top)){
      hunters.push({ idx, card: top });
    }
  });
  if (!hunters.length) return false;

  // Find all hunters we can legitimately pay for
  const possibleTrades = hunters
    .filter(h => suppliesMeetRequirements(h.card, suppliesInHand));

  if (!possibleTrades.length) return false;

  // For now, just pick one at random
  const choice = possibleTrades[Math.floor(Math.random() * possibleTrades.length)];
  const { idx: hunterSlot, card: hunterCard } = choice;

  // CPU pays with ALL supplies in hand that were considered
  const paySupplies = [...suppliesInHand];

  // Remove paid supplies from CPU hand
  paySupplies.forEach(card => {
    const ix = cpu.hand.indexOf(card);
    if (ix >= 0) cpu.hand.splice(ix, 1);
  });

  // Remove hunter from its roster slot
  const stack = cpu.roster[hunterSlot] || [];
  if (stack.length && stack[stack.length - 1] === hunterCard){
    stack.pop();
  } else {
    const pos = stack.indexOf(hunterCard);
    if (pos >= 0) stack.splice(pos, 1);
  }

  // Move hunter + supplies to backlog
  cpu.backlog.push(hunterCard, ...paySupplies);

  log(`
    <p class="phase-step cpu">
      💱 CPU trades <strong>${hunterCard.name}</strong> using 
      ${paySupplies.length} Supply card(s).
    </p>
  `);

  window.dispatchEvent(new CustomEvent('stateChanged'));
  await new Promise(res => setTimeout(res, 500));
  return true;
}

// ---------------------------------------------------------------------------
// CPU RESUPPLY
// ---------------------------------------------------------------------------

async function cpuDoResupply(){
  const cpu = State.cpu;

  const supplyTargets = [];
  cpu.roster.forEach((stack, idx)=>{
    const top = stack && stack[stack.length - 1];
    if (top && isSupply(top)){
      supplyTargets.push({ idx, card: top });
    }
  });

  if (!supplyTargets.length) return false;

  // Just pick one supply to resupply each time
  const pick = randomPick(supplyTargets);
  const stack = cpu.roster[pick.idx];
  stack.pop();

  discardResupply('cpu', [pick.card]);

  log(`
    <p class="phase-step cpu">
      📦 CPU resupplies <strong>${pick.card.name}</strong> 
      from roster to backlog.
    </p>
  `);

  window.dispatchEvent(new CustomEvent('stateChanged'));
  await sleep(CPU_DELAY);
  return true;
}

// ---------------------------------------------------------------------------
// CPU CULL
// ---------------------------------------------------------------------------

async function cpuDoCull(){
  const cpu = State.cpu;
  if (!cpu.hand.length) return false;

  // Cull the "worst" card: lowest power, then lowest tender
  const sorted = [...cpu.hand].sort((a,b)=>{
    const ap = num(a.power);
    const bp = num(b.power);
    if (ap !== bp) return ap - bp;
    const at = num(a.tender);
    const bt = num(b.tender);
    return at - bt;
  });

  const victim = sorted[0];
  const ix = cpu.hand.indexOf(victim);
  if (ix < 0) return false;

  cpu.hand.splice(ix, 1);
  discardCull('cpu', victim);

  log(`
    <p class="phase-step cpu">
      🗑️ CPU culls <strong>${victim.name}</strong> from its hand.
    </p>
  `);

  window.dispatchEvent(new CustomEvent('stateChanged'));
  await sleep(CPU_DELAY);
  return true;
}

// ---------------------------------------------------------------------------
// CPU TURN DRIVER
// ---------------------------------------------------------------------------

export async function runCpuTurn(){
  if (State.turn !== SIDES.CPU && State.turn !== 'cpu') return;

  const persona = ensureCpuPersona();
  log(`<p class="turn-header cpu">TURN ${State.turnCount} — <strong>CPU TURN (${persona})</strong></p>`);

  // We'll allow the CPU up to 3 actions per turn
  const maxActions = 3;
  let actionsTaken = 0;

  // Helper to attempt actions in an order, stopping when one succeeds
  async function attemptInOrder(order){
    for (const fn of order){
      const ok = await fn();
      if (ok){
        actionsTaken++;
        if (actionsTaken >= maxActions) return true;
      }
    }
    return false;
  }

  // Personality-based priority
  if (persona === 'offensive'){
    // Try to hunt first, then resupply to keep supply flowing, then trade, then cull.
    await attemptInOrder([cpuDoHunt, cpuDoResupply, cpuDoTrade, cpuDoCull]);
  } else if (persona === 'defensive'){
    // Build up: trade/resupply first, only then hunt easy targets, then cull.
    await attemptInOrder([cpuDoTrade, cpuDoResupply, cpuDoHunt, cpuDoCull]);
  } else { // balanced
    // Hunt if possible, otherwise mix trade/resupply, then cull.
    await attemptInOrder([cpuDoHunt, cpuDoTrade, cpuDoResupply, cpuDoCull]);
  }

  // After actions, perform CPU end-of-turn refresh

  // 1) CPU hand → backlog
  if (State.cpu.hand.length){
    State.cpu.backlog.push(...State.cpu.hand);
    State.cpu.hand.length = 0;
  }

  // 2) Ensure stock from backlog
  ensureStockFromBacklog(State.cpu);

  // 3) Draw a new hand
  let drawn = draw(State.cpu.stock, GAME.HAND_SIZE);
  drawn = autoRosterMonsters(drawn, State.cpu);

  // 4) Refill empty roster slots from deck
  refillCpuRosterFromDeck();

  // 5) Remaining drawn cards become CPU hand
  State.cpu.hand.push(...drawn);

  // 6) Reset shared per-turn flags
  State.cullUsed = false;

  const winner = checkWin();
  if (winner){
    window.dispatchEvent(new CustomEvent('gameOver', { detail:{ winner }}));
    return;
  }


  // 7) Return turn to player
  State.turnCount += 1;
  State.turn = SIDES.YOU;

  log(`<p class="turn-header you">TURN ${State.turnCount} — <strong>YOUR TURN</strong></p>`);

  window.dispatchEvent(new CustomEvent('stateChanged'));
}
