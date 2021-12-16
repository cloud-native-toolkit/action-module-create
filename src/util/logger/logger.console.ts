import {LoggerApi} from './logger.api';

export class ConsoleLogger implements LoggerApi {
  debug(message: string) {
    console.log('DEBUG: ' + message);
  }

  error(message: string | Error, properties?: any) {
    console.log('ERROR: ' + message, properties);
  }

  info(message: string) {
    console.log('INFO:  ' + message);
  }

  warning(message: string | Error, properties?: any) {
    console.log('WARN:  ' + message, properties);
  }
}
