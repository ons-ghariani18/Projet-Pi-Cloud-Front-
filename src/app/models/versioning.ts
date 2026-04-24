export interface BranchDTO {
  id: string;
  nom: string;
  startupId: string;
  membreId?: string;
  bmcSnapshot?: any;
  bmc_snapshot?: any;
}

export interface BlocConflict {
  main: string[];
  source: string[];
}

export interface MergeResultResponse {
  success?: boolean;
  sessionId?: string;
  conflicts?: { [key: string]: BlocConflict };
}

export interface CommitDTO {
  id: string;
  message: string;
  timestamp: string;
  snapshot?: any;
}
