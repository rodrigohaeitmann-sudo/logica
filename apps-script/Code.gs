// Lógica — progresso na nuvem (Google Apps Script Web App)
//
// Guarda o progresso dos desafios numa planilha sua, para não perder nada se o
// celular apagar os dados do navegador, e para jogar em mais de um aparelho.
//
// Configuração (uma vez):
// 1. Crie uma planilha nova no Google Drive (ex.: "Lógica — progresso").
// 2. Na planilha: Extensões > Apps Script. Apague o que houver e cole este arquivo.
// 3. Configurações do projeto (engrenagem) > Propriedades do script >
//    adicione a propriedade API_TOKEN com uma senha que você escolher.
// 4. Implantar > Nova implantação > App da web >
//    Executar como: VOCÊ | Quem pode acessar: QUALQUER PESSOA. Autorize o acesso.
// 5. Copie a URL que termina em /exec e cole no app (Ajustes > Progresso na
//    nuvem), com a mesma senha.
// Se editar este código depois, reimplante (Gerenciar implantações > editar >
// nova versão) para a URL /exec usar a versão nova.
//
// A aba "Progresso" é criada sozinha: uma linha por desafio, com um resumo
// legível e o progresso completo (JSON) na coluna "dados". A coluna "gravado"
// guarda quando a linha mudou na planilha (milissegundos, como número: texto com
// cara de data a planilha converteria em data).

const ABA = 'Progresso';
const COLUNAS = ['id', 'atualizado', 'resolvido', 'estrelas', 'melhor_tempo', 'dados', 'gravado'];
const C = { id: 0, atualizado: 1, resolvido: 2, estrelas: 3, tempo: 4, dados: 5, gravado: 6 };

function doGet(e) {
  const params = (e && e.parameter) || {};
  return responder(tratar(params, null), params.callback);
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  let corpo = {};
  try {
    corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {}
  return responder(tratar(params, corpo), params.callback);
}

function tratar(params, corpo) {
  const token = (corpo && corpo.token) || params.token;
  const guardado = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!guardado) return { ok: false, error: 'API_TOKEN não configurado' };
  if (token !== guardado) return { ok: false, error: 'invalid token' };
  const acao = (corpo && corpo.action) || params.action;
  try {
    if (acao === 'ping') return { ok: true, total: lerTudo().length, servidor: agora() };
    if (acao === 'ler') return ler(Number(params.desde || (corpo && corpo.desde) || 0));
    if (acao === 'sincronizar') return sincronizar(corpo || {});
    if (acao === 'apagar') return apagar();
    return { ok: false, error: 'ação desconhecida: ' + acao };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------

function agora() {
  return Date.now();
}

function aba() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA);
  if (!sh) {
    sh = ss.insertSheet(ABA);
    sh.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// [{ linha, id, gravado, prog }]
function lerTudo() {
  const sh = aba();
  const ultima = sh.getLastRow();
  if (ultima < 2) return [];
  const valores = sh.getRange(2, 1, ultima - 1, COLUNAS.length).getValues();
  const out = [];
  valores.forEach(function (v, i) {
    if (!v[C.id]) return;
    let prog = null;
    try {
      prog = JSON.parse(v[C.dados]);
    } catch (err) {
      return;
    }
    out.push({ linha: i + 2, id: String(v[C.id]), gravado: Number(v[C.gravado]) || 0, prog: prog });
  });
  return out;
}

function ler(desde) {
  const progresso = {};
  lerTudo().forEach(function (r) {
    if (!desde || r.gravado > desde) progresso[r.id] = r.prog;
  });
  return { ok: true, servidor: agora(), progresso: progresso };
}

// Recebe o progresso que mudou no aparelho, mescla com o da planilha (por
// desafio, vence o mais recente; melhores marcas se somam) e devolve o que
// mudou na planilha desde a última sincronização daquele aparelho.
function sincronizar(corpo) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const sh = aba();
    const desde = Number(corpo.desde) || 0;
    const recebido = corpo.progresso || {};
    const linhas = lerTudo();
    const porId = {};
    linhas.forEach(function (r) { porId[r.id] = r; });
    const quando = agora();
    const novas = [];
    Object.keys(recebido).forEach(function (id) {
      const veio = recebido[id];
      if (!veio || typeof veio !== 'object') return;
      const atual = porId[id];
      const junto = mesclar(atual ? atual.prog : null, veio);
      if (atual && JSON.stringify(junto) === JSON.stringify(atual.prog)) return;
      const linha = linhaDe(id, junto, quando);
      if (atual) {
        sh.getRange(atual.linha, 1, 1, COLUNAS.length).setValues([linha]);
        atual.prog = junto;
        atual.gravado = quando;
      } else {
        novas.push(linha);
        porId[id] = { id: id, gravado: quando, prog: junto };
      }
    });
    if (novas.length) sh.getRange(sh.getLastRow() + 1, 1, novas.length, COLUNAS.length).setValues(novas);
    // Devolve o que mudou desde a última vez daquele aparelho e, para ele
    // conferir que chegou, tudo o que acabou de mandar.
    const progresso = {};
    Object.keys(porId).forEach(function (id) {
      const r = porId[id];
      if (!desde || r.gravado > desde || recebido[id]) progresso[id] = r.prog;
    });
    return { ok: true, servidor: quando, progresso: progresso, total: Object.keys(porId).length };
  } finally {
    trava.releaseLock();
  }
}

function apagar() {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const sh = aba();
    const ultima = sh.getLastRow();
    if (ultima > 1) sh.deleteRows(2, ultima - 1);
    return { ok: true, servidor: agora() };
  } finally {
    trava.releaseLock();
  }
}

function linhaDe(id, prog, quando) {
  return [
    id,
    prog.atualizado || '',
    prog.resolvido ? 'sim' : '',
    prog.melhoresEstrelas || 0,
    prog.melhorTempo ? Math.round(prog.melhorTempo / 1000) + ' s' : '',
    JSON.stringify(prog),
    quando,
  ];
}

// Mesma regra do app (js/nuvem.js): vence o progresso mudado por último (empate,
// com as mesmas jogadas e só o cronômetro diferente: o de mais tempo); os
// recordes (melhor tempo, mais estrelas, vezes resolvido) ficam com o melhor dos dois.
function mesclar(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ta = String(a.atualizado || '');
  const tb = String(b.atualizado || '');
  const novo = tb > ta || (tb === ta && (Number(b.tempo) || 0) > (Number(a.tempo) || 0)) ? b : a;
  const outro = novo === a ? b : a;
  const out = JSON.parse(JSON.stringify(novo));
  const tempos = [a.melhorTempo, b.melhorTempo].filter(function (t) { return typeof t === 'number' && t > 0; });
  out.melhorTempo = tempos.length ? Math.min.apply(null, tempos) : (novo.melhorTempo != null ? novo.melhorTempo : (outro.melhorTempo != null ? outro.melhorTempo : null));
  out.melhoresEstrelas = Math.max(a.melhoresEstrelas || 0, b.melhoresEstrelas || 0);
  out.vezesResolvido = Math.max(a.vezesResolvido || 0, b.vezesResolvido || 0);
  return out;
}

function responder(obj, callback) {
  const json = JSON.stringify(obj);
  // JSONP: com ?callback=fn, devolve fn(json) como JavaScript (contorna CORS).
  if (callback && /^[\w.$]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
