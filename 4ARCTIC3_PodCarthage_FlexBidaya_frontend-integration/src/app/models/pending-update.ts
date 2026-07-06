

export interface PendingUpdate {
  id: number;
  entityType: 'EVENT' | 'HACKATHON';
  entityId: number;
  entityTitle: string;
  organisateurName: string;
  modifiedAt: string;
  diffs: FieldDiff[];
    pendingJson: string;
}

export interface FieldDiff {
  key: string;
  label: string;
  oldValue: string;
  newValue: string;
  changed: boolean;
}