import { getPool } from "./db.js";

async function main() {
  const pool = await getPool();
  const res = await pool.request().query("SELECT user_id, username, email, role, FORMAT(created_at, 'yyyy-MM-dd HH:mm') as registered_at FROM dbo.Users ORDER BY user_id ASC");
  console.log("\n========================== REGISTERED USERS IN DATABASE ==========================");
  console.table(res.recordset);
  console.log("==================================================================================\n");
  process.exit(0);
}

main().catch(err => {
  console.error("Error inspecting users:", err.message);
  process.exit(1);
});
