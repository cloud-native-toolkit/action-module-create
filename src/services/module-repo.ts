import {Octokit, RestEndpointMethodTypes} from '@octokit/action'
// eslint-disable-next-line import/named
import {default as pLimit, LimitFunction} from 'p-limit'
import {LoggerApi} from '../util/logger'
import {Container} from 'typescript-ioc'
import {
  BranchProtectionError,
  BranchProtectionErrors,
  isBranchProtectionError,
  isExistingRepoError
} from './errors'
import {
  apiFromUrl,
  GitApi,
  SimpleGitWithApi
} from '@cloudnativetoolkit/git-client'
import {YamlFile} from '../util/yaml-file/yaml-file'
import {ModuleMetadataModel} from '../models/module-metadata.model'

type CreateUsingTemplateParams =
  RestEndpointMethodTypes['repos']['createUsingTemplate']['parameters']
type UpdateRepoParams = RestEndpointMethodTypes['repos']['update']['parameters']
type CreateReleaseParams =
  RestEndpointMethodTypes['repos']['createRelease']['parameters']
type CreatePagesSiteParams =
  RestEndpointMethodTypes['repos']['createPagesSite']['parameters']
type CreateLabelParams =
  RestEndpointMethodTypes['issues']['createLabel']['parameters']

export interface TemplateRepo {
  template_owner: string
  template_repo: string
}

interface BranchRuleCheckCheck {
  context: string
  app_id?: number
}

interface BranchRuleCheck {
  strict: boolean
  contexts: string[]
  checks: BranchRuleCheckCheck[]
}

interface BranchProtection {
  branch: string
  required_status_checks?: BranchRuleCheck
}

interface Label {
  name: string
  description: string
  color: string
}

export interface CreateFromTemplateParams {
  octokit: Octokit
  templateRepo: TemplateRepo
  owner: string
  name: string
  description: string
  strict?: boolean
}

export interface UpdateMetadataParams {
  repoUrl: string
  repoCredentials: {
    username: string
    password: string
  }
  name: string
  type: string
  cloudProvider?: string
  softwareProvider?: string
}

export class ModuleRepo {
  private readonly limit: LimitFunction
  private logger: LoggerApi

  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly octokit: Octokit
  ) {
    this.limit = pLimit(1)
    this.logger = Container.get(LoggerApi)
  }

  static async createFromTemplate({
    octokit,
    templateRepo,
    owner,
    name,
    description,
    strict
  }: CreateFromTemplateParams): Promise<ModuleRepo> {
    const logger: LoggerApi = Container.get(LoggerApi)

    const createParams: CreateUsingTemplateParams = {
      template_owner: templateRepo.template_owner,
      template_repo: templateRepo.template_repo,
      owner,
      name,
      description,
      private: false,
      include_all_branches: true
    }

    // See https://docs.github.com/en/rest/reference/repos#create-a-repository-using-a-template
    logger.info(
      `Creating repo ${owner}/${name} from template ${templateRepo.template_owner}/${templateRepo.template_repo}`
    )
    try {
      await octokit.request(
        'POST /repos/{template_owner}/{template_repo}/generate',
        createParams
      )

      return new ModuleRepo(owner, name, octokit)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (!strict && isExistingRepoError(error)) {
        return new ModuleRepo(owner, name, octokit)
      }

      throw error
    }
  }

  async updateSettings(): Promise<void> {
    const updateParams: UpdateRepoParams = {
      owner: this.owner,
      repo: this.repo,
      allow_merge_commit: false,
      allow_auto_merge: true,
      delete_branch_on_merge: true
    }

    // See https://docs.github.com/en/rest/reference/repos#update-a-repository
    this.logger.info(`Updating repo ${this.owner}/${this.repo}`)
    await this.octokit.request('PATCH /repos/{owner}/{repo}', updateParams)
  }

  async addBranchProtection(): Promise<void> {
    const updateBranchProtectionLimiter = (
      octokit: Octokit,
      limit: LimitFunction,
      target: {owner: string; repo: string}
    ) => {
      return async (rule: BranchProtection) => {
        return limit(async () => updateBranchProtection(octokit, target, rule))
      }
    }

    const updateBranchProtection = async (
      octokit: Octokit,
      target: {owner: string; repo: string},
      rule: BranchProtection
    ): Promise<unknown> => {
      const params = Object.assign({}, target, rule, {
        enforce_admins: true,
        required_pull_request_reviews: null,
        restrictions: {
          users: [],
          teams: [],
          apps: []
        }
      })

      this.logger.info(
        `  Updating branch protection for ${params.branch} branch`
      )
      return octokit
        .request(
          'PUT /repos/{owner}/{repo}/branches/{branch}/protection',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          params as any
        )
        .catch(error => {
          throw new BranchProtectionError(params.branch, error)
        })
    }

    // Set https://docs.github.com/en/rest/reference/branches#update-branch-protection
    this.logger.info(
      `Updating branch protection for repo ${this.owner}/${this.repo}`
    )
    const branchRules: BranchProtection[] = [
      {
        branch: 'gh-pages'
      },
      {
        branch: 'main',
        required_status_checks: {
          strict: true,
          contexts: ['verifyMetadata', 'verify (ocp4_latest)'],
          checks: [
            {context: 'verifyMetadata'},
            {context: 'verify (ocp4_latest)'}
          ]
        }
      }
    ]
    const result = await Promise.all(
      branchRules
        .map(
          updateBranchProtectionLimiter(this.octokit, this.limit, {
            owner: this.owner,
            repo: this.repo
          })
        )
        .map(async (p: Promise<unknown>) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          p.catch(async (error: any) => Promise.resolve(error))
        )
    )

    const errors: BranchProtectionError[] = result.filter(
      isBranchProtectionError
    )
    if (errors.length > 0) {
      throw new BranchProtectionErrors(errors)
    }
  }

  async addDefaultLabels(): Promise<void> {
    const createLabelLimiter = (
      octokit: Octokit,
      limit: LimitFunction,
      target: {owner: string; repo: string}
    ) => {
      return async (label: Label) => {
        return limit(async () => createLabel(octokit, target, label))
      }
    }

    const createLabel = async (
      octokit: Octokit,
      target: {owner: string; repo: string},
      label: Label
    ): Promise<unknown> => {
      const params: CreateLabelParams = {
        owner: target.owner,
        repo: target.repo,
        name: label.name,
        description: label.description,
        color: label.color
      }

      return octokit.request('POST /repos/{owner}/{repo}/labels', params)
    }

    // See https://docs.github.com/en/rest/reference/issues#create-a-label
    // add labels
    this.logger.info(`Creating labels for repo ${this.owner}/${this.repo}`)
    const labels: Label[] = [
      {name: 'major', description: 'Release: major (x.0.0)', color: '94FFA4'},
      {name: 'minor', description: 'Release: minor (0.x.0)', color: '94D5A4'},
      {name: 'patch', description: 'Release: patch (0.0.x)', color: '94BBA4'},
      {name: 'chore', description: 'Changelog: chore', color: '000000'},
      {name: 'feature', description: 'Changelog: feature', color: '0075ca'},
      {name: 'skip ci', description: 'Skip ci validation', color: 'dd0000'}
    ]
    await Promise.all(
      labels.map(
        createLabelLimiter(this.octokit, this.limit, {
          owner: this.owner,
          repo: this.repo
        })
      )
    )
  }

  async createPagesSite(): Promise<void> {
    // set gh-pages branch as GitHub Pages target
    // See https://docs.github.com/en/rest/reference/pages#create-a-github-pages-site
    const pagesParams: CreatePagesSiteParams = {
      owner: this.owner,
      repo: this.repo,
      source: {branch: 'gh-pages'}
    }
    this.logger.info(`Setting GitHub Pages for repo ${this.owner}/${this.repo}`)
    await this.octokit
      .request('POST /repos/{owner}/{repo}/pages', pagesParams)
      .catch(() => ({}))
  }

  async createInitialRelease(): Promise<void> {
    // create release v0.0.0
    // See https://docs.github.com/en/rest/reference/releases#create-a-release
    const releaseParams: CreateReleaseParams = {
      owner: this.owner,
      repo: this.repo,
      tag_name: 'v0.0.0',
      name: 'v0.0.0'
    }
    this.logger.info(
      `Creating initial release for repo ${this.owner}/${this.repo}`
    )
    await this.octokit.request(
      'POST /repos/{owner}/{repo}/releases',
      releaseParams
    )
  }

  async updateMetadata({
    repoUrl,
    repoCredentials,
    name,
    type,
    cloudProvider,
    softwareProvider
  }: UpdateMetadataParams): Promise<void> {
    const gitApi: GitApi = await apiFromUrl(repoUrl, repoCredentials)

    this.logger.info(`Updating metadata with name: ${name}`)

    const repoDir = `/tmp/repo-${name}`
    const git: SimpleGitWithApi = await gitApi.clone(repoDir, {})

    const currentBranch: string = await git
      .branch()
      .then(result => result.current)

    const description: string =
      type === 'gitops'
        ? `Module to populate a gitops repo with the resources to provision ${name}`
        : `Module to provision ${name} on ${cloudProvider}`

    const metadataValues = Object.assign(
      {
        name,
        description,
        type
      },
      cloudProvider ? {cloudProvider} : {},
      softwareProvider ? {softwareProvider} : {}
    )

    // update values in module.yaml
    const yamlFile = await YamlFile.update<ModuleMetadataModel>(
      `${repoDir}/module.yaml`,
      metadataValues
    )
    this.logger.info(`Updated metadata: ${JSON.stringify(yamlFile.contents)}`)

    const message = 'Updates module.yaml with name and description'

    // push changes
    await git.add('.')
    await git.commit(message)
    await git.push('origin', currentBranch)
  }
}
