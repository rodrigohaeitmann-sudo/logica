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
const ZOOM_MAX = 6;
// Abaixo do tamanho normal, cada toque em "Menor" reduz as casas em ~20% (e os
// nomes, mais devagar), até a grade inteira caber na área sem rolar.
const PASSO_MENOR = 0.8;
const CEL_MIN = 9; // abaixo disso a linha não encolhe mais (altura do nome, com a menor escala)

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
    rel: { k: ks.length ? ks[0] : -1, form: novoFormRel(), editando: null },
  };
  $('aba-relacao').classList.toggle('hidden', !ks.length);
  $('jogo-nivel').textContent = `${NIVEL[d.nivel] || d.nivel} · ${P.m} categorias × ${P.n} itens`;
  $('jogo-nome').textContent = d.titulo;
  document.title = `${d.titulo} — Lógica`;
  fecharMenu();
  montarGrade();
  renderPainel();
  aplicarTamanhos(); // de novo: com o painel desenhado, a área da grade mudou de altura
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
  // As relações anotadas ficam no espaço vazio da escada, no último bloco de
  // linhas (como na margem da revista), e descem por uma linha extra abaixo da
  // grade (altura em --notas-extra), para caber mais coisa sem rolar.
  const comNotas = J.rel.k >= 0;
  const linhas = categoriasLinha(P);
  const blocoNotas = linhas[linhas.length - 1];
  let ri = 0;
  for (const rc of linhas) {
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
      if (resto > 0 && comNotas && rc === blocoNotas) {
        if (i === 0) h += `<td class="fora notas-cel" colspan="${resto}" rowspan="${n + 1}" style="--n:${n}"><div class="notas" id="notas-grade" role="button" tabindex="0" aria-label="Relações anotadas: toque para abrir a aba Relação"></div></td>`;
      } else if (resto > 0) h += `<td class="fora" colspan="${resto}" aria-hidden="true"></td>`;
      h += '</tr>';
      ri++;
    }
    if (comNotas && rc === blocoNotas && (m - 1 - ncg) > 0) {
      h += `<tr class="notas-extra"><td class="fora notas-extra-esq" colspan="${2 + ncg * n}" aria-hidden="true"></td></tr>`;
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
  pintarNotas();
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

// Tamanhos da grade (variáveis CSS da tabela).
//   zoom 0: casas que fazem a grade caber na largura (até 40px), ou 28px com a
//           grade rolando para os lados;
//   zoom > 0: +4px por toque (até 60px);
//   zoom < 0: −20% por toque, com os nomes encolhendo junto (mais devagar), até
//           o menor nível, em que a grade inteira cabe na área, sem rolar.
// O nível mínimo depende da grade e da tela; um zoom salvo abaixo dele vale como
// o mínimo.
function aplicarTamanhos() {
  if (!J || !J.tabela) return;
  const { P } = J;
  const area = $('grade-area');
  const nomesLinha = [];
  for (const rc of categoriasLinha(P)) for (let i = 0; i < P.n; i++) nomesLinha.push(P.nomes[rc * P.n + i]);
  const nomesColuna = [];
  for (const c of categoriasColuna(P)) for (let i = 0; i < P.n; i++) nomesColuna.push(P.nomes[c * P.n + i]);
  const wItem0 = Math.ceil(Math.min(112, Math.max(44, larguraTexto(nomesLinha) + 14)));
  const hItem0 = Math.ceil(Math.min(112, Math.max(36, larguraTexto(nomesColuna) + 12)));
  const cols = (P.m - 1) * P.n; // também é o número de linhas da escada
  const areaW = area.clientWidth || 340;
  const areaH = area.clientHeight || 400;
  const caber = Math.floor((areaW - W_CAT - wItem0 - 6) / cols);
  const cel0 = caber >= 22 ? Math.min(caber, 40) : 28;
  const escDe = (cel) => Math.max(0.6, Math.min(1, Math.sqrt(cel / cel0)));
  const medidas = (cel, esc = 1) => ({
    cel,
    esc,
    wItem: Math.ceil(wItem0 * esc),
    hItem: Math.ceil(hItem0 * esc),
    wCat: Math.round(W_CAT * esc),
    hCat: Math.round(H_CAT * esc),
  });
  // Bordas e arredondamentos: o que a tabela mede além da soma das partes
  // (sem a extensão das notas, que se ajusta no fim).
  J.tabela.style.setProperty('--notas-extra', '0px');
  aplicarMedidas(medidas(cel0));
  const folgaW = J.tabela.offsetWidth - (W_CAT + wItem0 + cols * cel0);
  const folgaH = J.tabela.offsetHeight - (H_CAT + hItem0 + cols * cel0);
  // A linha nunca fica mais baixa que o nome dela (fonte de 12px na escala, entrelinha 1,15).
  const alturaLinha = (t) => Math.max(t.cel, Math.ceil(12 * t.esc * 1.15));
  const cabe = (t) => t.wCat + t.wItem + cols * t.cel + folgaW <= areaW - 2 && t.hCat + t.hItem + cols * alturaLinha(t) + folgaH <= areaH - 2;
  let celCabe = CEL_MIN; // maior casa com a grade inteira à vista
  for (let c = cel0; c > CEL_MIN; c--) {
    if (cabe(medidas(c, escDe(c)))) {
      celCabe = c;
      break;
    }
  }
  const celNivel = (z) => Math.round(cel0 * PASSO_MENOR ** -z);
  let zMin = 0;
  if (cel0 > celCabe) {
    zMin = -1;
    while (celNivel(zMin) > celCabe && zMin > -30) zMin--;
  }
  const z = Math.max(zMin, Math.min(ZOOM_MAX, Math.round(ajustes.zoom || 0)));
  let t;
  if (z >= 0) t = medidas(Math.min(60, cel0 + z * 4));
  else {
    const cel = z === zMin ? celCabe : celNivel(z);
    t = medidas(cel, escDe(cel));
  }
  aplicarMedidas(t);
  // No menor nível, confere de verdade (arredondamentos) e reduz se precisar.
  for (let i = 0; i < 4 && z === zMin && zMin < 0 && t.cel > CEL_MIN && (J.tabela.offsetWidth > areaW || J.tabela.offsetHeight > areaH); i++) {
    t = medidas(t.cel - 1, escDe(t.cel - 1));
    aplicarMedidas(t);
  }
  // Notas mais altas: descem até o fim da área quando sobra espaço embaixo da
  // grade; se a grade já rola, descem pelo menos um bloco. (Quando a grade cabe
  // inteira, as notas não fazem ela passar a rolar.)
  if (J.rel.k >= 0) {
    const livre = areaH - J.tabela.offsetHeight - 2;
    const cabeInteira = J.tabela.offsetWidth <= areaW && J.tabela.offsetHeight <= areaH;
    const extra = cabeInteira ? Math.max(0, livre) : Math.max(Math.round(P.n * t.cel), livre);
    J.tabela.style.setProperty('--notas-extra', `${extra}px`);
  }
  J.zoom = z;
  J.zoomMin = zMin;
  $('btn-menos').disabled = z <= zMin;
  $('btn-mais').disabled = z >= ZOOM_MAX || t.cel >= 60;
}

function aplicarMedidas(t) {
  const { P } = J;
  const area = $('grade-area');
  const s = J.tabela.style;
  s.setProperty('--cel', `${t.cel}px`);
  s.setProperty('--w-item', `${t.wItem}px`);
  s.setProperty('--h-item', `${t.hItem}px`);
  s.setProperty('--w-cat', `${t.wCat}px`);
  s.setProperty('--h-cat', `${t.hCat}px`);
  s.setProperty('--esc', String(+t.esc.toFixed(3)));
  J.tam = { cel: t.cel, wItem: t.wItem, hItem: t.hItem, wCat: t.wCat, hCat: t.hCat };
  if (J.rel.k >= 0) {
    // O espaço vazio começa depois do 1º bloco de colunas; as notas ocupam a
    // parte dele que aparece sem rolar a grade para o lado (margem de 6px).
    const inicio = t.wCat + t.wItem + P.n * t.cel;
    const total = (P.m - 2) * P.n * t.cel - 12;
    const visivel = (area.clientWidth || 340) - inicio - 16;
    s.setProperty('--notas-w', `${Math.round(Math.max(Math.min(total, visivel), Math.min(total, 120)))}px`);
  }
}

function zoom(delta) {
  ajustes = estado.getAjustes();
  const atual = J.zoom ?? Math.round(ajustes.zoom || 0);
  ajustes.zoom = Math.max(J.zoomMin ?? -30, Math.min(ZOOM_MAX, atual + delta));
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
  const esq = a.left + J.tam.wCat + J.tam.wItem;
  const topo = a.top + J.tam.hCat + J.tam.hItem;
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
  J.rel.editando = null;
  salvar();
  pintar();
  renderPainel();
  pintarNotas();
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

let pensando = false;

function pedirDica() {
  if (encerrado()) return avisarEncerrado();
  if (pensando) return;
  const errs = M.erros(J.P, J.marcas);
  if (errs.length) {
    J.painelDica = { tipo: 'erros', erros: errs };
    J.alvo.clear();
    renderPainel();
    return;
  }
  // A explicação por hipótese pode levar um instante: mostra o botão ocupado
  // e só calcula depois que a tela for atualizada.
  const btn = $('btn-dica');
  const jogo = J;
  pensando = true;
  btn.classList.add('pensando');
  btn.setAttribute('aria-busy', 'true');
  requestAnimationFrame(() =>
    setTimeout(() => {
      try {
        if (J === jogo && !encerrado()) mostrarProximoPasso();
      } finally {
        pensando = false;
        btn.classList.remove('pensando');
        btn.removeAttribute('aria-busy');
      }
    }, 0),
  );
}

function mostrarProximoPasso() {
  const g = efetiva(ajustes.autoX ? M.autoX(J.P, J.marcas) : null);
  // Em aparelhos lentos, não espera demais por uma explicação ainda mais curta.
  const passo = M.proximoPassoDica(J.P, g, { limiteMs: 500 });
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
    case 'hipotese': return 'Teste uma hipótese';
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
  const citar = (lista) => lista.map((i) => `<div class="dica-citada">Dica ${i + 1}: “${esc(P.dicas[i].texto)}”</div>`).join('');
  let citacao = '';
  if (p.tipo === 'dica') citacao = citar([p.dica]);
  if (p.tipo === 'dicas') citacao = citar(p.dicas);
  if (p.tipo === 'hipotese') citacao = citar(M.dicasDaProva(p.prova));
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
// Aba Relação: o jogador anota relações entre itens na forma padronizada da
// margem da revista — o menor primeiro, a diferença (ou ?) e o maior:
// "Renata ? Marta", "Suspense 1 Paulo" — e o app monta as cadeias.
// ---------------------------------------------------------------------------

// auto: dica cujos itens o app pôs no formulário · manual: o jogador escolheu
// itens à mão (e ainda não anotou)
function novoFormRel() {
  return { a: '', q: '?', b: '', d: '', auto: null, manual: false };
}

// Põe no formulário os dois itens da próxima comparação da dica escolhida que
// ainda não foi anotada (na ordem do texto, com "?"): o jogador decide quem vem
// antes e a diferença. Sem `forcar`, só preenche se o formulário estiver vazio
// ou com os itens de outra dica (não apaga o que o jogador escolheu).
function preencherPelaDica(forcar = false) {
  if (!J || J.rel.k < 0 || J.rel.editando != null) return;
  const f = J.rel.form;
  const d = f.d === '' ? null : Number(f.d);
  const vazio = f.a === '' && f.b === '';
  const deOutra = f.auto != null && f.auto !== d;
  if (!forcar && !vazio && !deOutra) return;
  const s = d == null ? null : R.sugestoes(J.P, d).find((x) => !R.parAnotado(J.prog.relacoes, x));
  if (s) {
    J.rel.k = s.k;
    f.a = String(s.a);
    f.b = String(s.b);
    f.q = '?';
    f.auto = d;
    f.manual = false;
  } else if (f.auto != null) {
    f.a = '';
    f.b = '';
    f.q = '?';
    f.auto = null;
  }
}

// Ao abrir a aba Relação, o formulário passa a ser da dica em foco (a do
// carrossel ou a última tocada na lista) e já vem com os itens dela — a não ser
// que o jogador esteja no meio de uma anotação à mão na mesma dica.
function formParaDicaAtual() {
  const f = J.rel.form;
  const nova = String(J.dicaAtual);
  const mudou = f.d !== nova;
  f.d = nova;
  preencherPelaDica(mudou || !f.manual);
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
    editando: J.rel.editando,
    riscadas: J.prog.riscadas,
  });
}

function pintarNotas() {
  const el = document.getElementById('notas-grade');
  if (!el || !J) return;
  el.innerHTML = R.notasHtml(J.P, J.prog.relacoes, J.rel.editando, J.prog.riscadas);
}

// Rola a grade até as notas (com um brilho rápido) para mostrar onde a
// anotação foi parar.
function mostrarNotas(piscar = false) {
  const el = document.getElementById('notas-grade');
  const area = $('grade-area');
  if (!el || !area || !J.tam) return;
  const a = area.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const topo = a.top + J.tam.hCat + J.tam.hItem;
  const esq = a.left + J.tam.wCat + J.tam.wItem;
  let dx = 0;
  let dy = 0;
  if (r.top < topo || r.top > a.bottom - 48) dy = r.top - topo - 6;
  if (r.left < esq || r.left > a.right - 64) dx = r.left - esq - 6;
  if (dx || dy) area.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
  if (piscar) {
    el.classList.remove('pisca');
    void el.offsetWidth;
    el.classList.add('pisca');
  }
}

// Abre a aba Relação (e, se vier um id, a anotação para alterar).
function abrirRelacao(id = null) {
  if (!J || J.rel.k < 0) return;
  J.painelDica = null;
  J.alvo.clear();
  const abrindo = J.aba !== 'relacao' || !painelExpandido();
  J.aba = 'relacao';
  if (!largo.matches) J.expandido = true;
  if (id != null) editarRelacao(id, false);
  else if (abrindo) formParaDicaAtual();
  renderPainel();
  pintar();
  pintarNotas();
  setTimeout(() => J && mostrarNotas(), 260); // depois que o painel termina de abrir
}

function ajustarMedida() {
  R.ajustarForm(J.P, J.rel.k, J.rel.form);
}

function anotarRelacao() {
  const f = J.rel.form;
  const k = J.rel.k;
  if (f.a === '' || f.b === '') return toast('Escolha os dois itens.');
  if (f.a === f.b) return toast('Escolha dois itens diferentes.');
  ajustarMedida();
  const { a, b, t, v } = R.relDoForm(f);
  const nova = { id: 0, k, a, b, t, v, d: f.d === '' ? null : Number(f.d) };
  const ja = R.jaImplica(J.prog.relacoes, nova);
  if (ja) return toast(`Já está anotado: ${R.compacto(J.P, ja)}.`);
  nova.id = J.prog.relacoes.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
  const velhas = R.superadas(J.prog.relacoes, nova);
  J.prog.relacoes = J.prog.relacoes.filter((r) => !velhas.includes(r));
  J.prog.relacoes.push(nova);
  if (velhas.length) toast(`Anotado no lugar de ${velhas.map((r) => R.compacto(J.P, r)).join(', ')}.`);
  if (!J.prog.iniciado && !encerrado()) {
    J.prog.iniciado = true;
    iniciarRelogio();
  }
  // Como no papel: a próxima anotação continua a cadeia a partir do maior —
  // a não ser que a dica tenha outra comparação ainda não anotada.
  f.a = String(b);
  f.b = '';
  f.q = '?';
  f.auto = null;
  f.manual = false;
  preencherPelaDica(true);
  salvar();
  renderPainel();
  pintarNotas();
  mostrarNotas(true);
}

// Carrega uma anotação no formulário para alterar (Salvar/Cancelar).
function editarRelacao(id, redesenhar = true) {
  const r = J.prog.relacoes.find((x) => String(x.id) === String(id));
  if (!r) return;
  J.rel.editando = r.id;
  J.rel.k = r.k;
  J.rel.form = R.formDe(r);
  if (r.d != null) J.dicaAtual = r.d;
  if (redesenhar) {
    renderPainel();
    pintarNotas();
  }
  const corpo = $('painel-corpo');
  if (corpo) corpo.scrollTop = 0;
}

function salvarEdicao() {
  const f = J.rel.form;
  const k = J.rel.k;
  const r = J.prog.relacoes.find((x) => String(x.id) === String(J.rel.editando));
  if (!r) return cancelarEdicao();
  if (f.a === '' || f.b === '') return toast('Escolha os dois itens.');
  if (f.a === f.b) return toast('Escolha dois itens diferentes.');
  ajustarMedida();
  const nova = { ...R.relDoForm(f), k, d: f.d === '' ? null : Number(f.d) };
  const outras = J.prog.relacoes.filter((x) => x !== r);
  const ja = R.jaImplica(outras, nova);
  if (ja) return toast(`Já está anotado: ${R.compacto(J.P, ja)}.`);
  const velhas = R.superadas(outras, nova);
  Object.assign(r, nova);
  J.prog.relacoes = J.prog.relacoes.filter((x) => !velhas.includes(x));
  J.rel.editando = null;
  J.rel.form = { ...novoFormRel(), d: f.d };
  preencherPelaDica();
  salvar();
  renderPainel();
  pintarNotas();
  mostrarNotas(true);
  toast('Anotação alterada.');
}

function cancelarEdicao() {
  const d = J.rel.form.d;
  J.rel.editando = null;
  J.rel.form = { ...novoFormRel(), d };
  preencherPelaDica();
  renderPainel();
  pintarNotas();
}

function apagarRelacao(id) {
  J.prog.relacoes = J.prog.relacoes.filter((r) => String(r.id) !== String(id));
  if (String(J.rel.editando) === String(id)) {
    J.rel.editando = null;
    J.rel.form = { ...novoFormRel(), d: J.rel.form.d };
  }
  preencherPelaDica();
  salvar();
  renderPainel();
  pintarNotas();
}

function limparRelacoes() {
  const k = J.rel.k;
  const n = J.prog.relacoes.filter((r) => r.k === k).length;
  if (!n) return;
  if (!confirm(`Apagar ${n === 1 ? 'a anotação' : `as ${n} anotações`} de ${J.P.cats[k].nome}?`)) return;
  J.prog.relacoes = J.prog.relacoes.filter((r) => r.k !== k);
  if (J.rel.editando != null && !J.prog.relacoes.some((r) => String(r.id) === String(J.rel.editando))) {
    J.rel.editando = null;
    J.rel.form = { ...novoFormRel(), d: J.rel.form.d };
  }
  preencherPelaDica();
  salvar();
  renderPainel();
  pintarNotas();
}

// Setas da faixa de dica: … → última dica → anotação livre → 1ª dica → …
function navegarDicaRel(passo) {
  const N = J.P.dicas.length;
  const f = J.rel.form;
  const atual = f.d === '' ? N : Number(f.d);
  const prox = (atual + passo + N + 1) % (N + 1);
  f.d = prox === N ? '' : String(prox);
  if (f.d !== '') J.dicaAtual = prox;
  preencherPelaDica(true);
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
  } else if (['a', 'b', 'q'].includes(campo)) {
    J.rel.form[campo] = el.value;
    if (campo !== 'q') {
      J.rel.form.auto = null; // o jogador trocou um dos itens
      J.rel.form.manual = true;
    }
    ajustarMedida();
  }
  renderPainel();
}

function inverterForm() {
  const f = J.rel.form;
  [f.a, f.b] = [f.b, f.a];
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
  pintarNotas(); // as anotações dessa dica ficam riscadas (ou voltam) na grade
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
    } else if (a === 'rel-inverter') {
      inverterForm();
    } else if (a === 'rel-salvar') {
      salvarEdicao();
    } else if (a === 'rel-cancelar') {
      cancelarEdicao();
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
  const relEd = e.target.closest('[data-rel-edit]');
  if (relEd) {
    if (String(J.rel.editando) === String(relEd.dataset.relEdit)) cancelarEdicao();
    else editarRelacao(relEd.dataset.relEdit);
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
  if (aba === 'relacao' && J.rel.k >= 0 && (J.aba !== 'relacao' || !painelExpandido())) formParaDicaAtual();
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
    if (!J) return;
    const notas = e.target.closest('#notas-grade');
    if (notas) {
      const ed = e.target.closest('[data-rel-edit]');
      abrirRelacao(ed ? ed.dataset.relEdit : null);
      return;
    }
    const td = e.target.closest('td[data-c]');
    if (!td) return;
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
  if (e.target && e.target.id === 'notas-grade' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    abrirRelacao();
    return;
  }
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
