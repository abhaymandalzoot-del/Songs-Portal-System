import { getPool } from "./db.js";

async function main() {
  const pool = await getPool();
  const tables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
  console.log("TABLES:", JSON.stringify(tables.recordset, null, 2));

  const cols = await pool.request().query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_NAME, ORDINAL_POSITION");
  console.log("COLUMNS:", JSON.stringify(cols.recordset, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
