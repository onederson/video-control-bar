// Barra de controles flutuante (Shadow DOM) para vídeos que não exibem controles nativos (ex.: Instagram, TikTok).
// Ativada por padrão em sites conhecidos e alternável por site no popup ou pela tecla C.
(() => {
  const SITES_PADRAO = ['instagram.com', 'tiktok.com', 'threads.net', 'threads.com'];
  const normalizarHost = h => (h || '').toLowerCase().replace(/^www\./, '');
  const ehSitePadrao = host => SITES_PADRAO.some(s => host === s || host.endsWith('.' + s));
  const hostAtual = normalizarHost(location.hostname);

  const barraAtivaNoSite = mapa => {
    if (!hostAtual) return false;
    if (mapa && Object.prototype.hasOwnProperty.call(mapa, hostAtual)) return Boolean(mapa[hostAtual]);
    return ehSitePadrao(hostAtual);
  };

  let mapaSites = {};
  let habilitado = false;
  let preferida = 2;

  let hostEl = null;
  let shadow = null;
  let barraEl = null;
  let btnPlay = null;
  let btnVoltar = null;
  let btnAvancar = null;
  let tempoEl = null;
  let seekEl = null;
  let seekTip = null;
  let btnMute = null;
  let volEl = null;
  let btnVel = null;
  let btnPip = null;
  let btnFs = null;

  let alvo = null;
  let videoHover = null;
  let sobreBarra = false;
  let arrastando = false;
  let ativoRecentemente = false;
  let timerOcultar = null;
  let rafId = null;
  let ultimoRect = '';

  // Cache de estado visual para evitar reescrever DOM/SVG a cada frame (o que quebrava cliques).
  let uiPlay = '';
  let uiMute = '';
  let uiFs = '';
  let uiTempo = '';
  let uiVel = '';
  let uiVolPct = -1;
  let uiSeekVal = '';

  // Preferência de volume definida pelo usuário na barra (protege contra sites que resetam muted ao pausar).
  let volUsuario = null; // { volume: number, muted: boolean }
  let videosCache = [];
  let ultimoScanVideos = 0;
  let ultimoScanShadow = 0;

  const ICO = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    voltar: '<svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>',
    avancar: '<svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>',
    volAlto: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    volBaixo: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',
    mudo: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>',
    fsEntrar: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    fsSair: '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
  };

  function buscarVideosShadow(raiz, lista) {
    raiz.querySelectorAll('video').forEach(v => lista.push(v));
    raiz.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot && el !== hostEl) buscarVideosShadow(el.shadowRoot, lista);
    });
    return lista;
  }

  function listarVideos(forcar = false) {
    const agora = performance.now();
    if (!forcar && videosCache.length && (agora - ultimoScanVideos) < 300) {
      return videosCache;
    }
    ultimoScanVideos = agora;
    const diretos = Array.from(document.querySelectorAll('video'));
    if (diretos.length > 0) {
      videosCache = diretos;
      return videosCache;
    }
    if (forcar || (agora - ultimoScanShadow) > 1000) {
      ultimoScanShadow = agora;
      videosCache = buscarVideosShadow(document, []);
    }
    return videosCache;
  }

  function restaurarVolume(video, estado) {
    if (!video || !estado) return;
    const aplicar = () => {
      if (!video.isConnected) return;
      if (video.muted !== estado.muted) video.muted = estado.muted;
      if (Math.abs(video.volume - estado.volume) > 0.01) video.volume = estado.volume;
    };
    aplicar();
    queueMicrotask(aplicar);
    setTimeout(aplicar, 60);
    setTimeout(aplicar, 180);
  }

  function fmtTempo(seg) {
    if (!Number.isFinite(seg) || seg < 0) return '0:00';
    const total = Math.floor(seg);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const ss = String(s).padStart(2, '0');
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
    return `${m}:${ss}`;
  }

  function fmtVel(v) {
    const n = (v >= 0.001 && v < 1e9) ? Math.round(v * 100) / 100 : v;
    return String(n).replace('.', ',') + 'x';
  }

  function areaVisivel(r) {
    const x1 = Math.max(0, r.left);
    const y1 = Math.max(0, r.top);
    const x2 = Math.min(window.innerWidth, r.right);
    const y2 = Math.min(window.innerHeight, r.bottom);
    if (x2 <= x1 || y2 <= y1) return 0;
    return (x2 - x1) * (y2 - y1);
  }

  function escolherVideo() {
    if (arrastando && alvo && alvo.isConnected) return alvo;

    const fs = document.fullscreenElement;
    if (fs) {
      if (fs.tagName === 'VIDEO') return fs;
      const dentroFs = Array.from(fs.querySelectorAll('video')).find(v => {
        const r = v.getBoundingClientRect();
        return r.width >= 120 && r.height >= 80;
      });
      if (dentroFs) return dentroFs;
    }

    const candidatos = [];
    for (const v of listarVideos()) {
      if (!v.isConnected) continue;
      const r = v.getBoundingClientRect();
      if (r.width < 120 || r.height < 80) continue;
      const area = areaVisivel(r);
      if (area < 4000) continue;
      candidatos.push({ v, area, tocando: !v.paused && !v.ended });
    }
    if (!candidatos.length) return null;

    if (videoHover && candidatos.some(c => c.v === videoHover)) {
      return videoHover;
    }

    candidatos.sort((a, b) => {
      if (a.tocando !== b.tocando) return a.tocando ? -1 : 1;
      return b.area - a.area;
    });
    return candidatos[0].v;
  }

  function acordarBarra() {
    ativoRecentemente = true;
    clearTimeout(timerOcultar);
    timerOcultar = setTimeout(() => {
      ativoRecentemente = false;
      atualizarVisibilidade();
    }, 2500);
    atualizarVisibilidade();
  }

  function atualizarVisibilidade() {
    if (!barraEl) return;
    const mostrar = Boolean(
      habilitado &&
      alvo &&
      (sobreBarra || arrastando || ativoRecentemente || alvo.paused)
    );
    barraEl.classList.toggle('oculta', !mostrar);
  }

  // Selo rápido quando o usuário alterna pela tecla C.
  let toastEl, toastTimer;
  function mostrarToast(texto) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;padding:7px 13px;border-radius:10px;' +
        'background:rgba(15,18,25,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
        'border:1px solid rgba(255,255,255,.14);box-shadow:0 6px 20px rgba(0,0,0,.38);' +
        'color:#f8fafc;font:600 13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
        'pointer-events:none;transition:opacity .2s ease';
    }
    toastEl.textContent = texto;
    toastEl.style.opacity = '1';
    (document.fullscreenElement || document.body || document.documentElement).appendChild(toastEl);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 1400);
  }

  function criarBarra() {
    if (hostEl) return;
    hostEl = document.createElement('div');
    hostEl.setAttribute('data-vv-controls-host', '');
    hostEl.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;display:none;';
    shadow = hostEl.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .barra {
          pointer-events: auto;
          width: 100%;
          padding: 7px 11px 8px;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(17, 21, 30, 0.80) 0%, rgba(11, 14, 20, 0.94) 100%);
          backdrop-filter: blur(12px) saturate(1.2);
          -webkit-backdrop-filter: blur(12px) saturate(1.2);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          color: #f8fafc;
          font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          user-select: none;
          transition: opacity .22s ease, transform .22s ease;
          opacity: 1;
          transform: translateY(0);
        }
        .barra.oculta {
          opacity: 0;
          transform: translateY(4px);
          pointer-events: none;
        }

        .seek-wrap {
          position: relative;
          display: flex;
          align-items: center;
          height: 16px;
          margin-bottom: 4px;
        }
        .seek-tip {
          position: absolute;
          bottom: 20px;
          left: 0;
          transform: translateX(-50%);
          padding: 3px 7px;
          border-radius: 6px;
          background: rgba(11, 14, 20, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #fff;
          font: 600 11px/1.2 system-ui, sans-serif;
          font-variant-numeric: tabular-nums;
          pointer-events: none;
          opacity: 0;
          transition: opacity .12s ease;
          white-space: nowrap;
        }
        .seek-tip.visivel { opacity: 1; }

        input[type=range] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          margin: 0;
        }
        input[type=range]:focus { outline: none; }

        .seek {
          width: 100%;
          height: 4px;
          border-radius: 99px;
          background: linear-gradient(
            to right,
            #3b82f6 0%,
            #60a5fa var(--prog, 0%),
            rgba(255,255,255,.32) var(--prog, 0%),
            rgba(255,255,255,.32) var(--buf, 0%),
            rgba(255,255,255,.16) var(--buf, 0%),
            rgba(255,255,255,.16) 100%
          );
          transition: height .14s ease;
        }
        .seek-wrap:hover .seek { height: 6px; }
        .seek::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px; height: 12px; border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35), 0 1px 4px rgba(0, 0, 0, 0.55);
          transform: scale(0.82);
          transition: transform .14s ease;
        }
        .seek-wrap:hover .seek::-webkit-slider-thumb { transform: scale(1.12); }
        .seek:disabled { opacity: .4; cursor: default; }

        .linha { display: flex; align-items: center; gap: 4px; min-height: 28px; }
        button {
          display: inline-flex; align-items: center; justify-content: center;
          border: 0; background: transparent; color: #f8fafc;
          padding: 5px; border-radius: 7px; cursor: pointer;
          opacity: .88; transition: background .14s, opacity .14s, transform .08s;
        }
        button:hover { background: rgba(255, 255, 255, 0.14); opacity: 1; }
        button:active { transform: scale(0.92); }
        button svg { width: 17px; height: 17px; fill: currentColor; display: block; pointer-events: none; }

        .skip svg { width: 16px; height: 16px; }
        .barra.compacta .skip { display: none; }

        .tempo {
          font-size: 11.5px;
          font-variant-numeric: tabular-nums;
          color: rgba(248, 250, 252, 0.92);
          white-space: nowrap;
          padding: 0 4px;
        }
        .espaco { flex: 1; min-width: 2px; }

        .vol-box { display: inline-flex; align-items: center; gap: 4px; }
        .vol {
          width: 58px; height: 4px; border-radius: 99px;
          background: linear-gradient(
            to right,
            #f8fafc 0%,
            #f8fafc var(--vol, 100%),
            rgba(255,255,255,.22) var(--vol, 100%),
            rgba(255,255,255,.22) 100%
          );
        }
        .vol::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 11px; height: 11px; border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        }
        .barra.compacta .vol { width: 40px; }
        .barra.mini .vol { display: none; }

        .vel {
          font: 700 11px/1 system-ui, sans-serif;
          font-variant-numeric: tabular-nums;
          padding: 5px 7px;
          border-radius: 6px;
          background: rgba(59, 130, 246, 0.22);
          border: 1px solid rgba(96, 165, 250, 0.35);
          color: #bfdbfe;
          white-space: nowrap;
        }
        .vel:hover { background: rgba(59, 130, 246, 0.36); color: #fff; }
      </style>
      <div class="barra" id="barra">
        <div class="seek-wrap" id="seek-wrap">
          <div class="seek-tip" id="seek-tip">0:00</div>
          <input class="seek" id="seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Progresso do vídeo">
        </div>
        <div class="linha">
          <button id="play" title="Reproduzir / Pausar" aria-label="Reproduzir ou pausar"></button>
          <button class="skip" id="voltar" title="Voltar 5s" aria-label="Voltar 5 segundos"></button>
          <button class="skip" id="avancar" title="Avançar 5s" aria-label="Avançar 5 segundos"></button>
          <span class="tempo" id="tempo">0:00 / 0:00</span>
          <span class="espaco"></span>
          <div class="vol-box">
            <button id="mute" title="Mudo / Som" aria-label="Mudo ou som"></button>
            <input class="vol" id="vol" type="range" min="0" max="100" step="1" value="100" aria-label="Volume">
          </div>
          <button class="vel" id="vel" title="Alternar 1x ⇄ velocidade preferida">1x</button>
          <button id="pip" title="Picture-in-Picture" aria-label="Picture-in-Picture"></button>
          <button id="fs" title="Tela cheia" aria-label="Tela cheia"></button>
        </div>
      </div>
    `;

    barraEl = shadow.getElementById('barra');
    btnPlay = shadow.getElementById('play');
    btnVoltar = shadow.getElementById('voltar');
    btnAvancar = shadow.getElementById('avancar');
    tempoEl = shadow.getElementById('tempo');
    seekEl = shadow.getElementById('seek');
    seekTip = shadow.getElementById('seek-tip');
    btnMute = shadow.getElementById('mute');
    volEl = shadow.getElementById('vol');
    btnVel = shadow.getElementById('vel');
    btnPip = shadow.getElementById('pip');
    btnFs = shadow.getElementById('fs');

    btnVoltar.innerHTML = ICO.voltar;
    btnAvancar.innerHTML = ICO.avancar;
    btnPip.innerHTML = ICO.pip;
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
      btnPip.style.display = 'none';
    }

    // Impede que o site (ex.: Instagram) capture cliques na nossa barra.
    for (const ev of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart']) {
      barraEl.addEventListener(ev, e => e.stopPropagation());
    }

    barraEl.addEventListener('pointerenter', () => { sobreBarra = true; atualizarVisibilidade(); });
    barraEl.addEventListener('pointerleave', () => { sobreBarra = false; seekTip.classList.remove('visivel'); acordarBarra(); });

    btnPlay.addEventListener('click', () => {
      if (!alvo) return;
      const volAntes = volUsuario || { volume: alvo.volume, muted: alvo.muted };
      if (alvo.paused || alvo.ended) alvo.play().catch(() => {});
      else alvo.pause();
      restaurarVolume(alvo, volAntes);
      sincronizarEstado();
    });

    btnVoltar.addEventListener('click', () => {
      if (!alvo || !Number.isFinite(alvo.duration)) return;
      try { alvo.currentTime = Math.max(0, (alvo.currentTime || 0) - 5); } catch (_) {}
      sincronizarEstado();
    });

    btnAvancar.addEventListener('click', () => {
      if (!alvo || !Number.isFinite(alvo.duration)) return;
      try { alvo.currentTime = Math.min(alvo.duration, (alvo.currentTime || 0) + 5); } catch (_) {}
      sincronizarEstado();
    });

    const iniciarArrasto = () => { arrastando = true; atualizarVisibilidade(); };
    const terminarArrasto = () => { arrastando = false; acordarBarra(); };

    seekEl.addEventListener('pointerdown', iniciarArrasto);
    seekEl.addEventListener('pointerup', terminarArrasto);
    seekEl.addEventListener('change', terminarArrasto);
    seekEl.addEventListener('pointermove', e => {
      if (!alvo || !Number.isFinite(alvo.duration) || alvo.duration <= 0) {
        seekTip.classList.remove('visivel');
        return;
      }
      const r = seekEl.getBoundingClientRect();
      if (r.width <= 0) return;
      const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const x = Math.min(r.width - 20, Math.max(20, frac * r.width));
      seekTip.textContent = fmtTempo(frac * alvo.duration);
      seekTip.style.left = x + 'px';
      seekTip.classList.add('visivel');
    });
    seekEl.addEventListener('pointerleave', () => seekTip.classList.remove('visivel'));
    seekEl.addEventListener('input', () => {
      if (!alvo || !Number.isFinite(alvo.duration) || alvo.duration <= 0) return;
      const frac = Number(seekEl.value) / 1000;
      const novoTempo = frac * alvo.duration;
      try { alvo.currentTime = novoTempo; } catch (_) {}
      seekEl.style.setProperty('--prog', (frac * 100).toFixed(2) + '%');
      const txt = `${fmtTempo(novoTempo)} / ${fmtTempo(alvo.duration)}`;
      uiTempo = txt;
      tempoEl.textContent = txt;
    });

    btnMute.addEventListener('click', () => {
      if (!alvo) return;
      if (alvo.muted || alvo.volume === 0) {
        alvo.muted = false;
        if (alvo.volume === 0) alvo.volume = 0.5;
      } else {
        alvo.muted = true;
      }
      volUsuario = { volume: alvo.volume, muted: alvo.muted };
      sincronizarEstado();
    });

    volEl.addEventListener('pointerdown', iniciarArrasto);
    volEl.addEventListener('pointerup', terminarArrasto);
    volEl.addEventListener('change', terminarArrasto);
    volEl.addEventListener('input', () => {
      if (!alvo) return;
      const v = Number(volEl.value) / 100;
      alvo.volume = v;
      alvo.muted = v === 0;
      volUsuario = { volume: v, muted: v === 0 };
      sincronizarEstado();
    });

    btnVel.addEventListener('click', () => {
      if (!alvo) return;
      const nova = Math.abs(alvo.playbackRate - 1) < 0.01 ? preferida : 1;
      const dados = { ativa: nova };
      if (nova !== 1) dados.preferida = nova;
      chrome.storage.sync.set(dados);
    });

    btnPip.addEventListener('click', () => {
      if (!alvo) return;
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (typeof alvo.requestPictureInPicture === 'function') {
        alvo.requestPictureInPicture().catch(() => {});
      }
    });

    btnFs.addEventListener('click', () => {
      if (!alvo) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (typeof alvo.requestFullscreen === 'function') {
        alvo.requestFullscreen().catch(() => {});
      }
    });
  }

  function montarHost() {
    criarBarra();
    const destino = document.fullscreenElement || document.body || document.documentElement;
    if (destino && hostEl.parentNode !== destino) {
      destino.appendChild(hostEl);
    }
  }

  function sincronizarEstado() {
    if (!alvo || !barraEl) return;

    const estadoPlay = (alvo.paused || alvo.ended) ? 'play' : 'pause';
    if (estadoPlay !== uiPlay) {
      uiPlay = estadoPlay;
      btnPlay.innerHTML = ICO[estadoPlay];
    }

    const dur = alvo.duration;
    const cur = alvo.currentTime || 0;
    if (dur === Infinity) {
      if (uiTempo !== 'AO VIVO') {
        uiTempo = 'AO VIVO';
        tempoEl.textContent = 'AO VIVO';
      }
      seekEl.disabled = true;
      if (uiSeekVal !== '1000') {
        uiSeekVal = '1000';
        seekEl.value = '1000';
        seekEl.style.setProperty('--prog', '100%');
        seekEl.style.setProperty('--buf', '100%');
      }
    } else if (Number.isFinite(dur) && dur > 0) {
      seekEl.disabled = false;
      if (!arrastando) {
        const frac = Math.min(1, Math.max(0, cur / dur));
        const sv = String(Math.round(frac * 1000));
        if (sv !== uiSeekVal) {
          uiSeekVal = sv;
          seekEl.value = sv;
          seekEl.style.setProperty('--prog', (frac * 100).toFixed(2) + '%');
        }
        const txt = `${fmtTempo(cur)} / ${fmtTempo(dur)}`;
        if (txt !== uiTempo) {
          uiTempo = txt;
          tempoEl.textContent = txt;
        }
      }
      let bufFim = 0;
      try {
        for (let i = 0; i < alvo.buffered.length; i++) {
          if (alvo.buffered.start(i) <= cur && alvo.buffered.end(i) >= bufFim) {
            bufFim = alvo.buffered.end(i);
          }
        }
      } catch (_) {}
      seekEl.style.setProperty('--buf', (Math.min(1, bufFim / dur) * 100).toFixed(2) + '%');
    } else {
      seekEl.disabled = true;
      if (uiSeekVal !== '0') {
        uiSeekVal = '0';
        seekEl.value = '0';
        seekEl.style.setProperty('--prog', '0%');
        seekEl.style.setProperty('--buf', '0%');
      }
      if (uiTempo !== '0:00 / 0:00') {
        uiTempo = '0:00 / 0:00';
        tempoEl.textContent = uiTempo;
      }
    }

    const volEfetivo = alvo.muted ? 0 : alvo.volume;
    const estadoMute = volEfetivo === 0 ? 'mudo' : (volEfetivo < 0.5 ? 'volBaixo' : 'volAlto');
    if (estadoMute !== uiMute) {
      uiMute = estadoMute;
      btnMute.innerHTML = ICO[estadoMute];
    }
    const volPct = Math.round(volEfetivo * 100);
    if (!arrastando && volPct !== uiVolPct) {
      uiVolPct = volPct;
      volEl.value = String(volPct);
      volEl.style.setProperty('--vol', volPct + '%');
    }

    const txtVel = fmtVel(alvo.playbackRate || 1);
    if (txtVel !== uiVel) {
      uiVel = txtVel;
      btnVel.textContent = txtVel;
    }

    const estadoFs = document.fullscreenElement ? 'fsSair' : 'fsEntrar';
    if (estadoFs !== uiFs) {
      uiFs = estadoFs;
      btnFs.innerHTML = ICO[estadoFs];
    }
  }

  function posicionar() {
    if (!alvo || !hostEl) return;
    const r = alvo.getBoundingClientRect();
    const margem = 8;
    const largura = Math.min(window.innerWidth - margem * 2, Math.max(0, r.width - margem * 2));
    if (largura < 160 || r.bottom < 48 || r.top > window.innerHeight - 48) {
      hostEl.style.display = 'none';
      ultimoRect = '';
      return;
    }

    hostEl.style.display = 'block';
    const alturaBarra = barraEl.offsetHeight || 58;
    const esq = Math.min(window.innerWidth - largura - margem, Math.max(margem, r.left + margem));
    const topo = Math.min(window.innerHeight - alturaBarra - margem, Math.max(margem, r.bottom - alturaBarra - margem));
    const chave = `${Math.round(esq)}:${Math.round(topo)}:${Math.round(largura)}`;

    if (chave !== ultimoRect) {
      ultimoRect = chave;
      hostEl.style.left = Math.round(esq) + 'px';
      hostEl.style.top = Math.round(topo) + 'px';
      hostEl.style.width = Math.round(largura) + 'px';
      barraEl.classList.toggle('compacta', largura < 390);
      barraEl.classList.toggle('mini', largura < 260);
    }
  }

  function ciclo() {
    if (!habilitado) {
      rafId = null;
      return;
    }
    const novoAlvo = escolherVideo();
    if (novoAlvo !== alvo) {
      alvo = novoAlvo;
      ultimoRect = '';
      if (alvo) {
        if (volUsuario) restaurarVolume(alvo, volUsuario);
        acordarBarra();
      }
    }
    if (alvo) {
      montarHost();
      sincronizarEstado();
      posicionar();
      atualizarVisibilidade();
    } else if (hostEl) {
      hostEl.style.display = 'none';
      ultimoRect = '';
    }
    rafId = requestAnimationFrame(ciclo);
  }

  function atualizarAtivacao() {
    const ativo = barraAtivaNoSite(mapaSites);
    habilitado = ativo;
    if (habilitado) {
      montarHost();
      acordarBarra();
      if (!rafId) rafId = requestAnimationFrame(ciclo);
    } else {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      alvo = null;
      ultimoRect = '';
      if (hostEl) hostEl.style.display = 'none';
    }
  }

  // Preserva o volume escolhido na barra quando o site (ex.: Instagram) tenta mutar ao pausar/tocar.
  for (const ev of ['pause', 'play']) {
    document.addEventListener(ev, e => {
      if (!habilitado || !volUsuario) return;
      if (e.target instanceof HTMLVideoElement && e.target === alvo) {
        restaurarVolume(e.target, volUsuario);
      }
    }, true);
  }

  // Detecta hover sobre vídeos para acordar a barra mesmo quando oculta.
  document.addEventListener('pointermove', e => {
    if (!habilitado || sobreBarra) return;
    const x = e.clientX, y = e.clientY;
    let achou = null;
    for (const v of listarVideos()) {
      if (!v.isConnected) continue;
      const r = v.getBoundingClientRect();
      if (r.width >= 120 && r.height >= 80 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        achou = v;
        break;
      }
    }
    videoHover = achou;
    if (achou) acordarBarra();
  }, { passive: true });

  document.addEventListener('fullscreenchange', () => {
    if (!habilitado) return;
    montarHost();
    ultimoRect = '';
    acordarBarra();
  });

  function digitando(e) {
    const el = e.composedPath()[0] || e.target;
    if (!el || !el.tagName) return false;
    return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  }

  // Tecla C alterna a barra de controles para o site atual.
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || !e.key) return;
    if (e.key.toLowerCase() !== 'c' || digitando(e) || !listarVideos(true).length) return;
    const proximo = !habilitado;
    mapaSites = { ...mapaSites, [hostAtual]: proximo };
    chrome.storage.sync.set({ barraSites: mapaSites });
    atualizarAtivacao();
    mostrarToast(proximo ? 'Barra de controles: ativada' : 'Barra de controles: desativada');
    e.preventDefault();
    e.stopPropagation();
  }, true);

  chrome.storage.onChanged.addListener(mud => {
    if (mud.preferida && mud.preferida.newValue) preferida = mud.preferida.newValue;
    if (mud.barraSites) {
      mapaSites = mud.barraSites.newValue || {};
      atualizarAtivacao();
    }
  });

  chrome.storage.sync.get({ barraSites: {}, preferida: 2 }, d => {
    mapaSites = d.barraSites || {};
    preferida = d.preferida || 2;
    atualizarAtivacao();
  });
})();
