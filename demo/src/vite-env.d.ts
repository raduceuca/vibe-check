/// <reference types="vite/client" />

declare module '*.json' {
  const value: unknown
  export default value
}

interface MomentInstance {
  format: (pattern?: string) => string
}

interface MomentFn {
  (input?: string | number | Date): MomentInstance
  version?: string
}

interface TidewellConfiguratorApi {
  onLoad: () => void
  onGlazeChange: () => void
}

interface Window {
  moment?: MomentFn
  TidewellConfigurator?: TidewellConfiguratorApi
}
