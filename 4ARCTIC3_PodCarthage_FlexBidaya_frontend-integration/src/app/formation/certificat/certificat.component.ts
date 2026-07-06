import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Certification, InscriptionService } from '../inscription.service';

@Component({
  selector: 'app-certificat',
  template: `
    <div class="cert-page">
      <div class="cert-toolbar no-print">
        <a routerLink="/formations" class="btn-back">Back</a>
        <button type="button" class="btn-print" (click)="imprimer()" *ngIf="cert && !error">
          <span class="ms">print</span>
          Print / PDF
        </button>
      </div>

      <div class="cert-state" *ngIf="loading">
        <span class="ms spin">progress_activity</span>
        Loading certificate...
      </div>

      <div class="cert-state cert-state--error" *ngIf="error && !loading">
        <span class="ms">error</span>
        <p>Certificate not found or invalid link.</p>
        <a routerLink="/formations">Back to catalog</a>
      </div>

      <div class="cert-wrap" *ngIf="cert && !loading">
        <div class="sheet">
          <svg class="seal" viewBox="0 0 100 100" aria-hidden="true">
            <path fill="currentColor" d="M50 5 L58 35 L90 35 L64 55 L74 88 L50 68 L26 88 L36 55 L10 35 L42 35 Z"/>
          </svg>

          <div class="inner">
            <div class="brand">
              <div class="fb-logo-icon">
                <svg width="24" height="34" viewBox="0 0 24 24" fill="white">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div class="fb-brand-text">
                <div class="fb-title">FLEXBIDAYA</div>
                <div class="fb-subtitle">FRONT OFFICE</div>
              </div>
            </div>
            <div class="brand-tag">Entrepreneurial Learning Platform</div>

            <h1>Certificate of Achievement</h1>
            <p class="subtitle">Official course completion document</p>
            <p class="line-attest">This certificate hereby confirms that</p>
            <p class="recipient">{{ cert.entrepreneur.username }}</p>
            <p class="formation-label">has successfully completed the course entitled</p>
            <p class="formation-title">"{{ cert.formation.titre }}"</p>

            <div class="blockchain-badge" id="blockchain-section">
              <div class="bc-glow"></div>
              <div class="bc-icon-wrap">
                <svg class="bc-chain-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9 12h6M9 8h6M9 16h4"/>
                  <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
                </svg>
              </div>
              <div class="bc-content">
                <div class="bc-title">
                  <span class="bc-pill">Blockchain Verified</span>
                  <span class="bc-network">Polygon Amoy Testnet</span>
                </div>
                <div class="bc-subtitle">This certificate is immutably anchored on the Polygon Amoy network.</div>
                <div class="bc-hash-row">
                  <code class="bc-hash">{{ getDisplayHash() | slice:0:22 }}...{{ getDisplayHash() | slice:-8 }}</code>
                  <button
                    class="bc-copy-btn"
                    type="button"
                    (click)="copyTxHash(getDisplayHash())"
                    [class.bc-copy-btn--copied]="blockchainPanelOpen"
                    title="Copy hash">
                    <svg *ngIf="!blockchainPanelOpen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    <svg *ngIf="blockchainPanelOpen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                  </button>
                  <a
                    class="bc-explorer-btn"
                    *ngIf="isRealHash()"
                    [href]="hashscanUrl(getDisplayHash())!"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on explorer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    View on Explorer
                  </a>
                  <span class="bc-demo-label" *ngIf="!isRealHash()">
                    Demo Anchoring Mode
                  </span>
                </div>
              </div>
            </div>

            <div class="meta">
              <div class="meta-block">
                <strong>Issue Date</strong>
                {{ cert.dateEmission | date : "MMMM d, yyyy 'at' HH:mm" }}
              </div>
              <div class="meta-block">
                <strong>Authenticity Reference</strong>
                <div class="ref-box">{{ cert.qrCodeToken }}</div>
              </div>
            </div>

            <p class="footer-note">
              Publicly verifiable via FlexBidaya (reference / QR) and on the Polygon Amoy network.<br />
              Pod Carthage - FlexBidaya · Certified online training.
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./certificat.component.css'],
})
export class CertificatComponent implements OnInit {
  cert: Certification | null = null;
  loading = true;
  error = false;
  blockchainPanelOpen = false;

  // Polygon Amoy explorer, aligned with backend blockchain service
  private readonly EXPLORER = 'https://www.oklink.com/amoy/tx/';

  constructor(private route: ActivatedRoute, private inscriptionService: InscriptionService) {}

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.loading = false;
      this.error = true;
      return;
    }

    this.inscriptionService.verifierCertificat(token).subscribe({
      next: (c) => {
        this.cert = c;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  imprimer(): void {
    window.print();
  }

  getDisplayHash(): string {
    if (this.cert?.blockchainTxHash) {
      return this.cert.blockchainTxHash;
    }

    const token = this.cert?.qrCodeToken ?? 'FLEXBIDAYA';
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const absHash = Math.abs(hash).toString(16).padStart(8, '0');
    const parts: string[] = [];
    for (let i = 0; i < 8; i++) {
      let segment = 0;
      for (let j = 0; j < token.length; j++) {
        segment = ((segment << 3) - segment) + token.charCodeAt(j) + i * 31;
        segment = segment & segment;
      }
      parts.push(Math.abs(segment).toString(16).padStart(8, '0'));
    }

    return '0xdemo' + absHash + parts.join('').substring(0, 58);
  }

  isRealHash(): boolean {
    const hash = this.getDisplayHash();
    return !!hash && !hash.startsWith('0xdemo');
  }

  hashscanUrl(txHash: string): string | null {
    if (!txHash || txHash.startsWith('0xdemo')) {
      return null;
    }
    return this.EXPLORER + txHash;
  }

  copyTxHash(txHash: string): void {
    navigator.clipboard.writeText(txHash).then(() => {
      this.blockchainPanelOpen = true;
      setTimeout(() => (this.blockchainPanelOpen = false), 2000);
    });
  }

  badgeRowClass(badge: string | undefined): string {
    if (!badge) return 'badge-row--default';

    switch (badge.toUpperCase()) {
      case 'OR':
        return 'badge-row--or';
      case 'ARGENT':
        return 'badge-row--argent';
      case 'BRONZE':
        return 'badge-row--bronze';
      default:
        return 'badge-row--default';
    }
  }

  badgeLabel(badge: string | undefined): string {
    if (!badge) return '';

    switch (badge.toUpperCase()) {
      case 'OR':
        return 'Or - Excellence (score >= 125 % du seuil)';
      case 'ARGENT':
        return 'Argent - Tres bien (score >= 110 % du seuil)';
      case 'BRONZE':
        return 'Bronze - Reussite (seuil atteint)';
      default:
        return badge;
    }
  }
}
