const STORAGE_KEYS = {
  tasks: 'agenda-pessoal-js.tasks',
  theme: 'agenda-pessoal-js.theme',
};

let tasksNeedSeed = false;
let themeNeedSeed = false;

const seedTasks = [
  {
    id: 'task-1',
    title: 'Revisar agenda da semana',
    description: 'Organizar reuniões, entregas e blocos de foco.',
    date: getLocalDateKey(),
    time: '09:00',
    category: 'Trabalho',
    priority: 'Alta',
    completed: false,
  },
  {
    id: 'task-2',
    title: 'Treino funcional',
    description: 'Sessão curta para manter a rotina ativa.',
    date: getLocalDateKey(),
    time: '18:30',
    category: 'Treino',
    priority: 'Média',
    completed: true,
  },
  {
    id: 'task-3',
    title: 'Organizar finanças do mês',
    description: 'Conferir contas e separar pagamentos pendentes.',
    date: addDaysKey(new Date(), 1),
    time: '20:00',
    category: 'Pessoal',
    priority: 'Baixa',
    completed: false,
  },
];

const state = {
  tasks: loadTasks(),
  filter: 'all',
  search: '',
  editingId: null,
  theme: loadTheme(),
};

const elements = {
  body: document.body,
  currentDate: document.getElementById('current-date'),
  themeToggle: document.getElementById('theme-toggle'),
  newTaskButton: document.getElementById('new-task-button'),
  pendingCount: document.getElementById('pending-count'),
  doneCount: document.getElementById('done-count'),
  taskListTitle: document.getElementById('task-list-title'),
  taskSummary: document.getElementById('task-summary'),
  taskList: document.getElementById('task-list'),
  searchInput: document.getElementById('search-input'),
  filterButtons: document.querySelectorAll('.filter-button'),
  dialog: document.getElementById('task-dialog'),
  form: document.getElementById('task-form'),
  formKicker: document.getElementById('form-kicker'),
  formTitle: document.getElementById('form-title'),
  closeDialogButton: document.getElementById('close-dialog-button'),
  cancelTaskButton: document.getElementById('cancel-task-button'),
  taskId: document.getElementById('task-id'),
  taskTitle: document.getElementById('task-title'),
  taskDescription: document.getElementById('task-description'),
  taskDate: document.getElementById('task-date'),
  taskTime: document.getElementById('task-time'),
  taskCategory: document.getElementById('task-category'),
  taskPriority: document.getElementById('task-priority'),
  taskCompleted: document.getElementById('task-completed'),
  saveTaskButton: document.getElementById('save-task-button'),
};

const listDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const currentDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysKey(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return getLocalDateKey(next);
}

function getLocalDateTime(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function uid() {
  if (window.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tasks);
    if (!raw) {
      tasksNeedSeed = true;
      return seedTasks;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      tasksNeedSeed = true;
      return seedTasks;
    }

    return parsed.map((task) => ({
      priority: 'Média',
      completed: false,
      description: '',
      category: 'Outros',
      ...task,
    }));
  } catch {
    tasksNeedSeed = true;
    return seedTasks;
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
}

function loadTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  themeNeedSeed = true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function saveTheme() {
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
}

function formatDateLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return listDateFormatter.format(new Date(year, month - 1, day));
}

function getDueDateTime(task) {
  return getLocalDateTime(task.date, task.time);
}

function isTaskOverdue(task) {
  return !task.completed && getDueDateTime(task) < new Date();
}

function getTaskBucket(task) {
  if (isTaskOverdue(task)) {
    return 0;
  }

  if (task.date === getLocalDateKey()) {
    return 1;
  }

  return 2;
}

function applyTheme() {
  elements.body.dataset.theme = state.theme;
  elements.themeToggle.textContent = state.theme === 'dark' ? '☀' : '☾';
  elements.themeToggle.setAttribute('aria-label', state.theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro');
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const bucketDiff = getTaskBucket(a) - getTaskBucket(b);
    if (bucketDiff !== 0) {
      return bucketDiff;
    }

    const completionDiff = Number(a.completed) - Number(b.completed);
    if (completionDiff !== 0) {
      return completionDiff;
    }

    return getDueDateTime(a) - getDueDateTime(b);
  });
}

function getVisibleTasks() {
  return sortTasks(state.tasks).filter((task) => {
    const matchesSearch = normalizeText(task.title).includes(normalizeText(state.search));
    const matchesFilter =
      state.filter === 'all' ||
      (state.filter === 'today' && task.date === getLocalDateKey()) ||
      (state.filter === 'pending' && !task.completed) ||
      (state.filter === 'done' && task.completed);

    return matchesSearch && matchesFilter;
  });
}

function renderCounts() {
  const pending = state.tasks.filter((task) => !task.completed).length;
  const done = state.tasks.filter((task) => task.completed).length;

  elements.pendingCount.textContent = pending;
  elements.doneCount.textContent = done;
}

function renderTaskList() {
  const visibleTasks = getVisibleTasks();

  const filterLabels = {
    all: 'Todas as tarefas',
    today: 'Tarefas de hoje',
    pending: 'Tarefas pendentes',
    done: 'Tarefas concluídas',
  };

  elements.taskListTitle.textContent = filterLabels[state.filter];
  elements.taskSummary.textContent = `${visibleTasks.length} tarefa${visibleTasks.length === 1 ? '' : 's'} encontrada${visibleTasks.length === 1 ? '' : 's'}`;

  if (visibleTasks.length === 0) {
    const emptyMessage = state.tasks.length === 0
      ? 'Sua agenda está vazia. Crie a primeira tarefa para começar.'
      : 'Nenhuma tarefa encontrada com os filtros atuais.';

    elements.taskList.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  elements.taskList.innerHTML = visibleTasks.map((task) => {
    const isToday = task.date === getLocalDateKey();
    const statusText = task.completed ? 'Concluída' : 'Pendente';
    const completeButtonText = task.completed ? 'Marcar pendente' : 'Concluir';
    const overdue = isTaskOverdue(task);
    const priorityClass = {
      Baixa: 'priority-low',
      Média: 'priority-medium',
      Alta: 'priority-high',
    }[task.priority] || 'priority-medium';

    return `
      <article class="task-item ${task.completed ? 'is-done' : ''}" data-id="${task.id}">
        <div>
          <div class="task-header">
            <h3 class="task-title"><span class="status-dot"></span><span class="task-title-text">${escapeHtml(task.title)}</span></h3>
            <div class="task-badges">
              <span class="pill ${priorityClass}">Prioridade ${task.priority}</span>
              ${overdue ? '<span class="pill overdue">Atrasada</span>' : ''}
            </div>
          </div>
          ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta primary">
            <span class="pill ${isToday ? 'today' : ''}">${isToday ? 'Hoje' : formatDateLabel(task.date)}</span>
            <span class="pill">${task.time}</span>
            <span class="pill">${task.category}</span>
            <span class="pill status">${statusText}</span>
          </div>
        </div>

        <div class="task-actions">
          <button type="button" class="complete-button" data-action="toggle-complete">${completeButtonText}</button>
          <button type="button" class="edit-button" data-action="edit">Editar</button>
          <button type="button" class="delete-button" data-action="delete">Excluir</button>
        </div>
      </article>
    `;
  }).join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderFilterState() {
  elements.filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === state.filter);
  });
}

function renderAll() {
  renderCounts();
  renderFilterState();
  renderTaskList();
}

function openForm(task = null) {
  state.editingId = task ? task.id : null;
  elements.form.reset();

  elements.formKicker.textContent = task ? 'Editar tarefa' : 'Nova tarefa';
  elements.formTitle.textContent = task ? 'Editar tarefa' : 'Criar tarefa';
  elements.saveTaskButton.textContent = task ? 'Salvar alterações' : 'Salvar tarefa';

  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  elements.taskId.value = task ? task.id : '';
  elements.taskTitle.value = task ? task.title : '';
  elements.taskDescription.value = task ? task.description || '' : '';
  elements.taskDate.value = task ? task.date : getLocalDateKey();
  elements.taskTime.value = task ? task.time : defaultTime;
  elements.taskCategory.value = task ? task.category : 'Trabalho';
  elements.taskPriority.value = task ? task.priority : 'Média';
  elements.taskCompleted.checked = task ? task.completed : false;

  elements.dialog.showModal();
  elements.taskTitle.focus();
}

function closeForm() {
  state.editingId = null;
  elements.dialog.close();
}

function findTaskById(id) {
  return state.tasks.find((task) => task.id === id);
}

function upsertTask(formData) {
  const payload = {
    id: state.editingId || uid(),
    title: formData.get('title').trim(),
    description: formData.get('description').trim(),
    date: formData.get('date'),
    time: formData.get('time'),
    category: formData.get('category'),
    priority: formData.get('priority'),
    completed: formData.get('completed') === 'on',
  };

  if (state.editingId) {
    state.tasks = state.tasks.map((task) => (task.id === state.editingId ? payload : task));
  } else {
    state.tasks = [...state.tasks, payload];
  }

  saveTasks();
  renderAll();
  closeForm();
}

function deleteTask(id) {
  const task = findTaskById(id);
  if (!task) {
    return;
  }

  const confirmed = window.confirm(`Excluir "${task.title}"?`);
  if (!confirmed) {
    return;
  }

  state.tasks = state.tasks.filter((item) => item.id !== id);
  saveTasks();
  renderAll();
}

function toggleTaskCompletion(id) {
  state.tasks = state.tasks.map((task) => (
    task.id === id
      ? { ...task, completed: !task.completed }
      : task
  ));

  saveTasks();
  renderAll();
}

function editTask(id) {
  const task = findTaskById(id);
  if (task) {
    openForm(task);
  }
}

elements.currentDate.textContent = currentDateFormatter.format(new Date());
applyTheme();
if (themeNeedSeed) {
  saveTheme();
}

if (tasksNeedSeed) {
  saveTasks();
}

renderAll();

elements.filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    renderAll();
  });
});

elements.searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderTaskList();
});

elements.newTaskButton.addEventListener('click', () => openForm());
elements.themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveTheme();
  applyTheme();
});

elements.closeDialogButton.addEventListener('click', closeForm);
elements.cancelTaskButton.addEventListener('click', closeForm);

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!elements.taskTitle.value.trim()) {
    elements.taskTitle.focus();
    return;
  }

  upsertTask(new FormData(elements.form));
});

elements.taskList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const card = event.target.closest('.task-item');

  if (!button || !card) {
    return;
  }

  const { action } = button.dataset;
  const { id } = card.dataset;

  if (action === 'toggle-complete') {
    toggleTaskCompletion(id);
  }

  if (action === 'edit') {
    editTask(id);
  }

  if (action === 'delete') {
    deleteTask(id);
  }
});
