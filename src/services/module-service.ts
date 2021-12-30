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
  moduleName: string
}

const buildNameAndDescription = (
  repoType: string,
  baseName: string,
  provider?: string
): NameAndDescription => {
  const {name, moduleName} = buildName(repoType, baseName, provider)
  return {
    name,
    moduleName,
    description: buildDescription(repoType, baseName, provider)
  }
}

const buildName = (
  repoType: string,
  baseName: string,
  provider?: string
): {name: string; moduleName: string} => {
  if (repoType === 'gitops') {
    return {
      name: `terraform-gitops-${baseName}`,
      moduleName: `gitops-${baseName}`
    }
  }

  if (provider) {
    return {
      name: `terraform-${provider}-${baseName}`,
      moduleName: `${provider}-${baseName}`
    }
  }

  return {
    name: `terraform-any-${baseName}`,
    moduleName: baseName
  }
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
    moduleName: string
    cloudProvider?: string
    softwareProvider?: string
  }> {
    const logger: LoggerApi = Container.get(LoggerApi)

    const logWarning = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: any
    ): void => {
      logger.warning(error.message)
    }

    const templateRepo: TemplateRepo = this.getTemplateRepo(repoType)

    const {name, description, moduleName} = buildNameAndDescription(
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
        name: moduleName,
        baseName,
        type: repoType,
        cloudProvider: provider,
        softwareProvider
      })
      .catch(logWarning)

    await repo.addBranchProtection().catch(logWarning)

    await repo.createInitialRelease().catch(logWarning)

    return {
      repoUrl,
      owner,
      repo: name,
      moduleName,
      cloudProvider: provider,
      softwareProvider
    }
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
