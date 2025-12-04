// -----------------------------
// Авторизация и хранение токена
// -----------------------------
async function login(login, password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    const data = await res.json();
    if (data.ok) {
      localStorage.setItem('token', data.token);
      return true;
    } else {
      alert(data.error || 'Ошибка входа');
      return false;
    }
  } catch (err) {
    alert('Ошибка сети');
    console.error(err);
    return false;
  }
}

// -----------------------------
// Получить состояние сервера
// -----------------------------
async function getState() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const res = await fetch('/api/state', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 401) return null;
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

// -----------------------------
// Сохранить/слиять состояние на сервере
// -----------------------------
async function mergeState(newState) {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const res = await fetch('/api/state/merge', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newState)
    });
    const data = await res.json();
    if (data.ok) return data.state;
    return false;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// -----------------------------
// Добавить студента
// -----------------------------
async function addStudent(id, name, groupId) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/student', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id, name, groupId })
  });
  return res.ok;
}

// -----------------------------
// Удалить студента
// -----------------------------
async function deleteStudent(id) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/student/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return res.ok;
}

// -----------------------------
// Отметка посещаемости
// -----------------------------
async function markAttendance(studentId, date, status, comment='') {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/attendance', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ studentId, date, status, comment })
  });
  return res.ok;
}

// -----------------------------
// Получить посещаемость за день
// -----------------------------
async function getAttendance(date) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/attendance/${date}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return res.ok ? await res.json() : {};
}

// -----------------------------
// Смена пароля
// -----------------------------
async function changePassword(newPassword) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/changePassword', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ newPassword })
  });
  return res.ok;
}

// -----------------------------
// Пример синхронизации (ПК и телефон видят одно состояние)
// -----------------------------
async function syncState() {
  const serverState = await getState();
  if (!serverState) return;

  // Можно тут обновить UI студентов, посещаемость и т.д.
  console.log('Синхронизированное состояние:', serverState);

  // Если есть локальные изменения, слить их:
  // const merged = await mergeState(localState);
  // console.log('После слияния:', merged);
}
