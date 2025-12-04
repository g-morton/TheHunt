// js/ui/inspector.js
import { SIDES } from '../core/state.js';
import { traitsOf, isPassive, isActive } from '../logic/traits.js';
import { getParam } from '../logic/traits.js';
import { countSupplyInHand } from '../logic/supply.js';
import { isArmed, toggleArmed } from '../logic/trait-arming.js';
import { getClasses } from '../logic/constraints.js';

// Root getter
function inspectorRoot(){
  return document.getElementById('card-inspector');
}

export function clearInspector(){
  const root = inspectorRoot();
  if (!root) return;
  root.classList.add('empty');
  root.innerHTML = `
            <p class="inspector-hint">
              Select a hunter card in your hand to see its details and traits.
              Some traits are passive, others require activation and/or have a supply cost.
              <br /><br />
              Activating a trait with a cost will automatically consume all the required supply from you hand.
            </p>
  `;
}

// Main render
export function renderInspector(card, origin = { side: SIDES.YOU }){
  const root = inspectorRoot();
  if (!root) return;

  if (!card){
    clearInspector();
    return;
  }

  root.classList.remove('empty');
  root.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'inspector-header';
  header.innerHTML = `
    <div class="inspector-name">${card.name ?? 'Unknown card'}</div>
    <div class="inspector-sub">${String(card.t || '').toUpperCase()} · ${origin.side === SIDES.CPU ? 'CPU card' : 'Your card'}</div>
  `;
  root.appendChild(header);

  // Stats row
  const stats = document.createElement('div');
  stats.className = 'inspector-stats';

  // Class pill(s)
  const classes = getClasses(card);
  if (classes.length){
    stats.appendChild(pill(`Class: ${classes.map(cap).join(', ')}`));
  }

  if (card.power != null){
    stats.appendChild(pill(`Power: ${card.power}`));
  }
  if (card.foil){
    stats.appendChild(pill(`Foil: ${card.foil}`));
  }
  if (card.tender != null){
    stats.appendChild(pill(`Tender: ${card.tender}`));
  }
  if (card.requires && typeof card.requires === 'object'){
    const req = Object.entries(card.requires)
      .filter(([,v]) => v)
      .map(([k,v]) => `${v} ${k === 'any' ? 'Any' : cap(k)}`)
      .join(' · ');
    if (req) stats.appendChild(pill(`Requires: ${req}`));
  }
  if (stats.childNodes.length) root.appendChild(stats);

  // Traits block
  const traitsBlock = document.createElement('div');
  traitsBlock.className = 'inspector-traits';

  const traits = traitsOf(card);
  if (!traits.length){
    const p = document.createElement('div');
    p.className = 'inspector-trait';
    p.textContent = 'No special traits.';
    traitsBlock.appendChild(p);
  } else {
    for (const tr of traits){
      traitsBlock.appendChild(renderTraitRow(card, tr, origin));
    }
  }
  root.appendChild(traitsBlock);

  // Actions area (left blank for now – per-trait buttons are inline)
  const actions = document.createElement('div');
  actions.className = 'inspector-actions';
  root.appendChild(actions);
}

// One trait line with optional Activate button
function renderTraitRow(card, trait, origin){
  const row = document.createElement('div');
  row.className = 'inspector-trait';

  const label = document.createElement('div');
  label.className = 'inspector-trait-label';
  label.textContent = `${trait.label || cap(trait.mechanic)}`;
  row.appendChild(label);

  const text = document.createElement('div');
  text.textContent = trait.description || defaultDescription(trait);
  row.appendChild(text);

  // Active mechanics get a button
  if (origin.side === SIDES.YOU && isActive(trait.mechanic)){
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.style.float = 'right';
    btn.style.margin = '5px';

    // Determine if we can activate right now (supply in hand)
    const tag = trait.params?.supply ? String(trait.params.supply).toLowerCase() : null;
    const have = countSupplyInHand(SIDES.YOU, tag);
    const armed = isArmed(card, trait);
    btn.textContent = armed ? 'Armed' : 'Activate';
    btn.disabled = !have && !armed;   // allow un-arm even if no supply now
    if (!have && !armed){
      btn.title = tag ? `Need ${cap(tag)} in hand` : 'Need matching Supply in hand';
    }

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const nowArmed = toggleArmed(card, trait);
      btn.textContent = nowArmed ? 'Armed' : 'Activate';

      // Optional: subtle visual hint on arm
      row.style.opacity = nowArmed ? '1' : '';
      // You can also log here if you want
      // log(`<p class="you">Armed ${trait.label || trait.mechanic}.</p>`);
    });

    row.appendChild(btn);
  }

  return row;
}

// Small pill helper
function pill(txt){
  const d = document.createElement('div');
  d.className = 'inspector-stat-pill';
  d.textContent = txt;
  return d;
}

// Fallback copy if description is omitted
function defaultDescription(tr){
  switch (tr.mechanic){
    case 'sap':        return `On Hunt start, opponent discards ${getParam(tr,'x',1)} random card(s) to backlog.`;
    case 'boostPower': return `Spend ${cap(tr.params?.supply||'Supply')} from your hand for +1 Power each.`;
    case 'boostFoil':  return `Spend ${cap(tr.params?.supply||'Supply')} from your hand for +1 Foil each.`;
    case 'regimented': return `Cannot Hunt alone; must attack with another Hunter.`;
    default:           return `Special effect.`;
  }
}

function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
