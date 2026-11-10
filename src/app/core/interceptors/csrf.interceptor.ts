import { CSRF_COOKIE_NAMES } from '../auth/auth-cookie-names';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function readCsrfToken(document: Document): string | null {
  const cookies = document.cookie.split(';').map((c) => c.trim());
  for (const name of CSRF_COOKIE_NAMES) {
    const match = cookies.find((c) => c.startsWith(`${name}=`));
    if (match) {
      return decodeURIComponent(match.slice(name.length + 1));
    }
  }
  return null;
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (SAFE_METHODS.includes(req.method)) {
    return next(req);
  }

  const document = inject(DOCUMENT);
  const token = readCsrfToken(document);

  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [CSRF_HEADER]: token } }));
};
