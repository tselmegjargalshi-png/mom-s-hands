import crypto from 'node:crypto';

const TTL = 1000 * 60 * 60 * 12; // 12 hours

function secret() {
  return process.env.ADMIN_PASSWORD || '';
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issueToken() {
  const exp = String(Date.now() + TTL);
  return `${exp}.${sign(exp)}`;
}

export function checkPassword(pw) {
  const s = secret();
  if (!s || typeof pw !== 'string') return false;
  const a = Buffer.from(pw);
  const b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAuthed(req) {
  if (!secret()) return false;
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return good.length === got.length && crypto.timingSafeEqual(good, got);
}

export function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
