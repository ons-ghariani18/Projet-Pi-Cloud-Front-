import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BusinessPlanService, BusinessPlanDTO } from '../../../services/business-plan.service';
import { AuthService } from '../../../services/auth.service';
import { ProposeRequest, BmcProposal } from '../../../models/membre';
import { BmcWebSocketService } from '../../../services/bmc-websocket.service';
import { OnDestroy } from '@angular/core';

@Component({
  selector: 'app-bmc-public',
  templateUrl: './bmc-public.component.html',
  styleUrls: ['./bmc-public.component.css']
})
export class BmcPublicComponent implements OnInit, OnDestroy {
  token: string | null = null;
  isLoading = true;
  error: string | null = null;
  proposalFeedback: 'approved' | 'rejected' | null = null;

  blocks = [
    { id: 'partners',      title: 'Partenaires Clés',      icon: '🤝', color: '#EEF2FF', textColor: '#4338CA', notes: [] as string[] },
    { id: 'activities',    title: 'Activités Clés',         icon: '⚙️', color: '#F0FDF4', textColor: '#15803D', notes: [] as string[] },
    { id: 'resources',     title: 'Ressources Clés',        icon: '💎', color: '#F0FDF4', textColor: '#15803D', notes: [] as string[] },
    { id: 'propositions',  title: 'Propositions de Valeur', icon: '🎁', color: '#FFF7ED', textColor: '#C2410C', notes: [] as string[] },
    { id: 'relationships', title: 'Relations Clients',       icon: '❤️', color: '#FEF2F2', textColor: '#B91C1C', notes: [] as string[] },
    { id: 'channels',      title: 'Canaux',                 icon: '📡', color: '#FEF2F2', textColor: '#B91C1C', notes: [] as string[] },
    { id: 'segments',      title: 'Segments Clients',        icon: '👥', color: '#F5F3FF', textColor: '#6D28D9', notes: [] as string[] },
    { id: 'costs',         title: 'Structure de Coûts',     icon: '💸', color: '#F8FAFC', textColor: '#475569', notes: [] as string[] },
    { id: 'revenues',      title: 'Flux de Revenus',        icon: '💰', color: '#F8FAFC', textColor: '#475569', notes: [] as string[] }
  ];

  // ✅ FIX : map de traduction ID interne → nom français backend
  private readonly BLOC_ID_TO_NAME: { [key: string]: string } = {
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

  isModalOpen = false;
  currentBlock: any = null;
  proposalText = '';

  membreInfo: any = null;

  // Stores all proposals for this startup
  proposals: BmcProposal[] = [];

  constructor(
    private route: ActivatedRoute,
    private bmcService: BusinessPlanService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private wsService: BmcWebSocketService
  ) { }

  ngOnInit(): void {
    // Check for token in URL path (/bmc/public/:token)
    this.token = this.route.snapshot.paramMap.get('token');

    // If not found, check for token in query parameters (/bmc/join?token=xxx)
    if (!this.token) {
      this.token = this.route.snapshot.queryParamMap.get('token');
    }

    if (this.token) {
      this.joinAndLoad();
    } else {
      this.error = "Lien magique invalide.";
      this.isLoading = false;
    }
  }

  joinAndLoad() {
    this.isLoading = true;
    this.bmcService.joinByToken(this.token!).subscribe({
      next: (info) => {
        this.membreInfo = info;
        this.authService.saveMembreToken(this.token!);

        const sid = this.membreInfo.startup_id || this.membreInfo.startupId;
        this.loadBmc();

        // WebSocket logic
        this.wsService.connect();
        this.wsService.subscribe(sid).subscribe(event => {
          if (event.type === 'PROPOSAL_SENT' || event.type === 'PROPOSAL_REVIEWED') {
            this.loadProposals(); // Refresh the list
            if (event.type === 'PROPOSAL_REVIEWED') {
              this.proposalFeedback = event.proposal_status === 'APPROVED' ? 'approved' : 'rejected';
              if (event.proposal_status === 'APPROVED') this.loadBmc();
            }
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.error = "Lien magique invalide ou expiré.";
        this.isLoading = false;
      }
    });
  }

  loadBmc() {
    this.bmcService.getBmcByToken(this.token!).subscribe({
      next: (dto: BusinessPlanDTO) => {
        this.mapDtoToBlocks(dto);
        this.loadProposals(); // Fetch proposals as well
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = "Impossible de charger le contenu du BMC.";
        this.isLoading = false;
      }
    });
  }

  loadProposals() {
    this.bmcService.getProposalsByToken(this.token!).subscribe({
      next: (data) => {
        this.proposals = data;
        this.cdr.detectChanges();
      },
      error: () => console.error("Erreur lors du chargement des propositions.")
    });
  }

  private mapDtoToBlocks(dto: any) {
    this.getBlock('partners').notes      = this.splitNotes(dto.partenairesCles);
    this.getBlock('activities').notes    = this.splitNotes(dto.activitesCles);
    this.getBlock('resources').notes     = this.splitNotes(dto.ressourcesCles);
    this.getBlock('propositions').notes  = this.splitNotes(dto.propositionValeurs);
    this.getBlock('relationships').notes = this.splitNotes(dto.relationsClients);
    this.getBlock('channels').notes      = this.splitNotes(dto.canauxDistribution);
    this.getBlock('segments').notes      = this.splitNotes(dto.segmentsClients);
    this.getBlock('costs').notes         = this.splitNotes(dto.structuresCouts);
    this.getBlock('revenues').notes      = this.splitNotes(dto.fluxRevenus);
  }

  private getBlock(id: string) {
    return this.blocks.find(b => b.id === id)!;
  }

  private splitNotes(text: string): string[] {
    if (!text) return [];
    // ✅ FIX : gérer JSON array ["tag1","tag2"] ET string séparée par ";"
    const trimmed = text.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((n: string) => n && n.trim() !== '');
        }
      } catch {}
    }
    return trimmed.split(';').filter(n => n.trim() !== '');
  }

  openProposalModal(block: any) {
    this.currentBlock = block;
    this.proposalText = '';
    this.isModalOpen = true;
  }

  submitProposal() {
    const membreToken = this.authService.getMembreToken();
    if (!this.proposalText.trim() || !membreToken) {
      alert("Session expirée ou invalide.");
      return;
    }

    // ✅ FIX : traduire 'resources' → 'Ressources clés' avant envoi au backend
    const blocNameFr = this.BLOC_ID_TO_NAME[this.currentBlock.id];
    if (!blocNameFr) {
      console.error(`[BMC] bloc ID inconnu: ${this.currentBlock.id}`);
      alert("Erreur : bloc inconnu.");
      return;
    }

    const request: ProposeRequest = {
      token:     membreToken,
      blockName: blocNameFr,                        // ✅ 'Ressources clés' au lieu de 'resources'
      oldValue:  this.currentBlock.notes.join(';'),
      newValue:  this.proposalText.trim()
    };

    this.bmcService.proposeChange(request).subscribe({
      next: (response: any) => {
        // WebSocket notification
        this.wsService.sendProposal(this.membreInfo.startupId, {
          type:       'PROPOSAL_SENT',
          membreNom:  this.membreInfo.nomPrenom,
          blockName:  this.currentBlock.id,         // ✅ garder l'ID interne pour le WS (real-time)
          typingText: this.proposalText,
          proposalId: response.id
        });

        // Load proposals again to reflect the new state immediately
        this.loadProposals();

        this.isModalOpen  = false;
        this.proposalText = '';
      },
      error: () => {
        alert("Erreur lors de l'envoi de la proposition.");
      }
    });
  }

  getPendingForBlock(blockId: string): BmcProposal[] {
    // ✅ FIX : chercher avec les deux formats (ID interne ET nom français)
    //    car les anciennes proposals peuvent être stockées avec l'ID anglais
    const blocNameFr = this.BLOC_ID_TO_NAME[blockId];
    return this.proposals.filter(p =>
      p.blockName === blockId || p.blockName === blocNameFr
    );
  }

  onTyping(event: Event): void {
    // ✅ garder l'ID interne pour le WebSocket real-time (pas de changement)
    console.log('>>> MEMBRE envoie TYPING sur startupId:', this.membreInfo.startupId, 'blockName:', this.currentBlock.id);
    this.wsService.sendEvent(this.membreInfo.startupId, {
      type:       'TYPING',
      membreNom:  this.membreInfo.nomPrenom,
      blockName:  this.currentBlock.id,             // ✅ ID interne conservé pour le WS
      typingText: this.proposalText
    });
  }

  onBlockHover(blockId: string): void {
    if (this.membreInfo) {
      this.wsService.sendEvent(this.membreInfo.startupId, {
        type:      'CURSOR_MOVE',
        membreNom: this.membreInfo.nomPrenom,
        blockName: blockId                          // ✅ ID interne conservé pour le WS
      });
    }
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
  }
}