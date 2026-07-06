import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-home-admin',
  templateUrl: './home-admin.component.html',
  styleUrls: ['./home-admin.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class HomeAdminComponent {

  constructor(private router: Router) {}

  stats = [
    { icon:'🚀', label:'Startups',           num:'2 048', delta:'↑ +12 ce mois',      pct:72, bg:'#eef1fb' },
    { icon:'👥', label:'Utilisateurs actifs', num:'5 301', delta:'↑ +87 ce mois',      pct:85, bg:'#e6fcf5' },
    { icon:'📅', label:'Événements actifs',   num:'14',    delta:'↑ +3 cette semaine', pct:40, bg:'#fff8e1' },
    { icon:'💰', label:'Investisseurs',       num:'318',   delta:'↑ +5 ce mois',       pct:55, bg:'#fff0f6' },
  ];

  modules = [
    { icon:'🏗️', title:'Gestion Incubateur',         desc:"Programmes d'incubation, cohortes et suivi des startups.",       badge:'6 actifs',      count:'6',     countLabel:'programmes',   route:'/admin-panel',      color:'c1', arrow:'#4f6fff' },
    { icon:'🎯', title:'Événements & Hackathons',     desc:'Organisation, candidatures, jury et résultats des événements.',  badge:'14 actifs',     count:'14',    countLabel:'événements',   route:'/dashadmin',           color:'c2', arrow:'#20c997' },
    { icon:'🧑‍💼',title:'Entrepreneurs & Experts',  desc:'Profils, vérifications, rôles et accès des entrepreneurs.',      badge:'1 240 profils', count:'1 240', countLabel:'profils',      route:'/admin-panel',         color:'c3', arrow:'#f59f00' },
    { icon:'⚡', title:'Gestion des Startups',         desc:'Validation, suivi de progression et statut des startups.',       badge:'2 048',         count:'2 048', countLabel:'startups',     route:'/dashadmin',            color:'c4', arrow:'#7950f2' },
    { icon:'⚙️', title:'Utilisateurs & Plateforme',   desc:'Comptes, rôles, permissions et paramètres globaux.',            badge:'5 301 users',   count:'5 301', countLabel:'utilisateurs', route:'/admin-dashboard',           color:'c5', arrow:'#f03e3e' },
    { icon:'📋', title:'Opportunités & Candidatures', desc:'Offres publiées, dossiers reçus et décisions de sélection.',    badge:'432 dossiers',  count:'432',   countLabel:'candidatures', route:'/admin/opportunites',   color:'c6', arrow:'#12b886' },
    { icon:'💼', title:'Gestion des Investisseurs',   desc:'Portefeuilles, mises en relation et suivi des investissements.',badge:'318 actifs',    count:'318',   countLabel:'investisseurs',route:'/admin-panel',                 color:'c7', arrow:'#d6336c' },
  ];

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('roles');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    this.router.navigate(['/signin']);
  }
}