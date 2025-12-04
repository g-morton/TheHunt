// js/logic/constraints.js
import { traitsOf } from './traits.js';

// Normalise classes on a card to a lowercased array
export function getClasses(card){
  if (!card) return [];
  // Accept: class: "pediteer" | ["pediteer", "lahzar"] | c: "pediteer"
  const raw =
    (Array.isArray(card.class) ? card.class :
     typeof card.class === 'string' ? [card.class] :
     typeof card.c === 'string' ? [card.c] : []);
  return raw.map(s => String(s).trim().toLowerCase()).filter(Boolean);
}

// Validate "minimumGroupSize" constraints for a set of attacking hunters
// hunters: array of { card } or Card
// Returns { ok: boolean, errors: string[] }
export function validateMinimumGroupSize(hunters){
  const errors = [];
  const group = (hunters || []).map(h => h?.card || h).filter(Boolean);

  if (!group.length) return { ok:false, errors:['No hunters selected.'] };

  // Collect constraints per class (combine duplicates by taking the MAX minsize)
  const constraints = new Map(); // class -> { min: number, examples: Set<labels> }
  for (const card of group){
    for (const tr of traitsOf(card)){
      if (tr.mechanic !== 'minimumGroupSize') continue;
      const cls = String(tr?.params?.class || '').toLowerCase().trim();
      const min = Number.isFinite(tr?.params?.minsize) ? tr.params.minsize : 2;
      if (!cls) continue;
      const prev = constraints.get(cls) || { min: 0, examples: new Set() };
      prev.min = Math.max(prev.min, min);
      if (tr.label) prev.examples.add(tr.label);
      constraints.set(cls, prev);
    }
  }

  if (!constraints.size) return { ok:true, errors }; // no constraints to enforce

  // Count class membership in the group
    const counts = new Map(); // class -> count
    for (const card of group){
    const explicit = new Set(getClasses(card)); // from card.class / card.c

    // Infer classes from any minimumGroupSize trait on this card
    for (const tr of traitsOf(card)){
        if (tr.mechanic !== 'minimumGroupSize') continue;
        const cls = String(tr?.params?.class || '').toLowerCase().trim();
        if (cls) explicit.add(cls);
    }

    for (const cls of explicit){
        counts.set(cls, (counts.get(cls) || 0) + 1);
    }
    }

  // Enforce: if ANY member of class <cls> is present, then count(cls) >= min
  for (const [cls, { min, examples }] of constraints){
    const present = counts.get(cls) || 0;
    if (present > 0 && present < min){
      const name = cls[0].toUpperCase() + cls.slice(1);
      const via = examples.size ? ` (via ${Array.from(examples).join(', ')})` : '';
      errors.push(`${name} require at least ${min} ${name}${min===1?'':'s'} to hunt; you have ${present}.${via}`);
    }
  }

  console.debug('[minGroup] constraints', Array.from(constraints.entries()));

  return { ok: errors.length === 0, errors };
}



export function validateCannotHuntWith(hunters){
  const errors = [];
  const group = (hunters || []).map(h => h?.card || h).filter(Boolean);
  if (!group.length) return { ok:false, errors:['No hunters selected.'] };

  // Build a quick lookup of classes for each card
  const classesFor = new Map(); // card -> Set(classes)
  for (const card of group){
    const set = new Set(getClasses(card)); // explicit classes
    // If you also want to infer classes from traits (e.g., minimumGroupSize),
    // you can mirror what we did in the minGroup validator:
    for (const tr of traitsOf(card)){
      if (tr.mechanic === 'minimumGroupSize'){
        const cls = String(tr?.params?.class || '').toLowerCase().trim();
        if (cls) set.add(cls);
      }
    }
    classesFor.set(card, set);
  }

  // For each card that has a cannotHuntWith trait, check the rest of the group
  for (const card of group){
    const myTraits = traitsOf(card).filter(t => t.mechanic === 'cannotHuntWith');
    if (!myTraits.length) continue;

    for (const tr of myTraits){
      const forbidden = String(tr?.params?.class || '').toLowerCase().trim();
      if (!forbidden) continue;

      for (const other of group){
        if (other === card) continue;
        const otherClasses = classesFor.get(other) || new Set();
        if (otherClasses.has(forbidden)){
          const forbiddenName = forbidden[0]?.toUpperCase() + forbidden.slice(1);
          const who = card.name ? `“${card.name}”` : 'This hunter';
          errors.push(`${who} cannot hunt with ${forbiddenName}${forbiddenName.endsWith('s')?'':'s'}.`);
          // We can break after the first conflict per trait; remove break for all pairs
          break;
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}