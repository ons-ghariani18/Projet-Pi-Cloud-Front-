export interface Form {
  id?: number;
  fullName: string;  
  email: string;
  skills: string;
  cvPath: string;
  event?: { id: number };
    user?: { id: number } | null;  // ─── AJOUTER

}