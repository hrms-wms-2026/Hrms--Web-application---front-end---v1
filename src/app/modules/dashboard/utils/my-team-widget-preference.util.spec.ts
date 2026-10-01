import { ALL_MY_TEAM_WIDGET_KEYS } from '../models/my-team-widget-key.model';
import { loadMyTeamWidgetPreference, saveMyTeamWidgetPreference } from './my-team-widget-preference.util';

describe('my-team-widget-preference.util', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('defaults to every widget, in the canonical order, when nothing is stored', () => {
    expect(loadMyTeamWidgetPreference()).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
  });

  it('round-trips a saved order exactly', () => {
    saveMyTeamWidgetPreference(['teamProgress', 'actionCenter']);
    expect(loadMyTeamWidgetPreference()).toEqual(['teamProgress', 'actionCenter']);
  });

  it('preserves a reordered subset exactly as stored, not re-derived from the canonical order', () => {
    saveMyTeamWidgetPreference(['actionCenter', 'teamStatus']);
    expect(loadMyTeamWidgetPreference()).toEqual(['actionCenter', 'teamStatus']);
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
    saveMyTeamWidgetPreference(['teamProgress', 'actionCenter'], 'emp-2');

    expect(loadMyTeamWidgetPreference('emp-1')).toEqual(['teamStatus']);
    expect(loadMyTeamWidgetPreference('emp-2')).toEqual(['teamProgress', 'actionCenter']);
  });

  it('does not let an employee-scoped save leak into the unscoped default', () => {
    saveMyTeamWidgetPreference(['teamStatus'], 'emp-1');
    expect(loadMyTeamWidgetPreference(null)).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
    expect(loadMyTeamWidgetPreference()).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
  });

  it('falls back sensibly when employeeId is null or omitted', () => {
    saveMyTeamWidgetPreference(['actionCenter']);
    expect(loadMyTeamWidgetPreference()).toEqual(['actionCenter']);
    expect(loadMyTeamWidgetPreference(null)).toEqual(['actionCenter']);
  });

  describe('legacy widget-key migration (Action Center consolidation)', () => {
    it('maps a stored "priorityActions" to "actionCenter" at its position', () => {
      localStorage.setItem('onexso.my_team_widget_order', JSON.stringify(['teamStatus', 'priorityActions', 'teamProgress']));
      expect(loadMyTeamWidgetPreference()).toEqual(['teamStatus', 'actionCenter', 'teamProgress']);
    });

    it('maps a stored "approvalsExceptions" to "actionCenter" at its position', () => {
      localStorage.setItem('onexso.my_team_widget_order', JSON.stringify(['approvalsExceptions', 'teamStatus']));
      expect(loadMyTeamWidgetPreference()).toEqual(['actionCenter', 'teamStatus']);
    });

    it('collapses both legacy keys into one actionCenter at the earlier position', () => {
      localStorage.setItem('onexso.my_team_widget_order', JSON.stringify(['priorityActions', 'teamStatus', 'approvalsExceptions', 'teamProgress']));
      expect(loadMyTeamWidgetPreference()).toEqual(['actionCenter', 'teamStatus', 'teamProgress']);
    });

    it('collapses both legacy keys in the other relative order too', () => {
      localStorage.setItem('onexso.my_team_widget_order', JSON.stringify(['approvalsExceptions', 'teamStatus', 'priorityActions']));
      expect(loadMyTeamWidgetPreference()).toEqual(['actionCenter', 'teamStatus']);
    });

    it('does not insert actionCenter when neither legacy key was ever stored', () => {
      localStorage.setItem('onexso.my_team_widget_order', JSON.stringify(['teamStatus']));
      expect(loadMyTeamWidgetPreference()).toEqual(['teamStatus']);
    });

    it('writes the migrated order back so a second load does not re-run the mapping', () => {
      localStorage.setItem('onexso.my_team_widget_order', JSON.stringify(['priorityActions', 'teamStatus']));
      loadMyTeamWidgetPreference();
      const stored = localStorage.getItem('onexso.my_team_widget_order');
      expect(stored).not.toContain('priorityActions');
      expect(stored).not.toContain('approvalsExceptions');
      expect(JSON.parse(stored!)).toEqual(['actionCenter', 'teamStatus']);
    });

    it('migrates per employee scope independently', () => {
      localStorage.setItem('onexso.my_team_widget_order:emp-1', JSON.stringify(['priorityActions']));
      expect(loadMyTeamWidgetPreference('emp-1')).toEqual(['actionCenter']);
      expect(loadMyTeamWidgetPreference('emp-2')).toEqual([...ALL_MY_TEAM_WIDGET_KEYS]);
    });
  });
});
