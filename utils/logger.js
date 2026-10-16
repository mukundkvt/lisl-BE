import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logs directory
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (stack) log += `\n${stack}`;
    if (Object.keys(meta).length > 0) {
      log += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// Console format
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (stack) log += `\n${stack}`;
    return log;
  })
);

// === Transports ===
const generalLogTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  level: 'info',
});

const errorLogTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'error',
});

const accessLogTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '7d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  level: 'info',
});

const dbLogTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'database-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  level: 'info',
});

const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
});

// === Loggers ===
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'clinic-management' },
  transports: [generalLogTransport, errorLogTransport, consoleTransport],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: logFormat,
    }),
    consoleTransport,
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: logFormat,
    }),
    consoleTransport,
  ],
});

const accessLogger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'api-access' },
  transports: [accessLogTransport, consoleTransport],
});

const dbLogger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'database' },
  transports: [dbLogTransport, consoleTransport],
});

// === Helper functions ===
export const info = (message, meta = {}) => logger.info(message, meta);
export const warn = (message, meta = {}) => logger.warn(message, meta);
export const error = (message, err = null, meta = {}) => {
  if (err instanceof Error) {
    logger.error(message, {
      ...meta,
      error: err.message,
      stack: err.stack,
    });
  } else {
    logger.error(message, meta);
  }
};
export const debug = (message, meta = {}) => logger.debug(message, meta);

export const logRequest = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    responseTime: `${duration}ms`,
    userId: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString(),
  };

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const body = { ...req.body };
    delete body.password;
    delete body.token;
    delete body.refreshToken;
    logData.requestBody = body;
  }

  accessLogger.info('API Request', logData);
};

export const logDbOperation = (operation, collection, data = {}) => {
  dbLogger.info(`Database ${operation}`, {
    operation,
    collection,
    ...data,
  });
};

export const logDbError = (operation, collection, error, data = {}) => {
  dbLogger.error(`Database ${operation} failed`, {
    operation,
    collection,
    error: error.message,
    stack: error.stack,
    ...data,
  });
};

export const logUserAction = (userId, action, details = {}) => {
  logger.info('User Action', {
    userId,
    action,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export const logSecurityEvent = (event, details = {}) => {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export const logPerformance = (operation, duration, details = {}) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger[level]('Performance', {
    operation,
    duration: `${duration}ms`,
    ...details,
  });
};

// Export raw loggers if needed
export { logger, accessLogger, dbLogger };
