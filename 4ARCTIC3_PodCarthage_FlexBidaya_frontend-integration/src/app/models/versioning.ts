export interface BranchDTO {
  id: string;
  nom: string;
  startupId: string;
  membreId?: string;
  bmcSnapshot?: any;
  bmc_snapshot?: any;
}

export interface BlocConflict {
  blocName?: string;
  mainTags: string[];    // ✅ correspond au backend
  sourceTags: string[];  // ✅ correspond au backend
  originTags?: string[];
}

export interface MergeResultResponse {
  success?: boolean;
  sessionId?: string;
  session_id?: string;
  hasConflicts?: boolean;
  has_conflicts?: boolean;
  conflicts?: { [key: string]: BlocConflict };
}

export interface CommitDTO {
  id: string;
  message: string;
  timestamp: string;
  snapshot?: any;
}

export interface VersionEntry {
  versionNumber: number;
  mergedFromBranch: string;
  owner: string;
  commitId: string;
  mergedAt: string;
}