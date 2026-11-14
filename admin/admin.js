import { ALLERGENS, allergenIcon } from '/assets/allergens.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = { cloche: 'Servis', cake: 'Pasta', cup: 'Fincan', glass: 'Bardak', snow: 'Kar tanesi', shake: 'Milkshake', leaf: 'Yaprak', heart: 'Kalp' };

let token = sessionStorage.getItem('mh_token') || '';
let M = null;
let dirty = false;
const open = new Set();
let filter = '';

/* ---------- utils ---------- */
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2800);
}
function setDirty(v = true) { dirty = v; $('#dirty').hidden = !v; }
addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/api/login') { logout(); throw new Error(j.error || 'Oturum süresi doldu'); }
  if (!r.ok) throw new Error(j.error || 'Bir sorun oluştu');
  return j;
}
const uid = (s) => (s || 'urun').toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Math.random().toString(36).slice(2, 6);

function getPath(path) { return path.split('.').reduce((o, k) => o?.[k], M); }
function setPath(path, val) {
  const ks = path.split('.'); const last = ks.pop();
  const o = ks.reduce((o, k) => o[k], M); o[last] = val;
}

/* ---------- images ---------- */
async function compress(file) {
  if (/svg|gif/.test(file.type)) return file;
  const img = await createImageBitmap(file);
  const max = 1600; const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.84));
  if (blob && blob.type === 'image/webp') return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  const jpg = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
  return new File([jpg], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
async function upload(file) {
  const f = await compress(file);
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
  const j = await api('/api/upload', { method: 'POST', body: JSON.stringify({ filename: f.name, contentType: f.type, data }) });
  return j.url;
}
function pickFile() {
  return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files[0]); i.click(); });
}
async function chooseFromLibrary() {
  const { images } = await api('/api/upload');
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'picker';
    d.innerHTML = `<div class="picker-in"><h3>Kütüphaneden seç</h3>${images.length ? `<div class="lib">${images.map((i) => `<figure><img src="${esc(i.url)}" data-u="${esc(i.url)}" loading="lazy"></figure>`).join('')}</div>` : '<p class="muted">Henüz görsel yok.</p>'}<p><button class="btn wide" data-x>Vazgeç</button></p></div>`;
    d.onclick = (e) => { const u = e.target.dataset.u; if (u || e.target === d || e.target.hasAttribute('data-x')) { d.remove(); res(u || null); } };
    document.body.append(d);
  });
}
async function imageAction(path, how) {
  try {
    let url = null;
    if (how === 'upload') { const f = await pickFile(); if (!f) return; toast('Yükleniyor...'); url = await upload(f); }
    else if (how === 'lib') url = await chooseFromLibrary();
    else if (how === 'remove') url = '';
    if (url === null) return;
    setPath(path, url); setDirty(); renderAll(); toast(url ? 'Görsel eklendi. Yayınlamayı unutmayın.' : 'Görsel kaldırıldı');
  } catch (e) { toast(e.message, true); }
}
const imgField = (path, label, hint) => {
  const v = getPath(path);
  return `<div class="img-field">${v ? `<img src="${esc(v)}" alt="">` : '<span class="ph">Görsel yok</span>'}
    <div class="t"><b>${label}</b><span class="muted">${hint || ''}</span>
    <div class="bts"><button class="btn sm soft" data-img="${path}" data-how="upload">Yükle</button><button class="btn sm" data-img="${path}" data-how="lib">Kütüphane</button>${v ? `<button class="btn sm danger" data-img="${path}" data-how="remove">Kaldır</button>` : ''}</div></div></div>`;
};

/* ---------- render menu ---------- */
function field(path, label, type = 'text', extra = '') {
  const v = getPath(path) ?? '';
  if (type === 'textarea') return `<label class="fld"><span>${label}</span><textarea data-bind="${path}" ${extra}>${esc(v)}</textarea></label>`;
  return `<label class="fld"><span>${label}</span><input type="${type}" data-bind="${path}" data-type="${type}" value="${esc(v)}" ${extra}></label>`;
}

function itemRow(ci, ii) {
  const it = M.categories[ci].items[ii];
  const p = `categories.${ci}.items.${ii}`;
  const key = it.id;
  const isOpen = open.has(key);
  return `<div class="row ${it.available === false ? 'unavailable' : ''}">
    <div class="row-h">
      ${it.image ? `<img class="thumb" src="${esc(it.image)}" alt="">` : ''}
      <div class="nm" data-toggle="${esc(key)}">${esc(it.name || 'Yeni ürün')}<small>${it.kcal ? it.kcal + ' kcal' : ''}${it.size ? ' ✦ ' + esc(it.size) : ''}${it.unit ? ' ✦ ' + esc(it.unit) : ''}</small></div>
      <div class="pr"><input type="number" inputmode="decimal" min="0" step="1" data-bind="${p}.price" data-type="number" value="${esc(it.price)}"><span>₺</span></div>
      <button class="btn icon sm" data-toggle="${esc(key)}" title="Düzenle"><svg viewBox="0 0 24 24"><path d="${isOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}"/></svg></button>
    </div>
    ${isOpen ? `<div class="row-b">
      ${field(p + '.name', 'Ürün adı')}
      ${field(p + '.desc', 'Açıklama', 'textarea')}
      <div class="grid3">
        ${field(p + '.unit', 'Birim (kg, adet)')}
        ${field(p + '.size', 'Boy (10 oz / 300 ml)')}
        ${field(p + '.note', 'Kısa not')}
        ${field(p + '.kcal', 'Kalori (kcal)', 'number')}
        ${field(p + '.kcalNote', 'Kalori ölçüsü')}
        <label class="fld"><span>Etiketler</span><input data-bind="${p}.tags" data-type="list" value="${esc((it.tags || []).join(', '))}" placeholder="Favori, Yeni"></label>
      </div>
      <p class="fld"><span>Alerjenler</span></p>
      <div class="al-pick">${ALLERGENS.map((a) => `<button class="al-opt ${(it.allergens || []).includes(a.key) ? 'on' : ''}" data-al="${p}" data-k="${a.key}">${allergenIcon(a.key)}${a.name}</button>`).join('')}</div>
      ${imgField(p + '.image', 'Ürün görseli', 'Ayarlardan “Ürün görsellerini göster” açıksa menüde görünür.')}
      <div class="row-actions">
        <div class="l">
          <label class="switch"><input type="checkbox" data-bind="${p}.available" data-type="bool" ${it.available !== false ? 'checked' : ''}>Satışta</label>
          <label class="switch"><input type="checkbox" data-bind="${p}.priceFrom" data-type="bool" ${it.priceFrom ? 'checked' : ''}>Başlangıç fiyatı</label>
        </div>
        <div class="r">
          <button class="btn sm" data-move="${ci}.${ii}.-1">Yukarı</button>
          <button class="btn sm" data-move="${ci}.${ii}.1">Aşağı</button>
          <button class="btn sm" data-dup="${ci}.${ii}">Kopyala</button>
          <button class="btn sm danger" data-del="${ci}.${ii}">Sil</button>
        </div>
      </div>
    </div>` : ''}
  </div>`;
}

function renderMenu() {
  const q = filter.toLocaleLowerCase('tr');
  const total = M.categories.reduce((n, c) => n + c.items.length, 0);
  $('#stats').textContent = `${M.categories.length} kategori, ${total} ürün`;
  $('#cats').innerHTML = M.categories.map((c, ci) => {
    const rows = c.items.map((it, ii) => [it, ii]).filter(([it]) => !q || (it.name || '').toLocaleLowerCase('tr').includes(q));
    if (q && !rows.length) return '';
    return `<div class="card cat">
      <div class="cat-h">
        <div class="name"><input data-bind="categories.${ci}.name" value="${esc(c.name)}"><small>${c.items.length} ürün</small></div>
        <div class="cat-tools">
          <button class="btn icon sm" data-cmove="${ci}.-1" title="Yukarı"><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button>
          <button class="btn icon sm" data-cmove="${ci}.1" title="Aşağı"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
          <button class="btn icon sm danger" data-cdel="${ci}" title="Kategoriyi sil"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
        </div>
      </div>
      <div class="cat-body">
        <div class="grid2 cat-meta">
          ${field(`categories.${ci}.subtitle`, 'Alt başlık')}
          <label class="fld"><span>Simge</span><select data-bind="categories.${ci}.icon">${Object.entries(ICONS).map(([k, v]) => `<option value="${k}" ${c.icon === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        ${rows.map(([, ii]) => itemRow(ci, ii)).join('')}
        <button class="add-item" data-add="${ci}">+ Bu kategoriye ürün ekle</button>
      </div>
    </div>`;
  }).join('');
}

function renderSettings() {
  const s = 'settings';
  $('#settingsForm').innerHTML = `
    ${imgField('settings.logoImage', 'Logo', 'Kare, şeffaf PNG önerilir.')}
    ${imgField('settings.coverImage', 'Kapak görseli', 'Menünün en üstünde, mor tonların altında hafifçe görünür.')}
    <div class="grid2">${field(s + '.name', 'İşletme adı')}${field(s + '.sub', 'Alt yazı')}</div>
    ${field(s + '.tagline', 'Slogan')}
    ${field(s + '.notice', 'Üstteki duyuru', 'text', 'placeholder="Boş bırakılırsa gösterilmez"')}
    ${field(s + '.address', 'Adres', 'text', 'placeholder="Mahalle, cadde, no, ilçe, şehir"')}
    ${field(s + '.mapsUrl', 'Harita bağlantısı', 'url', 'placeholder="Google Haritalar bağlantısı (isteğe bağlı)"')}
    <div class="grid2">${field(s + '.instagram', 'Instagram kullanıcı adı', 'text', 'placeholder="kullaniciadi"')}${field(s + '.phone', 'Telefon', 'tel', 'placeholder="+90 5xx xxx xx xx"')}</div>
    <div class="grid2">${field(s + '.hours', 'Çalışma saatleri', 'text', 'placeholder="Her gün 08:00 ile 23:00 arası"')}${field(s + '.wifi', 'WiFi adı', 'text', 'placeholder="Ağ adı"')}</div>
    <p class="muted">Boş bırakılan iletişim bilgileri menüde gösterilmez.</p>
    <label class="switch"><input type="checkbox" data-bind="settings.showPhotos" data-type="bool" ${M.settings.showPhotos ? 'checked' : ''}>Ürün görsellerini menüde göster</label>`;
}

async function renderLib() {
  $('#lib').innerHTML = '<p class="muted">Yükleniyor...</p>';
  try {
    const { images } = await api('/api/upload');
    $('#lib').innerHTML = images.length ? images.map((i) => `<figure><img src="${esc(i.url)}" loading="lazy" alt=""><figcaption><button class="btn sm" data-copy="${esc(i.url)}">Bağlantı</button><button class="btn sm danger" data-rm="${esc(i.url)}">Sil</button></figcaption></figure>`).join('') : '<p class="muted">Henüz görsel yüklenmedi.</p>';
  } catch (e) { $('#lib').innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}

function renderAll() { renderMenu(); renderSettings(); }

/* ---------- events ---------- */
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-bind]'); if (!el) return;
  const t = el.dataset.type;
  let v = el.value;
  if (t === 'number') v = v === '' ? '' : Number(v);
  if (t === 'bool') v = el.checked;
  if (t === 'list') v = v.split(',').map((x) => x.trim()).filter(Boolean);
  if (t === 'lines') v = v.split('\n').map((x) => x.trim()).filter(Boolean);
  setPath(el.dataset.bind, v);
  setDirty();
  if (t === 'bool' && el.dataset.bind.endsWith('.available')) el.closest('.row')?.classList.toggle('unavailable', !v);
});
document.addEventListener('change', (e) => { if (e.target.matches('select[data-bind]')) { setPath(e.target.dataset.bind, e.target.value); setDirty(); } });

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button, [data-toggle]'); if (!b) return;
  const d = b.dataset;
  if (d.toggle) { open.has(d.toggle) ? open.delete(d.toggle) : open.add(d.toggle); renderMenu(); return; }
  if (d.al) {
    const it = getPath(d.al); const set = new Set(it.allergens || []);
    set.has(d.k) ? set.delete(d.k) : set.add(d.k);
    it.allergens = ALLERGENS.map((a) => a.key).filter((k) => set.has(k));
    b.classList.toggle('on'); setDirty(); return;
  }
  if (d.add) {
    const it = { id: uid('yeni'), name: 'Yeni ürün', desc: '', price: 0, unit: '', size: '', note: '', kcal: '', kcalNote: '', priceFrom: false, allergens: [], tags: [], image: '', available: true };
    M.categories[d.add].items.push(it); open.add(it.id); setDirty(); renderMenu(); return;
  }
  if (d.move) {
    const [ci, ii, dir] = d.move.split('.').map(Number); const arr = M.categories[ci].items; const j = ii + dir;
    if (j < 0 || j >= arr.length) return; [arr[ii], arr[j]] = [arr[j], arr[ii]]; setDirty(); renderMenu(); return;
  }
  if (d.dup) {
    const [ci, ii] = d.dup.split('.').map(Number); const c = structuredClone(M.categories[ci].items[ii]);
    c.id = uid(c.name); c.name += ' (kopya)'; M.categories[ci].items.splice(ii + 1, 0, c); open.add(c.id); setDirty(); renderMenu(); return;
  }
  if (d.del) {
    const [ci, ii] = d.del.split('.').map(Number);
    if (!confirm(`“${M.categories[ci].items[ii].name}” silinsin mi?`)) return;
    M.categories[ci].items.splice(ii, 1); setDirty(); renderMenu(); return;
  }
  if (d.cmove) {
    const [ci, dir] = d.cmove.split('.').map(Number); const a = M.categories; const j = ci + dir;
    if (j < 0 || j >= a.length) return; [a[ci], a[j]] = [a[j], a[ci]]; setDirty(); renderMenu(); return;
  }
  if (d.cdel) {
    const c = M.categories[d.cdel];
    if (!confirm(`“${c.name}” kategorisi ve içindeki ${c.items.length} ürün silinsin mi?`)) return;
    M.categories.splice(d.cdel, 1); setDirty(); renderMenu(); return;
  }
  if (d.img) { imageAction(d.img, d.how); return; }
  if (d.copy) { navigator.clipboard?.writeText(d.copy); toast('Bağlantı kopyalandı'); return; }
  if (d.rm) {
    if (!confirm('Bu görsel kalıcı olarak silinsin mi?')) return;
    try { await api('/api/upload', { method: 'DELETE', body: JSON.stringify({ url: d.rm }) }); toast('Görsel silindi'); renderLib(); } catch (er) { toast(er.message, true); }
    return;
  }
  if (d.tab) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === b));
    document.querySelectorAll('.pane').forEach((p) => (p.hidden = p.id !== 'tab-' + d.tab));
    if (d.tab === 'images') renderLib();
    scrollTo(0, 0);
  }
});

$('#addCat').onclick = () => {
  M.categories.push({ id: uid('kategori'), name: 'Yeni kategori', subtitle: '', icon: 'heart', items: [] });
  setDirty(); renderMenu(); scrollTo(0, document.body.scrollHeight);
};
$('#q').oninput = (e) => { filter = e.target.value; renderMenu(); };

$('#previewBtn').onclick = () => {
  try { localStorage.setItem('mh_preview', JSON.stringify(M)); } catch {}
  window.open('/?onizleme=1', '_blank');
};
$('#publishBtn').onclick = async () => {
  const b = $('#publishBtn'); b.disabled = true; b.textContent = 'Yayınlanıyor...';
  try { await api('/api/menu', { method: 'PUT', body: JSON.stringify(M) }); setDirty(false); toast('Menü yayınlandı ♡'); }
  catch (e) { toast(e.message, true); }
  finally { b.disabled = false; b.textContent = 'Yayınla'; }
};

async function uploadMany(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  for (let i = 0; i < list.length; i++) {
    toast(`Yükleniyor ${i + 1} / ${list.length}`);
    try { await upload(list[i]); } catch (e) { toast(e.message, true); return; }
  }
  toast('Görseller yüklendi'); renderLib();
}
$('#libUpload').onchange = (e) => uploadMany(e.target.files);
$('#dropInput').onchange = (e) => uploadMany(e.target.files);
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => uploadMany(e.dataTransfer.files));

/* ---------- auth ---------- */
function logout() { token = ''; sessionStorage.removeItem('mh_token'); $('#app').hidden = true; $('#login').hidden = false; }
$('#logoutBtn').onclick = () => { if (dirty && !confirm('Kaydedilmemiş değişiklikler var. Çıkılsın mı?')) return; setDirty(false); logout(); };

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  $('#loginErr').hidden = true;
  try {
    const j = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value }) });
    token = j.token; sessionStorage.setItem('mh_token', token); start();
  } catch (er) { $('#loginErr').textContent = er.message; $('#loginErr').hidden = false; }
};

async function start() {
  $('#login').hidden = true; $('#app').hidden = false;
  try {
    const r = await fetch('/api/menu', { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    M = j?.menu || (await (await fetch('/data/menu.json', { cache: 'no-store' })).json());
  } catch { M = await (await fetch('/data/menu.json')).json(); }
  M.settings ||= {}; M.categories ||= [];
  renderAll();
}

if (token) start();
