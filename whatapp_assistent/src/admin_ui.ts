import { Hono } from 'hono';
import { Env } from './types';

const adminUi = new Hono<{ Bindings: Env }>();

const loginHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Metoxi WeatherGPT - Admin Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --primary: #0066ff;
      --primary-hover: #0052cc;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --error: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .login-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 42px;
      height: 42px;
      background: rgba(0, 102, 255, 0.1);
      color: var(--primary);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-title { font-size: 22px; font-weight: 700; color: var(--text-main); }
    .brand-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-muted); }
    input {
      width: 100%;
      padding: 12px 16px;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text-main);
      font-size: 14px;
      outline: none;
      transition: all 0.2s;
    }
    input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.1); }
    button {
      width: 100%;
      padding: 12px;
      background: var(--primary);
      color: #ffffff;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s;
    }
    button:hover { background: var(--primary-hover); }
    .error-msg {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: var(--error);
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 20px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="brand">
      <div class="brand-icon">
        <i data-lucide="cloud-lightning" style="width:24px; height:24px;"></i>
      </div>
      <div>
        <div class="brand-title">Metoxi</div>
        <div class="brand-subtitle">WeatherGPT Executive Control Panel</div>
      </div>
    </div>
    <div id="error" class="error-msg"></div>
    <form id="loginForm">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" placeholder="Enter ADMIN_USERNAME" required autocomplete="username">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Enter ADMIN_PASSWORD" required autocomplete="current-password">
      </div>
      <button type="submit">
        <i data-lucide="log-in" style="width:18px; height:18px;"></i>
        <span>Log In to Control Panel</span>
      </button>
    </form>
  </div>
  <script>
    lucide.createIcons();
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('error');
      errorEl.style.display = 'none';
      const u = document.getElementById('username').value.trim();
      const p = document.getElementById('password').value.trim();
      
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        if (res.ok && (data.success || data.token)) {
          if (data.token) {
            localStorage.setItem('admin_token', data.token);
          }
          window.location.href = '/admin';
        } else {
          errorEl.textContent = data.error || 'Invalid credentials';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        errorEl.textContent = 'Connection error, please try again.';
        errorEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>
`;

const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Metoxi - WeatherGPT WhatsApp Executive Control Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --bg: #f8fafc;
      --sidebar-bg: #ffffff;
      --card-bg: #ffffff;
      --header-bg: #ffffff;
      --border: #e2e8f0;
      --primary: #0066ff;
      --primary-hover: #0052cc;
      --wa-green: #25d366;
      --wa-hover: #1eb956;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --text-light: #94a3b8;
      --green-badge: #dcfce7;
      --green-text: #15803d;
      --blue-badge: #e0f2fe;
      --blue-text: #0369a1;
      --amber-badge: #fef3c7;
      --amber-text: #b45309;
      --indigo-badge: #e0e7ff;
      --indigo-text: #4338ca;
      --bubble-user: #f1f5f9;
      --bubble-bot: #ecfdf5;
      --bubble-admin: #eff6ff;
    }
    .live-sync-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .live-dot-pulse {
      width: 7px;
      height: 7px;
      background-color: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
      animation: pulseDot 1.8s infinite;
    }
    @keyframes pulseDot {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    html, body {
      height: 100%;
      overflow: hidden;
      background-color: var(--bg);
      color: var(--text-main);
    }

    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    .app-container {
      display: flex;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: 240px;
      min-width: 240px;
      background-color: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .sidebar-header {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-bottom: 1px solid var(--border);
    }
    .brand-logo-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-logo {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
      letter-spacing: -0.02em;
    }
    .wa-badge-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(37, 211, 102, 0.1);
      color: #16a34a;
      border: 1px solid rgba(37, 211, 102, 0.3);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.2s;
    }
    .wa-badge-link:hover { background: rgba(37, 211, 102, 0.2); }
    .wa-dot {
      width: 6px;
      height: 6px;
      background: #25d366;
      border-radius: 50%;
      box-shadow: 0 0 6px #25d366;
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
    }
    .nav-section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-light);
      margin: 16px 10px 8px 10px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      margin-bottom: 2px;
    }
    .nav-item:hover, .nav-item.active {
      color: var(--primary);
      background-color: #f1f5f9;
      font-weight: 600;
    }
    .sidebar-footer {
      padding: 14px 18px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .btn-logout {
      display: flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      transition: color 0.2s;
    }
    .btn-logout:hover { color: #ef4444; }

    /* Main Content Area */
    .main-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* Fixed Top Header */
    .top-header {
      height: 56px;
      min-height: 56px;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .header-search {
      position: relative;
      width: 100%;
      max-width: 360px;
    }
    .header-search input {
      width: 100%;
      padding: 8px 14px 8px 36px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: #f8fafc;
      font-size: 13px;
      outline: none;
      transition: all 0.2s;
    }
    .header-search input:focus { border-color: var(--primary); background: #ffffff; }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-light);
      display: flex;
    }

    .header-actions-right { display: flex; align-items: center; gap: 12px; }

    .btn-whatsapp {
      background: var(--wa-green);
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      box-shadow: 0 2px 6px rgba(37, 211, 102, 0.3);
      transition: background 0.2s, transform 0.15s;
    }
    .btn-whatsapp:hover { background: var(--wa-hover); transform: translateY(-1px); }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: var(--primary-hover); }

    /* Dashboard Main Flex Body */
    .dashboard-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 18px 24px;
      gap: 16px;
      overflow: hidden;
      min-height: 0;
    }

    .breadcrumb-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .page-title { font-size: 17px; font-weight: 700; color: var(--text-main); }

    /* Evenly Distributed Metrics Cards */
    .metrics-grid-four {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      flex-shrink: 0;
    }

    .metric-card-clean {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .metric-info-left { display: flex; flex-direction: column; }
    .metric-val { font-size: 24px; font-weight: 700; color: var(--text-main); line-height: 1.2; }
    .metric-lbl { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
    .metric-icon-right {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* WhatsApp Workspace Grid */
    .whatsapp-panel-grid {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 280px 1fr;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
    }

    .wa-users-sidebar {
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      background: #f8fafc;
      height: 100%;
      overflow: hidden;
    }
    .wa-users-header {
      padding: 12px 16px;
      font-weight: 700;
      font-size: 13px;
      border-bottom: 1px solid var(--border);
      background: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .wa-user-item {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.15s;
    }
    .wa-user-item:hover, .wa-user-item.active { background: #e2e8f0; }
    .wa-user-phone { font-weight: 600; font-size: 13px; color: var(--text-main); }
    .wa-user-msg { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .wa-chat-main {
      display: flex;
      flex-direction: column;
      background: #f8fafc;
      height: 100%;
      overflow: hidden;
    }
    .wa-chat-header {
      padding: 10px 18px;
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      font-weight: 700;
      font-size: 13.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .wa-chat-messages {
      flex: 1;
      padding: 16px 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }

    /* Message Bubbles */
    .msg-bubble {
      max-width: 72%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.45;
      position: relative;
      word-wrap: break-word;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .msg-bubble.user {
      align-self: flex-start;
      background: var(--bubble-user);
      color: var(--text-main);
      border: 1px solid #e2e8f0;
      border-top-left-radius: 2px;
    }
    .msg-bubble.assistant {
      align-self: flex-end;
      background: var(--bubble-bot);
      color: #065f46;
      border: 1px solid #a7f3d0;
      border-top-right-radius: 2px;
    }
    .msg-bubble.admin {
      align-self: flex-end;
      background: var(--bubble-admin);
      color: #1e40af;
      border: 1px solid #bfdbfe;
      border-top-right-radius: 2px;
    }
    .msg-time {
      font-size: 10px;
      opacity: 0.65;
      text-align: right;
      margin-top: 4px;
    }

    .wa-chat-input-bar {
      padding: 12px 18px;
      background: #ffffff;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 10px;
      flex-shrink: 0;
    }
    .wa-input {
      flex: 1;
      padding: 9px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      outline: none;
      font-size: 13px;
    }

    /* Modal Overlay for Broadcasting */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 14px;
      width: 100%;
      max-width: 480px;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }
    .modal-title { font-size: 17px; font-weight: 700; margin-bottom: 6px; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
    .modal-sub { font-size: 12.5px; color: var(--text-muted); margin-bottom: 16px; }
    .modal-textarea {
      width: 100%;
      height: 110px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13.5px;
      outline: none;
      resize: vertical;
      margin-bottom: 16px;
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .btn-secondary {
      background: #f1f5f9;
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="app-container">
    <!-- Left Navigation Sidebar -->
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="brand-logo-row">
          <div style="color: var(--primary); display: flex;"><i data-lucide="cloud-lightning" style="width:22px; height:22px;"></i></div>
          <div class="brand-logo">Metoxi</div>
        </div>
        <a id="waDirectBadge" href="https://wa.me/1172736052599427?text=Hi%20WeatherGPT" target="_blank" class="wa-badge-link">
          <span class="wa-dot"></span> Test Bot on WhatsApp ↗
        </a>
      </div>
      <div class="sidebar-nav">
        <div class="nav-item active">
          <i data-lucide="layout-dashboard" style="width:16px; height:16px;"></i>
          <span>Dashboard</span>
        </div>
        <div class="nav-item">
          <i data-lucide="users" style="width:16px; height:16px;"></i>
          <span>WhatsApp Users</span>
        </div>

        <div class="nav-section-label">Management</div>
        <div class="nav-item" onclick="openBroadcastModal()">
          <i data-lucide="megaphone" style="width:16px; height:16px;"></i>
          <span>Mass Broadcast</span>
        </div>
        <div class="nav-item" onclick="openWhatsAppBotDirect()">
          <i data-lucide="phone-call" style="width:16px; height:16px;"></i>
          <span>Open WhatsApp Bot</span>
        </div>
        <div class="nav-item">
          <i data-lucide="bot" style="width:16px; height:16px;"></i>
          <span>Groq AI Status</span>
        </div>
      </div>
      <div class="sidebar-footer">
        <button class="btn-logout" onclick="logout()">
          <i data-lucide="log-out" style="width:16px; height:16px;"></i>
          <span>Logout</span>
        </button>
      </div>
    </div>

    <!-- Main Content Wrapper -->
    <div class="main-wrapper">
      <!-- Fixed Top Header -->
      <div class="top-header">
        <div class="header-search">
          <span class="search-icon"><i data-lucide="search" style="width:15px; height:15px;"></i></span>
          <input type="text" id="searchInput" placeholder="Search WhatsApp users or phone..." oninput="filterConversations()">
        </div>
        <div class="header-actions-right">
          <!-- PROMINENT DIRECT WHATSAPP BOT BUTTON -->
          <a id="btnWhatsAppDirect" href="https://wa.me/1172736052599427?text=Hi%20WeatherGPT" target="_blank" class="btn-whatsapp">
            <i data-lucide="message-square" style="width:16px; height:16px;"></i>
            <span>Chat on WhatsApp Bot 💬</span>
          </a>

          <button class="btn-primary" onclick="openBroadcastModal()">
            <i data-lucide="megaphone" style="width:16px; height:16px;"></i>
            <span>Send Mass Broadcast</span>
          </button>
        </div>
      </div>

      <!-- Dashboard Main Flex Body -->
      <div class="dashboard-body">
        <div class="breadcrumb-strip">
          <div class="page-title">WeatherGPT Executive Control Center</div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div id="liveSyncStatus" class="live-sync-pill">
              <span class="live-dot-pulse" id="syncDot"></span>
              <span id="syncText">Live Syncing (1.5s)</span>
            </div>
            <button id="toggleAutoSyncBtn" class="btn-secondary" style="padding: 5px 12px; font-size: 12px;" onclick="toggleAutoSync()">
              <i data-lucide="pause" style="width:13px; height:13px; display:inline; vertical-align:-1px;"></i>
              <span id="syncToggleLabel">Pause Auto-Sync</span>
            </button>
            <button class="btn-primary" style="padding: 5px 12px; font-size: 12px; background: #ffffff; color: var(--text-muted); border: 1px solid var(--border);" onclick="manualRefresh()">
              <i data-lucide="refresh-cw" id="refreshIcon" style="width:13px; height:13px;"></i>
              <span>Refresh Now</span>
            </button>
          </div>
        </div>

        <!-- 4 Balanced Metrics Cards -->
        <div class="metrics-grid-four">
          <div class="metric-card-clean">
            <div class="metric-info-left">
              <div class="metric-val" id="statUsersVal">0</div>
              <div class="metric-lbl">Active Audiences</div>
            </div>
            <div class="metric-icon-right" style="background: var(--blue-badge); color: var(--blue-text);">
              <i data-lucide="users" style="width:20px; height:20px;"></i>
            </div>
          </div>

          <div class="metric-card-clean">
            <div class="metric-info-left">
              <div class="metric-val" id="statUserMsgs">0</div>
              <div class="metric-lbl">User Queries</div>
            </div>
            <div class="metric-icon-right" style="background: var(--green-badge); color: var(--green-text);">
              <i data-lucide="message-square" style="width:20px; height:20px;"></i>
            </div>
          </div>

          <div class="metric-card-clean">
            <div class="metric-info-left">
              <div class="metric-val" id="statAiMsgs">0</div>
              <div class="metric-lbl">Groq AI Replies</div>
            </div>
            <div class="metric-icon-right" style="background: var(--amber-badge); color: var(--amber-text);">
              <i data-lucide="bot" style="width:20px; height:20px;"></i>
            </div>
          </div>

          <div class="metric-card-clean">
            <div class="metric-info-left">
              <div class="metric-val" id="statAdminMsgs">0</div>
              <div class="metric-lbl">Broadcasts Dispatched</div>
            </div>
            <div class="metric-icon-right" style="background: var(--indigo-badge); color: var(--indigo-text);">
              <i data-lucide="megaphone" style="width:20px; height:20px;"></i>
            </div>
          </div>
        </div>

        <!-- Integrated WhatsApp Live Panel -->
        <div class="whatsapp-panel-grid">
          <div class="wa-users-sidebar">
            <div class="wa-users-header">
              <i data-lucide="message-circle" style="width:16px; height:16px; color: var(--primary);"></i>
              <span>WhatsApp Audiences</span>
            </div>
            <div style="flex: 1; overflow-y: auto; min-height: 0;" id="conversationsList">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <div class="wa-chat-main">
            <div class="wa-chat-header">
              <span id="activePhoneDisplay">Select a conversation thread</span>
              <div style="display:flex; gap:8px;">
                <a id="activeChatWaLink" href="https://wa.me/1172736052599427?text=Hi%20WeatherGPT" target="_blank" class="btn-secondary" style="padding: 4px 10px; font-size: 11.5px; text-decoration:none; color:#16a34a; background:#dcfce7; border-color:#a7f3d0;">
                  <i data-lucide="phone-call" style="width:12px; height:12px; display:inline; vertical-align:-1px;"></i> Open in WhatsApp App
                </a>
                <button class="btn-secondary" style="padding: 4px 10px; font-size: 11.5px;" onclick="clearActiveHistory()">
                  <i data-lucide="trash-2" style="width:12px; height:12px; display:inline; vertical-align:-1px;"></i> Clear History
                </button>
              </div>
            </div>
            <div class="wa-chat-messages" id="messagesContainer">
              <div style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 50px;">
                <p style="margin-bottom:12px; font-weight:600;">Want to test WeatherGPT on your phone?</p>
                <a id="emptyStateWaLink" href="https://wa.me/1172736052599427?text=Hi%20WeatherGPT" target="_blank" class="btn-whatsapp" style="display:inline-flex;">
                  <i data-lucide="phone-call" style="width:16px; height:16px;"></i>
                  <span>Click to Start Chatting on WhatsApp App 📱</span>
                </a>
              </div>
            </div>
            <div class="wa-chat-input-bar">
              <input type="text" id="messageInput" class="wa-input" placeholder="Type direct WhatsApp message..." onkeypress="handleKeyPress(event)">
              <button class="btn-primary" onclick="sendMessage()">
                <i data-lucide="send" style="width:14px; height:14px;"></i>
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Broadcast Modal Window -->
  <div class="modal-overlay" id="broadcastModal">
    <div class="modal-card">
      <div class="modal-title">
        <i data-lucide="megaphone" style="color: var(--primary); width:20px; height:20px;"></i>
        <span>Send Mass WhatsApp Broadcast</span>
      </div>
      <div class="modal-sub">Send an instant notification to all registered WhatsApp user phone numbers.</div>
      <textarea id="broadcastInput" class="modal-textarea" placeholder="Type your announcement here... (e.g. ⛈️ Weather Alert: Heavy Rainfall warning issued!)"></textarea>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeBroadcastModal()">Cancel</button>
        <button class="btn-primary" onclick="submitBroadcast()">Send Broadcast</button>
      </div>
    </div>
  </div>

  <script>
    lucide.createIcons();
    let conversations = [];
    let activePhone = null;
    let botPhone = '1172736052599427';
    let autoSyncEnabled = true;
    let syncIntervalId = null;
    let lastMessageCount = 0;

    function getAuthHeaders() {
      const token = localStorage.getItem('admin_token') || '';
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      };
    }

    async function init() {
      await manualRefresh();
      startAutoSync();
    }

    function startAutoSync() {
      if (syncIntervalId) clearInterval(syncIntervalId);
      syncIntervalId = setInterval(async () => {
        if (!autoSyncEnabled) return;
        await syncData(false);
      }, 1500);
    }

    function toggleAutoSync() {
      autoSyncEnabled = !autoSyncEnabled;
      const statusPill = document.getElementById('liveSyncStatus');
      const syncText = document.getElementById('syncText');
      const syncDot = document.getElementById('syncDot');
      const toggleLabel = document.getElementById('syncToggleLabel');

      if (autoSyncEnabled) {
        if (statusPill) {
          statusPill.style.background = '#f0fdf4';
          statusPill.style.color = '#16a34a';
          statusPill.style.borderColor = '#bbf7d0';
        }
        if (syncDot) syncDot.style.display = 'inline-block';
        if (syncText) syncText.textContent = 'Live Syncing (1.5s)';
        if (toggleLabel) toggleLabel.textContent = 'Pause Auto-Sync';
        syncData(true);
      } else {
        if (statusPill) {
          statusPill.style.background = '#fef2f2';
          statusPill.style.color = '#dc2626';
          statusPill.style.borderColor = '#fecaca';
        }
        if (syncDot) syncDot.style.display = 'none';
        if (syncText) syncText.textContent = 'Auto-Sync Paused';
        if (toggleLabel) toggleLabel.textContent = 'Resume Auto-Sync';
      }
    }

    async function manualRefresh() {
      const icon = document.getElementById('refreshIcon');
      if (icon) icon.style.transform = 'rotate(360deg)';
      await syncData(true);
      setTimeout(() => { if (icon) icon.style.transform = 'none'; }, 400);
    }

    async function syncData(forceScroll = false) {
      await loadStats();
      await loadConversations();
      if (activePhone) {
        await loadMessages(activePhone, forceScroll);
      }
    }

    function updateWhatsAppBotLinks(phone) {
      if (!phone) return;
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (!cleanPhone) return;
      botPhone = cleanPhone;
      
      const linkUrl = 'https://wa.me/' + cleanPhone + '?text=Hi%20WeatherGPT';
      
      const btnHeader = document.getElementById('btnWhatsAppDirect');
      if (btnHeader) btnHeader.href = linkUrl;

      const badge = document.getElementById('waDirectBadge');
      if (badge) badge.href = linkUrl;

      const emptyLink = document.getElementById('emptyStateWaLink');
      if (emptyLink) emptyLink.href = linkUrl;
    }

    function openWhatsAppBotDirect() {
      const linkUrl = 'https://wa.me/' + botPhone + '?text=Hi%20WeatherGPT';
      window.open(linkUrl, '_blank');
    }

    async function logout() {
      localStorage.removeItem('admin_token');
      await fetch('/api/admin/logout', { method: 'POST', headers: getAuthHeaders() });
      window.location.href = '/admin/login';
    }

    async function loadStats() {
      try {
        const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
        if (res.status === 401) { window.location.href = '/admin/login'; return; }
        const data = await res.json();
        document.getElementById('statUsersVal').textContent = data.stats.totalConversations || 0;
        document.getElementById('statUserMsgs').textContent = data.stats.userMessagesCount || 0;
        document.getElementById('statAiMsgs').textContent = data.stats.aiMessagesCount || 0;
        document.getElementById('statAdminMsgs').textContent = data.stats.adminMessagesCount || 0;

        if (data.stats.whatsappBotPhone) {
          updateWhatsAppBotLinks(data.stats.whatsappBotPhone);
        }
      } catch (err) {}
    }

    async function loadConversations() {
      try {
        const res = await fetch('/api/admin/conversations', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          conversations = data.conversations || [];
          renderConversations();

          if (!activePhone && conversations.length > 0) {
            selectConversation(conversations[0].phone);
          }
        }
      } catch (err) {}
    }

    function renderConversations() {
      const listEl = document.getElementById('conversationsList');
      if (!listEl) return;
      const scrollPos = listEl.scrollTop;
      const query = (document.getElementById('searchInput').value || '').toLowerCase();
      
      const filtered = conversations.filter(c => 
        c.phone.toLowerCase().includes(query) || 
        (c.last_message && c.last_message.toLowerCase().includes(query)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(query))
      );

      if (filtered.length === 0) {
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12.5px;">No active conversations</div>';
        return;
      }

      listEl.innerHTML = filtered.map(c => {
        const isActive = c.phone === activePhone ? 'active' : '';
        const shortPhone = c.phone.replace(/^whatsapp:/, '');
        const lastText = c.last_message || c.lastMessage || 'No messages yet';
        return \`
          <div class="wa-user-item \${isActive}" onclick="selectConversation('\${c.phone}')">
            <div class="wa-user-phone">\${shortPhone}</div>
            <div class="wa-user-msg">\${escapeHtml(lastText)}</div>
          </div>
        \`;
      }).join('');

      listEl.scrollTop = scrollPos;
    }

    function filterConversations() {
      renderConversations();
    }

    async function selectConversation(phone) {
      activePhone = phone;
      lastMessageCount = 0;
      const displayPhone = phone.replace(/^whatsapp:/, '');
      document.getElementById('activePhoneDisplay').textContent = displayPhone;

      const activeLink = document.getElementById('activeChatWaLink');
      if (activeLink) {
        activeLink.href = 'https://wa.me/' + displayPhone.replace(/[^0-9]/g, '') + '?text=Hi';
      }

      renderConversations();
      await loadMessages(phone, true);
    }

    async function loadMessages(phone, forceScroll = false) {
      try {
        const res = await fetch(\`/api/admin/messages/\${encodeURIComponent(phone)}\`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const messages = data.messages || [];
          renderMessages(messages, forceScroll);
        }
      } catch (err) {}
    }

    function formatMessageText(text) {
      if (!text) return '';
      let formatted = escapeHtml(text);
      formatted = formatted.replace(/\\*(.*?)\\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
      formatted = formatted.replace(/\\n/g, '<br>');
      return formatted;
    }

    function renderMessages(messages, forceScroll = false) {
      const container = document.getElementById('messagesContainer');
      if (!container) return;

      const isNearBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 100;
      const hasNewMessages = messages.length > lastMessageCount;
      lastMessageCount = messages.length;

      container.innerHTML = messages.map(m => {
        const role = m.role || 'user';
        const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return \`
          <div class="msg-bubble \${role}">
            <div>\${formatMessageText(m.content)}</div>
            <div class="msg-time">\${timeStr}</div>
          </div>
        \`;
      }).join('');

      if (forceScroll || isNearBottom || hasNewMessages) {
        container.scrollTop = container.scrollHeight;
      }
    }

    async function sendMessage() {
      const input = document.getElementById('messageInput');
      const text = input.value.trim();
      if (!text || !activePhone) return;

      input.value = '';
      try {
        const res = await fetch('/api/admin/send', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ phone: activePhone, message: text })
        });
        if (res.ok) {
          await loadMessages(activePhone, true);
          await loadConversations();
        }
      } catch (err) {}
    }

    async function clearActiveHistory() {
      if (!activePhone || !confirm('Clear conversation history for this user?')) return;
      try {
        const res = await fetch(\`/api/admin/messages/\${encodeURIComponent(activePhone)}\`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          await loadMessages(activePhone, true);
          await loadConversations();
        }
      } catch (err) {}
    }

    function openBroadcastModal() {
      document.getElementById('broadcastModal').style.display = 'flex';
      lucide.createIcons();
    }

    function closeBroadcastModal() {
      document.getElementById('broadcastModal').style.display = 'none';
      document.getElementById('broadcastInput').value = '';
    }

    async function submitBroadcast() {
      const input = document.getElementById('broadcastInput');
      const text = input.value.trim();
      if (!text) return alert('Please enter broadcast message text.');

      try {
        const res = await fetch('/api/admin/broadcast', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          alert('✅ ' + data.message);
          closeBroadcastModal();
          await loadStats();
          await loadConversations();
        } else {
          alert('Failed to send broadcast: ' + (data.error || data.message || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error sending broadcast.');
      }
    }

    function handleKeyPress(e) {
      if (e.key === 'Enter') sendMessage();
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    window.onload = init;
  </script>
</body>
</html>
`;

adminUi.get('/admin/login', (c) => c.html(loginHtml));
adminUi.get('/admin', (c) => c.html(dashboardHtml));

export default adminUi;
