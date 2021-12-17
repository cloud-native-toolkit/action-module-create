// eslint-disable-next-line filenames/match-regex
export abstract class LoggerApi {
  abstract debug(message: string): void
  abstract info(message: string): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract error(message: string | Error, properties?: any): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract warning(message: string | Error, properties?: any): void
}
