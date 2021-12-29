import {Octokit} from '@octokit/action'
import {ModuleRepo} from './module-repo'
import {LoggerApi} from '../util/logger'
import {Container} from 'typescript-ioc'

interface TemplateRepo {
  template_owner: string
  template_repo: string
}

const templateRepos: {[type: string]: TemplateRepo} = {
  gitops: {
    template_owner: 'cloud-native-toolkit',
    template_repo: 'template-terraform-gitops'
  },
  terraform: {
    template_owner: 'cloud-native-toolkit',
    template_repo: 'template-terraform-module'
  }
}

interface NameAndDescription {
  name: string
  description: string
}

const buildNameAndDescription = (
  repoType: string,
  baseName: string,
  provider?: string
): NameAndDescription => {
  return {
    name: buildName(repoType, baseName, provider),
    description: buildDescription(repoType, baseName, provider)
  }
}

const buildName = (
  repoType: string,
  baseName: string,
  provider?: string
): string => {
  if (repoType === 'gitops') {
    return `terraform-gitops-${baseName}`
  }

  if (provider) {
    return `terraform-${provider}-${baseName}`
  }

  return `terraform-any-${baseName}`
}

const buildDescription = (
  repoType: string,
  baseName: string,
  provider?: string
): string => {
  if (repoType === 'gitops') {
    return `Module tp populate a gitops repo with the resources to provision ${baseName}`
  }

  if (provider) {
    return `Module to provision ${baseName} on ${provider}`
  }

  return `Module to provision ${baseName}`
}

export interface ModuleServiceParams {
  octokit: Octokit
  repoCredentials: {username: string; password: string}
  repoType: string
  owner: string
  baseName: string
  provider?: string
  strict?: boolean
  softwareProvider?: string
}

export class ModuleService {
  async run({
    octokit,
    repoCredentials,
    repoType,
    baseName,
    provider,
    owner,
    strict,
    softwareProvider
  }: ModuleServiceParams): Promise<{
    repoUrl: string
    owner: string
    repo: string
  }> {
    const logger: LoggerApi = Container.get(LoggerApi)

    const logWarning = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: any
    ): void => {
      logger.warning(error.message)
    }

    const templateRepo: TemplateRepo = this.getTemplateRepo(repoType)

    const {name, description} = buildNameAndDescription(
      repoType,
      baseName,
      provider
    )

    const repo: ModuleRepo = await ModuleRepo.createFromTemplate({
      octokit,
      templateRepo,
      owner,
      name,
      description,
      strict
    })

    await repo.updateSettings()

    await repo.addDefaultLabels().catch(logWarning)

    await repo.createPagesSite()

    const repoUrl = `https://github.com/${owner}/${name}`

    await repo
      .updateMetadata({
        repoUrl,
        repoCredentials,
        name,
        type: repoType,
        cloudProvider: provider,
        softwareProvider
      })
      .catch(logWarning)

    await repo.addBranchProtection().catch(logWarning)

    await repo.createInitialRelease().catch(logWarning)

    return {repoUrl, owner, repo: name}
  }

  private getTemplateRepo(repoType: string): TemplateRepo {
    const templateRepo: TemplateRepo | undefined = templateRepos[repoType]

    if (!templateRepo) {
      throw new Error(
        `Invalid repo type provided. Only 'gitops' and 'terraform' are supported. (${repoType})`
      )
    }

    return templateRepo
  }
}
