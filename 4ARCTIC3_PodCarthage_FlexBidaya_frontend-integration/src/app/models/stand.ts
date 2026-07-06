import { Evenement } from "./evenement";

export interface Stand {
  id?: number;
  startupName: string;
  domain: string;
  requiredSkills: string;
  description: string;
  event?: Evenement;
}

