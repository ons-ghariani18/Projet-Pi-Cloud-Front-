import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { VersioningService } from '../../../services/versioning.service';
import { BranchDTO, CommitDTO, BlocConflict, VersionEntry } from '../../../models/versioning';

@Component({
  selector: 'app-versioning',
  templateUrl: './versioning.component.html',
  styleUrls: ['./versioning.component.css']
})
export class VersioningComponent implements OnInit, OnChanges {
  @Input() startupId!: number | string;
  @Output() versionRestored = new EventEmitter<void>();

  branches: BranchDTO[] = [];
  commits: CommitDTO[] = [];
  versions: any[] = [];
  mainBranchId: string | null = null;
  isLoading = false;

  // Conflict Resolution State
  isMerging = false;
  sessionId: string | null = null;
  conflicts: { [key: string]: BlocConflict } = {};
  resolvedBlocs = new Set<string>();
  customChoices: { [key: string]: string } = {};
  currentStep = 0;
  hasConflicts = false;

  // Branch Editing State
  isEditing = false;
  editingBranch: BranchDTO | null = null;
  editingSnapshot: { [key: string]: string[] } = {};
  newTagInputs: { [key: string]: string } = {};

  showHistory = true;

  Object = Object;
  
  constructor(private versioningService: VersioningService) {}

  isBlocResolved(key: string): boolean {
    return this.resolvedBlocs.has(key);
  }

  ngOnInit(): void {
    if (this.startupId) {
      this.loadAll();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startupId'] && !changes['startupId'].firstChange) {
      this.loadAll();
    }
  }

  loadAll(): void {
    if (!this.startupId) return;
    this.isLoading = true;
    
    this.versioningService.getBranches(this.startupId).subscribe({
      next: (data: any[]) => {
        this.branches = data;
        const main = data.find(b => b.nom === 'main');
        if (main) {
          this.mainBranchId = main.id;
          // loadHistory is kept for internal commit tracking if needed, 
          // but versions is the primary for UI.
          this.loadHistory(main.id);
        }
        this.loadVersionHistory();
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Loading error:', err);
        this.isLoading = false;
      }
    });
  }

  loadHistory(mainId: string): void {
    this.versioningService.getCommits(mainId).subscribe({
      next: (data: any[]) => {
        this.commits = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },
      error: (err: any) => console.error('Erreur historique:', err)
    });
  }

  loadVersionHistory(): void {
    if (!this.startupId) return;
    this.versioningService.getVersionHistory(this.startupId).subscribe({
      next: (data: any[]) => {
        this.versions = data.sort((a, b) => b.versionNumber - a.versionNumber);
      },
      error: (err: any) => console.error('Erreur historique versions:', err)
    });
  }

  loadVersions(): void {
    if (!this.startupId) return;
    console.log('📡 Fetching versions for startup:', this.startupId);
    this.versioningService.getVersions(this.startupId).subscribe({
      next: (data: any[]) => {
        console.log('✅ Versions received:', data);
        this.versions = data;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('❌ Versions error:', err);
        this.isLoading = false;
      }
    });
  }

  createNewBranch(): void {
    if (!this.startupId) return;

    if (!this.mainBranchId) {
      const confirmInit = confirm('No main branch found. Create "main" branch?');
      if (!confirmInit) return;
    }

    const defaultName = this.mainBranchId ? 'feature-' : 'main';
    const nom = prompt('Name of the new branch:', defaultName);
    
    if (nom && nom.trim()) {
      this.isLoading = true;
      const parentId = this.mainBranchId || null;
      
      this.versioningService.createBranch(nom.trim(), this.startupId.toString(), parentId).subscribe({
        next: () => {
          alert('✅ Branch created successfully!');
          this.loadAll();
        },
        error: (err) => {
          console.error('Creation error:', err);
          this.isLoading = false;
          alert('Error during creation.');
        }
      });
    }
  }

  startMerge(sourceId: string): void {
    if (!this.mainBranchId) return;
    console.log(`🚀 Attempting merge: Source=${sourceId} -> Target(main)=${this.mainBranchId}`);
    this.isLoading = true;

    this.versioningService.startMerge(sourceId, this.mainBranchId).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        const sid = res.session_id || res.sessionId;
        
        // Force opening the modal for review
        this.isMerging = true;
        this.sessionId = sid || null;
        this.conflicts = res.conflicts || {};
        this.hasConflicts = res.has_conflicts ?? (Object.keys(this.conflicts).length > 0);
        this.currentStep = 0;
        this.resolvedBlocs.clear();
        
        console.log('🚀 Interface de merge ouverte. SessionId:', sid, 'Conflits:', this.hasConflicts);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Merge error:', err);
        alert('Error during merge start.');
      }
    });
  }

  resolveConflict(blocName: string, choice: string): void {
    if (!this.sessionId) return;

    let customTags: string[] | undefined;
    if (choice === 'CUSTOM') {
      const text = this.customChoices[blocName] || '';
      customTags = text.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    }

    this.isLoading = true;
    this.versioningService.resolveConflict(this.sessionId, blocName, choice, customTags).subscribe({
      next: () => {
        this.resolvedBlocs.add(blocName);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Resolution error:', err);
        alert('Error during conflict resolution.');
      }
    });
  }

  nextStep(): void {
    const keys = Object.keys(this.conflicts);
    if (this.currentStep < keys.length - 1) {
      this.currentStep++;
    } else {
      this.finalizeMerge();
    }
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
        console.error('Branch loading error:', err);
        this.isLoading = false;
        alert('Could not load the branch.');
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

    console.log('📦 Snapshot to edit:', parsedSnapshot);
    
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
          console.log(`✅ Block [${blocName}] synced successfully`, res);
          completed++;
          if (completed === blocNames.length) {
            alert('✅ Branch updated successfully!');
            this.isEditing = false;
            this.editingBranch = null;
            this.loadAll();
          }
        },
        error: (err) => {
          console.error(`Error syncing block ${blocName}`, err);
          this.isLoading = false;
        }
      });
    });
  }

  finalizeMerge(): void {
    if (!this.sessionId) return;
    this.isLoading = true;

    this.versioningService.finalizeMerge(this.sessionId).subscribe({
      next: () => {
        this.isMerging = false;
        this.sessionId = null;
        alert('✅ Merge finalized, official version updated!');
        this.loadAll();
        this.loadVersions();
        this.versionRestored.emit();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Finalization error:', err);
        alert('Error during finalization.');
      }
    });
  }

  restoreCommit(commitId: string): void {
    if (!this.mainBranchId) return;
    if (!confirm('Are you sure you want to restore this version? Current BMC will be replaced.')) return;

    this.isLoading = true;
    this.versioningService.restoreCommit(this.mainBranchId, commitId).subscribe({
      next: () => {
        alert('✅ Version restored successfully!');
        this.loadAll();
        this.versionRestored.emit();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Restoration error:', err);
        alert('Error during restoration.');
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
      partners: 'Key Partners',
      activities: 'Key Activities',
      resources: 'Key Resources',
      propositions: 'Value Propositions',
      relationships: 'Customer Relationships',
      channels: 'Channels',
      segments: 'Customer Segments',
      costs: 'Cost Structure',
      revenues: 'Revenue Streams'
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
