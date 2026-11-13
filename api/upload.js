import { list, put, del } from '@vercel/blob';
import { isAuthed, hasBlob } from './_auth.js';

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthed(req)) return res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yapın' });
  if (!hasBlob()) return res.status(500).json({ error: 'Depolama bağlı değil' });

  if (req.method === 'GET') {
    const { blobs } = await list({ prefix: 'images/', limit: 500 });
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    return res.status(200).json({ images: blobs.map((b) => ({ url: b.url, size: b.size, uploadedAt: b.uploadedAt, name: b.pathname.replace('images/', '') })) });
  }

  if (req.method === 'POST') {
    const { filename = 'gorsel', contentType, data } = req.body || {};
    if (!OK_TYPES.includes(contentType) || typeof data !== 'string') return res.status(400).json({ error: 'Desteklenmeyen dosya türü' });
    const buf = Buffer.from(data, 'base64');
    if (buf.length > 3_500_000) return res.status(413).json({ error: 'Dosya çok büyük' });
    const safe = String(filename).toLowerCase().replace(/[^a-z0-9.]+/g, '_').slice(0, 60);
    const blob = await put(`images/${Date.now()}_${safe}`, buf, { access: 'public', contentType, addRandomSuffix: true });
    return res.status(200).json({ url: blob.url });
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {};
    if (typeof url !== 'string' || !url.includes('/images/')) return res.status(400).json({ error: 'Geçersiz adres' });
    await del(url);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Desteklenmeyen istek' });
}
