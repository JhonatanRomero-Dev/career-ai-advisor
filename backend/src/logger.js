function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  };
}

function write(level, message, context = {}) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    service: "career-ai-backend",
    ...context
  };

  if (payload.error instanceof Error) {
    payload.error = serializeError(payload.error);
  }

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

function controllerError(message, context = {}) {
  const statusCode = Number(context.error?.statusCode || context.error?.status);
  const hasClientStatus = Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 500;

  write(hasClientStatus ? "warn" : "error", message, {
    ...context,
    status_code: Number.isFinite(statusCode) ? statusCode : undefined
  });
}

export const logger = {
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
  controllerError
};
