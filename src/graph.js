/** Validate the graph's stored shape and all references before analysis. */
export function validateTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error('Tasks must be a list.');
  const ids = new Set();
  for (const task of tasks) {
    if (!task || typeof task.id !== 'string' || !task.id.trim()) throw new Error('Every task needs an ID.');
    if (ids.has(task.id)) throw new Error(`Duplicate task ID: ${task.id}`);
    ids.add(task.id);
    if (typeof task.name !== 'string' || !task.name.trim()) throw new Error(`Task ${task.id} needs a name.`);
    if (!Array.isArray(task.dependencies)) throw new Error(`Dependencies for ${task.id} must be a list.`);
    if (new Set(task.dependencies).size !== task.dependencies.length) throw new Error(`Task ${task.id} has a duplicate prerequisite.`);
  }
  for (const task of tasks) {
    for (const dependency of task.dependencies) if (!ids.has(dependency)) throw new Error(`Task ${task.id} refers to missing prerequisite ${dependency}.`);
  }
  return true;
}

/** DFS with unvisited / visiting / visited states; only the back-edge cycle is returned. */
export function detectCycle(tasks) {
  validateTasks(tasks);
  const outgoing = new Map(tasks.map(({ id }) => [id, []]));
  for (const task of tasks) for (const dependency of task.dependencies) outgoing.get(dependency).push(task.id);
  const state = new Map();
  const stack = [];
  const stackIndex = new Map();
  let cycle = null;

  const visit = (id) => {
    state.set(id, 1);
    stackIndex.set(id, stack.length);
    stack.push(id);
    for (const next of outgoing.get(id)) {
      if (!state.has(next)) {
        if (visit(next)) return true;
      } else if (state.get(next) === 1) {
        const path = [...stack.slice(stackIndex.get(next)), next];
        cycle = { path, nodes: [...new Set(path)], edges: path.slice(0, -1).map((source, index) => [source, path[index + 1]]) };
        return true;
      }
    }
    stack.pop();
    stackIndex.delete(id);
    state.set(id, 2);
    return false;
  };

  for (const { id } of tasks) if (!state.has(id) && visit(id)) break;
  return cycle;
}

/** Kahn's algorithm; simultaneous eligible tasks are chosen by name, then ID. */
export function topologicalSort(tasks) {
  validateTasks(tasks);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const indegree = new Map(tasks.map(({ id, dependencies }) => [id, dependencies.length]));
  const outgoing = new Map(tasks.map(({ id }) => [id, []]));
  for (const task of tasks) for (const dependency of task.dependencies) outgoing.get(dependency).push(task.id);
  const compare = (left, right) => byId.get(left).name.localeCompare(byId.get(right).name) || left.localeCompare(right);
  const ready = [];
  const push = (id) => {
    let index = ready.length;
    ready.push(id);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compare(ready[parent], id) <= 0) break;
      ready[index] = ready[parent];
      index = parent;
    }
    ready[index] = id;
  };
  const pop = () => {
    const first = ready[0];
    const last = ready.pop();
    if (ready.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= ready.length) break;
        const child = right < ready.length && compare(ready[right], ready[left]) < 0 ? right : left;
        if (compare(last, ready[child]) <= 0) break;
        ready[index] = ready[child];
        index = child;
      }
      ready[index] = last;
    }
    return first;
  };
  for (const { id } of tasks) if (indegree.get(id) === 0) push(id);
  const order = [];
  while (ready.length) {
    const id = pop();
    order.push(id);
    for (const next of outgoing.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) {
        push(next);
      }
    }
  }
  return order.length === tasks.length ? order : [];
}

/** Stages are the longest prerequisite depth, so tasks at one depth are parallelizable. */
export function computeStages(tasks) {
  validateTasks(tasks);
  const order = topologicalSort(tasks);
  if (order.length !== tasks.length) return [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const depth = new Map();
  for (const id of order) {
    const prerequisites = byId.get(id).dependencies;
    let level = 0;
    for (const dependency of prerequisites) level = Math.max(level, depth.get(dependency) + 1);
    depth.set(id, level);
  }
  const stages = [];
  for (const id of order) {
    const stage = depth.get(id);
    (stages[stage] ??= []).push(id);
  }
  return stages;
}

export function analyzeGraph(tasks) {
  validateTasks(tasks);
  const cycle = detectCycle(tasks);
  if (cycle) return { cycle, order: [], stages: [] };
  const order = topologicalSort(tasks);
  return { cycle: null, order, stages: computeStages(tasks) };
}
