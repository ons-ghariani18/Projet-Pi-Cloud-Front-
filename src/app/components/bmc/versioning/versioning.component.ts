import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { VersioningService } from '../../../services/versioning.service';
import { BranchDTO, CommitDTO, BlocConflict } from '../../../models/versioning';

@Component({
  selector: 'app-versioning',
  templateUrl: './versioning.component.html',
  styleUrls: ['./versioning.component.css']
})
export class VersioningComponent implements OnInit {
  @Input() startupId!: number | string;
  @Output() versionRestored = new EventEmitter<void>();

  branches: BranchDTO[] = [];
  commits: CommitDTO[] = [];
  mainBranchId: string | null = null;
  isLoading = false;

  // ── Variables d'état de Merge ────────────────────────────────────
  isMerging        = false;
  sessionId        : string | null = null;
  conflicts        : any = {};
  hasConflicts     = false;
  currentStep      = 0;
  conflictKeys     : string[] = [];          // ✅ liste ordonnée des blocs en conflit
  currentConflict  : any = null;             // ✅ conflit actuellement affiché
  customTagsInput  = '';                     // ✅ champ textarea personnalisation
  resolvedBlocs    = new Set<string>();

  // ── Variables d'état d'Édition ──────────────────────────────────
  isEditing        = false;
  editingBranch    : BranchDTO | null = null;
  editingSnapshot  : { [key: string]: string[] } = {};
  newTagInputs     : { [key: string]: string } = {};
  showHistory      = true;

  Object           = Object;                 // ✅ pour Object.keys dans le template
  
  constructor(private versioningService: VersioningService) {}

  isBlocResolved(key: string): boolean {
    return this.resolvedBlocs.has(key);
  }

  ngOnInit(): void {
    if (this.startupId) {
      this.loadAll();
    }
  }

  loadAll(): void {
    if (!this.startupId) return;
    this.isLoading = true;
    
    this.versioningService.getBranches(this.startupId).subscribe({
      next: (data) => {
        this.branches = data;
        const main = data.find(b => b.nom === 'main');
        if (main) {
          this.mainBranchId = main.id;
          this.loadHistory(main.id);
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement:', err);
        this.isLoading = false;
      }
    });
  }

  loadHistory(mainId: string): void {
    this.versioningService.getCommits(mainId).subscribe({
      next: (data) => {
        this.commits = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },
      error: (err) => console.error('Erreur historique:', err)
    });
  }

  createNewBranch(): void {
    if (!this.startupId) return;

    if (!this.mainBranchId) {
      const confirmInit = confirm('Aucune branche principale (main) n\'a été trouvée. Créer la branche "main" ?');
      if (!confirmInit) return;
    }

    const defaultName = this.mainBranchId ? 'feature-' : 'main';
    const nom = prompt('Nom de la nouvelle branche :', defaultName);
    
    if (nom && nom.trim()) {
      this.isLoading = true;
      const parentId = this.mainBranchId || null;
      
      this.versioningService.createBranch(nom.trim(), this.startupId.toString(), parentId).subscribe({
        next: () => {
          alert('✅ Branche créée avec succès !');
          this.loadAll();
        },
        error: (err) => {
          console.error('Erreur création:', err);
          this.isLoading = false;
          alert('Erreur lors de la création.');
        }
      });
    }
  }

  startMerge(sourceId: string): void {
    if (!this.mainBranchId) return;
    this.isLoading = true;

    this.versioningService.startMerge(sourceId, this.mainBranchId).subscribe({
      next: (res: any) => {
        this.isMerging = true;
        this.sessionId = res.session_id || res.sessionId;
        this.conflicts = res.conflicts || {};
        this.hasConflicts = res.has_conflicts || res.hasConflicts || Object.keys(this.conflicts).length > 0;

        // ✅ Initialiser le stepper
        this.conflictKeys = Object.keys(this.conflicts);
        this.currentStep = 0;
        this.currentConflict = null;
        this.customTagsInput = '';
        this.resolvedBlocs = new Set<string>();
        
        if (this.hasConflicts) {
          this.loadCurrentConflict();
        }

        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Erreur merge:', err);
        alert('Erreur lors du lancement du merge.');
      }
    });
  }

  loadCurrentConflict() {
    if (this.conflictKeys.length === 0) return;
    const key = this.conflictKeys[this.currentStep];
    const data = this.conflicts[key];

    this.currentConflict = {
      blocName: key,
      mainTags: data?.mainTags || [],
      sourceTags: data?.sourceTags || [],
      originTags: data?.originTags || [],
    };
    this.customTagsInput = '';
  }

  resolveAndNext(choice: string) {
    if (!this.sessionId || !this.currentConflict) return;
    const blocName = this.currentConflict.blocName;
    const customTags = choice === 'CUSTOM'
      ? this.customTagsInput.split('\n').map(t => t.trim()).filter(t => t)
      : undefined;

    this.versioningService
      .resolveConflict(this.sessionId, blocName, choice, customTags)
      .subscribe({
        next: () => {
          this.resolvedBlocs.add(blocName);
          if (this.currentStep < this.conflictKeys.length - 1) {
            this.currentStep++;
            this.loadCurrentConflict();
          } else {
            this.finalizeMerge();
          }
        },
        error: (err) => {
          console.error('Erreur résolution:', err);
          alert('Erreur lors de la résolution.');
        }
      });
  }

  finalizeMerge() {
    if (!this.sessionId) return;
    this.isLoading = true;
    this.versioningService.finalizeMerge(this.sessionId).subscribe({
      next: () => {
        this.isMerging = false;
        this.hasConflicts = false;
        this.conflicts = {};
        this.sessionId = null;
        alert('✅ Merge finalisé avec succès !');
        this.loadAll();
        this.versionRestored.emit();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Erreur finalisation:', err);
        alert('Erreur lors de la finalisation.');
      }
    });
  }


  openEditBranch(branch: BranchDTO): void {
    this.isLoading = true;
    this.versioningService.getBranchById(branch.id).subscribe({
      next: (fullBranch: any) => {
        this.editingBranch = fullBranch;
        // Handle both bmc_snapshot (snake_case) and bmcSnapshot (camelCase)
        const snapshotData = fullBranch.bmc_snapshot || fullBranch.bmcSnapshot;
        this.editingSnapshot = this.ensureValidSnapshot(snapshotData);
        this.isEditing = true;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement branche:', err);
        this.isLoading = false;
        alert('Impossible de charger la branche.');
      }
    });
  }

  private ensureValidSnapshot(snapshot: any): { [key: string]: string[] } {
    const validKeys = [
      'Segments clients', 'Proposition de valeur', 'Canaux', 'Relations clients',
      'Flux de revenus', 'Ressources clés', 'Activités clés', 'Partenaires clés', 'Structure de coûts'
    ];
    
    let parsedSnapshot = snapshot;
    
    // Si le snapshot arrive sous forme de chaîne JSON, on le parse
    if (typeof snapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(snapshot);
      } catch (e) {
        console.error('Erreur parsing snapshot string', e);
        parsedSnapshot = {};
      }
    }

    console.log('📦 Snapshot à éditer :', parsedSnapshot);
    
    const result: { [key: string]: string[] } = {};
    validKeys.forEach(key => {
      // On cherche la clé exacte ou une version avec underscore si l'intercepteur est passé par là
      const val = (parsedSnapshot && parsedSnapshot[key]) || [];
      result[key] = Array.isArray(val) ? [...val] : [];
    });
    return result;
  }

  addTag(blocName: string): void {
    const tag = (this.newTagInputs[blocName] || '').trim();
    if (tag) {
      if (!this.editingSnapshot[blocName]) this.editingSnapshot[blocName] = [];
      this.editingSnapshot[blocName].push(tag);
      this.newTagInputs[blocName] = '';
    }
  }

  removeTag(blocName: string, index: number): void {
    this.editingSnapshot[blocName].splice(index, 1);
  }

  saveBranchChanges(): void {
    if (!this.editingBranch) return;
    this.isLoading = true;

    const blocNames = Object.keys(this.editingSnapshot);
    let completed = 0;

    blocNames.forEach(blocName => {
      console.log(`📡 Sync bloc [${blocName}] -> Tags:`, this.editingSnapshot[blocName]);
      this.versioningService.updateBranchBlock(this.editingBranch!.id, blocName, this.editingSnapshot[blocName]).subscribe({
        next: (res) => {
          console.log(`✅ Bloc [${blocName}] synchronisé avec succès`, res);
          completed++;
          if (completed === blocNames.length) {
            alert('✅ Branche mise à jour avec succès !');
            this.isEditing = false;
            this.editingBranch = null;
            this.loadAll();
          }
        },
        error: (err) => {
          console.error(`Erreur sync bloc ${blocName}`, err);
          this.isLoading = false;
        }
      });
    });
  }


  restoreCommit(commitId: string): void {
    if (!this.mainBranchId) return;
    if (!confirm('Êtes-vous sûr de vouloir restaurer cette version ? Le BMC actuel sera remplacé.')) return;

    this.isLoading = true;
    this.versioningService.restoreCommit(this.mainBranchId, commitId).subscribe({
      next: () => {
        alert('✅ Version restaurée avec succès !');
        this.loadAll();
        this.versionRestored.emit();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Erreur restauration:', err);
        alert('Erreur lors de la restauration.');
      }
    });
  }

  getConflictKeys(): string[] {
    return Object.keys(this.conflicts);
  }

  getEditingKeys(): string[] {
    return Object.keys(this.editingSnapshot);
  }

  get allConflictsResolved(): boolean {
    return this.getConflictKeys().every(key => this.resolvedBlocs.has(key));
  }

  getBlockLabel(id: string): string {
    const labels: any = {
      partners: 'Partenaires Clés',
      activities: 'Activités Clés',
      resources: 'Ressources Clés',
      propositions: 'Propositions de Valeur',
      relationships: 'Relations Clients',
      channels: 'Canaux',
      segments: 'Segments Clients',
      costs: 'Structure de Coûts',
      revenues: 'Flux de Revenus'
    };
    return labels[id] || id;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
