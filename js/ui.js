// Utilidades de interface compartilhadas: escape, tempo, estrelas, janelas e telas.

export const $ = (id) => document.getElementById(id);

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatarTempo(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

export function estrelasHtml(n, total = 3) {
  let h = '';
  for (let i = 0; i < total; i++) h += i < n ? '★' : '<span class="estrela-off">★</span>';
  return h;
}

export function mostrarTela(nome) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  $(`screen-${nome}`).classList.add('active');
  document.querySelectorAll('#bottom-nav button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.screen === nome);
  });
}

// ---------- Janela (modal) ----------
let aoFechar = null;
let acoes = {};
let fecharNoFundo = true;

export function abrirModal(html, opcoes = {}) {
  const fundo = $('modal-fundo');
  const modal = $('modal');
  modal.innerHTML = html;
  acoes = opcoes.acoes || {};
  aoFechar = opcoes.aoFechar || null;
  fecharNoFundo = opcoes.fecharNoFundo !== false;
  fundo.classList.remove('hidden');
  modal.scrollTop = 0;
  setTimeout(() => {
    const alvo = modal.querySelector('[data-foco]') || modal.querySelector('button');
    if (alvo) alvo.focus({ preventScroll: true });
  }, 30);
}

export function fecharModal() {
  const fundo = $('modal-fundo');
  if (fundo.classList.contains('hidden')) return;
  fundo.classList.add('hidden');
  $('modal').innerHTML = '';
  const cb = aoFechar;
  aoFechar = null;
  acoes = {};
  if (cb) cb();
}

export function modalAberto() {
  return !$('modal-fundo').classList.contains('hidden');
}

export function iniciarModal() {
  const fundo = $('modal-fundo');
  fundo.addEventListener('click', (e) => {
    if (e.target === fundo && fecharNoFundo) {
      fecharModal();
      return;
    }
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const fn = acoes[btn.dataset.acao];
    if (fn) fn(btn);
    else if (btn.dataset.acao === 'fechar') fecharModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalAberto() && fecharNoFundo) fecharModal();
  });
}
