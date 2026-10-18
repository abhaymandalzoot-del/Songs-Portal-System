import { getPool, sql } from "./db.js";

async function main() {
  try {
    const pool = await getPool();
    const r1 = await pool.request().query("SELECT @@SERVERNAME AS srv, DB_ID() AS dbid, SYSTEM_USER AS usr");
    console.log("CONNECTED:", JSON.stringify(r1.recordset[0]));

    const r2 = await pool.request().query("SELECT COUNT(*) AS cnt FROM dbo.Songs");
    console.log("SONGS_COUNT:", r2.recordset[0].cnt);

    // Insert + delete a dummy row to prove full write path
    const r3 = await pool.request()
      .input("song_name", sql.NVarChar(200), "TEST_SONG_PROOF")
      .input("singer_name", sql.NVarChar(200), "TESTER")
      .input("movie_name", sql.NVarChar(200), null)
      .input("album_name", sql.NVarChar(200), null)
      .input("language", sql.NVarChar(50), "Hindi")
      .input("category", sql.NVarChar(100), "Album Songs")
      .input("year", sql.Int, 2026)
      .input("ratting", sql.Decimal(3, 1), 4.5)
      .input("type_of_song", sql.NVarChar(100), "Romantic Songs")
      .input("song_file", sql.NVarChar(255), "test.mp3")
      .input("image_file", sql.NVarChar(255), null)
      .query(`INSERT INTO dbo.Songs (song_name, singer_name, movie_name, album_name, [language], category, year_of_Publishing, ratting, type_of_song, song_file, image_file) OUTPUT INSERTED.song_id VALUES (@song_name, @singer_name, @movie_name, @album_name, @language, @category, @year, @ratting, @type_of_song, @song_file, @image_file)`);
    const newId = r3.recordset[0].song_id;
    console.log("INSERT_OK, new song_id =", newId);

    await pool.request().input("id", sql.Int, newId).query("DELETE FROM dbo.Songs WHERE song_id = @id");
    console.log("DELETE_OK, cleaned up test row");

    console.log("ALL_PROOFS_PASS");
    process.exit(0);
  } catch (e) {
    console.error("TEST_FAILED:", e.message);
    process.exit(1);
  }
}
main();
