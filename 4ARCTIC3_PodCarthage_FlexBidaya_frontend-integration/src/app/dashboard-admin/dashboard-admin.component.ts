import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Evenement } from '../models/evenement';
import { Hackathon } from '../models/hackathon';
import { Conseils } from '../models/conseils';
import { EventService } from '../services/event.service';
import { HackathonService } from '../services/hackathon.service';
import { ConseilsService } from '../services/conseils.service';
import { get } from 'http';
import { OrganisateurStat } from '../models/organisateur';
import { FieldDiff, PendingUpdate } from '../models/pending-update';
import { PendingUpdateService } from '../services/pending-update.service';
import { OrganisateurService } from '../services/organisateur.service';
import { Chart } from 'chart.js';
import { Router } from '@angular/router';

export interface Toast { msg: string; type: 'success' | 'error'; }

// Minimal user/participant shape — adapt to your own User model
export interface UserStat {
  id: number;
  name: string;
  email: string;
  hackathonId?: number;
  eventId?: number;
}

@Component({
  selector: 'app-dashboard-admin',
  templateUrl: './dashboard-admin.component.html',
  styleUrls: ['./dashboard-admin.component.css']
})
export class DashboardAdminComponent implements OnInit {

  // ─── DATA ───
  events: Evenement[]     = [];
  hackathons: Hackathon[] = [];
  conseils: Conseils[]    = [];

  // Mock participants — replace with real service calls when available
  participants: UserStat[] = [
    { id:1, name:'Yassine Ben Ali',    email:'y@mail.com', hackathonId:1, eventId:1 },
    { id:2, name:'Lina Mourad',        email:'l@mail.com', hackathonId:1, eventId:1 },
    { id:3, name:'Omar Saleh',         email:'o@mail.com', hackathonId:1, eventId:2 },
    { id:4, name:'Fatma Karray',       email:'f@mail.com', hackathonId:2, eventId:1 },
    { id:5, name:'Walid Ferchichi',    email:'w@mail.com', hackathonId:2, eventId:2 },
    { id:6, name:'Amira Trabelsi',     email:'a@mail.com', hackathonId:3, eventId:3 },
    { id:7, name:'Hamza Ben Ali',      email:'h@mail.com', hackathonId:1, eventId:1 },
    { id:8, name:'Ines Oueslati',      email:'i@mail.com', hackathonId:3, eventId:2 },
  ];

  // Mock stands — replace with real service
  stands: { id:number; name:string; hackathonId:number; capacity:number; cat:string }[] = [
    { id:1, name:'Stand IA & Robotique', hackathonId:1, capacity:40, cat:'Technologie' },
    { id:2, name:'Stand Data Science',   hackathonId:1, capacity:30, cat:'Technologie' },
    { id:3, name:'Stand Fintech',        hackathonId:1, capacity:25, cat:'Finance' },
    { id:4, name:'Stand MedTech',        hackathonId:2, capacity:35, cat:'Santé' },
    { id:5, name:'Stand Green',          hackathonId:3, capacity:50, cat:'Environnement' },
  ];

  // ─── STATE ───
currentPage: 'overview' | 'events' | 'hackathons' | 'conseils' | 'versions' | 'startups' = 'overview';

  // Startups
  allStartups: any[] = [];
  startupTab: 'ALL' | 'approved' | 'pending' | 'rejected' = 'ALL';
  get filteredStartups(): any[] {
    if (this.startupTab === 'ALL') return this.allStartups;
    return this.allStartups.filter(s => (s.status || 'pending') === this.startupTab);
  }
  isLoading = false;

  // Tabs
  eventTab:   'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED' = 'ALL';
  hackTab:    'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED' = 'ALL';
  conseilCatFilter = 'ALL';

  // ─── MODAL STATE ───
  showConseilModal  = false;
  showConfirmModal  = false;
  editingConseilId: number | null = null;

  // Event / Hack approval modals
  showStatusModal  = false;
  statusModalType: 'event' | 'hackathon' = 'event';
  statusModalId    = 0;
  statusModalTitle = '';

  // ─── FORM MODELS ───
  conseilForm: Conseils = { title: '', content: '', category: 'CV' };

  // ─── CONFIRM ───
  confirmMsg = '';
  deleteCallback: (() => void) | null = null;

  // ─── TOASTS ───
  toasts: Toast[] = [];

  readonly CATEGORIES = ['CV', 'EVENT', 'HACKATHON', 'STAND', 'NETWORK', 'AUTRE'];

  constructor(
    private eventService: EventService,
    private hackathonService: HackathonService,
    private conseilsService: ConseilsService,
      private pendingUpdateService: PendingUpdateService ,
        private organisateurService: OrganisateurService,
            private router: Router
        
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.loadOrganisateurs();
    this.loadStartupsAdmin();
  }

  loadStartupsAdmin(): void {
    const token = localStorage.getItem('token');
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    // Use HttpClient via a direct import — piggyback on existing http
    fetch('http://localhost:8080/api/startups', { headers })
      .then(r => r.json())
      .then((data: any[]) => {
        this.allStartups = (data || []).map(s => ({
          ...s,
          status: s.stade === 'MVP' ? 'approved' : 'pending'
        }));
      })
      .catch(() => { this.allStartups = []; });
  }

  updateStartupStatusAdmin(id: number, status: 'approved' | 'pending' | 'rejected'): void {
    const s = this.allStartups.find(x => x.id === id);
    if (s) { s.status = status; }
    this.showToast(`Startup ${status === 'approved' ? 'approuvée' : status === 'rejected' ? 'rejetée' : 'mise en attente'}`, 'success');
  }

  deleteStartupAdmin(id: number): void {
    if (!confirm('Supprimer cette startup ?')) return;
    const token = localStorage.getItem('token');
    fetch(`http://localhost:8080/api/startups/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }).then(() => {
      this.allStartups = this.allStartups.filter(s => s.id !== id);
      this.showToast('Startup supprimée', 'success');
    }).catch(() => this.showToast('Erreur suppression', 'error'));
  }

  countStartupsByStatus(status: string): number {
    return this.allStartups.filter(s => (s.status || 'pending') === status).length;
  }

  // ════════════════════════════════
  // LOAD
  // ════════════════════════════════
loadAll(): void {
  this.isLoading = true;
  this._loaded = 0;
  this.eventService.getAll().subscribe({
    next: d => { this.events = d; this.checkDone(); },
    error: () => { this.showToast('Erreur chargement événements', 'error'); this.checkDone(); }
  });
  this.hackathonService.getAll().subscribe({
    next: d => { this.hackathons = d; this.checkDone(); },
    error: () => { this.showToast('Erreur chargement hackathons', 'error'); this.checkDone(); }
  });
  this.conseilsService.getAll().subscribe({
    next: d => { this.conseils = d; this.checkDone(); },
    error: () => { this.showToast('Erreur chargement conseils', 'error'); this.checkDone(); }
  });
}

private _loaded = 0;
checkDone(): void {
  this._loaded++;
  if (this._loaded >= 3) {
    this.isLoading = false;
    this.prepareChartData();
    this.renderAllCharts();
    this.loadPendingUpdates(); 
  }
}
  // ════════════════════════════════
  // COMPUTED — KPIs
  // ════════════════════════════════

  get totalEvents():      number { return this.events.length; }
  get approvedEvents():   number { return this.events.filter(e => e.status === 'APPROVED').length; }
  get pendingEvents():    number { return this.events.filter(e => e.status === 'PENDING').length; }
  get rejectedEvents():   number { return this.events.filter(e => e.status === 'REJECTED').length; }

  get totalHacks():       number { return this.hackathons.length; }
  get approvedHacks():    number { return this.hackathons.filter(h => h.status === 'APPROVED').length; }
  get pendingHacks():     number { return this.hackathons.filter(h => h.status === 'PENDING').length; }
  get rejectedHacks():    number { return this.hackathons.filter(h => h.status === 'REJECTED').length; }

  get totalParticipants(): number { return this.participants.length; }
  get totalStands():       number { return this.stands.length; }
  get totalConseils():     number { return this.conseils.length; }

  get pendingBadge(): number { return this.pendingEvents + this.pendingHacks; }

  // ─── Per-hackathon stats ───
  participantsForHack(hackId: number): number {
    return this.participants.filter(p => p.hackathonId === hackId).length;
  }
  standsForHack(hackId: number): number {
    return this.stands.filter(s => s.hackathonId === hackId).length;
  }

  // ─── Filtered lists ───
  get filteredEvents(): Evenement[] {
    return this.eventTab === 'ALL' ? this.events : this.events.filter(e => e.status === this.eventTab);
  }
  get filteredHacks(): Hackathon[] {
    return this.hackTab === 'ALL' ? this.hackathons : this.hackathons.filter(h => h.status === this.hackTab);
  }
  get filteredConseils(): Conseils[] {
    return this.conseilCatFilter === 'ALL'
      ? this.conseils
      : this.conseils.filter(c => c.category === this.conseilCatFilter);
  }

  // ════════════════════════════════
  // NAVIGATION
  // ════════════════════════════════

 navigate(page: 'overview' | 'events' | 'hackathons' | 'conseils' | 'versions' | 'startups'): void {
  this.currentPage = page;
}

 get topbarTitle(): string {
  const map: Record<string, string> = {
    overview:   'Vue d\'ensemble',
    events:     'Gestion Événements',
    hackathons: 'Gestion Hackathons',
    conseils:   'Gestion Conseils',
    versions:   'Versions & Organisateurs',   
  };
  return map[this.currentPage] || '';
}

  // ════════════════════════════════
  // STATUS APPROVAL (Events & Hackathons)
  // ════════════════════════════════

  openStatusModal(type: 'event' | 'hackathon', id: number): void {
    this.statusModalType  = type;
    this.statusModalId    = id;
    const title = type === 'event'
      ? this.events.find(e => e.id === id)?.title
      : this.hackathons.find(h => h.id === id)?.title;
    this.statusModalTitle = title || '';
    this.showStatusModal  = true;
  }

  applyStatus(newStatus: string): void {
    if (this.statusModalType === 'event') {
      const ev = this.events.find(e => e.id === this.statusModalId);
      if (!ev) return;
      const payload = { ...ev, status: newStatus };
      this.eventService.update(this.statusModalId, payload as Evenement).subscribe({
        next: () => { ev.status = newStatus; this.showToast(`Événement ${this.statusLabel(newStatus)}`, 'success'); },
        error: () => this.showToast('Erreur lors de la mise à jour', 'error')
      });
    } else {
      const h = this.hackathons.find(hk => hk.id === this.statusModalId);
      if (!h) return;
      const payload = { ...h, status: newStatus };
      this.hackathonService.update(this.statusModalId, payload as Hackathon).subscribe({
        next: () => { h.status = newStatus; this.showToast(`Hackathon ${this.statusLabel(newStatus)}`, 'success'); },
        error: () => this.showToast('Erreur lors de la mise à jour', 'error')
      });
    }
    this.showStatusModal = false;
  }

  statusLabel(s: string): string {
    return { APPROVED:'approuvé ✓', PENDING:'mis en attente ⏳', REJECTED:'rejeté ✕' }[s] || s;
  }

  // ════════════════════════════════
  // CONSEILS CRUD
  // ════════════════════════════════

  openConseilModal(id: number | null = null): void {
    this.editingConseilId = id;
    if (id) {
      const c = this.conseils.find(c => c.id === id);
      if (c) this.conseilForm = { title: c.title, content: c.content, category: c.category };
    } else {
      this.conseilForm = { title: '', content: '', category: 'CV' };
    }
    this.showConseilModal = true;
  }

  closeConseilModal(): void { this.showConseilModal = false; }

  saveConseil(): void {
    const { title, content, category } = this.conseilForm;
    if (!title.trim() || !content.trim()) {
      this.showToast('Veuillez remplir tous les champs obligatoires', 'error'); return;
    }
    const payload: Conseils = { title: title.trim(), content: content.trim(), category };

    if (this.editingConseilId) {
      this.conseilsService.update(this.editingConseilId, payload).subscribe({
        next: (updated) => {
          const idx = this.conseils.findIndex(c => c.id === this.editingConseilId);
          if (idx !== -1) this.conseils[idx] = updated;
          this.showToast('Conseil modifié avec succès', 'success');
          this.showConseilModal = false;
        },
        error: () => this.showToast('Erreur lors de la modification', 'error')
      });
    } else {
      this.conseilsService.create(payload).subscribe({
        next: (created) => {
          this.conseils.push(created);
          this.showToast('Conseil ajouté avec succès', 'success');
          this.showConseilModal = false;
        },
        error: () => this.showToast('Erreur lors de la création', 'error')
      });
    }
  }

  confirmDeleteConseil(id: number): void {
    this.confirmMsg = 'Êtes-vous sûr de vouloir supprimer ce conseil ? Cette action est irréversible.';
    this.deleteCallback = () => {
      this.conseilsService.delete(id).subscribe({
        next: () => {
          this.conseils = this.conseils.filter(c => c.id !== id);
          this.showToast('Conseil supprimé', 'success');
        },
        error: () => this.showToast('Erreur lors de la suppression', 'error')
      });
      this.showConfirmModal = false;
    };
    this.showConfirmModal = true;
  }

  confirmOk(): void { if (this.deleteCallback) this.deleteCallback(); }

  // ════════════════════════════════
  // HELPERS
  // ════════════════════════════════

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      APPROVED: 'badge-approved', PENDING: 'badge-pending', REJECTED: 'badge-rejected'
    };
    return 'badge ' + (map[status] || 'badge-pending');
  }

  statusBadgeLabel(status: string): string {
    return { APPROVED:'Approuvé', PENDING:'En attente', REJECTED:'Rejeté' }[status] || status;
  }

  catIcon(cat: string): string {
    return {
      CV:'fa-file-alt', EVENT:'fa-calendar-star', HACKATHON:'fa-code',
      STAND:'fa-store', NETWORK:'fa-handshake', AUTRE:'fa-lightbulb'
    }[cat] || 'fa-lightbulb';
  }

  catColor(cat: string): string {
    return {
      CV:'#3b82f6', EVENT:'#8b5cf6', HACKATHON:'#10b981',
      STAND:'#f59e0b', NETWORK:'#ec4899', AUTRE:'#6b7280'
    }[cat] || '#6b7280';
  }

  domainGradient(domain: string): string {
    const map: Record<string, string> = {
      'IA':'linear-gradient(135deg,#1e3a8a,#8b5cf6)',
      'Web':'linear-gradient(135deg,#0f766e,#3b82f6)',
      'Mobile':'linear-gradient(135deg,#6d28d9,#ec4899)',
      'Data':'linear-gradient(135deg,#0f766e,#8b5cf6)',
      'Green':'linear-gradient(135deg,#064e3b,#10b981)',
      'FinTech':'linear-gradient(135deg,#1e3a8a,#f59e0b)',
    };
    for (const key of Object.keys(map)) {
      if (domain?.toLowerCase().includes(key.toLowerCase())) return map[key];
    }
    return 'linear-gradient(135deg,#1e3a8a,#8b5cf6)';
  }

  formatDate(d: string): string {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  // ─── TOAST ───
  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toasts.push({ msg, type });
    setTimeout(() => this.toasts.shift(), 3200);
  }







  //version event et h

// ─── Dans la classe ───
pendingUpdates: PendingUpdate[] = [];
organisateurs: OrganisateurStat[] = [];

// Onglet actif dans la vue "versions"
updatesTab: 'versions' | 'organisateurs' = 'versions';



loadPendingUpdates(): void {
  this.pendingUpdateService.getAll().subscribe({
    next: (data) => {
      this.pendingUpdates = data.map(pu => ({
        id: pu.id,
        entityType: pu.entityType,                                          // ← garder 'EVENT'/'HACKATHON' tel quel
        entityId: pu.entityId,
        entityTitle: this.getTitleById(pu.entityType, pu.entityId),
        organisateurName: pu.organisateurName,
        modifiedAt: pu.modifiedAt,
        pendingJson: pu.pendingJson,                                        // ← ajouter ce champ
        diffs: this.computeDiffsFromJson(pu.entityType, pu.entityId, pu.pendingJson)
      }));
    }
  });
}

computeDiffs(current: any, pending: any): FieldDiff[] {
  const fields = [
    { key: 'title',       label: 'Titre' },
    { key: 'description', label: 'Description' },
    { key: 'location',    label: 'Lieu' },
    { key: 'startDate',   label: 'Date début' },
    { key: 'endDate',     label: 'Date fin' },
    { key: 'domain',      label: 'Domaine' },    // hackathon only
  ];
  return fields
    .filter(f => current[f.key] !== undefined || pending[f.key] !== undefined)
    .map(f => ({
      key: f.key,
      label: f.label,
      oldValue: this.formatFieldValue(current[f.key]),
      newValue: this.formatFieldValue(pending[f.key]),
      changed: current[f.key] !== pending[f.key]
    }));
}

formatFieldValue(val: any): string {
  if (!val) return '—';
  // Si c'est une date ISO
  if (typeof val === 'string' && val.includes('T')) return this.formatDate(val);
  return String(val);
}

// REMPLACER cette méthode — supprimer les données statiques
loadOrganisateurs(): void {
  this.organisateurService.getAll().subscribe({
    next: (data) => {
      this.organisateurs = data;
    },
    error: () => this.showToast('Erreur chargement organisateurs', 'error')
  });
}

// Remplacez aussi approveUpdate / rejectUpdate :
approveUpdate(update: PendingUpdate): void {
  this.pendingUpdateService.approve(update.id).subscribe({
    next: () => {
      this.pendingUpdates = this.pendingUpdates.filter(u => u !== update);
      this.loadAll();  // Recharger les données à jour
      this.showToast('Mise à jour approuvée ✓', 'success');
    },
    error: () => this.showToast('Erreur lors de l\'approbation', 'error')
  });
}
rejectUpdate(update: PendingUpdate): void {
  this.pendingUpdateService.reject(update.id).subscribe({
    next: () => {
      this.pendingUpdates = this.pendingUpdates.filter(u => u !== update);
      this.showToast('Mise à jour rejetée', 'success');
    }
  });
}

// ─── Confiance organisateurs ───
toggleTrust(org: OrganisateurStat): void {
  this.organisateurService.toggleTrust(org.id).subscribe({
    next: (updated) => {
      org.trusted = updated.trusted;
      const msg = org.trusted
        ? `${org.username} peut désormais publier directement ✓`
        : `Validation requise à nouveau pour ${org.username}`;
      this.showToast(msg, 'success');
    },
    error: () => this.showToast('Erreur lors de la mise à jour', 'error')
  });
}

getInitialsFromName(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

get pendingUpdatesCount(): number { return this.pendingUpdates.length; }
// Remplace getTitleById(type, id) — cherche le titre dans les listes déjà chargées
getTitleById(entityType: 'EVENT' | 'HACKATHON', entityId: number): string {
  if (entityType === 'EVENT') {
    return this.events.find(e => e.id === entityId)?.title ?? `Événement #${entityId}`;
  }
  return this.hackathons.find(h => h.id === entityId)?.title ?? `Hackathon #${entityId}`;
}

// Remplace computeDiffsFromJson — parse le JSON et compare avec l'entité courante
computeDiffsFromJson(
  entityType: 'EVENT' | 'HACKATHON',
  entityId: number,
  pendingJson: string
): FieldDiff[] {
  try {
    const pending = JSON.parse(pendingJson);
    const current = entityType === 'EVENT'
      ? this.events.find(e => Number(e.id) === Number(entityId))
      : this.hackathons.find(h => Number(h.id) === Number(entityId));

    if (!current) {
      // Afficher quand même les nouvelles valeurs même sans l'ancienne version
      const fields = [
        { key: 'title',       label: 'Titre' },
        { key: 'description', label: 'Description' },
        { key: 'location',    label: 'Lieu' },
        { key: 'startDate',   label: 'Date début' },
        { key: 'endDate',     label: 'Date fin' },
        { key: 'domain',      label: 'Domaine' },
      ];
      return fields
        .filter(f => pending[f.key] !== undefined)
        .map(f => ({
          key:      f.key,
          label:    f.label,
          oldValue: '—',
          newValue: this.formatFieldValue(pending[f.key]),
          changed:  true
        }));
    }

    return this.computeDiffs(current, pending);
  } catch (e) {
    console.error('Erreur computeDiffsFromJson:', e);
    return [];
  }
}




  // ─── Références aux canvas ───
  @ViewChild('evolutionChart') evolutionChartRef!: ElementRef;
  @ViewChild('statusDonutEvent') statusDonutEventRef!: ElementRef;
  @ViewChild('statusDonutHack') statusDonutHackRef!: ElementRef;
  @ViewChild('topHackChart') topHackChartRef!: ElementRef;
  @ViewChild('domainChart') domainChartRef!: ElementRef;
  @ViewChild('approvalTrendChart') approvalTrendChartRef!: ElementRef;

  @ViewChild('regionEventChart') regionEventChartRef!: ElementRef;
@ViewChild('regionHackChart') regionHackChartRef!: ElementRef;
@ViewChild('regionParticipantsChart') regionParticipantsChartRef!: ElementRef;

  // ─── Graphiques ───
  evolutionChart: Chart | null = null;
  statusDonutEvent: Chart | null = null;
  statusDonutHack: Chart | null = null;
  topHackChart: Chart | null = null;
  domainChart: Chart | null = null;
  approvalTrendChart: Chart | null = null;

  // ─── Données pour les graphiques ───
  monthlyStats: { month: string; events: number; hacks: number }[] = [];
  topHackathons: { name: string; participants: number }[] = [];
  domainStats: { domain: string; count: number }[] = [];
  approvalHistory: { month: string; rate: number }[] = [];


  // ─── Nouveaux graphiques ───
regionEventChart: Chart | null = null;
regionHackChart: Chart | null = null;
regionParticipantsChart: Chart | null = null;

// ─── Données géographiques ───
regionEventCounts: { region: string; count: number }[] = [];
regionHackCounts: { region: string; count: number }[] = [];
regionParticipantCounts: { region: string; count: number }[] = [];
  // ... (code existant)

  ngAfterViewInit(): void {
    // Attendre que les données soient chargées
    setTimeout(() => {
      this.prepareChartData();
      this.renderAllCharts();
    }, 500);
  }

  // ──────────────────────────────────────────
  // Préparation des données pour les graphiques
  // ──────────────────────────────────────────
prepareChartData(): void {
  this.computeMonthlyEvolution();
  this.computeTopHackathons();
  this.computeDomainStats();
  this.computeApprovalTrend();
  this.computeRegionStats();  
}

  computeMonthlyEvolution(): void {
    const monthMap = new Map<string, { events: number; hacks: number }>();
    
    // Événements (basé sur startDate)
    this.events.forEach(ev => {
      if (!ev.startDate) return;
      const date = new Date(ev.startDate);
      const key = `${date.getFullYear()}-${date.getMonth()+1}`;
      const label = date.toLocaleString('fr', { month: 'short', year: 'numeric' });
      if (!monthMap.has(key)) monthMap.set(key, { events: 0, hacks: 0 });
      monthMap.get(key)!.events++;
    });
    
    // Hackathons
    this.hackathons.forEach(h => {
      if (!h.startDate) return;
      const date = new Date(h.startDate);
      const key = `${date.getFullYear()}-${date.getMonth()+1}`;
      if (!monthMap.has(key)) monthMap.set(key, { events: 0, hacks: 0 });
      monthMap.get(key)!.hacks++;
    });
    
    const sorted = Array.from(monthMap.entries()).sort((a,b) => a[0].localeCompare(b[0]));
    this.monthlyStats = sorted.map(([key, val]) => ({
      month: new Date(parseInt(key.split('-')[0]), parseInt(key.split('-')[1])-1)
             .toLocaleString('fr', { month: 'short', year: 'numeric' }),
      events: val.events,
      hacks: val.hacks
    }));
  }

  computeTopHackathons(): void {
    this.topHackathons = this.hackathons
      .map(h => ({ name: h.title, participants: this.participantsForHack(h.id!) }))
      .sort((a,b) => b.participants - a.participants)
      .slice(0, 5);
  }

  computeDomainStats(): void {
    const domainCount = new Map<string, number>();
    this.hackathons.forEach(h => {
      const domain = h.domain || 'Autre';
      domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
    });
    this.domainStats = Array.from(domainCount.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a,b) => b.count - a.count);
  }

  computeApprovalTrend(): void {
    // Simule l'évolution du taux d'approbation sur les 6 derniers mois
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
    this.approvalHistory = months.map((month, idx) => ({
      month,
      rate: 60 + Math.random() * 30 // à remplacer par des données réelles si disponibles
    }));
  }

  // ──────────────────────────────────────────
  // Rendu des graphiques
  // ──────────────────────────────────────────
 renderAllCharts(): void {
  this.renderEvolutionChart();
  this.renderStatusDonuts();
  this.renderTopHackChart();
  this.renderDomainChart();
  this.renderApprovalTrendChart();
  this.renderRegionEventChart();        // nouveau
  this.renderRegionHackChart();         // nouveau
  this.renderRegionParticipantsChart(); // nouveau
}

  renderEvolutionChart(): void {
    if (!this.evolutionChartRef?.nativeElement) return;
    if (this.evolutionChart) this.evolutionChart.destroy();
    
    this.evolutionChart = new Chart(this.evolutionChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.monthlyStats.map(s => s.month),
        datasets: [
          {
            label: 'Événements créés',
            data: this.monthlyStats.map(s => s.events),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#1e3a8a'
          },
          {
            label: 'Hackathons créés',
            data: this.monthlyStats.map(s => s.hacks),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.1)',
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#6d28d9'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { tooltip: { mode: 'index', intersect: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Nombre créé' } } }
      }
    });
  }

  renderStatusDonuts(): void {
    // Donut événements
    if (this.statusDonutEventRef?.nativeElement) {
      if (this.statusDonutEvent) this.statusDonutEvent.destroy();
      this.statusDonutEvent = new Chart(this.statusDonutEventRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Approuvés', 'En attente', 'Rejetés'],
          datasets: [{
            data: [this.approvedEvents, this.pendingEvents, this.rejectedEvents],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
    // Donut hackathons
    if (this.statusDonutHackRef?.nativeElement) {
      if (this.statusDonutHack) this.statusDonutHack.destroy();
      this.statusDonutHack = new Chart(this.statusDonutHackRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Approuvés', 'En attente', 'Rejetés'],
          datasets: [{
            data: [this.approvedHacks, this.pendingHacks, this.rejectedHacks],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }

  renderTopHackChart(): void {
    if (!this.topHackChartRef?.nativeElement) return;
    if (this.topHackChart) this.topHackChart.destroy();
    this.topHackChart = new Chart(this.topHackChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: this.topHackathons.map(h => h.name.length > 15 ? h.name.slice(0,12)+'…' : h.name),
        datasets: [{
          label: 'Participants',
          data: this.topHackathons.map(h => h.participants),
          backgroundColor: 'rgba(139,92,246,0.7)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Nombre de participants' } } }
      }
    });
  }

  renderDomainChart(): void {
    if (!this.domainChartRef?.nativeElement) return;
    if (this.domainChart) this.domainChart.destroy();
    this.domainChart = new Chart(this.domainChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: this.domainStats.map(d => d.domain),
        datasets: [{
          label: 'Nombre de hackathons',
          data: this.domainStats.map(d => d.count),
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderRadius: 8
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  renderApprovalTrendChart(): void {
    if (!this.approvalTrendChartRef?.nativeElement) return;
    if (this.approvalTrendChart) this.approvalTrendChart.destroy();
    this.approvalTrendChart = new Chart(this.approvalTrendChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.approvalHistory.map(a => a.month),
        datasets: [{
          label: "Taux d'approbation (%)",
          data: this.approvalHistory.map(a => a.rate),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100, title: { display: true, text: 'Pourcentage (%)' } } }
      }
    });
  }
  ngOnDestroy(): void {
  const charts = [
    this.evolutionChart, this.statusDonutEvent, this.statusDonutHack,
    this.topHackChart, this.domainChart, this.approvalTrendChart,
    this.regionEventChart, this.regionHackChart, this.regionParticipantsChart
  ];
  charts.forEach(chart => chart?.destroy());
}

renderRegionEventChart(): void {
  if (!this.regionEventChartRef?.nativeElement) return;
  if (this.regionEventChart) this.regionEventChart.destroy();
  this.regionEventChart = new Chart(this.regionEventChartRef.nativeElement, {
    type: 'bar',
    data: {
      labels: this.regionEventCounts.map(r => r.region),
      datasets: [{
        label: "Nombre d'événements",
        data: this.regionEventCounts.map(r => r.count),
        backgroundColor: 'rgba(59,130,246,0.7)',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } }
    }
  });
}

renderRegionHackChart(): void {
  if (!this.regionHackChartRef?.nativeElement) return;
  if (this.regionHackChart) this.regionHackChart.destroy();
  this.regionHackChart = new Chart(this.regionHackChartRef.nativeElement, {
    type: 'bar',
    data: {
      labels: this.regionHackCounts.map(r => r.region),
      datasets: [{
        label: "Nombre de hackathons",
        data: this.regionHackCounts.map(r => r.count),
        backgroundColor: 'rgba(139,92,246,0.7)',
        borderRadius: 8
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
//region
renderRegionParticipantsChart(): void {
  if (!this.regionParticipantsChartRef?.nativeElement) return;
  if (this.regionParticipantsChart) this.regionParticipantsChart.destroy();
  this.regionParticipantsChart = new Chart(this.regionParticipantsChartRef.nativeElement, {
    type: 'bar',
    data: {
      labels: this.regionParticipantCounts.map(r => r.region),
      datasets: [{
        label: "Nombre de participants",
        data: this.regionParticipantCounts.map(r => r.count),
        backgroundColor: 'rgba(16,185,129,0.7)',
        borderRadius: 8
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
computeRegionStats(): void {
  const eventRegionMap = new Map<string, number>();
  const hackRegionMap = new Map<string, number>();
  const participantRegionMap = new Map<string, number>();

  // 1. Compter les événements par région
  this.events.forEach(ev => {
    const region = this.extractRegion(ev.location);
    eventRegionMap.set(region, (eventRegionMap.get(region) || 0) + 1);
  });

  // 2. Compter les hackathons par région
  this.hackathons.forEach(h => {
    const region = this.extractRegion(h.location);
    hackRegionMap.set(region, (hackRegionMap.get(region) || 0) + 1);
  });

  // 3. Compter les participants par région (via l'événement ou le hackathon associé)
  // Pour les participants de type événement
  this.participants.forEach(p => {
    let region: string | undefined;
    if (p.eventId) {
      const ev = this.events.find(e => e.id === p.eventId);
      if (ev) region = this.extractRegion(ev.location);
    } else if (p.hackathonId) {
      const hack = this.hackathons.find(h => h.id === p.hackathonId);
      if (hack) region = this.extractRegion(hack.location);
    }
    if (region) {
      participantRegionMap.set(region, (participantRegionMap.get(region) || 0) + 1);
    }
  });

  // Convertir en tableaux triés
  this.regionEventCounts = Array.from(eventRegionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6); // Top 6

  this.regionHackCounts = Array.from(hackRegionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  this.regionParticipantCounts = Array.from(participantRegionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}
/**
 * Extrait la région (ville ou gouvernorat) à partir de la chaîne location.
 * Exemples : "Tunis, Tunisie" -> "Tunis", "Sfax" -> "Sfax", "Ariana" -> "Ariana"
 */
extractRegion(location: string): string {
  if (!location) return 'Non spécifiée';
  // Supprimer la virgule et tout ce qui suit (pays)
  let region = location.split(',')[0].trim();
  // Normalisation : première lettre majuscule
  if (region.length > 0) {
    region = region.charAt(0).toUpperCase() + region.slice(1).toLowerCase();
  }
  // Gérer les cas particuliers (ex: "Tunis" reste "Tunis")
  return region;
}
logout(): void {
  localStorage.removeItem('token');
  this.router.navigate(['/signin']);
}
}

