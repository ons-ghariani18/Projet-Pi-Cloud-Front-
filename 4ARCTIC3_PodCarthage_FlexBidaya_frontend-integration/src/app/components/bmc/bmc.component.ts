import { Component, OnInit } from '@angular/core';
import { BusinessPlanService, BusinessPlanDTO } from '../../services/business-plan.service';
import { StartupService } from '../../services/startup.service';
import { BmcWebSocketService } from '../../services/bmc-websocket.service';
import { AuthService } from '../../services/auth.service';
import { CanvasAiService, CanvasSuggestionsResponse } from '../../services/canvas-ai.service';
import { VersioningService } from '../../services/versioning.service';
import { SwotService, SwotResponse } from '../../services/swot.service';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-bmc',
  templateUrl: './bmc.component.html',
  styleUrls: ['./bmc.component.css']
})
export class BmcComponent implements OnInit {
  startupId: number | null = null;
  allStartups: any[] = [];
  isLoading = false;
  activeTab: 'bmc' | 'suggestions' | 'membres' | 'versioning' = 'bmc';
  currentBmcId: number | null = null;

  // State for Real-time Collaboration (Google Docs style)
  activeBlocks: { [key: string]: { 
    membreNom: string, 
    isTyping: boolean, 
    typingText?: string,
    isPending?: boolean,
    proposalId?: number
  } } = {};

  blocks = [
    { id: 'partners',      title: 'Key Partners',           icon: '🤝', color: '#EEF2FF', textColor: '#4338CA', desc: 'Network of suppliers and partners.',       notes: [] as string[] },
    { id: 'activities',    title: 'Key Activities',          icon: '⚙️', color: '#F0FDF4', textColor: '#15803D', desc: 'Most important actions to take.',           notes: [] as string[] },
    { id: 'resources',     title: 'Key Resources',           icon: '💎', color: '#F0FDF4', textColor: '#15803D', desc: 'Assets required for the model.',            notes: [] as string[] },
    { id: 'propositions',  title: 'Value Propositions',      icon: '🎁', color: '#FFF7ED', textColor: '#C2410C', desc: 'Products and services that create value.',  notes: [] as string[] },
    { id: 'relationships', title: 'Customer Relationships',  icon: '❤️', color: '#FEF2F2', textColor: '#B91C1C', desc: 'Types of relationships with customers.',    notes: [] as string[] },
    { id: 'channels',      title: 'Channels',                icon: '📡', color: '#FEF2F2', textColor: '#B91C1C', desc: 'How we reach our customers.',               notes: [] as string[] },
    { id: 'segments',      title: 'Customer Segments',       icon: '👥', color: '#F5F3FF', textColor: '#6D28D9', desc: 'Who we create value for.',                  notes: [] as string[] },
    { id: 'costs',         title: 'Cost Structure',          icon: '💸', color: '#F8FAFC', textColor: '#475569', desc: 'Costs to operate the business.',            notes: [] as string[] },
    { id: 'revenues',      title: 'Revenue Streams',         icon: '💰', color: '#F8FAFC', textColor: '#475569', desc: 'How the company makes money.',              notes: [] as string[] }
  ];

  // Logic to convert from Backend (French) to Frontend (English ID)
  private readonly FRENCH_TO_BLOCK_ID: { [key: string]: string } = {
    'Partenaires clés':      'partners',
    'Activités clés':        'activities',
    'Ressources clés':       'resources',
    'Proposition de valeur':  'propositions',
    'Relations clients':     'relationships',
    'Canaux':                'channels',
    'Segments clients':      'segments',
    'Structure de coûts':    'costs',
    'Flux de revenus':       'revenues'
  };

  // Logic to convert from Frontend (English ID) to Backend (French)
  private readonly BLOCK_KEY_MAP: { [key: string]: string } = {
    'partners':      'Partenaires clés',
    'activities':    'Activités clés',
    'resources':     'Ressources clés',
    'propositions':  'Proposition de valeur',
    'relationships': 'Relations clients',
    'channels':      'Canaux',
    'segments':      'Segments clients',
    'costs':         'Structure de coûts',
    'revenues':      'Flux de revenus'
  };

  // ── INVITATION STATE ──
  isInviteModalOpen = false;
  inviteForm = { nomPrenom: '', email: '', role: 'Developpeur' };

  // ── MODAL BMC STATE ──
  isModalOpen = false;
  currentBlock: any = null;
  newNoteText = '';
  explodingEmoji: string | null = null;

  // ── AI STATE ──
  aiLoading = false;

  // ── SWOT STATE ──
  isSwotModalOpen = false;
  swotLoading = false;
  swotData: SwotResponse | null = null;
  swotError: string | null = null;

  // ── PROPOSALS STATE ──
  proposals: any[] = [];

  constructor(
    private bmcService: BusinessPlanService,
    private startupService: StartupService,
    private wsService: BmcWebSocketService,
    private authService: AuthService,
    private aiService: CanvasAiService,
    private versioningService: VersioningService,
    private swotService: SwotService
  ) { }

  ngOnInit(): void {
    this.loadAllStartups();
  }

  loadAllStartups() {
    this.startupService.getStartups().subscribe(res => {
      this.allStartups = res;
      if (res.length > 0) {
        this.startupId = res[0].id ?? null;
        this.loadBmc();
        this.setupWebSocket();
      }
    });
  }

  onStartupChange() {
    if (this.startupId) {
      this.loadBmc();
      this.setupWebSocket();
    }
  }

  setupWebSocket() {
    if (!this.startupId) return;
    this.wsService.connect();
    this.wsService.subscribe(this.startupId).subscribe((event: any) => {
      console.log('>>> EVENT WebSocket Reçu:', event);

      const blockId = this.FRENCH_TO_BLOCK_ID[event.blockName] || event.blockName;

      if (event.type === 'TYPING') {
        this.activeBlocks[blockId] = {
          membreNom: event.membreNom,
          isTyping: true,
          typingText: event.typingText
        };

        // Supprime le curseur après 3s d'inactivité
        setTimeout(() => {
          if (this.activeBlocks[blockId]?.isTyping) {
            this.activeBlocks[blockId].isTyping = false;
          }
        }, 3000);
      } 
      
      else if (event.type === 'CURSOR_MOVE') {
        this.activeBlocks[blockId] = {
          membreNom: event.membreNom,
          isTyping: false
        };
      }

      else if (event.type === 'PROPOSAL_SENT') {
        // Affiche la proposition directement dans le bloc (Live Preview)
        this.activeBlocks[blockId] = {
          membreNom: event.membreNom,
          isTyping: false,
          isPending: true,
          typingText: event.typingText,
          proposalId: event.proposalId
        };
        this.loadProposals(); // Sync tab counts
      }
    });
  }

  loadBmc() {
    if (!this.startupId) return;
    this.isLoading = true;
    this.bmcService.getByStartupId(this.startupId).subscribe({
      next: (plans: BusinessPlanDTO[]) => {
        if (plans.length > 0) {
          const dto = plans[0];
          this.currentBmcId = dto.id ?? null;
          this.mapDtoToBlocks(dto);
        }
        this.loadProposals();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadProposals() {
    if (!this.startupId) return;
    this.bmcService.getProposals(this.startupId).subscribe(res => {
      this.proposals = res.filter((p: any) => p.status === 'PENDING');
    });
  }

  private mapDtoToBlocks(dto: BusinessPlanDTO) {
    this.getBlock('partners').notes = this.splitNotes(dto.partenairesCles);
    this.getBlock('activities').notes = this.splitNotes(dto.activitesCles);
    this.getBlock('resources').notes = this.splitNotes(dto.ressourcesCles);
    this.getBlock('propositions').notes = this.splitNotes(dto.propositionValeurs);
    this.getBlock('relationships').notes = this.splitNotes(dto.relationsClients);
    this.getBlock('channels').notes = this.splitNotes(dto.canauxDistribution);
    this.getBlock('segments').notes = this.splitNotes(dto.segmentsClients);
    this.getBlock('costs').notes = this.splitNotes(dto.structuresCouts);
    this.getBlock('revenues').notes = this.splitNotes(dto.fluxRevenus);
  }

  private getBlock(id: string) {
    return this.blocks.find(b => b.id === id)!;
  }

  private splitNotes(text: string): string[] {
    return text ? text.split(';').filter(n => n.trim() !== '') : [];
  }

  getProgress(): number {
    const filled = this.blocks.filter(b => b.notes.length > 0).length;
    return Math.round((filled / this.blocks.length) * 100);
  }

  // ── NOTES MANAGEMENT ──
  openNoteModal(blockId: string) {
    this.currentBlock = this.getBlock(blockId);
    this.newNoteText = '';
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  saveNote() {
    if (this.newNoteText.trim() && this.currentBlock) {
      this.currentBlock.notes.push(this.newNoteText.trim());
      this.triggerEmoji(this.currentBlock.icon);
      this.closeModal();
      this.saveBmc();
    }
  }

  removeNote(blockId: string, index: number) {
    this.getBlock(blockId).notes.splice(index, 1);
    this.saveBmc();
  }

  updateNote(blockId: string, index: number, event: any) {
    const val = event.target.innerText.trim();
    if (val) {
      this.getBlock(blockId).notes[index] = val;
    } else {
      this.removeNote(blockId, index);
    }
  }

  onEnter(event: any) {
    event.target.blur();
  }

  drop(event: CdkDragDrop<string[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    this.saveBmc();
  }

  saveBmc() {
    if (!this.startupId || !this.currentBmcId) return;
    
    const dto: any = {
      id: this.currentBmcId,
      startupId: this.startupId,
      partenairesCles: this.getBlock('partners').notes.join(';'),
      activitesCles: this.getBlock('activities').notes.join(';'),
      ressourcesCles: this.getBlock('resources').notes.join(';'),
      propositionValeurs: this.getBlock('propositions').notes.join(';'),
      relationsClients: this.getBlock('relationships').notes.join(';'),
      canauxDistribution: this.getBlock('channels').notes.join(';'),
      segmentsClients: this.getBlock('segments').notes.join(';'),
      structuresCouts: this.getBlock('costs').notes.join(';'),
      fluxRevenus: this.getBlock('revenues').notes.join(';')
    };

    this.bmcService.update(this.currentBmcId, dto).subscribe();

    // Versioning logic: map blocks to snapshot format
    // const snapshotContent = this.mapBlocksToSnapshot();
    // this.versioningService.syncMainBranch(this.startupId, snapshotContent).subscribe();
  }

  private mapBlocksToSnapshot(): { [key: string]: string } {
    const snapshot: { [key: string]: string } = {};
    this.blocks.forEach(block => {
      snapshot[block.id] = block.notes.join(';');
    });
    return snapshot;
  }

  // ── INVITATION ──
  sendInvite() {
    if (!this.startupId || !this.inviteForm.email) return;
    this.isLoading = true;
    this.startupService.inviteMember(this.startupId, this.inviteForm).subscribe({
      next: () => {
        alert("Invitation envoyée avec succès !");
        this.isInviteModalOpen = false;
        this.isLoading = false;
      },
      error: () => {
        alert("Erreur lors de l'envoi.");
        this.isLoading = false;
      }
    });
  }

  // ── PROPOSALS REVIEW ──
  handleProposal(proposal: any, status: 'APPROVED' | 'REJECTED') {
    this.bmcService.reviewProposal(proposal.id, status).subscribe(() => {
      if (status === 'APPROVED') {
        const blockId = this.FRENCH_TO_BLOCK_ID[proposal.blockName] || proposal.blockName;
        this.getBlock(blockId).notes.push(proposal.newValue);
        this.saveBmc();
      }
      this.loadProposals();
      
      // Notify via WebSocket so member UI updates
      this.wsService.sendProposal(this.startupId!, {
        type: 'PROPOSAL_REVIEWED',
        proposalId: proposal.id,
        proposal_status: status
      });
    });
  }

  onApprove(pid: number, blockId: string) {
    const proposal = this.proposals.find(p => p.id === pid);
    if (proposal) {
      this.handleProposal(proposal, 'APPROVED');
      delete this.activeBlocks[blockId];
    }
  }

  onReject(pid: number, blockId: string) {
    const proposal = this.proposals.find(p => p.id === pid);
    if (proposal) {
      this.handleProposal(proposal, 'REJECTED');
      delete this.activeBlocks[blockId];
    }
  }

  getBlockLabel(frenchKey: string): string {
    const blockId = this.FRENCH_TO_BLOCK_ID[frenchKey] || frenchKey;
    return this.getBlock(blockId).title;
  }

  // ── AI SUGGESTIONS ──
  generateAiSuggestions() {
    if (!this.startupId) return;
    this.aiLoading = true;

    const bmcData = {
      partenairesCles: this.getBlock('partners').notes.join(';'),
      activitesCles: this.getBlock('activities').notes.join(';'),
      ressourcesCles: this.getBlock('resources').notes.join(';'),
      propositionValeurs: this.getBlock('propositions').notes.join(';'),
      relationsClients: this.getBlock('relationships').notes.join(';'),
      canauxDistribution: this.getBlock('channels').notes.join(';'),
      segmentsClients: this.getBlock('segments').notes.join(';'),
      structuresCouts: this.getBlock('costs').notes.join(';'),
      fluxRevenus: this.getBlock('revenues').notes.join(';')
    };

    this.aiService.getSuggestions(bmcData).subscribe({
      next: (res: CanvasSuggestionsResponse) => {
        alert("Suggestions IA générées ! Elles ont été ajoutées à vos notes.");
        this.loadBmc();
        this.aiLoading = false;
      },
      error: () => {
        alert("Erreur lors de la génération IA.");
        this.aiLoading = false;
      }
    });
  }

  // ── SWOT MODAL ──
  openSwotModal() {
    this.isSwotModalOpen = true;
    this.fetchSwotAnalysis();
  }

  closeSwotModal() {
    this.isSwotModalOpen = false;
  }

  fetchSwotAnalysis() {
    if (!this.startupId) return;
    this.swotLoading = true;
    this.swotError = null;

    const bmcData = {
      partenairesCles: this.getBlock('partners').notes.join(';'),
      activitesCles: this.getBlock('activities').notes.join(';'),
      ressourcesCles: this.getBlock('resources').notes.join(';'),
      propositionValeurs: this.getBlock('propositions').notes.join(';'),
      relationsClients: this.getBlock('relationships').notes.join(';'),
      canauxDistribution: this.getBlock('channels').notes.join(';'),
      segmentsClients: this.getBlock('segments').notes.join(';'),
      structuresCouts: this.getBlock('costs').notes.join(';'),
      fluxRevenus: this.getBlock('revenues').notes.join(';')
    };

    this.swotService.analyzeSwot(bmcData).subscribe({
      next: (res: SwotResponse) => {
        this.swotData = res;
        this.swotLoading = false;
      },
      error: (err: any) => {
        this.swotError = "Impossible de charger l'analyse SWOT.";
        this.swotLoading = false;
      }
    });
  }

  regenerateSwot() {
    this.fetchSwotAnalysis();
  }

  private triggerEmoji(emoji: string) {
    this.explodingEmoji = emoji;
    setTimeout(() => this.explodingEmoji = null, 800);
  }
}