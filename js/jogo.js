// Tela de jogo: grade em escada, marcações (✕ / S), painel com dicas, história,
// quadro de respostas e relações (anotações de ordem, como no papel), verificar,
// dica passo a passo, cronômetro e salvamento automático do progresso.

import * as M from './motor.js';
import * as R from './relacao.js';
import * as estado from './estado.js';
import { $, esc, formatarTempo, estrelasHtml, abrirModal, fecharModal, modalAberto } from './ui.js';

const { VAZIO, NAO, SIM } = M;
export const NIVEL = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
// Tipos de desafio: associação (só ligações entre nomes), ordem (antes/depois,
// vizinhos), cálculo (diferenças exatas: "dois anos mais velho") e misto.
export const TIPO = { associacao: 'Associação', ordem: 'Ordem', calculo: 'Cálculo', misto: 'Misto' };
const W_CAT = 22;
const H_CAT = 22;
const ZOOM_MIN = -3;
const ZOOM_MAX = 6;

let J = null; // jogo aberto
let ajustes = estado.getAjustes();
let ctx = { sair() {}, proximo() { return null; }, abrirDesafio() {} };
let toastTimer = null;
let errosTimer = null;
let festaTimer = null;
// Painel ao lado da grade (sempre expandido): telas largas ou celular deitado.
const largo = window.matchMedia('(min-width: 900px), (orientation: landscape) and (max-height: 540px) and (min-width: 600px)');

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

export function configurar(c) {
  ctx = { ...ctx, ...c };
  ligarEventos();
}

export function aberto() {
  return J ? J.d.id : null;
}

export function atualizarAjustes() {
  ajustes = estado.getAjustes();
  if (J) {
    aplicarTamanhos();
    pintar();
    mostrarTempo();
  }
}

export function abrir(item, opcoes = {}) {
  ajustes = estado.getAjustes();
  const { d, P } = item;
  let prog = estado.getProgresso(d.id);
  if (prog && prog.v !== (d.versao ?? 1)) prog = estado.novoProgresso(d, prog); // desafio mudou
  if (!prog) prog = estado.novoProgresso(d);
  prog = { ...estado.novoProgresso(d), ...prog };
  const ks = R.relacionaveis(P);
  prog.relacoes = relacoesValidas(P, ks, prog.relacoes);
  const marcas = prog.resolvido || prog.revelado ? Uint8Array.from(P.gradeSolucao) : M.gradeDeTexto(P, prog.marcas);
  J = {
    item,
    d,
    P,
    prog,
    marcas,
    pilha: [],
    sel: -1,
    expandido: false,
    aba: 'dicas',
    dicaAtual: Math.max(0, Math.min(prog.dicaAtual || 0, P.dicas.length - 1)),
    rodando: false,
    t0: 0,
    ticks: 0,
    timer: null,
    erros: new Set(),
    alvo: new Set(),
    painelDica: null,
    voltarComBack: !!opcoes.voltarComBack,
    lp: null,
    rel: { k: ks.length ? ks[0] : -1, form: novoFormRel() },
  };
  $('aba-relacao').classList.toggle('hidden', !ks.length);
  $('jogo-nivel').textContent = `${NIVEL[d.nivel] || d.nivel} · ${P.m} categorias × ${P.n} itens`;
  $('jogo-nome').textContent = d.titulo;
  document.title = `${d.titulo} — Lógica`;
  fecharMenu();
  montarGrade();
  renderPainel();
  pintar();
  mostrarTempo();
  atualizarBotoes();
  if (!prog.iniciado && !prog.resolvido && !prog.revelado) mostrarIntro(true);
  else iniciarRelogio();
}

export function fechar() {
  if (!J) return;
  J.fechando = true; // impede que callbacks de janelas reiniciem o cronômetro
  if (modalAberto()) fecharModal();
  pausarRelogio();
  salvar();
  fecharMenu();
  clearTimeout(errosTimer);
  clearTimeout(festaTimer);
  esconderToast();
  J = null;
  document.title = 'Lógica — Desafios de associação';
}

function sair() {
  const voltar = J && J.voltarComBack;
  ctx.sair(voltar);
}

// ---------------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------------

function categoriasLinha(P) {
  const out = [0];
  for (let c = P.m - 1; c >= 2; c--) out.push(c);
  return out;
}

function categoriasColuna(P) {
  const out = [];
  for (let c = 1; c < P.m; c++) out.push(c);
  return out;
}

function montarGrade() {
  const { P } = J;
  const { m, n } = P;
  const area = $('grade-area');
  const colCats = categoriasColuna(P);
  J.celR = new Int16Array(P.total);
  J.celK = new Int16Array(P.total);
  J.celRi = new Int16Array(P.total);
  J.celCi = new Int16Array(P.total);
  J.pos = new Map();

  let h = '<table class="grade" id="grade" role="grid" aria-label="Grade do desafio"><thead><tr>';
  h += '<th class="canto" colspan="2" rowspan="2"></th>';
  for (const c of colCats) h += `<th class="th-cat" colspan="${n}">${esc(P.cats[c].nome)}</th>`;
  h += '</tr><tr>';
  for (const c of colCats) {
    for (let j = 0; j < n; j++) {
      const g = c * n + j;
      h += `<th class="th-item${j === 0 ? ' ini-col' : ''}" data-g="${g}"><span>${esc(P.nomes[g])}</span></th>`;
    }
  }
  h += '</tr></thead><tbody>';
  let ri = 0;
  for (const rc of categoriasLinha(P)) {
    const ncg = rc === 0 ? m - 1 : rc - 1;
    for (let i = 0; i < n; i++) {
      const gR = rc * n + i;
      h += `<tr${i === 0 ? ' class="ini-bloco"' : ''}>`;
      if (i === 0) h += `<th class="th-cat-linha" rowspan="${n}" style="--n:${n}"><span>${esc(P.cats[rc].nome)}</span></th>`;
      h += `<th class="th-linha" data-g="${gR}">${esc(P.nomes[gR])}</th>`;
      let ci = 0;
      for (let cg = 1; cg <= ncg; cg++) {
        for (let j = 0; j < n; j++) {
          const gC = cg * n + j;
          const c = M.celula(P, gR, gC);
          J.celR[c] = gR;
          J.celK[c] = gC;
          J.celRi[c] = ri;
          J.celCi[c] = ci;
          J.pos.set(ri * 1000 + ci, c);
          h += `<td data-c="${c}"${j === 0 ? ' data-ini="1"' : ''} role="gridcell"></td>`;
          ci++;
        }
      }
      const resto = (m - 1 - ncg) * n;
      if (resto > 0) h += `<td class="fora" colspan="${resto}" aria-hidden="true"></td>`;
      h += '</tr>';
      ri++;
    }
  }
  h += '</tbody></table>';
  area.innerHTML = h;
  area.scrollTop = 0;
  area.scrollLeft = 0;

  J.tabela = $('grade');
  J.tds = new Array(P.total);
  J.tabela.querySelectorAll('td[data-c]').forEach((td) => {
    J.tds[+td.dataset.c] = td;
  });
  J.thLinha = new Map();
  J.tabela.querySelectorAll('th.th-linha').forEach((th) => J.thLinha.set(+th.dataset.g, th));
  J.thCol = new Map();
  J.tabela.querySelectorAll('th.th-item').forEach((th) => J.thCol.set(+th.dataset.g, th));
  aplicarTamanhos();
}

let canvasMedida = null;
function larguraTexto(textos, peso = 600, tam = 12) {
  canvasMedida = canvasMedida || document.createElement('canvas');
  const g = canvasMedida.getContext('2d');
  g.font = `${peso} ${tam}px ${getComputedStyle(document.body).fontFamily}`;
  let w = 0;
  for (const t of textos) w = Math.max(w, g.measureText(t).width);
  return w;
}

function aplicarTamanhos() {
  if (!J || !J.tabela) return;
  const { P } = J;
  const area = $('grade-area');
  const nomesLinha = [];
  for (const rc of categoriasLinha(P)) for (let i = 0; i < P.n; i++) nomesLinha.push(P.nomes[rc * P.n + i]);
  const nomesColuna = [];
  for (const c of categoriasColuna(P)) for (let i = 0; i < P.n; i++) nomesColuna.push(P.nomes[c * P.n + i]);
  const wItem = Math.ceil(Math.min(112, Math.max(44, larguraTexto(nomesLinha) + 14)));
  const hItem = Math.ceil(Math.min(112, Math.max(36, larguraTexto(nomesColuna) + 12)));
  const cols = (P.m - 1) * P.n;
  const disp = (area.clientWidth || 340) - W_CAT - wItem - 6;
  // Se a grade inteira cabe na largura com casas de pelo menos 22px, ajusta à
  // tela; senão usa casas confortáveis (28px) e a grade rola para os lados.
  const caber = Math.floor(disp / cols);
  let cel = caber >= 22 ? Math.min(caber, 40) : 28;
  cel = Math.max(16, Math.min(60, cel + (ajustes.zoom || 0) * 4));
  const s = J.tabela.style;
  s.setProperty('--cel', `${cel}px`);
  s.setProperty('--w-item', `${wItem}px`);
  s.setProperty('--h-item', `${hItem}px`);
  s.setProperty('--w-cat', `${W_CAT}px`);
  s.setProperty('--h-cat', `${H_CAT}px`);
  J.tam = { cel, wItem, hItem };
  $('btn-menos').disabled = (ajustes.zoom || 0) <= ZOOM_MIN || cel <= 16;
  $('btn-mais').disabled = (ajustes.zoom || 0) >= ZOOM_MAX || cel >= 60;
}

function zoom(delta) {
  ajustes = estado.getAjustes();
  ajustes.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (ajustes.zoom || 0) + delta));
  estado.salvarAjustes(ajustes);
  aplicarTamanhos();
  if (J.sel >= 0) rolarAte(J.sel);
}

function efetiva(ax) {
  const e = Uint8Array.from(J.marcas);
  if (ax) for (let i = 0; i < e.length; i++) if (ax[i] && e[i] === VAZIO) e[i] = NAO;
  return e;
}

function pintar() {
  if (!J) return;
  const { P } = J;
  const encerrado = J.prog.resolvido || J.prog.revelado;
  const ax = ajustes.autoX && !encerrado ? M.autoX(P, J.marcas) : null;
  J.ax = ax;
  const conf = ajustes.conflitos && !encerrado ? M.conflitos(P, efetiva(ax)) : null;
  const selR = J.sel >= 0 ? J.celR[J.sel] : -1;
  const selK = J.sel >= 0 ? J.celK[J.sel] : -1;
  for (let c = 0; c < P.total; c++) {
    const td = J.tds[c];
    const v = J.marcas[c];
    let cls = td.dataset.ini ? 'ini-col' : '';
    if (v === SIM) cls += ' s';
    else if (v === NAO) cls += ' x';
    else if (ax && ax[c]) cls += ' x auto';
    if (c === J.sel) cls += ' sel';
    else if (J.celR[c] === selR || J.celK[c] === selK) cls += ' cruz';
    if (conf && conf.has(c)) cls += ' conflito';
    if (J.erros.has(c)) cls += ' erro';
    if (J.alvo.has(c)) cls += ' alvo';
    if (td.className !== cls) td.className = cls;
  }
  J.tabela.querySelectorAll('th.foco').forEach((th) => th.classList.remove('foco'));
  if (J.sel >= 0) {
    const a = J.thLinha.get(selR);
    const b = J.thCol.get(selK);
    if (a) a.classList.add('foco');
    if (b) b.classList.add('foco');
  }
  J.tabela.classList.toggle('final', !!J.prog.resolvido);
  infoCasa();
  if (painelExpandido() && !J.painelDica && (J.aba === 'quadro' || (J.aba === 'relacao' && ajustes.relPossiveis))) renderPainel();
}

function nomeCurto(g) {
  return J.P.nomes[g];
}

function infoCasa() {
  const el = $('info-casa');
  if (J.prog.resolvido) {
    el.innerHTML = `🎉 Resolvido em <b>${formatarTempo(J.prog.tempo)}</b>`;
    return;
  }
  if (J.prog.revelado) {
    el.innerHTML = 'Resposta revelada · use <b>Recomeçar</b> no menu ⋯ para jogar de novo';
    return;
  }
  if (J.sel < 0) {
    el.innerHTML = 'Toque: <span class="marca">✕</span> → <span class="marca">S</span> → limpa · Segure: <span class="marca">S</span>';
    return;
  }
  const c = J.sel;
  const v = J.marcas[c];
  const auto = v === VAZIO && J.ax && J.ax[c];
  const estadoTxt = v === SIM ? 'combinam <span class="marca">S</span>' : v === NAO ? 'não combinam ✕' : auto ? 'não combinam ✕ (automático)' : 'em aberto';
  el.innerHTML = `<b>${esc(nomeCurto(J.celR[c]))}</b> × <b>${esc(nomeCurto(J.celK[c]))}</b> · ${estadoTxt}`;
}

function selecionar(c) {
  J.sel = c;
}

function encerrado() {
  return J.prog.resolvido || J.prog.revelado;
}

function avisarEncerrado() {
  toast(J.prog.resolvido ? 'Desafio resolvido! Para jogar de novo, use “Recomeçar” no menu ⋯.' : 'A resposta foi revelada. Use “Recomeçar” no menu ⋯ para tentar de novo.');
}

// Toque numa casa: ✕ → S → vazio. Toque longo: S (ou limpa um S).
function tocar(c, longo = false) {
  if (!J) return;
  selecionar(c);
  if (encerrado()) {
    pintar();
    avisarEncerrado();
    return;
  }
  const atual = J.marcas[c];
  if (atual === VAZIO && J.ax && J.ax[c]) {
    pintar();
    toast('Essa casa já tem ✕ automático: há um S na mesma linha ou coluna deste quadro.');
    return;
  }
  let novo;
  if (longo) novo = atual === SIM ? VAZIO : SIM;
  else novo = atual === VAZIO ? NAO : atual === NAO ? SIM : VAZIO;
  aplicar([[c, novo]]);
}

function marcarDireto(c, v) {
  if (encerrado()) return avisarEncerrado();
  if (J.marcas[c] === VAZIO && v !== VAZIO && J.ax && J.ax[c]) {
    toast('Essa casa já tem ✕ automático.');
    return;
  }
  aplicar([[c, v]]);
}

function aplicar(lista) {
  const antes = M.gradeParaTexto(J.marcas);
  let mudou = false;
  for (const [c, v] of lista) {
    if (J.marcas[c] !== v) {
      J.marcas[c] = v;
      mudou = true;
    }
  }
  if (!mudou) {
    pintar();
    return;
  }
  J.pilha.push(antes);
  if (J.pilha.length > 400) J.pilha.shift();
  J.erros.clear();
  J.alvo.clear();
  if (J.painelDica && J.painelDica.tipo === 'passo') {
    // a dica mostrada pode ter ficado velha; mantém o texto, mas tira o destaque
  }
  if (!J.prog.iniciado) J.prog.iniciado = true;
  if (!J.rodando) iniciarRelogio();
  salvar();
  pintar();
  atualizarBotoes();
  if (M.resolvido(J.P, J.marcas)) concluir();
}

function desfazer() {
  if (!J || !J.pilha.length) return;
  if (encerrado()) return avisarEncerrado();
  J.marcas = M.gradeDeTexto(J.P, J.pilha.pop());
  J.erros.clear();
  J.alvo.clear();
  salvar();
  pintar();
  atualizarBotoes();
}

function atualizarBotoes() {
  const fim = encerrado();
  $('btn-desfazer').disabled = fim || J.pilha.length === 0;
  $('btn-verificar').disabled = fim;
  $('btn-dica').disabled = fim;
}

// Rola a grade para deixar a casa visível (descontando os rótulos fixos).
function rolarAte(c) {
  const td = J.tds[c];
  const area = $('grade-area');
  if (!td || !area) return;
  const a = area.getBoundingClientRect();
  const r = td.getBoundingClientRect();
  const esq = a.left + W_CAT + J.tam.wItem;
  const topo = a.top + H_CAT + J.tam.hItem;
  let dx = 0;
  let dy = 0;
  if (r.left < esq) dx = r.left - esq - 8;
  else if (r.right > a.right) dx = r.right - a.right + 8;
  if (r.top < topo) dy = r.top - topo - 8;
  else if (r.bottom > a.bottom) dy = r.bottom - a.bottom + 8;
  if (dx || dy) area.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Cronômetro e salvamento
// ---------------------------------------------------------------------------

function tempoAtual() {
  return J.prog.tempo + (J.rodando ? Date.now() - J.t0 : 0);
}

function iniciarRelogio() {
  if (!J || J.fechando || J.rodando || encerrado() || !J.prog.iniciado) return;
  if (document.visibilityState === 'hidden' || modalAberto()) return;
  J.rodando = true;
  J.t0 = Date.now();
  const timer = setInterval(() => {
    if (!J || J.timer !== timer) {
      clearInterval(timer);
      return;
    }
    mostrarTempo();
    J.ticks++;
    if (J.ticks % 15 === 0) salvar();
  }, 1000);
  J.timer = timer;
  mostrarTempo();
}

function pausarRelogio() {
  if (!J || !J.rodando) return;
  J.prog.tempo += Date.now() - J.t0;
  J.rodando = false;
  clearInterval(J.timer);
  J.timer = null;
}

function mostrarTempo() {
  if (!J) return;
  const el = $('jogo-tempo');
  el.textContent = formatarTempo(tempoAtual());
  el.classList.toggle('resolvido', !!J.prog.resolvido);
  el.classList.toggle('hidden', !ajustes.cronometro && !J.prog.resolvido);
}

function salvar() {
  if (!J) return;
  estado.salvarProgresso(J.d.id, {
    ...J.prog,
    marcas: M.gradeParaTexto(J.marcas),
    tempo: tempoAtual(),
    dicaAtual: J.dicaAtual,
  });
}

// ---------------------------------------------------------------------------
// Fim de jogo, recomeçar, revelar
// ---------------------------------------------------------------------------

function concluir() {
  pausarRelogio();
  const p = J.prog;
  p.resolvido = true;
  p.vezesResolvido = (p.vezesResolvido || 0) + 1;
  p.estrelas = estado.estrelasDaTentativa(p);
  p.melhoresEstrelas = Math.max(p.melhoresEstrelas || 0, p.estrelas);
  p.melhorTempo = p.melhorTempo ? Math.min(p.melhorTempo, p.tempo) : p.tempo;
  J.marcas = Uint8Array.from(J.P.gradeSolucao);
  J.sel = -1;
  J.painelDica = null;
  salvar();
  pintar();
  mostrarTempo();
  atualizarBotoes();
  renderPainel();
  const id = J.d.id;
  clearTimeout(festaTimer);
  festaTimer = setTimeout(() => {
    if (J && J.d.id === id) mostrarFesta();
  }, 450);
}

function mostrarFesta() {
  if (!J) return;
  const p = J.prog;
  const prox = ctx.proximo(J.d.id);
  const motivo = p.estrelas === 3 ? 'Sem verificar e sem pedir dica. Lógica pura!' : p.estrelas === 2 ? 'Resolvido usando “Verificar”.' : 'Resolvido com ajuda das dicas.';
  const recorde = p.vezesResolvido > 1 && p.melhorTempo === p.tempo ? ' · novo recorde!' : '';
  abrirModal(
    `<div class="festa">
      <div class="big">🎉</div>
      <h2>Desafio resolvido!</h2>
      <div class="estrelas-grandes">${estrelasHtml(p.estrelas)}</div>
      <p style="margin-bottom:4px">${esc(motivo)}</p>
      <div class="tempo-final">Tempo: ${formatarTempo(p.tempo)}${recorde}</div>
      ${prox ? `<button class="btn-primary" data-acao="proximo" data-foco>Próximo: ${esc(prox.d.titulo)}</button>` : ''}
      <button class="${prox ? 'btn-secondary' : 'btn-primary'}" data-acao="ver">Ver a grade resolvida</button>
      <button class="btn-secondary" data-acao="voltar">Voltar aos desafios</button>
    </div>`,
    {
      acoes: {
        proximo: () => {
          fecharModal();
          ctx.abrirDesafio(prox.d.id);
        },
        ver: () => fecharModal(),
        voltar: () => {
          fecharModal();
          sair();
        },
      },
    },
  );
}

function recomecar() {
  const comNotas = (J.prog.relacoes || []).length > 0;
  if (!confirm(comNotas ? 'Apagar as marcações, as anotações de relação e o tempo deste desafio e começar de novo?' : 'Apagar as marcações e o tempo deste desafio e começar de novo?')) return;
  pausarRelogio();
  const novo = estado.novoProgresso(J.d, J.prog);
  novo.iniciado = true;
  J.prog = novo;
  J.marcas = M.novaGrade(J.P);
  J.pilha = [];
  J.sel = -1;
  J.erros.clear();
  J.alvo.clear();
  J.painelDica = null;
  J.dicaAtual = 0;
  J.rel.form = novoFormRel();
  salvar();
  pintar();
  renderPainel();
  mostrarTempo();
  atualizarBotoes();
  iniciarRelogio();
  toast('Grade limpa. Boa sorte!');
}

function revelar() {
  if (encerrado()) return avisarEncerrado();
  if (!confirm('Mostrar a resposta encerra esta tentativa, sem estrelas. Continuar?')) return;
  pausarRelogio();
  J.prog.revelado = true;
  J.marcas = Uint8Array.from(J.P.gradeSolucao);
  J.sel = -1;
  J.painelDica = null;
  J.aba = 'quadro';
  J.expandido = true;
  salvar();
  pintar();
  renderPainel();
  mostrarTempo();
  atualizarBotoes();
}

// ---------------------------------------------------------------------------
// Verificar e dica
// ---------------------------------------------------------------------------

function marcadas() {
  let n = 0;
  for (const v of J.marcas) if (v !== VAZIO) n++;
  return n;
}

function destacarErros(lista) {
  J.erros = new Set(lista);
  pintar();
  rolarAte(lista[0]);
  clearTimeout(errosTimer);
  errosTimer = setTimeout(() => {
    if (!J) return;
    J.erros.clear();
    pintar();
  }, 5000);
}

function verificar() {
  if (encerrado()) return avisarEncerrado();
  if (!marcadas()) {
    toast('Nada marcado ainda. Comece pelas dicas diretas!');
    return;
  }
  J.prog.verificacoes++;
  salvar();
  const errs = M.erros(J.P, J.marcas);
  if (!errs.length) {
    toast('Tudo certo até aqui! 👍');
    return;
  }
  destacarErros(errs);
  toast(errs.length === 1 ? '1 marcação errada, destacada em vermelho.' : `${errs.length} marcações erradas, destacadas em vermelho.`);
}

function focoDoPasso(p) {
  if (p.tipo === 'G1' || p.marcas.length <= 1) return p;
  const sim = p.marcas.find(([, v]) => v === SIM);
  return { ...p, marcas: [sim || p.marcas[0]] };
}

function pedirDica() {
  if (encerrado()) return avisarEncerrado();
  const errs = M.erros(J.P, J.marcas);
  if (errs.length) {
    J.painelDica = { tipo: 'erros', erros: errs };
    J.alvo.clear();
    renderPainel();
    return;
  }
  const g = efetiva(ajustes.autoX ? M.autoX(J.P, J.marcas) : null);
  const passo = M.proximoPasso(J.P, g);
  if (!passo || passo.tipo === 'contradicao') {
    toast('Não encontrei um próximo passo a partir daqui.');
    return;
  }
  const foco = focoDoPasso(passo);
  J.prog.dicasUsadas++;
  if (!J.prog.iniciado) J.prog.iniciado = true;
  salvar();
  J.alvo = new Set(foco.marcas.map(([c]) => c));
  J.painelDica = { tipo: 'passo', passo: foco };
  renderPainel();
  pintar();
  rolarAte(foco.marcas[0][0]);
}

function tituloPasso(p) {
  switch (p.tipo) {
    case 'G1': return 'Risque a linha e a coluna';
    case 'G2': return 'Só sobrou uma opção';
    case 'G3': return 'Ligue as informações';
    case 'G4': return 'Cruze as informações';
    case 'G5': return 'Elimine pelas opções que restam';
    case 'dica': return p.direta ? `Use a dica ${p.dica + 1}` : `Releia a dica ${p.dica + 1}`;
    case 'dicas': return `Junte as dicas ${p.dicas[0] + 1} e ${p.dicas[1] + 1}`;
    default: return 'Próximo passo';
  }
}

function cardDica() {
  const pd = J.painelDica;
  if (pd.tipo === 'erros') {
    const n = pd.erros.length;
    return `<div class="dica-card">
      <div class="modal-eyebrow">Dica</div>
      <h3 class="dica-titulo">Antes, um ajuste</h3>
      <div class="dica-box">${n === 1 ? 'Há <b>1 marcação</b> que não bate' : `Há <b>${n} marcações</b> que não batem`} com a solução. A dica parte do que está marcado, então é melhor corrigir primeiro.</div>
      <div class="modal-botoes">
        <button class="btn-secondary" data-acao="mostrar-erros">Mostrar</button>
        <button class="btn-primary" data-acao="apagar-erros">Apagar ${n === 1 ? 'a errada' : 'as erradas'}</button>
      </div>
      <button class="link-fechar" data-acao="fechar-dica">Fechar</button>
    </div>`;
  }
  const p = pd.passo;
  const P = J.P;
  let citacao = '';
  if (p.tipo === 'dica') citacao = `<div class="dica-citada">Dica ${p.dica + 1}: “${esc(P.dicas[p.dica].texto)}”</div>`;
  if (p.tipo === 'dicas') citacao = p.dicas.map((i) => `<div class="dica-citada">Dica ${i + 1}: “${esc(P.dicas[i].texto)}”</div>`).join('');
  const qtd = p.marcas.length;
  return `<div class="dica-card">
    <div class="modal-eyebrow">Dica · próximo passo</div>
    <h3 class="dica-titulo">${esc(tituloPasso(p))}</h3>
    ${citacao}
    <div class="dica-box">${M.descreverPasso(P, p)}</div>
    <div class="modal-botoes">
      <button class="btn-secondary" data-acao="fechar-dica">Fechar</button>
      <button class="btn-primary" data-acao="aplicar-dica">${qtd > 1 ? `Marcar as ${qtd} casas` : 'Marcar para mim'}</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Painel: dicas, história, quadro
// ---------------------------------------------------------------------------

function painelExpandido() {
  return largo.matches || J.expandido;
}

function renderPainel() {
  if (!J) return;
  const exp = painelExpandido();
  const painel = $('painel');
  painel.classList.toggle('expandido', exp);
  $('painel-toggle').setAttribute('aria-label', exp ? 'Recolher painel' : 'Expandir painel');
  const aba = exp ? J.aba : 'dicas';
  painel.classList.toggle('aba-relacao', exp && aba === 'relacao' && !J.painelDica);
  painel.querySelectorAll('[role="tab"]').forEach((b) => {
    const on = !J.painelDica && b.dataset.aba === aba;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const usadas = J.prog.riscadas.length;
  $('aba-cont').textContent = usadas ? `${usadas}/${J.P.dicas.length}` : '';
  const corpo = $('painel-corpo');
  if (J.painelDica) corpo.innerHTML = cardDica();
  else if (!exp) corpo.innerHTML = carrossel();
  else if (aba === 'dicas') corpo.innerHTML = listaDicas();
  else if (aba === 'historia') corpo.innerHTML = historia();
  else if (aba === 'relacao' && J.rel.k >= 0) corpo.innerHTML = abaRelacao();
  else corpo.innerHTML = quadro();
  if (exp && aba === 'dicas' && !J.painelDica) {
    const atual = corpo.querySelector('.dica-item.atual');
    if (atual && corpo.scrollHeight > corpo.clientHeight) atual.scrollIntoView({ block: 'nearest' });
  }
}

function itemDica(i, comClasseAtual) {
  const usada = J.prog.riscadas.includes(i);
  const atual = comClasseAtual && i === J.dicaAtual;
  return `<li class="dica-item${usada ? ' usada' : ''}${atual ? ' atual' : ''}" data-dica="${i}" role="button" aria-pressed="${usada}">
    <span class="dica-num">${i + 1}</span><span class="dica-texto">${esc(J.P.dicas[i].texto)}</span></li>`;
}

function carrossel() {
  const N = J.P.dicas.length;
  return `<div class="carrossel">
    <button class="car-nav" data-car="-1" aria-label="Dica anterior">‹</button>
    <div class="car-dica"><ul class="dicas-lista">${itemDica(J.dicaAtual, false)}</ul>
      <div class="car-rodape">Dica ${J.dicaAtual + 1} de ${N} · toque nela para riscar</div></div>
    <button class="car-nav" data-car="1" aria-label="Próxima dica">›</button>
  </div>`;
}

function listaDicas() {
  let h = '<ul class="dicas-lista">';
  for (let i = 0; i < J.P.dicas.length; i++) h += itemDica(i, true);
  h += '</ul><p class="quadro-nota">Toque numa dica para riscá-la quando já tiver tirado tudo o que ela diz.</p>';
  return h;
}

function historia() {
  const { d, P } = J;
  const chips = P.cats.map((c) => `<span class="cat-chip"><b>${esc(c.nome)}:</b> ${c.itens.map(esc).join(', ')}</span>`).join('');
  return `<p class="historia">${esc(d.introducao)}</p><div class="cat-chips">${chips}</div>`;
}

function quadro() {
  const { P } = J;
  const linhas = M.quadroRespostas(P, J.marcas);
  let h = '<table class="quadro"><thead><tr>';
  for (const c of P.cats) h += `<th>${esc(c.nome)}</th>`;
  h += '</tr></thead><tbody>';
  for (const linha of linhas) {
    h += '<tr>';
    linha.forEach((g, i) => {
      if (i === 0) h += `<td>${esc(P.nomes[g])}</td>`;
      else if (g >= 0) h += `<td>${esc(P.nomes[g])}</td>`;
      else if (g === -2) h += '<td class="vazio conflito">conflito</td>';
      else h += '<td class="vazio">—</td>';
    });
    h += '</tr>';
  }
  h += '</tbody></table><p class="quadro-nota">O quadro se completa sozinho conforme você marca <b class="s-txt">S</b> — inclusive ligações indiretas (se A combina com B, e B com C, A aparece junto de C).</p>';
  return h;
}

// ---------------------------------------------------------------------------
// Aba Relação: o jogador anota relações entre itens ("Renata antes de Marta",
// "Paulo 1 mês depois do suspense") e o app monta as cadeias.
// ---------------------------------------------------------------------------

function novoFormRel() {
  return { a: '', t: '<', v: null, b: '', d: '' };
}

function relacoesValidas(P, ks, lista) {
  if (!Array.isArray(lista)) return [];
  const nItens = P.nomes.length;
  const okItem = (g) => Number.isInteger(g) && g >= 0 && g < nItens;
  return lista.filter((r) => r && ks.includes(r.k) && okItem(r.a) && okItem(r.b) && r.a !== r.b && R.TIPOS.includes(r.t));
}

function abaRelacao() {
  const mostrar = !!ajustes.relPossiveis;
  return R.html(J.P, {
    k: J.rel.k,
    form: J.rel.form,
    rels: J.prog.relacoes,
    mostrarPossiveis: mostrar,
    grade: mostrar ? efetiva(J.ax) : null,
  });
}

function ajustarMedida() {
  const f = J.rel.form;
  if (!R.exatas(J.P, J.rel.k) && R.preciso(f.t)) f.t = '<';
  if (!R.preciso(f.t)) return;
  const difs = R.diferencas(J.P, J.rel.k);
  if (!difs.includes(Number(f.v))) f.v = difs[0];
}

const INVERSO = { '<': '>', '>': '<', '+': '-', '-': '+', '~': '~' };

function anotarRelacao() {
  const f = J.rel.form;
  const k = J.rel.k;
  if (f.a === '' || f.b === '') return toast('Escolha os dois itens.');
  const a = Number(f.a);
  const b = Number(f.b);
  if (a === b) return toast('Escolha dois itens diferentes.');
  ajustarMedida();
  const v = R.preciso(f.t) ? Number(f.v) : null;
  const igual = (r) => r.k === k && ((r.a === a && r.b === b && r.t === f.t) || (r.a === b && r.b === a && r.t === INVERSO[f.t])) && (v == null || r.v === v);
  if (J.prog.relacoes.some(igual)) return toast('Essa relação já está anotada.');
  const id = J.prog.relacoes.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
  const nova = { id, k, a, b, t: f.t, v, d: f.d === '' ? null : Number(f.d) };
  J.prog.relacoes.push(nova);
  if (!J.prog.iniciado && !encerrado()) {
    J.prog.iniciado = true;
    iniciarRelogio();
  }
  // Como no papel: a próxima anotação continua a cadeia a partir do 2º item.
  f.a = String(b);
  f.b = '';
  salvar();
  renderPainel();
}

function apagarRelacao(id) {
  J.prog.relacoes = J.prog.relacoes.filter((r) => String(r.id) !== String(id));
  salvar();
  renderPainel();
}

function limparRelacoes() {
  const k = J.rel.k;
  const n = J.prog.relacoes.filter((r) => r.k === k).length;
  if (!n) return;
  if (!confirm(`Apagar ${n === 1 ? 'a anotação' : `as ${n} anotações`} de ${J.P.cats[k].nome}?`)) return;
  J.prog.relacoes = J.prog.relacoes.filter((r) => r.k !== k);
  salvar();
  renderPainel();
}

// Setas da faixa de dica: … → última dica → anotação livre → 1ª dica → …
function navegarDicaRel(passo) {
  const N = J.P.dicas.length;
  const f = J.rel.form;
  const atual = f.d === '' ? N : Number(f.d);
  const prox = (atual + passo + N + 1) % (N + 1);
  f.d = prox === N ? '' : String(prox);
  if (f.d !== '') J.dicaAtual = prox;
  salvar();
  renderPainel();
}

function mudancaPainel(e) {
  if (!J) return;
  const el = e.target.closest('[data-rel]');
  if (!el) return;
  const campo = el.dataset.rel;
  if (campo === 'possiveis') {
    ajustes = estado.getAjustes();
    ajustes.relPossiveis = el.checked;
    estado.salvarAjustes(ajustes);
  } else if (['a', 'b', 't', 'v'].includes(campo)) {
    J.rel.form[campo] = el.value;
    ajustarMedida();
  }
  renderPainel();
}

function alternarUsada(i) {
  const s = new Set(J.prog.riscadas);
  if (s.has(i)) s.delete(i);
  else s.add(i);
  J.prog.riscadas = [...s].sort((a, b) => a - b);
  J.dicaAtual = i;
  salvar();
  renderPainel();
}

function cliquePainel(e) {
  if (!J) return;
  const acao = e.target.closest('[data-acao]');
  if (acao) {
    const a = acao.dataset.acao;
    if (a === 'fechar-dica') {
      J.painelDica = null;
      J.alvo.clear();
      renderPainel();
      pintar();
    } else if (a === 'aplicar-dica') {
      const p = J.painelDica && J.painelDica.passo;
      J.painelDica = null;
      renderPainel();
      if (p) aplicar(p.marcas);
    } else if (a === 'mostrar-erros') {
      const errs = M.erros(J.P, J.marcas);
      J.prog.verificacoes++;
      salvar();
      J.painelDica = null;
      renderPainel();
      if (errs.length) destacarErros(errs);
    } else if (a === 'apagar-erros') {
      const errs = M.erros(J.P, J.marcas);
      J.prog.verificacoes++;
      J.painelDica = null;
      aplicar(errs.map((c) => [c, VAZIO]));
      renderPainel();
      toast(errs.length === 1 ? 'Marcação errada apagada.' : `${errs.length} marcações erradas apagadas.`);
    } else if (a === 'rel-add') {
      anotarRelacao();
    } else if (a === 'rel-limpar') {
      limparRelacoes();
    }
    return;
  }
  const relCat = e.target.closest('[data-rel-cat]');
  if (relCat) {
    J.rel.k = Number(relCat.dataset.relCat);
    ajustarMedida();
    renderPainel();
    return;
  }
  const relNav = e.target.closest('[data-rel-nav]');
  if (relNav) {
    navegarDicaRel(Number(relNav.dataset.relNav));
    return;
  }
  const relDel = e.target.closest('[data-rel-del]');
  if (relDel) {
    apagarRelacao(relDel.dataset.relDel);
    return;
  }
  const nav = e.target.closest('[data-car]');
  if (nav) {
    const N = J.P.dicas.length;
    J.dicaAtual = (J.dicaAtual + Number(nav.dataset.car) + N) % N;
    renderPainel();
    return;
  }
  const item = e.target.closest('[data-dica]');
  if (item) alternarUsada(Number(item.dataset.dica));
}

function cliqueAba(aba) {
  if (!J) return;
  J.painelDica = null;
  J.alvo.clear();
  if (aba === 'relacao' && J.rel.k >= 0 && (J.aba !== 'relacao' || !painelExpandido())) J.rel.form.d = String(J.dicaAtual);
  if (largo.matches) {
    J.aba = aba;
  } else if (!J.expandido) {
    J.aba = aba;
    J.expandido = true;
  } else if (J.aba === aba) {
    J.expandido = false;
    J.aba = 'dicas';
  } else {
    J.aba = aba;
  }
  renderPainel();
  pintar();
}

function alternarPainel() {
  J.painelDica = null;
  J.expandido = !J.expandido;
  if (!J.expandido) J.aba = 'dicas';
  renderPainel();
}

// ---------------------------------------------------------------------------
// Introdução e menu
// ---------------------------------------------------------------------------

function mostrarIntro(primeira) {
  const { d, P } = J;
  pausarRelogio();
  const chips = P.cats.map((c) => `<span class="cat-chip"><b>${esc(c.nome)}:</b> ${c.itens.map(esc).join(', ')}</span>`).join('');
  abrirModal(
    `<div class="modal-eyebrow">${esc(NIVEL[d.nivel] || d.nivel)}${TIPO[d.tipo] ? ` · ${TIPO[d.tipo]}` : ''} · ${P.m} categorias × ${P.n} itens · ${P.dicas.length} dicas</div>
     <h2>${esc(d.titulo)}</h2>
     <p>${esc(d.introducao)}</p>
     <div class="cat-chips" style="margin-bottom:16px">${chips}</div>
     <button class="btn-primary" data-acao="comecar" data-foco>${primeira ? 'Começar' : 'Voltar ao jogo'}</button>`,
    {
      fecharNoFundo: !primeira,
      acoes: { comecar: () => fecharModal() },
      aoFechar: () => {
        if (!J || J.fechando) return;
        if (!J.prog.iniciado && !encerrado()) {
          J.prog.iniciado = true;
          salvar();
        }
        iniciarRelogio();
      },
    },
  );
}

function abrirMenu() {
  $('menu-jogo').classList.toggle('hidden');
}

function fecharMenu() {
  $('menu-jogo').classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function toast(msg, ms = 2800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(esconderToast, ms);
}

function esconderToast() {
  $('toast').classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function ligarEventos() {
  const area = $('grade-area');

  area.addEventListener('pointerdown', (e) => {
    const td = e.target.closest('td[data-c]');
    if (!td || !J) return;
    const c = Number(td.dataset.c);
    const lp = { c, x: e.clientX, y: e.clientY, disparou: false, timer: null };
    lp.timer = setTimeout(() => {
      lp.disparou = true;
      tocar(c, true);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 450);
    J.lp = lp;
  });
  const cancelar = () => {
    if (J && J.lp) clearTimeout(J.lp.timer);
  };
  area.addEventListener('pointermove', (e) => {
    if (!J || !J.lp) return;
    if (Math.abs(e.clientX - J.lp.x) > 8 || Math.abs(e.clientY - J.lp.y) > 8) cancelar();
  });
  area.addEventListener('pointerup', cancelar);
  area.addEventListener('pointercancel', cancelar);
  area.addEventListener('scroll', cancelar, { passive: true });
  area.addEventListener('contextmenu', (e) => {
    if (e.target.closest('td[data-c]')) e.preventDefault();
  });
  area.addEventListener('click', (e) => {
    const td = e.target.closest('td[data-c]');
    if (!td || !J) return;
    const c = Number(td.dataset.c);
    if (J.lp && J.lp.disparou && J.lp.c === c) {
      J.lp = null;
      return;
    }
    J.lp = null;
    tocar(c);
  });

  $('btn-voltar').addEventListener('click', sair);
  $('btn-desfazer').addEventListener('click', desfazer);
  $('btn-menos').addEventListener('click', () => zoom(-1));
  $('btn-mais').addEventListener('click', () => zoom(1));
  $('btn-verificar').addEventListener('click', verificar);
  $('btn-dica').addEventListener('click', pedirDica);
  $('painel-corpo').addEventListener('click', cliquePainel);
  $('painel-corpo').addEventListener('change', mudancaPainel);
  $('painel-toggle').addEventListener('click', alternarPainel);
  document.querySelectorAll('#painel [role="tab"]').forEach((b) => b.addEventListener('click', () => cliqueAba(b.dataset.aba)));

  $('btn-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    abrirMenu();
  });
  $('menu-jogo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b || !J) return;
    fecharMenu();
    if (b.dataset.acao === 'historia') mostrarIntro(false);
    else if (b.dataset.acao === 'recomecar') recomecar();
    else if (b.dataset.acao === 'resposta') revelar();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menu-jogo') && !e.target.closest('#btn-menu')) fecharMenu();
  });

  document.addEventListener('visibilitychange', () => {
    if (!J) return;
    if (document.visibilityState === 'hidden') {
      pausarRelogio();
      salvar();
    } else {
      iniciarRelogio();
    }
  });
  window.addEventListener('pagehide', () => {
    if (J) {
      pausarRelogio();
      salvar();
    }
  });

  let t = null;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!J) return;
      aplicarTamanhos();
      renderPainel();
    }, 150);
  });
  largo.addEventListener('change', () => J && renderPainel());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => J && aplicarTamanhos());

  document.addEventListener('keydown', teclado);
}

function teclado(e) {
  if (!J || modalAberto()) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return; // o botão age sozinho
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    desfazer();
    return;
  }
  const setas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (setas[e.key]) {
    e.preventDefault();
    if (J.sel < 0) {
      J.sel = J.pos.get(0);
    } else {
      const [dr, dc] = setas[e.key];
      let r = J.celRi[J.sel];
      let c = J.celCi[J.sel];
      for (let k = 0; k < 40; k++) {
        r += dr;
        c += dc;
        if (r < 0 || c < 0 || r > 40 || c > 40) break;
        const alvo = J.pos.get(r * 1000 + c);
        if (alvo !== undefined) {
          J.sel = alvo;
          break;
        }
      }
    }
    pintar();
    rolarAte(J.sel);
    return;
  }
  if (J.sel < 0) return;
  const k = e.key.toLowerCase();
  if (k === 'x' || k === '1') marcarDireto(J.sel, NAO);
  else if (k === 'o' || k === '2' || k === 'enter') marcarDireto(J.sel, SIM);
  else if (k === ' ') {
    e.preventDefault();
    tocar(J.sel);
  } else if (k === 'backspace' || k === 'delete' || k === '0') marcarDireto(J.sel, VAZIO);
}
