import {LoggerApi} from './logger.api'
import {Container} from 'typescript-ioc'
import {ConsoleLogger} from './logger.console'

export * from './logger.api'

Container.bind(LoggerApi).to(ConsoleLogger)
