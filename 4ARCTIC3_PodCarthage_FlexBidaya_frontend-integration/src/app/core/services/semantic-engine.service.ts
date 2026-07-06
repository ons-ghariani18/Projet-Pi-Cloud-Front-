import { Injectable } from '@angular/core';

export interface MatchingResult {
  score: number;
  keywords: string[];
  explanation: string;
  mathLog: string[];
  topic?: string;
  content?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SemanticEngineService {
  
  private stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'est', 'sont', 'dans', 'pour', 'avec', 'par', 'sur', 'qui', 'que', 'ce', 'ces']);
  
  private idfMap: Map<string, number> = new Map();
  private totalDocs = 0;
  private isTrained = false;

  constructor() {}

  /**
   * PHASE A : L'ENTRAÎNEMENT (A to Z) - LE RUNNER
   * On calcule dynamiquement l'importance des mots à partir de la base d'opportunités.
   */
  train(documents: string[]): string[] {
    const logs: string[] = [];
    this.totalDocs = documents.length;
    const docFrequency: Map<string, number> = new Map();

    logs.push(`🚀 INITIALISATION DU RUNNER IA (Mode A à Z)...`);
    logs.push(`📦 Chargement de ${this.totalDocs} offres dans la mémoire vive...`);

    documents.forEach(doc => {
      const uniqueTokens = new Set(this.tokenize(doc));
      uniqueTokens.forEach(token => {
        docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
      });
    });

    // Calcul de l'importance (IDF) : log(Total / Docs avec le mot)
    this.idfMap.clear();
    docFrequency.forEach((freq, token) => {
      const idf = Math.log(this.totalDocs / freq);
      this.idfMap.set(token, idf);
    });

    this.isTrained = true;
    logs.push(`✅ MODÈLE CONSTRUIT : ${this.idfMap.size} termes indexés.`);
    logs.push(`📊 Matrice TF-IDF prête pour l'inférence.`);
    return logs;
  }

  /**
   * PHASE B : L'INFÉRENCE (Calcul du matching)
   */
  calculateMatch(query: string, document: string): MatchingResult {
    const logs: string[] = [];
    
    // 1. Tokenization et filtrage
    const queryTokens = this.tokenize(query);
    const docTokens = this.tokenize(document);
    
    // 2. Création des vecteurs (TF-IDF)
    const queryVector = this.vectorize(queryTokens);
    const docVector = this.vectorize(docTokens);
    
    // 3. Similitude Cosinus
    const score = this.cosineSimilarity(queryVector, docVector, logs);
    
    // 4. Mots-clés communs pour l'explication
    const common = queryTokens.filter(t => docTokens.includes(t));
    const keywords = [...new Set(common)].slice(0, 5);

    let explanation = "";
    if (score > 70) explanation = "Excellente correspondance technique.";
    else if (score > 40) explanation = "Correspondance partielle détectée.";
    else explanation = "Faible similitude mathématique.";

    return {
      score: Math.round(score),
      keywords,
      explanation,
      mathLog: logs
    };
  }

  /**
   * PHASE C : ANALYSE DES LACUNES (GAP ANALYSIS)
   * Identifie les termes de l'offre qui manquent au profil du candidat.
   */
  getGapAnalysis(profile: string, jobDescription: string): string[] {
    const profileTokens = new Set(this.tokenize(profile));
    const jobTokens = this.tokenize(jobDescription);
    
    // On cherche les mots de l'offre (poids IDF élevé) qui ne sont PAS dans le profil
    return [...new Set(jobTokens)]
      .filter(token => !profileTokens.has(token))
      .sort((a, b) => (this.idfMap.get(b) || 0) - (this.idfMap.get(a) || 0))
      .slice(0, 4); // On retourne les 4 manques les plus critiques
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\sàâäéèêëîïôöùûüç]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.stopWords.has(token));
  }

  private vectorize(tokens: string[]): Map<string, number> {
    const vector = new Map<string, number>();
    const tf: Map<string, number> = new Map();
    tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
    
    tf.forEach((count, token) => {
      const termFreq = count / tokens.length;
      const idf = this.idfMap.get(token) || 1;
      vector.set(token, termFreq * idf);
    });
    return vector;
  }

  private cosineSimilarity(v1: Map<string, number>, v2: Map<string, number>, logs: string[]): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    const allKeys = new Set([...v1.keys(), ...v2.keys()]);
    
    allKeys.forEach(key => {
      const val1 = v1.get(key) || 0;
      const val2 = v2.get(key) || 0;
      
      dotProduct += val1 * val2;
      mag1 += val1 * val1;
      mag2 += val2 * val2;
      
      if (val1 > 0 && val2 > 0) {
        logs.push(`Math: DotProduct pour '${key}' (Poids: ${(val1*val2).toFixed(4)})`);
      }
    });

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    if (magnitude === 0) return 0;
    
    const sim = (dotProduct / magnitude) * 100;
    logs.push(`Final Cosinus: ${sim.toFixed(2)}%`);
    return sim;
  }
}
