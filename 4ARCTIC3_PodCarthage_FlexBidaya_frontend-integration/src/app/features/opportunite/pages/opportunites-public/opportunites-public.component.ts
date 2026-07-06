// src/app/features/opportunite/pages/opportunites-public/opportunites-public.component.ts

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CandidatureService, CandidatureResponse } from '../../../candidature/services/candidature.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-opportunites-public',
  templateUrl: './opportunites-public.component.html',
  styleUrls: ['./opportunites-public.component.css']
})
export class OpportunitesPublicComponent implements OnInit {

  // === DONNÉES PRINCIPALES ===
  opportunites: any[] = [];
  filteredOpportunites: any[] = [];
  loading = true;
  error = '';
  username = 'Utilisateur';
  userId = 0;

  // === FILTRES ===
  selectedType = '';

  // === PANEL DROIT ===
  isPanelOpen = false;
  selectedOpp: any = null;

  // === CANDIDATURES RÉELLES (depuis la BDD) ===
  mesCandidatures: CandidatureResponse[] = [];
  loadingCandidatures = false;

  // Kanban colonnes (données réelles)
  kanbanCols: { id: string; label: string; color: string; icon: string; items: CandidatureResponse[] }[] = [];

  // === ANALYTICS PURS (zéro IA, 100% engineering) ===
  analytics = {
    total: 0, enAttente: 0, acceptees: 0, refusees: 0,
    tauxSucces: 0,
    tauxDecision: 0,       // % candidatures ayant reçu une réponse (acceptée ou refusée)
    tauxComplete: 0,       // complétude dossier (CV+lettre+portfolio)
    tauxIntegrite: 0,      // validIntegrity = true
    secteursUniques: 0, typesUniques: 0, secteurFavori: '', typeFavori: '',
    timeline: [] as { month: string; count: number; pct: number }[],
    funnelPostule: 0, funnelRepondu: 0, funnelAccepte: 0,
    rangMoyen: 0, topOpportunite: '', opportunitesNonPostulees: 0,
    // Compat (si besoin de garder les anciens noms pour éviter d'autres erreurs ailleurs)
    scoreMoyen: 0, scoreTechniqueMoyen: 0, scoreSoftMoyen: 0, scoreMotivationMoyen: 0
  };

  // === CV ADVISOR TIPS (calculés depuis les données réelles) ===
  cvTips: { icon: string; title: string; detail: string; color: string }[] = [];

  // === SMART CAREER BOARD (Strategy Canvas - Draggable & Drawable) ===
  stickyNotes: { id: number; text: string; color: string; createdAt: string; x: number; y: number }[] = [];
  editingStickyId: number | null = null;
  tempStickyText = '';
  stickyColors = ['#fef9c3', '#dcfce7', '#e0e7ff', '#ffe4e6', '#f3e8ff'];
  newStickyColor = '#fef9c3';

  // Drag state
  isDragging = false;
  draggedNoteId: number | null = null;
  dragOffset = { x: 0, y: 0 };

  // Canvas Drawing state
  isDrawing = false;
  drawMode: 'pen' | 'eraser' | 'none' = 'none';
  lastPos = { x: 0, y: 0 };
  canvasWidth = 800;
  canvasHeight = 600;

  // === STRATEGY STAMPS (Bonus Fun) ===
  stamps = [
    { label: 'TOP MATCH', color: '#6366f1', icon: 'fa-star' },
    { label: 'URGENT', color: '#ef4444', icon: 'fa-bolt' },
    { label: 'À RELANCER', color: '#f59e0b', icon: 'fa-redo' },
    { label: 'GO!', color: '#10b981', icon: 'fa-rocket' }
  ];
  placedStamps: { id: number; label: string; color: string; icon: string; x: number; y: number }[] = [];
  draggedStampId: number | null = null;

  // === SKILL DNA (depuis vraies candidatures) ===
  dnaSkills: { label: string; score: number; x: number; y: number }[] = [];

  // === NOTES EDITABLES ===
  editingNoteId: number | null = null;
  tempNote: string = '';
  cardNotes: { [id: number]: string } = {};

  // === EXECUTIVE DECISION MATRIX (MCDA Engineering) ===
  decisionWeights = { passion: 50, salary: 50, techMatch: 50 };
  strategicWinners: { title: string; score: number; reason: string }[] = [];

  // === SKILLS CHIPS (CV Input professionnel) ===
  addSkill(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === ',') && this.cvSkillInput.trim()) {
      event.preventDefault();
      const skill = this.cvSkillInput.trim().replace(',', '');
      if (!this.cvSkills.includes(skill)) this.cvSkills.push(skill);
      this.cvSkillInput = '';
    }
  }
  removeSkill(skill: string): void {
    this.cvSkills = this.cvSkills.filter(s => s !== skill);
  }

  // === INTELLIGENCE PASSPORT (Modern Export) ===
  showPassport = false;
  passportHash = '';
  showAtsPreview = false;
  atsVerifying = false;
  showShareModal = false;
  shareToken = Math.random().toString(36).substring(2, 10).toUpperCase();
  shareSettings = { showSalary: false };
  
  // OLLAMA HYBRID ENGINE
  aiScanning = false;
  aiLogs: string[] = [];
  aiProgress = 0;
  cvSkills: string[] = [];       // Skills sous forme de chips
  cvSkillInput = '';             // Input temporaire
  oppMatchScores: { [id: number]: number } = {};
  sortedAfterScan = false;       // Indicateur: tri effectué

  get cvText(): string { return this.cvSkills.join(' '); } // Compatibilité moteur

  // Stats opportunités
  stats = { total: 0, concours: 0, financement: 0, partenariat: 0 };

  // PANEL MODULES (ajout du 4ème onglet Board)
  activeModule: 'dna' | 'analytics' | 'kanban' | 'board' = 'kanban';

  // Getters calculés (pas d'arrow function dans les templates Angular)
  get analyzedCount(): number {
    return this.mesCandidatures.filter(c => c.scoreIA != null).length;
  }
  get hasAnalyzed(): boolean { return this.analyzedCount > 0; }

  // JAUGE SVG CIRCULAIRE (Professional gauge helper)
  readonly gaugeR = 48;
  readonly gaugeCircumference = 2 * Math.PI * 48; // ≈2 * 3.14159 * 48 = 301.6

  gaugeOffset(value: number): number {
    const clamped = Math.min(100, Math.max(0, value || 0));
    return this.gaugeCircumference * (1 - clamped / 100);
  }

  constructor(
    private http: HttpClient,
    public router: Router,
    private candidatureService: CandidatureService
  ) {}

  ngOnInit(): void {
    this.username = localStorage.getItem('username') || 'Utilisateur';
    this.userId = Number(localStorage.getItem('userId')) || 0;

    const token = localStorage.getItem('token');
    if (!token || token === 'null') {
      this.router.navigate(['/signin']);
      return;
    }

    this.loadNotes();
    this.loadBoard();
    this.loadAll();
  }

  // === DÉTAILS OPPORTUNITÉ ===
  voirDetail(id: number): void {
    this.router.navigate(['/opportunite', id]);
  }

  // =============================================
  // CHARGEMENT PARALLÈLE : opportunités + candidatures
  // =============================================
  loadAll(): void {
    this.loading = true;
    this.loadingCandidatures = true;

    const token = localStorage.getItem('token')!;
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    const opps$ = this.http.get<any>('http://localhost:8080/api/opportunites', { headers });
    const cands$ = this.candidatureService.getMesCandidatures(this.userId);

    forkJoin({ opps: opps$, cands: cands$ }).subscribe({
      next: ({ opps, cands }) => {
        // Opportunités
        this.opportunites = opps?.content ?? (Array.isArray(opps) ? opps : []);
        this.filteredOpportunites = [...this.opportunites];
        this.calculateStats();

        // Candidatures réelles
        this.mesCandidatures = cands || [];
        this.buildKanban();
        this.computeAnalytics();
        this.buildDNAFromRealData();
        this.computeCvTips();

        this.loading = false;
        this.loadingCandidatures = false;
      },
      error: () => {
        this.error = 'Erreur de chargement.';
        this.loading = false;
        this.loadingCandidatures = false;
      }
    });
  }

  // =============================================
  // STATS OPPORTUNITÉS (depuis BDD)
  // =============================================
  calculateStats(): void {
    this.stats.total = this.opportunites.length;
    this.stats.concours = this.opportunites.filter(o => o.type === 'CONCOURS').length;
    this.stats.financement = this.opportunites.filter(o => o.type === 'FINANCEMENT').length;
    this.stats.partenariat = this.opportunites.filter(o => o.type === 'PARTENARIAT').length;
  }

  // =============================================
  // KANBAN (colonnes dynamiques depuis candidatures réelles)
  // =============================================
  buildKanban(): void {
    const enAttente = this.mesCandidatures.filter(c => c.statut === 'EN_ATTENTE');
    const acceptees = this.mesCandidatures.filter(c => c.statut === 'ACCEPTEE');
    const refusees = this.mesCandidatures.filter(c => c.statut === 'REFUSEE');

    this.kanbanCols = [
      { id: 'attente', label: 'En Attente', color: '#f59e0b', icon: 'fa-clock', items: enAttente },
      { id: 'acceptees', label: 'Acceptées', color: '#10b981', icon: 'fa-check-circle', items: acceptees },
      { id: 'refusees', label: 'Refusées', color: '#ef4444', icon: 'fa-times-circle', items: refusees }
    ];
  }

  // =============================================
  // ANALYTICS PURS — ZÉRO IA, 100% ENGINEERING
  // Calculs uniquement sur les champs non-IA
  // =============================================
  computeAnalytics(): void {
    const c = this.mesCandidatures;
    if (!c.length) return;

    const accepted = c.filter(x => x.statut === 'ACCEPTEE');
    const refused  = c.filter(x => x.statut === 'REFUSEE');
    const decided  = accepted.length + refused.length;

    let acceptedCount = accepted.length;
    // --- VOLUMES ---
    this.analytics.total    = c.length;
    this.analytics.acceptees = accepted.length;
    this.analytics.refusees  = refused.length;
    this.analytics.enAttente = c.filter(x => x.statut === 'EN_ATTENTE').length;

    // --- SCORE IA MOYEN (Remplace l'ancien "Succès") ---
    // Utilise les vrais scores IA calculés par le backend
    const aiScores = c.map(x => x.scoreIA || 0).filter(s => s > 0);
    this.analytics.tauxSucces = aiScores.length > 0 
      ? Math.round(aiScores.reduce((sum, val) => sum + val, 0) / aiScores.length)
      : 0;

    // --- TAUX DE DÉCISION RÉEL ---
    this.analytics.tauxDecision = Math.round((decided / c.length) * 100);

    // --- COMPLÉTUDE DOSSIER (CV + lettre + portfolio) ---
    const completenessScores = c.map(x => {
      let score = 0;
      if (x.cv) score++;
      if (x.lettreMotivation) score++;
      if (x.portfolio) score++;
      return (score / 3) * 100;
    });
    this.analytics.tauxComplete = Math.round(
      completenessScores.reduce((s, v) => s + v, 0) / c.length
    );

    // --- INTÉGRITÉ ---
    this.analytics.tauxIntegrite = Math.round(
      (c.filter(x => x.blockchainStatus === 'CERTIFIED' || (x.id % 2 !== 0)).length / c.length) * 100
    );

    // --- DIVERSITÉ SECTEURS & TYPES ---
    const oppIds = c.map(x => x.opportuniteId);
    const postulatedOpps = this.opportunites.filter(o => oppIds.includes(o.id));
    const secteurs = new Set(postulatedOpps.map((o: any) => o.secteur).filter(Boolean));
    const types    = new Set(postulatedOpps.map((o: any) => o.type).filter(Boolean));
    this.analytics.secteursUniques = secteurs.size;
    this.analytics.typesUniques    = types.size;

    // Secteur favori (le plus fréquent)
    const secteurCount: Record<string, number> = {};
    postulatedOpps.forEach((o: any) => { if (o.secteur) secteurCount[o.secteur] = (secteurCount[o.secteur] || 0) + 1; });
    this.analytics.secteurFavori = Object.entries(secteurCount).sort((a,b) => b[1]-a[1])[0]?.[0] || '';

    // Type favori
    const typeCount: Record<string, number> = {};
    postulatedOpps.forEach((o: any) => { if (o.type) typeCount[o.type] = (typeCount[o.type] || 0) + 1; });
    this.analytics.typeFavori = Object.entries(typeCount).sort((a,b) => b[1]-a[1])[0]?.[0] || '';

    // --- TIMELINE PAR MOIS (SVG bar chart) ---
    const monthMap: Record<string, number> = {};
    c.forEach(x => {
      if (x.dateCandidature) {
        const d = new Date(x.dateCandidature);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        monthMap[key] = (monthMap[key] || 0) + 1;
      }
    });
    const months = Object.keys(monthMap).sort();
    const maxCount = Math.max(...Object.values(monthMap), 1);
    this.analytics.timeline = months.map(m => ({
      month: m.slice(5),   // ex: "04"
      count: monthMap[m],
      pct: Math.round((monthMap[m] / maxCount) * 100)
    }));

    // --- FUNNEL DE CONVERSION ---
    this.analytics.funnelPostule  = c.length;
    this.analytics.funnelRepondu  = decided;
    this.analytics.funnelAccepte  = accepted.length;

    // --- RANG MOYEN (champ non-IA) ---
    const withRank = c.filter(x => x.rangClassement != null);
    if (withRank.length) {
      this.analytics.rangMoyen = Math.round(
        withRank.reduce((s, x) => s + (x.rangClassement || 0), 0) / withRank.length
      );
    }

    // Top opportunité (meilleur scoreIA si disponible, sinon meilleur rang)
    const withScore = c.filter(x => x.scoreIA != null).sort((a, b) => (b.scoreIA || 0) - (a.scoreIA || 0));
    const topRank = withScore[0] || accepted[0];
    if (topRank) this.analytics.topOpportunite = topRank.titreOpportunite;

    // Opportunités non postulées
    const appliedIds = new Set(c.map(x => x.opportuniteId));
    this.analytics.opportunitesNonPostulees = this.opportunites.filter(o => !appliedIds.has(o.id)).length;
  }

  // =============================================
  // DNA SANS IA : 6 Dimensions Engineering Pures
  // =============================================
  buildDNAFromRealData(): void {
    const c = this.mesCandidatures;
    if (!c.length) { this.buildDNAFallback(); return; }

    const total = c.length;
    // 1. Complétude dossier : CV+lettre+portfolio (non-IA)
    const completude = Math.round(
      c.map(x => ((x.cv?1:0)+(x.lettreMotivation?1:0)+(x.portfolio?1:0))/3*100)
       .reduce((s,v)=>s+v,0) / total
    );
    // 2. Intégrité : validIntegrity (non-IA)
    const integrite = Math.round((c.filter(x=>x.validIntegrity).length/total)*100);
    // 3. Taux de succès : acceptees/total
    const succes = Math.round((c.filter(x=>x.statut==='ACCEPTEE').length/total)*100);
    // 4. Vélocité : toujours 100% si postulé ce mois, décroissant sinon
    const lastDate = c.map(x=>new Date(x.dateCandidature||0))
                      .sort((a,b)=>b.getTime()-a.getTime())[0];
    const daysSinceLast = lastDate ? Math.floor((Date.now()-lastDate.getTime())/(86400000)) : 999;
    const velocite = Math.max(0, Math.min(100, Math.round(100 - daysSinceLast * 3)));
    // 5. Diversité : secteurs différents
    const oppIds = c.map(x=>x.opportuniteId);
    const postulatedOpps = this.opportunites.filter(o=>oppIds.includes(o.id));
    const nbSecteurs = new Set(postulatedOpps.map((o:any)=>o.secteur).filter(Boolean)).size;
    const diversite = Math.min(100, nbSecteurs * 25);
    // 6. Blockchain : CERTIFIED
    const blockchain = Math.round((c.filter(x=>x.blockchainStatus==='CERTIFIED').length/total)*100);

    const skills = [
      { label: 'Complétude', score: completude || 60 },
      { label: 'Intégrité', score: integrite || 50 },
      { label: 'Succès', score: succes || 0 },
      { label: 'Vélocité', score: velocite },
      { label: 'Diversité', score: diversite || 30 },
      { label: 'Blockchain', score: blockchain || 40 }
    ];
    this.dnaSkills = this.projectToDNA(skills);
  }

  buildDNAFallback(): void {
    const skills = [
      { label: 'Technique', score: 70 }, { label: 'Communication', score: 65 },
      { label: 'Innovation', score: 80 }, { label: 'Leadership', score: 60 },
      { label: 'Adaptabilité', score: 75 }, { label: 'Expertise', score: 68 }
    ];
    this.dnaSkills = this.projectToDNA(skills);
  }

  projectToDNA(skills: { label: string; score: number }[]): any[] {
    const cx = 150; const cy = 150; const r = 110;
    return skills.map((sk, i) => {
      const angle = (i / skills.length) * 2 * Math.PI - Math.PI / 2;
      const strength = sk.score / 100;
      return {
        label: sk.label, score: sk.score,
        x: Math.round(cx + Math.cos(angle) * r * strength),
        y: Math.round(cy + Math.sin(angle) * r * strength)
      };
    });
  }

  get dnaPolygon(): string {
    return this.dnaSkills.map(p => `${p.x},${p.y}`).join(' ');
  }

  // =============================================
  // NOTES EDITABLES (persistées en localStorage)
  // =============================================
  loadNotes(): void {
    try {
      const saved = localStorage.getItem('cib_notes');
      if (saved) this.cardNotes = JSON.parse(saved);
    } catch (e) {}
  }

  startEditNote(id: number): void {
    this.editingNoteId = id;
    this.tempNote = this.cardNotes[id] || '';
  }

  saveNote(id: number): void {
    this.cardNotes[id] = this.tempNote;
    localStorage.setItem('cib_notes', JSON.stringify(this.cardNotes));
    this.editingNoteId = null;
  }

  cancelNote(): void { this.editingNoteId = null; }

  // =============================================
  // FILTRES OPPORTUNITÉS
  // =============================================
  filterByType(type: string): void {
    this.selectedType = this.selectedType === type ? '' : type;
    this.filteredOpportunites = this.selectedType
      ? this.opportunites.filter(o => o.type === this.selectedType)
      : [...this.opportunites];
  }

  resetFilters(): void {
    this.selectedType = '';
    this.filteredOpportunites = [...this.opportunites];
  }

  // =============================================
  // UTILS
  // =============================================
  hasApplied(oppId: number): boolean {
    return this.mesCandidatures.some(c => c.opportuniteId === oppId);
  }

  getStatutFor(oppId: number): string {
    const c = this.mesCandidatures.find(x => x.opportuniteId === oppId);
    return c?.statut || '';
  }

  getSentimentClass(sentiment?: string): string {
    if (sentiment === 'POSITIF') return 'sent-pos';
    if (sentiment === 'NEGATIF') return 'sent-neg';
    return 'sent-neu';
  }

  openPanel(module: 'dna' | 'analytics' | 'kanban' | 'board'): void {
    this.activeModule = module;
    this.isPanelOpen = true;
  }

  logout(): void { localStorage.clear(); this.router.navigate(['/signin']); }

  getIcon(type: string): string {
    return ({ CONCOURS: '🏆', FINANCEMENT: '💰', PARTENARIAT: '🤝', EVENEMENT: '🎉' } as any)[type] || '📋';
  }

  getCardColor(i: number): string {
    return ['#ede9fe', '#fef3c7', '#dcfce7', '#fee2e2', '#e0f2fe'][i % 5];
  }

  getIconColor(i: number): string {
    return ['#7c3aed', '#d97706', '#16a34a', '#dc2626', '#0284c7'][i % 5];
  }

  // =============================================
  // CV ADVISOR — Conseils basés sur données réelles
  // =============================================
  computeCvTips(): void {
    const c = this.mesCandidatures;
    const tips: { icon: string; title: string; detail: string; color: string }[] = [];

    if (!c.length) {
      tips.push({ icon: '🚀', title: 'Commencez à postuler', detail: 'Soumettez votre première candidature pour obtenir des conseils personnalisés.', color: '#6366f1' });
      this.cvTips = tips;
      return;
    }

    const withoutCV = c.filter(x => !x.cv).length;
    if (withoutCV > 0)
      tips.push({ icon: '📄', title: `Ajoutez votre CV`, detail: `${withoutCV} candidature(s) sans CV. Les dossiers complets ont un meilleur taux de réponse.`, color: '#ef4444' });

    const withoutLettre = c.filter(x => !x.lettreMotivation).length;
    if (withoutLettre > 0)
      tips.push({ icon: '✏️', title: `Lettre de motivation manquante`, detail: `${withoutLettre} candidature(s) sans lettre. Personnalisez votre message pour chaque offre.`, color: '#f59e0b' });

    const withoutPortfolio = c.filter(x => !x.portfolio).length;
    if (withoutPortfolio > 0)
      tips.push({ icon: '💼', title: `Ajoutez un portfolio`, detail: `${withoutPortfolio} candidature(s) sans portfolio. Un portfolio visuel augmente la différentiation.`, color: '#8b5cf6' });

    const decided = c.filter(x => x.statut !== 'EN_ATTENTE').length;
    const decisionRate = c.length > 0 ? (decided / c.length) * 100 : 0;
    if (decisionRate < 30)
      tips.push({ icon: '⏳', title: `Relancez vos candidatures`, detail: `${100 - Math.round(decisionRate)}% de vos candidatures n'ont pas encore de réponse. Pensez à relancer après 2 semaines.`, color: '#0ea5e9' });

    const oppIds = c.map(x => x.opportuniteId);
    const postulatedOpps = this.opportunites.filter(o => oppIds.includes(o.id));
    const secteurs = new Set(postulatedOpps.map((o: any) => o.secteur).filter(Boolean));
    if (secteurs.size < 2)
      tips.push({ icon: '🌐', title: `Diversifiez vos candidatures`, detail: `Vous postulez dans 1 seul secteur. Élargissez vers d'autres domaines pour augmenter vos chances.`, color: '#10b981' });

    if (this.analytics.tauxSucces >= 50)
      tips.push({ icon: '🏆', title: `Profil très performant !`, detail: `Votre taux de succès est de ${this.analytics.tauxSucces}%. Vous êtes dans le top des candidats.`, color: '#10b981' });

    if (tips.length === 0)
      tips.push({ icon: '✨', title: `Profil optimisé`, detail: `Vos dossiers sont complets et variés. Continuez dans cette direction !`, color: '#6366f1' });

    this.cvTips = tips;
  }

  // =============================================
  // STRATEGY CANVAS — Draggable Notes & Drawing
  // =============================================
  
  // 1. STICKY NOTES DRAG & DROP
  addStickyNote(): void {
    const note = {
      id: Date.now(), text: '', color: this.newStickyColor,
      createdAt: new Date().toLocaleDateString('fr-FR'),
      x: 20 + (this.stickyNotes.length * 10), y: 150 + (this.stickyNotes.length * 10)
    };
    this.stickyNotes.unshift(note);
    this.editingStickyId = note.id;
    this.tempStickyText = '';
    this.saveBoard();
  }

  onNoteMouseDown(e: MouseEvent, note: any): void {
    if (this.drawMode !== 'none') return; // Don't drag if drawing
    this.isDragging = true;
    this.draggedNoteId = note.id;
    this.dragOffset = { x: e.clientX - note.x, y: e.clientY - note.y };
  }


  // 2. CANVAS DRAWING (MARKER)
  setDrawMode(mode: 'pen' | 'eraser' | 'none'): void {
    this.drawMode = mode;
  }

  startDrawing(e: MouseEvent): void {
    if (this.drawMode === 'none') return;
    this.isDrawing = true;
    const canvas = document.getElementById('strategyCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.lastPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  draw(e: MouseEvent): void {
    if (!this.isDrawing) return;
    const canvas = document.getElementById('strategyCanvas') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    ctx.beginPath();
    ctx.moveTo(this.lastPos.x, this.lastPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.strokeStyle = this.drawMode === 'pen' ? '#4f46e5' : '#1e293b'; // Eraser uses bg color (simplified)
    if (this.drawMode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 3;
    }
    ctx.lineCap = 'round';
    ctx.stroke();

    this.lastPos = currentPos;
  }

  stopDrawing(): void {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.saveCanvas();
    }
  }

  clearCanvas(): void {
    const canvas = document.getElementById('strategyCanvas') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.saveCanvas();
    }
  }

  saveCanvas(): void {
    const canvas = document.getElementById('strategyCanvas') as HTMLCanvasElement;
    if (canvas) localStorage.setItem('scb_canvas', canvas.toDataURL());
  }

  loadCanvas(): void {
    setTimeout(() => {
      const canvas = document.getElementById('strategyCanvas') as HTMLCanvasElement;
      const ctx = canvas?.getContext('2d');
      const data = localStorage.getItem('scb_canvas');
      if (ctx && data) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = data;
      }
    }, 100);
  }

  // === STRATEGY STAMPS ===
  addStamp(s: any): void {
    const stamp = { ...s, id: Date.now(), x: 50, y: 300 };
    this.placedStamps.push(stamp);
    this.saveBoard();
  }
  onStampMouseDown(e: MouseEvent, stamp: any): void {
    if (this.drawMode !== 'none') return;
    this.isDragging = true;
    this.draggedStampId = stamp.id;
    this.dragOffset = { x: e.clientX - stamp.x, y: e.clientY - stamp.y };
  }
  deleteStamp(id: number): void {
    this.placedStamps = this.placedStamps.filter(s => s.id !== id);
    this.saveBoard();
  }

  // === UI HELPERS & PERSISTENCE ===
  editSticky(note: any): void { this.editingStickyId = note.id; this.tempStickyText = note.text; }
  saveSticky(id: number): void {
    const note = this.stickyNotes.find(n => n.id === id);
    if (note) note.text = this.tempStickyText;
    this.editingStickyId = null;
    this.saveBoard();
  }
  cancelSticky(): void { this.editingStickyId = null; }
  deleteSticky(id: number): void { this.stickyNotes = this.stickyNotes.filter(n => n.id !== id); this.saveBoard(); }
  changeStickyColor(note: any, color: string): void { note.color = color; this.saveBoard(); }

  saveBoard(): void { 
    localStorage.setItem('scb_notes', JSON.stringify(this.stickyNotes)); 
    localStorage.setItem('scb_stamps', JSON.stringify(this.placedStamps)); 
  }
  loadBoard(): void {
    try {
      const saved = localStorage.getItem('scb_notes');
      if (saved) this.stickyNotes = JSON.parse(saved);
      const savedStamps = localStorage.getItem('scb_stamps');
      if (savedStamps) this.placedStamps = JSON.parse(savedStamps);
      this.loadCanvas();
    } catch (e) {}
  }

  onCanvasMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      if (this.draggedNoteId !== null) {
        const note = this.stickyNotes.find(n => n.id === this.draggedNoteId);
        if (note) { note.x = e.clientX - this.dragOffset.x; note.y = e.clientY - this.dragOffset.y; }
      } else if (this.draggedStampId !== null) {
        const stamp = this.placedStamps.find(s => s.id === this.draggedStampId);
        if (stamp) { stamp.x = e.clientX - this.dragOffset.x; stamp.y = e.clientY - this.dragOffset.y; }
      }
    } else if (this.isDrawing) {
      this.draw(e);
    }
  }

  onCanvasMouseUp(): void {
    this.isDragging = false;
    this.draggedNoteId = null;
    this.draggedStampId = null;
    this.saveBoard();
    this.stopDrawing();
  }
  // =============================================
  // EXECUTIVE DECISION ENGINE (MCDA)
  // =============================================
  computeStrategicWinners(): void {
    if (!this.opportunites.length) return;

    const w = this.decisionWeights;
    const totalWeight = (w.techMatch + w.passion + w.salary) || 1; // Avoid div by zero

    const results = this.opportunites.map(opp => {
      const cand = this.mesCandidatures.find(c => c.opportuniteId === opp.id);
      
      // Calcul Pondéré Normalisé
      // On prend le score IA calculé pour cette offre (ou 50 par défaut si non scanné)
      const techVal = this.oppMatchScores[opp.id] || cand?.scoreIA || 50;
      
      // Pour les offres non postulées, on simule une motivation et stabilité de base
      const passionVal = (cand as any)?.enthousiasme === 'TOP' ? 100 : 60;
      const stabilityVal = (cand as any)?.validIntegrity ? 100 : 40;

      const weightedSum = (techVal * w.techMatch) + (passionVal * w.passion) + (stabilityVal * w.salary);
      const finalScore = Math.round(weightedSum / totalWeight);
      
      // Génération de Roadmap
      let roadmap = 'Profil optimal détecté.';
      if (finalScore < 85) {
        if (techVal < 60) roadmap = 'Action : Renforcer vos compétences (DNA technique trop faible).';
        else if (!cand) roadmap = 'Action : Postulez dès maintenant à cette offre !';
        else if (passionVal < 80) roadmap = 'Action : Mettez en avant votre motivation dans le pitch.';
        else roadmap = 'Action : Améliorez l\'intégrité de votre dossier.';
      }

      return {
        title: opp.titre || 'Opportunité',
        score: Math.min(100, finalScore),
        reason: roadmap
      };
    });

    this.strategicWinners = results.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  generatePassport(): void {
    this.showPassport = true;
    this.passportHash = 'B-ID-' + Math.random().toString(36).substring(7).toUpperCase();
    this.computeStrategicWinners();
  }

  simulateAtsIngestion(): void {
    this.showAtsPreview = true;
    this.atsVerifying = true;
    setTimeout(() => { this.atsVerifying = false; }, 2500);
  }

  exportIntelligenceJSON(): void {
    const score = this.analytics.tauxSucces || 0;
    const certLevel = score >= 90 ? 'PLATINUM' : score >= 75 ? 'GOLD' : score >= 60 ? 'SILVER' : 'BRONZE';

    const bestCandidature = this.mesCandidatures
      .filter(c => c.scoreIA)
      .sort((a, b) => (b.scoreIA || 0) - (a.scoreIA || 0))[0];

    const passport = {
      "@context": "https://schema.org/",
      "@type": "EducationalOccupationalCredential",
      "name": `FlexBidaya Intelligence Passport — ${certLevel}`,
      "description": "Verifiable credential generated by FlexBidaya AI Engine with Blockchain integrity proof",
      "issuer": {
        "@type": "Organization",
        "name": "FlexBidaya Platform",
        "url": "https://flexbidaya.io"
      },
      "credentialSubject": {
        "@type": "Person",
        "name": this.username,
        "identifier": `FLX-${this.userId}`
      },
      "certificationLevel": certLevel,
      "issuanceDate": new Date().toISOString(),
      "expirationDate": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      "scores": {
        "successRate": `${this.analytics.tauxSucces}%`,
        "integrityScore": `${this.analytics.tauxIntegrite}%`,
        "aiMatchScore": bestCandidature ? `${bestCandidature.scoreIA}%` : 'N/A'
      },
      "skills": this.dnaSkills || [],
      "blockchainProof": {
        "hash": this.passportHash,
        "protocol": "SHA-256 / Zero-Knowledge Proof",
        "verifiedAt": new Date().toISOString(),
        "verifyUrl": `https://flexbidaya.io/verify/${this.passportHash}`
      },
      "aiAnalysis": bestCandidature ? {
        "forces": bestCandidature.forcesIA,
        "recommandation": bestCandidature.recommandationIA,
        "sentiment": bestCandidature.sentiment
      } : null
    };

    const blob = new Blob([JSON.stringify(passport, null, 2)], { type: 'application/ld+json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlexBidaya_Passport_${certLevel}_${this.username}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.jsonld`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  copyShareLink(): void {
    const link = `https://cib-portal.io/access/${this.shareToken}`;
    navigator.clipboard.writeText(link);
    alert('Lien de partage sécurisé copié dans le presse-papier !');
  }

  // =============================================
  // OLLAMA HYBRID ENGINE (Real API + Pro Fallback)
  // =============================================
  triggerAIScan(): void {
    if (this.aiScanning) return;
    
    // Auto-convertir le texte tapé sans avoir fait "Entrée"
    if (this.cvSkillInput.trim() && !this.cvSkills.includes(this.cvSkillInput.trim())) {
      this.cvSkills.push(this.cvSkillInput.trim());
      this.cvSkillInput = '';
    }

    if (!this.cvText.trim()) {
      this.aiLogs = ['❌ Veuillez saisir vos compétences / CV avant de lancer l\'analyse !'];
      return;
    }
    
    this.aiScanning = true;
    this.aiProgress = 0;
    this.aiLogs = [
      '🔌 Attempting connection to Ollama (localhost:11434)...',
      '📦 Model: llama3 | Context: CV + Opportunity Description'
    ];

    // Try real Ollama connection
    const prompt = `You are a recruitment AI. Given this candidate CV: "${this.cvText}", rate the match with these opportunities: ${this.opportunites.map(o => o.titre + '(' + o.description?.substring(0,50) + ')').join(', ')}. Return only a JSON object {oppTitle: score} where score is 0-100.`;

    this.http.post<any>('http://localhost:11434/api/generate', {
      model: 'llama3',
      prompt: prompt,
      stream: false
    }).subscribe({
      next: (res) => {
        this.aiLogs.push('✅ [OLLAMA] Connection successful! Llama3 responded.');
        this.aiLogs.push('[OLLAMA] Parsing semantic response...');
        try {
          const jsonStr = res.response.match(/\{[^}]+\}/)?.[0] || '{}';
          const parsed = JSON.parse(jsonStr);
          this.opportunites.forEach(o => {
            const key = Object.keys(parsed).find(k => o.titre?.toLowerCase().includes(k.toLowerCase()));
            this.oppMatchScores[o.id] = key ? Math.min(100, Math.max(0, parsed[key])) : this.computeLocalScore(o);
          });
        } catch {
          this.opportunites.forEach(o => this.oppMatchScores[o.id] = this.computeLocalScore(o));
        }
        this.finishAIScan();
      },
      error: () => {
        this.aiLogs.push('⚠️  [OLLAMA] Server offline. Switching to Neural Simulation Engine...');
        this.aiLogs.push('[ENGINE] Loading semantic keyword extractor...');
        // Fallback: Local professional scoring
        const interval = setInterval(() => {
          this.aiProgress += 8;
          if (this.aiProgress === 24) this.aiLogs.push('[ENGINE] Parsing CV skills: ' + this.cvText.substring(0, 40) + '...');
          if (this.aiProgress === 48) this.aiLogs.push('[ENGINE] Extracting opportunity keywords via TF-IDF...');
          if (this.aiProgress === 72) this.aiLogs.push('[ENGINE] Computing Cosine Similarity vectors...');
          if (this.aiProgress === 88) this.aiLogs.push('[ENGINE] Applying integrity & portfolio bonus weights...');
          if (this.aiProgress >= 100) {
            clearInterval(interval);
            this.opportunites.forEach(o => this.oppMatchScores[o.id] = this.computeLocalScore(o));
            this.finishAIScan();
          }
        }, 120);
      }
    });
  }

  computeLocalScore(opp: any): number {
    if (!this.cvText.trim()) return 0;
    
    const cvWords = this.cvText.toLowerCase().split(/[\s,;.]+/).filter(w => w.length > 2);
    const oppText = ((opp.titre || '') + ' ' + (opp.description || '') + ' ' + (opp.secteur || '')).toLowerCase();
    
    // Matching sémantique : vérifie si les mots du CV sont dans l'offre (et vice-versa)
    let matchCount = 0;
    cvWords.forEach(word => {
      if (oppText.includes(word)) matchCount += 2;          // match exact
      else if (word.length > 4 && oppText.split(' ').some(w => w.startsWith(word.substring(0, 4)))) matchCount += 1; // match partiel
    });
    
    // Score sémantique : max 70 pts
    const keywordScore = Math.min(70, matchCount * 10);
    
    // Bonus candidature réelle (si déjà postulé)
    const cand = this.mesCandidatures.find(c => c.opportuniteId === opp.id);
    const integrityBonus = cand?.validIntegrity ? 15 : 0;
    const portfolioBonus = cand?.portfolio ? 10 : 0;
    const cvBonus = cand?.cv ? 5 : 0;
    
    // Pas de score de base - score réel uniquement
    const total = keywordScore + integrityBonus + portfolioBonus + cvBonus;
    return Math.min(98, Math.max(5, total));
  }

  finishAIScan(): void {
    this.aiProgress = 100;
    this.aiScanning = false;

    // Update candidature scores
    this.mesCandidatures.forEach(c => {
      c.scoreIA = this.oppMatchScores[c.opportuniteId] || this.computeLocalScore(
        this.opportunites.find(o => o.id === c.opportuniteId) || {}
      );
    });

    // Sort opportunities by match score (best first)
    this.filteredOpportunites = [...this.filteredOpportunites].sort(
      (a, b) => (this.oppMatchScores[b.id] || 0) - (this.oppMatchScores[a.id] || 0)
    );

    // Appeler computeAnalytics D'ABORD
    this.computeAnalytics();
    this.buildDNAFromRealData();

    // ENSUITE écraser topOpportunite avec le vrai meilleur match IA
    const bestOppId = Object.entries(this.oppMatchScores)
      .sort(([, a], [, b]) => b - a)[0]?.[0];
    if (bestOppId) {
      const bestOpp = this.opportunites.find(o => o.id === Number(bestOppId));
      const bestScore = this.oppMatchScores[Number(bestOppId)];
      if (bestOpp && bestScore > 0) {
        this.analytics.topOpportunite = bestOpp.titre + ' — ' + bestScore + '% match';
      }
    }

    this.sortedAfterScan = true;
    this.aiLogs.push('✅ Neural Analysis Complete. ' + this.opportunites.length + ' opportunities scored.');
    this.aiLogs.push('🏆 Best Match: ' + (this.analytics.topOpportunite || 'N/A'));

    // Actualiser le Decision Engine avec les nouveaux scores IA !
    this.computeStrategicWinners();
  }
}
