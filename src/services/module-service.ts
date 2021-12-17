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
  repoType: string
  owner: string
  baseName: string
  provider?: string
}

export class ModuleService {
  async run({
    octokit,
    repoType,
    baseName,
    provider,
    owner
  }: ModuleServiceParams): Promise<{repoUrl: string}> {
    const logger: LoggerApi = Container.get(LoggerApi)

    const templateRepo: TemplateRepo = this.getTemplateRepo(repoType)

    const {name, description} = buildNameAndDescription(
      repoType,
      baseName,
      provider
    )

    const repo: ModuleRepo = await ModuleRepo.createFromTemplate(
      octokit,
      templateRepo,
      owner,
      name,
      description
    )

    await repo.updateSettings()

    await repo.addDefaultLabels()

    await repo.createPagesSite()

    try {
      await repo.addBranchProtection()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      logger.warning(error.message)
    }

    await repo.createInitialRelease()

    return {repoUrl: `https://github.com/${owner}/${name}`}
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
