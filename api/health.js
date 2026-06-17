import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ ok: false, error: 'DATABASE_URL não configurada.' });
    }
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT now() AS now`;
    return res.status(200).json({ ok: true, database: 'connected', now: result[0].now });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Erro ao conectar no Neon.' });
  }
}
