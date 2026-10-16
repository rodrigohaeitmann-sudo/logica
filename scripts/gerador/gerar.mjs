#!/usr/bin/env node
// Gerador de desafios de lógica (associação em grade).
//
// Para cada desafio: sorteia um tema, as categorias e uma solução; sorteia fatos
// verdadeiros (dicas candidatas) do tipo pedido; junta dicas até a solução ser
// única e dedutível pelo motor (o mesmo do app); poda tudo o que sobrar; mede o
// nível (médio = resolve sem juntar duas dicas); escreve as frases em português.
//
// Uso:
//   node scripts/gerador/gerar.mjs --plano                    mostra o plano de desafios
//   node scripts/gerador/gerar.mjs --gerar 6-100 [--saida d]  gera os desafios do plano
//        (padrão: grava em desafios/ e anota tema/semente em scripts/gerador/registro.json;
//         depois, inclua os arquivos novos em desafios/index.json)
//   node scripts/gerador/gerar.mjs --teste tema estilo nivel m n [semente]

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../../js/motor.js';
import { TEMAS, NOMES_M, NOMES_F, SOBRENOMES } from './temas.mjs';
import { aleatorio, frase, flex, juntar, cap, extenso, slug } from './lingua.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const range = (n) => Array.from({ length: n }, (_, i) => i);
const chaveTexto = (s) => String(s).normalize('NFC').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Instância: categorias, itens, solução
// ---------------------------------------------------------------------------

function escolherNomes(r, n, proibidos, iniciaisProibidas = new Set()) {
  for (let t = 0; t < 200; t++) {
    const nf = r.int(1, n - 1);
    const fem = r.amostra(NOMES_F.filter((x) => !proibidos.has(x)), nf).map((x) => ({ r: x, gen: 'f' }));
    const mas = r.amostra(NOMES_M.filter((x) => !proibidos.has(x)), n - nf).map((x) => ({ r: x, gen: 'm' }));
    const todos = [...fem, ...mas];
    const ini = new Set(todos.map((x) => x.r[0]));
    if (ini.size === n && todos.every((x) => !iniciaisProibidas.has(x.r[0]))) return todos;
  }
  return null;
}

function categoriasDoEstilo(tema, estilo, k, r) {
  const nominais = tema.categorias.filter((c) => !c.ordem);
  const ordenadas = tema.categorias.filter((c) => c.ordem);
  const prinOrd = !!tema.principal.ordem;
  if (estilo === 'associacao') {
    if (tema.semAssociacao || nominais.length < k) return null;
    return r.amostra(nominais, k);
  }
  const naoNum = ordenadas.filter((c) => !c.numerica);
  const num = ordenadas.filter((c) => c.numerica);
  let ords = [];
  if (estilo === 'ordem') {
    if (!naoNum.length && !prinOrd) return null;
    if (naoNum.length) ords.push(r.escolha(naoNum));
  } else if (estilo === 'calculo') {
    if (!num.length) return null;
    ords.push(r.escolha(num));
  } else {
    if (!ordenadas.length && !prinOrd) return null;
    if (ordenadas.length) ords.push(r.escolha(ordenadas));
  }
  const p2 = estilo === 'misto' ? 0.5 : 0.35;
  if (k >= 3 && r.chance(p2)) {
    const resto = ordenadas.filter((c) => !ords.includes(c) && (estilo !== 'ordem' || !c.numerica || r.chance(0.5)));
    if (resto.length) ords.push(r.escolha(resto));
  }
  const resto = r.embaralhar(ordenadas.filter((c) => !ords.includes(c)));
  while (ords.length + nominais.length < k && resto.length) ords.push(resto.pop());
  if (ords.length > k) ords = ords.slice(0, k);
  if (ords.length + nominais.length < k) return null;
  const noms = r.amostra(nominais, k - ords.length);
  return [...r.embaralhar(noms), ...ords];
}

function instanciar(tema, estilo, m, n, r) {
  const escolhidas = categoriasDoEstilo(tema, estilo, m - 1, r);
  if (!escolhidas) return null;
  const que = tema.que;
  const usados = new Set();
  const cats = [];

  // Principal
  const sp = tema.principal;
  let itensP;
  if (sp.tipo === 'pessoas') {
    itensP = escolherNomes(r, n, usados);
    if (!itensP) return null;
    itensP = itensP.map((x) => ({ r: x.r, x: x.r, gen: x.gen }));
  } else if (sp.tipo === 'sobrenomes') {
    let lista = null;
    for (let t = 0; t < 100 && !lista; t++) {
      const c = r.amostra(SOBRENOMES, n);
      if (new Set(c.map((x) => x[0])).size === n) lista = c;
    }
    if (!lista) return null;
    itensP = lista.map((x) => ({ r: x, x: `a família ${x}`, gen: 'f' }));
  } else if (sp.tipo === 'lista') {
    itensP = r.amostra(sp.itens, n).map((x) => ({ r: x.r, x: x.x, gen: x.g }));
  } else {
    const vals = sp.valores(n, r);
    itensP = vals.map((v) => ({ r: sp.rotulo(v), x: sp.x(v), valor: v }));
  }
  for (const it of itensP) usados.add(it.r);
  cats.push({ spec: sp, principal: true, ordem: !!sp.ordem, itens: itensP });

  // Demais
  for (const spec of escolhidas) {
    let its;
    if (spec.tipo === 'nomes') {
      const nomes = escolherNomes(r, n, usados, new Set(itensP.filter((x) => sp.tipo === 'pessoas').map((x) => x.r[0])));
      if (!nomes) return null;
      its = nomes.map((x) => ({ r: x.r, x: spec.xNome(x.r, x.gen), gen: x.gen, g: x.gen }));
    } else if (spec.ordem) {
      const vals = spec.valores(n, r);
      if (new Set(vals).size !== n) return null;
      its = vals.map((v) => ({ r: spec.rotulo(v), x: spec.x(v), d: spec.d ? spec.d(v) : undefined, valor: v }));
    } else {
      if (spec.itens.length < n) return null;
      its = r.amostra(spec.itens, n).map((x) => ({ ...x }));
    }
    for (const it of its) {
      if (usados.has(it.r)) return null;
      usados.add(it.r);
    }
    cats.push({ spec, principal: false, ordem: !!spec.ordem, itens: its });
  }
  // rótulos únicos (sem diferença de maiúsculas)
  const rot = new Set();
  for (const c of cats) for (const it of c.itens) {
    const k = chaveTexto(it.r);
    if (rot.has(k)) return null;
    rot.add(k);
  }
  // ordenar itens: por valor (ordenadas) ou alfabética
  for (const c of cats) {
    if (c.ordem) c.itens.sort((a, b) => a.valor - b.valor);
    else c.itens.sort((a, b) => a.r.localeCompare(b.r, 'pt'));
    if (c.ordem) {
      const vs = c.itens.map((x) => x.valor);
      c.itens.forEach((x) => {
        x.extremo = x.valor === Math.min(...vs) ? 'min' : x.valor === Math.max(...vs) ? 'max' : null;
      });
    }
  }
  // solução: entidade e = índice do item principal
  const sol = cats.map((c, ci) => (ci === 0 ? range(n) : r.embaralhar(range(n))));
  const inst = { tema, estilo, m, n, que, cats, sol, r };
  cats.forEach((c, ci) => c.itens.forEach((it, i) => Object.assign(it, { c: ci, i, cat: c, spec: c.spec })));
  inst.it = (e, c) => cats[c].itens[sol[c][e]];
  inst.entDe = (it) => sol[it.c].indexOf(it.i);
  inst.val = (e, c) => inst.it(e, c).valor;

  const d = {
    id: 'x', titulo: 'x', nivel: 'medio',
    categorias: cats.map((c) => {
      const o = { id: c.spec.id, nome: c.spec.nome, itens: c.itens.map((x) => x.r) };
      if (c.ordem) o.valores = c.itens.map((x) => x.valor);
      if (c.spec.formato) o.formato = c.spec.formato;
      if (c.ordem && c.spec.relacao) o.relacao = c.spec.relacao;
      return o;
    }),
    dicas: [],
    solucao: range(n).map((e) => cats.map((c, ci) => inst.it(e, ci).r)),
  };
  inst.base = d;
  inst.P0 = M.compilar(d);
  return inst;
}

// ---------------------------------------------------------------------------
// Fatos (dicas atômicas)
// ---------------------------------------------------------------------------

function ordenadasPara(inst, tipo) {
  return inst.cats
    .map((c, ci) => ({ c, ci }))
    .filter(({ c }) => c.ordem && (!c.spec.usos || c.spec.usos.includes(tipo)) && (tipo !== 'adj' || c.spec.dist) && (tipo !== 'dif' || c.spec.difMaior))
    .map(({ ci }) => ci);
}

function amostrarFato(inst, tipo, r) {
  const { m, n } = inst;
  const cats = range(m);
  const it = inst.it;
  const outra = (excl) => r.escolha(cats.filter((c) => !excl.includes(c)));
  switch (tipo) {
    case 'pos': {
      const e = r.int(0, n - 1);
      const [c1, c2] = r.amostra(cats, 2);
      return { t: 'pos', a: it(e, c1), b: it(e, c2) };
    }
    case 'neg': {
      const [e1, e2] = r.amostra(range(n), 2);
      const [c1, c2] = r.amostra(cats, 2);
      return { t: 'neg', a: it(e1, c1), b: it(e2, c2) };
    }
    case 'ou': {
      const e = r.int(0, n - 1);
      const [c1, c2] = r.amostra(cats, 2);
      const c3 = r.chance(0.6) ? c2 : outra([c1]);
      const e2 = r.escolha(range(n).filter((x) => x !== e));
      return { t: 'ou', a: it(e, c1), b: it(e, c2), c: it(e2, c3) };
    }
    case 'par': {
      const [e1, e2] = r.amostra(range(n), 2);
      const ca = r.escolha(cats);
      const cb = r.chance(0.5) ? ca : r.escolha(cats);
      const livres = cats.filter((c) => c !== ca && c !== cb);
      if (!livres.length) return null;
      const c3 = r.escolha(livres);
      let C = it(e1, c3);
      let D = it(e2, c3);
      if (r.chance(0.5)) [C, D] = [D, C];
      return { t: 'par', a: it(e1, ca), b: it(e2, cb), c: C, d: D };
    }
    case 'distintos': {
      const k = n >= 5 && r.chance(0.35) ? 4 : 3;
      const es = r.amostra(range(n), k);
      const cs = es.map(() => r.escolha(cats));
      if (new Set(cs).size < 2) return null;
      return { t: 'distintos', itens: es.map((e, i) => it(e, cs[i])) };
    }
    case 'gt':
    case 'dif':
    case 'adj': {
      const Ks = ordenadasPara(inst, tipo);
      if (!Ks.length) return null;
      const K = r.escolha(Ks);
      let [e1, e2] = r.amostra(range(n), 2);
      if (inst.val(e1, K) < inst.val(e2, K)) [e1, e2] = [e2, e1];
      const k = +(inst.val(e1, K) - inst.val(e2, K)).toFixed(2);
      const a = it(e1, outra([K]));
      const b = it(e2, outra([K]));
      return { t: tipo, K, a, b, k };
    }
    case 'extremo':
    case 'meio': {
      const Ks = ordenadasPara(inst, tipo);
      if (!Ks.length || n < 3) return null;
      const K = r.escolha(Ks);
      const es = range(n).filter((e) => {
        const ex = inst.it(e, K).extremo;
        return tipo === 'extremo' ? !!ex : !ex;
      });
      const e = r.escolha(es);
      return { t: tipo, K, a: it(e, outra([K])) };
    }
    default:
      return null;
  }
}

function idCat(inst, K) {
  return inst.cats[K].spec.id;
}

function regrasDoFato(inst, f) {
  const R = (x) => x.r;
  switch (f.t) {
    case 'pos': return [['=', R(f.a), R(f.b)]];
    case 'neg': return [['!=', R(f.a), R(f.b)]];
    case 'ou': return [['ou', R(f.a), R(f.b), R(f.c)]];
    case 'par': return [['par', [R(f.a), R(f.b)], [R(f.c), R(f.d)]]];
    case 'distintos': return [['distintos', ...f.itens.map(R)]];
    case 'gt': return [['>', idCat(inst, f.K), R(f.a), R(f.b)]];
    case 'dif': return [['dif', idCat(inst, f.K), R(f.a), R(f.b), f.k]];
    case 'adj': return [['dist', idCat(inst, f.K), R(f.a), R(f.b), f.k]];
    case 'extremo': return [['extremo', idCat(inst, f.K), R(f.a)]];
    case 'meio': return [['meio', idCat(inst, f.K), R(f.a)]];
    default: throw new Error(f.t);
  }
}

const RELACIONAIS = new Set(['gt', 'dif', 'adj', 'extremo', 'meio']);

function pesos(estilo, nivel) {
  const base = {
    associacao: { pos: 3, neg: 5, ou: 3, par: 2, distintos: 1.5 },
    ordem: { pos: 2, neg: 3, ou: 1, par: 0.6, gt: 4, dif: 3, adj: 1.5, extremo: 1, meio: 1 },
    calculo: { pos: 2, neg: 3, ou: 1, par: 0.4, gt: 3, dif: 5, adj: 1.5, extremo: 0.8, meio: 0.8 },
    misto: { pos: 2.5, neg: 4, ou: 2, par: 1.5, distintos: 1, gt: 3, dif: 2.5, adj: 1, extremo: 1, meio: 1 },
  }[estilo];
  const w = { ...base };
  if (nivel === 'dificil') {
    w.pos *= 0.35;
    for (const k of ['ou', 'par', 'adj', 'distintos']) if (w[k]) w[k] *= 1.4;
  } else {
    w.pos *= 1.4;
  }
  return w;
}

// ---------------------------------------------------------------------------
// Checagens com o motor
// ---------------------------------------------------------------------------

function unico(inst, sel) {
  const regras = sel.flatMap((f) => f.comp);
  return M.contarSolucoes(inst.P0, { regras, limite: 2 }).total === 1;
}

function deduz(inst, sel, pares) {
  const d = { ...inst.base, dicas: sel.map((f) => ({ texto: '', regras: f.regras })) };
  const P = M.compilar(d);
  const r = M.deduzirTudo(P, null, { pares });
  r.decididas = r.grade.reduce((s, v) => s + (v ? 1 : 0), 0);
  return r;
}

function maxDicas(m, n) {
  return { '4x4': 10, '4x5': 13, '5x4': 13, '5x5': 17 }[`${m}x${n}`];
}

function atendeEstilo(inst, sel) {
  const tipos = sel.map((f) => f.t);
  const rel = sel.filter((f) => RELACIONAIS.has(f.t));
  switch (inst.estilo) {
    case 'associacao':
      return tipos.some((t) => t === 'ou' || t === 'par' || t === 'distintos');
    case 'ordem':
      return rel.length >= 2 && rel.some((f) => !inst.cats[f.K].spec.numerica);
    case 'calculo':
      return rel.length >= 2 && rel.some((f) => f.t === 'dif' && inst.cats[f.K].spec.numerica);
    case 'misto':
      return rel.length >= 1 && tipos.some((t) => t === 'ou' || t === 'par' || t === 'distintos' || t === 'neg');
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Geração de um desafio
// ---------------------------------------------------------------------------

export function gerarDesafio({ tema, estilo, nivel, m, n, semente, log = () => {} }) {
  const r = aleatorio(semente);
  const inst = instanciar(tema, estilo, m, n, r);
  if (!inst) return { erro: 'instancia' };
  const pares = nivel === 'dificil';
  const w = pesos(estilo, nivel);

  // Fatos candidatos
  const pool = [];
  const vistos = new Set();
  for (let t = 0; t < 6000 && pool.length < 700; t++) {
    const tipo = r.pesado(w);
    const f = amostrarFato(inst, tipo, r);
    if (!f) continue;
    f.regras = regrasDoFato(inst, f);
    const k = JSON.stringify(f.regras);
    if (vistos.has(k)) continue;
    vistos.add(k);
    try {
      f.comp = f.regras.map((x) => inst.P0.compilarRegra(x));
    } catch (e) {
      continue;
    }
    pool.push(f);
  }

  // 1) até a solução ser única
  const sel = [];
  let i = 0;
  while (i < pool.length) {
    sel.push(pool[i++]);
    if (sel.length >= 3 && unico(inst, sel)) break;
  }
  if (!unico(inst, sel)) return { erro: 'nao-unico' };

  // 2) até ser dedutível (sem chute) no modo do nível
  let ded = deduz(inst, sel, pares);
  for (let extra = 0; !ded.completo && extra < 12; extra++) {
    let melhor = null;
    let melhorDed = null;
    const amostra = r.amostra(pool.slice(i), 18);
    for (const f of amostra) {
      const dd = deduz(inst, [...sel, f], pares);
      if (!melhorDed || dd.decididas > melhorDed.decididas) {
        melhor = f;
        melhorDed = dd;
      }
      if (dd.completo) break;
    }
    if (!melhor) break;
    sel.push(melhor);
    pool.splice(pool.indexOf(melhor), 1);
    ded = melhorDed;
  }
  if (!ded.completo || !ded.correto) return { erro: 'nao-dedutivel' };

  // 3) poda: tira tudo o que não faz falta
  const prioridade = (f) => (nivel === 'dificil' ? (f.t === 'pos' ? 0 : f.t === 'neg' ? 1 : 2) : 0);
  const ordem = r.embaralhar(sel).sort((a, b) => prioridade(a) - prioridade(b));
  let atual = sel.slice();
  for (const f of ordem) {
    const sem = atual.filter((x) => x !== f);
    if (!unico(inst, sem)) continue;
    const dd = deduz(inst, sem, pares);
    if (dd.completo && dd.correto) atual = sem;
  }

  // 4) nível e estilo
  const semPares = deduz(inst, atual, false);
  const precisaPares = !semPares.completo;
  const diretas = atual.filter((f) => f.t === 'pos').length;
  if (nivel === 'dificil' && !precisaPares && !(m === 5 && n === 5 && diretas <= 1)) return { erro: 'facil-demais' };
  if (nivel === 'medio' && precisaPares) return { erro: 'dificil-demais' };
  if (atual.length > maxDicas(m, n)) return { erro: 'dicas-demais' };
  if (!atendeEstilo(inst, atual)) return { erro: 'estilo' };

  // 5) texto
  const dicas = redigir(inst, atual, r);
  const comPares = deduz(inst, atual, true);
  log(`ok: ${atual.length} fatos → ${dicas.length} dicas; passos ${comPares.passos.length}; pares ${comPares.passos.filter((p) => p.tipo === 'dicas').length}`);
  return { inst, dicas, fatos: atual, passos: comPares.passos.length };
}

// ---------------------------------------------------------------------------
// Redação
// ---------------------------------------------------------------------------

function sujeitoNP(inst, it, r) {
  const { que } = inst;
  const c = it.cat;
  const sp = c.spec;
  if (c.principal) {
    if (sp.tipo === 'pessoas') return { t: it.r, g: it.gen, k: 'nome' };
    if (sp.tipo === 'sobrenomes') return { t: it.x, g: 'f', k: 'art' };
    if (sp.tipo === 'lista') return { t: it.x, g: it.gen, k: 'art' };
    const o = sp.np(it);
    return { t: o.t, g: o.g, k: 'art' };
  }
  if (c.ordem && it.extremo) {
    const npx = it.extremo === 'min' ? sp.npMin : sp.npMax;
    if (npx && r.chance(0.5)) return { t: `${que.t} ${flex(npx, que.g)}`, g: que.g, k: 'desc' };
  }
  if (sp.np) {
    const o = sp.np(it);
    if (typeof o === 'string') return { t: flex(o, que.g), g: que.g, k: o.startsWith('quem') ? 'desc' : 'art' };
    return { t: flex(o.t, o.g), g: o.g, k: 'art' };
  }
  return { t: `${que.t} ${flex(predPartes(inst, it, que.g).full, que.g)}`, g: que.g, k: 'desc' };
}

function prioridade(np, it) {
  if (np.k === 'nome') return 3;
  if (np.k === 'art') return 2;
  return it.cat.ordem ? 0 : 1;
}

// Verbos no presente que abrem predicados das categorias (mora, tem, toca...).
const PRESENTES = new Set(['tem', 'treina', 'mora', 'trabalha', 'é', 'vende', 'vai', 'usa', 'toca', 'faz', 'dá', 'cuida', 'cobra', 'toma', 'representa', 'rega', 'prefere', 'pede', 'guarda', 'gosta', 'estuda', 'costuma', 'coleciona', 'alimenta', 'aduba', 'adora']);
function presente(it) {
  const sp = it.cat.spec;
  if (sp.presente !== undefined) return sp.presente;
  return PRESENTES.has(String(sp.pred || '').trim().split(/\s+/)[0]);
}
// "era" combina com sujeitos no passado ("quem pescou o dourado era Pedro"); com
// sujeitos no presente fica "é" ("quem mora em Santana é Pedro").
function serPara(inst, ...its) {
  const ser = inst.tema.ser;
  if (ser !== 'era') return ser;
  return its.some((it) => it && !it.cat.principal && presente(it)) ? 'é' : ser;
}

function predPartes(inst, it, g, ser = inst.tema.ser) {
  const c = it.cat;
  const sp = c.spec;
  let tpl;
  let x;
  if (c.principal && sp.tipo !== 'ordem') {
    tpl = `${ser} {x}`;
    x = it.x;
  } else {
    tpl = sp.pred;
    x = it.x;
  }
  const [pre, suf = ''] = tpl.split('{x}');
  const P = { pre: flex(pre, g), x: flex(x, g), suf: flex(suf, g) };
  P.full = `${P.pre}${P.x}${P.suf}`;
  return P;
}

// Predicado de um item, às vezes com superlativo (mais velho, primeiro a chegar...)
function predicado(inst, it, g, r, superlativo = true, ser = inst.tema.ser) {
  const sp = it.cat.spec;
  if (superlativo && it.cat.ordem && !it.cat.principal && it.extremo) {
    const p = it.extremo === 'min' ? sp.predMin : sp.predMax;
    if (p && r.chance(0.55)) return flex(p, g);
  }
  return predPartes(inst, it, g, ser).full;
}

function troca(s, A, B) {
  return s.split('{A}').join(A).split('{B}').join(B);
}

function specK(inst, K) {
  return inst.cats[K].spec;
}

// Predicado de um fato relacional/associativo com `x` como sujeito.
function predDoFato(inst, f, x, r) {
  const S = x.np;
  switch (f.t) {
    case 'pos': {
      const o = f.a === x.it ? f.b : f.a;
      return predicado(inst, o, S.g, r);
    }
    case 'neg': {
      const o = f.a === x.it ? f.b : f.a;
      return `não ${predicado(inst, o, S.g, r)}`;
    }
    case 'gt':
    case 'dif': {
      const sp = specK(inst, f.K);
      const souA = f.a === x.it;
      const outro = sujeitoNP(inst, souA ? f.b : f.a, r);
      let rel;
      if (f.t === 'gt') rel = souA ? sp.maior : sp.menor;
      else rel = souA ? sp.difMaior(f.k) : sp.difMenor(f.k);
      return `${flex(sp.verbo, S.g)} ${troca(flex(rel, S.g), '', outro.t)}`;
    }
    case 'extremo':
      return flex(specK(inst, f.K).extremo, S.g);
    case 'meio':
      return flex(specK(inst, f.K).meio, S.g);
    default:
      return null;
  }
}

function textoFato(inst, f, r) {
  switch (f.t) {
    case 'pos':
    case 'neg': {
      const na = sujeitoNP(inst, f.a, r);
      const nb = sujeitoNP(inst, f.b, r);
      let [s, o, ns] = prioridade(na, f.a) >= prioridade(nb, f.b) ? [f.a, f.b, na] : [f.b, f.a, nb];
      if (prioridade(na, f.a) === prioridade(nb, f.b) && r.chance(0.5)) [s, o, ns] = [f.b, f.a, nb];
      const p = predicado(inst, o, ns.g, r, true, serPara(inst, s));
      return `${ns.t} ${f.t === 'neg' ? 'não ' : ''}${p}`;
    }
    case 'ou': {
      const A = sujeitoNP(inst, f.a, r);
      let [B, C] = r.chance(0.5) ? [f.b, f.c] : [f.c, f.b];
      const ser = serPara(inst, f.a);
      if (B.c === C.c) {
        const P = predPartes(inst, B, A.g, ser);
        const x2 = predPartes(inst, C, A.g, ser).x;
        return `${A.t} ${P.pre}${P.x} ou ${x2}${P.suf}`;
      }
      return `${A.t} ${predPartes(inst, B, A.g, ser).full} ou ${predPartes(inst, C, A.g, ser).full}, mas não as duas coisas`;
    }
    case 'par': {
      let A = sujeitoNP(inst, f.a, r);
      let B = sujeitoNP(inst, f.b, r);
      if (prioridade(B, f.b) > prioridade(A, f.a)) [A, B] = [B, A];
      const fem = A.g === 'f' && B.g === 'f';
      const ser = serPara(inst, f.a, f.b);
      const P = predPartes(inst, f.c, fem ? 'f' : 'm', ser);
      const x2 = predPartes(inst, f.d, fem ? 'f' : 'm', ser).x;
      return `Entre ${A.t} e ${B.t}, ${fem ? 'uma' : 'um'} ${P.full} e ${fem ? 'a outra' : 'o outro'}, ${x2}`;
    }
    case 'distintos': {
      const nps = f.itens
        .map((it) => {
          const np = sujeitoNP(inst, it, r);
          return { t: np.t, p: prioridade(np, it) };
        })
        .sort((a, b) => b.p - a.p)
        .map((x) => x.t);
      const ent = inst.tema.entidade;
      return `${juntar(nps)} são ${extenso(nps.length, ent.g)} ${ent.plural} diferentes`;
    }
    case 'gt':
    case 'dif': {
      const sp = specK(inst, f.K);
      const A = sujeitoNP(inst, f.a, r);
      const B = sujeitoNP(inst, f.b, r);
      let usarMaior = r.chance(0.5);
      if (prioridade(A, f.a) > prioridade(B, f.b)) usarMaior = r.chance(0.8);
      if (prioridade(B, f.b) > prioridade(A, f.a)) usarMaior = r.chance(0.2);
      if (usarMaior) {
        const rel = f.t === 'gt' ? sp.maior : sp.difMaior(f.k);
        return `${A.t} ${flex(sp.verbo, A.g)} ${troca(flex(rel, A.g), '', B.t)}`;
      }
      const rel = f.t === 'gt' ? sp.menor : sp.difMenor(f.k);
      return `${B.t} ${flex(sp.verbo, B.g)} ${troca(flex(rel, B.g), '', A.t)}`;
    }
    case 'adj': {
      const sp = specK(inst, f.K);
      let A = sujeitoNP(inst, f.a, r);
      let B = sujeitoNP(inst, f.b, r);
      const pa = prioridade(A, f.a);
      const pb = prioridade(B, f.b);
      if (pb > pa || (pb === pa && r.chance(0.5))) [A, B] = [B, A];
      return troca(flex(sp.dist(f.k), 'm'), A.t, B.t);
    }
    case 'extremo':
    case 'meio': {
      const A = sujeitoNP(inst, f.a, r);
      return `${A.t} ${flex(specK(inst, f.K)[f.t], A.g)}`;
    }
    default:
      throw new Error(f.t);
  }
}

// Junta fatos em frases compostas (como nas revistas) e escreve todas as dicas.
function redigir(inst, fatos, r) {
  const livres = r.embaralhar(fatos.slice());
  const dicas = [];
  const usar = (fs, texto) => {
    for (const f of fs) livres.splice(livres.indexOf(f), 1);
    dicas.push({ texto: frase(texto), regras: fs.flatMap((f) => f.regras) });
  };
  const minimo = Math.max(4, Math.ceil(fatos.length * 0.6));
  const podeJuntar = () => livres.length + dicas.length - 1 >= minimo;
  const itemSujeito = (it) => {
    const np = sujeitoNP(inst, it, r);
    return np.k !== 'desc' ? np : null;
  };

  // 1) "A não X nem Y"
  for (const f1 of livres.slice()) {
    if (!livres.includes(f1) || f1.t !== 'neg' || !podeJuntar() || !r.chance(0.6)) continue;
    for (const x of [f1.a, f1.b]) {
      const np = itemSujeito(x);
      if (!np) continue;
      const y1 = x === f1.a ? f1.b : f1.a;
      const f2 = livres.find((f) => f !== f1 && f.t === 'neg' && (f.a === x || f.b === x) && (f.a === x ? f.b : f.a).c !== x.c);
      if (!f2) continue;
      const y2 = f2.a === x ? f2.b : f2.a;
      let texto;
      if (y1.c === y2.c) {
        const P = predPartes(inst, y1, np.g);
        texto = `${np.t} não ${P.pre}${P.x} nem ${predPartes(inst, y2, np.g).x}${P.suf}`;
      } else {
        texto = `${np.t} não ${predPartes(inst, y1, np.g).full} nem ${predPartes(inst, y2, np.g).full}`;
      }
      usar([f1, f2], texto);
      break;
    }
  }
  // 2) "Nem A nem B X"
  for (const f1 of livres.slice()) {
    if (!livres.includes(f1) || f1.t !== 'neg' || !podeJuntar() || !r.chance(0.5)) continue;
    for (const y of [f1.a, f1.b]) {
      const x1 = y === f1.a ? f1.b : f1.a;
      const n1 = itemSujeito(x1);
      if (!n1) continue;
      const f2 = livres.find((f) => f !== f1 && f.t === 'neg' && (f.a === y || f.b === y) && (f.a === y ? f.b : f.a).c === x1.c);
      if (!f2) continue;
      const x2 = f2.a === y ? f2.b : f2.a;
      const n2 = itemSujeito(x2);
      if (!n2 || y.cat.principal) continue;
      const g = n1.g === 'f' && n2.g === 'f' ? 'f' : 'm';
      usar([f1, f2], `Nem ${n1.t} nem ${n2.t} ${predPartes(inst, y, g).full}`);
      break;
    }
  }
  // 3) cadeia "A ... depois de B, mas antes de C"
  for (const f1 of livres.slice()) {
    if (!livres.includes(f1) || f1.t !== 'gt' || !podeJuntar() || !r.chance(0.7)) continue;
    const f2 = livres.find((f) => f !== f1 && f.t === 'gt' && f.K === f1.K && f.b === f1.a);
    if (!f2) continue;
    // f2: C > A ; f1: A > B  →  A depois de B, mas antes de C
    const sp = specK(inst, f1.K);
    const A = sujeitoNP(inst, f1.a, r);
    const B = sujeitoNP(inst, f1.b, r);
    const C = sujeitoNP(inst, f2.a, r);
    usar([f1, f2], `${A.t} ${flex(sp.verbo, A.g)} ${troca(flex(sp.maior, A.g), '', B.t)}, mas ${troca(flex(sp.menor, A.g), '', C.t)}`);
  }
  // 4) oração relativa "A, que não X, Y"
  for (const f1 of livres.slice()) {
    if (!livres.includes(f1) || (f1.t !== 'neg' && f1.t !== 'pos') || !podeJuntar() || !r.chance(0.45)) continue;
    for (const x of [f1.a, f1.b]) {
      const np = itemSujeito(x);
      if (!np) continue;
      const f2 = livres.find((f) => f !== f1 && ['pos', 'neg', 'gt', 'dif', 'extremo', 'meio'].includes(f.t) && (f.a === x || f.b === x));
      if (!f2) continue;
      const sx = { it: x, np };
      const p1 = predDoFato(inst, f1, sx, r);
      const p2 = predDoFato(inst, f2, sx, r);
      if (!p1 || !p2) continue;
      usar([f1, f2], `${np.t}, que ${p1}, ${p2}`);
      break;
    }
  }
  for (const f of livres.slice()) usar([f], textoFato(inst, f, r));
  return r.embaralhar(dicas);
}

// ---------------------------------------------------------------------------
// Montagem do JSON
// ---------------------------------------------------------------------------

export function montarJSON(res, { titulo, nivel, numero }) {
  const { inst, dicas } = res;
  const { tema, n, r } = inst;
  const ctx = {
    n: extenso(n, tema.entidade.g),
    num: n,
    N: cap(extenso(n, tema.entidade.g)),
    P: tema.protagonista ? r.escolha([...NOMES_F, ...NOMES_M].filter((x) => !inst.cats.some((c) => c.itens.some((it) => it.r === x)))) : '',
  };
  const cenario = r.escolha(tema.cenarios)(ctx);
  const outras = inst.cats.slice(1);
  const clausulas = outras.filter((c) => c.spec.intro).map((c) => c.spec.intro);
  const frases = clausulas.length ? `${tema.cadaUm} ${juntar(clausulas)}.` : '';
  const descubra = `A partir das dicas, descubra, ${tema.paraCada}, ${juntar(outras.map((c) => c.spec.descubra))}.`;
  const d = {
    id: slug(titulo),
    versao: 1,
    titulo,
    nivel,
    tipo: inst.estilo,
    introducao: [cenario, frases, descubra].filter(Boolean).join(' '),
    categorias: inst.base.categorias,
    dicas: dicas.map((x) => ({ texto: x.texto, regras: x.regras })),
    solucao: inst.base.solucao,
  };
  if (numero) d.numero = numero;
  return d;
}

const q = (x) => JSON.stringify(x);
export function formatar(d) {
  const L = ['{'];
  L.push(`  "id": ${q(d.id)},`);
  L.push(`  "versao": ${d.versao ?? 1},`);
  L.push(`  "titulo": ${q(d.titulo)},`);
  L.push(`  "nivel": ${q(d.nivel)},`);
  if (d.tipo) L.push(`  "tipo": ${q(d.tipo)},`);
  L.push(`  "introducao": ${q(d.introducao)},`);
  L.push('  "categorias": [');
  d.categorias.forEach((c, i) => {
    const partes = [`"id": ${q(c.id)}`, `"nome": ${q(c.nome)}`, `"itens": [${c.itens.map(q).join(', ')}]`];
    if (c.valores) partes.push(`"valores": [${c.valores.join(', ')}]`);
    if (c.formato) partes.push(`"formato": ${q(c.formato)}`);
    if (c.relacao) partes.push(`"relacao": ${q(c.relacao)}`);
    L.push(`    { ${partes.join(', ')} }${i < d.categorias.length - 1 ? ',' : ''}`);
  });
  L.push('  ],');
  L.push('  "dicas": [');
  d.dicas.forEach((dc, i) => {
    const regras = dc.regras.map((r) => '[' + r.map((x) => (Array.isArray(x) ? '[' + x.map(q).join(', ') + ']' : q(x))).join(', ') + ']').join(', ');
    L.push(`    { "texto": ${q(dc.texto)}, "regras": [${regras}] }${i < d.dicas.length - 1 ? ',' : ''}`);
  });
  L.push('  ],');
  L.push('  "solucao": [');
  d.solucao.forEach((s, i) => L.push(`    [${s.map(q).join(', ')}]${i < d.solucao.length - 1 ? ',' : ''}`));
  L.push('  ]');
  L.push('}');
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Plano dos 95 desafios novos (números 6 a 100)
// ---------------------------------------------------------------------------

export function plano() {
  const estilos = [];
  const cota = { associacao: 22, ordem: 25, calculo: 24, misto: 24 };
  const ciclo = ['ordem', 'associacao', 'calculo', 'misto'];
  for (let i = 0; estilos.length < 95; i++) {
    const e = ciclo[i % 4];
    if (cota[e] > 0) {
      estilos.push(e);
      cota[e]--;
    }
  }
  const tamMedio = [[4, 4], [4, 5], [5, 4], [4, 5], [4, 4], [5, 5], [5, 4]];
  const tamDificil = [[4, 5], [5, 5], [5, 4], [4, 4], [5, 5], [4, 5], [5, 4]];
  const itens = [];
  let im = 0;
  let id = 0;
  for (let i = 0; i < 95; i++) {
    // 45 médios e 50 difíceis, intercalados
    const nivel = (i * 45) % 95 < 45 ? 'medio' : 'dificil';
    const estilo = estilos[i];
    let [m, n] = nivel === 'medio' ? tamMedio[im++ % tamMedio.length] : tamDificil[id++ % tamDificil.length];
    if (estilo === 'associacao' && m === 5 && n === 5 && nivel === 'medio') [m, n] = [4, 5];
    itens.push({ numero: i + 6, estilo, nivel, m, n });
  }
  return itens;
}

// Distribui temas: cada tema no máximo 4 vezes; respeita o que o tema suporta.
function suporta(tema, estilo, m) {
  const nominais = tema.categorias.filter((c) => !c.ordem).length;
  const ordenadas = tema.categorias.filter((c) => c.ordem);
  if (estilo === 'associacao') return !tema.semAssociacao && nominais >= m - 1;
  if (estilo === 'ordem') return ordenadas.some((c) => !c.numerica) || !!tema.principal.ordem;
  if (estilo === 'calculo') return ordenadas.some((c) => c.numerica);
  return ordenadas.length > 0 || !!tema.principal.ordem;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function args() {
  const a = process.argv.slice(2);
  const o = { _: [] };
  const booleanos = new Set(['teste', 'plano']);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      const v = !booleanos.has(k) && a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
      o[k] = v;
    } else o._.push(a[i]);
  }
  return o;
}

function main() {
  const o = args();
  if (o.plano) {
    const p = plano();
    const cont = {};
    for (const x of p) {
      const k = `${x.nivel}/${x.estilo}`;
      cont[k] = (cont[k] || 0) + 1;
    }
    console.log(p.map((x) => `${x.numero} ${x.nivel} ${x.estilo} ${x.m}x${x.n}`).join('\n'));
    console.log(cont);
    return;
  }
  if (o.teste) {
    const [temaId, estilo, nivel, m, n, sem] = o._;
    const tema = TEMAS.find((t) => t.id === temaId);
    for (let s = Number(sem || 1); s < Number(sem || 1) + 60; s++) {
      const t0 = Date.now();
      const res = gerarDesafio({ tema, estilo, nivel, m: Number(m), n: Number(n), semente: s, log: (x) => console.log('  ', x) });
      if (res.erro) {
        console.log(`semente ${s}: ${res.erro} (${Date.now() - t0} ms)`);
        continue;
      }
      const d = montarJSON(res, { titulo: tema.titulos[0], nivel });
      console.log(`semente ${s} (${Date.now() - t0} ms)\n${d.introducao}\n`);
      d.dicas.forEach((x, i) => console.log(`${String(i + 1).padStart(2)}. ${x.texto}`));
      console.log('\n' + d.solucao.map((x) => '   ' + x.join(' | ')).join('\n'));
      if (o.salvar) writeFileSync(o.salvar, formatar(d));
      break;
    }
    return;
  }
  if (o.gerar) {
    const [de, ate] = String(o.gerar).split('-').map(Number);
    const saida = o.saida || join(RAIZ, 'desafios');
    mkdirSync(saida, { recursive: true });
    const p = plano().filter((x) => x.numero >= de && x.numero <= ate);
    // Registro do que já foi gerado (tema, título e semente de cada número). Os
    // números fora da faixa pedida contam no uso de temas e títulos; os de dentro
    // são refeitos, então rodar de novo a mesma faixa reproduz os mesmos arquivos.
    const uso = {};
    const titulosUsados = new Set();
    const regFile = o.registro || (o.saida ? join(saida, '_gerados.json') : join(RAIZ, 'scripts', 'gerador', 'registro.json'));
    const reg = existsSync(regFile) ? JSON.parse(readFileSync(regFile, 'utf8')) : {};
    for (const [num, v] of Object.entries(reg)) {
      if (Number(num) >= de && Number(num) <= ate) {
        delete reg[num];
        continue;
      }
      uso[v.tema] = (uso[v.tema] || 0) + 1;
      titulosUsados.add(v.titulo);
    }
    const baseSemente = Number(o.semente || 20261016);
    for (const item of p) {
      if (reg[item.numero]) continue;
      const t0 = Date.now();
      const r = aleatorio(baseSemente + item.numero * 7919);
      let feito = null;
      const candidatos = r.embaralhar(TEMAS.filter((t) => suporta(t, item.estilo, item.m) && (uso[t.id] || 0) < 4))
        .sort((a, b) => (uso[a.id] || 0) - (uso[b.id] || 0));
      for (const tema of candidatos) {
        const titulo = tema.titulos.find((x) => !titulosUsados.has(x));
        if (!titulo) continue;
        for (let tent = 0; tent < 25 && !feito; tent++) {
          const semente = baseSemente + item.numero * 1000 + tent * 17 + tema.id.length;
          const res = gerarDesafio({ tema, estilo: item.estilo, nivel: item.nivel, m: item.m, n: item.n, semente });
          if (res.erro) continue;
          const d = montarJSON(res, { titulo, nivel: item.nivel });
          // conferência final com o motor
          const P = M.compilar(d);
          const unicoOk = M.contarSolucoes(P, { limite: 2 }).total === 1;
          const dd = M.deduzirTudo(P, null, { pares: item.nivel === 'dificil' });
          if (!unicoOk || !dd.completo || !dd.correto || M.conferirSolucao(P).length) continue;
          feito = { d, tema, semente };
        }
        if (feito) break;
      }
      if (!feito) {
        console.log(`#${item.numero} ${item.nivel} ${item.estilo} ${item.m}x${item.n}: FALHOU (${Date.now() - t0} ms)`);
        continue;
      }
      const { d, tema, semente } = feito;
      const arq = `${String(item.numero).padStart(3, '0')}-${d.id}.json`;
      writeFileSync(join(saida, arq), formatar(d));
      uso[tema.id] = (uso[tema.id] || 0) + 1;
      titulosUsados.add(d.titulo);
      reg[item.numero] = { arquivo: arq, tema: tema.id, titulo: d.titulo, semente, estilo: item.estilo, nivel: item.nivel };
      writeFileSync(regFile, JSON.stringify(reg, null, 1));
      console.log(`#${item.numero} ${item.nivel} ${item.estilo} ${item.m}x${item.n}: ${d.titulo} [${tema.id}] ${d.dicas.length} dicas (${Date.now() - t0} ms)`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
