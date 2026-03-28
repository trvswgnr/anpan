export interface IslandMeta {
  /** Stable hash derived from the component's file path + export name */
  id: string;
  /** Absolute path to the source file */
  filePath: string;
  /** Export name, usually "default" */
  exportName: string;
  /** URL path where the client bundle is served, e.g. /_islands/counter-abc123.js */
  bundleUrl: string;
}

export type IslandManifest = Map<string, IslandMeta>;
