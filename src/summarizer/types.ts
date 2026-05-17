import { OpenCodeSession } from '../plugin/storage-reader';

export interface SummarizedSession {
  id: string;
  originalCreatedAt: number;
  summarizedAt: number;
  project: string;
  isSummary: true;
  content: {
    summary: string;
    decisions: string[];
    key_files: string[];
    next_steps: string[];
  };
}

export type ProcessedSession = OpenCodeSession | SummarizedSession;
