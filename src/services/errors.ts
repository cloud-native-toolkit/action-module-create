export class BranchProtectionError extends Error {
  public readonly branch: string
  public readonly error: Error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(branch: string, error: any) {
    super(
      `Error updating branch protection for ${branch} branch`
    )
    this.branch = branch
    this.error = error
  }
}

export class BranchProtectionErrors extends Error {
  private _errors: BranchProtectionError[]

  constructor(errors: BranchProtectionError[] = []) {
    super(
      `Error updating branch protection for branch(es): ${JSON.stringify(
        errors.map(e => e.branch)
      )}`
    )

    this._errors = errors
  }

  errors(): BranchProtectionError[] {
    return this._errors.slice()
  }

  branches(): string[] {
    return this._errors.map(e => e.branch)
  }
}

export const isBranchProtectionError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any
): error is BranchProtectionError => {
  return (
    error &&
    !!(error as BranchProtectionError).branch &&
    !!(error as BranchProtectionError).error
  )
}
