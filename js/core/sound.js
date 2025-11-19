// js/core/sound.js
// Simple SFX manager for THE HUNT

const SFX_BASE = './sounds/';

const SFX_FILES = {
  newgame:       'newgame.mp3',
  endgameWin:    'endgame-win.mp3',
  endgameLose:   'endgame-lose.mp3',
  huntStart:     'hunt-start.mp3',
  huntWin:       'hunt-win.mp3',
  huntFoiled:    'hunt-foiled.mp3',
  cardPlaced:    'card-placed.mp3',
  cardShuffle:   'card-shuffle.mp3',
  cardSelection: 'card-selection.mp3'
};

const sounds = {};
let muted = false;

function makeAudio(file){
  const a = new Audio(SFX_BASE + file);
  a.preload = 'auto';
  return a;
}

// Preload
for (const [name, file] of Object.entries(SFX_FILES)){
  sounds[name] = makeAudio(file);
}

export function playSfx(name){
  if (muted) return;
  const audio = sounds[name];
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play();
  } catch (e){
    // ignore autoplay / race issues
  }
}

export function setSfxMuted(flag){
  muted = !!flag;
}

// Optional: expose for quick console testing
if (typeof window !== 'undefined'){
  window.playSfx = playSfx;
}
