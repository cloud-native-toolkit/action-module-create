import * as core from '@actions/core'
import * as github from '@actions/github'
import {Octokit} from '@octokit/action'
import {Container} from 'typescript-ioc'
import {ModuleService} from './services'
import {LoggerApi} from './util/logger'
import {ActionLogger} from './util/logger/logger.action'

async function run(): Promise<void> {
  try {
    Container.bind(LoggerApi).to(ActionLogger)

    const token: string = core.getInput('token')
    const repoType: string = core.getInput('type')
    const owner: string = core.getInput('owner')
    const baseName: string = core.getInput('name')
    const provider: string = core.getInput('provider')
    const strict: boolean = core.getBooleanInput('strict')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const octokit: Octokit = github.getOctokit(token) as any

    const service: ModuleService = new ModuleService()
    const {repoUrl, repo} = await service.run({
      octokit,
      repoCredentials: {username: '', password: token},
      repoType,
      owner,
      baseName,
      provider,
      strict
    })

    core.setOutput('repo_url', repoUrl)
    core.setOutput('owner', owner)
    core.setOutput('repo', repo)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run().catch(error => core.error(error.message))
