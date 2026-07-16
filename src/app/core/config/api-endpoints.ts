const encodePathValue = (value: string): string =>
  encodeURIComponent(value.trim());

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    refresh: '/auth/refresh',
    context: '/auth/context',
  },

  employees: {
    list: '/employees',
    detail: (id: string): string =>
      `/employees/${encodePathValue(id)}`,
  },

  projects: {
    list: '/projects',
    detail: (id: string): string =>
      `/projects/${encodePathValue(id)}`,
  },
} as const;
