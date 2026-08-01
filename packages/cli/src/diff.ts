/**
 * Minimal unified diff for a single file.
 */
export function unifiedDiff(
  filePath: string,
  original: string,
  next: string,
): string {
  const a = original.split("\n");
  const b = next.split("\n");
  const lines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ];

  // Simple LCS-free line diff: emit hunks for contiguous changes
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    const startI = i;
    const startJ = j;
    while (i < a.length && (j >= b.length || a[i] !== b[j])) {
      // look ahead for resync
      let found = -1;
      for (let k = j; k < Math.min(j + 40, b.length); k++) {
        if (a[i] === b[k]) {
          found = k;
          break;
        }
      }
      if (found !== -1 && found !== j) {
        break;
      }
      i++;
    }
    while (j < b.length && (startI >= a.length || (i < a.length ? b[j] !== a[i] : true))) {
      let found = -1;
      for (let k = startI; k < Math.min(i + 1, a.length); k++) {
        // keep simple
      }
      if (i < a.length && b[j] === a[i]) {
        break;
      }
      // if remaining equal prefix
      if (i >= a.length) {
        j = b.length;
        break;
      }
      // advance j until match current a[i] or end
      const target = a[i];
      let k = j;
      while (k < b.length && b[k] !== target) {
        k++;
      }
      if (k === j) {
        break;
      }
      j = k;
      break;
    }

    // Fallback simple: dump remaining as remove+add once
    if (startI === i && startJ === j) {
      if (i < a.length) {
        i++;
      } else if (j < b.length) {
        j++;
      }
    }

    const removed = a.slice(startI, i);
    const added = b.slice(startJ, j);
    if (removed.length === 0 && added.length === 0) {
      if (i < a.length) {
        i++;
      }
      if (j < b.length) {
        j++;
      }
      continue;
    }
    lines.push(`@@ -${startI + 1},${Math.max(removed.length, 1)} +${startJ + 1},${Math.max(added.length, 1)} @@`);
    for (const line of removed) {
      lines.push(`-${line}`);
    }
    for (const line of added) {
      lines.push(`+${line}`);
    }
  }

  return lines.join("\n");
}

/**
 * Very small structural diff that lists changed lines by index.
 * Reliable for CLI output without external deps.
 */
export function lineDiff(filePath: string, original: string, next: string): string {
  const a = original.split("\n");
  const b = next.split("\n");
  const out: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];
  const max = Math.max(a.length, b.length);
  let hunk: string[] = [];
  let hunkStart = 0;

  const flush = () => {
    if (hunk.length === 0) {
      return;
    }
    out.push(`@@ around line ${hunkStart + 1} @@`);
    out.push(...hunk);
    hunk = [];
  };

  for (let i = 0; i < max; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) {
      flush();
      continue;
    }
    if (hunk.length === 0) {
      hunkStart = i;
    }
    if (left !== undefined) {
      hunk.push(`-${left}`);
    }
    if (right !== undefined) {
      hunk.push(`+${right}`);
    }
  }
  flush();
  return out.join("\n");
}
