// Orquestração: carrega os desafios, navega entre telas (via #hash, para o
// botão "voltar" do celular funcionar), desenha a tela inicial e os ajustes.

import * as M from './motor.js';
import * as estado from './estado.js';
import * as jogo from './jogo.js';
import { NIVEL, TIPO } from './jogo.js';
import { $, esc, formatarTempo, estrelasHtml, mostrarTela, iniciarModal } from './ui.js';
import { VERSAO } from './versao.js';

const ORDEM_NIVEL = ['facil', 'medio', 'dificil'];
const ORDEM_TIPO = Object.keys(TIPO);

let DESAFIOS = []; // [{ d, P, num }] na ordem do índice; num = posição (1, 2, …)
let carregando = true;
let erroCarga = null;
let navegandoNoApp = false;
let atualizacaoPronta = false;

// ---------- Desafios ----------

// No site publicado, todos os desafios vêm num pacote só (desafios/pacote.json,
// montado no deploy). Sem o pacote (ex.: rodando local), lê o índice e os
// arquivos soltos.
async function lerPacote() {
  try {
    const r = await fetch('desafios/pacote.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const { desafios } = await r.json();
    return Array.isArray(desafios) ? desafios : null;
  } catch {
    return null;
  }
}

async function lerArquivosSoltos() {
  const r = await fetch('desafios/index.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`índice indisponível (${r.status})`);
  const { desafios } = await r.json();
  return Promise.all(
    desafios.map(async (arq) => {
      try {
        const rr = await fetch(`desafios/${arq}`, { cache: 'no-cache' });
        return await rr.json();
      } catch (e) {
        console.error('Desafio indisponível:', arq, e);
        return null;
      }
    }),
  );
}

async function carregarDesafios() {
  const lista = (await lerPacote()) || (await lerArquivosSoltos());
  DESAFIOS = lista
    .map((d, i) => {
      if (!d) return null;
      try {
        return { d, P: M.compilar(d), num: i + 1 };
      } catch (e) {
        console.error('Desafio inválido:', d.id, e);
        return null;
      }
    })
    .filter(Boolean);
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

function descricao(item) {
  const { d, P } = item;
  const partes = [`<span class="nv nv-${esc(d.nivel)}">${esc(NIVEL[d.nivel] || d.nivel)}</span>`];
  if (TIPO[d.tipo]) partes.push(TIPO[d.tipo]);
  partes.push(`${P.m} categorias × ${P.n} itens`);
  return partes.join(' · ');
}

function linhaDesafio(item, p) {
  const { d, P } = item;
  const andamento = emAndamento(p);
  const frac = Math.round(estado.fracaoMarcada(p, P.total) * 100);
  const extras = [];
  if (p && p.melhoresEstrelas) extras.push(`<span class="estrelas" title="Melhor resultado">${estrelasHtml(p.melhoresEstrelas)}</span>`);
  if (p && p.melhorTempo && !p.resolvido) extras.push(`melhor ${formatarTempo(p.melhorTempo)}`);
  return `<button class="desafio-row" data-id="${esc(d.id)}">
    <div class="desafio-linha"><span class="desafio-num">${item.num}</span><span class="desafio-nome">${esc(d.titulo)}</span>${chipStatus(item, p)}</div>
    <div class="desafio-linha desafio-sub"><span class="desafio-meta">${descricao(item)}</span>${
      extras.length ? `<span class="desafio-meta">${extras.join(' · ')}</span>` : ''
    }</div>
    ${andamento ? `<div class="track"><div class="fill" style="width:${frac}%"></div></div>` : ''}
  </button>`;
}

// ---------- Filtros ----------

function passaFiltros(item, p, f) {
  if (f.nivel && item.d.nivel !== f.nivel) return false;
  if (f.tipo && item.d.tipo !== f.tipo) return false;
  if (f.ocultarResolvidos && p && p.resolvido) return false;
  return true;
}

function renderFiltros(f, mostrando) {
  const el = $('filtros');
  if (!DESAFIOS.length) {
    el.classList.add('hidden');
    return;
  }
  const niveis = ORDEM_NIVEL.filter((n) => DESAFIOS.some((x) => x.d.nivel === n));
  const tipos = ORDEM_TIPO.filter((t) => DESAFIOS.some((x) => x.d.tipo === t));
  const chips = (campo, valores, rotulo) =>
    `<div class="filtro-chips" role="group" data-filtro="${campo}">` +
    ['', ...valores].map((v) => `<button class="filtro-chip${f[campo] === v ? ' on' : ''}" data-v="${v}" aria-pressed="${f[campo] === v}">${v ? esc(rotulo(v)) : 'Todos'}</button>`).join('') +
    '</div>';
  let h = '';
  if (niveis.length > 1) h += `<div class="filtro-linha"><span class="filtro-rot">Nível</span>${chips('nivel', niveis, (v) => NIVEL[v] || v)}</div>`;
  if (tipos.length > 1) h += `<div class="filtro-linha"><span class="filtro-rot">Tipo</span>${chips('tipo', tipos, (v) => TIPO[v])}</div>`;
  h += `<div class="filtro-rodape"><label class="filtro-toggle"><input type="checkbox" data-filtro-ocultar${f.ocultarResolvidos ? ' checked' : ''}> Esconder os resolvidos</label>
    <span class="filtro-cont">${mostrando === DESAFIOS.length ? `${DESAFIOS.length} desafios` : `${mostrando} de ${DESAFIOS.length}`}</span></div>`;
  el.innerHTML = h;
  el.classList.remove('hidden');
}

function ligarFiltros() {
  const el = $('filtros');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.filtro-chip');
    if (!b) return;
    const campo = b.closest('[data-filtro]').dataset.filtro;
    const f = estado.getFiltros();
    f[campo] = b.dataset.v;
    estado.salvarFiltros(f);
    renderHome();
  });
  el.addEventListener('change', (e) => {
    if (!e.target.matches('[data-filtro-ocultar]')) return;
    const f = estado.getFiltros();
    f.ocultarResolvidos = e.target.checked;
    estado.salvarFiltros(f);
    renderHome();
  });
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
  // Sem nada em andamento, sugere o primeiro desafio ainda não feito.
  const proximo = continuar ? null : DESAFIOS.find((item) => {
    const p = progressoValido(item, todos);
    return !p || (!p.resolvido && !p.revelado);
  });
  if (continuar) {
    const { item, p } = continuar;
    const frac = Math.round(estado.fracaoMarcada(p, item.P.total) * 100);
    cc.innerHTML = `<div class="continuar-topo"><span class="section-title">Continuar</span><span class="continuar-meta">${formatarTempo(p.tempo)} · ${frac}% marcado</span></div>
      <div class="continuar-nome"><span class="continuar-num">${item.num}</span>${esc(item.d.titulo)}</div>
      <div class="continuar-desc">${descricao(item)}</div>
      <div class="track" style="height:7px;margin-top:10px"><div class="fill" style="width:${frac}%"></div></div>
      <button class="btn-primary" data-id="${esc(item.d.id)}">Continuar</button>`;
    cc.classList.remove('hidden');
  } else if (proximo) {
    cc.innerHTML = `<div class="continuar-topo"><span class="section-title">${resolvidos > 0 ? 'Próximo desafio' : 'Comece por aqui'}</span></div>
      <div class="continuar-nome"><span class="continuar-num">${proximo.num}</span>${esc(proximo.d.titulo)}</div>
      <div class="continuar-desc">${descricao(proximo)}</div>
      <button class="btn-primary" data-id="${esc(proximo.d.id)}">Começar</button>`;
    cc.classList.remove('hidden');
  } else {
    cc.classList.add('hidden');
    cc.innerHTML = '';
  }

  const f = estado.getFiltros();
  const visiveis = DESAFIOS.filter((item) => passaFiltros(item, progressoValido(item, todos), f));
  renderFiltros(f, visiveis.length);
  let h = visiveis.map((item) => linhaDesafio(item, progressoValido(item, todos))).join('');
  if (DESAFIOS.length && !visiveis.length) {
    h = `<div class="lista-vazia">Nenhum desafio com esses filtros.<button class="link-acao" data-acao="limpar-filtros">Mostrar todos</button></div>`;
  }
  $('lista-desafios').innerHTML = h;
}

// ---------- Ajustes ----------

// ---------- Instalar no celular ----------
// O Lógica tem identidade própria no manifesto (id "/logica/", escopo /logica/),
// separada dos outros apps do mesmo domínio (TEMa Estudo etc.).

let pedidoInstalar = null; // evento beforeinstallprompt guardado para o botão
let instaladoAqui = false; // o próprio Lógica já está instalado neste aparelho?

function emModoApp() {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
}

function ehIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function renderInstalar() {
  const el = $('instalar');
  if (!el) return;
  let h;
  if (emModoApp()) {
    h = '<p class="instalar-txt">Você está usando o app instalado. ✓</p>';
  } else if (pedidoInstalar) {
    h = '<button class="btn-primary" data-acao="instalar">Instalar o app Lógica</button><p class="instalar-txt">Ele fica na tela inicial e funciona sem internet.</p>';
  } else if (instaladoAqui) {
    h = '<p class="instalar-txt"><b>O Lógica já está instalado neste celular.</b> Procure “Lógica” na lista de apps: tirar o ícone da tela inicial não desinstala. Para instalar de novo, desinstale esse primeiro.</p>';
  } else if (ehIOS()) {
    h = '<p class="instalar-txt">No iPhone, abra este endereço no Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>';
  } else {
    h = '<p class="instalar-txt">No Android, abra no Chrome e use o menu <b>⋮</b> → <b>Instalar app</b>. Se ele disser que o app já está instalado, procure “Lógica” na lista de apps do celular (tirar o ícone da tela inicial não desinstala).</p>';
  }
  el.innerHTML = h;
}

async function verificarInstalado() {
  if (!('getInstalledRelatedApps' in navigator)) return;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    instaladoAqui = apps.some((x) => x.platform === 'webapp');
    renderInstalar();
  } catch {
    /* navegador sem suporte */
  }
}

function ligarInstalar() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoInstalar = e;
    renderInstalar();
  });
  window.addEventListener('appinstalled', () => {
    pedidoInstalar = null;
    instaladoAqui = true;
    renderInstalar();
  });
  $('instalar').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-acao="instalar"]') || !pedidoInstalar) return;
    const pedido = pedidoInstalar;
    pedidoInstalar = null;
    pedido.prompt();
    try {
      await pedido.userChoice;
    } catch {
      /* janela fechada */
    }
    renderInstalar();
  });
  renderInstalar();
  verificarInstalado();
}

function renderAjustes() {
  renderInstalar();
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
  ligarInstalar();
  observarAtualizacao();

  document.querySelectorAll('#bottom-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.screen;
      irPara(s === 'como' ? '#/como' : s === 'config' ? '#/ajustes' : '#/');
    });
  });
  ligarFiltros();
  $('screen-home').addEventListener('click', (e) => {
    const acao = e.target.closest('[data-acao="atualizar"]');
    if (acao) {
      location.reload();
      return;
    }
    if (e.target.closest('[data-acao="limpar-filtros"]')) {
      estado.salvarFiltros({ ...estado.FILTROS_PADRAO });
      renderHome();
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
