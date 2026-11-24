// Velocidade de Vídeo: aplica a velocidade escolhida a todo <video>/<audio> da página.
// Sem rede, sem coleta: só lê/grava a velocidade no chrome.storage.
(() => {
  const PASSO = 0.5, PISO_BOTAO = 0.1;
  const NATIVO_MIN = 0.0625, NATIVO_MAX = 16;
  let ativa = 1;        // velocidade aplicada agora
  let preferida = 2;    // velocidade para a qual o R alterna

  const normalizar = v => {
    if (!Number.isFinite(v) || v <= 0) return 1;
    return (v >= 0.001 && v < 1e9) ? Math.round(v * 10000) / 10000 : v;
  };
  const fmt = v => String(v).replace('.', ',') + 'x';

  // Acha mídias inclusive dentro de shadow DOM (players modernos usam muito).
  function midias(raiz = document, lista = []) {
    raiz.querySelectorAll('video, audio').forEach(m => lista.push(m));
    raiz.querySelectorAll('*').forEach(el => { if (el.shadowRoot) midias(el.shadowRoot, lista); });
    return lista;
  }

  function aplicar(m) {
    if (Math.abs(m.playbackRate - ativa) <= 0.0001) return;
    try {
      m.playbackRate = ativa;
    } catch (_) {
      // Navegadores Chromium limitam playbackRate nativo entre 0.0625x e 16x.
      const seguro = Math.min(NATIVO_MAX, Math.max(NATIVO_MIN, ativa));
      if (Math.abs(m.playbackRate - seguro) > 0.0001) {
        try { m.playbackRate = seguro; } catch (__) { /* alguns players bloqueiam */ }
      }
    }
  }
  const aplicarTodas = () => midias().forEach(aplicar);

  // Selo com a velocidade, por 1,2 s, no canto do vídeo.
  let selo, timer;
  function mostrar(texto) {
    const alvo = midias().find(m => m.tagName === 'VIDEO' && m.offsetWidth > 0) || null;
    if (!selo) {
      selo = document.createElement('div');
      selo.style.cssText = 'position:fixed;z-index:2147483647;padding:6px 12px;border-radius:10px;' +
        'background:rgba(15,18,25,.84);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
        'border:1px solid rgba(255,255,255,.14);box-shadow:0 6px 20px rgba(0,0,0,.38);' +
        'color:#f8fafc;font:700 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
        'font-variant-numeric:tabular-nums;pointer-events:none;transition:opacity .2s ease';
    }
    const r = alvo ? alvo.getBoundingClientRect() : { top: 0, left: 0 };
    selo.style.top = Math.max(8, r.top + 10) + 'px';
    selo.style.left = Math.max(8, r.left + 10) + 'px';
    selo.textContent = texto;
    selo.style.opacity = '1';
    (document.fullscreenElement || document.body || document.documentElement).appendChild(selo);
    clearTimeout(timer);
    timer = setTimeout(() => { selo.style.opacity = '0'; }, 1200);
  }

  function definir(v, { salvar = true, aviso = true } = {}) {
    ativa = normalizar(v);
    if (ativa !== 1) preferida = ativa;
    aplicarTodas();
    if (aviso) {
      let texto = fmt(ativa);
      if (ativa > NATIVO_MAX) texto += ' (máx. 16x)';
      else if (ativa < NATIVO_MIN) texto += ' (mín. 0,0625x)';
      mostrar(texto);
    }
    if (salvar) chrome.storage.sync.set({ ativa, preferida });
  }

  // Sites (YouTube etc.) zeram a velocidade a cada vídeo novo: reaplica ao carregar/tocar.
  for (const ev of ['play', 'loadeddata', 'loadedmetadata']) {
    document.addEventListener(ev, e => {
      if (e.target instanceof HTMLMediaElement) aplicar(e.target);
    }, true);
  }

  function digitando(e) {
    const el = e.composedPath()[0] || e.target;
    if (!el || !el.tagName) return false;
    return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || !e.key) return;
    const k = e.key.toLowerCase();
    if (!['d', 's', 'r'].includes(k) || digitando(e) || !midias().length) return;
    if (k === 'd') definir(ativa + PASSO);
    else if (k === 's') {
      const prox = ativa - PASSO;
      definir(prox >= PISO_BOTAO ? prox : Math.min(ativa, PISO_BOTAO));
    }
    else if (k === 'r') definir(ativa === 1 ? preferida : 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // Mudança feita no popup ou em outra aba.
  chrome.storage.onChanged.addListener(mud => {
    if (mud.preferida) preferida = mud.preferida.newValue;
    if (mud.ativa && mud.ativa.newValue !== ativa) {
      definir(mud.ativa.newValue, { salvar: false, aviso: !document.hidden });
    }
  });

  chrome.storage.sync.get({ ativa: 1, preferida: 2 }, d => {
    preferida = d.preferida;
    definir(d.ativa, { salvar: false, aviso: false });
  });
})();
