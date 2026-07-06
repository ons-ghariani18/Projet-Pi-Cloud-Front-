import { Hackathon } from "./hackathon";

export interface Gagnant {
  id?: number;
  teamName: string;
  position: string; // FIRST, SECOND...
  description: string;
  contactEmail: string;
  contactPhone: string;
  hackathonId?: number; // 🔥 AJOUT IMPORTANT

  hackathon?: Hackathon;
}