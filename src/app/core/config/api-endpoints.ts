const encodePathValue = (value: string): string => encodeURIComponent(value.trim());

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    loginGoogle: '/auth/login/google',
    selectWorkspace: '/auth/login/select-workspace',
    googleConfig: '/auth/google-config',
    logout: '/auth/logout',
    me: '/auth/me',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    sessionExchange: '/auth/session-exchange',
    invitationPreview: (token: string): string => `/auth/invitations/${encodePathValue(token)}`,
    acceptEmployeeInvitation: (token: string): string =>
      `/auth/invitations/${encodePathValue(token)}/accept-employee`,
  },

  legal: {
    completeLogin: '/legal/acceptances/complete-login',
    currentDocuments: '/legal/documents/current',
  },

  employees: {
    list: '/employees',
    detail: (id: string): string => `/employees/${encodePathValue(id)}`,
  },

  projects: {
    list: '/projects',
    detail: (id: string): string => `/projects/${encodePathValue(id)}`,
  },
} as const;
