// js/core/log.js
const el = () => document.getElementById('log');

export function log(html){
  const p = document.createElement('div');
  p.className = 'log-line';
  p.innerHTML = html;
  const root = el();
  if (!root) return;
  root.appendChild(p);
  root.scrollTo({ top: root.scrollHeight, behavior: 'smooth' });
}

export function clearStepLog(){
  const root = el();
  if (!root) return;
  root.innerHTML = '';
}
