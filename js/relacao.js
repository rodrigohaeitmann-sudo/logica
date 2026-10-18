// Aba "Relação": anotações de ordem entre itens, como se faz na margem da revista.
//
// Notação padronizada (compacta):  MENOR  q  MAIOR
//   - o primeiro item é sempre o de valor menor (antes, mais novo, menos páginas,
//     mais barato, à frente na colocação…);
//   - q é a diferença exata, só o número, sem unidade ("Suspense 1 Paulo"), ou
//     "?" quando só se sabe a ordem ("Renata ? Marta ? Paulo");
//   - "±q" quando se sabe a diferença, mas não quem vem antes ("Igor ±18 Tia").
//
// Armazenamento (progresso.relacoes): { id, k, a, b, t, v, d }
//   k: índice da categoria; a, b: itens (índice global); d: dica de origem (opcional)
//   t: '<' a < b (sem medida) · '>' a > b · '+' a = b + v · '-' a = b − v · '~' |a − b| = v
//   O formulário grava sempre na forma padronizada ('<' ou '-' com a = menor, ou '~');
//   anotações antigas, em outra forma, são mostradas padronizadas.
// Nada aqui consulta a solução: só o que o jogador anotou (e, se ele pedir,
// as marcações da grade para calcular os valores ainda possíveis).

import * as M from './motor.js';

const { NAO, SIM } = M;

const PADRAO = {
  menor: 'menor que', maior: 'maior que',
  menorK: '{k} a menos que', maiorK: '{k} a mais que',
  unidade: [], menorCurto: 'menor', maiorCurto: 'maior',
};

export const TIPOS = ['<', '>', '-', '+', '~'];

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(v) {
  const [i, d] = String(Math.abs(v)).split('.');
  return (v < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? `,${d}` : '');
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Categorias "relacionáveis": as que têm valores numéricos no desafio.
export function relacionaveis(P) {
  const out = [];
  P.cats.forEach((c, k) => {
    if (Array.isArray(c.valores)) out.push(k);
  });
  return out;
}

export function rotulos(P, k) {
  return { ...PADRAO, ...(P.cats[k].relacao || {}) };
}

// "1 mês", "60 páginas", "R$ 1,50" (para a leitura por extenso)
export function quantidade(P, k, v) {
  const r = rotulos(P, k);
  if (r.prefixo) return `${r.prefixo}${numero(P, k, v)}`;
  const un = r.unidade || [];
  if (un.length) return `${fmtNum(v)} ${v === 1 ? un[0] : un[1] || un[0]}`;
  return fmtNum(v);
}

// Só o número, sem unidade: "1", "60", "1,50" (para a notação compacta)
export function numero(P, k, v) {
  const r = rotulos(P, k);
  if (r.prefixo && !Number.isInteger(v)) return v.toFixed(2).replace('.', ',');
  return fmtNum(v);
}

// Diferenças possíveis entre dois valores da categoria (para relações exatas).
export function diferencas(P, k) {
  const vs = P.valores[k];
  const s = new Set();
  for (const a of vs) for (const b of vs) if (a > b) s.add(+(a - b).toFixed(2));
  return [...s].sort((x, y) => x - y);
}

// A categoria aceita diferença exata? (não para números que só servem para comparar)
export function exatas(P, k) {
  return rotulos(P, k).exata !== false && diferencas(P, k).length > 0;
}

export function nome(P, g) {
  return M.nomeItem(P, g);
}

// ---------------------------------------------------------------------------
// Forma padronizada
// ---------------------------------------------------------------------------

// { menor, maior, q (número ou null = só a ordem), semOrdem }
export function padrao(r) {
  switch (r.t) {
    case '<': return { menor: r.a, maior: r.b, q: null, semOrdem: false };
    case '>': return { menor: r.b, maior: r.a, q: null, semOrdem: false };
    case '+': return { menor: r.b, maior: r.a, q: r.v, semOrdem: false };
    case '-': return { menor: r.a, maior: r.b, q: r.v, semOrdem: false };
    default: return { menor: r.a, maior: r.b, q: r.v, semOrdem: true };
  }
}

function qTexto(P, k, c) {
  if (c.q == null) return '?';
  return `${c.semOrdem ? '±' : ''}${numero(P, k, c.q)}`;
}

// "Renata ? Marta", "Suspense 1 Paulo", "Igor ±18 Tia"
export function compacto(P, r) {
  const c = padrao(r);
  return `${nome(P, c.menor)} ${qTexto(P, r.k, c)} ${nome(P, c.maior)}`;
}

// Leitura por extenso, também na ordem padronizada: "Renata antes de Marta",
// "Suspense 1 mês antes de Paulo", "Igor e Tia: 18 votos de diferença".
export function texto(P, r) {
  const c = padrao(r);
  const rt = rotulos(P, r.k);
  if (c.semOrdem) return `${nome(P, c.menor)} e ${nome(P, c.maior)}: ${quantidade(P, r.k, c.q)} de diferença`;
  if (c.q == null) return `${nome(P, c.menor)} ${rt.menor} ${nome(P, c.maior)}`;
  return `${nome(P, c.menor)} ${rt.menorK.replace('{k}', quantidade(P, r.k, c.q))} ${nome(P, c.maior)}`;
}

// Formulário: { a: menor, q: '?' | 'n' | '±n', b: maior, d }
export function formDe(r) {
  const c = padrao(r);
  return {
    a: String(c.menor),
    b: String(c.maior),
    q: c.q == null ? '?' : `${c.semOrdem ? '±' : ''}${c.q}`,
    d: r.d == null ? '' : String(r.d),
  };
}

// Relação (t, v) a partir do formulário, já na forma padronizada.
export function relDoForm(f) {
  const a = Number(f.a);
  const b = Number(f.b);
  const q = String(f.q ?? '?');
  if (q === '?') return { a, b, t: '<', v: null };
  if (q.startsWith('±')) return { a, b, t: '~', v: Number(q.slice(1)) };
  return { a, b, t: '-', v: Number(q) };
}

// Duas anotações dizem a mesma coisa?
export function mesma(r1, r2) {
  if (r1.k !== r2.k) return false;
  const c1 = padrao(r1);
  const c2 = padrao(r2);
  if (c1.semOrdem !== c2.semOrdem || c1.q !== c2.q) return false;
  if (c1.semOrdem) return (c1.menor === c2.menor && c1.maior === c2.maior) || (c1.menor === c2.maior && c1.maior === c2.menor);
  return c1.menor === c2.menor && c1.maior === c2.maior;
}

// Uma anotação já existente diz o mesmo (ou mais) que `nova`? Ex.: "Renata ? Marta"
// diante de "Renata 2 Marta", ou "Igor ±18 Tia" diante de "Tia 18 Igor".
export function jaImplica(rels, nova) {
  const cn = padrao(nova);
  const mesmoPar = (c) => (c.menor === cn.menor && c.maior === cn.maior) || (c.menor === cn.maior && c.maior === cn.menor);
  return rels.find((r) => {
    if (r === nova || r.k !== nova.k) return false;
    if (mesma(r, nova)) return true;
    const c = padrao(r);
    if (c.semOrdem) return false;
    if (!cn.semOrdem && cn.q == null) return c.menor === cn.menor && c.maior === cn.maior;
    if (cn.semOrdem) return c.q === cn.q && mesmoPar(c);
    return false;
  }) || null;
}

// Anotações que a nova torna desnecessárias: "Biografia ? Fantasia" (ou
// "Biografia ±2 Fantasia") quando se anota "Biografia 2 Fantasia".
export function superadas(rels, nova) {
  const cn = padrao(nova);
  if (cn.semOrdem || cn.q == null) return [];
  return rels.filter((r) => {
    if (r === nova || r.k !== nova.k) return false;
    const c = padrao(r);
    if (c.semOrdem) return c.q === cn.q && ((c.menor === cn.menor && c.maior === cn.maior) || (c.menor === cn.maior && c.maior === cn.menor));
    return c.q == null && c.menor === cn.menor && c.maior === cn.maior;
  });
}

// Deixa o formulário coerente com a categoria (medidas que existem nela).
export function ajustarForm(P, k, f) {
  const q = String(f.q ?? '?');
  if (q === '?') return;
  const v = Number(q.replace('±', ''));
  if (!exatas(P, k) || !diferencas(P, k).includes(v)) f.q = '?';
}

// ---------------------------------------------------------------------------
// Cadeias: caminhos crescentes (MENOR q … q MAIOR), os mais longos primeiro.
// As anotações sem ordem (±q) ficam à parte.
// ---------------------------------------------------------------------------

export function trilhas(P, k, rels) {
  const rk = rels.filter((r) => r.k === k);
  const arestas = new Map();
  const soltas = [];
  for (const r of rk) {
    const c = padrao(r);
    if (c.semOrdem) {
      soltas.push({ nos: [c.menor, c.maior], passos: [{ q: qTexto(P, k, c), rels: [r] }], semOrdem: true });
      continue;
    }
    const chave = `${c.menor}>${c.maior}`;
    if (!arestas.has(chave)) arestas.set(chave, { chave, de: c.menor, para: c.maior, rels: [], qs: new Set() });
    const e = arestas.get(chave);
    e.rels.push(r);
    if (c.q != null) e.qs.add(c.q);
  }
  const restantes = new Set(arestas.keys());
  const out = [];
  while (restantes.size) {
    const vivas = [...restantes].map((x) => arestas.get(x));
    const entram = new Set(vivas.map((e) => e.para));
    const nos = [...new Set(vivas.map((e) => e.de))];
    const inicios = nos.filter((x) => !entram.has(x));
    let melhor = [];
    let passos = 0;
    const dfs = (x, caminho, visto) => {
      if (++passos > 20000) return;
      if (caminho.length > melhor.length) melhor = caminho.slice();
      for (const e of vivas) {
        if (e.de !== x || visto.has(e.para)) continue;
        visto.add(e.para);
        caminho.push(e);
        dfs(e.para, caminho, visto);
        caminho.pop();
        visto.delete(e.para);
      }
    };
    for (const x of inicios.length ? inicios : nos) dfs(x, [], new Set([x]));
    if (!melhor.length) melhor = [vivas[0]];
    for (const e of melhor) restantes.delete(e.chave);
    out.push({
      nos: [melhor[0].de, ...melhor.map((e) => e.para)],
      passos: melhor.map((e) => ({
        q: e.qs.size ? [...e.qs].sort((x, y) => x - y).map((v) => numero(P, k, v)).join('/') : '?',
        rels: e.rels,
      })),
      semOrdem: false,
    });
  }
  return out.concat(soltas);
}

// `juntar`: mantém "q item" na mesma linha (a cadeia quebra entre os passos).
function desenharTrilhas(P, k, rels, { no, passo, classe, juntar = '' }) {
  let h = '';
  for (const tr of trilhas(P, k, rels)) {
    h += `<div class="${classe}${tr.semOrdem ? ' sem-ordem' : ''}">`;
    tr.nos.forEach((g, i) => {
      if (!i) h += no(g);
      else if (juntar) h += ` <span class="${juntar}">${passo(tr.passos[i - 1])}${no(g)}</span>`;
      else h += passo(tr.passos[i - 1]) + no(g);
    });
    h += '</div>';
  }
  return h;
}

// ---------------------------------------------------------------------------
// Valores ainda possíveis de cada item citado, a partir das relações anotadas e
// das marcações da grade (✕ e S); com grade = null, só pelas relações (serve
// para achar anotações que se contradizem). Não usa a solução.
// ---------------------------------------------------------------------------

export function possiveis(P, k, rels, grade) {
  const n = P.n;
  const vs = P.valores[k];
  const rk = rels.filter((r) => r.k === k);
  const nos = new Set();
  for (const r of rk) {
    nos.add(r.a);
    nos.add(r.b);
  }
  const dom = new Map();
  for (const g of nos) {
    let s;
    if (P.catDe[g] === k) s = new Set([P.idxDe[g]]);
    else {
      s = new Set();
      let sim = -1;
      for (let j = 0; j < n; j++) {
        const v = grade ? grade[M.celula(P, g, k * n + j)] : 0;
        if (v === SIM) sim = j;
        if (v !== NAO) s.add(j);
      }
      if (sim >= 0) s = new Set([sim]);
    }
    dom.set(g, s);
  }
  const ok = (t, va, vb, v) => {
    const TOL = 1e-9;
    if (t === '<') return va < vb - TOL;
    if (t === '>') return va > vb + TOL;
    if (t === '+') return Math.abs(va - vb - v) < TOL;
    if (t === '-') return Math.abs(vb - va - v) < TOL;
    return Math.abs(Math.abs(va - vb) - v) < TOL;
  };
  for (let it = 0; it < 50; it++) {
    let mudou = false;
    for (const r of rk) {
      const da = dom.get(r.a);
      const db = dom.get(r.b);
      for (const ja of [...da]) {
        if (![...db].some((jb) => ok(r.t, vs[ja], vs[jb], r.v))) {
          da.delete(ja);
          mudou = true;
        }
      }
      for (const jb of [...db]) {
        if (![...da].some((ja) => ok(r.t, vs[ja], vs[jb], r.v))) {
          db.delete(jb);
          mudou = true;
        }
      }
    }
    // itens da mesma categoria são de pessoas diferentes: valores diferentes
    for (const x of nos) {
      const dx = dom.get(x);
      if (dx.size !== 1) continue;
      const j = [...dx][0];
      for (const y of nos) {
        if (y !== x && P.catDe[y] === P.catDe[x] && dom.get(y).has(j)) {
          dom.get(y).delete(j);
          mudou = true;
        }
      }
    }
    if (!mudou) break;
  }
  return dom;
}

// Rótulo curto de um valor da categoria (para a lista de valores possíveis):
// "420 páginas" → "420", "R$ 45" → "R$ 45", "Portão 21" → "21",
// "Janeiro" → "Jan" (abrevia todos os nomes da categoria do mesmo jeito).
function rotuloValor(P, k, j) {
  const nomes = P.nomes.slice(k * P.n, (k + 1) * P.n);
  const s = nomes[j];
  if (s.includes(' ')) {
    const p = s.split(' ');
    if (p[0] === 'R$') return `${p[0]} ${p[1]}`;
    return /^\d/.test(p[0]) ? p[0] : p[p.length - 1];
  }
  if (nomes.some((x) => x.length > 5) && !nomes.some((x) => /\d/.test(x))) {
    const curtos = nomes.map((x) => x.slice(0, 3));
    if (new Set(curtos).size === nomes.length) return curtos[j];
  }
  return s;
}

// ---------------------------------------------------------------------------
// HTML da aba
// ---------------------------------------------------------------------------
//
// estado: { k, form: { a, q, b, d }, rels, mostrarPossiveis, grade, editando }
//   form.a: item menor · form.b: item maior (índice global, em texto) ou ''
//   form.q: '?' | 'n' | '±n' · form.d: dica de origem (índice) ou ''
//   editando: id da anotação que está sendo alterada (ou null)
// Contrato com o jogo (eventos delegados no painel e nas notas da grade):
//   [data-rel-cat]  troca a categoria      [data-rel-nav] dica anterior/seguinte
//   select[data-rel="a|q|b"] (change)      input[data-rel="possiveis"] (change)
//   [data-acao="rel-add"] anota            [data-acao="rel-inverter"] troca os itens
//   [data-rel-del="id"] apaga              [data-rel-edit="id"] abre para alterar
//   [data-acao="rel-salvar"] / [data-acao="rel-cancelar"] concluem a alteração
//   [data-acao="rel-limpar"] apaga as anotações da categoria

const LAPIS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

function vazio(x) {
  return x === '' || x == null;
}

// Rótulo da coluna do meio: "Meses", "Páginas", "R$", "Dif." (vazio quando só cabe "?")
function rotuloMeio(P, k) {
  if (!exatas(P, k)) return '';
  const rt = rotulos(P, k);
  if (rt.prefixo) return rt.prefixo.trim();
  const un = rt.unidade || [];
  return un.length ? cap(un[1] || un[0]) : 'Dif.';
}

// "Renata ? Marta" em HTML, com a diferença destacada
function compactoHtml(P, r) {
  const c = padrao(r);
  return `<b>${esc(nome(P, c.menor))}</b> <span class="rel-q">${esc(qTexto(P, r.k, c))}</span> <b>${esc(nome(P, c.maior))}</b>`;
}

export function html(P, estado) {
  const { k, form, rels, mostrarPossiveis, grade } = estado;
  const editando = estado.editando ?? null;
  const emEdicao = editando != null ? rels.find((r) => String(r.id) === String(editando)) : null;
  const ks = relacionaveis(P);
  const nomeCat = (c) => esc(P.cats[c].nome);
  const rt = rotulos(P, k);
  let h = '<div class="rel">';
  if (ks.length > 1) {
    h += '<div class="seg-track rel-cats" role="group" aria-label="Categoria das anotações">';
    for (const c of ks) h += `<button class="seg-btn${c === k ? ' on' : ''}" data-rel-cat="${c}" aria-pressed="${c === k}">${nomeCat(c)}</button>`;
    h += '</div>';
  } else {
    h += `<div class="rel-cat-unica">Anotações de <b>${nomeCat(k)}</b></div>`;
  }

  // Formulário na mesma forma da anotação: [menor] [diferença ou ?] [maior]
  const opcoesItens = (sel, rotulo) => {
    let o = `<option value=""${vazio(sel) ? ' selected' : ''}>${rotulo}</option>`;
    P.cats.forEach((c, ci) => {
      o += `<optgroup label="${esc(c.nome)}">`;
      for (let i = 0; i < P.n; i++) {
        const g = ci * P.n + i;
        o += `<option value="${g}"${String(sel) === String(g) ? ' selected' : ''}>${esc(nome(P, g))}</option>`;
      }
      o += '</optgroup>';
    });
    return o;
  };
  const q = String(form.q ?? '?');
  const semOrdem = q.startsWith('±');
  const difs = exatas(P, k) ? diferencas(P, k) : [];
  const opQ = (v, txt) => `<option value="${v}"${q === v ? ' selected' : ''}>${esc(txt)}</option>`;
  const opcoesQ = opQ('?', '?') + (difs.length
    ? `<optgroup label="Diferença exata">${difs.map((v) => opQ(String(v), numero(P, k, v))).join('')}</optgroup>
       <optgroup label="Diferença, sem saber a ordem">${difs.map((v) => opQ(`±${v}`, `±${numero(P, k, v)}`)).join('')}</optgroup>`
    : '');
  const dica = vazio(form.d) ? null : Number(form.d);
  const fonte = dica == null || !P.dicas[dica]
    ? '<div class="rel-fonte-txt rel-fonte-livre">Anotação livre, sem dica ligada. Use as setas para escolher a dica.</div>'
    : `<div class="rel-fonte-txt"><span class="dica-num">${dica + 1}</span>${esc(P.dicas[dica].texto)}</div>`;
  const pronto = !vazio(form.a) && !vazio(form.b) && String(form.a) !== String(form.b);
  const previa = pronto ? { k, ...relDoForm(form) } : null;
  const botoes = emEdicao
    ? `<button class="btn-rel-sec" data-acao="rel-cancelar">Cancelar</button><button class="btn-rel-add" data-acao="rel-salvar"${pronto ? '' : ' disabled'}>Salvar</button>`
    : `<button class="btn-rel-add" data-acao="rel-add"${pronto ? '' : ' disabled'}>Anotar</button>`;
  h += `<div class="rel-form${emEdicao ? ' rel-form-edicao' : ''}">
    ${emEdicao ? `<div class="rel-editando"><span>Alterando a anotação</span><div>${compactoHtml(P, emEdicao)}</div></div>` : ''}
    <div class="rel-fonte">
      <button class="car-nav" data-rel-nav="-1" aria-label="Dica anterior">‹</button>
      ${fonte}
      <button class="car-nav" data-rel-nav="1" aria-label="Próxima dica">›</button>
    </div>
    <div class="rel-trio">
      <span class="rel-rot">${esc(semOrdem ? 'Um' : cap(rt.menorCurto))}</span>
      <span class="rel-rot rel-rot-meio">${esc(rotuloMeio(P, k))}</span>
      <span class="rel-rot">${esc(semOrdem ? 'Outro' : cap(rt.maiorCurto))}</span>
      <div class="rel-sel"><select data-rel="a" aria-label="Item menor (vem primeiro)" required>${opcoesItens(form.a, 'Item…')}</select></div>
      <div class="rel-sel rel-sel-q"><select data-rel="q" aria-label="Diferença (? se não souber)">${opcoesQ}</select></div>
      <div class="rel-sel"><select data-rel="b" aria-label="Item maior" required>${opcoesItens(form.b, 'Item…')}</select></div>
    </div>
    <div class="rel-acoes">
      <button class="rel-inverter" data-acao="rel-inverter" aria-label="Trocar os dois itens de lugar" title="Trocar os itens de lugar">⇄</button>
      <div class="rel-previa">${previa
        ? `<div class="rel-compacto">${compactoHtml(P, previa)}</div><div class="rel-leitura">${esc(texto(P, previa))}</div>`
        : !vazio(form.a) && String(form.a) === String(form.b) ? 'Escolha dois itens diferentes.' : `Primeiro o item ${esc(rt.menorCurto)}; no meio, a diferença (ou ?).`}</div>
      ${botoes}
    </div>
  </div>`;

  // Cadeias e lista
  const rk = rels.filter((r) => r.k === k);
  if (!rk.length) {
    h += `<p class="rel-vazio">Anote como na margem da revista, sempre com o item ${esc(rt.menorCurto)} primeiro: “Renata ? Marta” (sem saber quanto) ou “Suspense 1 Paulo” (diferença exata). Juntando “Renata ? Marta” e “Marta ? Paulo”, a cadeia <b>Renata ? Marta ? Paulo</b> aparece aqui e no espaço vazio da grade.</p>`;
  } else {
    const dom = mostrarPossiveis ? possiveis(P, k, rels, grade) : null;
    const no = (g) => {
      let extra = '';
      if (dom) {
        const s = dom.get(g);
        extra = s.size
          ? `<span class="rel-pos">${[...s].sort((x, y) => x - y).map((j) => esc(rotuloValor(P, k, j))).join(' · ')}</span>`
          : '<span class="rel-pos rel-pos-erro">nenhum</span>';
      }
      return `<span class="rel-no"><span class="rel-nome">${esc(nome(P, g))}</span>${extra}</span>`;
    };
    const passo = (p) => `<button class="rel-con${p.rels.some((r) => String(r.id) === String(editando)) ? ' ed' : ''}" data-rel-edit="${esc(p.rels[0].id)}" aria-label="Alterar: ${esc(texto(P, p.rels[0]))}">${esc(p.q)}</button>`;
    h += '<div class="rel-sec">Cadeias</div><div class="rel-cadeias">';
    h += desenharTrilhas(P, k, rels, { no, passo, classe: 'rel-cadeia' });
    h += '</div>';
    const semSaida = possiveis(P, k, rels, null);
    if ([...semSaida.values()].some((s) => !s.size)) {
      h += '<p class="rel-alerta">Essas anotações se contradizem. Revise uma delas.</p>';
    } else if (dom && [...dom.values()].some((s) => !s.size)) {
      h += '<p class="rel-alerta">Essas anotações não fecham com as marcações da grade. Revise uma delas (ou a grade).</p>';
    }
    h += `<div class="rel-sec">Anotações <span class="rel-cont">${rk.length}</span><span class="rel-sec-dica">toque para alterar</span></div><ul class="rel-lista">`;
    for (const r of rk) {
      const ed = String(r.id) === String(editando);
      const leitura = esc(texto(P, r));
      h += `<li class="rel-item${ed ? ' editando' : ''}" data-rel-edit="${esc(r.id)}"${ed ? ' aria-current="true"' : ''} title="${leitura}">
        <span class="rel-txt">${compactoHtml(P, r)}${r.d != null && r.d !== '' ? ` <span class="rel-tag">dica ${Number(r.d) + 1}</span>` : ''}</span>
        <button class="rel-ed" data-rel-edit="${esc(r.id)}" aria-label="Alterar anotação: ${leitura}">${LAPIS}</button>
        <button class="rel-del" data-rel-del="${esc(r.id)}" aria-label="Apagar anotação: ${leitura}">✕</button></li>`;
    }
    h += `</ul><button class="link-fechar rel-limpar" data-acao="rel-limpar">Apagar as anotações de ${nomeCat(k)}</button>`;
  }
  h += `<label class="rel-toggle"><input type="checkbox" data-rel="possiveis"${mostrarPossiveis ? ' checked' : ''}> <span>Mostrar os valores ainda possíveis de cada item (pelas anotações e pelos ✕ e S da grade)</span></label>`;
  h += '</div>';
  return h;
}

// ---------------------------------------------------------------------------
// Notas na grade: as cadeias ficam no espaço vazio da escada, como na margem
// da revista. Tocar numa diferença abre a anotação para alterar; tocar no
// resto, a aba Relação.
// ---------------------------------------------------------------------------

export function notasHtml(P, rels, editando = null) {
  const ks = relacionaveis(P).filter((k) => rels.some((r) => r.k === k));
  if (!ks.length) {
    return '<div class="notas-titulo">Relações</div><div class="notas-vazio">Toque aqui para anotar as relações das dicas, como na margem da revista: o menor primeiro, a diferença (ou ?) e o maior.</div>';
  }
  const no = (g) => `<span class="notas-no">${esc(nome(P, g))}</span>`;
  const passo = (p) => `<span class="notas-q${p.rels.some((r) => String(r.id) === String(editando)) ? ' ed' : ''}" data-rel-edit="${esc(p.rels[0].id)}">${esc(p.q)}</span>`;
  let h = '';
  for (const k of ks) {
    const contradiz = [...possiveis(P, k, rels, null).values()].some((s) => !s.size);
    h += `<div class="notas-titulo${contradiz ? ' erro' : ''}">${esc(P.cats[k].nome)}${contradiz ? ' · não fecha' : ''}</div>`;
    h += desenharTrilhas(P, k, rels, { no, passo, classe: 'notas-cadeia', juntar: 'notas-passo' });
  }
  return h;
}
