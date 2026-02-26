const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const UAParser = require('ua-parser-js');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const DATA_PATH = path.join(ROOT, 'downloads.xlsx');

const defaultConfig = {
  adminPath: 'admin-alyaman-2026',
  adminPassword: 'change-me',
  links: {
    android: {
      current: 'https://example.com/android.apk',
      history: [
        {
          url: 'https://example.com/android.apk',
          downloads: 0,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    ios: {
      current: 'https://example.com/ios',
      history: [
        {
          url: 'https://example.com/ios',
          downloads: 0,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  },
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function ensureWorkbook() {
  if (!fs.existsSync(DATA_PATH)) {
    const wb = XLSX.utils.book_new();
    const header = [
      'timestamp',
      'type',
      'link',
      'ip',
      'deviceCategory',
      'deviceName',
      'os',
      'browser',
      'userAgent',
    ];
    const sheet = XLSX.utils.aoa_to_sheet([header]);
    XLSX.utils.book_append_sheet(wb, sheet, 'downloads');
    XLSX.writeFile(wb, DATA_PATH);
  }
}

function appendDownload(entry) {
  ensureWorkbook();
  const wb = XLSX.readFile(DATA_PATH);
  const sheet = wb.Sheets.downloads || wb.Sheets.Downloads || wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  data.push([
    entry.timestamp,
    entry.type,
    entry.link,
    entry.ip,
    entry.deviceCategory,
    entry.deviceName,
    entry.os,
    entry.browser,
    entry.userAgent,
  ]);
  const newSheet = XLSX.utils.aoa_to_sheet(data);
  wb.Sheets.downloads = newSheet;
  if (!wb.SheetNames.includes('downloads')) {
    wb.SheetNames.unshift('downloads');
  }
  XLSX.writeFile(wb, DATA_PATH);
}

function getDeviceInfo(userAgent) {
  const parser = new UAParser(userAgent || '');
  const device = parser.getDevice();
  const os = parser.getOS();
  const browser = parser.getBrowser();

  const deviceType = device.type || 'desktop';
  const deviceCategory = deviceType === 'mobile' || deviceType === 'tablet' ? 'mobile' : 'laptop/desktop';
  const deviceName = [device.vendor, device.model].filter(Boolean).join(' ') || 'غير معروف';

  return {
    deviceCategory,
    deviceName,
    os: os.name ? `${os.name} ${os.version || ''}`.trim() : 'غير معروف',
    browser: browser.name ? `${browser.name} ${browser.version || ''}`.trim() : 'غير معروف',
  };
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ ok: false, message: 'غير مصرح' });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'alyaman-admin-session',
    resave: false,
    saveUninitialized: false,
  })
);

const config = loadConfig();
const adminPath = `/${config.adminPath}`;
ensureWorkbook();

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(ROOT, 'styles.css'));
});

app.get('/app.js', (req, res) => {
  res.sendFile(path.join(ROOT, 'app.js'));
});

app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(ROOT, 'logo.png'));
});

app.get('/api/links', (req, res) => {
  const current = {
    android: config.links.android.current,
    ios: config.links.ios.current,
  };
  res.json(current);
});

app.get('/download/:type', (req, res) => {
  const type = req.params.type;
  if (type !== 'android' && type !== 'ios') {
    return res.status(404).send('Not Found');
  }

  const linkEntry = config.links[type];
  const link = linkEntry.current;

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'غير معروف';
  const info = getDeviceInfo(req.headers['user-agent']);

  const entry = {
    timestamp: new Date().toISOString(),
    type,
    link,
    ip,
    deviceCategory: info.deviceCategory,
    deviceName: info.deviceName,
    os: info.os,
    browser: info.browser,
    userAgent: req.headers['user-agent'] || 'غير معروف',
  };

  const historyItem = linkEntry.history.find((item) => item.url === link);
  if (historyItem) {
    historyItem.downloads += 1;
  } else {
    linkEntry.history.push({ url: link, downloads: 1, createdAt: new Date().toISOString() });
  }

  saveConfig(config);
  appendDownload(entry);

  if (!link || link.startsWith('https://example.com')) {
    return res.status(200).send('الرابط غير محدث بعد من صفحة الادمن.');
  }

  return res.redirect(link);
});

app.get(adminPath, (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.sendFile(path.join(ROOT, 'admin.html'));
  }
  return res.sendFile(path.join(ROOT, 'admin-login.html'));
});

app.post(`${adminPath}/login`, (req, res) => {
  const password = req.body.password || '';
  if (password === config.adminPassword) {
    req.session.isAdmin = true;
    return res.redirect(adminPath);
  }
  return res.status(401).send('كلمة السر غير صحيحة');
});

app.post(`${adminPath}/logout`, (req, res) => {
  req.session.destroy(() => {
    res.redirect(adminPath);
  });
});

app.get('/api/admin/status', requireAuth, (req, res) => {
  const androidTotal = config.links.android.history.reduce((sum, item) => sum + item.downloads, 0);
  const iosTotal = config.links.ios.history.reduce((sum, item) => sum + item.downloads, 0);

  res.json({
    android: {
      current: config.links.android.current,
      currentDownloads: (config.links.android.history.find((item) => item.url === config.links.android.current) || {}).downloads || 0,
      totalDownloads: androidTotal,
      history: config.links.android.history,
    },
    ios: {
      current: config.links.ios.current,
      currentDownloads: (config.links.ios.history.find((item) => item.url === config.links.ios.current) || {}).downloads || 0,
      totalDownloads: iosTotal,
      history: config.links.ios.history,
    },
  });
});

app.post('/api/admin/links', requireAuth, (req, res) => {
  const { type, url } = req.body;
  if (!['android', 'ios'].includes(type) || !url) {
    return res.status(400).json({ ok: false, message: 'بيانات غير صحيحة' });
  }

  const linkEntry = config.links[type];
  if (linkEntry.current !== url) {
    linkEntry.current = url;
    linkEntry.history.push({ url, downloads: 0, createdAt: new Date().toISOString() });
  }

  saveConfig(config);
  res.json({ ok: true });
});

app.get('/api/admin/export', requireAuth, (req, res) => {
  ensureWorkbook();
  res.download(DATA_PATH, 'downloads.xlsx');
});

app.get('/admin.css', (req, res) => {
  res.sendFile(path.join(ROOT, 'admin.css'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin URL: http://localhost:${PORT}${adminPath}`);
});
