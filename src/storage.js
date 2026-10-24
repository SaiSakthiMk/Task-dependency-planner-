import { validateTasks } from './graph.js';

const STORAGE_KEY = 'task-dependency-planner:v1';

export function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: [], recovered: false };
    const parsed = JSON.parse(raw);
    const tasks = Array.isArray(parsed) ? parsed : parsed?.version === 1 && Array.isArray(parsed.tasks) ? parsed.tasks : null;
    if (!tasks) throw new Error('Unsupported saved format.');
    validateTasks(tasks);
    const cleaned = tasks.map(({ id, name, description = '', dependencies }) => ({
      id, name: name.trim(), description: typeof description === 'string' ? description : '', dependencies: [...dependencies],
    }));
    return { tasks: cleaned, recovered: false };
  } catch {
    return { tasks: [], recovered: true };
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
}

export function clearSavedTasks() {
  localStorage.removeItem(STORAGE_KEY);
}
