import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  it('forwards error() to console.error with context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = TestBed.inject(LoggerService);

    service.error('boom', { url: '/api/v1/thing' });

    expect(spy).toHaveBeenCalledWith('boom', { url: '/api/v1/thing' });
    spy.mockRestore();
  });

  it('forwards warn() to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = TestBed.inject(LoggerService);

    service.warn('careful');

    expect(spy).toHaveBeenCalledWith('careful', {});
    spy.mockRestore();
  });
});
