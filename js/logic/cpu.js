// js/logic/cpu.js — V5.1 CPU turn logic with FOIL

import { State, SIDES, GAME } from '../core/state.js';
import { log } from '../core/log.js';
import {
  isMonster,
  isHunter,
  isSupply,
  num,
  topOf,
  checkWin,
  isRegimented
} from './utils.js';
import { suppliesMeetRequirements } from './trade.js';
import {
  discardHuntersAfterHunt,
  discardMonsterAfterHunt,
  discardResupply,
  discardCull,
  discardTrade
} from './discard.js';
import { startCpuTurn, startPlayerTurn } from './startturn.js';
import { showFoilPrompt } from '../ui/foil.js';
import {
  playerHasFoilHunters,
  collectPlayerFoilSelection,
  computeFoilAgainstHunters,
  applyPlayerFoilCardMovement,
  discardFoiledHunters,
  promptPlayerFoil
} from './cpu-foil.js';
import { playSfx } from '../core/sound.js';


const CPU_DELAY = 500; // ms between actions — tweak to taste



// 🔹 NEW: CPU-end-of-turn roster refill
function refillRosterFromDeck(board){
  let added = 0;
  const names = [];

  board.roster = board.roster || [];
  for (let i = 0; i < GAME.ROSTER_SLOTS; i++){
    const stack = board.roster[i] || (board.roster[i] = []);
    if (stack.length === 0 && board.deck.length){
      const card = board.deck.pop();
      stack.push(card);
      added++;
      names.push(card.name || 'Card');
    }
  }

  if (added > 0){
    log(`
      <p class="cpu">
        🧱 CPU refills ${added} empty roster slot${added === 1 ? '' : 's'}
        from its deck: ${names.join(', ')}.
      </p>
    `);
  }
}


// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms){
  return new Promise(res => setTimeout(res, ms));
}

function randomPick(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

// Ensure CPU has a persona for basic prioritisation
function ensureCpuPersona(){
  const cpu = State.cpu;
  if (!cpu.persona){
    const personas = ['offensive','balanced','defensive'];
    cpu.persona = personas[Math.floor(Math.random() * personas.length)];
  }
  return cpu.persona;
}






// ---------------------------------------------------------------------------
// CPU HUNT PLANNING
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


// ---------------------------------------------------------------------------
// CPU HUNT with FOIL support
// ---------------------------------------------------------------------------

// CPU attempts a Hunt (now FOIL-aware).
// Returns true if it performed a Hunt action (success or fail), false if no hunt was attempted.
// CPU attempts a Hunt (FOIL-aware).
// Returns true if it performed a Hunt action (success or fail), false if no hunt was attempted.
async function cpuDoHunt(){
  const cpu  = State.cpu;
  const plan = planCpuHunt();
  if (!plan) {
    log(`
      <p class="cpu">
        🤔 CPU considers a <strong>Hunt</strong> but finds no worthwhile target.
      </p>
    `);
    await sleep(CPU_DELAY);
    return false;
  }

  let { hunters, target, huntersPower } = plan;
  // Clone hunters array so we can modify independently after FOIL
  hunters = hunters.slice();

  const monster      = target.card;
  const monsterPower = num(monster.power);

// Regimented rule for CPU too:
  // if it plans to use exactly ONE Regimented Hunter, cancel the hunt.
  const cpuRegimented = hunters.filter(h => isRegimented(h));
  if (cpuRegimented.length === 1){
    const lone = cpuRegimented[0];
    log(`
      <p class="cpu">
        ⚠️ CPU cancels this Hunt: <strong>${lone.name}</strong> is 
        <strong>Regimented</strong> and requires at least two Regimented Hunters
        to embark together.
      </p>
    `);
    await sleep(CPU_DELAY);
    return false;
  }

  const ownerLabel   = (target.side === 'you' || target.side === SIDES.YOU)
    ? 'YOUR roster'
    : 'CPU roster';

  const hunterListText = hunters
    .map(h => `${h.name || 'Hunter'} (P${num(h.power)})`)
    .join(', ') || 'none';

  playSfx('huntStart');

  log(`
    <p class="phase-step cpu">
      🗡️ CPU attempts a Hunt on <strong>${monster.name}</strong>
      (P${monster.power}, 💰${monster.tender || 0}) on
      <strong>${ownerLabel}</strong><br>
      using ${hunters.length} hunter(s) (total P${huntersPower}):<br>
      <span class="cpu-hunters-list">${hunterListText}</span>
    </p>
  `);

  let foilUsed         = false;
  let foilRemovedPower = 0;
  let foiledNames      = [];

  // 🔹 Player may attempt to FOIL any CPU Hunt (if they have Hunters available)
  if (playerHasFoilHunters()){
    log(`
      <p class="you">
        🛡️ You may <strong>FOIL</strong> this CPU Hunt by committing Hunters
        from your hand or roster.
      </p>
    `);

    // Clear any stale selection before asking for a Foil choice
    if (State.sel){
      State.sel.hand?.clear?.();
      State.sel.roster?.clear?.();
      State.sel.monster = null;
      if ('enemyMonsterIdx' in State.sel){
        State.sel.enemyMonsterIdx = null;
      }
      window.dispatchEvent(new CustomEvent('selectionChanged'));
    }

    // Enter FOIL mode so UI can highlight your hand/roster
    State.foil.active   = true;
    State.foil.defender = SIDES.YOU;
    State.foil.target   = monster;
    window.dispatchEvent(new CustomEvent('stateChanged'));

    // Show the FOIL popup and wait for player's choice
    const decision = await promptPlayerFoil(monster, hunters);

    if (decision === 'foil'){
      const foilSelection = collectPlayerFoilSelection();
      const foilBudget = foilSelection.reduce(
        (sum, f) => sum + num(f.card.power),
        0
      );

      if (foilBudget > 0){
        const foilOutcome = computeFoilAgainstHunters(hunters, foilBudget);

        foilUsed         = true;
        foilRemovedPower = foilOutcome.removedPower;
        foiledNames      = foilOutcome.foiled.map(h => h.name);

        // Your Foil Hunters are burned
        applyPlayerFoilCardMovement(foilSelection);

        // Foiled CPU Hunters are burned
        if (foilOutcome.foiled.length){
          discardFoiledHunters('cpu', foilOutcome.foiled);
        }

        // Remaining CPU hunters + power after FOIL
        hunters      = foilOutcome.survivors;
        huntersPower = huntersPower - foilOutcome.removedPower;
      } else {
        playSfx('huntWin');

        log(`
          <p class="you">
            You selected <strong>FOIL</strong> but no valid Hunters were chosen,
            so the CPU's Hunt proceeds unblocked.
          </p>
        `);
      }

      // Clear selection now that Foil has been resolved
      if (State.sel){
        State.sel.hand?.clear?.();
        State.sel.roster?.clear?.();
        State.sel.monster = null;
        if ('enemyMonsterIdx' in State.sel){
          State.sel.enemyMonsterIdx = null;
        }
        window.dispatchEvent(new CustomEvent('selectionChanged'));
      }
    } else if (decision === 'pass'){
      playSfx('huntWin');
      log(`
        <p class="you">
          You allow the CPU's Hunt to proceed without Foil.
        </p>
      `);
    }

    // Exit FOIL mode
    State.foil.active   = false;
    State.foil.defender = null;
    State.foil.target   = null;
    window.dispatchEvent(new CustomEvent('stateChanged'));
  }

  // 🔹 Commit CPU hunters: remove all *original* hunters from hand.
  // Foiled ones may already be removed by discardFoiledHunters; indexOf check is safe.
  plan.hunters.forEach(h => {
    const ix = cpu.hand.indexOf(h);
    if (ix >= 0){
      cpu.hand.splice(ix, 1);
    }
  });

  if (foilUsed && foilRemovedPower > 0){
    playSfx('huntFoiled');
    log(`
      <p class="you">
        🛡️ Your Foil neutralises ${foiledNames.length} CPU hunter(s)
        (blocking P${foilRemovedPower}). 
      </p>
    `);
  }

  // 🔹 Check if, after Foil, the hunt still has enough power to succeed
  if (huntersPower < monsterPower){
    // Hunt fails: monster survives, CPU's surviving hunters go to backlog,
    // your foilers are already burned, and foiled CPU hunters were burned too.
    log(`
      <p class="cpu">
        ❌ <strong>CPU Hunt fails</strong>: remaining hunter power P${huntersPower}
        is not enough to defeat <strong>${monster.name}</strong> (P${monsterPower}).<br>
        The monster survives, but the CPU's hunters are spent.
      </p>
    `);

    // Surviving (non-foiled) hunters always go to backlog
    discardHuntersAfterHunt('cpu', hunters);

    window.dispatchEvent(new CustomEvent('stateChanged'));
    await sleep(CPU_DELAY);
    return true;
  }

  // 🔹 Hunt succeeds
  const defender = (target.side === 'you' || target.side === SIDES.YOU)
    ? State.you
    : State.cpu;

  const stack = defender.roster[target.idx] || [];
  const pos   = stack.lastIndexOf(monster);
  if (pos >= 0){
    stack.splice(pos, 1);
  }

  // Monster is always burned on success
  discardMonsterAfterHunt(target.side, monster);

  // Surviving (non-foiled) hunters always go to backlog
  discardHuntersAfterHunt('cpu', hunters);

  // Tender gain rules:
  // - Hunting CPU's own monsters (on its own roster) yields Tender.
  // - Hunting the player's roster gives no Tender (pure disruption).
  if (target.side === 'cpu' || target.side === SIDES.CPU) {
    const gain = Number(target.card.tender || 0);
    if (gain > 0){
      cpu.tender = Number(cpu.tender || 0) + gain;
      playSfx('huntWin');
      log(`
        <p class='cpu'>
          ✅ <strong>CPU Hunt succeeds</strong> against its own monster 
          <strong>${monster.name}</strong>, gaining <strong>${gain}</strong> Tender.
        </p>
      `);
    } else {
      log(`
        <p class='cpu'>
          ✅ <strong>CPU Hunt succeeds</strong> against its own monster 
          <strong>${monster.name}</strong>, but it yields no Tender.
        </p>
      `);
    }
  } else {
    if (foilUsed && foilRemovedPower > 0){
      log(`
        <p class='cpu'>
          ✅ Despite your Foil, CPU still removes 
          <strong>${monster.name}</strong> from your roster (no Tender gained).
        </p>
      `);
    } else {
      log(`
        <p class='cpu'>
          ✅ CPU disrupts your roster by removing 
          <strong>${monster.name}</strong>, but gains no Tender.
        </p>
      `);
    }
  }

  window.dispatchEvent(new CustomEvent('stateChanged'));
  await sleep(CPU_DELAY);
  return true;
}




// ---------------------------------------------------------------------------
// CPU TRADE
// ---------------------------------------------------------------------------


function tryBuildCpuPayment(hunter, suppliesInHand){
  if (!hunter.requires) return null;  // no cost? ignore (or auto afford)

  const req = hunter.requires;
  const payment = [];
  const supplyPool = [...suppliesInHand];

  // Pay specific types first (Kit, Script, Treacle)
  for (const [type, amount] of Object.entries(req)){
    if (type === 'any') continue;

    let need = amount;
    for (let i = supplyPool.length - 1; i >= 0 && need > 0; i--){
      const card = supplyPool[i];
      if (card.t === type){
        payment.push(card);
        supplyPool.splice(i, 1);
        need--;
      }
    }

    if (need > 0){
      return null; // Cannot pay required type
    }
  }

  // Now pay mutually-flexible "any" cards
  const anyAmount = req.any || 0;
  if (anyAmount > 0){
    for (let i = supplyPool.length - 1; i >=0 && payment.length < (anyAmount + payment.length); i--){
      const card = supplyPool[i];
      if (isSupply(card)){
        payment.push(card);
        supplyPool.splice(i, 1);
      }
    }

    if (payment.length < Object.keys(req).filter(k => k !== 'any').reduce((a,k)=>a+req[k],0) + anyAmount){
      return null; // Not enough flexible supplies
    }
  }

  return payment;
}


async function cpuDoTrade(){
  const cpu = State.cpu;

  // Supplies in hand
  const suppliesInHand = cpu.hand.filter(c => isSupply(c));
  if (!suppliesInHand.length) return false;

  // Hunters on roster
  const hunters = [];
  cpu.roster.forEach((stack, idx) => {
    const top = stack && stack[stack.length - 1];
    if (isHunter(top)){
      hunters.push({ idx, card: top });
    }
  });
  if (!hunters.length) return false;

  // All hunters that CPU CAN pay for
  const affordable = hunters
    .map(h => ({
      ...h,
      payment: tryBuildCpuPayment(h.card, suppliesInHand)  // NEW: exact payment
    }))
    .filter(h => h.payment !== null);

  if (!affordable.length) return false;

  // Choose cheapest or strongest?
  // For now: cheapest supply cost
  affordable.sort((a, b) => a.payment.length - b.payment.length);

  const choice = affordable[0];
  const { idx: slot, card: hunterCard, payment } = choice;

  // Remove used supplies from CPU hand
  payment.forEach(card => {
    const ix = cpu.hand.indexOf(card);
    if (ix >= 0) cpu.hand.splice(ix, 1);
  });

  // Remove hunter from roster (top or fallback)
  const stack = cpu.roster[slot] || [];
  if (stack.length && stack[stack.length - 1] === hunterCard){
    stack.pop();
  } else {
    const pos = stack.indexOf(hunterCard);
    if (pos >= 0) stack.splice(pos, 1);
  }

  // Move traded hunter and spent supplies to backlog
  discardTrade('cpu', hunterCard, payment);

  // Logging (super clear)
  const payList = payment.map(c => c.name || c.t || '?').join(', ');

  log(`
    <p class="phase-step cpu">
      💱 CPU trades <strong>${hunterCard.name}</strong><br>
      🔧 Paid using: <strong>${payList}</strong><br>
      📦 ${payment.length} Supply card(s) consumed.
    </p>
  `);

  window.dispatchEvent(new CustomEvent('stateChanged'));
  await sleep(CPU_DELAY);
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

  // --- NEW: Guardrails to prevent CPU self-destruction ---
  const totalCards =
    cpu.deck.length +
    cpu.stock.length +
    cpu.backlog.length +
    cpu.hand.length +
    cpu.roster.reduce((a, s) => a + s.length, 0);

  const huntersInHand = cpu.hand.filter(c => isHunter(c)).length;

  if (
    cpu.hand.length <= 3 ||          // Preserve minimum hand
    cpu.stock.length <= 3 ||         // Keep enough stock for a redraw
    cpu.backlog.length === 0 ||      // Don’t cull before reshuffle
    totalCards < 10 ||               // Danger: low total card count
    huntersInHand <= 2               // Keep minimal hunting force
  ){
    return false;
  }

  // --- Existing cull logic (choose weakest card, burn it) ---
  const cullCandidates = cpu.hand.filter(c => !isHunter(c));
  if (!cullCandidates.length) return false;

  const target = randomPick(cullCandidates);

  const ix = cpu.hand.indexOf(target);
  if (ix >= 0) cpu.hand.splice(ix, 1);

  cpu.burn.push(target);

  log(`
    <p class="phase-step cpu">
      🗑️ CPU culls <strong>${target.name || target.t}</strong>.
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

  // V5.1: CPU refresh now happens at the START of its own turn
  startCpuTurn();

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

  // After CPU actions, check for win
  const winner = checkWin();
  if (winner){
    window.dispatchEvent(new CustomEvent('gameOver', { detail:{ winner }}));
    return;
  }


  
  // ✅ Refill CPU roster at the END of its turn
  refillRosterFromDeck(State.cpu);
  window.dispatchEvent(new CustomEvent('stateChanged'));


  // Hand turn back to player, and refresh them at the START of their turn
  State.turnCount += 1;
  State.turn = SIDES.YOU;

  startPlayerTurn();
}
