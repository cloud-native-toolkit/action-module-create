import {Octokit, RestEndpointMethodTypes} from '@octokit/action';
import {default as pLimit, LimitFunction} from 'p-limit';
import {LoggerApi} from '../util/logger';
import {Container} from 'typescript-ioc';

type CreateUsingTemplateParams = RestEndpointMethodTypes['repos']['createUsingTemplate']['parameters'];
type UpdateRepoParams = RestEndpointMethodTypes['repos']['update']['parameters'];
type CreateReleaseParams = RestEndpointMethodTypes['repos']['createRelease']['parameters'];
type CreatePagesSiteParams = RestEndpointMethodTypes['repos']['createPagesSite']['parameters'];
type CreateLabelParams = RestEndpointMethodTypes['issues']['createLabel']['parameters'];

export interface TemplateRepo {
  template_owner: string;
  template_repo: string;
}

interface BranchRuleCheck {
  strict: boolean;
  checks: Array<{context: string, app_id?: number}>
}

interface BranchProtection {
  branch: string;
  required_status_checks?: BranchRuleCheck;
}

interface Label {
  name: string;
  description: string;
  color: string;
}

export class ModuleRepo {

  private readonly limit: LimitFunction;
  private logger: LoggerApi;

  constructor(public readonly owner: string, public readonly repo: string, public readonly octokit: Octokit) {
    this.limit = pLimit(1);
    this.logger = Container.get(LoggerApi);
  }

  static async createFromTemplate(octokit: Octokit, templateRepo: TemplateRepo, owner: string, name: string, description: string): Promise<ModuleRepo> {

    const logger: LoggerApi = Container.get(LoggerApi);

    const createParams: CreateUsingTemplateParams = {
      template_owner: templateRepo.template_owner,
      template_repo: templateRepo.template_repo,
      owner,
      name,
      description,
      private: false,
      include_all_branches: true,
    };

    // See https://docs.github.com/en/rest/reference/repos#create-a-repository-using-a-template
    logger.debug(`Creating repo ${owner}/${name} from template ${templateRepo.template_owner}/${templateRepo.template_repo}`);
    await octokit['repos'].createUsingTemplate(createParams);

    return new ModuleRepo(owner, name, octokit);
  }

  async updateSettings(): Promise<void> {

    const updateParams: UpdateRepoParams = {
      owner: this.owner,
      repo: this.repo,
      allow_merge_commit: false,
      allow_auto_merge: true,
      delete_branch_on_merge: true,
    };

    // See https://docs.github.com/en/rest/reference/repos#update-a-repository
    this.logger.debug(`Updating repo ${this.owner}/${this.repo}`);
    await this.octokit['repos'].update(updateParams);
  }

  async addBranchProtection(): Promise<void> {

    const updateBranchProtectionLimiter = (octokit: Octokit, limit: LimitFunction, target: {owner: string, repo: string}) => {
      return (rule: BranchProtection) => {
        return limit(() => updateBranchProtection(octokit, target, rule));
      }
    }

    const updateBranchProtection = async (octokit: Octokit, target: {owner: string, repo: string}, rule: BranchProtection) => {
      const params = Object.assign(
        {},
        target,
        rule,
        {contexts: rule.required_status_checks?.checks.map(v => v.context)}
      ) as any;

      return octokit['repos'].updateBranchProtection(params);
    }

    // Set https://docs.github.com/en/rest/reference/branches#update-branch-protection
    this.logger.debug(`Update branch protection for repo ${this.owner}/${this.repo}`);
    const branchRules: BranchProtection[] = [
      {branch: 'gh-pages'},
      {branch: 'main', required_status_checks: {strict: true, checks: [{context: 'verifyMetadata'}, {context: 'verify (ocp4_latest)'}]}}
    ];
    await Promise.all(branchRules.map(updateBranchProtectionLimiter(this.octokit, this.limit, {owner: this.owner, repo: this.repo})));
  }

  async addDefaultLabels(): Promise<void> {

    const createLabelLimiter = (octokit: Octokit, limit: LimitFunction, target: {owner: string, repo: string}) => {
      return (label: Label) => {
        return limit(() => createLabel(octokit, target, label));
      }
    }

    const createLabel = async (octokit: Octokit, target: {owner: string, repo: string}, label: Label) => {
      const params: CreateLabelParams = {
        owner: target.owner,
        repo: target.repo,
        name: label.name,
        description: label.description,
        color: label.color,
      };

      return octokit['issues'].createLabel(params);
    }

    // See https://docs.github.com/en/rest/reference/issues#create-a-label
    // add labels
    this.logger.debug(`Creating labels for repo ${this.owner}/${this.repo}`);
    const labels: Label[] = [
      {name: 'major', description: 'Release: major (x.0.0)', color: '94FFA4'},
      {name: 'minor', description: 'Release: minor (0.x.0)', color: '94D5A4'},
      {name: 'patch', description: 'Release: patch (0.0.x)', color: '94BBA4'},
      {name: 'chore', description: 'Changelog: chore', color: '000000'},
      {name: 'feature', description: 'Changelog: feature', color: '0075ca'},
    ];
    await Promise.all(labels.map(createLabelLimiter(this.octokit, this.limit, {owner: this.owner, repo: this.repo})));
  }

  async createPagesSite(): Promise<void> {

    // set gh-pages branch as GitHub Pages target
    // See https://docs.github.com/en/rest/reference/pages#create-a-github-pages-site
    const pagesParams: CreatePagesSiteParams = {
      owner: this.owner,
      repo: this.repo,
      source: {branch: 'gh-pages'}
    };
    this.logger.debug(`Setting GitHub Pages for repo ${this.owner}/${this.repo}`);
    await this.octokit['repos'].createPagesSite(pagesParams);
  }

  async createInitialRelease(): Promise<void> {

    // create release v0.0.0
    // See https://docs.github.com/en/rest/reference/releases#create-a-release
    const releaseParams: CreateReleaseParams = {
      owner: this.owner,
      repo: this.repo,
      tag_name: 'v0.0.0',
      name: 'v0.0.0'
    };
    this.logger.debug(`Creating initial release for repo ${this.owner}/${this.repo}`);
    await this.octokit['repos'].createRelease(releaseParams);
  }
}
