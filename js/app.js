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
let houvePedido = false; // o navegador chegou a oferecer a instalação nesta visita?
let instaladoAqui = null; // getInstalledRelatedApps: true/false (null: sem resposta)
let verificouInstalado = false; // já deu para saber (ou não há como saber)?
let acabouDeInstalar = false;

function emModoApp() {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
}

function ehIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Navegador em uso (para as instruções e o diagnóstico).
function navegador() {
  const ua = navigator.userAgent;
  const versao = (re) => (ua.match(re) || [])[1] || '';
  const so = ehIOS() ? 'iPhone/iPad' : /Android/i.test(ua) ? 'Android' : 'computador';
  if (/FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Snapchat|; wv\)/.test(ua)) return { id: 'interno', nome: 'navegador interno de outro app', so };
  if (/SamsungBrowser\//.test(ua)) return { id: 'samsung', nome: `Samsung Internet ${versao(/SamsungBrowser\/(\d+)/)}`, so };
  if (/EdgA?\/|EdgiOS\//.test(ua)) return { id: 'edge', nome: `Edge ${versao(/Edg\w*\/(\d+)/)}`, so };
  if (/OPR\/|OPT\//.test(ua)) return { id: 'opera', nome: 'Opera', so };
  if (/Firefox\/|FxiOS\//.test(ua)) return { id: 'firefox', nome: `Firefox ${versao(/(?:Firefox|FxiOS)\/(\d+)/)}`, so };
  if (/CriOS\//.test(ua)) return { id: 'chrome', nome: `Chrome ${versao(/CriOS\/(\d+)/)}`, so };
  if (/Chrome\//.test(ua)) return { id: 'chrome', nome: `Chrome ${versao(/Chrome\/(\d+)/)}`, so };
  if (/Safari\//.test(ua)) return { id: 'safari', nome: 'Safari', so };
  return { id: 'outro', nome: 'navegador', so };
}

// Passos para instalar, conforme o aparelho e o navegador.
function passosInstalar(nav) {
  const jaInstalado =
    '<li>Se o navegador disser que o app <b>já está instalado</b> (ou mostrar <b>Abrir no app</b>), ele existe no celular, mesmo sem ícone na tela inicial: procure “Lógica” na lista de apps. Para instalar de novo, desinstale em <b>Configurações → Apps → Lógica → Desinstalar</b> e recarregue esta página.</li>';
  if (nav.id === 'interno') {
    return '<li>Este link abriu dentro de outro app (Instagram, Facebook…), que não instala apps. Toque em <b>⋮</b> ou <b>…</b> e escolha <b>Abrir no navegador</b> (ou copie o endereço e cole no Chrome).</li><li>No Chrome, use o menu <b>⋮</b> → <b>Instalar app</b>.</li>';
  }
  if (nav.so === 'iPhone/iPad') {
    return '<li>Abra este endereço no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> (o quadrado com a seta) → <b>Adicionar à Tela de Início</b> → <b>Adicionar</b>.</li><li>No iOS 16.4 ou mais novo, o Chrome também tem essa opção em <b>Compartilhar</b>.</li>';
  }
  if (nav.so === 'computador') {
    return '<li>No Chrome ou no Edge, use o ícone de instalar no fim da barra de endereço (ou o menu → <b>Instalar Lógica</b>).</li>';
  }
  const abrirNoChrome =
    '<li>Se você abriu o link pelo WhatsApp, Gmail ou outro app, toque em <b>⋮</b> e escolha <b>Abrir no Chrome</b>: a página aberta dentro de outro app não instala.</li>';
  if (nav.id === 'samsung') {
    return `${abrirNoChrome.replace('Abrir no Chrome', 'Abrir no navegador')}<li>No Samsung Internet, toque no ícone de instalar na barra de endereço ou no menu <b>≡</b> → <b>Adicionar página a</b> → <b>Tela inicial</b>.</li>${jaInstalado}`;
  }
  if (nav.id === 'firefox') return `${abrirNoChrome}<li>No Firefox, toque em <b>⋮</b> → <b>Instalar</b> (ou <b>Adicionar à tela inicial</b>).</li>${jaInstalado}`;
  return `${abrirNoChrome}<li>No Chrome, toque em <b>⋮</b> → <b>Instalar app</b> (em algumas versões, <b>Adicionar à tela inicial</b> → <b>Instalar</b>).</li>${jaInstalado}`;
}

function renderInstalar() {
  const el = $('instalar');
  if (!el) return;
  const nav = navegador();
  let h;
  if (emModoApp()) {
    h = '<p class="instalar-txt">Você está usando o app instalado. ✓</p>';
  } else if (acabouDeInstalar) {
    h = '<p class="instalar-txt"><b>App instalado.</b> Procure o ícone “Lógica” na tela inicial ou na lista de apps.</p>';
  } else if (pedidoInstalar) {
    h = '<button class="btn-primary" data-acao="instalar">Instalar o app Lógica</button><p class="instalar-txt">Ele fica na tela inicial, abre em tela cheia e funciona sem internet.</p>';
  } else if (instaladoAqui) {
    h = '<p class="instalar-txt"><b>O Lógica já está instalado neste celular.</b> Procure “Lógica” na lista de apps: tirar o ícone da tela inicial não desinstala. Para instalar de novo, desinstale esse primeiro.</p>';
  } else {
    h = `<p class="instalar-txt">Para instalar, siga os passos abaixo (${esc(nav.nome)}${nav.so === 'computador' ? '' : `, ${nav.so}`}).</p>`;
  }
  if (!emModoApp()) {
    const aberto = !pedidoInstalar && !acabouDeInstalar ? ' open' : '';
    h += `<details class="instalar-ajuda"${aberto}><summary>${pedidoInstalar ? 'Outras formas de instalar' : 'Como instalar'}</summary><ol class="instalar-passos">${passosInstalar(nav)}</ol>
      <p class="instalar-diag" id="instalar-diag">Diagnóstico: verificando…</p></details>`;
  }
  el.innerHTML = h;
  diagnosticar();
}

// Uma linha com o que o app consegue ver sobre a instalação (ajuda a achar a
// causa quando não dá para instalar).
async function diagnosticar() {
  const alvo = $('instalar-diag');
  if (!alvo || !alvo.closest('.screen.active')) return; // só com Ajustes aberto
  const nav = navegador();
  const partes = [`${nav.nome}${nav.so === 'computador' ? '' : ` no ${nav.so}`}`];
  if ('serviceWorker' in navigator) {
    let sw = 'service worker não registrado';
    try {
      if (navigator.serviceWorker.controller) sw = 'service worker ativo';
      else if (await navigator.serviceWorker.getRegistration()) sw = 'service worker registrado';
    } catch {
      sw = 'service worker indisponível';
    }
    partes.push(sw);
  } else partes.push('sem service worker');
  try {
    const r = await fetch('manifest.json', { cache: 'no-cache' });
    const m = await r.json();
    const icones = (m.icons || []).map((i) => i.sizes).join(', ');
    partes.push(r.ok && m.id && m.start_url ? `manifesto ok (id ${m.id}, ícones ${icones})` : 'manifesto incompleto');
  } catch {
    partes.push('manifesto não carregou');
  }
  partes.push(pedidoInstalar ? 'oferta de instalação: disponível' : houvePedido ? 'oferta de instalação: já usada' : 'oferta de instalação: não veio');
  if (instaladoAqui !== null) partes.push(instaladoAqui ? 'app já instalado neste aparelho' : 'nenhuma instalação detectada');
  const el = $('instalar-diag'); // (o cartão pode ter sido redesenhado enquanto isso)
  if (el) el.textContent = `Diagnóstico: ${partes.join(' · ')}.`;
}

async function verificarInstalado() {
  try {
    if ('getInstalledRelatedApps' in navigator) {
      const apps = await navigator.getInstalledRelatedApps();
      instaladoAqui = apps.some((x) => x.platform === 'webapp');
    }
  } catch {
    /* navegador sem suporte */
  }
  verificouInstalado = true;
  renderInstalar();
  renderAvisoInstalar();
}

// Aviso discreto na tela inicial: no celular, enquanto o app não estiver
// instalado (com o botão do navegador, quando ele oferece; senão, o caminho
// para as instruções em Ajustes). "Agora não" esconde por 30 dias.
function renderAvisoInstalar() {
  const el = $('home-instalar');
  if (!el) return;
  const dispensado = estado.getAvisos().instalarDispensado;
  const recente = dispensado && Date.now() - new Date(dispensado).getTime() < 30 * 864e5;
  const celular = navegador().so !== 'computador';
  const mostrar = !emModoApp() && !acabouDeInstalar && !recente && (!!pedidoInstalar || (celular && verificouInstalado && instaladoAqui !== true));
  el.classList.toggle('hidden', !mostrar);
  if (!mostrar) {
    el.innerHTML = '';
    return;
  }
  const botao = pedidoInstalar
    ? '<button class="btn-aviso" data-acao="instalar">Instalar</button>'
    : '<button class="btn-aviso" data-acao="ver-instalar">Ver como</button>';
  el.innerHTML = `<p><b>Instale o Lógica no celular:</b> ele abre como app, em tela cheia, e funciona sem internet.</p><div class="aviso-botoes">${botao}<button class="link-acao" data-acao="instalar-depois">Agora não</button></div>`;
}

async function instalarAgora() {
  if (!pedidoInstalar) return;
  const pedido = pedidoInstalar;
  pedidoInstalar = null;
  try {
    await pedido.prompt();
    await pedido.userChoice;
  } catch {
    /* janela fechada ou pedido já usado */
  }
  renderInstalar();
  renderAvisoInstalar();
}

function ligarInstalar() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoInstalar = e;
    houvePedido = true;
    renderInstalar();
    renderAvisoInstalar();
  });
  window.addEventListener('appinstalled', () => {
    pedidoInstalar = null;
    instaladoAqui = true;
    acabouDeInstalar = true;
    renderInstalar();
    renderAvisoInstalar();
  });
  $('instalar').addEventListener('click', (e) => {
    if (e.target.closest('[data-acao="instalar"]')) instalarAgora();
  });
  $('home-instalar').addEventListener('click', (e) => {
    if (e.target.closest('[data-acao="instalar"]')) instalarAgora();
    else if (e.target.closest('[data-acao="ver-instalar"]')) irPara('#/ajustes');
    else if (e.target.closest('[data-acao="instalar-depois"]')) {
      estado.salvarAvisos({ ...estado.getAvisos(), instalarDispensado: new Date().toISOString() });
      renderAvisoInstalar();
    }
  });
  renderInstalar();
  renderAvisoInstalar();
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
