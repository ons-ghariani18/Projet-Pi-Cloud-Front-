import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ExchangeRateService, ExchangeRateResponse } from '../../services/exchange-rate.service';

@Component({
  selector: 'app-exchange-rate-modal',
  templateUrl: './exchange-rate-modal.component.html',
  styleUrls: ['./exchange-rate-modal.component.css']
})
export class ExchangeRateModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  rateData: ExchangeRateResponse | null = null;
  eurAmount: number | null = 1;
  tndAmount: number | null = null;
  loading: boolean = false;
  error: string | null = null;

  constructor(private exchangeRateService: ExchangeRateService) {}

  ngOnInit(): void {
    this.fetchRate();
  }

  fetchRate(): void {
    this.loading = true;
    this.error = null;
    this.exchangeRateService.getExchangeRate().subscribe({
      next: (data: any) => {
        this.rateData = data;
        this.loading = false;
        this.updateTndFromEur();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = 'Impossible de récupérer le taux de change.';
        console.error('Exchange rate error:', err);
      }
    });
  }

  updateTndFromEur(): void {
    if (this.rateData && this.eurAmount !== null) {
      this.tndAmount = Number((this.eurAmount * this.rateData.rate).toFixed(4));
    } else {
      this.tndAmount = null;
    }
  }

  updateEurFromTnd(): void {
    if (this.rateData && this.tndAmount !== null) {
      this.eurAmount = Number((this.tndAmount / this.rateData.rate).toFixed(4));
    } else {
      this.eurAmount = null;
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
