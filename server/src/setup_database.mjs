import crypto from "node:crypto";
import { getPool, sql } from "./db.js";

function hashPassword(pass) {
  return crypto.createHash("sha256").update(pass).digest("hex");
}

async function run() {
  console.log("Connecting to MS SQL Server...");
  const pool = await getPool();

  // 1. Ensure media_type column in dbo.Songs
  console.log("Checking dbo.Songs columns...");
  const checkCol = await pool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Songs' AND COLUMN_NAME = 'media_type'
  `);
  if (checkCol.recordset.length === 0) {
    console.log("Adding media_type column to dbo.Songs...");
    await pool.request().query(`
      ALTER TABLE dbo.Songs ADD media_type NVARCHAR(20) NOT NULL CONSTRAINT DF_Songs_media_type DEFAULT 'audio' WITH VALUES;
    `);
  }

  // 2. Create dbo.Users table
  console.log("Ensuring dbo.Users table...");
  await pool.request().query(`
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

  // 3. Create dbo.Favorites table
  console.log("Ensuring dbo.Favorites table...");
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.Favorites', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Favorites (
        favorite_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
        song_id INT NOT NULL FOREIGN KEY REFERENCES dbo.Songs(song_id) ON DELETE CASCADE,
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_User_Song UNIQUE (user_id, song_id)
      );
    END
  `);

  // 4. Seed default users
  console.log("Seeding default users...");
  const adminPass = hashPassword("admin123");
  const userPass = hashPassword("user123");

  await pool.request()
    .input("admin_user", sql.NVarChar(100), "admin")
    .input("admin_email", sql.NVarChar(150), "admin@songsportal.com")
    .input("admin_pass", sql.NVarChar(255), adminPass)
    .input("admin_role", sql.NVarChar(50), "admin")
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = @admin_user)
      BEGIN
        INSERT INTO dbo.Users (username, email, password, role)
        VALUES (@admin_user, @admin_email, @admin_pass, @admin_role);
      END
    `);

  await pool.request()
    .input("user_name", sql.NVarChar(100), "abhay")
    .input("user_email", sql.NVarChar(150), "abhay@songsportal.com")
    .input("user_pass", sql.NVarChar(255), userPass)
    .input("user_role", sql.NVarChar(50), "user")
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = @user_name)
      BEGIN
        INSERT INTO dbo.Users (username, email, password, role)
        VALUES (@user_name, @user_email, @user_pass, @user_role);
      END
    `);

  // 5. Seed sample songs (both audio and video)
  console.log("Checking sample songs...");
  const countRes = await pool.request().query("SELECT COUNT(*) as cnt FROM dbo.Songs");
  if (countRes.recordset[0].cnt < 4) {
    console.log("Seeding initial audio & video songs...");
    const sampleItems = [
      {
        name: "Kesariya",
        singer: "Arijit Singh",
        movie: "Brahmastra",
        album: "Brahmastra",
        language: "Hindi",
        category: "Bollywood",
        year: 2022,
        rating: 4.8,
        type: "Romantic Songs",
        media: "audio",
        file: "sample1.mp3"
      },
      {
        name: "Brown Munde",
        singer: "AP Dhillon, Gurinder Gill",
        movie: null,
        album: "Brown Munde",
        language: "Punjabi",
        category: "Punjabi",
        year: 2021,
        rating: 4.7,
        type: "Remix Songs",
        media: "audio",
        file: "sample2.mp3"
      },
      {
        name: "Shree Hanuman Chalisa",
        singer: "Gulshan Kumar",
        movie: null,
        album: "Hanuman Chalisa",
        language: "Hindi",
        category: "Bhakti",
        year: 2011,
        rating: 5.0,
        type: "Devotional Songs",
        media: "audio",
        file: "sample1.mp3"
      },
      {
        name: "Raataan Lambiyan (Official Video)",
        singer: "Jubin Nautiyal, Asees Kaur",
        movie: "Shershaah",
        album: "Shershaah",
        language: "Hindi",
        category: "Bollywood",
        year: 2021,
        rating: 4.9,
        type: "Romantic Songs",
        media: "video",
        file: "sample1.mp4"
      },
      {
        name: "Excuses Video Hits",
        singer: "AP Dhillon",
        movie: null,
        album: "Hidden Gems",
        language: "Punjabi",
        category: "Punjabi",
        year: 2022,
        rating: 4.6,
        type: "Remix Songs",
        media: "video",
        file: "sample2.mp4"
      }
    ];

    for (const item of sampleItems) {
      await pool.request()
        .input("song_name", sql.NVarChar(200), item.name)
        .input("singer_name", sql.NVarChar(200), item.singer)
        .input("movie_name", sql.NVarChar(200), item.movie)
        .input("album_name", sql.NVarChar(200), item.album)
        .input("language", sql.NVarChar(50), item.language)
        .input("category", sql.NVarChar(100), item.category)
        .input("year", sql.Int, item.year)
        .input("ratting", sql.Decimal(3, 1), item.rating)
        .input("type_of_song", sql.NVarChar(100), item.type)
        .input("song_file", sql.NVarChar(255), item.file)
        .input("image_file", sql.NVarChar(255), null)
        .input("media_type", sql.NVarChar(20), item.media)
        .query(`
          INSERT INTO dbo.Songs
            (song_name, singer_name, movie_name, album_name, [language], category,
             year_of_Publishing, ratting, type_of_song, song_file, image_file, media_type)
          VALUES
            (@song_name, @singer_name, @movie_name, @album_name, @language, @category,
             @year, @ratting, @type_of_song, @song_file, @image_file, @media_type)
        `);
    }
  }

  console.log("DB Setup Complete!");
  const users = await pool.request().query("SELECT user_id, username, email, role FROM dbo.Users");
  console.log("Users in DB:", users.recordset);
  const songs = await pool.request().query("SELECT song_id, song_name, singer_name, category, media_type, song_file FROM dbo.Songs");
  console.log("Songs in DB:", songs.recordset);
  process.exit(0);
}

run().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
