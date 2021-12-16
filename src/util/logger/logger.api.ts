
export abstract class LoggerApi {
  abstract debug(message: string): void;
  abstract info(message: string): void;
  abstract error(message: string | Error, properties?: any): void;
  abstract warning(message: string | Error, properties?: any): void;
}
