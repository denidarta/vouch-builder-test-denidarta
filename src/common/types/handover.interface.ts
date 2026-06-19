import { NormalizedEvent } from './event.interface';

export interface HandoverItem {
  priority: number;
  category: string;
  summary: string;
  details: string;
  room: string | null;
  guest: string | null;
  sourceEvents: string[];
  nightsOpen: number;
  threadStatus: 'still_open' | 'newly_resolved' | 'new_tonight';
}

export interface DataQualityWarning {
  type: 'contradiction' | 'anomaly';
  description: string;
  relatedEvents: string[];
}

export interface FlaggedEntry {
  eventId: string;
  reason: string;
  action: string;
}

export interface IncompleteEntry {
  eventId: string;
  missing: string[];
  note: string;
}

export interface DataQuality {
  warnings: DataQualityWarning[];
  flaggedEntries: FlaggedEntry[];
  incompleteEntries: IncompleteEntry[];
}

export interface Handover {
  actionRequired: HandoverItem[];
  pending: HandoverItem[];
  resolved: HandoverItem[];
  fyi: HandoverItem[];
}

export interface HandoverResponse {
  hotel: { id: string; name: string };
  generatedAt: string;
  shiftDate: string;
  shiftWindow: { start: string; end: string };
  handover: Handover;
  dataQuality: DataQuality;
}

export interface ReconciledIssue {
  threadKey: string;
  status: 'still_open' | 'newly_resolved' | 'new_tonight';
  category: string;
  room: string | null;
  guest: string | null;
  summary: string;
  nightsOpen: number;
  sourceEvents: string[];
  contradiction?: string;
  timeline: { date: string; eventId: string; summary: string }[];
}

export interface ShiftGroup {
  shiftDate: string;
  start: string;
  end: string;
  events: NormalizedEvent[];
}
