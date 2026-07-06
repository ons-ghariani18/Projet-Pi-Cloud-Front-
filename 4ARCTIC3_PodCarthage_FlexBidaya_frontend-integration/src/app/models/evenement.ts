export interface Evenement {
  id?: number;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  status: string;
    imageBase64?: string;  
organisateurId?: number;
      hasPendingUpdate?: boolean;
  pendingUpdateJson?: string | null;
}