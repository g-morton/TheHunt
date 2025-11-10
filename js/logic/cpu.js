// js/logic/cpu.js
import { State } from '../core/state.js';
import { log } from '../core/log.js';
import { TYPES } from '../data.js';

const CPU_DELAY = 500; // ms between phases – tweak to taste

function sleep(ms){
  return new Promise(res => setTimeout(res, ms));
}

// helpers to flicker CPU UI
function highlightCpuZone(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('cpu-thinking');
}

function unhighlightCpuZone(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('cpu-thinking');
}

function highlightOnce(id, ms = 350){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('cpu-working');
  setTimeout(() => el.classList.remove('cpu-working'), ms);
}

function burnHighlightForOwner(owner){
  const id = owner === 'cpu' ? 'cpu-burn' : 'player-burn';
  const el = document.getElementById(id);
  if (!el) return;

  // Add pulsing class
  el.classList.add('cpu-thinking');

  // Wait for animation (~3s) then clean up
  setTimeout(() => {
    el.classList.remove('cpu-thinking');
  }, 3200); // matches 3 × 1s pulses + small buffer
}

/* ------------------------- shared helper functions ------------------------ */

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function leastFilledRosterIndex(board){
  let bestIdx = 0;
  let bestCount = Infinity;
  board.roster.forEach((stack, i)=>{
    const len = stack.length;
    if (len < bestCount){
      bestCount = len;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function placeIntoRoster(card, side='cpu'){
  const board = side === 'cpu' ? State.cpu : State.you;
  const idx = leastFilledRosterIndex(board);
  board.roster[idx].push(card);
}

/* ------------------------------- CPU phases ------------------------------- */

function cpuHunt() {
  const cpu = State.cpu;
  const cpuHunters = cpu.hand.filter(c => c.t === TYPES.HUNTER);

  log("<p class='cpu'>🗡️ Hunt phase</p>");

  // 1) find a target monster (prefer player's)
  let target = null;
  let targetSide = null;
  let targetIdx = -1;

  // look at player's roster first
  State.you.roster.forEach((stack, i) => {
    if (!stack.length) return;
    const top = stack[stack.length - 1];
    if (top.t === TYPES.MONSTER) {
      if (!target || top.power < target.power) {
        target = top;
        targetSide = 'you';
        targetIdx = i;
      }
    }
  });

  // if none on player, look at CPU's own roster
  if (!target) {
    State.cpu.roster.forEach((stack, i) => {
      if (!stack.length) return;
      const top = stack[stack.length - 1];
      if (top.t === TYPES.MONSTER) {
        if (!target || top.power < target.power) {
          target = top;
          targetSide = 'cpu';
          targetIdx = i;
        }
      }
    });
  }

  if (!target) {
    log("<p class='phase-step cpu'>No monsters to hunt — skipping.</p>");
    return;
  }

  // 2) check power
  const totalP = cpuHunters.reduce((s, c) => s + (c.power || 0), 0);
  if (totalP < (target.power || 0)) {
    log(
      `<p class='phase-step cpu'>Hunters total P${totalP} &lt; ${target.name} (P${target.power}) — skipping.</p>`
    );
    return;
  }

  // 3) BEGINNER MODE: just do the hunt right now, no foil / prompt
  if (State.beginner) {
    const victimStacks =
      targetSide === 'you' ? State.you.roster : State.cpu.roster;
    const stack = victimStacks[targetIdx];
    const monster = stack.pop();

    // burn monster to owner
    if (targetSide === 'you') {
      State.you.burn.push(monster);
      log(
        `<p class='phase-step cpu'>⚔️ CPU hunted YOUR <strong>${monster.name}</strong> (P${monster.power}).</p>`
      );
    } else {
      State.cpu.burn.push(monster);
            log(
        `<p class='phase-step cpu'>⚔️ CPU hunted own <strong>${monster.name}</strong> (P${monster.power}).</p>`
      );
    }

    // burn all CPU hunters used
    cpuHunters.forEach(h => {
      const ix = State.cpu.hand.indexOf(h);
      if (ix > -1) {
        State.cpu.hand.splice(ix, 1);
        State.cpu.burn.push(h);
      }
    });

    // award tender to CPU (your player version now awards from any hunt)
    const gain = Number(monster.tender || 0);
    if (gain > 0) {
      State.cpu.tender = Number(State.cpu.tender || 0) + gain;
    }


    // update UI
    window.dispatchEvent(new CustomEvent('stateChanged'));
    return;
  }

  // 4) NORMAL MODE: create an interrupt so player can FOIL or PASS
  State.interrupt = {
    type: 'cpu-hunt-foil',
    cpuHunters: cpuHunters.slice(),
    target,
    targetSide,
    targetIdx
  };

  log(`
    <p class='phase-step cpu'>
      🤖 CPU is hunting <strong>${target.name}</strong> (P${target.power})<br>
      using: ${cpuHunters
        .map(h => `${h.name} (P${h.power || 0}, F${h.foil || 0})`)
        .join(', ')}<br>
      ❓ Player may FOIL or PASS.
    </p>
  `);

  // wake the UI so it shows PASS button
  window.dispatchEvent(new CustomEvent('stateChanged'));
}


/*  Player response to CPU hunt interrupt                             */
/* ------------------------------------------------------------------ */

export async function resumeCpuHuntFromInterrupt(playerFoilCard = null){
  const intr = State.interrupt;
  if (!intr || intr.type !== 'cpu-hunt-foil') return;

  const { cpuHunters, target, targetSide, targetIdx } = intr;

  // PLAYER FOILED
  if (playerFoilCard) {
    // find a CPU hunter we can match: player foil >= cpu hunter foil
    const playerFoilVal = Number(playerFoilCard.foil || 0);
    const cpuMatch = cpuHunters.find(h => Number(h.foil || 0) <= playerFoilVal);
    if (cpuMatch) {
      // burn player's chosen card
      const phIdx = State.you.hand.indexOf(playerFoilCard);
      if (phIdx >= 0) State.you.hand.splice(phIdx, 1);
      State.you.burn.push(playerFoilCard);

      // burn matched CPU hunter (remove from CPU hand)
      const chIdx = State.cpu.hand.indexOf(cpuMatch);
      if (chIdx >= 0) State.cpu.hand.splice(chIdx, 1);
      State.cpu.burn.push(cpuMatch);

      log(`
        <p class='sys'>
          ❌ <strong>FOIL!</strong><br>
          You burned <strong>${playerFoilCard.name}</strong> (Foil ${playerFoilVal})<br>
          to foil CPU's <strong>${cpuMatch.name}</strong> (Foil ${cpuMatch.foil || 0}).<br>
          CPU hunt is halted.
        </p>
      `);

      // clear interrupt and continue CPU turn
      State.interrupt = null;
      await runCpuTurn();  // continue to CPU trade/restock/etc.
      return;
    } else {
      // player tried invalid foil – just treat as PASS
      log("<p class='sys'>❌ Foil didn't match any CPU hunter — treating as PASS.</p>");
    }
  }

  // PASS / or invalid foil → resolve hunt normally
  const victimStacks = (targetSide === 'you') ? State.you.roster : State.cpu.roster;
  const stack = victimStacks[targetIdx];
  const monster = stack.pop();

  if (targetSide === 'you') {
    State.you.burn.push(monster);
    burnHighlightForOwner('you');
  } else {
    State.cpu.burn.push(monster);
    burnHighlightForOwner('cpu');
  }

  // burn all CPU hunters used
  cpuHunters.forEach(h => {
    const ix = State.cpu.hand.indexOf(h);
    if (ix > -1){
      State.cpu.hand.splice(ix,1);
      State.cpu.burn.push(h);
    }
  });
  highlightOnce('cpu-burn');

  const gain = target.tender || 0;
  if (gain) {
    State.cpu.tender = (State.cpu.tender || 0) + gain;
    window.dispatchEvent(new CustomEvent('stateChanged'));
  }

  log(`
    <p class='phase-step cpu'>
      ⚔️ CPU hunt succeeded on <strong>${target.name}</strong>.
      ${gain ? `💰 CPU gained <strong>${gain}</strong> Tender.` : ''}
    </p>
  `);

  // clear interrupt and continue CPU turn
  State.interrupt = null;
  await runCpuTurn();
}

function cpuTrade(){
  log("<p class='cpu'>💱 Trade phase</p>");

  const didTrade = cpuTryTrade();
  if (!didTrade){
    log("<p class='phase-step cpu'>No affordable hunters to buy — skipping.</p>");
  }
}

// --- CPU trade helpers -------------------------------------------------------

function cpuTryTrade(){
  const cpu = State.cpu;
  const hand = cpu.hand || [];
  const roster = cpu.roster || [];

  // supplies in hand
  const supplies = hand.filter(c => c.t === TYPES.SUPPLY);
  if (supplies.length === 0) return false;

  const wallet = countSupplies(supplies);

  // find hunters on top of CPU roster stacks
  const candidateHunters = [];
  roster.forEach((stack, idx) => {
    if (!stack || !stack.length) return;
    const top = stack[stack.length - 1];
    if (top.t === TYPES.HUNTER) {
      candidateHunters.push({ card: top, stackIndex: idx });
    }
  });
  if (candidateHunters.length === 0) return false;

  // keep only hunters we can pay for
  const affordable = candidateHunters
    .map(h => {
      const payPlan = canAffordHunter(structuredCloneWallet(wallet), h.card.requires || h.card.req);
      return payPlan ? { ...h, payPlan } : null;
    })
    .filter(Boolean);

  if (affordable.length === 0) return false;

  // choose best hunter (highest power, then highest foil)
  affordable.sort((a, b) => {
    const ap = a.card.power || 0;
    const bp = b.card.power || 0;
    if (ap !== bp) return bp - ap;
    const af = a.card.foil || 0;
    const bf = b.card.foil || 0;
    return bf - af;
  });

  const chosen = affordable[0];

  // pay: backlog supplies used
  chosen.payPlan.forEach(card => {
    const i = cpu.hand.indexOf(card);
    if (i >= 0) {
      cpu.hand.splice(i, 1);
      cpu.backlog.push(card); // buying backlogs supply
    }
  });

  // take hunter from roster → to backlog (so CPU draws it later)
  roster[chosen.stackIndex].pop();
  cpu.backlog.push(chosen.card);

  log(
    `<p class='phase-step cpu'>CPU traded ${chosen.payPlan.length} Supply to recruit <strong>${chosen.card.name}</strong> (to backlog).</p>`
  );

  return true;
}

function countSupplies(supplyCards){
  const wallet = {
    any: 0,
    kit: 0,
    script: 0,
    treacle: 0,
    _cards: {
      any: [],
      kit: [],
      script: [],
      treacle: []
    }
  };

  supplyCards.forEach(card => {
    const kind = detectSupplyKind(card);
    wallet[kind] += 1;
    wallet._cards[kind].push(card);
  });

  return wallet;
}

// structuredClone alternative for wallet
function structuredCloneWallet(w){
  return {
    any: w.any,
    kit: w.kit,
    script: w.script,
    treacle: w.treacle,
    _cards: {
      any: [...w._cards.any],
      kit: [...w._cards.kit],
      script: [...w._cards.script],
      treacle: [...w._cards.treacle],
    }
  };
}

function detectSupplyKind(card){
  if (card.supplyType) return String(card.supplyType).toLowerCase();
  const name = (card.name || "").toLowerCase();
  if (name.includes("kit")) return "kit";
  if (name.includes("script")) return "script";
  if (name.includes("treacle")) return "treacle";
  return "any";
}

function canAffordHunter(wallet, requires){
  if (!requires) return [];

  // normalise
  const need = {};
  if (Array.isArray(requires)){
    requires.forEach(r => {
      const key = String(r).toLowerCase();
      need[key] = (need[key] || 0) + 1;
    });
  } else {
    Object.entries(requires).forEach(([k,v]) => {
      need[String(k).toLowerCase()] = v;
    });
  }

  const payPlan = [];

  // pay strict types first
  const strict = ["kit","script","treacle"];
  for (const t of strict){
    const want = need[t] || 0;
    if (!want) continue;

    if (wallet[t] >= want){
      for (let i=0; i<want; i++){
        payPlan.push(wallet._cards[t][i]);
      }
      wallet._cards[t].splice(0, want);
      wallet[t] -= want;
    } else {
      const have = wallet[t];
      for (let i=0; i<have; i++){
        payPlan.push(wallet._cards[t][i]);
      }
      wallet._cards[t].splice(0, have);
      wallet[t] = 0;

      const short = want - have;
      if (wallet.any >= short){
        for (let i=0; i<short; i++){
          payPlan.push(wallet._cards.any[i]);
        }
        wallet._cards.any.splice(0, short);
        wallet.any -= short;
      } else {
        return null;
      }
    }
  }

  // pay 'any' last
  const needAny = need.any || 0;
  if (needAny){
    if (wallet.any >= needAny){
      for (let i=0; i<needAny; i++){
        payPlan.push(wallet._cards.any[i]);
      }
      wallet._cards.any.splice(0, needAny);
      wallet.any -= needAny;
    } else {
      // try to use leftover strict as 'any'
      let remaining = needAny - wallet.any;

      for (let i=0; i<wallet.any; i++){
        payPlan.push(wallet._cards.any[i]);
      }
      wallet._cards.any.splice(0, wallet.any);
      wallet.any = 0;

      const pools = ["kit","script","treacle"];
      for (const p of pools){
        while (remaining > 0 && wallet[p] > 0){
          payPlan.push(wallet._cards[p][0]);
          wallet._cards[p].splice(0,1);
          wallet[p] -= 1;
          remaining -= 1;
        }
      }
      if (remaining > 0){
        return null;
      }
    }
  }

  return payPlan;
}

function cpuRestock(){
  log("<p class='cpu'>📦 Restock phase</p>");
  const regs = State.cpu.roster;
  for (let i = 0; i < regs.length; i++){
    const stack = regs[i];
    const top = stack[stack.length - 1];
    if (top && top.t === TYPES.SUPPLY){
      stack.pop();
      State.cpu.backlog.push(top);
      log(`<p class='phase-step cpu'>Restocked ${top.name} from Roster to backlog.</p>`);
      return;
    }
  }
  log("<p class='phase-step cpu'>No supply on roster — skipping.</p>");
}

function reshufflebacklogIntostockCpu(){
  if (!State.cpu.backlog.length) return false;
  State.cpu.stock.push(...State.cpu.backlog);
  State.cpu.backlog.length = 0;
  shuffle(State.cpu.stock);
  log("<p class='phase-step cpu'>stock empty → shuffled backlog back in.</p>");
  return true;
}

function cpuDrawOneIntoHand(){
  if (!State.cpu.stock.length){
    const ok = reshufflebacklogIntostockCpu();
    if (!ok) return false;
  }
  const card = State.cpu.stock.pop();
  if (!card) return false;

  if (card.t === TYPES.MONSTER){
    placeIntoRoster(card, 'cpu');
    log(`<p class='phase-step cpu'>Drew Monster ${card.name} → CPU Roster.</p>`);
  } else {
    State.cpu.hand.push(card);
  }
  return true;
}

function cpuRosterRefresh(){
  for (let n = 0; n < 5; n++){
    if (!State.cpu.deck.length) break;
    const card = State.cpu.deck.pop();
    const idx = n % State.cpu.roster.length;
    State.cpu.roster[idx].push(card);
  }
  log("<p class='phase-step cpu'>Roster refreshed from Deck.</p>");
}

function cpubacklog(){
  log("<p class='cpu'>🗑️ Backlog phase</p>");
  log("<p class='phase-step cpu'>No backlog this turn.</p>");
}

function cpuRefresh(){
  log("<p class='cpu'>🔁 Refresh phase</p>");
  while (State.cpu.hand.length < 5){
    const ok = cpuDrawOneIntoHand();
    if (!ok) break;
  }
  cpuRosterRefresh();
  log(`<p class='phase-step cpu'>Refresh complete. Hand: ${State.cpu.hand.length} cards.</p>`);
}

/* --------------------------- main CPU turn runner -------------------------- */

// js/logic/cpu.js (just the runner)
export async function runCpuTurn(){
  if (State.turn !== 'cpu') return;

  const CPU_DELAY = 500;       // how long to show each phase
  const PAINT_DELAY = 120;     // tiny pause so highlight actually renders

  log(`<p class='turn-header cpu'>TURN ${State.turnCount} — <strong>CPU TURN</strong></p>`);

  // HUNT
  highlightCpuZone('cpu-roster');
  await sleep(PAINT_DELAY);    // let the highlight show
  cpuHunt();
  await sleep(CPU_DELAY);      // keep it visible so player can read log
  unhighlightCpuZone('cpu-roster');

    // if hunt created an interrupt, stop here; UI will resume via resumeCpuHuntFromInterrupt
  if (State.interrupt && State.interrupt.type === 'cpu-hunt-foil') {
    return;
  }

  // TRADE
  highlightCpuZone('cpu-roster');
  await sleep(PAINT_DELAY);
  cpuTrade();
  await sleep(CPU_DELAY);
  unhighlightCpuZone('cpu-roster');

  // RESTOCK
  highlightCpuZone('cpu-roster');
  await sleep(PAINT_DELAY);
  cpuRestock();
  await sleep(CPU_DELAY);
  unhighlightCpuZone('cpu-roster');

  // backlog (no visible backlog, reuse roster)
  highlightCpuZone('cpu-roster');
  await sleep(PAINT_DELAY);
  cpubacklog();
  await sleep(CPU_DELAY);
  unhighlightCpuZone('cpu-roster');

  // REFRESH
  highlightCpuZone('cpu-deck');
  await sleep(PAINT_DELAY);
  cpuRefresh();
  await sleep(CPU_DELAY);
  unhighlightCpuZone('cpu-deck');

  // end of CPU turn → back to player
  State.turnCount++;
  State.turn = 'you';
  State.phase = 'hunt';

  // clear selections
  State.sel.monster = null;
  State.sel.hunters?.clear?.();
  State.sel.tradeSupply?.clear?.();
  State.sel.tradeHunters?.clear?.();
  State.sel.restock = null;
  State.selectedTobacklog?.clear?.();
  State.readyPhase = null;

  log(`<p class='turn-header you'>TURN ${State.turnCount} — <strong>YOUR TURN</strong></p>`);
  window.dispatchEvent(new CustomEvent('stateChanged'));
}
