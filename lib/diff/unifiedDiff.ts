export type PatchFile = {
    path: string;
    before?: string; // optional old content
    after: string;   // new content
  };
  
  function splitLines(s: string) {
    return (s ?? "").replace(/\r\n/g, "\n").split("\n");
  }
  
  /**
   * Minimal unified diff generator (good enough for “wow UI” without dependencies).
   * If before is missing => treated as new file.
   */
  export function toUnifiedDiff(file: PatchFile) {
    const before = file.before ?? "";
    const after = file.after ?? "";
  
    const a = splitLines(before);
    const b = splitLines(after);
  
    // Very lightweight line diff (LCS-like but simplified)
    // For production you can swap to "diff" npm package later.
    const out: string[] = [];
  
    out.push(`diff --git a/${file.path} b/${file.path}`);
    out.push(`--- a/${file.path}`);
    out.push(`+++ b/${file.path}`);
  
    // If no before, mark as new file-ish
    if (!file.before) {
      out.push(`@@ -0,0 +1,${b.length} @@`);
      for (const line of b) out.push(`+${line}`);
      return out.join("\n");
    }
  
    // Simple heuristic diff:
    // find common prefix & suffix, mark middle as changed
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
  
    let endA = a.length - 1;
    let endB = b.length - 1;
    while (endA >= start && endB >= start && a[endA] === b[endB]) {
      endA--;
      endB--;
    }
  
    const removed = a.slice(start, endA + 1);
    const added = b.slice(start, endB + 1);
  
    const oldStart = start + 1;
    const oldCount = removed.length;
    const newStart = start + 1;
    const newCount = added.length;
  
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
  
    for (const line of removed) out.push(`-${line}`);
    for (const line of added) out.push(`+${line}`);
  
    // include some context around
    // (optional: if you want, we can include prefix/suffix context lines later)
  
    return out.join("\n");
  }
  
  export function patchBundleToUnifiedDiff(files: PatchFile[]) {
    return files.map(toUnifiedDiff).join("\n\n");
  }