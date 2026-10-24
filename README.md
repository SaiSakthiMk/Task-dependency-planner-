# Task Dependency Planner - https://saisakthi-task-dependency-planner.vercel.app/

A local-first college project prototype for representing tasks as a directed graph, detecting cycles, and calculating a valid execution plan when one exists.

## Features

- Create, edit, and delete tasks with stable IDs, names, descriptions, and prerequisites.
- Interactive Cytoscape.js graph with directed prerequisite arrows, pan, zoom, selection, and cycle/order highlighting.
- Precise DFS cycle paths and deterministic Kahn topological ordering.
- Parallel stages grouped by longest prerequisite depth.
- Valid and circular sample workflows, responsive layout, and browser LocalStorage persistence.
- No backend, accounts, API keys, or remote data storage.

## Architecture

- `src/main.js` wires forms, rendering, examples, graph interaction, and persistence.
- `src/graph.js` validates graph data, detects cycles, sorts tasks, and computes stages.
- `src/storage.js` restores and saves versioned project data in LocalStorage.
- `src/style.css` contains the responsive visual system.
- `tests/graph.test.js` covers graph correctness with Node's built-in test runner.

## Graph model and algorithms

Each task has a stable ID and a list of prerequisite IDs. If task A is a prerequisite of task B, the visualization draws `A → B`.

Cycle detection uses depth-first search with unvisited, visiting, and visited states. An edge to a visiting node identifies a back edge; the active DFS stack gives the exact cycle path and its nodes/edges. It runs in `O(V + E)` time and uses `O(V + E)` space. The task editor prevents self-dependencies, while the graph algorithm still identifies a self-loop if one is present in graph data.

Execution order uses Kahn's algorithm: initialize each task's indegree from its prerequisite count, repeatedly take a zero-indegree task, and lower the indegree of its dependents. A min-heap chooses eligible tasks alphabetically by name and then ID for deterministic results. Graph processing is `O(V + E)`; deterministic tie-breaking adds `O(log V)` work per ready-queue operation. A cycle yields no order.

Parallel stages use each task's longest prerequisite depth. Tasks at one depth can be planned together after earlier stages complete. Stage computation is `O(V + E)` after ordering, excluding the same deterministic-ready-set sorting overhead. Stages are a planning aid; the application does not execute external jobs.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To check the project:

```sh
npm test
npm run build
```

## Demonstration

1. Choose **Load example → Product launch**. Design unlocks frontend and backend development in parallel, then integration testing and deployment.
2. Choose **Load example → Circular dependency**. The app shows the actual cycle path, highlights only its nodes and edges, and blocks the execution plan.
3. Use **Reset project** to return to a blank workspace. Add tasks with unique IDs and select prerequisites; each dependent task points from prerequisite to dependent.

## Limitations and future work

Project data is stored per browser and is not synchronized. The app is a planning tool, not a task runner. Possible extensions include importing/exporting project JSON, due dates, and resource-aware scheduling.
