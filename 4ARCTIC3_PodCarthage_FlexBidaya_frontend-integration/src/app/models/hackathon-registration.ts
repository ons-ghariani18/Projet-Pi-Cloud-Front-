import { Hackathon } from "./hackathon";
import { User } from "./user";

export interface HackathonRegistration {
  id?: number;
  teamName: string;
  teamSize: number;
  leaderName: string;
  leaderEmail: string;

  hackathon?: Hackathon;
  user?: { id: number } | null;  // ─── AJOUTER
    teamFolderId?: string;   // ✅ ID dossier Drive équipe
  teamFolderLink?: string; // ✅ Lien dossier Drive équipe
    present?: boolean;  // ← ajouter

}