export interface EventScore {
  score: number;           // score global 0-100
  totalResponses: number;
  level: 'Excellent' | 'Bien' | 'Moyen' | 'Faible';
  details: {
    questionLabel: string;
    type: string;
    score: number;
  }[];
    averageScore: number;   // ← ajoutez cette ligne

}