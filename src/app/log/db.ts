// db.ts — lightweight log store with category-based filtering
export type LogLevel = 'info' | 'error';

export interface LogRecord {
  id: number;
  category: string;
  message: string;
  level: LogLevel;
  timestamp: number;
  data?: unknown[];
}

type LogListener = (records: ReadonlyArray<LogRecord>) => void;

const MAX_RECORDS = 500;
const records: LogRecord[] = [];
const listeners = new Set<LogListener>();
const categories = new Set<string>();

let initialized = false;
let nextId = 1;

export function initLogging(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  log('init', 'Application starting');

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    log('error', args.map(formatArg).join(' '), { level: 'error', data: args });
    originalError(...args);
  };

  window.addEventListener('error', (event) => {
    const message = event.message || 'Unknown script error';
    log('error', `${message} (${event.filename ?? 'unknown'}:${event.lineno ?? 0})`, {
      level: 'error',
      data: [event.error ?? message],
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason ?? 'Unknown reason';
    log('error', `Unhandled rejection: ${formatArg(reason)}`, {
      level: 'error',
      data: [reason],
    });
  });
}

export function log(
  category: string,
  message: string,
  options: { level?: LogLevel; data?: unknown[]; timestamp?: number } = {},
): void {
  const level = options.level ?? 'info';
  categories.add(category);

  const record: LogRecord = {
    id: nextId++,
    category,
    message,
    level,
    timestamp: options.timestamp ?? Date.now(),
    data: options.data,
  };

  records.push(record);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }

  const snapshot = records.slice();
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribe(listener: LogListener): () => void {
  listeners.add(listener);
  listener(records.slice());
  return () => {
    listeners.delete(listener);
  };
}

export function getCategories(): ReadonlyArray<string> {
  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

function formatArg(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
