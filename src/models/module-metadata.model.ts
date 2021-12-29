// eslint-disable-next-line filenames/match-regex
export interface ModuleMetadataProvider {
  name: string
  source: string
}

export interface ModuleMetadataDependencyRef {
  source: string
  version: string
}

export interface ModuleMetadataDependency {
  id: string
  refs?: ModuleMetadataDependencyRef[]
  interface?: string
}

export interface ModuleMetadataModuleRef {
  id: string
  output: string
}

export interface ModuleMetadataVariable {
  name: string
  scope?: string
  moduleRef?: ModuleMetadataModuleRef
}

export interface ModuleMetadataVersion {
  platforms: string[]
  providers: ModuleMetadataProvider[]
  dependencies: ModuleMetadataDependency[]
  variables: ModuleMetadataVariable[]
}

export interface ModuleMetadataModel {
  name: string
  alias?: string
  cloudProvider?: string
  softwareProvider?: string
  type: string
  description: string
  tags: string[]
  versions: ModuleMetadataVersion[]
}
