// Persistência local (localStorage). Todas as chaves usam o prefixo "logica:"
// para não colidir com outros apps do mesmo domínio (ex.: TEMa Estudo).

const K = {
  progresso: 'logica:progresso',
  ajustes: 'logica:ajustes',
  filtros: 'logica:filtros',
  avisos: 'logica:avisos',
  nuvem: 'logica:nuvem',
};

function ler(chave, padrao) {
  try {
    const raw = localStorage.getItem(chave);
    return raw ? JSON.parse(raw) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

// --- Ajustes ---
export const AJUSTES_PADRAO = { autoX: true, conflitos: true, cronometro: true, zoom: 0, relPossiveis: false };

export function getAjustes() {
  return { ...AJUSTES_PADRAO, ...ler(K.ajustes, {}) };
}

export function salvarAjustes(a) {
  gravar(K.ajustes, a);
}

// --- Filtros da lista de desafios ---
export const FILTROS_PADRAO = { nivel: '', tipo: '', ocultarResolvidos: false };

export function getFiltros() {
  return { ...FILTROS_PADRAO, ...ler(K.filtros, {}) };
}

export function salvarFiltros(f) {
  gravar(K.filtros, f);
}

// --- Avisos já dispensados (ex.: { instalarDispensado: data ISO }) ---
export function getAvisos() {
  return ler(K.avisos, {});
}

export function salvarAvisos(a) {
  gravar(K.avisos, a);
}

// --- Progresso por desafio ---
// {
//   v: versão do desafio, marcas: "0120…" (uma letra por casa), riscadas: [i…],
//   dicaAtual, tempo (ms), resolvido, revelado, verificacoes, dicasUsadas,
//   iniciado, melhorTempo, melhoresEstrelas, vezesResolvido, atualizado,
//   relacoes: [{ id, k, a, b, t, v, d }…] (anotações da aba Relação; ver relacao.js)
// }
export function todosProgressos() {
  return ler(K.progresso, {});
}

export function getProgresso(id) {
  return todosProgressos()[id] || null;
}

// Quem quer saber quando um progresso é salvo (a sincronização com a nuvem):
// fn(id, novo, anterior).
const ouvintes = new Set();
export function aoSalvarProgresso(fn) {
  ouvintes.add(fn);
}

// `atualizado` marca a última mudança de verdade (marcas, anotações, dicas
// riscadas, resolver…). Salvamentos que só mexem no cronômetro ou na dica à
// vista não o mudam: é por ele que a sincronização decide qual versão vence.
const MENORES = new Set(['tempo', 'dicaAtual', 'atualizado']);
function essencia(p) {
  const o = {};
  for (const k of Object.keys(p || {}).sort()) if (!MENORES.has(k)) o[k] = p[k];
  return JSON.stringify(o);
}

export function salvarProgresso(id, p) {
  const todos = todosProgressos();
  const anterior = todos[id] || null;
  const soMenores = !!(anterior && anterior.atualizado && essencia(anterior) === essencia(p));
  todos[id] = { ...p, atualizado: soMenores ? anterior.atualizado : new Date().toISOString() };
  const ok = gravar(K.progresso, todos);
  ouvintes.forEach((fn) => {
    try {
      fn(id, todos[id], anterior);
    } catch {
      /* um ouvinte com problema não impede o jogo de salvar */
    }
  });
  return ok;
}

// Grava todos de uma vez, sem avisar os ouvintes (usado ao trazer da nuvem).
export function gravarProgressos(todos) {
  return gravar(K.progresso, todos);
}

// --- Progresso na nuvem: { url, token, desde, pendentes, apagar, ultima, okEm } (ver nuvem.js) ---
export function getNuvem() {
  return ler(K.nuvem, null);
}

export function salvarNuvem(n) {
  if (n) gravar(K.nuvem, n);
  else {
    try {
      localStorage.removeItem(K.nuvem);
    } catch {
      /* sem armazenamento */
    }
  }
}

export function apagarTudo() {
  try {
    localStorage.removeItem(K.progresso);
  } catch {
    /* sem armazenamento */
  }
}

export function novoProgresso(d, anterior = null) {
  return {
    v: d.versao ?? 1,
    marcas: '',
    riscadas: [],
    dicaAtual: 0,
    tempo: 0,
    resolvido: false,
    revelado: false,
    verificacoes: 0,
    dicasUsadas: 0,
    iniciado: false,
    relacoes: [],
    melhorTempo: anterior?.melhorTempo ?? null,
    melhoresEstrelas: anterior?.melhoresEstrelas ?? 0,
    vezesResolvido: anterior?.vezesResolvido ?? 0,
  };
}

// Fração de casas já marcadas (não revela se estão certas).
export function fracaoMarcada(p, total) {
  if (!p || !p.marcas || !total) return 0;
  let n = 0;
  for (let i = 0; i < p.marcas.length; i++) if (p.marcas[i] !== '0') n++;
  return n / total;
}

export function estrelasDaTentativa(p) {
  if (p.revelado) return 0;
  if (p.dicasUsadas > 0) return 1;
  if (p.verificacoes > 0) return 2;
  return 3;
}
