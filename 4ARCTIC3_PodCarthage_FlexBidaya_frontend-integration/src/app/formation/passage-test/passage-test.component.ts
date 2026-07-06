import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { TestFormationService } from '../test-formation.service';
import { TestFormation, ReponseTest, QuestionTest } from '../test-formation.model';
import { SoumissionTest } from '../test-formation.model';
import { ActivatedRoute, Router } from '@angular/router';
import { PaiementService } from '../paiement.service';
import { InscriptionService, Inscription, Certification } from '../inscription.service';
import { Subscription, interval } from 'rxjs';

// face-api.js chargé depuis le CDN (index.html)
declare const faceapi: any;

@Component({
  selector: 'app-passage-test',
  templateUrl: './passage-test.component.html',
  styleUrls: ['./passage-test.component.css']
})
export class PassageTestComponent implements OnInit, OnDestroy {
  test: TestFormation | null = null;
  reponses: ReponseTest[] = [];
  entrepreneurId!: number;

  // State
  loading = true;
  paiementRequis = false;
  testDemarre = false;
  soumis = false;
  score = 0;
  testId!: number;
  inscriptionId?: number;
  reussi = false;           // true si score >= seuil (QCM pur)
  certToken: string | null = null;   // token du certificat blockchain si disponible
  certCheckDone = false;   // évite les appels multiples
  showPaymentModal = false; // modal de paiement custom

  // Timer
  tempsRestant = 0; // en secondes
  timerSubscription?: Subscription;

  // Security & Anti-Cheat
  infractions = 0;
  maxInfractions = 3;
  cameraStream: MediaStream | null = null;
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('faceCanvas') faceCanvas!: ElementRef<HTMLCanvasElement>;

  // Détection de visage
  faceDetected = true;
  faceDetectionActive = false;
  consecutiveNoFace = 0;
  faceDetectionInterval?: any;
  faceModelLoaded = false;

  // Anti-cheat notification (non-blocking, replaces alert())
  infractionEnCours = false;       // Lock to prevent duplicate fraud triggers
  notificationVisible = false;
  notificationMotif = '';
  notificationAutoClose?: any;

  constructor(
    private testService: TestFormationService,
    private route: ActivatedRoute,
    private paiementService: PaiementService,
    private router: Router,
    private inscriptionService: InscriptionService
  ) { }

  ngOnInit(): void {
    this.entrepreneurId = Number(localStorage.getItem('userId'));
    this.testId = Number(this.route.snapshot.paramMap.get('testId'));

    setInterval(() => { }, 1000);
    this.chargerTest();
  }

  // --- ANTI-CHEAT LISTENERS ---
  @HostListener('contextmenu', ['$event'])
  onRightClick(event: Event) {
    if (this.testDemarre && !this.soumis) {
      event.preventDefault();
    }
  }

  @HostListener('copy', ['$event'])
  @HostListener('cut', ['$event'])
  @HostListener('paste', ['$event'])
  onClipboard(event: Event) {
    if (this.testDemarre && !this.soumis) {
      event.preventDefault();
      this.enregistrerInfraction('Tentative de copier/coller détectée.');
    }
  }

  @HostListener('window:blur', ['$event'])
  onWindowBlur(event: Event) {
    // Only register if test is active and no infraction notification is currently showing
    if (this.testDemarre && !this.soumis && !this.infractionEnCours) {
      this.enregistrerInfraction('Sortie de l\'onglet ou changement de fenêtre détecté.');
    }
  }

  @HostListener('document:fullscreenchange', ['$event'])
  onFullscreenChange(event: Event) {
    if (this.testDemarre && !this.soumis && !document.fullscreenElement && !this.infractionEnCours) {
      this.enregistrerInfraction('Sortie du mode plein écran détectée.');
      document.documentElement.requestFullscreen().catch(() => { });
    }
  }

  enregistrerInfraction(motif: string) {
    if (this.soumis || this.infractionEnCours) return;

    this.infractionEnCours = true; // Lock: prevent duplicate events while notification is open
    this.infractions++;
    console.warn(`[ANTI-CHEAT] Infraction #${this.infractions}: ${motif}`);

    if (this.infractions >= this.maxInfractions) {
      // Final infraction → submit immediately without waiting
      this.notificationMotif = motif;
      this.notificationVisible = true;
      setTimeout(() => {
        this.notificationVisible = false;
        this.infractionEnCours = false;
        this.soumettre();
      }, 3000); // Give 3 seconds to read the message before auto-submit
    } else {
      // Warning: show non-blocking notification and allow continuing
      this.notificationMotif = motif;
      this.notificationVisible = true;
      if (this.notificationAutoClose) clearTimeout(this.notificationAutoClose);
      this.notificationAutoClose = setTimeout(() => {
        this.notificationVisible = false;
        this.infractionEnCours = false; // Unlock after notification is gone
      }, 4000); // Dismiss after 4 seconds, then student can continue
    }
  }

  fermerNotification() {
    this.notificationVisible = false;
    if (this.notificationAutoClose) clearTimeout(this.notificationAutoClose);
    // Unlock only if we're not at max infractions yet
    if (this.infractions < this.maxInfractions) {
      this.infractionEnCours = false;
    }
  }
  // ----------------------------

  chargerTest() {
    this.loading = true;
    const urlInsId = this.route.snapshot.queryParamMap.get('inscriptionId');
    if (urlInsId) {
      this.inscriptionId = Number(urlInsId);
    }

    this.testService.getExamen(this.testId, this.entrepreneurId).subscribe({
      next: (res: TestFormation) => {
        this.test = res;
        this.paiementRequis = false;
        if (!this.inscriptionId) this.chercherInscriptionId();
        else this.verifierSoumissionExistante();
      },
      error: (err: any) => {
        if (err.status === 402) {
          this.paiementRequis = true;
          this.recupererInfosTestPourPaiement();
        } else {
          this.loading = false;
          console.error("Erreur lors du chargement du test", err);
        }
      }
    });
  }

  recupererInfosTestPourPaiement() {
    this.testService.getAllExamens().subscribe((exams: TestFormation[]) => {
      const t = exams.find(e => e.id === this.testId);
      if (t) {
        this.test = t;
        if (!this.inscriptionId) this.chercherInscriptionId();
        else this.loading = false;
      } else {
        this.loading = false;
      }
    });
  }

  chercherInscriptionId() {
    const fId = this.test?.formation?.id || this.test?.formationId;
    if (!fId) { this.loading = false; return; }

    this.inscriptionService.getMesFormations(this.entrepreneurId).subscribe((inscriptions: Inscription[]) => {
      const ins = inscriptions.find((i: Inscription) => i.formation?.id === fId);
      if (ins) this.inscriptionId = ins.id;
      this.verifierSoumissionExistante();
    });
  }

  verifierSoumissionExistante() {
    this.testService.getMesSoumissions(this.entrepreneurId).subscribe((soumissions: SoumissionTest[]) => {
      const existante = soumissions.find(s => s.testFormation?.id === this.testId);
      if (existante) {
        // Examen déjà passé ! On bloque l'accès et on affiche le résultat.
        this.soumis = true;
        this.score = existante.scoreObtenu || 0;
        this.infractions = existante.tentativeFraude ? this.maxInfractions : 0;
        this.reussi = this.test?.scoreSeuil != null && this.score >= this.test.scoreSeuil;
        
        if (this.reussi && this.infractions < this.maxInfractions) {
           this.rechercherCertificat();
        }
      }
      this.loading = false;
    }, () => {
      this.loading = false;
    });
  }

  payer() {
    // Le paiement est maintenant géré via le modal dans le dashboard.
    // Rediriger vers mes-formations pour ouvrir le modal de paiement.
    this.router.navigate(['/mes-formations']);
  }

  onPaymentSuccess() {
    // Paiement confirmé → cacher le modal et recharger le test
    this.showPaymentModal = false;
    this.paiementRequis = false;
    this.chargerTest(); // recharge pour vérifier l'accès
  }

  get dateArrivee(): boolean {
    if (!this.test || !this.test.heureFixeDebut) return true;
    return new Date() >= new Date(this.test.heureFixeDebut);
  }

  // --- SHUFFLE LOGIC ---
  shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  shuffleQuestions() {
    if (!this.test?.questions) return;

    // Mélange des questions
    this.test.questions = this.shuffleArray(this.test.questions);

    this.test.questions.forEach((q: any) => {
      if (q.type === 'QCM') {
        const rawOptions = [
          { id: 'A', text: q.choixA },
          { id: 'B', text: q.choixB },
          { id: 'C', text: q.choixC },
          { id: 'D', text: q.choixD }
        ].filter(opt => opt.text && opt.text.trim() !== '');
        q.shuffledOptions = this.shuffleArray(rawOptions);
      }
    });
  }
  // -------------------------

  async initiserCamera(): Promise<boolean> {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // NE PAS assigner srcObject ici : le <video> n'existe pas encore (il est dans *ngIf="testDemarre")
      // L'assignation se fait APRES testDemarre = true dans demarrerTest()
      return true;
    } catch (err) {
      console.error("Accès caméra refusé", err);
      alert("L'accès à la caméra est OBLIGATOIRE pour passer l'examen surveillé. Veuillez autoriser la caméra dans votre navigateur.");
      return false;
    }
  }

  /** Détection de visage avec face-api.js (TinyFaceDetector) */
  async startFaceDetection() {
    this.faceDetectionActive = true;
    this.consecutiveNoFace = 0;
    try {
      if (typeof faceapi !== 'undefined' && faceapi.nets) {
        if (!this.faceModelLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(
            'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights'
          );
          this.faceModelLoaded = true;
          console.log('✅ face-api TinyFaceDetector model chargé');
        }
        this.faceDetectionInterval = setInterval(async () => {
          if (!this.testDemarre || this.soumis || !this.videoElement?.nativeElement) return;
          try {
            const detection = await faceapi.detectSingleFace(
              this.videoElement.nativeElement,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.60 })
            );
            if (detection) {
              this.faceDetected = true;
              this.consecutiveNoFace = 0;
            } else {
              this.faceDetected = false;
              this.consecutiveNoFace++;
              console.warn(`⚠️ Visage non détecté (${this.consecutiveNoFace}/2)`);
              if (this.consecutiveNoFace >= 2) {
                this.consecutiveNoFace = 0;
                this.enregistrerInfraction('📷 Visage non visible — vous devez rester face à la caméra.');
              }
            }
          } catch (e) { /* ignorer les erreurs transitoires */ }
        }, 3000);
        return;
      }
    } catch (e) {
      console.warn('face-api.js non disponible, fallback sur analyse luminosité :', e);
    }
    // Fallback : analyse de luminosité (détecte si caméra bloquée/couverte)
    this.startBrightnessFallback();
  }

  /** Fallback : détecte présence d'une peau via analyse couleur (teinte chair) */
  startBrightnessFallback() {
    this.faceDetectionInterval = setInterval(() => {
      if (!this.testDemarre || this.soumis || !this.videoElement?.nativeElement) return;
      try {
        const canvas = this.faceCanvas?.nativeElement;
        if (!canvas) return;
        canvas.width = 160; canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(this.videoElement.nativeElement, 0, 0, 160, 120);
        const data = ctx.getImageData(0, 0, 160, 120).data;
        let skinPixels = 0;
        const total = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          // Detection couleur peau (HSV-like heuristic)
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const isSkin = r > 95 && g > 40 && b > 20
            && max - min > 15
            && Math.abs(r - g) > 15
            && r > g && r > b;
          if (isSkin) skinPixels++;
        }
        const skinRatio = skinPixels / total;
        // Si plus de 6% des pixels sont de couleur peau → visage probable
        if (skinRatio > 0.06) {
          this.faceDetected = true;
          this.consecutiveNoFace = 0;
        } else {
          this.faceDetected = false;
          this.consecutiveNoFace++;
          if (this.consecutiveNoFace >= 3) {
            this.consecutiveNoFace = 0;
            this.enregistrerInfraction('📷 Visage non visible — vous devez rester face à la caméra.');
          }
        }
      } catch (e) { /* ignorer */ }
    }, 4000); // vérification toutes les 4 secondes
  }

  stopFaceDetection() {
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = undefined;
    }
    this.faceDetectionActive = false;
  }

  async demarrerTest() {
    if (!this.test) return;

    // 1. Demander la Caméra
    const cameraOk = await this.initiserCamera();
    if (!cameraOk) return;

    // 2. Demander le Plein Écran
    try {
      await document.documentElement.requestFullscreen();
    } catch (e) {
      console.warn("Fullscreen API non supportée ou rejetée", e);
      alert("Veuillez autoriser le plein écran pour démarrer l'examen.");
      this.arreterCamera(); // fail safe
      return;
    }

    // 3. Lancement officiel côté serveur ET client
    this.testService.demarrerTest(this.testId, this.entrepreneurId).subscribe({
      next: () => {
        this.shuffleQuestions();
        this.testDemarre = true;
        this.tempsRestant = (this.test!.dureeMinutes || 0) * 60;
        this.infractions = 0;

        this.reponses = this.test!.questions?.map((q: any) => ({
          questionTest: q,
          reponseFournie: ''
        })) || [];

        // Angular a maintenant rendu le <video> (testDemarre = true) → on peut assigner le flux
        setTimeout(() => {
          if (this.videoElement?.nativeElement && this.cameraStream) {
            this.videoElement.nativeElement.srcObject = this.cameraStream;
            console.log('✅ Caméra liée à la vidéo');
          }
          // Démarrer la détection de visage 1.5s après (vidéo a le temps de charger)
          setTimeout(() => this.startFaceDetection(), 1500);
        }, 300); // 300ms pour laisser Angular rendre le DOM

        this.timerSubscription = interval(1000).subscribe(() => {
          if (this.tempsRestant > 0) {
            this.tempsRestant--;
          } else {
            this.soumettre(); // Auto-soumission
          }
        });
      },
      error: () => {
        alert("Impossible de démarrer l'examen (Erreur serveur)");
        this.arreterCamera();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      }
    });
  }

  get answeredCount(): number {
    return this.reponses.filter(r => r.reponseFournie && r.reponseFournie.trim() !== '').length;
  }

  get progression(): number {
    if (!this.reponses.length) return 0;
    const answered = this.reponses.filter(r => r.reponseFournie && r.reponseFournie.trim() !== '').length;
    return Math.round((answered / this.reponses.length) * 100);
  }

  get formattedTime(): string {
    const min = Math.floor(this.tempsRestant / 60);
    const sec = this.tempsRestant % 60;
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  }

  soumettre() {
    if (this.soumis) return;
    if (this.timerSubscription) this.timerSubscription.unsubscribe();

    const payload = this.reponses.map(r => ({
      reponseFournie: r.reponseFournie,
      questionTest: { id: r.questionTest.id }
    }));

    this.testService.soumettreTest(this.testId, this.entrepreneurId, payload as any, this.infractions).subscribe({
      next: (res: SoumissionTest) => {
        this.soumis = true;
        this.score = res.scoreObtenu;
        this.reussi = !res.tentativeFraude && this.score >= (this.test?.scoreSeuil ?? 0);
        this.testDemarre = false;
        this.arreterCamera();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => { });
        }

        // Si réussi, tenter de récupérer le token du certificat après un petit délai
        // (le backend génère la cert de façon synchrone pour QCM)
        if (this.reussi) {
          setTimeout(() => this.rechercherCertificat(), 1500);
        }
      },
      error: (err: any) => alert('Erreur lors de la soumission: ' + err.message)
    });
  }

  /** Cherche le certificat nouvellement créé pour cet entrepreneur + formation */
  rechercherCertificat(tentative = 1) {
    if (this.certCheckDone) return;
    const MAX_TENTATIVES = 8; // Retry jusqu'à 8 fois (16 secondes max)

    this.inscriptionService.getMesCertifications(this.entrepreneurId).subscribe({
      next: (certs: Certification[]) => {
        if (!certs || certs.length === 0) {
          // Pas encore de cert → réessayer
          if (tentative < MAX_TENTATIVES) {
            setTimeout(() => this.rechercherCertificat(tentative + 1), 2000);
          }
          return;
        }

        // Chercher par titre de formation (l'interface Certification.formation n'a que {titre})
        const titreCible = this.test?.formation?.titre;
        let cert: Certification | undefined;

        if (titreCible) {
          cert = certs.find(c =>
            c.formation?.titre?.toLowerCase() === titreCible.toLowerCase()
          );
        }

        // Fallback : prendre le certificat le plus récent
        if (!cert && certs.length > 0) {
          cert = certs.sort((a, b) =>
            new Date(b.dateEmission || 0).getTime() - new Date(a.dateEmission || 0).getTime()
          )[0];
        }

        if (cert) {
          this.certToken = cert.qrCodeToken ?? null;
          this.certCheckDone = true;
          console.log('✅ Certificat trouvé :', cert.qrCodeToken, '| Blockchain TX:', cert.blockchainTxHash);
        } else if (tentative < MAX_TENTATIVES) {
          // Réessayer si pas encore trouvé
          setTimeout(() => this.rechercherCertificat(tentative + 1), 2000);
        }
      },
      error: () => {
        if (tentative < MAX_TENTATIVES) {
          setTimeout(() => this.rechercherCertificat(tentative + 1), 2000);
        }
      }
    });
  }

  ouvrirCertificat() {
    if (this.certToken) {
      window.open(`/certificat/${this.certToken}`, '_blank', 'noopener');
    }
  }

  arreterCamera() {
    this.stopFaceDetection();
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
  }

  parseOptions(optionsStr: string): string[] {
    if (!optionsStr) return [];
    try {
      if (optionsStr.startsWith('[')) return JSON.parse(optionsStr);
      return optionsStr.split(',');
    } catch {
      return optionsStr.split(',');
    }
  }

  ngOnDestroy() {
    if (this.timerSubscription) this.timerSubscription.unsubscribe();
    this.stopFaceDetection();
    this.arreterCamera();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  }
}
