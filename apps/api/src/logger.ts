type LogMetadata = Record<string, unknown>;

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY =
  /authorization|cookie|password|secret|token|api[_-]?key|database[_-]?url/i;

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Date)
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(nestedValue),
      ]),
    );
  }

  return value;
}

export function sanitizeLogMetadata(
  metadata: LogMetadata = {},
): LogMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(value),
    ]),
  );
}

function write(
  level: 'info' | 'error',
  event: string,
  metadata: LogMetadata = {},
): void {
  const safeMetadata = sanitizeLogMetadata(metadata);
  const payload = JSON.stringify({
    ...safeMetadata,
    timestamp: new Date().toISOString(),
    level,
    event,
  });

  if (level === 'error') {
    console.error(payload);
    return;
  }

  console.info(payload);
}

export const logger = {
  info(event: string, metadata?: LogMetadata): void {
    write('info', event, metadata);
  },
  error(event: string, metadata?: LogMetadata): void {
    write('error', event, metadata);
  },
};
