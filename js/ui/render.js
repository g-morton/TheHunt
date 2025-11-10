// js/ui/render.js
import { State } from '../core/state.js';
import { TYPES } from '../data.js';
import { setPhaseButtons } from './controls.js';
import { updateHuntReadiness } from '../logic/hunt.js';

function byId(id){ return document.getElementById(id); }

export function render(){
  // turn pill
  const pill = byId('turn-pill');
  if (pill){
    pill.textContent = State.turn === 'you' ? 'YOUR TURN' : 'CPU TURN';
    pill.classList.toggle('cpu', State.turn === 'cpu');
  }

  // piles
  renderPile('player-deck',    State.you.deck,    true);
  renderPile('player-stock', State.you.stock, true);
  renderPile('player-backlog', State.you.backlog, false);
  renderPile('player-burn',    State.you.burn,    false);

  renderPile('cpu-deck', State.cpu.deck, true);
  renderPile('cpu-burn', State.cpu.burn, false);
  renderPile('cpu-stock', State.cpu.stock, true);
  renderPile('cpu-backlog', State.cpu.backlog, false);

  // rosters
  renderRoster('player-roster', State.you.roster, 'you');
  renderRoster('cpu-roster',    State.cpu.roster, 'cpu');

  // hands
  renderHand('player-hand', State.you.hand);
  //renderHand('cpu-hand',    State.cpu.hand);
  renderCpuHand('cpu-hand', State.cpu.hand);

  // scores / tender
  const youT = byId('tender-you');
  const cpuT = byId('tender-cpu');
  if (youT) youT.textContent = String(State.you.tender || 0);
  if (cpuT) cpuT.textContent = String(State.cpu.tender || 0);
}

function renderPile(rootId, pile, faceDown){
  const root = byId(rootId);
  if (!root) return;
  root.innerHTML = '';

  const count = Array.isArray(pile) ? pile.length : 0;
  if (count === 0){
    const empty = document.createElement('div');
    empty.className = 'pile-empty';
    empty.textContent = 'Empty';
    root.appendChild(empty);
    return;
  }
  if (faceDown){
    const back = document.createElement('div');
    back.className = 'card-back';
    root.appendChild(back);
  } else {
    const top = pile[pile.length - 1];
    root.insertAdjacentHTML('beforeend', cardEl(top));
  }
  const badge = document.createElement('div');
  badge.className = 'count-badge';
  badge.textContent = String(count).toUpperCase();
  root.appendChild(badge);
}

export function renderRoster(rootId, stacks, side){
  const root = document.getElementById(rootId);
  if (!root) return;
  root.innerHTML = '';

  // make sure the set exists
  State.sel.tradeHunters ??= new Set();

  (stacks || []).forEach((stack, i) => {
    const slot = document.createElement('div');
    slot.className = 'stack';

    const top   = stack && stack.length ? stack[stack.length - 1] : null;
    const count = stack ? stack.length : 0;

    // render the top card, if any
    let cardNodeEl = null;
    if (top) {
      cardNodeEl = cardNode(top);
      slot.appendChild(cardNodeEl);
    }

    // stack count badge
    const badge = document.createElement('div');
    badge.className = 'stack-count badge';
    badge.textContent = `${count} card${count === 1 ? '' : 's'}`;
    slot.appendChild(badge);

    // classify top card
    const isMonster = !!top && (
      (top.t && String(top.t).toLowerCase() === 'monster') ||
      (top.power != null && top.tender != null)
    );
    const isHunter = !!top && top.t && String(top.t).toLowerCase() === 'hunter';
    const isSupply = !!top && top.t && String(top.t).toLowerCase() === 'supply';

    const huntSelectable =
      (State.turn === 'you' && State.phase === 'hunt' && isMonster);

    const tradeSelectable =
      (State.turn === 'you' && State.phase === 'trade' && side === 'you' && isHunter);

    const restockSelectable =
      (State.turn === 'you' && State.phase === 'restock' && side === 'you' && isSupply);

    if (huntSelectable || tradeSelectable || restockSelectable){
      slot.style.cursor = 'pointer';
      if (cardNodeEl) cardNodeEl.style.cursor = 'pointer';
    }

    // apply selected styling
    // hunt selected monster
    if (State.sel.monster &&
        State.sel.monster.side === side &&
        State.sel.monster.idx === i){
      if (cardNodeEl) cardNodeEl.classList.add('selected');
    }
    // trade: multiple hunters in player's roster
    if (side === 'you' && State.sel.tradeHunters.has(i)){
      if (cardNodeEl) cardNodeEl.classList.add('selected');
    }
    // restock: single supply in player's roster
    if (side === 'you' && State.sel.restock &&
        State.sel.restock.side === side &&
        State.sel.restock.idx === i){
      if (cardNodeEl) cardNodeEl.classList.add('selected');
    }

    // click handler
    slot.addEventListener('click', () => {
      // re-evaluate live top (in case of re-render data)
      const liveStack = stacks?.[i] || [];
      const liveTop   = liveStack.length ? liveStack[liveStack.length - 1] : null;
      const liveIsMonster = !!liveTop && (
        (liveTop.t && String(liveTop.t).toLowerCase() === 'monster') ||
        (liveTop.power != null && liveTop.tender != null)
      );
      const liveIsHunter = !!liveTop && liveTop.t && String(liveTop.t).toLowerCase() === 'hunter';
      const liveIsSupply = !!liveTop && liveTop.t && String(liveTop.t).toLowerCase() === 'supply';

      // HUNT
      if (State.turn === 'you' && State.phase === 'hunt' && liveIsMonster){
        const was = State.sel.monster;
        if (was && was.side === side && was.idx === i){
          State.sel.monster = null;
        } else {
          State.sel.monster = { side, idx: i };
        }
        updateHuntReadiness();
        render();
        setPhaseButtons();
        return;
      }

      // TRADE
      if (State.turn === 'you' && State.phase === 'trade' && side === 'you' && liveIsHunter){
        if (State.sel.tradeHunters.has(i)) {
          State.sel.tradeHunters.delete(i);
        } else {
          State.sel.tradeHunters.add(i);
        }
        render();
        setPhaseButtons();
        return;
      }

      // RESTOCK
      if (State.turn === 'you' && State.phase === 'restock' && side === 'you' && liveIsSupply){
        const was = State.sel.restock;
        if (was && was.side === side && was.idx === i){
          State.sel.restock = null;
        } else {
          State.sel.restock = { side, idx: i };
        }
        render();
        setPhaseButtons();
        return;
      }
    });

    root.appendChild(slot);
  });
}

export function renderHand(rootId, cards){
  const root = byId(rootId);
  if (!root) return;
  root.innerHTML = '';

  const isHuntSel    = (State.turn === 'you' && State.phase === 'hunt');
  const isTradeSel   = (State.turn === 'you' && State.phase === 'trade');
  const isbacklogSel = (State.turn === 'you' && State.phase === 'backlog');
  const isRefreshSel = (State.turn === 'you' && State.phase === 'refresh');

  State.sel.hunters ??= new Set();
  State.sel.tradeSupply ??= new Set();
  State.selectedTobacklog ??= new Set();

  (cards || []).forEach((c, i)=>{
    const node = cardNode(c);
    node.dataset.handIndex = i;

    //c.traits: Array.isArray(c.traits) ? c.traits.map(t => t.toLowerCase()) : [],

    if (isHuntSel && c.t === TYPES.HUNTER){
      node.style.cursor = 'pointer';
      if (State.sel.hunters.has(c)) node.classList.add('selected');
      node.addEventListener('click', ()=>{
        if (State.sel.hunters.has(c)) State.sel.hunters.delete(c);
        else State.sel.hunters.add(c);
        updateHuntReadiness();
        render();
        setPhaseButtons();
      });
    }

    if (isTradeSel && c.t === TYPES.SUPPLY){
      node.style.cursor = 'pointer';
      if (State.sel.tradeSupply.has(c)) node.classList.add('selected');
      node.addEventListener('click', ()=>{
        if (State.sel.tradeSupply.has(c)) State.sel.tradeSupply.delete(c);
        else State.sel.tradeSupply.add(c);
        render();
        setPhaseButtons();
      });
    }

    if (isbacklogSel){
      node.style.cursor = 'pointer';
      if (State.selectedTobacklog.has(c)) node.classList.add('selected');
      node.addEventListener('click', ()=>{
        if (State.selectedTobacklog.has(c)) State.selectedTobacklog.delete(c);
        else State.selectedTobacklog.add(c);
        render();
        setPhaseButtons && setPhaseButtons();
      });
    }

    if (isRefreshSel){
      // nothing special for now
    }

    root.appendChild(node);
  });
}


export function renderCpuHand(rootId, cards) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const count = Array.isArray(cards) ? cards.length : 0;
  root.innerHTML = '';

  if (count === 0) {
    return;
  }

  // show up to 7 backs so it doesn't get too wide
  const maxVisible = Math.min(count, 7);
  for (let i = 0; i < maxVisible; i++) {
    const back = document.createElement('div');
    back.className = 'cpu-card-back';
    root.appendChild(back);
  }

  // badge with actual count
  /*
  const badge = document.createElement('div');
  badge.className = 'cpu-hand-badge';
  badge.textContent = count;
  root.appendChild(badge);
  */
}

// --- centralised card rendering -----------------------------------------

function buildCardElement(c) {
  const node = document.createElement('div');
  node.className = 'card';

  // tint
  if (c.t === TYPES.HUNTER) node.classList.add('card--hunter');
  else if (c.t === TYPES.MONSTER) node.classList.add('card--monster');
  else if (c.t === TYPES.SUPPLY) node.classList.add('card--supply');

  // background
  let bg = '';
  if (c.img) {
    bg = `url('./images/${c.img}')`;
  } else {
    if (c.t === TYPES.HUNTER) bg = "url('./images/hunter.jpg')";
    else if (c.t === TYPES.MONSTER) bg = "url('./images/monster.jpg')";
    else if (c.t === TYPES.SUPPLY) bg = "url('./images/supply.jpg')";
  }
  if (bg) {
    node.style.backgroundImage = bg;
    node.style.backgroundSize = 'cover';
    node.style.backgroundPosition = 'center';
  }

  // meta
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const type = document.createElement('div');
  type.className = 'card-type';
  type.textContent = c.t;
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = c.name;
  meta.appendChild(title);
  meta.appendChild(type);


  // stats
  const stats = document.createElement('div');
  stats.className = 'card-stats';

  const reqText = formatRequires(c);
  if (reqText) {
    const r = document.createElement('div');
    r.className = 'card-req';
    r.textContent = reqText;
    stats.appendChild(r);
  }

  if (c.power != null) {
    const p = document.createElement('div');
    p.className = 'card-stat power';
    p.textContent = `${c.power}⚡`;
    stats.appendChild(p);
  }
  if (c.foil != null) {
    const f = document.createElement('div');
    f.className = 'card-stat foil';
    f.textContent = `${c.foil}❌`;
    stats.appendChild(f);
  }
  if (c.tender != null) {
    const t = document.createElement('div');
    t.className = 'card-stat tender';
    t.textContent = `${c.tender}🥇`;
    stats.appendChild(t);
  }



  node.appendChild(meta);
  node.appendChild(stats);

  return node;
}

export function cardNode(c) {
  return buildCardElement(c);
}

export function cardEl(c) {
  return buildCardElement(c).outerHTML;
}

function formatRequires(c) {
  const r = c.requires;
  // new / object shape
  if (r && typeof r === 'object') {
    // normalise keys to lowercase
    const norm = {};
    for (const [k, v] of Object.entries(r)) {
      norm[k.toLowerCase()] = v;
    }

    const parts = [];
    if (norm.any)     parts.push(`${norm.any}x ANY`);
    if (norm.kit)     parts.push(`${norm.kit}x KIT`);
    if (norm.script)  parts.push(`${norm.script}x SCRIPT`);
    if (norm.treacle) parts.push(`${norm.treacle}x TREACLE`);

    return parts.join(' + ');
  }

  // legacy array shape: ["KIT","SCRIPT"]
  if (Array.isArray(c.req) && c.req.length) {
    return c.req.join(' + ');
  }

  return '';
}
