const AUTH_KEY = 'alyaman_admin_auth';
const ATTEMPT_KEY = 'alyaman_admin_attempts';
const LOCK_KEY = 'alyaman_admin_lock_until';
const MAX_ATTEMPTS = 3;
const LOCK_MINUTES = 10;

const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const exportBtn = document.getElementById('export-csv');
const exportJsonBtn = document.getElementById('export-json');
const importJsonInput = document.getElementById('import-json');
const passwordForm = document.getElementById('password-form');
const toast = document.getElementById('toast');

const filterType = document.getElementById('filter-type');
const filterDevice = document.getElementById('filter-device');
const filterSearch = document.getElementById('filter-search');
const downloadsList = document.getElementById('downloads-list');
const downloadsCount = document.getElementById('downloads-count');

const statAndroid = document.getElementById('stat-android');
const statIos = document.getElementById('stat-ios');
const statMobile = document.getElementById('stat-mobile');
const statDesktop = document.getElementById('stat-desktop');
const barAndroid = document.getElementById('bar-android');
const barIos = document.getElementById('bar-ios');
const barMobile = document.getElementById('bar-mobile');
const barDesktop = document.getElementById('bar-desktop');

function showToast(message, isError = false) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.toggle('error', isError);
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2400);
}

function showAdmin() {
  loginSection.classList.add('hidden');
  adminSection.classList.remove('hidden');
  loadStatus();
}

function showLogin() {
  adminSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
}

function setAuth(value) {
  if (value) {
    localStorage.setItem(AUTH_KEY, 'true');
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

function getLockUntil() {
  const raw = localStorage.getItem(LOCK_KEY);
  const value = raw ? Number(raw) : 0;
  if (!value || Number.isNaN(value)) return 0;
  return value;
}

function setLockUntil(ts) {
  localStorage.setItem(LOCK_KEY, String(ts));
}

function clearLock() {
  localStorage.removeItem(LOCK_KEY);
  localStorage.removeItem(ATTEMPT_KEY);
}

function isLocked() {
  const lockUntil = getLockUntil();
  if (!lockUntil) return false;
  if (Date.now() > lockUntil) {
    clearLock();
    return false;
  }
  return true;
}

function recordFailedAttempt() {
  const current = Number(localStorage.getItem(ATTEMPT_KEY) || '0');
  const next = current + 1;
  localStorage.setItem(ATTEMPT_KEY, String(next));
  if (next >= MAX_ATTEMPTS) {
    const lockUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    setLockUntil(lockUntil);
  }
  return next;
}

function renderHistory(container, history, current) {
  container.innerHTML = '';
  if (!history || !history.length) {
    container.textContent = 'لا يوجد روابط محفوظة بعد.';
    return;
  }

  history
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((item) => {
      const row = document.createElement('div');
      row.className = 'history-item';

      const url = document.createElement('span');
      url.className = 'history-url';
      url.textContent = item.url;

      const count = document.createElement('span');
      count.className = 'history-count';
      count.textContent = `تحميلات: ${item.downloads || 0}`;

      row.appendChild(url);
      row.appendChild(count);

      if (item.url === current) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'الحالي';
        row.appendChild(badge);
      }

      container.appendChild(row);
    });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('ar');
  } catch (err) {
    return iso;
  }
}

function renderDownloads() {
  if (!downloadsList) return;
  const typeFilter = filterType ? filterType.value : 'all';
  const deviceFilter = filterDevice ? filterDevice.value : 'all';
  const search = filterSearch ? filterSearch.value.trim().toLowerCase() : '';

  const all = getDownloads().slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const filtered = all.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (deviceFilter !== 'all' && item.deviceCategory !== deviceFilter) return false;
    if (search) {
      const hay = [item.deviceName, item.os, item.browser, item.userAgent]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const visible = filtered.slice(0, 10);
  downloadsCount.textContent = `عرض ${visible.length} من أصل ${filtered.length} (آخر 10 تحميلات)`;

  downloadsList.innerHTML = '';
  if (!visible.length) {
    downloadsList.textContent = 'لا يوجد تحميلات بعد.';
    return;
  }

  visible.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'download-item';

    const left = document.createElement('div');
    const right = document.createElement('div');

    left.innerHTML = `
      <strong>${item.type === 'android' ? 'Android' : 'iOS'}</strong>
      <div class="download-meta">${item.link || '---'}</div>
      <div class="download-meta">${formatDate(item.timestamp)}</div>
    `;

    right.innerHTML = `
      <div class="download-meta">${item.deviceCategory || '---'}</div>
      <div class="download-meta">${item.deviceName || '---'}</div>
      <div class="download-meta">${item.os || '---'} • ${item.browser || '---'}</div>
    `;

    row.appendChild(left);
    row.appendChild(right);
    downloadsList.appendChild(row);
  });
}

function renderStats(downloads) {
  const android = downloads.filter((d) => d.type === 'android').length;
  const ios = downloads.filter((d) => d.type === 'ios').length;
  const mobile = downloads.filter((d) => d.deviceCategory === 'mobile').length;
  const desktop = downloads.filter((d) => d.deviceCategory === 'laptop/desktop').length;
  const total = downloads.length || 1;

  if (statAndroid) statAndroid.textContent = android;
  if (statIos) statIos.textContent = ios;
  if (statMobile) statMobile.textContent = mobile;
  if (statDesktop) statDesktop.textContent = desktop;

  if (barAndroid) barAndroid.style.width = `${Math.round((android / total) * 100)}%`;
  if (barIos) barIos.style.width = `${Math.round((ios / total) * 100)}%`;
  if (barMobile) barMobile.style.width = `${Math.round((mobile / total) * 100)}%`;
  if (barDesktop) barDesktop.style.width = `${Math.round((desktop / total) * 100)}%`;
}

function loadStatus() {
  const android = getStats('android');
  const ios = getStats('ios');
  const downloads = getDownloads();

  document.getElementById('android-current').textContent = android.current || '---';
  document.getElementById('android-current-count').textContent = android.currentDownloads;
  document.getElementById('android-total').textContent = android.totalDownloads;

  document.getElementById('ios-current').textContent = ios.current || '---';
  document.getElementById('ios-current-count').textContent = ios.currentDownloads;
  document.getElementById('ios-total').textContent = ios.totalDownloads;

  renderHistory(document.getElementById('android-history'), android.history, android.current);
  renderHistory(document.getElementById('ios-history'), ios.history, ios.current);

  renderStats(downloads);
  renderDownloads();
}

if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isLocked()) {
      const left = Math.ceil((getLockUntil() - Date.now()) / 60000);
      loginError.textContent = `تم قفل الدخول مؤقتاً. حاول بعد ${left} دقيقة.`;
      return;
    }
    const password = loginForm.querySelector('input[name="password"]').value.trim();
    const db = loadDB();

    if (password === db.adminPassword) {
      setAuth(true);
      loginError.textContent = '';
      loginForm.reset();
      clearLock();
      showToast('تم تسجيل الدخول بنجاح');
      showAdmin();
    } else {
      const attempts = recordFailedAttempt();
      if (isLocked()) {
        loginError.textContent = 'تم قفل الدخول مؤقتاً بسبب المحاولات الخاطئة.';
      } else {
        loginError.textContent = `كلمة السر غير صحيحة (محاولة ${attempts}/${MAX_ATTEMPTS}).`;
      }
      showToast('كلمة السر غير صحيحة', true);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    setAuth(false);
    showLogin();
  });
}

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    downloadCSV('downloads.csv');
    showToast('تم تنزيل ملف CSV');
  });
}

if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', () => {
    exportJSON('alyaman-backup.json');
    showToast('تم تنزيل النسخة الاحتياطية');
  });
}

if (importJsonInput) {
  importJsonInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJSON(reader.result);
        showToast('تم استيراد النسخة بنجاح');
        loadStatus();
      } catch (err) {
        showToast('فشل استيراد الملف', true);
      }
    };
    reader.readAsText(file);
  });
}

if (passwordForm) {
  passwordForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const newPassword = passwordForm.querySelector('input[name="password"]').value.trim();
    if (!newPassword) return;
    const db = loadDB();
    db.adminPassword = newPassword;
    saveDB(db);
    passwordForm.reset();
    showToast('تم حفظ كلمة السر الجديدة');
  });
}

const linkForms = document.querySelectorAll('.link-form');
linkForms.forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const type = form.dataset.type;
    const url = form.querySelector('input[name="url"]').value.trim();
    if (!url) return;
    setLink(type, url);
    form.reset();
    loadStatus();
    showToast('تم حفظ الرابط');
  });
});

[filterType, filterDevice, filterSearch].forEach((control) => {
  if (!control) return;
  control.addEventListener('input', () => {
    renderDownloads();
  });
});

if (isAuthed()) {
  showAdmin();
} else {
  showLogin();
}
