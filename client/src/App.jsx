import React, { useState, useEffect, useRef } from "react";
import "./styles.css";

const API_HOST = typeof window !== "undefined" ? window.location.hostname : "localhost";
const SERVER_URL = `http://${API_HOST}:5000`;
const API_BASE = `${SERVER_URL}/api`;

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${SERVER_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const CATEGORIES = ["All", "Bollywood", "Punjabi", "Bhakti", "English", "Album Songs"];

export default function App() {
  // Current user state (persisted)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("songportal_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'audio' | 'video' | 'favorites' | 'admin'
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'
  const [authError, setAuthError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Playback state
  const [activeAudioTrack, setActiveAudioTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  // Video modal state
  const [activeVideoTrack, setActiveVideoTrack] = useState(null);

  // Admin upload form
  const [adminForm, setAdminForm] = useState({
    song_name: "",
    singer_name: "",
    movie_name: "",
    album_name: "",
    language: "Hindi",
    category: "Bollywood",
    media_type: "audio",
    type_of_song: "Romantic Songs",
    year_of_Publishing: "2024",
    ratting: "4.8"
  });
  const [adminSongFile, setAdminSongFile] = useState(null);
  const [adminImageFile, setAdminImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [updatingSong, setUpdatingSong] = useState(false);
  const [editForm, setEditForm] = useState({
    song_name: "",
    singer_name: "",
    category: "Bollywood",
    media_type: "audio",
    movie_name: "",
    album_name: "",
    language: "Hindi",
    type_of_song: "Romantic Songs",
    year_of_Publishing: "2024",
    ratting: "4.8"
  });
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (e) {
      console.error("Failed to load users:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch songs
  const loadSongs = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const url = new URL(`${API_BASE}/songs`);
      if (user?.user_id) {
        url.searchParams.append("user_id", user.user_id);
      }
      if (activeTab === "audio") url.searchParams.append("media_type", "audio");
      if (activeTab === "video") url.searchParams.append("media_type", "video");
      if (selectedCategory !== "All") url.searchParams.append("category", selectedCategory);
      if (searchQuery.trim()) url.searchParams.append("search", searchQuery.trim());

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Could not load songs library.");
      let data = await res.json();

      // If on favorites tab, filter
      if (activeTab === "favorites") {
        data = data.filter((s) => s.is_favorite);
      }
      setSongs(data);
    } catch (err) {
      setErrorMessage(err.message || "Failed to load songs.");
    } finally {
      setLoading(false);
    }
  };

  // Synchronized helper to check if any song is marked as favorite
  const isSongFavorite = (songId, fallback = false) => {
    if (!songId) return false;
    const found = songs.find((s) => s.song_id === songId);
    if (found !== undefined) return Boolean(found.is_favorite);
    return Boolean(fallback);
  };

  useEffect(() => {
    loadSongs();
    if (activeTab === "admin" && user?.role === "admin") {
      loadUsers();
    }
  }, [user, activeTab, selectedCategory]);

  // Keep active audio and video tracks favorite state synchronized with songs
  useEffect(() => {
    if (activeAudioTrack) {
      const match = songs.find((s) => s.song_id === activeAudioTrack.song_id);
      if (match && Boolean(match.is_favorite) !== Boolean(activeAudioTrack.is_favorite)) {
        setActiveAudioTrack((prev) => (prev ? { ...prev, is_favorite: match.is_favorite } : prev));
      }
    }
    if (activeVideoTrack) {
      const match = songs.find((s) => s.song_id === activeVideoTrack.song_id);
      if (match && Boolean(match.is_favorite) !== Boolean(activeVideoTrack.is_favorite)) {
        setActiveVideoTrack((prev) => (prev ? { ...prev, is_favorite: match.is_favorite } : prev));
      }
    }
  }, [songs]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadSongs();
  };

  const openAuthModal = (mode = "login") => {
    setAuthMode(mode);
    setAuthError("");
    setOtpStep(false);
    setOtpCode("");
    setAuthModalOpen(true);
  };

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid username/email or password.");
      setUser(data.user);
      localStorage.setItem("songportal_user", JSON.stringify(data.user));
      setAuthModalOpen(false);
      setLoginForm({ username: "", password: "" });
      setAuthError("");
      setSuccessMessage(`Welcome back, ${data.user.username}!`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError("Passwords do not match!");
      return;
    }
    setSendingOtp(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerForm.username,
          email: registerForm.email,
          password: registerForm.password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP.");
      setOtpStep(true);
      setSuccessMessage(data.message || `Verification OTP sent to ${registerForm.email}`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setAuthError("Please enter the 6-digit verification code.");
      return;
    }
    setVerifyingOtp(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerForm.email,
          otp: otpCode.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "OTP verification failed.");
      setUser(data.user);
      localStorage.setItem("songportal_user", JSON.stringify(data.user));
      setAuthModalOpen(false);
      setOtpStep(false);
      setOtpCode("");
      setRegisterForm({ username: "", email: "", password: "", confirmPassword: "" });
      setSuccessMessage(`Account verified! Welcome, ${data.user.username}`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("songportal_user");
    if (activeTab === "admin" || activeTab === "favorites") {
      setActiveTab("all");
    }
    setSuccessMessage("Logged out successfully.");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  // Play audio or video
  const playMedia = (item) => {
    const isFav = isSongFavorite(item.song_id, item.is_favorite);
    const resolvedItem = { ...item, is_favorite: isFav };

    if (item.media_type === "video") {
      // Pause audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      setActiveVideoTrack(resolvedItem);
    } else {
      if (activeAudioTrack?.song_id === item.song_id) {
        toggleAudioPlay();
        return;
      }
      setActiveAudioTrack(resolvedItem);
      setIsPlaying(true);
      setCurrentTime(0);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      }, 50);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (songId) => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id, song_id: songId })
      });
      const data = await res.json();
      if (res.ok) {
        const isFav = Boolean(data.is_favorite);

        // 1. Update songs list
        setSongs((prev) =>
          prev.map((s) => (s.song_id === songId ? { ...s, is_favorite: isFav } : s))
        );

        // 2. Update active audio track state
        setActiveAudioTrack((prev) =>
          prev && prev.song_id === songId ? { ...prev, is_favorite: isFav } : prev
        );

        // 3. Update active video track state
        setActiveVideoTrack((prev) =>
          prev && prev.song_id === songId ? { ...prev, is_favorite: isFav } : prev
        );

        // 4. If on favorites tab and un-favorited, filter out
        if (activeTab === "favorites" && !isFav) {
          setSongs((prev) => prev.filter((s) => s.song_id !== songId));
        }
      }
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  };

  // Audio player controls
  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const playNext = () => {
    const audioSongs = songs.filter((s) => s.media_type !== "video");
    if (!audioSongs.length) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * audioSongs.length);
      playMedia(audioSongs[randomIndex]);
      return;
    }
    const currentIndex = audioSongs.findIndex((s) => s.song_id === activeAudioTrack?.song_id);
    const nextIndex = (currentIndex + 1) % audioSongs.length;
    playMedia(audioSongs[nextIndex]);
  };

  const playPrevious = () => {
    const audioSongs = songs.filter((s) => s.media_type !== "video");
    if (!audioSongs.length) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = audioSongs.findIndex((s) => s.song_id === activeAudioTrack?.song_id);
    const prevIndex = (currentIndex - 1 + audioSongs.length) % audioSongs.length;
    playMedia(audioSongs[prevIndex]);
  };

  const handleAudioEnded = () => {
    if (isRepeat) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      playNext();
    }
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.volume = volume || 0.5;
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const onSeek = (e) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Admin Upload handler
  const handleAdminUpload = async (e) => {
    e.preventDefault();
    if (!adminSongFile) {
      alert("Please select an audio or video file to upload!");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      Object.entries(adminForm).forEach(([key, val]) => {
        formData.append(key, val);
      });
      formData.append("songFile", adminSongFile);
      if (adminImageFile) formData.append("imageFile", adminImageFile);

      const res = await fetch(`${API_BASE}/songs`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed.");

      setSuccessMessage("Song/Video uploaded successfully!");
      setAdminSongFile(null);
      setAdminImageFile(null);
      // Reset file input elements
      const songInput = document.getElementById("admin-song-file");
      if (songInput) songInput.value = "";
      const imgInput = document.getElementById("admin-image-file");
      if (imgInput) imgInput.value = "";

      loadSongs();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      alert(err.message || "Failed to upload.");
    } finally {
      setUploading(false);
    }
  };

  // Admin Delete handler
  const handleDeleteSong = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/songs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete item.");
      setSongs((prev) => prev.filter((s) => s.song_id !== id));
      if (activeAudioTrack?.song_id === id) {
        setActiveAudioTrack(null);
        setIsPlaying(false);
      }
      setSuccessMessage("Song deleted.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  // Admin Edit Song handlers
  const handleStartEdit = (song) => {
    setEditingSong(song);
    setEditImageFile(null);
    setEditForm({
      song_name: song.song_name || "",
      singer_name: song.singer_name || "",
      category: song.category || "Bollywood",
      media_type: song.media_type || "audio",
      movie_name: song.movie_name || "",
      album_name: song.album_name || "",
      language: song.language || "Hindi",
      type_of_song: song.type_of_song || "General",
      year_of_Publishing: song.year_of_Publishing || new Date().getFullYear(),
      ratting: song.ratting || "4.8"
    });
  };

  const handleUpdateSong = async (e) => {
    e.preventDefault();
    if (!editingSong) return;
    setUpdatingSong(true);
    try {
      let res;
      if (editImageFile) {
        const formData = new FormData();
        Object.entries(editForm).forEach(([k, v]) => {
          if (v !== undefined && v !== null) formData.append(k, v);
        });
        formData.append("imageFile", editImageFile);
        res = await fetch(`${API_BASE}/songs/${editingSong.song_id}`, {
          method: "PUT",
          body: formData
        });
      } else {
        res = await fetch(`${API_BASE}/songs/${editingSong.song_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm)
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update track details.");

      loadSongs();
      setSuccessMessage(data.message || `Track "${editForm.song_name}" updated in database!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      setEditingSong(null);
      setEditImageFile(null);
    } catch (err) {
      alert(err.message || "Failed to update track.");
    } finally {
      setUpdatingSong(false);
    }
  };

  // Admin Delete User handler
  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${username}" (ID: #${userId})?\n\nThis will remove their account and favorites from the database.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete user.");
      setUsersList((prev) => prev.filter((u) => u.user_id !== userId));
      setSuccessMessage(data.message || `User '${username}' has been deleted.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="app-root">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-brand" onClick={() => setActiveTab("all")}>
          🎵 <span>Songs Portal System</span>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            🔥 All Hits
          </button>
          <button
            className={`nav-btn ${activeTab === "audio" ? "active" : ""}`}
            onClick={() => setActiveTab("audio")}
          >
            🎧 Audio Songs
          </button>
          <button
            className={`nav-btn ${activeTab === "video" ? "active" : ""}`}
            onClick={() => setActiveTab("video")}
          >
            🎬 Video Songs
          </button>
          {user && (
            <button
              className={`nav-btn ${activeTab === "favorites" ? "active" : ""}`}
              onClick={() => setActiveTab("favorites")}
            >
              ❤️ Favorites
            </button>
          )}
          {user?.role === "admin" && (
            <button
              className={`nav-btn admin-badge-nav ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              ⚙️ Admin Portal
            </button>
          )}
        </nav>

        <div className="nav-auth">
          {user ? (
            <div className="user-tag">
              <span>👤 {user.username}</span>
              <span className={`role-pill ${user.role}`}>{user.role}</span>
              <button className="btn-secondary" style={{ padding: "4px 10px", fontSize: "12px" }} onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn-secondary"
                onClick={() => openAuthModal("login")}
              >
                Login
              </button>
              <button
                className="btn-primary"
                onClick={() => openAuthModal("register")}
              >
                Register
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ALERTS */}
      {successMessage && (
        <div style={{ background: "#065f46", color: "#a7f3d0", padding: "12px 36px", fontSize: "14px", fontWeight: "600" }}>
          ✓ {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ background: "#991b1b", color: "#fecaca", padding: "12px 36px", fontSize: "14px", fontWeight: "600" }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* ADMIN PANEL VIEW */}
      {activeTab === "admin" && user?.role === "admin" ? (
        <div className="admin-view">
          <div className="hero" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <h1>Admin Control Panel</h1>
            <p>Upload new Audio & Video tracks, manage database entries and catalog permissions.</p>
          </div>

          <div className="admin-card">
            <h2>➕ Upload New Audio / Video</h2>
            <form onSubmit={handleAdminUpload}>
              <div className="admin-form-grid">
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    required
                    value={adminForm.song_name}
                    onChange={(e) => setAdminForm({ ...adminForm, song_name: e.target.value })}
                    placeholder="e.g. Kesariya"
                  />
                </div>
                <div className="form-group">
                  <label>Singer / Artist *</label>
                  <input
                    type="text"
                    required
                    value={adminForm.singer_name}
                    onChange={(e) => setAdminForm({ ...adminForm, singer_name: e.target.value })}
                    placeholder="e.g. Arijit Singh"
                  />
                </div>
                <div className="form-group">
                  <label>Movie / Film</label>
                  <input
                    type="text"
                    value={adminForm.movie_name}
                    onChange={(e) => setAdminForm({ ...adminForm, movie_name: e.target.value })}
                    placeholder="e.g. Brahmastra"
                  />
                </div>
                <div className="form-group">
                  <label>Album Name</label>
                  <input
                    type="text"
                    value={adminForm.album_name}
                    onChange={(e) => setAdminForm({ ...adminForm, album_name: e.target.value })}
                    placeholder="e.g. Soulful Hits"
                  />
                </div>
                <div className="form-group">
                  <label>Media Format *</label>
                  <select
                    value={adminForm.media_type}
                    onChange={(e) => setAdminForm({ ...adminForm, media_type: e.target.value })}
                  >
                    <option value="audio">Audio (MP3 / WAV / OGG)</option>
                    <option value="video">Video (MP4 / WebM)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={adminForm.category}
                    onChange={(e) => setAdminForm({ ...adminForm, category: e.target.value })}
                  >
                    <option value="Bollywood">Bollywood</option>
                    <option value="Punjabi">Punjabi</option>
                    <option value="Bhakti">Bhakti</option>
                    <option value="English">English</option>
                    <option value="Album Songs">Album Songs</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Language *</label>
                  <input
                    type="text"
                    value={adminForm.language}
                    onChange={(e) => setAdminForm({ ...adminForm, language: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Mood / Song Type</label>
                  <input
                    type="text"
                    value={adminForm.type_of_song}
                    onChange={(e) => setAdminForm({ ...adminForm, type_of_song: e.target.value })}
                    placeholder="Romantic / Party / Sad / Devotional"
                  />
                </div>
                <div className="form-group">
                  <label>Publishing Year</label>
                  <input
                    type="number"
                    value={adminForm.year_of_Publishing}
                    onChange={(e) => setAdminForm({ ...adminForm, year_of_Publishing: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Media File (MP3 / MP4) *</label>
                  <input
                    id="admin-song-file"
                    type="file"
                    required
                    accept="audio/*,video/*"
                    onChange={(e) => setAdminSongFile(e.target.files[0])}
                  />
                </div>
                <div className="form-group">
                  <label>Cover Artwork (Optional)</label>
                  <input
                    id="admin-image-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAdminImageFile(e.target.files[0])}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={uploading}>
                {uploading ? "Uploading to Server..." : "🚀 Upload to Library"}
              </button>
            </form>
          </div>

          <div className="admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ margin: 0 }}>📑 Edit & Update Catalog Records ({songs.length})</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "4px 0 0" }}>
                  Directly edit titles, artists, categories, albums, and details in the database.
                </p>
              </div>
              <button className="btn-secondary" onClick={loadSongs} disabled={loading} style={{ fontSize: "12px", padding: "6px 12px" }}>
                {loading ? "Refreshing..." : "🔄 Refresh List"}
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cover</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th>Category</th>
                    <th>Movie / Album</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {songs.map((song) => (
                    <tr key={song.song_id}>
                      <td>#{song.song_id}</td>
                      <td>
                        {song.cover_image_url ? (
                          <img
                            src={getImageUrl(song.cover_image_url)}
                            alt={song.song_name}
                            style={{ width: "44px", height: "44px", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--border)", display: "block" }}
                          />
                        ) : (
                          <div style={{ width: "44px", height: "44px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                            {song.media_type === "video" ? "🎬" : "🎵"}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`media-type-badge ${song.media_type}`} style={{ position: "static" }}>
                          {song.media_type}
                        </span>
                      </td>
                      <td><strong>{song.song_name}</strong></td>
                      <td>{song.singer_name}</td>
                      <td>
                        <span className="small-tag" style={{ fontSize: "11px" }}>{song.category}</span>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        {song.movie_name || song.album_name || "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            className="btn-secondary"
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              ...(activeAudioTrack?.song_id === song.song_id && isPlaying
                                ? { background: "#10b981", color: "#fff", borderColor: "#10b981" }
                                : {})
                            }}
                            onClick={() => playMedia(song)}
                            title={activeAudioTrack?.song_id === song.song_id && isPlaying ? "Pause Track" : "Play Track"}
                          >
                            {activeAudioTrack?.song_id === song.song_id && isPlaying ? "⏸ Pause" : "▶ Play"}
                          </button>
                          <button
                            className="btn-secondary"
                            style={{
                              padding: "4px 10px",
                              fontSize: "12px",
                              borderColor: "#6366f1",
                              color: "#818cf8",
                              fontWeight: "600"
                            }}
                            onClick={() => handleStartEdit(song)}
                            title="Edit details (Title, Artist, Category, etc.)"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                            onClick={() => handleDeleteSong(song.song_id, song.song_name)}
                            title="Delete song from database"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0 }}>👥 Registered Users in Database ({usersList.length})</h2>
              <button className="btn-secondary" onClick={loadUsers} disabled={loadingUsers} style={{ fontSize: "12px", padding: "6px 12px" }}>
                {loadingUsers ? "Refreshing..." : "🔄 Refresh Users"}
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Registered At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u.user_id}>
                      <td>#{u.user_id}</td>
                      <td><strong>{u.username}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-pill ${u.role}`}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        {u.created_at ? new Date(u.created_at).toLocaleString() : "N/A"}
                      </td>
                      <td>
                        {u.role === "admin" || u.username.toLowerCase() === "admin" ? (
                          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>
                            🛡️ System Admin
                          </span>
                        ) : (
                          <button
                            className="btn-danger"
                            style={{ padding: "4px 10px", fontSize: "12px" }}
                            onClick={() => handleDeleteUser(u.user_id, u.username)}
                            title={`Delete user ${u.username}`}
                          >
                            🗑️ Delete User
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* MAIN LISTENER PORTAL VIEW */
        <main>
          {/* HERO */}
          <section className="hero">
            <h1>
              {activeTab === "audio"
                ? "Audio Music Library 🎧"
                : activeTab === "video"
                ? "Video Music Collection 🎬"
                : activeTab === "favorites"
                ? "Your Favorite Tracks ❤️"
                : "Welcome to the Songs Portal System"}
            </h1>
            <p>
              Listen to high fidelity audio songs, stream video songs, save your favorites, and download tracks offline.
            </p>
          </section>

          {/* CONTROLS */}
          <section className="controls-container">
            <form onSubmit={handleSearchSubmit} className="search-bar">
              <input
                type="text"
                className="search-input"
                placeholder="Search by song name, singer, or album..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                Search
              </button>
            </form>

            <div className="filter-row">
              <span className="filter-label">Genre:</span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`chip ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* MEDIA GRID */}
          {loading ? (
            <div className="empty-state">
              <h3>Loading songs library...</h3>
            </div>
          ) : songs.length === 0 ? (
            <div className="empty-state">
              <h3>No songs or videos found</h3>
              <p>Try switching category filter or clearing search terms.</p>
            </div>
          ) : (
            <div className="media-grid">
              {songs.map((song) => {
                const isThisTrack = activeAudioTrack?.song_id === song.song_id;
                const isThisPlaying = isThisTrack && isPlaying;

                return (
                  <div key={song.song_id} className={`media-card ${isThisTrack ? "is-active" : ""}`}>
                    <div className="thumbnail-box">
                      {song.cover_image_url ? (
                        <img src={getImageUrl(song.cover_image_url)} alt={song.song_name} className="thumbnail-img" />
                      ) : (
                        <div className={`thumbnail-placeholder ${song.media_type === "video" ? "video-thumb" : ""}`}>
                          {song.media_type === "video" ? "🎬" : "🎵"}
                        </div>
                      )}
                      <span className={`media-type-badge ${song.media_type}`}>
                        {song.media_type === "video" ? "Video" : "Audio"}
                      </span>
                      {isThisTrack && (
                        <div className="now-playing-badge">
                          {isThisPlaying ? (
                            <>
                              <span className="eq-bar-wrap">
                                <span className="eq-bar"></span>
                                <span className="eq-bar"></span>
                                <span className="eq-bar"></span>
                              </span>
                              Playing
                            </>
                          ) : (
                            "Paused"
                          )}
                        </div>
                      )}
                      <button
                        className={`play-overlay-btn ${isThisPlaying ? "playing" : ""}`}
                        onClick={() => playMedia(song)}
                        title={isThisPlaying ? `Pause ${song.song_name}` : `Play ${song.song_name}`}
                      >
                        {isThisPlaying ? "⏸" : "▶"}
                      </button>
                    </div>

                  <div className="card-body">
                    <h3 className="song-title" title={song.song_name}>
                      {song.song_name}
                    </h3>
                    <p className="song-artist" title={song.singer_name}>
                      {song.singer_name} {song.movie_name ? `• ${song.movie_name}` : ""}
                    </p>

                    <div className="tag-row">
                      <span className="small-tag">{song.category}</span>
                      <span className="small-tag">{song.language}</span>
                      {song.ratting && <span className="small-tag">⭐ {song.ratting}</span>}
                    </div>

                    <div className="card-actions">
                      <button
                        className={`fav-btn ${isSongFavorite(song.song_id, song.is_favorite) ? "active" : ""}`}
                        onClick={() => toggleFavorite(song.song_id)}
                        title={isSongFavorite(song.song_id, song.is_favorite) ? "Remove Favorite" : "Add to Favorites"}
                      >
                        {isSongFavorite(song.song_id, song.is_favorite) ? "❤️" : "🤍"}
                      </button>

                      <a
                        href={`${API_BASE}/songs/${song.song_id}/download`}
                        className="download-link"
                        download
                        title="Download track"
                      >
                        ⬇ Download
                      </a>

                      {user?.role === "admin" && (
                        <>
                          <button
                            className="btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px", borderColor: "#6366f1", color: "#818cf8" }}
                            onClick={() => handleStartEdit(song)}
                            title="Edit Track"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleDeleteSong(song.song_id, song.song_name)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </main>
      )}

      {/* FLOATING AUDIO PLAYER */}
      {activeAudioTrack && (
        <aside className="audio-player-bar">
          <audio
            ref={audioRef}
            src={`${API_BASE}/songs/${activeAudioTrack.song_id}/stream`}
            onTimeUpdate={onTimeUpdate}
            onEnded={handleAudioEnded}
            autoPlay
          />
          <div
            className="now-playing-info clickable"
            onClick={() => setIsPlayerExpanded(true)}
            title="Click to expand full player"
          >
            <div className="now-playing-thumb">
              {activeAudioTrack.cover_image_url ? (
                <img
                  src={getImageUrl(activeAudioTrack.cover_image_url)}
                  alt={activeAudioTrack.song_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }}
                />
              ) : (
                "🎵"
              )}
            </div>
            <div className="now-playing-details">
              <h4>{activeAudioTrack.song_name}</h4>
              <p>{activeAudioTrack.singer_name}</p>
              <span className="now-playing-expand-hint">⤢ Full Player</span>
            </div>
          </div>

          <div className="player-controls">
            <div className="player-buttons">
              <button className="control-btn" onClick={playPrevious} title="Previous Track (⏮)">
                ⏮
              </button>
              <button className="control-btn" onClick={() => (audioRef.current.currentTime -= 10)} title="Rewind 10s">
                ⏪
              </button>
              <button className="play-toggle-btn" onClick={toggleAudioPlay} title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button className="control-btn" onClick={() => (audioRef.current.currentTime += 10)} title="Forward 10s">
                ⏩
              </button>
              <button className="control-btn" onClick={playNext} title="Next Track (⏭)">
                ⏭
              </button>
            </div>
            <div className="progress-row">
              <span className="progress-time">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="progress-bar"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={onSeek}
              />
              <span className="progress-time">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-extra">
            <button
              className="control-btn"
              onClick={() => setIsPlayerExpanded(true)}
              title="Expand Fullscreen Player"
              style={{ fontSize: "16px", marginRight: "4px" }}
            >
              ⤢
            </button>
            <button
              className={`fav-btn ${isSongFavorite(activeAudioTrack.song_id, activeAudioTrack.is_favorite) ? "active" : ""}`}
              onClick={() => toggleFavorite(activeAudioTrack.song_id)}
              title={isSongFavorite(activeAudioTrack.song_id, activeAudioTrack.is_favorite) ? "Remove from Favorites" : "Add to Favorites"}
            >
              {isSongFavorite(activeAudioTrack.song_id, activeAudioTrack.is_favorite) ? "❤️" : "🤍"}
            </button>
            <a
              href={`${API_BASE}/songs/${activeAudioTrack.song_id}/download`}
              className="download-link"
              download
            >
              ⬇
            </a>
            <button
              className="control-btn"
              style={{ fontSize: "16px", marginLeft: "8px" }}
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setActiveAudioTrack(null);
                setIsPlaying(false);
                setIsPlayerExpanded(false);
              }}
              title="Close Player"
            >
              ✕
            </button>
          </div>
        </aside>
      )}

      {/* EXPANDED FULL-SCREEN NOW-PLAYING MODAL */}
      {isPlayerExpanded && activeAudioTrack && (
        <div className="expanded-player-modal" onClick={() => setIsPlayerExpanded(false)}>
          <div className="expanded-player-card" onClick={(e) => e.stopPropagation()}>
            <div className="expanded-player-header">
              <div className="expanded-player-badge">
                <span className="eq-bar-wrap">
                  <span className="eq-bar" style={{ background: "#818cf8" }}></span>
                  <span className="eq-bar" style={{ background: "#818cf8" }}></span>
                  <span className="eq-bar" style={{ background: "#818cf8" }}></span>
                </span>
                {isPlaying ? "Now Playing" : "Paused"}
              </div>
              <div className="expanded-header-actions">
                <button
                  className="minimize-btn"
                  onClick={() => setIsPlayerExpanded(false)}
                  title="Minimize to bottom bar"
                >
                  ▼ Minimize
                </button>
                <button
                  className="close-btn"
                  onClick={() => setIsPlayerExpanded(false)}
                  title="Close modal"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="expanded-player-body">
              <div className="expanded-cover-container">
                {activeAudioTrack.cover_image_url ? (
                  <img
                    src={getImageUrl(activeAudioTrack.cover_image_url)}
                    alt={activeAudioTrack.song_name}
                    className="expanded-cover-img"
                  />
                ) : (
                  <div className="expanded-cover-fallback">
                    🎵
                  </div>
                )}
              </div>

              <div className="expanded-track-info">
                <h2 className="expanded-track-title">{activeAudioTrack.song_name}</h2>
                <p className="expanded-track-artist">
                  {activeAudioTrack.singer_name}
                  {activeAudioTrack.movie_name ? ` • ${activeAudioTrack.movie_name}` : ""}
                </p>

                <div className="expanded-chips-row">
                  <span className="expanded-chip">🏷️ {activeAudioTrack.category}</span>
                  <span className="expanded-chip">🌐 {activeAudioTrack.language}</span>
                  {activeAudioTrack.album_name && (
                    <span className="expanded-chip">💿 {activeAudioTrack.album_name}</span>
                  )}
                  {activeAudioTrack.year_of_Publishing && (
                    <span className="expanded-chip">📅 {activeAudioTrack.year_of_Publishing}</span>
                  )}
                  {activeAudioTrack.ratting && (
                    <span className="expanded-chip">⭐ {activeAudioTrack.ratting}</span>
                  )}
                </div>
              </div>

              <div className="expanded-progress-wrap">
                <input
                  type="range"
                  className="expanded-progress-bar"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={onSeek}
                />
                <div className="expanded-time-row">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="expanded-controls-row">
                <button
                  className={`expanded-ctrl-btn ${isShuffle ? "active-toggle" : ""}`}
                  onClick={() => setIsShuffle(!isShuffle)}
                  title={`Shuffle: ${isShuffle ? "ON" : "OFF"}`}
                >
                  🔀
                </button>
                <button className="expanded-ctrl-btn" onClick={playPrevious} title="Previous Song (⏮)">
                  ⏮
                </button>
                <button
                  className="expanded-ctrl-btn"
                  onClick={() => (audioRef.current.currentTime -= 10)}
                  title="Rewind 10s (⏪)"
                >
                  ⏪
                </button>
                <button
                  className="expanded-main-play-btn"
                  onClick={toggleAudioPlay}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <button
                  className="expanded-ctrl-btn"
                  onClick={() => (audioRef.current.currentTime += 10)}
                  title="Forward 10s (⏩)"
                >
                  ⏩
                </button>
                <button className="expanded-ctrl-btn" onClick={playNext} title="Next Song (⏭)">
                  ⏭
                </button>
                <button
                  className={`expanded-ctrl-btn ${isRepeat ? "active-toggle" : ""}`}
                  onClick={() => setIsRepeat(!isRepeat)}
                  title={`Repeat Track: ${isRepeat ? "ON" : "OFF"}`}
                >
                  🔁
                </button>
              </div>

              <div className="expanded-bottom-tools">
                <div className="volume-control-group">
                  <button
                    onClick={toggleMute}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "inherit" }}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="volume-slider"
                    title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  />
                </div>

                <div className="expanded-action-buttons">
                  <button
                    className={`fav-btn ${isSongFavorite(activeAudioTrack.song_id, activeAudioTrack.is_favorite) ? "active" : ""}`}
                    onClick={() => toggleFavorite(activeAudioTrack.song_id)}
                    style={{ fontSize: "15px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    title={isSongFavorite(activeAudioTrack.song_id, activeAudioTrack.is_favorite) ? "Remove from Favorites" : "Add to Favorites"}
                  >
                    {isSongFavorite(activeAudioTrack.song_id, activeAudioTrack.is_favorite) ? "❤️ Liked" : "🤍 Favorite"}
                  </button>
                  <a
                    href={`${API_BASE}/songs/${activeAudioTrack.song_id}/download`}
                    className="btn-secondary"
                    style={{ textDecoration: "none", fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    download
                  >
                    ⬇ Download MP3
                  </a>
                </div>
              </div>

              {/* Up Next Info */}
              {(() => {
                const audioSongs = songs.filter((s) => s.media_type !== "video");
                const currIdx = audioSongs.findIndex((s) => s.song_id === activeAudioTrack.song_id);
                const nextTrack = audioSongs[(currIdx + 1) % audioSongs.length];
                if (nextTrack && nextTrack.song_id !== activeAudioTrack.song_id) {
                  return (
                    <div
                      className="queue-preview-box"
                      onClick={() => playMedia(nextTrack)}
                      title="Click to play next track"
                    >
                      <span>⏭ <strong>Up Next:</strong> {nextTrack.song_name} — {nextTrack.singer_name}</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* VIDEO PLAYER MODAL */}
      {activeVideoTrack && (
        <div className="modal-overlay" onClick={() => setActiveVideoTrack(null)}>
          <div className="video-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎬 {activeVideoTrack.song_name} - {activeVideoTrack.singer_name}</h3>
              <button className="close-btn" onClick={() => setActiveVideoTrack(null)}>
                ✕
              </button>
            </div>
            <div className="video-wrapper">
              <video
                src={`${API_BASE}/songs/${activeVideoTrack.song_id}/stream`}
                controls
                autoPlay
              />
            </div>
            <div className="video-details" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
                  Category: <strong>{activeVideoTrack.category}</strong> | Language: <strong>{activeVideoTrack.language}</strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button
                  className={`fav-btn ${isSongFavorite(activeVideoTrack.song_id, activeVideoTrack.is_favorite) ? "active" : ""}`}
                  onClick={() => toggleFavorite(activeVideoTrack.song_id)}
                  title={isSongFavorite(activeVideoTrack.song_id, activeVideoTrack.is_favorite) ? "Remove from Favorites" : "Add to Favorites"}
                >
                  {isSongFavorite(activeVideoTrack.song_id, activeVideoTrack.is_favorite) ? "❤️ Liked" : "🤍 Like"}
                </button>
                <a
                  href={`${API_BASE}/songs/${activeVideoTrack.song_id}/download`}
                  className="btn-secondary"
                  style={{ textDecoration: "none", fontSize: "13px", padding: "8px 14px" }}
                  download
                >
                  ⬇ Download Video
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SONG MODAL */}
      {editingSong && (
        <div className="modal-overlay" onClick={() => setEditingSong(null)}>
          <div
            className="auth-card"
            style={{ maxWidth: "680px", width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>
                  ✏️ Edit Track Details (ID: #{editingSong.song_id})
                </h2>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  File: <code style={{ color: "#818cf8" }}>{editingSong.song_file}</code>
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "4px 10px", fontSize: "12px" }}
                onClick={() => setEditingSong(null)}
              >
                ✕ Cancel
              </button>
            </div>

            <form onSubmit={handleUpdateSong}>
              <div className="admin-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
                <div className="form-group">
                  <label>Title (Song Name) *</label>
                  <input
                    type="text"
                    required
                    value={editForm.song_name}
                    onChange={(e) => setEditForm({ ...editForm, song_name: e.target.value })}
                    placeholder="Song title"
                  />
                </div>

                <div className="form-group">
                  <label>Singer / Artist *</label>
                  <input
                    type="text"
                    required
                    value={editForm.singer_name}
                    onChange={(e) => setEditForm({ ...editForm, singer_name: e.target.value })}
                    placeholder="Artist name"
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    <option value="Bollywood">Bollywood</option>
                    <option value="Punjabi">Punjabi</option>
                    <option value="Bhakti">Bhakti</option>
                    <option value="English">English</option>
                    <option value="Classical">Classical</option>
                    <option value="Pop">Pop</option>
                    <option value="Romantic">Romantic</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Media Format *</label>
                  <select
                    value={editForm.media_type}
                    onChange={(e) => setEditForm({ ...editForm, media_type: e.target.value })}
                  >
                    <option value="audio">Audio (MP3 / WAV)</option>
                    <option value="video">Video (MP4 / WebM)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Movie / Film</label>
                  <input
                    type="text"
                    value={editForm.movie_name}
                    onChange={(e) => setEditForm({ ...editForm, movie_name: e.target.value })}
                    placeholder="Movie name"
                  />
                </div>

                <div className="form-group">
                  <label>Album Name</label>
                  <input
                    type="text"
                    value={editForm.album_name}
                    onChange={(e) => setEditForm({ ...editForm, album_name: e.target.value })}
                    placeholder="Album name"
                  />
                </div>

                <div className="form-group">
                  <label>Language</label>
                  <input
                    type="text"
                    value={editForm.language}
                    onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                    placeholder="e.g. Hindi, Punjabi, English"
                  />
                </div>

                <div className="form-group">
                  <label>Mood / Song Type</label>
                  <input
                    type="text"
                    value={editForm.type_of_song}
                    onChange={(e) => setEditForm({ ...editForm, type_of_song: e.target.value })}
                    placeholder="Romantic / Party / Devotional"
                  />
                </div>

                <div className="form-group">
                  <label>Publishing Year</label>
                  <input
                    type="number"
                    value={editForm.year_of_Publishing}
                    onChange={(e) => setEditForm({ ...editForm, year_of_Publishing: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Rating (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={editForm.ratting}
                    onChange={(e) => setEditForm({ ...editForm, ratting: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: "1 / -1", background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                  <label>Cover Artwork / Thumbnail Image (Optional)</label>
                  {editingSong.cover_image_url && (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                      <img
                        src={getImageUrl(editingSong.cover_image_url)}
                        alt="Current Cover"
                        style={{ width: "50px", height: "50px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border)" }}
                      />
                      <div>
                        <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "600" }}>Current Thumbnail</span>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Select a new file below to replace it.</div>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditImageFile(e.target.files[0])}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingSong(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updatingSong}
                >
                  {updatingSong ? "Saving to Database..." : "💾 Update Database Records"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {authModalOpen && (
        <div className="modal-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="auth-card" onClick={(e) => e.stopPropagation()}>
            <div className="auth-tabs">
              <button
                className={`auth-tab ${authMode === "login" ? "active" : ""}`}
                onClick={() => { setAuthMode("login"); setAuthError(""); }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${authMode === "register" ? "active" : ""}`}
                onClick={() => { setAuthMode("register"); setAuthError(""); }}
              >
                Create Account
              </button>
            </div>

            {authError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.16)",
                border: "1px solid #ef4444",
                borderRadius: "8px",
                padding: "12px 14px",
                marginBottom: "16px",
                color: "#fecaca",
                fontSize: "13px",
                lineHeight: "1.45",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px"
              }}>
                <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
                <span style={{ flex: 1, fontWeight: "500" }}>{authError}</span>
              </div>
            )}

            {authMode === "login" ? (
              <form onSubmit={handleLogin} className="auth-form">
                <div className="form-group">
                  <label>Username or Email</label>
                  <input
                    type="text"
                    required
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    placeholder="Enter username or email"
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: "10px" }} disabled={loggingIn}>
                  {loggingIn ? "Signing In..." : "Sign In to Songs Portal System"}
                </button>
              </form>
            ) : !otpStep ? (
              <form onSubmit={handleSendOtp} className="auth-form">
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    required
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    placeholder="Choose a username"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    placeholder="Create a password"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                  />
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0" }}>
                  🔒 We will send a 6-digit OTP code to your email to verify your identity.
                </p>
                <button type="submit" className="btn-primary" style={{ marginTop: "10px" }} disabled={sendingOtp}>
                  {sendingOtp ? "Sending Verification Code..." : "Send Verification Code ✉️"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="auth-form">
                <div style={{ textAlign: "center", marginBottom: "14px" }}>
                  <div style={{ fontSize: "36px", marginBottom: "6px" }}>📩</div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "17px" }}>Verify Your Email</h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                    Enter the 6-digit code sent to: <br />
                    <strong style={{ color: "#fff" }}>{registerForm.email}</strong>
                  </p>
                </div>

                <div className="form-group">
                  <label style={{ textAlign: "center" }}>Enter 6-Digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    style={{
                      fontSize: "24px",
                      letterSpacing: "8px",
                      textAlign: "center",
                      fontWeight: "700",
                      padding: "12px"
                    }}
                    autoFocus
                  />
                </div>

                <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "8px", padding: "10px", fontSize: "12px", color: "#cbd5e1", textAlign: "center" }}>
                  📧 Please enter the 6-digit verification code sent to your email (check inbox & spam).
                </div>

                <button type="submit" className="btn-primary" style={{ marginTop: "6px" }} disabled={verifyingOtp}>
                  {verifyingOtp ? "Verifying..." : "Verify & Complete Registration 🚀"}
                </button>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "12px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                    onClick={() => { setOtpStep(false); setOtpCode(""); }}
                  >
                    ← Edit Details
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                  >
                    Resend Code
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
