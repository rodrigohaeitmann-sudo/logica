// Motor lógico dos desafios de associação (estilo "Desafio de Lógica").
//
// É usado pelo app (verificar, dicas, quadro de respostas) e pelo validador em
// Node (scripts/validar.mjs). Não depende do DOM.
//
// Conceitos
// - Categoria c (0..m-1), todas com n itens. A categoria 0 é a principal: cada
//   item dela identifica uma "entidade" (uma linha do quadro de respostas).
// - Item global g = c*n + i (i = posição do item dentro da categoria).
// - Grade: para cada par de categorias (a < b) existe um quadro n×n. Cada casa
//   vale VAZIO (0), NAO (1, ✕) ou SIM (2, S). A grade inteira é um Uint8Array.
//
// Regras formais das dicas (arrays JSON, os itens são citados pelo nome — use
// "idDaCategoria:Nome" se o mesmo nome existir em duas categorias):
//   ["=", A, B]              A e B pertencem à mesma entidade
//   ["!=", A, B]             A e B pertencem a entidades diferentes
//   ["distintos", A, B, ...] todos pertencem a entidades diferentes
//   ["ou", A, B, C, ...]     A combina com exatamente um entre B, C, ...
//   ["par", [A, B], [C, D]]  {A, B} são as mesmas entidades que {C, D}, em alguma ordem
//   ["dif", K, A, B, k]      valor de K de A − valor de K de B = k
//   ["dist", K, A, B, k]     |valor de K de A − valor de K de B| = k
//   [">", K, A, B]           valor de K de A > valor de K de B   ("<" também existe)
//   ["extremo", K, A]        o valor de K de A é o menor ou o maior da categoria
//   ["meio", K, A]           o valor de K de A não é o menor nem o maior
// K é o id de uma categoria. Os valores vêm de "valores" da categoria (números)
// ou, se ausente, da posição do item na lista (0, 1, 2, ...).

export const VAZIO = 0;
export const NAO = 1;
export const SIM = 2;

const TOL = 1e-9;

function chave(s) {
  return String(s).normalize('NFC').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Compilação
// ---------------------------------------------------------------------------

export function compilar(d) {
  if (!d || !Array.isArray(d.categorias)) throw new Error('Desafio sem "categorias".');
  const cats = d.categorias;
  const m = cats.length;
  const n = cats[0] && Array.isArray(cats[0].itens) ? cats[0].itens.length : 0;
  if (m < 3) throw new Error('São necessárias pelo menos 3 categorias.');
  if (n < 3) throw new Error('Cada categoria precisa de pelo menos 3 itens.');

  const idsCat = new Map();
  cats.forEach((c, ci) => {
    if (!c.id) throw new Error(`Categoria ${ci + 1} sem "id".`);
    if (idsCat.has(chave(c.id))) throw new Error(`Id de categoria repetido: ${c.id}`);
    idsCat.set(chave(c.id), ci);
    if (!Array.isArray(c.itens) || c.itens.length !== n) {
      throw new Error(`A categoria "${c.nome || c.id}" deve ter ${n} itens (como a primeira).`);
    }
    if (c.valores && (!Array.isArray(c.valores) || c.valores.length !== n || c.valores.some((v) => typeof v !== 'number'))) {
      throw new Error(`"valores" da categoria "${c.nome || c.id}" deve ser uma lista de ${n} números.`);
    }
  });

  const nomes = [];
  const catDe = [];
  const idxDe = [];
  const porNome = new Map();
  const ambiguos = new Set();
  const porCatNome = new Map();
  cats.forEach((c, ci) => {
    c.itens.forEach((it, ii) => {
      const g = ci * n + ii;
      nomes[g] = String(it);
      catDe[g] = ci;
      idxDe[g] = ii;
      const k = chave(it);
      if (porCatNome.has(`${ci}|${k}`)) throw new Error(`Item repetido na categoria "${c.nome || c.id}": ${it}`);
      porCatNome.set(`${ci}|${k}`, g);
      if (porNome.has(k)) ambiguos.add(k);
      else porNome.set(k, g);
    });
  });

  const valores = cats.map((c) => (c.valores ? c.valores.slice() : c.itens.map((_, i) => i)));
  const minK = valores.map((v) => Math.min(...v));
  const maxK = valores.map((v) => Math.max(...v));

  // Índices das casas da grade
  const base = [];
  let total = 0;
  for (let a = 0; a < m; a++) {
    base[a] = [];
    for (let b = a + 1; b < m; b++) {
      base[a][b] = total;
      total += n * n;
    }
  }
  const celA = new Int16Array(total);
  const celB = new Int16Array(total);
  for (let a = 0; a < m; a++) {
    for (let b = a + 1; b < m; b++) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const c = base[a][b] + i * n + j;
          celA[c] = a * n + i;
          celB[c] = b * n + j;
        }
      }
    }
  }

  const P = {
    id: d.id,
    titulo: d.titulo,
    m,
    n,
    cats,
    nomes,
    catDe,
    idxDe,
    valores,
    minK,
    maxK,
    base,
    total,
    celA,
    celB,
    dicas: [],
    regras: [],
    solucao: null,
    entSol: null,
    gradeSolucao: null,
  };

  function catId(x, onde) {
    const ci = idsCat.get(chave(x));
    if (ci === undefined) throw new Error(`${onde}: categoria desconhecida "${x}".`);
    return ci;
  }

  function ref(x, onde) {
    const s = String(x);
    const p = s.indexOf(':');
    if (p > 0) {
      const ci = idsCat.get(chave(s.slice(0, p)));
      if (ci !== undefined) {
        const g = porCatNome.get(`${ci}|${chave(s.slice(p + 1))}`);
        if (g === undefined) throw new Error(`${onde}: item "${s.slice(p + 1)}" não existe na categoria "${s.slice(0, p)}".`);
        return g;
      }
    }
    const k = chave(s);
    if (ambiguos.has(k)) throw new Error(`${onde}: "${s}" existe em mais de uma categoria; use "idCategoria:${s}".`);
    const g = porNome.get(k);
    if (g === undefined) throw new Error(`${onde}: item desconhecido "${s}".`);
    return g;
  }

  P.ref = (x) => ref(x, 'Referência');
  P.compilarRegra = (r, onde = 'Regra') => compilarRegra(r, onde);

  function compilarRegra(r, onde) {
    if (!Array.isArray(r) || r.length === 0) throw new Error(`${onde}: regra inválida.`);
    const [t, ...a] = r;
    let out;
    switch (t) {
      case '=':
      case '!=':
        if (a.length !== 2) throw new Error(`${onde}: "${t}" precisa de 2 itens.`);
        out = { t, refs: [ref(a[0], onde), ref(a[1], onde)] };
        break;
      case 'distintos':
        if (a.length < 2) throw new Error(`${onde}: "distintos" precisa de 2 ou mais itens.`);
        out = { t, refs: a.map((x) => ref(x, onde)) };
        break;
      case 'ou':
        if (a.length < 3) throw new Error(`${onde}: "ou" precisa de um item e 2 ou mais opções.`);
        out = { t, refs: a.map((x) => ref(x, onde)) };
        break;
      case 'par': {
        if (a.length !== 2 || !Array.isArray(a[0]) || !Array.isArray(a[1]) || a[0].length !== a[1].length || a[0].length < 2) {
          throw new Error(`${onde}: "par" precisa de duas listas do mesmo tamanho (2 ou mais).`);
        }
        const A = a[0].map((x) => ref(x, onde));
        const B = a[1].map((x) => ref(x, onde));
        out = { t, A, B, refs: [...A, ...B] };
        break;
      }
      case 'dif':
      case 'dist':
        if (a.length !== 4 || typeof a[3] !== 'number') throw new Error(`${onde}: "${t}" é [${t}, categoria, A, B, número].`);
        out = { t, K: catId(a[0], onde), refs: [ref(a[1], onde), ref(a[2], onde)], k: a[3] };
        break;
      case '>':
      case '<': {
        if (a.length !== 3) throw new Error(`${onde}: "${t}" é [${t}, categoria, A, B].`);
        const K = catId(a[0], onde);
        const x = ref(a[1], onde);
        const y = ref(a[2], onde);
        out = { t: '>', K, refs: t === '>' ? [x, y] : [y, x] };
        break;
      }
      case 'extremo':
      case 'meio':
        if (a.length !== 2) throw new Error(`${onde}: "${t}" é [${t}, categoria, A].`);
        out = { t, K: catId(a[0], onde), refs: [ref(a[1], onde)] };
        break;
      default:
        throw new Error(`${onde}: tipo de regra desconhecido "${t}".`);
    }
    const unicos = new Set(out.refs);
    if (unicos.size !== out.refs.length) throw new Error(`${onde}: o mesmo item aparece duas vezes na regra.`);
    out.escopo = new Set(out.refs.map((g) => catDe[g]));
    if (out.K !== undefined) out.escopo.add(out.K);
    return out;
  }

  // Dicas
  (d.dicas || []).forEach((dc, i) => {
    const onde = `Dica ${i + 1}`;
    if (!dc || typeof dc.texto !== 'string') throw new Error(`${onde}: falta "texto".`);
    const regras = (dc.regras || []).map((r, j) => {
      const cr = compilarRegra(r, `${onde}, regra ${j + 1}`);
      cr.dica = i;
      return cr;
    });
    P.dicas.push(prepararDica(P, i, dc.texto, regras));
    P.regras.push(...regras);
  });

  // Solução declarada
  if (Array.isArray(d.solucao)) {
    if (d.solucao.length !== n) throw new Error(`A solução deve ter ${n} linhas.`);
    const ent = new Int8Array(m * n).fill(-1);
    d.solucao.forEach((linha, e) => {
      if (!Array.isArray(linha) || linha.length !== m) throw new Error(`Solução, linha ${e + 1}: precisa de ${m} itens (um por categoria, na ordem).`);
      linha.forEach((nome, c) => {
        const g = porCatNome.get(`${c}|${chave(nome)}`);
        if (g === undefined) throw new Error(`Solução, linha ${e + 1}: "${nome}" não é item da categoria "${cats[c].nome || cats[c].id}".`);
        if (ent[g] !== -1) throw new Error(`Solução: "${nome}" aparece em mais de uma linha.`);
        ent[g] = -2 - e; // provisório
      });
    });
    // Entidade = índice do item da categoria 0 da linha
    const entSol = new Int8Array(m * n);
    d.solucao.forEach((linha) => {
      const e0 = porCatNome.get(`0|${chave(linha[0])}`);
      linha.forEach((nome, c) => {
        entSol[porCatNome.get(`${c}|${chave(nome)}`)] = idxDe[e0];
      });
    });
    P.entSol = entSol;
    P.solucao = Array.from({ length: m }, (_, c) => {
      const arr = new Int8Array(n);
      for (let i = 0; i < n; i++) arr[entSol[c * n + i]] = i;
      return arr;
    });
    const gs = new Uint8Array(total);
    for (let c = 0; c < total; c++) gs[c] = entSol[celA[c]] === entSol[celB[c]] ? SIM : NAO;
    P.gradeSolucao = gs;
  }

  return P;
}

// Pré-calcula o que a dedução por dica precisa (ver prepararConjunto).
function prepararDica(P, i, texto, regras) {
  const C = prepararConjunto(P, regras);
  const direta = regras.length > 0 && regras.every((r) => r.t === '=' || r.t === '!=');
  return { ...C, i, texto, regras, direta };
}

// Para um conjunto de regras (de uma dica ou de duas dicas juntas):
// - refs: itens citados; rel: pares (categoria de relação, item) cujo valor importa;
// - vars: ordem de atribuição (entidade de cada item, intercalada com os valores
//   de relação daquele item), e em que ponto cada regra já pode ser avaliada.
function prepararConjunto(P, regras) {
  const refs = [];
  const pos = new Map();
  for (const r of regras) {
    for (const g of r.refs) {
      if (!pos.has(g)) {
        pos.set(g, refs.length);
        refs.push(g);
      }
    }
  }
  const rel = [];
  const relPos = new Map();
  for (const r of regras) {
    if (r.K === undefined) continue;
    for (const g of r.refs) {
      const k = r.K * P.m * P.n + g;
      if (!relPos.has(k)) {
        relPos.set(k, rel.length);
        rel.push([r.K, pos.get(g)]);
      }
    }
  }
  const vars = [];
  const varEnt = new Array(refs.length);
  const varRel = new Array(rel.length);
  for (let i = 0; i < refs.length; i++) {
    varEnt[i] = vars.length;
    vars.push({ tipo: 'ent', i });
    for (let t = 0; t < rel.length; t++) {
      if (rel[t][1] === i) {
        varRel[t] = vars.length;
        vars.push({ tipo: 'rel', t });
      }
    }
  }
  const regrasApos = vars.map(() => []);
  for (const r of regras) {
    let ult = 0;
    for (const g of r.refs) {
      ult = Math.max(ult, varEnt[pos.get(g)]);
      if (r.K !== undefined) ult = Math.max(ult, varRel[relPos.get(r.K * P.m * P.n + g)]);
    }
    regrasApos[ult].push(r);
  }
  return { refs, pos, rel, relPos, vars, regrasApos };
}

// ---------------------------------------------------------------------------
// Grade: utilidades
// ---------------------------------------------------------------------------

export function celula(P, gA, gB) {
  let ca = P.catDe[gA];
  let cb = P.catDe[gB];
  if (ca === cb) return -1;
  if (ca > cb) {
    const t = gA; gA = gB; gB = t;
    const u = ca; ca = cb; cb = u;
  }
  return P.base[ca][cb] + P.idxDe[gA] * P.n + P.idxDe[gB];
}

// Tabela (item A · N + item B) → casa, ou -1 se forem da mesma categoria.
// Calculada uma vez por desafio; acelera as varreduras da grade.
const cacheCelulas = new WeakMap();
function tabelaCelulas(P) {
  let t = cacheCelulas.get(P);
  if (t) return t;
  const N = P.m * P.n;
  t = new Int32Array(N * N);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) t[x * N + y] = celula(P, x, y);
  cacheCelulas.set(P, t);
  return t;
}

export function novaGrade(P) {
  return new Uint8Array(P.total);
}

export function gradeDeTexto(P, s) {
  const g = new Uint8Array(P.total);
  if (typeof s === 'string' && s.length === P.total) {
    for (let i = 0; i < P.total; i++) {
      const v = s.charCodeAt(i) - 48;
      g[i] = v === NAO || v === SIM ? v : VAZIO;
    }
  }
  return g;
}

export function gradeParaTexto(g) {
  let s = '';
  for (let i = 0; i < g.length; i++) s += String(g[i]);
  return s;
}

// Casas que ficam com ✕ automaticamente: mesma linha/coluna de um S no mesmo quadro.
export function autoX(P, g) {
  const { n } = P;
  const out = new Uint8Array(P.total);
  for (let a = 0; a < P.m; a++) {
    for (let b = a + 1; b < P.m; b++) {
      const base = P.base[a][b];
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (g[base + i * n + j] !== SIM) continue;
          for (let k = 0; k < n; k++) {
            if (k !== j && g[base + i * n + k] === VAZIO) out[base + i * n + k] = 1;
            if (k !== i && g[base + k * n + j] === VAZIO) out[base + k * n + j] = 1;
          }
        }
      }
    }
  }
  return out;
}

// Combina marcações do jogador com os ✕ automáticos.
export function gradeEfetiva(P, g, comAutoX = true) {
  const e = Uint8Array.from(g);
  if (comAutoX) {
    const ax = autoX(P, g);
    for (let i = 0; i < e.length; i++) if (ax[i]) e[i] = NAO;
  }
  return e;
}

// Casas marcadas diferente da solução.
export function erros(P, g) {
  const out = [];
  for (let c = 0; c < P.total; c++) {
    if (g[c] !== VAZIO && g[c] !== P.gradeSolucao[c]) out.push(c);
  }
  return out;
}

// Resolvido = todos os S da solução marcados e nenhum S errado.
export function resolvido(P, g) {
  for (let c = 0; c < P.total; c++) {
    const s = P.gradeSolucao[c];
    if (s === SIM && g[c] !== SIM) return false;
    if (s === NAO && g[c] === SIM) return false;
  }
  return true;
}

// Conflitos visíveis sem olhar a solução: dois S na mesma linha/coluna de um
// quadro ou uma linha/coluna inteira de ✕.
export function conflitos(P, g) {
  const { n } = P;
  const out = new Set();
  for (let a = 0; a < P.m; a++) {
    for (let b = a + 1; b < P.m; b++) {
      const base = P.base[a][b];
      for (let i = 0; i < n; i++) {
        let sims = 0;
        let naos = 0;
        let sims2 = 0;
        let naos2 = 0;
        for (let j = 0; j < n; j++) {
          const v = g[base + i * n + j];
          if (v === SIM) sims++;
          else if (v === NAO) naos++;
          const w = g[base + j * n + i];
          if (w === SIM) sims2++;
          else if (w === NAO) naos2++;
        }
        if (sims > 1 || naos === n) for (let j = 0; j < n; j++) out.add(base + i * n + j);
        if (sims2 > 1 || naos2 === n) for (let j = 0; j < n; j++) out.add(base + j * n + i);
      }
    }
  }
  return out;
}

// Quadro de respostas a partir dos S (com transitividade): para cada item da
// categoria principal, o item de cada categoria ligado a ele (ou null).
export function quadroRespostas(P, g) {
  const N = P.m * P.n;
  const pai = Array.from({ length: N }, (_, i) => i);
  const achar = (x) => {
    while (pai[x] !== x) {
      pai[x] = pai[pai[x]];
      x = pai[x];
    }
    return x;
  };
  for (let c = 0; c < P.total; c++) {
    if (g[c] === SIM) {
      const ra = achar(P.celA[c]);
      const rb = achar(P.celB[c]);
      if (ra !== rb) pai[ra] = rb;
    }
  }
  const grupos = new Map();
  for (let x = 0; x < N; x++) {
    const r = achar(x);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(x);
  }
  const linhas = [];
  for (let e = 0; e < P.n; e++) {
    const grupo = grupos.get(achar(e));
    const linha = [e];
    for (let c = 1; c < P.m; c++) {
      const daCat = grupo.filter((x) => P.catDe[x] === c);
      linha.push(daCat.length === 1 ? daCat[0] : daCat.length > 1 ? -2 : -1);
    }
    linhas.push(linha);
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Avaliação de regras
// ---------------------------------------------------------------------------

function avaliar(P, r, ent, val) {
  switch (r.t) {
    case '=':
      return ent(r.refs[0]) === ent(r.refs[1]);
    case '!=':
      return ent(r.refs[0]) !== ent(r.refs[1]);
    case 'distintos': {
      const vistos = new Set();
      for (const g of r.refs) {
        const e = ent(g);
        if (vistos.has(e)) return false;
        vistos.add(e);
      }
      return true;
    }
    case 'ou': {
      const e = ent(r.refs[0]);
      let c = 0;
      for (let i = 1; i < r.refs.length; i++) if (ent(r.refs[i]) === e) c++;
      return c === 1;
    }
    case 'par': {
      const ea = r.A.map(ent);
      const eb = r.B.map(ent);
      if (new Set(ea).size !== ea.length) return false;
      return ea.every((e) => eb.includes(e)) && eb.every((e) => ea.includes(e));
    }
    case 'dif':
      return Math.abs(val(r.K, r.refs[0]) - val(r.K, r.refs[1]) - r.k) < TOL;
    case 'dist':
      return Math.abs(Math.abs(val(r.K, r.refs[0]) - val(r.K, r.refs[1])) - r.k) < TOL;
    case '>':
      return val(r.K, r.refs[0]) > val(r.K, r.refs[1]) + TOL;
    case 'extremo': {
      const v = val(r.K, r.refs[0]);
      return Math.abs(v - P.minK[r.K]) < TOL || Math.abs(v - P.maxK[r.K]) < TOL;
    }
    case 'meio': {
      const v = val(r.K, r.refs[0]);
      return !(Math.abs(v - P.minK[r.K]) < TOL || Math.abs(v - P.maxK[r.K]) < TOL);
    }
    default:
      throw new Error(`Regra desconhecida: ${r.t}`);
  }
}

// A solução declarada cumpre cada regra? Retorna a lista de dicas violadas.
export function conferirSolucao(P) {
  const violadas = [];
  if (!P.entSol) return violadas;
  const ent = (g) => P.entSol[g];
  const val = (K, g) => P.valores[K][P.solucao[K][P.entSol[g]]];
  for (const d of P.dicas) {
    for (const r of d.regras) {
      if (!avaliar(P, r, ent, val)) {
        violadas.push(d.i);
        break;
      }
    }
  }
  return violadas;
}

// ---------------------------------------------------------------------------
// Força bruta: conta soluções (para validar unicidade)
// ---------------------------------------------------------------------------

function permutacoes(n) {
  const out = [];
  const a = Array.from({ length: n }, (_, i) => i);
  const usado = new Array(n).fill(false);
  const cur = [];
  (function rec() {
    if (cur.length === n) {
      out.push(Int8Array.from(cur));
      return;
    }
    for (let i = 0; i < n; i++) {
      if (usado[i]) continue;
      usado[i] = true;
      cur.push(a[i]);
      rec();
      cur.pop();
      usado[i] = false;
    }
  })();
  return out;
}

export function contarSolucoes(P, { limite = 2, regras = null } = {}) {
  const lista = regras || P.regras;
  const { m, n } = P;
  const perms = permutacoes(n);
  const perm = new Array(m).fill(null);
  const inv = Array.from({ length: m }, () => new Int8Array(n));
  const id = Int8Array.from({ length: n }, (_, i) => i);
  perm[0] = id;
  inv[0] = id;

  const ent = (g) => {
    const c = P.catDe[g];
    return c === 0 ? P.idxDe[g] : inv[c][P.idxDe[g]];
  };
  const val = (K, g) => P.valores[K][perm[K][ent(g)]];

  // Ordem gulosa: a cada passo, a categoria que libera mais regras.
  const atribuidas = new Set([0]);
  const ordem = [];
  const restantes = new Set(Array.from({ length: m - 1 }, (_, i) => i + 1));
  while (restantes.size) {
    let melhor = -1;
    let melhorQtd = -1;
    for (const c of restantes) {
      let q = 0;
      for (const r of lista) {
        let cobre = true;
        for (const x of r.escopo) if (x !== c && !atribuidas.has(x)) { cobre = false; break; }
        if (cobre && r.escopo.has(c)) q++;
      }
      if (q > melhorQtd) { melhorQtd = q; melhor = c; }
    }
    ordem.push(melhor);
    atribuidas.add(melhor);
    restantes.delete(melhor);
  }
  const checar = ordem.map(() => []);
  const iniciais = [];
  for (const r of lista) {
    let nivel = -1;
    for (const x of r.escopo) {
      if (x === 0) continue;
      nivel = Math.max(nivel, ordem.indexOf(x));
    }
    if (nivel < 0) iniciais.push(r);
    else checar[nivel].push(r);
  }

  const solucoes = [];
  for (const r of iniciais) if (!avaliar(P, r, ent, val)) return { total: 0, solucoes };

  let total = 0;
  (function rec(nivel) {
    if (total >= limite) return;
    if (nivel === ordem.length) {
      total++;
      solucoes.push(perm.map((p) => Array.from(p)));
      return;
    }
    const c = ordem[nivel];
    for (const p of perms) {
      perm[c] = p;
      for (let e = 0; e < n; e++) inv[c][p[e]] = e;
      let ok = true;
      for (const r of checar[nivel]) {
        if (!avaliar(P, r, ent, val)) { ok = false; break; }
      }
      if (ok) rec(nivel + 1);
      if (total >= limite) break;
    }
    perm[c] = null;
  })(0);

  return { total, solucoes };
}

// ---------------------------------------------------------------------------
// Dedução passo a passo (como uma pessoa resolveria, sem chutar)
// ---------------------------------------------------------------------------
//
// Cada passo: { tipo, marcas: [[casa, valor], ...], ...detalhes }
//   G1 eliminação: um S risca o resto da linha e da coluna no mesmo quadro
//   G2 única opção: só sobrou uma casa livre para um item num quadro
//   G3 transitividade: A–B S e B–C S ⇒ A–C S
//   G4 transitividade: A–B S e B–C ✕ ⇒ A–C ✕
//   G5 cruzamento: todas as opções de A numa categoria são ✕ com C ⇒ A–C ✕
//   dica: o que a dica permite concluir com o que já se sabe

function* passosG1(P, g) {
  const { n } = P;
  for (let a = 0; a < P.m; a++) {
    for (let b = a + 1; b < P.m; b++) {
      const base = P.base[a][b];
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (g[base + i * n + j] !== SIM) continue;
          const marcas = [];
          for (let k = 0; k < n; k++) {
            if (k !== j && g[base + i * n + k] === VAZIO) marcas.push([base + i * n + k, NAO]);
            if (k !== i && g[base + k * n + j] === VAZIO) marcas.push([base + k * n + j, NAO]);
          }
          if (marcas.length) yield { tipo: 'G1', marcas, a: a * n + i, b: b * n + j };
        }
      }
    }
  }
}

function* passosG2(P, g) {
  const { n } = P;
  for (let a = 0; a < P.m; a++) {
    for (let b = a + 1; b < P.m; b++) {
      const base = P.base[a][b];
      for (let i = 0; i < n; i++) {
        // linha i (item a*n+i)
        let livres = 0, sims = 0, ult = -1;
        for (let j = 0; j < n; j++) {
          const v = g[base + i * n + j];
          if (v === SIM) sims++;
          else if (v === VAZIO) { livres++; ult = j; }
        }
        if (sims === 0 && livres === 1) {
          yield { tipo: 'G2', marcas: [[base + i * n + ult, SIM]], item: a * n + i, outra: b, escolhido: b * n + ult };
        }
        // coluna i (item b*n+i)
        livres = 0; sims = 0; ult = -1;
        for (let j = 0; j < n; j++) {
          const v = g[base + j * n + i];
          if (v === SIM) sims++;
          else if (v === VAZIO) { livres++; ult = j; }
        }
        if (sims === 0 && livres === 1) {
          yield { tipo: 'G2', marcas: [[base + ult * n + i, SIM]], item: b * n + i, outra: a, escolhido: a * n + ult };
        }
      }
    }
  }
}

// Mesma ordem de sempre (A, B, C, a, b, c); os pares a–b com S de cada (A, B)
// são listados uma vez só.
function* passosG34(P, g, tipo) {
  const { m, n } = P;
  const N = m * n;
  const T = tabelaCelulas(P);
  const quer = tipo === 'G3' ? SIM : NAO;
  for (let A = 0; A < m; A++) {
    for (let B = 0; B < m; B++) {
      if (B === A) continue;
      const pares = [];
      for (let a = A * n; a < A * n + n; a++) {
        for (let b = B * n; b < B * n + n; b++) if (g[T[a * N + b]] === SIM) pares.push(a, b);
      }
      if (!pares.length) continue;
      for (let C = 0; C < m; C++) {
        if (C === A || C === B) continue;
        for (let k = 0; k < pares.length; k += 2) {
          const a = pares[k];
          const b = pares[k + 1];
          for (let c = C * n; c < C * n + n; c++) {
            const ac = T[a * N + c];
            if (g[ac] !== VAZIO) continue;
            if (g[T[b * N + c]] === quer) yield { tipo, marcas: [[ac, quer]], a, b, c };
          }
        }
      }
    }
  }
}

function* passosG5(P, g) {
  const { m, n } = P;
  const N = m * n;
  const T = tabelaCelulas(P);
  for (let A = 0; A < m; A++) {
    for (let C = 0; C < m; C++) {
      if (C === A) continue;
      for (let a = A * n; a < A * n + n; a++) {
        for (let c = C * n; c < C * n + n; c++) {
          const ac = T[a * N + c];
          if (g[ac] !== VAZIO) continue;
          for (let B = 0; B < m; B++) {
            if (B === A || B === C) continue;
            let tem = false;
            let todos = true;
            for (let b = B * n; b < B * n + n; b++) {
              if (g[T[a * N + b]] === NAO) continue;
              tem = true;
              if (g[T[b * N + c]] !== NAO) {
                todos = false;
                break;
              }
            }
            if (!tem || !todos) continue;
            const cand = [];
            for (let b = B * n; b < B * n + n; b++) if (g[T[a * N + b]] !== NAO) cand.push(b);
            yield { tipo: 'G5', marcas: [[ac, NAO]], a, c, cand };
            break;
          }
        }
      }
    }
  }
}

function dominioEntidade(P, g, x) {
  if (P.catDe[x] === 0) return [P.idxDe[x]];
  const out = [];
  for (let e = 0; e < P.n; e++) {
    const v = g[celula(P, e, x)];
    if (v === SIM) return [e];
    if (v !== NAO) out.push(e);
  }
  return out;
}

// Enumera os "mundos locais" de um conjunto de regras (onde cada item citado
// pode estar e quais valores de relação ele pode ter) compatíveis com a grade;
// o que for igual em todos os mundos vira dedução. Retorna {marcas} ou {contradicao}.
export function deduzirDica(P, g, D, { limiteMundos = 2e6 } = {}) {
  const { n, m } = P;
  const R = D.refs.length;
  const T = D.rel.length;
  const dom = D.refs.map((x) => dominioEntidade(P, g, x));
  const ents = new Int8Array(R).fill(-1);
  const kv = new Int8Array(T).fill(-1);
  const possEnt = D.refs.map(() => new Set());
  const viuIgual = Array.from({ length: R }, () => new Array(R).fill(false));
  const viuDif = Array.from({ length: R }, () => new Array(R).fill(false));
  const possK = D.rel.map(() => new Set());
  let mundos = 0;
  let nos = 0;
  let estourou = false;

  const ent = (x) => ents[D.pos.get(x)];
  const val = (K, x) => P.valores[K][kv[D.relPos.get(K * m * n + x)]];

  // Item x (ref i) na entidade e é compatível com o que já foi atribuído?
  function entOk(i, e) {
    const x = D.refs[i];
    for (let j = 0; j < R; j++) {
      if (j === i || ents[j] < 0) continue;
      const y = D.refs[j];
      if (P.catDe[x] === P.catDe[y]) {
        if (ents[j] === e) return false;
      } else {
        const v = g[celula(P, x, y)];
        if (ents[j] === e ? v === NAO : v === SIM) return false;
      }
    }
    for (let t = 0; t < T; t++) {
      if (kv[t] < 0) continue;
      const [K, rj] = D.rel[t];
      const ej = ents[rj];
      if (P.catDe[x] === K) {
        if (ej === e ? kv[t] !== P.idxDe[x] : kv[t] === P.idxDe[x]) return false;
      } else {
        const v = g[celula(P, x, K * n + kv[t])];
        if (ej === e ? v === NAO : v === SIM) return false;
      }
    }
    return true;
  }

  // Valor k da categoria K para a entidade do item da ref ri é compatível?
  function relCandidatos(t) {
    const [K, ri] = D.rel[t];
    const x = D.refs[ri];
    const e = ents[ri];
    if (P.catDe[x] === K) return [P.idxDe[x]];
    if (K === 0) return [e];
    const out = [];
    for (let k = 0; k < n; k++) {
      const y = K * n + k;
      if (g[celula(P, x, y)] === NAO || g[celula(P, e, y)] === NAO) continue;
      let ok = true;
      for (let j = 0; j < R && ok; j++) {
        if (j === ri || ents[j] < 0) continue;
        const s = D.refs[j];
        if (P.catDe[s] === K) {
          if (ents[j] === e ? k !== P.idxDe[s] : k === P.idxDe[s]) ok = false;
        } else {
          const v = g[celula(P, s, y)];
          if (ents[j] === e ? v === NAO : v === SIM) ok = false;
        }
      }
      for (let u = 0; u < T && ok; u++) {
        if (u === t || kv[u] < 0 || D.rel[u][0] !== K) continue;
        const eu = ents[D.rel[u][1]];
        if (eu === e ? kv[u] !== k : kv[u] === k) ok = false;
      }
      if (ok) out.push(k);
    }
    return out;
  }

  function regrasOk(v) {
    for (const r of D.regrasApos[v]) if (!avaliar(P, r, ent, val)) return false;
    return true;
  }

  function registrar() {
    mundos++;
    for (let i = 0; i < R; i++) {
      possEnt[i].add(ents[i]);
      for (let j = i + 1; j < R; j++) {
        if (ents[i] === ents[j]) viuIgual[i][j] = true;
        else viuDif[i][j] = true;
      }
    }
    for (let t = 0; t < T; t++) possK[t].add(kv[t]);
  }

  (function rec(v) {
    if (estourou) return;
    if (++nos > limiteMundos) { estourou = true; return; }
    if (v === D.vars.length) { registrar(); return; }
    const V = D.vars[v];
    if (V.tipo === 'ent') {
      const i = V.i;
      for (const e of dom[i]) {
        if (!entOk(i, e)) continue;
        ents[i] = e;
        if (regrasOk(v)) rec(v + 1);
        ents[i] = -1;
      }
    } else {
      const t = V.t;
      for (const k of relCandidatos(t)) {
        kv[t] = k;
        if (regrasOk(v)) rec(v + 1);
        kv[t] = -1;
      }
    }
  })(0);

  if (estourou) return { marcas: [], estourou: true };
  if (mundos === 0) return { contradicao: true, marcas: [] };

  const marcas = new Map();
  const marcar = (c, v) => {
    if (c >= 0 && g[c] === VAZIO && !marcas.has(c)) marcas.set(c, v);
  };
  for (let i = 0; i < R; i++) {
    const x = D.refs[i];
    if (P.catDe[x] === 0) continue;
    if (possEnt[i].size === 1) marcar(celula(P, [...possEnt[i]][0], x), SIM);
    for (const e of dom[i]) if (!possEnt[i].has(e)) marcar(celula(P, e, x), NAO);
  }
  for (let i = 0; i < R; i++) {
    for (let j = i + 1; j < R; j++) {
      const x = D.refs[i];
      const y = D.refs[j];
      if (P.catDe[x] === P.catDe[y] || P.catDe[x] === 0 || P.catDe[y] === 0) continue;
      if (!viuDif[i][j]) marcar(celula(P, x, y), SIM);
      if (!viuIgual[i][j]) marcar(celula(P, x, y), NAO);
    }
  }
  for (let t = 0; t < T; t++) {
    const [K, ri] = D.rel[t];
    const x = D.refs[ri];
    if (K === 0 || P.catDe[x] === K) continue;
    if (possK[t].size === 1) marcar(celula(P, x, K * n + [...possK[t]][0]), SIM);
    for (let k = 0; k < n; k++) if (!possK[t].has(k)) marcar(celula(P, x, K * n + k), NAO);
  }
  return { marcas: [...marcas.entries()] };
}

// Dica direta ("=" / "!="): marca só a casa que a própria dica cita; as
// consequências ficam para as regras da grade (G1–G5), que explicam melhor.
function deduzirDicaDireta(P, g, D) {
  const marcas = [];
  for (const r of D.regras) {
    const c = celula(P, r.refs[0], r.refs[1]);
    if (c < 0) {
      if (r.t === '=') return { contradicao: true, marcas: [] };
      continue;
    }
    const v = r.t === '=' ? SIM : NAO;
    if (g[c] === VAZIO) marcas.push([c, v]);
    else if (g[c] !== v) return { contradicao: true, marcas: [] };
  }
  return { marcas };
}

// Remove de uma lista de marcas os ✕ que são mera consequência (G1) de um S
// da própria lista — deixa a explicação da dica mais enxuta.
function enxugar(P, marcas) {
  const sims = marcas.filter(([, v]) => v === SIM).map(([c]) => c);
  if (!sims.length) return marcas;
  const { n } = P;
  const implicados = new Set();
  for (const c of sims) {
    let a = 0;
    let b = 1;
    outer: for (a = 0; a < P.m; a++) {
      for (b = a + 1; b < P.m; b++) {
        if (c >= P.base[a][b] && c < P.base[a][b] + n * n) break outer;
      }
    }
    const base = P.base[a][b];
    const i = Math.floor((c - base) / n);
    const j = (c - base) % n;
    for (let k = 0; k < n; k++) {
      implicados.add(base + i * n + k);
      implicados.add(base + k * n + j);
    }
  }
  return marcas.filter(([c, v]) => v === SIM || !implicados.has(c));
}

function primeiro(gen) {
  const r = gen.next();
  return r.done ? null : r.value;
}

// Próximo passo lógico a partir da grade g (que deve estar correta).
// Ordem pensada para dicas: do mais mecânico ao que exige reler as dicas.
// { pares: false } desliga a técnica de juntar duas dicas (usada para medir o
// nível: um desafio médio sai sem ela).
export function proximoPasso(P, g, { pares = true } = {}) {
  let p = primeiro(passosG1(P, g));
  if (p) return p;
  for (const D of P.dicas) {
    if (!D.direta) continue;
    const r = deduzirDicaDireta(P, g, D);
    if (r.contradicao) return { tipo: 'contradicao', dica: D.i, marcas: [] };
    if (r.marcas.length) return { tipo: 'dica', dica: D.i, marcas: r.marcas, direta: true };
  }
  p = primeiro(passosG2(P, g));
  if (p) return p;
  p = primeiro(passosG34(P, g, 'G3'));
  if (p) return p;
  p = primeiro(passosG34(P, g, 'G4'));
  if (p) return p;
  p = primeiro(passosG5(P, g));
  if (p) return p;
  for (const D of P.dicas) {
    if (D.direta) continue;
    const r = deduzirDica(P, g, D);
    if (r.contradicao) return { tipo: 'contradicao', dica: D.i, marcas: [] };
    if (r.marcas.length) return { tipo: 'dica', dica: D.i, marcas: enxugar(P, r.marcas) };
  }
  // Juntar duas dicas (técnica mais difícil): só pares que falam de algo em comum.
  if (!pares) return null;
  for (const [i, j] of paresDeDicas(P)) {
    const D = conjuntoDoPar(P, i, j);
    const r = deduzirDica(P, g, D);
    if (r.contradicao) return { tipo: 'contradicao', dica: i, dicas: [i, j], marcas: [] };
    if (r.marcas.length) return { tipo: 'dicas', dicas: [i, j], marcas: enxugar(P, r.marcas) };
  }
  return null;
}

// Pares de dicas que compartilham um item ou uma categoria (de item ou de relação).
function paresDeDicas(P) {
  if (P._pares) return P._pares;
  const cats = P.dicas.map((D) => {
    const s = new Set();
    for (const r of D.regras) for (const c of r.escopo) s.add(c);
    s.delete(0);
    return s;
  });
  const itens = P.dicas.map((D) => new Set(D.refs));
  const pares = [];
  for (let i = 0; i < P.dicas.length; i++) {
    for (let j = i + 1; j < P.dicas.length; j++) {
      const compartilhaItem = [...itens[i]].some((x) => itens[j].has(x));
      const compartilhaCat = [...cats[i]].some((c) => cats[j].has(c));
      if (compartilhaItem || compartilhaCat) pares.push([i, j, compartilhaItem ? 0 : 1]);
    }
  }
  pares.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
  P._pares = pares.map(([i, j]) => [i, j]);
  return P._pares;
}

function conjuntoDoPar(P, i, j) {
  P._conjPar = P._conjPar || new Map();
  const k = i * 1000 + j;
  if (!P._conjPar.has(k)) P._conjPar.set(k, prepararConjunto(P, [...P.dicas[i].regras, ...P.dicas[j].regras]));
  return P._conjPar.get(k);
}

// Aplica deduções até não haver mais. Não chuta.
export function deduzirTudo(P, inicial = null, { maxPassos = 5000, pares = true } = {}) {
  const g = inicial ? Uint8Array.from(inicial) : novaGrade(P);
  const passos = [];
  let contradicao = false;
  for (let k = 0; k < maxPassos; k++) {
    const p = proximoPasso(P, g, { pares });
    if (!p) break;
    if (p.tipo === 'contradicao') { contradicao = true; passos.push(p); break; }
    for (const [c, v] of p.marcas) {
      if (g[c] !== VAZIO && g[c] !== v) contradicao = true;
      g[c] = v;
    }
    passos.push(p);
    if (contradicao) break;
  }
  const completo = !contradicao && g.every((v) => v !== VAZIO);
  let correto = false;
  if (completo && P.gradeSolucao) correto = g.every((v, i) => v === P.gradeSolucao[i]);
  return { grade: g, passos, completo, correto, contradicao };
}

// ---------------------------------------------------------------------------
// Explicação por hipótese (prova por absurdo)
// ---------------------------------------------------------------------------
//
// Quando só juntando dicas dá para avançar, o botão Dica mostra o raciocínio de
// quem resolve no papel: "suponha que A combine com B; então …; mas aí … —
// impossível". A cadeia usa só passos simples (regras da grade e dicas
// isoladas) e é enxugada para conter só o que leva à contradição.

// Contradição visível numa grade: dois S na mesma linha de um quadro, uma
// linha toda de ✕, ou A–B e A–C com S mas B–C com ✕. Devolve as casas que a
// provam (ou null).
export function contradicaoGrade(P, g) {
  const { n } = P;
  for (let a = 0; a < P.m; a++) {
    for (let b = a + 1; b < P.m; b++) {
      const base = P.base[a][b];
      for (let i = 0; i < n; i++) {
        // linha i (item a·n+i) e coluna i (item b·n+i): passo 1 e n entre casas
        for (const [ini, passo, item, outra] of [[base + i * n, 1, a * n + i, b], [base + i, n, b * n + i, a]]) {
          let sims = 0;
          let naos = 0;
          for (let j = 0; j < n; j++) {
            const v = g[ini + j * passo];
            if (v === SIM) sims++;
            else if (v === NAO) naos++;
          }
          if (sims < 2 && naos < n) continue;
          const L = [];
          for (let j = 0; j < n; j++) L.push(ini + j * passo);
          if (sims > 1) return { tipo: 'dois', item, casas: L.filter((c) => g[c] === SIM).slice(0, 2) };
          return { tipo: 'nenhum', item, outra, casas: L };
        }
      }
    }
  }
  const N = P.m * n;
  const T = tabelaCelulas(P);
  const sims = [];
  for (let x = 0; x < N; x++) {
    sims.length = 0;
    for (let y = 0; y < N; y++) {
      const c = T[x * N + y];
      if (c >= 0 && g[c] === SIM) sims.push(y);
    }
    for (let i = 0; i < sims.length; i++) {
      for (let j = i + 1; j < sims.length; j++) {
        const y = sims[i];
        const z = sims[j];
        const c = T[y * N + z];
        if (c >= 0 && g[c] === NAO) return { tipo: 'trans', x, y, z, casas: [T[x * N + y], T[x * N + z], c] };
      }
    }
  }
  return null;
}

// Há contradição envolvendo alguma das casas `mudou`? (Mais rápido que
// varrer a grade toda; vale quando a grade não tinha contradição antes delas.)
function haContradicao(P, g, mudou) {
  const { n } = P;
  const N = P.m * n;
  const T = tabelaCelulas(P);
  for (const c of mudou) {
    const a = P.celA[c];
    const b = P.celB[c];
    const A = P.catDe[a];
    const B = P.catDe[b];
    for (const [x, Y] of [[a, B], [b, A]]) {
      let sims = 0;
      let naos = 0;
      for (let y = Y * n; y < Y * n + n; y++) {
        const v = g[T[x * N + y]];
        if (v === SIM) sims++;
        else if (v === NAO) naos++;
      }
      if (sims > 1 || naos === n) return true;
    }
    const v = g[c];
    for (let z = 0; z < N; z++) {
      const Z = P.catDe[z];
      if (Z === A || Z === B) continue;
      const az = g[T[a * N + z]];
      const bz = g[T[b * N + z]];
      if (v === SIM && ((az === SIM && bz === NAO) || (az === NAO && bz === SIM))) return true;
      if (v === NAO && az === SIM && bz === SIM) return true;
    }
  }
  return false;
}

// Casas que um passo da grade usou como premissa.
function premissasPasso(P, p) {
  const cel = (a, b) => celula(P, a, b);
  switch (p.tipo) {
    case 'G1':
      return [cel(p.a, p.b)];
    case 'G2': {
      const out = [];
      for (let k = 0; k < P.n; k++) {
        const z = p.outra * P.n + k;
        if (z !== p.escolhido) out.push(cel(p.item, z));
      }
      return out;
    }
    case 'G3':
    case 'G4':
      return [cel(p.a, p.b), cel(p.b, p.c)];
    case 'G5': {
      const B = P.catDe[p.cand[0]];
      const out = [];
      for (let k = 0; k < P.n; k++) {
        const b = B * P.n + k;
        if (!p.cand.includes(b)) out.push(cel(p.a, b));
      }
      for (const b of p.cand) out.push(cel(b, p.c));
      return out;
    }
    default:
      return null;
  }
}

// Entre as casas `candidatas`, as que a dica D precisa para continuar
// concluindo `alvo` (ou, com contradicao, para continuar impossível). Tenta
// dispensar primeiro as do fim da lista, para ficar com as mais antigas (que
// pedem menos passos para explicar).
function premissasDica(P, gAntes, D, alvo, candidatas, contradicao) {
  const segue = (gr) => {
    const r = deduzirDica(P, gr, D);
    if (r.estourou) return false;
    if (r.contradicao) return true;
    if (contradicao) return false;
    const m = new Map(r.marcas);
    return alvo.every(([c, v]) => m.get(c) === v);
  };
  const g = Uint8Array.from(gAntes);
  const usadas = [];
  for (let k = candidatas.length - 1; k >= 0; k--) {
    const c = candidatas[k];
    const v = g[c];
    if (v === VAZIO) continue;
    g[c] = VAZIO;
    if (!segue(g)) {
      g[c] = v;
      usadas.push(c);
    }
  }
  return usadas;
}

// Uma regra já impossível só de olhar as casas dos itens que ela cita (sem
// raciocinar sobre o resto da grade)? Devolve o motivo, para a explicação, ou
// null se a regra ainda parece possível:
//   { tipo: 'liga', a, b, v }       a combinaria (v = S) / não combinaria (✕) com b
//   { tipo: 'dois', a, b, c }       a combinaria com b e também com c
//   { tipo: 'nenhuma', a, bs }      a não combinaria com nenhum de bs
//   { tipo: 'so', as, b }           os itens de `as` só poderiam combinar com b
//   { tipo: 'opcoes', itens }       [[item, [opções…]]…] na categoria comparada
//   { tipo: 'outro' }               impossível, sem resumo em palavras
function regraSemSaida(P, gx, r) {
  const { n } = P;
  const liga = (a, b) => {
    if (a === b) return SIM;
    const c = celula(P, a, b);
    return c < 0 ? NAO : gx[c];
  };
  switch (r.t) {
    case '=':
      return liga(r.refs[0], r.refs[1]) === NAO ? { tipo: 'liga', a: r.refs[0], b: r.refs[1], v: NAO } : null;
    case '!=':
      return liga(r.refs[0], r.refs[1]) === SIM ? { tipo: 'liga', a: r.refs[0], b: r.refs[1], v: SIM } : null;
    case 'distintos':
      for (let i = 0; i < r.refs.length; i++) {
        for (let j = i + 1; j < r.refs.length; j++) {
          if (liga(r.refs[i], r.refs[j]) === SIM) return { tipo: 'liga', a: r.refs[i], b: r.refs[j], v: SIM };
        }
      }
      return null;
    case 'ou': {
      const [a, ...bs] = r.refs;
      const sims = bs.filter((b) => liga(a, b) === SIM);
      if (sims.length > 1) return { tipo: 'dois', a, b: sims[0], c: sims[1] };
      if (bs.every((b) => liga(a, b) === NAO)) return { tipo: 'nenhuma', a, bs };
      return null;
    }
    case 'par': {
      const k = r.A.length;
      const usado = new Array(k).fill(false);
      const tenta = (i) => {
        if (i === k) return true;
        for (let j = 0; j < k; j++) {
          if (usado[j] || liga(r.A[i], r.B[j]) === NAO) continue;
          usado[j] = true;
          const ok = tenta(i + 1);
          usado[j] = false;
          if (ok) return true;
        }
        return false;
      };
      if (tenta(0)) return null;
      const ops = r.A.map((a) => r.B.filter((b) => liga(a, b) !== NAO));
      const i = ops.findIndex((o) => o.length === 0);
      if (i >= 0) return { tipo: 'nenhuma', a: r.A[i], bs: r.B };
      if (k === 2 && ops[0].length === 1 && ops[1].length === 1) return { tipo: 'so', as: r.A, b: ops[0][0] };
      return { tipo: 'outro' };
    }
    default:
      break;
  }
  if (r.K === undefined) return null;
  const dom = r.refs.map((x) => {
    if (P.catDe[x] === r.K) return [x];
    const out = [];
    for (let y = r.K * n; y < r.K * n + n; y++) {
      const v = gx[celula(P, x, y)];
      if (v === SIM) return [y];
      if (v !== NAO) out.push(y);
    }
    return out;
  });
  const val = (y) => P.valores[r.K][P.idxDe[y]];
  const ext = (v) => Math.abs(v - P.minK[r.K]) < TOL || Math.abs(v - P.maxK[r.K]) < TOL;
  const cabe = (a, b) => {
    switch (r.t) {
      case 'dif': return Math.abs(val(a) - val(b) - r.k) < TOL;
      case 'dist': return Math.abs(Math.abs(val(a) - val(b)) - r.k) < TOL;
      case '>': return val(a) > val(b) + TOL;
      case 'extremo': return ext(val(a));
      case 'meio': return !ext(val(a));
      default: return true;
    }
  };
  const possivel = dom.length === 1 ? dom[0].some((a) => cabe(a)) : dom[0].some((a) => dom[1].some((b) => a !== b && cabe(a, b)));
  if (possivel) return null;
  const itens = r.refs.map((x, i) => [x, dom[i]]).filter(([x]) => P.catDe[x] !== r.K);
  return itens.length ? { tipo: 'opcoes', itens } : { tipo: 'outro' };
}

// Supõe o contrário de (c, v) e aplica só passos simples até uma contradição.
// Devolve { celula, valor, passos: [{ p, alvo }], fim } com só os passos que
// levam à contradição, ou null se não chegar a uma.
export function provarPorAbsurdo(P, g, c0, v0, { maxPassos = 60, pares = false } = {}) {
  const h = Uint8Array.from(g);
  h[c0] = v0 === SIM ? NAO : SIM;
  const passos = [];
  let fim = contradicaoGrade(P, h);
  for (let k = 0; !fim; k++) {
    if (k >= maxPassos) return null;
    const p = proximoPasso(P, h, { pares });
    if (!p) return null;
    if (p.tipo === 'contradicao') {
      fim = p.dicas ? { tipo: 'dicas', dicas: p.dicas } : { tipo: 'dica', dica: p.dica };
      break;
    }
    passos.push({ p, antes: Uint8Array.from(h) });
    for (const [c, v] of p.marcas) h[c] = v;
    if (haContradicao(P, h, p.marcas.map(([c]) => c))) fim = contradicaoGrade(P, h);
  }
  const derivadas = new Set([c0]);
  for (const s of passos) for (const [c] of s.p.marcas) derivadas.add(c);
  const precisa = new Set();
  const conjunto = (q) => (q.tipo === 'dicas' ? conjuntoDoPar(P, q.dicas[0], q.dicas[1]) : P.dicas[q.dica]);
  if (fim.tipo === 'dica' || fim.tipo === 'dicas') {
    for (const c of premissasDica(P, h, conjunto(fim), [], [...derivadas], true)) precisa.add(c);
  } else {
    for (const c of fim.casas) if (derivadas.has(c)) precisa.add(c);
  }
  const usados = [];
  for (let i = passos.length - 1; i >= 0; i--) {
    const s = passos[i];
    const alvo = s.p.marcas.filter(([c]) => precisa.has(c));
    if (!alvo.length) continue;
    for (const [c] of alvo) precisa.delete(c);
    let prem = premissasPasso(P, s.p);
    if (!prem) {
      if (s.p.direta) prem = [];
      else {
        const anteriores = [c0];
        for (let j = 0; j < i; j++) for (const [c] of passos[j].p.marcas) anteriores.push(c);
        prem = premissasDica(P, s.antes, conjunto(s.p), alvo, anteriores, false);
      }
    }
    for (const c of prem) if (derivadas.has(c)) precisa.add(c);
    usados.unshift({ p: s.p, alvo });
  }
  if (fim.tipo === 'trans') fim = { ...fim, suposto: derivadas.has(fim.casas[2]) };
  if (fim.tipo === 'dica') {
    // O que o jogador tem em mente: a grade + a suposição + os passos mostrados
    // (com os ✕ óbvios de cada S).
    const gx = Uint8Array.from(g);
    gx[c0] = h[c0];
    for (const { p, alvo } of usados) for (const [c, v] of p.tipo === 'G1' ? p.marcas : alvo) gx[c] = v;
    const ax = autoX(P, gx);
    for (let c = 0; c < gx.length; c++) if (ax[c] && gx[c] === VAZIO) gx[c] = NAO;
    // À vista: alguma regra da dica já não cabe nas casas dos itens que cita.
    // Senão, o jogador ainda teria de raciocinar para ver por que a dica falha.
    for (const r of P.dicas[fim.dica].regras) {
      const motivo = regraSemSaida(P, gx, r);
      if (!motivo) continue;
      fim = { ...fim, visivel: true, motivo };
      break;
    }
  }
  return { celula: c0, valor: v0, passos: usados, fim };
}

// Casas vazias, começando pelas que estão numa linha ou coluna com menos
// opções livres (as escolhas "ou isto ou aquilo" costumam dar provas curtas).
function casasPorOpcoes(P, g) {
  const { n } = P;
  const out = [];
  for (let c = 0; c < g.length; c++) {
    if (g[c] !== VAZIO) continue;
    const a = P.celA[c];
    const b = P.celB[c];
    const A = P.catDe[a] * n;
    const B = P.catDe[b] * n;
    let la = 0;
    let lb = 0;
    for (let k = 0; k < n; k++) {
      if (g[celula(P, a, B + k)] === VAZIO) la++;
      if (g[celula(P, A + k, b)] === VAZIO) lb++;
    }
    out.push([Math.min(la, lb), c]);
  }
  out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return out.map(([, c]) => c);
}

// Passo para o botão Dica quando só juntando dicas dá para avançar: uma casa
// que se resolve por absurdo, com a explicação mais curta que se encontrar.
// Primeiro as conclusões que os pares de dicas permitem; se a explicação ficar
// longa, testa as outras casas vazias. `limiteMs` (opcional) encerra a busca
// por algo melhor depois de um tempo, se já houver uma explicação.
export function passoPorHipotese(P, g, { bom = 3, longo = 6, maxPassos = 45, limiteMs = Infinity } = {}) {
  const t0 = Date.now();
  let melhor = null;
  const esgotou = () => melhor && Date.now() - t0 > limiteMs;
  const vistos = new Set();
  const candidatos = [];
  const avaliar = (c, v, opcoes = {}) => {
    const prova = provarPorAbsurdo(P, g, c, v, opcoes);
    if (!prova) return;
    const f = prova.fim;
    const oculto = (f.tipo === 'dica' || f.tipo === 'dicas') && !f.visivel;
    const custo = prova.passos.filter((s) => s.p.tipo !== 'G1').length + (oculto ? 8 : 0) + (opcoes.pares ? 100 : 0);
    if (!melhor || custo < melhor.custo) melhor = { custo, prova, c, v };
  };
  const bastou = () => melhor && melhor.custo <= bom;
  for (const [i, j] of paresDeDicas(P)) {
    const r = deduzirDica(P, g, conjuntoDoPar(P, i, j));
    if (r.contradicao || !r.marcas.length) continue;
    for (const [c, v] of enxugar(P, r.marcas)) {
      if (vistos.has(c)) continue;
      vistos.add(c);
      candidatos.push([c, v]);
      avaliar(c, v);
    }
    if (bastou() || esgotou()) break;
  }
  // Com a solução à mão, só testa o lado que pode dar contradição.
  const lados = (c) => (P.gradeSolucao ? [P.gradeSolucao[c]] : [SIM, NAO]);
  if (!bastou()) {
    for (const c of casasPorOpcoes(P, g)) {
      if (vistos.has(c)) continue;
      for (const v of lados(c)) avaliar(c, v, { maxPassos });
      if (bastou() || esgotou()) break;
    }
  }
  if (!esgotou() && (!melhor || melhor.custo > longo)) {
    for (const c of casasPorOpcoes(P, g)) {
      for (const v of lados(c)) avaliar(c, v, { maxPassos: 3 * maxPassos });
      if ((melhor && melhor.custo <= longo) || esgotou()) break;
    }
  }
  // Casos raros: cadeia mais longa e, em último caso, juntando dicas dentro dela.
  if (!melhor) for (const [c, v] of candidatos.slice(0, 6)) avaliar(c, v, { maxPassos: 200 });
  if (!melhor) for (const [c, v] of candidatos.slice(0, 3)) avaliar(c, v, { maxPassos: 200, pares: true });
  if (!melhor) return null;
  return { tipo: 'hipotese', marcas: [[melhor.c, melhor.v]], prova: melhor.prova };
}

// Próximo passo para o botão Dica: os passos simples primeiro; quando só
// juntando dicas, uma hipótese explicada passo a passo.
export function proximoPassoDica(P, g, opcoes = {}) {
  return proximoPasso(P, g, { pares: false }) || passoPorHipotese(P, g, opcoes) || proximoPasso(P, g, { pares: true });
}

// Dicas citadas numa prova por absurdo (na ordem em que aparecem).
export function dicasDaProva(prova) {
  const out = [];
  const add = (i) => {
    if (!out.includes(i)) out.push(i);
  };
  for (const s of prova.passos) {
    if (s.p.tipo === 'dica') add(s.p.dica);
    if (s.p.tipo === 'dicas') s.p.dicas.forEach(add);
  }
  if (prova.fim.tipo === 'dica') add(prova.fim.dica);
  if (prova.fim.tipo === 'dicas') prova.fim.dicas.forEach(add);
  return out;
}

// ---------------------------------------------------------------------------
// Textos (para as dicas do app e para o relatório do validador)
// ---------------------------------------------------------------------------

export function nomeItem(P, g) {
  const c = P.cats[P.catDe[g]];
  const nome = P.nomes[g];
  return c.formato ? c.formato.replace('{}', nome) : nome;
}

function lista(arr) {
  if (arr.length <= 1) return arr.join('');
  return arr.slice(0, -1).join(', ') + ' ou ' + arr[arr.length - 1];
}

// Par de categorias (a, b) no layout em escada: a categoria principal fica nas
// linhas do primeiro bloco; nos demais blocos, a categoria de índice maior
// fica nas linhas e a de índice menor nas colunas.
export function orientacaoQuadro(a, b) {
  if (a > b) { const t = a; a = b; b = t; }
  return a === 0 ? { linhas: a, colunas: b } : { linhas: b, colunas: a };
}

export function nomeQuadro(P, a, b) {
  const o = orientacaoQuadro(a, b);
  return `${P.cats[o.linhas].nome} × ${P.cats[o.colunas].nome}`;
}

export function descreverMarca(P, c, v) {
  const a = nomeItem(P, P.celA[c]);
  const b = nomeItem(P, P.celB[c]);
  return v === SIM ? `${a} combina com ${b}` : `${a} não combina com ${b}`;
}

export function descreverPasso(P, p) {
  const N = (g) => `<b>${escapar(nomeItem(P, g))}</b>`;
  switch (p.tipo) {
    case 'G1':
      return `Como ${N(p.a)} combina com ${N(p.b)}, nenhuma outra opção pode combinar com eles no quadro ${escapar(nomeQuadro(P, P.catDe[p.a], P.catDe[p.b]))}. Marque ✕ no resto da linha e da coluna.`;
    case 'G2':
      return `No quadro ${escapar(nomeQuadro(P, P.catDe[p.item], p.outra))}, só sobrou uma opção livre para ${N(p.item)}: ${N(p.escolhido)}.`;
    case 'G3':
      return `${N(p.a)} combina com ${N(p.b)}, e ${N(p.b)} combina com ${N(p.c)}. Logo, ${N(p.a)} combina com ${N(p.c)}.`;
    case 'G4':
      return `${N(p.a)} combina com ${N(p.b)}, mas ${N(p.b)} não combina com ${N(p.c)}. Logo, ${N(p.a)} não combina com ${N(p.c)}.`;
    case 'G5': {
      const ops = p.cand.map(N);
      const umSo = ops.length === 1;
      return umSo
        ? `${N(p.a)} só pode combinar com ${ops[0]}, que não combina com ${N(p.c)}. Logo, ${N(p.a)} não combina com ${N(p.c)}.`
        : `${N(p.a)} só pode combinar com ${lista(ops)}, e nenhum deles combina com ${N(p.c)}. Logo, ${N(p.a)} não combina com ${N(p.c)}.`;
    }
    case 'dica': {
      const concl = p.marcas.map(([c, v]) => {
        const a = N(P.celA[c]);
        const b = N(P.celB[c]);
        return v === SIM ? `${a} combina com ${b}` : `${a} não combina com ${b}`;
      });
      const txt = concl.length > 1 ? concl.slice(0, -1).join('; ') + ' e ' + concl[concl.length - 1] : concl[0];
      if (p.direta) return `A dica ${p.dica + 1} diz diretamente que ${txt}.`;
      return `Releia a dica ${p.dica + 1}. Com o que já foi descoberto, ela mostra que ${txt}.`;
    }
    case 'dicas': {
      const concl = p.marcas.map(([c, v]) => {
        const a = N(P.celA[c]);
        const b = N(P.celB[c]);
        return v === SIM ? `${a} combina com ${b}` : `${a} não combina com ${b}`;
      });
      const txt = concl.length > 1 ? concl.slice(0, -1).join('; ') + ' e ' + concl[concl.length - 1] : concl[0];
      return `Junte as dicas ${p.dicas[0] + 1} e ${p.dicas[1] + 1}. Analisadas juntas, com o que já foi descoberto, elas mostram que ${txt}.`;
    }
    case 'hipotese':
      return descreverHipotese(P, p.prova);
    case 'contradicao':
      return `Há uma contradição com a dica ${p.dica + 1}. Confira suas marcações.`;
    default:
      return '';
  }
}

function juntarFrases(arr) {
  return arr.length > 1 ? `${arr.slice(0, -1).join('; ')} e ${arr[arr.length - 1]}` : arr[0] || '';
}

// "Suponha que …" → passos (no condicional) → contradição → conclusão
export function descreverHipotese(P, prova) {
  const N = (g) => `<b>${escapar(nomeItem(P, g))}</b>`;
  const par = (c) => [P.celA[c], P.celB[c]];
  const hipot = (c, v) => {
    const [a, b] = par(c);
    return v === SIM ? `${N(a)} combinaria com ${N(b)}` : `${N(a)} não combinaria com ${N(b)}`;
  };
  const [a0, b0] = par(prova.celula);
  const sup = prova.valor === SIM ? `${N(a0)} não combine com ${N(b0)}` : `${N(a0)} combine com ${N(b0)}`;
  const concl = prova.valor === SIM ? `${N(a0)} combina com ${N(b0)}` : `${N(a0)} não combina com ${N(b0)}`;
  const linhas = [];
  for (const { p, alvo } of prova.passos) {
    switch (p.tipo) {
      case 'G1':
        break;
      case 'G2':
        linhas.push(`Para ${N(p.item)}, sobraria só ${N(p.escolhido)}.`);
        break;
      case 'G3':
        linhas.push(`${N(p.a)} combinaria com ${N(p.c)} (via ${N(p.b)}).`);
        break;
      case 'G4':
        linhas.push(`${N(p.a)} não combinaria com ${N(p.c)} (via ${N(p.b)}).`);
        break;
      case 'G5':
        linhas.push(
          p.cand.length === 1
            ? `${N(p.a)} não combinaria com ${N(p.c)}, porque a única opção que sobraria para ${N(p.a)} (${N(p.cand[0])}) não combina com ${N(p.c)}.`
            : `${N(p.a)} não combinaria com ${N(p.c)}, porque nenhuma das opções que sobrariam para ${N(p.a)} (${lista(p.cand.map(N))}) combina com ${N(p.c)}.`,
        );
        break;
      case 'dica':
        linhas.push(`Pela dica ${p.dica + 1}, ${juntarFrases(alvo.map(([c, v]) => hipot(c, v)))}.`);
        break;
      case 'dicas':
        linhas.push(`Juntando as dicas ${p.dicas[0] + 1} e ${p.dicas[1] + 1}, ${juntarFrases(alvo.map(([c, v]) => hipot(c, v)))}.`);
        break;
      default:
        break;
    }
  }
  const f = prova.fim;
  let fim;
  if (f.tipo === 'dica') {
    const m = f.motivo;
    const nem = (bs) => `nem com ${bs.map(N).join(' nem com ')}`;
    let porque = '';
    if (!m || m.tipo === 'outro') porque = '';
    else if (m.tipo === 'opcoes') {
      porque = juntarFrases(m.itens.map(([x, ys]) => (ys.length === 1 ? `${N(x)} combinaria com ${N(ys[0])}` : `${N(x)} só poderia combinar com ${lista(ys.map(N))}`)));
    } else if (m.tipo === 'liga') porque = `${N(m.a)} ${m.v === SIM ? 'combinaria' : 'não combinaria'} com ${N(m.b)}`;
    else if (m.tipo === 'dois') porque = `${N(m.a)} combinaria com ${N(m.b)} e também com ${N(m.c)}`;
    else if (m.tipo === 'nenhuma') porque = `${N(m.a)} não combinaria ${nem(m.bs)}`;
    else if (m.tipo === 'so') porque = `${N(m.as[0])} e ${N(m.as[1])} só poderiam combinar com ${N(m.b)}`;
    fim = `Mas aí a dica ${f.dica + 1} não teria como ser cumprida${porque ? `: ${porque}` : ''}.`;
  } else if (f.tipo === 'dicas') fim = `Mas aí as dicas ${f.dicas[0] + 1} e ${f.dicas[1] + 1} não teriam como ser cumpridas juntas.`;
  else if (f.tipo === 'dois') {
    const outro = (c) => (P.celA[c] === f.item ? P.celB[c] : P.celA[c]);
    fim = `Mas aí ${N(f.item)} combinaria com ${N(outro(f.casas[0]))} e também com ${N(outro(f.casas[1]))}.`;
  } else if (f.tipo === 'nenhum') {
    fim = `Mas aí não sobraria nenhuma opção para ${N(f.item)} no quadro ${escapar(nomeQuadro(P, P.catDe[f.item], f.outra))}.`;
  } else {
    fim = `Mas aí ${N(f.x)} combinaria com ${N(f.y)} e com ${N(f.z)}, e ${N(f.y)} ${f.suposto ? 'não combinaria' : 'não combina'} com ${N(f.z)}.`;
  }
  const lista1 = linhas.length ? `<ol class="dica-cadeia">${linhas.map((l) => `<li>${l}</li>`).join('')}</ol>` : '';
  return `<p>Suponha que ${sup}.</p>${lista1}<p>${fim}</p><p>Então a suposição é impossível: ${concl}.</p>`;
}

function escapar(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
