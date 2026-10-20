// Catálogo de temas do gerador de desafios.
//
// Cada tema tem uma categoria principal (pessoas, famílias, times, dias...) e
// várias categorias possíveis; o gerador escolhe algumas a cada desafio.
//
// Convenções dos textos (ver lingua.mjs):
// - pred: o que se diz de alguém ("correu {x}"); {x} vem do item.
// - np (opcional): como se refere a alguém por meio do item ("quem tem o gato").
//   Sem np, usa-se "<que> <pred>" (ex.: "quem correu de azul").
// - Categorias ordenadas (ordem: true) têm valores numéricos e as frases de
//   comparação: verbo + maior/menor ("chegou" + "depois de {B}"), difMaior(k),
//   difMenor(k), dist(k) (com {A} e {B}), extremo, meio, predMin/predMax
//   (superlativos) e npMin/npMax.
// - {o}, {um}... concordam com o gênero de quem é o sujeito da frase.
// - relacao: rótulos da aba Relação do app (menor/maior, menorK/maiorK com {k},
//   unidade, prefixo, menorCurto/maiorCurto; exata: false esconde as relações
//   com medida exata, para números que só servem para comparar).

import { extenso, fmtNum, qtd, reais } from './lingua.mjs';

// ---------------------------------------------------------------------------
// Nomes
// ---------------------------------------------------------------------------

export const NOMES_M = ['André', 'Bruno', 'Caio', 'Daniel', 'Eduardo', 'Fábio', 'Gustavo', 'Heitor', 'Igor', 'João',
  'Lucas', 'Mateus', 'Nicolas', 'Otávio', 'Pedro', 'Rafael', 'Samuel', 'Tiago', 'Vítor', 'Arthur', 'César', 'Diego',
  'Enzo', 'Felipe', 'Gabriel', 'Henrique', 'Júlio', 'Leonardo', 'Marcelo', 'Nelson', 'Paulo', 'Renato', 'Sérgio',
  'Túlio', 'Vicente', 'Alexandre', 'Breno', 'Davi', 'Elias', 'Fernando', 'Guilherme', 'Hugo', 'Ivan', 'Jorge',
  'Lauro', 'Miguel', 'Natan', 'Orlando', 'Ricardo', 'Silvio', 'Teodoro', 'Ulisses', 'Valter', 'Wagner', 'Yuri'];

export const NOMES_F = ['Ana', 'Beatriz', 'Camila', 'Daniela', 'Elisa', 'Fernanda', 'Gabriela', 'Helena', 'Isabela',
  'Júlia', 'Larissa', 'Mariana', 'Natália', 'Olívia', 'Paula', 'Renata', 'Sofia', 'Tatiana', 'Vanessa', 'Alice',
  'Clara', 'Débora', 'Eduarda', 'Flávia', 'Giovana', 'Heloísa', 'Iara', 'Joana', 'Lívia', 'Marina', 'Nina',
  'Priscila', 'Raquel', 'Sara', 'Teresa', 'Valéria', 'Yasmin', 'Aline', 'Bruna', 'Carolina', 'Diana', 'Estela',
  'Fabiana', 'Glória', 'Irene', 'Laura', 'Mônica', 'Nádia', 'Patrícia', 'Rita', 'Simone', 'Tânia', 'Vera',
  'Lorena', 'Cecília', 'Ursula', 'Zélia'];

export const SOBRENOMES = ['Almeida', 'Barros', 'Campos', 'Duarte', 'Esteves', 'Farias', 'Gomes', 'Lacerda', 'Macedo',
  'Nogueira', 'Pacheco', 'Queiroz', 'Ribeiro', 'Siqueira', 'Teixeira', 'Vieira', 'Andrade', 'Bastos', 'Cardoso',
  'Dantas', 'Freitas', 'Guimarães', 'Leme', 'Moreira', 'Novaes', 'Peixoto', 'Rezende', 'Sales', 'Tavares', 'Xavier'];

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------

const horas = (k) => qtd(k, 'hora', 'horas', 'f');
const anos = (k) => qtd(k, 'ano', 'anos', 'm');
const meses = (k) => qtd(k, 'mês', 'meses', 'm');
const dias = (k) => qtd(k, 'dia', 'dias', 'm');
const posicoes = (k) => qtd(k, 'posição', 'posições', 'f');
const andares = (k) => qtd(k, 'andar', 'andares', 'm');
const filas = (k) => qtd(k, 'fila', 'filas', 'f');
const minutos = (k) => qtd(k, 'minuto', 'minutos', 'm', k <= 10);
const pontos = (k) => {
  const int = Math.floor(k);
  const meio = Math.abs(k - int - 0.5) < 1e-9;
  if (meio && int === 0) return 'meio ponto';
  if (meio) return `${extenso(int)} ${int === 1 ? 'ponto' : 'pontos'} e meio`;
  return qtd(k, 'ponto', 'pontos', 'm');
};
const kg = (k) => (k < 1 ? `${Math.round(k * 1000)} gramas` : `${fmtNum(+k.toFixed(2))} kg`);
const outras = (k, sing, plur, g) => `${extenso(k, g)} ${k === 1 ? sing : plur}`;

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro',
  'Novembro', 'Dezembro'];
const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DIA_X = ['', 'na segunda-feira', 'na terça-feira', 'na quarta-feira', 'na quinta-feira', 'na sexta-feira',
  'no sábado', 'no domingo'];
const DIA_NOME = ['', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

// Rótulos da aba Relação
const R_TEMPO = (un) => ({ menor: 'antes de', maior: 'depois de', menorK: '{k} antes de', maiorK: '{k} depois de', unidade: un, menorCurto: 'antes', maiorCurto: 'depois' });
const R_QTD = (un, extra = {}) => ({ menor: 'menos que', maior: 'mais que', menorK: '{k} a menos que', maiorK: '{k} a mais que', unidade: un, menorCurto: 'menos', maiorCurto: 'mais', ...extra });
const R_REAIS = { menor: 'mais barato que', maior: 'mais caro que', menorK: '{k} mais barato que', maiorK: '{k} mais caro que', prefixo: 'R$ ', menorCurto: 'mais barato', maiorCurto: 'mais caro' };
const R_POSICAO = { menor: 'à frente de', maior: 'atrás de', menorK: '{k} à frente de', maiorK: '{k} atrás de', unidade: ['posição', 'posições'], menorCurto: 'à frente', maiorCurto: 'atrás' };
const R_IDADE = { menor: 'mais novo(a) que', maior: 'mais velho(a) que', menorK: '{k} mais novo(a) que', maiorK: '{k} mais velho(a) que', unidade: ['ano', 'anos'], menorCurto: 'mais novo(a)', maiorCurto: 'mais velho(a)' };
const R_ANDAR = { menor: 'abaixo de', maior: 'acima de', menorK: '{k} abaixo de', maiorK: '{k} acima de', unidade: ['andar', 'andares'], menorCurto: 'abaixo', maiorCurto: 'acima' };

// ---------------------------------------------------------------------------
// Geradores de valores
// ---------------------------------------------------------------------------

const progressao = (inicios, passos) => (n, r) => {
  const i0 = r.escolha(inicios);
  const p = r.escolha(passos);
  return Array.from({ length: n }, (_, i) => +(i0 + i * p).toFixed(2));
};
const consecutivos = (inicios) => progressao(inicios, [1]);
const amostra = (pool) => (n, r) => r.amostra(pool, n).sort((a, b) => a - b);
const janela = (min, max) => (n, r) => {
  const i0 = r.int(min, max - n + 1);
  return Array.from({ length: n }, (_, i) => i0 + i);
};

// Itens nominais: 'Rótulo|x|d|g' (x = trecho na frase, d = forma definida, g = gênero)
function itens(lista) {
  return lista.map((s) => {
    const [r, x, d, g] = s.split('|');
    return { r, x: x ?? r.toLowerCase(), d: d || undefined, g: g || undefined };
  });
}

// ---------------------------------------------------------------------------
// Categorias reaproveitadas
// ---------------------------------------------------------------------------

function idade({ inicios = [22, 25, 28, 31, 34], passos = [2, 3, 4], intro = 'tem uma idade diferente' } = {}) {
  return {
    id: 'idade', nome: 'Idade', ordem: true, numerica: true,
    valores: progressao(inicios, passos),
    rotulo: (v) => `${v} anos`, x: (v) => `${v} anos`,
    pred: 'tem {x}',
    predMin: 'é {o} mais nov{o} do grupo', npMin: 'é o mais novo do grupo',
    predMax: 'é {o} mais velh{o} do grupo', npMax: 'é o mais velho do grupo',
    verbo: 'é', maior: 'mais velh{o} que {B}', menor: 'mais nov{o} que {B}',
    difMaior: (k) => `${anos(k)} mais velh{o} que {B}`,
    difMenor: (k) => `${anos(k)} mais nov{o} que {B}`,
    dist: (k) => `{A} e {B} têm ${anos(k)} de diferença de idade`,
    extremo: 'é {o} mais velh{o} ou {o} mais nov{o} do grupo',
    meio: 'não é {o} mais velh{o} nem {o} mais nov{o} do grupo',
    relacao: R_IDADE, intro, descubra: 'a idade',
  };
}

function colocacao({ verbo = 'chegou', venceu = 'venceu a prova', ultimo, intro = 'chegou em uma posição diferente', plural = 'chegaram' } = {}) {
  return {
    id: 'colocacao', nome: 'Colocação', ordem: true, numerica: false,
    valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
    rotulo: (v) => `${v}º`, formato: '{} lugar', x: (v) => `em ${v}º lugar`,
    pred: `${verbo} {x}`,
    predMin: venceu, npMin: venceu,
    predMax: ultimo || `${verbo} em último lugar`, npMax: ultimo || `${verbo} em último lugar`,
    verbo, maior: 'atrás de {B}', menor: 'à frente de {B}',
    difMaior: (k) => (k === 1 ? 'logo atrás de {B}' : `${posicoes(k)} atrás de {B}`),
    difMenor: (k) => (k === 1 ? 'imediatamente à frente de {B}' : `${posicoes(k)} à frente de {B}`),
    dist: (k) => (k === 1 ? `{A} e {B} ${plural} em posições seguidas` : `{A} e {B} ${plural} com ${posicoes(k)} de diferença`),
    extremo: `${verbo} em primeiro ou em último lugar`,
    meio: `não ${verbo} nem em primeiro nem em último lugar`,
    relacao: R_POSICAO, intro, descubra: 'a colocação',
  };
}

function andar({ verbo = 'mora', plural = 'moram', intro = 'mora em um andar diferente', descubra = 'o andar' } = {}) {
  return {
    id: 'andar', nome: 'Andar', ordem: true, numerica: false,
    valores: consecutivos([1, 2, 3, 4, 5, 6]),
    rotulo: (v) => `${v}º andar`, x: (v) => `no ${v}º andar`,
    pred: `${verbo} {x}`,
    predMin: `${verbo} no andar mais baixo`, npMin: `${verbo} no andar mais baixo`,
    predMax: `${verbo} no andar mais alto`, npMax: `${verbo} no andar mais alto`,
    verbo, maior: 'acima de {B}', menor: 'abaixo de {B}',
    difMaior: (k) => (k === 1 ? 'no andar logo acima do de {B}' : `${andares(k)} acima de {B}`),
    difMenor: (k) => (k === 1 ? 'no andar logo abaixo do de {B}' : `${andares(k)} abaixo de {B}`),
    dist: (k) => (k === 1 ? `{A} e {B} ${plural} em andares vizinhos` : `{A} e {B} ${plural} a ${andares(k)} de distância`),
    extremo: `${verbo} no andar mais alto ou no mais baixo`,
    meio: `não ${verbo} nem no andar mais alto nem no mais baixo`,
    relacao: R_ANDAR, intro, descubra,
  };
}

function mes({ pred, verbo, primeiro, ultimo, npPrimeiro, npUltimo, seguidos, distFrase, extremo, meio, intro, descubra, xPrefixo = 'em' }) {
  return {
    id: 'mes', nome: 'Mês', ordem: true, numerica: false,
    valores: janela(1, 12),
    rotulo: (v) => MESES[v], x: (v) => `${xPrefixo} ${MESES[v].toLowerCase()}`,
    pred,
    predMin: primeiro, npMin: npPrimeiro, predMax: ultimo, npMax: npUltimo,
    verbo, maior: 'depois de {B}', menor: 'antes de {B}',
    difMaior: (k) => (k === 1 ? 'no mês seguinte ao de {B}' : `${meses(k)} depois de {B}`),
    difMenor: (k) => (k === 1 ? 'no mês anterior ao de {B}' : `${meses(k)} antes de {B}`),
    dist: (k) => (k === 1 ? seguidos : distFrase(meses(k))),
    extremo, meio,
    relacao: R_TEMPO(['mês', 'meses']), intro, descubra,
  };
}

function diaSemana({ pred, verbo, primeiro, ultimo, npPrimeiro, npUltimo, seguidos, distFrase, extremo, meio, intro, descubra, vespera }) {
  return {
    id: 'dia', nome: 'Dia', ordem: true, numerica: false,
    valores: janela(1, 6),
    rotulo: (v) => DIAS[v], x: (v) => DIA_X[v],
    pred,
    predMin: primeiro, npMin: npPrimeiro, predMax: ultimo, npMax: npUltimo,
    verbo, maior: 'depois de {B}', menor: 'antes de {B}',
    difMaior: (k) => (k === 1 ? 'no dia seguinte ao de {B}' : `${dias(k)} depois de {B}`),
    difMenor: (k) => (k === 1 ? vespera : `${dias(k)} antes de {B}`),
    dist: (k) => (k === 1 ? seguidos : distFrase(dias(k))),
    extremo, meio,
    relacao: R_TEMPO(['dia', 'dias']), intro, descubra,
  };
}

function horario({ id = 'horario', nome = 'Horário', inicios, passo = 1, pred, verbo, primeiro, ultimo, npPrimeiro, npUltimo, maior = 'depois de {B}', menor = 'antes de {B}', difMaior, difMenor, distFrase, seguidos, extremo, meio, intro, descubra, xPrefixo = 'às', relacao }) {
  return {
    id, nome, ordem: true, numerica: false,
    valores: progressao(inicios, [passo]), passo,
    rotulo: (v) => `${v}h`, x: (v) => `${xPrefixo} ${v}h`,
    pred, predMin: primeiro, npMin: npPrimeiro, predMax: ultimo, npMax: npUltimo,
    verbo, maior, menor,
    difMaior: difMaior || ((k) => `${horas(k)} depois de {B}`),
    difMenor: difMenor || ((k) => `${horas(k)} antes de {B}`),
    dist: (k) => (seguidos && k === passo ? seguidos : distFrase(horas(k))),
    extremo, meio,
    relacao: relacao || R_TEMPO(['hora', 'horas']), intro, descubra,
  };
}

// ---------------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------------

const PESSOAS = { que: { t: 'quem', g: 'm' }, ser: 'era', entidade: { plural: 'pessoas', g: 'f' }, cadaUm: 'Cada um', paraCada: 'para cada um' };
const PRESENTE = { ...PESSOAS, ser: 'é' };

export const TEMAS = [
  // 1 ─────────────────────────────────────────────────────────────────────
  {
    id: 'corrida', ...PESSOAS,
    titulos: ['Corrida noturna', 'Meia maratona', 'Corrida beneficente', 'Desafio dos 10 km'],
    principal: { id: 'corredor', nome: 'Corredor(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} amigos que treinam juntos no parque se inscreveram numa corrida de rua no último domingo.`,
      (c) => `Na corrida do aniversário da cidade, ${c.n} colegas de trabalho resolveram correr juntos pela primeira vez.`,
    ],
    categorias: [
      { id: 'camiseta', nome: 'Camiseta', pred: 'correu {x}', intro: 'correu com uma camiseta de cor diferente', descubra: 'a cor da camiseta',
        itens: itens(['Amarela|de amarelo', 'Azul|de azul', 'Branca|de branco', 'Laranja|de laranja', 'Verde|de verde', 'Vermelha|de vermelho', 'Preta|de preto', 'Roxa|de roxo', 'Cinza|de cinza', 'Rosa|de rosa']) },
      { id: 'cidade', nome: 'Cidade', pred: 'veio {x}', intro: 'veio de uma cidade diferente', descubra: 'a cidade de origem',
        itens: itens(['Campinas|de Campinas', 'Santos|de Santos', 'Sorocaba|de Sorocaba', 'Jundiaí|de Jundiaí', 'Bauru|de Bauru', 'Piracicaba|de Piracicaba', 'Taubaté|de Taubaté', 'Franca|de Franca', 'Limeira|de Limeira', 'Marília|de Marília']) },
      { id: 'equipe', nome: 'Equipe', pred: 'treina {x}', intro: 'treina com uma equipe de corrida diferente', descubra: 'a equipe de treino',
        itens: itens(['Passo Firme|com a equipe Passo Firme', 'Ritmo|com a equipe Ritmo', 'Fôlego|com a equipe Fôlego', 'Pé na Pista|com a equipe Pé na Pista', 'Vento Sul|com a equipe Vento Sul', 'Avante|com a equipe Avante', 'Largada|com a equipe Largada']) },
      {
        id: 'numero', nome: 'Número', ordem: true, numerica: false, usos: ['gt', 'extremo', 'meio'],
        valores: amostra([7, 12, 18, 23, 27, 31, 35, 42, 48, 53, 61, 67, 74, 88, 96]),
        rotulo: (v) => String(v), formato: 'nº {}', x: (v) => `o número ${v}`,
        pred: 'usou {x}', predMin: 'usou o menor número', npMin: 'usou o menor número', predMax: 'usou o maior número', npMax: 'usou o maior número',
        verbo: 'usou', maior: 'um número maior que o de {B}', menor: 'um número menor que o de {B}',
        extremo: 'usou o maior ou o menor número', meio: 'não usou nem o maior nem o menor número',
        relacao: { menor: 'menor que', maior: 'maior que', menorCurto: 'menor', maiorCurto: 'maior', exata: false },
        intro: 'recebeu um número de peito diferente', descubra: 'o número de peito',
      },
      colocacao({ verbo: 'chegou', venceu: 'venceu a corrida' }),
      idade(),
    ],
  },

  // 2 ─────────────────────────────────────────────────────────────────────
  {
    id: 'predio', ...PRESENTE,
    titulos: ['Edifício Aurora', 'Vizinhos de porta', 'Condomínio das Palmeiras', 'Reunião de condomínio'],
    principal: { id: 'morador', nome: 'Morador(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `Na reunião de condomínio, ${c.n} moradores se apresentaram aos vizinhos que acabaram de chegar ao prédio.`,
      (c) => `${c.N} vizinhos do mesmo prédio organizaram juntos a festa de fim de ano do condomínio.`,
    ],
    categorias: [
      { id: 'profissao', nome: 'Profissão', pred: 'é {x}', intro: 'tem uma profissão diferente', descubra: 'a profissão',
        itens: itens(['Dentista|dentista', 'Jornalista|jornalista', 'Economista|economista', 'Florista|florista', 'Nutricionista|nutricionista', 'Fisioterapeuta|fisioterapeuta', 'Pianista|pianista', 'Motorista|motorista', 'Eletricista|eletricista', 'Recepcionista|recepcionista']) },
      { id: 'pet', nome: 'Animal', pred: 'tem {x}', np: (it) => `quem tem ${it.d}`, intro: 'tem um animal de estimação diferente', descubra: 'o animal de estimação',
        itens: itens(['Gato|um gato|o gato', 'Cachorro|um cachorro|o cachorro', 'Papagaio|um papagaio|o papagaio', 'Coelho|um coelho|o coelho', 'Tartaruga|uma tartaruga|a tartaruga', 'Hamster|um hamster|o hamster', 'Calopsita|uma calopsita|a calopsita', 'Aquário|um aquário|o aquário']) },
      { id: 'instrumento', nome: 'Instrumento', pred: 'toca {x}', intro: 'toca um instrumento diferente', descubra: 'o instrumento que toca',
        itens: itens(['Violão|violão', 'Piano|piano', 'Flauta|flauta', 'Bateria|bateria', 'Saxofone|saxofone', 'Violino|violino', 'Ukulele|ukulele', 'Teclado|teclado']) },
      { id: 'carro', nome: 'Carro', pred: 'tem {x}', np: (it) => `quem tem ${it.d}`, intro: 'tem um carro de cor diferente', descubra: 'a cor do carro',
        itens: itens(['Prata|um carro prata|o carro prata', 'Branco|um carro branco|o carro branco', 'Preto|um carro preto|o carro preto', 'Vermelho|um carro vermelho|o carro vermelho', 'Azul|um carro azul|o carro azul', 'Cinza|um carro cinza|o carro cinza', 'Verde|um carro verde|o carro verde']) },
      andar(),
      {
        id: 'tempo', nome: 'Tempo no prédio', ordem: true, numerica: true,
        valores: progressao([2, 3, 4], [2, 3]),
        rotulo: (v) => `${v} anos`, x: (v) => `há ${v} anos`,
        pred: 'mora no prédio {x}',
        predMin: 'é quem mora há menos tempo no prédio', npMin: 'mora há menos tempo no prédio',
        predMax: 'é quem mora há mais tempo no prédio', npMax: 'mora há mais tempo no prédio',
        verbo: 'mora no prédio', maior: 'há mais tempo que {B}', menor: 'há menos tempo que {B}',
        difMaior: (k) => `há ${anos(k)} a mais que {B}`, difMenor: (k) => `há ${anos(k)} a menos que {B}`,
        dist: (k) => `{A} e {B} se mudaram para o prédio com ${anos(k)} de diferença`,
        extremo: 'é quem mora há mais tempo ou há menos tempo no prédio',
        meio: 'não é quem mora há mais tempo nem quem mora há menos tempo no prédio',
        relacao: { menor: 'há menos tempo que', maior: 'há mais tempo que', menorK: '{k} a menos que', maiorK: '{k} a mais que', unidade: ['ano', 'anos'], menorCurto: 'menos tempo', maiorCurto: 'mais tempo' },
        intro: 'mora no prédio há um tempo diferente', descubra: 'há quanto tempo mora no prédio',
      },
    ],
  },

  // 3 ─────────────────────────────────────────────────────────────────────
  {
    id: 'festa-junina', ...PESSOAS,
    titulos: ['Arraial da escola', 'Quermesse da paróquia', 'Festa junina da rua', 'Arraiá do bairro'],
    principal: { id: 'voluntario', nome: 'Voluntário(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `No arraial da escola, ${c.n} voluntários se revezaram para ajudar na festa.`,
      (c) => `${c.N} vizinhos se ofereceram para trabalhar nas barracas da festa junina da rua.`,
    ],
    categorias: [
      { id: 'barraca', nome: 'Barraca', pred: 'ficou {x}', intro: 'ficou em uma barraca diferente', descubra: 'a barraca',
        itens: itens(['Pescaria|na barraca de pescaria', 'Argola|na barraca de argola', 'Correio elegante|no correio elegante', 'Boca do palhaço|na boca do palhaço', 'Pipoca|na barraca de pipoca', 'Pamonha|na barraca de pamonha', 'Quentão|na barraca de quentão', 'Cachorro-quente|na barraca de cachorro-quente', 'Maçã do amor|na barraca de maçã do amor']) },
      { id: 'traje', nome: 'Acessório', pred: 'usou {x}', np: (it) => `quem usou ${it.d}`, intro: 'usou um acessório típico diferente', descubra: 'o acessório típico',
        itens: itens(['Chapéu de palha|um chapéu de palha|o chapéu de palha', 'Lenço vermelho|um lenço vermelho|o lenço vermelho', 'Camisa xadrez|uma camisa xadrez|a camisa xadrez', 'Vestido de chita|um vestido de chita|o vestido de chita', 'Bigode pintado|um bigode pintado|o bigode pintado', 'Trança postiça|uma trança postiça|a trança postiça', 'Macacão|um macacão remendado|o macacão remendado']) },
      { id: 'doce', nome: 'Doce preferido', pred: 'adora {x}', intro: 'tem um doce junino preferido diferente', descubra: 'o doce preferido',
        itens: itens(['Paçoca|paçoca', 'Canjica|canjica', 'Pé de moleque|pé de moleque', 'Curau|curau', 'Bolo de milho|bolo de milho', 'Cocada|cocada', 'Pinhão|pinhão']) },
      horario({
        id: 'turno', nome: 'Início do turno', inicios: [15, 16, 17, 18],
        pred: 'começou o turno {x}', verbo: 'começou o turno',
        primeiro: 'foi {o} primeir{o} a começar o turno', npPrimeiro: 'começou o turno primeiro',
        ultimo: 'foi {o} últim{o} a começar o turno', npUltimo: 'começou o turno por último',
        distFrase: (q) => `{A} e {B} começaram seus turnos com ${q} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a começar o turno', meio: 'não foi {o} primeir{o} nem {o} últim{o} a começar o turno',
        intro: 'começou o turno em um horário diferente', descubra: 'o horário de início do turno',
      }),
      {
        id: 'arrecadacao', nome: 'Arrecadação', ordem: true, numerica: true,
        valores: progressao([80, 100, 120, 150], [15, 20, 25, 30]),
        rotulo: (v) => `R$ ${v}`, x: (v) => `R$ ${v}`,
        pred: 'arrecadou {x}',
        predMin: 'foi quem menos arrecadou', npMin: 'menos arrecadou', predMax: 'foi quem mais arrecadou', npMax: 'mais arrecadou',
        verbo: 'arrecadou', maior: 'mais que {B}', menor: 'menos que {B}',
        difMaior: (k) => `${reais(k)} a mais que {B}`, difMenor: (k) => `${reais(k)} a menos que {B}`,
        dist: (k) => `{A} e {B} arrecadaram valores com ${reais(k)} de diferença`,
        extremo: 'foi quem mais ou quem menos arrecadou', meio: 'não foi quem mais nem quem menos arrecadou',
        relacao: R_QTD([], { prefixo: 'R$ ' }), intro: 'arrecadou um valor diferente', descubra: 'quanto arrecadou',
      },
    ],
  },

  // 4 ─────────────────────────────────────────────────────────────────────
  {
    id: 'bolos', ...PESSOAS,
    titulos: ['Concurso de bolos', 'Bolo da vovó', 'Festival de confeitaria', 'Prova dos confeiteiros'],
    principal: { id: 'confeiteiro', nome: 'Confeiteiro(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} confeiteiros amadores participaram do concurso de bolos da padaria do bairro.`,
      (c) => `No festival de confeitaria da cidade, ${c.n} participantes chegaram à final.`,
    ],
    categorias: [
      { id: 'sabor', nome: 'Sabor', pred: 'fez {x}', intro: 'fez um bolo de sabor diferente', descubra: 'o sabor do bolo',
        itens: itens(['Chocolate|o bolo de chocolate', 'Cenoura|o bolo de cenoura', 'Laranja|o bolo de laranja', 'Coco|o bolo de coco', 'Limão|o bolo de limão', 'Milho|o bolo de milho', 'Banana|o bolo de banana', 'Fubá|o bolo de fubá', 'Morango|o bolo de morango', 'Nozes|o bolo de nozes']) },
      { id: 'cobertura', nome: 'Cobertura', pred: 'usou {x}', intro: 'usou uma cobertura diferente', descubra: 'a cobertura',
        itens: itens(['Brigadeiro|cobertura de brigadeiro', 'Chantilly|cobertura de chantilly', 'Ganache|cobertura de ganache', 'Glacê|cobertura de glacê', 'Doce de leite|cobertura de doce de leite', 'Merengue|cobertura de merengue', 'Frutas vermelhas|cobertura de frutas vermelhas']) },
      { id: 'bairro', nome: 'Bairro', pred: 'mora {x}', intro: 'mora em um bairro diferente', descubra: 'o bairro',
        itens: itens(['Lapa|na Lapa', 'Mooca|na Mooca', 'Penha|na Penha', 'Tatuapé|no Tatuapé', 'Butantã|no Butantã', 'Ipiranga|no Ipiranga', 'Pinheiros|em Pinheiros', 'Santana|em Santana', 'Saúde|na Saúde', 'Freguesia|na Freguesia']) },
      { id: 'decoracao', nome: 'Decoração', pred: 'decorou o bolo {x}', intro: 'decorou o bolo de um jeito diferente', descubra: 'a decoração',
        itens: itens(['Flores|com flores de açúcar', 'Confeitos|com confeitos coloridos', 'Morangos|com morangos frescos', 'Raspas|com raspas de chocolate', 'Castanhas|com castanhas', 'Folhas douradas|com folhas douradas']) },
      {
        id: 'nota', nome: 'Nota', ordem: true, numerica: true,
        valores: (n, r) => (r.chance(0.5) ? progressao([6, 6.5, 7], [0.5])(n, r) : progressao([5, 6], [1])(n, r)),
        rotulo: (v) => fmtNum(v), formato: 'nota {}', x: (v) => `nota ${fmtNum(v)}`,
        pred: 'recebeu {x}',
        predMin: 'recebeu a menor nota', npMin: 'recebeu a menor nota', predMax: 'venceu o concurso', npMax: 'venceu o concurso',
        verbo: 'recebeu', maior: 'nota maior que {B}', menor: 'nota menor que {B}',
        difMaior: (k) => `${pontos(k)} a mais que {B}`, difMenor: (k) => `${pontos(k)} a menos que {B}`,
        dist: (k) => `as notas de {A} e de {B} tiveram ${pontos(k)} de diferença`,
        extremo: 'recebeu a maior ou a menor nota', meio: 'não recebeu nem a maior nem a menor nota',
        relacao: { menor: 'nota menor que', maior: 'nota maior que', menorK: '{k} a menos que', maiorK: '{k} a mais que', unidade: ['ponto', 'pontos'], menorCurto: 'menor', maiorCurto: 'maior' },
        intro: 'recebeu uma nota diferente dos jurados', descubra: 'a nota',
      },
      {
        id: 'forno', nome: 'Tempo de forno', ordem: true, numerica: true,
        valores: progressao([25, 30, 35], [5]),
        rotulo: (v) => `${v} min`, x: (v) => `${v} minutos`,
        pred: 'deixou o bolo {x} no forno',
        predMin: 'foi quem deixou o bolo menos tempo no forno', npMin: 'deixou o bolo menos tempo no forno',
        predMax: 'foi quem deixou o bolo mais tempo no forno', npMax: 'deixou o bolo mais tempo no forno',
        verbo: 'deixou o bolo', maior: 'mais tempo no forno que {B}', menor: 'menos tempo no forno que {B}',
        difMaior: (k) => `${k} minutos a mais no forno que {B}`, difMenor: (k) => `${k} minutos a menos no forno que {B}`,
        dist: (k) => `{A} e {B} deixaram seus bolos no forno com ${k} minutos de diferença`,
        extremo: 'foi quem deixou o bolo mais tempo ou menos tempo no forno',
        meio: 'não foi quem deixou o bolo mais tempo nem quem deixou menos tempo no forno',
        relacao: R_QTD(['minuto', 'minutos']), intro: 'deixou o bolo no forno por um tempo diferente', descubra: 'o tempo de forno',
      },
    ],
  },

  // 5 ─────────────────────────────────────────────────────────────────────
  {
    id: 'viagem', ...PESSOAS,
    titulos: ['Férias de verão', 'Pé na estrada', 'Mochileiros', 'Destinos de férias'],
    principal: { id: 'viajante', nome: 'Viajante', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} colegas de trabalho voltaram das férias cheios de histórias para contar.`,
      (c) => `Na volta das férias, ${c.n} amigos de faculdade se reuniram para trocar fotos das viagens.`,
    ],
    categorias: [
      { id: 'destino', nome: 'Destino', pred: 'viajou {x}', intro: 'viajou para um destino diferente', descubra: 'o destino',
        itens: itens(['Gramado|para Gramado', 'Bonito|para Bonito', 'Paraty|para Paraty', 'Olinda|para Olinda', 'Ouro Preto|para Ouro Preto', 'Jericoacoara|para Jericoacoara', 'Pirenópolis|para Pirenópolis', 'Ilhabela|para Ilhabela', 'Lençóis|para Lençóis', 'Maragogi|para Maragogi']) },
      { id: 'transporte', nome: 'Transporte', pred: 'foi {x}', intro: 'usou um meio de transporte diferente', descubra: 'o meio de transporte',
        itens: itens(['Avião|de avião', 'Ônibus|de ônibus', 'Carro|de carro', 'Moto|de moto', 'Van|de van', 'Trem|de trem']) },
      { id: 'companhia', nome: 'Companhia', pred: 'levou {x}', intro: 'viajou com uma companhia diferente', descubra: 'a companhia',
        itens: itens(['Irmã|a irmã', 'Pais|os pais', 'Amigos|os amigos', 'Primos|os primos', 'Avó|a avó', 'Cachorro|o cachorro', 'Sobrinhos|os sobrinhos']) },
      { id: 'hospedagem', nome: 'Hospedagem', pred: 'ficou {x}', intro: 'ficou em um tipo de hospedagem diferente', descubra: 'a hospedagem',
        itens: itens(['Hotel|num hotel', 'Pousada|numa pousada', 'Camping|num camping', 'Hostel|num hostel', 'Casa alugada|numa casa alugada', 'Casa de amigos|na casa de amigos']) },
      mes({
        pred: 'tirou férias {x}', verbo: 'tirou férias',
        primeiro: 'foi {o} primeir{o} a tirar férias', npPrimeiro: 'tirou férias primeiro',
        ultimo: 'foi {o} últim{o} a tirar férias', npUltimo: 'tirou férias por último',
        seguidos: '{A} e {B} tiraram férias em meses seguidos', distFrase: (q) => `{A} e {B} tiraram férias com ${q} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a tirar férias', meio: 'não foi {o} primeir{o} nem {o} últim{o} a tirar férias',
        intro: 'tirou férias em um mês diferente', descubra: 'o mês das férias',
      }),
      {
        id: 'dias', nome: 'Duração', ordem: true, numerica: true,
        valores: progressao([4, 5, 6], [2, 3]),
        rotulo: (v) => `${v} dias`, x: (v) => `${v} dias`,
        pred: 'passou {x} fora',
        predMin: 'foi quem passou menos dias fora', npMin: 'passou menos dias fora',
        predMax: 'foi quem passou mais dias fora', npMax: 'passou mais dias fora',
        verbo: 'passou', maior: 'mais dias fora que {B}', menor: 'menos dias fora que {B}',
        difMaior: (k) => `${dias(k)} a mais fora que {B}`, difMenor: (k) => `${dias(k)} a menos fora que {B}`,
        dist: (k) => `as viagens de {A} e de {B} tiveram ${dias(k)} de diferença`,
        extremo: 'foi quem passou mais dias fora ou quem passou menos dias fora', meio: 'não foi quem passou mais dias fora nem quem passou menos',
        relacao: R_QTD(['dia', 'dias']), intro: 'passou um número diferente de dias fora', descubra: 'quantos dias passou fora',
      },
    ],
  },

  // 6 ─────────────────────────────────────────────────────────────────────
  {
    id: 'futebol',
    que: { t: 'o time que', g: 'm' }, ser: 'era', entidade: { plural: 'times', g: 'm' }, cadaUm: 'Cada time', paraCada: 'para cada time',
    titulos: ['Copa do bairro', 'Torneio de várzea', 'Campeonato de society', 'Taça da amizade'],
    principal: {
      id: 'time', nome: 'Time', tipo: 'lista',
      itens: ['União', 'Esperança', 'Juventude', 'Primavera', 'Aurora', 'Ipiranga', 'Estrela', 'Vila Nova', 'Bela Vista', 'Santa Cruz'].map((r) => ({ r, x: `o ${r}`, g: 'm' })),
    },
    cenarios: [
      (c) => `${c.N} times amadores disputaram o torneio de futebol do bairro neste fim de semana.`,
      (c) => `A tradicional copa de várzea da cidade teve ${c.n} times inscritos este ano.`,
    ],
    categorias: [
      { id: 'uniforme', nome: 'Uniforme', pred: 'jogou {x}', intro: 'jogou com um uniforme de cor diferente', descubra: 'a cor do uniforme',
        itens: itens(['Azul|de azul', 'Vermelho|de vermelho', 'Verde|de verde', 'Amarelo|de amarelo', 'Branco|de branco', 'Preto|de preto', 'Laranja|de laranja', 'Grená|de grená']) },
      { id: 'capitao', nome: 'Capitão(ã)', tipo: 'nomes', pred: 'foi comandado em campo {x}', xNome: (n) => `por ${n}`, np: (it) => `o time de ${it.r}`,
        intro: 'tinha um capitão diferente', descubra: 'quem comandou o time em campo' },
      { id: 'bairro', nome: 'Bairro', pred: 'representa {x}', np: (it) => `o time ${it.d}`, intro: 'representa um bairro diferente', descubra: 'o bairro que representa',
        itens: itens(['Lapa|a Lapa|da Lapa', 'Mooca|a Mooca|da Mooca', 'Penha|a Penha|da Penha', 'Tatuapé|o Tatuapé|do Tatuapé', 'Butantã|o Butantã|do Butantã', 'Ipiranga|o Ipiranga|do Ipiranga', 'Pinheiros|Pinheiros|de Pinheiros', 'Santana|Santana|de Santana']) },
      {
        id: 'gols', nome: 'Gols', ordem: true, numerica: true,
        valores: amostra([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
        rotulo: (v) => (v === 1 ? '1 gol' : `${v} gols`), x: (v) => (v === 1 ? 'um gol' : `${v} gols`),
        pred: 'marcou {x}',
        predMin: 'foi o time que menos marcou gols', npMin: 'menos marcou gols', predMax: 'foi o time que mais marcou gols', npMax: 'mais marcou gols',
        verbo: 'marcou', maior: 'mais gols que {B}', menor: 'menos gols que {B}',
        difMaior: (k) => (k === 1 ? 'um gol a mais que {B}' : `${qtd(k, 'gol', 'gols')} a mais que {B}`),
        difMenor: (k) => (k === 1 ? 'um gol a menos que {B}' : `${qtd(k, 'gol', 'gols')} a menos que {B}`),
        dist: (k) => `a diferença entre os gols de {A} e os de {B} foi de ${extenso(k)}`,
        extremo: 'foi o time que mais ou que menos marcou gols', meio: 'não foi nem o time que mais marcou gols nem o que menos marcou',
        relacao: R_QTD(['gol', 'gols']), intro: 'marcou um número diferente de gols', descubra: 'quantos gols marcou',
      },
      colocacao({ verbo: 'terminou', venceu: 'foi o campeão', plural: 'terminaram', intro: 'terminou em uma posição diferente' }),
    ],
  },

  // 7 ─────────────────────────────────────────────────────────────────────
  {
    id: 'cinema', ...PESSOAS,
    titulos: ['Sessão de cinema', 'Noite de estreia', 'Festival de cinema', 'Cinema de rua'],
    principal: { id: 'espectador', nome: 'Espectador(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} amigos combinaram de ir ao cinema no sábado, mas cada um acabou escolhendo um filme diferente.`,
      (c) => `No festival de cinema da cidade, ${c.n} vizinhos foram assistir a filmes no mesmo dia.`,
    ],
    categorias: [
      { id: 'filme', nome: 'Gênero', pred: 'viu {x}', intro: 'viu um filme de gênero diferente', descubra: 'o gênero do filme',
        itens: itens(['Comédia|a comédia', 'Drama|o drama', 'Terror|o filme de terror', 'Animação|a animação', 'Ficção científica|a ficção científica', 'Suspense|o suspense', 'Romance|o romance', 'Documentário|o documentário', 'Aventura|o filme de aventura', 'Musical|o musical']) },
      { id: 'lanche', nome: 'Lanche', pred: 'comprou {x}', intro: 'comprou um lanche diferente', descubra: 'o lanche',
        itens: itens(['Pipoca doce|pipoca doce', 'Pipoca salgada|pipoca salgada', 'Nachos|nachos', 'Chocolate|chocolate', 'Cachorro-quente|cachorro-quente', 'Sorvete|sorvete', 'Balas|balas']) },
      { id: 'bebida', nome: 'Bebida', pred: 'tomou {x}', intro: 'tomou uma bebida diferente', descubra: 'a bebida',
        itens: itens(['Refrigerante|refrigerante', 'Suco|suco', 'Água|água', 'Chá gelado|chá gelado', 'Milk-shake|milk-shake', 'Café|café']) },
      horario({
        id: 'sessao', nome: 'Sessão', inicios: [13, 14, 15], passo: 2, xPrefixo: 'das',
        pred: 'foi à sessão {x}', verbo: 'foi',
        primeiro: 'foi à primeira sessão', npPrimeiro: 'foi à primeira sessão',
        ultimo: 'foi à última sessão', npUltimo: 'foi à última sessão',
        maior: 'a uma sessão mais tarde que {B}', menor: 'a uma sessão mais cedo que {B}',
        difMaior: (k) => (k === 2 ? 'à sessão seguinte à de {B}' : `a uma sessão ${horas(k)} depois da de {B}`),
        difMenor: (k) => (k === 2 ? 'à sessão anterior à de {B}' : `a uma sessão ${horas(k)} antes da de {B}`),
        seguidos: '{A} e {B} foram a sessões seguidas', distFrase: (q) => `{A} e {B} foram a sessões com ${q} de diferença`,
        extremo: 'foi à primeira ou à última sessão', meio: 'não foi nem à primeira nem à última sessão',
        intro: 'foi a uma sessão diferente', descubra: 'o horário da sessão',
      }),
      {
        id: 'fila', nome: 'Fila', ordem: true, numerica: false,
        valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
        rotulo: (v) => `Fila ${'ABCDEFG'[v - 1]}`, x: (v) => `na fila ${'ABCDEFG'[v - 1]}`,
        pred: 'sentou {x}',
        predMin: 'sentou na primeira fila', npMin: 'sentou na primeira fila', predMax: 'sentou na última fila', npMax: 'sentou na última fila',
        verbo: 'sentou', maior: 'mais atrás que {B}', menor: 'mais à frente que {B}',
        difMaior: (k) => (k === 1 ? 'na fila logo atrás da de {B}' : `${filas(k)} atrás de {B}`),
        difMenor: (k) => (k === 1 ? 'na fila logo à frente da de {B}' : `${filas(k)} à frente de {B}`),
        dist: (k) => (k === 1 ? '{A} e {B} sentaram em filas vizinhas' : `{A} e {B} sentaram com ${filas(k)} de distância`),
        extremo: 'sentou na primeira ou na última fila', meio: 'não sentou nem na primeira nem na última fila',
        relacao: { menor: 'à frente de', maior: 'atrás de', menorK: '{k} à frente de', maiorK: '{k} atrás de', unidade: ['fila', 'filas'], menorCurto: 'à frente', maiorCurto: 'atrás' },
        intro: 'sentou em uma fila diferente', descubra: 'a fila em que sentou',
      },
      {
        id: 'nota', nome: 'Nota', ordem: true, numerica: true,
        valores: consecutivos([5, 6]),
        rotulo: (v) => String(v), formato: 'nota {}', x: (v) => `nota ${v}`,
        pred: 'deu {x} ao filme',
        predMin: 'deu a menor nota', npMin: 'deu a menor nota', predMax: 'deu a maior nota', npMax: 'deu a maior nota',
        verbo: 'deu ao filme', maior: 'uma nota maior que {B}', menor: 'uma nota menor que {B}',
        difMaior: (k) => `${pontos(k)} a mais que {B}`, difMenor: (k) => `${pontos(k)} a menos que {B}`,
        dist: (k) => `as notas de {A} e de {B} tiveram ${pontos(k)} de diferença`,
        extremo: 'deu a maior ou a menor nota', meio: 'não deu nem a maior nem a menor nota',
        relacao: { menor: 'nota menor que', maior: 'nota maior que', menorK: '{k} a menos que', maiorK: '{k} a mais que', unidade: ['ponto', 'pontos'], menorCurto: 'menor', maiorCurto: 'maior' },
        intro: 'deu uma nota diferente ao filme que viu', descubra: 'a nota que deu ao filme',
      },
    ],
  },

  // 8 ─────────────────────────────────────────────────────────────────────
  {
    id: 'plantao', ...PRESENTE,
    titulos: ['Escala de plantão', 'Residência médica', 'Corredores do hospital', 'Sala dos residentes'],
    principal: { id: 'residente', nome: 'Residente', tipo: 'pessoas' },
    cenarios: [
      (c) => `No Hospital Santa Clara, ${c.n} residentes dividem a escala de plantões da semana.`,
      (c) => `${c.N} residentes do mesmo hospital costumam se encontrar na copa entre um atendimento e outro.`,
    ],
    categorias: [
      { id: 'especialidade', nome: 'Especialidade', pred: 'é residente {x}', intro: 'faz residência em uma especialidade diferente', descubra: 'a especialidade',
        itens: itens(['Cardiologia|de cardiologia', 'Pediatria|de pediatria', 'Ortopedia|de ortopedia', 'Neurologia|de neurologia', 'Dermatologia|de dermatologia', 'Mastologia|de mastologia', 'Oftalmologia|de oftalmologia', 'Geriatria|de geriatria', 'Infectologia|de infectologia']) },
      { id: 'bebida', nome: 'Bebida', pred: 'toma {x} no intervalo', intro: 'toma uma bebida diferente no intervalo', descubra: 'a bebida do intervalo',
        itens: itens(['Café|café', 'Chá|chá', 'Chocolate quente|chocolate quente', 'Suco|suco de laranja', 'Cappuccino|cappuccino', 'Água de coco|água de coco', 'Mate|mate']) },
      { id: 'hobby', nome: 'Passatempo', pred: 'gosta {x} nas folgas', intro: 'tem um passatempo diferente nas folgas', descubra: 'o passatempo',
        itens: itens(['Pedalar|de pedalar', 'Nadar|de nadar', 'Cozinhar|de cozinhar', 'Ler|de ler', 'Pintar|de pintar', 'Dançar|de dançar', 'Plantas|de cuidar das plantas']) },
      diaSemana({
        pred: 'dá plantão {x}', verbo: 'dá plantão',
        primeiro: 'dá o primeiro plantão da semana', npPrimeiro: 'dá o primeiro plantão da semana',
        ultimo: 'dá o último plantão da semana', npUltimo: 'dá o último plantão da semana',
        vespera: 'na véspera do plantão de {B}',
        seguidos: '{A} e {B} dão plantão em dias seguidos', distFrase: (q) => `os plantões de {A} e de {B} têm ${q} de diferença`,
        extremo: 'dá o primeiro ou o último plantão da semana', meio: 'não dá nem o primeiro nem o último plantão da semana',
        intro: 'dá plantão em um dia diferente', descubra: 'o dia do plantão',
      }),
      andar({ verbo: 'atende', plural: 'atendem', intro: 'atende em um andar diferente', descubra: 'o andar onde atende' }),
    ],
  },

  // 9 ─────────────────────────────────────────────────────────────────────
  {
    id: 'artesanato', ...PRESENTE,
    titulos: ['Feira de artesanato', 'Mãos que criam', 'Arte na praça', 'Bazar dos artesãos'],
    principal: { id: 'artesao', nome: 'Artesão(ã)', tipo: 'pessoas' },
    cenarios: [
      (c) => `Na feira de artesanato da praça, ${c.n} artesãos montaram suas bancas lado a lado.`,
      (c) => `${c.N} artesãos de cidades diferentes foram convidados para a feira de inverno do centro cultural.`,
    ],
    categorias: [
      { id: 'peca', nome: 'Peças', pred: 'vende {x}', intro: 'vende um tipo de peça diferente', descubra: 'o que vende',
        itens: itens(['Vasos|vasos', 'Colares|colares', 'Tapetes|tapetes', 'Quadros|quadros', 'Cestos|cestos', 'Bolsas|bolsas', 'Luminárias|luminárias', 'Bonecas|bonecas de pano', 'Velas|velas aromáticas']) },
      { id: 'material', nome: 'Material', pred: 'trabalha {x}', intro: 'trabalha com um material diferente', descubra: 'o material',
        itens: itens(['Madeira|com madeira', 'Cerâmica|com cerâmica', 'Palha|com palha', 'Couro|com couro', 'Vidro|com vidro', 'Tecido|com tecido', 'Metal|com metal', 'Papel|com papel reciclado']) },
      { id: 'cidade', nome: 'Cidade', pred: 'veio {x}', intro: 'veio de uma cidade diferente', descubra: 'a cidade de origem',
        itens: itens(['Tiradentes|de Tiradentes', 'Embu|de Embu', 'Caruaru|de Caruaru', 'Cunha|de Cunha', 'Olinda|de Olinda', 'Penedo|de Penedo', 'Bichinho|de Bichinho', 'Paraty|de Paraty']) },
      {
        id: 'banca', nome: 'Banca', ordem: true, numerica: false,
        valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
        rotulo: (v) => `Banca ${v}`, x: (v) => `na banca ${v}`,
        pred: 'ficou {x}',
        predMin: 'ficou na primeira banca', npMin: 'ficou na primeira banca', predMax: 'ficou na última banca', npMax: 'ficou na última banca',
        verbo: 'ficou', maior: 'mais longe da entrada que {B}', menor: 'mais perto da entrada que {B}',
        difMaior: (k) => (k === 1 ? 'na banca logo depois da de {B}' : `${qtd(k, 'banca', 'bancas', 'f')} depois de {B}`),
        difMenor: (k) => (k === 1 ? 'na banca logo antes da de {B}' : `${qtd(k, 'banca', 'bancas', 'f')} antes de {B}`),
        dist: (k) => (k === 1 ? '{A} e {B} ficaram em bancas vizinhas' : `entre as bancas de {A} e de {B} havia ${outras(k - 1, 'outra banca', 'outras bancas', 'f')}`),
        extremo: 'ficou na primeira ou na última banca', meio: 'não ficou nem na primeira nem na última banca',
        relacao: { menor: 'antes de', maior: 'depois de', menorK: '{k} antes de', maiorK: '{k} depois de', unidade: ['banca', 'bancas'], menorCurto: 'antes', maiorCurto: 'depois' },
        intro: 'ficou em uma banca diferente', descubra: 'a banca',
      },
      {
        id: 'preco', nome: 'Preço', ordem: true, numerica: true,
        valores: progressao([20, 25, 30, 40], [5, 10, 15]),
        rotulo: (v) => `R$ ${v}`, x: (v) => `R$ ${v}`,
        pred: 'cobra {x} por peça',
        predMin: 'cobra o preço mais baixo', npMin: 'cobra o preço mais baixo', predMax: 'cobra o preço mais alto', npMax: 'cobra o preço mais alto',
        verbo: 'cobra', maior: 'mais caro que {B}', menor: 'mais barato que {B}',
        difMaior: (k) => `${reais(k)} a mais que {B}`, difMenor: (k) => `${reais(k)} a menos que {B}`,
        dist: (k) => `os preços de {A} e de {B} têm ${reais(k)} de diferença`,
        extremo: 'cobra o preço mais alto ou o mais baixo', meio: 'não cobra nem o preço mais alto nem o mais baixo',
        relacao: R_REAIS, intro: 'cobra um preço diferente por peça', descubra: 'o preço por peça',
      },
    ],
  },

  // 10 ────────────────────────────────────────────────────────────────────
  {
    id: 'pescaria', ...PESSOAS,
    titulos: ['Domingo no pesqueiro', 'Torneio de pesca', 'Pescaria no lago', 'Beira do rio'],
    principal: { id: 'pescador', nome: 'Pescador(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} amigos passaram o domingo num pesqueiro e, no fim do dia, cada um voltou com um único peixe.`,
      (c) => `No torneio de pesca do clube, ${c.n} participantes fisgaram um peixe cada.`,
    ],
    categorias: [
      { id: 'peixe', nome: 'Peixe', pred: 'pescou {x}', np: (it) => `quem pescou ${it.d}`, intro: 'pescou um peixe de espécie diferente', descubra: 'o peixe',
        itens: itens(['Tilápia|uma tilápia|a tilápia', 'Pacu|um pacu|o pacu', 'Dourado|um dourado|o dourado', 'Traíra|uma traíra|a traíra', 'Tucunaré|um tucunaré|o tucunaré', 'Pintado|um pintado|o pintado', 'Tambaqui|um tambaqui|o tambaqui', 'Carpa|uma carpa|a carpa', 'Piau|um piau|o piau']) },
      { id: 'isca', nome: 'Isca', pred: 'usou {x} como isca', intro: 'usou uma isca diferente', descubra: 'a isca',
        itens: itens(['Minhoca|minhoca', 'Milho|milho', 'Massa|massa', 'Camarão|camarão', 'Ração|ração', 'Salsicha|salsicha', 'Queijo|queijo']) },
      { id: 'local', nome: 'Ponto', pred: 'ficou {x}', intro: 'pescou em um ponto diferente', descubra: 'o ponto de pesca',
        itens: itens(['Ponte|na ponte', 'Deque|no deque', 'Barco|no barco', 'Margem|na margem', 'Píer|no píer', 'Pedras|nas pedras', 'Prainha|na prainha']) },
      {
        id: 'peso', nome: 'Peso', ordem: true, numerica: true,
        valores: progressao([0.8, 1, 1.2, 1.5], [0.3, 0.4, 0.5]),
        rotulo: (v) => `${fmtNum(v)} kg`, x: (v) => `${fmtNum(v)} kg`,
        pred: 'fisgou um peixe de {x}',
        predMin: 'fisgou o peixe mais leve', npMin: 'fisgou o peixe mais leve', predMax: 'fisgou o peixe mais pesado', npMax: 'fisgou o peixe mais pesado',
        verbo: 'fisgou', maior: 'um peixe mais pesado que o de {B}', menor: 'um peixe mais leve que o de {B}',
        difMaior: (k) => `um peixe ${kg(k)} mais pesado que o de {B}`, difMenor: (k) => `um peixe ${kg(k)} mais leve que o de {B}`,
        dist: (k) => `os peixes de {A} e de {B} tinham ${kg(k)} de diferença`,
        extremo: 'fisgou o peixe mais pesado ou o mais leve', meio: 'não fisgou nem o peixe mais pesado nem o mais leve',
        relacao: { menor: 'mais leve que', maior: 'mais pesado que', menorK: '{k} mais leve que', maiorK: '{k} mais pesado que', unidade: ['kg', 'kg'], menorCurto: 'mais leve', maiorCurto: 'mais pesado' },
        intro: 'fisgou um peixe de peso diferente', descubra: 'o peso do peixe',
      },
      horario({
        inicios: [5, 6, 7], pred: 'chegou ao pesqueiro {x}', verbo: 'chegou ao pesqueiro',
        primeiro: 'foi {o} primeir{o} a chegar ao pesqueiro', npPrimeiro: 'chegou primeiro ao pesqueiro',
        ultimo: 'foi {o} últim{o} a chegar ao pesqueiro', npUltimo: 'chegou por último ao pesqueiro',
        distFrase: (q) => `{A} e {B} chegaram ao pesqueiro com ${q} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a chegar ao pesqueiro', meio: 'não foi {o} primeir{o} nem {o} últim{o} a chegar ao pesqueiro',
        intro: 'chegou ao pesqueiro em um horário diferente', descubra: 'o horário de chegada',
      }),
    ],
  },

  // 11 ────────────────────────────────────────────────────────────────────
  {
    id: 'livros', ...PESSOAS,
    titulos: ['Leituras do ano', 'Estante compartilhada', 'Maratona literária', 'Troca de livros'],
    principal: { id: 'leitor', nome: 'Leitor(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `No clube de leitura do bairro, cada participante escolhe a leitura de um mês. Este ano, ${c.n} participantes fizeram suas indicações.`,
      (c) => `${c.N} amigos que adoram ler resolveram indicar um livro cada um para o grupo.`,
    ],
    categorias: [
      { id: 'genero', nome: 'Gênero', pred: 'indicou {x}', np: (it) => `quem indicou ${it.d}`, intro: 'indicou um livro de gênero diferente', descubra: 'o gênero do livro',
        itens: itens(['Romance|um romance|o romance', 'Biografia|uma biografia|a biografia', 'Poesia|um livro de poesia|o livro de poesia', 'Fantasia|um livro de fantasia|o livro de fantasia', 'Suspense|um suspense|o suspense', 'Ficção científica|uma ficção científica|a ficção científica', 'Crônicas|um livro de crônicas|o livro de crônicas', 'Policial|um romance policial|o romance policial', 'Contos|um livro de contos|o livro de contos', 'Humor|um livro de humor|o livro de humor']) },
      { id: 'edicao', nome: 'Edição', pred: 'leu uma edição {x}', intro: 'leu uma edição de tipo diferente', descubra: 'o tipo de edição',
        itens: itens(['De bolso|de bolso', 'Capa dura|de capa dura', 'Digital|digital', 'Ilustrada|ilustrada', 'Usada|usada', 'Autografada|autografada']) },
      { id: 'lugar', nome: 'Onde lê', pred: 'costuma ler {x}', intro: 'costuma ler em um lugar diferente', descubra: 'onde costuma ler',
        itens: itens(['Rede|na rede', 'Ônibus|no ônibus', 'Cama|na cama', 'Parque|no parque', 'Café|no café', 'Varanda|na varanda', 'Biblioteca|na biblioteca']) },
      mes({
        pred: 'fez a indicação {x}', xPrefixo: 'de', verbo: 'fez sua indicação',
        primeiro: 'foi {o} primeir{o} a fazer a indicação', npPrimeiro: 'fez a primeira indicação',
        ultimo: 'foi {o} últim{o} a fazer a indicação', npUltimo: 'fez a última indicação',
        seguidos: '{A} e {B} fizeram suas indicações em meses seguidos', distFrase: (q) => `as indicações de {A} e de {B} tiveram ${q} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a fazer a indicação', meio: 'não foi {o} primeir{o} nem {o} últim{o} a fazer a indicação',
        intro: 'escolheu a leitura de um mês diferente', descubra: 'o mês da indicação',
      }),
      {
        id: 'paginas', nome: 'Páginas', ordem: true, numerica: true,
        valores: progressao([120, 150, 180, 200, 240], [40, 50, 60, 80]),
        rotulo: (v) => String(v), formato: '{} páginas', x: (v) => `um livro de ${v} páginas`, d: (v) => `o livro de ${v} páginas`,
        pred: 'indicou {x}', np: (it) => `quem indicou ${it.d}`,
        predMin: 'indicou o livro mais curto', npMin: 'indicou o livro mais curto', predMax: 'indicou o livro mais longo', npMax: 'indicou o livro mais longo',
        verbo: 'indicou', maior: 'um livro mais longo que o de {B}', menor: 'um livro mais curto que o de {B}',
        difMaior: (k) => `um livro com ${k} páginas a mais que o de {B}`, difMenor: (k) => `um livro com ${k} páginas a menos que o de {B}`,
        dist: (k) => `os livros de {A} e de {B} têm ${k} páginas de diferença`,
        extremo: 'indicou o livro mais longo ou o mais curto', meio: 'não indicou nem o livro mais longo nem o mais curto',
        relacao: { menor: 'menos páginas que', maior: 'mais páginas que', menorK: '{k} a menos que', maiorK: '{k} a mais que', unidade: ['página', 'páginas'], menorCurto: 'menos', maiorCurto: 'mais' },
        intro: 'indicou um livro com um número diferente de páginas', descubra: 'o número de páginas do livro',
      },
    ],
  },

  // 12 ────────────────────────────────────────────────────────────────────
  {
    id: 'academia', ...PRESENTE,
    titulos: ['Rotina de treinos', 'Academia do bairro', 'Vida saudável', 'Hora do treino'],
    principal: { id: 'aluno', nome: 'Aluno(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} amigos se matricularam juntos numa academia, mas acabaram criando rotinas bem diferentes.`,
      (c) => `Na academia do bairro, ${c.n} alunos se conheceram durante a semana de aulas experimentais.`,
    ],
    categorias: [
      { id: 'modalidade', nome: 'Modalidade', pred: 'faz {x}', intro: 'faz uma modalidade diferente', descubra: 'a modalidade',
        itens: itens(['Pilates|pilates', 'Natação|natação', 'Musculação|musculação', 'Spinning|spinning', 'Ioga|ioga', 'Funcional|treino funcional', 'Boxe|boxe', 'Hidroginástica|hidroginástica', 'Zumba|zumba']) },
      { id: 'professor', nome: 'Professor(a)', tipo: 'nomes', pred: 'treina {x}', xNome: (n) => `com ${n}`, np: (it) => `quem treina com ${it.r}`,
        intro: 'tem um professor diferente', descubra: 'quem é o professor' },
      { id: 'objetivo', nome: 'Objetivo', pred: 'treina {x}', intro: 'tem um objetivo diferente', descubra: 'o objetivo',
        itens: itens(['Força|para ganhar força', 'Peso|para perder peso', 'Postura|para melhorar a postura', 'Fôlego|para ganhar fôlego', 'Estresse|para aliviar o estresse', 'Flexibilidade|para ganhar flexibilidade', 'Lesão|para se recuperar de uma lesão']) },
      horario({
        inicios: [6, 7, 17, 18], pred: 'treina {x}', verbo: 'treina',
        primeiro: 'é quem treina mais cedo', npPrimeiro: 'treina mais cedo',
        ultimo: 'é quem treina mais tarde', npUltimo: 'treina mais tarde',
        maior: 'mais tarde que {B}', menor: 'mais cedo que {B}',
        distFrase: (q) => `{A} e {B} treinam com ${q} de diferença`,
        extremo: 'é quem treina mais cedo ou quem treina mais tarde', meio: 'não é quem treina mais cedo nem quem treina mais tarde',
        relacao: { menor: 'mais cedo que', maior: 'mais tarde que', menorK: '{k} antes de', maiorK: '{k} depois de', unidade: ['hora', 'horas'], menorCurto: 'mais cedo', maiorCurto: 'mais tarde' },
        intro: 'treina em um horário diferente', descubra: 'o horário do treino',
      }),
      {
        id: 'frequencia', nome: 'Frequência', ordem: true, numerica: true, usos: ['gt', 'dif', 'extremo', 'meio'],
        valores: consecutivos([1, 2]),
        rotulo: (v) => (v === 1 ? '1 vez' : `${v} vezes`), formato: '{} por semana',
        x: (v) => `${extenso(v, 'f')} ${v === 1 ? 'vez' : 'vezes'} por semana`,
        pred: 'vai à academia {x}',
        predMin: 'é quem vai menos vezes à academia', npMin: 'vai menos vezes à academia',
        predMax: 'é quem vai mais vezes à academia', npMax: 'vai mais vezes à academia',
        verbo: 'vai à academia', maior: 'mais vezes por semana que {B}', menor: 'menos vezes por semana que {B}',
        difMaior: (k) => `${extenso(k, 'f')} ${k === 1 ? 'vez' : 'vezes'} a mais por semana que {B}`,
        difMenor: (k) => `${extenso(k, 'f')} ${k === 1 ? 'vez' : 'vezes'} a menos por semana que {B}`,
        extremo: 'é quem vai mais vezes ou quem vai menos vezes à academia', meio: 'não é quem vai mais vezes nem quem vai menos vezes à academia',
        relacao: R_QTD(['vez', 'vezes']), intro: 'vai à academia um número diferente de vezes por semana', descubra: 'quantas vezes por semana vai à academia',
      },
    ],
  },

  // 13 ────────────────────────────────────────────────────────────────────
  {
    id: 'aeroporto', ...PESSOAS,
    titulos: ['Saguão do aeroporto', 'Embarque imediato', 'Voos da manhã', 'Portão de embarque'],
    principal: { id: 'passageiro', nome: 'Passageiro(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `Numa sexta-feira de manhã, ${c.n} passageiros que se conheceram na fila do café embarcaram em voos diferentes.`,
      (c) => `${c.N} amigos de infância se reencontraram por acaso no saguão do aeroporto, cada um a caminho de um lugar.`,
    ],
    categorias: [
      { id: 'destino', nome: 'Destino', pred: 'embarcou {x}', intro: 'embarcou para um destino diferente', descubra: 'o destino',
        itens: itens(['Lisboa|para Lisboa', 'Santiago|para Santiago', 'Lima|para Lima', 'Bogotá|para Bogotá', 'Cancún|para Cancún', 'Madri|para Madri', 'Roma|para Roma', 'Montevidéu|para Montevidéu', 'Buenos Aires|para Buenos Aires']) },
      { id: 'mala', nome: 'Mala', pred: 'despachou {x}', np: (it) => `quem despachou ${it.d}`, intro: 'despachou uma mala de cor diferente', descubra: 'a cor da mala',
        itens: itens(['Azul|uma mala azul|a mala azul', 'Vermelha|uma mala vermelha|a mala vermelha', 'Verde|uma mala verde|a mala verde', 'Amarela|uma mala amarela|a mala amarela', 'Preta|uma mala preta|a mala preta', 'Prata|uma mala prata|a mala prata', 'Rosa|uma mala rosa|a mala rosa', 'Laranja|uma mala laranja|a mala laranja']) },
      { id: 'motivo', nome: 'Motivo', pred: 'viajou {x}', intro: 'viajou por um motivo diferente', descubra: 'o motivo da viagem',
        itens: itens(['Trabalho|a trabalho', 'Passeio|a passeio', 'Congresso|para um congresso', 'Casamento|para um casamento', 'Estudos|para estudar', 'Família|para visitar a família', 'Show|para ver um show']) },
      horario({
        inicios: [6, 7, 8], pred: 'partiu {x}', verbo: 'partiu',
        primeiro: 'foi {o} primeir{o} a partir', npPrimeiro: 'partiu primeiro',
        ultimo: 'foi {o} últim{o} a partir', npUltimo: 'partiu por último',
        distFrase: (q) => `{A} e {B} partiram com ${q} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a partir', meio: 'não foi {o} primeir{o} nem {o} últim{o} a partir',
        intro: 'partiu em um horário diferente', descubra: 'o horário do voo',
      }),
      {
        id: 'portao', nome: 'Portão', ordem: true, numerica: false, usos: ['gt', 'extremo', 'meio'],
        valores: amostra([2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19, 21]),
        rotulo: (v) => `Portão ${v}`, x: (v) => `pelo portão ${v}`,
        pred: 'embarcou {x}',
        predMin: 'embarcou pelo portão de número mais baixo', npMin: 'embarcou pelo portão de número mais baixo',
        predMax: 'embarcou pelo portão de número mais alto', npMax: 'embarcou pelo portão de número mais alto',
        verbo: 'embarcou', maior: 'por um portão de número maior que o de {B}', menor: 'por um portão de número menor que o de {B}',
        extremo: 'embarcou pelo portão de número mais alto ou mais baixo', meio: 'não embarcou nem pelo portão de número mais alto nem pelo de número mais baixo',
        relacao: { menor: 'menor que', maior: 'maior que', menorCurto: 'menor', maiorCurto: 'maior', exata: false },
        intro: 'embarcou por um portão diferente', descubra: 'o portão de embarque',
      },
    ],
  },

  // 14 ────────────────────────────────────────────────────────────────────
  {
    id: 'gincana',
    que: { t: 'a equipe que', g: 'f' }, ser: 'era', entidade: { plural: 'equipes', g: 'f' }, cadaUm: 'Cada equipe', paraCada: 'para cada equipe',
    titulos: ['Gincana da escola', 'Olimpíada da primavera', 'Gincana beneficente', 'Jogos de inverno'],
    principal: {
      id: 'equipe', nome: 'Equipe', tipo: 'lista',
      itens: ['Onça', 'Tucano', 'Arara', 'Capivara', 'Jacaré', 'Tamanduá', 'Sabiá', 'Tatu', 'Coruja', 'Boto'].map((r) => ({ r, x: `a equipe ${r}`, g: 'f' })),
    },
    cenarios: [
      (c) => `A gincana anual do colégio reuniu ${c.n} equipes, cada uma batizada com o nome de um animal brasileiro.`,
      (c) => `${c.N} equipes de alunos disputaram as provas da gincana beneficente do bairro.`,
    ],
    categorias: [
      { id: 'lider', nome: 'Líder', tipo: 'nomes', pred: 'foi liderada {x}', xNome: (n) => `por ${n}`, np: (it) => `a equipe de ${it.r}`,
        intro: 'teve um líder diferente', descubra: 'quem liderou a equipe' },
      { id: 'cor', nome: 'Camiseta', pred: 'usou camisetas {x}', intro: 'usou camisetas de uma cor diferente', descubra: 'a cor das camisetas',
        itens: itens(['Amarela|amarelas', 'Azul|azuis', 'Verde|verdes', 'Vermelha|vermelhas', 'Branca|brancas', 'Laranja|laranja', 'Roxa|roxas', 'Preta|pretas']) },
      { id: 'prova', nome: 'Prova vencida', pred: 'venceu {x}', intro: 'venceu uma prova diferente', descubra: 'a prova que venceu',
        itens: itens(['Corrida de saco|a corrida de saco', 'Cabo de guerra|o cabo de guerra', 'Caça ao tesouro|a caça ao tesouro', 'Quiz|o quiz de conhecimentos', 'Dança|a prova de dança', 'Paródia|a prova de paródia', 'Revezamento|o revezamento', 'Arrecadação|a arrecadação de alimentos']) },
      {
        id: 'pontos', nome: 'Pontos', ordem: true, numerica: true,
        valores: progressao([60, 80, 100, 120], [10, 15, 20, 25]),
        rotulo: (v) => `${v} pts`, x: (v) => `${v} pontos`,
        pred: 'somou {x}',
        predMin: 'foi a equipe que menos pontuou', npMin: 'menos pontuou', predMax: 'foi a equipe que mais pontuou', npMax: 'mais pontuou',
        verbo: 'somou', maior: 'mais pontos que {B}', menor: 'menos pontos que {B}',
        difMaior: (k) => `${k} pontos a mais que {B}`, difMenor: (k) => `${k} pontos a menos que {B}`,
        dist: (k) => `a diferença entre {A} e {B} foi de ${k} pontos`,
        extremo: 'foi a equipe que mais ou que menos pontuou', meio: 'não foi nem a equipe que mais pontuou nem a que menos pontuou',
        relacao: R_QTD(['ponto', 'pontos']), intro: 'somou uma pontuação diferente', descubra: 'a pontuação final',
      },
    ],
  },

  // 15 ────────────────────────────────────────────────────────────────────
  {
    id: 'talentos', ...PESSOAS,
    titulos: ['Show de talentos', 'Noite de estrelas', 'Palco aberto', 'Sarau da escola'],
    principal: { id: 'artista', nome: 'Artista', tipo: 'pessoas' },
    cenarios: [
      (c) => `No show de talentos do clube, ${c.n} participantes se apresentaram para uma plateia lotada.`,
      (c) => `${c.N} alunos da escola se inscreveram no palco aberto da festa de fim de ano.`,
    ],
    categorias: [
      { id: 'talento', nome: 'Talento', pred: 'fez {x}', intro: 'apresentou um talento diferente', descubra: 'o talento',
        itens: itens(['Mágica|mágica', 'Malabarismo|malabarismo', 'Stand-up|stand-up', 'Beatbox|beatbox', 'Sapateado|sapateado', 'Imitações|imitações', 'Acrobacias|acrobacias', 'Ventriloquia|ventriloquia']) },
      { id: 'figurino', nome: 'Figurino', pred: 'usou um figurino {x}', intro: 'usou um figurino de cor diferente', descubra: 'a cor do figurino',
        itens: itens(['Dourado|dourado', 'Prateado|prateado', 'Vermelho|vermelho', 'Azul|azul', 'Verde|verde', 'Preto|preto', 'Branco|branco', 'Roxo|roxo']) },
      { id: 'torcida', nome: 'Torcida', pred: 'levou {x} para torcer', intro: 'levou alguém diferente para torcer', descubra: 'quem levou para torcer',
        itens: itens(['Mãe|a mãe', 'Avô|o avô', 'Irmão|o irmão', 'Tia|a tia', 'Amigos|os amigos', 'Vizinha|a vizinha', 'Padrinho|o padrinho']) },
      {
        id: 'ordem', nome: 'Ordem', ordem: true, numerica: false,
        valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
        rotulo: (v) => `${v}º`, formato: '{} a se apresentar', x: (v) => `{o} ${v}{º}`,
        pred: 'foi {x} a se apresentar',
        predMin: 'abriu o show', npMin: 'abriu o show', predMax: 'encerrou o show', npMax: 'encerrou o show',
        verbo: 'se apresentou', maior: 'depois de {B}', menor: 'antes de {B}',
        difMaior: (k) => (k === 1 ? 'logo depois de {B}' : `${posicoes(k)} depois de {B}`),
        difMenor: (k) => (k === 1 ? 'logo antes de {B}' : `${posicoes(k)} antes de {B}`),
        dist: (k) => (k === 1 ? '{A} e {B} se apresentaram em sequência' : `entre as apresentações de {A} e de {B} houve ${outras(k - 1, 'outra apresentação', 'outras apresentações', 'f')}`),
        extremo: 'abriu ou encerrou o show', meio: 'não abriu nem encerrou o show',
        relacao: { menor: 'antes de', maior: 'depois de', menorK: '{k} antes de', maiorK: '{k} depois de', unidade: ['posição', 'posições'], menorCurto: 'antes', maiorCurto: 'depois' },
        intro: 'se apresentou em um momento diferente', descubra: 'a ordem de apresentação',
      },
      {
        id: 'votos', nome: 'Votos', ordem: true, numerica: true,
        valores: progressao([40, 60, 80, 100], [12, 15, 18, 20, 25]),
        rotulo: (v) => `${v} votos`, x: (v) => `${v} votos`,
        pred: 'recebeu {x} do público',
        predMin: 'foi {o} menos votad{o}', npMin: 'foi o menos votado', predMax: 'foi {o} mais votad{o}', npMax: 'foi o mais votado',
        verbo: 'recebeu', maior: 'mais votos que {B}', menor: 'menos votos que {B}',
        difMaior: (k) => `${k} votos a mais que {B}`, difMenor: (k) => `${k} votos a menos que {B}`,
        dist: (k) => `{A} e {B} tiveram ${k} votos de diferença`,
        extremo: 'foi {o} mais votad{o} ou {o} menos votad{o}', meio: 'não foi {o} mais votad{o} nem {o} menos votad{o}',
        relacao: R_QTD(['voto', 'votos']), intro: 'recebeu um número diferente de votos do público', descubra: 'quantos votos recebeu',
      },
    ],
  },

  // 16 ────────────────────────────────────────────────────────────────────
  {
    id: 'colecoes', ...PRESENTE,
    titulos: ['Clube dos colecionadores', 'Feira de colecionáveis', 'Paixão por coleções', 'Tesouros guardados'],
    principal: { id: 'colecionador', nome: 'Colecionador(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `Na reunião mensal do clube dos colecionadores, ${c.n} sócios trouxeram suas coleções para exibir.`,
      (c) => `${c.N} colecionadores foram convidados para a feira de colecionáveis do centro de convenções.`,
    ],
    categorias: [
      { id: 'objeto', nome: 'Coleção', pred: 'coleciona {x}', intro: 'coleciona um tipo de objeto diferente', descubra: 'o que coleciona',
        itens: itens(['Selos|selos', 'Moedas|moedas', 'Chaveiros|chaveiros', 'Discos|discos de vinil', 'Postais|cartões-postais', 'Miniaturas|carrinhos em miniatura', 'Figurinhas|figurinhas', 'Canecas|canecas', 'Ímãs|ímãs de geladeira']) },
      { id: 'cidade', nome: 'Cidade', pred: 'mora {x}', intro: 'mora em uma cidade diferente', descubra: 'a cidade onde mora',
        itens: itens(['Curitiba|em Curitiba', 'Recife|em Recife', 'Belém|em Belém', 'Goiânia|em Goiânia', 'Manaus|em Manaus', 'Vitória|em Vitória', 'Natal|em Natal', 'Maceió|em Maceió', 'Cuiabá|em Cuiabá']) },
      { id: 'guarda', nome: 'Onde guarda', pred: 'guarda a coleção {x}', intro: 'guarda a coleção de um jeito diferente', descubra: 'onde guarda a coleção',
        itens: itens(['Armário|num armário', 'Estante|numa estante', 'Caixas|em caixas', 'Álbum|em álbuns', 'Parede|na parede', 'Vitrine|numa vitrine']) },
      {
        id: 'quantidade', nome: 'Peças', ordem: true, numerica: true,
        valores: progressao([120, 150, 200, 250], [30, 40, 50, 60]),
        rotulo: (v) => String(v), formato: '{} peças', x: (v) => `${v} peças`,
        pred: 'tem {x} na coleção',
        predMin: 'tem a menor coleção', npMin: 'tem a menor coleção', predMax: 'tem a maior coleção', npMax: 'tem a maior coleção',
        verbo: 'tem', maior: 'mais peças que {B}', menor: 'menos peças que {B}',
        difMaior: (k) => `${k} peças a mais que {B}`, difMenor: (k) => `${k} peças a menos que {B}`,
        dist: (k) => `as coleções de {A} e de {B} têm ${k} peças de diferença`,
        extremo: 'tem a maior ou a menor coleção', meio: 'não tem nem a maior nem a menor coleção',
        relacao: R_QTD(['peça', 'peças']), intro: 'tem uma coleção de tamanho diferente', descubra: 'quantas peças tem',
      },
      {
        id: 'ano', nome: 'Início', ordem: true, numerica: false,
        valores: progressao([1998, 2000, 2003, 2006, 2008], [2, 3, 4]),
        rotulo: (v) => String(v), x: (v) => `em ${v}`,
        pred: 'começou a colecionar {x}',
        predMin: 'foi {o} primeir{o} a começar a colecionar', npMin: 'começou a colecionar primeiro',
        predMax: 'foi {o} últim{o} a começar a colecionar', npMax: 'começou a colecionar por último',
        verbo: 'começou a colecionar', maior: 'depois de {B}', menor: 'antes de {B}',
        difMaior: (k) => `${anos(k)} depois de {B}`, difMenor: (k) => `${anos(k)} antes de {B}`,
        dist: (k) => `{A} e {B} começaram suas coleções com ${anos(k)} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a começar a colecionar', meio: 'não foi {o} primeir{o} nem {o} últim{o} a começar a colecionar',
        relacao: R_TEMPO(['ano', 'anos']), intro: 'começou a colecionar em um ano diferente', descubra: 'o ano em que começou a colecionar',
      },
    ],
  },

  // 17 ────────────────────────────────────────────────────────────────────
  {
    id: 'restaurante', ...PESSOAS,
    titulos: ['Almoço de domingo', 'Jantar entre amigos', 'Restaurante da esquina', 'Cardápio do dia'],
    principal: { id: 'cliente', nome: 'Cliente', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} amigos se encontraram para um almoço num restaurante do centro, e cada um fez um pedido diferente.`,
      (c) => `Para comemorar o fim do projeto, ${c.n} colegas de trabalho jantaram juntos num restaurante.`,
    ],
    categorias: [
      { id: 'prato', nome: 'Prato', pred: 'pediu {x}', intro: 'pediu um prato diferente', descubra: 'o prato',
        itens: itens(['Lasanha|lasanha', 'Risoto|risoto', 'Feijoada|feijoada', 'Moqueca|moqueca', 'Strogonoff|strogonoff', 'Salmão|salmão grelhado', 'Picanha|picanha', 'Nhoque|nhoque', 'Escondidinho|escondidinho', 'Parmegiana|parmegiana']) },
      { id: 'bebida', nome: 'Bebida', pred: 'bebeu {x}', intro: 'tomou uma bebida diferente', descubra: 'a bebida',
        itens: itens(['Suco de laranja|suco de laranja', 'Limonada|limonada', 'Água com gás|água com gás', 'Refrigerante|refrigerante', 'Chá gelado|chá gelado', 'Suco de uva|suco de uva', 'Água de coco|água de coco']) },
      { id: 'sobremesa', nome: 'Sobremesa', pred: 'pediu {x} de sobremesa', intro: 'escolheu uma sobremesa diferente', descubra: 'a sobremesa',
        itens: itens(['Pudim|pudim', 'Sorvete|sorvete', 'Mousse|mousse', 'Petit gâteau|petit gâteau', 'Quindim|quindim', 'Torta de limão|torta de limão', 'Brownie|brownie', 'Salada de frutas|salada de frutas']) },
      { id: 'pagamento', nome: 'Pagamento', pred: 'pagou {x}', intro: 'pagou de um jeito diferente', descubra: 'a forma de pagamento',
        itens: itens(['Pix|com Pix', 'Crédito|no cartão de crédito', 'Débito|no cartão de débito', 'Dinheiro|em dinheiro', 'Vale-refeição|com vale-refeição']) },
      {
        id: 'conta', nome: 'Conta', ordem: true, numerica: true,
        valores: progressao([38, 42, 45, 48, 52], [4, 5, 6, 7, 8]),
        rotulo: (v) => `R$ ${v}`, x: (v) => `R$ ${v}`,
        pred: 'gastou {x}',
        predMin: 'foi quem gastou menos', npMin: 'gastou menos', predMax: 'foi quem gastou mais', npMax: 'gastou mais',
        verbo: 'gastou', maior: 'mais que {B}', menor: 'menos que {B}',
        difMaior: (k) => `${reais(k)} a mais que {B}`, difMenor: (k) => `${reais(k)} a menos que {B}`,
        dist: (k) => `as contas de {A} e de {B} tiveram ${reais(k)} de diferença`,
        extremo: 'foi quem gastou mais ou quem gastou menos', meio: 'não foi quem gastou mais nem quem gastou menos',
        relacao: R_QTD([], { prefixo: 'R$ ' }), intro: 'gastou um valor diferente', descubra: 'quanto gastou',
      },
      {
        id: 'chegada', nome: 'Chegada', ordem: true, numerica: false,
        valores: (n, r) => { const ini = r.escolha([720, 735, 750]); const p = r.escolha([10, 15]); return Array.from({ length: n }, (_, i) => ini + i * p); },
        rotulo: (v) => `${Math.floor(v / 60)}h${v % 60 ? String(v % 60).padStart(2, '0') : ''}`,
        x: (v) => `às ${Math.floor(v / 60)}h${v % 60 ? String(v % 60).padStart(2, '0') : ''}`,
        pred: 'chegou {x}',
        predMin: 'foi {o} primeir{o} a chegar', npMin: 'chegou primeiro', predMax: 'foi {o} últim{o} a chegar', npMax: 'chegou por último',
        verbo: 'chegou', maior: 'depois de {B}', menor: 'antes de {B}',
        difMaior: (k) => `${minutos(k)} depois de {B}`, difMenor: (k) => `${minutos(k)} antes de {B}`,
        dist: (k) => `{A} e {B} chegaram com ${minutos(k)} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a chegar', meio: 'não foi {o} primeir{o} nem {o} últim{o} a chegar',
        relacao: R_TEMPO(['minuto', 'minutos']), intro: 'chegou em um horário diferente', descubra: 'o horário de chegada',
      },
    ],
  },

  // 18 ────────────────────────────────────────────────────────────────────
  {
    id: 'horta', ...PRESENTE,
    titulos: ['Horta comunitária', 'Mãos na terra', 'Colheita de outono', 'Canteiros da vila'],
    principal: { id: 'horticultor', nome: 'Horticultor(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `Na horta comunitária da vila, ${c.n} vizinhos cuidam cada um de um canteiro.`,
      (c) => `${c.N} aposentados transformaram um terreno vazio do bairro numa horta cheia de vida.`,
    ],
    categorias: [
      { id: 'planta', nome: 'Planta', pred: 'plantou {x}', intro: 'plantou uma espécie diferente', descubra: 'o que plantou',
        itens: itens(['Tomate|tomate', 'Alface|alface', 'Manjericão|manjericão', 'Morango|morango', 'Pimenta|pimenta', 'Cenoura|cenoura', 'Hortelã|hortelã', 'Rúcula|rúcula', 'Abobrinha|abobrinha', 'Couve|couve']) },
      { id: 'adubo', nome: 'Adubo', pred: 'aduba a terra {x}', intro: 'usa um adubo diferente', descubra: 'o adubo',
        itens: itens(['Húmus|com húmus de minhoca', 'Esterco|com esterco', 'Composto|com composto caseiro', 'Cinzas|com cinzas', 'Borra de café|com borra de café', 'Casca de ovo|com casca de ovo moída']) },
      { id: 'chapeu', nome: 'Proteção', pred: 'usa {x}', np: (it) => `quem usa ${it.d}`, intro: 'protege a cabeça do sol de um jeito diferente', descubra: 'o que usa na cabeça',
        itens: itens(['Chapéu de palha|um chapéu de palha|o chapéu de palha', 'Boné|um boné|o boné', 'Viseira|uma viseira|a viseira', 'Lenço|um lenço|o lenço', 'Chapéu de pescador|um chapéu de pescador|o chapéu de pescador', 'Bandana|uma bandana|a bandana']) },
      {
        id: 'canteiro', nome: 'Canteiro', ordem: true, numerica: false,
        valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
        rotulo: (v) => `Canteiro ${v}`, x: (v) => `do canteiro ${v}`,
        pred: 'cuida {x}',
        predMin: 'cuida do primeiro canteiro', npMin: 'cuida do primeiro canteiro', predMax: 'cuida do último canteiro', npMax: 'cuida do último canteiro',
        verbo: 'cuida', maior: 'de um canteiro de número maior que o de {B}', menor: 'de um canteiro de número menor que o de {B}',
        difMaior: (k) => (k === 1 ? 'do canteiro logo depois do de {B}' : `de um canteiro ${qtd(k, 'número', 'números')} depois do de {B}`),
        difMenor: (k) => (k === 1 ? 'do canteiro logo antes do de {B}' : `de um canteiro ${qtd(k, 'número', 'números')} antes do de {B}`),
        dist: (k) => (k === 1 ? '{A} e {B} cuidam de canteiros vizinhos' : `entre os canteiros de {A} e de {B} há ${outras(k - 1, 'outro canteiro', 'outros canteiros', 'm')}`),
        extremo: 'cuida do primeiro ou do último canteiro', meio: 'não cuida nem do primeiro nem do último canteiro',
        relacao: { menor: 'antes de', maior: 'depois de', menorK: '{k} antes de', maiorK: '{k} depois de', unidade: ['canteiro', 'canteiros'], menorCurto: 'antes', maiorCurto: 'depois' },
        intro: 'cuida de um canteiro diferente', descubra: 'o canteiro',
      },
      {
        id: 'colheita', nome: 'Colheita', ordem: true, numerica: true,
        valores: progressao([2, 3, 4], [1, 1.5, 2]),
        rotulo: (v) => `${fmtNum(v)} kg`, x: (v) => `${fmtNum(v)} kg`,
        pred: 'colheu {x}',
        predMin: 'foi quem menos colheu', npMin: 'menos colheu', predMax: 'foi quem mais colheu', npMax: 'mais colheu',
        verbo: 'colheu', maior: 'mais que {B}', menor: 'menos que {B}',
        difMaior: (k) => `${kg(k)} a mais que {B}`, difMenor: (k) => `${kg(k)} a menos que {B}`,
        dist: (k) => `as colheitas de {A} e de {B} tiveram ${kg(k)} de diferença`,
        extremo: 'foi quem mais ou quem menos colheu', meio: 'não foi quem mais nem quem menos colheu',
        relacao: R_QTD(['kg', 'kg']), intro: 'colheu uma quantidade diferente', descubra: 'quanto colheu',
      },
      diaSemana({
        pred: 'rega a horta {x}', verbo: 'rega a horta',
        primeiro: 'é quem rega a horta primeiro na semana', npPrimeiro: 'rega a horta primeiro na semana',
        ultimo: 'é quem rega a horta por último na semana', npUltimo: 'rega a horta por último na semana',
        vespera: 'na véspera do dia de {B}',
        seguidos: '{A} e {B} regam a horta em dias seguidos', distFrase: (q) => `{A} e {B} regam a horta com ${q} de diferença`,
        extremo: 'é quem rega a horta primeiro ou por último na semana', meio: 'não é quem rega a horta primeiro nem quem rega por último na semana',
        intro: 'rega a horta em um dia diferente da semana', descubra: 'o dia da rega',
      }),
    ],
  },

  // 19 ────────────────────────────────────────────────────────────────────
  {
    id: 'musica', ...PRESENTE,
    titulos: ['Escola de música', 'Recital de fim de ano', 'Conservatório', 'Aulas de música'],
    principal: { id: 'musico', nome: 'Aluno(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} alunos da escola de música vão se apresentar no recital de fim de ano.`,
      (c) => `No conservatório da cidade, ${c.n} alunos foram escolhidos para o concerto de primavera.`,
    ],
    categorias: [
      { id: 'instrumento', nome: 'Instrumento', pred: 'toca {x}', intro: 'toca um instrumento diferente', descubra: 'o instrumento',
        itens: itens(['Violino|violino', 'Violoncelo|violoncelo', 'Flauta|flauta transversal', 'Clarinete|clarinete', 'Trompete|trompete', 'Piano|piano', 'Oboé|oboé', 'Harpa|harpa', 'Viola|viola', 'Fagote|fagote']) },
      { id: 'compositor', nome: 'Compositor(a)', pred: 'vai tocar uma peça {x}', intro: 'vai tocar a peça de um compositor diferente', descubra: 'o compositor da peça',
        itens: itens(['Bach|de Bach', 'Mozart|de Mozart', 'Chopin|de Chopin', 'Villa-Lobos|de Villa-Lobos', 'Beethoven|de Beethoven', 'Vivaldi|de Vivaldi', 'Debussy|de Debussy', 'Chiquinha Gonzaga|de Chiquinha Gonzaga', 'Pixinguinha|de Pixinguinha']) },
      { id: 'professor', nome: 'Professor(a)', tipo: 'nomes', pred: 'tem aulas {x}', xNome: (n) => `com ${n}`, np: (it) => `quem tem aulas com ${it.r}`,
        intro: 'tem aulas com um professor diferente', descubra: 'quem é o professor' },
      { id: 'cidade', nome: 'Cidade', pred: 'nasceu {x}', intro: 'nasceu em uma cidade diferente', descubra: 'a cidade natal',
        itens: itens(['Londrina|em Londrina', 'Juiz de Fora|em Juiz de Fora', 'Petrópolis|em Petrópolis', 'Blumenau|em Blumenau', 'Ilhéus|em Ilhéus', 'Mossoró|em Mossoró', 'Itajaí|em Itajaí', 'Sobral|em Sobral']) },
      {
        id: 'estudo', nome: 'Tempo de estudo', ordem: true, numerica: true,
        valores: progressao([2, 3, 4], [1, 2]),
        rotulo: (v) => `${v} anos`, x: (v) => `há ${v} anos`,
        pred: 'estuda música {x}',
        predMin: 'é quem estuda música há menos tempo', npMin: 'estuda música há menos tempo',
        predMax: 'é quem estuda música há mais tempo', npMax: 'estuda música há mais tempo',
        verbo: 'estuda música', maior: 'há mais tempo que {B}', menor: 'há menos tempo que {B}',
        difMaior: (k) => `há ${anos(k)} a mais que {B}`, difMenor: (k) => `há ${anos(k)} a menos que {B}`,
        dist: (k) => `{A} e {B} começaram a estudar música com ${anos(k)} de diferença`,
        extremo: 'é quem estuda música há mais tempo ou há menos tempo', meio: 'não é quem estuda música há mais tempo nem quem estuda há menos tempo',
        relacao: { menor: 'há menos tempo que', maior: 'há mais tempo que', menorK: '{k} a menos que', maiorK: '{k} a mais que', unidade: ['ano', 'anos'], menorCurto: 'menos tempo', maiorCurto: 'mais tempo' },
        intro: 'estuda música há um tempo diferente', descubra: 'há quanto tempo estuda música',
      },
      idade({ inicios: [11, 12, 13, 14, 15], passos: [1, 2] }),
    ],
  },

  // 20 ────────────────────────────────────────────────────────────────────
  {
    id: 'mudanca',
    que: { t: 'a família que', g: 'f' }, ser: 'era', entidade: { plural: 'famílias', g: 'f' }, cadaUm: 'Cada família', paraCada: 'para cada família',
    titulos: ['Vida nova', 'Caminhão de mudança', 'Novos endereços', 'De mudança'],
    principal: { id: 'familia', nome: 'Família', tipo: 'sobrenomes' },
    cenarios: [
      (c) => `Nos últimos anos, ${c.n} famílias que moravam na mesma rua se mudaram para outras cidades.`,
      (c) => `${c.N} famílias que eram vizinhas de porta acabaram, uma a uma, deixando o antigo bairro.`,
    ],
    categorias: [
      { id: 'cidade', nome: 'Cidade', pred: 'se mudou {x}', intro: 'se mudou para uma cidade diferente', descubra: 'a nova cidade',
        itens: itens(['Curitiba|para Curitiba', 'Natal|para Natal', 'Goiânia|para Goiânia', 'Vitória|para Vitória', 'Londrina|para Londrina', 'Joinville|para Joinville', 'Uberlândia|para Uberlândia', 'Campina Grande|para Campina Grande', 'Pelotas|para Pelotas']) },
      { id: 'pet', nome: 'Animal', pred: 'levou {x} na mudança', np: (it) => `a família que levou ${it.d}`, intro: 'levou um animal de estimação diferente na mudança', descubra: 'o animal de estimação',
        itens: itens(['Gato|um gato|o gato', 'Cachorro|um cachorro|o cachorro', 'Papagaio|um papagaio|o papagaio', 'Coelho|um coelho|o coelho', 'Tartaruga|uma tartaruga|a tartaruga', 'Aquário|um aquário|o aquário', 'Calopsita|uma calopsita|a calopsita']) },
      { id: 'transporte', nome: 'Viagem', pred: 'fez a viagem {x}', intro: 'fez a viagem da mudança de um jeito diferente', descubra: 'como fez a viagem',
        itens: itens(['Carro|de carro', 'Avião|de avião', 'Ônibus|de ônibus', 'Caminhão|no próprio caminhão de mudança', 'Trem|de trem']) },
      {
        id: 'ano', nome: 'Ano', ordem: true, numerica: false,
        valores: progressao([2014, 2015, 2016, 2017, 2018], [1, 2]),
        rotulo: (v) => String(v), x: (v) => `em ${v}`,
        pred: 'se mudou {x}',
        predMin: 'foi {o} primeir{o} a se mudar', npMin: 'se mudou primeiro', predMax: 'foi {o} últim{o} a se mudar', npMax: 'se mudou por último',
        verbo: 'se mudou', maior: 'depois de {B}', menor: 'antes de {B}',
        difMaior: (k) => `${anos(k)} depois de {B}`, difMenor: (k) => `${anos(k)} antes de {B}`,
        dist: (k) => `{A} e {B} se mudaram com ${anos(k)} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a se mudar', meio: 'não foi {o} primeir{o} nem {o} últim{o} a se mudar',
        relacao: R_TEMPO(['ano', 'anos']), intro: 'se mudou em um ano diferente', descubra: 'o ano da mudança',
      },
      {
        id: 'filhos', nome: 'Filhos', ordem: true, numerica: true, usos: ['gt', 'dif', 'extremo', 'meio'],
        valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
        rotulo: (v) => (v === 1 ? '1 filho' : `${v} filhos`), x: (v) => `${extenso(v)} ${v === 1 ? 'filho' : 'filhos'}`,
        pred: 'tem {x}',
        predMin: 'é a família com menos filhos', npMin: 'tem menos filhos', predMax: 'é a família com mais filhos', npMax: 'tem mais filhos',
        verbo: 'tem', maior: 'mais filhos que {B}', menor: 'menos filhos que {B}',
        difMaior: (k) => `${qtd(k, 'filho', 'filhos')} a mais que {B}`, difMenor: (k) => `${qtd(k, 'filho', 'filhos')} a menos que {B}`,
        extremo: 'é a família com mais filhos ou a com menos filhos', meio: 'não é nem a família com mais filhos nem a com menos filhos',
        relacao: R_QTD(['filho', 'filhos']), intro: 'tem um número diferente de filhos', descubra: 'quantos filhos tem',
      },
    ],
  },

  // 21 ────────────────────────────────────────────────────────────────────
  {
    id: 'aniversarios', ...PRESENTE,
    titulos: ['Aniversariantes do ano', 'Festa surpresa', 'Parabéns pra você', 'Calendário de aniversários'],
    principal: { id: 'aniversariante', nome: 'Aniversariante', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} primos sempre comemoram juntos os aniversários da família.`,
      (c) => `${c.N} colegas da mesma turma da escola sempre convidam a sala inteira para suas festas de aniversário.`,
    ],
    categorias: [
      { id: 'presente', nome: 'Presente', pred: 'ganhou {x}', np: (it) => `quem ganhou ${it.d}`, intro: 'ganhou um presente diferente', descubra: 'o presente',
        itens: itens(['Bicicleta|uma bicicleta|a bicicleta', 'Livro|um livro|o livro', 'Patins|um par de patins|os patins', 'Relógio|um relógio|o relógio', 'Fone|um fone de ouvido|o fone de ouvido', 'Mochila|uma mochila|a mochila', 'Câmera|uma câmera|a câmera', 'Violão|um violão|o violão', 'Jogo|um jogo de tabuleiro|o jogo de tabuleiro']) },
      { id: 'bolo', nome: 'Bolo', pred: 'escolheu {x}', intro: 'escolheu um sabor de bolo diferente', descubra: 'o sabor do bolo',
        itens: itens(['Chocolate|bolo de chocolate', 'Morango|bolo de morango', 'Prestígio|bolo prestígio', 'Limão|bolo de limão', 'Abacaxi|bolo de abacaxi', 'Floresta negra|bolo floresta negra', 'Doce de leite|bolo de doce de leite']) },
      { id: 'local', nome: 'Local', pred: 'comemorou {x}', intro: 'comemorou em um lugar diferente', descubra: 'onde comemorou',
        itens: itens(['Salão|num salão de festas', 'Parque|no parque', 'Pizzaria|numa pizzaria', 'Casa|em casa', 'Sítio|num sítio', 'Boliche|no boliche', 'Praia|na praia']) },
      { id: 'tema', nome: 'Tema', pred: 'escolheu o tema {x}', intro: 'escolheu um tema de festa diferente', descubra: 'o tema da festa',
        itens: itens(['Dinossauros|dinossauros', 'Fundo do mar|fundo do mar', 'Circo|circo', 'Espaço|espaço sideral', 'Futebol|futebol', 'Safári|safári', 'Super-heróis|super-heróis']) },
      mes({
        pred: 'faz aniversário {x}', verbo: 'faz aniversário',
        primeiro: 'é {o} primeir{o} a fazer aniversário no ano', npPrimeiro: 'faz aniversário primeiro no ano',
        ultimo: 'é {o} últim{o} a fazer aniversário no ano', npUltimo: 'faz aniversário por último no ano',
        seguidos: '{A} e {B} fazem aniversário em meses seguidos', distFrase: (q) => `os aniversários de {A} e de {B} têm ${q} de diferença`,
        extremo: 'é {o} primeir{o} ou {o} últim{o} a fazer aniversário no ano', meio: 'não é {o} primeir{o} nem {o} últim{o} a fazer aniversário no ano',
        intro: 'faz aniversário em um mês diferente', descubra: 'o mês do aniversário',
      }),
      idade({ inicios: [7, 8, 9, 10, 12], passos: [1, 2] }),
    ],
  },

  // 22 ────────────────────────────────────────────────────────────────────
  {
    id: 'feira-livre', ...PRESENTE,
    titulos: ['Feira de sábado', 'Barracas da feira', 'Hora da xepa', 'Feira do produtor'],
    principal: { id: 'feirante', nome: 'Feirante', tipo: 'pessoas' },
    cenarios: [
      (c) => `Na feira livre de sábado, ${c.n} feirantes vizinhos de barraca disputam a freguesia.`,
      (c) => `${c.N} produtores rurais vendem suas frutas na feira do produtor, todo domingo de manhã.`,
    ],
    categorias: [
      { id: 'produto', nome: 'Fruta', pred: 'vende {x}', intro: 'vende uma fruta diferente', descubra: 'a fruta',
        itens: itens(['Banana|banana', 'Laranja|laranja', 'Morango|morango', 'Abacaxi|abacaxi', 'Manga|manga', 'Uva|uva', 'Mamão|mamão', 'Melancia|melancia', 'Goiaba|goiaba', 'Caqui|caqui']) },
      { id: 'avental', nome: 'Avental', pred: 'usa um avental {x}', intro: 'usa um avental diferente', descubra: 'o avental',
        itens: itens(['Azul|azul', 'Verde|verde', 'Vermelho|vermelho', 'Amarelo|amarelo', 'Xadrez|xadrez', 'Listrado|listrado', 'Branco|branco']) },
      { id: 'brinde', nome: 'Brinde', pred: 'dá {x} de brinde', intro: 'dá um brinde diferente aos fregueses', descubra: 'o brinde',
        itens: itens(['Cheiro-verde|cheiro-verde', 'Limão|um limão', 'Pimenta|uma pimenta', 'Hortelã|um raminho de hortelã', 'Bala|uma bala', 'Alho|uma cabeça de alho']) },
      {
        id: 'preco', nome: 'Preço do quilo', ordem: true, numerica: true,
        valores: progressao([3, 3.5, 4, 4.5, 5], [0.5, 1, 1.5]),
        rotulo: (v) => `R$ ${v.toFixed(2).replace('.', ',')}`, x: (v) => `R$ ${v.toFixed(2).replace('.', ',')}`,
        pred: 'cobra {x} pelo quilo',
        predMin: 'cobra o preço mais baixo', npMin: 'cobra o preço mais baixo', predMax: 'cobra o preço mais alto', npMax: 'cobra o preço mais alto',
        verbo: 'cobra', maior: 'mais caro que {B}', menor: 'mais barato que {B}',
        difMaior: (k) => `${reais(k)} a mais que {B}`, difMenor: (k) => `${reais(k)} a menos que {B}`,
        dist: (k) => `os preços de {A} e de {B} têm ${reais(k)} de diferença`,
        extremo: 'cobra o preço mais alto ou o mais baixo', meio: 'não cobra nem o preço mais alto nem o mais baixo',
        relacao: R_REAIS, intro: 'cobra um preço diferente pelo quilo', descubra: 'o preço do quilo',
      },
      {
        id: 'barraca', nome: 'Barraca', ordem: true, numerica: false,
        valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
        rotulo: (v) => `Barraca ${v}`, x: (v) => `na barraca ${v}`,
        pred: 'trabalha {x}',
        predMin: 'trabalha na primeira barraca', npMin: 'trabalha na primeira barraca', predMax: 'trabalha na última barraca', npMax: 'trabalha na última barraca',
        verbo: 'trabalha', maior: 'mais longe da entrada que {B}', menor: 'mais perto da entrada que {B}',
        difMaior: (k) => (k === 1 ? 'na barraca logo depois da de {B}' : `${qtd(k, 'barraca', 'barracas', 'f')} depois de {B}`),
        difMenor: (k) => (k === 1 ? 'na barraca logo antes da de {B}' : `${qtd(k, 'barraca', 'barracas', 'f')} antes de {B}`),
        dist: (k) => (k === 1 ? '{A} e {B} trabalham em barracas vizinhas' : `entre as barracas de {A} e de {B} há ${outras(k - 1, 'outra barraca', 'outras barracas', 'f')}`),
        extremo: 'trabalha na primeira ou na última barraca', meio: 'não trabalha nem na primeira nem na última barraca',
        relacao: { menor: 'antes de', maior: 'depois de', menorK: '{k} antes de', maiorK: '{k} depois de', unidade: ['barraca', 'barracas'], menorCurto: 'antes', maiorCurto: 'depois' },
        intro: 'trabalha em uma barraca diferente', descubra: 'a barraca',
      },
    ],
  },

  // 23 ────────────────────────────────────────────────────────────────────
  {
    id: 'hotel', ...PESSOAS,
    titulos: ['Hotel Beira-Mar', 'Pousada da serra', 'Check-in', 'Recepção do hotel'],
    principal: { id: 'hospede', nome: 'Hóspede', tipo: 'pessoas' },
    cenarios: [
      (c) => `Durante o feriado, ${c.n} hóspedes que não se conheciam ficaram no mesmo hotel.`,
      (c) => `Numa pousada da serra, ${c.n} hóspedes viraram amigos durante o café da manhã.`,
    ],
    categorias: [
      { id: 'cidade', nome: 'Cidade', pred: 'veio {x}', intro: 'veio de uma cidade diferente', descubra: 'a cidade de origem',
        itens: itens(['Belo Horizonte|de Belo Horizonte', 'Brasília|de Brasília', 'Salvador|de Salvador', 'Fortaleza|de Fortaleza', 'Porto Alegre|de Porto Alegre', 'Manaus|de Manaus', 'Recife|de Recife', 'Campo Grande|de Campo Grande']) },
      { id: 'motivo', nome: 'Motivo', pred: 'viajou {x}', intro: 'viajou por um motivo diferente', descubra: 'o motivo da viagem',
        itens: itens(['Trabalho|a trabalho', 'Lua de mel|em lua de mel', 'Congresso|para um congresso', 'Casamento|para um casamento', 'Show|para um show', 'Descanso|para descansar', 'Maratona|para correr uma maratona']) },
      { id: 'cafe', nome: 'Café da manhã', pred: 'pede {x} no café da manhã', intro: 'tem um pedido preferido diferente no café da manhã', descubra: 'o pedido do café da manhã',
        itens: itens(['Tapioca|tapioca', 'Omelete|omelete', 'Pão de queijo|pão de queijo', 'Panqueca|panqueca', 'Cuscuz|cuscuz', 'Salada de frutas|salada de frutas', 'Bolo de fubá|bolo de fubá']) },
      andar({ verbo: 'ficou', plural: 'ficaram', intro: 'ficou em um andar diferente', descubra: 'o andar' }),
      {
        id: 'noites', nome: 'Noites', ordem: true, numerica: true, usos: ['gt', 'dif', 'extremo', 'meio'],
        valores: consecutivos([1, 2]),
        rotulo: (v) => (v === 1 ? '1 noite' : `${v} noites`), x: (v) => `${extenso(v, 'f')} ${v === 1 ? 'noite' : 'noites'}`,
        pred: 'passou {x} no hotel',
        predMin: 'foi quem passou menos noites no hotel', npMin: 'passou menos noites no hotel',
        predMax: 'foi quem passou mais noites no hotel', npMax: 'passou mais noites no hotel',
        verbo: 'passou', maior: 'mais noites no hotel que {B}', menor: 'menos noites no hotel que {B}',
        difMaior: (k) => `${qtd(k, 'noite', 'noites', 'f')} a mais no hotel que {B}`, difMenor: (k) => `${qtd(k, 'noite', 'noites', 'f')} a menos no hotel que {B}`,
        extremo: 'foi quem passou mais noites ou quem passou menos noites no hotel', meio: 'não foi quem passou mais noites nem quem passou menos noites no hotel',
        relacao: R_QTD(['noite', 'noites']), intro: 'passou um número diferente de noites no hotel', descubra: 'quantas noites passou no hotel',
      },
    ],
  },

  // 24 ────────────────────────────────────────────────────────────────────
  {
    id: 'xadrez', ...PESSOAS,
    titulos: ['Torneio de xadrez', 'Xeque-mate', 'Clube de xadrez', 'Rodada final'],
    principal: { id: 'enxadrista', nome: 'Enxadrista', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} enxadristas disputaram o torneio relâmpago do clube no fim de semana.`,
      (c) => `No clube de xadrez do bairro, ${c.n} sócios jogaram um torneio entre si numa tarde de sábado.`,
    ],
    categorias: [
      { id: 'abertura', nome: 'Abertura', pred: 'prefere {x}', intro: 'prefere uma abertura diferente', descubra: 'a abertura preferida',
        itens: itens(['Siciliana|a Defesa Siciliana', 'Francesa|a Defesa Francesa', 'Italiana|a Abertura Italiana', 'Espanhola|a Abertura Espanhola', 'Gambito da Dama|o Gambito da Dama', 'Caro-Kann|a Defesa Caro-Kann', 'Inglesa|a Abertura Inglesa', 'Escandinava|a Defesa Escandinava']) },
      { id: 'lanche', nome: 'Lanche', pred: 'comeu {x} no intervalo', intro: 'comeu um lanche diferente no intervalo', descubra: 'o lanche do intervalo',
        itens: itens(['Banana|uma banana', 'Barra de cereal|uma barra de cereal', 'Sanduíche|um sanduíche', 'Castanhas|castanhas', 'Chocolate|chocolate', 'Maçã|uma maçã', 'Pão de queijo|pão de queijo']) },
      { id: 'peca', nome: 'Peça preferida', pred: 'tem {x} como peça preferida', intro: 'tem uma peça preferida diferente', descubra: 'a peça preferida',
        itens: itens(['Cavalo|o cavalo', 'Torre|a torre', 'Bispo|o bispo', 'Dama|a dama', 'Peão|o peão', 'Rei|o rei']) },
      {
        id: 'pontos', nome: 'Pontos', ordem: true, numerica: true,
        valores: progressao([1.5, 2, 2.5], [0.5, 1]),
        rotulo: (v) => fmtNum(v), formato: '{} pontos', x: (v) => `${fmtNum(v)} ${v === 1 ? 'ponto' : 'pontos'}`,
        pred: 'fez {x}',
        predMin: 'foi quem fez menos pontos', npMin: 'fez menos pontos', predMax: 'venceu o torneio', npMax: 'venceu o torneio',
        verbo: 'fez', maior: 'mais pontos que {B}', menor: 'menos pontos que {B}',
        difMaior: (k) => `${pontos(k)} a mais que {B}`, difMenor: (k) => `${pontos(k)} a menos que {B}`,
        dist: (k) => `{A} e {B} terminaram com ${pontos(k)} de diferença`,
        extremo: 'foi quem fez mais pontos ou quem fez menos pontos', meio: 'não foi quem fez mais pontos nem quem fez menos',
        relacao: R_QTD(['ponto', 'pontos']), intro: 'fez uma pontuação diferente', descubra: 'a pontuação',
      },
      idade({ inicios: [14, 18, 22, 26, 30], passos: [3, 4, 5] }),
    ],
  },

  // 25 ────────────────────────────────────────────────────────────────────
  {
    id: 'fotografia', ...PESSOAS,
    titulos: ['Concurso de fotografia', 'Olhar urbano', 'Clique premiado', 'Exposição coletiva'],
    principal: { id: 'fotografo', nome: 'Fotógrafo(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} fotógrafos amadores tiveram fotos selecionadas para a exposição do centro cultural.`,
      (c) => `No concurso de fotografia da biblioteca municipal, ${c.n} participantes chegaram à final.`,
    ],
    categorias: [
      { id: 'tema', nome: 'Tema', pred: 'fotografou {x}', intro: 'fotografou um tema diferente', descubra: 'o tema das fotos',
        itens: itens(['Paisagens|paisagens', 'Retratos|retratos', 'Animais|animais', 'Prédios antigos|prédios antigos', 'Esportes|esportes', 'Vida nas ruas|a vida nas ruas', 'Flores|flores', 'Céu noturno|o céu noturno']) },
      { id: 'camera', nome: 'Equipamento', pred: 'usou {x}', np: (it) => `quem usou ${it.d || it.x}`, intro: 'usou um equipamento diferente', descubra: 'o equipamento',
        itens: itens(['Celular|o celular|o celular', 'Analógica|uma câmera analógica|a câmera analógica', 'Profissional|uma câmera profissional|a câmera profissional', 'Compacta|uma câmera compacta|a câmera compacta', 'Drone|um drone|o drone', 'Instantânea|uma câmera instantânea|a câmera instantânea']) },
      { id: 'cidade', nome: 'Cidade', pred: 'mora {x}', intro: 'mora em uma cidade diferente', descubra: 'a cidade onde mora',
        itens: itens(['Niterói|em Niterói', 'Santos|em Santos', 'Ribeirão Preto|em Ribeirão Preto', 'Caxias do Sul|em Caxias do Sul', 'Feira de Santana|em Feira de Santana', 'Anápolis|em Anápolis', 'Maringá|em Maringá']) },
      colocacao({ verbo: 'ficou', venceu: 'venceu o concurso', plural: 'ficaram', intro: 'ficou em uma posição diferente no concurso' }),
      {
        id: 'fotos', nome: 'Fotos expostas', ordem: true, numerica: true, usos: ['gt', 'dif', 'extremo', 'meio'],
        valores: progressao([3, 4, 5, 6], [1, 2]),
        rotulo: (v) => `${v} fotos`, x: (v) => `${extenso(v, 'f')} fotos`,
        pred: 'expôs {x}',
        predMin: 'foi quem expôs menos fotos', npMin: 'expôs menos fotos', predMax: 'foi quem expôs mais fotos', npMax: 'expôs mais fotos',
        verbo: 'expôs', maior: 'mais fotos que {B}', menor: 'menos fotos que {B}',
        difMaior: (k) => `${qtd(k, 'foto', 'fotos', 'f')} a mais que {B}`, difMenor: (k) => `${qtd(k, 'foto', 'fotos', 'f')} a menos que {B}`,
        extremo: 'foi quem expôs mais fotos ou quem expôs menos fotos', meio: 'não foi quem expôs mais fotos nem quem expôs menos',
        relacao: R_QTD(['foto', 'fotos']), intro: 'expôs um número diferente de fotos', descubra: 'quantas fotos expôs',
      },
    ],
  },

  // 26 ────────────────────────────────────────────────────────────────────
  {
    id: 'agenda',
    que: { t: 'o compromisso que', g: 'm' }, ser: 'foi', entidade: { plural: 'compromissos', g: 'm' }, cadaUm: 'Cada compromisso', paraCada: 'para cada dia',
    protagonista: true, semAssociacao: true,
    titulos: ['Agenda da semana', 'Semana corrida', 'Compromissos', 'De segunda a sexta'],
    principal: {
      id: 'dia', nome: 'Dia', tipo: 'ordem', ordem: true, numerica: false,
      valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
      rotulo: (v) => DIAS[v], x: (v) => DIA_X[v],
      np: (it) => ({ t: `o compromisso de ${DIA_NOME[it.valor]}`, g: 'm' }),
      pred: 'aconteceu {x}',
      verbo: 'aconteceu', maior: 'depois de {B}', menor: 'antes de {B}',
      difMaior: (k) => (k === 1 ? 'no dia seguinte ao de {B}' : `${dias(k)} depois de {B}`),
      difMenor: (k) => (k === 1 ? 'na véspera de {B}' : `${dias(k)} antes de {B}`),
      dist: (k) => (k === 1 ? '{A} e {B} aconteceram em dias seguidos' : `entre {A} e {B} se passaram ${dias(k)}`),
      extremo: 'foi o primeiro ou o último compromisso da semana', meio: 'não foi nem o primeiro nem o último compromisso da semana',
      relacao: R_TEMPO(['dia', 'dias']),
    },
    cenarios: [
      (c) => `${c.P} anotou na agenda um compromisso para cada dia útil da semana.`,
      (c) => `Na última semana do mês, ${c.P} teve um compromisso diferente a cada dia, de segunda a ${c.num === 5 ? 'sexta' : 'quinta'}.`,
    ],
    categorias: [
      { id: 'compromisso', nome: 'Compromisso', pred: 'foi {x}', np: (it) => ({ t: it.x, g: it.g }), descubra: 'o compromisso',
        itens: itens(['Dentista|a consulta no dentista||f', 'Reunião|a reunião de trabalho||f', 'Inglês|a aula de inglês||f', 'Almoço|o almoço com a avó||m', 'Vôlei|o treino de vôlei||m', 'Cabeleireiro|a ida ao cabeleireiro||f', 'Banco|a visita ao banco||f', 'Cinema|a sessão de cinema||f', 'Revisão do carro|a revisão do carro||f']) },
      { id: 'local', nome: 'Local', pred: 'aconteceu {x}', np: (it) => ({ t: `o compromisso ${it.x}`, g: 'm' }), intro: 'aconteceu em um lugar diferente', descubra: 'o local',
        itens: itens(['Centro|no centro', 'Shopping|no shopping', 'Bairro|no bairro', 'Zona sul|na zona sul', 'Escritório|no escritório', 'Clube|no clube', 'On-line|on-line']) },
      horario({
        inicios: [8, 9, 10, 13, 14], pred: 'começou {x}', verbo: 'começou',
        primeiro: 'foi o compromisso mais cedo', npPrimeiro: 'começou mais cedo',
        ultimo: 'foi o compromisso mais tarde', npUltimo: 'começou mais tarde',
        maior: 'mais tarde que {B}', menor: 'mais cedo que {B}',
        difMaior: (k) => `${horas(k)} mais tarde que {B}`, difMenor: (k) => `${horas(k)} mais cedo que {B}`,
        distFrase: (q) => `{A} e {B} começaram com ${q} de diferença`,
        extremo: 'começou no horário mais cedo ou no mais tarde', meio: 'não começou nem no horário mais cedo nem no mais tarde',
        relacao: { menor: 'mais cedo que', maior: 'mais tarde que', menorK: '{k} mais cedo que', maiorK: '{k} mais tarde que', unidade: ['hora', 'horas'], menorCurto: 'mais cedo', maiorCurto: 'mais tarde' },
        intro: 'começou em um horário diferente', descubra: 'o horário',
      }),
      {
        id: 'duracao', nome: 'Duração', ordem: true, numerica: true,
        valores: progressao([30, 40, 45], [15, 20, 30]),
        rotulo: (v) => `${v} min`, x: (v) => `${v} minutos`,
        np: (it) => ({ t: `o compromisso de ${it.valor} minutos`, g: 'm' }),
        pred: 'durou {x}',
        predMin: 'foi o compromisso mais curto', npMin: 'durou menos', predMax: 'foi o compromisso mais longo', npMax: 'durou mais',
        verbo: 'durou', maior: 'mais que {B}', menor: 'menos que {B}',
        difMaior: (k) => `${k} minutos a mais que {B}`, difMenor: (k) => `${k} minutos a menos que {B}`,
        dist: (k) => `as durações de {A} e de {B} tiveram ${k} minutos de diferença`,
        extremo: 'foi o compromisso mais longo ou o mais curto', meio: 'não foi nem o compromisso mais longo nem o mais curto',
        relacao: R_QTD(['minuto', 'minutos']), intro: 'teve uma duração diferente', descubra: 'a duração',
      },
    ],
  },

  // 27 ────────────────────────────────────────────────────────────────────
  {
    id: 'provas',
    que: { t: 'a prova que', g: 'f' }, ser: 'foi', entidade: { plural: 'provas', g: 'f' }, cadaUm: 'Cada prova', paraCada: 'para cada dia',
    protagonista: true, semAssociacao: true,
    titulos: ['Semana de provas', 'Boletim', 'Fim de bimestre', 'Hora da prova'],
    principal: {
      id: 'dia', nome: 'Dia', tipo: 'ordem', ordem: true, numerica: false,
      valores: (n) => Array.from({ length: n }, (_, i) => i + 1),
      rotulo: (v) => DIAS[v], x: (v) => DIA_X[v],
      np: (it) => ({ t: `a prova de ${DIA_NOME[it.valor]}`, g: 'f' }),
      pred: 'foi {x}',
      verbo: 'foi', maior: 'depois de {B}', menor: 'antes de {B}',
      difMaior: (k) => (k === 1 ? 'no dia seguinte a {B}' : `${dias(k)} depois de {B}`),
      difMenor: (k) => (k === 1 ? 'na véspera de {B}' : `${dias(k)} antes de {B}`),
      dist: (k) => (k === 1 ? '{A} e {B} foram em dias seguidos' : `entre {A} e {B} se passaram ${dias(k)}`),
      extremo: 'foi a primeira ou a última prova da semana', meio: 'não foi nem a primeira nem a última prova da semana',
      relacao: R_TEMPO(['dia', 'dias']),
    },
    cenarios: [
      (c) => `Na última semana do bimestre, ${c.P} fez uma prova por dia.`,
      (c) => `${c.P} passou a semana inteira estudando: teve uma prova diferente a cada dia, de segunda a ${c.num === 5 ? 'sexta' : 'quinta'}.`,
    ],
    categorias: [
      { id: 'disciplina', nome: 'Disciplina', pred: 'foi {x}', np: (it) => ({ t: it.d, g: 'f' }), descubra: 'a disciplina',
        itens: itens(['História|a de história|a prova de história', 'Geografia|a de geografia|a prova de geografia', 'Química|a de química|a prova de química', 'Física|a de física|a prova de física', 'Biologia|a de biologia|a prova de biologia', 'Matemática|a de matemática|a prova de matemática', 'Inglês|a de inglês|a prova de inglês', 'Português|a de português|a prova de português', 'Artes|a de artes|a prova de artes']) },
      { id: 'professor', nome: 'Professor(a)', tipo: 'nomes', pred: 'foi aplicada {x}', xNome: (n, g) => (g === 'f' ? `pela professora ${n}` : `pelo professor ${n}`),
        np: (it) => ({ t: it.g === 'f' ? `a prova da professora ${it.r}` : `a prova do professor ${it.r}`, g: 'f' }),
        intro: 'foi aplicada por um professor diferente', descubra: 'quem aplicou a prova' },
      {
        id: 'nota', nome: 'Nota', ordem: true, numerica: true,
        valores: (n, r) => (r.chance(0.5) ? progressao([6, 6.5, 7], [0.5])(n, r) : progressao([5, 6], [1])(n, r)),
        rotulo: (v) => fmtNum(v), formato: 'nota {}', x: (v) => `nota ${fmtNum(v)}`,
        pred: 'teve {x}',
        predMin: 'teve a menor nota', npMin: 'teve a menor nota', predMax: 'teve a maior nota', npMax: 'teve a maior nota',
        verbo: 'teve', maior: 'nota maior que a de {B}', menor: 'nota menor que a de {B}',
        difMaior: (k) => `${pontos(k)} a mais que {B}`, difMenor: (k) => `${pontos(k)} a menos que {B}`,
        dist: (k) => `as notas de {A} e de {B} tiveram ${pontos(k)} de diferença`,
        extremo: 'teve a maior ou a menor nota', meio: 'não teve nem a maior nem a menor nota',
        relacao: { menor: 'nota menor que', maior: 'nota maior que', menorK: '{k} a menos que', maiorK: '{k} a mais que', unidade: ['ponto', 'pontos'], menorCurto: 'menor', maiorCurto: 'maior' },
        intro: 'teve uma nota diferente', descubra: 'a nota',
      },
      horario({
        inicios: [7, 8, 13, 14], pred: 'começou {x}', verbo: 'começou',
        primeiro: 'foi a prova mais cedo', npPrimeiro: 'começou mais cedo',
        ultimo: 'foi a prova mais tarde', npUltimo: 'começou mais tarde',
        maior: 'mais tarde que {B}', menor: 'mais cedo que {B}',
        difMaior: (k) => `${horas(k)} mais tarde que {B}`, difMenor: (k) => `${horas(k)} mais cedo que {B}`,
        distFrase: (q) => `{A} e {B} começaram com ${q} de diferença`,
        extremo: 'começou no horário mais cedo ou no mais tarde', meio: 'não começou nem no horário mais cedo nem no mais tarde',
        relacao: { menor: 'mais cedo que', maior: 'mais tarde que', menorK: '{k} mais cedo que', maiorK: '{k} mais tarde que', unidade: ['hora', 'horas'], menorCurto: 'mais cedo', maiorCurto: 'mais tarde' },
        intro: 'começou em um horário diferente', descubra: 'o horário',
      }),
    ],
  },

  // 28 ────────────────────────────────────────────────────────────────────
  {
    id: 'zoologico', ...PRESENTE,
    titulos: ['Zoológico municipal', 'Hora da refeição', 'Cuidadores de bichos', 'Safári urbano'],
    principal: { id: 'tratador', nome: 'Tratador(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `No zoológico da cidade, ${c.n} tratadores são responsáveis cada um por um animal diferente.`,
      (c) => `${c.N} tratadores do zoológico municipal participaram de uma entrevista para o jornal do bairro.`,
    ],
    categorias: [
      { id: 'animal', nome: 'Animal', pred: 'cuida {x}', intro: 'cuida de um animal diferente', descubra: 'o animal',
        itens: itens(['Girafa|da girafa', 'Elefante|do elefante', 'Leão|do leão', 'Hipopótamo|do hipopótamo', 'Zebra|da zebra', 'Tigre|do tigre', 'Urso|do urso', 'Anta|da anta', 'Onça-pintada|da onça-pintada']) },
      { id: 'ajudante', nome: 'Ajudante', tipo: 'nomes', pred: 'tem {x} como ajudante', xNome: (n) => n, np: (it) => `quem tem ${it.r} como ajudante`,
        intro: 'trabalha com um ajudante diferente', descubra: 'o ajudante' },
      { id: 'apelido', nome: 'Apelido', pred: 'deu ao animal o apelido de {x}', intro: 'deu um apelido diferente ao seu animal', descubra: 'o apelido do animal',
        itens: itens(['Bolinha|Bolinha', 'Pipoca|Pipoca', 'Biscoito|Biscoito', 'Faísca|Faísca', 'Nuvem|Nuvem', 'Trovão|Trovão', 'Pingo|Pingo']) },
      horario({
        inicios: [8, 9, 10], pred: 'alimenta seu animal {x}', verbo: 'alimenta seu animal',
        primeiro: 'é {o} primeir{o} a alimentar seu animal', npPrimeiro: 'alimenta seu animal primeiro',
        ultimo: 'é {o} últim{o} a alimentar seu animal', npUltimo: 'alimenta seu animal por último',
        distFrase: (q) => `{A} e {B} alimentam seus animais com ${q} de diferença`,
        extremo: 'é {o} primeir{o} ou {o} últim{o} a alimentar seu animal', meio: 'não é {o} primeir{o} nem {o} últim{o} a alimentar seu animal',
        intro: 'alimenta seu animal em um horário diferente', descubra: 'o horário da refeição',
      }),
      {
        id: 'casa', nome: 'Tempo de casa', ordem: true, numerica: true,
        valores: progressao([2, 3, 4, 5], [2, 3]),
        rotulo: (v) => `${v} anos`, x: (v) => `há ${v} anos`,
        pred: 'trabalha no zoológico {x}',
        predMin: 'é quem trabalha no zoológico há menos tempo', npMin: 'trabalha no zoológico há menos tempo',
        predMax: 'é quem trabalha no zoológico há mais tempo', npMax: 'trabalha no zoológico há mais tempo',
        verbo: 'trabalha no zoológico', maior: 'há mais tempo que {B}', menor: 'há menos tempo que {B}',
        difMaior: (k) => `há ${anos(k)} a mais que {B}`, difMenor: (k) => `há ${anos(k)} a menos que {B}`,
        dist: (k) => `{A} e {B} começaram a trabalhar no zoológico com ${anos(k)} de diferença`,
        extremo: 'é quem trabalha no zoológico há mais tempo ou há menos tempo', meio: 'não é quem trabalha no zoológico há mais tempo nem quem trabalha há menos tempo',
        relacao: { menor: 'há menos tempo que', maior: 'há mais tempo que', menorK: '{k} a menos que', maiorK: '{k} a mais que', unidade: ['ano', 'anos'], menorCurto: 'menos tempo', maiorCurto: 'mais tempo' },
        intro: 'trabalha no zoológico há um tempo diferente', descubra: 'há quanto tempo trabalha no zoológico',
      },
    ],
  },

  // 29 ────────────────────────────────────────────────────────────────────
  {
    id: 'trilhas', ...PESSOAS,
    titulos: ['Trilheiros', 'Pé na trilha', 'Aventura na serra', 'Rumo ao cume'],
    principal: { id: 'trilheiro', nome: 'Trilheiro(a)', tipo: 'pessoas' },
    cenarios: [
      (c) => `${c.N} amigos de um grupo de trilhas fizeram, cada um, uma travessia diferente nas férias.`,
      (c) => `No encontro anual do clube de montanhismo, ${c.n} sócios contaram como foi a última aventura de cada um.`,
    ],
    categorias: [
      { id: 'trilha', nome: 'Trilha', pred: 'fez a trilha {x}', intro: 'fez uma trilha diferente', descubra: 'a trilha',
        itens: itens(['Pedra Azul|da Pedra Azul', 'Cachoeira Alta|da Cachoeira Alta', 'Vale Verde|do Vale Verde', 'Serra Fria|da Serra Fria', 'Morro do Sol|do Morro do Sol', 'Pico da Névoa|do Pico da Névoa', 'Lagoa Funda|da Lagoa Funda', 'Gruta Clara|da Gruta Clara']) },
      { id: 'item', nome: 'Item especial', pred: 'levou {x}', np: (it) => `quem levou ${it.d}`, intro: 'levou um item especial diferente na mochila', descubra: 'o item especial',
        itens: itens(['Lanterna|uma lanterna|a lanterna', 'Bússola|uma bússola|a bússola', 'Binóculo|um binóculo|o binóculo', 'Câmera|uma câmera|a câmera', 'Cantil|um cantil|o cantil', 'Canivete|um canivete|o canivete', 'Rede|uma rede|a rede']) },
      { id: 'companhia', nome: 'Companhia', pred: 'fez a travessia {x}', intro: 'fez a travessia com uma companhia diferente', descubra: 'a companhia',
        itens: itens(['Sozinho(a)|sozinh{o}', 'Irmão|com o irmão', 'Primos|com os primos', 'Guia|com um guia', 'Cachorro|com o cachorro', 'Colegas|com colegas de trabalho']) },
      mes({
        pred: 'fez sua travessia {x}', verbo: 'fez sua travessia',
        primeiro: 'foi {o} primeir{o} a fazer a travessia', npPrimeiro: 'fez a travessia primeiro',
        ultimo: 'foi {o} últim{o} a fazer a travessia', npUltimo: 'fez a travessia por último',
        seguidos: '{A} e {B} fizeram suas travessias em meses seguidos', distFrase: (q) => `as travessias de {A} e de {B} tiveram ${q} de diferença`,
        extremo: 'foi {o} primeir{o} ou {o} últim{o} a fazer a travessia', meio: 'não foi {o} primeir{o} nem {o} últim{o} a fazer a travessia',
        intro: 'fez a travessia em um mês diferente', descubra: 'o mês da travessia',
      }),
      {
        id: 'distancia', nome: 'Distância', ordem: true, numerica: true,
        valores: progressao([6, 8, 10, 12], [2, 3, 4]),
        rotulo: (v) => `${v} km`, x: (v) => `${v} km`,
        pred: 'caminhou {x}',
        predMin: 'foi quem caminhou menos', npMin: 'caminhou menos', predMax: 'foi quem caminhou mais', npMax: 'caminhou mais',
        verbo: 'caminhou', maior: 'mais que {B}', menor: 'menos que {B}',
        difMaior: (k) => `${k} km a mais que {B}`, difMenor: (k) => `${k} km a menos que {B}`,
        dist: (k) => `{A} e {B} caminharam distâncias com ${k} km de diferença`,
        extremo: 'foi quem caminhou mais ou quem caminhou menos', meio: 'não foi quem caminhou mais nem quem caminhou menos',
        relacao: R_QTD(['km', 'km']), intro: 'caminhou uma distância diferente', descubra: 'a distância percorrida',
      },
      {
        id: 'altitude', nome: 'Altitude', ordem: true, numerica: true,
        valores: progressao([800, 1000, 1200], [150, 200, 250]),
        rotulo: (v) => `${fmtNum(v)} m`, x: (v) => `${fmtNum(v)} metros de altitude`,
        pred: 'alcançou {x}',
        predMin: 'alcançou a menor altitude', npMin: 'alcançou a menor altitude', predMax: 'alcançou a maior altitude', npMax: 'alcançou a maior altitude',
        verbo: 'alcançou', maior: 'uma altitude maior que {B}', menor: 'uma altitude menor que {B}',
        difMaior: (k) => `${fmtNum(k)} metros a mais que {B}`, difMenor: (k) => `${fmtNum(k)} metros a menos que {B}`,
        dist: (k) => `as altitudes alcançadas por {A} e por {B} tiveram ${fmtNum(k)} metros de diferença`,
        extremo: 'alcançou a maior ou a menor altitude', meio: 'não alcançou nem a maior nem a menor altitude',
        relacao: { menor: 'mais baixo que', maior: 'mais alto que', menorK: '{k} abaixo de', maiorK: '{k} acima de', unidade: ['metro', 'metros'], menorCurto: 'mais baixo', maiorCurto: 'mais alto' },
        intro: 'alcançou uma altitude diferente', descubra: 'a altitude alcançada',
      },
    ],
  },
];
