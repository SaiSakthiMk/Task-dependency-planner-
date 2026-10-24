import cytoscape from 'cytoscape';
import { analyzeGraph, validateTasks } from './graph.js';
import { clearSavedTasks, loadTasks, saveTasks } from './storage.js';
import './style.css';

const examples = {
  valid: [
    { id: 'design', name: 'Design', description: 'Plan the product experience and technical foundation.', dependencies: [] },
    { id: 'frontend', name: 'Frontend Development', description: 'Build the user interface.', dependencies: ['design'] },
    { id: 'backend', name: 'Backend Development', description: 'Build the service and data layer.', dependencies: ['design'] },
    { id: 'integration', name: 'Integration Testing', description: 'Verify that frontend and backend work together.', dependencies: ['frontend', 'backend'] },
    { id: 'deployment', name: 'Deployment', description: 'Release the tested product.', dependencies: ['integration'] },
  ],
  cycle: [
    { id: 'task-a', name: 'Task A', description: 'Waits for Task C.', dependencies: ['task-c'] },
    { id: 'task-b', name: 'Task B', description: 'Waits for Task A.', dependencies: ['task-a'] },
    { id: 'task-c', name: 'Task C', description: 'Waits for Task B.', dependencies: ['task-b'] },
  ],
};

const $ = (selector) => document.querySelector(selector);
const els = {
  form: $('#task-form'), id: $('#task-id'), name: $('#task-name'), description: $('#task-description'), dependencies: $('#task-dependencies'),
  formMessage: $('#form-message'), formHeading: $('#form-heading'), submit: $('#submit-task'), cancelEdit: $('#cancel-edit'),
  taskList: $('#task-list'), taskEmpty: $('#task-empty'), listCount: $('#list-count'), listCaption: $('#list-caption'),
  taskCount: $('#task-count'), dependencyCount: $('#dependency-count'), cycleStatus: $('#cycle-status'), executionStatus: $('#execution-status'),
  graphEmpty: $('#graph-empty'), analysisMessage: $('#analysis-message'), order: $('#execution-order'), orderEmpty: $('#order-empty'), orderCount: $('#order-count'),
  stages: $('#stages-list'), stagesEmpty: $('#stages-empty'), stageCount: $('#stage-count'), selectedDetails: $('#selected-details'),
  examplesDialog: $('#examples-dialog'), toast: $('#toast'),
};
const loaded = loadTasks();
let tasks = loaded.tasks;
let editingId = null;
let selectedId = null;
let cycleHighlight = true;
let orderHighlight = false;
let currentAnalysis = analyzeGraph(tasks);
let toastTimer;

const cy = cytoscape({
  container: $('#cy'),
  elements: [],
  layout: { name: 'cose', animate: false, padding: 40, nodeRepulsion: 5200, idealEdgeLength: 130 },
  minZoom: 0.35,
  maxZoom: 2.5,
  style: [
    { selector: 'node', style: { 'background-color': '#dce7f6', 'border-color': '#7999c7', 'border-width': 1.5, label: 'data(label)', color: '#18304d', 'font-size': 12, 'font-weight': 600, 'text-wrap': 'wrap', 'text-max-width': 116, 'text-valign': 'center', 'text-halign': 'center', width: 'label', height: 'label', padding: 14, shape: 'round-rectangle', 'overlay-opacity': 0 } },
    { selector: 'edge', style: { width: 2, 'line-color': '#9aabc0', 'target-arrow-color': '#71849d', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 1.1, 'overlay-opacity': 0 } },
    { selector: '.cycle-node', style: { 'background-color': '#fff0ed', 'border-color': '#c44635', 'border-width': 3, color: '#812d25' } },
    { selector: '.cycle-edge', style: { 'line-color': '#c44635', 'target-arrow-color': '#c44635', width: 3.5, 'line-style': 'dashed' } },
    { selector: '.order-node', style: { 'background-color': '#e8f3ff', 'border-color': '#2c6eae', 'border-width': 2.5 } },
    { selector: '.selected-node', style: { 'border-color': '#182c49', 'border-width': 4, 'z-index': 10 } },
    { selector: ':selected', style: { 'overlay-opacity': 0 } },
  ],
});

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 2800);
}

function taskById(id) { return tasks.find((task) => task.id === id); }

function persistAndRender(message) {
  let saveFailed = false;
  try { saveTasks(tasks); }
  catch { saveFailed = true; }
  currentAnalysis = analyzeGraph(tasks);
  if (!tasks.some((task) => task.id === selectedId)) selectedId = null;
  render();
  if (message) showToast(saveFailed ? `${message} · browser storage unavailable` : message);
}

function renderDependencyOptions() {
  const targetId = editingId;
  els.dependencies.replaceChildren();
  const candidates = tasks.filter((task) => task.id !== targetId).sort((a, b) => a.name.localeCompare(b.name));
  for (const task of candidates) {
    const option = document.createElement('option');
    option.value = task.id;
    option.textContent = `${task.name} · ${task.id}`;
    option.selected = Boolean(editingId && taskById(editingId)?.dependencies.includes(task.id));
    els.dependencies.append(option);
  }
  els.dependencies.disabled = candidates.length === 0;
}

function renderList() {
  els.taskList.replaceChildren();
  els.taskEmpty.classList.toggle('hidden', tasks.length > 0);
  els.taskList.classList.toggle('hidden', tasks.length === 0);
  els.listCount.textContent = String(tasks.length);
  els.listCaption.textContent = tasks.length ? `${tasks.length} in this project` : 'Start by adding a task';
  for (const task of tasks) {
    const item = document.createElement('li');
    item.className = `task-item${task.id === selectedId ? ' task-item-selected' : ''}`;
    const content = document.createElement('button');
    content.type = 'button';
    content.className = 'task-main';
    content.setAttribute('aria-label', `Select ${task.name}`);
    const marker = document.createElement('span');
    marker.className = 'task-marker';
    marker.textContent = currentAnalysis.cycle?.nodes.includes(task.id) ? '!' : '•';
    if (currentAnalysis.cycle?.nodes.includes(task.id)) marker.classList.add('marker-cycle');
    const copy = document.createElement('span');
    copy.className = 'task-copy';
    const title = document.createElement('strong'); title.textContent = task.name;
    const sub = document.createElement('small');
    const deps = task.dependencies.map((id) => taskById(id)?.name).filter(Boolean);
    sub.textContent = deps.length ? `After ${deps.join(', ')}` : 'No prerequisites';
    copy.append(title, sub);
    content.append(marker, copy);
    content.addEventListener('click', () => selectTask(task.id));
    const actions = document.createElement('span'); actions.className = 'task-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'mini-action'; edit.textContent = 'Edit'; edit.setAttribute('aria-label', `Edit ${task.name}`); edit.addEventListener('click', () => beginEdit(task.id));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'mini-action delete-action'; remove.textContent = '×'; remove.setAttribute('aria-label', `Delete ${task.name}`); remove.addEventListener('click', () => deleteTask(task.id));
    actions.append(edit, remove);
    item.append(content, actions);
    els.taskList.append(item);
  }
}

function renderGraph() {
  const elements = [];
  for (const task of tasks) elements.push({ data: { id: task.id, label: task.name } });
  for (const task of tasks) for (const prerequisite of task.dependencies) {
    elements.push({ data: { id: `edge:${JSON.stringify([prerequisite, task.id])}`, source: prerequisite, target: task.id } });
  }
  cy.elements().remove();
  if (elements.length) cy.add(elements);
  for (const node of cy.nodes()) {
    if (cycleHighlight && currentAnalysis.cycle?.nodes.includes(node.id())) node.addClass('cycle-node');
    if (orderHighlight && currentAnalysis.order.includes(node.id())) node.addClass('order-node');
    if (node.id() === selectedId) node.addClass('selected-node');
  }
  if (cycleHighlight && currentAnalysis.cycle) {
    for (const [source, target] of currentAnalysis.cycle.edges) {
      cy.edges().filter((edge) => edge.data('source') === source && edge.data('target') === target).addClass('cycle-edge');
    }
  }
  els.graphEmpty.classList.toggle('hidden', tasks.length > 0);
  cy.layout({ name: 'cose', animate: false, padding: 40, nodeRepulsion: 5200, idealEdgeLength: 130 }).run();
}

function renderResults() {
  const { cycle, order, stages } = currentAnalysis;
  els.order.replaceChildren(); els.stages.replaceChildren();
  const message = els.analysisMessage;
  message.className = `analysis-message ${cycle ? 'message-error' : tasks.length ? 'message-success' : ''}`;
  message.replaceChildren();
  const icon = document.createElement('span'); icon.className = 'message-icon'; icon.textContent = cycle ? '!' : tasks.length ? '✓' : 'i';
  const copy = document.createElement('p');
  if (cycle) {
    const labels = cycle.path.map((id) => taskById(id)?.name ?? id);
    copy.textContent = `Cycle detected: ${labels.join(' → ')}. A valid execution order cannot be generated.`;
  } else if (tasks.length) copy.textContent = 'No cycles found. All prerequisites can be completed in order.';
  else copy.textContent = 'Add tasks to calculate a valid order and parallel stages.';
  message.append(icon, copy);
  els.orderCount.textContent = cycle ? 'Blocked' : order.length ? `${order.length} tasks` : '—';
  els.stageCount.textContent = cycle ? 'Blocked' : stages.length ? `${stages.length} stages` : '—';
  els.orderEmpty.classList.toggle('hidden', order.length > 0);
  for (const [index, id] of order.entries()) {
    const item = document.createElement('li');
    const number = document.createElement('span'); number.className = 'order-number'; number.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('span'); name.textContent = taskById(id)?.name ?? id;
    item.append(number, name); els.order.append(item);
  }
  els.stagesEmpty.classList.toggle('hidden', stages.length > 0);
  for (const [index, stage] of stages.entries()) {
    const block = document.createElement('div'); block.className = 'stage-block';
    const head = document.createElement('div'); head.className = 'stage-label';
    const label = document.createElement('strong'); label.textContent = `Stage ${index + 1}`;
    const parallel = document.createElement('small'); parallel.textContent = stage.length > 1 ? `${stage.length} can run in parallel` : '1 task';
    head.append(label, parallel);
    const chips = document.createElement('div'); chips.className = 'stage-chips';
    for (const id of stage) { const chip = document.createElement('span'); chip.textContent = taskById(id)?.name ?? id; chips.append(chip); }
    block.append(head, chips); els.stages.append(block);
  }
}

function renderSummary() {
  const dependencies = tasks.reduce((sum, task) => sum + task.dependencies.length, 0);
  els.taskCount.textContent = String(tasks.length);
  els.dependencyCount.textContent = String(dependencies);
  els.cycleStatus.textContent = currentAnalysis.cycle ? 'Detected' : tasks.length ? 'No cycle' : 'Not checked';
  els.cycleStatus.className = `summary-state ${currentAnalysis.cycle ? 'text-danger' : ''}`;
  els.executionStatus.textContent = currentAnalysis.cycle ? 'Blocked' : currentAnalysis.order.length ? 'Plan ready' : 'Ready to plan';
  els.executionStatus.className = `summary-state ${currentAnalysis.cycle ? 'text-danger' : ''}`;
}

function renderSelected() {
  const task = taskById(selectedId);
  if (!task) { els.selectedDetails.textContent = 'Select a task to view details'; return; }
  const names = task.dependencies.map((id) => taskById(id)?.name).filter(Boolean);
  els.selectedDetails.textContent = `${task.name}${task.description ? ` — ${task.description}` : ''}${names.length ? ` · After: ${names.join(', ')}` : ' · No prerequisites'}`;
}

function render() {
  renderDependencyOptions(); renderSummary(); renderList(); renderGraph(); renderResults(); renderSelected();
}

function selectTask(id) {
  selectedId = id;
  cy.nodes().removeClass('selected-node');
  cy.getElementById(id).addClass('selected-node');
  renderList(); renderSelected();
}

function beginEdit(id) {
  const task = taskById(id);
  if (!task) return;
  editingId = id;
  els.id.value = task.id; els.id.disabled = true;
  els.name.value = task.name; els.description.value = task.description;
  renderDependencyOptions();
  for (const option of els.dependencies.options) option.selected = task.dependencies.includes(option.value);
  els.formHeading.textContent = 'Edit task'; els.submit.textContent = 'Save changes'; els.cancelEdit.classList.remove('hidden');
  els.formMessage.textContent = '';
  els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.name.focus({ preventScroll: true });
}

function resetForm() {
  editingId = null; els.form.reset(); els.id.disabled = false;
  els.formHeading.textContent = 'Add a task'; els.submit.textContent = '＋ Add task'; els.cancelEdit.classList.add('hidden');
  els.formMessage.textContent = ''; renderDependencyOptions();
}

function deleteTask(id) {
  const task = taskById(id);
  if (!task || !confirm(`Delete “${task.name}”? Any links to this task will also be removed.`)) return;
  tasks = tasks.filter((item) => item.id !== id).map((item) => ({ ...item, dependencies: item.dependencies.filter((dependency) => dependency !== id) }));
  if (editingId === id) resetForm();
  if (selectedId === id) selectedId = null;
  persistAndRender(`${task.name} deleted`);
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = els.id.value.trim();
  const name = els.name.value.trim();
  const description = els.description.value.trim();
  const dependencies = [...els.dependencies.selectedOptions].map((option) => option.value);
  const fail = (message, field) => { els.formMessage.textContent = message; field?.focus(); };
  els.formMessage.textContent = '';
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) return fail('Enter an ID using letters, numbers, hyphens, or underscores.', els.id);
  if (!name) return fail('Enter a task name before saving.', els.name);
  if (!editingId && tasks.some((task) => task.id === id)) return fail(`The ID “${id}” is already in use.`, els.id);
  if (dependencies.includes(id)) return fail('A task cannot depend on itself.', els.dependencies);
  const next = editingId
    ? tasks.map((task) => task.id === editingId ? { ...task, name, description, dependencies } : task)
    : [...tasks, { id, name, description, dependencies }];
  try { validateTasks(next); }
  catch (error) { return fail(error.message, els.dependencies); }
  const wasEditing = Boolean(editingId);
  tasks = next;
  resetForm();
  selectedId = id;
  persistAndRender(wasEditing ? 'Task updated' : 'Task added');
});

els.cancelEdit.addEventListener('click', resetForm);
$('#reset-button').addEventListener('click', () => {
  if (!confirm('Reset this project? All tasks saved in this browser will be deleted.')) return;
  tasks = []; selectedId = null; resetForm(); clearSavedTasks(); currentAnalysis = analyzeGraph(tasks); render(); showToast('Project reset');
});
$('#examples-button').addEventListener('click', () => els.examplesDialog.showModal());
els.examplesDialog.querySelectorAll('[data-example]').forEach((button) => button.addEventListener('click', () => {
  const label = button.dataset.example === 'cycle' ? 'Circular dependency' : 'Product launch';
  if (tasks.length && !confirm(`Replace the current project with “${label}”?`)) return;
  tasks = examples[button.dataset.example].map((task) => ({ ...task, dependencies: [...task.dependencies] }));
  selectedId = null; resetForm(); persistAndRender(`${label} example loaded`); els.examplesDialog.close();
}));
$('#fit-graph').addEventListener('click', () => cy.fit(undefined, 45));
$('#reset-view').addEventListener('click', () => { cy.layout({ name: 'cose', animate: false, padding: 40, nodeRepulsion: 5200, idealEdgeLength: 130 }).run(); cy.fit(undefined, 45); });
$('#toggle-cycles').addEventListener('click', (event) => { cycleHighlight = !cycleHighlight; event.currentTarget.setAttribute('aria-pressed', String(cycleHighlight)); renderGraph(); });
$('#toggle-order').addEventListener('click', (event) => { orderHighlight = !orderHighlight; event.currentTarget.setAttribute('aria-pressed', String(orderHighlight)); renderGraph(); });
cy.on('tap', 'node', (event) => selectTask(event.target.id()));
cy.on('tap', (event) => { if (event.target === cy) { selectedId = null; renderList(); renderSelected(); cy.nodes().removeClass('selected-node'); } });

if (loaded.recovered) showToast('Saved project data was invalid, so a blank project was opened.');
render();
