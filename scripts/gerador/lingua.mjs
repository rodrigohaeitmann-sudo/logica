// Utilidades de português para montar as frases das dicas.

const NUM = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];

// Número por extenso (até 20), concordando em gênero ("uma hora", "duas horas").
export function extenso(n, g = 'm') {
  if (!Number.isInteger(n) || n < 0 || n > 20) return fmtNum(n);
  if (n === 1) return g === 'f' ? 'uma' : 'um';
  if (n === 2) return g === 'f' ? 'duas' : 'dois';
  return NUM[n];
}

// 1.5 → "1,5"; 1200 → "1.200"
export function fmtNum(v) {
  const neg = v < 0;
  const [i, d] = String(Math.abs(v)).split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '−' : '') + (d ? `${int},${d}` : int);
}

// "uma hora", "três anos" (por extenso até 20) ou "60 páginas" (algarismos).
export function qtd(k, sing, plur, g = 'm', porExtenso = true) {
  const num = porExtenso ? extenso(k, g) : fmtNum(k);
  return `${num} ${k === 1 ? sing : plur}`;
}

// Valores em reais: "R$ 15", "R$ 2,50", "50 centavos".
export function reais(v) {
  if (v < 1) return `${Math.round(v * 100)} centavos`;
  if (Number.isInteger(v)) return `R$ ${fmtNum(v)}`;
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Concordância: {o} → o/a, {um} → um/uma, {do} → do/da, {ele} → ele/ela,
// {dele} → dele/dela, {e} → e/a (ex.: "mais velh{o}").
export function flex(s, g) {
  const f = g === 'f';
  return s
    .replace(/\{o\}/g, f ? 'a' : 'o')
    .replace(/\{os\}/g, f ? 'as' : 'os')
    .replace(/\{um\}/g, f ? 'uma' : 'um')
    .replace(/\{do\}/g, f ? 'da' : 'do')
    .replace(/\{no\}/g, f ? 'na' : 'no')
    .replace(/\{ao\}/g, f ? 'à' : 'ao')
    .replace(/\{ele\}/g, f ? 'ela' : 'ele')
    .replace(/\{dele\}/g, f ? 'dela' : 'dele')
    .replace(/\{º\}/g, f ? 'ª' : 'º');
}

// Contrações: "de o" → "do", "em a" → "na", "a o" → "ao", "a a" → "à", "por o" → "pelo".
export function contrair(s) {
  return s
    .replace(/(^|[\s(])de (o|a|os|as)(?=\s)/g, (m, p, a) => `${p}d${a}`)
    .replace(/(^|[\s(])em (o|a|os|as)(?=\s)/g, (m, p, a) => `${p}n${a}`)
    .replace(/(^|[\s(])por (o|a|os|as)(?=\s)/g, (m, p, a) => `${p}pel${a}`)
    .replace(/(^|[\s(])a (o|os)(?=\s)/g, (m, p, a) => `${p}a${a}`)
    .replace(/(^|[\s(])a a(s?)(?=\s)/g, (m, p, s) => `${p}à${s}`);
}

// "a, b e c"
export function juntar(arr, conj = 'e') {
  if (arr.length <= 1) return arr.join('');
  return `${arr.slice(0, -1).join(', ')} ${conj} ${arr[arr.length - 1]}`;
}

// Fecha a frase: contrações, espaços, maiúscula inicial e ponto final.
export function frase(s) {
  let t = contrair(s.replace(/\s+/g, ' ').trim());
  t = t.replace(/\s+([,.;:)])/g, '$1').replace(/\(\s+/g, '(');
  t = cap(t);
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}

export function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Gerador pseudoaleatório com semente (mulberry32) + utilidades.
export function aleatorio(semente) {
  let a = semente >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    num: rnd,
    int: (a0, b0) => a0 + Math.floor(rnd() * (b0 - a0 + 1)),
    chance: (p) => rnd() < p,
    escolha: (arr) => arr[Math.floor(rnd() * arr.length)],
    embaralhar: (arr) => {
      const x = arr.slice();
      for (let i = x.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [x[i], x[j]] = [x[j], x[i]];
      }
      return x;
    },
    amostra: (arr, k) => r.embaralhar(arr).slice(0, k),
    // escolhe uma chave de {chave: peso}
    pesado: (pesos) => {
      const ent = Object.entries(pesos).filter(([, w]) => w > 0);
      const tot = ent.reduce((s, [, w]) => s + w, 0);
      let x = rnd() * tot;
      for (const [k, w] of ent) {
        x -= w;
        if (x <= 0) return k;
      }
      return ent[ent.length - 1][0];
    },
  };
  return r;
}
