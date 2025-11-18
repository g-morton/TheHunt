// js/ui/foil.js
//
// Pure UI helper for FOIL prompts.
// Usage:
//   showFoilPrompt({ monsterName, monsterPower, attackHunters }, cb)

let foilOverlay;
let foilMonsterNameEl;
let foilMonsterPowerEl;
let foilAttackersLineEl;
let foilConfirmBtn;
let foilPassBtn;

let currentContext = null;
let currentCallback = null;

function lazyInit(){
  if (foilOverlay) return;

  foilOverlay        = document.getElementById('foil-overlay');
  foilMonsterNameEl  = document.getElementById('foil-monster-name');
  foilMonsterPowerEl = document.getElementById('foil-monster-power');
  foilAttackersLineEl= document.getElementById('foil-attackers-line');
  foilConfirmBtn     = document.getElementById('foil-confirm');
  foilPassBtn        = document.getElementById('foil-pass');

  if (!foilOverlay){
    console.warn('[FOIL UI] #foil-overlay not found in DOM.');
    return;
  }

  foilConfirmBtn?.addEventListener('click', () => {
    resolveFoil('foil');
  });

  foilPassBtn?.addEventListener('click', () => {
    resolveFoil('pass');
  });
}

function resolveFoil(decision){
  if (!foilOverlay) return;

  foilOverlay.classList.add('foil-hidden');

  const cb  = currentCallback;
  const ctx = currentContext;

  currentCallback = null;
  currentContext  = null;

  if (typeof cb === 'function'){
    cb({ decision, context: ctx });
  }
}

/**
 * Show the FOIL prompt.
 *
 * @param {Object} ctx - Context about the incoming Hunt:
 *   {
 *     monsterName: string,
 *     monsterPower: number,
 *     attackHunters: [{ name, power }, ...]
 *   }
 * @param {Function} callback - Called with { decision: 'foil' | 'pass', context }
 */
export function showFoilPrompt(ctx, callback){
  lazyInit();
  if (!foilOverlay) return;

  currentContext  = ctx || {};
  currentCallback = callback || null;

  const {
    monsterName   = 'Unknown Monster',
    monsterPower  = '?',
    attackHunters = []
  } = ctx || {};

  if (foilMonsterNameEl){
    foilMonsterNameEl.textContent = monsterName;
  }
  if (foilMonsterPowerEl){
    foilMonsterPowerEl.textContent = `P${monsterPower}`;
  }

  if (foilAttackersLineEl){
    if (attackHunters && attackHunters.length){
      const parts = attackHunters.map(h => {
        const name  = h.name || 'Hunter';
        const power = (h.power != null ? h.power : '?');
        return `${name} (F${power})`;
      });
      foilAttackersLineEl.textContent =
        `Opponent is attacking with: ${parts.join(', ')}`;
    } else {
      foilAttackersLineEl.textContent = '';
    }
  }

  foilOverlay.classList.remove('foil-hidden');
}

/**
 * Hide the FOIL prompt without making a decision.
 */
export function hideFoilPrompt(){
  lazyInit();
  if (!foilOverlay) return;

  foilOverlay.classList.add('foil-hidden');
  currentCallback = null;
  currentContext  = null;
}
