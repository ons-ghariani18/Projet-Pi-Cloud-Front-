import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { PaiementService, PaymentRequest, PaymentResponse } from '../paiement.service';

@Component({
  selector: 'app-payment-modal',
  templateUrl: './payment-modal.component.html',
  styleUrls: ['./payment-modal.component.css']
})
export class PaymentModalComponent implements OnInit {

  @Input() inscriptionId!: number;
  @Input() formationTitle: string = '';
  @Input() amount: number = 50;

  @Output() closed = new EventEmitter<void>();
  @Output() paymentSuccess = new EventEmitter<PaymentResponse>();

  // Form fields
  cardHolder = '';
  cardNumber = '';
  expiryMM = '';
  expiryYY = '';
  cvv = '';

  // UI state
  loading = false;
  errorMsg = '';
  successData: PaymentResponse | null = null;
  cardType = '';
  cardFlipped = false;

  constructor(private paiementService: PaiementService) {}

  ngOnInit(): void {}

  // ─── Card number formatting ───────────────────────────────────────────────
  onCardInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '').substring(0, 16);
    this.cardNumber = val.replace(/(.{4})/g, '$1 ').trim();
    input.value = this.cardNumber;
    this.detectCardType(val);
  }

  detectCardType(digits: string) {
    if (/^4/.test(digits))            this.cardType = 'visa';
    else if (/^5[1-5]|^2[2-7]/.test(digits)) this.cardType = 'mastercard';
    else if (/^3[47]/.test(digits))   this.cardType = 'amex';
    else if (/^6/.test(digits))       this.cardType = 'discover';
    else                              this.cardType = '';
  }

  onExpiryInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) {
      this.expiryMM = val.substring(0, 2);
      this.expiryYY = val.substring(2, 4);
      input.value = val.substring(0, 2) + '/' + val.substring(2);
    } else {
      this.expiryMM = val.substring(0, 2);
      this.expiryYY = '';
      input.value = val;
    }
  }

  onCvvFocus()  { this.cardFlipped = true; }
  onCvvBlur()   { this.cardFlipped = false; }

  // ─── Masked card for preview ──────────────────────────────────────────────
  get maskedPreview(): string {
    const digits = this.cardNumber.replace(/\s/g, '');
    const groups = [];
    for (let i = 0; i < 4; i++) {
      const chunk = digits.substring(i * 4, i * 4 + 4);
      groups.push(chunk.padEnd(4, '•'));
    }
    return groups.join('  ');
  }

  get expiryPreview(): string {
    const mm = this.expiryMM || 'MM';
    const yy = this.expiryYY || 'YY';
    return `${mm}/${yy}`;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  submit() {
    this.errorMsg = '';
    if (!this.cardHolder.trim()) { this.errorMsg = 'Please enter the cardholder name.'; return; }
    if (this.cardNumber.replace(/\s/g, '').length < 13) { this.errorMsg = 'Please enter a valid card number.'; return; }
    if (!this.expiryMM || !this.expiryYY) { this.errorMsg = 'Please enter the expiry date.'; return; }
    if (!this.cvv || this.cvv.length < 3) { this.errorMsg = 'Please enter the CVV.'; return; }

    this.loading = true;
    const req: PaymentRequest = {
      inscriptionId: this.inscriptionId,
      cardNumber: this.cardNumber.replace(/\s/g, ''),
      expiryMM: this.expiryMM,
      expiryYY: this.expiryYY,
      cvv: this.cvv,
      cardHolder: this.cardHolder,
      amount: this.amount
    };

    this.paiementService.payer(req).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.successData = res;
          this.paymentSuccess.emit(res);
        } else {
          this.errorMsg = res.error || 'Payment failed. Please try again.';
        }
      },
      error: (err) => {
        this.loading = false;
        const body = err?.error;
        this.errorMsg = (body?.error) || 'Server error. Please try again.';
      }
    });
  }

  close() { this.closed.emit(); }
}
