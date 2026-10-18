import sql from "mssql";

async function run() {
  const cfgAudio = {
    server: "localhost",
    port: 1433,
    database: "AudioSongDB",
    user: "sa",
    password: "Abhay@123",
    options: { encrypt: false, trustServerCertificate: true }
  };
  const poolAudio = new sql.ConnectionPool(cfgAudio);
  await poolAudio.connect();

  const songsData = await poolAudio.request().query("SELECT * FROM dbo.Songs ORDER BY song_id ASC");
  const usersData = await poolAudio.request().query("SELECT * FROM dbo.Users ORDER BY user_id ASC");
  const favsData = await poolAudio.request().query("SELECT * FROM dbo.Favorites");
  await poolAudio.close();

  const cfgPortal = {
    server: "localhost",
    port: 1433,
    database: "SongsPortalSystem",
    user: "sa",
    password: "Abhay@123",
    options: { encrypt: false, trustServerCertificate: true }
  };
  const poolPortal = new sql.ConnectionPool(cfgPortal);
  await poolPortal.connect();

  // Create Users table in SongsPortalSystem if not exists
  await poolPortal.request().query(`
    IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Users (
        user_id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(100) NOT NULL UNIQUE,
        email NVARCHAR(150) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        role NVARCHAR(50) NOT NULL DEFAULT 'user',
        created_at DATETIME2 DEFAULT GETDATE()
      );
    END
  `);

  // Create Songs table in SongsPortalSystem if not exists
  await poolPortal.request().query(`
    IF OBJECT_ID(N'dbo.Songs', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Songs (
        song_id INT IDENTITY(1,1) PRIMARY KEY,
        song_name NVARCHAR(200) NOT NULL,
        singer_name NVARCHAR(200) NOT NULL,
        movie_name NVARCHAR(200) NULL,
        album_name NVARCHAR(200) NULL,
        language NVARCHAR(50) NOT NULL,
        category NVARCHAR(100) NOT NULL,
        year_of_Publishing INT NULL,
        ratting DECIMAL(3,1) NULL,
        type_of_song NVARCHAR(100) NOT NULL,
        media_type NVARCHAR(20) NOT NULL DEFAULT 'audio',
        song_file NVARCHAR(255) NOT NULL,
        image_file NVARCHAR(255) NULL,
        created_at DATETIME2 DEFAULT GETDATE()
      );
    END
  `);

  // Create Favorites table in SongsPortalSystem if not exists
  await poolPortal.request().query(`
    IF OBJECT_ID(N'dbo.Favorites', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Favorites (
        favorite_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
        song_id INT NOT NULL FOREIGN KEY REFERENCES dbo.Songs(song_id) ON DELETE CASCADE,
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_Portal_User_Song UNIQUE (user_id, song_id)
      );
    END
  `);

  // Sync Users
  for (const u of usersData.recordset) {
    await poolPortal.request()
      .input("uname", sql.NVarChar(100), u.username)
      .input("email", sql.NVarChar(150), u.email)
      .input("pass", sql.NVarChar(255), u.password)
      .input("role", sql.NVarChar(50), u.role)
      .input("created", sql.DateTime2, u.created_at)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = @uname)
        BEGIN
          INSERT INTO dbo.Users (username, email, password, role, created_at)
          VALUES (@uname, @email, @pass, @role, @created);
        END
      `);
  }

  // Sync Songs
  for (const s of songsData.recordset) {
    await poolPortal.request()
      .input("name", sql.NVarChar(200), s.song_name)
      .input("singer", sql.NVarChar(200), s.singer_name)
      .input("movie", sql.NVarChar(200), s.movie_name)
      .input("album", sql.NVarChar(200), s.album_name)
      .input("lang", sql.NVarChar(50), s.language)
      .input("cat", sql.NVarChar(100), s.category)
      .input("yr", sql.Int, s.year_of_Publishing)
      .input("rat", sql.Decimal(3,1), s.ratting)
      .input("type", sql.NVarChar(100), s.type_of_song)
      .input("media", sql.NVarChar(20), s.media_type)
      .input("sfile", sql.NVarChar(255), s.song_file)
      .input("ifile", sql.NVarChar(255), s.image_file)
      .input("created", sql.DateTime2, s.created_at)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Songs WHERE song_name = @name AND singer_name = @singer)
        BEGIN
          INSERT INTO dbo.Songs (song_name, singer_name, movie_name, album_name, language, category, year_of_Publishing, ratting, type_of_song, media_type, song_file, image_file, created_at)
          VALUES (@name, @singer, @movie, @album, @lang, @cat, @yr, @rat, @type, @media, @sfile, @ifile, @created);
        END
      `);
  }

  // Sync Favorites
  for (const f of favsData.recordset) {
    await poolPortal.request()
      .input("uid", sql.Int, f.user_id)
      .input("sid", sql.Int, f.song_id)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Favorites WHERE user_id = @uid AND song_id = @sid)
        BEGIN
          INSERT INTO dbo.Favorites (user_id, song_id) VALUES (@uid, @sid);
        END
      `);
  }

  const checkUsers = await poolPortal.request().query("SELECT user_id, username, email, role FROM dbo.Users");
  const checkSongs = await poolPortal.request().query("SELECT song_id, song_name, media_type FROM dbo.Songs");
  console.log("SUCCESS! SongsPortalSystem now populated:");
  console.log("Users:", checkUsers.recordset);
  console.log("Songs:", checkSongs.recordset);

  await poolPortal.close();
  process.exit(0);
}

run().catch(err => {
  console.error("Sync error:", err);
  process.exit(1);
});
