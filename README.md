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

- toque numa casa: **✕** (não combinam) → **S** (combinam) → limpa;
- toque e segure: **S** direto;
- ao marcar **S**, o resto da linha e da coluna daquele quadro recebe ✕
  automaticamente (dá para desligar em Ajustes);
- o painel de baixo traz as **dicas** (toque para riscar), a **história**, o
  **quadro de respostas** (se monta sozinho conforme você marca) e a
  **relação** (veja abaixo);
- **Verificar** aponta marcações erradas; **Dica** mostra o próximo passo lógico
  e explica qual regra ou dica permite concluí-lo. Quando só juntando dicas dá
  para avançar, a Dica explica por hipótese: “suponha que A combine com B;
  então… mas aí a dica 3 não teria como ser cumprida” — uma cadeia curta de
  passos simples (regras da grade e dicas isoladas) até a contradição;
- resolver sem verificar nem pedir dica vale ★★★ (Verificar: ★★; Dica: ★).

### Instalar no celular

No Android, o Chrome oferece **Instalar app** (o app também mostra um botão na
tela inicial quando o navegador permite). No iPhone, abra no Safari →
**Compartilhar** → **Adicionar à Tela de Início**. Em **Ajustes → App no
celular** ficam os passos para cada navegador e uma linha de diagnóstico (service
worker, manifesto, se o navegador ofereceu a instalação, se o app já está
instalado). Se o Chrome disser que o app já está instalado, ele existe no
aparelho mesmo sem ícone na tela inicial — tirar o ícone não desinstala; procure
“Lógica” na lista de apps.

### Aba Relação

Nos desafios com categorias que dá para comparar (datas, idades, preços,
horários, páginas…), a aba **Relação** faz o papel das anotações na margem da
revista, numa notação padronizada e compacta: **o item menor primeiro, a
diferença exata no meio (só o número, sem unidade) ou `?` se não se sabe quanto,
e o maior por último**:

- só a ordem: **Renata ? Marta** (Renata indicou antes de Marta);
- diferença exata: **Suspense 1 Paulo** (Paulo leu um mês depois do suspense),
  **Poesia 60 Romance** (60 páginas a menos);
- diferença sem saber quem vem antes: **Igor ±18 Tia**.

O formulário segue a mesma ordem (menor · diferença · maior, com botão para
trocar os itens) e mostra a leitura por extenso para conferir. Cada anotação
pode ficar ligada a uma dica (as setas mostram o texto dela). A anotação
seguinte já começa no último item, e o app monta as cadeias crescentes
(**Renata ? Marta ? Paulo**), que aparecem também na tela do desafio, no espaço
vazio da escada da grade (como na margem da revista). Tocar numa anotação — na
lista, na cadeia ou nas notas da grade — abre para alterar (Salvar/Cancelar).
Opcionalmente, mostra embaixo de cada item os valores que ainda cabem,
cruzando as anotações com os ✕ e S da grade — sem consultar a resposta. As
anotações ficam salvas com o progresso e somem em “Recomeçar”.

## Desafios incluídos

São **100 desafios**: 47 médios e 53 difíceis. Os de número 1 a 5 foram feitos à
mão; os de 6 a 100 saíram do gerador (abaixo) e passaram pelo mesmo validador.

| Nível | Associação | Ordem | Cálculo | Misto |
|-------|-----------:|------:|--------:|------:|
| Médio | 11 | 11 | 10 | 15 |
| Difícil | 11 | 16 | 15 | 11 |

- **Associação**: só ligações entre nomes (“quem tem o gato não mora em Santos”).
- **Ordem**: antes/depois, vizinhos, primeiro e último.
- **Cálculo**: diferenças exatas (“dois anos mais velho”, “R$ 10 a mais”).
- **Misto**: um pouco de cada.

Tamanhos: 21 de 4×4, 32 de 4 categorias × 5 itens, 28 de 5 × 4 e 19 de 5×5. A
tela inicial lista os desafios numerados, com filtros de nível e tipo (e a opção
de esconder os resolvidos).

## Garantia de que as dicas bastam

Cada dica tem, além do texto, **regras formais** que o computador entende. O
script `scripts/validar.mjs` roda no GitHub Actions a cada push e só deixa o
deploy acontecer se, para todos os desafios:

1. a solução declarada cumpre todas as dicas;
2. as dicas levam a **uma única solução** (busca exaustiva);
3. dá para chegar à solução **só por dedução, sem chute** — usando as regras da
   grade (eliminação, única opção, transitividade, cruzamento) e as dicas, uma
   de cada vez ou duas combinadas;
4. o **nível** confere: **médio** sai sem nunca juntar duas dicas; **difícil**
   exige juntar duas dicas em algum momento (ou é 5×5 com no máximo uma dica
   direta “A é B”);
5. nenhuma dica é dispensável (aviso) e os textos não têm deslizes comuns de
   redação (contração faltando, espaço duplo, falta de ponto final…).

O mesmo motor (`js/motor.js`) gera o botão **Dica** do app. Nos pontos em que
só juntando duas dicas dá para avançar, o botão não diz apenas “junte as dicas
i e j”: procura uma casa que se resolva por absurdo com a explicação mais curta
(`passoPorHipotese`), preferindo finais que se veem de imediato na grade ou na
dica (e diz por que a dica falharia, quando dá para resumir).

```bash
node scripts/validar.mjs            # valida todos
node scripts/validar.mjs --passos   # mostra a resolução passo a passo
node scripts/validar.mjs rascunho.json --passos   # testa um desafio avulso
```

## Como criar um desafio

1. Crie `desafios/NNN-nome.json` e acrescente o arquivo em `desafios/index.json`
   (a ordem do índice é a numeração da lista).
2. Rode `node scripts/validar.mjs desafios/NNN-nome.json --passos` até passar.
3. Faça push na `main`: o Actions valida e publica.

```json
{
  "id": "feira-de-adocao",
  "versao": 1,
  "titulo": "Feira de adoção",
  "nivel": "medio",
  "tipo": "misto",
  "introducao": "História que apresenta o desafio…",
  "categorias": [
    { "id": "familia", "nome": "Família", "itens": ["Almeida", "Barros", "Campos", "Duarte"] },
    { "id": "idade", "nome": "Idade", "itens": ["1 ano", "2 anos", "3 anos", "4 anos"], "valores": [1, 2, 3, 4],
      "relacao": { "menor": "mais novo(a) que", "maior": "mais velho(a) que", "menorK": "{k} mais novo(a) que",
                   "maiorK": "{k} mais velho(a) que", "unidade": ["ano", "anos"], "menorCurto": "mais novo(a)", "maiorCurto": "mais velho(a)" } }
  ],
  "dicas": [
    { "texto": "A família Campos adotou o animal mais novo.", "regras": [["=", "Campos", "1 ano"]] }
  ],
  "solucao": [["Almeida", "…"], ["Barros", "…"]]
}
```

- `nivel`: `facil`, `medio` ou `dificil`. `tipo` (opcional): `associacao`,
  `ordem`, `calculo` ou `misto` (aparece na lista e nos filtros).
- A primeira categoria é a principal (linhas do quadro de respostas).
- `valores` (opcional) dá números aos itens para dicas de comparação; sem ele,
  vale a ordem da lista. `formato` (opcional, ex.: `"{} páginas"`) só muda como o
  item aparece nas explicações.
- `relacao` (opcional, só em categorias com `valores`): rótulos da aba Relação.
  `menor`/`maior` são as relações sem medida; `menorK`/`maiorK` as com medida
  (`{k}` vira a quantidade, com `unidade` no singular e no plural ou com
  `prefixo`, ex. `"R$ "`); `menorCurto`/`maiorCurto` aparecem nas cadeias.
  `"exata": false` esconde as relações com medida (números que só servem para
  comparar, como o de um portão). Sem `relacao`, a aba usa “menor que”/“maior que”.
  Categorias sem `valores` não aparecem na aba; se nenhuma tiver, a aba some.
- `solucao`: uma linha por item da categoria principal, com um item de cada
  categoria, na ordem das categorias.
- Se mudar a grade, as regras das dicas ou a solução de um desafio já publicado,
  aumente `versao` (o progresso salvo dele é reiniciado). Corrigir só a redação
  de uma dica, sem mudar o sentido, não precisa.

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

## Gerador de desafios

`scripts/gerador/` cria desafios novos com o mesmo motor do app. Para cada um,
sorteia um tema (29 temas em `temas.mjs`: corrida, prédio, festa junina,
viagens, plantão médico, horta, mudança…), as categorias e uma solução; junta
fatos verdadeiros do tipo pedido até a solução ficar única e dedutível; poda o
que sobra; confere o nível; e escreve as dicas em português (concordância,
contrações e frases compostas como “Bruno chegou depois de Elisa, mas antes de
Fábio”, em `lingua.mjs`).

```bash
node scripts/gerador/gerar.mjs --plano                         # nível, tipo e tamanho de cada número
node scripts/gerador/gerar.mjs --teste corrida ordem dificil 4 5   # mostra um desafio de teste
node scripts/gerador/gerar.mjs --gerar 6-100                   # grava em desafios/
node scripts/validar.mjs                                       # depois, sempre
```

O resultado é determinístico (semente fixa; `--semente N` muda tudo). O tema, o
título e a semente de cada número ficam em `scripts/gerador/registro.json`;
gerar de novo a mesma faixa reproduz os mesmos arquivos. Desafios novos
precisam entrar em `desafios/index.json`.

## Desenvolvimento

Sem build: edite e dê push. Para rodar localmente (ES modules não funcionam via
`file://`):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

No deploy, `scripts/empacotar.mjs` junta todos os desafios em
`desafios/pacote.json`, que o app baixa de uma vez (e o service worker guarda
para uso offline). Localmente, sem o pacote, o app lê o índice e os arquivos
soltos.

### Estrutura

```
index.html                 SPA: Desafios, Jogo, Como jogar, Ajustes
css/style.css              Estilo mobile-first + tokens de tema
js/app.js                  Carrega desafios, navegação (#hash), tela inicial (lista e filtros), ajustes
js/jogo.js                 Grade, marcações, painel, verificar, dica, cronômetro
js/relacao.js              Aba Relação: anotações, cadeias e valores possíveis
js/motor.js                Motor lógico: validação, solução única, dedução e textos das dicas
js/estado.js               Progresso, ajustes e filtros no localStorage (chaves "logica:")
js/ui.js                   Utilidades de interface (janelas, tempo, estrelas)
desafios/                  Um JSON por desafio + index.json
scripts/validar.mjs        Validador usado no CI
scripts/empacotar.mjs      Junta os desafios em desafios/pacote.json (deploy)
scripts/gerador/           Gerador de desafios (temas, língua, registro)
sw.js, manifest.json       PWA (offline + instalar na tela inicial)
.github/workflows/         Valida e publica no GitHub Pages
```

O deploy usa a fonte **GitHub Actions** do Pages (Settings → Pages → Build and
deployment → Source: GitHub Actions).
