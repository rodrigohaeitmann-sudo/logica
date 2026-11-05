// Progresso na nuvem: sincroniza o progresso salvo no aparelho (localStorage)
// com uma planilha Google do jogador, por um Apps Script Web App
// (apps-script/Code.gs, mesmo esquema do TEMa Estudo: URL /exec + token).
//
// Como funciona:
// - cada jogada salva entra em `pendentes`; alguns segundos depois (ou ao sair
//   do app) elas vão para a planilha. Salvamentos só do cronômetro não mudam
//   `atualizado` (ver estado.js) e vão junto na próxima vez, sem chamar o script;
// - a planilha devolve o que mudou desde a última sincronização deste aparelho
//   (`desde`, relógio do servidor, com margem) e confirma o que recebeu; o app
//   mescla: por desafio, vence o progresso mudado por último (empate: o de mais
//   tempo); recordes (melhor tempo, estrelas, vezes resolvido) ficam com o
//   melhor dos dois. O que a planilha não confirmou continua pendente;
// - na primeira sincronização (ou depois de reconectar) vai tudo e volta tudo:
//   é assim que o progresso reaparece se o celular apagar os dados;
// - o desafio aberto na tela só é trocado se outro aparelho mexeu nele depois
//   (aí a tela recarrega com o progresso de lá).
// Também há a cópia manual: um arquivo .json para guardar onde quiser.

import * as estado from './estado.js';
import { esc } from './ui.js';

const URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const ATRASO = 5000; // espera depois da última jogada
const ATRASO_MAX = 30000; // jogando sem parar, sobe pelo menos a cada 30 s
// Ao pedir "o que mudou desde…", recua um minuto: servidores do Google podem ter
// relógios um pouco diferentes, e receber de novo o que já está aqui não muda nada.
const MARGEM = 60000;
const NADA = Number.MAX_SAFE_INTEGER; // "desde" que não traz nada de volta
const MSG_DURA = 60000; // avisos do cartão dão lugar ao status depois disso
const SCRIPT_GITHUB = 'https://github.com/rodrigohaeitmann-sudo/logica/blob/main/apps-script/Code.gs';

let opcoes = { aoMudar() {}, jogoAberto: () => null, recarregarJogo() {} };
let timer = null;
let primeiraPendencia = 0;
let emAndamento = null;
let conectando = false;
let el = null; // cartão em Ajustes
let msg = { texto: '', erro: false, quando: 0 };

class ErroNuvem extends Error {
  constructor(m, tipo) {
    super(m);
    this.tipo = tipo; // 'url' | 'rede' | 'login' | 'resposta' | 'api' | 'confirmacao'
  }
}

// ---------------------------------------------------------------------------
// Regra de mescla (igual à do Code.gs)
// ---------------------------------------------------------------------------

export function mesclar(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ta = String(a.atualizado || '');
  const tb = String(b.atualizado || '');
  // vence o mudado por último; empate (mesmas jogadas, só o cronômetro andou): o de mais tempo
  const novo = tb > ta || (tb === ta && (Number(b.tempo) || 0) > (Number(a.tempo) || 0)) ? b : a;
  const outro = novo === a ? b : a;
  const out = JSON.parse(JSON.stringify(novo));
  const tempos = [a.melhorTempo, b.melhorTempo].filter((t) => typeof t === 'number' && t > 0);
  out.melhorTempo = tempos.length ? Math.min(...tempos) : (novo.melhorTempo ?? outro.melhorTempo ?? null);
  out.melhoresEstrelas = Math.max(a.melhoresEstrelas || 0, b.melhoresEstrelas || 0);
  out.vezesResolvido = Math.max(a.vezesResolvido || 0, b.vezesResolvido || 0);
  return out;
}

// Mesmo conteúdo, qualquer que seja a ordem das chaves (campo vazio = ausente).
function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => v[k] != null)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

function igual(a, b) {
  return canonico(a) === canonico(b);
}

// ---------------------------------------------------------------------------
// Configuração e pendências
// ---------------------------------------------------------------------------

function cfg() {
  return estado.getNuvem();
}

export function configurada() {
  const c = cfg();
  return !!(c && c.url && c.token);
}

function atualizarCfg(mudar) {
  const c = cfg();
  if (!c) return null;
  mudar(c);
  estado.salvarNuvem(c);
  return c;
}

const mesmaConta = (x, c) => !!x && x.url === c.url && x.token === c.token;

function marcarPendente(id, novo, anterior) {
  if (!configurada()) return;
  atualizarCfg((c) => {
    c.pendentes = Array.isArray(c.pendentes) ? c.pendentes : [];
    if (!c.pendentes.includes(id)) c.pendentes.push(id);
  });
  // Só o cronômetro (ou a dica à vista) mudou: vai junto na próxima sincronização.
  if (novo && anterior && novo.atualizado === anterior.atualizado) return;
  agendar();
}

function agendar() {
  const t = Date.now();
  if (!primeiraPendencia) primeiraPendencia = t;
  clearTimeout(timer);
  const espera = Math.max(0, Math.min(ATRASO, primeiraPendencia + ATRASO_MAX - t));
  timer = setTimeout(() => {
    primeiraPendencia = 0;
    sincronizar({ silencioso: true });
  }, espera);
}

// ---------------------------------------------------------------------------
// Conversa com o Apps Script
// ---------------------------------------------------------------------------

function traduzir(raw) {
  const e = String(raw || '');
  if (/invalid token/i.test(e)) return 'Senha errada: ela precisa ser igual à propriedade API_TOKEN do script (Configurações do projeto › Propriedades do script).';
  if (/API_TOKEN/.test(e)) return 'O script ainda não tem a propriedade API_TOKEN (Configurações do projeto › Propriedades do script).';
  return `Erro do script: ${e || 'sem detalhes'}`;
}

function lerResposta(texto) {
  const t = texto.trim();
  if (t.startsWith('<')) {
    if (/accounts\.google\.com|ServiceLogin|Fazer login|Sign in/i.test(t)) {
      throw new ErroNuvem('O Google pediu login em vez de responder. Na implantação, “Quem pode acessar” precisa ser “Qualquer pessoa”.', 'login');
    }
    const plano = t
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    throw new ErroNuvem(
      `O script respondeu com uma página de erro do Google${plano ? ` (“${plano.slice(0, 100)}”)` : ''}. Confira se colou o script inteiro e se a implantação é “App da Web” com acesso “Qualquer pessoa”.`,
      'resposta',
    );
  }
  let r;
  try {
    r = JSON.parse(t);
  } catch {
    throw new ErroNuvem(`Resposta inesperada do script: ${t.slice(0, 120)}`, 'resposta');
  }
  if (!r || !r.ok) throw new ErroNuvem(traduzir(r && r.error), 'api');
  return r;
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = `logicacb_${Math.random().toString(36).slice(2)}`;
    const s = document.createElement('script');
    let feito = false;
    const fim = (fn) => {
      if (feito) return;
      feito = true;
      clearTimeout(t);
      delete window[cb];
      s.remove();
      fn();
    };
    const t = setTimeout(() => fim(() => reject(new ErroNuvem('O script demorou demais para responder.', 'rede'))), 20000);
    window[cb] = (dados) => fim(() => resolve(dados));
    s.onerror = () => fim(() => reject(new ErroNuvem('Não consegui falar com o script. Confira se a URL termina em /exec e se a implantação está com acesso “Qualquer pessoa”.', 'rede')));
    s.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cb}`;
    document.head.appendChild(s);
  });
}

// POST text/plain (pedido "simples", sem preflight de CORS). Se o navegador não
// deixar ler a resposta, envia às cegas (no-cors) e lê pelo GET com JSONP — com
// tudo o que está na planilha, para conferir se o envio chegou.
async function chamar(url, token, dados) {
  if (!URL_RE.test(url)) {
    throw new ErroNuvem('A URL precisa começar com https://script.google.com/macros/s/ e terminar em /exec (é a URL da implantação, não a do editor).', 'url');
  }
  const corpo = JSON.stringify({ token, ...dados });
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corpo, redirect: 'follow' });
    return lerResposta(await res.text());
  } catch (err) {
    if (err instanceof ErroNuvem) throw err;
    if (!navigator.onLine) throw new ErroNuvem('Sem internet agora.', 'rede');
    const conferir = dados.action === 'sincronizar' && dados.progresso && Object.keys(dados.progresso).length > 0;
    if (dados.action !== 'ping') {
      try {
        await fetch(url, { method: 'POST', mode: 'no-cors', credentials: 'include', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corpo });
      } catch {
        throw new ErroNuvem('Não consegui falar com o script agora.', 'rede');
      }
    }
    const acao = dados.action === 'ping' ? 'ping' : 'ler';
    const desde = conferir ? 0 : dados.desde || 0;
    const r = await jsonp(`${url}?action=${acao}&token=${encodeURIComponent(token)}&desde=${encodeURIComponent(desde)}`);
    if (!r || !r.ok) throw new ErroNuvem(traduzir(r && r.error), 'api');
    return r;
  }
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

// Traz o que veio da planilha para o aparelho. O desafio aberto na tela só muda
// se outro aparelho mexeu nele depois; senão o que está na tela é o mais novo
// (e vai para a planilha na próxima vez).
function aplicarRemoto(remoto) {
  const todos = estado.todosProgressos();
  const aberto = opcoes.jogoAberto();
  const mudou = [];
  let recarregar = false;
  for (const [id, r] of Object.entries(remoto || {})) {
    if (!r || typeof r !== 'object') continue;
    const local = todos[id];
    if (id === aberto && local && !(String(r.atualizado || '') > String(local.atualizado || ''))) continue;
    const junto = mesclar(local, r);
    if (!local || !igual(junto, local)) {
      todos[id] = junto;
      mudou.push(id);
      if (id === aberto) recarregar = true;
    }
  }
  if (mudou.length) estado.gravarProgressos(todos);
  return { mudou, recarregar };
}

// A planilha tem o que foi enviado? (juntar o enviado ao que ela devolveu não muda nada)
function confirmado(enviado, voltou) {
  return !!voltou && igual(mesclar(voltou, enviado), voltou);
}

export function sincronizar({ silencioso = false } = {}) {
  if (!configurada()) return Promise.resolve(null);
  if (emAndamento) {
    // já há uma em curso: roda de novo logo depois, com o que tiver mudado
    return emAndamento.catch(() => null).then(() => sincronizar({ silencioso }));
  }
  clearTimeout(timer);
  primeiraPendencia = 0;
  const c = cfg();
  emAndamento = (async () => {
    const todos = estado.todosProgressos();
    const ids = c.desde ? (c.pendentes || []).filter((id) => todos[id]) : Object.keys(todos);
    const enviados = {};
    for (const id of ids) enviados[id] = todos[id];
    let resultado = null;
    try {
      if (c.apagar) {
        await chamar(c.url, c.token, { action: 'apagar' });
        atualizarCfg((x) => {
          if (mesmaConta(x, c)) delete x.apagar;
        });
      }
      const r = await chamar(c.url, c.token, { action: 'sincronizar', desde: c.desde || 0, progresso: enviados });
      if (!mesmaConta(cfg(), c)) return null; // desligado ou trocado no meio do caminho
      const voltou = r.progresso || {};
      const { mudou, recarregar } = aplicarRemoto(voltou);
      const naoSubiu = ids.filter((id) => !confirmado(enviados[id], voltou[id]));
      atualizarCfg((x) => {
        const agora = estado.todosProgressos();
        x.pendentes = (x.pendentes || []).filter((id) => {
          if (!enviados[id] || naoSubiu.includes(id)) return true; // entrou na fila agora, ou não chegou
          const daqui = agora[id];
          // mudou de novo durante a sincronização (e não só com o que veio da planilha)
          return !!daqui && !igual(daqui, enviados[id]) && !igual(daqui, voltou[id]);
        });
        x.desde = Math.max(1, (Number(r.servidor) || Date.now()) - MARGEM);
        x.ultima = naoSubiu.length
          ? {
              quando: Date.now(),
              ok: false,
              tipo: 'confirmacao',
              msg: `a planilha não confirmou ${naoSubiu.length === 1 ? '1 desafio' : `${naoSubiu.length} desafios`}; vou tentar de novo.`,
            }
          : { quando: Date.now(), ok: true, total: r.total ?? null };
        if (!naoSubiu.length) x.okEm = Date.now();
      });
      resultado = { enviados: ids.length, recebidos: mudou.length, naoSubiu: naoSubiu.length };
      if (mudou.length) opcoes.aoMudar(mudou);
      if (recarregar) opcoes.recarregarJogo();
      return resultado;
    } catch (err) {
      atualizarCfg((x) => {
        if (mesmaConta(x, c)) x.ultima = { quando: Date.now(), ok: false, tipo: err.tipo || 'rede', msg: err.message || String(err) };
      });
      if (!silencioso) throw err;
      return null;
    } finally {
      emAndamento = null;
      renderNuvem();
      if (!resultado || !resultado.recebidos) opcoes.aoMudar([]); // atualiza o aviso da tela inicial
    }
  })();
  renderNuvem();
  return emAndamento;
}

// Ao abrir Ajustes: manda o que estiver esperando, para o status ficar em dia.
export function sincronizarPendentes() {
  const c = cfg();
  if (configurada() && !emAndamento && (c.pendentes || []).length) sincronizar({ silencioso: true });
}

// Ao sair do app: manda as pendências sem esperar resposta. Elas continuam na
// fila até uma sincronização normal confirmar que chegaram.
function enviarAoSair() {
  const c = cfg();
  if (!c || !c.url || !c.token || !(c.pendentes || []).length || !URL_RE.test(c.url)) return;
  const todos = estado.todosProgressos();
  const progresso = {};
  for (const id of c.pendentes) if (todos[id]) progresso[id] = todos[id];
  try {
    fetch(c.url, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: c.token, action: 'sincronizar', desde: NADA, progresso }),
    }).catch(() => {});
  } catch {
    /* sem rede, ou pacote grande demais para keepalive: vai na próxima */
  }
}

export async function conectar(url, token) {
  url = String(url || '').trim();
  token = String(token || '').trim();
  if (!url || !token) throw new ErroNuvem('Cole a URL do script e a senha.', 'url');
  const r = await chamar(url, token, { action: 'ping' });
  const agora = Date.now();
  estado.salvarNuvem({ url, token, desde: 0, pendentes: [], ultima: { quando: agora, ok: true, total: r.total ?? null }, okEm: agora });
  return sincronizar();
}

export function desconectar() {
  clearTimeout(timer);
  estado.salvarNuvem(null);
}

// Apaga também na planilha (agora, ou na próxima sincronização se estiver sem rede).
export async function apagarNaNuvem() {
  if (!configurada()) return;
  atualizarCfg((c) => {
    c.apagar = true;
    c.pendentes = [];
    c.desde = 0;
  });
  try {
    await sincronizar();
  } catch {
    /* fica marcado para a próxima */
  }
}

// Aviso para a tela inicial quando o progresso não está chegando à planilha
// (falta de internet só conta depois de alguns dias: é passageira).
export function avisoHome() {
  if (!configurada()) return '';
  const c = cfg();
  const u = c.ultima;
  if (!u || u.ok) return '';
  if (u.tipo === 'rede' && Date.now() - (c.okEm || 0) < 3 * 864e5) return '';
  return 'O progresso não está indo para a planilha.';
}

// ---------------------------------------------------------------------------
// Cópia manual
// ---------------------------------------------------------------------------

function nomeArquivo() {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, '0');
  return `logica-progresso-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}.json`;
}

async function baixarCopia() {
  const dados = JSON.stringify({ app: 'logica', versao: 1, criado: new Date().toISOString(), progresso: estado.todosProgressos() }, null, 1);
  const arquivo = new File([dados], nomeArquivo(), { type: 'application/json' });
  // No celular, a folha de compartilhar deixa salvar direto no Drive ou em Arquivos.
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Progresso do Lógica' });
      return 'Cópia pronta.';
    } catch (err) {
      if (err && err.name === 'AbortError') return '';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(arquivo);
  a.download = arquivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return `Cópia salva: ${arquivo.name}.`;
}

async function restaurarCopia(arquivo) {
  let dados;
  try {
    dados = JSON.parse(await arquivo.text());
  } catch {
    throw new Error('Esse arquivo não é uma cópia do Lógica.');
  }
  if (!dados || dados.app !== 'logica' || typeof dados.progresso !== 'object' || !dados.progresso) {
    throw new Error('Esse arquivo não é uma cópia do Lógica.');
  }
  const todos = estado.todosProgressos();
  const novos = [];
  for (const [id, p] of Object.entries(dados.progresso)) {
    if (!p || typeof p !== 'object') continue;
    const junto = mesclar(todos[id], p);
    if (!todos[id] || !igual(junto, todos[id])) {
      todos[id] = junto;
      novos.push(id);
    }
  }
  if (!novos.length) return 'Nada a restaurar: o aparelho já tinha tudo o que está na cópia.';
  estado.gravarProgressos(todos);
  if (configurada()) {
    atualizarCfg((c) => {
      c.pendentes = Array.isArray(c.pendentes) ? c.pendentes : [];
      for (const id of novos) if (!c.pendentes.includes(id)) c.pendentes.push(id);
    });
  }
  opcoes.aoMudar(novos);
  if (configurada()) await sincronizar({ silencioso: true });
  const n = novos.length;
  return `Cópia restaurada: ${n} ${n === 1 ? 'desafio atualizado' : 'desafios atualizados'}.`;
}

// ---------------------------------------------------------------------------
// Cartão em Ajustes
// ---------------------------------------------------------------------------

function quandoTexto(ms) {
  const d = new Date(ms);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 864e5);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoje.toDateString()) return `hoje às ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem às ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora}`;
}

const PASSOS = `<ol class="instalar-passos">
  <li>No Google Drive, crie uma planilha nova (por exemplo, <b>Lógica — progresso</b>).</li>
  <li>Na planilha, abra <b>Extensões → Apps Script</b>, apague o que houver, cole o script e salve:
    <button class="link-acao" data-acao="nuvem-copiar-script">copiar o script</button> ·
    <a class="link-acao" href="${SCRIPT_GITHUB}" target="_blank" rel="noopener">ver no GitHub</a></li>
  <li>Na engrenagem (<b>Configurações do projeto</b>) → <b>Propriedades do script</b>, adicione <b>API_TOKEN</b> com uma senha que você inventar.</li>
  <li><b>Implantar → Nova implantação</b> → tipo <b>App da Web</b>. Executar como: <b>Eu</b>; Quem pode acessar: <b>Qualquer pessoa</b>. Autorize o acesso.</li>
  <li>Copie a URL que termina em <b>/exec</b> e cole aqui embaixo, com a mesma senha.</li>
</ol>
<p class="instalar-txt">Guarde a URL e a senha (numa nota, por exemplo): se o celular apagar os dados de novo, é só colar aqui que o progresso volta.</p>`;

function statusAtual() {
  if (emAndamento) return { texto: 'Sincronizando…', erro: false };
  if (conectando) return { texto: 'Conectando…', erro: false };
  const c = cfg();
  const u = configurada() && c.ultima;
  // o aviso de uma ação vale até uma sincronização mais nova (ou por um minuto)
  if (msg.texto && Date.now() - msg.quando < MSG_DURA && (!u || msg.quando >= u.quando)) return msg;
  if (!u) return { texto: '', erro: false };
  let texto = u.ok
    ? `Última sincronização: ${quandoTexto(u.quando)}${u.total != null ? ` · ${u.total} ${u.total === 1 ? 'desafio' : 'desafios'} na planilha` : ''}.`
    : `Não sincronizou (${quandoTexto(u.quando)}): ${u.msg}`;
  const pend = (c.pendentes || []).length;
  if (pend && u.ok) texto += ` ${pend === 1 ? '1 desafio vai' : `${pend} desafios vão`} na próxima sincronização.`;
  return { texto, erro: !u.ok };
}

function desenharCartao(forma) {
  const c = cfg();
  // o que estava digitado continua (ex.: ao desligar, para religar sem colar de novo)
  const urlAntes = el.querySelector('#nuvem-url')?.value;
  const tokAntes = el.querySelector('#nuvem-token')?.value;
  let h;
  if (forma === 'lig') {
    h = `<p class="instalar-txt"><b>Ligado à sua planilha.</b> O progresso sincroniza sozinho ao abrir o app e alguns segundos depois de cada jogada.</p>
      <p class="nuvem-status" id="nuvem-status" hidden></p>
      <button class="btn-secondary" data-acao="nuvem-sincronizar">Sincronizar agora</button>
      <details class="instalar-ajuda"><summary>Trocar a planilha ou a senha</summary>
        <label class="campo"><span>URL do script</span><input id="nuvem-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" value="${esc(c.url)}"></label>
        <label class="campo"><span>Senha (API_TOKEN)</span><input id="nuvem-token" type="password" autocomplete="off" value="${esc(c.token)}"></label>
        <button class="btn-secondary" data-acao="nuvem-conectar">Salvar e sincronizar</button>
        <button class="link-fechar" data-acao="nuvem-desconectar">Desligar deste aparelho</button>
      </details>`;
  } else {
    h = `<p class="instalar-txt">Guarde o progresso numa planilha Google sua: ele sincroniza sozinho e volta se o celular apagar os dados (ou se você jogar em outro aparelho).</p>
      <details class="instalar-ajuda"><summary>Como configurar (uma vez, de preferência no computador)</summary>${PASSOS}</details>
      <label class="campo"><span>URL do script</span><input id="nuvem-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label class="campo"><span>Senha (API_TOKEN)</span><input id="nuvem-token" type="password" autocomplete="off"></label>
      <button class="btn-primary" data-acao="nuvem-conectar">Conectar e sincronizar</button>
      <p class="nuvem-status" id="nuvem-status" hidden></p>`;
  }
  h += `<div class="nuvem-sub">Cópia manual</div>
    <p class="instalar-txt">Um arquivo com todo o progresso, para guardar onde quiser (Drive, e-mail…) e restaurar depois.</p>
    <div class="nuvem-botoes">
      <button class="btn-secondary" data-acao="copia-baixar">Salvar cópia</button>
      <button class="btn-secondary" data-acao="copia-restaurar">Restaurar cópia</button>
    </div>
    <input type="file" id="copia-arquivo" accept="application/json,.json" hidden>`;
  el.innerHTML = h;
  el.dataset.forma = forma;
  if (forma === 'des') {
    if (urlAntes) el.querySelector('#nuvem-url').value = urlAntes;
    if (tokAntes) el.querySelector('#nuvem-token').value = tokAntes;
  }
}

// Redesenha o cartão só quando muda de forma (ligado/desligado); fora isso
// atualiza o status e os botões no lugar, sem tirar o foco de quem digita.
export function renderNuvem() {
  if (!el) return;
  const forma = configurada() ? 'lig' : 'des';
  if (el.dataset.forma !== forma) desenharCartao(forma);
  const { texto, erro } = statusAtual();
  const st = el.querySelector('#nuvem-status');
  st.textContent = texto;
  st.hidden = !texto;
  st.classList.toggle('erro', !!erro);
  const ocupado = !!emAndamento || conectando;
  el.querySelectorAll('[data-acao="nuvem-sincronizar"], [data-acao="nuvem-conectar"]').forEach((b) => {
    b.disabled = ocupado;
  });
}

function avisar(texto, erro = false) {
  msg = { texto, erro, quando: Date.now() };
  renderNuvem();
}

function textoConectado(r) {
  const veio = r && r.recebidos ? `${r.recebidos} ${r.recebidos === 1 ? 'desafio veio' : 'desafios vieram'} da planilha` : '';
  if (veio && r.enviados) return `Conectado. ${veio}; o progresso deste aparelho também foi para lá.`;
  if (veio) return `Conectado. ${veio}.`;
  if (r && r.enviados) return 'Conectado. O progresso deste aparelho foi para a planilha.';
  return 'Conectado. A planilha está vazia: o progresso vai para lá a cada jogada.';
}

async function copiarScript() {
  try {
    const r = await fetch('apps-script/Code.gs', { cache: 'no-cache' });
    if (!r.ok) throw new Error();
    await navigator.clipboard.writeText(await r.text());
    avisar('Script copiado. Cole no editor do Apps Script.');
  } catch {
    window.open(SCRIPT_GITHUB, '_blank', 'noopener');
  }
}

function ligarCartao() {
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    try {
      if (acao === 'nuvem-conectar') {
        if (conectando) return;
        const url = el.querySelector('#nuvem-url').value;
        const token = el.querySelector('#nuvem-token').value;
        const trocando = el.dataset.forma === 'lig';
        conectando = true;
        msg = { texto: '', erro: false, quando: 0 };
        renderNuvem();
        let r;
        try {
          r = await conectar(url, token);
        } finally {
          conectando = false;
        }
        if (trocando) el.querySelector('details.instalar-ajuda')?.removeAttribute('open');
        avisar(r && r.naoSubiu ? 'Conectado, mas a planilha não confirmou parte do envio; vou tentar de novo.' : textoConectado(r), !!(r && r.naoSubiu));
      } else if (acao === 'nuvem-sincronizar') {
        msg = { texto: '', erro: false, quando: 0 };
        const r = await sincronizar();
        if (r && r.naoSubiu) avisar(`A planilha não confirmou ${r.naoSubiu === 1 ? '1 desafio' : `${r.naoSubiu} desafios`}; vou tentar de novo.`, true);
        else avisar(r && r.recebidos ? `Sincronizado: ${r.recebidos} ${r.recebidos === 1 ? 'desafio atualizado' : 'desafios atualizados'} da planilha.` : 'Sincronizado. Está tudo igual ao da planilha.');
      } else if (acao === 'nuvem-desconectar') {
        desconectar();
        avisar('Desligado deste aparelho. O progresso continua aqui e na planilha.');
      } else if (acao === 'nuvem-copiar-script') {
        await copiarScript();
      } else if (acao === 'copia-baixar') {
        const m = await baixarCopia();
        if (m) avisar(m);
      } else if (acao === 'copia-restaurar') {
        el.querySelector('#copia-arquivo').click();
      }
    } catch (err) {
      avisar(err.message || String(err), true);
    }
  });
  el.addEventListener('change', async (e) => {
    if (e.target.id !== 'copia-arquivo' || !e.target.files || !e.target.files[0]) return;
    const arquivo = e.target.files[0];
    e.target.value = '';
    try {
      avisar(await restaurarCopia(arquivo));
    } catch (err) {
      avisar(err.message || String(err), true);
    }
  });
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

// op: { aoMudar(ids), jogoAberto() → id | null, recarregarJogo() }
export function iniciarNuvem(op = {}) {
  opcoes = { ...opcoes, ...op };
  el = document.getElementById('nuvem');
  if (el) ligarCartao();
  estado.aoSalvarProgresso(marcarPendente);
  window.addEventListener('online', () => sincronizar({ silencioso: true }));
  // O jogo registra os seus ouvintes antes (app.js chama jogo.configurar
  // primeiro): ao esconder o app, ele salva e só então este envia.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') enviarAoSair();
    else {
      // de volta ao app: traz o que mudou em outro aparelho (no máximo 1x por minuto)
      const u = cfg()?.ultima;
      if (configurada() && (!u || Date.now() - u.quando > 60000)) sincronizar({ silencioso: true });
    }
  });
  window.addEventListener('pagehide', enviarAoSair);
  renderNuvem();
  return sincronizar({ silencioso: true });
}
