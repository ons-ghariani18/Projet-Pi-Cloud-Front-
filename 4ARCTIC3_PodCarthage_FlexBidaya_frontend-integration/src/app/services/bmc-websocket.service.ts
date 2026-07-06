import { Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { Observable, BehaviorSubject } from 'rxjs';
import SockJS from 'sockjs-client';

export interface BmcEvent {
  type: 'CURSOR_MOVE' | 'TYPING' | 'PROPOSAL_SENT' | 'PROPOSAL_REVIEWED';
  startup_id: number;
  membre_nom: string;
  block_name: string;
  typing_text?: string;
  proposal_status?: string;
  cursor_x?: number;
  cursor_y?: number;
  proposal_id?: number;
}

@Injectable({ providedIn: 'root' })
export class BmcWebSocketService {

  private rxStomp = new RxStomp();
  private activeBlocksSubject = new BehaviorSubject<{ [key: string]: any }>({});
  public activeBlocks$ = this.activeBlocksSubject.asObservable();

  constructor() {
    this.configure();
  }

  private configure(): void {
    this.rxStomp.configure({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 3000,
    });
  }

  // Ancienne méthode (pour BmcPublicComponent)
  connect(): void {
    if (!this.rxStomp.active) {
      this.rxStomp.activate();
    }
  }

  // Ancienne méthode (pour BmcPublicComponent)
  disconnect(): void {
    if (this.rxStomp.active) {
      this.rxStomp.deactivate();
    }
    this.activeBlocksSubject.next({});
  }

  // Ancienne méthode (pour BmcPublicComponent)
  subscribe(startupId: number): Observable<any> {
    return new Observable(observer => {
      this.rxStomp.watch(`/topic/bmc/${startupId}`).subscribe(msg => {
        const event = JSON.parse(msg.body) as BmcEvent;
        this.handleIncomingEvent(event);
        observer.next(event);
      });
    });
  }

  connectToStartup(startupId: number): void {
    this.connect();
    this.rxStomp.watch(`/topic/bmc/${startupId}`).subscribe(msg => {
      const event = JSON.parse(msg.body) as BmcEvent;
      this.handleIncomingEvent(event);
    });
  }

  disconnectFromStartup(startupId: number): void {
    this.activeBlocksSubject.next({});
  }

  private handleIncomingEvent(event: BmcEvent): void {
    const current = this.activeBlocksSubject.value;
    if (event.type === 'TYPING') {
      current[event.block_name] = {
        isTyping: true,
        membreNom: event.membre_nom,
        typingText: event.typing_text
      };
    } else if (event.type === 'PROPOSAL_SENT') {
      current[event.block_name] = {
        isPending: true,
        membreNom: event.membre_nom,
        typingText: event.typing_text,
        proposalId: event.proposal_id
      };
    } else if (event.type === 'PROPOSAL_REVIEWED') {
      delete current[event.block_name];
    }
    this.activeBlocksSubject.next({ ...current });
  }

  sendEvent(startupId: number, event: any): void {
    this.rxStomp.publish({
      destination: `/app/bmc/${startupId}/event`,
      body: JSON.stringify(event),
    });
  }

  sendProposal(startupId: number, event: any): void {
    this.rxStomp.publish({
      destination: `/app/bmc/${startupId}/propose`,
      body: JSON.stringify(event),
    });
  }

  sendReview(startupId: number, event: any): void {
    this.rxStomp.publish({
      destination: `/app/bmc/${startupId}/review`,
      body: JSON.stringify(event),
    });
  }
}
