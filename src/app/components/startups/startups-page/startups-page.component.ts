import { Component, OnInit, ViewChild } from '@angular/core';
import { StatusModalComponent } from '../status-modal/status-modal.component';
import { EditStartupModalComponent } from '../edit-startup-modal/edit-startup-modal.component';
import { Startup } from '../../../models/startup';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-startups-page',
  templateUrl: './startups-page.component.html',
  styleUrls: ['./startups-page.component.css']
})
export class StartupsPageComponent implements OnInit {
  @ViewChild('statusModal') statusModal!: StatusModalComponent;
  @ViewChild('editModal') editModal!: EditStartupModalComponent;

  selectedStartupToEdit: Startup | null = null;
  currentUsername: string = 'Ahmed';

  constructor(private authService: AuthService) { }

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (user && user.username) {
      this.currentUsername = user.username;
    }
  }

  onOpenStatusModal(event: {startup: Startup, index: number}): void {
    this.statusModal.open(event.startup, event.index);
  }

  onOpenEditModal(startup: Startup): void {
    // Clone the startup to avoid direct binding to the list before save
    this.selectedStartupToEdit = { ...startup };
  }

  onCloseEditModal(): void {
    this.selectedStartupToEdit = null;
  }
}
