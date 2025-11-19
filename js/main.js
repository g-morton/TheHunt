// js/main.js
//
// V5 bootstrap: no phases. Free-order actions with smart button highlights.
// Assumes the following DOM IDs exist:
//   #btn-hunt  #btn-trade  #btn-resupply  #btn-cull  #btn-endturn
//
// Minimal dependencies: state, action executors, action hints, and render.

import { State, newGameState, SIDES } from './core/state.js';
import { computeActionHints } from './logic/actions.js';
import { executeHunt } from './logic/hunt.js';
import { executeTrade } from './logic/trade.js';
import { executeResupply } from './logic/resupply.js';
import { executeCull } from './logic/cull.js';
import { endYourTurn } from './logic/endturn.js';
import './logic/setup.js';
import { render, updateSelectionHighlights } from './ui/render.js';
import { log } from './core/log.js';
import { showFoilPrompt } from './ui/foil.js';
import { playSfx } from './core/sound.js';

// ---------- Button helpers ----------
function $(id){ return document.getElementById(id); }

const BTN = {
  hunt:     $('btn-hunt'),
  trade:    $('btn-trade'),
  resupply: $('btn-resupply'),
  cull:     $('btn-cull'),
  endturn:  $('btn-endturn'),
  newgame:  $('btn-newgame')
};





// DEV ONLY: test Foil UI by pressing F on the keyboard
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'f' || ev.key === 'F') {
    showFoilPrompt(
      {
        monsterName: 'Dire Wolf Alpha',
        monsterPower: 7,
        requiredPower: 7
      },
      ({ decision, context }) => {
        console.log('[FOIL decision]', decision, context);
        // later: plug in real foil logic here
      }
    );
  }
});





function setBtn(el, enabled, highlighted){
  if (!el) return;
  // End Turn remains clickable on your turn even if not "highlighted"
  el.disabled = !enabled;
  el.classList.toggle('highlight', !!highlighted);
}

function refreshButtons(){
  const h = computeActionHints();

  // Enable == same as highlight for primary actions
  setBtn(BTN.hunt,     h.hunt,     h.hunt);
  setBtn(BTN.trade,    h.trade,    h.trade);
  setBtn(BTN.resupply, h.resupply, h.resupply);

  // Cull: enabled only when valid (once/turn, exactly one hand card)
  setBtn(BTN.cull,     h.cull,     h.cull);

  // End Turn: enabled on your turn; highlight always (helps UX)
  const yourTurn = (State.turn === SIDES.YOU);
  setBtn(BTN.endturn,  yourTurn,   yourTurn);

  // Optional: set button titles with reasons for disabled state (nice UX)
  if (BTN.hunt)     BTN.hunt.title     = h.hunt ? '' : (h.reasons?.hunt     || '');
  if (BTN.trade)    BTN.trade.title    = h.trade ? '' : (h.reasons?.trade    || '');
  if (BTN.resupply) BTN.resupply.title = h.resupply ? '' : (h.reasons?.resupply || '');
  if (BTN.cull)     BTN.cull.title     = h.cull ? '' : (h.reasons?.cull     || '');
  if (BTN.endturn)  BTN.endturn.title  = h.endturn ? '' : (h.reasons?.endturn  || '');
}

// ---------- Wire actions ----------
function wireButtons(){
  BTN.hunt     && BTN.hunt.addEventListener('click',     executeHunt);
  BTN.trade    && BTN.trade.addEventListener('click',    executeTrade);
  BTN.resupply && BTN.resupply.addEventListener('click', executeResupply);
  BTN.cull     && BTN.cull.addEventListener('click',     executeCull);
  BTN.endturn  && BTN.endturn.addEventListener('click',  endYourTurn);
  BTN.newgame  && BTN.newgame.addEventListener('click',  startNewGame);
}

// ---------- Global event plumbing ----------
function wireEvents(){
  window.addEventListener('stateChanged', ()=>{
    render?.();
    refreshButtons();
  });

  window.addEventListener('selectionChanged', ()=>{
    // No need to redraw; just toggle .selected based on State.sel
    updateSelectionHighlights?.();
    refreshButtons();
  });

  window.addEventListener('gameOver', (ev)=>{
    const winner = ev?.detail?.winner || 'unknown';
    const label =
      winner === 'you' ? 'YOU' :
      winner === 'cpu' ? 'CPU' : String(winner).toUpperCase();

    // Log it as before (if you like)
    log(`
      <p class="sys game-over">
        🏁 <strong>GAME OVER</strong><br>
        <strong>${label}</strong> wins the Hunt.
      </p>
    `);

    // Show fancy overlay
    const overlay = $('game-over-overlay');
    const winnerEl = $('game-over-winner');
    const summaryEl = $('game-over-summary');

    if (overlay && winnerEl){
      if (winner === 'you'){
        playSfx('endgameWin');
        winnerEl.textContent = 'Victory! You dominate the Hunt.';
        if (summaryEl){
          summaryEl.textContent = 'Your Hunters stand alone amid the wreckage. The CPU slinks away in defeat.';
        }
      } else if (winner === 'cpu'){
        playSfx('endgameLose');
        winnerEl.textContent = 'Defeat. The CPU claims the field.';
        if (summaryEl){
          summaryEl.textContent = 'Your deck is spent. The Hunt is lost… for now.';
        }
      } else {
        winnerEl.textContent = `${label} ends the Hunt.`;
      }

      overlay.classList.add('visible');
    }

    console.log(`Game Over: ${label} wins`);
  });
}


// ---------- Intro rules block ----------
function buildIntroRulesHtml(){
  return `
  <div class="intro-block">
    <h2>Welcome to <span class="brand-inline">THE HUNT v5</span></h2>
    <p>
      This is a fast, 2-player deck-duel. Build Hunters, manage Supply, and
      claim the most 💰 <strong>Tender</strong> by defeating Monsters.
    </p>

    <h3>Start of each turn</h3>
    <ul>
      <li>At the start of <strong>every turn</strong>, all cards in your 🤲 <strong>HAND</strong> are discarded to your 📂 <strong>BACKLOG</strong>.</li>
      <li>You then draw a <strong>new hand</strong> from your 📦 <strong>STOCK</strong> up to your hand limit.</li>
      <li>If your stock runs out while drawing, your backlog is 🔀 <strong>shuffled</strong> and becomes your new stock, and drawing continues.</li>
      <li>Any Monsters drawn may be placed straight onto your 🧩 <strong>ROSTER</strong>; the remaining cards stay in your hand.</li>
      <li>You play your entire turn using <strong>only</strong> this fresh hand and your current roster – no extra draws mid-turn.</li>
    </ul>

    <h3>How your turn works</h3>
    <ul>
      <li>There are <strong>no fixed phases</strong> – you may use any actions in any order.</li>
      <li>Select cards in your 🤲 <strong>HAND</strong> and/or 🧩 <strong>ROSTER</strong>.</li>
      <li>Any valid actions for that selection will cause their buttons to <strong>light up</strong>.</li>
      <li>Click a lit button to perform that action.</li>
      <li>When you’re done, click <strong>“I’m done”</strong> to end your turn and pass play to your opponent.</li>
    </ul>

    <h3>Core actions</h3>
    <ul>
      <li><strong>Hunt</strong> – Spend Hunters from your hand to defeat a Monster on your roster or on the opponent's). Gain its 💰 Tender when you hunt your own Monster; Hunters go to your backlog, the Monster is 🔥 burned.</li>
      <li><strong>Trade</strong> – Spend Supply from your hand to recruit a Hunter from your roster into your backlog (respecting their cost).</li>
      <li><strong>Resupply</strong> – Move Supply from your roster back to your backlog.</li>
      <li><strong>Cull</strong> – 🔥 Burn a single unwanted card from your hand.</li>
    </ul>

    <h3>Reading the board</h3>
    <ul>
      <li><strong>Deck</strong> → where new cards are drawn from at the start of the game.</li>
      <li><strong>Stock</strong> → your active 📦 draw pile.</li>
      <li><strong>Roster</strong> → Monsters, Hunters and new Supply “on the board”.</li>
      <li><strong>Backlog</strong> → 📂 discard pile that is reshuffled back into your stock when needed.</li>
      <li><strong>Burn</strong> → 🔥 cards removed from the game.</li>
    </ul>

    <p class="intro-tip">
      When you’re ready, click <strong>START NEW GAME</strong> above to deal decks and begin <strong>The Hunt!</strong>
    </p>
  </div>`;
}


// ---------- Boot sequence ----------
async function boot() {
  // 1) Initialise a clean but EMPTY state (no decks dealt yet)
  newGameState();

  // 2) Wire UI + events
  wireButtons();
  wireEvents();

  // 3) Initial paint + neutral button state
  render?.();
  refreshButtons();

  // 4) Show rules / intro in the log, but do NOT start a game yet
  const beginnerBox = document.getElementById('beginner-mode');
  const showIntro = !beginnerBox || beginnerBox.checked;

  if (showIntro){
    log(buildIntroRulesHtml());
  } else {
    log("<p class='sys'>Click <strong>START NEW GAME</strong> to begin The Hunt v5.</p>");
  }

  // Overlay button wiring
  const playAgainBtn   = $('btn-play-again');
  const closeOverlayBtn = $('btn-close-overlay');
  const overlay        = $('game-over-overlay');

  if (playAgainBtn){
    playAgainBtn.addEventListener('click', async ()=>{
      overlay?.classList.remove('visible');
      await startNewGame();
    });
  }

  if (closeOverlayBtn){
    closeOverlayBtn.addEventListener('click', ()=>{
      overlay?.classList.remove('visible');
    });
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', ()=>{
  boot();
});

// ---------- New game entry point ----------
export async function startNewGame(){

  playSfx('newgame');

  // wipe & re-init base state
  document.querySelector('#log').innerHTML = '';
  newGameState();

  // call your setup routine if present (V5 first, then fallbacks)
  if (typeof window.setupV5 === 'function'){
    await window.setupV5();
  } else if (typeof window.setupGame === 'function'){
    await window.setupGame();
  } else if (typeof window.initGame === 'function'){
    await window.initGame();
  } else {
    console.warn('[The Hunt] No setup routine found. Define window.setupV5() to build decks & deal.');
  }

  // initial paint
  render?.();
  // force buttons to re-evaluate (in case nothing emitted yet)
  window.dispatchEvent(new CustomEvent('selectionChanged'));
  window.dispatchEvent(new CustomEvent('stateChanged'));
}
