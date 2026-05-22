const pino = require('pino');

const logger = pino({
  level: 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      }
    : undefined,
});

module.exports = logger;
