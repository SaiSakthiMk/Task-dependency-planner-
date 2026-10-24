import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGraph, computeStages, detectCycle, topologicalSort, validateTasks } from '../src/graph.js';

const task = (id, name = id, dependencies = []) => ({ id, name, description: '', dependencies });
const positions = (order) => new Map(order.map((id, index) => [id, index]));

test('empty graph has an empty valid plan', () => {
  assert.deepEqual(analyzeGraph([]), { cycle: null, order: [], stages: [] });
});

test('single task appears once in the only stage', () => {
  const tasks = [task('a')];
  assert.deepEqual(topologicalSort(tasks), ['a']);
  assert.deepEqual(computeStages(tasks), [['a']]);
});

test('simple chain preserves prerequisites and creates one task per stage', () => {
  const tasks = [task('c', 'C', ['b']), task('b', 'B', ['a']), task('a', 'A')];
  const order = topologicalSort(tasks);
  const position = positions(order);
  assert.ok(position.get('a') < position.get('b') && position.get('b') < position.get('c'));
  assert.deepEqual(computeStages(tasks), [['a'], ['b'], ['c']]);
});

test('branching dependencies keep independent work parallel', () => {
  const tasks = [task('d', 'Integration', ['b', 'c']), task('b', 'Frontend', ['a']), task('c', 'Backend', ['a']), task('a', 'Design')];
  assert.deepEqual(computeStages(tasks), [['a'], ['c', 'b'], ['d']]);
});

test('disconnected tasks are all eligible in the first stage', () => {
  const tasks = [task('b', 'Beta'), task('a', 'Alpha'), task('c', 'Gamma')];
  assert.deepEqual(computeStages(tasks), [['a', 'b', 'c']]);
});

test('simultaneous choices are deterministic by name then ID', () => {
  assert.deepEqual(topologicalSort([task('z', 'Same'), task('b', 'Same'), task('a', 'Alpha')]), ['a', 'b', 'z']);
});

test('two-task cycle returns a path and no order', () => {
  const result = analyzeGraph([task('a', 'A', ['b']), task('b', 'B', ['a'])]);
  assert.ok(result.cycle);
  assert.deepEqual(result.order, []);
  assert.equal(result.cycle.path.length, 3);
  assert.equal(result.cycle.path[0], result.cycle.path.at(-1));
  assert.equal(result.cycle.edges.length, 2);
});

test('three-task cycle highlights only the actual cycle', () => {
  const tasks = [task('a', 'A', ['c']), task('b', 'B', ['a']), task('c', 'C', ['b']), task('down', 'Downstream', ['c'])];
  const cycle = detectCycle(tasks);
  assert.deepEqual(new Set(cycle.nodes), new Set(['a', 'b', 'c']));
  assert.ok(!cycle.nodes.includes('down'));
  assert.deepEqual(topologicalSort(tasks), []);
});

test('self-loop is detected as a cycle', () => {
  const cycle = detectCycle([task('a', 'A', ['a'])]);
  assert.deepEqual(cycle.path, ['a', 'a']);
  assert.deepEqual(cycle.edges, [['a', 'a']]);
  assert.deepEqual(topologicalSort([task('a', 'A', ['a'])]), []);
});

test('Kahn ordering includes every task exactly once', () => {
  const tasks = [task('a'), task('b', 'B', ['a']), task('c', 'C', ['a']), task('d', 'D', ['b', 'c'])];
  const order = topologicalSort(tasks);
  assert.equal(order.length, tasks.length);
  assert.equal(new Set(order).size, tasks.length);
  const position = positions(order);
  for (const item of tasks) for (const dependency of item.dependencies) assert.ok(position.get(dependency) < position.get(item.id));
});

test('invalid and missing dependency references are rejected', () => {
  assert.throws(() => validateTasks([task('a', 'A', ['missing'])]), /missing prerequisite/);
  assert.throws(() => validateTasks([task('a'), task('a')]), /Duplicate task ID/);
  assert.throws(() => validateTasks([task('a', '  ')]), /needs a name/);
});
