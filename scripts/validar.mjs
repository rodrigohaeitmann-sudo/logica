#!/usr/bin/env node
// Valida os desafios de desafios/index.json:
//  1. estrutura (categorias, itens, dicas e regras bem formadas);
//  2. a solução declarada cumpre todas as dicas;
//  3. as dicas levam a UMA única solução (busca exaustiva);
//  4. dá para chegar à solução só por dedução, sem chutar (mesmo motor das dicas do app);
//  5. avisa sobre dicas redundantes (a solução continua única sem elas).
// Sai com código 1 se algum desafio falhar — o deploy do GitHub Pages não acontece.
//
// Uso:
//   node scripts/validar.mjs                       valida todos
//   node scripts/validar.mjs --passos              idem, mostrando a resolução passo a passo
//   node scripts/validar.mjs arquivo.json --passos valida só esse arquivo (ex.: um rascunho)

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../js/motor.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pastaDesafios = join(raiz, 'desafios');
const args = process.argv.slice(2);
const mostrarPassos = args.includes('--passos');
const avulsos = args.filter((a) => a.endsWith('.json'));

const NIVEIS = new Set(['facil', 'medio', 'dificil']);
const semTags = (s) => s.replace(/<\/?b>/g, '');

function carregarLista() {
  if (avulsos.length) return avulsos.map((f) => ({ arquivo: f, caminho: f }));
  const indice = JSON.parse(readFileSync(join(pastaDesafios, 'index.json'), 'utf8'));
  const listados = new Set(indice.desafios);
  const soltos = readdirSync(pastaDesafios).filter((f) => f.endsWith('.json') && f !== 'index.json' && !listados.has(f));
  for (const f of soltos) console.warn(`⚠️  ${f} está em desafios/ mas não aparece em index.json (não vai para o app).`);
  return indice.desafios.map((f) => ({ arquivo: f, caminho: join(pastaDesafios, f) }));
}

function validar({ arquivo, caminho }, ids) {
  const erros = [];
  const avisos = [];
  let d;
  try {
    d = JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (e) {
    return { arquivo, erros: [`JSON inválido: ${e.message}`], avisos };
  }
  for (const campo of ['id', 'titulo', 'nivel', 'introducao', 'categorias', 'dicas', 'solucao']) {
    if (d[campo] === undefined) erros.push(`falta o campo "${campo}"`);
  }
  if (d.id && ids.has(d.id)) erros.push(`id repetido: ${d.id}`);
  if (d.id) ids.add(d.id);
  if (d.nivel && !NIVEIS.has(d.nivel)) erros.push(`nivel deve ser facil, medio ou dificil (veio "${d.nivel}")`);
  if (erros.length) return { arquivo, d, erros, avisos };

  let P;
  try {
    P = M.compilar(d);
  } catch (e) {
    return { arquivo, d, erros: [e.message], avisos };
  }
  if (P.m < 4 || P.m > 5) avisos.push(`${P.m} categorias (o padrão do app é 4 ou 5)`);
  if (P.n < 4 || P.n > 5) avisos.push(`${P.n} itens por categoria (o padrão do app é 4 ou 5)`);
  P.dicas.forEach((D) => {
    if (!D.regras.length) erros.push(`a dica ${D.i + 1} não tem regras formais`);
  });

  const violadas = M.conferirSolucao(P);
  for (const i of violadas) erros.push(`a solução declarada contradiz a dica ${i + 1}`);

  const t0 = Date.now();
  const { total, solucoes } = M.contarSolucoes(P, { limite: 2 });
  const msBusca = Date.now() - t0;
  if (total === 0) erros.push('as dicas não têm nenhuma solução');
  else if (total > 1) {
    const s = solucoes[1];
    const linhas = [];
    for (let e = 0; e < P.n; e++) linhas.push(s.map((perm, c) => P.nomes[c * P.n + perm[e]]).join(' / '));
    erros.push(`as dicas permitem mais de uma solução — outra possível:\n      ${linhas.join('\n      ')}`);
  } else if (!violadas.length) {
    const s = solucoes[0];
    const igual = s.every((perm, c) => perm.every((i, e) => P.solucao[c][e] === i));
    if (!igual) erros.push('a solução única das dicas é diferente da solução declarada');
  }

  const t1 = Date.now();
  const ded = M.deduzirTudo(P);
  const msDeducao = Date.now() - t1;
  if (total === 1 && !ded.completo) {
    const faltam = ded.grade.filter((v) => v === M.VAZIO).length;
    erros.push(`não dá para terminar só por dedução: o motor parou com ${faltam} casas em aberto`);
  }
  if (ded.completo && !ded.correto) erros.push('a dedução chegou a uma grade diferente da solução (bug no motor?)');
  if (ded.contradicao) erros.push('a dedução encontrou contradição');

  // Dica dispensável = sem ela a solução continua única E ainda dá para resolver
  // por dedução. Se só a unicidade se mantém, a dica é "de apoio": evita que o
  // jogador precise de raciocínios longos demais (não é aviso).
  const dispensaveis = [];
  const deApoio = [];
  if (total === 1 && ded.completo) {
    for (const D of P.dicas) {
      const regras = P.regras.filter((r) => r.dica !== D.i);
      if (M.contarSolucoes(P, { regras, limite: 2 }).total !== 1) continue;
      const P2 = M.compilar({ ...d, dicas: d.dicas.filter((_, j) => j !== D.i) });
      if (M.deduzirTudo(P2).completo) dispensaveis.push(D.i + 1);
      else deApoio.push(D.i + 1);
    }
  }
  if (dispensaveis.length) avisos.push(`dicas dispensáveis (dá para resolver sem elas): ${dispensaveis.join(', ')}`);

  const tipos = {};
  for (const p of ded.passos) tipos[p.tipo] = (tipos[p.tipo] || 0) + 1;
  const dicasComplexas = ded.passos.filter((p) => p.tipo === 'dica' && !p.direta).length;
  return { arquivo, d, P, erros, avisos, tipos, dicasComplexas, deApoio, ded, msBusca, msDeducao };
}

const lista = carregarLista();
const ids = new Set();
let falhas = 0;
for (const item of lista) {
  const r = validar(item, ids);
  const nome = r.d ? `${r.d.id} — ${r.d.titulo} (${r.d.nivel})` : r.arquivo;
  if (r.erros.length) {
    falhas++;
    console.log(`❌ ${basename(r.arquivo)}: ${nome}`);
    for (const e of r.erros) console.log(`   • ${e}`);
  } else {
    const t = r.tipos;
    console.log(
      `✅ ${basename(r.arquivo)}: ${nome} — ${r.P.m} categorias × ${r.P.n} itens, ${r.P.dicas.length} dicas, solução única, ` +
        `resolvível por dedução em ${r.ded.passos.length} passos ` +
        `(dicas diretas ${(t.dica || 0) - r.dicasComplexas}, indiretas ${r.dicasComplexas}, pares de dicas ${t.dicas || 0}, ` +
        `grade G1 ${t.G1 || 0} · G2 ${t.G2 || 0} · G3 ${t.G3 || 0} · G4 ${t.G4 || 0} · G5 ${t.G5 || 0}) ` +
        `[${r.msBusca + r.msDeducao} ms]`,
    );
    if (r.deApoio.length) console.log(`   ℹ️  dicas de apoio (sem elas a solução seria única, mas exigiria raciocínio além de pares de dicas): ${r.deApoio.join(', ')}`);
  }
  for (const a of r.avisos) console.log(`   ⚠️  ${a}`);
  if (r.P && r.ded && mostrarPassos) {
    r.ded.passos.forEach((p, i) => console.log(`   ${String(i + 1).padStart(3)}. [${p.tipo}] ${semTags(M.descreverPasso(r.P, p))}`));
  }
}
if (falhas) {
  console.log(`\n${falhas} desafio(s) com problema.`);
  process.exit(1);
}
console.log(`\nTodos os ${lista.length} desafios estão OK.`);
