// Orquestração: carrega os desafios, navega entre telas (via #hash, para o
// botão "voltar" do celular funcionar), desenha a tela inicial e os ajustes.

import * as M from './motor.js';
import * as estado from './estado.js';
import * as jogo from './jogo.js';
import { NIVEL } from './jogo.js';
import { $, esc, formatarTempo, estrelasHtml, mostrarTela, iniciarModal } from './ui.js';
import { VERSAO } from './versao.js';

const ORDEM_NIVEL = ['facil', 'medio', 'dificil'];

let DESAFIOS = []; // [{ d, P }]
let carregando = true;
let erroCarga = null;
let navegandoNoApp = false;
let atualizacaoPronta = false;

// ---------- Desafios ----------

async function carregarDesafios() {
  const r = await fetch('desafios/index.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`índice indisponível (${r.status})`);
  const { desafios } = await r.json();
  const itens = await Promise.all(
    desafios.map(async (arq) => {
      try {
        const rr = await fetch(`desafios/${arq}`, { cache: 'no-cache' });
        const d = await rr.json();
        return { d, P: M.compilar(d) };
      } catch (e) {
        console.error('Desafio inválido:', arq, e);
        return null;
      }
    }),
  );
  DESAFIOS = itens.filter(Boolean);
}

function acharDesafio(id) {
  return DESAFIOS.find((x) => x.d.id === id) || null;
}

function progressoValido(item, todos) {
  const p = todos[item.d.id];
  return p && p.v === (item.d.versao ?? 1) ? p : null;
}

function emAndamento(p) {
  return !!p && !p.resolvido && !p.revelado && !!p.iniciado && (p.tempo > 0 || (p.marcas && /[12]/.test(p.marcas)));
}

// Próximo desafio ainda não resolvido (na ordem da lista), para o botão "Próximo".
function proximoDesafio(idAtual) {
  const todos = estado.todosProgressos();
  const i = DESAFIOS.findIndex((x) => x.d.id === idAtual);
  for (let k = 1; k <= DESAFIOS.length; k++) {
    const item = DESAFIOS[(i + k) % DESAFIOS.length];
    if (item.d.id === idAtual) continue;
    const p = progressoValido(item, todos);
    if (!p || !p.resolvido) return item;
  }
  return null;
}

// ---------- Navegação ----------

function irPara(hash) {
  if (location.hash === hash) {
    rota(true);
    return;
  }
  navegandoNoApp = true;
  location.hash = hash;
}

function rota(doApp = false) {
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  const tela = partes[0] || '';
  if (tela === 'jogo' && partes[1]) {
    const item = acharDesafio(decodeURIComponent(partes[1]));
    if (item) {
      if (jogo.aberto() !== item.d.id) {
        if (jogo.aberto()) jogo.fechar();
        document.body.classList.add('em-jogo');
        mostrarTela('jogo');
        jogo.abrir(item, { voltarComBack: doApp });
      }
      return;
    }
    if (carregando) return; // ainda carregando: tenta de novo ao terminar
    location.replace('#/');
    return;
  }
  if (jogo.aberto()) jogo.fechar();
  document.body.classList.remove('em-jogo');
  const nome = tela === 'como' ? 'como' : tela === 'ajustes' ? 'config' : 'home';
  mostrarTela(nome);
  if (nome === 'home') renderHome();
  if (nome === 'config') renderAjustes();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => {
  const doApp = navegandoNoApp;
  navegandoNoApp = false;
  rota(doApp);
});

// ---------- Início ----------

function chipStatus(item, p) {
  if (p && p.resolvido) return `<span class="chip chip-ok">✓ ${formatarTempo(p.tempo)}</span>`;
  if (p && p.revelado) return '<span class="chip chip-visto">resposta vista</span>';
  if (emAndamento(p)) return `<span class="chip chip-andamento">${Math.round(estado.fracaoMarcada(p, item.P.total) * 100)}% marcado</span>`;
  return '<span class="chip chip-novo">Novo</span>';
}

function linhaDesafio(item, p) {
  const { d, P } = item;
  const andamento = emAndamento(p);
  const frac = Math.round(estado.fracaoMarcada(p, P.total) * 100);
  const extras = [];
  if (p && p.melhoresEstrelas) extras.push(`<span class="estrelas" title="Melhor resultado">${estrelasHtml(p.melhoresEstrelas)}</span>`);
  if (p && p.melhorTempo && !p.resolvido) extras.push(`melhor ${formatarTempo(p.melhorTempo)}`);
  return `<button class="desafio-row" data-id="${esc(d.id)}">
    <div class="desafio-linha"><span class="desafio-nome">${esc(d.titulo)}</span>${chipStatus(item, p)}</div>
    <div class="desafio-linha"><span class="desafio-meta">${P.m} categorias · ${P.n} itens · ${P.dicas.length} dicas</span>${
      extras.length ? `<span class="desafio-meta">${extras.join(' · ')}</span>` : ''
    }</div>
    ${andamento ? `<div class="track"><div class="fill" style="width:${frac}%"></div></div>` : ''}
  </button>`;
}

function renderHome() {
  const alerta = $('home-alert');
  let msg = '';
  if (atualizacaoPronta) msg = 'Há uma versão nova do app. <button class="link-acao" data-acao="atualizar">Atualizar agora</button>';
  else if (carregando) msg = 'Carregando desafios…';
  else if (erroCarga) msg = 'Não foi possível carregar os desafios. Verifique a conexão e abra o app de novo.';
  else if (!DESAFIOS.length) msg = 'Nenhum desafio encontrado.';
  alerta.innerHTML = msg;
  alerta.classList.toggle('hidden', !msg);

  const todos = estado.todosProgressos();
  let resolvidos = 0;
  let andamento = 0;
  let estrelas = 0;
  let continuar = null;
  for (const item of DESAFIOS) {
    const p = progressoValido(item, todos);
    if (!p) continue;
    if (p.resolvido) resolvidos++;
    if (emAndamento(p)) {
      andamento++;
      if (!continuar || (p.atualizado || '') > (continuar.p.atualizado || '')) continuar = { item, p };
    }
    estrelas += p.melhoresEstrelas || 0;
  }
  $('n-resolvidos').textContent = carregando ? '–' : `${resolvidos}/${DESAFIOS.length}`;
  $('n-andamento').textContent = carregando ? '–' : String(andamento);
  const badge = $('badge-estrelas');
  badge.textContent = `★ ${estrelas}`;
  badge.classList.toggle('active', estrelas > 0);
  badge.title = `${estrelas} de ${DESAFIOS.length * 3} estrelas`;

  const cc = $('card-continuar');
  if (continuar) {
    const { item, p } = continuar;
    const frac = Math.round(estado.fracaoMarcada(p, item.P.total) * 100);
    cc.innerHTML = `<div class="continuar-topo"><span class="section-title">Continuar</span><span class="continuar-meta">${formatarTempo(p.tempo)} · ${frac}% marcado</span></div>
      <div class="continuar-nome">${esc(item.d.titulo)}</div>
      <div class="track" style="height:7px;margin-top:10px"><div class="fill" style="width:${frac}%"></div></div>
      <button class="btn-primary" data-id="${esc(item.d.id)}">Continuar</button>`;
    cc.classList.remove('hidden');
  } else {
    cc.classList.add('hidden');
    cc.innerHTML = '';
  }

  const grupos = {};
  for (const item of DESAFIOS) (grupos[item.d.nivel] = grupos[item.d.nivel] || []).push(item);
  const ordem = [...ORDEM_NIVEL, ...Object.keys(grupos).filter((k) => !ORDEM_NIVEL.includes(k))];
  let h = '';
  for (const nivel of ordem) {
    if (!grupos[nivel]) continue;
    h += `<div class="grupo"><div class="grupo-titulo">${esc(NIVEL[nivel] || nivel)}</div>`;
    for (const item of grupos[nivel]) h += linhaDesafio(item, progressoValido(item, todos));
    h += '</div>';
  }
  $('lista-desafios').innerHTML = h;
}

// ---------- Ajustes ----------

function renderAjustes() {
  const a = estado.getAjustes();
  document.querySelectorAll('[data-ajuste]').forEach((grupo) => {
    const v = a[grupo.dataset.ajuste] ? '1' : '0';
    grupo.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  });
  const versao = VERSAO.startsWith('__') ? 'desenvolvimento' : VERSAO;
  $('sobre').textContent =
    `${DESAFIOS.length} desafios · versão ${versao}. Cada desafio é conferido automaticamente antes de ir ao ar: ` +
    'as dicas levam a uma única solução, que dá para alcançar só por dedução, sem chute. O progresso fica salvo neste aparelho.';
}

function ligarAjustes() {
  document.querySelectorAll('[data-ajuste]').forEach((grupo) => {
    grupo.addEventListener('click', (e) => {
      const b = e.target.closest('.seg-btn');
      if (!b) return;
      const a = estado.getAjustes();
      a[grupo.dataset.ajuste] = b.dataset.v === '1';
      estado.salvarAjustes(a);
      renderAjustes();
      jogo.atualizarAjustes();
    });
  });
  $('btn-apagar-progresso').addEventListener('click', () => {
    if (!confirm('Apagar o progresso, os tempos e as estrelas de todos os desafios neste aparelho?')) return;
    estado.apagarTudo();
    $('sobre').textContent = 'Progresso apagado.';
  });
}

// ---------- Atualização do app (service worker) ----------

function observarAtualizacao() {
  if (!('serviceWorker' in navigator)) return;
  const tinhaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControlador) return;
    atualizacaoPronta = true;
    if (!jogo.aberto()) renderHome();
  });
}

// ---------- Início do app ----------

async function iniciar() {
  iniciarModal();
  jogo.configurar({
    sair: (comBack) => {
      if (comBack) history.back();
      else location.replace('#/');
    },
    proximo: proximoDesafio,
    abrirDesafio: (id) => irPara(`#/jogo/${encodeURIComponent(id)}`),
  });
  ligarAjustes();
  observarAtualizacao();

  document.querySelectorAll('#bottom-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.screen;
      irPara(s === 'como' ? '#/como' : s === 'config' ? '#/ajustes' : '#/');
    });
  });
  $('screen-home').addEventListener('click', (e) => {
    const acao = e.target.closest('[data-acao="atualizar"]');
    if (acao) {
      location.reload();
      return;
    }
    const alvo = e.target.closest('[data-id]');
    if (alvo) irPara(`#/jogo/${encodeURIComponent(alvo.dataset.id)}`);
  });

  rota();
  try {
    await carregarDesafios();
  } catch (e) {
    console.error(e);
    erroCarga = e;
  }
  carregando = false;
  rota();
}

iniciar();
