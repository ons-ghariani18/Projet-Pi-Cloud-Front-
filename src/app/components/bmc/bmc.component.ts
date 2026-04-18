import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { BusinessPlanService, BusinessPlanDTO } from '../../services/business-plan.service';
import { StartupService } from '../../services/startup.service';

@Component({
  selector: 'app-bmc',
  templateUrl: './bmc.component.html',
  styleUrls: ['./bmc.component.css']
})
export class BmcComponent implements OnInit {
  
  startupId: number | null = null;
  businessPlanId: number | null = null;
  isLoading = false;
  allStartups: any[] = []; // Liste pour le sélecteur

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
  currentBlockId = '';
  currentBlock: any = null;
  newNoteText = '';
  explodingEmoji: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private bmcService: BusinessPlanService,
    private startupService: StartupService // Nouveau
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
        this.loadBusinessPlan();
      } else {
        // Si pas d'ID, on pourrait rediriger ou attendre la sélection
        this.resetCanvas();
      }
    });
  }

  onStartupChange(event: any) {
    const selectedId = event.target.value;
    if (selectedId) {
      this.router.navigate(['/bmc', selectedId]);
    }
  }

  resetCanvas() {
    this.businessPlanId = null;
    this.blocks.forEach(b => b.notes = []);
  }

  // ── CHARGEMENT DEPUIS LE BACKEND ──────────────────────────────────────────
  loadBusinessPlan() {
    if (!this.startupId) return;
    
    // 1. On vide TOUJOURS le canvas avant de charger une nouvelle startup
    this.resetCanvas();
    this.isLoading = true;

    this.bmcService.getByStartupId(this.startupId).subscribe({
      next: (plans) => {
        if (plans && plans.length > 0) {
          const plan = plans[0];
          this.businessPlanId = plan.id || null;
          this.mapDtoToBlocks(plan);
        } else {
          // Si aucun plan n'existe pour cette startup, on reste sur un canvas vide
          this.businessPlanId = null;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement du BMC', err);
        this.isLoading = false;
        this.resetCanvas();
      }
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

    const dto: BusinessPlanDTO = this.mapBlocksToDto();
    
    // DEBUG : Voir ce qui est envoyé au serveur
    console.log('Envoi du DTO au serveur :', dto);

    this.isLoading = true;
    
    if (this.businessPlanId) {
      this.bmcService.update(this.businessPlanId, dto).subscribe({
        next: (res) => {
          alert('✨ Business Model Canvas mis à jour avec succès !');
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Erreur lors de la mise à jour', err);
          alert('Erreur lors de la sauvegarde. Vérifiez la console (F12).');
          this.isLoading = false;
        }
      });
    } else {
      this.bmcService.create(dto).subscribe({
        next: (res) => {
          this.businessPlanId = res.id || null;
          alert('✨ Premier Business Model Canvas créé avec succès !');
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Erreur lors de la création', err);
          alert('Erreur 400 : Le serveur a rejeté les données. Vérifiez la console (F12).');
          this.isLoading = false;
        }
      });
    }
  }

  // ── MAPPING FUNCTIONS ──────────────────────────────────────────────────────
  
  private mapDtoToBlocks(dto: any) {
    if (!dto) return;

    // Mapping flexible pour supporter CamelCase (Frontend) et snake_case (souvent Backend/DB)
    this.getBlock('partners').notes = this.splitNotes(dto.partenairesCles || dto.partenaires_cles);
    this.getBlock('activities').notes = this.splitNotes(dto.activitesCles || dto.activites_cles);
    this.getBlock('resources').notes = this.splitNotes(dto.ressourcesCles || dto.ressources_cles);
    this.getBlock('propositions').notes = this.splitNotes(dto.propositionValeurs || dto.proposition_valeurs);
    this.getBlock('relationships').notes = this.splitNotes(dto.relationsClients || dto.relations_clients);
    this.getBlock('channels').notes = this.splitNotes(dto.canauxDistribution || dto.canaux_distribution);
    this.getBlock('segments').notes = this.splitNotes(dto.segmentsClients || dto.segments_clients);
    this.getBlock('costs').notes = this.splitNotes(dto.structuresCouts || dto.structures_couts);
    this.getBlock('revenues').notes = this.splitNotes(dto.fluxRevenus || dto.flux_revenus);
  }

  private mapBlocksToDto(): any {
    const sId = Number(this.startupId);
    return {
      // On envoie les deux formats pour être sûr que le backend intercepte les données
      startupId: sId,
      startup_id: sId,
      
      partenairesCles: this.joinNotes('partners') || ' ',
      partenaires_cles: this.joinNotes('partners') || ' ',
      
      activitesCles: this.joinNotes('activities') || ' ',
      activites_cles: this.joinNotes('activities') || ' ',
      
      ressourcesCles: this.joinNotes('resources') || ' ',
      ressources_cles: this.joinNotes('resources') || ' ',
      
      propositionValeurs: this.joinNotes('propositions') || ' ',
      proposition_valeurs: this.joinNotes('propositions') || ' ',
      
      relationsClients: this.joinNotes('relationships') || ' ',
      relations_clients: this.joinNotes('relationships') || ' ',
      
      canauxDistribution: this.joinNotes('channels') || ' ',
      canaux_distribution: this.joinNotes('channels') || ' ',
      
      segmentsClients: this.joinNotes('segments') || ' ',
      segments_clients: this.joinNotes('segments') || ' ',
      
      structuresCouts: this.joinNotes('costs') || ' ',
      structures_couts: this.joinNotes('costs') || ' ',
      
      fluxRevenus: this.joinNotes('revenues') || ' ',
      flux_revenus: this.joinNotes('revenues') || ' '
    };
  }

  private getBlock(id: string) {
    return this.blocks.find(b => b.id === id)!;
  }

  private splitNotes(text: string): string[] {
    return text ? text.split(';').filter(n => n.trim() !== '') : [];
  }

  private joinNotes(blockId: string): string {
    const notes = this.getBlock(blockId).notes;
    return notes.length > 0 ? notes.join(';') : '';
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
      this.cdr.detectChanges();
      setTimeout(() => {
        this.explodingEmoji = null;
        this.cdr.detectChanges();
      }, 1000);
    }
  }

  removeNote(blockId: string, index: number) {
    this.getBlock(blockId).notes.splice(index, 1);
  }

  updateNote(blockId: string, index: number, event: any) {
    const newText = event.target.textContent.trim();
    if (newText) {
      this.getBlock(blockId).notes[index] = newText;
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
