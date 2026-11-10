/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MATCH_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
