import { ALLERGENS, ALLERGEN_MAP, allergenIcon } from './allergens.js';

const CAT_ICONS = {
  cloche: '<path d="M3 18.5h18M5 18.5a7 7 0 0 1 14 0M12 9.5V7.5M10.4 7.5h3.2"/>',
  cake: '<path d="M4 20.5h16M6 20.5v-6h12v6M6 16.5c2 1.2 4 1.2 6 0s4-1.2 6 0M8 14.5v-3h8v3M12 11.5V9"/><path d="M12 9c-1.3-.8-.9-2.6 0-4 .9 1.4 1.3 3.2 0 4z"/>',
  cup: '<path d="M4 9.5h12v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c-1 1 1 2 0 3.5M12 3.5c-1 1 1 2 0 3.5"/>',
  glass: '<path d="M6 7h12l-1.6 13.5H7.6zM13.5 7l2.5-4.5M6.6 12h10.8"/><circle cx="17.5" cy="7" r="2.5"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5"/>',
  shake: '<path d="M7 9h10l-1.4 12H8.4zM6 9h12M8.5 9a3.5 3.5 0 0 1 7 0M13 6l3-4"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7"/>',
  heart: '<path d="M12 20c-4.5-3.5-8-6.4-8-10.2C4 7.3 6 5.5 8.3 5.5c1.6 0 2.9.9 3.7 2.3.8-1.4 2.1-2.3 3.7-2.3C18 5.5 20 7.3 20 9.8 20 13.6 16.5 16.5 12 20z"/>',
};
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21C7 17 2 13.6 2 8.6 2 5.5 4.4 3.5 7 3.5c2.2 0 3.8 1.3 5 3 1.2-1.7 2.8-3 5-3 2.6 0 5 2 5 5.1 0 5-5 8.4-10 12.4z"/></svg>';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s = '') => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

let MENU = null;
const state = { q: '', exclude: new Set() };
try { JSON.parse(localStorage.getItem('mh_ex') || '[]').forEach((k) => state.exclude.add(k)); } catch {}

export function priceHTML(it) {
  const p = Number(it.price || 0).toLocaleString('tr-TR');
  let s = `${p} ₺`;
  if (it.priceFrom) s += `<small>’den</small>`;
  if (it.unit) s += ` <small>/ ${esc(it.unit)}</small>`;
  return s;
}
const kcalText = (it) => (it.kcal || it.kcal === 0 ? `${it.kcal} kcal${it.kcalNote ? ' / ' + esc(it.kcalNote) : ''}` : '');

async function load() {
  const params = new URLSearchParams(location.search);
  if (params.has('onizleme')) {
    try { const d = JSON.parse(localStorage.getItem('mh_preview')); if (d) return d; } catch {}
  }
  try {
    const r = await fetch('/api/menu', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); if (j.menu) return j.menu; }
  } catch {}
  const r = await fetch('/data/menu.json', { cache: 'no-store' });
  return r.json();
}

function applySettings(s) {
  $('#brandName').textContent = s.name || "Mom's Hands";
  $('#brandSub').textContent = s.sub || 'Cafe & Pasta';
  $('#tagline').textContent = s.tagline || '';
  $('#footTag').textContent = s.tagline || '';
  if (s.notice) { $('#notice').textContent = s.notice; $('#notice').hidden = false; }
  if (s.logoImage) { $('#logoImg').src = s.logoImage; $('#logoImg').hidden = false; }
  if (s.coverImage) { const b = $('#heroBg'); b.style.backgroundImage = `url("${s.coverImage}")`; b.classList.add('on'); }
  const show = (id, on) => { $(id).hidden = !on; return on; };
  const ig = (s.instagram || '').trim().replace(/^@/, '');
  const any = [
    show('#addrCard', !!s.address) && (($('#addr').textContent = s.address), ($('#addrCard').href = s.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(s.address)}`)),
    show('#igCard', !!ig) && (($('#ig').textContent = '@' + ig), ($('#igCard').href = `https://instagram.com/${ig}`)),
    show('#telCard', !!s.phone) && (($('#tel').textContent = s.phone), ($('#telCard').href = 'tel:' + s.phone.replace(/\s+/g, ''))),
    show('#hoursCard', !!s.hours) && ($('#hours').textContent = s.hours),
    show('#wifiCard', !!s.wifi) && ($('#wifi').textContent = s.wifi),
  ].some(Boolean);
  $('#info').hidden = !any;
  $('#yr').textContent = new Date().getFullYear();
  const slogans = [...(s.slogans || []), s.tagline].filter(Boolean);
  const run = slogans.map((t) => `<span>${esc(t)}</span>`).join('');
  $('#marquee').innerHTML = run + run;
}

function itemHTML(it, cat, i) {
  const tags = (it.tags || []).map((t) => `<span class="tag ${/favori/i.test(t) ? 'fav' : ''}">${esc(t)}</span>`).join(' ');
  const al = (it.allergens || []).map((k) => allergenIcon(k)).join('');
  const thumb = MENU.settings.showPhotos && it.image ? `<img class="thumb" src="${esc(it.image)}" alt="" loading="lazy">` : '';
  return `<button class="item ${it.available === false ? 'soldout' : ''}" data-cat="${esc(cat.id)}" data-i="${i}" style="transition-delay:${Math.min(i, 8) * 40}ms">
    <div class="item-main">
      <div class="item-top"><h3>${esc(it.name)} ${tags}</h3><span class="leader"></span><span class="price">${priceHTML(it)}</span></div>
      ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ''}
      <div class="meta">
        ${kcalText(it) ? `<span class="kcal">${HEART}${kcalText(it)}</span>` : ''}
        ${it.size ? `<span class="size">${esc(it.size)}</span>` : ''}
        ${al}
      </div>
    </div>${thumb}
  </button>`;
}

function render() {
  const main = $('#menu');
  const q = norm(state.q.trim());
  let html = '';
  let shown = 0;
  MENU.categories.forEach((cat, ci) => {
    const items = cat.items.map((it, i) => [it, i]).filter(([it]) => !q || norm(`${it.name} ${it.desc} ${(it.tags || []).join(' ')}`).includes(q) || norm(cat.name).includes(q));
    if (!items.length) return;
    shown += items.length;
    html += `<section class="cat" id="c-${esc(cat.id)}">
      <div class="cat-head">
        <span class="cat-icon"><svg viewBox="0 0 24 24">${CAT_ICONS[cat.icon] || CAT_ICONS.heart}</svg></span>
        <div><p class="cat-num">${String(ci + 1).padStart(2, '0')} ✦ ${cat.items.length} LEZZET</p><h2>${esc(cat.name)}</h2>${cat.subtitle ? `<p class="cat-sub">${esc(cat.subtitle)}</p>` : ''}</div>
      </div>
      <div class="items">${items.map(([it, i]) => itemHTML(it, cat, i)).join('')}</div>
    </section>`;
  });
  if (!shown) html = `<div class="empty"><p>Hmm...</p><p>“${esc(state.q)}” için bir lezzet bulamadık.</p></div>`;
  main.innerHTML = html;
  applyFilter();
  observeItems();
}

function applyFilter() {
  document.querySelectorAll('.item').forEach((el) => {
    const it = MENU.categories.find((c) => c.id === el.dataset.cat).items[el.dataset.i];
    const bad = (it.allergens || []).some((k) => state.exclude.has(k));
    el.classList.toggle('off', bad);
  });
  $('#filterDot').hidden = state.exclude.size === 0;
}

function renderChips() {
  $('#chips').innerHTML = MENU.categories.map((c) => `<a class="chip" href="#c-${esc(c.id)}" data-id="${esc(c.id)}"><svg viewBox="0 0 24 24">${CAT_ICONS[c.icon] || CAT_ICONS.heart}</svg>${esc(c.name)}</a>`).join('');
}

let io;
function observeItems() {
  io?.disconnect();
  io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.item').forEach((el) => io.observe(el));
}

function scrollSpy() {
  const bar = $('#bar');
  const setH = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  setH(); addEventListener('resize', setH);
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = bar.offsetHeight + 40;
      let cur = null;
      document.querySelectorAll('.cat').forEach((s) => { if (s.getBoundingClientRect().top <= y) cur = s.id.slice(2); });
      document.querySelectorAll('.chip').forEach((c) => {
        const on = c.dataset.id === cur;
        if (on && !c.classList.contains('active')) c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        c.classList.toggle('active', on);
      });
    });
  }, { passive: true });
}

/* ---------- sheet ---------- */
function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheetWrap').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() { $('#sheetWrap').hidden = true; document.body.style.overflow = ''; }
$('#sheetWrap').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

function detailHTML(it, cat) {
  const al = it.allergens || [];
  return `
    ${it.image && MENU.settings.showPhotos ? `<img class="sh-img" src="${esc(it.image)}" alt="">` : ''}
    <p class="sh-cat">${esc(cat.name)}</p>
    <h3 class="sh-title" id="sheetTitle">${esc(it.name)}</h3>
    ${it.desc ? `<p class="sh-desc">${esc(it.desc)}</p>` : ''}
    <div class="sh-stats">
      <div class="stat"><b>${priceHTML(it)}</b><span>Fiyat</span></div>
      <div class="stat"><b>${it.kcal ?? '?'}</b><span>kcal${it.kcalNote ? ' / ' + esc(it.kcalNote) : ''}</span></div>
      <div class="stat"><b>${esc(it.size || (it.unit ? '1 ' + it.unit : 'Porsiyon'))}</b><span>Boy</span></div>
    </div>
    ${it.note ? `<p class="sh-desc"><b>Not:</b> ${esc(it.note)}</p>` : ''}
    <p class="sh-h">İçerdiği alerjenler</p>
    ${al.length ? `<div class="sh-al">${al.map((k) => `<span class="row">${allergenIcon(k)}${esc(ALLERGEN_MAP[k]?.name || k)}</span>`).join('')}</div>` : `<p class="none">Bilinen bir alerjen içermez ♡</p>`}
    <p class="sh-note">Kalori değerleri yaklaşıktır. Ürünlerimiz alerjen içeren ürünlerle aynı mutfakta hazırlanır.</p>`;
}

$('#menu').addEventListener('click', (e) => {
  const b = e.target.closest('.item'); if (!b) return;
  const cat = MENU.categories.find((c) => c.id === b.dataset.cat);
  openSheet(detailHTML(cat.items[b.dataset.i], cat));
});

/* ---------- filter ---------- */
function filterHTML() {
  return `<p class="sh-cat">Alerjen filtresi</p>
    <h3 class="sh-title" id="sheetTitle">Hangilerinden kaçınıyorsunuz?</h3>
    <p class="sh-desc">Seçtiğiniz alerjenleri içeren ürünler soluk görünür.</p>
    <div class="flt-grid">${ALLERGENS.map((a) => `<button class="flt ${state.exclude.has(a.key) ? 'on' : ''}" data-k="${a.key}">${allergenIcon(a.key)}${a.name}</button>`).join('')}</div>
    <div class="flt-actions"><button data-act="clear">Temizle</button><button class="primary" data-close>Uygula</button></div>`;
}
$('#filterBtn').addEventListener('click', () => openSheet(filterHTML()));
$('#sheetBody').addEventListener('click', (e) => {
  const f = e.target.closest('.flt');
  if (f) { const k = f.dataset.k; state.exclude.has(k) ? state.exclude.delete(k) : state.exclude.add(k); f.classList.toggle('on'); }
  if (e.target.closest('[data-act="clear"]')) { state.exclude.clear(); document.querySelectorAll('.flt.on').forEach((x) => x.classList.remove('on')); }
  if (e.target.closest('[data-act="again"]')) pick();
  if (f || e.target.closest('[data-act="clear"]')) {
    try { localStorage.setItem('mh_ex', JSON.stringify([...state.exclude])); } catch {}
    applyFilter();
  }
});

/* ---------- search ---------- */
$('#searchBtn').addEventListener('click', () => { $('#searchRow').hidden = false; $('#searchInput').focus(); });
$('#searchClose').addEventListener('click', () => { $('#searchRow').hidden = true; state.q = ''; $('#searchInput').value = ''; render(); });
let st;
$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(st);
  st = setTimeout(() => { state.q = e.target.value; render(); $('#menu').scrollIntoView({ behavior: 'smooth' }); }, 160);
});

/* ---------- mom's pick ---------- */
function pick() {
  const pool = MENU.categories.flatMap((c) => c.items.filter((it) => it.available !== false && !(it.allergens || []).some((k) => state.exclude.has(k))).map((it) => [it, c]));
  if (!pool.length) return;
  openSheet(`<div class="pick-stage"><p class="script">Annemin önerisi...</p><div class="pick-roll rolling" id="roll"></div></div><div id="pickOut"></div>`);
  let n = 0;
  const roll = $('#roll');
  const spin = () => {
    const [it] = pool[Math.floor(Math.random() * pool.length)];
    roll.textContent = it.name;
    n++;
    if (n < 16) setTimeout(spin, 50 + n * n * 1.6);
    else {
      const [it2, c2] = pool[Math.floor(Math.random() * pool.length)];
      roll.classList.remove('rolling');
      roll.textContent = '';
      $('#pickOut').innerHTML = detailHTML(it2, c2) + `<div class="flt-actions"><button data-act="again">Başka bir tane</button><button class="primary" data-close>Harika, bunu alıyorum</button></div>`;
      $('.pick-stage .script').textContent = 'Bugün sana bunu öneriyorum';
    }
  };
  spin();
}
$('#pickBtn').addEventListener('click', pick);

/* ---------- boot ---------- */
(async () => {
  MENU = await load();
  document.querySelector('#alGrid').innerHTML = ALLERGENS.map((a) => `<div class="al-cell">${allergenIcon(a.key, 'al al-big')}<span>${a.name}</span></div>`).join('');
  applySettings(MENU.settings || {});
  renderChips();
  render();
  scrollSpy();
})();
