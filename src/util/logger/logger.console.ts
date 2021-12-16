// eslint-disable-next-line filenames/match-regex
import {LoggerApi} from './logger.api'

export class ConsoleLogger implements LoggerApi {
  debug(message: string): void {
    // eslint-disable-next-line no-console
    console.log(`DEBUG: ${message}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: string | Error, properties?: any): void {
    // eslint-disable-next-line no-console
    console.log(`ERROR: ${message}`, properties)
  }

  info(message: string): void {
    // eslint-disable-next-line no-console
    console.log(`INFO:  ${message}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warning(message: string | Error, properties?: any): void {
    // eslint-disable-next-line no-console
    console.log(`WARN:  ${message}`, properties)
  }
}
