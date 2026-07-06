import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormationService, Lecon } from '../formation.service';
import { InscriptionService } from '../inscription.service';
import { TestFormationService } from '../test-formation.service';
import { TestFormation } from '../test-formation.model';
import { PdfExtractorService, ExtractedContent } from './pdf-extractor.service';
import { OllamaService } from './ollama.service';
import { forkJoin } from 'rxjs';

export type SmartLearnMode = null | 'quiz' | 'mindmap' | 'summary' | 'exam';
export type SmartLearnStep = 'upload' | 'analyzing' | 'ready' | 'result';

interface SmartQuizQuestion {
  question: string;
  choices: string[];
  correct: number;
  userAnswer: number | null;
  revealed: boolean;
}

interface SmartMindmapNode {
  label: string;
  children: string[];
}

interface SmartExamQuestion {
  question: string;
  points: number;
  hint: string;
}

interface SmartSummary {
  intro: string;
  points: string[];
  vocab: string[];
}

export interface SmartLearnState {
  step: SmartLearnStep;
  mode: SmartLearnMode;
  fileName: string;
  fileSize: string;
  analyzeStep: number;
  quiz: SmartQuizQuestion[];
  mindmap: SmartMindmapNode[];
  exam: SmartExamQuestion[];
  summary: SmartSummary | null;
  quizScore: number | null;
  quizSubmitted: boolean;
  isGenerating: boolean;
  transcriptionStatus: 'none' | 'success' | 'fallback' | 'error';
  transcriptionPreview: string;
}

@Component({
  selector: 'app-lecon-viewer',
  templateUrl: './lecon-viewer.component.html',
  styleUrls: ['./lecon-viewer.component.css']
})
export class LeconViewerComponent implements OnInit {
  @ViewChild('videoPlayer') videoPlayer?: ElementRef<HTMLVideoElement>;
  @ViewChild('slFileInput') slFileInput?: ElementRef<HTMLInputElement>;

  inscriptionId!: number;
  formationId!: number;
  lecons: Lecon[] = [];
  leconActive?: Lecon;
  progressions: { [leconId: number]: string } = {};
  progressionIds: { [leconId: number]: number } = {}; // <--- ADDED
  tempsDebut = 0;
  chargement = true;
  message = '';
  isDragging = false;

  // Extracted content from the uploaded file
  private extractedContent: ExtractedContent | null = null;
  smartLearn: SmartLearnState = this.blankSmartLearn();

  examenFormation?: TestFormation;
  examenConfirme = false;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formationService: FormationService,
    private inscriptionService: InscriptionService,
    private testFormationService: TestFormationService,
    private pdfExtractor: PdfExtractorService,
    private ollamaService: OllamaService
  ) { }

  ngOnInit(): void {
    this.inscriptionId = +this.route.snapshot.params['inscriptionId'];
    this.formationId = +this.route.snapshot.params['formationId'];

    forkJoin([
      this.formationService.getLecons(this.formationId),
      this.inscriptionService.getProgression(this.inscriptionId),
      this.testFormationService.getAllExamens()
    ]).subscribe(([lecons, progressions, examens]) => {
      this.lecons = lecons;
      progressions.forEach(p => {
        this.progressions[p.lecon.id] = p.statut;
        this.progressionIds[p.lecon.id] = p.id;
      });
      
      this.examenFormation = examens.find(e => {
         // Because of Transient field vs Relationship handling
         const idF = e.formation ? e.formation.id : e.formationId;
         return idF === this.formationId;
      });

      this.chargement = false;
    });
  }

  blankSmartLearn(): SmartLearnState {
    return {
      step: 'upload',
      mode: null,
      fileName: '',
      fileSize: '',
      analyzeStep: 0,
      quiz: [],
      mindmap: [],
      exam: [],
      summary: null,
      quizScore: null,
      quizSubmitted: false,
      isGenerating: false,
      transcriptionStatus: 'none',
      transcriptionPreview: ''
    };
  }

  // ══════════════════════════════════════════════════════
  // LESSON NAVIGATION
  // ══════════════════════════════════════════════════════
  choisirLecon(lecon: Lecon): void {
    if (this.isLocked(lecon)) {
      const idx = this.lecons.indexOf(lecon);
      const prev = this.lecons[idx - 1];
      this.message = `⚠️ Veuillez d'abord terminer : "${prev?.titre || 'la leçon précédente'}"`;
      return;
    }
    this.message = '';
    this.leconActive = lecon;
    this.smartLearn = this.blankSmartLearn();
    this.extractedContent = null;
    this.tempsDebut = Date.now();
    if (this.videoPlayer) this.videoPlayer.nativeElement.load();
  }



  // ══════════════════════════════════════════════════════
  // SMARTLEARN — Upload & Analyse (NotebookLM flow)
  // ══════════════════════════════════════════════════════
  triggerFileInput() {
    this.slFileInput?.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  useLeconFile() {
    if (!this.leconActive) return;

    const url = this.getMediaUrl(this.leconActive.cheminFichier, this.leconActive.type);
    const rawName = this.leconActive.cheminFichier?.split('/').pop() || (this.leconActive.titre + '.pdf');
    const name = rawName.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '');
    const isVideo = name.toLowerCase().endsWith('.mp4') || name.toLowerCase().endsWith('.mov');

    this.smartLearn.fileName = name;
    this.smartLearn.step = 'analyzing';
    this.smartLearn.analyzeStep = 0;

    // --- VIDÉO : télécharger puis transcrire avec Whisper ---
    if (isVideo && this.leconActive.cheminFichier) {
      this.smartLearn.fileSize = '🎙️ Téléchargement vidéo...';
      const url = this.getMediaUrl(this.leconActive.cheminFichier, this.leconActive.type);
      const rawName = this.leconActive.cheminFichier.split('/').pop() || 'video.mp4';

      this.ollamaService.downloadAsFile(url, rawName).subscribe({
        next: (videoFile) => {
          this.smartLearn.fileSize = '🎙️ Transcription Whisper en cours...';
          this.ollamaService.transcribeVideo(videoFile).subscribe({
            next: (transcript) => {
              if (transcript && transcript.trim().length > 50) {
                console.log(`✅ Whisper SmartLearn : ${transcript.length} caractères transcrits`);
                this.extractedContent = this.pdfExtractor.extractFromText(transcript);
              } else {
                console.warn('⚠️ Transcription vide ou trop courte — fallback titre');
                this.extractedContent = this.buildVideoContextFromTitle();
              }
              this.animateAnalysis();
            },
            error: (err) => {
              console.warn('⚠️ Whisper non disponible :', err.message);
              this.extractedContent = this.buildVideoContextFromTitle();
              this.animateAnalysis();
            }
          });
        },
        error: (err) => {
          console.error('Erreur téléchargement vidéo :', err);
          this.extractedContent = this.buildVideoContextFromTitle();
          this.animateAnalysis();
        }
      });
      return;
    }

    // --- PDF & DOCUMENTS : télécharger et extraire le texte ---
    this.smartLearn.fileSize = 'Téléchargement...';
    this.ollamaService.downloadAsFile(url, name).subscribe({
      next: (file) => {
        this.processFile(file);
      },
      error: (err) => {
        console.error('Erreur téléchargement fichier leçon:', err);
        this.extractedContent = this.buildVideoContextFromTitle();
        this.animateAnalysis();
      }
    });
  }

  private async processFile(file: File) {
    const sizeLabel = file.size > 1024 * 1024
      ? (file.size / 1024 / 1024).toFixed(1) + ' Mo'
      : Math.round(file.size / 1024) + ' Ko';

    const name = file.name.toLowerCase();
    const isVideo = name.endsWith('.mp4') || name.endsWith('.mov') ||
                    name.endsWith('.avi') || name.endsWith('.mkv') || name.endsWith('.webm');

    this.smartLearn.fileName = file.name;
    this.smartLearn.fileSize = sizeLabel;
    this.smartLearn.step = 'analyzing';
    this.smartLearn.analyzeStep = 0;

    if (isVideo) {
      // Tentative de transcription réelle avec Whisper (/transcribe-video)
      this.smartLearn.fileSize = '🎙️ Whisper transcrit la vidéo... (peut prendre 1-2 min)';
      this.ollamaService.transcribeVideo(file).subscribe({
        next: (transcript) => {
          if (transcript && transcript.trim().length > 50) {
            console.log(`✅ Whisper SmartLearn : ${transcript.length} chars transcrits`);
            this.extractedContent = this.pdfExtractor.extractFromText(transcript);
            this.smartLearn.transcriptionStatus = 'success';
            this.smartLearn.transcriptionPreview = transcript.substring(0, 200);
            this.smartLearn.fileSize = `✅ Transcription : ${transcript.length} caractères`;
          } else {
            // Whisper n'a pas détecté de parole (vidéo muette ou musique)
            this.smartLearn.transcriptionStatus = 'error';
            this.smartLearn.fileSize = '⚠️ Aucune parole détectée dans la vidéo';
            this.extractedContent = null;
          }
          this.animateAnalysis();
        },
        error: (err) => {
          console.warn('⚠️ Whisper non disponible :', err.message);
          this.smartLearn.transcriptionStatus = 'error';
          this.smartLearn.fileSize = '❌ Whisper indisponible — relancez whisper_service.py';
          this.extractedContent = null;
          this.animateAnalysis();
        }
      });
      return;
    }

    // Pour les fichiers textuels (PDF, TXT, PPTX)
    try {
      this.extractedContent = await this.pdfExtractor.extractFromFile(file);
    } catch (e) {
      console.error('Extraction failed:', e);
      this.extractedContent = this.pdfExtractor.extractFromText(
        `Le document ${file.name} aborde l'entrepreneuriat.`
      );
    }

    this.animateAnalysis();
  }

  demanderReouverture() {
    const pId = this.progressionIds[this.leconActive?.id || 0];
    if (!pId) return;
    
    if (!confirm('Voulez-vous vraiment demander la réouverture de cette leçon (le quiz devra être repassé) ?')) return;

    this.inscriptionService.demanderReouverture(pId).subscribe({
      next: (updated) => {
        alert('Demande envoyée ! En attente de validation.');
        // On pourrait mettre à jour le state localement pour afficher un status "En attente de réouverture" si on avait un flag dans le composant
      },
      error: (err) => {
        console.error('Erreur demande réouverture', err);
        alert('Erreur lors de la demande de réouverture.');
      }
    });
  }

  /** Construit un contexte textuel riche à partir du titre de la leçon active */
  private buildVideoContextFromTitle(): any {
    const titre = this.leconActive?.titre || 'contenu de la leçon';
    const motsClés = titre.split(' ').filter((w: string) => w.length > 3).join(', ');
    const contextText = `Cette leçon vidéo est intitulée "${titre}".
    Elle aborde en profondeur les concepts et compétences liés à ce domaine.
    Objectifs pédagogiques : comprendre les principes fondamentaux de "${titre}",
    maîtriser les notions clés, et les appliquer dans un contexte professionnel réel.
    Mots-clés : ${motsClés}.
    Les étudiants apprendront à analyser, évaluer et mettre en pratique les enseignements de cette leçon.`;
    return this.pdfExtractor.extractFromText(contextText);
  }

  private animateAnalysis() {
    const delays = [600, 1200, 1800, 2400];
    delays.forEach((ms, i) => {
      setTimeout(() => {
        this.smartLearn.analyzeStep = i + 1;
        if (i === delays.length - 1) {
          setTimeout(() => {
            this.smartLearn.step = 'ready';
          }, 400);
        }
      }, ms);
    });
  }

  private startAnalysis(name: string, size: string) {
    this.smartLearn.fileName = name;
    this.smartLearn.fileSize = size;
    this.smartLearn.step = 'analyzing';
    this.smartLearn.analyzeStep = 0;
    this.animateAnalysis();
  }

  resetSmartLearn() {
    this.smartLearn = this.blankSmartLearn();
    this.extractedContent = null;
  }

  // ══════════════════════════════════════════════════════
  // GÉNÉRATION IA basée sur le VRAI contenu extrait
  // ══════════════════════════════════════════════════════
  generateTool(mode: SmartLearnMode) {
    this.smartLearn.mode = mode;
    this.smartLearn.isGenerating = true;
    this.smartLearn.quizScore = null;
    this.smartLearn.quizSubmitted = false;
    // Keep step as 'ready' so the tool buttons stay visible with loading indicator
    this.smartLearn.step = 'ready';

    const content = this.extractedContent
      || this.pdfExtractor.extractFromText(this.smartLearn.fileName);

    const txtContent = content.text || content.sentences.join(' ');
    // Tronquer à 3500 caractères pour ne pas surcharger la RAM locale d'Ollama
    const textContext = txtContent.substring(0, 3500);

    const finalize = () => {
      this.smartLearn.isGenerating = false;
      this.smartLearn.step = 'result';
    };
    const onError = () => {
      this.smartLearn.isGenerating = false;
      this.smartLearn.step = 'ready';
    };

    switch (mode) {
      case 'quiz':
        this.ollamaService.generateQuiz(textContext).subscribe({
          next: (res) => {
            try {
              let jsonRes = res;
              if (res.includes('```json')) {
                jsonRes = res.split('```json')[1].split('```')[0].trim();
              } else if (res.includes('```')) {
                jsonRes = res.split('```')[1].split('```')[0].trim();
              }
              let parsedQuiz = JSON.parse(jsonRes);
              this.smartLearn.quiz = parsedQuiz.map((q: any) => ({
                ...q,
                choices: q.choices || q.options || [],
                userAnswer: null,
                revealed: false
              }));
              finalize();
            } catch (e) {
              console.error('Erreur parsing JSON Quiz', e);
              onError();
            }
          },
          error: onError
        });
        break;

      case 'mindmap':
        this.ollamaService.generateMindmap(textContext).subscribe({
          next: (res) => {
            try {
              // Extraction robuste du tableau JSON
              const jsonMatch = res.match(/\[\s*\{[\s\S]*\}\s*\]/);
              let jsonRes = jsonMatch ? jsonMatch[0] : res;
              
              let parsedMap = JSON.parse(jsonRes);
              
              // Nettoyage pour empêcher les [object Object] dans le HTML
              this.smartLearn.mindmap = parsedMap.map((node: any) => {
                return {
                  label: node.label || node.title || 'Concept',
                  children: (node.children || []).map((child: any) => {
                    if (typeof child === 'string') return child;
                    return child.text || child.label || child.description || JSON.stringify(child);
                  })
                };
              });
              finalize();
            } catch (e) {
              console.error('Erreur parsing JSON Mindmap:', e);
              let cleanMap = res.replace(/```.*/gi, '').trim();
              const lines = cleanMap.split('\n')
                .filter((l: string) => l.trim().length > 2)
                .map((l: string) => l.replace(/^[-*•]\s*/, '').replace(/[\{\}\[\]"]/g, '').trim());
              this.smartLearn.mindmap = [{ label: 'Concepts Extraits', children: lines.slice(0, 5) }];
              finalize();
            }
          },
          error: onError
        });
        break;

      case 'summary':
        this.ollamaService.generateSummary(textContext).subscribe({
          next: (res) => {
            let cleanRes = res;
            if (res.includes('```html')) {
              cleanRes = res.split('```html')[1].split('```')[0].trim();
            } else if (res.includes('```')) {
              cleanRes = res.split('```')[1].split('```')[0].trim();
            }
            this.smartLearn.summary = { intro: cleanRes, points: [], vocab: content.keywords.slice(0, 5) };
            finalize();
          },
          error: onError
        });
        break;

      case 'exam':
        this.ollamaService.generateExam(textContext).subscribe({
          next: (res) => {
            try {
              // Extraction robuste
              const jsonMatch = res.match(/\[\s*\{[\s\S]*\}\s*\]/);
              let jsonRes = jsonMatch ? jsonMatch[0] : res;
              
              this.smartLearn.exam = JSON.parse(jsonRes);
              finalize();
            } catch (e) {
              console.error('Erreur parsing JSON Exam', e);
              // Fallback simple si JSON invalide
              this.smartLearn.exam = [
                { question: "Expliquez avec vos propres mots l'idée principale du document.", points: 5, hint: "Soyez synthétique" },
                { question: "Donnez un exemple d'application des concepts vus.", points: 5, hint: "Basez-vous sur une expérience réelle" }
              ];
              finalize();
            }
          },
          error: onError
        });
        break;
    }
  }

  // ── Quiz : uses REAL sentences from the document ──────────────
  private buildQuiz(c: ExtractedContent): SmartQuizQuestion[] {
    const sentences = this.pdfExtractor.pickSentences(c.sentences, 8);
    const kw = c.keywords;
    const questions: SmartQuizQuestion[] = [];

    // Q1 — from first meaningful sentence
    if (sentences[0]) {
      const correct = sentences[0].substring(0, 120);
      questions.push({
        question: `Quelle affirmation est correcte selon le document ?`,
        choices: this.shuffleWithCorrect(correct, [
          `Cela n'est pas mentionné dans le document`,
          `C'est l'opposé de ce qui est décrit`,
          `Cette notion est hors sujet`
        ], 0),
        correct: 0, userAnswer: null, revealed: false
      });
    }

    // Q2 — keyword-based
    if (kw[0] && kw[1]) {
      questions.push({
        question: `Parmi ces termes, lequel est un concept clé abordé dans ce document ?`,
        choices: this.shuffleWithCorrect(kw[0], [
          `Notion non liée au contenu`,
          `Terme inventé`,
          `Concept d'un autre domaine`
        ], 0),
        correct: 0, userAnswer: null, revealed: false
      });
    }

    // Q3 — from another sentence
    if (sentences[2]) {
      const extract = sentences[2].substring(0, 100);
      questions.push({
        question: `Le document affirme que : "${extract.substring(0, 70)}..." — Cette affirmation est :`,
        choices: [
          `Vraie et bien detaillée dans le texte`,
          `Fausse selon le contexte du document`,
          `Partiellement vraie mais incomplète`,
          `Hors du périmètre de cette leçon`
        ],
        correct: 0, userAnswer: null, revealed: false
      });
    }

    // Q4 — vocabulary test
    if (kw.length >= 3) {
      questions.push({
        question: `Quel est le thème principal développé dans ce document ?`,
        choices: this.shuffleWithCorrect(
          `${kw[0]}, ${kw[1]} et leurs applications`,
          [
            `Des notions sans lien avec le sujet`,
            `Un concept avancé non traité ici`,
            `Une introduction à un autre domaine`
          ], 0
        ),
        correct: 0, userAnswer: null, revealed: false
      });
    }

    return questions.slice(0, 4);
  }

  private shuffleWithCorrect(correct: string, wrong: string[], correctIdx: number): string[] {
    const all = [correct, ...wrong.slice(0, 3)];
    // Place correct at index correctIdx (0)
    return all;
  }

  // ── MindMap : uses REAL keywords & paragraphs ─────────────────
  private buildMindmap(c: ExtractedContent): SmartMindmapNode[] {
    const kw = c.keywords;
    const sentences = c.sentences;

    // Group sentences by keyword proximity
    const nodes: SmartMindmapNode[] = [];

    // Main theme from first 2 keywords
    if (kw.length > 0) {
      nodes.push({
        label: `🎯 ${kw[0]}`,
        children: sentences.slice(0, 3).map(s =>
          s.length > 80 ? s.substring(0, 80) + '...' : s
        ).filter(s => s.length > 10)
      });
    }

    // Second concept
    if (kw.length > 1) {
      nodes.push({
        label: `⚙️ ${kw[1]}`,
        children: sentences.slice(3, 6).map(s =>
          s.length > 80 ? s.substring(0, 80) + '...' : s
        ).filter(s => s.length > 10)
      });
    }

    // Vocabulary cluster
    if (kw.length > 3) {
      nodes.push({
        label: `📖 Concepts associés`,
        children: kw.slice(2, 7).map(k => `→ ${k}`)
      });
    }

    // Key ideas from remaining sentences
    if (sentences.length > 6) {
      nodes.push({
        label: `💡 Points essentiels`,
        children: sentences.slice(6, 10).map(s =>
          s.length > 80 ? s.substring(0, 80) + '...' : s
        ).filter(s => s.length > 10)
      });
    }

    return nodes.filter(n => n.children.length > 0);
  }

  // ── Summary : REAL content ────────────────────────────────────
  private buildSummary(c: ExtractedContent): SmartSummary {
    const intro = c.sentences.slice(0, 3).join('. ').substring(0, 400);
    const keyPoints = c.sentences
      .slice(3, 10)
      .map(s => s.length > 120 ? s.substring(0, 120) + '...' : s)
      .filter(s => s.length > 20);

    return {
      intro: intro || 'Contenu extrait du document.',
      points: keyPoints.length > 0 ? keyPoints : [`Contenu principal : ${c.keywords.slice(0, 5).join(', ')}`],
      vocab: c.keywords.slice(0, 8)
    };
  }

  // ── Exam : based on REAL content ──────────────────────────────
  private buildExam(c: ExtractedContent): SmartExamQuestion[] {
    const sentences = c.sentences;
    const kw = c.keywords;
    const excerpt = this.pdfExtractor.getExcerpt(c.text, 200);

    return [
      {
        question: `Expliquez avec vos propres mots le passage suivant extrait du document : "${sentences[0]?.substring(0, 150) || excerpt}"`,
        points: 4,
        hint: `💡 Reformulez en montrant que vous avez compris le sens et le contexte.`
      },
      {
        question: `Le document aborde "${kw[0] || 'ce concept'}". Donnez 2 exemples concrets illustrant cette notion.`,
        points: 4,
        hint: `💡 Basez-vous uniquement sur ce qui est mentionné dans le texte.`
      },
      {
        question: `Analysez la relation entre "${kw[0] || 'concept A'}" et "${kw[1] || 'concept B'}" telle qu'elle est développée dans le document.`,
        points: 5,
        hint: `💡 Identifiez comment ces deux notions interagissent selon le texte.`
      },
      {
        question: `Quel est l'argument principal du document ? Citez un passage qui le soutient directement.`,
        points: 4,
        hint: `💡 Utilisez une citation exacte entre guillemets, puis expliquez son importance.`
      },
      {
        question: `Comment appliqueriez-vous les enseignements de ce document dans votre contexte professionnel ou entrepreneurial ?`,
        points: 3,
        hint: `💡 Reliez le contenu théorique à une situation concrète de votre parcours.`
      }
    ];
  }

  // ── Quiz interaction ──────────────────────────────────────────
  answerQuiz(qIdx: number, aIdx: number) {
    if (this.smartLearn.quizSubmitted) return;
    this.smartLearn.quiz[qIdx].userAnswer = aIdx;
  }

  submitSmartQuiz() {
    if (this.smartLearn.quizSubmitted) return;
    this.smartLearn.quizSubmitted = true;
    this.smartLearn.quiz.forEach(q => q.revealed = true);
    const correct = this.smartLearn.quiz.filter(q => q.userAnswer === q.correct).length;
    this.smartLearn.quizScore = Math.round((correct / this.smartLearn.quiz.length) * 100);

    const tempsMin = Math.round((Date.now() - this.tempsDebut) / 60000) || 1;
    if (this.leconActive) {
      this.inscriptionService.completerLecon(
        this.inscriptionId, this.leconActive.id, this.smartLearn.quizScore, tempsMin
      ).subscribe({
        next: () => {
          this.progressions[this.leconActive!.id] = 'COMPLETE';
          this.message = `✅ Leçon terminée ! Score : ${this.smartLearn.quizScore}%`;
        },
        error: () => {}
      });
    }
  }

  // ── File helpers ──────────────────────────────────────────────
  getFileIcon(): string {
    const n = this.smartLearn.fileName.toLowerCase();
    if (n.endsWith('.pdf')) return '📋';
    if (n.endsWith('.ppt') || n.endsWith('.pptx')) return '📊';
    if (n.endsWith('.mp4') || n.endsWith('.mov')) return '🎬';
    if (n.endsWith('.txt')) return '📄';
    return '📁';
  }

  // ══════════════════════════════════════════════════════
  // DOWNLOAD, COMPLETE, ETC.
  // ══════════════════════════════════════════════════════
  downloadLecon(): void {
    if (!this.leconActive) return;
    const url = this.getMediaUrl(this.leconActive.cheminFichier, this.leconActive.type);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.leconActive.titre || 'lecon';
    a.target = '_blank';
    a.click();
  }

  _terminerLecon(): void {
    if (!this.leconActive) return;
    const tempsMin = Math.round((Date.now() - this.tempsDebut) / 60000) || 1;
    this.inscriptionService.completerLecon(this.inscriptionId, this.leconActive.id, 100, tempsMin)
      .subscribe({
        next: () => {
          this.progressions[this.leconActive!.id] = 'COMPLETE';
          this.message = '✅ Leçon marquée comme terminée';
        },
        error: (e) => {
          let msg = 'Erreur serveur';
          if (e && e.error) {
             msg = typeof e.error === 'string' ? e.error : (e.error.message || e.error.error || JSON.stringify(e.error));
          } else if (e && e.message) {
             msg = e.message;
          }
          this.message = '❌ ' + msg;
        }
      });
  }

  statutLecon(lecon: Lecon): string { return this.progressions[lecon.id] || 'NON_VU'; }

  isLocked(lecon: Lecon): boolean {
    const idx = this.lecons.indexOf(lecon);
    if (idx <= 0) return false; // La première leçon n'est jamais bloquée
    
    // Vérifier si au moins une leçon avant celle-ci n'est pas COMPLETE
    return this.lecons.slice(0, idx).some(l => this.progressions[l.id] !== 'COMPLETE');
  }

  isPdf(chemin?: string): boolean { return !!chemin?.toLowerCase().endsWith('.pdf'); }

  isLastLessonActive(): boolean {
    if (!this.lecons.length || !this.leconActive) return false;
    return this.lecons[this.lecons.length - 1].id === this.leconActive.id;
  }

  confirmerExamen() {
    this.examenConfirme = true;
    this.message = "✅ Examen ajouté à votre calendrier ! Vous pouvez passer l'examen quand vous serez prêt.";
  }

  getProgressPct(): number {
    if (!this.lecons.length) return 0;
    const done = this.lecons.filter(l => this.progressions[l.id] === 'COMPLETE').length;
    return Math.round((done / this.lecons.length) * 100);
  }

  retour(): void { this.router.navigate(['/mes-formations']); }

  /**
   * Construit l'URL media pour afficher un fichier de leçon.
   * - Si c'est une URL complète (Google Drive, etc.) → retourner telle quelle
   * - Si c'est un chemin local → préfixer avec localhost:8080
   */
  getMediaUrl(chemin?: string, type?: string): string {
    if (!chemin) return '';
    let p = chemin.replace(/\\/g, '/');

    // URLs complètes (Google Drive, etc.) → retourner directement
    if (p.startsWith('http://') || p.startsWith('https://')) {
      return p;
    }

    // Chemin local legacy
    if (p.includes('Downloads/')) return `http://localhost:8080/legacy-downloads/${p.split('Downloads/')[1]}`;
    return `http://localhost:8080/${p}`;
  }

  /**
   * Vérifie si l'URL pointe vers Google Drive (nécessite un iframe au lieu de <video>)
   */
  isDriveUrl(chemin?: string): boolean {
    if (!chemin) return false;
    return chemin.includes('drive.google.com') || chemin.includes('googleusercontent.com');
  }

}
