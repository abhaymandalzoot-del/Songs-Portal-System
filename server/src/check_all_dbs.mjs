import sql from "mssql";

const dbs = ["SongsPortalDB", "SongsPortalSystem", "Songs Portal System", "AudioSongDB"];

async function check() {
  for (const db of dbs) {
    try {
      const config = {
        server: "localhost",
        port: 1433,
        database: db,
        user: "sa",
        password: "Abhay@123",
        options: { encrypt: false, trustServerCertificate: true }
      };
      const pool = await sql.connect(config);
      const tables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
      const tnames = tables.recordset.map(t => t.TABLE_NAME);
      console.log(`DB [${db}] Tables:`, tnames);

      for (const t of tnames) {
        const count = await pool.request().query(`SELECT COUNT(*) as cnt FROM [dbo].[${t}]`);
        console.log(`  -> Table [${t}]: ${count.recordset[0].cnt} rows`);
      }
      await pool.close();
    } catch (err) {
      console.log(`DB [${db}] Error:`, err.message);
    }
  }
  process.exit(0);
}

check();
