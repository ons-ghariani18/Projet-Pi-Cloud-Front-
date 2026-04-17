import { Component, OnInit, ViewChild } from '@angular/core';
import { StatusModalComponent } from '../status-modal/status-modal.component';
import { Startup } from '../../../models/startup';

@Component({
  selector: 'app-startups-page',
  templateUrl: './startups-page.component.html',
  styleUrls: ['./startups-page.component.css']
})
export class StartupsPageComponent implements OnInit {
  @ViewChild('statusModal') statusModal!: StatusModalComponent;

  constructor() { }

  ngOnInit(): void {
  }

  onOpenStatusModal(event: {startup: Startup, index: number}): void {
    this.statusModal.open(event.startup, event.index);
  }
}
