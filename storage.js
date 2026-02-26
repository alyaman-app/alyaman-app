const ALYAMAN_STORAGE_KEY = 'alyaman_db_v1';

const DEFAULT_DB = (() => {
  const now = new Date().toISOString();
  return {
    adminPassword: 'change-me',
    links: {
      android: {
        current: 'https://example.com/android.apk',
        history: [{ url: 'https://example.com/android.apk', downloads: 0, createdAt: now }],
      },
      ios: {
        current: 'https://example.com/ios',
        history: [{ url: 'https://example.com/ios', downloads: 0, createdAt: now }],
      },
    },
    downloads: [],
  };
})();

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function normalizeDB(input) {
  const db = input && typeof input === 'object' ? input : {};
  if (!db.links) db.links = {};
  if (!db.links.android) db.links.android = cloneDefault().links.android;
  if (!db.links.ios) db.links.ios = cloneDefault().links.ios;
  if (!Array.isArray(db.downloads)) db.downloads = [];
  if (typeof db.adminPassword !== 'string' || !db.adminPassword.trim()) {
    db.adminPassword = cloneDefault().adminPassword;
  }
  return db;
}

function loadDB() {
  const raw = localStorage.getItem(ALYAMAN_STORAGE_KEY);
  if (!raw) {
    const fresh = cloneDefault();
    localStorage.setItem(ALYAMAN_STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    const parsed = normalizeDB(JSON.parse(raw));
    return parsed;
  } catch (err) {
    const fresh = cloneDefault();
    localStorage.setItem(ALYAMAN_STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

function saveDB(db) {
  const normalized = normalizeDB(db);
  localStorage.setItem(ALYAMAN_STORAGE_KEY, JSON.stringify(normalized));
}

function ensureHistory(linkEntry) {
  if (!Array.isArray(linkEntry.history)) {
    linkEntry.history = [];
  }
  if (linkEntry.current && !linkEntry.history.find((item) => item.url === linkEntry.current)) {
    linkEntry.history.push({ url: linkEntry.current, downloads: 0, createdAt: new Date().toISOString() });
  }
}

function getCurrentLink(type) {
  const db = loadDB();
  return db.links[type]?.current || '';
}

function setLink(type, url) {
  const db = loadDB();
  if (!db.links[type]) return;
  const entry = db.links[type];
  entry.current = url;
  ensureHistory(entry);
  const historyItem = entry.history.find((item) => item.url === url);
  if (!historyItem) {
    entry.history.push({ url, downloads: 0, createdAt: new Date().toISOString() });
  }
  saveDB(db);
}

function getStats(type) {
  const db = loadDB();
  const entry = db.links[type];
  if (!entry) {
    return { current: '', currentDownloads: 0, totalDownloads: 0, history: [] };
  }
  ensureHistory(entry);
  const currentItem = entry.history.find((item) => item.url === entry.current) || { downloads: 0 };
  const totalDownloads = entry.history.reduce((sum, item) => sum + (item.downloads || 0), 0);
  return {
    current: entry.current,
    currentDownloads: currentItem.downloads || 0,
    totalDownloads,
    history: entry.history,
  };
}

function detectDeviceInfo() {
  const ua = navigator.userAgent || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  let os = 'غير معروف';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'غير معروف';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  let deviceName = 'غير معروف';
  if (navigator.userAgentData && navigator.userAgentData.model) {
    deviceName = navigator.userAgentData.model;
  }

  return {
    deviceCategory: isMobile ? 'mobile' : 'laptop/desktop',
    deviceName,
    os,
    browser,
    userAgent: ua || 'غير معروف',
  };
}

function recordDownload(type) {
  const db = loadDB();
  const entry = db.links[type];
  if (!entry) return;
  ensureHistory(entry);

  const link = entry.current;
  const historyItem = entry.history.find((item) => item.url === link);
  if (historyItem) {
    historyItem.downloads = (historyItem.downloads || 0) + 1;
  }

  const info = detectDeviceInfo();
  db.downloads.push({
    timestamp: new Date().toISOString(),
    type,
    link,
    deviceCategory: info.deviceCategory,
    deviceName: info.deviceName,
    os: info.os,
    browser: info.browser,
    userAgent: info.userAgent,
  });

  saveDB(db);
}

function getDownloads() {
  const db = loadDB();
  return Array.isArray(db.downloads) ? db.downloads : [];
}

function downloadCSV(filename = 'downloads.csv') {
  const db = loadDB();
  const headers = [
    'timestamp',
    'type',
    'link',
    'deviceCategory',
    'deviceName',
    'os',
    'browser',
    'userAgent',
  ];
  const rows = db.downloads.map((row) => [
    row.timestamp,
    row.type,
    row.link,
    row.deviceCategory,
    row.deviceName,
    row.os,
    row.browser,
    row.userAgent,
  ]);

  const escapeCell = (value) => {
    const text = String(value ?? '');
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  };

  const csv = ['\ufeff' + headers.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportJSON(filename = 'alyaman-backup.json') {
  const db = loadDB();
  const data = JSON.stringify(db, null, 2);
  const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importJSON(text) {
  const parsed = normalizeDB(JSON.parse(text));
  saveDB(parsed);
  return parsed;
}
