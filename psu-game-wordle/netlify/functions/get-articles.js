import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
})

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { Allow: 'GET' },
      body: 'Method Not Allowed',
    }
  }

  try {
    const query = `
      select guid, title, author, pub_date, url
      from articles
      order by pub_date desc
      limit 50
    `
    const { rows } = await pool.query(query)
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rows),
    }
  } catch (error) {
    console.error('Error fetching articles:', error)
    return {
      statusCode: 500,
      body: 'Server error',
    }
  }
}
