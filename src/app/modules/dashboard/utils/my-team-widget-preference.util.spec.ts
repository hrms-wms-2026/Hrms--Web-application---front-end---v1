import { ALL_MY_TEAM_WIDGET_KEYS } from '../models/my-team-widget-key.model';
import { loadMyTeamWidgetPreference, saveMyTeamWidgetPreference } from './my-team-widget-preference.util';

describe('my-team-widget-preference.util', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('defaults to every widget, in the canonical order, when nothing is stored', () => {
    expect(loadMyTeamWidgetPreference()).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
  });

  it('round-trips a saved order exactly', () => {
    saveMyTeamWidgetPreference(['teamProgress', 'priorityActions']);
    expect(loadMyTeamWidgetPreference()).toEqual(['teamProgress', 'priorityActions']);
  });

  it('preserves a reordered subset exactly as stored, not re-derived from the canonical order', () => {
    saveMyTeamWidgetPreference(['approvalsExceptions', 'teamStatus']);
    expect(loadMyTeamWidgetPreference()).toEqual(['approvalsExceptions', 'teamStatus']);
  });

  it('drops unknown keys from a corrupted or stale stored value', () => {
    localStorage.setItem('onexso.my_team_widget_order', JSON.stringify(['teamStatus', 'notAWidget', 'teamProgress']));
    expect(loadMyTeamWidgetPreference()).toEqual(['teamStatus', 'teamProgress']);
  });

  it('falls back to the default on invalid JSON', () => {
    localStorage.setItem('onexso.my_team_widget_order', '{not json');
    expect(loadMyTeamWidgetPreference()).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
  });

  it('falls back to the default when the stored value is not an array', () => {
    localStorage.setItem('onexso.my_team_widget_order', JSON.stringify({ not: 'an array' }));
    expect(loadMyTeamWidgetPreference()).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
  });

  it('can store an empty list (everything hidden)', () => {
    saveMyTeamWidgetPreference([]);
    expect(loadMyTeamWidgetPreference()).toEqual([]);
  });

  it('keeps two employees\' preferences on the same browser independent', () => {
    saveMyTeamWidgetPreference(['teamStatus'], 'emp-1');
    saveMyTeamWidgetPreference(['teamProgress', 'priorityActions'], 'emp-2');

    expect(loadMyTeamWidgetPreference('emp-1')).toEqual(['teamStatus']);
    expect(loadMyTeamWidgetPreference('emp-2')).toEqual(['teamProgress', 'priorityActions']);
  });

  it('does not let an employee-scoped save leak into the unscoped default', () => {
    saveMyTeamWidgetPreference(['teamStatus'], 'emp-1');
    expect(loadMyTeamWidgetPreference(null)).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
    expect(loadMyTeamWidgetPreference()).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
  });

  it('falls back sensibly when employeeId is null or omitted', () => {
    saveMyTeamWidgetPreference(['approvalsExceptions']);
    expect(loadMyTeamWidgetPreference()).toEqual(['approvalsExceptions']);
    expect(loadMyTeamWidgetPreference(null)).toEqual(['approvalsExceptions']);
  });
});
