import { Component, OnInit } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-add-startup-modal',
  templateUrl: './add-startup-modal.component.html',
  styleUrls: ['./add-startup-modal.component.css']
})
export class AddStartupModalComponent implements OnInit {
  isVisible: boolean = false;
  step: number = 1;
  showSuccess: boolean = false;
  activeStatus: string = 'active';

  form = {
    name: '',
    description: '',
    sector: '',
    stage: '',
    creationDate: '',
    clientType: '',
    mrr: 0,
    budget: 0,
    hasCredit: false,
    credit: { montant: 0, taux: 5.5, duree: 24, source: '' }
  };

  membersList: { nom: string; role: string; email: string; statut: string }[] = [];

  constructor(
    private startupService: StartupService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void { }

  open(): void {
    this.isVisible = true;
    this.resetForm();
  }

  close(): void {
    this.isVisible = false;
  }

  closeOnOutsideClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close();
    }
  }

  goToStep(s: number): void {
    this.step = s;
  }

  // ✅ Valeurs exactes de l'enum Java Stade
  mapStage(stage: string): string {
    const mapping: { [key: string]: string } = {
      'Idee':       'Idee',
      'Idée':       'Idee',
      'Prototype':  'Prototype',
      'MVP':        'MVP',
      'Croissance': 'Croissance',
      'Scale':      'Scale'
    };
    return mapping[stage] || 'Idee';
  }

  // ✅ Valeurs exactes de l'enum Java Secteur
  mapSector(sector: string): string {
    const mapping: { [key: string]: string } = {
      'Fintech':     'Fintech',
      'Healthtech':  'Healthtech',
      'Edtech':      'Edtech',
      'SaaS':        'SaaS',
      'E-commerce':  'Ecommerce',
      'Ecommerce':   'Ecommerce',
      'Logistique':  'Logistique',
      'Immobilier':  'Immobilier',
      'Agritech':    'Agritech',
      'Legaltech':   'Legaltech',
      'Autre':       'Autre'
    };
    return mapping[sector] || 'Autre';
  }

  // ✅ Valeurs exactes de l'enum Java RoleStartup
  private normalizeRole(role: string): string {
    if (!role) return 'Autre';
    const normalized = role.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mapping: { [key: string]: string } = {
      'ceo':           'CEO_Fondateur',
      'fondateur':     'CEO_Fondateur',
      'ceo / fondateur': 'CEO_Fondateur',
      'ceo/fondateur': 'CEO_Fondateur',
      'ceo_fondateur': 'CEO_Fondateur',
      'cto':           'CTO',
      'coo':           'COO',
      'developpeur':   'Developpeur',
      'dev':           'Developpeur',
      'designer':      'Designer',
      'marketing':     'Marketing',
      'commercial':    'Commercial',
      'finance':       'Finance',
      'autre':         'Autre'
    };
    return mapping[normalized] || 'Autre';
  }

  // ✅ Valeurs exactes de l'enum Java Source
  private normalizeSource(source: string): string {
    if (!source) return 'Autre';
    const normalized = source.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mapping: { [key: string]: string } = {
      'banque':             'Banque',
      'investisseur prive': 'Investisseur_prive',
      'investisseur_prive': 'Investisseur_prive',
      'business angel':     'Business_Angel',
      'business_angel':     'Business_Angel',
      'fonds public':       'Fonds_public',
      'fonds_public':       'Fonds_public',
      'famille / amis':     'Famille_Amis',
      'famille amis':       'Famille_Amis',
      'famille/amis':       'Famille_Amis',
      'famille_amis':       'Famille_Amis',
      'autre':              'Autre'
    };
    return mapping[normalized] || 'Autre';
  }

  addMember(): void {
    this.membersList.push({ nom: '', role: '', email: '', statut: 'Tempsplein' });
  }

  removeMember(index: number): void {
    this.membersList.splice(index, 1);
  }

  fmt(n: number): string {
    return '€ ' + (n || 0).toLocaleString('fr-FR');
  }

  submit(): void {
    const todayStr = new Date().toISOString().split('T')[0];

    const toNum = (v: any): number => {
      if (typeof v === 'string') {
        v = v.replace(',', '.').replace(/\s/g, '');
      }
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    // ✅ EXACT format from Postman (snake_case)
    const payload: any = {
      nom:            this.form.name || 'Nouvelle Startup',
      description:    this.form.description || '',
      secteur:        this.mapSector(this.form.sector),
      stade:          this.mapStage(this.form.stage),
      statut:         'Active',
      date_creation:  this.form.creationDate || todayStr,
      type_client:    (this.form.clientType || 'B2B').toUpperCase(),
      mrr:            toNum(this.form.mrr),
      budget_initial: toNum(this.form.budget)
    };

    if (this.membersList.length > 0) {
      payload.membres = this.membersList
        .filter(m => m.nom || m.email)
        .map(m => {
          const cleanName = (m.nom || 'membre')
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '.')
            .toLowerCase();
          
          // Mapping exact pour correspondre à la BD : Tempsplein, Tempspartiel, Freelance, Advisor
          let statut_membre = (m.statut || 'Tempsplein').trim();
          if (statut_membre === 'Temps plein') statut_membre = 'Tempsplein';
          if (statut_membre === 'Temps partiel') statut_membre = 'Tempspartiel';
          // On retire le .toUpperCase() car la BD est en TitleCase

          return {
            nom_prenom:     m.nom || 'Membre',
            role:           this.normalizeRole(m.role),
            email:          m.email || `${cleanName}@flexbidaya.tn`,
            statut_membre:  statut_membre
          };
        });
    }

    if (this.form.hasCredit) {
      payload.credits = [{
        montant:       toNum(this.form.credit.montant),
        taux_interet:  toNum(this.form.credit.taux),
        duree_mois:    Math.floor(toNum(this.form.credit.duree)) || 1,
        source:        this.normalizeSource(this.form.credit.source)
      }];
    }

    console.log('Sending payload:', JSON.stringify(payload, null, 2));
    // Affichage forcé pour débogage
    window.alert('PAYLOAD ENVOYÉ: ' + JSON.stringify(payload));

    this.startupService.addStartup(payload).subscribe({
      next: () => {
        this.showSuccess = true;
      },
      error: (err) => {
        console.error('Error creating startup', err);
        let errorMsg = 'Erreur lors de la création de la startup';
        if (err.error && typeof err.error === 'string') {
          errorMsg += ` : ${err.error}`;
        }
        this.toastService.show(errorMsg);
      }
    });
  }

  resetAndContinue(): void {
    this.resetForm();
    this.toastService.show('Startup créée avec succès !');
    this.close();
  }

  private resetForm(): void {
    this.form = {
      name: '',
      description: '',
      sector: '',
      stage: '',
      creationDate: '',
      clientType: '',
      mrr: 0,
      budget: 0,
      hasCredit: false,
      credit: { montant: 0, taux: 5.5, duree: 24, source: '' }
    };
    this.membersList = [];
    this.step = 1;
    this.showSuccess = false;
    this.activeStatus = 'active';
  }
}