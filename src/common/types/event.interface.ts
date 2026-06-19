export interface RawEvent {
  id: string;
  timestamp: string;
  type: string;
  room: string | null;
  guest: string | null;
  description: string;
  status: 'resolved' | 'unresolved' | 'pending';
}

export interface NightLog {
  date: string;
  content: string;
}

export interface NormalizedEvent {
  id: string;
  source: 'system' | 'night_log';
  timestamp: string | null;
  type: string;
  room: string | null;
  guest: string | null;
  description: string;
  status: 'resolved' | 'unresolved' | 'pending';
  rawText?: string;
  language?: string;
  confidence: 'high' | 'low';
}
