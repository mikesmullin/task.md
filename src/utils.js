// utils.js
import crypto from 'crypto';

// Create deterministic hash from a canonical object of identity fields
export function computeDeterministicId(identityObj, len = 8) {
  const normalized = JSON.stringify(normalizeForHash(identityObj));
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, len);
}

function normalizeForHash(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeForHash);
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    const res = {};
    for (const k of keys) res[k] = normalizeForHash(obj[k]);
    return res;
  }
  return obj;
}

// Flatten tree to array
export function collectTasks(rootTasks) {
  const out = [];
  function rec(tasks, parentId = null) {
    for (const t of tasks) {
      const copy = t; // t is an object reference
      copy.parent = parentId;
      out.push(copy);
      if (t.children && t.children.length) rec(t.children, t.id);
    }
  }
  rec(rootTasks, null);
  return out;
}

// Resolve shorthand ID to full id (unique prefix)
export function resolveIdByPrefix(rootTasks, short) {
  const all = collectTasks(rootTasks);
  const matches = all.filter(t => t.id && t.id.startsWith(short));
  if (matches.length === 1) return matches[0].id;
  if (matches.length === 0) throw new Error(`No task id matching prefix '${short}'`);
  throw new Error(`Ambiguous id prefix '${short}' matches ${matches.length} tasks`);
}

// Deep-get for sort keys like 'some.nested' (but we store flat keys)
export function getSortValue(task, key) {
  if (key === 'parent') return task.parent ?? '';
  // direct property
  if (task.data?.hasOwnProperty(key)) return task.data[key];
  // fallback to top-level fields
  if (task.hasOwnProperty(key)) return task[key];
  return undefined;
}

// Multi-key sort helper
export function multiKeySort(tasks, keySpecArray) {
  const cmp = (a, b) => {
    for (const spec of keySpecArray) {
      const k = spec.key;
      const dir = spec.dir === 'desc' ? -1 : 1;
      const va = getSortValue(a, k);
      const vb = getSortValue(b, k);
      if (va === undefined && vb === undefined) continue;
      if (va === undefined) return -1 * dir;
      if (vb === undefined) return 1 * dir;
      // compare numbers vs strings
      if (typeof va === 'number' && typeof vb === 'number') {
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
      } else {
        const sa = String(va);
        const sb = String(vb);
        if (sa < sb) return -1 * dir;
        if (sa > sb) return 1 * dir;
      }
    }
    return 0;
  };
  tasks.sort(cmp);
}
