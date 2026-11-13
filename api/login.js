import { checkPassword, issueToken } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Yalnızca POST' });
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'Yönetici şifresi tanımlı değil' });
  const { password } = req.body || {};
  // small delay against brute force
  await new Promise((r) => setTimeout(r, 400));
  if (!checkPassword(password)) return res.status(401).json({ error: 'Şifre hatalı' });
  return res.status(200).json({ token: issueToken() });
}
