import { Component, OnInit } from '@angular/core';
import { FormationService, Formation, Lecon } from '../formation.service';
import { InscriptionService } from '../inscription.service';
import { TestFormationService } from '../test-formation.service';
import { TestFormation, SoumissionTest } from '../test-formation.model';
import { UserService } from '../../services/user.service';
import { forkJoin } from 'rxjs';

type FormMode = 'create' | 'edit';

@Component({
  selector: 'app-mentor-dashboard',
  templateUrl: './mentor-dashboard.component.html',
  styleUrls: ['./mentor-dashboard.component.css'],
})
export class MentorDashboardComponent implements OnInit {
  activeSection: 'formations' | 'lecons' | 'reouvertures' | 'examens' | 'tendances' | 'stats' = 'stats';

  // ─── Authenticated User ────────────────────────────────
  currentUserId: number = 0;
  currentUsername: string = 'Expert';

  // ─── Formations ───────────────────────────────────────
  formations: Formation[] = [];
  formationForm = this.blankFormation();
  formationMode: FormMode = 'create';
  editFormationId?: number;
  imageFile?: File;
  msgFormation = '';
  isLoadingFormations = false;

  // ─── Search ───────────────────────────────────────────
  searchQuery = '';

  get filteredFormations(): Formation[] {
    if (!this.searchQuery.trim()) return this.formations;
    const q = this.searchQuery.toLowerCase();
    return this.formations.filter(f =>
      f.titre?.toLowerCase().includes(q) ||
      f.categorie?.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q)
    );
  }

  clearSearch() { this.searchQuery = ''; }

  // ─── Leçons ───────────────────────────────────────────
  selectedFormationId?: number;
  lecons: Lecon[] = [];
  leconForm = this.blankLecon();
  editLeconId?: number;
  leconFile?: File;
  msgLecon = '';

  // ─── Stats ────────────────────────────────────────────
  allLecons: Lecon[] = [];
  isLoadingStats = false;

  get totalFormations(): number { return this.formations.length; }
  get totalLecons(): number { return this.allLecons.length; }
  get totalDureeHeures(): number { return this.formations.reduce((s, f) => s + (f.dureeHeures || 0), 0); }
  get videoCount(): number { return this.allLecons.filter(l => l.type === 'VIDEO').length; }
  get pptCount(): number { return this.allLecons.filter(l => l.type === 'PPT').length; }

  // ─── Examens & Notes ──────────────────────────────────
  examens: TestFormation[] = [];
  selectedExamen?: TestFormation;
  soumissions: SoumissionTest[] = [];
  isLoadingExamens = false;
  isLoadingSoumissions = false;

  // ─── Stats globales ────────────────────────────────
  allInscriptions: any[] = [];
  allCertifications: any[] = [];
  isLoadingGlobalStats = false;

  get totalEtudiants(): number { return this.allInscriptions.length; }
  get totalEtudiantsTermines(): number { return this.allInscriptions.filter((i: any) => i.statut === 'TERMINEE').length; }
  get totalExamens(): number { return this.examens.length; }
  get totalCertifications(): number { return this.allCertifications.length; }
  get tauxCompletion(): number {
    if (this.totalEtudiants === 0) return 0;
    return Math.round((this.totalEtudiantsTermines / this.totalEtudiants) * 100);
  }
  get dureeTotaleHeures(): number { return this.formations.reduce((s, f) => s + (f.dureeHeures || 0), 0); }

  // ─── Tendances Marché ──────────────────────────────────
  marketTrendsLoading = false;
  marketTrendsResult: any = null;
  marketTrendsError = '';

  constructor(
    private fs: FormationService,
    private is: InscriptionService,
    private testService: TestFormationService,
    private userService: UserService
  ) {}

  // ─── Demandes de Réouverture ──────────────────────────────
  demandesReouverture: any[] = [];
  isLoadingDemandes = false;

  ngOnInit() {
    // ✅ Charger l'utilisateur courant depuis le JWT
    this.currentUserId = this.fs.getUserIdFromToken();
    this.currentUsername = localStorage.getItem('username') || 'Expert';
    // Mettre à jour depuis UserService si possible
    try {
      this.userService.getCurrentUser().subscribe({
        next: (u) => {
          if (u.id) this.currentUserId = u.id;
          if (u.username) this.currentUsername = u.username;
        },
        error: () => {} // fallback déjà géré
      });
    } catch {}
    this.loadAll();
    this.loadDemandesReouverture();
    this.loadExamens();
    this.loadGlobalStats();
  }

  loadGlobalStats() {
    this.isLoadingGlobalStats = true;
    this.is.getVueMentor().subscribe({
      next: (data: any[]) => {
        this.allInscriptions = data;
        this.isLoadingGlobalStats = false;
      },
      error: () => this.isLoadingGlobalStats = false
    });
    this.is.getCertificationsMentor().subscribe({
      next: (certs: any[]) => { this.allCertifications = certs; },
      error: () => {}
    });
  }

  loadExamens() {
    this.isLoadingExamens = true;
    this.testService.getAllExamens().subscribe({
      next: (exams) => {
        this.examens = exams.sort((a, b) => new Date(a.heureFixeDebut).getTime() - new Date(b.heureFixeDebut).getTime());
        this.isLoadingExamens = false;
      },
      error: () => this.isLoadingExamens = false
    });
  }

  selecterExamen(exam: TestFormation) {
    this.selectedExamen = exam;
    this.soumissions = [];
    this.isLoadingSoumissions = true;
    this.testService.getSoumissionsParTest(exam.id!).subscribe({
      next: (s) => { this.soumissions = s; this.isLoadingSoumissions = false; },
      error: () => this.isLoadingSoumissions = false
    });
  }

  loadDemandesReouverture() {
    this.isLoadingDemandes = true;
    this.is.getDemandesReouvertureFormation().subscribe({
      next: (d) => {
        this.demandesReouverture = d;
        this.isLoadingDemandes = false;
      },
      error: () => this.isLoadingDemandes = false
    });
  }

  approuverReouverture(inscriptionId: number) {
    if (!confirm('Autoriser cet apprenant à refaire toute la formation ?')) return;
    this.is.approuverReouvertureFormation(inscriptionId).subscribe(() => {
      this.msgFormation = '✅ Demande de réouverture approuvée.';
      this.loadDemandesReouverture();
      setTimeout(() => this.msgFormation = '', 4000);
    });
  }

  refuserReouverture(inscriptionId: number) {
    if (!confirm('Refuser cette demande de réouverture ?')) return;
    this.is.refuserReouvertureFormation(inscriptionId).subscribe(() => {
      this.msgFormation = '❌ Demande de réouverture refusée.';
      this.loadDemandesReouverture();
      setTimeout(() => this.msgFormation = '', 4000);
    });
  }

  loadAll() {
    this.isLoadingFormations = true;
    this.isLoadingStats = true;
    this.fs.getMesFormations().subscribe({
      next: (formations) => {
        this.formations = formations ?? [];
        this.isLoadingFormations = false;
        if (this.formations.length > 0) {
          const reqs = this.formations.map(f => this.fs.getLecons(f.id));
          forkJoin(reqs).subscribe({
            next: (arrays) => { this.allLecons = arrays.flat(); this.isLoadingStats = false; },
            error: () => { this.isLoadingStats = false; }
          });
        } else {
          this.isLoadingStats = false;
        }
      },
      error: () => {
        this.formations = [];
        this.isLoadingFormations = false;
        this.isLoadingStats = false;
        this.msgFormation = '❌ Impossible de charger. Vérifiez que le serveur est démarré.';
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  // FORMATIONS
  // ═══════════════════════════════════════════════════════
  blankFormation() {
    return { titre: '', description: '', categorie: 'TECH', niveau: 'DEBUTANT', dureeHeures: 1 };
  }

  selectImageFile(e: Event) {
    this.imageFile = (e.target as HTMLInputElement).files?.[0];
  }

  saveFormation() {
    if (!this.formationForm.titre?.trim()) { this.msgFormation = '⚠️ Le titre est obligatoire'; return; }
    if (!this.formationForm.description?.trim()) { this.msgFormation = '⚠️ La description est obligatoire'; return; }

    const fd = new FormData();
    fd.append('titre', this.formationForm.titre.trim());
    fd.append('description', this.formationForm.description.trim());
    fd.append('categorie', this.formationForm.categorie);
    fd.append('niveau', this.formationForm.niveau);
    fd.append('dureeHeures', String(this.formationForm.dureeHeures));
    // ✅ Utilise l'ID extrait du JWT (pas statique)
    fd.append('expertId', String(this.currentUserId));
    if (this.imageFile) fd.append('image', this.imageFile);

    const op = this.formationMode === 'create'
      ? this.fs.create(fd)
      : this.fs.update(this.editFormationId!, fd);

    op.subscribe({
      next: () => {
        this.msgFormation = this.formationMode === 'create' ? '✅ Formation créée !' : '✅ Formation mise à jour !';
        this.formationForm = this.blankFormation();
        this.imageFile = undefined;
        this.formationMode = 'create';
        this.editFormationId = undefined;
        this.loadAll();
        setTimeout(() => this.msgFormation = '', 4000);
      },
      error: (err) => {
        this.msgFormation = '❌ Erreur : ' + (err?.error?.erreur || err?.error?.message || err?.statusText || 'Inconnue');
      },
    });
  }

  editFormation(f: Formation) {
    this.formationMode = 'edit';
    this.editFormationId = f.id;
    this.formationForm = { titre: f.titre, description: f.description, categorie: f.categorie, niveau: f.niveau, dureeHeures: f.dureeHeures };
    this.msgFormation = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteFormation(id: number) {
    if (!confirm('Supprimer cette formation et toutes ses leçons ?')) return;
    this.fs.delete(id).subscribe({
      next: () => { this.msgFormation = '✅ Formation supprimée'; this.loadAll(); setTimeout(() => this.msgFormation = '', 3000); },
      error: (e) => {
        const msg = e?.error?.message || e?.error?.erreur || (typeof e?.error === 'string' ? e.error : null) || e?.statusText || 'Erreur inconnue';
        this.msgFormation = `❌ Suppression échouée (${e?.status}): ${msg}`;
      },
    });
  }

  cancelFormation() {
    this.formationMode = 'create';
    this.editFormationId = undefined;
    this.formationForm = this.blankFormation();
    this.imageFile = undefined;
    this.msgFormation = '';
  }

  getProgress(heures: number): number { return Math.min((heures / 30) * 100, 100); }

  categoryIcon(cat: string): string {
    const icons: Record<string, string> = { 'TECH': '💻', 'MARKETING': '📣', 'FINANCE': '💰', 'DESIGN': '🎨', 'MANAGEMENT': '🏢', 'ENTREPRENEURIAT': '🚀' };
    return icons[cat] || '📚';
  }

  niveauIcon(n: string): string {
    const icons: Record<string, string> = { 'DEBUTANT': '🌱', 'INTERMEDIAIRE': '⚡', 'AVANCE': '🏆' };
    return icons[n] || '📊';
  }

  // ═══════════════════════════════════════════════════════
  // LEÇONS
  // ═══════════════════════════════════════════════════════
  blankLecon() {
    return { titre: '', type: 'VIDEO' as 'VIDEO' | 'PPT', cheminFichier: '', ordre: 1, dureeMinutes: 10, isObligatoire: true };
  }

  loadLecons() {
    if (!this.selectedFormationId) return;
    this.fs.getLecons(this.selectedFormationId).subscribe({
      next: (l) => { this.lecons = l ?? []; },
      error: () => { this.lecons = []; this.msgLecon = '❌ Impossible de charger les leçons.'; }
    });
  }

  onSelectFormationForLecon(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    this.selectedFormationId = val ? +val : undefined;
    this.lecons = [];
    if (this.selectedFormationId) this.loadLecons();
  }

  selectLeconFile(e: Event) {
    this.leconFile = (e.target as HTMLInputElement).files?.[0];
  }

  saveLecon() {
    if (!this.selectedFormationId) { this.msgLecon = '⚠️ Sélectionnez une formation'; return; }
    if (!this.leconForm.titre?.trim()) { this.msgLecon = '⚠️ Le titre est obligatoire'; return; }
    if (!this.leconFile && !this.editLeconId) { this.msgLecon = '⚠️ Veuillez sélectionner un fichier'; return; }

    const fd = new FormData();
    fd.append('formationId', String(this.selectedFormationId));
    fd.append('titre', this.leconForm.titre.trim());
    fd.append('ordre', String(this.leconForm.ordre));
    fd.append('isObligatoire', String(this.leconForm.isObligatoire));
    if (this.leconForm.dureeMinutes) fd.append('dureeMinutes', String(this.leconForm.dureeMinutes));
    if (this.leconFile) {
      fd.append('fichier', this.leconFile);
      if (this.leconForm.type === 'VIDEO') fd.append('fichierVideo', this.leconFile);
    }

    const req = this.editLeconId
      ? this.fs.updateLecon(this.editLeconId, fd)
      : (this.leconForm.type === 'VIDEO' ? this.fs.addLeconVideo(fd) : this.fs.addLeconPPT(fd));

    req.subscribe({
      next: () => {
        this.msgLecon = this.editLeconId ? '✅ Leçon modifiée !' : '✅ Leçon ajoutée !';
        this.leconForm = this.blankLecon();
        this.leconFile = undefined;
        this.editLeconId = undefined;
        this.loadLecons();
        this.loadAll();
        setTimeout(() => this.msgLecon = '', 4000);
      },
      error: (err) => { 
        const errorMsg = err?.error?.erreur || err?.error?.message || (typeof err?.error === 'string' ? err.error : err?.statusText || 'Inconnue');
        this.msgLecon = '❌ Erreur : ' + errorMsg; 
      }
    });
  }

  editLecon(l: Lecon) {
    this.editLeconId = l.id;
    this.leconForm = { titre: l.titre, type: l.type, cheminFichier: l.cheminFichier, ordre: l.ordre, dureeMinutes: l.dureeMinutes || 0, isObligatoire: l.isObligatoire };
    this.msgLecon = '✏️ Modification en cours.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelLecon() {
    this.editLeconId = undefined;
    this.leconForm = this.blankLecon();
    this.leconFile = undefined;
    this.msgLecon = '';
  }

  deleteLecon(id: number) {
    if (!confirm('Supprimer cette leçon ?')) return;
    // ✅ Retrait immédiat de l'UI (évite désynchronisation)
    this.lecons = this.lecons.filter(l => l.id !== id);
    this.fs.deleteLecon(id).subscribe({
      next: () => {
        this.msgLecon = '✅ Leçon supprimée';
        // Rechargement forcé depuis le serveur
        this.loadLecons();
        this.loadAll();
        setTimeout(() => this.msgLecon = '', 3000);
      },
      error: (e) => {
        // Si erreur, on recharge quand même pour resynchroniser l'état
        this.loadLecons();
        const msg = e?.error?.message || (typeof e?.error === 'string' ? e.error : null) || e?.statusText || 'Inconnue';
        // 400 "non trouvée" = déjà supprimée → traiter comme succès
        if (e?.status === 400 && msg?.includes('non trouvée')) {
          this.msgLecon = '✅ Leçon supprimée';
          this.loadAll();
        } else {
          this.msgLecon = `❌ Erreur suppression (${e?.status}): ${msg}`;
        }
        setTimeout(() => this.msgLecon = '', 3000);
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  // EXPORT & NOTIFICATIONS (Statistiques & Google Sheet compatible)
  // ═══════════════════════════════════════════════════════

  get totalInscritsExamen(): number {
    return this.soumissions.length;
  }

  get tReussiteExamen(): number {
    if (this.soumissions.length === 0 || !this.selectedExamen) return 0;
    const seuil = this.selectedExamen.scoreSeuil || 0;
    const notesCorrigees = this.soumissions.filter(s => s.estCorrige);
    if (notesCorrigees.length === 0) return 0;
    
    const reussites = notesCorrigees.filter(s => s.scoreObtenu >= seuil).length;
    return Math.round((reussites / notesCorrigees.length) * 100);
  }

  get tCorrectionExamen(): number {
    if (this.soumissions.length === 0) return 0;
    const corriges = this.soumissions.filter(s => s.estCorrige).length;
    return Math.round((corriges / this.soumissions.length) * 100);
  }

  exportSoumissionsToCSV() {
    if (!this.selectedExamen || this.soumissions.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    // Préparation de l'en-tête CSV
    let csvContent = 'ID Inscription,Apprenant,Email,Date Soumission,Score,Seuil Requis,Statut,Fraude,Infractions\n';

    // Remplissage des lignes avec les données
    this.soumissions.forEach((s) => {
      const id = s.id;
      const nom = s.entrepreneur?.username || 'Inconnu';
      const email = s.entrepreneur?.email || 'N/A';
      const date = s.dateSoumission ? new Date(s.dateSoumission).toLocaleString() : 'N/A';
      const score = s.scoreObtenu;
      const seuil = this.selectedExamen?.scoreSeuil || 0;
      
      const fraude = s.tentativeFraude ? 'Oui' : 'Non';
      const infractions = s.infractionsDetectees || 0;

      let statut = 'En attente';
      if (s.estCorrige) {
        statut = (score >= seuil && !s.tentativeFraude) ? 'Réussi' : 'Échoué';
      } else if (s.tentativeFraude) {
        statut = 'Échoué (Fraude)';
      }

      // Remplacer les virgules dans le texte pour éviter de casser le format CSV
      const escapedNom = nom.replace(/,/g, ' ');
      const escapedEmail = email.replace(/,/g, ' ');

      csvContent += `${id},${escapedNom},${escapedEmail},${date},${score},${seuil},${statut},${fraude},${infractions}\n`;
    });

    // Création du fichier Blob et téléchargement forcé
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel UTF-8 UTF-8 
    const link = document.createElement('a');
    
    // Nom du fichier personnalisé
    const safeTitle = (this.selectedExamen.formation?.titre || 'Examen').replace(/[^a-z0-9]/gi, '_');
    link.href = URL.createObjectURL(blob);
    link.download = `Resultats_${safeTitle}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  envoyerEmailGroupe() {
    if (!this.selectedExamen) return;
    const count = this.soumissions.length;
    if (count === 0) {
      alert("Aucun apprenant à contacter.");
      return;
    }
    
    // Stub function - En production ça appellerait l'endpoint Spring Boot : /api/emails/send-bulk
    if (confirm(`📧 Voulez-vous envoyer un e-mail de rappel/résultats aux ${count} inscrits de l'examen ?`)) {
      // Simulation appel backend
      alert("✅ Les e-mails ont été mis en file d'attente pour l'envoi.");
    }
  }

  // ─── Tendances Marché (Web Scraping via Spring Boot → Python) ──
  analyzeMarket(): void {
    this.marketTrendsLoading = true;
    this.marketTrendsError = '';
    this.marketTrendsResult = null;

    // Appel via Spring Boot qui appelle Python (web scraping) puis matche avec les formations
    this.fs.getMarketTrends().subscribe({
      next: (data: any) => {
        this.marketTrendsResult = {
          motsClesDemandes: data.motsClesDemandes || [],
          motsClesCouvertes: data.motsClesCouvertes || [],
          motsClesManquantes: data.motsClesManquantes || [],
          formationsExistantes: data.formationsExistantes || [],
          scrapingStatus: data.scrapingStatus || 'unknown',
          sourcesCount: data.sourcesCount || 0
        };
        this.marketTrendsLoading = false;
      },
      error: (err) => {
        this.marketTrendsError = `Impossible de contacter le service. Vérifiez que Spring Boot (8080) et Python (9000) sont lancés.`;
        this.marketTrendsLoading = false;
        console.error(err);
      }
    });
  }

  // ─── Dynamic Username (basé sur le JWT, pas statique) ────
  getMentorUsername(): string {
    return this.currentUsername || localStorage.getItem('username') || 'Expert';
  }

  getMentorInitiales(): string {
    const username = this.currentUsername || localStorage.getItem('username') || '';
    if (!username) return 'EX';
    const parts = username.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  }

}
