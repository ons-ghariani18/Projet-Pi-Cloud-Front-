import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { BusinessPlanService, BusinessPlanDTO } from '../../services/business-plan.service';
import { StartupService } from '../../services/startup.service';
import { BmcProposal, Membre } from '../../models/membre';
import { BmcWebSocketService } from '../../services/bmc-websocket.service';
import { OnDestroy } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { CanvasAiService, CanvasSuggestionsResponse } from '../../services/canvas-ai.service';
import { VersioningService } from '../../services/versioning.service';

@Component({
  selector: 'app-bmc',
  templateUrl: './bmc.component.html',
  styleUrls: ['./bmc.component.css']
})
export class BmcComponent implements OnInit, OnDestroy {

  startupId: number | null = null;
  businessPlanId: number | null = null;
  isLoading = false;
  allStartups: any[] = []; // Liste pour le sélecteur
  activeTab: 'bmc' | 'suggestions' | 'membres' | 'versioning' = 'bmc';

  activeBlocks: {
    [blockId: string]: {
      membreNom?: string;
      membre_nom?: string;
      typingText?: string;
      typing_text?: string;
      isTyping: boolean;
      isPending: boolean;
      proposalId?: number;
      proposal_id?: number;
    }
  } = {};

  blocks = [
    { id: 'partners', title: 'Partenaires Clés', icon: '🤝', color: '#EEF2FF', textColor: '#4338CA', desc: 'Réseau de fournisseurs et partenaires.', notes: [] as string[] },
    { id: 'activities', title: 'Activités Clés', icon: '⚙️', color: '#F0FDF4', textColor: '#15803D', desc: 'Actions les plus importantes à faire.', notes: [] as string[] },
    { id: 'resources', title: 'Ressources Clés', icon: '💎', color: '#F0FDF4', textColor: '#15803D', desc: 'Actifs requis pour le modèle.', notes: [] as string[] },
    { id: 'propositions', title: 'Propositions de Valeur', icon: '🎁', color: '#FFF7ED', textColor: '#C2410C', desc: 'Produits et services qui créent de la valeur.', notes: [] as string[] },
    { id: 'relationships', title: 'Relations Clients', icon: '❤️', color: '#FEF2F2', textColor: '#B91C1C', desc: 'Types de relations avec les clients.', notes: [] as string[] },
    { id: 'channels', title: 'Canaux', icon: '📡', color: '#FEF2F2', textColor: '#B91C1C', desc: 'Comment nous touchons nos clients.', notes: [] as string[] },
    { id: 'segments', title: 'Segments Clients', icon: '👥', color: '#F5F3FF', textColor: '#6D28D9', desc: 'Pour qui nous créons de la valeur.', notes: [] as string[] },
    { id: 'costs', title: 'Structure de Coûts', icon: '💸', color: '#F8FAFC', textColor: '#475569', desc: 'Tous les coûts pour opérer.', notes: [] as string[] },
    { id: 'revenues', title: 'Flux de Revenus', icon: '💰', color: '#F8FAFC', textColor: '#475569', desc: 'Comment nous gagnons de l\'argent.', notes: [] as string[] }
  ];

  isModalOpen = false;
  isInviteModalOpen = false;
  isProposalsModalOpen = false;

  currentBlockId = '';
  currentBlock: any = null;
  newNoteText = '';
  explodingEmoji: string | null = null;

  // For Invitations
  inviteForm = { nomPrenom: '', email: '', role: 'Developpeur', statutMembre: 'Tempsplein' };

  // For Proposals
  proposals: BmcProposal[] = [];
  aiLoading = false;
  aiError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private bmcService: BusinessPlanService,
    private startupService: StartupService,
    private wsService: BmcWebSocketService,
    private authService: AuthService,
    private canvasAiService: CanvasAiService,
    private versioningService: VersioningService
  ) { }

  ngOnInit(): void {
    // Charger la liste des startups pour le sélecteur
    this.startupService.startups$.subscribe(startups => {
      this.allStartups = startups;
    });

    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.startupId = +id;
        this.authService.saveCurrentStartupId(this.startupId);
        this.loadBmc(); // Appel de la méthode renommée
        this.setupWebSocket();
      } else {
        const lastId = this.authService.getCurrentStartupId();
        if (lastId) {
          this.router.navigate(['/bmc', lastId]);
        } else {
          this.resetCanvas();
        }
      }
    });

    this.startupService.startups$.subscribe(startups => {
      if (startups.length > 0 && !this.startupId && !this.authService.getCurrentStartupId()) {
        this.router.navigate(['/bmc', startups[0].id]);
      }
    });
  }

  setupWebSocket() {
    if (!this.startupId) return;

    console.log('>>> ENTREPRENEUR écoute startupId:', this.startupId);
    this.wsService.disconnect();
    this.wsService.connect();

    this.wsService.subscribe(this.startupId).subscribe(event => {
      console.log('>>> ENTREPRENEUR reçoit event:', event);

      const blockId = event.block_name;
      if (!blockId) return;

      // Handle Review event separately (cleanup)
      if (event.type === 'PROPOSAL_REVIEWED') {
        if (event.proposal_status === 'APPROVED') {
          this.loadBmc();
        }
        delete this.activeBlocks[blockId];
        this.activeBlocks = { ...this.activeBlocks };
        this.cdr.detectChanges();
        return;
      }

      // Ensure the block object exists in our tracking map
      const current = this.activeBlocks[blockId] ? { ...this.activeBlocks[blockId] } : {
        membreNom: event.membre_nom,
        typingText: '',
        isTyping: false,
        isPending: false
      };

      current.membreNom = event.membre_nom;

      if (event.type === 'CURSOR_MOVE') {
        // Just presence update
      } else if (event.type === 'TYPING') {
        current.typingText = event.typing_text || '';
        current.isTyping = true;
        current.isPending = false;
      } else if (event.type === 'PROPOSAL_SENT') {
        current.typingText = event.typing_text || '';
        current.isTyping = false;
        current.isPending = true;
        current.proposalId = event.proposal_id;

        // Refresh hidden list for the modal
        this.bmcService.getProposals(this.startupId!).subscribe(data => this.proposals = data);
      }

      // Update the map with a NEW object reference
      this.activeBlocks[blockId] = current;
      this.activeBlocks = { ...this.activeBlocks }; // Force Angular to detect change in the map
      this.cdr.detectChanges();
    });
  }

  onStartupChange() {
    if (this.startupId) {
      this.router.navigate(['/bmc', this.startupId]);
    }
  }

  resetCanvas() {
    this.businessPlanId = null;
    this.blocks.forEach(b => b.notes = []);
  }

  // ── CHARGEMENT DEPUIS LE BACKEND ──────────────────────────────────────────
  loadBmc() {
    if (!this.startupId) return;

    this.resetCanvas();
    this.isLoading = true;

    this.bmcService.getByStartupId(this.startupId).subscribe({
      next: (plans) => {
        if (plans && plans.length > 0) {
          const plan = plans[0];
          this.businessPlanId = plan.id || null;
          this.mapBmcToBlocks(plan);

          // Après le BMC, on charge les propositions en attente pour les afficher inline
          this.loadPendingProposalsInline();
        } else {
          this.businessPlanId = null;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement BMC:', err);
        this.isLoading = false;
        this.resetCanvas();
      }
    });
  }

  loadPendingProposalsInline() {
    if (!this.startupId) return;
    this.bmcService.getPendingProposals(this.startupId).subscribe(proposals => {
      proposals.forEach(p => {
        if (!this.activeBlocks[p.blockName]) {
          this.activeBlocks[p.blockName] = {
            membreNom: p.member?.nomPrenom || 'Membre',
            typingText: p.newValue,
            isTyping: false,
            isPending: true,
            proposalId: p.id
          };
        }
      });
      this.cdr.detectChanges();
    });
  }

  // ── CALCUL DE PROGRESSION ────────────────────────────────────────────────
  getProgress(): number {
    const filledBlocks = this.blocks.filter(b => b.notes.length > 0).length;
    return Math.round((filledBlocks / this.blocks.length) * 100);
  }

  // ── SAUVEGARDE VERS LE BACKEND ────────────────────────────────────────────
  saveBmc() {
    if (!this.startupId) {
      alert('⚠️ Veuillez d\'abord choisir une startup dans la liste en haut.');
      return;
    }

    const valuePropNotes = this.getBlock('propositions').notes;
    if (!valuePropNotes || valuePropNotes.length === 0) {
      alert('⚠️ La "Proposition de Valeur" est obligatoire pour sauvegarder le Business Model Canvas.');
      return;
    }

    const dto: BusinessPlanDTO = this.mapBlocksToDto();

    // DEBUG : Voir ce qui est envoyé au serveur
    console.log('Envoi du DTO au serveur :', dto);

    this.isLoading = true;

    if (this.businessPlanId) {
      this.bmcService.update(this.businessPlanId, dto).subscribe({
        next: (res: any) => {
          console.log('Sauvegarde réussie !');
          this.isLoading = false;
          // Reload to ensure UI is perfectly in sync with DB
          this.loadBmc();
          
          // SYNCHRONISATION AVEC LA BRANCHE MAIN
          this.syncMainBranch();
        },
        error: (err: any) => {
          console.error('Erreur lors de la mise à jour', err);
          alert('Erreur lors de la sauvegarde. Vérifiez la console (F12).');
          this.isLoading = false;
        }
      });
    } else {
      this.bmcService.create(dto).subscribe({
        next: (res: any) => {
          this.businessPlanId = res.id || null;
          alert('✨ Premier Business Model Canvas créé avec succès !');
          this.isLoading = false;
        },
        error: (err: any) => {
          console.error('Erreur lors de la création', err);
          alert('Erreur 400 : Le serveur a rejeté les données. Vérifiez la console (F12).');
          this.isLoading = false;
        }
      });
    }
  }

  // ── SYNCHRONISATION BRANCHE MAIN ───────────────────────────────────────────
  syncMainBranch() {
    if (!this.startupId) {
      console.error('❌ Impossible de synchroniser : startupId est nul');
      return;
    }
    console.log('🔍 Tentative de sync main pour startupId:', this.startupId);

    this.versioningService.getBranches(this.startupId).subscribe({
      next: (branches: any[]) => {
        const mainBranch = branches.find(b => b.nom === 'main');
        
        if (!mainBranch) {
          console.warn('Branche main introuvable pour cette startup');
          this.isLoading = false;
          return;
        }

        // Envoyer tout le snapshot en une seule requête pour éviter les conflits
        const snapshot = this.mapBlocksToSnapshot();
        console.log('📡 Synchronisation globale du snapshot...', snapshot);

        this.versioningService.updateBranchSnapshot(mainBranch.id, snapshot).subscribe({
          next: () => {
            console.log('✅ Branche main synchronisée (Global)');
            this.isLoading = false;
          },
          error: (err: any) => {
            console.error('Erreur sync globale', err);
            this.isLoading = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Erreur récupération branches', err);
        this.isLoading = false;
      }
    });
  }

  mapBlocksToSnapshot(): { [key: string]: string[] } {
    return {
      'Segments clients':      this.getBlock('segments').notes      || [],
      'Proposition de valeur': this.getBlock('propositions').notes  || [],
      'Canaux':                this.getBlock('channels').notes      || [],
      'Relations clients':     this.getBlock('relationships').notes || [],
      'Flux de revenus':       this.getBlock('revenues').notes      || [],
      'Ressources clés':       this.getBlock('resources').notes     || [],
      'Activités clés':        this.getBlock('activities').notes    || [],
      'Partenaires clés':      this.getBlock('partners').notes      || [],
      'Structure de coûts':    this.getBlock('costs').notes         || []
    };
  }

  // ── MAPPING FUNCTIONS ──────────────────────────────────────────────────────

  mapBmcToBlocks(bmc: any): void {
    if (!bmc) return;

    const getVal = (cCase: string, sCase: string) => bmc[cCase] || bmc[sCase] || '';

    this.getBlock('partners').notes = this.splitNotes(getVal('partenairesCles', 'partenaires_cles'));
    this.getBlock('activities').notes = this.splitNotes(getVal('activitesCles', 'activites_cles'));
    this.getBlock('resources').notes = this.splitNotes(getVal('ressourcesCles', 'ressources_cles'));
    this.getBlock('propositions').notes = this.splitNotes(getVal('propositionValeurs', 'proposition_valeurs'));
    this.getBlock('relationships').notes = this.splitNotes(getVal('relationsClients', 'relations_clients'));
    this.getBlock('channels').notes = this.splitNotes(getVal('canauxDistribution', 'canaux_distribution'));
    this.getBlock('segments').notes = this.splitNotes(getVal('segmentsClients', 'segments_clients'));
    this.getBlock('costs').notes = this.splitNotes(getVal('structuresCouts', 'structures_couts'));
    this.getBlock('revenues').notes = this.splitNotes(getVal('fluxRevenus', 'flux_revenus'));

    this.businessPlanId = bmc.id || null;
  }

  private mapBlocksToDto(): any {
    const sId = Number(this.startupId);
    return {
      startupId: sId,
      partenairesCles: this.joinNotes('partners') || '',
      activitesCles: this.joinNotes('activities') || '',
      ressourcesCles: this.joinNotes('resources') || '',
      propositionValeurs: this.joinNotes('propositions') || '',
      relationsClients: this.joinNotes('relationships') || '',
      canauxDistribution: this.joinNotes('channels') || '',
      segmentsClients: this.joinNotes('segments') || '',
      structuresCouts: this.joinNotes('costs') || '',
      fluxRevenus: this.joinNotes('revenues') || ''
    };
  }

  private getBlock(id: string) {
    return this.blocks.find(b => b.id === id)!;
  }

  private splitNotes(text: string): string[] {
    if (!text || text.trim() === 'À définir') return [];
    return text.split(/[;,]/).map(n => n.trim()).filter(n => n !== '' && n !== 'À définir');
  }

  // ── INVITATIONS ────────────────────────────────────────────────────────────
  openInviteModal() {
    if (!this.startupId) {
      alert('Veuillez sélectionner une startup d\'abord.');
      return;
    }
    this.isInviteModalOpen = true;
  }

  sendInvite() {
    if (!this.inviteForm.email || !this.inviteForm.nomPrenom) return;
    this.isLoading = true;
    this.startupService.inviteMember(this.startupId!, this.inviteForm).subscribe({
      next: () => {
        alert("Invitation envoyée avec succès ✨");
        this.isInviteModalOpen = false;
        this.inviteForm = { nomPrenom: '', email: '', role: 'Developpeur', statutMembre: 'Tempsplein' };
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error("Erreur invitation:", err);
        alert("Erreur lors de l'envoi de l'invitation.");
        this.isLoading = false;
      }
    });
  }

  // ── PROPOSALS ──────────────────────────────────────────────────────────────
  openProposalsModal() {
    if (!this.startupId) return;
    this.isLoading = true;
    this.bmcService.getProposals(this.startupId).subscribe({
      next: (data: BmcProposal[]) => {
        this.proposals = data;
        this.isProposalsModalOpen = true;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  handleProposal(proposal: BmcProposal, status: 'APPROVED' | 'REJECTED') {
    this.reviewProposal(proposal.id, status, proposal.blockName);
  }

  onApprove(proposalId: number, blockName: string) {
    this.reviewProposal(proposalId, 'APPROVED', blockName);
  }

  onReject(proposalId: number, blockName: string) {
    this.reviewProposal(proposalId, 'REJECTED', blockName);
  }

  private reviewProposal(proposalId: number, status: 'APPROVED' | 'REJECTED', blockName: string) {
    this.isLoading = true;
    this.bmcService.reviewProposal(proposalId, status).subscribe({
      next: () => {
        if (status === 'APPROVED') {
          // Apply the suggestion to the local blocks array
          const suggestion = this.activeBlocks[blockName]?.typingText;
          if (suggestion) {
            const block = this.blocks.find(b => b.id === blockName);
            if (block) {
              if (!block.notes) block.notes = [];
              block.notes.push(suggestion);

              // Persist the whole BMC with the new note added
              this.saveBmc(); // Persistence - Enabled specifically for Approval action
            }
          }
        }

        // Notify member via WebSocket
        if (this.startupId) {
          this.wsService.sendReview(this.startupId, {
            type: 'PROPOSAL_REVIEWED',
            proposal_status: status,
            block_name: blockName
          });
        }

        // Local cleanup
        delete this.activeBlocks[blockName];
        this.activeBlocks = { ...this.activeBlocks };

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Error during proposal review:", err);
        alert("Erreur lors de la revue de la proposition.");
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
  }

  generateAiSuggestions(): void {
    if (!this.startupId) {
      alert('Veuillez sélectionner une startup avant de lancer l’IA.');
      return;
    }

    this.aiLoading = true;
    this.aiError = null;

    this.canvasAiService.getSuggestions(this.startupId).subscribe({
      next: (response) => {
        this.applyAiSuggestionsToBlocks(response);
        this.aiLoading = false;
      },
      error: (err) => {
        console.error('Erreur génération suggestions IA:', err);
        this.aiError = err?.error?.erreur || 'Impossible de récupérer les suggestions IA.';
        this.aiLoading = false;
      }
    });
  }

  private applyAiSuggestionsToBlocks(response: CanvasSuggestionsResponse): void {
    const mapping: Array<{ blockId: string; suggestions?: string[] }> = [
      { blockId: 'partners', suggestions: response.partenairesCles },
      { blockId: 'activities', suggestions: response.activitesCles },
      { blockId: 'resources', suggestions: response.ressourcesCles },
      { blockId: 'propositions', suggestions: response.propositionValeurs },
      { blockId: 'relationships', suggestions: response.relationsClients },
      { blockId: 'channels', suggestions: response.canauxDistribution },
      { blockId: 'segments', suggestions: response.segmentsClients },
      { blockId: 'costs', suggestions: response.structuresCouts },
      { blockId: 'revenues', suggestions: response.fluxRevenus }
    ];

    mapping.forEach(({ blockId, suggestions }) => {
      if (!suggestions || !suggestions.length) return;
      const block = this.getBlock(blockId);
      const existing = new Set((block.notes || []).map((n) => n.trim().toLowerCase()));
      const toAdd = suggestions
        .map((s) => (s || '').trim())
        .filter((s) => s.length > 0 && !existing.has(s.toLowerCase()));
      block.notes = [...(block.notes || []), ...toAdd];
    });

    this.cdr.detectChanges();
  }

  private joinNotes(blockId: string): string {
    const notes = this.getBlock(blockId).notes;
    return notes.length > 0 ? notes.join(',') : '';
  }

  // ── UI LOGIC (EXISTANTE) ────────────────────────────────────────────────────

  openNoteModal(blockId: string) {
    const block = this.blocks.find(b => b.id === blockId);
    if (block) {
      this.currentBlock = block;
      this.explodingEmoji = block.icon;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.currentBlockId = blockId;
        this.newNoteText = '';
        this.isModalOpen = true;
        this.explodingEmoji = null;
        this.cdr.detectChanges();
      }, 800);
    }
  }

  closeModal() {
    this.isModalOpen = false;
  }

  saveNote() {
    if (this.newNoteText.trim()) {
      const block = this.getBlock(this.currentBlockId);
      block.notes.push(this.newNoteText.trim());
      this.explodingEmoji = block.icon;
      this.closeModal();
      // this.saveBmc(); // Persistence - removed to prevent auto-save
      this.cdr.detectChanges();
      setTimeout(() => {
        this.explodingEmoji = null;
        this.cdr.detectChanges();
      }, 1000);
    }
  }

  removeNote(blockId: string, index: number) {
    this.getBlock(blockId).notes.splice(index, 1);
    // this.saveBmc(); // Persistence - removed to prevent auto-save
  }

  updateNote(blockId: string, index: number, event: any) {
    const newText = event.target.textContent.trim();
    if (newText) {
      this.getBlock(blockId).notes[index] = newText;
      // this.saveBmc(); // Persistence - removed to prevent auto-save
    } else {
      // Si on efface tout, on remet l'ancienne valeur ou on supprime ? 
      // Ici on garde l'ancienne pour éviter les notes vides accidentelles
      event.target.textContent = this.getBlock(blockId).notes[index];
    }
  }

  onEnter(event: any) {
    event.preventDefault();
    if (event.target instanceof HTMLElement) {
      event.target.blur();
    }
  }

  getBlockLabel(key: string): string {
    const labels: any = {
      partners: 'Partenaires Clés',
      activities: 'Activités Clés',
      resources: 'Ressources Clés',
      propositions: 'Propositions de Valeur',
      relationships: 'Relations Clients',
      channels: 'Canaux',
      segments: 'Segments Clients',
      costs: 'Structure de Coûts',
      revenues: 'Flux de Revenus',
      // Handles both block IDs and backend keys if they differ
      partenairesCles: 'Partenaires Clés',
      activitesCles: 'Activités Clés',
      ressourcesCles: 'Ressources Clés',
      propositionValeurs: 'Propositions de Valeur',
      relationsClients: 'Relations Clients',
      canauxDistribution: 'Canaux',
      segmentsClients: 'Segments Clients',
      structuresCouts: 'Structure de Coûts',
      fluxRevenus: 'Flux de Revenus'
    };
    return labels[key] || key;
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
  }
}
