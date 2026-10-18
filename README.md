# 🎵 Songs Portal System (Full Stack)

A complete Audio & Video Portal built with **React (Vite)**, **Node.js (Express)**, and **Microsoft SQL Server**. By Abhay

---

## 📁 Clean Folder Structure

```text
Songs Portal System/
├── client/                  👉 Active Frontend (React + Vite, UI, Player, Admin View)
│   └── src/
│       ├── App.jsx          👉 Complete App Logic & Components
│       ├── styles.css       👉 Dark Theme Styling
│       └── main.jsx
├── server/                  👉 Active Backend API (Express.js)
│   ├── src/
│   │   ├── server.js        👉 Streaming & CRUD REST API
│   │   └── db.js            👉 MS SQL Server Connection
│   ├── uploads/             👉 Uploaded Audio (.mp3) & Video (.mp4) Files
│                  👉 Database Config (DB: SongsPortalSystem)
├── database.sql             👉 Complete SQL Server Schema
├── check_users.bat          👉 Double-click to see registered users in database
├── package.json             👉 Project scripts
└── _legacy_archive/         👉 Old prototype backups (Safe storage)
```

---

## 🚀 Commands to Run

Open terminal in VS Code (`Ctrl + ~`) in the project folder:

### 1. View Registered Users in Database:
```bash
npm run users
```

### 2. Start Full Project (Backend + Frontend):
```bash
npm run dev
```
* **Frontend:** http://localhost:5173
* **Backend API:** http://localhost:5000

---

## 🗄️ Database Info (MS SQL Server)
* **Database Name:** `SongsPortalSystem`
* **Tables:**
  - `dbo.Users` (admin, user credentials & roles)
  - `dbo.Songs` (audio & video metadata + file references)
  - `dbo.Favorites` (saved favorites per user)
