/**
 * Logger config for Suspect-X.
 *
 * winston 3.3.3
 */

const winston = require('winston');
const os = require('os');
const path = require('path');
const moment = require('moment');

/* Log Config*/
const tmp = os.tmpdir();

module.exports = function(callModule) {
  return winston.createLogger({
    level: 'info',
    transports: [
      new winston.transports.Console({
        name: 'console',
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
        ),
        // silent: process.env.NODE_ENV === 'testing',
        silent: process.env.NODE_ENV === 'testing'
      }),
      new winston.transports.File({
        filename: path.join(tmp, 'ACCUiNspection_' + moment(new Date()).format('YYYYMMDD'), 'ACCUiNspection.log'),
      }),
    ],
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.splat(),
      winston.format.printf(({ timestamp, level, message, label }) => {
        let print_level = level.toUpperCase();
        let print_message = typeof(message) === 'object'? JSON.stringify(message) : message;
        if (label) {
          return `${timestamp} | ${print_level} | ${callModule.id} | ${label}: ${print_message} `
        }
        else {
          return `${timestamp} | ${print_level} | ${callModule.id} | ${print_message} `
        }
      }),
    )
  });
}
