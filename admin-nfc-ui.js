// SPA навигация и мобильный-first UI для Attendance
// ---
// Контейнеры страниц (добавьте аналогичные для других страниц)
const pages = {
	home: document.getElementById('homePage'),
	group: document.getElementById('groupPage'),
	admin: document.getElementById('nfc-admin-root'),
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
	if (!window.renderAdmin || !window.state) {
		const t = setInterval(() => {
			if (window.renderAdmin && window.state) {
				clearInterval(t);
				init();
			}
		}, 200);
	} else init();

	function init() {
		const originalRenderAdmin = window.renderAdmin ? window.renderAdmin.bind(window) : () => {};

		window.renderAdmin = function () {
			originalRenderAdmin();

			try {
				const adminEl = document.querySelector('#adminPage');
				if (!adminEl) return;

				const container = document.createElement('div');
				container.style.marginTop = '12px';
				container.className = 'admin-card';
				container.innerHTML = `
					<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
						<div class="logo" style="width:56px;height:56px;border-radius:50%;background:#fff;box-shadow:0 2px 12px #667eea44;overflow:hidden;display:flex;align-items:center;justify-content:center;">
							<img src="logo-trk.png" alt="Логотип ТРК" style="width:100%;height:100%;object-fit:contain;" />
						</div>
						<div>
							<h3 style="margin:0;font-size:1.3em;font-weight:700;letter-spacing:0.01em;">NFC — Управление токенами</h3>
							<div class="muted" style="font-size:0.95em;">Таш-Кумырский региональный колледж</div>
						</div>
					</div>
					<div style="display:flex;flex-direction:column;gap:12px">
						<div class="muted">Здесь будет управление NFC-токенами для студентов и групп. (Дальнейшая интеграция с backend и UI — следующий этап)</div>
						<div style="margin-top:8px;">
							<button class="btn primary" disabled>Создать NFC-токен</button>
							<button class="btn ghost" disabled>Сбросить все токены</button>
						</div>
					</div>
				`;
				adminEl.appendChild(container);
			} catch (e) {
				console.error('admin-nfc-ui render error', e);
			}
		};
	}
})();