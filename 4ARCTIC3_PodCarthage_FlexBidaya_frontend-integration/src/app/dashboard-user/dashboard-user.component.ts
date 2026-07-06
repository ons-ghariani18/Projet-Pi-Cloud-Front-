import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Evenement } from '../models/evenement';
import { Hackathon } from '../models/hackathon';
import { Stand } from '../models/stand';
import { Conseils } from '../models/conseils';
import { HackathonRegistration } from '../models/hackathon-registration';
import { Form as CandidatureForm } from '../models/form';
import { Matching, MatchResult, StandMatchResult } from '../models/matching';

import { EventService } from '../services/event.service';
import { HackathonService } from '../services/hackathon.service';
import { StandService } from '../services/stand.service';
import { ConseilsService } from '../services/conseils.service';
import { FormService } from '../services/form.service';
import { MatchingService } from '../services/matching.service';
import { RegistrationService } from '../services/registration.service';
import { FeedbackForm } from '../models/feedback-form';
import { FeedbackService } from '../services/feedback.service';
import { FeedbackAnswer } from '../models/feedback-answer';
import { SubmitService } from '../services/submit.service';
import { WarRoomService } from '../services/war-room.service';
import { WarRoom } from '../models/war-room';
import { WarRoomTask } from '../models/war-room-task';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RecommendationService } from '../services/recommendation.service';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import { ActiveTimerService } from '../services/active-timer.service';
import { ActivatedRoute, Router } from '@angular/router';

export interface Toast {
  message: string;
  type: 'success' | 'error';
}

export interface StandWithMatch extends Stand {
  matchScore?: number;
}

@Component({
  selector: 'app-dashboard-user',
  templateUrl: './dashboard-user.component.html',
  styleUrls: ['./dashboard-user.component.css']
})
export class DashboardUserComponent implements OnInit {

  currentTimeFilter: 'ALL' | 'EN_COURS' | 'PREVU' | 'TERMINE' = 'ALL';


  // ─── NAVIGATION STATE ───
  activePage = 'overview';
  currentEvFilter = 'ALL';

  // ─── DATA DYNAMIQUE ───
  events: Evenement[] = [];
  hackathons: Hackathon[] = [];
  stands: Stand[] = [];
  matchings: Matching[] = [];
  conseilsData: Conseils[] = [];

  // ─── LOADING FLAGS ───
  isLoadingEvents = false;
  isLoadingHackathons = false;
  isLoadingStands = false;
  isLoadingConseils = false;

  // ─── MODAL STATE ───
  modalEventVisible = false;
  modalHackVisible = false;

  // ─── SUCCESS MODAL (après inscription) ───
  modalSuccessVisible = false;
  successModalType: 'event' | 'hack' = 'event';
  successModalTitle = '';
  successModalDate  = '';
  successModalLocation = '';

  currentEvent?: Evenement;
  currentHackathon?: Hackathon;

  // ─── FORM MODELS ───
  eventForm: CandidatureForm = { fullName: '', email: '', skills: '', cvPath: '' };
  hackForm: Omit<HackathonRegistration, 'id'> = {
    teamName: '',
    teamSize: 3,
    leaderName: '',
    leaderEmail: ''
  };

  // ─── CV STATE (modal) ───
  cvFileModal: File | null = null;
  standMatchResults: StandMatchResult[] = [];
  matchDone = false;
  cvAnalyzing = false;

  // ─── CV STATE (page cvmatch) ───
  cvFile: File | null = null;
  matchResult: MatchResult | null = null;
  selectedStandSkills = '';
  selectedStandName = '';
  cvLoaded = false;

  // ─── DOMAIN DETECTION PAGE ───
  cvDomainFile: File | null = null;
  cvDomainAnalyzing = false;
  cvDomainLoaded = false;
  detectedDomain: string | null = null;
  detectedDomainSkills: string[] = [];
  domainStands: Stand[] = [];

  // ─── TOAST ───
  toasts: Toast[] = [];

  // ─── ICON / COLOR MAPS ───
  typeColors: Record<string, string[]> = {
    Hackathon:       ['#1e3a8a', '#8b5cf6'],
    Conférence:      ['#0f766e', '#3b82f6'],
    Forum:           ['#7c2d12', '#f59e0b'],
    Workshop:        ['#1e3a8a', '#10b981'],
    'Startup Pitch': ['#6d28d9', '#ec4899']
  };

  typeIcons: Record<string, string> = {
    Hackathon:       'fa-code',
    Conférence:      'fa-microphone',
    Forum:           'fa-comments',
    Workshop:        'fa-tools',
    'Startup Pitch': 'fa-rocket'
  };

  catIcons: Record<string, string> = {
    Technologie:   'fa-microchip',
    Finance:       'fa-coins',
    Santé:         'fa-heartbeat',
    Éducation:     'fa-graduation-cap',
    Environnement: 'fa-leaf',
    Autre:         'fa-store'
  };

conseilUiMap: Record<string, { color: string; bg: string; icon: string; sub: string; light: string }> = {
  CV:        { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: 'fa-file-alt',   sub: 'Dans les stands et salons',      light: '#eff6ff' },
  EVENT:     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: 'fa-user-tie',   sub: 'Personal branding efficace',      light: '#f5f3ff' },
  NETWORK:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: 'fa-handshake',  sub: 'Créer des connexions durables',   light: '#fffbeb' },
  HACKATHON: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: 'fa-trophy',     sub: 'Tips pour performer en équipe',   light: '#fef2f2' },
  IMPACT:    { color: '#0f766e', bg: 'rgba(15,118,110,0.1)', icon: 'fa-chart-line', sub: 'Stratégie avant & après',         light: '#f0fdfa' },
  STAND:     { color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: 'fa-comments',   sub: 'Communication & impact',          light: '#ecfdf5' },
};

  private readonly SKILL_ALIASES: Record<string, string[]> = {
    'spring':      ['springboot', 'spring boot', 'spring framework', 'spring mvc', 'spring data'],
    'springboot':  ['spring', 'spring boot', 'spring framework'],
    'js':          ['javascript', 'java script'],
    'ts':          ['typescript'],
    'react':       ['reactjs', 'react.js'],
    'node':        ['nodejs', 'node.js'],
    'angular':     ['angularjs', 'angular.js'],
    'vue':         ['vuejs', 'vue.js'],
    'postgres':    ['postgresql'],
    'mongo':       ['mongodb'],
    'kubernetes':  ['k8s'],
    'docker':      ['containerisation', 'container'],
  };
currentUsername = '';
currentUserId: number | null = null;
currentUserEmail = '';

  // ─── SUBMIT PAGE ───
myRegistrations: HackathonRegistration[] = [];
myRegistration: HackathonRegistration | null = null;
submitLoading = false;
submitDeadlinePassed = false;
submitProgressPercent = 0;
countdownDays = '00';
countdownHours = '00';
countdownMins = '00';
countdownSecs = '00';
private countdownInterval: any = null;
private submitHackathonStartDate: string = '';
recoFloatOpen = false;

// ─── FEEDBACK STATE ───
feedbackFormData: FeedbackForm | null = null;
feedbackAnswers: Record<number, string> = {};
feedbackSubmitting = false;
feedbackDone = false;
feedbackError = '';
showFeedbackModal = false;
currentFeedbackEventId: number | null = null;

  constructor(
    private eventService: EventService,
    private hackathonService: HackathonService,
    private standService: StandService,
    private conseilsService: ConseilsService,
    private hackRegService: RegistrationService,
    private formService: FormService,
    private matchingService: MatchingService,
      private feedbackService: FeedbackService,
  private submitService: SubmitService,
  private   warRoomService  :  WarRoomService,
  private sanitizer: DomSanitizer ,
  private recoService: RecommendationService,
    private http: HttpClient,
    public timerService: ActiveTimerService,
    private route: ActivatedRoute,
        private router: Router
    
  ) {}

  // ─── AJOUTER cette méthode ───
private getCurrentUsername(): string {
  const token = localStorage.getItem('token');
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub; // retourne "eyatawa"
  } catch {
    return '';
  }
}

// ─── AJOUTER cette nouvelle méthode ───
private getCurrentUserId(): number | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id ?? null;
  } catch {
    return null;
  }
}
private getCurrentUserEmail(): string {
  const token = localStorage.getItem('token');
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // ✅ Chercher dans plusieurs champs possibles
    const email = payload.email ?? payload.mail ?? payload.username ?? '';
    // ✅ Valider que c'est bien un email
    return email.includes('@') ? email : '';
  } catch {
    return '';
  }
}
  // ─── LIFECYCLE ───
ngOnInit(): void {
  this.currentUserEmail = this.getCurrentUserEmail();
  this.currentUsername  = this.getCurrentUsername();
  this.currentUserId    = this.getCurrentUserId();

  this.loadEvents();
  this.loadHackathons();
  this.loadConseils();

  // ✅ NE PAS appeler checkWarRoomAccess() ici

  const userId = this.getCurrentUserId();
  const urlToken = this.route?.snapshot?.queryParamMap?.get('warRoomToken');
  if (urlToken) {
    localStorage.setItem('pendingWarRoomToken', urlToken);
  }

  forkJoin({
    stands:    this.standService.getAll().pipe(catchError(() => of([]))),
    matchings: this.matchingService.getAll().pipe(catchError(() => of([]))),
    regs:      userId
                 ? this.hackRegService.getByUserId(userId).pipe(catchError(() => of([])))
                 : of([])
  }).subscribe({
    next: (result) => {
      this.stands          = result.stands;
      this.matchings       = result.matchings;
      this.myRegistrations = result.regs ?? [];
      this.myRegistration  = result.regs[0] ?? null;

      const first = this.myRegistrations.find(r => r.hackathon?.submissionDeadline);
      if (first?.hackathon?.submissionDeadline) {
        this.startCountdown(first.hackathon.submissionDeadline, first.hackathon.startDate ?? '');
      }

      // ✅ D'abord charger toutes mes War Rooms
      this.loadAllWarRooms();

      this.buildProfileAndRecommend();
    },
    error: () => { this.buildProfileAndRecommend(); }
  });
}
// ─── Construire le profil et demander les recommandations ───
buildProfileAndRecommend(): void {

  // Skills depuis les stands matchés
  const skillsFromStands = this.stands
    .slice(0, 5)
    .map(s => s.requiredSkills || '')
    .join(' ')
    .trim();

  // Skills depuis les matchings existants
  const skillsFromMatch = this.matchings
    .map(m => m.stand?.requiredSkills || '')
    .join(' ')
    .trim();

  // Domain depuis les inscriptions hackathon
  const domain = this.myRegistrations
    .map(r => r.hackathon?.domain || '')
    .filter(d => d.length > 0)
    .join(' ')
    .trim();

  // Prendre le meilleur disponible
  const skills = skillsFromMatch || skillsFromStands || 'Angular Java Python';

  console.log('📤 Skills envoyés :', skills);
  console.log('📤 Domain envoyé  :', domain);

  this.loadRecommendations(skills, domain || 'Technologie');
}
  // ─── LOADERS ───
  loadEvents(): void {
    this.isLoadingEvents = true;
    this.eventService.getAll().subscribe({
      next: (data) => { this.events = data; this.isLoadingEvents = false; },
      error: () => { this.showToast('Erreur chargement événements', 'error'); this.isLoadingEvents = false; }
    });
  }

  loadHackathons(): void {
    this.isLoadingHackathons = true;
    this.hackathonService.getAll().subscribe({
      next: (data) => { this.hackathons = data; this.isLoadingHackathons = false; },
      error: () => { this.showToast('Erreur chargement hackathons', 'error'); this.isLoadingHackathons = false; }
    });
  }

  loadStands(): void {
    this.isLoadingStands = true;
    this.standService.getAll().subscribe({
      next: (data) => { this.stands = data; this.isLoadingStands = false; },
      error: () => { this.showToast('Erreur chargement stands', 'error'); this.isLoadingStands = false; }
    });
  }

  loadConseils(): void {
    this.isLoadingConseils = true;
    this.conseilsService.getAll().subscribe({
      next: (data) => { this.conseilsData = data; this.isLoadingConseils = false; },
      error: () => { this.showToast('Erreur chargement conseils', 'error'); this.isLoadingConseils = false; }
    });
  }

  loadMatchings(): void {
    this.matchingService.getAll().subscribe({
      next: (data) => { this.matchings = data; },
      error: () => {}
    });
  }

  // ─── GETTERS / COMPUTED ───
  get pageTitle(): string {
    const titles: Record<string, string> = {
      overview:   "Vue d'ensemble",
      events:     'Événements disponibles',
      hackathons: 'Hackathons disponibles',
      stands:     'Stands recommandés',
      cvmatch:    'Matching CV × Stands',
      domain:     'Recommandations domaine',
      conseils:   'Conseils & Guides',
          submit:     'Soumettre mon travail'  

    };
    return titles[this.activePage] || '';
  }
searchQuery: string = '';

get filteredEvents(): Evenement[] {
  let result = this.events.filter(e => e.status === 'APPROVED');
  // Filtre par période
  if (this.currentTimeFilter !== 'ALL') {
    result = result.filter(e => this.getItemTimeStatus(e) === this.currentTimeFilter);
  }
  // Filtre par recherche (titre)
  if (this.searchQuery.trim()) {
    const q = this.searchQuery.toLowerCase();
    result = result.filter(e => e.title.toLowerCase().includes(q));
  }
  return result;
}
get approvedHackathons(): Hackathon[] {
  const approved = this.hackathons.filter(h => h.status === 'APPROVED');
  if (this.currentTimeFilter === 'ALL') return approved;
  return approved.filter(h =>
    this.getItemTimeStatus(h) === this.currentTimeFilter
  );
}
get filteredHackathons(): Hackathon[] {
  let result = this.hackathons.filter(h => h.status === 'APPROVED');
  if (this.currentTimeFilter !== 'ALL') {
    result = result.filter(h => this.getItemTimeStatus(h) === this.currentTimeFilter);
  }
  if (this.searchQuery.trim()) {
    const q = this.searchQuery.toLowerCase();
    result = result.filter(h => h.title.toLowerCase().includes(q));
  }
  return result;
}
get overviewHacks(): Hackathon[] {
  return this.hackathons.filter(h => h.status === 'APPROVED').slice(0, 2);
}

get overviewEvents(): Evenement[] {
  return this.events.filter(e => e.status === 'APPROVED').slice(0, 3);
}

  get topStands(): (Stand & { matchScore: number })[] {
    return this.stands
      .map(s => ({ ...s, matchScore: this.getMatchScore(s.id!) }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);
  }

  get top3Stands(): (Stand & { matchScore: number })[] {
    return this.topStands.slice(0, 3);
  }

  get eventsWithStands(): Evenement[] {
    const eventIds = new Set(
      this.stands.filter(s => s.event?.id).map(s => s.event!.id!)
    );
    return this.events.filter(e => eventIds.has(e.id!));
  }

  get standMatchResultsSorted(): StandMatchResult[] {
    return [...this.standMatchResults].sort((a, b) => b.finalScore - a.finalScore);
  }

  getStandCountByEvent(eventId: number): number {
    return this.stands.filter(s => s.event?.id === eventId).length;
  }

  getStandsByEvent(eventId: number): Stand[] {
    return this.stands.filter(s => s.event?.id === eventId);
  }

  getMatchScore(standId: number): number {
    const match = this.matchings.find(m => m.stand?.id === standId);
    return match ? match.score : 0;
  }

  getConseilUi(category: string) {
  return this.conseilUiMap[category] ?? {
    color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: 'fa-lightbulb', sub: '', light: '#f9fafb'
  };
}

  getConseilTips(content: string): string[] {
    return content.split('\n').filter(t => t.trim().length > 0);
  }

  // ─── SKILL MATCHING ───
  private normalizeSkill(skill: string): string {
    return skill.toLowerCase().replace(/\s+/g, '').replace(/\./g, '').replace(/-/g, '');
  }

  skillMatches(cvSkill: string, requiredSkill: string): boolean {
    const cvNorm  = this.normalizeSkill(cvSkill);
    const reqNorm = this.normalizeSkill(requiredSkill);
    if (cvNorm === reqNorm) return true;
    if (cvNorm.includes(reqNorm) || reqNorm.includes(cvNorm)) return true;
    const aliases = this.SKILL_ALIASES[reqNorm] ?? [];
    if (aliases.map(a => this.normalizeSkill(a)).includes(cvNorm)) return true;
    const cvAliases = this.SKILL_ALIASES[cvNorm] ?? [];
    if (cvAliases.map(a => this.normalizeSkill(a)).includes(reqNorm)) return true;
    return false;
  }

  isSkillMatched(requiredSkill: string, cvSkillsExtracted: string): boolean {
    if (!cvSkillsExtracted) return false;
    return cvSkillsExtracted.split(',').map(s => s.trim())
      .some(cv => this.skillMatches(cv, requiredSkill));
  }

  isEventActiveOrUpcoming(event: Evenement | undefined): boolean {

  if (!event) return false;

  const now = new Date();

  // If endDate exists, the event is valid while endDate >= today

  if (event.endDate) {

    const end = new Date(event.endDate);

    end.setHours(23, 59, 59, 999); 

    return end >= now;

  }

  // No endDate → consider it ongoing

  return true;

}
  get top3StandsFromMatch(): (Stand & { matchScore: number; level: string })[] {
    if (!this.matchResult || !this.matchResult.cvSkillsExtracted) return [];
    return this.stands
        .filter(s => this.isEventActiveOrUpcoming(s.event as Evenement))

      .map(s => {
        const skills = s.requiredSkills?.split(',').map(sk => sk.trim()) || [];
        const matched = skills.filter(sk =>
          this.isSkillMatched(sk, this.matchResult!.cvSkillsExtracted)
        );
        const keywordScore = skills.length > 0 ? matched.length / skills.length : 0;
        const semanticBoost = this.matchResult!.semanticScore * 0.4;
        const finalScore = Math.round((keywordScore * 0.6 + semanticBoost) * 100);
        return { ...s, matchScore: finalScore, level: this.getLevel(finalScore) };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  }

  // ─── DOMAIN DETECTION ───
  pickFileDomain(): void {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e: any) => {
      const file: File = e.target.files?.[0];
      if (!file) return;
      this.cvDomainFile         = file;
      this.cvDomainLoaded       = false;
      this.detectedDomain       = null;
      this.detectedDomainSkills = [];
      this.domainStands         = [];
    };
    input.click();
  }

  // ─── runDomainDetection : 100% local, sans API externe ───
  // Étape 1 : Groq extrait les skills du CV (ton backend Spring Boot)
  // Étape 2 : inferDomainFromSkills() compare ces skills avec
  //           le champ s.domain de chaque stand (pas les requiredSkills)
runDomainDetection(): void {
  if (!this.cvDomainFile || this.cvDomainAnalyzing) return;
  this.cvDomainAnalyzing    = true;
  this.cvDomainLoaded       = false;
  this.detectedDomain       = null;
  this.detectedDomainSkills = [];
  this.domainStands         = [];

  // ✅ Prendre un event qui a des stands Technologie, pas forcément events[0]
  const techEvent = this.events.find(e =>
    this.stands.some(s => s.event?.id === e.id && s.domain?.toLowerCase() === 'technologie')
  );
  const eventId = techEvent?.id ?? this.events[0]?.id ?? 0;

  this.matchingService.analyzeCv(this.cvDomainFile, eventId).subscribe({
    next: (results) => {
      if (!results || results.length === 0) {
        this.cvDomainAnalyzing = false;
        return;
      }

      const rawSkills = results[0]?.cvSkillsExtracted ?? '';

      // ✅ Liste blanche stricte — UNIQUEMENT skills techniques connues
      const TECH_WHITELIST = [
        'java', 'javascript', 'js', 'typescript', 'ts', 'python', 'php', 'c#', 'c++',
        'spring', 'springboot', 'spring boot', 'angular', 'react', 'vue', 'symfony',
        'laravel', 'django', 'flask', 'nodejs', 'node',
        'html', 'css', 'bootstrap', 'tailwind',
        'mysql', 'sql', 'postgresql', 'mongodb', 'redis',
        'docker', 'kubernetes', 'k8s', 'openstack', 'git', 'github',
        'jwt', 'api', 'api rest', 'rest', 'graphql', 'soap',
        'eclipse', 'intellij', 'visual studio',
        'adobe premiere', 'adobe photoshop', 'adobe after effects',
        'figma', 'linux', 'aws', 'azure',
        'excel', 'power bi', 'sap',
        'design ux', 'design ui', 'ux', 'ui'
      ];

      const allExtracted = rawSkills.split(',').map((s: string) => s.trim()).filter(Boolean);

      // ✅ Garder UNIQUEMENT les skills qui matchent la whitelist
      const cleanSkills = allExtracted.filter((skill: string) => {
        const lower = skill.toLowerCase();
        return TECH_WHITELIST.some(kw => lower === kw || lower.includes(kw) || kw.includes(lower));
      });

      console.log('📤 rawSkills (toutes) :', allExtracted);
      console.log('📤 cleanSkills (filtrées) :', cleanSkills);

      // Afficher dans l'UI les skills nettoyées
      this.detectedDomainSkills = cleanSkills.length > 0 ? cleanSkills : allExtracted.slice(0, 15);

      const availableDomains = [...new Set(
        this.stands.map(s => s.domain?.trim()).filter(Boolean)
      )] as string[];

      console.log('📤 availableDomains :', availableDomains);

      if (cleanSkills.length === 0) {
        // Aucune skill technique → fallback local direct
        this.detectedDomain = this.inferDomainFromSkills(allExtracted);
        
        this.domainStands = this.stands.filter(s =>

  s.domain?.trim().toLowerCase() === this.detectedDomain?.toLowerCase() &&

  this.isEventActiveOrUpcoming(s.event as Evenement)

);
        this.cvDomainAnalyzing = false;
        this.cvDomainLoaded    = true;
        return;
      }

      this.matchingService.detectDomain(cleanSkills, availableDomains)
        .subscribe({
          next: (domain: string) => {
            const domainTrimmed = domain.trim();
            const match = availableDomains.find(
              d => d.toLowerCase() === domainTrimmed.toLowerCase()
            );
            this.detectedDomain = match ?? domainTrimmed;

            console.log('✅ Domaine détecté :', this.detectedDomain);

            this.domainStands = this.stands.filter(s =>
              s.domain?.trim().toLowerCase() === this.detectedDomain?.toLowerCase()
            );

            console.log('🏪 Stands filtrés :', this.domainStands);

            this.cvDomainAnalyzing = false;
            this.cvDomainLoaded    = true;
          },
          error: () => {
            // Fallback local avec skills propres
            this.detectedDomain = this.inferDomainFromSkills(cleanSkills);
            this.domainStands = this.stands.filter(s =>
              s.domain?.trim().toLowerCase() === this.detectedDomain?.toLowerCase()
            );
            this.cvDomainAnalyzing = false;
            this.cvDomainLoaded    = true;
          }
        });
    },
    error: () => {
      this.cvDomainAnalyzing = false;
      this.showToast("Erreur lors de l'analyse du CV", 'error');
    }
  });
}
getImageSrc(base64: string): string {
  // PNG starts with 'iVBOR', JPEG with '/9j/'
  const type = base64.startsWith('/9j/') ? 'jpeg' : 'png';
  return `data:image/${type};base64,${base64}`;
}

  // ─── inferDomainFromSkills ───
  // Compare les skills du CV avec le champ "domain" (s.domain) de chaque stand.
  // Calcule un score pour chaque domaine distinct, retourne le meilleur.
  //
  // Score = 70% matching skills CV ↔ requiredSkills des stands du domaine
  //       + 30% matching skills CV ↔ nom du domaine lui-même
  //       × bonus logarithmique selon le nombre de stands du domaine
  //         (évite qu'un domaine avec 1 stand gagne à 100%)
  inferDomainFromSkills(skills: string[]): string {
    if (!skills || skills.length === 0) return 'Autre';

    // Domaines distincts depuis ta BDD via s.domain
    const allDomains = [...new Set(this.stands.map(s => s.domain).filter(Boolean))];
    if (allDomains.length === 0) return 'Autre';

    const skillsLower = skills.map(s => s.toLowerCase().trim());
    const scores: Record<string, number> = {};

    for (const domain of allDomains) {

      // ── Score A : skill CV contient un mot du nom du domaine ──
      // ex: domaine = "Technologie" → mot = "technologie"
      // aucune skill "java", "spring", "angular" ne contient "technologie"
      // → score A faible pour domaine Technologie sur ce critère seul
      const domainWords = domain.toLowerCase().split(/[\s\-_]+/);
      const directMatchCount = domainWords.filter(word =>
        skillsLower.some(sk => sk.includes(word) || word.includes(sk))
      ).length;
      const scoreA = domainWords.length > 0 ? directMatchCount / domainWords.length : 0;

      // ── Score B : skills CV ↔ requiredSkills des stands de ce domaine ──
      // ex: stand Technologie requiert "Java, Spring, Angular"
      // → Java matche → score B élevé pour Technologie
      const standsOfDomain = this.stands.filter(s =>

  s.domain === domain &&

  this.isEventActiveOrUpcoming(s.event as Evenement)

);
      let totalRequired = 0;
      let totalMatched  = 0;

      for (const stand of standsOfDomain) {
        const required = (stand.requiredSkills ?? '')
          .split(',').map(r => r.trim()).filter(Boolean);
        totalRequired += required.length;
        totalMatched  += required.filter(r =>
          skills.some(cv => this.skillMatches(cv, r))
        ).length;
      }

      const scoreB = totalRequired > 0 ? totalMatched / totalRequired : 0;

      // ── Score final ──
      // Math.log1p(n) : log(1+n) → pénalise les domaines avec 1 seul stand
      // log1p(1) ≈ 0.69  /  log1p(5) ≈ 1.79  /  log1p(10) ≈ 2.40
      scores[domain] = (scoreB * 0.7 + scoreA * 0.3)
                       * Math.log1p(standsOfDomain.length);
    }

    const best = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
    return best && best[1] > 0 ? best[0] : 'Autre';
  }

  get domainScorePercent(): number {
    if (!this.detectedDomain || this.domainStands.length === 0 ||
        this.detectedDomainSkills.length === 0) return 0;
    const allRequired = this.domainStands
      .flatMap(s => (s.requiredSkills ?? '').split(',').map(r => r.trim()).filter(Boolean));
    const matched = allRequired.filter(r =>
      this.detectedDomainSkills.some(cv => this.skillMatches(cv, r))
    );
    return allRequired.length > 0
      ? Math.round((matched.length / allRequired.length) * 100)
      : 0;
  }

  getDomainIcon(domain: string): string {
    const map: Record<string, string> = {
      Technologie:   'fa-microchip',
      Finance:       'fa-coins',
      'Santé':       'fa-heartbeat',
      'Éducation':   'fa-graduation-cap',
      Environnement: 'fa-leaf',
      Autre:         'fa-store'
    };
    return map[domain] ?? 'fa-store';
  }

  getDomainColor(domain: string): string {
    const map: Record<string, string> = {
      Technologie:   '#3b82f6',
      Finance:       '#f59e0b',
      'Santé':       '#ef4444',
      'Éducation':   '#8b5cf6',
      Environnement: '#10b981',
      Autre:         '#6b7280'
    };
    return map[domain] ?? '#6b7280';
  }

  getDomainBg(domain: string): string {
    const map: Record<string, string> = {
      Technologie:   'rgba(59,130,246,0.1)',
      Finance:       'rgba(245,158,11,0.1)',
      'Santé':       'rgba(239,68,68,0.1)',
      'Éducation':   'rgba(139,92,246,0.1)',
      Environnement: 'rgba(16,185,129,0.1)',
      Autre:         'rgba(107,114,128,0.1)'
    };
    return map[domain] ?? 'rgba(107,114,128,0.1)';
  }

  getIndividualStandScore(stand: Stand): number {
    if (!this.detectedDomainSkills || this.detectedDomainSkills.length === 0) return 0;
    const required = (stand.requiredSkills ?? '')
      .split(',').map(r => r.trim()).filter(Boolean);
    if (required.length === 0) return 0;
    const matched = required.filter(r =>
      this.detectedDomainSkills.some(cv => this.skillMatches(cv, r))
    );
    return Math.round((matched.length / required.length) * 100);
  }

  // ─── NIVEAU ───
  getLevel(score: number): string {
    if (score >= 70) return 'Fort';
    if (score >= 40) return 'Moyen';
    return 'Faible';
  }

  levelColor(level: string): string {
    return level === 'Fort' ? '#22c55e' : level === 'Moyen' ? '#f59e0b' : '#ef4444';
  }

  levelBg(level: string): string {
    return level === 'Fort'  ? 'rgba(34,197,94,0.1)'
         : level === 'Moyen' ? 'rgba(245,158,11,0.1)'
         : 'rgba(239,68,68,0.1)';
  }

  // ─── NAVIGATION ───
navigate(page: string): void {
  // ✅ Si on quitte la War Room et que le whiteboard est ouvert → sauvegarder
  if (this.activePage === 'warroom' && 
      this.warRoomTab === 'whiteboard' && 
      this.showExcalidrawIframe &&
      page !== 'warroom') {
    const iframe = document.getElementById(
      'excalidraw-iframe') as HTMLIFrameElement;
    iframe?.contentWindow?.postMessage({ type: 'WB_GET' }, '*');
  }
  this.activePage = page;
}
  filterEventsPage(type: string): void { this.currentEvFilter = type; }

  showStandsOf(eventId: number): void {
    this.activePage = 'stands';
    setTimeout(() => {
      const el = document.querySelector(`[data-eid="${eventId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // ─── DATE FORMAT ───
  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  // ─── STATUS BADGE ───
  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      APPROVED: 'badge-open', PENDING: 'badge-soon', REJECTED: 'badge-full',
      open: 'badge-open', soon: 'badge-soon', full: 'badge-full'
    };
    return 'badge ' + (map[status] || 'badge-soon');
  }

  statusBadgeLabel(status: string): string {
    const map: Record<string, string> = {
      APPROVED: 'Ouvert', PENDING: 'Bientôt', REJECTED: 'Complet',
      open: 'Ouvert', soon: 'Bientôt', full: 'Complet'
    };
    return map[status] || status;
  }

  // ─── MODAL ÉVÉNEMENT ───
  openEventModal(id: number): void {
    this.eventService.getById(id).subscribe({
      next: (ev) => {
        this.currentEvent      = ev;
        this.cvFileModal       = null;
        this.standMatchResults = [];
        this.matchDone         = false;
        this.eventForm         = { fullName: '', email: '', skills: '', cvPath: '' };
        this.modalEventVisible = true;
      },
      error: () => this.showToast("Erreur lors du chargement de l'événement", 'error')
    });
  }

 submitEvent(): void {
  if (!this.eventForm.fullName || !this.eventForm.email) {
    this.showToast('Veuillez remplir tous les champs obligatoires', 'error');
    return;
  }
  const userId = this.getCurrentUserId();

  // ✅ AJOUTE L'ID DE L'ÉVÉNEMENT dans le payload
  const payload = {
    ...this.eventForm,
      present: false,  
  event:    { id: this.currentEvent?.id ?? 0 } ,
  user: this.currentUserId ? { id: this.currentUserId } : null

  };

  this.formService.create(payload).subscribe({
    next: (savedForm: any) => {
      this.showToast('Candidature envoyée ! Un email de confirmation vous a été envoyé 📧', 'success');

      if (this.cvFileModal && this.currentEvent?.id) {
        this.cvAnalyzing = true;
        this.matchingService.analyzeCv(this.cvFileModal, this.currentEvent.id)
          .subscribe({
            next: (results) => {
              this.standMatchResults = results;
              this.matchDone         = true;
              this.cvAnalyzing       = false;
              results.forEach(r => this.saveMatchingResult(r, this.currentEvent!.id!));
              this.loadMatchings();
              this.triggerSuccessModal('event');
            },
            error: () => {
              this.cvAnalyzing = false;
              this.showToast("Erreur lors de l'analyse du CV", 'error');
            }
          });
      } else {
        this.modalEventVisible = false;
        this.triggerSuccessModal('event');
      }
    },
    error: () => this.showToast("Erreur lors de l'envoi de la candidature", 'error')
  });
}
  private saveMatchingResult(result: StandMatchResult, eventId: number): void {
    const s = this.stands.find(st => st.id === result.standId);
    if (!s) { console.warn('Stand non trouvé pour id', result.standId); return; }

    const matching: Partial<Matching> = {
      score: Math.round(result.finalScore * 100),
      semanticScore: result.semanticScore,
      keywordScore:  result.keywordScore,
      level:         result.level,
      stand:         s,
      event:         { id: eventId }
    };
    this.matchingService.save(matching).subscribe({
      error: (err) => console.warn('Sauvegarde matching échouée', result.standId, err)
    });
  }

  // ─── MODAL HACKATHON ───
  openHackModal(id: number): void {
    this.hackathonService.getById(id).subscribe({
      next: (h) => {
        this.currentHackathon = h;
        this.hackForm         = { teamName: '', teamSize: 3, leaderName: '', leaderEmail: '' };
        this.modalHackVisible = true;
      },
      error: () => this.showToast('Erreur lors du chargement du hackathon', 'error')
    });
  }

  submitHack(): void {
    if (!this.hackForm.teamName || !this.hackForm.leaderName ||
        !this.hackForm.leaderEmail || !this.hackForm.teamSize) {
      this.showToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }
  const userId = this.getCurrentUserId();

    const registration: HackathonRegistration = {
      ...this.hackForm,
      hackathon: this.currentHackathon,
  user: this.currentUserId ? { id: this.currentUserId } : null
    };

    this.hackRegService.create(registration).subscribe({
      next: () => {
        this.modalHackVisible = false;
        this.showToast(`Équipe "${this.hackForm.teamName}" inscrite ! Un email de confirmation vous a été envoyé 📧`, 'success');
        this.triggerSuccessModal('hack');
      },
      error: () => this.showToast("Erreur lors de l'inscription de l'équipe", 'error')
    });
  }

  // ─── SUCCESS MODAL ───
  private triggerSuccessModal(type: 'event' | 'hack'): void {
    this.successModalType = type;
    if (type === 'event' && this.currentEvent) {
      this.successModalTitle    = this.currentEvent.title || '';
      this.successModalDate     = this.formatDate(this.currentEvent.startDate);
      this.successModalLocation = this.currentEvent.location || '';
    } else if (type === 'hack' && this.currentHackathon) {
      this.successModalTitle    = this.currentHackathon.title || '';
      this.successModalDate     = this.formatDate(this.currentHackathon.startDate);
      this.successModalLocation = this.currentHackathon.location || '';
    }
    this.modalSuccessVisible = true;
    setTimeout(() => { this.modalSuccessVisible = false; }, 6000);
  }

  closeSuccessModal(): void { this.modalSuccessVisible = false; }

  closeModal(type: 'event' | 'hack'): void {
    if (type === 'event') {
      this.modalEventVisible = false;
      this.matchDone         = false;
      this.cvAnalyzing       = false;
      this.cvFileModal       = null;
      this.standMatchResults = [];
    } else {
      this.modalHackVisible = false;
    }
  }

  // ─── PICK FILE ───
  pickFile(type: 'event' | 'cv'): void {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e: any) => {
      const file: File = e.target.files?.[0];
      if (!file) return;
      if (type === 'event') {
        this.cvFileModal       = file;
        this.eventForm.cvPath  = file.name;
        this.standMatchResults = [];
        this.matchDone         = false;
      } else {
        this.cvFile      = file;
        this.cvLoaded    = true;
        this.matchResult = null;
      }
    };
    input.click();
  }

  pickFileCvPage(): void { this.pickFile('cv'); }

  selectStandForMatch(stand: Stand): void {
    this.selectedStandSkills = stand.requiredSkills;
    this.selectedStandName   = stand.startupName;
    this.matchResult         = null;
    this.cvLoaded            = false;
  }

  // ─── ANALYSE CV (page cvmatch) ───
  // ─── ANALYSE CV (page cvmatch) ───
// Remplace complètement l'ancienne méthode runCVAnalysis()
runCVAnalysis(): void {
  if (!this.cvFile) { this.showToast("Veuillez d'abord charger un CV (PDF)", 'error'); return; }
  if (this.cvAnalyzing) return;
  this.cvAnalyzing = true;
  this.cvLoaded    = false;
  this.matchResult = null;

  // ✅ Prendre un eventId d'un événement actif/à venir
  const activeEvent = this.events.find(e =>
    e.status === 'APPROVED' && this.isEventActiveOrUpcoming(e)
  );
  const eventId = activeEvent?.id ?? this.events[0]?.id ?? 0;

  this.matchingService.analyzeCv(this.cvFile, eventId).subscribe({
    next: (results) => {
      this.cvAnalyzing = false;

      if (!results || results.length === 0) {
        this.cvLoaded = true;
        return;
      }

      // ✅ Skills extraites depuis le backend (Groq)
      const cvSkillsExtracted = results[0]?.cvSkillsExtracted ?? '';
      const semanticScore     = results[0]?.semanticScore ?? 0;

      // ✅ Recalculer le score uniquement sur les stands d'événements actifs/à venir
      const activeStands = this.stands.filter(s => this.isEventActiveOrUpcoming(s.event));

      if (activeStands.length === 0) {
        // Aucun stand actif → score 0, on affiche quand même les skills
       this.matchResult = {
  finalScore:        0,
  semanticScore:     semanticScore,
  keywordScore:      0,
  level:             this.getLevel(0) as 'Fort' | 'Moyen' | 'Faible',
  cvSkillsExtracted
};
        this.cvLoaded = true;
        return;
      }

      // Calculer le score pour chaque stand actif
      const scored = activeStands.map(s => {
        const requiredSkills = s.requiredSkills?.split(',').map(sk => sk.trim()).filter(Boolean) || [];
        const matched = requiredSkills.filter(sk => this.isSkillMatched(sk, cvSkillsExtracted));
        const keywordScore = requiredSkills.length > 0 ? matched.length / requiredSkills.length : 0;
        // finalScore entre 0 et 1 (cohérent avec le template qui fait * 100)
        const finalScore = keywordScore * 0.6 + semanticScore * 0.4;
        return { keywordScore, finalScore };
      });

      // Prendre le meilleur score parmi les stands actifs
      const best = scored.sort((a, b) => b.finalScore - a.finalScore)[0];

      // getLevel() attend un score entre 0 et 100
    this.matchResult = {
  finalScore:        best.finalScore,
  semanticScore:     semanticScore,
  keywordScore:      best.keywordScore,
  level:             this.getLevel(Math.round(best.finalScore * 100)) as 'Fort' | 'Moyen' | 'Faible',
  cvSkillsExtracted
};

      this.cvLoaded = true;
    },
    error: () => {
      this.cvAnalyzing = false;
      this.showToast("Erreur lors de l'analyse du CV", 'error');
    }
  });
}

  // ─── TOAST ───
  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toasts.push({ message, type });
    setTimeout(() => this.toasts.shift(), 3200);
  }


  //drive
  // ─── Charger l'inscription du participant connecté ───
loadMyRegistration(): void {
  this.submitLoading = true;
  const userId = this.getCurrentUserId();
  if (!userId) { this.submitLoading = false; return; }

  this.hackRegService.getByUserId(userId).subscribe({
    next: (regs) => {
      this.myRegistrations = regs ?? [];
      this.myRegistration = regs[0] ?? null; // compatibilité
      console.log('✅ myRegistrations:', this.myRegistrations);
      this.submitLoading = false;
  // ✅ Appeler ICI, pas dans ngOnInit
  if (this.myRegistration?.id) {
    this.loadOrCreateWarRoom();
  }
      // Démarrer countdown pour le premier hackathon avec deadline
      const first = this.myRegistrations.find(
        r => r.hackathon?.submissionDeadline
      );
      if (first?.hackathon?.submissionDeadline) {
        this.startCountdown(
          first.hackathon.submissionDeadline,
          first.hackathon.startDate ?? ''
        );
      }
    },
    error: (err) => {
      console.log('❌ Erreur:', err);
      this.submitLoading = false;
    }
  });
}
// ─── Démarrer le chronomètre ───
startCountdown(deadline: string, startDate: string): void {
  this.submitHackathonStartDate = startDate;
  if (this.countdownInterval) clearInterval(this.countdownInterval);

  const update = () => {
    const now = Date.now();
    const deadlineMs = new Date(deadline).getTime();
    const startMs = startDate ? new Date(startDate).getTime() : now;
    const diff = deadlineMs - now;

    // Barre de progression
    const total = deadlineMs - startMs;
    const elapsed = now - startMs;
    this.submitProgressPercent = total > 0
      ? Math.min(100, Math.round((elapsed / total) * 100))
      : 100;

    if (diff <= 0) {
      this.submitDeadlinePassed = true;
      this.countdownDays  = '00';
      this.countdownHours = '00';
      this.countdownMins  = '00';
      this.countdownSecs  = '00';
      this.submitProgressPercent = 100;
      clearInterval(this.countdownInterval);
      return;
    }

    this.submitDeadlinePassed = false;
    this.countdownDays  = String(Math.floor(diff / 86400000)).padStart(2, '0');
    this.countdownHours = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
    this.countdownMins  = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    this.countdownSecs  = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  };

  update();
  this.countdownInterval = setInterval(update, 1000);
}

// ─── Formater deadline complète ───
formatDeadlineFull(deadline?: string): string {
  if (!deadline) return '—';
  const date = new Date(deadline);
  if (isNaN(date.getTime())) return deadline;
  const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} à ${h}h${m}`;
}

// ─── Badge d'alerte si deadline dans moins de 24h ───
isDeadlineSoon(reg: HackathonRegistration): boolean {
  if (!reg.hackathon?.submissionDeadline) return false;
  const diff = new Date(reg.hackathon.submissionDeadline).getTime() - Date.now();
  return diff > 0 && diff < 86400000; // moins de 24h
}

// ─── Dans ngOnDestroy (ajouter si pas encore présent) ───
ngOnDestroy(): void {
  // ✅ Sauvegarder le whiteboard avant de quitter
  if (this.warRoomTab === 'whiteboard' && this.showExcalidrawIframe) {
    const iframe = document.getElementById(
      'excalidraw-iframe') as HTMLIFrameElement;
    iframe?.contentWindow?.postMessage({ type: 'WB_GET' }, '*');
  }

  if (this.countdownInterval) clearInterval(this.countdownInterval);
  if (this.kanbanPollingInterval) clearInterval(this.kanbanPollingInterval);
  if (this.whiteboardPollingInterval) clearInterval(this.whiteboardPollingInterval);
  if (this.wbSaveHandler) {
    window.removeEventListener('message', this.wbSaveHandler);
  }
}
openFeedbackModal(id: number, type: 'EVENT' | 'HACKATHON' = 'EVENT'): void {
  this.currentFeedbackEventId = id;
  this.feedbackFormData = null;
  this.feedbackAnswers = {};
  this.feedbackDone = false;
  this.feedbackError = '';

  this.feedbackService.getForm(type, id).subscribe({
    next: (form) => {
      this.feedbackFormData = form;
      this.showFeedbackModal = true;
    },
    error: () => this.showToast(
      "Aucun formulaire disponible", 'error')
  });
}

setAnswer(questionId: number, value: string): void {
  this.feedbackAnswers[questionId] = value;
}

submitFeedback(userEmail: string, userName: string): void {
  if (!this.feedbackFormData?.id) return;

  // Vérifier champs obligatoires
  const missing = this.feedbackFormData.questions
    .filter(q => q.required && !this.feedbackAnswers[q.id!]?.trim());
  if (missing.length > 0) {
    this.feedbackError =
      `${missing.length} question(s) obligatoire(s) sans réponse`;
    return;
  }

  this.feedbackSubmitting = true;
  this.feedbackError = '';

  const answers: FeedbackAnswer[] = Object.entries(this.feedbackAnswers)
    .filter(([, v]) => v?.trim())
    .map(([id, value]) => ({
      question: { id: Number(id) },
      value
    }));

  const response = {
    form: { id: this.feedbackFormData.id },
    participantEmail: userEmail,
    participantName: userName,
    answers
  };

  this.feedbackService.submitResponse(response).subscribe({
    next: (res) => {
      this.feedbackSubmitting = false;
      if (res.success) {
        this.feedbackDone = true;
      } else if (res.alreadySubmitted) {
        this.feedbackError = 'Vous avez déjà soumis ce feedback';
      } else {
        this.feedbackError = res.message || 'Erreur';
      }
    },
    error: () => {
      this.feedbackSubmitting = false;
      this.feedbackError = 'Erreur serveur — réessayez';
    }
  });
}

getOptionsArray(options: string | undefined): string[] {
  if (!options) return [];
  return options.split('|').filter(o => o.trim());
}

getScaleArray(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => i + min);
}

isCheckboxChecked(questionId: number, option: string): boolean {
  const val = this.feedbackAnswers[questionId] || '';
  return val.split('|').includes(option);
}

toggleCheckbox(questionId: number, option: string): void {
  const current = this.feedbackAnswers[questionId] || '';
  const parts = current ? current.split('|') : [];
  const idx = parts.indexOf(option);
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(option);
  this.feedbackAnswers[questionId] = parts.join('|');
}



//drive

// ─── SUBMIT STATE ───
submitFiles: File[] = [];
submitUploading = false;
submitUploadResults: { name: string; success: boolean; link?: string }[] = [];



// ─── Sélectionner fichiers ───
pickSubmitFiles(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.pdf,.zip,.pptx,.docx,.png,.jpg,.mp4';
  input.onchange = (e: any) => {
    const files: FileList = e.target.files;
    if (!files) return;
    this.submitFiles = Array.from(files);
    this.submitUploadResults = [];
  };
  input.click();
}

removeSubmitFile(index: number): void {
  this.submitFiles.splice(index, 1);
}

// ─── Soumettre tous les fichiers ───
async submitAllFiles(): Promise<void> {
  if (!this.myRegistration?.id || this.submitFiles.length === 0) return;
  if (this.submitDeadlinePassed) {
    this.showToast('La deadline est passée — soumission fermée', 'error');
    return;
  }

  this.submitUploading = true;
  this.submitUploadResults = [];

  for (const file of this.submitFiles) {
    try {
      const result = await this.submitService
        .uploadFile(this.myRegistration.id!, file)
        .toPromise();

      this.submitUploadResults.push({
        name: file.name,
        success: result.success,
        link: result.fileLink
      });
    } catch (err) {
      this.submitUploadResults.push({
        name: file.name,
        success: false
      });
    }
  }

  this.submitUploading = false;
  const allOk = this.submitUploadResults.every(r => r.success);
  if (allOk) {
    this.showToast('✅ Tous les fichiers soumis avec succès !', 'success');
    this.submitFiles = [];
  } else {
    this.showToast('⚠️ Certains fichiers ont échoué', 'error');
  }
}

getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'fa-file-pdf', zip: 'fa-file-archive',
    pptx: 'fa-file-powerpoint', docx: 'fa-file-word',
    png: 'fa-file-image', jpg: 'fa-file-image', mp4: 'fa-file-video'
  };
  return map[ext ?? ''] ?? 'fa-file';
}

// ─── Map fichiers par registrationId ───
submitFilesByReg: Map<number, File[]> = new Map();
submitResultsByReg: Map<number, { name: string; success: boolean; link?: string }[]> = new Map();

isRegDeadlinePassed(reg: HackathonRegistration): boolean {
  if (!reg.hackathon?.submissionDeadline) return false;
  return new Date() > new Date(reg.hackathon.submissionDeadline);
}

getFilesForReg(regId: number): File[] {
  return this.submitFilesByReg.get(regId) ?? [];
}

getResultsForReg(regId: number): { name: string; success: boolean; link?: string }[] {
  return this.submitResultsByReg.get(regId) ?? [];
}

pickSubmitFilesForReg(reg: HackathonRegistration): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.pdf,.zip,.pptx,.docx,.png,.jpg,.mp4';
  input.onchange = (e: any) => {
    const files: File[] = Array.from(e.target.files ?? []);
    this.submitFilesByReg.set(reg.id!, files);
    this.submitResultsByReg.delete(reg.id!);
  };
  input.click();
}

removeFileForReg(regId: number, index: number): void {
  const files = this.submitFilesByReg.get(regId) ?? [];
  files.splice(index, 1);
  this.submitFilesByReg.set(regId, [...files]);
}

async submitFilesForReg(reg: HackathonRegistration): Promise<void> {
  if (!reg.id || this.isRegDeadlinePassed(reg)) return;
  const files = this.submitFilesByReg.get(reg.id) ?? [];
  if (files.length === 0) return;

  this.submitUploading = true;
  const results: { name: string; success: boolean; link?: string }[] = [];

  for (const file of files) {
    try {
      const result = await this.submitService.uploadFile(reg.id, file).toPromise();
      results.push({ name: file.name, success: result.success, link: result.fileLink });
    } catch {
      results.push({ name: file.name, success: false });
    }
  }

  this.submitResultsByReg.set(reg.id, results);
  this.submitUploading = false;

  const allOk = results.every(r => r.success);
  if (allOk) {
    this.showToast('✅ Fichiers soumis avec succès !', 'success');
    this.submitFilesByReg.delete(reg.id);
  } else {
    this.showToast('⚠️ Certains fichiers ont échoué', 'error');
  }
}
get activeRegistrations(): HackathonRegistration[] {
  return this.myRegistrations.filter(r => !this.isRegDeadlinePassed(r));
}


//table

// ─── VARIABLES ───
//myWarRoom: WarRoom | null = null;
warRoomLoading = false;
warRoomTab: 'kanban' | 'whiteboard' = 'kanban';

// Kanban
warRoomTasks: WarRoomTask[] = [];
newTaskTitle = '';
newTaskDescription = '';
private kanbanPollingInterval: any = null;

// Whiteboard
private excalidrawAPI: any = null;
private whiteboardPollingInterval: any = null;

// Partager
showShareModal = false;
inviteEmailInput = '';
inviteEmails: string[] = [];
inviteSending = false;

// ─── MÉTHODES ───

navigateToWarRoom(): void {
  this.activePage = 'warroom';
  if (this.myWarRooms.size > 0 && !this.activeWarRoomRegId) {
    this.activeWarRoomRegId = this.myRegistrations[0]?.id ?? null;
  }
  if (this.myWarRoom) {
    this.loadTasks();
    this.startKanbanPolling();
  }
}

loadOrCreateWarRoom(): void {
  // Remplacée par loadAllWarRooms()
  this.loadAllWarRooms();
}

// ─── KANBAN ───


getTasksByStatus(status: 'TODO' | 'DOING' | 'DONE'): WarRoomTask[] {
  return this.warRoomTasks.filter(t => t.status === status);
}

addTask(): void {
  if (!this.newTaskTitle.trim() || !this.myWarRoom?.id) return;
  const warRoomId = Math.abs(this.myWarRoom.id as number); // ✅

  const task: WarRoomTask = {
    title: this.newTaskTitle.trim(),
    description: this.newTaskDescription.trim(),
    status: 'TODO',
    createdBy: this.currentUserEmail
  };

  this.warRoomService.addTask(warRoomId, task).subscribe({
    next: (t: WarRoomTask) => {
      this.warRoomTasks.push(t);
      this.newTaskTitle = '';
      this.newTaskDescription = '';
    },
    error: () => this.showToast('Erreur ajout tâche', 'error')
  });
}

moveTask(task: WarRoomTask, newStatus: 'TODO' | 'DOING' | 'DONE'): void {
  if (!task.id) return;
  this.warRoomService.updateTaskStatus(task.id, newStatus).subscribe({
    next: (updated: WarRoomTask) => {
      const idx = this.warRoomTasks.findIndex(t => t.id === task.id);
      if (idx >= 0) this.warRoomTasks[idx] = updated;
    },
    error: () => this.showToast('Erreur mise à jour', 'error')
  });
}

deleteTask(taskId: number): void {
  this.warRoomService.deleteTask(taskId).subscribe({
    next: () => {
      this.warRoomTasks = this.warRoomTasks.filter(t => t.id !== taskId);
    },
    error: () => this.showToast('Erreur suppression', 'error')
  });
}

startKanbanPolling(): void {
  if (this.kanbanPollingInterval) clearInterval(this.kanbanPollingInterval);
  
  // ✅ Capturer l'ID au moment du démarrage du polling
  const room = this.myWarRoom;
  if (!room?.id) return;
  const warRoomId = Math.abs(room.id as number);
  
  console.log('🔄 Kanban polling démarré pour warRoomId:', warRoomId);
  
  this.kanbanPollingInterval = setInterval(() => {
    if (this.activePage !== 'warroom' || this.warRoomTab !== 'kanban') return;
    
    // ✅ Utiliser l'ID capturé, pas this.myWarRoom qui peut changer
    this.warRoomService.getTasks(warRoomId).subscribe({
      next: (tasks: WarRoomTask[]) => { 
        this.warRoomTasks = tasks; 
      },
      error: () => {}
    });
  }, 2000);
}



// ─── PARTAGER ───
openShareModal(): void {
  this.inviteEmails = [];
  this.inviteEmailInput = '';
  this.showShareModal = true;
}

addInviteEmail(): void {
  const email = this.inviteEmailInput.trim();
  if (!email || !email.includes('@')) {
    this.showToast('Email invalide', 'error');
    return;
  }
  if (this.inviteEmails.includes(email)) {
    this.showToast('Email déjà ajouté', 'error');
    return;
  }
  this.inviteEmails.push(email);
  this.inviteEmailInput = '';
}

removeInviteEmail(index: number): void {
  this.inviteEmails.splice(index, 1);
}

sendInvitations(): void {
  if (!this.myWarRoom?.id || this.inviteEmails.length === 0) return;
  this.inviteSending = true;

  this.warRoomService.inviteMembers(this.myWarRoom.id, this.inviteEmails).subscribe({
    next: () => {
      this.inviteSending = false;
      this.showShareModal = false;
      this.showToast(
        `✅ ${this.inviteEmails.length} invitation(s) envoyée(s) !`,
        'success'
      );
      this.inviteEmails = [];
    },
    error: () => {
      this.inviteSending = false;
      this.showToast('Erreur envoi invitations', 'error');
    }
  });
}

// ─── REJOINDRE VIA TOKEN ───
 /*checkWarRoomAccess(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const email = this.currentUserEmail;

  if (token && email) {
    this.warRoomService.joinRoom(token, email).subscribe({
      next: (room: WarRoom) => {
        this.myWarRoom = room;
        this.activePage = 'warroom';
        this.loadTasks();
        this.startKanbanPolling();
        this.showToast('✅ Vous avez rejoint la War Room !', 'success');
      },
      error: () => this.showToast("Lien d'invitation invalide", 'error')
    });
  }
}
*/
checkWarRoomAccess(): void {
  const token = localStorage.getItem('pendingWarRoomToken');
  if (!token) return;

  localStorage.removeItem('pendingWarRoomToken');
  this.warRoomLoading = true;

  this.warRoomService.joinRoom(token).subscribe({
    next: (room: WarRoom) => {
      this.warRoomLoading = false;

      // ✅ Ajouter la War Room invitée sans écraser les autres
      const invKey = -room.id!;
      this.myWarRooms.set(invKey, room);

      // ✅ Sélectionner la War Room invitée comme active
      this.activeWarRoomRegId = invKey;

      this.warRoomTasks = [];
      this.loadTasks();
      this.startKanbanPolling();

      // ✅ Naviguer vers warroom
      this.activePage = 'warroom';

      this.showToast('✅ Vous avez rejoint la War Room !', 'success');
    },
    error: () => {
      this.warRoomLoading = false;
      this.showToast("Lien d'invitation invalide ou expiré", 'error');
    }
  });
}

getInvitedWarRoomKeys(): number[] {
  return Array.from(this.myWarRooms.keys()).filter(k => k < 0);
}
// ─── DRAG & DROP KANBAN ───
draggedTask: WarRoomTask | null = null;
dragOverColumn: string | null = null;

onDragStart(task: WarRoomTask): void {
  this.draggedTask = task;
}

onDragOver(event: DragEvent, status: string): void {
  event.preventDefault();
  this.dragOverColumn = status;
}

onDragLeave(): void {
  this.dragOverColumn = null;
}

onDrop(event: DragEvent, newStatus: 'TODO' | 'DOING' | 'DONE'): void {
  event.preventDefault();
  this.dragOverColumn = null;
  if (!this.draggedTask || this.draggedTask.status === newStatus) {
    this.draggedTask = null;
    return;
  }
  this.moveTask(this.draggedTask, newStatus);
  this.draggedTask = null;
}

onDragEnd(): void {
  this.draggedTask = null;
  this.dragOverColumn = null;
}







//recom
  recommendations: any[] = [];
  isLoading = false;
  hasError  = false;
 
loadUserThenRecommend(): void {

  // ── Option 1 : depuis les matchings CV déjà calculés ──
  // tu as this.matchings chargé dans loadMatchings()
  const skillsFromMatching = this.matchings.length > 0
    ? this.matchings.map(m => m.stand?.requiredSkills || '').join(' ')
    : '';

  // ── Option 2 : depuis les inscriptions hackathon ──
  const domainFromHack = this.myRegistrations.length > 0
    ? this.myRegistrations.map(r => r.hackathon?.domain || '').join(' ')
    : '';

  // ── Option 3 : depuis les stands populaires ──
  const skillsFromStands = this.stands.slice(0, 3)
    .map(s => s.requiredSkills || '').join(' ');

  // Prendre le premier non vide
  const skills = skillsFromMatching || skillsFromStands || '';
  const domain = domainFromHack || '';

  console.log('📤 Skills envoyés :', skills);
  console.log('📤 Domain envoyé  :', domain);

  this.loadRecommendations(skills, domain);
}
 
loadRecommendations(skills: string, domain: string): void {
  this.isLoading = true;
  this.hasError  = false;

  this.recoService.getRecommendations(skills, domain).subscribe({
    next: (res) => {
      const now = new Date();
      // ✅ Filtrer : APPROVED + endDate pas encore passée
      this.recommendations = (res.recommendations || []).filter((reco: any) => {
        const event = this.events.find(e => e.id === reco.id || e.title === reco.title);
        if (!event) return false;
        if (event.status !== 'APPROVED') return false;
        if (event.endDate && new Date(event.endDate) <= now) return false;
        return true;
      });
      this.isLoading = false;
    },
    error: () => {
      console.warn('Recommendation service (localhost:5001) offline. Falling back to default events.');
      const now = new Date();
      
      // Fallback: Pick top 3 upcoming approved events
      this.recommendations = this.events
        .filter(e => e.status === 'APPROVED' && (!e.endDate || new Date(e.endDate) > now))
        .slice(0, 3)
        .map(e => ({ 
          ...e, 
          reason: 'Événement populaire pour votre profil' 
        }));

      this.hasError  = false; // Silently fallback
      this.isLoading = false;
    }
  });
}
/*carte decoration*/
// À côté des autres propriétés
conseilCatFilter = 'ALL';
readonly CONSEIL_CATEGORIES = ['CV', 'EVENT', 'HACKATHON', 'STAND', 'NETWORK', 'AUTRE'];

// Getter pour les conseils filtrés
get filteredConseils(): Conseils[] {
  if (this.conseilCatFilter === 'ALL') return this.conseilsData;
  return this.conseilsData.filter(c => c.category === this.conseilCatFilter);
}
 // ─── FLIP CARD STATE ───
flippedCards: Record<number, boolean> = {};
showCongrats = false;
currentCongratsCategory = '';
private congratsTimeout: any = null;

flipCard(id: number): void {
  this.flippedCards[id] = !this.flippedCards[id]; // toggle au lieu de = true
  // Vérifier complétion seulement si on vient de retourner (pas de refermer)
  if (this.flippedCards[id]) {
    this.checkCategoryComplete();
  }
}
isFlipped(id: number): boolean {
  return !!this.flippedCards[id];
}

setConseilFilter(cat: string): void {
  this.conseilCatFilter = cat;
  this.showCongrats = false;
}

private checkCategoryComplete(): void {
  if (this.conseilCatFilter === 'ALL') return;

  const inCategory = this.conseilsData.filter(
    c => c.category === this.conseilCatFilter
  );
  const allFlipped = inCategory.every(c => this.flippedCards[c.id!]);

  if (allFlipped && inCategory.length > 0) {
    this.currentCongratsCategory = this.conseilCatFilter;
    this.showCongrats = true;
    if (this.congratsTimeout) clearTimeout(this.congratsTimeout);
    this.congratsTimeout = setTimeout(() => {
      this.showCongrats = false;
    }, 5000);
  }
}

//gestion des trie de affichage ahck et event
getItemTimeStatus(item: { startDate?: string; endDate?: string }): 'EN_COURS' | 'PREVU' | 'TERMINE' {
  const now = new Date();
  const start = item.startDate ? new Date(item.startDate) : null;
  const end = item.endDate ? new Date(item.endDate) : null;
  
  // ✅ Forcer la fin de journée pour endDate
  if (end) end.setHours(23, 59, 59, 999);

  if (!start) return 'PREVU';
  if (now < start) return 'PREVU';
  if (end && now > end) return 'TERMINE';
  return 'EN_COURS';
}

getTimeStatusLabel(status: string): string {
  const map: Record<string, string> = {
    EN_COURS: 'En cours', PREVU: 'Prévu', TERMINE: 'Terminé'
  };
  return map[status] ?? status;
}

getTimeStatusColor(status: string): string {
  return status === 'EN_COURS' ? '#22c55e'
       : status === 'PREVU'    ? '#3b82f6'
       : '#9ca3af';
}

getTimeStatusBg(status: string): string {
  return status === 'EN_COURS' ? 'rgba(34,197,94,0.1)'
       : status === 'PREVU'    ? 'rgba(59,130,246,0.1)'
       : 'rgba(156,163,175,0.08)';
}

setTimeFilter(f: 'ALL' | 'EN_COURS' | 'PREVU' | 'TERMINE'): void {
  this.currentTimeFilter = f;
}

get eventsCountByTime(): Record<string, number> {
  const all = this.events.filter(e => e.status === 'APPROVED');
  return {
    EN_COURS: all.filter(e => this.getItemTimeStatus(e) === 'EN_COURS').length,
    PREVU:    all.filter(e => this.getItemTimeStatus(e) === 'PREVU').length,
    TERMINE:  all.filter(e => this.getItemTimeStatus(e) === 'TERMINE').length,
  };
}

get hackathonsCountByTime(): Record<string, number> {
  const all = this.hackathons.filter(h => h.status === 'APPROVED');
  return {
    EN_COURS: all.filter(h => this.getItemTimeStatus(h) === 'EN_COURS').length,
    PREVU:    all.filter(h => this.getItemTimeStatus(h) === 'PREVU').length,
    TERMINE:  all.filter(h => this.getItemTimeStatus(h) === 'TERMINE').length,
  };
}

get upcomingOverviewEvents(): Evenement[] {
  return this.events
    .filter(e => e.status === 'APPROVED' && this.getItemTimeStatus(e) !== 'TERMINE')
    .slice(0, 3);
}
myEventForms: any[] = [];

// Dans ngOnInit, après loadEvents(), charger les formulaires du user
// OU utiliser les matchings comme proxy (chaque matching = 1 inscription à un event)
get myEventRegistrations(): any[] {
  // Proxy : événements distincts ayant au moins un matching
  const eventIds = new Set(
    this.matchings.map(m => m.event?.id).filter(Boolean)
  );
  return Array.from(eventIds);
}




// ─── REMPLACER les variables War Room existantes ───

// War Rooms multiples (une par hackathon)
myWarRooms: Map<number, WarRoom> = new Map(); // key = registrationId
activeWarRoomRegId: number | null = null;     // celle affichée
receivedInvitations: WarRoom[] = [];          // invitations d'amis

get myWarRoom(): WarRoom | null {
  if (!this.activeWarRoomRegId) return null;
  return this.myWarRooms.get(this.activeWarRoomRegId) ?? null;
}

// Alert fermeture War Room
get warRoomClosingAlert(): boolean {
  if (!this.activeWarRoomRegId) return false;

  let endDate: string | undefined;

  if (this.activeWarRoomRegId < 0) {
    const room = this.myWarRooms.get(this.activeWarRoomRegId);
    const reg = this.myRegistrations.find(r =>
      Math.abs(this.activeWarRoomRegId!) === (room?.id as number)
    );
    endDate = reg?.hackathon?.endDate;
  } else {
    endDate = this.myRegistrations.find(r => r.id === this.activeWarRoomRegId)?.hackathon?.endDate;
  }

  if (!endDate) return false;
  const end = new Date(endDate);
  const closeDate = new Date(end.getTime() + 24 * 3600 * 1000);
  const now = new Date();
  return now > end && now < closeDate;
}

get warRoomClosed(): boolean {
  if (!this.activeWarRoomRegId) return false;

  // War Room invitée (clé négative) → chercher via la Map
  if (this.activeWarRoomRegId < 0) {
    const room = this.myWarRooms.get(this.activeWarRoomRegId);
    if (!room?.id) return false;
    // Chercher une registration dont la warRoom.id correspond
    const reg = this.myRegistrations.find(r =>
      Math.abs(this.activeWarRoomRegId!) === (room.id as number)
    );
    // Pas de registration trouvée → on ne peut pas savoir → false
    if (!reg?.hackathon?.endDate) return false;
    const closeDate = new Date(new Date(reg.hackathon.endDate).getTime() + 24 * 3600 * 1000);
    return new Date() > closeDate;
  }

  // War Room propre
  const hack = this.myRegistrations.find(r => r.id === this.activeWarRoomRegId)?.hackathon;
  if (!hack?.endDate) return false;
  const closeDate = new Date(new Date(hack.endDate).getTime() + 24 * 3600 * 1000);
  return new Date() > closeDate;
}

get warRoomCloseDate(): string {
  let endDate: string | undefined;

  if (this.activeWarRoomRegId !== null && this.activeWarRoomRegId < 0) {
    const room = this.myWarRooms.get(this.activeWarRoomRegId);
    const reg = this.myRegistrations.find(r =>
      Math.abs(this.activeWarRoomRegId!) === (room?.id as number)
    );
    endDate = reg?.hackathon?.endDate;
  } else {
    endDate = this.myRegistrations.find(r => r.id === this.activeWarRoomRegId)?.hackathon?.endDate;
  }

  if (!endDate) return '';
  const d = new Date(new Date(endDate).getTime() + 24 * 3600 * 1000);
  const months = ['jan','fév','mar','avr','mai','jun',
                  'jul','aoû','sep','oct','nov','déc'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} 
          à ${d.getHours().toString().padStart(2,'0')}h${d.getMinutes().toString().padStart(2,'0')}`;
}

// ─── REMPLACER loadOrCreateWarRoom() ───

loadAllWarRooms(): void {
  if (this.myRegistrations.length === 0) {
    // Même sans inscriptions, charger les invitations
    this.loadReceivedInvitations();
    return;
  }

  let loadedCount = 0;
  const total = this.myRegistrations.length;

  this.myRegistrations.forEach(reg => {
    if (!reg.id) { loadedCount++; return; }

    this.warRoomService.getWarRoom(reg.id).subscribe({
      next: (room: WarRoom) => {
        this.myWarRooms.set(reg.id!, room);
        if (!this.activeWarRoomRegId) {
          this.activeWarRoomRegId = reg.id!;
          this.loadTasks();
          this.startKanbanPolling();
        }
        loadedCount++;
        // ✅ Attendre que TOUTES les War Rooms soient chargées
        if (loadedCount === total) {
          this.loadReceivedInvitations();
        }
      },
      error: () => {
        this.warRoomService.createWarRoom(reg.id!).subscribe({
          next: (room: WarRoom) => {
            this.myWarRooms.set(reg.id!, room);
            if (!this.activeWarRoomRegId) {
              this.activeWarRoomRegId = reg.id!;
              this.loadTasks();
              this.startKanbanPolling();
            }
          },
          error: () => {}
        });
        loadedCount++;
        if (loadedCount === total) {
          this.loadReceivedInvitations();
        }
      }
    });
  });
}
loadReceivedInvitations(): void {
  if (!this.currentUserEmail || !this.currentUserEmail.includes('@')) {
    console.warn('Email invalide:', this.currentUserEmail);
    return;
  }

  console.log('📧 Chargement invitations pour:', this.currentUserEmail);

  this.warRoomService.getAcceptedInvitations(this.currentUserEmail).subscribe({
    next: (invitations: any[]) => {
      console.log('✅ Invitations acceptées reçues:', invitations);  // ← VOIR ICI
      
      invitations.forEach(inv => {
        console.log('🔍 inv:', inv);           // structure de chaque invitation
        console.log('🔍 inv.warRoom:', inv.warRoom); // est-ce que warRoom existe ?
        
        const room: WarRoom = inv.warRoom;
        if (!room?.id) {
          console.warn('❌ Pas de warRoom dans:', inv);
          return;
        }

        const invKey = -(room.id as number);
        const myRoomIds = new Set(
          Array.from(this.myWarRooms.values())
            .filter(r => r.id !== undefined && (r.id as number) > 0)
            .map(r => r.id as number)
        );

        console.log('🗝️ invKey:', invKey, '| myRoomIds:', Array.from(myRoomIds));

        if (!myRoomIds.has(room.id as number)) {
          this.myWarRooms.set(invKey, room);
          console.log('✅ War Room invitée ajoutée:', room.name);
        }
      });

      console.log('🗺️ myWarRooms finale:', Array.from(this.myWarRooms.entries()));

      // Invitations non encore acceptées
      this.warRoomService.getInvitations(this.currentUserEmail).subscribe({
        next: (rooms: WarRoom[]) => {
          console.log('📬 Invitations pending:', rooms);
          const allMyRoomIds = new Set(
            Array.from(this.myWarRooms.values())
              .filter(r => r.id !== undefined)
              .map(r => r.id as number)
          );
          this.receivedInvitations = rooms.filter(r =>
            r.id !== undefined && !allMyRoomIds.has(r.id as number)
          );
        },
        error: () => {}
      });
    },
    error: (err) => {
      console.error('❌ Erreur getAcceptedInvitations:', err);  // ← voir l'erreur HTTP
      
      this.warRoomService.getInvitations(this.currentUserEmail).subscribe({
        next: (rooms: WarRoom[]) => {
          const allMyRoomIds = new Set(
            Array.from(this.myWarRooms.values())
              .filter(r => r.id !== undefined)
              .map(r => r.id as number)
          );
          this.receivedInvitations = rooms.filter(r =>
            r.id !== undefined && !allMyRoomIds.has(r.id as number)
          );
        },
        error: () => {}
      });
    }
  });
}

joinInvitedWarRoom(room: WarRoom): void {
  if (this.kanbanPollingInterval) {
    clearInterval(this.kanbanPollingInterval);
    this.kanbanPollingInterval = null;
  }
  
  this.myWarRooms.set(-room.id!, room);
  this.activeWarRoomRegId = -room.id!;
  this.warRoomTasks = [];
  this.loadTasks();
  
  // ✅ Démarrer le polling avec l'ID de la room invitée
  setTimeout(() => this.startKanbanPolling(), 300);
  
  this.navigate('warroom');
}
// ─── REMPLACER loadTasks() ───
loadTasks(): void {
  const room = this.myWarRoom;
  if (!room?.id) return;
  const warRoomId = Math.abs(room.id as number); // ✅ toujours positif
  this.warRoomService.getTasks(warRoomId).subscribe({
    next: (tasks: WarRoomTask[]) => { this.warRoomTasks = tasks; },
    error: () => {}
  });
}

// ─── EXPORT SPRINT PDF ───
exportSprintPdf(): void {
  const room = this.myWarRoom;
  if (!room) return;

  const done  = this.getTasksByStatus('DONE');
  const doing = this.getTasksByStatus('DOING');
  const todo  = this.getTasksByStatus('TODO');

  const hackTitle = this.myRegistrations.find(
    r => r.id === this.activeWarRoomRegId
  )?.hackathon?.title ?? 'Hackathon';

  const lines: string[] = [
    `RAPPORT SPRINT — ${room.name}`,
    `Hackathon : ${hackTitle}`,
    `Exporté le : ${new Date().toLocaleDateString('fr-FR')}`,
    ``,
    `═══ TERMINÉ (${done.length}) ═══`,
    ...done.map(t => `  ✓ ${t.title}${t.description ? ' — ' + t.description : ''}`),
    ``,
    `═══ EN COURS (${doing.length}) ═══`,
    ...doing.map(t => `  ◎ ${t.title}${t.description ? ' — ' + t.description : ''}`),
    ``,
    `═══ À FAIRE (${todo.length}) ═══`,
    ...todo.map(t => `  ○ ${t.title}${t.description ? ' — ' + t.description : ''}`),
    ``,
    `STATS`,
    `Total : ${this.warRoomTasks.length} tâches`,
    `Complétées : ${done.length} / ${this.warRoomTasks.length}`,
    `Taux : ${this.warRoomTasks.length > 0
      ? Math.round((done.length / this.warRoomTasks.length) * 100)
      : 0}%`
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sprint-${room.name?.replace(/\s+/g, '-') ?? 'warroom'}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  this.showToast('Sprint exporté avec succès 📄', 'success');
}

// ─── WHITEBOARD : charger depuis le backend ───

// Données Excalidraw brutes (JSON string) par warRoomId
excalidrawDataByRoom: Map<number, string> = new Map();

// Appelé quand on clique sur l'onglet Whiteboard





// ═══ WHITEBOARD ═══
excalidrawLoading    = false;
showExcalidrawIframe = false;
excalidrawUrl: SafeResourceUrl = '';
private whiteboardCache: Map<number, string> = new Map();
private wbSaveHandler: ((e: MessageEvent) => void) | null = null;

initWhiteboardForCurrent(): void {
  const room = this.myWarRoom;
  if (!room?.id) return;

  const warRoomId = room.id;
  console.log('🖌️ Whiteboard pour War Room:', warRoomId, room.name);

  this.showExcalidrawIframe = false;
  this.excalidrawUrl = '';
  this.excalidrawLoading = true;
  this.lastWhiteboardData = '';

  // Nettoyer ancien handler
  if (this.wbSaveHandler) {
    window.removeEventListener('message', this.wbSaveHandler);
    this.wbSaveHandler = null;
  }
  if (this.whiteboardPollingInterval) {
    clearInterval(this.whiteboardPollingInterval);
    this.whiteboardPollingInterval = null;
  }

  let saveTimeout: any = null;
  let iframeReady = false;
  let pendingDataUrl: string | null = null;

  this.wbSaveHandler = (e: MessageEvent) => {
    if (!e.data?.type) return;

    if (e.data.type === 'WB_READY') {
      iframeReady = true;
      // ✅ Injecter les données si déjà chargées
      if (pendingDataUrl) {
        const iframe = document.getElementById('excalidraw-iframe') as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage({ type: 'WB_LOAD', dataUrl: pendingDataUrl }, '*');
        pendingDataUrl = null;
      }
      // ✅ Démarrer le polling temps réel
      this.startWhiteboardPolling(warRoomId);
      return;
    }

    if (e.data.type === 'WB_SAVE') {
      const dataUrl = e.data.dataUrl;
      if (!dataUrl?.startsWith('data:image/png') || dataUrl.length < 5000) return;
      
      this.lastWhiteboardData = dataUrl;
      this.lastUserDrawTime = Date.now();
      
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.warRoomService.saveWhiteboard(warRoomId, dataUrl).subscribe({
          next: () => console.log('💾 Auto-save War Room', warRoomId),
          error: () => {}
        });
      }, 1500);
    }
  };

  window.addEventListener('message', this.wbSaveHandler);

  // Charger données existantes PUIS afficher iframe
  this.warRoomService.getWhiteboard(warRoomId).subscribe({
    next: (res: any) => {
      const data = res?.boardData;
      const isValid = data && data !== '{}' && data.startsWith('data:image/png') && data.length > 1000;
      
      this.excalidrawLoading = false;
      this.excalidrawUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/whiteboard.html');

      setTimeout(() => {
        this.showExcalidrawIframe = true;
        if (isValid) {
          if (iframeReady) {
            const iframe = document.getElementById('excalidraw-iframe') as HTMLIFrameElement;
            iframe?.contentWindow?.postMessage({ type: 'WB_LOAD', dataUrl: data }, '*');
          } else {
            pendingDataUrl = data; // sera injecté au WB_READY
          }
        }
      }, 150);
    },
    error: () => {
      this.excalidrawLoading = false;
      this.excalidrawUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/whiteboard.html');
      setTimeout(() => { this.showExcalidrawIframe = true; }, 150);
    }
  });
}


private lastWhiteboardData: string = '';
private lastUserDrawTime = 0;

startWhiteboardPolling(warRoomId: number): void {
  if (this.whiteboardPollingInterval) clearInterval(this.whiteboardPollingInterval);

  this.whiteboardPollingInterval = setInterval(() => {
    if (this.activePage !== 'warroom' || this.warRoomTab !== 'whiteboard') return;

    // ✅ Ne pas écraser si l'utilisateur est en train de dessiner
    const timeSinceLastDraw = Date.now() - this.lastUserDrawTime;
    if (this.lastUserDrawTime > 0 && timeSinceLastDraw < 4000) return;

    this.warRoomService.getWhiteboard(warRoomId).subscribe({
      next: (res: any) => {
        const newData = res?.boardData;
        if (!newData || newData === '{}' || !newData.startsWith('data:image/png') || newData.length < 1000) return;
        if (newData === this.lastWhiteboardData) return; // ✅ Pas de changement

        console.log('🔄 Mise à jour whiteboard depuis autre utilisateur');
        this.lastWhiteboardData = newData;

        const iframe = document.getElementById('excalidraw-iframe') as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage({ type: 'WB_LOAD', dataUrl: newData }, '*');
      },
      error: () => {}
    });
  }, 2000); // ✅ toutes les 2 secondes
}
// ✅ Nouvelle méthode : attendre que l'iframe soit prête
private injectWhenReady(dataUrl: string): void {
  let injected = false;

  // ✅ Méthode 1 : écouter WB_READY (l'iframe signale qu'elle est prête)
  const readyHandler = (e: MessageEvent) => {
    if (e.data?.type !== 'WB_READY' || injected) return;
    window.removeEventListener('message', readyHandler);
    injected = true;

    const iframe = document.getElementById('excalidraw-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      // ✅ Petit délai après WB_READY pour que le canvas soit vraiment initialisé
      setTimeout(() => {
        iframe.contentWindow!.postMessage({ type: 'WB_LOAD', dataUrl }, '*');
        console.log('✅ Dessin injecté après WB_READY');
      }, 200);
    }
  };
  window.addEventListener('message', readyHandler);

  // ✅ Méthode 2 : fallback si WB_READY n'arrive pas dans 5s
  setTimeout(() => {
    if (injected) return;
    window.removeEventListener('message', readyHandler);

    const iframe = document.getElementById('excalidraw-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'WB_LOAD', dataUrl }, '*');
      console.log('✅ Dessin injecté (fallback 5s)');
    }
  }, 5000);
}
saveWhiteboard(): void {
  const room = this.myWarRoom;
  if (!room?.id) return;
  const warRoomId = room.id;

  const iframe = document.getElementById('excalidraw-iframe') as HTMLIFrameElement;
  iframe?.contentWindow?.postMessage({ type: 'WB_GET' }, '*');

  const handler = (e: MessageEvent) => {
    if (e.data?.type !== 'WB_SAVE') return;
    window.removeEventListener('message', handler);
    const dataUrl = e.data.dataUrl;
    this.warRoomService.saveWhiteboard(warRoomId, dataUrl).subscribe({
      next: () => this.showToast('✅ Whiteboard sauvegardé !', 'success'),
      error: () => this.showToast('Erreur sauvegarde', 'error')
    });
  };
  window.addEventListener('message', handler);
  setTimeout(() => window.removeEventListener('message', handler), 3000);
}

selectWarRoom(regId: number): void {
  if (this.warRoomTab === 'whiteboard' && this.showExcalidrawIframe) {
    const iframe = document.getElementById('excalidraw-iframe') as HTMLIFrameElement;
    iframe?.contentWindow?.postMessage({ type: 'WB_GET' }, '*');
  }

  if (this.whiteboardPollingInterval) {
    clearInterval(this.whiteboardPollingInterval);
    this.whiteboardPollingInterval = null;
  }
  if (this.kanbanPollingInterval) {
    clearInterval(this.kanbanPollingInterval); // ✅ arrêter l'ancien polling
    this.kanbanPollingInterval = null;
  }

  this.lastWhiteboardData = '';
  this.activeWarRoomRegId = regId;
  this.warRoomTasks = [];
  this.showExcalidrawIframe = false;
  this.excalidrawUrl = '';
  
  // ✅ Charger les tâches puis redémarrer le polling avec le nouvel ID
  this.loadTasks();
  setTimeout(() => this.startKanbanPolling(), 500); // délai pour que myWarRoom soit à jour

  if (this.warRoomTab === 'whiteboard') {
    setTimeout(() => this.initWhiteboardForCurrent(), 300);
  }
}

showLogoutConfirm = false;


logout(): void {
  this.showLogoutConfirm = false;
  localStorage.removeItem('token');
  this.router.navigate(['/signin']);
}




}