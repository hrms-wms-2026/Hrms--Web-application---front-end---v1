import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { AuthStore } from '../auth/state/auth.store';
import { ErrorHandlerService } from '../services/error-handler.service';

const RETRY_DELAYS_MS = [250, 500, 1000];
const SESSION_EXEMPT_PATH_FRAGMENTS = ['/auth/login', '/auth/me'];

function isSessionExempt(url: string): boolean {
  return SESSION_EXEMPT_PATH_FRAGMENTS.some((fragment) => url.includes(fragment));
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authStore = inject(AuthStore);
  const errorHandler = inject(ErrorHandlerService);

  return next(req).pipe(
    retry({
      count: 3,
      delay: (error: HttpErrorResponse, attempt: number) => {
        if (error.status >= 500 || error.status === 0) {
          return timer(RETRY_DELAYS_MS[attempt - 1] ?? 1000);
        }
        throw error;
      }
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isSessionExempt(req.url)) {
        authStore.clearSession();
        router.navigate(['/auth/login']);
        return throwError(() => error);
      }

      errorHandler.handle(error);
      return throwError(() => error);
    })
  );
};
