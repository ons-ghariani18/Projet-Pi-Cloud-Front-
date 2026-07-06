import { Injectable } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private client: Client;
  private notificationSubject = new Subject<string>();
  
  public notifications$ = this.notificationSubject.asObservable();

  constructor() {
    this.client = new Client({
      // @ts-ignore : workaround pour SockJS
      webSocketFactory: () => new SockJS('http://localhost:8080/ws-notifications'),
      debug: (str) => { console.log(str); },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });
  }

  connect(userId: number): void {
    this.client.onConnect = (frame) => {
      console.log('Connecté au WebSocket', frame);
      this.client.subscribe(`/topic/user/${userId}`, (message: Message) => {
        if (message.body) {
          this.notificationSubject.next(message.body);
        }
      });
    };

    this.client.onStompError = (frame) => {
      console.error('Erreur STOMP', frame.headers['message']);
      console.error('Détails : ', frame.body);
    };

    this.client.activate();
  }

  disconnect(): void {
    if (this.client.active) {
      this.client.deactivate();
    }
  }
}
