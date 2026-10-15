# Lógica — Desafios de associação

Web app estático (HTML/CSS/JS puro, sem build) com desafios de lógica de
associação em grade, no estilo dos “Desafios de Lógica” das revistas de
passatempo. Funciona no celular, pode ser instalado na tela inicial e guarda o
progresso no próprio aparelho (offline).

**App:** https://rodrigohaeitmann-sudo.github.io/logica/

O visual (temas Âmbar, Ametista e Esmeralda, claro/noturno, fonte Manrope) segue
o app [TEMa Estudo](https://github.com/rodrigohaeitmann-sudo/estudo-tema).

## Como jogar

Cada desafio tem 4 ou 5 categorias (ex.: pessoa, cor, horário…) com 4 ou 5 itens
cada. Cada item combina com exatamente um item de cada outra categoria. A grade
em escada cruza as categorias duas a duas:

- toque numa casa: **✕** (não combinam) → **●** (combinam) → limpa;
- toque e segure: **●** direto;
- ao marcar **●**, o resto da linha e da coluna daquele quadro recebe ✕
  automaticamente (dá para desligar em Ajustes);
- o painel de baixo traz as **dicas** (toque para riscar), a **história** e o
  **quadro de respostas**, que se monta sozinho conforme você marca;
- **Verificar** aponta marcações erradas; **Dica** mostra o próximo passo lógico
  e explica qual regra ou dica permite concluí-lo;
- resolver sem verificar nem pedir dica vale ★★★ (Verificar: ★★; Dica: ★).

## Desafios incluídos

| # | Desafio | Nível | Tamanho |
|---|---------|-------|---------|
| 1 | Feira de adoção | Médio | 4 categorias × 4 itens |
| 2 | Corrida da Primavera | Médio | 4 × 5 |
| 3 | Feira de ciências | Médio | 5 × 4 |
| 4 | Clube do livro | Difícil | 4 × 5 |
| 5 | Festival de bandas | Difícil | 5 × 5 |

## Garantia de que as dicas bastam

Cada dica tem, além do texto, **regras formais** que o computador entende. O
script `scripts/validar.mjs` roda no GitHub Actions a cada push e só deixa o
deploy acontecer se, para todos os desafios:

1. a solução declarada cumpre todas as dicas;
2. as dicas levam a **uma única solução** (busca exaustiva);
3. dá para chegar à solução **só por dedução, sem chute** — usando as regras da
   grade (eliminação, única opção, transitividade, cruzamento) e as dicas, uma
   de cada vez ou duas combinadas;
4. nenhuma dica é dispensável (aviso).

O mesmo motor (`js/motor.js`) gera o botão **Dica** do app.

```bash
node scripts/validar.mjs            # valida todos
node scripts/validar.mjs --passos   # mostra a resolução passo a passo
node scripts/validar.mjs rascunho.json --passos   # testa um desafio avulso
```

## Como criar um desafio

1. Crie `desafios/NN-nome.json` e acrescente o arquivo em `desafios/index.json`.
2. Rode `node scripts/validar.mjs desafios/NN-nome.json --passos` até passar.
3. Faça push na `main`: o Actions valida e publica.

```json
{
  "id": "feira-de-adocao",
  "versao": 1,
  "titulo": "Feira de adoção",
  "nivel": "medio",
  "introducao": "História que apresenta o desafio…",
  "categorias": [
    { "id": "familia", "nome": "Família", "itens": ["Almeida", "Barros", "Campos", "Duarte"] },
    { "id": "idade", "nome": "Idade", "itens": ["1 ano", "2 anos", "3 anos", "4 anos"], "valores": [1, 2, 3, 4] }
  ],
  "dicas": [
    { "texto": "A família Campos adotou o animal mais novo.", "regras": [["=", "Campos", "1 ano"]] }
  ],
  "solucao": [["Almeida", "…"], ["Barros", "…"]]
}
```

- `nivel`: `facil`, `medio` ou `dificil`.
- A primeira categoria é a principal (linhas do quadro de respostas).
- `valores` (opcional) dá números aos itens para dicas de comparação; sem ele,
  vale a ordem da lista. `formato` (opcional, ex.: `"{} páginas"`) só muda como o
  item aparece nas explicações.
- `solucao`: uma linha por item da categoria principal, com um item de cada
  categoria, na ordem das categorias.
- Se mudar um desafio já publicado, aumente `versao` (o progresso salvo dele é
  reiniciado, porque a grade mudou).

Regras disponíveis (itens pelo nome; use `"idCategoria:Nome"` se o nome se repetir):

| Regra | Significado |
|-------|-------------|
| `["=", A, B]` | A e B são do mesmo grupo |
| `["!=", A, B]` | A e B são de grupos diferentes |
| `["distintos", A, B, C…]` | todos de grupos diferentes |
| `["ou", A, B, C…]` | A combina com exatamente um entre B, C… |
| `["par", [A, B], [C, D]]` | A e B são C e D, em alguma ordem |
| `["dif", K, A, B, k]` | valor de K de A − valor de K de B = k |
| `["dist", K, A, B, k]` | diferença absoluta = k (ex.: “lado a lado”) |
| `[">", K, A, B]` / `["<", K, A, B]` | comparação pelos valores da categoria K |
| `["extremo", K, A]` / `["meio", K, A]` | A tem o menor ou o maior valor de K / nenhum dos dois |

## Desenvolvimento

Sem build: edite e dê push. Para rodar localmente (ES modules não funcionam via
`file://`):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

### Estrutura

```
index.html                 SPA: Desafios, Jogo, Como jogar, Ajustes
css/style.css              Estilo mobile-first + tokens de tema
js/app.js                  Carrega desafios, navegação (#hash), tela inicial, ajustes
js/jogo.js                 Grade, marcações, painel, verificar, dica, cronômetro
js/motor.js                Motor lógico: validação, solução única, dedução e textos das dicas
js/estado.js               Progresso e ajustes no localStorage (chaves "logica:")
js/ui.js                   Utilidades de interface (janelas, tempo, estrelas)
desafios/                  Um JSON por desafio + index.json
scripts/validar.mjs        Validador usado no CI
sw.js, manifest.json       PWA (offline + instalar na tela inicial)
.github/workflows/         Valida e publica no GitHub Pages
```

O deploy usa a fonte **GitHub Actions** do Pages (Settings → Pages → Build and
deployment → Source: GitHub Actions).
