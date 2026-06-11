import { createUser } from '../services/userService.js'
import db from '../config/db.js'

async function run() {
  try {
    const email = 'ci_manual_test@example.com'
    const hashed = '$2b$10$abcdefghijklmnopqrstuv' // dummy hash; not secure, just testing DB insert
    const user = await createUser(email, hashed)
    console.log('Inserted user:', user)
    const res = await db.query('SELECT id, email, created_at FROM users ORDER BY id DESC LIMIT 5')
    console.log('Latest users:', res.rows)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    process.exit()
  }
}

run()
