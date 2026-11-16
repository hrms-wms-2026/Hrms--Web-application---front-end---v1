import { parseSafeReturnPath, toSafeInternalPath } from './safe-return-path';

describe('toSafeInternalPath', () => {
  it('keeps an in-app route with its query string', () => {
    expect(toSafeInternalPath('/people/employees?tab=active')).toBe('/people/employees?tab=active');
  });

  it('keeps a valid tray activation path with its original values', () => {
    expect(toSafeInternalPath('/device/activate?request_id=req-1&user_code=ABCD-1234')).toBe(
      '/device/activate?request_id=req-1&user_code=ABCD-1234',
    );
  });

  it.each([
    ['absolute external url', 'https://evil.example/steal'],
    ['protocol-relative url', '//evil.example/steal'],
    ['backslash trick', '/\\evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['relative path', 'people/employees'],
    ['control character', '/people\u0000/employees'],
    ['auth page loop', '/auth/login?returnUrl=/x'],
    [
      'activation with extra param',
      '/device/activate?request_id=a&user_code=b&next=https://evil.example',
    ],
    ['activation without user code', '/device/activate?request_id=a'],
    ['empty', ''],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(toSafeInternalPath(value)).toBeNull();
  });
});

describe('parseSafeReturnPath', () => {
  it('rejects an external activation lookalike', () => {
    expect(
      parseSafeReturnPath('https://evil.example/device/activate?request_id=a&user_code=b'),
    ).toBeNull();
  });
});
