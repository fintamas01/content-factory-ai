const DEFAULTS = {
  maxString: 1600,
  maxArray: 24,
  maxDepth: 5,
  maxKeys: 80,
  maxTotalChars: 14_000,
};

function clampString(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 20))}… (trimmed, ${s.length} chars)`;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== "object") return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

function safeJsonStringify(x: unknown) {
  try {
    return JSON.stringify(x);
  } catch {
    return null;
  }
}

export function trimCopilotContext<T>(input: T, opts?: Partial<typeof DEFAULTS>): T {
  const o = { ...DEFAULTS, ...(opts ?? {}) };
  let total = 0;

  const visit = (value: unknown, depth: number, keyBudget: { used: number }): unknown => {
    if (total > o.maxTotalChars) return "[trimmed: payload budget exceeded]";
    if (depth > o.maxDepth) return "[trimmed: depth]";
    if (value == null) return value;

    if (typeof value === "string") {
      const out = clampString(value, o.maxString);
      total += out.length;
      return out;
    }
    if (typeof value === "number" || typeof value === "boolean") return value;

    if (Array.isArray(value)) {
      const sliced = value.slice(0, o.maxArray);
      const out = sliced.map((v) => visit(v, depth + 1, keyBudget));
      if (value.length > o.maxArray) out.push(`[trimmed: +${value.length - o.maxArray} more]`);
      return out;
    }

    if (isPlainObject(value)) {
      const keys = Object.keys(value);
      const limitedKeys = keys.slice(0, Math.max(0, o.maxKeys - keyBudget.used));
      keyBudget.used += limitedKeys.length;

      const out: Record<string, unknown> = {};
      for (const k of limitedKeys) out[k] = visit(value[k], depth + 1, keyBudget);
      if (keys.length > limitedKeys.length) {
        out.__trimmed__ = `+${keys.length - limitedKeys.length} keys`;
      }
      return out;
    }

    // Dates, Maps, Sets, class instances, functions, etc.
    const json = safeJsonStringify(value);
    if (json) {
      const out = clampString(json, o.maxString);
      total += out.length;
      return out;
    }
    return String(value);
  };

  // Attempt to keep shape stable by trimming via deep walk.
  return visit(input, 0, { used: 0 }) as T;
}

