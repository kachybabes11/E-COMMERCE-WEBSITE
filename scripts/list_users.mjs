import db from '../config/db.js'

async function list() {
  try {
    const res = await db.query('SELECT id, email, is_admin, created_at FROM users ORDER BY id DESC LIMIT 10')
    console.log(res.rows)
  } catch (err) {
    console.error('DB error', err)
  } finally {
    process.exit()
  }
}

list()
