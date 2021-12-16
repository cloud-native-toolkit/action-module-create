import * as core from '@actions/core';

import {LoggerApi} from './logger.api';

export class ActionLogger implements LoggerApi {
  debug(message: string) {
    core.debug(message);
  }

  error(message: string | Error, properties?: any) {
    core.error(message, properties);
  }

  info(message: string) {
    core.info(message);
  }

  warning(message: string | Error, properties?: any) {
    core.warning(message, properties);
  }
}
