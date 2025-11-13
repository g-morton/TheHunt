// js/ui/render.js

import { State, SIDES, GAME } from '../core/state.js';

function $(id){ return document.getElementById(id); }
function el(tag, cls){ const n = document.createElement(tag); if (cls) n.className = cls; return n; }

// --------- selection toggles ---------
function toggleSelectHand(idx){
  if (State.turn !== SIDES.YOU) return;
  if (State.sel.hand.has(idx)) State.sel.hand.delete(idx);
  else State.sel.hand.add(idx);
  window.dispatchEvent(new CustomEvent('selectionChanged'));
}

function toggleSelectRoster(idx){
  if (State.turn !== SIDES.YOU) return;
  if (State.sel.roster.has(idx)) State.sel.roster.delete(idx);
  else State.sel.roster.add(idx);
  window.dispatchEvent(new CustomEvent('selectionChanged'));
}

export function updateSelectionHighlights(){
  // Hand: indices stored in State.sel.hand (Set of numbers)
  const handKids = document.querySelectorAll('#hand .card');
  handKids.forEach((el, i)=>{
    el.classList.toggle('selected', State.sel.hand.has(i));
  });

  // Roster: slots & their top card
  const rosterSlots = document.querySelectorAll('#roster .stack');
  rosterSlots.forEach((slotEl, i)=>{
    const selected = State.sel.roster.has(i);
    slotEl.classList.toggle('selected', selected);

    const face = slotEl.querySelector('.card');  // top card in stack
    if (face) {
      face.classList.toggle('selected', selected);
    }
  });
}

function renderPile(rootId, cards, faceDown = false) {
  const root = document.getElementById(rootId);
  if (!root) return;
  root.innerHTML = '';
  const top = cards[cards.length - 1] || null;
  let face;
  if (faceDown) {
    // render card back
    face = document.createElement('div');
    face.className = 'card card-back pile-top';
  } else {
    // render real card
    face = renderCard(top);
    face.classList.add('pile-top');
  }
  root.appendChild(face);
  // count badge
  const count = document.createElement('div');
  count.className = 'pile-count';
  count.textContent = cards.length;
  root.appendChild(count);
}

// --------- Image helper (background-based) ---------
const IMG_EXTS = ['jpg','png','webp'];
const IMG_BASE = './images/';

function slugify(s){
  return String(s || 'unknown')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

// Preload image, then apply as background-image
function applyCardBackground(cardEl, card){
  if (!card || !card.img){
    cardEl.style.backgroundImage = `url("${IMG_BASE}unknown.jpg")`;
    return;
  }

  const url = `${IMG_BASE}${card.img}`;
  const img = new Image();

  img.onload = () => {
    cardEl.style.backgroundImage = `url("${url}")`;
    cardEl.dataset.img = url;
  };

  img.onerror = () => {
    // fallback if image cannot be found
    cardEl.style.backgroundImage = `url("${IMG_BASE}unknown.jpg")`;
  };

  img.decoding = 'async';
  img.fetchPriority = 'low';
  img.src = url;
}

// Build overlay blocks using your existing CSS
function buildOverlay(card){
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.innerHTML = `
    <div class="card-type">${card.t ?? ''}</div>
    <div class="card-title">${card.name ?? ''}</div>
  `;

  const stats = document.createElement('div');
  stats.className = 'card-stats';

  // ---------------------------
  // Power
  // ---------------------------
  if (card.power != null){
    const s = document.createElement('div');
    s.className = 'card-stat';
    s.textContent = `⚡ ${card.power}`;
    stats.appendChild(s);
  }

  // ---------------------------
  // Tender / Reward
  // ---------------------------
  if (card.tender != null){
    const s = document.createElement('div');
    s.className = 'card-stat';
    s.textContent = `💰 ${card.tender}`;
    stats.appendChild(s);
  }

  // ---------------------------
  // Foil badge (only for Hunters)
  // card.foil === number
  // ---------------------------
  const isHunter = String(card.t || '').toLowerCase() === 'hunter';
  if (isHunter && card.foil != null){
    const s = document.createElement('div');
    s.className = 'card-stat card-foil';
    const count = card.foil > 1 ? ` ×${card.foil}` : '';
    s.textContent = `❌ ${count}`;
    stats.appendChild(s);
  }

  // ---------------------------
  // Supply requirements (card.requires)
  // { Kit: 1, Script: 2, Treacle: 1, any: 1 }
  // ---------------------------
  if (card.requires && typeof card.requires === 'object'){
    const SUPPLY_ICONS = {
      Kit: '🗡',
      Script: '📜',
      Treacle: '🧪',
      any: '❔'
    };

    const parts = [];
    for (const [type, amount] of Object.entries(card.requires)){
      if (!amount) continue;
      const icon = SUPPLY_ICONS[type] || '';
      const label = type === 'any' ? 'Any' : type;
      parts.push(`${icon ? icon + ' ' : ''}${amount} ${label}`);
    }

    if (parts.length){
      const req = document.createElement('div');
      req.className = 'card-req';
      req.textContent = `${parts.join(' · ')}`;
      stats.appendChild(req);
    }
  }

  return { meta, stats };
}


// --------- card rendering ---------
// We no longer expose a custom window.cardEl; renderCard is the single path.
function renderCard(card){
  if (!card){
    const empty = el('div','card empty');
    return empty;
  }

  const c = el('div', `card ${card.t || ''}`);
  // width/height driven by CSS custom props
  c.style.width  = 'var(--card-w)';
  c.style.height = 'var(--card-h)';

  // overlay
  const { meta, stats } = buildOverlay(card);
  c.appendChild(meta);
  c.appendChild(stats);

  // image as background
  applyCardBackground(c, card);

  return c;
}

// --------- sub-renders ---------
function renderHud(){
  const you = State.you;
  const cpu = State.cpu;

  // Turn pill text
  const pill = document.getElementById('turn-pill');
  if (pill){
    const isYouTurn = (State.turn === SIDES.YOU);
    pill.textContent = `${isYouTurn ? 'YOUR' : 'CPU'} TURN · Round ${State.turnCount}`;
  }

  // Tender tallies in the sidebar
  const tenderYouEl = document.getElementById('tender-you');
  if (tenderYouEl){
    tenderYouEl.textContent = you.tender ?? 0;
  }

  const tenderCpuEl = document.getElementById('tender-cpu');
  if (tenderCpuEl){
    tenderCpuEl.textContent = cpu.tender ?? 0;
  }
}

function renderRoster(){
  const root = $('roster');
  if (!root) return;

  const you = State.you;
  root.innerHTML = '';

  for (let i = 0; i < GAME.ROSTER_SLOTS; i++){
    const stack = you.roster[i] || [];
    const slot  = el('div', 'stack');

    const top = stack[stack.length - 1] || null;
    const face = top ? renderCard(top) : el('div','card empty');
    face.classList.add('face');

    const count = document.createElement('div');
    count.className = 'stack-count';
    count.textContent = `${stack.length} card${stack.length===1?'':'s'}`;

    slot.addEventListener('click', () => toggleSelectRoster(i));

    slot.appendChild(face);
    slot.appendChild(count);
    root.appendChild(slot);
  }
}

function renderHand(){
  const root = $('hand');
  if (!root) return;

  const hand = State.you.hand;
  root.innerHTML = '';

  hand.forEach((card, i) => {
    const node = renderCard(card);
    node.classList.add('hand-card');
    if (State.sel.hand.has(i)) node.classList.add('selected');

    node.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleSelectHand(i);
    });

    root.appendChild(node);
  });
}


function renderCpuRoster(){
  const root = $('cpu-roster');
  if (!root) return;

  const cpu = State.cpu;
  root.innerHTML = '';

  for (let i = 0; i < GAME.ROSTER_SLOTS; i++){
    const stack = cpu.roster[i] || [];
    const slot  = el('div', 'stack');

    // top card (CPU roster is visible, like yours)
    const top  = stack[stack.length - 1] || null;
    const face = renderCard(top);
    face.classList.add('face');

    // count badge
    const count = el('div', 'stack-count');
    count.textContent = `${stack.length} card${stack.length === 1 ? '' : 's'}`;

    // no selection / click for CPU
    slot.appendChild(face);
    slot.appendChild(count);
    root.appendChild(slot);
  }
}

function renderCpuHand() {
  const root = document.getElementById("cpu-hand");
  if (!root) return;

  root.innerHTML = '';

  const hand = State.cpu.hand;

  for (let i = 0; i < hand.length; i++) {
    const back = document.createElement('div');
    back.className = 'card card-back';
    root.appendChild(back);
  }
}

// --------- public render ---------
export function render(){
  const you = State.you;
  const cpu = State.cpu;

  renderHud();
  renderRoster();
  renderHand();

  // PLAYER PILES
  renderPile('player-deck',    you.deck,    true);
  renderPile('player-stock',   you.stock,   true);
  renderPile('player-backlog', you.backlog);
  renderPile('player-burn',    you.burn);

  // CPU PILES
  renderPile('cpu-deck',    cpu.deck,     true);
  renderPile('cpu-stock',   cpu.stock,   true);
  renderPile('cpu-backlog', cpu.backlog);
  renderPile('cpu-burn',    cpu.burn);

  renderCpuRoster();
  renderCpuHand();
}
