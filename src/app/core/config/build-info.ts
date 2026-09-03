export interface BuildInfo {
  readonly version: string;
  readonly commitSha: string;
  readonly buildTimestamp: string;
}

export const BUILD_INFO: Readonly<BuildInfo> = Object.freeze({
  version: '0.0.0-dev',
  commitSha: 'local',
  buildTimestamp: 'local',
});
