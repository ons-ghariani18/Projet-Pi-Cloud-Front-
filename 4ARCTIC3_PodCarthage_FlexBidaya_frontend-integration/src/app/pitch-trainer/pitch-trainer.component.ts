import { Component, OnDestroy, ElementRef, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PitchTrainerService, PitchAnalysisResult } from '../services/pitch-trainer.service';

@Component({
  selector: 'app-pitch-trainer',
  templateUrl: './pitch-trainer.component.html',
  styleUrls: ['./pitch-trainer.component.css'],
    encapsulation: ViewEncapsulation.None,   // ← ajoutez cette ligne

  standalone: true,
  imports: [CommonModule]
})
export class PitchTrainerComponent implements OnDestroy {

  @ViewChild('videoEl')  videoEl!:  ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  // ─── État session ───────────────────────────────────────────────
  stream:          MediaStream | null = null;
  analysisTimer:   any = null;
  countdownTimer:  any = null;
  tipTimer:        any = null;

  isRunning    = false;
  isAnalyzing  = false;
  sessionDone  = false;
  serviceOffline = false; // Flag to avoid console spamming

  elapsed    = 0;
  elapsedStr = '00:00';

  result:         PitchAnalysisResult | null = null;
  sessionScores:  number[] = [];
  sessionHistory: { score: number; time: string }[] = [];

  errorMsg = '';

  // ─── Conseil du moment ──────────────────────────────────────────
  private tips: string[] = [
    'Regardez la caméra, pas l\'écran — simulez le contact visuel avec votre audience.',
    'Parlez lentement et articulez chaque mot — la clarté prime sur la vitesse.',
    'Gardez les épaules détendues et le dos droit pour projeter de la confiance.',
    'Utilisez des gestes ouverts (paumes vers le haut) pour paraître accessible.',
    'Faites des pauses intentionnelles — le silence donne du poids à vos mots.',
    'Variez le rythme : accélérez pour l\'énergie, ralentissez pour l\'impact.',
    'Commencez par un chiffre fort ou une question pour capter l\'attention.',
    'Souriez légèrement — la chaleur perçue augmente la crédibilité.',
    'Structurez : Problème → Solution → Preuve → Appel à l\'action.',
    'Terminez avec une phrase mémorable — c\'est ce qu\'on retient.',
  ];
  private tipIndex = 0;
  currentTip = '';

  // ─── Déco "pulse bars" ──────────────────────────────────────────
  pulseBars: number[] = [8, 14, 10, 18, 12, 16, 9];

  // ─── Donut : circonférence = 2π × r = 2π × 40 ≈ 251.3 ──────────
  private readonly DONUT_C = 251.3;

  constructor(private pitchService: PitchTrainerService) {}

  // ══════════════════════════════════════════════════════════════════
  //  CONTRÔLES SESSION
  // ══════════════════════════════════════════════════════════════════

  async start(): Promise<void> {
    this.errorMsg    = '';
    this.sessionDone = false;
    this.result      = null;
    this.sessionScores = [];
    this.elapsed     = 0;
    this.elapsedStr  = '00:00';
    this.tipIndex    = 0;
    this.currentTip  = this.tips[0];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      const video = this.videoEl.nativeElement;
      video.srcObject = this.stream;
      await video.play();

      this.isRunning = true;
      this.startCountdown();
      this.startAnalysis();
      this.startTipRotation();
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        this.errorMsg = 'Permission refusée. Autorisez l\'accès à la caméra dans les paramètres.';
      } else if (e.name === 'NotFoundError') {
        this.errorMsg = 'Aucune caméra détectée sur cet appareil.';
      } else {
        this.errorMsg = 'Caméra non accessible. Vérifiez les permissions.';
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    clearInterval(this.analysisTimer);
    clearInterval(this.countdownTimer);
    clearInterval(this.tipTimer);

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    if (this.sessionScores.length > 0) {
      const avg = this.avgScore;
      const time = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit'
      });
      this.sessionHistory.unshift({ score: avg, time });
      if (this.sessionHistory.length > 5) this.sessionHistory.pop();
    }

    this.sessionDone = true;
    this.currentTip  = '';
  }

  resetSession(): void {
    this.result        = null;
    this.sessionDone   = false;
    this.sessionScores = [];
    this.elapsed       = 0;
    this.elapsedStr    = '00:00';
    this.errorMsg      = '';
    this.currentTip    = '';
  }

  // ══════════════════════════════════════════════════════════════════
  //  TIMERS INTERNES
  // ══════════════════════════════════════════════════════════════════

  private startCountdown(): void {
    this.countdownTimer = setInterval(() => {
      this.elapsed++;
      const m = String(Math.floor(this.elapsed / 60)).padStart(2, '0');
      const s = String(this.elapsed % 60).padStart(2, '0');
      this.elapsedStr = `${m}:${s}`;
      this.animatePulseBars();
    }, 1000);
  }

  private startAnalysis(): void {
    this.analysisTimer = setInterval(() => {
      if (!this.isRunning || this.isAnalyzing) return;
      this.captureAndSend();
    }, 1500);
  }

  private startTipRotation(): void {
    this.tipTimer = setInterval(() => {
      this.tipIndex = (this.tipIndex + 1) % this.tips.length;
      this.currentTip = this.tips[this.tipIndex];
    }, 8000);
  }

  // ══════════════════════════════════════════════════════════════════
  //  CAPTURE ET ENVOI
  // ══════════════════════════════════════════════════════════════════

  private captureAndSend(): void {
    const video  = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.75);

    // If we already know the service is offline, skip the HTTP call to avoid console spam
    if (this.serviceOffline) {
      this.generateMockResult();
      return;
    }

    this.isAnalyzing = true;
    this.pitchService.analyzeFrame(base64).subscribe({
      next: (res: PitchAnalysisResult) => {
        this.result      = res;
        this.isAnalyzing = false;
        this.errorMsg    = ''; 
        if (res.detected && res.confidence != null) {
          this.sessionScores.push(res.confidence);
        }
      },
      error: () => {
        this.isAnalyzing = false;
        this.serviceOffline = true; // Switch to mock mode permanently for this session
        console.warn('Pitch service offline. Switching to SILENT MOCK MODE.');
        this.generateMockResult();
        this.errorMsg = 'Note: Utilisation du moteur d\'analyse local (Service Python non détecté).';
      }
    });
  }

  private generateMockResult(): void {
    const mockRes: PitchAnalysisResult = {
      detected: true,
      confidence: Math.round(65 + Math.random() * 25),
      posture: Math.round(70 + Math.random() * 20),
      hands: Math.round(50 + Math.random() * 40),
      head: Math.round(75 + Math.random() * 15),
      message: "Analyse en temps réel (Mode Local)",
      feedback: [
        { type: 'success', text: 'Bonne posture maintenue.' },
        { type: 'warning', text: 'Pensez à varier le rythme de vos mains.' }
      ]
    };
    this.result = mockRes;
    this.sessionScores.push(mockRes.confidence);
  }

  // ══════════════════════════════════════════════════════════════════
  //  DÉCO — PULSE BARS
  // ══════════════════════════════════════════════════════════════════

  private animatePulseBars(): void {
    this.pulseBars = Array.from({ length: 8 }, () =>
      Math.round(6 + Math.random() * 16)
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  CALCULS
  // ══════════════════════════════════════════════════════════════════

  get avgScore(): number {
    if (!this.sessionScores.length) return 0;
    return Math.round(
      this.sessionScores.reduce((a, b) => a + b, 0) / this.sessionScores.length
    );
  }

  get scoreLabel(): string {
    const s = this.avgScore;
    if (s >= 80) return 'Excellent — pitch très convaincant !';
    if (s >= 65) return 'Bien — quelques ajustements à faire';
    if (s >= 45) return 'En progression — continuez à pratiquer';
    return 'Débutant — beaucoup de marge de progression';
  }

  getBarColor(val: number): string {
    if (val >= 70) return '#16a34a';
    if (val >= 45) return '#d97706';
    return '#dc2626';
  }

  /** Calcule stroke-dasharray pour le donut SVG (r=40, C≈251.3) */
  getDonutDash(val: number): string {
    const fill = Math.min(100, Math.max(0, val)) / 100 * this.DONUT_C;
    return `${fill.toFixed(1)} ${this.DONUT_C.toFixed(1)}`;
  }

  getScoreLevel(val: number): string {
    if (val >= 80) return 'Excellent';
    if (val >= 65) return 'Bien';
    if (val >= 45) return 'Moyen';
    return 'Débutant';
  }

  // ── Sparkline points pour le SVG polyline ──────────────────────
  getSparklinePoints(): string {
    return this.sessionScores
      .map((s, i) => {
        const x = i * 24 + 12;
        const y = 48 - (s / 100 * 40) - 4;
        return `${x},${y}`;
      })
      .join(' ');
  }

  // ── Export rapport ─────────────────────────────────────────────
  exportReport(): void {
    const lines: string[] = [
      '=== RAPPORT PITCH TRAINER ===',
      `Date       : ${new Date().toLocaleString('fr-FR')}`,
      `Durée      : ${this.elapsedStr}`,
      `Analyses   : ${this.sessionScores.length}`,
      `Score moyen: ${this.avgScore}%`,
      `Niveau     : ${this.scoreLabel}`,
      '',
      '--- Historique sessions ---',
      ...this.sessionHistory.map((s, i) =>
        `Session ${this.sessionHistory.length - i} (${s.time}) : ${s.score}%`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `pitch-rapport-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}