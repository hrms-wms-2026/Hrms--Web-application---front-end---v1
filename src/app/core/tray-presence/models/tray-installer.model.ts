export interface TrayInstallerInfo {
  version: string;
  download_url: string;
  sha256: string;
  file_size_bytes: number;
  publisher: string;
  minimum_windows_version: string;
  release_notes: string | null;
  channel: 'stable' | 'beta';
}
