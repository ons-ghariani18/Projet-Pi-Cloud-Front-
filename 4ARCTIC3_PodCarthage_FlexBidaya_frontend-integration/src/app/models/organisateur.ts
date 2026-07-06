import { User } from "./user";

export interface Organisateur extends User{
    

    organisation: String;
  
  }

  export interface OrganisateurStat {
  id: number;
  username: string;
  email: string;
  organisation: string;
  trusted: boolean;
  totalEvents: number;
  totalHackathons: number;
}