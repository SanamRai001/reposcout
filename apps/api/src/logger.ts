type LogMetadata = Record<string, unknown>;

function write(
  level: 'info' | 'error',
  event: string,
  metadata: LogMetadata = {},
): void {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...metadata,
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
