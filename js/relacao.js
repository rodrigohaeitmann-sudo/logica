// Aba "Relação": anotações de ordem entre itens, como se faz no papel
// ("Renata antes de Marta antes de Paulo", "Paulo 1 mês depois do suspense").
//
// Uma relação vale para uma categoria com valores (datas, tamanhos, preços...):
//   { id, k, a, b, t, v, d }
//   k: índice da categoria; a, b: itens (índice global); d: dica de origem (opcional)
//   t: '<'  a vem antes / é menor que b (sem medida)
//      '>'  a vem depois / é maior que b (sem medida)
//      '+'  a = b + v      '-'  a = b − v      '~'  |a − b| = v
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

export function quantidade(P, k, v) {
  const r = rotulos(P, k);
  if (r.prefixo) return `${r.prefixo}${Number.isInteger(v) ? fmtNum(v) : v.toFixed(2).replace('.', ',')}`;
  const un = r.unidade || [];
  if (un.length) return `${fmtNum(v)} ${v === 1 ? un[0] : un[1] || un[0]}`;
  return fmtNum(v);
}

// Diferenças possíveis entre dois valores da categoria (para relações exatas).
export function diferencas(P, k) {
  const vs = P.valores[k];
  const s = new Set();
  for (const a of vs) for (const b of vs) if (a > b) s.add(+(a - b).toFixed(2));
  return [...s].sort((x, y) => x - y);
}

export function nome(P, g) {
  return M.nomeItem(P, g);
}

// "antes de", "1 mês depois de", "e … : 2 meses de diferença"
export function verbo(P, k, t, v) {
  const r = rotulos(P, k);
  switch (t) {
    case '<': return r.menor;
    case '>': return r.maior;
    case '-': return r.menorK.replace('{k}', v == null ? '…' : quantidade(P, k, v));
    case '+': return r.maiorK.replace('{k}', v == null ? '…' : quantidade(P, k, v));
    case '~': return `${v == null ? '…' : quantidade(P, k, v)} de diferença de`;
    default: return '';
  }
}

export function texto(P, r) {
  return `${nome(P, r.a)} ${verbo(P, r.k, r.t, r.v)} ${nome(P, r.b)}`;
}

// Rótulo curto do conector entre dois itens, lido da esquerda para a direita:
// "Renata [antes] Marta", "Suspense [1 mês antes] Paulo".
function curto(s) {
  return s.replace(/\s+(de|que|do|da)$/, '');
}

function conector(P, k, rel, esquerda) {
  // orienta a relação com `esquerda` como sujeito
  let t = rel.t;
  if (rel.a !== esquerda) t = { '<': '>', '>': '<', '+': '-', '-': '+', '~': '~' }[t];
  const r = rotulos(P, k);
  if (t === '<') return { txt: r.menorCurto, dir: -1 };
  if (t === '>') return { txt: r.maiorCurto, dir: 1 };
  if (t === '-') return { txt: curto(r.menorK.replace('{k}', quantidade(P, k, rel.v))), dir: -1 };
  if (t === '+') return { txt: curto(r.maiorK.replace('{k}', quantidade(P, k, rel.v))), dir: 1 };
  return { txt: `${quantidade(P, k, rel.v)} de diferença`, dir: 0 };
}

// Componentes ligados; os que formam uma linha (A–B–C) viram cadeia.
export function cadeias(P, k, rels) {
  const rk = rels.filter((r) => r.k === k);
  const adj = new Map();
  const liga = (x, y, r) => {
    if (!adj.has(x)) adj.set(x, new Map());
    const m = adj.get(x);
    if (!m.has(y)) m.set(y, []);
    m.get(y).push(r);
  };
  for (const r of rk) {
    liga(r.a, r.b, r);
    liga(r.b, r.a, r);
  }
  const visto = new Set();
  const comps = [];
  for (const r of rk) {
    for (const ini of [r.a, r.b]) {
      if (visto.has(ini)) continue;
      const nos = [];
      const fila = [ini];
      visto.add(ini);
      while (fila.length) {
        const x = fila.shift();
        nos.push(x);
        for (const y of adj.get(x).keys()) {
          if (!visto.has(y)) {
            visto.add(y);
            fila.push(y);
          }
        }
      }
      const arestas = rk.filter((q) => nos.includes(q.a));
      const pares = new Set(arestas.map((q) => [Math.min(q.a, q.b), Math.max(q.a, q.b)].join(',')));
      const ehLinha = nos.length >= 2 && pares.size === nos.length - 1 && nos.every((x) => adj.get(x).size <= 2);
      let caminho = null;
      if (ehLinha) {
        let atual = nos.find((x) => adj.get(x).size === 1);
        caminho = [atual];
        let ant = null;
        while (caminho.length < nos.length) {
          const prox = [...adj.get(atual).keys()].find((y) => y !== ant);
          ant = atual;
          atual = prox;
          caminho.push(atual);
        }
        // orienta da esquerda para a direita do menor para o maior, quando possível
        let saldo = 0;
        for (let i = 0; i + 1 < caminho.length; i++) {
          const rel = adj.get(caminho[i]).get(caminho[i + 1])[0];
          saldo -= conector(P, k, rel, caminho[i]).dir;
        }
        if (saldo < 0) caminho.reverse();
      }
      comps.push({ nos, arestas, caminho, adj });
    }
  }
  return comps;
}

// Valores ainda possíveis de cada item citado, a partir das relações anotadas e
// das marcações da grade (✕ e S); com grade = null, só pelas relações (serve
// para achar anotações que se contradizem). Não usa a solução.
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
// estado: { k, form: { a, t, v, b, d }, rels, mostrarPossiveis, grade }
//   form.a / form.b: item (índice global, em texto) ou '' · form.t: tipo
//   form.v: medida (relações exatas) · form.d: dica de origem (índice) ou ''
// Contrato com o jogo (eventos delegados no painel):
//   [data-rel-cat]  troca a categoria      [data-rel-nav] dica anterior/seguinte
//   select[data-rel="a|t|v|b"] (change)    input[data-rel="possiveis"] (change)
//   [data-acao="rel-add"] anota            [data-rel-del="id"] apaga uma anotação
//   [data-acao="rel-limpar"] apaga as anotações da categoria

export function exatas(P, k) {
  return rotulos(P, k).exata !== false && diferencas(P, k).length > 0;
}

export function preciso(t) {
  return t === '+' || t === '-' || t === '~';
}

function vazio(x) {
  return x === '' || x == null;
}

export function html(P, estado) {
  const { k, form, rels, mostrarPossiveis, grade } = estado;
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

  // Formulário: [item] [relação] [medida] [item], ligado a uma dica
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
  const comMedida = exatas(P, k);
  const t = !comMedida && preciso(form.t) ? '<' : form.t;
  const exata = preciso(t);
  const difs = diferencas(P, k);
  const opT = (tt, txt) => `<option value="${tt}"${t === tt ? ' selected' : ''}>${esc(txt)}</option>`;
  const dica = vazio(form.d) ? null : Number(form.d);
  const fonte = dica == null || !P.dicas[dica]
    ? '<div class="rel-fonte-txt rel-fonte-livre">Anotação livre, sem dica ligada. Use as setas para escolher a dica.</div>'
    : `<div class="rel-fonte-txt"><span class="dica-num">${dica + 1}</span>${esc(P.dicas[dica].texto)}</div>`;
  const pronto = !vazio(form.a) && !vazio(form.b) && String(form.a) !== String(form.b);
  h += `<div class="rel-form">
    <div class="rel-fonte">
      <button class="car-nav" data-rel-nav="-1" aria-label="Dica anterior">‹</button>
      ${fonte}
      <button class="car-nav" data-rel-nav="1" aria-label="Próxima dica">›</button>
    </div>
    <div class="rel-sel"><select data-rel="a" aria-label="Primeiro item" required>${opcoesItens(form.a, 'Escolha um item…')}</select></div>
    <div class="rel-linha">
      <div class="rel-sel rel-tipo"><select data-rel="t" aria-label="Relação">
        ${comMedida ? `<optgroup label="Sem medida">${opT('<', rt.menor)}${opT('>', rt.maior)}</optgroup>
        <optgroup label="Com medida exata">${opT('-', rt.menorK.replace('{k}', '…'))}${opT('+', rt.maiorK.replace('{k}', '…'))}${opT('~', '… de diferença de')}</optgroup>`
        : `${opT('<', rt.menor)}${opT('>', rt.maior)}`}
      </select></div>
      ${exata ? `<div class="rel-sel rel-qtd"><select data-rel="v" aria-label="Medida">${difs.map((v) => `<option value="${v}"${Number(form.v) === v ? ' selected' : ''}>${esc(quantidade(P, k, v))}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="rel-sel"><select data-rel="b" aria-label="Segundo item" required>${opcoesItens(form.b, 'Escolha o outro item…')}</select></div>
    <div class="rel-acoes">
      <div class="rel-previa">${pronto
        ? `<b>${esc(texto(P, { k, a: Number(form.a), b: Number(form.b), t, v: exata ? Number(form.v ?? difs[0]) : null }))}</b>`
        : !vazio(form.a) && String(form.a) === String(form.b) ? 'Escolha dois itens diferentes.' : 'Escolha os dois itens e a relação entre eles.'}</div>
      <button class="btn-rel-add" data-acao="rel-add"${pronto ? '' : ' disabled'}>Anotar</button>
    </div>
  </div>`;

  // Cadeias e lista
  const rk = rels.filter((r) => r.k === k);
  if (!rk.length) {
    h += `<p class="rel-vazio">Transforme as dicas em anotações, como no papel: por exemplo, “Renata ${esc(rt.menor)} Marta” e depois “Marta ${esc(rt.menor)} Paulo”. O app monta a cadeia <b>Renata – Marta – Paulo</b> para você.</p>`;
  } else {
    const dom = mostrarPossiveis ? possiveis(P, k, rels, grade) : null;
    const chip = (g) => {
      let extra = '';
      if (dom) {
        const s = dom.get(g);
        extra = s.size
          ? `<span class="rel-pos">${[...s].sort((x, y) => x - y).map((j) => esc(rotuloValor(P, k, j))).join(' · ')}</span>`
          : '<span class="rel-pos rel-pos-erro">nenhum</span>';
      }
      return `<span class="rel-no"><span class="rel-nome">${esc(nome(P, g))}</span>${extra}</span>`;
    };
    const con = (txt) => `<span class="rel-con">${esc(txt)}</span>`;
    h += '<div class="rel-sec">Cadeias</div><div class="rel-cadeias">';
    for (const comp of cadeias(P, k, rels)) {
      if (comp.caminho) {
        h += '<div class="rel-cadeia">';
        comp.caminho.forEach((g, i) => {
          if (i) {
            const ant = comp.caminho[i - 1];
            const rs = comp.adj.get(ant).get(g);
            h += con(rs.map((r) => conector(P, k, r, ant).txt).join(' · '));
          }
          h += chip(g);
        });
        h += '</div>';
      } else {
        h += '<div class="rel-grupo">';
        for (const r of comp.arestas) h += `<div class="rel-cadeia">${chip(r.a)}${con(conector(P, k, r, r.a).txt)}${chip(r.b)}</div>`;
        h += '</div>';
      }
    }
    h += '</div>';
    const semSaida = possiveis(P, k, rels, null);
    if ([...semSaida.values()].some((s) => !s.size)) {
      h += '<p class="rel-alerta">Essas anotações se contradizem. Revise uma delas.</p>';
    } else if (dom && [...dom.values()].some((s) => !s.size)) {
      h += '<p class="rel-alerta">Essas anotações não fecham com as marcações da grade. Revise uma delas (ou a grade).</p>';
    }
    h += `<div class="rel-sec">Anotações <span class="rel-cont">${rk.length}</span></div><ul class="rel-lista">`;
    for (const r of rk) {
      h += `<li class="rel-item"><span class="rel-txt">${esc(texto(P, r))}${r.d != null && r.d !== '' ? ` <span class="rel-tag">dica ${Number(r.d) + 1}</span>` : ''}</span>
        <button class="rel-del" data-rel-del="${esc(r.id)}" aria-label="Apagar anotação: ${esc(texto(P, r))}">✕</button></li>`;
    }
    h += `</ul><button class="link-fechar rel-limpar" data-acao="rel-limpar">Apagar as anotações de ${nomeCat(k)}</button>`;
  }
  h += `<label class="rel-toggle"><input type="checkbox" data-rel="possiveis"${mostrarPossiveis ? ' checked' : ''}> <span>Mostrar os valores ainda possíveis de cada item (pelas anotações e pelos ✕ e S da grade)</span></label>`;
  h += '</div>';
  return h;
}
