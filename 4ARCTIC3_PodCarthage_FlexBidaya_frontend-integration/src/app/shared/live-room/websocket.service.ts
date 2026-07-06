import { Injectable } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
// @ts-ignore
import SockJS from 'sockjs-client';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {

  private stompClient!: Client;
  private messageSubject: Subject<any> = new Subject<any>();
  private participantSubject: Subject<any> = new Subject<any>();
  private invitationSubject: Subject<any> = new Subject<any>();
  private connected = false;
  private connecting = false;
  private pendingJoins: Array<{ roomId: string; user: any }> = [];
  // ✅ FIX : suivre les salles actives pour ré-abonnement à la reconnexion
  private activeRooms: Map<string, any> = new Map();

  constructor() {}

  private getUsername(): string {
    try {
      const auth = localStorage.getItem('flexbidaya_auth');
      if (auth) return JSON.parse(auth).username || 'guest';
    } catch {}
    return 'guest';
  }

  private connect(): void {
    if (this.connected || this.connecting) {
      return;
    }

    this.connecting = true;

    // ✅ FIX : factory (pas une instance fixe) → crée UN NOUVEAU SockJS à chaque reconnexion
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      debug: () => {}
    });

    this.stompClient.onConnect = () => {
      console.log('✅ WebSocket connecté !');
      this.connecting = false;
      this.connected = true;

      const username = this.getUsername();
      this.stompClient.subscribe(`/user/${username}/queue/invitations`, (message: Message) => {
        console.log('📨 Invitation reçue:', message.body);
        this.invitationSubject.next(JSON.parse(message.body));
      });

      // ✅ FIX : retraiter les joins en attente ET les salles actives (après reconnexion)
      const pending = [...this.pendingJoins];
      this.pendingJoins = [];
      pending.forEach(p => this._doJoin(p.roomId, p.user));

      // Ré-abonner aux salles actives en cas de reconnexion (backend restart)
      this.activeRooms.forEach((user, roomId) => this._doJoin(roomId, user));
    };

    this.stompClient.onDisconnect = () => {
      console.warn('⚠️ WebSocket déconnecté — tentative de reconnexion...');
      // ✅ FIX : remettre connected à false pour que les nouveaux joins attendent
      this.connecting = false;
      this.connected = false;
    };

    this.stompClient.onStompError = (frame) => {
      console.error('❌ Erreur STOMP :', frame.headers['message']);
      this.connecting = false;
      this.connected = false;
    };

    this.stompClient.onWebSocketClose = () => {
      this.connecting = false;
      this.connected = false;
    };

    this.stompClient.onWebSocketError = () => {
      this.connecting = false;
      this.connected = false;
    };

    this.stompClient.activate();
  }

  // Abonnements STOMP + publication JOIN (logique centrale séparée)
  private _doJoin(roomId: string, user: any): void {
    this.stompClient.subscribe(`/topic/room/${roomId}`, (message: Message) => {
      if (message.body) this.messageSubject.next(JSON.parse(message.body));
    });

    this.stompClient.subscribe(`/topic/participants/${roomId}`, (message: Message) => {
      if (message.body) this.participantSubject.next(JSON.parse(message.body));
    });

    if (user) {
      this.stompClient.publish({
        destination: `/app/join/${roomId}`,
        body: JSON.stringify(user)
      });
    }
    console.log(`🎧 Connecté à la salle ${roomId}`);
  }

  // Rejoindre une salle et s'abonner aux messages + participants
  public joinRoom(roomId: string, user?: any): void {
    this.connect();
    // ✅ FIX : stocker la salle pour ré-abonnement automatique à la reconnexion
    this.activeRooms.set(roomId, user || {});

    if (!this.connected) {
      this.pendingJoins.push({ roomId, user: user || {} });
      return;
    }

    this._doJoin(roomId, user || {});
  }

  // Quitter une salle
  public leaveRoom(roomId: string, user?: any): void {
    this.activeRooms.delete(roomId);
    if (this.connected && user) {
      this.stompClient.publish({
        destination: `/app/leave/${roomId}`,
        body: JSON.stringify(user)
      });
    }
  }

  // Envoyer un message dans la salle
  public sendMessage(roomId: string, messageBody: any): void {
    if (this.stompClient && this.connected) {
      this.stompClient.publish({
        destination: `/app/chat/${roomId}`,
        body: JSON.stringify(messageBody)
      });
    }
  }

  // Envoyer un événement whiteboard (stroke/clear) — pas sauvegardé en DB
  public sendWhiteboard(roomId: string, data: any): void {
    if (this.stompClient && this.connected) {
      this.stompClient.publish({
        destination: `/app/whiteboard/${roomId}`,
        body: JSON.stringify(data)
      });
    }
  }

  // Observer les messages
  public getMessages(): Observable<any> {
    return this.messageSubject.asObservable();
  }

  // Observer les changements de participants
  public getParticipants(): Observable<any> {
    return this.participantSubject.asObservable();
  }

  // Observer les invitations
  public getInvitations(): Observable<any> {
    this.connect();
    return this.invitationSubject.asObservable();
  }
}
