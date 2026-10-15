// Persistência local (localStorage). Todas as chaves usam o prefixo "logica:"
// para não colidir com outros apps do mesmo domínio (ex.: TEMa Estudo).

const K = {
  progresso: 'logica:progresso',
  ajustes: 'logica:ajustes',
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
export const AJUSTES_PADRAO = { autoX: true, conflitos: true, cronometro: true, zoom: 0 };

export function getAjustes() {
  return { ...AJUSTES_PADRAO, ...ler(K.ajustes, {}) };
}

export function salvarAjustes(a) {
  gravar(K.ajustes, a);
}

// --- Progresso por desafio ---
// {
//   v: versão do desafio, marcas: "0120…" (uma letra por casa), riscadas: [i…],
//   dicaAtual, tempo (ms), resolvido, revelado, verificacoes, dicasUsadas,
//   iniciado, melhorTempo, melhoresEstrelas, vezesResolvido, atualizado
// }
export function todosProgressos() {
  return ler(K.progresso, {});
}

export function getProgresso(id) {
  return todosProgressos()[id] || null;
}

export function salvarProgresso(id, p) {
  const todos = todosProgressos();
  todos[id] = { ...p, atualizado: new Date().toISOString() };
  return gravar(K.progresso, todos);
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
