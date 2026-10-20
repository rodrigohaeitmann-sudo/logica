# Lógica — Configuração do Projeto

PWA estática (HTML + CSS + JS vanilla, sem bundler) com desafios de lógica de
associação em grade. Visual herdado do app `estudo-tema` (temas Âmbar, Ametista,
Esmeralda × claro/noturno; fonte Manrope).

## Deploy
- Branch: **`main`**. Cada push roda `.github/workflows/deploy-pages.yml`:
  valida os desafios (`node scripts/validar.mjs`) e só então publica no GitHub
  Pages (fonte: GitHub Actions). No deploy, `scripts/empacotar.mjs` gera
  `desafios/pacote.json` (todos os desafios num arquivo; não vai para o git).
- URL: https://rodrigohaeitmann-sudo.github.io/logica/
- Depois de um push, confira o run do workflow.

## Desafios
- Um JSON por desafio em `desafios/` (`NNN-slug.json`), listado em
  `desafios/index.json`; a ordem do índice é a numeração mostrada no app.
- Toda dica precisa de `regras` formais (ver README) que correspondam exatamente
  ao texto. O validador exige: solução única, solução declarada coerente e
  resolução completa só por dedução (regras da grade + dicas isoladas ou em pares).
- Nível: **médio** resolve sem nunca juntar duas dicas; **difícil** precisa juntar
  duas dicas (ou é 5×5 com no máximo uma dica `=`). O validador confere.
- `tipo`: `associacao`, `ordem`, `calculo` ou `misto`. Categorias com `valores`
  podem ter `relacao` (rótulos da aba Relação; ver README).
- Ao criar ou alterar um desafio: `node scripts/validar.mjs arquivo.json --passos`
  até passar sem erros nem dicas dispensáveis. Mudou a grade, as regras ou a
  solução de um desafio publicado? Aumente `versao` (só corrigir a redação de uma
  dica, sem mudar o sentido, não precisa: o progresso salvo continua valendo).
- Evite associações que dê para adivinhar pelo mundo real (ex.: forró ↔ Recife).
- Gerador: `node scripts/gerador/gerar.mjs --gerar A-B` (temas em
  `scripts/gerador/temas.mjs`, português em `lingua.mjs`); é determinístico.
  Releia os textos gerados e valide tudo depois.

## Código
- `js/motor.js` é compartilhado entre o app (botão Dica, verificar, quadro) e o
  validador/gerador em Node — não usar DOM nele. `proximoPasso` define o nível e
  o relatório do validador: mexer na ordem dos passos muda tudo (compare a saída
  de `--passos` antes e depois). O botão Dica usa `proximoPassoDica`, que troca
  o "junte as dicas i e j" por uma explicação por hipótese (`passoPorHipotese`).
- Marcas da grade: ✕ (não combinam) e **S** (combinam), nunca bolinha.
- Aba Relação (`js/relacao.js`): anotações do jogador (`progresso.relacoes`),
  editáveis, sempre exibidas na notação padronizada "MENOR q MAIOR" (q = diferença
  exata, só o número, ou `?`; `±q` sem ordem). As cadeias aparecem também na grade,
  numa célula no espaço vazio do último bloco de linhas (`#notas-grade`). Não pode
  consultar a solução.
- PWA: o manifesto tem `id` próprio (`/logica/`) e escopo `./`; outros apps do
  usuário vivem no mesmo domínio (rodrigohaeitmann-sudo.github.io), então nunca
  use escopo `/` nem copie `id`/`start_url` de outro app.
- Instalação: cartão "App no celular" em Ajustes (passos por navegador e uma
  linha de diagnóstico: service worker, manifesto, oferta de instalação, app já
  instalado) e aviso na tela inicial no celular ("Agora não" esconde por 30
  dias, chave `logica:avisos`). No Android, tirar o ícone da tela inicial não
  desinstala o app: o Chrome continua dizendo que já está instalado.
- `localStorage` só com prefixo `logica:` (o domínio é compartilhado com o estudo-tema).
- Textos da interface em português do Brasil.
