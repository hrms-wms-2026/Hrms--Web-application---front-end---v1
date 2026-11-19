import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv.util';

describe('csvCell', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@cmd', "'@cmd"]
  ])('escapes %j', (raw, expected) => {
    expect(csvCell(raw)).toBe(expected);
  });
});

describe('toCsv', () => {
  it('joins escaped cells with commas and rows with CRLF', () => {
    expect(toCsv([['Name', 'Note'], ['Ann', 'a,b']])).toBe('Name,Note\r\nAnn,"a,b"');
  });
});
