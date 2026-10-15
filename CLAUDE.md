# Lógica — Configuração do Projeto

PWA estática (HTML + CSS + JS vanilla, sem bundler) com desafios de lógica de
associação em grade. Visual herdado do app `estudo-tema` (temas Âmbar, Ametista,
Esmeralda × claro/noturno; fonte Manrope).

## Deploy
- Branch: **`main`**. Cada push roda `.github/workflows/deploy-pages.yml`:
  valida os desafios (`node scripts/validar.mjs`) e só então publica no GitHub
  Pages (fonte: GitHub Actions).
- URL: https://rodrigohaeitmann-sudo.github.io/logica/
- Depois de um push, confira o run do workflow.

## Desafios
- Um JSON por desafio em `desafios/`, listado em `desafios/index.json`.
- Toda dica precisa de `regras` formais (ver README) que correspondam exatamente
  ao texto. O validador exige: solução única, solução declarada coerente e
  resolução completa só por dedução (regras da grade + dicas isoladas ou em pares).
- Ao criar ou alterar um desafio: `node scripts/validar.mjs arquivo.json --passos`
  até passar sem erros nem dicas dispensáveis. Mudou um desafio publicado? Aumente `versao`.
- Evite associações que dê para adivinhar pelo mundo real (ex.: forró ↔ Recife).

## Código
- `js/motor.js` é compartilhado entre o app (botão Dica, verificar, quadro) e o
  validador em Node — não usar DOM nele.
- `localStorage` só com prefixo `logica:` (o domínio é compartilhado com o estudo-tema).
- Textos da interface em português do Brasil.
