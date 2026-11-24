import { AuthResponseDto } from './auth-response.dto';

/** One workspace the signed-in identity may enter. displayName is camelCase on the wire. */
export interface WorkspaceOptionDto {
  slug: string;
  displayName: string;
}

/** 202 body from POST /auth/login and POST /auth/login/google when several workspaces match. */
export interface WorkspaceSelectionRequiredDto {
  requires_workspace_selection: true;
  login_challenge: string;
  workspaces: WorkspaceOptionDto[];
}

export interface SelectWorkspaceRequestDto {
  login_challenge: string;
  workspace: string;
}

/** What a root-host login call can answer with. */
export type LoginResultDto = AuthResponseDto | WorkspaceSelectionRequiredDto;

export function isWorkspaceSelectionRequired(
  body: LoginResultDto,
): body is WorkspaceSelectionRequiredDto {
  return (body as Partial<WorkspaceSelectionRequiredDto>).requires_workspace_selection === true;
}
