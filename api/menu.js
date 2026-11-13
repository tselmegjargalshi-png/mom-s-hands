import { list, put, del } from '@vercel/blob';
import { isAuthed, hasBlob } from './_auth.js';

const PREFIX = 'menu/';
const KEEP = 15;

async function latest() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs;
}

function valid(menu) {
  return menu && typeof menu === 'object' && menu.settings && Array.isArray(menu.categories) &&
    menu.categories.every((c) => c && typeof c.name === 'string' && Array.isArray(c.items));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    if (!hasBlob()) return res.status(404).json({ source: 'default' });
    try {
      const blobs = await latest();
      if (!blobs.length) return res.status(404).json({ source: 'default' });
      const r = await fetch(blobs[0].url, { cache: 'no-store' });
      const menu = await r.json();
      return res.status(200).json({ source: 'live', updatedAt: blobs[0].uploadedAt, menu });
    } catch (e) {
      return res.status(500).json({ error: 'Menü okunamadı' });
    }
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yapın' });
    if (!hasBlob()) return res.status(500).json({ error: 'Depolama bağlı değil' });
    const menu = req.body;
    if (!valid(menu)) return res.status(400).json({ error: 'Menü verisi geçersiz' });
    const body = JSON.stringify(menu);
    if (body.length > 2_000_000) return res.status(413).json({ error: 'Menü çok büyük' });
    const blob = await put(`${PREFIX}menu-${Date.now()}.json`, body, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    try {
      const blobs = await latest();
      const old = blobs.slice(KEEP).map((b) => b.url);
      if (old.length) await del(old);
    } catch {}
    return res.status(200).json({ ok: true, updatedAt: blob.uploadedAt || new Date().toISOString() });
  }

  return res.status(405).json({ error: 'Desteklenmeyen istek' });
}
