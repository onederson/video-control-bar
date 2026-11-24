const OPCOES = [0.5, 1, 1.25, 1.5, 2, 3, 4, 5, 10];
const PASSO = 0.5;
const PISO_BOTAO = 0.1;
const NATIVO_MIN = 0.0625;
const NATIVO_MAX = 16;
const SITES_PADRAO = ['instagram.com', 'tiktok.com', 'threads.net', 'threads.com'];

const grade = document.getElementById('grade');
const velInput = document.getElementById('vel');
const badgeVel = document.getElementById('badge-vel');
const formVel = document.getElementById('form-vel');
const avisoEl = document.getElementById('aviso');
const barraBox = document.getElementById('barra-box');
const barraSiteEl = document.getElementById('barra-site');
const barraToggle = document.getElementById('barra-toggle');

let atual = 1;
let hostAba = '';
let mapaSites = {};

const normalizarHost = h => (h || '').toLowerCase().replace(/^www\./, '');
const ehSitePadrao = host => SITES_PADRAO.some(s => host === s || host.endsWith('.' + s));
const barraAtivaNoSite = (host, mapa) => {
  if (!host) return false;
  if (mapa && Object.prototype.hasOwnProperty.call(mapa, host)) return Boolean(mapa[host]);
  return ehSitePadrao(host);
};

const normalizar = v => {
  if (!Number.isFinite(v) || v <= 0) return null;
  return (v >= 0.001 && v < 1e9) ? Math.round(v * 10000) / 10000 : v;
};

const fmtNum = v => String(v).replace('.', ',');
const fmt = v => fmtNum(v) + 'x';

function lerCampo() {
  const limpo = velInput.value.trim().replace(/x$/i, '').replace(/\s+/g, '').replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  return normalizar(n);
}

function renderBarra() {
  if (!hostAba) {
    barraBox.hidden = true;
    return;
  }
  barraBox.hidden = false;
  barraSiteEl.textContent = hostAba;
  barraToggle.checked = barraAtivaNoSite(hostAba, mapaSites);
}

function render() {
  if (document.activeElement !== velInput) {
    velInput.value = fmtNum(atual);
  }
  badgeVel.textContent = fmt(atual);
  badgeVel.title = fmt(atual);
  grade.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', Math.abs(Number(b.dataset.v) - atual) < 0.0001);
  });
  if (atual > NATIVO_MAX) {
    avisoEl.textContent = 'Valor salvo! O navegador limita a reprodução nativa a 16x.';
    avisoEl.hidden = false;
  } else if (atual < NATIVO_MIN) {
    avisoEl.textContent = 'Valor salvo! O navegador limita a reprodução nativa a 0,0625x.';
    avisoEl.hidden = false;
  } else {
    avisoEl.hidden = true;
  }
  renderBarra();
}

function definir(v) {
  const n = normalizar(v);
  if (n === null) {
    velInput.value = fmtNum(atual);
    return;
  }
  atual = n;
  velInput.value = fmtNum(atual);
  const dados = { ativa: atual };
  if (atual !== 1) dados.preferida = atual;
  chrome.storage.sync.set(dados);
  render();
}

for (const v of OPCOES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = fmt(v);
  b.dataset.v = v;
  b.onclick = () => definir(v);
  grade.appendChild(b);
}

formVel.onsubmit = e => {
  e.preventDefault();
  definir(lerCampo());
  velInput.blur();
};

velInput.addEventListener('focus', () => velInput.select());
velInput.addEventListener('blur', () => {
  const n = lerCampo();
  if (n !== null && n !== atual) definir(n);
  else velInput.value = fmtNum(atual);
});

document.getElementById('menos').onclick = () => {
  const prox = atual - PASSO;
  definir(prox >= PISO_BOTAO ? prox : Math.min(atual, PISO_BOTAO));
};
document.getElementById('reset').onclick = () => definir(1);
document.getElementById('mais').onclick = () => definir(atual + PASSO);

barraToggle.addEventListener('change', () => {
  if (!hostAba) return;
  mapaSites = { ...mapaSites, [hostAba]: barraToggle.checked };
  chrome.storage.sync.set({ barraSites: mapaSites });
});

chrome.storage.onChanged.addListener(mud => {
  if (mud.ativa && mud.ativa.newValue !== atual) {
    const n = normalizar(mud.ativa.newValue);
    if (n !== null) {
      atual = n;
      render();
    }
  }
  if (mud.barraSites) {
    mapaSites = mud.barraSites.newValue || {};
    renderBarra();
  }
});

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const urlStr = tabs && tabs[0] && tabs[0].url;
  if (urlStr) {
    try {
      const u = new URL(urlStr);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        hostAba = normalizarHost(u.hostname);
      }
    } catch (_) {}
  }
  renderBarra();
});

chrome.storage.sync.get({ ativa: 1, barraSites: {} }, d => {
  atual = normalizar(d.ativa) ?? 1;
  mapaSites = d.barraSites || {};
  render();
});
