export interface Hackathon {
  id?: number;
  title: string;
  description: string;
  domain: string;
  startDate: string;
  endDate: string;
  location: string;
    status: string;
  imageBase64?: string; // ✅ NOUVEAU
  driveFolderId?: string;
  driveFolderLink?: string;
  submissionDeadline?: string;  // ✅ AJOUTER
  driveDeadlinePassed?: boolean; // ✅ AJOUTER
organisateurId?: number;
    hasPendingUpdate?: boolean;
  pendingUpdateJson?: string | null;
}