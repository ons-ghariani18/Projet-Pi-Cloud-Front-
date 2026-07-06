import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { WebsocketService } from '../live-room/websocket.service';

interface AvatarPreview { initials: string; color: string; }

interface LiveRoom {
  id: number;
  titre: string;
  description: string;
  theme: string;
  themeEmoji: string;
  isOfficial: boolean;
  hasExpert: boolean;
  hasCodeSharing: boolean;
  participants: number;
  maxParticipants: number;
  participantAvatars: AvatarPreview[];
  timer: string;
  acces: 'public' | 'certifies' | 'invite';
  createdById: number;
  createdAt?: string;
  dureeMinutes?: number;
  isEnded?: boolean;
  recordingUrl?: string;
  endedAt?: string;
}

@Component({
  selector: 'app-live-rooms-lobby',
  templateUrl: './live-rooms-lobby.component.html',
  styleUrls: ['./live-rooms-lobby.component.css']
})
export class LiveRoomsLobbyComponent implements OnInit, OnDestroy {

  totalOnline = 0;
  expertCount = 0;
  onlineExperts: { initials: string, name: string, color: string }[] = [];

  activeFilter = 'all';
  searchTerm = '';

  // ✅ FIX : lire depuis flexbidaya_auth
  currentUserRole: 'EXPERT' | 'ENTREPRENEUR' = this.getStoredRole();
  currentUsername: string = this.getStoredUsername();



  allRooms: LiveRoom[] = [];
  displayedRooms: LiveRoom[] = [];

  showCreateModal = false;
  mesInscrits: any[] = [];
  invitesSelectionnes: string[] = [];
  messageAucunInscrit: string = '';
  newRoom = this.resetNewRoom();

  themes = [
    { value: 'business', emoji: '🏭', label: 'Business Model' },
    { value: 'tech', emoji: '💻', label: 'Tech & Startup' },
    { value: 'social', emoji: '🌍', label: 'Social Impact' },
    { value: 'partner', emoji: '🤝', label: 'Looking for Partner' },
  ];

  private timerInterval: any;
  private refreshInterval: any;

  constructor(
    private router: Router,
    private http: HttpClient,
    private wsService: WebsocketService
  ) { }

  // ✅ Lit le username : priorité à la clé JWT du signin, puis flexbidaya_auth
  private getStoredUsername(): string {
    try {
      // 1. Clé principale posée par signin.component.ts
      const fromJwt = localStorage.getItem('username');
      if (fromJwt && fromJwt.trim() && fromJwt !== 'Visiteur') return fromJwt.trim();
      // 2. Clé propriétaire du module IdeaLab (dev / fallback)
      const auth = localStorage.getItem('flexbidaya_auth');
      if (auth) {
        const parsed = JSON.parse(auth);
        if (parsed.username && parsed.username !== 'Visiteur') return parsed.username;
      }
    } catch {}
    return 'Visiteur';
  }

  // ✅ Lit le rôle : priorité à la clé JWT du signin ('roles'), puis flexbidaya_auth
  private getStoredRole(): 'EXPERT' | 'ENTREPRENEUR' {
    try {
      // 1. Clé principale posée par signin.component.ts
      const rolesJson = localStorage.getItem('roles');
      if (rolesJson) {
        const roles: string[] = JSON.parse(rolesJson);
        if (roles.includes('ROLE_EXPERT') || roles.includes('ROLE_ORGANISATEUR')) return 'EXPERT';
        return 'ENTREPRENEUR';
      }
      // 2. Clé propriétaire IdeaLab
      const auth = localStorage.getItem('flexbidaya_auth');
      if (auth) {
        const roles: string[] = JSON.parse(auth).roles || [];
        return roles.includes('ROLE_EXPERT') ? 'EXPERT' : 'ENTREPRENEUR';
      }
    } catch {}
    return 'ENTREPRENEUR';
  }

  ngOnInit(): void {
    // Si l'utilisateur est connecté via JWT, synchroniser flexbidaya_auth avec son vrai username/role
    const jwtUsername = localStorage.getItem('username');
    const jwtRolesJson = localStorage.getItem('roles');
    if (jwtUsername && jwtRolesJson) {
      // Sync silencieux : on met à jour flexbidaya_auth pour les autres modules IdeaLab
      const jwtRoles: string[] = JSON.parse(jwtRolesJson);
      localStorage.setItem('flexbidaya_auth', JSON.stringify({ username: jwtUsername, roles: jwtRoles }));
      this.currentUsername = jwtUsername;
      this.currentUserRole = (jwtRoles.includes('ROLE_EXPERT') || jwtRoles.includes('ROLE_ORGANISATEUR')) ? 'EXPERT' : 'ENTREPRENEUR';
    } else if (this.currentUsername === 'Visiteur' || !this.currentUsername) {
      // Pas de session JWT → demande un pseudo (fallback dev)
      const nom = prompt('Entrez votre prénom/pseudo pour accéder à IdeaLab :');
      const finalName = (nom && nom.trim()) ? nom.trim() : `User_${Math.floor(1000 + Math.random() * 9000)}`;
      const role = this.currentUserRole === 'EXPERT' ? 'ROLE_EXPERT' : 'ROLE_ENTREPRENEUR';
      localStorage.setItem('flexbidaya_auth', JSON.stringify({ username: finalName, roles: [role] }));
      this.currentUsername = finalName;
    }
    this.chargerSalles();
    this.startRoomTimers();
    this.listenForInvitations();
    this.refreshInterval = setInterval(() => this.chargerSalles(), 10000);
  }



  private listenForInvitations(): void {
    this.wsService.getInvitations().subscribe((invitation: any) => {
      console.log('📨 Invitation reçue:', invitation);
      this.showInvitationPopup(invitation);
    });
  }

  private showInvitationPopup(invitation: any): void {
    const accept = confirm(
      `${invitation.invitedBy} vous invite à rejoindre "${invitation.roomTitle}"\n\nCliquez OK pour accepter`
    );
    if (accept) {
      this.router.navigate(['/live-room', invitation.roomId]);
    }
  }

  chargerSalles(): void {
    const username = this.currentUsername;
    console.log('🔄 Chargement des salles pour:', username);

    this.http.get<any[]>(`http://localhost:8080/api/rooms/accessible/${username}`).subscribe({
      next: (rooms) => {
        console.log('✅ Salles reçues:', rooms.length);
        
        let currentTotalOnline = 0;
        const expertsMap = new Map<number, any>();

        this.allRooms = rooms.map(r => {
          const duree = r.dureeMinutes != null ? r.dureeMinutes : 60;
          // On vérifie d'abord si le backend a défini endedAt
          let isEnded = r.endedAt != null || r.isActive === false;
          
          if (!isEnded && r.createdAt && duree > 0) {
            const diffMin = (Date.now() - new Date(r.createdAt).getTime()) / 60000;
            if (diffMin >= duree) {
               isEnded = true;
            }
          }

          let defaultTimer = '00:00';
          if (r.createdAt) {
            let diffSec = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 1000);
            if (diffSec < 0) diffSec = 0;
            if (isEnded && duree > 0) diffSec = duree * 60;
            const h = Math.floor(diffSec / 3600);
            const m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
            const s = (diffSec % 60).toString().padStart(2, '0');
            defaultTimer = h > 0 ? `${h.toString().padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
          }
          
          const participantsCount = r.invites ? r.invites.length + 1 : 1;
          
          if (!isEnded) {
             currentTotalOnline += participantsCount;
             if (r.expert && r.expert.id) {
                expertsMap.set(r.expert.id, r.expert);
             }
          }

          return {
            id: r.id,
            titre: r.titre,
            description: r.description,
            theme: r.theme,
            themeEmoji: r.themeEmoji,
            isOfficial: r.expert?.role === 'ADMIN' || r.expert != null,
            hasExpert: r.expert != null,
            hasCodeSharing: true,
            participants: participantsCount,
            maxParticipants: r.maxParticipants || 10,
            participantAvatars: [{ initials: r.expert?.username ? r.expert.username.charAt(0).toUpperCase() : 'E', color: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }],
            timer: defaultTimer,
            acces: r.acces,
            createdById: r.expert?.id || 1,
            createdAt: r.createdAt,
            dureeMinutes: duree,
            isEnded: isEnded,
            recordingUrl: r.recordingUrl
          };
        });
        
        this.totalOnline = currentTotalOnline;
        this.expertCount = expertsMap.size;
        
        const colors = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706'];
        this.onlineExperts = Array.from(expertsMap.values()).map((ex: any, idx: number) => ({
           initials: ex.username ? ex.username.charAt(0).toUpperCase() : 'E',
           name: ex.username || 'Expert',
           color: colors[idx % colors.length]
        }));
        
        this.applyFilters();
      },
      error: (err) => {
        console.error("❌ Erreur chargement salles", err);
        this.allRooms = [];
        this.displayedRooms = [];
        this.totalOnline = 0;
        this.expertCount = 0;
        this.onlineExperts = [];
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  filterRooms(filter: string): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  applySearch(): void { this.applyFilters(); }

  private applyFilters(): void {
    let filtered = [...this.allRooms];
    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(r => r.theme === this.activeFilter);
    }
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.titre.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
      );
    }
    this.displayedRooms = filtered;
  }

  joinRoom(room: LiveRoom): void {
    if (room.participants >= room.maxParticipants) {
      alert('Cette salle est pleine !');
      return;
    }
    this.router.navigate(['/live-room', room.id]);
  }

  createRoom(): void {
    if (this.currentUserRole !== 'EXPERT') {
      alert('Seuls les experts certifiés sont autorisés à créer des salles.');
      return;
    }
    if (!this.newRoom.titre.trim() || !this.newRoom.theme) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const theme = this.themes.find(t => t.value === this.newRoom.theme);
    const payload = {
      titre: this.newRoom.titre,
      description: this.newRoom.description || 'Salle créée par un expert.',
      theme: this.newRoom.theme,
      themeEmoji: theme?.emoji || '💬',
      maxParticipants: parseInt(this.newRoom.maxParticipants),
      acces: this.newRoom.acces,
      modeStrict: this.newRoom.modeStrict,
      invites: this.invitesSelectionnes,
      duree: this.newRoom.duree,
      createdBy: this.currentUsername
    };

    this.http.post<any>('http://localhost:8080/api/rooms', payload).subscribe({
      next: (roomCree) => {
        console.log('✅ Salle créée:', roomCree);
        this.showCreateModal = false;
        this.newRoom = this.resetNewRoom();
        this.invitesSelectionnes = [];
        this.chargerSalles();
        this.router.navigate(['/live-room', roomCree.id]);
      },
      error: (err) => {
        console.error("❌ Erreur de création de salle", err);
        alert("Impossible de créer la salle: " + (err.error || err.message));
      }
    });
  }

  ouvrirModalCreation(): void {
    this.showCreateModal = true;
    this.invitesSelectionnes = [];
    this.mesInscrits = [];
    this.messageAucunInscrit = '';

    console.log("🔍 Chargement des entrepreneurs...");

    this.http.get<any[]>('http://localhost:8080/users/entrepreneurs').subscribe({
      next: (users) => {
        console.log("✅ Entrepreneurs reçus:", users);
        this.mesInscrits = users.map(user => ({
          entrepreneurUsername: user.username,
          entrepreneurEmail: user.email,
          userId: user.id
        }));
        if (this.mesInscrits.length === 0) {
          this.messageAucunInscrit = "Aucun entrepreneur inscrit.";
        }
      },
      error: (err) => {
        console.error("❌ Erreur chargement entrepreneurs:", err);
        this.messageAucunInscrit = "Erreur de chargement des utilisateurs.";
        this.mesInscrits = [];
      }
    });
  }

  toggleInvite(username: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.invitesSelectionnes.push(username);
    } else {
      this.invitesSelectionnes = this.invitesSelectionnes.filter(u => u !== username);
    }
    console.log('Invités sélectionnés:', this.invitesSelectionnes);
  }

  closeModalIfOutside(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      this.showCreateModal = false;
    }
  }

  get rooms(): LiveRoom[] { return this.allRooms; }

  private resetNewRoom() {
    return {
      titre: '',
      description: '',
      theme: '',
      duree: '60',
      maxParticipants: '10',
      acces: 'invite' as 'public' | 'certifies' | 'invite',
      modeStrict: false
    };
  }

  private startRoomTimers(): void {
    this.timerInterval = setInterval(() => {
      this.allRooms.forEach(room => {
        if (room.isEnded) return;
        if (room.createdAt) {
          const dureeEffective = room.dureeMinutes != null ? room.dureeMinutes : 60;
          let diffSec = Math.floor((Date.now() - new Date(room.createdAt).getTime()) / 1000);
          if (diffSec < 0) diffSec = 0;
          
          if (dureeEffective > 0 && diffSec >= dureeEffective * 60) {
            room.isEnded = true;
            diffSec = dureeEffective * 60;
          }
          
          const h = Math.floor(diffSec / 3600);
          const m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
          const s = (diffSec % 60).toString().padStart(2, '0');
          room.timer = h > 0 ? `${h.toString().padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
        }
      });
    }, 1000);
  }
}