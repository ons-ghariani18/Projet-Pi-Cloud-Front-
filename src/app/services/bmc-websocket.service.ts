import { Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { Observable } from 'rxjs';
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

  connect(): void {
    this.rxStomp.configure({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 3000,
    });
    this.rxStomp.activate();
  }

  disconnect(): void {
    this.rxStomp.deactivate();
  }

  subscribe(startupId: number): Observable<BmcEvent> {
    return new Observable(observer => {
      this.rxStomp
        .watch(`/topic/bmc/${startupId}`)
        .subscribe(msg => {
          observer.next(JSON.parse(msg.body) as BmcEvent);
        });
    });
  }

  sendEvent(startupId: number, event: any): void {
    this.rxStomp.publish({
      destination: `/app/bmc/${startupId}/event`,
      body: JSON.stringify({
        type: event.type,
        startup_id: startupId,
        membre_nom: event.membreNom || event.membre_nom,
        block_name: event.blockName || event.block_name,
        typing_text: event.typingText || event.typing_text,
        cursor_x: event.cursorX || event.cursor_x,
        cursor_y: event.cursorY || event.cursor_y
      }),
    });
  }

  sendProposal(startupId: number, event: any): void {
    this.rxStomp.publish({
      destination: `/app/bmc/${startupId}/propose`,
      body: JSON.stringify({
        type: event.type,
        startup_id: startupId,
        membre_nom: event.membreNom || event.membre_nom,
        block_name: event.blockName || event.block_name,
        typing_text: event.typingText || event.typing_text,
        proposal_id: event.proposalId || event.proposal_id
      }),
    });
  }

  sendReview(startupId: number, event: any): void {
    this.rxStomp.publish({
      destination: `/app/bmc/${startupId}/review`,
      body: JSON.stringify({
        type: event.type,
        startup_id: startupId,
        membre_nom: event.membreNom || event.membre_nom,
        block_name: event.blockName || event.block_name,
        proposal_status: event.proposalStatus || event.proposal_status
      }),
    });
  }
}
