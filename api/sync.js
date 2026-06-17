import { neon } from '@neondatabase/serverless';

const STORE_ID = 'default';

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada no Vercel.');
  }
  return neon(process.env.DATABASE_URL);
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS vetcore_sync_store (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    INSERT INTO vetcore_sync_store (id, data)
    VALUES (${STORE_ID}, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
}

export default async function handler(req, res) {
  allowCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const sql = getSql();
    await ensureTable(sql);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data, updated_at
        FROM vetcore_sync_store
        WHERE id = ${STORE_ID}
        LIMIT 1
      `;
      return res.status(200).json({
        ok: true,
        data: rows[0]?.data || {},
        updated_at: rows[0]?.updated_at || null
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const data = body.data || {};

      if (typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({ ok: false, error: 'Formato inválido.' });
      }

      await sql`
        UPDATE vetcore_sync_store
        SET data = ${JSON.stringify(data)}::jsonb,
            updated_at = now()
        WHERE id = ${STORE_ID}
      `;

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Erro interno na API.'
    });
  }
}
