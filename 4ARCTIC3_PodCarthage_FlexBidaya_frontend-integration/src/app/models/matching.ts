import { Evenement } from "./evenement";
import { Stand } from "./stand";
import { User } from "./user";

export interface Matching {
  id?: number;
  stand: Stand;                  // obligatoire
  event?: { id: number } | Evenement; // <-- ajoute cette ligne
  score: number;
  semanticScore?: number;        // optionnel
  keywordScore?: number;         // optionnel
  level?: 'Fort' | 'Moyen' | 'Faible'; // optionnel
}
// Nouveau DTO retourné par /api/match/analyze
export interface MatchResult {
  semanticScore: number;
  keywordScore:  number;
  finalScore:    number;
  level:         'Fort' | 'Moyen' | 'Faible';
  cvSkillsExtracted: string;
}

// Nouveau : résultat par stand pour un événement
export interface StandMatchResult {
  standId:           number;
  startupName:       string;
  domain:            string;
  requiredSkills:    string;
  semanticScore:     number;
  keywordScore:      number;
  finalScore:        number;
  level:             'Fort' | 'Moyen' | 'Faible';
  cvSkillsExtracted: string;
}