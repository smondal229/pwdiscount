/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

interface ImportMetaEnv {
  readonly MONGO_URI?: string;
  readonly MONGO_DB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
