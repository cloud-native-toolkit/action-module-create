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
    const displayName: string = core.getInput('displayName')
    const provider: string = core.getInput('provider')
    const softwareProvider: string = core.getInput('softwareProvider')
    const strict: boolean = core.getBooleanInput('strict')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const octokit: Octokit = github.getOctokit(token) as any

    const service: ModuleService = new ModuleService()
    const {repoUrl, repo, moduleName} = await service.run({
      octokit,
      repoCredentials: {username: '', password: token},
      repoType,
      owner,
      baseName,
      provider,
      softwareProvider,
      strict
    })

    core.setOutput('repo_url', repoUrl)
    core.setOutput('repoUrl', repoUrl)
    core.setOutput('owner', owner)
    core.setOutput('repo', repo)
    core.setOutput('moduleName', moduleName)
    core.setOutput('displayName', displayName)
    core.setOutput('cloudProvider', provider)
    core.setOutput('softwareProvider', softwareProvider)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run().catch(error => core.error(error.message))
