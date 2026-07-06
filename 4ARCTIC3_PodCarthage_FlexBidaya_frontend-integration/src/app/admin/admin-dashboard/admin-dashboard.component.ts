import { Component, OnInit } from '@angular/core';
import { InscriptionService, AlerteInactivite, MentorInscriptionVue, Certification, ProgressionLecon } from '../../formation/inscription.service';
import { FormationService, Formation } from '../../formation/formation.service';
import { OllamaService } from '../../formation/lecon-viewer/ollama.service';
import { PdfExtractorService } from '../../formation/lecon-viewer/pdf-extractor.service';
import { firstValueFrom } from 'rxjs';

type Tab = 'stats' | 'formations_attente';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {
  activeTab: Tab = 'stats';

  alertes: AlerteInactivite[] = [];
  vues: MentorInscriptionVue[] = [];
  certifications: Certification[] = [];
  progressionDetail: ProgressionLecon[] | null = null;
  detailInscriptionId: number | null = null;
  chargementDetail = false;
  editingRemarqueId: number | null = null;
  editedRemarque: string = '';

  // Nouveaux: Approve/Reject Formations
  formationsEnAttente: Formation[] = [];
  rejetMotif: { [formationId: number]: string } = {};
  showRejetInput: { [formationId: number]: boolean } = {};

  // Nouveaux: IA Spam Analysis
  isAnalysingIA: { [formationId: number]: boolean } = {};
  iaAnalysisResult: { [formationId: number]: { isSpam: boolean; status?: string; reason: string; confidence: number; contentExtracted?: boolean; extractError?: string | null } | null } = {};

  constructor(
    private inscriptionService: InscriptionService,
    private formationService: FormationService,
    private ollamaService: OllamaService,
    private pdfExtractor: PdfExtractorService
  ) {}

  ngOnInit(): void {
    this.chargerAlertes();
    this.chargerVueMentor();
    this.chargerCertifications();
    this.chargerFormationsEnAttente();
  }

  setTab(tab: Tab) { this.activeTab = tab; }

  chargerFormationsEnAttente() {
    this.formationService.getPending().subscribe(f => {
      this.formationsEnAttente = f;
      // Pre-fetch lecons for all pending formations so AI can access them quickly
      f.forEach(form => {
        this.formationService.getLecons(form.id).subscribe(lecons => {
           // We store them directly on the formation object for the AI function
           (form as any).leconsDetail = lecons;
        });
      });
    });
  }

  async analyserFormationIA(f: Formation) {
    this.isAnalysingIA[f.id] = true;
    this.iaAnalysisResult[f.id] = null;

    const titre = f.titre || '';
    const desc = f.description || '';
    const lecons = (f as any).leconsDetail || [];

    let extractedText: string | null = null;
    let extractionError: string | null = null;

    // ─────────────────────────────────────────────────────────────
    // HELPER: Détecte si un texte est du charabia
    // ─────────────────────────────────────────────────────────────
    const isGibberish = (text: string): boolean => {
      if (!text || text.trim().length < 3) return true;
      if (/(.)\\1{3,}/.test(text)) return true;
      const chars = text.replace(/\s/g, '');
      if (chars.length > 3) {
        const freq: {[k: string]: number} = {};
        for (const c of chars) freq[c] = (freq[c] || 0) + 1;
        const maxFreq = Math.max(...Object.values(freq));
        if (maxFreq / chars.length > 0.6) return true;
      }
      return false;
    };

    const setResult = (isSpam: boolean, reason: string, confidence: number) => {
      this.isAnalysingIA[f.id] = false;
      this.iaAnalysisResult[f.id] = { isSpam, status: isSpam ? 'SPAM' : 'VALIDE', reason, confidence, contentExtracted: !!extractedText, extractError: extractionError };
    };

    // ─────────────────────────────────────────────────────────────
    // ÉTAPE 1 : Vérification RAPIDE — charabia évident uniquement
    // (yyyyy, aaaa, iiiiii) → SPAM immédiat sans aller plus loin
    // Un titre court mais logique ("leadership", "finance") est VALIDE
    // ─────────────────────────────────────────────────────────────
    if (isGibberish(titre)) {
      return setResult(true, `Le titre "${titre}" contient du charabia ou des lettres répétées.`, 100);
    }
    if (isGibberish(desc)) {
      return setResult(true, `La description "${desc}" contient du charabia ou des lettres répétées.`, 100);
    }

    // ─────────────────────────────────────────────────────────────
    // ÉTAPE 2 : Extraction du contenu réel des leçons
    // ─────────────────────────────────────────────────────────────
    if (lecons.length === 0) {
      return setResult(false, 'Titre et description valides. Aucune leçon ajoutée encore — à re-analyser après ajout de contenu.', 60);
    }

    // Vérifier si Whisper est disponible
    let whisperAvailable = false;
    try {
      whisperAvailable = await firstValueFrom(this.ollamaService.checkWhisperAvailable());
    } catch {
      whisperAvailable = false;
    }

    // Essayer d'extraire le contenu de la première leçon avec fichier
    const leconAvecFichier = lecons.find((l: any) => l.cheminFichier);

    if (leconAvecFichier) {
      try {
        const cheminFichier = leconAvecFichier.cheminFichier;
        const type = cheminFichier.toLowerCase();
        const isVideo = type.endsWith('.mp4') || type.endsWith('.mov') || type.endsWith('.avi') || type.endsWith('.mkv');
        const isPdf = type.endsWith('.pdf') || type.endsWith('.ppt') || type.endsWith('.pptx');

        let p = cheminFichier.replace(/\\/g, '/');
        const url = p.startsWith('http') ? p : `http://localhost:8080/${p}`;
        const name = cheminFichier.split('/').pop() || 'file';

        if (isVideo) {
          if (whisperAvailable) {
            try {
              const file = await firstValueFrom(this.ollamaService.downloadAsFile(url, name));
              const transcription = await firstValueFrom(this.ollamaService.transcribeVideo(file));
              if (transcription && transcription.trim().length > 10) {
                extractedText = transcription;
                console.log('✅ Transcription Whisper réussie :', extractedText.substring(0, 100));
              } else {
                // Whisper a répondu mais pas de parole → vraiment muette
                extractedText = '[MUET]';
                console.warn('⚠️ Vidéo muette confirmée par Whisper');
              }
            } catch (e: any) {
              // Erreur lors de la transcription (ex: format non supporté)
              extractionError = `Transcription échouée : ${e.message || 'erreur inconnue'}`;
              console.warn('Whisper transcription error:', e.message);
            }
          } else {
            // Whisper n'est PAS lancé → ne pas marquer comme muet
            extractionError = 'Service Whisper non disponible (port 9000). La vidéo n\'a pas pu être analysée.';
            console.warn('⚠️ Whisper non disponible sur port 9000');
          }
        } else if (isPdf) {
          try {
            const file = await firstValueFrom(this.ollamaService.downloadAsFile(url, name));
            const content = await this.pdfExtractor.extractFromFile(file);
            const rawText = (content.text || content.sentences.join(' ')).trim();
            if (rawText.length > 30) {
              extractedText = rawText;
              console.log('✅ Extraction PDF réussie :', rawText.substring(0, 100));
            } else {
              extractionError = 'Le document est vide ou non lisible (PDF scanné/protégé ?).';
            }
          } catch (e: any) {
            extractionError = `Extraction PDF échouée : ${e.message || 'fichier inaccessible'}`;
          }
        }
      } catch (e: any) {
        extractionError = `Impossible d'accéder au fichier : ${e.message || 'erreur réseau'}`;
      }
    } else {
      extractionError = 'Aucune leçon ne contient de fichier attaché.';
    }

    // ─────────────────────────────────────────────────────────────
    // ÉTAPE 3 : Analyse du contenu extrait
    // ─────────────────────────────────────────────────────────────
    if (extractedText === '[MUET]') {
      return setResult(true, 'La vidéo ne contient aucune parole (muette confirmée par Whisper) — contenu invalide.', 98);
    }
    if (extractedText && isGibberish(extractedText.substring(0, 300))) {
      return setResult(true, 'Le contenu extrait du fichier contient du charabia ou des lettres au hasard.', 98);
    }

    // ─────────────────────────────────────────────────────────────
    // ÉTAPE 4 : Appel à Llama avec contexte complet
    // (titre + description + titres/types de toutes les leçons + contenu extrait)
    // ─────────────────────────────────────────────────────────────
    this.ollamaService.detectSpamFormation(titre, desc, lecons, extractedText).subscribe({
      next: (res) => {
        this.isAnalysingIA[f.id] = false;
        try {
          let jsonStr = res.trim();
          if (res.includes('```json')) jsonStr = res.split('```json')[1].split('```')[0].trim();
          else if (res.includes('```')) jsonStr = res.split('```')[1].split('```')[0].trim();
          
          // Vérifier si c'est bien du JSON avant de parser
          if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
            const parsed = JSON.parse(jsonStr);
            console.log('Réponse IA Llama:', parsed);
            const spamDetected = (parsed.status && parsed.status.toString().toUpperCase().includes('SPAM')) || parsed.isSpam === true;
            this.iaAnalysisResult[f.id] = { ...parsed, isSpam: spamDetected, status: spamDetected ? 'SPAM' : 'VALIDE', contentExtracted: !!extractedText, extractError: extractionError };
          } else {
            // Si ce n'est pas du JSON, c'est probablement un message d'erreur ou d'attente
            console.warn('Réponse IA non-JSON:', jsonStr);
            this.iaAnalysisResult[f.id] = { 
              isSpam: false, 
              reason: jsonStr, 
              confidence: 0, 
              contentExtracted: !!extractedText, 
              extractError: extractionError 
            };
          }
        } catch (e) {
          console.error('Erreur parsing IA:', e, res);
          this.iaAnalysisResult[f.id] = { isSpam: false, reason: "L'IA n'est pas encore prête ou a renvoyé un format invalide.", confidence: 0, contentExtracted: !!extractedText, extractError: extractionError };
        }
      },
      error: () => {
        this.isAnalysingIA[f.id] = false;
        this.iaAnalysisResult[f.id] = { isSpam: false, reason: 'Erreur de connexion avec le serveur IA local (Ollama/Llama).', confidence: 0, contentExtracted: false };
      }
    });
  }

  approuverFormation(id: number) {

    if (!confirm('Approuver cette formation et la rendre visible dans le catalogue ?')) return;
    this.formationService.approuver(id).subscribe(() => {
      this.chargerFormationsEnAttente();
    });
  }

  toggleRejetInput(id: number) {
    this.showRejetInput[id] = !this.showRejetInput[id];
    if (this.showRejetInput[id]) this.rejetMotif[id] = '';
  }

  rejeterFormation(id: number) {
    const motif = this.rejetMotif[id];
    if (!motif || motif.trim() === '') {
      alert('Veuillez fournir un motif de rejet.');
      return;
    }
    this.formationService.rejeter(id, motif).subscribe(() => {
      this.chargerFormationsEnAttente();
    });
  }

  // (Demandes de réouverture ont été déplacées vers le mentor)

  // Nouveaux: Visualisation des leçons par l'Admin
  leconsAffichees: any[] = [];
  formationSelectPourLecons: number | null = null;

  voirLecons(id: number) {
    if (this.formationSelectPourLecons === id) {
      this.formationSelectPourLecons = null;
      this.leconsAffichees = [];
      return;
    }
    this.formationSelectPourLecons = id;
    this.formationService.getLecons(id).subscribe(l => {
      this.leconsAffichees = l;
    });
  }

  chargerAlertes(): void {
    this.inscriptionService.getAlertes().subscribe((a) => (this.alertes = a));
  }

  chargerVueMentor(): void {
    this.inscriptionService.getVueMentor().subscribe((v) => (this.vues = v));
  }

  chargerCertifications(): void {
    this.inscriptionService.getCertificationsMentor().subscribe((c) => (this.certifications = c));
  }

  marquerLue(alerte: AlerteInactivite): void {
    this.inscriptionService.marquerLue(alerte.id).subscribe(() => { alerte.estLue = true; });
  }

  nombreAlertesNonLues(): number {
    return this.alertes.filter((a) => !a.estLue).length;
  }

  getTypeLabel(type: string): string {
    if (type === 'ALERTE_1J') return 'Inactif 1 jour +';
    return type === 'ALERTE_14J' ? 'Inactif 14 jours +' : 'Inactif 7 jours +';
  }

  ouvrirDetail(row: MentorInscriptionVue): void {
    if (this.detailInscriptionId === row.inscriptionId) {
      this.progressionDetail = null;
      this.detailInscriptionId = null;
      return;
    }
    this.detailInscriptionId = row.inscriptionId;
    this.chargementDetail = true;
    this.progressionDetail = null;
    this.inscriptionService.getProgression(row.inscriptionId).subscribe({
      next: (p) => { this.progressionDetail = p; this.chargementDetail = false; this.editingRemarqueId = null; },
      error: () => (this.chargementDetail = false),
    });
  }

  startEditRemarque(p: ProgressionLecon): void {
    this.editingRemarqueId = p.id;
    this.editedRemarque = p.remarqueMentor || '';
  }

  saveRemarque(p: ProgressionLecon): void {
    if (!this.editingRemarqueId) return;
    const old = p.remarqueMentor;
    p.remarqueMentor = this.editedRemarque;
    this.inscriptionService.updateProgression(p.id, p).subscribe({
      next: () => { this.editingRemarqueId = null; },
      error: () => { p.remarqueMentor = old; alert('Erreur sauvegarde.'); }
    });
  }

  cancelEditRemarque(): void { this.editingRemarqueId = null; }

  telechargerCert(token: string): void {
    this.inscriptionService.ouvrirCertificat(token);
  }

  labelStatut(statut: string): string {
    const labels: Record<string, string> = { EN_COURS: 'En cours', TERMINEE: 'Terminée', NON_COMMENCEE: 'Non commencée' };
    return labels[statut] ?? statut;
  }

  iconeLecon(statut: string): string {
    if (statut === 'COMPLETE') return 'check_circle';
    if (statut === 'EN_COURS') return 'pending';
    return 'radio_button_unchecked';
  }
}