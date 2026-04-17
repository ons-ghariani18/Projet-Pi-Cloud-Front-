import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-bmc',
  templateUrl: './bmc.component.html',
  styleUrls: ['./bmc.component.css']
})
export class BmcComponent implements OnInit {
  // Retour aux couleurs douces (Pastels)
  blocks = [
    { 
      id: 'partners', 
      title: 'Partenaires Clés', 
      icon: '🤝', 
      color: '#EEF2FF', 
      textColor: '#4338CA', 
      desc: 'Réseau de fournisseurs et partenaires.',
      notes: ['Investisseurs privés', 'Banque Centrale']
    },
    { 
      id: 'activities', 
      title: 'Activités Clés', 
      icon: '⚙️', 
      color: '#F0FDF4', 
      textColor: '#15803D', 
      desc: 'Actions les plus importantes à faire.',
      notes: ['Développement App', 'Marketing Digital']
    },
    { 
      id: 'resources', 
      title: 'Ressources Clés', 
      icon: '💎', 
      color: '#F0FDF4', 
      textColor: '#15803D', 
      desc: 'Actifs requis pour le modèle.',
      notes: ['Serveurs Cloud', 'Équipe Tech']
    },
    { 
      id: 'propositions', 
      title: 'Propositions de Valeur', 
      icon: '🎁', 
      color: '#FFF7ED', 
      textColor: '#C2410C', 
      desc: 'Produits et services qui créent de la valeur.',
      notes: ['Paiement instantané', 'Zéro frais']
    },
    { 
      id: 'relationships', 
      title: 'Relations Clients', 
      icon: '❤️', 
      color: '#FEF2F2', 
      textColor: '#B91C1C', 
      desc: 'Types de relations avec les clients.',
      notes: ['Support 24/7', 'Communauté Slack']
    },
    { 
      id: 'channels', 
      title: 'Canaux', 
      icon: '📡', 
      color: '#FEF2F2', 
      textColor: '#B91C1C', 
      desc: 'Comment nous touchons nos clients.',
      notes: ['App Store', 'Réseaux Sociaux']
    },
    { 
      id: 'segments', 
      title: 'Segments Clients', 
      icon: '👥', 
      color: '#F5F3FF', 
      textColor: '#6D28D9', 
      desc: 'Pour qui nous créons de la valeur.',
      notes: ['PME en Tunisie', 'Freelances']
    },
    { 
      id: 'costs', 
      title: 'Structure de Coûts', 
      icon: '💸', 
      color: '#F8FAFC', 
      textColor: '#475569', 
      desc: 'Tous les coûts pour opérer.',
      notes: ['Salaires', 'Marketing']
    },
    { 
      id: 'revenues', 
      title: 'Flux de Revenus', 
      icon: '💰', 
      color: '#F8FAFC', 
      textColor: '#475569', 
      desc: 'Comment nous gagnons de l\'argent.',
      notes: ['Abonnement Mensuel', 'Commissions']
    }
  ];

  isModalOpen = false;
  currentBlockId = '';
  currentBlock: any = null;
  newNoteText = '';
  explodingEmoji: string | null = null;

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
  }

  openNoteModal(blockId: string) {
    const block = this.blocks.find(b => b.id === blockId);
    if (block) {
      this.currentBlock = block;
      // Déclencher l'animation magique
      this.explodingEmoji = block.icon;
      this.cdr.detectChanges();
      
      // Attendre la fin de l'animation pour ouvrir le modal
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
      const block = this.blocks.find(b => b.id === this.currentBlockId);
      if (block) {
        block.notes.push(this.newNoteText.trim());
        
        // Effet Magique (Emoji Zoom)
        this.explodingEmoji = block.icon;
        
        this.closeModal();
        this.cdr.detectChanges();

        setTimeout(() => {
          this.explodingEmoji = null;
          this.cdr.detectChanges();
        }, 1000);
      }
    }
  }

  removeNote(blockId: string, index: number) {
    const block = this.blocks.find(b => b.id === blockId);
    if (block) {
      block.notes.splice(index, 1);
    }
  }

  // Gérer le Drag & Drop
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

  saveBmc() {
    console.log('Sauvegarde du BMC en cours...', this.blocks);
    alert('✨ Business Model Canvas sauvegardé avec succès !');
  }
}
