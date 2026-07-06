import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface OllamaQuery {
  prompt: string;
  modele?: string;
}

export interface OllamaResult {
  response: string;
}

@Injectable({
  providedIn: 'root'
})
export class OllamaService {
  private apiUrl = `http://localhost:8080/api/ia/generate`;

  constructor(private http: HttpClient) {}

  /**
   * Envoie un texte au backend Spring Boot qui l'envoie à l'Ollama local.
   */
  generateContent(prompt: string, modele: string = 'llama3.2'): Observable<string> {
    const query: OllamaQuery = { prompt, modele };
    return this.http.post<OllamaResult>(this.apiUrl, query).pipe(
      map(res => res.response)
    );
  }

  // --- Prompts prédéfinis pour NotebookLM ---

  generateSummary(text: string): Observable<string> {
    const prompt = `Tu es un assistant de cours. Fais un résumé professionnel en HTML (avec des balises <ul>, <li>, <strong>) de ce texte. 
Ne donne aucune introduction, écris uniquement le code HTML du résumé.
Voici le texte : 
${text}`;
    return this.generateContent(prompt, 'llama3.2');
  }

  generateQuiz(text: string): Observable<string> {
    const prompt = `Tu es un professeur. Basé sur ce texte, génère 3 questions à choix multiples (QCM). 
Tu DOIS répondre STRICTEMENT avec un tableau JSON valide et rien d'autre. Ne mets pas de bloc markdown.
Format attendu:
[
  {
    "question": "Texte question?",
    "choices": ["Choix A", "Choix B", "Choix C", "Choix D"],
    "correct": 0,
    "explanation": "Explication courte"
  }
]
Voici le texte :
${text}`;
    return this.generateContent(prompt, 'llama3.2');
  }

  generateMindmap(text: string): Observable<string> {
    const prompt = `Tu es un expert pédagogique spécialisé en cartographie mentale.
Analyse ce texte (qui peut être une transcription vidéo ou le contenu de slides de présentation) et génère une mindmap structurée.

RÈGLES IMPORTANTES :
- Identifie le SUJET PRINCIPAL du document/vidéo
- Génère 4 à 6 branches thématiques (concepts clés abordés)
- Chaque branche doit avoir 2 à 4 sous-points CONCRETS et SPÉCIFIQUES au texte
- Les sous-points doivent être des phrases courtes (max 8 mots), pas des mots isolés
- Si c'est une transcription vidéo : base-toi sur les idées expliquées oralement
- Si c'est un PPT/PDF : base-toi sur les titres de slides et leurs contenus

Réponds UNIQUEMENT avec un tableau JSON valide, sans introduction ni markdown :
[
  {
    "label": "🎯 Concept principal 1",
    "children": ["Point concret A", "Point concret B", "Point concret C"]
  },
  {
    "label": "⚙️ Concept principal 2",
    "children": ["Sous-idée 1", "Sous-idée 2"]
  }
]

Voici le texte à analyser :
${text}`;
    return this.generateContent(prompt, 'llama3.2');
  }

  generateExam(text: string): Observable<string> {
    const prompt = `Tu es un professeur d'examen. Basé sur ce texte, génère 3 questions ouvertes complexes format JSON strict.
Format attendu:
[
  {
    "question": "Texte de la question ouverte complexe ?",
    "points": 5,
    "hint": "Un petit indice pour l'étudiant"
  }
]
Voici le texte:
${text}`;
    return this.generateContent(prompt, 'llama3.2');
  }

  /**
   * Analyse une formation pour détecter le spam.
   * Si extractedText est fourni, l'IA peut analyser le contenu réel du fichier.
   */
  detectSpamFormation(titre: string, description: string, lecons: any[], extractedText: string | null = null): Observable<string> {
    const leconsText = lecons.map((l: any) => l.titre).join(', ');
    const extraits = extractedText ? extractedText.substring(0, 3000) : 'Aucun fichier disponible';

    const prompt = `Tu es un modérateur expert pour une PLATEFORME ÉDUCATIVE de formation professionnelle.
Ton rôle est de détecter les soumissions frauduleuses, spam ou hors-sujet.

Formation soumise :
- Titre : "${titre}"
- Description : "${description}"
- Leçons : [${leconsText}]
- Contenu extrait de la première leçon (transcription vidéo ou texte PDF) :
"${extraits}"

RÈGLES DE DÉTECTION (applique dans l'ordre, première règle qui s'applique gagne) :
1. SPAM si le Titre ou Description contient des lettres répétées au hasard (yyyyy, aaaa, hbcccc).
2. SPAM si le contenu extrait est de la MUSIQUE, des paroles de chanson, du divertissement non-éducatif — quelle que soit la qualité.
3. SPAM si le contenu parle d'un sujet COMPLÈTEMENT DIFFÉRENT du titre (ex: titre="Leadership" mais contenu="recettes de cuisine").
4. SPAM si le contenu extrait est vide, muet ou du charabia.
5. VALIDE si le contenu correspond au titre et est éducatif/professionnel.
6. VALIDE si le contenu n'a pas pu être extrait (Whisper indisponible) mais le titre et la description sont sérieux.

EXEMPLES :
- Titre: "Leadership", Contenu: paroles d'une chanson → SPAM (musique hors-sujet, règle 2)
- Titre: "Finance", Contenu: "cours sur les marchés financiers" → VALIDE
- Titre: "Python", Contenu: "vidéo de cuisine" → SPAM (hors-sujet, règle 3)
- Titre: "Leadership", Contenu: "Aucun fichier disponible" → VALIDE avec réserve (règle 6)

Réponds UNIQUEMENT avec ce JSON (rien d'autre) :
{
  "status": "SPAM" ou "VALIDE",
  "reason": "Explication courte en 1 phrase",
  "confidence": 99
}`;

    return this.generateContent(prompt, 'llama3.2');
  }

  /**
   * Demande au service Whisper local de transcrire une vidéo via son chemin absolu
   */
  transcribeLocalVideo(filepath: string): Observable<string> {
    return this.http.post<{ text: string; language: string }>(
      'http://localhost:9000/transcribe',
      { filepath: filepath }
    ).pipe(
      map(res => res.text)
    );
  }

  /**
   * Upload direct d'un fichier File vers Whisper pour analyse admin (FormData)
   * Utilise /transcribe-video qui ne requiert pas roomId/username
   */
  transcribeVideo(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<{ text: string; language: string }>(
      'http://localhost:9000/transcribe-video',
      formData
    ).pipe(
      map(res => res.text)
    );
  }

  /**
   * Vérifie si le service Whisper est disponible
   */
  checkWhisperAvailable(): Observable<boolean> {
    return this.http.get<{ status: string }>('http://localhost:9000/health').pipe(
      map(res => res.status === 'ok'),
    );
  }

  /**
   * Télécharge un fichier distant et le retourne comme objet File utilisable.
   */
  downloadAsFile(url: string, filename: string): Observable<File> {
    return this.http.get(url, { responseType: 'blob' }).pipe(
      map(blob => new File([blob], filename, { type: blob.type || 'application/octet-stream' }))
    );
  }

  /**
   * Mode Accessibilité : simplifie un texte (issu de Whisper) pour les personnes sourdes.
   * Retourne un JSON avec un résumé court et des mots-clés visuels.
   */
  generateAccessibility(text: string): Observable<string> {
    const prompt = `Tu es un assistant d'accessibilité pour personnes sourdes ou malentendantes.
Transforme le texte suivant en un résumé ULTRA-SIMPLE et une liste de mots-clés visuels.
Tu DOIS répondre UNIQUEMENT avec ce JSON valide (rien d'autre, pas de markdown) :
{
  "resume": "Phrase très courte résumant le sujet principal (max 25 mots)",
  "mots_cles": ["Mot1", "Mot2", "Mot3", "Mot4", "Mot5"]
}

Texte à simplifier :
${text.substring(0, 2000)}`;
    return this.generateContent(prompt, 'llama3.2');
  }
}
