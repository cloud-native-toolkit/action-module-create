import * as core from '@actions/core'
import {AnnotationProperties} from '@actions/core'

import {LoggerApi} from './logger.api'

export class ActionLogger implements LoggerApi {
  debug(message: string): void {
    core.debug(message)
  }

  error(message: string | Error, properties?: AnnotationProperties): void {
    core.error(message, properties)
  }

  info(message: string): void {
    core.info(message)
  }

  warning(message: string | Error, properties?: AnnotationProperties): void {
    core.warning(message, properties)
  }
}
