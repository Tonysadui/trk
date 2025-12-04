// SPA навигация и мобильный-first UI для Attendance
// ---
// Контейнеры страниц (добавьте аналогичные для других страниц)
const pages = {
  home: document.getElementById('homePage'),
  group: document.getElementById('groupPage'),
  admin: document.getElementById('qr-admin-root'),
  // ...добавьте остальные по мере необходимости
};

// Состояние несохранённых изменений (пример)
let unsaved = false;
function hasUnsavedChanges() { return unsaved; }
function setUnsaved(val) { unsaved = val; }

// Показать только нужную страницу, скрыть остальные
function showPage(pageKey) {
  Object.entries(pages).forEach(([key, el]) => {
    if (!el) return;
    if (key === pageKey) {
      el.style.display = 'block';
      el.classList.add('fade-in');
      setTimeout(() => el.classList.remove('fade-in'), 220);
      // accessibility: фокус на заголовок
      el.querySelector('h1, h2')?.focus();
    } else {
      el.style.display = 'none';
    }
  });
  // Обновить активный header
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (pageKey === 'home') document.querySelector('.home-btn')?.classList.add('active');
  if (pageKey === 'admin') document.querySelector('.admin-btn')?.classList.add('active');
}

// Переход на главную с подтверждением
function goHome(force = false) {
  if (hasUnsavedChanges() && !force) {
    showModalConfirm(() => goHome(true));
    return;
  }
  location.hash = '#/';
  showPage('home');
  showToast('Возврат на главную…');
}

// Модальное подтверждение
function showModalConfirm(onLeave) {
  const modal = document.getElementById('modalConfirm');
  modal.style.display = 'block';
  document.getElementById('stayBtn').onclick = () => { modal.style.display = 'none'; };
  document.getElementById('leaveBtn').onclick = () => { modal.style.display = 'none'; onLeave(); };
}

// Тост уведомление
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = '#222b';
    toast.style.color = '#fff';
    toast.style.padding = '12px 22px';
    toast.style.borderRadius = '12px';
    toast.style.fontSize = '15px';
    toast.style.zIndex = 1000;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = 1;
  setTimeout(() => { toast.style.opacity = 0; }, 1200);
}

// Навесить обработчики на логотип и кнопку "Главная"
function setupNav() {
  const logo = document.querySelector('.logo, .logo-circle');
  const homeBtn = document.querySelector('.home-btn');
  if (logo) {
    logo.setAttribute('aria-label', 'Главная');
    logo.setAttribute('role', 'button');
    logo.setAttribute('tabindex', '0');
    logo.onclick = goHome;
    logo.ondblclick = () => { /* сброс фильтров/поиска, если нужно */ };
  }
  if (homeBtn) homeBtn.onclick = goHome;
}

// SPA роутинг
window.onhashchange = () => {
  const hash = location.hash.replace('#/', '');
  if (!hash || hash === '') showPage('home');
  else if (hash.startsWith('group')) showPage('group');
  else if (hash === 'admin') showPage('admin');
  // ...
};

// Инициализация
window.addEventListener('DOMContentLoaded', () => {
  setupNav();
  window.onhashchange();
});

// CSS-анимация (можно вынести в style.css)
const style = document.createElement('style');
style.textContent = `
.fade-in { animation: fadeIn .18s cubic-bezier(.4,0,.2,1); }
@keyframes fadeIn { from { opacity:0; transform: translateY(16px);} to { opacity:1; transform: none;} }
`;
document.head.appendChild(style);

(function () {
  let rotatingInterval = null;

  async function fetchRotatingQr(groupId) {
    const token = localStorage.getItem('token') || '';
    const resp = await fetch('/api/qr/totp/' + encodeURIComponent(groupId), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return resp.json().catch(() => ({ ok: false, error: 'Invalid response' }));
  }

  async function updateQrOnce(groupId, imgEl, statusEl) {
    try {
      const j = await fetchRotatingQr(groupId);
      if (!j.ok) {
        statusEl.textContent = j.error || 'Ошибка получения QR';
        imgEl.src = '';
        return;
      }
      const qrUrl = j.url;
      const qrImg = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrUrl + '&_=' + Date.now());
      imgEl.src = qrImg;
      const expiresAt = j.expiresAt ? new Date(j.expiresAt).toLocaleTimeString() : '—';
      statusEl.textContent = `Обновлено. Действителен до: ${expiresAt}`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Ошибка сети при получении QR';
    }
  }

  function startRotating(groupId, imgEl, statusEl, intervalSeconds = 60) {
    stopRotating();
    updateQrOnce(groupId, imgEl, statusEl);
    rotatingInterval = setInterval(() => {
      updateQrOnce(groupId, imgEl, statusEl);
    }, Math.max(10, intervalSeconds) * 1000);
    statusEl.textContent = 'Запущено — обновление каждые ' + intervalSeconds + ' с';
  }

  function stopRotating() {
    if (rotatingInterval) {
      clearInterval(rotatingInterval);
      rotatingInterval = null;
    }
  }

  window.renderAdmin = function () {
    try {
      const adminEl = document.querySelector('#adminPage');
      if (!adminEl) return;
      const container = document.createElement('div');
      container.className = 'admin-card glass';
      container.style.marginTop = '24px';
      container.style.maxWidth = '420px';
      container.style.marginLeft = 'auto';
      container.style.marginRight = 'auto';
      container.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.18)';
      container.style.backdropFilter = 'blur(16px)';
      container.style.background = 'rgba(255,255,255,0.18)';
      container.style.borderRadius = '24px';
      container.style.border = '1.5px solid rgba(255,255,255,0.25)';
      container.style.padding = '28px 20px 22px 20px';
      container.innerHTML = `
        <div class="admin-header" style="display:flex;align-items:center;gap:18px;margin-bottom:18px;">
          <div class="logo" style="width:54px;height:54px;backdrop-filter:blur(4px);border-radius:16px;overflow:hidden;box-shadow:0 2px 12px #4da3ff33;">
            <img src="logo-trk.png" alt="Логотип ТКР" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <div>
            <h3 style="margin:0;font-size:1.25em;font-weight:800;letter-spacing:0.01em;color:#fff;text-shadow:0 2px 8px #0002;">QR — Ротация (админ)</h3>
            <div class="muted" style="font-size:1em;opacity:0.8;">Таш-Кумырский колледж</div>
          </div>
        </div>
        <div class="admin-controls" style="display:flex;flex-direction:column;gap:18px;">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;">
            <label class="muted" style="font-weight:600;">Группа:</label>
            <select id="qrGroupSelect" class="input" style="min-width:120px;border-radius:12px;padding:6px 12px;"></select>
            <button id="showRotatingQrBtn" class="btn glassy">Показать</button>
            <button id="startRotatingBtn" class="btn glassy">Авто‑обновление</button>
            <button id="stopRotatingBtn" class="btn glassy ghost">Стоп</button>
            <button id="copyQrLinkBtn" class="btn glassy">Копировать</button>
            <a id="downloadQrLink" class="btn glassy ghost" download="qr.png" style="text-decoration:none">Скачать</a>
          </div>
          <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;justify-content:center;">
            <div style="background:rgba(255,255,255,0.22);backdrop-filter:blur(8px);border-radius:18px;padding:12px;box-shadow:0 2px 16px #4da3ff22;display:flex;align-items:center;justify-content:center;">
              <img id="rotatingQrImg" src="" alt="rotating qr" style="width:160px;height:160px;border-radius:14px;border:2px solid #4da3ff33;background:rgba(255,255,255,0.7);transition:box-shadow .3s;box-shadow:0 2px 16px #4da3ff22;" />
            </div>
            <div style="flex:1;min-width:120px;display:flex;flex-direction:column;gap:8px;">
              <div id="rotatingQrStatus" class="muted" style="font-size:1.08em;">Нажмите <b>Показать</b></div>
              <div style="margin-top:2px;font-size:0.98em;opacity:0.7;">Токен меняется каждые 5 минут.<br>Можно настроить интервал авто‑обновления.</div>
            </div>
          </div>
        </div>
      `;
      adminEl.appendChild(container);

      // Добавим анимацию появления
      container.animate([
        { opacity: 0, transform: 'translateY(24px) scale(0.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ], { duration: 420, easing: 'cubic-bezier(.4,1.4,.6,1)', fill: 'forwards' });

      const select = document.getElementById('qrGroupSelect');
      const imgEl = document.getElementById('rotatingQrImg');
      const statusEl = document.getElementById('rotatingQrStatus');
      const showBtn = document.getElementById('showRotatingQrBtn');
      const startBtn = document.getElementById('startRotatingBtn');
      const stopBtn = document.getElementById('stopRotatingBtn');
      const copyBtn = document.getElementById('copyQrLinkBtn');
      const downloadLink = document.getElementById('downloadQrLink');

      select.innerHTML = '';
      (window.state && window.state.groups ? window.state.groups : []).forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = `${g.name} (${g.id})`;
        select.appendChild(opt);
      });
      if (select.options.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Нет групп';
        select.appendChild(opt);
      }

      showBtn.addEventListener('click', () => {
        const gid = select.value;
        if (!gid) { statusEl.textContent = 'Выберите группу'; return; }
        updateQrOnce(gid, imgEl, statusEl);
        imgEl.animate([
          { opacity: 0, transform: 'scale(0.95)' },
          { opacity: 1, transform: 'scale(1)' }
        ], { duration: 320, fill: 'forwards' });
      });

      startBtn.addEventListener('click', () => {
        const gid = select.value;
        if (!gid) { statusEl.textContent = 'Выберите группу'; return; }
        startRotating(gid, imgEl, statusEl, 60);
        statusEl.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], { duration: 300, fill: 'forwards' });
      });

      stopBtn.addEventListener('click', () => {
        stopRotating();
        statusEl.textContent = 'Авто‑обновление остановлено';
        statusEl.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], { duration: 300, fill: 'forwards' });
      });

      copyBtn.addEventListener('click', async () => {
        const gid = select.value;
        if (!gid) { statusEl.textContent = 'Выберите группу'; return; }
        const j = await fetchRotatingQr(gid);
        if (!j.ok) { statusEl.textContent = j.error || 'Ошибка'; return; }
        const url = j.url;
        try {
          await navigator.clipboard.writeText(url);
          statusEl.textContent = 'Ссылка скопирована в буфер обмена';
        } catch (e) {
          statusEl.textContent = 'Не удалось скопировать ссылку';
        }
        statusEl.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], { duration: 300, fill: 'forwards' });
      });

      downloadLink.addEventListener('click', (ev) => {
        if (!downloadLink.href) {
          ev.preventDefault();
          statusEl.textContent = 'Сначала нажмите «Показать»';
        }
      });

      window.addEventListener('hashchange', () => {
        if (!location.hash || !location.hash.startsWith('#/admin')) {
          stopRotating();
        }
      });

    } catch (e) {
      console.error('admin-qr-ui render error', e);
    }
  };

  // Автоинициализация, когда всё готово
  if (!window.state) {
    const t = setInterval(() => {
      if (window.state) {
        clearInterval(t);
        window.renderAdmin();
      }
    }, 200);
  } else {
    window.renderAdmin();
  }
})();