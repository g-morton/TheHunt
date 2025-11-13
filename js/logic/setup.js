// js/logic/setup.js
import { State, GAME, SIDES, newGameState } from '../core/state.js';
import { shuffle, isMonster } from './utils.js';
import { log } from '../core/log.js';

// --- top of file (after imports)
const L = (...args) => console.log('[The Hunt setup]', ...args);
const W = (...args) => console.warn('[The Hunt setup]', ...args);
const E = (...args) => console.error('[The Hunt setup]', ...args);

// --- fetch JSON relative to this file (no module imports)
async function loadJsonRel(moduleRelativePath) {
  const url = new URL(moduleRelativePath, import.meta.url);
  L('Fetching JSON', { rel: moduleRelativePath, url: url.href });
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (err) {
    E('Network/fetch error', err);
    throw err;
  }
  if (!res.ok) {
    E('HTTP error', res.status, res.statusText, 'for', url.href);
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  const json = await res.json();
  //L('Loaded JSON ok', { rel: moduleRelativePath, size: Array.isArray(json) ? json.length : Object.keys(json || {}).length });
  return json;
}

// --- case-insensitive lookups (names & ids)
function normalizeCard(c){
  const t = String(c?.t ?? '').toLowerCase();
  return { id: c?.id ?? `${t}_${Math.random().toString(36).slice(2,8)}`, name: c?.name ?? '(unnamed)', t,
           power: c?.power ?? null, tender: c?.tender ?? null, cost: c?.cost ?? null, ...c };
}
function buildLookup(cardsArr){
  //L('Building card lookup…', { count: cardsArr?.length });
  const byId = new Map(), byName = new Map(), byIdLc = new Map(), byNameLc = new Map();
  for (const raw of cardsArr){
    const card = normalizeCard(raw);
    if (card.id){ const id = String(card.id); byId.set(id, card); byIdLc.set(id.toLowerCase(), card); }
    if (card.name){ const nm = String(card.name); byName.set(nm, card); byNameLc.set(nm.toLowerCase(), card); }
  }
  //L('Lookup built', { byId: byId.size, byName: byName.size });
  return { byId, byName, byIdLc, byNameLc };
}

function resolveDeckEntries(entries, lookup){
  const out = [];
  //L('Resolving deck entries…', { entriesCount: entries?.length });
  for (const item of entries || []){
    if (typeof item === 'string'){
      const key = String(item), keyLc = key.toLowerCase();
      const found = lookup.byId.get(key) || lookup.byName.get(key) || lookup.byIdLc.get(keyLc) || lookup.byNameLc.get(keyLc);
      if (!found){ W('Missing card in cards.json:', item); continue; }
      out.push({ ...found });
    } else if (item && typeof item === 'object'){
      out.push(normalizeCard(item));
    } else {
      W('Skipping unknown deck entry:', item);
    }
  }
  //L('Deck resolved', { resolved: out.length });
  return out;
}

// --- dealing helpers
function dealToRoster(board, nSlots){
  //L('Deal to roster…', { nSlots, deckBefore: board.deck.length });
  for (let i=0;i<nSlots;i++){
    if (!board.deck.length) break;
    board.roster[i].push(board.deck.pop());
  }
  L('Roster dealt', {
    deckAfter: board.deck.length,
    rosterCounts: board.roster.map(s => s.length)
  });
}
function moveN(from,to,n){ const before = from.length; while(n-- > 0 && from.length) to.push(from.pop()); L('Moved N', { n: before - from.length }); }
function drawFromStockToHand(board,n){ const before = board.stock.length; while(n-- > 0 && board.stock.length) board.hand.push(board.stock.pop()); L('Drawn from stock', { drawn: before - board.stock.length }); }
function sweepMonstersFromHandToRoster(board){
  const start = board.hand.length;
  if (!start) return;
  let moved = 0;
  const keep = [];
  for (const c of board.hand){
    if ((c?.t||'').toLowerCase() === 'monster'){
      let target=0,best=board.roster[0].length;
      for (let i=1;i<board.roster.length;i++){ if (board.roster[i].length<best){best=board.roster[i].length;target=i;} }
      board.roster[target].push(c); moved++;

    log(`
      <p class="sys">
       ✨ ${c.name} moved to roster.
      </p>
    `);

    } else keep.push(c);
  }
  board.hand = keep;
  if (moved) L('Swept monsters from hand to roster', { moved });
}

function setupSideFromDeck(board, deck){
  //L('Setup side from deck', { deckLen: deck?.length });
  board.deck = Array.isArray(deck) ? deck.slice() : [];
  // basic shuffle
  for (let i=board.deck.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [board.deck[i],board.deck[j]]=[board.deck[j],board.deck[i]]; }
  dealToRoster(board, State?.GAME?.ROSTER_SLOTS || 5);
  moveN(board.deck, board.stock, 10);
  drawFromStockToHand(board, 5);
  sweepMonstersFromHandToRoster(board);
  L('Side ready', {
    deck: board.deck.length, stock: board.stock.length, hand: board.hand.length, backlog: board.backlog.length, burn: board.burn.length,
    roster: board.roster.map(s => s.length)
  });
}

// --- load cards & decks (explicit sides OR catalog)
async function loadCardsAndDecks(){
  const cards = await loadJsonRel('../../data/cards.json');
  const decks = await loadJsonRel('../../data/decks.json');
  //L('JSON loaded', { cardsType: Array.isArray(cards) ? 'array' : typeof cards, decksKeys: Object.keys(decks||{}).length });

  const lookup = buildLookup(Array.isArray(cards) ? cards : []);
  if (!lookup.byName.size && !lookup.byId.size) throw new Error('cards.json empty/invalid');

  const explicit = decks?.decks ? decks.decks : decks;
  if (explicit && Array.isArray(explicit.you) && Array.isArray(explicit.cpu)){
    //L('Using explicit decks.json {you,cpu}');
    const you = resolveDeckEntries(explicit.you, lookup);
    const cpu = resolveDeckEntries(explicit.cpu, lookup);
    if (!you.length || !cpu.length) throw new Error('Explicit decks resolved empty.');
    return { you, cpu };
  }

  const keys = Object.keys(decks || {});
  const looksCatalog = keys.length > 0 && keys.every(k => decks[k] && Array.isArray(decks[k].cards));
  if (looksCatalog){
    const a = Math.floor(Math.random()*keys.length);
    let b = Math.floor(Math.random()*keys.length);
    if (keys.length>1 && b===a) b = (b+1)%keys.length;
    const keyYou = keys[a], keyCpu = keys[b];
    //L('Catalog detected', { count: keys.length, keyYou, keyCpu });
    const deckYou = resolveDeckEntries(decks[keyYou].cards, lookup);
    const deckCpu = resolveDeckEntries(decks[keyCpu].cards, lookup);
    if (!deckYou.length || !deckCpu.length) throw new Error('Catalog pick resolved empty.');

    log(`
      <p class="sys turn-header">
        New game<br>
        Player deck: <strong>${decks[keyYou].name}</strong><br>
        CPU deck: <strong>${decks[keyCpu].name}</strong>
      </p>
    `);

    return { you: deckYou, cpu: deckCpu };
  }

  throw new Error('decks.json shape not recognized');
}

// --- Public entry
window.setupV5 = async function setupV5(){
  try{
    //L('setupV5 begin');
    if (!State.started) {
      //L('newGameState() was not called yet — calling defensively');
      // If your startNewGame already called this, harmless to call again.
      import('../core/state.js').then(m => m.newGameState?.());
    }

    const { you, cpu } = await loadCardsAndDecks();

    // hard reset piles
    for (const side of [State.you, State.cpu]){
      side.deck.length = side.stock.length = side.backlog.length = side.burn.length = side.hand.length = 0;
      side.roster = Array.from({length: 5}, () => []);
      side.tender = 0;
    }

    setupSideFromDeck(State.you, you);
    setupSideFromDeck(State.cpu, cpu);

    //L('setupV5 done → dispatch stateChanged');
    window.dispatchEvent(new CustomEvent('stateChanged'));
  } catch (err){
    E('setupV5 failed', err);
    throw err;
  }
};