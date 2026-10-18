import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { getPool, sql } from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

function hashPassword(pass) {
  return crypto.createHash("sha256").update(String(pass).trim()).digest("hex");
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB limit to accommodate video clips
  fileFilter: (_req, file, cb) => {
    const isAudioOrVideo = file.fieldname === "songFile" && (
      file.mimetype.startsWith("audio/") ||
      file.mimetype.startsWith("video/") ||
      /\.(mp3|wav|ogg|m4a|aac|flac|webm|mp4|mkv)$/i.test(file.originalname)
    );
    const isImage = file.fieldname === "imageFile" && (
      file.mimetype.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.originalname)
    );
    if (isAudioOrVideo || isImage) return cb(null, true);
    cb(new Error(file.fieldname === "songFile" ? "Please upload a valid audio or video file." : "Please upload a valid image file."));
  }
});

function publicSong(row) {
  let coverUrl = null;
  if (row.image_file) {
    if (row.image_file.startsWith("http://") || row.image_file.startsWith("https://")) {
      coverUrl = row.image_file;
    } else {
      coverUrl = `/uploads/${encodeURIComponent(row.image_file)}`;
    }
  }
  return {
    ...row,
    audio_url: `/api/songs/${row.song_id}/stream`,
    download_url: `/api/songs/${row.song_id}/download`,
    cover_image_url: coverUrl,
    is_favorite: Boolean(row.is_favorite)
  };
}

function deleteUploadedFile(filename) {
  if (!filename) return;
  if (filename.startsWith("cover_") || filename.startsWith("sample")) return;
  const target = path.join(uploadDir, path.basename(filename));
  if (fs.existsSync(target)) {
    fs.unlink(target, () => {});
  }
}

function parseSongFields(body, uploadedFile) {
  if (!body.song_name || !String(body.song_name).trim()) throw new Error("Song name is required.");
  if (!body.singer_name || !String(body.singer_name).trim()) throw new Error("Singer name is required.");

  const rawYear = body.year_of_Publishing ?? body.year;
  const rawRating = body.ratting ?? body.rating;
  const year = rawYear === undefined || rawYear === "" || rawYear === null ? null : Number(rawYear);
  const rating = rawRating === undefined || rawRating === "" || rawRating === null ? null : Number(rawRating);

  let mediaType = body.media_type ? String(body.media_type).toLowerCase().trim() : "audio";
  if (uploadedFile) {
    const ext = path.extname(uploadedFile.originalname || uploadedFile.filename || "").toLowerCase();
    if (ext === ".mp4" || ext === ".mkv" || uploadedFile.mimetype?.startsWith("video/")) {
      mediaType = "video";
    }
  }

  return {
    song_name: String(body.song_name).trim(),
    singer_name: String(body.singer_name).trim(),
    movie_name: String(body.movie_name || "").trim() || null,
    album_name: String(body.album_name || "").trim() || null,
    language: String(body.language || "Hindi").trim(),
    category: String(body.category || "Bollywood").trim(),
    year_of_Publishing: year,
    ratting: rating,
    type_of_song: String(body.type_of_song || "Romantic Songs").trim(),
    media_type: mediaType === "video" ? "video" : "audio"
  };
}

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
app.get("/api/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// -------------------------------------------------------------
// AUTH & RBAC ROUTES
// -------------------------------------------------------------
const otpStore = new Map();

let mailTransporter = null;
function getMailTransporter() {
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (user && pass) {
    if (!mailTransporter) {
      mailTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user,
          pass
        }
      });
    }
    return mailTransporter;
  }
  return null;
}

// 1. Send OTP to Email
app.post("/api/auth/send-otp", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required." });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const pool = await getPool();
    const existing = await pool.request()
      .input("username", sql.NVarChar(100), cleanUsername)
      .input("email", sql.NVarChar(150), cleanEmail)
      .query("SELECT user_id FROM dbo.Users WHERE username = @username OR email = @email");

    if (existing.recordset.length > 0) {
      return res.status(400).json({ message: "Username or Email is already registered." });
    }

    const transporter = getMailTransporter();
    if (!transporter) {
      return res.status(500).json({
        message: "Email service (SMTP) is not configured on the server. Please check SMTP_USER and SMTP_PASS in server/.env."
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    try {
      await transporter.sendMail({
        from: `"Songs Portal System" <${(process.env.SMTP_USER || "").trim()}>`,
        to: cleanEmail,
        subject: "Your Songs Portal Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; padding: 30px; border: 1px solid #334155;">
            <h2 style="color: #6366f1; margin-top: 0;">Songs Portal System 🎵</h2>
            <p style="color: #cbd5e1; font-size: 15px;">Hello <strong>${cleanUsername}</strong>,</p>
            <p style="color: #94a3b8; font-size: 14px;">Use the verification code below to complete your registration:</p>
            <div style="text-align: center; margin: 25px 0;">
              <span style="display: inline-block; background: #1e293b; color: #ec4899; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 12px 28px; border-radius: 8px; border: 1px solid #475569;">
                ${otp}
              </span>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `
      });
      console.log(`[EMAIL SENT] Successfully delivered OTP to ${cleanEmail}`);
    } catch (mailErr) {
      console.error(`[EMAIL SEND FAILED]:`, mailErr.message);
      return res.status(500).json({
        message: `Failed to send verification email to ${cleanEmail}: ${mailErr.message}. Please verify the email address is correct.`
      });
    }

    otpStore.set(cleanEmail, {
      otp,
      expiresAt,
      username: cleanUsername,
      email: cleanEmail,
      password: String(password).trim()
    });

    console.log(`\n======================================================`);
    console.log(`[EMAIL OTP VERIFICATION] To: ${cleanEmail}`);
    console.log(`Expires in: 10 minutes`);
    console.log(`======================================================\n`);

    res.json({
      message: `Verification OTP has been sent to ${cleanEmail}! Please check your inbox and spam folder.`
    });
  } catch (error) { next(error); }
});

// 2. Verify OTP & Complete Registration (ALWAYS role: 'user')
app.post("/api/auth/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP code are required." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const record = otpStore.get(cleanEmail);
    if (!record) {
      return res.status(400).json({ message: "No pending registration found for this email. Please request a new code." });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ message: "OTP has expired. Please request a new code." });
    }

    if (record.otp !== cleanOtp) {
      return res.status(400).json({ message: "Invalid verification code. Please check and try again." });
    }

    // STRICT: Normal registrations are ALWAYS role = 'user'
    const pool = await getPool();
    const hashed = hashPassword(record.password);

    const result = await pool.request()
      .input("username", sql.NVarChar(100), record.username)
      .input("email", sql.NVarChar(150), record.email)
      .input("password", sql.NVarChar(255), hashed)
      .input("role", sql.NVarChar(50), "user")
      .query(`
        INSERT INTO dbo.Users (username, email, password, role)
        OUTPUT INSERTED.user_id, INSERTED.username, INSERTED.email, INSERTED.role
        VALUES (@username, @email, @password, @role)
      `);

    otpStore.delete(cleanEmail);

    const createdUser = result.recordset[0];
    res.status(201).json({
      message: "Account verified & registered successfully!",
      user: createdUser
    });
  } catch (error) { next(error); }
});

// 3. Fallback direct register (Role is strictly locked to 'user')
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required." });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    const pool = await getPool();
    const existing = await pool.request()
      .input("username", sql.NVarChar(100), cleanUsername)
      .input("email", sql.NVarChar(150), cleanEmail)
      .query("SELECT user_id FROM dbo.Users WHERE username = @username OR email = @email");

    if (existing.recordset.length > 0) {
      return res.status(400).json({ message: "Username or Email already registered." });
    }

    // Role is STRICTLY locked to 'user'
    const userRole = "user";
    const hashed = hashPassword(password);

    const result = await pool.request()
      .input("username", sql.NVarChar(100), cleanUsername)
      .input("email", sql.NVarChar(150), cleanEmail)
      .input("password", sql.NVarChar(255), hashed)
      .input("role", sql.NVarChar(50), userRole)
      .query(`
        INSERT INTO dbo.Users (username, email, password, role)
        OUTPUT INSERTED.user_id, INSERTED.username, INSERTED.email, INSERTED.role
        VALUES (@username, @email, @password, @role)
      `);

    const createdUser = result.recordset[0];
    res.status(201).json({
      message: "Registration successful!",
      user: createdUser
    });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Please provide username/email and password." });
    }

    const pool = await getPool();
    const cleanUser = String(username).trim();
    const hashed = hashPassword(password);

    // 1. Check if user exists by username or email
    const userCheck = await pool.request()
      .input("identifier", sql.NVarChar(150), cleanUser)
      .query(`
        SELECT user_id, username, email, password, role
        FROM dbo.Users
        WHERE username = @identifier OR email = @identifier
      `);

    if (userCheck.recordset.length === 0) {
      return res.status(401).json({
        message: "Account does not exist. Please check your username/email or click 'Create Account'."
      });
    }

    const user = userCheck.recordset[0];
    if (user.password !== hashed) {
      return res.status(401).json({
        message: "Incorrect password. Please verify your password and try again."
      });
    }

    res.json({
      message: "Login successful!",
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) { next(error); }
});

app.get("/api/users", async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT user_id, username, email, role, created_at
      FROM dbo.Users
      ORDER BY user_id DESC
    `);
    res.json(result.recordset);
  } catch (error) { next(error); }
});

// Admin Delete User Endpoint
app.delete("/api/users/:id", async (req, res, next) => {
  try {
    const userIdToDelete = parseInt(req.params.id, 10);
    if (isNaN(userIdToDelete)) {
      return res.status(400).json({ message: "Invalid user ID provided." });
    }

    const pool = await getPool();

    // Check if target user exists
    const checkRes = await pool.request()
      .input("userId", sql.Int, userIdToDelete)
      .query("SELECT user_id, username, email, role FROM dbo.Users WHERE user_id = @userId");

    if (checkRes.recordset.length === 0) {
      return res.status(404).json({ message: "User not found in database." });
    }

    const targetUser = checkRes.recordset[0];

    // Protect system admin account from deletion
    if (targetUser.role === "admin" || targetUser.username.toLowerCase() === "admin") {
      return res.status(403).json({ message: "Action Forbidden: System Admin accounts cannot be deleted!" });
    }

    // 1. Delete associated favorites
    await pool.request()
      .input("userId", sql.Int, userIdToDelete)
      .query("DELETE FROM dbo.Favorites WHERE user_id = @userId");

    // 2. Delete the user
    await pool.request()
      .input("userId", sql.Int, userIdToDelete)
      .query("DELETE FROM dbo.Users WHERE user_id = @userId");

    console.log(`[USER DELETED] Admin deleted user: ${targetUser.username} (ID: ${userIdToDelete}, Email: ${targetUser.email})`);

    res.json({
      message: `User '${targetUser.username}' (#${userIdToDelete}) has been permanently deleted from the database.`,
      deletedUserId: userIdToDelete
    });
  } catch (error) { next(error); }
});

// -------------------------------------------------------------
// SONGS CRUD & BROWSING
// -------------------------------------------------------------
app.get("/api/songs", async (req, res, next) => {
  try {
    const { category, media_type, search, user_id } = req.query;
    const pool = await getPool();
    const reqQuery = pool.request();

    let sqlQuery = `
      SELECT s.song_id, s.song_name, s.singer_name, s.movie_name, s.album_name,
             s.[language], s.category, s.year_of_Publishing, s.ratting, s.type_of_song,
             s.song_file, s.image_file, s.media_type, s.created_at,
             CASE WHEN f.favorite_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
      FROM dbo.Songs s
      LEFT JOIN dbo.Favorites f ON f.song_id = s.song_id
    `;

    if (user_id) {
      reqQuery.input("userId", sql.Int, Number(user_id));
      sqlQuery += ` AND f.user_id = @userId `;
    } else {
      sqlQuery += ` AND f.user_id = -1 `;
    }

    let whereClauses = [];
    if (category && category !== "All") {
      reqQuery.input("category", sql.NVarChar(100), category);
      whereClauses.push("s.category = @category");
    }
    if (media_type && media_type !== "all") {
      reqQuery.input("mediaType", sql.NVarChar(20), media_type);
      whereClauses.push("s.media_type = @mediaType");
    }
    if (search && String(search).trim()) {
      reqQuery.input("search", sql.NVarChar(200), `%${String(search).trim()}%`);
      whereClauses.push("(s.song_name LIKE @search OR s.singer_name LIKE @search OR s.album_name LIKE @search OR s.movie_name LIKE @search)");
    }

    if (whereClauses.length > 0) {
      sqlQuery += ` WHERE ` + whereClauses.join(" AND ");
    }

    sqlQuery += ` ORDER BY s.song_id DESC`;

    const result = await reqQuery.query(sqlQuery);
    res.json(result.recordset.map(publicSong));
  } catch (error) { next(error); }
});

app.get("/api/songs/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM dbo.Songs WHERE song_id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Song not found." });
    }
    res.json(publicSong(result.recordset[0]));
  } catch (error) { next(error); }
});

// Admin-only POST song
app.post("/api/songs", upload.fields([{ name: "songFile", maxCount: 1 }, { name: "imageFile", maxCount: 1 }]), async (req, res, next) => {
  const songFile = req.files?.songFile?.[0];
  const imageFile = req.files?.imageFile?.[0];
  try {
    if (!songFile) throw new Error("Please choose an audio or video file.");
    const fields = parseSongFields(req.body, songFile);
    const pool = await getPool();
    const result = await pool.request()
      .input("song_name", sql.NVarChar(200), fields.song_name)
      .input("singer_name", sql.NVarChar(200), fields.singer_name)
      .input("movie_name", sql.NVarChar(200), fields.movie_name)
      .input("album_name", sql.NVarChar(200), fields.album_name)
      .input("language", sql.NVarChar(50), fields.language)
      .input("category", sql.NVarChar(100), fields.category)
      .input("year", sql.Int, fields.year_of_Publishing)
      .input("ratting", sql.Decimal(3, 1), fields.ratting)
      .input("type_of_song", sql.NVarChar(100), fields.type_of_song)
      .input("media_type", sql.NVarChar(20), fields.media_type)
      .input("song_file", sql.NVarChar(255), songFile.filename)
      .input("image_file", sql.NVarChar(255), imageFile?.filename || req.body.image_url || req.body.image_file || null)
      .query(`
        INSERT INTO dbo.Songs
          (song_name, singer_name, movie_name, album_name, [language], category,
           year_of_Publishing, ratting, type_of_song, song_file, image_file, media_type)
        OUTPUT INSERTED.song_id
        VALUES (@song_name, @singer_name, @movie_name, @album_name, @language, @category,
                @year, @ratting, @type_of_song, @song_file, @image_file, @media_type)
      `);
    res.status(201).json({ message: "Song/Video uploaded successfully.", song_id: result.recordset[0].song_id });
  } catch (error) {
    if (songFile) deleteUploadedFile(songFile.filename);
    if (imageFile) deleteUploadedFile(imageFile.filename);
    next(error);
  }
});

// Admin-only PUT song
app.put("/api/songs/:id", upload.fields([{ name: "songFile", maxCount: 1 }, { name: "imageFile", maxCount: 1 }]), async (req, res, next) => {
  const songFile = req.files?.songFile?.[0];
  const imageFile = req.files?.imageFile?.[0];
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid song ID.");
    const fields = parseSongFields(req.body, songFile);
    const pool = await getPool();
    const oldResult = await pool.request().input("id", sql.Int, id).query(
      "SELECT song_file, image_file FROM dbo.Songs WHERE song_id = @id"
    );
    if (!oldResult.recordset.length) throw new Error("Song not found.");
    const old = oldResult.recordset[0];
    const newSongFile = songFile?.filename || old.song_file;
    const newImageFile = imageFile?.filename || req.body.image_url || req.body.image_file || old.image_file;

    const updated = await pool.request()
      .input("id", sql.Int, id)
      .input("song_name", sql.NVarChar(200), fields.song_name)
      .input("singer_name", sql.NVarChar(200), fields.singer_name)
      .input("movie_name", sql.NVarChar(200), fields.movie_name)
      .input("album_name", sql.NVarChar(200), fields.album_name)
      .input("language", sql.NVarChar(50), fields.language)
      .input("category", sql.NVarChar(100), fields.category)
      .input("year", sql.Int, fields.year_of_Publishing)
      .input("ratting", sql.Decimal(3, 1), fields.ratting)
      .input("type_of_song", sql.NVarChar(100), fields.type_of_song)
      .input("media_type", sql.NVarChar(20), fields.media_type)
      .input("song_file", sql.NVarChar(255), newSongFile)
      .input("image_file", sql.NVarChar(255), newImageFile)
      .query(`
        UPDATE dbo.Songs SET song_name=@song_name, singer_name=@singer_name,
          movie_name=@movie_name, album_name=@album_name, [language]=@language,
          category=@category, year_of_Publishing=@year, ratting=@ratting,
          type_of_song=@type_of_song, song_file=@song_file, image_file=@image_file,
          media_type=@media_type
        OUTPUT INSERTED.*
        WHERE song_id=@id
      `);

    if (songFile && old.song_file !== newSongFile) deleteUploadedFile(old.song_file);
    if (imageFile && old.image_file && old.image_file !== newImageFile) deleteUploadedFile(old.image_file);

    console.log(`[SONG UPDATED] Track #${id} updated: "${fields.song_name}" by "${fields.singer_name}" [${fields.category}]`);

    res.json({
      message: `Track '${fields.song_name}' updated successfully in the database.`,
      song: publicSong(updated.recordset[0])
    });
  } catch (error) {
    if (songFile) deleteUploadedFile(songFile.filename);
    if (imageFile) deleteUploadedFile(imageFile.filename);
    next(error);
  }
});

// Admin-only DELETE song
app.delete("/api/songs/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid song ID.");
    const pool = await getPool();
    const found = await pool.request().input("id", sql.Int, id).query(
      "SELECT song_file, image_file FROM dbo.Songs WHERE song_id=@id"
    );
    if (!found.recordset.length) return res.status(404).json({ message: "Song not found." });
    await pool.request().input("id", sql.Int, id).query("DELETE FROM dbo.Songs WHERE song_id=@id");
    deleteUploadedFile(found.recordset[0].song_file);
    deleteUploadedFile(found.recordset[0].image_file);
    res.json({ message: "Song deleted successfully." });
  } catch (error) { next(error); }
});

// -------------------------------------------------------------
// FAVORITES / LIKES API
// -------------------------------------------------------------
app.get("/api/favorites", async (req, res, next) => {
  try {
    const userId = Number(req.query.user_id);
    if (!userId) return res.status(400).json({ message: "user_id is required." });

    const pool = await getPool();
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT s.song_id, s.song_name, s.singer_name, s.movie_name, s.album_name,
               s.[language], s.category, s.year_of_Publishing, s.ratting, s.type_of_song,
               s.song_file, s.image_file, s.media_type, s.created_at,
               1 AS is_favorite
        FROM dbo.Favorites f
        JOIN dbo.Songs s ON s.song_id = f.song_id
        WHERE f.user_id = @userId
        ORDER BY f.created_at DESC
      `);

    res.json(result.recordset.map(publicSong));
  } catch (error) { next(error); }
});

app.post("/api/favorites/toggle", async (req, res, next) => {
  try {
    const { user_id, song_id } = req.body;
    if (!user_id || !song_id) {
      return res.status(400).json({ message: "user_id and song_id are required." });
    }

    const pool = await getPool();
    const check = await pool.request()
      .input("userId", sql.Int, Number(user_id))
      .input("songId", sql.Int, Number(song_id))
      .query("SELECT favorite_id FROM dbo.Favorites WHERE user_id = @userId AND song_id = @songId");

    let isFavorite = false;
    if (check.recordset.length > 0) {
      await pool.request()
        .input("userId", sql.Int, Number(user_id))
        .input("songId", sql.Int, Number(song_id))
        .query("DELETE FROM dbo.Favorites WHERE user_id = @userId AND song_id = @songId");
      isFavorite = false;
    } else {
      await pool.request()
        .input("userId", sql.Int, Number(user_id))
        .input("songId", sql.Int, Number(song_id))
        .query("INSERT INTO dbo.Favorites (user_id, song_id) VALUES (@userId, @songId)");
      isFavorite = true;
    }

    res.json({ is_favorite: isFavorite, message: isFavorite ? "Added to favorites!" : "Removed from favorites." });
  } catch (error) { next(error); }
});

// -------------------------------------------------------------
// STREAMING & DOWNLOAD
// -------------------------------------------------------------
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    case ".m4a": return "audio/mp4";
    case ".aac": return "audio/aac";
    case ".flac": return "audio/flac";
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".mkv": return "video/x-matroska";
    default: return "application/octet-stream";
  }
}

app.get("/api/songs/:id/stream", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).query(
      "SELECT song_name, song_file, media_type FROM dbo.Songs WHERE song_id=@id"
    );
    if (!result.recordset.length) return res.status(404).json({ message: "Song not found." });

    const row = result.recordset[0];
    const fullPath = path.join(uploadDir, path.basename(row.song_file));
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "Media file is missing from server storage." });
    }

    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const contentType = getMimeType(fullPath);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(fullPath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Accept-Ranges": "bytes",
        "Content-Type": contentType
      });
      fs.createReadStream(fullPath).pipe(res);
    }
  } catch (error) { next(error); }
});

app.get("/api/songs/:id/audio", (req, res, next) => {
  // Alias to /stream
  req.url = `/api/songs/${req.params.id}/stream`;
  app.handle(req, res, next);
});

app.get("/api/songs/:id/download", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).query(
      "SELECT song_name, song_file FROM dbo.Songs WHERE song_id=@id"
    );
    if (!result.recordset.length) return res.status(404).json({ message: "Song not found." });

    const row = result.recordset[0];
    const fullPath = path.join(uploadDir, path.basename(row.song_file));
    if (!fs.existsSync(fullPath)) return res.status(404).json({ message: "File missing." });

    const ext = path.extname(fullPath) || ".mp3";
    const downloadName = `${row.song_name.replace(/[^\w\s-]/g, "").trim() || "media"}${ext}`;
    return res.download(fullPath, downloadName);
  } catch (error) { next(error); }
});

// -------------------------------------------------------------
// 1. FEEDBACK API ROUTES
// -------------------------------------------------------------
app.post("/api/feedback", async (req, res, next) => {
  try {
    const { user_id, username, rating, category, comment } = req.body;
    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ message: "Comments are required." });
    }

    const pool = await getPool();
    await pool.request()
      .input("userId", sql.Int, user_id ? Number(user_id) : null)
      .input("username", sql.NVarChar(100), username || "Anonymous Listener")
      .input("rating", sql.Int, Number(rating) || 5)
      .input("category", sql.NVarChar(100), category || "General Experience")
      .input("comment", sql.NVarChar(sql.MAX), String(comment).trim())
      .query(`
        INSERT INTO dbo.Feedback (user_id, username, rating, category, comment)
        VALUES (@userId, @username, @rating, @category, @comment)
      `);

    res.status(201).json({ message: "Thank you! Your feedback has been submitted successfully." });
  } catch (error) { next(error); }
});

app.get("/api/feedback", async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT feedback_id, user_id, username, rating, category, comment, created_at
      FROM dbo.Feedback
      ORDER BY feedback_id DESC
    `);
    res.json(result.recordset);
  } catch (error) { next(error); }
});

// -------------------------------------------------------------
// 2. PAYMENT / SUBSCRIPTION API ROUTES
// -------------------------------------------------------------
app.post("/api/payment/process", async (req, res, next) => {
  try {
    const { user_id, username, plan_id, plan_name, amount, currency, status } = req.body;
    if (!user_id || !amount || !plan_name) {
      return res.status(400).json({ message: "Missing payment details or user session." });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input("userId", sql.Int, Number(user_id))
      .input("username", sql.NVarChar(100), username || "User")
      .input("planId", sql.NVarChar(50), plan_id || "monthly")
      .input("planName", sql.NVarChar(100), plan_name)
      .input("amount", sql.Decimal(10, 2), Number(amount))
      .input("currency", sql.NVarChar(10), currency || "INR")
      .input("status", sql.NVarChar(50), status || "SUCCESS")
      .query(`
        INSERT INTO dbo.Payments (user_id, username, plan_id, plan_name, amount, currency, status)
        OUTPUT INSERTED.payment_id
        VALUES (@userId, @username, @planId, @planName, @amount, @currency, @status)
      `);

    const transactionId = result.recordset[0].payment_id;
    console.log(`[PAYMENT SUCCESS] User #${user_id} (${username}) purchased ${plan_name} for ₹${amount}`);

    res.status(201).json({
      message: "Payment processed and recorded successfully!",
      transaction_id: transactionId
    });
  } catch (error) { next(error); }
});

app.get("/api/payments", async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT payment_id, user_id, username, plan_id, plan_name, amount, currency, status, created_at
      FROM dbo.Payments
      ORDER BY payment_id DESC
    `);
    res.json(result.recordset);
  } catch (error) { next(error); }
});

// -------------------------------------------------------------
// ERROR HANDLER & START
// -------------------------------------------------------------
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error instanceof multer.MulterError ? 400 : 400;
  res.status(status).json({ message: error.message || "An unexpected server error occurred." });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Audio & Video Song Portal API running on http://localhost:${port}`));
