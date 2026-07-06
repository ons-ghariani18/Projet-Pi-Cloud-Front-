import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';

interface Participant {
  id: number;
  nom: string;
  initials: string;
  role: 'EXPERT' | 'ENTREPRENEUR';
  isSpeaking: boolean;
  isMuted: boolean;
}

interface ChatMessage {
  id: number;
  auteur: string;
  initials: string;
  userRole: 'EXPERT' | 'ENTREPRENEUR';
  contenu: string;
  type: 'TEXT' | 'CODE' | 'SYSTEM' | 'SYSTEM_TRANSCRIPTION' | 'VOICE_WARNING';
  langage?: string;
  heure: string;
  isOwn: boolean;
}

import { WebsocketService } from './websocket.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-live-room',
  templateUrl: './live-room.component.html',
  styleUrls: ['./live-room.component.css']
})
export class LiveRoomComponent implements OnInit, OnDestroy {

  @ViewChild('chatBox') chatBox!: ElementRef;
  @ViewChild('wbCanvas') wbCanvasRef?: ElementRef<HTMLCanvasElement>;

  roomTitle = 'Chargement…';
  roomTheme = '💬 Salle Live';
  sessionTimer = '00:00';
  private timerInterval: any;
  private elapsedSeconds = 0;

  isMicOn = false;
  isMuted = false;
  isSpeakerOn = true;
  isPTTActive = false;
  volume = 70;

  isModerateur = false;

  currentUser: { id: number; nom: string; initials: string; role: 'EXPERT' | 'ENTREPRENEUR' } = {
    id: 0,
    nom: this.getStoredUsername(),
    initials: this.getStoredUsername().substring(0, 2).toUpperCase(),
    role: this.getStoredRole()
  };

  showRules = false;
  isCodeMode = false;
  messageInput = '';
  codeInput = '';
  selectedLang = 'Java';
  warningCount = 0;
  signalements = 0;
  isEnded = false;

  viewMode: 'chat' | 'whiteboard' = 'chat';

  // ✅ Whiteboard Canvas natif (zéro cache, zéro IndexedDB, reset instantané)
  wbTool: 'pen' | 'eraser' = 'pen';
  wbColor = '#1e293b';
  wbStrokeWidth: number = 4;
  private wbIsDrawing = false;
  private wbPrevX = 0;
  private wbPrevY = 0;
  private wbCanvas?: HTMLCanvasElement;
  private wbCtx?: CanvasRenderingContext2D;
  private wbThrottleTimer?: any;

  isRoomLoaded = false;

  participants: Participant[] = [];
  messages: ChatMessage[] = [];

  private spamTracker: Map<number, number[]> = new Map();
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private micStream?: MediaStream;
  private voiceDetectionInterval?: any;
  private roomId = '1';
  roomDurationMinutes: number = 60;

  // 📹 Enregistrement de session (comme Google Meet)
  private screenRecorder?: MediaRecorder;
  private screenChunks: Blob[] = [];
  private screenStream?: MediaStream;
  isRecording = false;
  recordingUploading = false;
  recordingUrl: string | null = null;

  private readonly SPRING_URL = 'http://localhost:8080';
  private readonly WHISPER_URL = 'http://localhost:9000';

  constructor(
    private wsService: WebsocketService,
    private http: HttpClient,
    private route: ActivatedRoute
  ) { }

  // ─── Helpers localStorage ───────────────────────────────────────────────────

  private getStoredUsername(): string {
    try {
      // 1. JWT key
      const fromJwt = localStorage.getItem('username');
      if (fromJwt && fromJwt.trim() && fromJwt !== 'Visiteur') return fromJwt.trim();
      // 2. Fallback IdeaLab
      const auth = localStorage.getItem('flexbidaya_auth');
      if (auth) return JSON.parse(auth).username || 'Visiteur';
    } catch { }
    return 'Visiteur';
  }

  private getStoredRole(): 'EXPERT' | 'ENTREPRENEUR' {
    try {
      const rolesJson = localStorage.getItem('roles');
      if (rolesJson) {
        const roles: string[] = JSON.parse(rolesJson);
        if (roles.includes('ROLE_EXPERT') || roles.includes('ROLE_ORGANISATEUR')) return 'EXPERT';
        return 'ENTREPRENEUR';
      }
      const auth = localStorage.getItem('flexbidaya_auth');
      if (auth) {
        const roles: string[] = JSON.parse(auth).roles || [];
        return roles.includes('ROLE_EXPERT') ? 'EXPERT' : 'ENTREPRENEUR';
      }
    } catch { }
    return 'ENTREPRENEUR';
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.startTimer();
    const roomId = this.route.snapshot.paramMap.get('roomId') || '1';
    this.roomId = roomId;
    this.loadCurrentUser(roomId);
    // Whiteboard initialisé depuis le backend (whiteboardSessionKey UUID)
    // → ne pas mettre de fallback ici, initRoom() le fera
  }

  private loadCurrentUser(roomId: string): void {
    let username = this.getStoredUsername();

    // Si toujours "Visiteur" ici, l'utilisateur n'est pas identifié — on s'assure d'avoir un nom
    if (username === 'Visiteur') {
      const nom = prompt('Entrez votre prénom/pseudo pour participer à la salle :');
      username = (nom && nom.trim()) ? nom.trim() : `User_${Math.floor(1000 + Math.random() * 9000)}`;
      const storedAuth = localStorage.getItem('flexbidaya_auth');
      let roles = ['ROLE_ENTREPRENEUR'];
      try { roles = JSON.parse(storedAuth || '{}').roles || roles; } catch { }
      localStorage.setItem('flexbidaya_auth', JSON.stringify({ username, roles }));
    }

    const storedRole = this.getStoredRole();

    // Initialisation immédiate depuis localStorage — ne bloque pas le démarrage
    this.currentUser = {
      id: 0,
      nom: username,
      initials: username.substring(0, 2).toUpperCase(),
      role: storedRole
    };
    this.isModerateur = storedRole === 'EXPERT';

    // Démarrer la salle sans attendre le backend
    this.initRoom(roomId);

    // Enrichissement best-effort depuis le backend
    this.http.get<any>(`${this.SPRING_URL}/users/by-username?username=${encodeURIComponent(username)}`).subscribe({
      next: (user) => {
        const roleNames: string[] = (user.roles || []).map((r: any) =>
          typeof r === 'string' ? r : r.name
        );
        const isExpert = roleNames.some(r => r === 'ROLE_EXPERT' || r === 'EXPERT');
        this.currentUser = {
          id: user.id,
          nom: user.username || username,
          initials: (user.username || username).substring(0, 2).toUpperCase(),
          role: isExpert ? 'EXPERT' : 'ENTREPRENEUR'
        };
        this.isModerateur = isExpert;
        console.log(`✅ Profil enrichi depuis backend : ${user.username} [${isExpert ? 'EXPERT' : 'ENTREPRENEUR'}]`);
      },
      error: () => {
        console.warn(`⚠️ Utilisateur "${username}" non trouvé en BD — profil localStorage utilisé.`);
      }
    });
  }

  private initRoom(roomId: string): void {
    this.http.get<any>(`${this.SPRING_URL}/api/rooms/${roomId}`).subscribe({
      next: (room) => {
        this.roomTitle = room.titre || 'Salle Live';
        this.roomTheme = (room.themeEmoji || '💬') + ' ' + (room.theme || 'Général');
        this.roomDurationMinutes = room.dureeMinutes != null ? room.dureeMinutes : 60;

        if (room.recordingUrl) {
          this.recordingUrl = room.recordingUrl;
        }

        if (room.endedAt != null || room.isActive === false) {
          this.isEnded = true;
        } else if (room.createdAt && this.roomDurationMinutes > 0) {
          const diffMin = (Date.now() - new Date(room.createdAt).getTime()) / 60000;
          if (diffMin >= this.roomDurationMinutes) this.isEnded = true;
        }
        this.isRoomLoaded = true;
        setTimeout(() => this.initCanvas(), 100);
      },
      error: () => {
        this.roomTitle = 'Salle Live';
        this.roomTheme = '💬 Général';
        this.isRoomLoaded = true;
        setTimeout(() => this.initCanvas(), 100);
      }
    });

    // ÉTAPE 1 — Écouter les messages WebSocket
    this.wsService.getMessages().subscribe(msg => {
      if (msg.type === 'RETRACT') {
        this.messages = this.messages.filter(m => m.id !== msg.messageId);
        this.addSystemMessage('⚠️ Un message a été retiré par la modération IA.');
        return;
      }

      // Whiteboard reset (moderator) → canvas is simply cleared
      if ((msg as any).type === 'WHITEBOARD_RESET') {
        this.clearCanvas();
        this.addSystemMessage('🔄 Le tableau blanc a été réinitialisé par le modérateur.');
        return;
      }

      // Whiteboard stroke/clear → draw on local canvas
      if ((msg as any).type === 'WB_STROKE') {
        const s = msg as any;
        this.drawStroke(s.x1, s.y1, s.x2, s.y2, s.color, s.width);
        return;
      }
      if ((msg as any).type === 'WB_CLEAR') {
        if (this.wbCtx && this.wbCanvas) {
          this.wbCtx.fillStyle = '#ffffff';
          this.wbCtx.fillRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);
        }
        return;
      }

      if (msg.type === 'VOICE_WARNING') {
        this.warningCount++;
        this.addSystemMessage(
          `🚨 Propos inappropriés détectés dans le vocal de ${msg.auteur}. Avertissement ${this.warningCount}/3`
        );
        if (this.warningCount >= 3 && msg.auteur === this.currentUser.nom) {
          this.isMuted = true;
          this.addSystemMessage('⛔ Vous avez été muté par le système IA.');
        }
        return;
      }

      // Intercept early termination message
      if (msg.contenu === '🔴_ROOM_FORCE_ENDED') {
        this.isEnded = true;
        this.addSystemMessage('🔴 Le modérateur a mis fin au direct. La salle est maintenant en mode Record.');
        return;
      }

      const isSystem = ['SYSTEM', 'SYSTEM_TRANSCRIPTION'].includes(msg.type);
      if (isSystem || msg.auteur !== this.currentUser.nom) {
        this.messages.push({
          id: msg.id || Date.now(),
          auteur: msg.auteur,
          initials: msg.initials,
          userRole: msg.userRole as any,
          contenu: msg.contenu,
          type: msg.type as any,
          langage: msg.langage,
          heure: msg.heure,
          isOwn: false
        });
        this.scrollToBottom();
      }
    });

    // ÉTAPE 2 — Écouter les participants
    this.wsService.getParticipants().subscribe((event: any) => {
      if (event && event.participants) {
        this.participants = event.participants.map((p: any) => ({
          id: p.id || Date.now(),
          nom: p.nom,
          initials: p.initials || (p.nom ? p.nom.substring(0, 2).toUpperCase() : '?'),
          role: p.role || 'ENTREPRENEUR',
          isSpeaking: false,
          isMuted: false
        }));
      }
      if (event.action === 'JOIN') {
        const last = event.participants[event.participants.length - 1];
        this.addSystemMessage(`🟢 ${last?.nom || 'Quelqu\'un'} a rejoint la salle.`);
      } else if (event.action === 'LEAVE') {
        this.addSystemMessage('🔴 Un participant a quitté la salle.');
      }
    });

    // ÉTAPE 3 — Rejoindre la salle
    this.wsService.joinRoom(roomId, {
      id: this.currentUser.id,
      nom: this.currentUser.nom,
      initials: this.currentUser.initials,
      role: this.currentUser.role
    });

    // ✅ FIX PARTICIPANTS : ajout optimiste immédiat (sans attendre la réponse WebSocket)
    // → l'utilisateur se voit dans la liste même si le WS met du temps à répondre.
    // → remplacé par la liste complète du serveur dès réception de l'event JOIN.
    if (!this.participants.find(p => p.nom === this.currentUser.nom)) {
      this.participants.push({
        id: this.currentUser.id || Date.now(),
        nom: this.currentUser.nom,
        initials: this.currentUser.initials,
        role: this.currentUser.role,
        isSpeaking: false,
        isMuted: false
      });
    }

    // ÉTAPE 4 — Charger l'historique des messages
    this.http.get<any[]>(`${this.SPRING_URL}/api/rooms/${roomId}/messages`).subscribe({
      next: (historique) => {
        // Vérifier si la salle a été fermée manuellement
        const forceEnded = historique.some(h => h.contenu === '🔴_ROOM_FORCE_ENDED');
        if (forceEnded) {
          this.isEnded = true;
        }

        const histMsgs = historique
          .filter(h => h.contenu !== '🔴_ROOM_FORCE_ENDED') // ne pas afficher le tag technique
          .map(h => ({
            id: h.id,
            auteur: h.auteur,
            initials: h.initials,
            userRole: h.userRole,
            contenu: h.contenu,
            type: h.type,
            heure: new Date(h.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            isOwn: h.auteur === this.currentUser.nom
          }));
        this.messages = [...histMsgs, ...this.messages];
        if (forceEnded) {
          this.addSystemMessage('🔴 Ce live a été terminé par le modérateur et est en mode Record.');
        }
        this.scrollToBottom();
      },
      error: (err) => console.error("Impossible de charger l'historique", err)
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.voiceDetectionInterval) clearInterval(this.voiceDetectionInterval);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
    if (this.micStream) this.micStream.getTracks().forEach(t => t.stop());
    if (this.audioContext) this.audioContext.close();
    this.wsService.leaveRoom(this.roomId, { nom: this.currentUser.nom });
  }

  // ─── Whiteboard ──────────────────────────────────────────────────────────────

  /**
   * ✅ FIX WHITEBOARD COMPLET
   *
   * On n'utilise PLUS pseudoHash (risque de collision + format clé incorrect).
   * On utilise l'UUID backend DIRECTEMENT dans l'URL Excalidraw :
   *   - Room ID (20 chars hex) = premiers 20 chars de l'UUID
   *   - Key    (22 chars hex) = chars 10−32 de l'UUID (chevauchement intentionnel)
   *
   * → UUID unique par salle en BD = URL Excalidraw unique par salle = whiteboard vierge.
   * → Si plusieurs participants rejoignent la même salle, même UUID = même URL = partage OK.
   * → Pas de localStorage, pas de pseudoHash, pas de collision.
   */
  private buildExcalidrawUrl(roomId: string, sessionKey: string | null): string {
    let hexKey: string;

    if (sessionKey && sessionKey.replace(/-/g, '').length >= 20) {
      // UUID backend : ex. "9d5c2f3a8b1e4d6f0c7a2e5b9d3f1a8c" (32 hex chars)
      hexKey = sessionKey.replace(/-/g, '');
    } else {
      // Fallback éphémère si le backend n'a pas de clé (ne devrait pas arriver)
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      hexKey = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      console.warn('⚠️ Whiteboard : pas de sessionKey backend, URL éphémère générée');
    }

    const excalidrawRoomId = hexKey.substring(0, 20);
    const excalidrawKey = hexKey.substring(10, 32);  // 22 chars
    return `https://excalidraw.com/#room=${excalidrawRoomId},${excalidrawKey}`;
  }

  toggleWhiteboard(): void {
    this.viewMode = this.viewMode === 'chat' ? 'whiteboard' : 'chat';
    if (this.viewMode === 'whiteboard') {
      setTimeout(() => this.initCanvas(), 80);
    }
  }

  openWhiteboardTab(): void { window.open(this.buildExcalidrawUrl(this.roomId, null), '_blank', 'noopener,noreferrer'); }

  // ─── Canvas Whiteboard ───────────────────────────────────────────────
  initCanvas(): void {
    const el = this.wbCanvasRef?.nativeElement;
    if (!el) return;
    this.wbCanvas = el;
    const container = el.parentElement;
    if (container) {
      el.width = container.clientWidth || 1200;
      el.height = (container.clientHeight || 700) - 36; // marge footer
    }
    this.wbCtx = el.getContext('2d') || undefined;
    if (this.wbCtx) {
      this.wbCtx.fillStyle = '#ffffff';
      this.wbCtx.fillRect(0, 0, el.width, el.height);
    }
  }

  wbMouseDown(e: MouseEvent): void {
    if (!this.wbCanvas) this.initCanvas();
    if (!this.wbCtx || !this.wbCanvas) return;
    this.wbIsDrawing = true;
    const rect = this.wbCanvas.getBoundingClientRect();
    this.wbPrevX = (e.clientX - rect.left) * (this.wbCanvas.width / rect.width);
    this.wbPrevY = (e.clientY - rect.top) * (this.wbCanvas.height / rect.height);
  }

  wbMouseMove(e: MouseEvent): void {
    if (!this.wbIsDrawing || !this.wbCtx || !this.wbCanvas) return;
    const rect = this.wbCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.wbCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.wbCanvas.height / rect.height);
    const color = this.wbTool === 'eraser' ? '#ffffff' : this.wbColor;
    const width = this.wbTool === 'eraser' ? this.wbStrokeWidth * 5 : this.wbStrokeWidth;
    this.drawStroke(this.wbPrevX, this.wbPrevY, x, y, color, width);
    // Émission WebSocket throttleée (max 30 fps)
    if (!this.wbThrottleTimer) {
      const px = this.wbPrevX, py = this.wbPrevY;
      this.wbThrottleTimer = setTimeout(() => {
        this.wsService.sendWhiteboard(this.roomId, { type: 'WB_STROKE', x1: px, y1: py, x2: x, y2: y, color, width });
        this.wbThrottleTimer = undefined;
      }, 33);
    }
    this.wbPrevX = x;
    this.wbPrevY = y;
  }

  wbMouseUp(): void { this.wbIsDrawing = false; }

  drawStroke(x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
    if (!this.wbCtx) return;
    this.wbCtx.beginPath();
    this.wbCtx.moveTo(x1, y1);
    this.wbCtx.lineTo(x2, y2);
    this.wbCtx.strokeStyle = color;
    this.wbCtx.lineWidth = width;
    this.wbCtx.lineCap = 'round';
    this.wbCtx.lineJoin = 'round';
    this.wbCtx.stroke();
  }

  clearCanvas(): void {
    if (!this.wbCanvas) this.initCanvas();
    if (this.wbCtx && this.wbCanvas) {
      this.wbCtx.fillStyle = '#ffffff';
      this.wbCtx.fillRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);
    }
    this.wsService.sendWhiteboard(this.roomId, { type: 'WB_CLEAR' });
  }


  // ─── Vocal ───────────────────────────────────────────────────────────────────

  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private isRecordingSegment = false;
  private silenceTimer?: any;
  private readonly SILENCE_THRESHOLD = 20;
  private readonly SILENCE_DURATION = 1500;

  private async initVoiceDetection(): Promise<void> {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.micStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      this.mediaRecorder = new MediaRecorder(this.micStream, { mimeType });
      this.mediaRecorder.ondataavailable = (e: any) => { if (e.data.size > 0) this.audioChunks.push(e.data); };
      this.mediaRecorder.onstop = () => this.envoyerSegmentVocal();

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.voiceDetectionInterval = setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = avg > this.SILENCE_THRESHOLD && this.isMicOn && !this.isMuted;
        const self = this.participants.find(p => p.nom === this.currentUser.nom);
        if (self) self.isSpeaking = isSpeaking;

        if (isSpeaking) {
          if (!this.isRecordingSegment && this.mediaRecorder?.state === 'inactive') {
            this.isRecordingSegment = true; this.audioChunks = []; this.mediaRecorder.start();
          }
          clearTimeout(this.silenceTimer);
          this.silenceTimer = setTimeout(() => {
            if (this.isRecordingSegment && this.mediaRecorder?.state === 'recording') {
              this.isRecordingSegment = false; this.mediaRecorder.stop();
            }
          }, this.SILENCE_DURATION);
        }
      }, 200);
    } catch (err) { console.warn('⚠️ Accès micro refusé:', err); }
  }

  private async envoyerSegmentVocal(): Promise<void> {
    if (this.audioChunks.length === 0) return;
    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
    if (blob.size < 500) return;
    const formData = new FormData();
    formData.append('audio', blob, 'voice_segment.webm');
    formData.append('roomId', this.roomId);
    formData.append('username', this.currentUser.nom);
    try {
      const res = await fetch(`${this.WHISPER_URL}/transcribe`, { method: 'POST', body: formData });
      const result = await res.json();
      console.log(`🗣️ Whisper : action=${result.action} → "${result.transcription}"`);

      // ✅ FIX VOCAL : afficher le résultat dans le chat si harcèlement détecté
      if (result.action === 'HARASSED') {
        this.warningCount++;
        this.addSystemMessage(
          `🚨 Propos inappropriés détectés dans votre vocal. Avertissement ${this.warningCount}/3`
        );
        if (this.warningCount >= 3) {
          this.isMuted = true;
          this.addSystemMessage('⛔ Vous avez été muté par le système IA après 3 avertissements.');
        }
      } else if (result.transcription && result.transcription.trim().length > 0) {
        // Double check with Java backend moderation
        this.http.post<{ isHarassment: boolean }>(`${this.SPRING_URL}/api/moderation/check`, { text: result.transcription }).subscribe({
          next: (modRes) => {
            if (modRes.isHarassment) {
              this.warningCount++;
              this.addSystemMessage(`🚨 Propos inappropriés détectés dans votre vocal. Avertissement ${this.warningCount}/3`);
              if (this.warningCount >= 3) {
                this.isMuted = true;
                this.addSystemMessage('⛔ Vous avez été muté par le système IA après 3 avertissements.');
              }
            } else {
              this.addSystemMessage(`🎤 ${this.currentUser.nom} : "${result.transcription}"`);
            }
          },
          error: () => {
            this.addSystemMessage(`🎤 ${this.currentUser.nom} : "${result.transcription}"`);
          }
        });
      }
    } catch {
      console.warn('⚠️ Whisper indisponible — fallback Web Speech API');
      this.detecterVoixClientSide();
    }
  }

  private detecterVoixClientSide(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const texte = event.results[0][0].transcript;
      this.http.post<{ isHarassment: boolean }>(`${this.SPRING_URL}/api/moderation/check`, { text: texte }).subscribe({
        next: (res) => {
          const ep = res.isHarassment ? 'voice-alert' : 'transcription';
          this.http.post(`${this.SPRING_URL}/api/rooms/${this.roomId}/${ep}`, {
            username: this.currentUser.nom, transcription: texte
          }).subscribe({ error: () => { } });
        },
        error: () => {
          this.http.post(`${this.SPRING_URL}/api/rooms/${this.roomId}/transcription`, {
            username: this.currentUser.nom, transcription: texte
          }).subscribe({ error: () => { } });
        }
      });
    };
    recognition.onerror = (e: any) => console.warn('[Fallback SR] Erreur:', e.error);
    recognition.start();
  }

  // ─── Messages texte ──────────────────────────────────────────────────────────

  // ✅ FIX DÉTECTION HARCÈLEMENT TEXTE
  // - Ajout de logs pour diagnostiquer
  // - Si l'endpoint /api/moderation/check répond isHarassment=true → bloque le message
  // - Sinon → diffuse normalement
  envoyerMessage(): void {
    const txt = this.messageInput.trim();
    if (!txt || this.isMuted || this.isEnded) return;

    if (this.isSpam()) {
      this.warningCount++;
      this.addSystemMessage(`⏱️ Envoi trop rapide. Avertissement ${this.warningCount}/3`);
      if (this.warningCount >= 3) {
        this.isMuted = true;
        this.addSystemMessage('⛔ Muté pour spam.');
      }
      return;
    }

    console.log('📤 Vérification modération pour:', txt);

    this.http.post<{ isHarassment: boolean }>(
      `${this.SPRING_URL}/api/moderation/check`,
      { text: txt }
    ).subscribe({
      next: (res) => {
        console.log('🔍 Résultat modération:', res);
        if (res.isHarassment) {
          this.bloquerMessage();
        } else {
          this.diffuserMessage(txt);
        }
      },
      error: (err) => {
        // ✅ Log l'erreur pour diagnostiquer — puis diffuse en fallback
        console.error('❌ Erreur endpoint modération:', err.status, err.message);
        console.warn('⚠️ Modération indisponible — message diffusé sans vérification');
        this.diffuserMessage(txt);
      }
    });
  }

  private bloquerMessage(): void {
    this.warningCount++;
    this.addSystemMessage(`⚠️ Message bloqué par la modération. Avertissement ${this.warningCount}/3`);
    this.messageInput = '';
    if (this.warningCount >= 3) {
      this.isMuted = true;
      this.addSystemMessage('⛔ Muté automatiquement après 3 avertissements.');
    }
  }

  private diffuserMessage(txt: string): void {
    this.addMessage({ type: 'TEXT', contenu: txt });
    this.wsService.sendMessage(this.roomId, {
      auteur: this.currentUser.nom,
      initials: this.currentUser.initials,
      userRole: this.currentUser.role,
      contenu: txt, type: 'TEXT', langage: null
    });
    this.messageInput = '';
  }

  // ─── Timer session ───────────────────────────────────────────────────────────

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (this.isEnded) { clearInterval(this.timerInterval); return; }
      this.elapsedSeconds++;

      if (this.roomDurationMinutes > 0) {
        const limitSec = this.roomDurationMinutes * 60;
        if (this.elapsedSeconds >= limitSec) {
          this.elapsedSeconds = limitSec; this.isEnded = true;
          clearInterval(this.timerInterval);
          this.addSystemMessage('🔴 SESSION TERMINÉE — Ce live est passé en mode Record.');
          // ✅ Sauvegarder la session en base de données
          this.saveSessionEnd(this.elapsedSeconds);
        }
      }

      const h = Math.floor(this.elapsedSeconds / 3600);
      const m = Math.floor((this.elapsedSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (this.elapsedSeconds % 60).toString().padStart(2, '0');
      this.sessionTimer = h > 0 ? `${h.toString().padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
    }, 1000);
  }

  /**
   * ✅ Enregistre la fin de session en base de données via l'API backend.
   * Appelé automatiquement quand le timer expire ou manuellement par le modérateur.
   */
  private saveSessionEnd(durationSeconds: number): void {
    const roomIdNum = Number(this.roomId);
    if (!roomIdNum) return;

    const payload = {
      actualDurationSeconds: durationSeconds,
      participantCount: this.participants.length,
      endedBy: this.currentUser.nom
    };

    this.http.post(`${this.SPRING_URL}/api/rooms/${roomIdNum}/end`, payload).subscribe({
      next: (res: any) => {
        console.log('✅ Session sauvegardée en base :', res);
        this.addSystemMessage(`💾 Session archivée — Durée : ${this.sessionTimer} | ${this.participants.length} participant(s)`);
        // Arrêter et uploader l'enregistrement si actif
        this.stopAndUploadRecording();
      },
      error: (err) => {
        console.warn('⚠️ Impossible de sauvegarder la session :', err.message);
        this.stopAndUploadRecording();
      }
    });
  }

  // ─── Enregistrement de session (Google Meet style) ───────────────────────────

  /**
   * Démarre l'enregistrement de l'écran entier (onglet ou écran complet).
   * Le navigateur demande à l'utilisateur quelle fenêtre partager.
   */
  async startScreenRecording(): Promise<void> {
    if (this.isRecording) return;
    try {
      // Capture de l'écran
      this.screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 15, width: 1280, height: 720 },
        audio: true
      });

      this.screenChunks = [];
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      const mimeType = MediaRecorder.isTypeSupported(options.mimeType)
        ? options.mimeType
        : 'video/webm';

      if (!this.screenStream) return;
      this.screenRecorder = new MediaRecorder(this.screenStream, { mimeType });

      this.screenRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.screenChunks.push(e.data);
      };

      this.screenRecorder.onstop = () => {
        this.isRecording = false;
        this.screenStream?.getTracks().forEach(t => t.stop());
      };

      this.screenRecorder.start(5000); // chunk toutes les 5 secondes
      this.isRecording = true;
      this.addSystemMessage('🔴 Enregistrement démarré — La session est en cours d\'enregistrement.');
      console.log('📹 Enregistrement écran démarré');

    } catch (err: any) {
      console.warn('⚠️ Enregistrement annulé ou non supporté :', err.message);
      this.isRecording = false;
    }
  }

  /**
   * Arrête l'enregistrement et upload le fichier WebM sur le backend.
   */
  stopAndUploadRecording(): void {
    if (!this.screenRecorder || !this.isRecording) return;

    this.screenRecorder.onstop = () => {
      this.isRecording = false;
      this.screenStream?.getTracks().forEach(t => t.stop());

      if (this.screenChunks.length === 0) {
        console.warn('⚠️ Aucun chunk enregistré');
        return;
      }

      const blob = new Blob(this.screenChunks, { type: 'video/webm' });
      const roomIdNum = Number(this.roomId);
      if (!roomIdNum) return;

      this.recordingUploading = true;
      this.addSystemMessage('⏳ Upload de l\'enregistrement en cours… veuillez patienter.');

      const formData = new FormData();
      formData.append('file', blob, `session_room_${roomIdNum}.webm`);

      this.http.post<any>(`${this.SPRING_URL}/api/rooms/${roomIdNum}/upload-recording`, formData).subscribe({
        next: (res) => {
          this.recordingUploading = false;
          this.recordingUrl = res.recordingUrl;
          this.addSystemMessage(`✅ Enregistrement sauvegardé ! Disponible à : ${res.recordingUrl}`);
          console.log('✅ Recording uploaded:', res.recordingUrl);
        },
        error: (err) => {
          this.recordingUploading = false;
          console.error('❌ Erreur upload enregistrement :', err);
          this.addSystemMessage('❌ Erreur lors de la sauvegarde de l\'enregistrement.');
        }
      });
    };

    this.screenRecorder.stop();
  }

  /** Bouton toggle pour démarrer/arrêter l'enregistrement manuellement */
  toggleRecording(): void {
    if (this.isRecording) {
      this.stopAndUploadRecording();
    } else {
      this.startScreenRecording();
    }
  }

  // ─── Contrôles audio ─────────────────────────────────────────────────────────

  toggleMic(): void {
    if (this.isEnded) return;
    this.isMicOn = !this.isMicOn;
    if (this.isMicOn) {
      this.initVoiceDetection();
    } else {
      if (this.voiceDetectionInterval) clearInterval(this.voiceDetectionInterval);
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
      if (this.micStream) this.micStream.getTracks().forEach(t => t.stop());
      if (this.audioContext) { this.audioContext.close(); this.audioContext = undefined; }
      this.analyser = undefined; this.micStream = undefined;
      this.mediaRecorder = undefined; this.isRecordingSegment = false;
    }
  }

  toggleSpeaker(): void { this.isSpeakerOn = !this.isSpeakerOn; }
  startPTT(): void { if (!this.isMicOn) this.toggleMic(); this.isPTTActive = true; }
  stopPTT(): void { this.isPTTActive = false; }

  get isSelfSpeaking(): boolean {
    return this.participants.find(p => p.nom === this.currentUser.nom)?.isSpeaking ?? false;
  }

  // ─── Code ────────────────────────────────────────────────────────────────────

  envoyerCode(): void {
    if (!this.codeInput.trim()) return;
    const codeContent = this.codeInput.trim();
    this.addMessage({ type: 'CODE', contenu: codeContent, langage: this.selectedLang });
    this.wsService.sendMessage(this.roomId, {
      auteur: this.currentUser.nom, initials: this.currentUser.initials,
      userRole: this.currentUser.role, contenu: codeContent, type: 'CODE', langage: this.selectedLang
    });
    this.codeInput = ''; this.isCodeMode = false;
  }

  toggleCodeMode(): void { this.isCodeMode = !this.isCodeMode; this.codeInput = ''; }

  // ─── Modération ──────────────────────────────────────────────────────────────

  muterParticipant(p: Participant): void {
    p.isMuted = !p.isMuted; p.isSpeaking = false;
    this.addSystemMessage(p.isMuted ? `${p.nom} a été muté.` : `${p.nom} a été démuté.`);
  }

  expulserParticipant(p: Participant): void {
    if (confirm(`Expulser ${p.nom} de la salle ?`)) {
      this.participants = this.participants.filter(x => x.id !== p.id);
      this.addSystemMessage(`${p.nom} a été expulsé.`);
    }
  }

  /**
   * ✅ FIX WHITEBOARD : réinitialise le tableau blanc de la salle.
   * Génère un nouveau UUID côté backend → tous les participants rechargent
   * via l'event WebSocket WHITEBOARD_RESET.
   */
  resetWhiteboard(): void {
    if (!confirm('Réinitialiser le tableau blanc ? Tout le contenu sera perdu pour tous les participants.')) return;
    // Effacement local immédiat
    this.clearCanvas();
    // Notifier tous les participants via WebSocket
    this.wsService.sendWhiteboard(this.roomId, { type: 'WB_CLEAR' });
    console.log('✅ Whiteboard réinitialisé (canvas natif)');
  }

  signalerMessage(msg: ChatMessage): void { this.signalements++; alert('Message signalé.'); }
  copierCode(code: string): void { navigator.clipboard.writeText(code); }
  voirSignalements(): void { alert(`${this.signalements} message(s) signalé(s).`); }

  fermerSalle(): void {
    if (confirm('Mettre fin à ce direct ? La session sera sauvegardée et la salle passera en mode Record.')) {
      this.isEnded = true;
      clearInterval(this.timerInterval);

      // ✅ Sauvegarder la session en base de données
      this.saveSessionEnd(this.elapsedSeconds);

      // Envoie le flag technique au backend via WebSocket (pour notifier les participants)
      this.wsService.sendMessage(this.roomId, {
        auteur: 'Système', initials: '🤖', userRole: 'EXPERT',
        contenu: '🔴_ROOM_FORCE_ENDED', type: 'SYSTEM', langage: null
      });

      this.addSystemMessage('🔴 Vous avez mis fin au direct. La session a été sauvegardée en base de données.');
    }
  }

  shareRoom(): void { navigator.clipboard.writeText(window.location.href); alert('Lien copié !'); }
  leaveRoom(): void { if (confirm('Quitter la salle ?')) window.history.back(); }

  // ─── Helpers messages ────────────────────────────────────────────────────────

  private addMessage(data: Partial<ChatMessage>): void {
    this.messages.push({
      id: Date.now(), auteur: this.currentUser.nom, initials: this.currentUser.initials,
      userRole: this.currentUser.role, contenu: data.contenu || '',
      type: data.type || 'TEXT', langage: data.langage,
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      isOwn: true
    });
    this.scrollToBottom();
  }

  private addSystemMessage(text: string): void {
    this.messages.push({
      id: Date.now(), auteur: 'Système', initials: '🤖', userRole: 'ENTREPRENEUR',
      contenu: text, type: 'SYSTEM',
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      isOwn: false
    });
    this.scrollToBottom();
  }

  private isSpam(): boolean {
    const now = Date.now();
    const timestamps = this.spamTracker.get(this.currentUser.id) || [];
    const recent = timestamps.filter(t => now - t < 60000);
    recent.push(now);
    this.spamTracker.set(this.currentUser.id, recent);
    return recent.length > 5;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatBox) this.chatBox.nativeElement.scrollTop = this.chatBox.nativeElement.scrollHeight;
    }, 50);
  }
}