const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CONTROLS_SRC = fs.readFileSync(path.join(__dirname, '..', 'controls.js'), 'utf8');

function criarAmbiente({ hostname, barraSites = {} }) {
  let agora = 1000;
  const storage = { barraSites: { ...barraSites }, preferida: 2 };
  const storageSets = [];
  const docListeners = new Map();
  let rafCallback = null;
  const timers = [];

  class FakeElement {
    constructor(tagName = 'DIV') {
      this.tagName = tagName.toUpperCase();
      this.style = {
        setProperty(k, v) { this[k] = v; }
      };
      this.classList = {
        _set: new Set(),
        toggle(cls, force) {
          if (force === undefined) {
            if (this._set.has(cls)) this._set.delete(cls);
            else this._set.add(cls);
          } else if (force) this._set.add(cls);
          else this._set.delete(cls);
        },
        add(cls) { this._set.add(cls); },
        remove(cls) { this._set.delete(cls); },
        contains(cls) { return this._set.has(cls); }
      };
      this._listeners = new Map();
      this.children = [];
      this.parentNode = null;
      this.isConnected = true;
      this.offsetHeight = 58;
      this.value = '';
      this.textContent = '';
      this.disabled = false;
    }
    setAttribute() {}
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    addEventListener(type, fn) {
      if (!this._listeners.has(type)) this._listeners.set(type, []);
      this._listeners.get(type).push(fn);
    }
    dispatch(type, extra = {}) {
      const ev = {
        type,
        target: this,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        composedPath() { return [this]; },
        ...extra
      };
      for (const fn of this._listeners.get(type) || []) fn(ev);
      return ev;
    }
    getBoundingClientRect() {
      return { left: 100, top: 50, right: 500, bottom: 650, width: 400, height: 600 };
    }
    attachShadow() {
      const ids = {};
      for (const id of ['barra', 'play', 'voltar', 'avancar', 'tempo', 'seek', 'seek-tip', 'mute', 'vol', 'vel', 'pip', 'fs']) {
        ids[id] = new FakeElement(id === 'seek' || id === 'vol' ? 'INPUT' : 'BUTTON');
      }
      this.shadowRoot = {
        _ids: ids,
        set innerHTML(_) {},
        getElementById(id) { return ids[id]; }
      };
      return this.shadowRoot;
    }
  }

  class HTMLVideoElement extends FakeElement {
    constructor() {
      super('VIDEO');
      this.paused = false;
      this.ended = false;
      this.duration = 60;
      this.currentTime = 10;
      this.volume = 0.8;
      this.muted = false;
      this.playbackRate = 1;
      this.buffered = { length: 0 };
      this.onPauseSiteHook = null;
    }
    pause() {
      this.paused = true;
      dispatchDoc('pause', { target: this });
      if (this.onPauseSiteHook) this.onPauseSiteHook();
    }
    play() {
      this.paused = false;
      dispatchDoc('play', { target: this });
      return Promise.resolve();
    }
  }

  const video = new HTMLVideoElement();
  const body = new FakeElement('BODY');

  function dispatchDoc(type, extra = {}) {
    const ev = {
      type,
      target: body,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
      composedPath() { return [extra.target || body]; },
      ...extra
    };
    for (const fn of docListeners.get(type) || []) fn(ev);
    return ev;
  }

  const document = {
    body,
    documentElement: body,
    fullscreenElement: null,
    pictureInPictureEnabled: false,
    createElement(tag) { return new FakeElement(tag); },
    querySelectorAll(sel) { return sel === 'video' ? [video] : []; },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    }
  };

  const sandbox = {
    window: { innerWidth: 1280, innerHeight: 800 },
    location: { hostname },
    document,
    HTMLVideoElement,
    performance: { now: () => agora },
    requestAnimationFrame(fn) { rafCallback = fn; return 1; },
    cancelAnimationFrame() { rafCallback = null; },
    setTimeout(fn, ms) { timers.push({ fn, at: agora + (ms || 0) }); return timers.length; },
    clearTimeout() {},
    queueMicrotask(fn) { fn(); },
    chrome: {
      storage: {
        sync: {
          get(defaults, cb) { cb({ ...defaults, ...storage }); },
          set(obj) {
            storageSets.push(obj);
            Object.assign(storage, obj);
          }
        },
        onChanged: { addListener() {} }
      }
    }
  };

  vm.runInNewContext(CONTROLS_SRC, sandbox, { filename: 'controls.js' });

  const avancarTempo = ms => {
    agora += ms;
    const pendentes = timers.filter(t => t.at <= agora);
    for (const t of pendentes) {
      const idx = timers.indexOf(t);
      if (idx !== -1) timers.splice(idx, 1);
      t.fn();
    }
  };

  const tickFrame = () => {
    if (rafCallback) {
      const fn = rafCallback;
      rafCallback = null;
      fn();
    }
  };

  const getBarIds = () => {
    const host = body.children.find(c => c.shadowRoot);
    return host ? host.shadowRoot._ids : null;
  };

  return { video, storage, storageSets, dispatchDoc, tickFrame, avancarTempo, getBarIds };
}

test('YouTube: apertar C simples não intercepta legendas nem altera barraSites; Alt+C alterna a barra', () => {
  const env = criarAmbiente({ hostname: 'www.youtube.com' });

  const evC = env.dispatchDoc('keydown', { key: 'c', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false });
  assert.equal(evC.defaultPrevented, false);
  assert.equal(evC.propagationStopped, false);
  assert.equal(env.storageSets.length, 0);
  assert.equal(env.storage.barraSites['youtube.com'], undefined);

  const evAltC = env.dispatchDoc('keydown', { key: 'c', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false });
  assert.equal(evAltC.defaultPrevented, true);
  assert.equal(evAltC.propagationStopped, true);
  assert.equal(env.storage.barraSites['youtube.com'], true);
});

test('Instagram: mutar pela barra, desmutar pelo controle do site e pausar mantém muted = false', () => {
  const env = criarAmbiente({ hostname: 'www.instagram.com' });
  env.tickFrame();
  const ids = env.getBarIds();
  assert.ok(ids, 'barra deve estar montada no Instagram');

  // 1. Usuário muta pela nossa barra.
  ids.mute.dispatch('click');
  assert.equal(env.video.muted, true);

  // 2. Passa tempo fora da janela de restauração e o usuário desmuta pelo botão do próprio site.
  env.avancarTempo(500);
  env.video.muted = false;
  env.video.volume = 0.65;
  env.dispatchDoc('volumechange', { target: env.video });

  // 3. Usuário pausa (evento pause) — deve permanecer desmutado.
  env.video.pause();
  env.avancarTempo(300);
  assert.equal(env.video.muted, false);
  assert.equal(env.video.volume, 0.65);

  // 4. Usuário clica play/pause na barra — também deve manter muted = false.
  ids.play.dispatch('click');
  env.avancarTempo(300);
  assert.equal(env.video.muted, false);
});

test('Instagram: volume definido na barra é preservado quando o site tenta forçar muted = true ao pausar', () => {
  const env = criarAmbiente({ hostname: 'www.instagram.com' });
  env.tickFrame();
  const ids = env.getBarIds();

  // Usuário ajusta volume para 70% na barra (desmutado).
  ids.vol.value = '70';
  ids.vol.dispatch('input');
  assert.equal(env.video.muted, false);
  assert.equal(env.video.volume, 0.7);

  // Simula o player React do Instagram forçando muted = true assim que pausa.
  env.video.onPauseSiteHook = () => {
    env.video.muted = true;
    env.dispatchDoc('volumechange', { target: env.video });
  };

  // Usuário pausa pela barra.
  ids.play.dispatch('click');
  env.avancarTempo(250);
  assert.equal(env.video.paused, true);
  assert.equal(env.video.muted, false);
  assert.equal(env.video.volume, 0.7);
});
