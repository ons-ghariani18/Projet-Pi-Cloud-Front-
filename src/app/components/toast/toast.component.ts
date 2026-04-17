import { Component, OnInit } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent implements OnInit {
  message: string | null = null;

  constructor(private toastService: ToastService) { }

  ngOnInit(): void {
    this.toastService.message$.subscribe(msg => {
      this.message = msg;
    });
  }
}
