-- ==========================================================
-- SONGS PORTAL SYSTEM - DATABASE DEFINITION (MS SQL SERVER)
-- Database Name: SongsPortalSystem
-- ==========================================================

IF DB_ID(N'SongsPortalSystem') IS NULL
BEGIN
    CREATE DATABASE SongsPortalSystem;
END
GO

USE SongsPortalSystem;
GO

-- 1. USERS TABLE (Authentication & Role-Based Access Control)
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        user_id     INT IDENTITY(1,1) PRIMARY KEY,
        username    NVARCHAR(100) NOT NULL UNIQUE,
        email       NVARCHAR(150) NOT NULL UNIQUE,
        password    NVARCHAR(255) NOT NULL,
        role        NVARCHAR(50)  NOT NULL DEFAULT 'user', -- 'admin' or 'user'
        created_at  DATETIME2     DEFAULT GETDATE()
    );
END
GO

-- 2. SONGS & VIDEOS TABLE (Audio & Video Catalog)
IF OBJECT_ID(N'dbo.Songs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Songs (
        song_id            INT IDENTITY(1,1) PRIMARY KEY,
        song_name          NVARCHAR(200) NOT NULL,
        singer_name        NVARCHAR(200) NOT NULL,
        movie_name         NVARCHAR(200) NULL,
        album_name         NVARCHAR(200) NULL,
        language           NVARCHAR(50)  NOT NULL,
        category           NVARCHAR(100) NOT NULL,
        year_of_Publishing INT           NULL,
        ratting            DECIMAL(3,1)  NULL,
        type_of_song       NVARCHAR(100) NOT NULL,
        media_type         NVARCHAR(20)  NOT NULL DEFAULT 'audio', -- 'audio' or 'video'
        song_file          NVARCHAR(255) NOT NULL,
        image_file         NVARCHAR(255) NULL,
        created_at         DATETIME2     DEFAULT GETDATE()
    );
END
GO

-- 3. FAVORITES TABLE (User Favorite Songs)
IF OBJECT_ID(N'dbo.Favorites', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Favorites (
        favorite_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id     INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
        song_id     INT NOT NULL FOREIGN KEY REFERENCES dbo.Songs(song_id) ON DELETE CASCADE,
        created_at  DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_Favorites_User_Song UNIQUE (user_id, song_id)
    );
END
GO
