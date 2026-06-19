export const PRIORITY_ORDER: Record<string, number> = {
  compliance: 1,
  incident: 2,
  finance_note: 3,
  maintenance: 3,
  deposit_issue: 4,
  damage_report: 4,
  facilities: 5,
  complaint: 6,
  check_in_issue: 7,
  early_checkout_request: 7,
  no_show: 7,
  guest_message: 8,
  note: 9,
  check_in: 10,
  walk_in: 10,
  lost_keycard: 10,
};

export const ACTION_REQUIRED_STATUSES = ['unresolved'] as const;
export const PENDING_STATUSES = ['pending'] as const;
export const RESOLVED_STATUSES = ['resolved'] as const;

export const CATEGORY_TO_SECTION: Record<string, string> = {
  unresolved: 'actionRequired',
  pending: 'pending',
  resolved: 'resolved',
};
