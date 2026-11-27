import { TestBed } from '@angular/core/testing';
import { LOG_SINK, LoggerService } from './logger.service';

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

  it('also reports to a LOG_SINK when one is provided, and a failing sink never breaks the caller', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: LOG_SINK, useValue: { report } }] });
    const service = TestBed.inject(LoggerService);

    service.error('boom', { clientErrorId: 'c1' });
    expect(report).toHaveBeenCalledWith({ level: 'error', message: 'boom', context: { clientErrorId: 'c1' } });

    report.mockImplementation(() => {
      throw new Error('sink down');
    });
    expect(() => service.error('again')).not.toThrow();
  });
});
