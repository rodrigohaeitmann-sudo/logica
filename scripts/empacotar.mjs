#!/usr/bin/env node
// Junta os desafios listados em desafios/index.json num arquivo só,
// desafios/pacote.json, para o app baixar tudo de uma vez (uma requisição em
// vez de uma por desafio). Roda no deploy (GitHub Actions); sem o pacote, o app
// volta a ler o índice e os arquivos soltos, então localmente não é preciso rodar.
//
// Uso: node scripts/empacotar.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'desafios');
const { desafios } = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const lista = desafios.map((arq) => JSON.parse(readFileSync(join(DIR, arq), 'utf8')));
const saida = join(DIR, 'pacote.json');
writeFileSync(saida, JSON.stringify({ desafios: lista }));
const kb = (Buffer.byteLength(JSON.stringify({ desafios: lista })) / 1024).toFixed(0);
console.log(`desafios/pacote.json: ${lista.length} desafios, ${kb} KB`);
