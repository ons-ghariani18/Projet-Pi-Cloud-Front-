import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Evenement } from '../models/evenement';
import { Hackathon } from '../models/hackathon';
import { EventService } from '../services/event.service';
import { HackathonService } from '../services/hackathon.service';
import { StandService } from '../services/stand.service';
import { Stand } from '../models/stand';
import { HackathonRegistration } from '../models/hackathon-registration';
import { RegistrationService } from '../services/registration.service';
import { Gagnant } from '../models/gagnant';
import { GagnantService } from '../services/gagnant.service';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FormService } from '../services/form.service';
import { FeedbackService } from '../services/feedback.service';
import { FeedbackForm } from '../models/feedback-form';
import { EventScore } from '../models/event-score';
import Chart from 'chart.js/auto';
import { PendingUpdateService } from '../services/pending-update.service';
import { Router } from '@angular/router';

export type EventStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface Participant {
  id: number;
  name: string;
  role: string;
  eventId: number;
    present: boolean; // ✅ AJOUTER
  type: 'event' | 'hackathon'; // ← AJOUTER
  hackathonId?: number;         // ← AJOUTER
}

export interface Toast {
  msg: string;
  type: 'success' | 'error';
}

@Component({
  selector: 'app-dashboard-org',
  templateUrl: './dashboard-org.component.html',
  styleUrls: ['./dashboard-org.component.css']
})
export class DashboardOrgComponent implements OnInit, OnDestroy {
  private hackathonPollingPaused = false;
  private hackathonOfflineToastShown = false;
  private resumeHackathonPolling(): void {
    this.hackathonPollingPaused = false;
    this.hackathonOfflineToastShown = false;
  }
  private refreshInterval: any; // ✅ stocker l'interval



  // ─── CHARTS & STATS OVERVIEW ───
@ViewChild('eventMonthlyChart') eventMonthlyChartRef!: ElementRef;
@ViewChild('hackMonthlyChart') hackMonthlyChartRef!: ElementRef;
@ViewChild('scoresChart') scoresChartRef!: ElementRef;

eventMonthlyChart: Chart | null = null;
hackMonthlyChart: Chart | null = null;
scoresChart: Chart | null = null;

monthlyEventLabels: string[] = [];
monthlyEventData: number[] = [];
monthlyHackData: number[] = [];
topSkillsList: { name: string; count: number }[] = [];
bestMonth: string = '';
bestMonthCount: number = 0;
topEventsByPresence: { event: Evenement; presentCount: number; totalCount: number; rate: number }[] = [];

// ─── Dans le corps de la classe (au même niveau que les autres propriétés) ───
monthlyActivityEventData: number[] = new Array(12).fill(0);
monthlyActivityHackData:  number[] = new Array(12).fill(0);

  // ─── DATA ───
  events: Evenement[] = [];
  hackathons: Hackathon[] = [];
  stands: Stand[] = [];
  participants: Participant[] = [];
  gagnants: Gagnant[] = [];
private pollingInterval: any = null;

  hackathonTeams: HackathonRegistration[] = [];
  teamsLoading = false;

  standForm: {
    eventId: number | null;
    startupName: string;
    domain: string;
    requiredSkills: string;
    description: string;
  } = {
    eventId: null,
    startupName: '',
    domain: 'Technologie',
    requiredSkills: '',
    description: ''
  };
// ─── IMAGE HACKATHON ───
hackImagePreview: string | null = null;
hackImageError: string = '';
  // ─── STATE ───
  currentPage: 'overview' | 'events' | 'hackathons' | 'stands' | 'participants' | 'gagnants' = 'overview';
  currentFilter: EventStatus | 'ALL' = 'ALL';
  currentEventId: number | null = null;
  showEventDetail = false;
  hackFilter: string = 'ALL';
  currentHackId: number | null = null;
  showHackDetail = false;
  participantsFilter: number | 'ALL' = 'ALL';
  isLoading = false;
  gagnantsLoading = false;

  // ─── MODAL STATE ───
  showEventModal = false;
  showHackModal = false;
  showStandModal = false;
  showConfirmModal = false;
  showGagnantModal = false;

  editingEventId: number | null = null;
  editingHackId: number | null = null;
  editingStandId: number | null = null;
  editingGagnantHackId: number | null = null;


  // ─── FEEDBACK STATE ───
showFeedbackBuilder = false;
feedbackForm: FeedbackForm = {
  title: '', description: '',
  targetType: 'EVENT', targetId: 0,
  questions: []
};
feedbackStats: any = null;
feedbackLoading = false;
showFeedbackStats = false;


  // ─── FORM MODELS ───
  evForm: Omit<Evenement, 'id' | 'status'> & { imageBase64?: string } = {
    title: '', description: '', location: '', startDate: '', endDate: '', imageBase64: ''
  };

  hackForm: Omit<Hackathon, 'id' | 'status'> = {
    title: '', description: '', domain: '', location: '', startDate: '', endDate: '',  imageBase64: '', submissionDeadline: '' 
  };

  gagnantForm: {
    first:  { teamName: string; description: string; contactEmail: string; contactPhone: string };
    second: { teamName: string; description: string; contactEmail: string; contactPhone: string };
    third:  { teamName: string; description: string; contactEmail: string; contactPhone: string };
  } = {
    first:  { teamName: '', description: '', contactEmail: '', contactPhone: '' },
    second: { teamName: '', description: '', contactEmail: '', contactPhone: '' },
    third:  { teamName: '', description: '', contactEmail: '', contactPhone: '' }
  };

  // ─── IMAGE ───
  imagePreview: string | null = null;
  imageError: string = '';

  confirmMsg = '';
  deleteCallback: (() => void) | null = null;
  eventOptions: Evenement[] = [];
  toasts: Toast[] = [];

  constructor(
    private eventService: EventService,
    private hackathonService: HackathonService,
    private standService: StandService,
    private registrationServicee: RegistrationService,
    private gagnantService: GagnantService,
    private formService: FormService,
    private feedbackService: FeedbackService,
    private pendingUpdateService: PendingUpdateService  ,
    private router: Router
  ) {}
currentUserName = '';

ngOnInit(): void {
  this.loadEvents();
  this.loadHackathons();
  this.loadStands();
  this.loadParticipants();
   this.currentUserName = this.getCurrentUserName();

  // Polling participants (page participants active seulement)
  this.pollingInterval = setInterval(() => {
    if (this.currentPage === 'participants') {
      this.loadParticipants();
    } else if (this.showEventDetail && this.currentEventId) {
      this.loadParticipantsForEvent(this.currentEventId);
    }
  }, 3000);
 
  // Polling hackathons (deadline)
  this.refreshInterval = setInterval(() => {
    this.loadHackathons();
  }, 5000);
}
 
ngAfterViewInit(): void {
  // Attendre que les données soient chargées (1.5s suffit en local)
  // En production, appeler updateOverviewStats() depuis loadParticipants() à la fin
  setTimeout(() => this.updateOverviewStats(), 1500);
}
 
loadParticipants(): void {
  forkJoin({
    forms: this.formService.getAll().pipe(catchError(() => of([]))),
    regs:  this.registrationServicee.getAll().pipe(catchError(() => of([])))
  }).subscribe({
    next: ({ forms, regs }) => {
      const eventParts: Participant[] = forms.map((f: any) => ({
        id:          f.id ?? 0,
        name:        String(f.fullName ?? ''),
        role:        String(f.skills ?? 'Participant'),
        eventId:     Number(f.event?.id ?? f.eventId ?? 0),
        present:     Boolean(f.present),
        type:        'event' as const,
        hackathonId: undefined
      }));
 
      const hackParts: Participant[] = regs.map((r: any) => ({
        id:          r.id ?? 0,
        name:        String(r.leaderName ?? ''),
        role:        `Équipe: ${r.teamName ?? ''} · ${r.teamSize ?? 1} membres`,
        eventId:     0,
        present:     Boolean(r.present),
        type:        'hackathon' as const,
        hackathonId: Number(r.hackathon?.id ?? 0)
      }));
 
      this.participants = [...eventParts, ...hackParts];
 
      // ✅ Recalculer stats si on est sur la vue d'ensemble
      if (this.currentPage === 'overview') {
        this.updateOverviewStats();
      }
    },
    error: () => this.showToast('Erreur chargement participants', 'error')
  });
}
ngOnDestroy(): void {
  if (this.pollingInterval)  clearInterval(this.pollingInterval);
  if (this.refreshInterval)  clearInterval(this.refreshInterval);
  // Détruire les instances Chart.js pour éviter les memory leaks
  this.eventMonthlyChart?.destroy();
  this.scoresChart?.destroy();
  this.activityChart?.destroy();
}
  // ════════════════════════════════
  // LOAD
  // ════════════════════════════════

loadEvents(): void {
  this.isLoading = true;
  this.eventService.getAll().subscribe({
    next: (data) => {
      // ✅ Filtrer uniquement les events de l'organisateur connecté
this.events = data.filter(e => Number(e.organisateurId) === Number(this.currentUserId));
      this.isLoading = false;
      this.loadEventScores();
    },
    error: () => { this.showToast('Erreur chargement événements', 'error'); this.isLoading = false; }
  });
}


loadHackathons(): void {
  if (this.hackathonPollingPaused) {
    return;
  }

  this.hackathonService.getAll().subscribe({
    next: (data) => {
      // ✅ Filtrer uniquement les hackathons de l'organisateur connecté
this.hackathons = data.filter(h => Number(h.organisateurId) === Number(this.currentUserId));
      this.loadAllGagnants();
      this.loadHackathonScores();
    },
    error: (error) => {
      if (error?.status === 0) {
        this.hackathonPollingPaused = true;
        if (!this.hackathonOfflineToastShown) {
          this.hackathonOfflineToastShown = true;
          this.showToast('Backend indisponible pour les hackathons. Le rafraichissement auto est mis en pause.', 'error');
        }
        return;
      }
      this.showToast('Erreur chargement hackathons', 'error');
    }
  });
}

  loadStands(): void {
    this.standService.getAll().subscribe({
      next: (data) => { this.stands = data; },
      error: () => this.showToast('Erreur chargement stands', 'error')
    });
  }

  /**
   * Charge les gagnants uniquement des hackathons APPROVED ET terminés (endDate < now).
   */
  loadAllGagnants(): void {
    const finished = this.hackathons.filter(
      h => h.status === 'APPROVED' && h.endDate && new Date(h.endDate) < new Date()
    );
    if (finished.length === 0) { this.gagnants = []; return; }

    this.gagnantsLoading = true;
    const calls = finished.map(h =>
      this.gagnantService.getByHackathon(h.id!).pipe(catchError(() => of([] as any[])))
    );

    forkJoin(calls).subscribe({
      next: (results: any[][]) => {
        const normalized: Gagnant[] = [];
        results.forEach((list, idx) => {
          const hackId = finished[idx].id!;
          (list || []).forEach((g: any) => {
            normalized.push(this.normalizeGagnant(g, hackId));
          });
        });
        this.gagnants = normalized;
        this.gagnantsLoading = false;
      },
      error: () => {
        this.showToast('Erreur chargement gagnants', 'error');
        this.gagnantsLoading = false;
      }
    });
  }

  loadTeamsForHackathon(hackathonId: number): void {
    this.teamsLoading = true;
    this.hackathonTeams = [];
    this.registrationServicee.getByHackathon(hackathonId).subscribe({
      next: (data) => { this.hackathonTeams = data; this.teamsLoading = false; },
      error: () => { this.showToast('Erreur chargement des équipes', 'error'); this.teamsLoading = false; }
    });
  }

  reloadGagnantsForHack(hackathonId: number): void {
    this.gagnantService.getByHackathon(hackathonId).subscribe({
      next: (data: any[]) => {
        const normalized = (data || []).map((g: any) => this.normalizeGagnant(g, hackathonId));
        this.gagnants = [
          ...this.gagnants.filter(g => this.extractHackId(g) !== hackathonId),
          ...normalized
        ];
      },
      error: () => this.showToast('Erreur rechargement gagnants', 'error')
    });
  }

  /**
   * Normalise un gagnant brut du backend.
   * L'API Spring Boot retourne { hackathonId: 1, ... } (forme aplatie).
   * On garantit que hackathonId ET hackathon.id sont toujours présents.
   */
  private normalizeGagnant(g: any, hackId: number): Gagnant {
    const resolvedHackId = g.hackathonId ?? g?.hackathon?.id ?? hackId;
    return {
      ...g,
      hackathonId: resolvedHackId,
      hackathon: { id: resolvedHackId }
    };
  }

  /**
   * Extrait l'id du hackathon — priorité à hackathonId (champ plat API).
   * Utilise Number() pour éviter toute comparaison string vs number.
   */
  private extractHackId(g: any): number | undefined {
    if (g?.hackathonId != null) return Number(g.hackathonId);
    if (g?.hackathon?.id != null) return Number(g.hackathon.id);
    return undefined;
  }

  // ════════════════════════════════
  // IMAGE HANDLING
  // ════════════════════════════════

  onImageSelected(event: Event): void {
    this.imageError = '';
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      this.imageError = 'Format non supporté. Utilisez JPG, PNG, WEBP ou GIF.';
      input.value = ''; return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.imageError = 'Image trop lourde. Maximum 2 Mo.';
      input.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result as string;
      this.imagePreview = result;
      this.evForm.imageBase64 = result.split(',')[1];
    };
    reader.onerror = () => { this.imageError = "Erreur lors de la lecture du fichier."; };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.imagePreview = null;
    this.evForm.imageBase64 = '';
    this.imageError = '';
    const input = document.getElementById('eventImageInput') as HTMLInputElement;
    if (input) input.value = '';
  }
onHackImageSelected(event: Event): void {
  this.hackImageError = '';
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    this.hackImageError = 'Format non supporté. Utilisez JPG, PNG, WEBP ou GIF.';
    input.value = ''; return;
  }
  if (file.size > 2 * 1024 * 1024) {
    this.hackImageError = 'Image trop lourde. Maximum 2 Mo.';
    input.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    const result = e.target?.result as string;
    this.hackImagePreview = result;
    this.hackForm.imageBase64 = result.split(',')[1];
  };
  reader.onerror = () => { this.hackImageError = "Erreur lors de la lecture du fichier."; };
  reader.readAsDataURL(file);
}

removeHackImage(): void {
  this.hackImagePreview = null;
  this.hackForm.imageBase64 = '';
  this.hackImageError = '';
  const input = document.getElementById('hackImageInput') as HTMLInputElement;
  if (input) input.value = '';
}
  getImageSrc(imageBase64: string | undefined | null): string {
    if (!imageBase64) return '';
    if (imageBase64.startsWith('data:')) return imageBase64;
    let mime = 'image/jpeg';
    if (imageBase64.startsWith('iVBORw')) mime = 'image/png';
    else if (imageBase64.startsWith('R0lGOD')) mime = 'image/gif';
    else if (imageBase64.startsWith('UklGR')) mime = 'image/webp';
    return `data:${mime};base64,${imageBase64}`;
  }

  // ════════════════════════════════
  // COMPUTED
  // ════════════════════════════════

  get kpiTotalEvents(): number { return this.events.length; }
  get kpiApprovedEvents(): number { return this.events.filter(e => e.status === 'APPROVED').length; }
  get kpiPendingEvents(): number { return this.events.filter(e => e.status === 'PENDING').length; }
  get kpiTotalHacks(): number { return this.hackathons.length; }
  get kpiPendingHacks(): number { return this.hackathons.filter(h => h.status === 'PENDING').length; }
get kpiParticipants(): number { return this.myParticipants.length; }
  get pendingCount(): number { return this.kpiPendingEvents + this.kpiPendingHacks; }

  /** Hackathons APPROVED dont la date de fin est passée */
  get finishedHackathons(): Hackathon[] {
    const now = new Date();
    return this.hackathons.filter(
      h => h.status === 'APPROVED' && h.endDate && new Date(h.endDate) < now
    );
  }

  get topbarTitle(): string {
  const map: Record<string, string> = {
    overview: "Overview",
    events: "My Events",
    hackathons: "My Hackathons",
    stands: "Stand Management",
    participants: "Participants",
    gagnants: "Hackathon Winners"
  };
    return map[this.currentPage] || '';
  }

  get filteredEvents(): Evenement[] {
    return this.currentFilter === 'ALL'
      ? this.events : this.events.filter(e => e.status === this.currentFilter);
  }

  get overviewEvents(): Evenement[] { return this.events.slice(0, 4); }

  get filteredHackathons(): Hackathon[] {
    return this.hackFilter === 'ALL'
      ? this.hackathons : this.hackathons.filter(h => h.status === this.hackFilter);
  }

  get overviewHacks(): Hackathon[] { return this.hackathons.slice(0, 2); }

 /* get filteredParticipants(): Participant[] {
    return this.participantsFilter === 'ALL'
      ? this.participants : this.participants.filter(p => p.eventId === this.participantsFilter);
  }*/

  get currentEvent(): Evenement | undefined {
    return this.events.find(e => e.id === this.currentEventId);
  }

  get currentHack(): Hackathon | undefined {
    return this.hackathons.find(h => h.id === this.currentHackId);
  }

  get detailStands(): Stand[] {
    return this.currentEventId ? this.getStandsByEvent(this.currentEventId) : [];
  }

  get detailParticipants(): Participant[] {
    return this.currentEventId ? this.getParticipantsByEvent(this.currentEventId) : [];
  }

  // ════════════════════════════════
  // GAGNANTS — helpers lecture
  // ════════════════════════════════

  getGagnantsByHack(hackId: number): Gagnant[] {
    return this.gagnants
      .filter(g => this.extractHackId(g) === Number(hackId))
      .sort((a, b) => {
        const order: Record<string, number> = { FIRST: 1, SECOND: 2, THIRD: 3 };
        return (order[a.position] ?? 99) - (order[b.position] ?? 99);
      });
  }

  getGagnantByPosition(hackId: number, position: 'FIRST' | 'SECOND' | 'THIRD'): Gagnant | undefined {
    return this.gagnants.find(
      g => this.extractHackId(g) === Number(hackId) && g.position === position
    );
  }

  hasGagnants(hackId: number): boolean {
    return this.gagnants.some(g => this.extractHackId(g) === Number(hackId));
  }

  rankColor(position: string): string {
    const map: Record<string, string> = {
      FIRST:  'linear-gradient(135deg,#f59e0b,#d97706)',
      SECOND: 'linear-gradient(135deg,#9ca3af,#6b7280)',
      THIRD:  'linear-gradient(135deg,#92400e,#78350f)'
    };
    return map[position] || 'linear-gradient(135deg,#1e3a8a,#8b5cf6)';
  }

  positionLabel(position: string): string {
    const map: Record<string, string> = {
      FIRST: '1ère place', SECOND: '2ème place', THIRD: '3ème place'
    };
    return map[position] || position;
  }

  positionEmoji(position: string): string {
    const map: Record<string, string> = { FIRST: '🥇', SECOND: '🥈', THIRD: '🥉' };
    return map[position] || '🏅';
  }

  // ════════════════════════════════
  // GAGNANTS — SUPPRESSION
  // ════════════════════════════════

  /**
   * Supprime un gagnant individuel et recharge le palmarès du hackathon.
   */
  deleteGagnant(gagnant: Gagnant): void {
    if (!gagnant.id) return;
    const hackId = this.extractHackId(gagnant);
    this.confirmMsg = `Supprimer "${gagnant.teamName}" (${this.positionLabel(gagnant.position)}) du palmarès ?`;
    this.deleteCallback = () => {
      this.gagnantService.delete(gagnant.id!).subscribe({
        next: () => {
          this.showToast(`"${gagnant.teamName}" supprimé du palmarès ✓`, 'success');
          // Mise à jour immédiate du cache local
          this.gagnants = this.gagnants.filter(g => g.id !== gagnant.id);
          // Resynchronisation avec l'API
          if (hackId != null) this.reloadGagnantsForHack(hackId);
        },
        error: () => this.showToast('Erreur lors de la suppression du gagnant', 'error')
      });
      this.showConfirmModal = false;
    };
    this.showConfirmModal = true;
  }

  /**
   * Supprime TOUT le palmarès d'un hackathon d'un seul coup.
   */
  deleteAllGagnants(hackId: number): void {
    const list = this.getGagnantsByHack(hackId);
    if (list.length === 0) return;
    const hackTitle = this.hackathons.find(h => h.id === hackId)?.title || 'ce hackathon';
    this.confirmMsg = `Supprimer tout le palmarès de "${hackTitle}" ? Cette action est irréversible.`;
    this.deleteCallback = () => {
      const calls = list
        .filter(g => g.id != null)
        .map(g => this.gagnantService.delete(g.id!).pipe(catchError(() => of(null))));
      if (calls.length === 0) { this.showConfirmModal = false; return; }
      forkJoin(calls).subscribe({
        next: (results) => {
          const failed = results.filter(r => r === null).length;
          if (failed > 0) {
            this.showToast(`${list.length - failed} supprimé(s), ${failed} erreur(s)`, 'error');
          } else {
            this.showToast('Palmarès supprimé avec succès', 'success');
          }
          // Vide le cache local pour ce hackathon
          this.gagnants = this.gagnants.filter(g => this.extractHackId(g) !== hackId);
          // Resynchronisation API
          this.reloadGagnantsForHack(hackId);
        },
        error: () => this.showToast('Erreur lors de la suppression du palmarès', 'error')
      });
      this.showConfirmModal = false;
    };
    this.showConfirmModal = true;
  }

  // ════════════════════════════════
  // GAGNANTS — modal & save
  // ════════════════════════════════

  openGagnantModal(hackId: number): void {
    this.editingGagnantHackId = hackId;

    this.gagnantService.getByHackathon(hackId).subscribe({
      next: (data: any[]) => {
        const normalized = (data || []).map((g: any) => this.normalizeGagnant(g, hackId));
        this.gagnants = [
          ...this.gagnants.filter(g => this.extractHackId(g) !== hackId),
          ...normalized
        ];
        const byPos = (pos: string) => normalized.find((g: Gagnant) => g.position === pos);
        const fill = (g: Gagnant | undefined) => ({
          teamName:     g?.teamName     || '',
          description:  g?.description  || '',
          contactEmail: g?.contactEmail || '',
          contactPhone: g?.contactPhone || ''
        });
        this.gagnantForm = {
          first:  fill(byPos('FIRST')),
          second: fill(byPos('SECOND')),
          third:  fill(byPos('THIRD'))
        };
      },
      error: () => {
        this.gagnantForm = {
          first:  { teamName: '', description: '', contactEmail: '', contactPhone: '' },
          second: { teamName: '', description: '', contactEmail: '', contactPhone: '' },
          third:  { teamName: '', description: '', contactEmail: '', contactPhone: '' }
        };
      }
    });

    this.loadTeamsForHackathon(hackId);
    this.showGagnantModal = true;
  }

  closeGagnantModal(): void {
    this.showGagnantModal = false;
    this.editingGagnantHackId = null;
    this.gagnantForm = {
      first:  { teamName: '', description: '', contactEmail: '', contactPhone: '' },
      second: { teamName: '', description: '', contactEmail: '', contactPhone: '' },
      third:  { teamName: '', description: '', contactEmail: '', contactPhone: '' }
    };
    this.hackathonTeams = [];
  }

saveGagnants(): void {
  if (!this.editingGagnantHackId) return;

  if (!this.gagnantForm.first.teamName.trim()) {
    this.showToast('La 1ère place est obligatoire', 'error');
    return;
  }

  const hackId = this.editingGagnantHackId;
  const hackRef = { id: hackId } as Hackathon;

  // Récupérer les gagnants existants pour ce hackathon
  const existingWinners = this.gagnants.filter(g => this.extractHackId(g) === hackId);
  
  // Créer un tableau d'observables pour les opérations séquentielles
  const operations: Observable<any>[] = [];

  // Positions à traiter
  const positions: { key: 'first' | 'second' | 'third'; pos: string }[] = [
    { key: 'first', pos: 'FIRST' },
    { key: 'second', pos: 'SECOND' },
    { key: 'third', pos: 'THIRD' }
  ];

  for (const { key, pos } of positions) {
    const formData = this.gagnantForm[key];
    const existing = existingWinners.find(w => w.position === pos);
    
    if (formData.teamName?.trim()) {
      // Si un gagnant existe déjà pour cette position, le supprimer d'abord
      if (existing && existing.id) {
        operations.push(
          this.gagnantService.delete(existing.id).pipe(
            catchError(err => {
              console.error(`Erreur suppression ${pos}`, err);
              return of(null);
            })
          )
        );
      }
      // Ajouter le nouveau gagnant
      const newWinner: Gagnant = {
        teamName: formData.teamName.trim(),
        position: pos,
        description: formData.description || '',
        contactEmail: formData.contactEmail || '',
        contactPhone: formData.contactPhone || '',
        hackathon: hackRef
      };
      operations.push(
        this.gagnantService.add(newWinner).pipe(
          catchError(err => {
            console.error(`Erreur ajout ${pos}`, err);
            return of(null);
          })
        )
      );
    } else {
      // Si le champ est vide mais qu'un gagnant existait, le supprimer
      if (existing && existing.id) {
        operations.push(
          this.gagnantService.delete(existing.id).pipe(
            catchError(err => {
              console.error(`Erreur suppression ${pos}`, err);
              return of(null);
            })
          )
        );
      }
    }
  }

  if (operations.length === 0) {
    this.closeGagnantModal();
    return;
  }

  // Exécuter toutes les opérations en parallèle
  forkJoin(operations).subscribe({
    next: () => {
      this.showToast('Palmarès mis à jour avec succès 🏆', 'success');
      this.reloadGagnantsForHack(hackId);
      this.closeGagnantModal();
    },
    error: () => this.showToast("Erreur lors de la mise à jour du palmarès", 'error')
  });
}
  // ════════════════════════════════
  // NAVIGATION
  // ════════════════════════════════

navigate(page: 'overview' | 'events' | 'hackathons' | 'stands' | 'participants' | 'gagnants'): void {
  this.currentPage = page;
  if (page === 'events')    { this.showEventDetail = false; this.currentEventId = null; }
  if (page === 'hackathons'){
    this.showHackDetail = false;
    this.currentHackId = null;
    this.resumeHackathonPolling();
    this.loadHackathons();
  }
  if (page === 'gagnants')  { this.loadAllGagnants(); }
  if (page === 'participants') {
    this.presenceFilter = 'ALL';      // ✅ reset filtre
    this.loadParticipants();          // ✅ recharge avec present
  }
}

  // ════════════════════════════════
  // FILTERS
  // ════════════════════════════════

  filterEvents(status: EventStatus | 'ALL'): void { this.currentFilter = status; }
  filterHackathons(status: string): void { this.hackFilter = status; }
filterParticipants(eventId: number | 'ALL' | string): void { 
  this.participantsFilter = eventId as any; 
}
  // ════════════════════════════════
  // STATUS HELPERS
  // ════════════════════════════════

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      APPROVED: 'badge-approved', PENDING: 'badge-pending', REJECTED: 'badge-rejected'
    };
    return 'badge ' + (map[status] || 'badge-pending');
  }

  statusBadgeLabel(status: string): string {
    const map: Record<string, string> = {
      APPROVED: 'Approuvé', PENDING: 'En attente', REJECTED: 'Rejeté'
    };
    return map[status] || status;
  }

  statusChipStyle(status: string): string {
    const colors: Record<string, string> = {
      APPROVED: 'rgba(16,185,129,0.2)', PENDING: 'rgba(245,158,11,0.2)', REJECTED: 'rgba(239,68,68,0.2)'
    };
    return `background:${colors[status] || 'rgba(107,114,128,0.2)'}`;
  }

  statusChipLabel(status: string): string {
    const map: Record<string, string> = {
      APPROVED: '✓ Approuvé', PENDING: '⏳ En attente', REJECTED: '✕ Rejeté'
    };
    return map[status] || status;
  }

  // ════════════════════════════════
  // TYPE / ICON HELPERS
  // ════════════════════════════════

  typeIcon(type: string): string {
    const map: Record<string, string> = {
      'Hackathon': 'fa-code', 'Conférence': 'fa-microphone',
      'Forum': 'fa-comments', 'Workshop': 'fa-tools', 'Startup Pitch': 'fa-rocket'
    };
    return map[type] || 'fa-star';
  }

  typeGradient(type: string): string {
    const map: Record<string, string> = {
      'Hackathon': 'linear-gradient(135deg,#1e3a8a,#8b5cf6)',
      'Conférence': 'linear-gradient(135deg,#0f766e,#3b82f6)',
      'Forum': 'linear-gradient(135deg,#7c2d12,#f59e0b)',
      'Workshop': 'linear-gradient(135deg,#1e3a8a,#10b981)',
      'Startup Pitch': 'linear-gradient(135deg,#6d28d9,#ec4899)'
    };
    return map[type] || 'linear-gradient(135deg,#1e3a8a,#8b5cf6)';
  }

  domainGradient(domain: string): string {
    const map: Record<string, string> = {
      'IA': 'linear-gradient(135deg,#1e3a8a,#8b5cf6)',
      'Web': 'linear-gradient(135deg,#0f766e,#3b82f6)',
      'Mobile': 'linear-gradient(135deg,#6d28d9,#ec4899)',
      'Data': 'linear-gradient(135deg,#0f766e,#8b5cf6)',
      'Cybersécurité': 'linear-gradient(135deg,#7c2d12,#ef4444)',
      'Green Tech': 'linear-gradient(135deg,#064e3b,#10b981)',
      'FinTech': 'linear-gradient(135deg,#1e3a8a,#f59e0b)',
    };
    for (const key of Object.keys(map)) {
      if (domain?.toLowerCase().includes(key.toLowerCase())) return map[key];
    }
    return 'linear-gradient(135deg,#1e3a8a,#8b5cf6)';
  }

  // ════════════════════════════════
  // DATA HELPERS
  // ════════════════════════════════

  getStandsByEvent(eventId: number): Stand[] {
    return this.stands.filter(s => s.event?.id === eventId);
  }

  getParticipantsByEvent(eventId: number): Participant[] {
    return this.participants.filter(p => p.eventId === eventId);
  }

  getEventTitle(eventId: number): string {
    return this.events.find(e => e.id === eventId)?.title || 'N/A';
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }

  formatDate(d: string): string {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  isHackathonFinished(h: Hackathon): boolean {
    return h.endDate ? new Date(h.endDate) < new Date() : false;
  }

  // ════════════════════════════════
  // EVENT CRUD
  // ════════════════════════════════

 openEventDetail(id: number): void {
  this.currentEventId = id;
  this.showEventDetail = true;
  this.currentPage = 'events';
  this.loadParticipantsForEvent(id); // ← charge uniquement ceux de cet événement
}

  backToEvents(): void { this.showEventDetail = false; this.currentEventId = null; }
loadParticipantsForEvent(eventId: number): void {
  this.formService.getByEvent(eventId).subscribe({
    next: (forms) => {
      const others = this.participants.filter(p => Number(p.eventId) !== Number(eventId));
      const newOnes: Participant[] = forms.map(f => ({
        id:          f.id ?? 0,
        name:        String(f.fullName ?? ''),
        role:        String(f.skills ?? 'Participant'),
        eventId:     Number(eventId),
        present:     Boolean((f as any).present),
        type:        'event' as const,  // ← AJOUTER
        hackathonId: undefined          // ← AJOUTER
      }));
      this.participants = [...others, ...newOnes];
    },
    error: () => this.showToast('Erreur chargement participants', 'error')
  });
}
  openEventModal(id: number | null = null): void {
    this.editingEventId = id;
    this.imagePreview = null;
    this.imageError = '';
    if (id) {
      this.eventService.getById(id).subscribe({
        next: (ev) => {
          this.evForm = {
            title: ev.title, description: ev.description, location: ev.location,
            startDate: ev.startDate?.substring(0, 10) ?? '',
            endDate: ev.endDate?.substring(0, 10) ?? '',
            imageBase64: ev.imageBase64 || ''
          };
          if (ev.imageBase64) this.imagePreview = this.getImageSrc(ev.imageBase64);
        },
        error: () => this.showToast("Erreur chargement de l'événement", 'error')
      });
    } else {
      this.evForm = { title: '', description: '', location: '', startDate: '', endDate: '', imageBase64: '' };
    }
    this.showEventModal = true;
  }

  closeEventModal(): void {
    this.showEventModal = false;
    this.imagePreview = null;
    this.imageError = '';
  }

saveEvent(): void {
  const { title, location, startDate, endDate, description, imageBase64 } = this.evForm;
  if (!title || !location || !startDate || !endDate) {
    this.showToast('Veuillez remplir tous les champs obligatoires', 'error'); return;
  }

  const organisateurId = Number(localStorage.getItem('userId')); // ← AJOUTER

  const payload: Evenement = {
    title, description, location,
    startDate: startDate + 'T00:00:00',
    endDate: endDate + 'T00:00:00',
    status: 'PENDING',
    imageBase64: imageBase64 || undefined,
organisateurId: this.getCurrentUserId() ?? undefined,
  };

  if (this.editingEventId) {
    // ── MODIFICATION — soumettre via PendingUpdate ──
    this.pendingUpdateService.submitUpdate(
      'EVENT',
      this.editingEventId,
      payload,
      'Eya Chebbi'  // ← remplacer par le nom de l'utilisateur connecté
    ).subscribe({
      next: () => {
        this.showToast(
          'Modification soumise — en attente de validation par l\'admin ⏳',
          'success'
        );
        this.loadEvents();
        this.showEventModal = false;
        this.imagePreview = null;
      },
      error: () => this.showToast('Erreur lors de la soumission', 'error')
    });

  } else {
    // ── CRÉATION — comme avant ──
    this.eventService.create(payload).subscribe({
      next: () => {
        this.showToast("Événement créé — en attente d'approbation", 'success');
        this.loadEvents();
        this.showEventModal = false;
        this.imagePreview = null;
      },
      error: () => this.showToast('Erreur lors de la création', 'error')
    });
  }
}
// Ajouter cette méthode dans DashboardOrgComponent
private getCurrentUserId(): number | null {
  const token = localStorage.getItem('token');
  const localUserId = Number(localStorage.getItem('userId'));

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const tokenUserId = payload.id ?? payload.userId ?? payload.sub ?? null;
      if (tokenUserId != null && !Number.isNaN(Number(tokenUserId))) {
        return Number(tokenUserId);
      }
    } catch {
      // fallback localStorage
    }
  }

  return Number.isNaN(localUserId) || localUserId <= 0 ? null : localUserId;
}
  // ════════════════════════════════
  // HACKATHON CRUD
  // ════════════════════════════════

openHackDetail(id: number): void {
  this.currentHackId = id;
  this.showHackDetail = true;
  this.currentPage = 'hackathons';
  this.reloadGagnantsForHack(id);
  this.loadTeamsForHackathon(id); // ← ajoute ça
}

  backToHackathons(): void { this.showHackDetail = false; this.currentHackId = null; }

  openHackModal(id: number | null = null): void {
  this.editingHackId = id;
  this.hackImagePreview = null;  // ✅
  this.hackImageError = '';       // ✅
  if (id) {
    this.hackathonService.getById(id).subscribe({
      next: (h) => {
        this.hackForm = {
          title: h.title, description: h.description, domain: h.domain,
          location: h.location,
          startDate: h.startDate?.substring(0, 10) ?? '',
          endDate: h.endDate?.substring(0, 10) ?? '',
          imageBase64: h.imageBase64 || '' ,
                    submissionDeadline:  h.submissionDeadline || '' // ✅ AJOUTER

        };
        // ✅ Prévisualiser l'image existante
        if (h.imageBase64) this.hackImagePreview = this.getImageSrc(h.imageBase64);
      },
      error: () => this.showToast('Erreur chargement hackathon', 'error')
    });
  } else {
    this.hackForm = {
      title: '', description: '', domain: '',
      location: '', startDate: '', endDate: '', imageBase64: '',submissionDeadline: '' 
    };
  }
  this.showHackModal = true;
}

  closeHackModal(): void { this.showHackModal = false; }

saveHackathon(): void {
  const { title, description, domain, location, startDate, endDate, imageBase64 } = this.hackForm;
  if (!title || !domain || !location || !startDate || !endDate) {
    this.showToast('Veuillez remplir tous les champs obligatoires', 'error'); return;
  }
  const orgId = this.getCurrentUserId();
  console.log('organisateurId envoyé:', orgId); // ← debug

 const payload: Hackathon = {
  title, description, domain, location,
  startDate: startDate + 'T00:00:00',
  endDate: endDate + 'T00:00:00',
  status: 'PENDING',
  imageBase64: imageBase64 || undefined,
  submissionDeadline: this.hackForm.submissionDeadline || undefined,
    organisateurId: orgId ?? undefined,
};

  if (this.editingHackId) {
    // ── MODIFICATION — soumettre via PendingUpdate ──
    this.pendingUpdateService.submitUpdate(
      'HACKATHON',
      this.editingHackId,
      payload,
      'Eya Chebbi'  // ← remplacer par le nom de l'utilisateur connecté
    ).subscribe({
      next: () => {
        this.showToast(
          'Modification soumise — en attente de validation par l\'admin ⏳',
          'success'
        );
        this.loadHackathons();
        this.showHackModal = false;
        this.hackImagePreview = null;
      },
      error: () => this.showToast('Erreur lors de la soumission', 'error')
    });

  } else {
    // ── CRÉATION — comme avant ──
    this.hackathonService.create(payload).subscribe({
      next: () => {
        this.showToast("Hackathon créé — en attente d'approbation", 'success');
        this.loadHackathons();
        this.showHackModal = false;
        this.hackImagePreview = null;
      },
      error: () => this.showToast('Erreur lors de la création', 'error')
    });
  }
}
  // ════════════════════════════════
  // STAND CRUD
  // ════════════════════════════════

  openStandModal(eventId: number | null = null, standId: number | null = null): void {
    this.editingStandId = standId;
    this.eventOptions = [...this.events];
    if (standId) {
      const stand = this.stands.find(s => s.id === standId);
      if (stand) {
        this.standForm = {
          eventId: stand.event?.id ?? null, startupName: stand.startupName,
          domain: stand.domain, requiredSkills: stand.requiredSkills, description: stand.description
        };
      }
    } else {
      this.standForm = {
        eventId: eventId ?? (this.events[0]?.id ?? null),
        startupName: '', domain: 'Technologie', requiredSkills: '', description: ''
      };
    }
    this.showStandModal = true;
  }

  closeStandModal(): void {
    this.showStandModal = false;
    this.editingStandId = null;
    this.standForm = { eventId: null, startupName: '', domain: 'Technologie', requiredSkills: '', description: '' };
  }

  saveStand(): void {
    if (!this.standForm.startupName || !this.standForm.requiredSkills || !this.standForm.eventId) {
      this.showToast('Veuillez remplir tous les champs obligatoires', 'error'); return;
    }
    const payload: Stand = {
      startupName: this.standForm.startupName, domain: this.standForm.domain,
      requiredSkills: this.standForm.requiredSkills, description: this.standForm.description,
      event: { id: this.standForm.eventId } as Evenement
    };
    if (this.editingStandId) {
      this.standService.update(this.editingStandId, { ...payload, id: this.editingStandId }).subscribe({
        next: () => { this.showToast('Stand modifié avec succès', 'success'); this.loadStands(); this.closeStandModal(); },
        error: () => this.showToast('Erreur lors de la modification', 'error')
      });
    } else {
      this.standService.create(payload).subscribe({
        next: () => { this.showToast('Stand ajouté avec succès', 'success'); this.loadStands(); this.closeStandModal(); },
        error: () => this.showToast('Erreur lors de la création', 'error')
      });
    }
  }

  // ════════════════════════════════
  // DELETE (event / hackathon / stand)
  // ════════════════════════════════

  confirmDelete(type: 'event' | 'hackathon' | 'stand', id: number): void {
    const msgs: Record<string, string> = {
      event: 'Êtes-vous sûr de vouloir supprimer cet événement ?',
      hackathon: 'Êtes-vous sûr de vouloir supprimer ce hackathon ?',
      stand: 'Êtes-vous sûr de vouloir supprimer ce stand ?'
    };
    this.confirmMsg = msgs[type];
    this.deleteCallback = () => {
      if (type === 'event') {
        this.eventService.delete(id).subscribe({
          next: () => { this.showToast('Événement supprimé', 'success'); if (this.currentEventId === id) this.backToEvents(); this.loadEvents(); },
          error: () => this.showToast('Erreur lors de la suppression', 'error')
        });
      } else if (type === 'hackathon') {
        this.hackathonService.delete(id).subscribe({
          next: () => { this.showToast('Hackathon supprimé', 'success'); this.loadHackathons(); },
          error: () => this.showToast('Erreur lors de la suppression', 'error')
        });
      } else {
        this.standService.delete(id).subscribe({
          next: () => { this.showToast('Stand supprimé', 'success'); this.loadStands(); },
          error: () => this.showToast('Erreur lors de la suppression', 'error')
        });
      }
      this.showConfirmModal = false;
    };
    this.showConfirmModal = true;
  }

  confirmOk(): void { if (this.deleteCallback) this.deleteCallback(); }

  // ════════════════════════════════
  // TOAST
  // ════════════════════════════════

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toasts.push({ msg, type });
    setTimeout(() => this.toasts.shift(), 3000);
  }


  // ─── FILTRE PRÉSENCE ───
presenceFilter: 'ALL' | 'PRESENT' | 'ABSENT' = 'ALL';

filterPresence(val: 'ALL' | 'PRESENT' | 'ABSENT'): void {
  this.presenceFilter = val;
}

// ─── PARTICIPANTS FILTRÉS (event + présence) ───
get filteredParticipants(): Participant[] {
  const list = this.currentFilteredList;
  if (this.presenceFilter === 'PRESENT') return list.filter(p => p.present);
  if (this.presenceFilter === 'ABSENT')  return list.filter(p => !p.present);
  return list;
}
// ─── STATS PARTICIPANTS ───
get currentFilteredList(): Participant[] {
  if (this.participantsFilter === 'ALL') return this.participants;
  
  const filter = String(this.participantsFilter);
  if (filter.startsWith('hack_')) {
    const hackId = Number(filter.replace('hack_', ''));
    return this.participants.filter(p => p.type === 'hackathon' && p.hackathonId === hackId);
  }
  return this.participants.filter(p => p.type === 'event' && p.eventId === Number(filter));
}


get presentCount(): number  { return this.currentFilteredList.filter(p => p.present).length; }
get absentCount(): number   { return this.currentFilteredList.filter(p => !p.present).length; }
get presenceRate(): number  {
  const total = this.currentFilteredList.length;
  return total > 0 ? Math.round((this.presentCount / total) * 100) : 0;
}


//drive
// ✅ AJOUTER cette méthode dans la classe
formatDeadline(deadline: string): string {
  if (!deadline) return '';
  const date = new Date(deadline);
  if (isNaN(date.getTime())) return deadline;
  const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} à ${hours}h${minutes}`;
}

isDeadlinePassed(deadline: string): boolean {
  if (!deadline) return false;
  return new Date() > new Date(deadline);
}


// ─── MÉTHODES FEEDBACK ───

openFeedbackBuilder(eventId: number): void {
  this.feedbackForm = {
    title: 'Feedback — ' + this.getEventTitle(eventId),
    description: '',
    targetType: 'EVENT',
    targetId: eventId,
    questions: []
  };
  // Charger formulaire existant si présent
  this.feedbackService.getForm('EVENT', eventId).subscribe({
    next: (form) => {
      this.feedbackForm = form;
      this.showFeedbackBuilder = true;
    },
    error: () => { this.showFeedbackBuilder = true; }
  });
}

closeFeedbackBuilder(): void {
  this.showFeedbackBuilder = false;
}

addQuestion(type: 'LINEAR' | 'TEXT' | 'RADIO' | 'CHECKBOX'): void {
  const defaults: Record<string, any> = {
    LINEAR:   { scaleMin: 1, scaleMax: 5 },
    TEXT:     {},
    RADIO:    { options: 'Option 1|Option 2|Option 3' },
    CHECKBOX: { options: 'Option A|Option B|Option C' }
  };
  this.feedbackForm.questions.push({
    label: '',
    type,
    required: false,
    position: this.feedbackForm.questions.length,
    scaleMin: 1,
    scaleMax: 5,
    ...defaults[type]
  });
}

removeQuestion(index: number): void {
  this.feedbackForm.questions.splice(index, 1);
  this.feedbackForm.questions.forEach((q, i) => q.position = i);
}

moveQuestion(index: number, dir: 'up' | 'down'): void {
  const arr = this.feedbackForm.questions;
  const swap = dir === 'up' ? index - 1 : index + 1;
  if (swap < 0 || swap >= arr.length) return;
  [arr[index], arr[swap]] = [arr[swap], arr[index]];
  arr.forEach((q, i) => q.position = i);
}

saveFeedbackForm(): void {
  if (!this.feedbackForm.title.trim()) {
    this.showToast('Le titre est obligatoire', 'error'); return;
  }
  if (this.feedbackForm.questions.length === 0) {
    this.showToast('Ajoutez au moins une question', 'error'); return;
  }
  this.feedbackService.saveForm(this.feedbackForm).subscribe({
    next: (saved) => {
      this.feedbackForm = saved;
      this.showToast('Formulaire sauvegardé ✓', 'success');
      this.showFeedbackBuilder = false;
    },
    error: () => this.showToast('Erreur sauvegarde', 'error')
  });
}

openFeedbackStats(eventId: number): void {
  this.feedbackStats = null;
  this.feedbackLoading = true;
  this.showFeedbackStats = true;
  this.feedbackService.getForm('EVENT', eventId).subscribe({
    next: (form) => {
      if (form?.id) {
        this.feedbackService.getStats(form.id).subscribe({
          next: (stats) => {
            this.feedbackStats = stats;
            this.feedbackLoading = false;
          },
          error: () => { this.feedbackLoading = false; }
        });
      } else { this.feedbackLoading = false; }
    },
    error: () => { this.feedbackLoading = false; }
  });
}

getOptionsArray(options: string | undefined): string[] {
  if (!options) return [];
  return options.split('|').filter(o => o.trim());
}

getStarsArray(max: number): number[] {
  return Array.from({ length: max }, (_, i) => i + 1);
}

getHackathonTitle(hackathonId: number): string {
  return this.hackathons.find(h => h.id === hackathonId)?.title || 'Hackathon';
}


// ─── TOP PRÉSENCE ───
get topEvent(): Evenement | undefined {
  let best: Evenement | undefined;
  let bestCount = -1;
  for (const e of this.events) {
    const count = this.myParticipants.filter(
      p => p.type === 'event' && p.eventId === e.id && p.present
    ).length;
    if (count > bestCount) { bestCount = count; best = e; }
  }
  return bestCount > 0 ? best : undefined;
}

get topEventPresentCount(): number {
  if (!this.topEvent) return 0;
  return this.myParticipants.filter(
    p => p.type === 'event' && p.eventId === this.topEvent!.id && p.present
  ).length;
}

get topEventTotal(): number {
  if (!this.topEvent) return 0;
  return this.myParticipants.filter(
    p => p.type === 'event' && p.eventId === this.topEvent!.id
  ).length;
}

get topEventPresenceRate(): number {
  const total = this.topEventTotal;
  return total > 0 ? Math.round((this.topEventPresentCount / total) * 100) : 0;
}

get topHackathon(): Hackathon | undefined {
  let best: Hackathon | undefined;
  let bestCount = -1;
  for (const h of this.hackathons) {
    const count = this.myParticipants.filter(
      p => p.type === 'hackathon' && p.hackathonId === h.id && p.present
    ).length;
    if (count > bestCount) { bestCount = count; best = h; }
  }
  return bestCount > 0 ? best : undefined;
}

get topHackPresentCount(): number {
  if (!this.topHackathon) return 0;
  return this.myParticipants.filter(
    p => p.type === 'hackathon' && p.hackathonId === this.topHackathon!.id && p.present
  ).length;
}

get topHackTotal(): number {
  if (!this.topHackathon) return 0;
  return this.myParticipants.filter(
    p => p.type === 'hackathon' && p.hackathonId === this.topHackathon!.id
  ).length;
}

get topHackPresenceRate(): number {
  const total = this.topHackTotal;
  return total > 0 ? Math.round((this.topHackPresentCount / total) * 100) : 0;
}

//calcule score 
// Ajouter dans la classe
eventScores: Map<number, EventScore> = new Map();

// Appeler dans loadEvents() après avoir chargé les events
loadEventScores(): void {
  if (this.events.length === 0) return;

  const calls = this.events
    .filter(e => e.id != null)
    .map(e =>
      this.feedbackService.getEventScore(e.id!).pipe(catchError(() => of(null)))
    );

  forkJoin(calls).subscribe({
    next: (results) => {
      results.forEach((score, i) => {
        const event = this.events.filter(e => e.id != null)[i];
        console.log(`Event "${event.title}" → score brut:`, score); // ← AJOUTER
        if (score && score.totalResponses > 0) {
          this.eventScores.set(event.id!, score);
        }
      });
      this.updateOverviewStats();
    },
    error: () => this.updateOverviewStats()
  });
}

// Helper
getEventScore(eventId: number): EventScore | null {
  return this.eventScores.get(eventId) ?? null;
}

scoreColor(score: number): string {
  if (score >= 75) return '#059669';
  if (score >= 50) return '#3b82f6';
  if (score >= 25) return '#f59e0b';
  return '#ef4444';
}

scoreBg(score: number): string {
  if (score >= 75) return 'rgba(5,150,105,0.1)';
  if (score >= 50) return 'rgba(59,130,246,0.1)';
  if (score >= 25) return 'rgba(245,158,11,0.1)';
  return 'rgba(239,68,68,0.1)';
}


/*courbe*/
// ═══════════════════════════════════════════════════════════════
// MÉTHODES STATISTIQUES POUR VUE D'ENSEMBLE
// ═══════════════════════════════════════════════════════════════

/**
 * Met à jour toutes les statistiques et graphiques de l'aperçu
 */

// ═══════════════════════════════════════════════════════════════
// NOUVELLES PROPRIÉTÉS — ajouter dans la classe DashboardOrgComponent
// ═══════════════════════════════════════════════════════════════
 
// ─── 3ème canvas (activité planifiée par mois) ───
@ViewChild('activityChart') activityChartRef!: ElementRef;
activityChart: Chart | null = null;
 
// ─── Filtre vue courbe (both / events / hacks) ───
overviewView: 'both' | 'events' | 'hacks' = 'both';
 
// ─── Filtre année ───
selectedYear: number = new Date().getFullYear();
availableYears: number[] = [new Date().getFullYear()];
 
 
// ═══════════════════════════════════════════════════════════════
// NOUVEAUX GETTERS — ajouter dans la classe
// ═══════════════════════════════════════════════════════════════
 
get kpiApprovedHacks(): number {
  return this.hackathons.filter(h => h.status === 'APPROVED').length;
}
 
get presentCountAll(): number {
  return this.myParticipants.filter(p => p.present).length;
}
 
get presenceRateAll(): number {
  const total = this.myParticipants.length;
  return total > 0 ? Math.round((this.presentCountAll / total) * 100) : 0;
}
 

updateOverviewStats(): void {
  // Construire la liste des années disponibles depuis les données
  const years = new Set<number>();
  [...this.events, ...this.hackathons].forEach(item => {
    if (item.startDate) years.add(new Date(item.startDate).getFullYear());
  });
  this.availableYears = Array.from(years).sort((a, b) => b - a);
  if (this.availableYears.length > 0 && !this.availableYears.includes(this.selectedYear)) {
    this.selectedYear = this.availableYears[0];
  }
  if (this.availableYears.length === 0) {
    this.availableYears = [new Date().getFullYear()];
    this.selectedYear = this.availableYears[0];
  }
 
  this.computeMonthlyData();
  this.computeBestMonth();
  this.computeTopSkills();
  this.computeTopEventsPresence();
 
  // Délai court pour s'assurer que les canvas sont dans le DOM
  setTimeout(() => this.renderCharts(), 100);
}

/**
 * Agrège les participants par mois (événements et hackathons)
 */
computeMonthlyData(): void {
  const monthMap = new Map<string, { events: number; hacks: number }>();
  // Ajoute temporairement dans computeMonthlyData() tout en haut
console.log('=== DEBUG ===');
console.log('selectedYear:', this.selectedYear);
console.log('events:', this.events.map(e => ({ title: e.title, start: e.startDate })));
console.log('hackathons:', this.hackathons.map(h => ({ title: h.title, start: h.startDate })));
console.log('monthlyActivityEventData:', this.monthlyActivityEventData);
  // Agrégation pour les ÉVÉNEMENTS
  this.events.forEach(event => {
    if (!event.startDate) return;
    const date = new Date(event.startDate);
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const monthLabel = `${date.toLocaleString('fr', { month: 'short' })} ${date.getFullYear()}`;
    
   const participantsEvent = this.myParticipants.filter(p => 
  p.type === 'event' && p.eventId === event.id && p.present
).length;
    
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { events: 0, hacks: 0 });
    }
    const existing = monthMap.get(monthKey)!;
    existing.events += participantsEvent;
    monthMap.set(monthKey, existing);
  });
  
  // Agrégation pour les HACKATHONS
  this.hackathons.forEach(hack => {
    if (!hack.startDate) return;
    const date = new Date(hack.startDate);
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    
    const participantsHack = this.myParticipants.filter(p => 
  p.type === 'hackathon' && p.hackathonId === hack.id && p.present
).length;
    
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { events: 0, hacks: 0 });
    }
    const existing = monthMap.get(monthKey)!;
    existing.hacks += participantsHack;
    monthMap.set(monthKey, existing);
  });
  
  // Trier par date
  const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  this.monthlyEventLabels = [];
  this.monthlyEventData = [];
  this.monthlyHackData = [];
  
  sorted.forEach(([key, data]) => {
    const [year, month] = key.split('-');
    const label = `${new Date(parseInt(year), parseInt(month) - 1).toLocaleString('fr', { month: 'short' })} ${year}`;
    this.monthlyEventLabels.push(label);
    this.monthlyEventData.push(data.events);
    this.monthlyHackData.push(data.hacks);
  });

  // Reset
  this.monthlyActivityEventData = new Array(12).fill(0);
  this.monthlyActivityHackData  = new Array(12).fill(0);

  // Compter les événements par mois (pour l'année sélectionnée)
  this.events.forEach(event => {
    if (!event.startDate) return;
    const date = new Date(event.startDate);
    if (date.getFullYear() !== this.selectedYear) return;
    this.monthlyActivityEventData[date.getMonth()]++;
  });

  // Compter les hackathons par mois (pour l'année sélectionnée)
  this.hackathons.forEach(hack => {
    if (!hack.startDate) return;
    const date = new Date(hack.startDate);
    if (date.getFullYear() !== this.selectedYear) return;
    this.monthlyActivityHackData[date.getMonth()]++;
  });

}

/**
 * Trouve le meilleur mois pour les événements (plus grand nombre de participants présents)
 */
computeBestMonth(): void {
  const monthParticipants = new Map<string, number>();
  
  this.events.forEach(event => {
    if (!event.startDate) return;
    const date = new Date(event.startDate);
    const monthKey = `${date.toLocaleString('fr', { month: 'long' })} ${date.getFullYear()}`;
   const participantsCount = this.myParticipants.filter(p => 
  p.type === 'event' && p.eventId === event.id && p.present
).length;
    
    const current = monthParticipants.get(monthKey) || 0;
    monthParticipants.set(monthKey, current + participantsCount);
  });
  
  let best = '';
  let max = 0;
  monthParticipants.forEach((count, month) => {
    if (count > max) {
      max = count;
      best = month;
    }
  });
  
  this.bestMonth = best || 'Aucune donnée';
  this.bestMonthCount = max;
}

/**
 * Extrait les compétences les plus fréquentes chez les participants présents
 */
computeTopSkills(): void {
  const skillCount = new Map<string, number>();
  
  // Parcourir les participants de type 'event' qui sont présents
this.myParticipants
  .filter(p => p.type === 'event' && p.present && p.role)
    .forEach(participant => {
      // La chaîne 'role' contient les compétences (ex: "JavaScript, Angular, Node.js")
      const skills = participant.role.split(/[ ,]+/).filter(s => s.length > 2);
      skills.forEach(skill => {
        const normalized = skill.trim().toLowerCase();
        const count = skillCount.get(normalized) || 0;
        skillCount.set(normalized, count + 1);
      });
    });
  
  // Convertir en tableau trié
  this.topSkillsList = Array.from(skillCount.entries())
    .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

/**
 * Calcule le top des événements avec meilleur taux de présence
 */
computeTopEventsPresence(): void {
  const results: { event: Evenement; presentCount: number; totalCount: number; rate: number }[] = [];
  
  this.events.forEach(event => {
const participantsEvent = this.myParticipants.filter(p => p.type === 'event' && p.eventId === event.id);
    const presentCount = participantsEvent.filter(p => p.present).length;
    const totalCount = participantsEvent.length;
    const rate = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;
    
    results.push({ event, presentCount, totalCount, rate });
  });
  
  this.topEventsByPresence = results
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);
}

/**
 * Initialise les graphiques avec Chart.js
 */
renderCharts(): void {
  const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
 
  // ── 1. COURBE ÉVOLUTION PARTICIPANTS ──
  if (this.eventMonthlyChartRef?.nativeElement) {
    if (this.eventMonthlyChart) this.eventMonthlyChart.destroy();
 
    const datasets = [];
 
    if (this.overviewView !== 'hacks') {
      datasets.push({
        label: 'Événements',
        data: this.monthlyEventData,
        borderColor: '#378ADD',
        backgroundColor: 'rgba(55,138,221,0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#378ADD',
        pointBorderColor: '#fff',
        pointRadius: 4,
        borderWidth: 2,
        borderDash: []
      });
    }
 
    if (this.overviewView !== 'events') {
      datasets.push({
        label: 'Hackathons',
        data: this.monthlyHackData,
        borderColor: '#7F77DD',
        backgroundColor: 'rgba(127,119,221,0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#7F77DD',
        pointBorderColor: '#fff',
        pointRadius: 4,
        borderWidth: 2,
        borderDash: this.overviewView === 'both' ? [5, 3] : []
      });
    }
 
    this.eventMonthlyChart = new Chart(this.eventMonthlyChartRef.nativeElement, {
      type: 'line',
      data: { labels: MONTHS_FR, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(128,128,128,0.1)' },
            ticks: { font: { size: 11 } },
            title: { display: true, text: 'Participants présents', font: { size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, autoSkip: false, maxRotation: 0 }
          }
        }
      }
    });
  }
 
  // ── 2. GRAPHIQUE SCORES ──
  if (this.scoresChartRef?.nativeElement && this.eventScores.size > 0) {
    if (this.scoresChart) this.scoresChart.destroy();
 
    const sortedScores = Array.from(this.eventScores.entries())
  .sort((a, b) => b[1].score - a[1].score)
  .slice(0, 6);
 
    const labels = sortedScores.map(([id]) => {
      const ev = this.events.find(e => e.id === id);
      return ev ? ev.title.substring(0, 18) : 'N/A';
    });
const scores = sortedScores.map(([, s]) => Math.round(s.score));
    const colors = scores.map(s =>
      s >= 80 ? '#1D9E75' : s >= 65 ? '#378ADD' : s >= 50 ? '#EF9F27' : '#E24B4A'
    );
 
    this.scoresChart = new Chart(this.scoresChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Score (%)',
          data: scores,
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.raw}%` } }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(128,128,128,0.1)' },
            ticks: { font: { size: 11 }, callback: (v) => v + '%' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, autoSkip: false, maxRotation: 30 }
          }
        }
      }
    });
  }
 
  // ── 3. GRAPHIQUE ACTIVITÉ PLANIFIÉE ──
  if (this.activityChartRef?.nativeElement) {
    if (this.activityChart) this.activityChart.destroy();
 
    this.activityChart = new Chart(this.activityChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: MONTHS_FR,
        datasets: [
          {
            label: 'Événements',
            data: this.monthlyActivityEventData,
            backgroundColor: 'rgba(55,138,221,0.75)',
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'Hackathons',
            data: this.monthlyActivityHackData,
            backgroundColor: 'rgba(127,119,221,0.75)',
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 11 }, stepSize: 1 },
            grid: { color: 'rgba(128,128,128,0.1)' },
            title: { display: true, text: 'Nb organisés', font: { size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, autoSkip: false, maxRotation: 0 }
          }
        }
      }
    });
  }
}

get myParticipants(): Participant[] {
  const myEventIds = new Set(this.events.map(e => e.id));
  const myHackIds  = new Set(this.hackathons.map(h => h.id));
  return this.participants.filter(p =>
    (p.type === 'event'     && myEventIds.has(p.eventId))   ||
    (p.type === 'hackathon' && myHackIds.has(p.hackathonId))
  );
}

private getCurrentUserName(): string {
  const token = localStorage.getItem('token');
  if (!token) return 'Organisateur';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? payload.firstName ?? payload.username ?? payload.name ?? 'Organisateur';
  } catch {
    return 'Organisateur';
  }
}
// ─── FEEDBACK HACKATHON ───
openFeedbackBuilderHack(hackId: number): void {
  this.feedbackForm = {
    title: 'Feedback — ' + this.getHackathonTitle(hackId),
    description: '',
    targetType: 'HACKATHON',
    targetId: hackId,
    questions: []
  };
  this.feedbackService.getForm('HACKATHON', hackId).subscribe({
    next: (form) => {
      this.feedbackForm = form;
      this.showFeedbackBuilder = true;
    },
    error: () => { this.showFeedbackBuilder = true; }
  });
}

openFeedbackStatsHack(hackId: number): void {
  this.feedbackStats = null;
  this.feedbackLoading = true;
  this.showFeedbackStats = true;
  this.feedbackService.getForm('HACKATHON', hackId).subscribe({
    next: (form) => {
      if (form?.id) {
        this.feedbackService.getStats(form.id).subscribe({
          next: (stats) => {
            this.feedbackStats = stats;
            this.feedbackLoading = false;
          },
          error: () => { this.feedbackLoading = false; }
        });
      } else { this.feedbackLoading = false; }
    },
    error: () => { this.feedbackLoading = false; }
  });
}

// ─── SCORES HACKATHONS ───
hackathonScores: Map<number, EventScore> = new Map();

loadHackathonScores(): void {
  if (this.hackathons.length === 0) return;

  const calls = this.hackathons
    .filter(h => h.id != null)
    .map(h =>
      this.feedbackService.getEventScore(h.id!).pipe(catchError(() => of(null)))
    );

  forkJoin(calls).subscribe({
    next: (results) => {
      results.forEach((score, i) => {
        const hack = this.hackathons.filter(h => h.id != null)[i];
        if (score && score.totalResponses > 0) {
          this.hackathonScores.set(hack.id!, score);
        }
      });
    },
    error: () => {}
  });
}

getHackathonScore(hackId: number): EventScore | null {
  return this.hackathonScores.get(hackId) ?? null;
}


// Getter ID utilisateur connecté
get currentUserId(): number | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id ?? null;
  } catch { return null; }
}


showLogoutConfirm = false;

logout(): void {
  this.showLogoutConfirm = false;
  localStorage.removeItem('token');
  this.router.navigate(['/signin']);
}
}
