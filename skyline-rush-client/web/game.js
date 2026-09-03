/**
 * Skyline Rush — Playable Web Runner (Vantage City)
 * Full client engine connected to the Skyline Rush API Gateway.
 * Option A (Full Meta Screens), Option B (Observability), Option C (Visuals, Particles, Synth Audio)
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? window.location.origin
  : 'http://localhost:3000';

// Storage keys
const STORAGE_KEY_TOKEN = 'skyline_access_token';
const STORAGE_KEY_PLAYER_ID = 'skyline_player_id';
const STORAGE_KEY_DEVICE_ID = 'skyline_device_id';
const STORAGE_KEY_AGE_BUCKET = 'skyline_age_bucket';

// Generate UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// -------------------------------------------------------------
// API CLIENT
// -------------------------------------------------------------
const Api = {
  token: localStorage.getItem(STORAGE_KEY_TOKEN) || null,
  playerId: localStorage.getItem(STORAGE_KEY_PLAYER_ID) || null,
  deviceId: localStorage.getItem(STORAGE_KEY_DEVICE_ID) || null,
  ageBucket: localStorage.getItem(STORAGE_KEY_AGE_BUCKET) || '16_plus',

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    try {
      const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw data.error || { code: 'HTTP_ERROR', message: `Status ${res.status}` };
      }
      return data;
    } catch (err) {
      console.warn(`API Error on ${path}:`, err);
      throw err;
    }
  },

  async initAuth() {
    if (!this.deviceId) {
      this.deviceId = uuidv4();
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, this.deviceId);
    }
    try {
      const auth = await this.request('/v1/auth/guest', {
        method: 'POST',
        body: JSON.stringify({
          guest_device_id: this.deviceId,
          age_bucket: this.ageBucket
        })
      });
      this.token = auth.access_token;
      this.playerId = auth.player_id;
      this.ageBucket = auth.age_bucket || this.ageBucket;
      localStorage.setItem(STORAGE_KEY_TOKEN, this.token);
      localStorage.setItem(STORAGE_KEY_PLAYER_ID, this.playerId);
      localStorage.setItem(STORAGE_KEY_AGE_BUCKET, this.ageBucket);
      return auth;
    } catch (e) {
      console.error("Auth init failed:", e);
      return null;
    }
  },

  async getProfile() {
    return this.request('/v1/profile');
  },

  async getBalance() {
    return this.request('/v1/economy/balance');
  },

  async submitRun(meters, chips, durationSec, powerupsCount, runnerId = 'vex', boardId = 'ion-glide') {
    return this.request('/v1/runs', {
      method: 'POST',
      headers: { 'Idempotency-Key': uuidv4() },
      body: JSON.stringify({
        district_id: 'neo-marina',
        runner_id: runnerId,
        board_id: boardId,
        meters: Math.floor(meters),
        chips_collected: Math.floor(chips),
        duration_seconds: Math.max(1, Math.floor(durationSec)),
        powerups_collected: powerupsCount,
        crashed_cause: 'drone_collision',
        client_submitted_at: new Date().toISOString()
      })
    });
  },

  async redeploy(method, runId) {
    return this.request('/v1/runs/redeploy', {
      method: 'POST',
      headers: { 'Idempotency-Key': uuidv4() },
      body: JSON.stringify({
        run_id: runId,
        method: method,
        ad_receipt: method === 'ad' ? 'mock_ad_reward_receipt' : undefined
      })
    });
  },

  async getLeaderboard() {
    return this.request('/v1/leaderboard?district_id=neo-marina&limit=15');
  },

  async getSupplyDropTable() {
    return this.request('/v1/supply-drops/tables/standard-v7');
  },

  async openSupplyDrop(method = 'earned') {
    return this.request('/v1/supply-drops/open', {
      method: 'POST',
      headers: { 'Idempotency-Key': uuidv4() },
      body: JSON.stringify({ acquired_via: method })
    });
  },

  async getContracts() {
    return this.request('/v1/contracts/active');
  },

  async claimContract(contractId) {
    return this.request(`/v1/contracts/${contractId}/claim`, {
      method: 'POST',
      headers: { 'Idempotency-Key': uuidv4() }
    });
  },

  async getRoster() {
    return this.request('/v1/roster');
  },

  async equipRosterItem(itemType, itemId) {
    return this.request('/v1/roster/equip', {
      method: 'POST',
      body: JSON.stringify({ item_type: itemType, item_id: itemId })
    });
  },

  async unlockRosterItem(itemType, itemId) {
    return this.request('/v1/roster/unlock', {
      method: 'POST',
      headers: { 'Idempotency-Key': uuidv4() },
      body: JSON.stringify({ item_type: itemType, item_id: itemId })
    });
  },

  async getParentalGateChallenge() {
    return this.request('/v1/auth/parental-gate/challenge');
  },

  async verifyParentalGate(challengeToken, answer) {
    return this.request('/v1/auth/parental-gate/verify', {
      method: 'POST',
      body: JSON.stringify({ challenge_token: challengeToken, answer })
    });
  },

  async submitPurchaseReceipt(sku, transactionId, signedTransaction, parentalGateToken = null) {
    return this.request('/v1/purchases/receipt', {
      method: 'POST',
      headers: { 'Idempotency-Key': uuidv4() },
      body: JSON.stringify({
        sku,
        transaction_id: transactionId,
        signed_transaction: signedTransaction,
        parental_gate_token: parentalGateToken
      })
    });
  },

  async addFriend(code) {
    return this.request('/v1/friends/add', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },

  async exportData(parentalGateToken = null) {
    return this.request('/v1/privacy/data-export', {
      method: 'POST',
      body: JSON.stringify({ parental_gate_token: parentalGateToken })
    });
  },

  async deleteAccount(parentalGateToken = null) {
    return this.request('/v1/privacy/delete-account', {
      method: 'POST',
      body: JSON.stringify({ parental_gate_token: parentalGateToken })
    });
  }
};

// -------------------------------------------------------------
// DYNAMIC CYBERPUNK WEB AUDIO SYNTH ENGINE (OPTION C)
// -------------------------------------------------------------
const AudioSynth = {
  ctx: null,
  masterFilter: null,
  masterGain: null,
  sfxGain: null,
  musicGain: null,
  bassInterval: null,
  bassStep: 0,
  arpStep: 0,
  currentBpm: 128,
  isPlayingBass: false,
  sfxVolume: 0.8,
  musicVolume: 0.7,

  init() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();

          // RED-214: Bind onstatechange to pause/resume scheduling cleanly
          this.ctx.onstatechange = () => {
            if (!this.ctx) return;
            if (this.ctx.state === 'running') {
              if (this.isPlayingBass && !this.bassInterval) {
                this.scheduleNextNote();
              }
            } else if (this.ctx.state === 'suspended' || this.ctx.state === 'closed') {
              if (this.bassInterval) {
                clearTimeout(this.bassInterval);
                this.bassInterval = null;
              }
            }
          };

          // Master Lowpass Filter for Modal Muffling (20,000 Hz normal -> 380 Hz muffled)
          this.masterFilter = this.ctx.createBiquadFilter();
          this.masterFilter.type = 'lowpass';
          this.masterFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);
          this.masterFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

          // Gains
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

          this.sfxGain = this.ctx.createGain();
          this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);

          this.musicGain = this.ctx.createGain();
          this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);

          this.sfxGain.connect(this.masterFilter);
          this.musicGain.connect(this.masterFilter);
          this.masterFilter.connect(this.masterGain);
          this.masterGain.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {}
  },

  muffle(duration = 0.35) {
    if (!this.masterFilter || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.masterFilter.frequency.cancelScheduledValues(now);
      this.masterFilter.frequency.setValueAtTime(this.masterFilter.frequency.value, now);
      this.masterFilter.frequency.exponentialRampToValueAtTime(380, now + duration);
    } catch (e) {}
  },

  unmuffle(duration = 0.35) {
    if (!this.masterFilter || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.masterFilter.frequency.cancelScheduledValues(now);
      this.masterFilter.frequency.setValueAtTime(this.masterFilter.frequency.value, now);
      this.masterFilter.frequency.exponentialRampToValueAtTime(20000, now + duration);
    } catch (e) {}
  },

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  },

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  },

  beep(freq, duration, type = 'sine', gainVal = 0.15) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.sfxGain || this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },

  chip() { this.beep(880, 0.08, 'triangle', 0.15); },
  jump() { this.beep(340, 0.15, 'sine', 0.22); },
  slide() { this.beep(180, 0.18, 'sawtooth', 0.18); },
  crash() { this.beep(110, 0.35, 'square', 0.35); },
  powerup() {
    this.beep(520, 0.1, 'sine', 0.25);
    setTimeout(() => this.beep(780, 0.15, 'sine', 0.25), 80);
  },

  nearMiss() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const now = this.ctx.currentTime;
      // High-velocity Doppler sweep downward
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.22);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  },

  // 4-Bar Driving Synth Bassline Loop & 16th-Note Arp
  startBassline() {
    if (this.isPlayingBass) return;
    this.init();
    if (!this.ctx) {
      this.isPlayingBass = false;
      return;
    }
    this.isPlayingBass = true;
    this.bassStep = 0;
    this.arpStep = 0;
    this.scheduleNextNote();
  },

  stopBassline() {
    this.isPlayingBass = false;
    if (this.bassInterval) {
      clearTimeout(this.bassInterval);
      this.bassInterval = null;
    }
  },

  updateTempo(speed) {
    // Accelerate tempo dynamically with run speed (125 -> 165 BPM)
    this.currentBpm = Math.min(165, 125 + Math.max(0, speed - 240) * 0.15);
  },

  scheduleNextNote() {
    if (!this.ctx) {
      this.isPlayingBass = false;
      return;
    }
    if (!this.isPlayingBass || this.ctx.state !== 'running') return;

    const stepDuration = 60 / this.currentBpm / 4; // 16th note

    // 4-Bar Synth Bassline pattern in E minor
    const bassNotes = [
      41.2, 0, 41.2, 41.2,  41.2, 0, 49.0, 0,
      55.0, 0, 55.0, 0,     41.2, 41.2, 36.7, 0,
      41.2, 0, 41.2, 41.2,  41.2, 0, 61.7, 0,
      55.0, 0, 49.0, 0,     41.2, 0, 36.7, 30.9
    ];

    // High Arpeggiator notes in pentatonic minor
    const arpNotes = [
      329.63, 392.00, 493.88, 587.33, 659.25, 587.33, 493.88, 392.00,
      329.63, 392.00, 493.88, 659.25, 783.99, 659.25, 493.88, 392.00
    ];

    const noteFreq = bassNotes[this.bassStep % bassNotes.length];
    if (noteFreq > 0 && this.musicVolume > 0) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(noteFreq, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + stepDuration * 1.6);

        gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + stepDuration * 1.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain || this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + stepDuration * 1.6);
      } catch (e) {}
    }

    // Boost mode: Arpeggiator layer fades in dynamically!
    if (window.game && window.game.runner && window.game.runner.boostTimer > 0 && this.musicVolume > 0) {
      const arpFreq = arpNotes[this.arpStep % arpNotes.length];
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(arpFreq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + stepDuration * 0.9);

        osc.connect(gain);
        gain.connect(this.musicGain || this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + stepDuration * 0.9);
      } catch (e) {}
    }

    this.bassStep++;
    this.arpStep++;
    this.bassInterval = setTimeout(() => this.scheduleNextNote(), stepDuration * 1000);
  }
};

// -------------------------------------------------------------
// PARTICLE SYSTEMS (OPTION C)
// -------------------------------------------------------------
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
  }

  addSlideSparks(screenX, screenY) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: screenX + (Math.random() - 0.5) * 24,
        y: screenY + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 90 - 45,
        vy: -Math.random() * 70 - 25,
        size: Math.random() * 3 + 2,
        color: Math.random() > 0.3 ? '#ffaa00' : '#ffffff',
        alpha: 1.0,
        life: 0.28 + Math.random() * 0.15,
        maxLife: 0.42
      });
    }
  }

  addThrusterPlume(screenX, screenY, isBoost) {
    const color = isBoost ? '#ff00aa' : '#00f0ff';
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: screenX + (Math.random() - 0.5) * 16,
        y: screenY + 4,
        vx: (Math.random() - 0.5) * 25,
        vy: Math.random() * 45 + 30, // downward exhaust
        size: Math.random() * 6 + 3,
        color: color,
        alpha: 0.85,
        life: 0.22 + Math.random() * 0.1,
        maxLife: 0.32
      });
    }
  }

  addChipSparkles(screenX, screenY, isPowerup = false) {
    const colors = isPowerup ? ['#00f0ff', '#00ffa2', '#ffffff'] : ['#ffd700', '#ffea00', '#ffffff'];
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 35;
      this.particles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.5 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        life: 0.38 + Math.random() * 0.2,
        maxLife: 0.58
      });
    }
  }

  addDebrisShockwave(screenX, screenY) {
    // Expanding shockwave ring
    this.particles.push({
      x: screenX,
      y: screenY,
      size: 10,
      maxSize: 110,
      alpha: 1.0,
      isRing: true,
      color: '#ff0055',
      life: 0.45,
      maxLife: 0.45
    });
    // Fragments
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 160 + 50;
      this.particles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        size: Math.random() * 5 + 2,
        color: Math.random() > 0.5 ? '#ff0055' : '#00f0ff',
        alpha: 1.0,
        life: 0.55 + Math.random() * 0.3,
        maxLife: 0.85
      });
    }
  }

  addFloatingText(text, x, y, color = '#ffd700') {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -60,
      alpha: 1.0,
      life: 0.75,
      color
    });
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    while (this.particles.length > 250) {
      this.particles.shift();
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (!Number.isFinite(p.life) || p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.alpha = p.life / p.maxLife;
      if (p.isRing) {
        p.size += (p.maxSize - p.size) * (dt * 8);
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt; // gravity
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.alpha = ft.life / 0.75;
    }
  }

  draw(ctx) {
    // Additive blending gives particles a bloom-like glow against the dark city.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const a = Math.max(0, p.alpha);
      if (p.isRing) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = a * 0.35;
        ctx.lineWidth = 9;
        ctx.stroke();
      } else {
        // Soft halo
        ctx.globalAlpha = a * 0.28;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fill();
        // Bright core
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a * 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    for (const ft of this.floatingTexts) {
      ctx.save();
      const a = Math.max(0, ft.alpha);
      const pop = 1 + (1 - a) * 0.25;
      ctx.globalAlpha = a;
      ctx.font = `900 ${Math.round(16 * pop)}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineJoin = 'round';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 12;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}

// -------------------------------------------------------------
// PROCEDURAL VISUALS: SKYLINE HOVER-TRAFFIC (OPTION C)
// -------------------------------------------------------------
class HoverTraffic {
  constructor() {
    this.vehicles = [];
    for (let i = 0; i < 9; i++) {
      const depth = Math.random(); // 0 = far/small, 1 = near/large
      this.vehicles.push({
        x: Math.random() * 800 - 400,
        y: 0.12 + Math.random() * 0.34, // fraction of the sky height
        speed: (Math.random() > 0.5 ? 1 : -1) * (30 + depth * 90),
        color: (i % 3 === 0) ? '#ff2d75' : ((i % 3 === 1) ? '#00f0ff' : '#ffd166'),
        length: 14 + depth * 26,
        depth
      });
    }
  }
  update(dt, w) {
    this.vehicles.forEach(v => {
      v.x += v.speed * dt;
      if (v.speed > 0 && v.x > w + 80) v.x = -80;
      if (v.speed < 0 && v.x < -80) v.x = w + 80;
    });
  }
  draw(ctx) {
    const skyH = H * CAM.horizon;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.vehicles.forEach(v => {
      const y = v.y * skyH;
      const isRight = v.speed > 0;
      const h = 2 + v.depth * 2.5;
      const tailLen = v.length * 2.2;
      // Light trail
      const tx0 = isRight ? v.x - tailLen : v.x + v.length + tailLen;
      const tx1 = isRight ? v.x : v.x + v.length;
      const tg = ctx.createLinearGradient(tx0, 0, tx1, 0);
      tg.addColorStop(0, 'rgba(0,0,0,0)');
      tg.addColorStop(1, v.color);
      ctx.globalAlpha = 0.35 + v.depth * 0.35;
      ctx.fillStyle = tg;
      ctx.fillRect(Math.min(tx0, tx1), y + h * 0.25, Math.abs(tx1 - tx0), h * 0.5);
      // Hull
      ctx.globalAlpha = 0.6 + v.depth * 0.4;
      ctx.fillStyle = v.color;
      ctx.shadowColor = v.color;
      ctx.shadowBlur = 6 + v.depth * 6;
      roundRect(v.x, y, v.length, h, h / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Headlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(isRight ? v.x + v.length : v.x, y + h / 2, h * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}

// -------------------------------------------------------------
// RUNNER & 3-LANE SIMULATION
// -------------------------------------------------------------
const Lanes = { LEFT: -1, CENTER: 0, RIGHT: 1 };
const LANE_WIDTH = 110;

class Runner {
  constructor() {
    this.runnerId = 'vex';
    this.boardId = 'ion-glide';
    this.reset();
  }

  reset() {
    this.targetLane = Lanes.CENTER;
    this.currentX = 0;
    this.y = 0;
    this.isJumping = false;
    this.jumpTimer = 0;
    this.jumpDuration = 0.65;
    this.jumpHeight = 110;

    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = 0.60;

    this.hasShield = false;
    this.magnetTimer = 0;
    this.boostTimer = 0;
    this.multiplierTimer = 0;

    this.invulnerableTimer = 0;
    this.particles = [];
  }

  changeLane(dir) {
    const next = this.targetLane + dir;
    if (next >= -1 && next <= 1) {
      this.targetLane = next;
      AudioSynth.beep(420, 0.06, 'triangle', 0.1);
    }
  }

  jump() {
    if (!this.isJumping && !this.isSliding) {
      this.isJumping = true;
      this.jumpTimer = 0;
      AudioSynth.jump();
    }
  }

  slide() {
    if (this.isJumping) {
      // Fast-fall directly into slide on landing
      this.jumpTimer = this.jumpDuration * 0.85;
      this.isSliding = true;
      this.slideTimer = 0;
      AudioSynth.slide();
    } else if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = 0;
      AudioSynth.slide();
    }
  }

  update(dt, particleSystem, pRunner) {
    const targetX = this.targetLane;
    this.currentX += (targetX - this.currentX) * Math.min(1, dt * 16);

    // Jump physics
    if (this.isJumping) {
      this.jumpTimer += dt;
      const p = Math.min(1, this.jumpTimer / this.jumpDuration);
      this.y = 4 * this.jumpHeight * p * (1 - p);
      if (p >= 1) {
        this.isJumping = false;
        this.y = 0;
      }
    }

    // Slide physics & friction sparks
    if (this.isSliding) {
      this.slideTimer += dt;
      if (particleSystem && pRunner) {
        particleSystem.addSlideSparks(pRunner.x, pRunner.y);
      }
      if (this.slideTimer >= this.slideDuration) {
        this.isSliding = false;
      }
    }

    // Thruster plasma plume
    if (particleSystem && pRunner) {
      particleSystem.addThrusterPlume(pRunner.x, pRunner.y, this.boostTimer > 0);
    }

    // Power-up durations
    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.multiplierTimer > 0) this.multiplierTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
  }
}

// -------------------------------------------------------------
// TRACK & PROCEDURAL OBSTACLE MANAGER
// -------------------------------------------------------------
class TrackManager {
  constructor() {
    this.segments = [];
    this.nextZ = 450;
    this.baseSpeed = 240;
    this.speed = this.baseSpeed;
    this.distance = 0;
    this.chipsCollected = 0;
    this.powerupsCollected = 0;
    this.lastObstacleLane = null;
    this.billboardTimer = 0;
    this.bridgeTimer = 0;
  }

  reset() {
    this.segments = [];
    this.nextZ = 400;
    this.speed = this.baseSpeed;
    this.distance = 0;
    this.chipsCollected = 0;
    this.powerupsCollected = 0;
    this.lastObstacleLane = null;

    // Runway without obstacles
    for (let i = 0; i < 6; i++) {
      const lane = [-1, 0, 1][i % 3];
      for (let c = 0; c < 4; c++) {
        this.segments.push({
          type: 'chip',
          lane: lane,
          z: this.nextZ + c * 35,
          collected: false
        });
      }
      this.nextZ += 180;
    }
  }

  spawnSegment() {
    const lastItem = this.segments[this.segments.length - 1];
    if (lastItem && this.nextZ <= lastItem.z) {
      this.nextZ = lastItem.z + 180;
    }
    const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];

    if (this.distance < 80) {
      if (Math.random() < 0.25) {
        const puTypes = ['shield', 'magnet', 'boost', 'multiplier'];
        const puType = puTypes[Math.floor(Math.random() * puTypes.length)];
        this.segments.push({
          type: 'powerup',
          puType: puType,
          lane: lane,
          z: this.nextZ,
          collected: false
        });
      } else {
        for (let c = 0; c < 4; c++) {
          this.segments.push({
            type: 'chip',
            lane: lane,
            z: this.nextZ + c * 35,
            collected: false
          });
        }
      }
      this.nextZ += 180;
      return;
    }

    const typeRoll = Math.random();
    if (typeRoll < 0.40) {
      // Hurdle (requires jump)
      this.segments.push({
        type: 'hurdle',
        lane: lane,
        z: this.nextZ,
        width: 80,
        height: 24,
        cleared: false
      });
      this.lastObstacleLane = lane;
    } else if (typeRoll < 0.70) {
      // High Pipe / Laser Barrier (requires slide)
      this.segments.push({
        type: 'high_pipe',
        lane: lane,
        z: this.nextZ,
        width: 85,
        height: 30,
        cleared: false
      });
      this.lastObstacleLane = lane;
    } else if (typeRoll < 0.85) {
      // Drone
      this.segments.push({
        type: 'drone',
        lane: lane,
        z: this.nextZ,
        width: 45,
        height: 45,
        cleared: false
      });
      this.lastObstacleLane = lane;
    } else {
      // Power-up
      const puTypes = ['shield', 'magnet', 'boost', 'multiplier'];
      const puType = puTypes[Math.floor(Math.random() * puTypes.length)];
      this.segments.push({
        type: 'powerup',
        puType: puType,
        lane: lane,
        z: this.nextZ,
        collected: false
      });
    }

    // Add Energy Chips in free lane
    const freeLanes = [-1, 0, 1].filter(l => l !== lane);
    const chipLane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
    for (let c = 0; c < 3; c++) {
      this.segments.push({
        type: 'chip',
        lane: chipLane,
        z: this.nextZ + 60 + c * 35,
        collected: false
      });
    }

    this.nextZ += 240;
  }

  update(dt, runner, particleSystem) {
    // Speed increases with distance up to 480
    const currentSpeed = runner.boostTimer > 0
      ? this.speed * 1.5
      : Math.min(480, this.baseSpeed + Math.floor(this.distance / 100) * 15);
    this.speed = currentSpeed;
    AudioSynth.updateTempo(this.speed);

    const advance = currentSpeed * dt;
    this.distance += advance * 0.05;

    for (let i = this.segments.length - 1; i >= 0; i--) {
      const item = this.segments[i];
      item.z -= advance;

      // Magnet attraction
      if (item.type === 'chip' && !item.collected && runner.magnetTimer > 0) {
        const dz = item.z - 0;
        const targetX = runner.currentX * LANE_WIDTH;
        const currentItemX = item.lane * LANE_WIDTH;
        if (dz > -20 && dz < 260) {
          item.lane += (runner.targetLane - item.lane) * Math.min(1, dt * 10);
        }
      }

      // Check Collision with Runner at z in [-15, 25]
      if (item.z >= -15 && item.z <= 25) {
        const xDist = Math.abs((item.lane * LANE_WIDTH) - (runner.currentX * LANE_WIDTH));

        if (item.type === 'chip' && !item.collected) {
          if (xDist < 45) {
            item.collected = true;
            const chipInc = runner.multiplierTimer > 0 ? 2 : 1;
            this.chipsCollected += chipInc;
            AudioSynth.chip();
            if (particleSystem) {
              const p = project(runner.currentX * LANE_WIDTH, runner.y + 10, 0);
              particleSystem.addChipSparkles(p.x, p.y);
              particleSystem.addFloatingText(`+${chipInc}`, p.x, p.y - 15, '#ffd700');
            }
          }
        } else if (item.type === 'powerup' && !item.collected) {
          if (xDist < 45) {
            item.collected = true;
            this.powerupsCollected++;
            AudioSynth.powerup();
            const p = project(runner.currentX * LANE_WIDTH, runner.y + 10, 0);

            if (item.puType === 'shield') {
              runner.hasShield = true;
              if (particleSystem) particleSystem.addFloatingText('SHIELD!', p.x, p.y - 15, '#00ff88');
            } else if (item.puType === 'magnet') {
              runner.magnetTimer = 10;
              if (particleSystem) particleSystem.addFloatingText('MAGNET!', p.x, p.y - 15, '#00f0ff');
            } else if (item.puType === 'boost') {
              runner.boostTimer = 8;
              if (particleSystem) particleSystem.addFloatingText('BOOST!', p.x, p.y - 15, '#ff0055');
            } else if (item.puType === 'multiplier') {
              runner.multiplierTimer = 12;
              if (particleSystem) particleSystem.addFloatingText('2X CHIPS!', p.x, p.y - 15, '#ffd700');
            }
            if (particleSystem) particleSystem.addChipSparkles(p.x, p.y, true);
          }
        } else if (['hurdle', 'high_pipe', 'drone'].includes(item.type) && !item.cleared) {
          // Near-miss check (Option C)
          if (xDist >= 35 && xDist < 80) {
            item.nearMissed = true;
            AudioSynth.nearMiss();
            if (particleSystem) {
              const p = project(runner.currentX * LANE_WIDTH, runner.y + 10, 0);
              particleSystem.addFloatingText('NEAR MISS!', p.x, p.y - 25, '#00f0ff');
            }
          }

          let hit = false;
          if (xDist < 35) {
            if (item.type === 'hurdle') {
              if (runner.y < 35) hit = true;
            } else if (item.type === 'high_pipe') {
              if (!runner.isSliding) hit = true;
            } else if (item.type === 'drone') {
              if (runner.boostTimer > 0) {
                hit = false; // boost smashes drone
                if (particleSystem) {
                  const p = project(item.lane * LANE_WIDTH, 20, 0);
                  particleSystem.addDebrisShockwave(p.x, p.y);
                }
              } else if (runner.y < 30 && !runner.isSliding) {
                hit = true;
              }
            }
          }

          if (hit) {
            if (runner.invulnerableTimer > 0 || runner.boostTimer > 0) {
              item.cleared = true;
              if (particleSystem) {
                const p = project(item.lane * LANE_WIDTH, 20, 0);
                particleSystem.addDebrisShockwave(p.x, p.y);
              }
            } else if (runner.hasShield) {
              runner.hasShield = false;
              item.cleared = true;
              AudioSynth.beep(600, 0.25, 'sine', 0.25);
              if (particleSystem) {
                const p = project(runner.currentX * LANE_WIDTH, runner.y + 10, 0);
                particleSystem.addDebrisShockwave(p.x, p.y);
              }
            } else {
              item.cleared = true;
              return { crashed: true, cause: item.type };
            }
          }
        }
      }

      if (item.z < -80) {
        this.segments.splice(i, 1);
      }
    }

    const maxZ = this.segments.length > 0 ? this.segments[this.segments.length - 1].z : 0;
    if ((maxZ < 1000 || this.segments.length < 10) && this.segments.length < 30) {
      this.spawnSegment();
    }

    return { crashed: false };
  }
}

// -------------------------------------------------------------
// RENDERER (CYBERPUNK VANTAGE CITY) — v3 VISUAL OVERHAUL
// -------------------------------------------------------------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = canvas.width;
let H = canvas.height;
let DPR = 1;

// Seeded PRNG so scenery is stable across frames and resizes.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Renderer-side effects state (screen shake, hit flash, world scroll).
const RenderFX = {
  shake: 0,
  flash: 0,
  scroll: 0,      // continuous world-space scroll used for grid / props / dashes
  time: 0,
  scanPattern: null
};
window.RenderFX = RenderFX;

const RUNNER_STYLE = {
  vex:    { suit: '#eef3ff', suitDark: '#aab7d6', trim: '#00f0ff', visor: '#7ff9ff' },
  nyx:    { suit: '#2b2f4a', suitDark: '#161a2e', trim: '#ff2d75', visor: '#ff8fb8' },
  pulse:  { suit: '#ff9c3a', suitDark: '#b8621a', trim: '#ffe066', visor: '#fff1a8' },
  cipher: { suit: '#b184ff', suitDark: '#6f4bc4', trim: '#00ff88', visor: '#a8ffd6' },
  kael:   { suit: '#ff9c3a', suitDark: '#b8621a', trim: '#ffe066', visor: '#fff1a8' },
  aria:   { suit: '#b184ff', suitDark: '#6f4bc4', trim: '#ff5cf0', visor: '#ffb3fa' }
};
const BOARD_STYLE = {
  'ion-glide': '#00f0ff',
  'pulse-ray': '#ffb020',
  'vortex-breaker': '#ff2d75'
};
const PU_STYLE = {
  shield:     { c: '#00ff88', glyph: 'S' },
  magnet:     { c: '#00f0ff', glyph: 'M' },
  boost:      { c: '#ff2d75', glyph: 'B' },
  multiplier: { c: '#ffd700', glyph: '2X' }
};

// Static scenery (stars + two parallax skyline layers), rebuilt on resize.
const Scenery = {
  stars: [],
  far: [],
  near: [],
  rebuild() {
    const rnd = seededRandom(0x5EED);
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({ x: rnd(), y: rnd() * 0.48, r: 0.4 + rnd() * 1.2, ph: rnd() * 6.28, sp: 0.8 + rnd() * 2.2 });
    }
    const winColors = ['#00f0ff', '#ff2d75', '#ffd166', '#9be7ff'];
    const neonColors = ['#00f0ff', '#ff2d75', '#b967ff', null, null];
    const build = (count, hMin, hMax, wMin, wMax) => {
      const arr = [];
      let x = -0.05;
      for (let i = 0; i < count; i++) {
        const w = wMin + rnd() * (wMax - wMin);
        arr.push({
          x, w,
          h: hMin + rnd() * (hMax - hMin),
          seed: Math.floor(rnd() * 1000),
          winColor: winColors[Math.floor(rnd() * winColors.length)],
          neon: neonColors[Math.floor(rnd() * neonColors.length)],
          antenna: rnd() > 0.55,
          phase: rnd() * 6.28,
          lit: rnd() > 0.15
        });
        x += w + 0.004 + rnd() * 0.02;
        if (x > 1.1) break;
      }
      return arr;
    };
    this.far = build(26, 0.10, 0.30, 0.03, 0.07);
    this.near = build(16, 0.06, 0.22, 0.05, 0.11);
  }
};

function resizeCanvas() {
  const container = document.getElementById('game-container');
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = container.clientWidth;
  H = container.clientHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  Scenery.rebuild();

  // Scanline pattern (1x3 px) — cheap CRT texture.
  const pc = document.createElement('canvas');
  pc.width = 1; pc.height = 3;
  const pctx = pc.getContext('2d');
  pctx.fillStyle = 'rgba(0,0,0,0.10)';
  pctx.fillRect(0, 2, 1, 1);
  RenderFX.scanPattern = ctx.createPattern(pc, 'repeat');
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Camera: vanishing row at 56% of the screen, camera 120 units above the deck
// and 190 units behind the runner so the courier is fully framed (feet ~81% H).
const CAM = { fov: 320, z: -190, y: 120, horizon: 0.56 };

function project(x, y, z) {
  const dist = z - CAM.z;
  if (dist <= 10) return { x: -9999, y: -9999, scale: 0 };
  const scale = CAM.fov / dist;
  const projX = (W / 2) + (x * scale);
  const projY = (H * CAM.horizon) - ((y - CAM.y) * scale);
  return { x: projX, y: projY, scale: scale };
}

const hoverTraffic = new HoverTraffic();
const particleSystem = new ParticleSystem();

// Billboard slogans
const BILLBOARDS = [
  'NEO MARINA', 'ION DRINK', 'CYBER-LINK', 'RUN FASTER', 'VANTAGE TECH'
];

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function hexPath(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------- SKY ----------
function drawSky(HZ, t, hueShift) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HZ);
  skyGrad.addColorStop(0, `hsl(${236 + hueShift}, 55%, 5%)`);
  skyGrad.addColorStop(0.45, `hsl(${258 + hueShift}, 55%, 14%)`);
  skyGrad.addColorStop(0.8, `hsl(${300 + hueShift}, 60%, 24%)`);
  skyGrad.addColorStop(1, `hsl(${340 + hueShift}, 85%, 46%)`);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, HZ + 2);

  // Stars
  ctx.fillStyle = '#ffffff';
  for (const s of Scenery.stars) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
    ctx.globalAlpha = tw * 0.9;
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * HZ, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Giant synthwave sun
  const sunR = W * 0.30;
  const sunX = W * 0.5;
  const sunY = HZ - sunR * 0.30;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, HZ);
  ctx.clip();

  // Outer glow
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * 1.9);
  glow.addColorStop(0, `hsla(${350 + hueShift}, 100%, 60%, 0.35)`);
  glow.addColorStop(1, 'rgba(255,60,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, HZ);

  // Sun disc
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sg.addColorStop(0, `hsl(${48 + hueShift * 0.3}, 100%, 78%)`);
  sg.addColorStop(0.45, `hsl(${22 + hueShift * 0.3}, 100%, 62%)`);
  sg.addColorStop(1, `hsl(${338 + hueShift}, 100%, 55%)`);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal slats through the lower half of the sun
  ctx.fillStyle = `hsla(${262 + hueShift}, 60%, 16%, 0.92)`;
  let slatY = sunY + sunR * 0.05;
  let slatH = 2;
  let gap = 14;
  while (slatY < sunY + sunR) {
    ctx.fillRect(sunX - sunR, slatY, sunR * 2, slatH);
    slatY += gap;
    slatH += 1.4;
    gap -= 0.6;
    if (gap < 4) gap = 4;
  }
  ctx.restore();
}

// ---------- SKYLINE ----------
function drawSkylineLayer(layer, parallaxPx, HZ, bodyTop, bodyBottom, winAlpha, t, scaleH) {
  for (const b of layer) {
    const bw = b.w * W;
    const bh = b.h * H * scaleH;
    const bx = b.x * W + parallaxPx;
    const by = HZ - bh;
    if (bx + bw < -20 || bx > W + 20) continue;

    const g = ctx.createLinearGradient(0, by, 0, HZ);
    g.addColorStop(0, bodyTop);
    g.addColorStop(1, bodyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);

    // Rooftop neon edge
    if (b.neon) {
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bx, by, bw, 1.5);
      ctx.globalAlpha = 1;
    }

    // Windows grid
    if (b.lit && winAlpha > 0) {
      const cols = Math.max(1, Math.floor(bw / 8));
      const rows = Math.max(1, Math.floor(bh / 12));
      const cw = bw / cols;
      const rh = bh / rows;
      ctx.fillStyle = b.winColor;
      const flick = 0.55 + 0.45 * Math.sin(t * 0.9 + b.phase);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const hsh = (r * 7 + c * 13 + b.seed) % 7;
          if (hsh === 0 || hsh === 3) continue;
          ctx.globalAlpha = winAlpha * (hsh === 5 ? flick : 1);
          ctx.fillRect(bx + c * cw + cw * 0.3, by + r * rh + rh * 0.3, cw * 0.4, rh * 0.45);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Antenna + blinking beacon
    if (b.antenna) {
      const ax = bx + bw * 0.5;
      const ah = 14 + (b.seed % 12);
      ctx.strokeStyle = 'rgba(60,70,110,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, by);
      ctx.lineTo(ax, by - ah);
      ctx.stroke();
      const blink = Math.sin(t * 3 + b.phase) > 0.6;
      if (blink) {
        ctx.fillStyle = '#ff3b5c';
        ctx.shadowColor = '#ff3b5c';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(ax, by - ah, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
}

// ---------- ITEMS ----------
function drawChip(p, t, idx) {
  const s = Math.max(4, 16 * p.scale);
  const spin = Math.cos(t * 4 + idx * 0.7);
  const bob = Math.sin(t * 3 + idx) * 3 * p.scale;
  const cy = p.y - 22 * p.scale + bob;

  // Ground reflection
  ctx.fillStyle = 'rgba(255, 200, 40, 0.16)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 2 * p.scale, s * 0.9, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, cy);
  ctx.scale(Math.max(0.12, Math.abs(spin)), 1);
  ctx.shadowColor = '#ffcc33';
  ctx.shadowBlur = 14;
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, '#fff6bf');
  g.addColorStop(0.5, '#ffc400');
  g.addColorStop(1, '#ff8a00');
  ctx.fillStyle = g;
  hexPath(0, 0, s);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(120, 60, 0, 0.75)';
  ctx.lineWidth = Math.max(1, 1.5 * p.scale);
  hexPath(0, 0, s * 0.55);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, -s * 0.35, s * 0.28, s * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerup(p, item, t) {
  const st = PU_STYLE[item.puType] || PU_STYLE.shield;
  const r = Math.max(6, 22 * p.scale);
  const bob = Math.sin(t * 2.5 + item.z * 0.01) * 4 * p.scale;
  const cy = p.y - 28 * p.scale + bob;

  ctx.fillStyle = st.c;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 2 * p.scale, r * 1.1, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const og = ctx.createRadialGradient(p.x - r * 0.3, cy - r * 0.3, r * 0.1, p.x, cy, r);
  og.addColorStop(0, '#ffffff');
  og.addColorStop(0.35, st.c);
  og.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.shadowColor = st.c;
  ctx.shadowBlur = 22;
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(p.x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Orbiting ring
  ctx.strokeStyle = st.c;
  ctx.lineWidth = Math.max(1, 2 * p.scale);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(p.x, cy, r * 1.45, r * 0.45, t * 1.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Glyph
  ctx.fillStyle = '#0a0c16';
  ctx.font = `900 ${Math.max(7, Math.floor(r * 0.9))}px Orbitron, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(st.glyph, p.x, cy + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawHurdle(p, item, t) {
  const w = Math.max(10, item.width * p.scale);
  const h = Math.max(8, item.height * p.scale);
  const x0 = p.x - w / 2;
  const y0 = p.y - h;
  const pFar = project(item.lane * LANE_WIDTH, item.height, item.z + 26);
  const wFar = Math.max(8, item.width * pFar.scale);

  // Top face
  ctx.fillStyle = '#ffd36e';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + w, y0);
  ctx.lineTo(pFar.x + wFar / 2, pFar.y);
  ctx.lineTo(pFar.x - wFar / 2, pFar.y);
  ctx.closePath();
  ctx.fill();

  // Front face with hazard stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.fillStyle = '#ffb020';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = '#15100a';
  const stripe = Math.max(4, 10 * p.scale);
  for (let k = -h; k < w + h; k += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x0 + k, y0 + h);
    ctx.lineTo(x0 + k + stripe, y0 + h);
    ctx.lineTo(x0 + k + stripe + h, y0);
    ctx.lineTo(x0 + k + h, y0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Glowing edge + warning strobe
  ctx.strokeStyle = '#ffcf5a';
  ctx.shadowColor = '#ffb020';
  ctx.shadowBlur = 10;
  ctx.lineWidth = Math.max(1, 1.5 * p.scale);
  ctx.strokeRect(x0, y0, w, h);
  ctx.shadowBlur = 0;
  if (Math.sin(t * 8 + item.z * 0.05) > 0) {
    ctx.fillStyle = '#ff3b5c';
    ctx.shadowColor = '#ff3b5c';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, y0 - 3 * p.scale, Math.max(1.5, 2.5 * p.scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawLaserBarrier(p, item, t) {
  const w = Math.max(12, item.width * p.scale);
  const h = Math.max(10, item.height * p.scale);
  const s = p.scale;
  const beamTop = p.y - h - 45 * s;
  const beamMid = beamTop + 9 * s;
  const xL = p.x - w / 2;
  const xR = p.x + w / 2;
  const pulse = 0.75 + 0.25 * Math.sin(t * 12);

  // Emitter posts
  ctx.fillStyle = '#1b2140';
  ctx.fillRect(xL - 4 * s, beamTop - 6 * s, 8 * s, p.y - beamTop + 6 * s);
  ctx.fillRect(xR - 4 * s, beamTop - 6 * s, 8 * s, p.y - beamTop + 6 * s);
  ctx.fillStyle = '#3a4470';
  ctx.fillRect(xL - 5 * s, beamTop - 8 * s, 10 * s, 14 * s);
  ctx.fillRect(xR - 5 * s, beamTop - 8 * s, 10 * s, 14 * s);

  // Beam glow layers
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(0, 229, 255, ${0.22 * pulse})`;
  ctx.lineWidth = 16 * s;
  ctx.beginPath(); ctx.moveTo(xL, beamMid); ctx.lineTo(xR, beamMid); ctx.stroke();
  ctx.strokeStyle = `rgba(0, 229, 255, ${0.9 * pulse})`;
  ctx.lineWidth = 6 * s;
  ctx.beginPath(); ctx.moveTo(xL, beamMid); ctx.lineTo(xR, beamMid); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.beginPath(); ctx.moveTo(xL, beamMid); ctx.lineTo(xR, beamMid); ctx.stroke();

  // Faint light curtain under the beam (slide cue)
  const cg = ctx.createLinearGradient(0, beamMid, 0, p.y);
  cg.addColorStop(0, 'rgba(0,229,255,0.16)');
  cg.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(xL, beamMid, w, p.y - beamMid);
  ctx.restore();

  // Emitter lights
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(xL, beamMid, Math.max(1.5, 2.5 * s), 0, Math.PI * 2);
  ctx.arc(xR, beamMid, Math.max(1.5, 2.5 * s), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawDrone(p, item, t) {
  const s = p.scale;
  const r = Math.max(8, 22 * s);
  const bob = Math.sin(t * 3 + item.z * 0.02) * 4 * s;
  const cy = p.y - 30 * s + bob;

  // Scan cone
  const cone = ctx.createLinearGradient(0, cy, 0, p.y);
  cone.addColorStop(0, 'rgba(255, 45, 117, 0.42)');
  cone.addColorStop(1, 'rgba(255, 45, 117, 0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(p.x, cy);
  ctx.lineTo(p.x - r * 1.9, p.y + 2 * s);
  ctx.lineTo(p.x + r * 1.9, p.y + 2 * s);
  ctx.closePath();
  ctx.fill();

  // Rotor arms
  ctx.strokeStyle = '#3a3f5c';
  ctx.lineWidth = Math.max(1.5, 3 * s);
  ctx.beginPath();
  ctx.moveTo(p.x - r * 1.5, cy - r * 0.5);
  ctx.lineTo(p.x + r * 1.5, cy - r * 0.5);
  ctx.moveTo(p.x - r * 1.2, cy + r * 0.25);
  ctx.lineTo(p.x + r * 1.2, cy + r * 0.25);
  ctx.stroke();

  // Rotors (blurred discs)
  const rotorSpin = Math.abs(Math.cos(t * 30));
  ctx.strokeStyle = 'rgba(200, 215, 255, 0.5)';
  ctx.lineWidth = Math.max(1, 1.2 * s);
  [[-1.5, -0.5], [1.5, -0.5], [-1.2, 0.25], [1.2, 0.25]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.ellipse(p.x + dx * r, cy + dy * r, r * 0.55, r * 0.14 + r * 0.06 * rotorSpin, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Body
  const bg = ctx.createLinearGradient(0, cy - r * 0.7, 0, cy + r * 0.7);
  bg.addColorStop(0, '#4a1d4f');
  bg.addColorStop(1, '#1a0b22');
  ctx.fillStyle = bg;
  ctx.strokeStyle = '#ff2d75';
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.shadowColor = '#ff2d75';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(p.x, cy - r * 0.75);
  ctx.lineTo(p.x + r, cy - r * 0.1);
  ctx.lineTo(p.x + r * 0.7, cy + r * 0.6);
  ctx.lineTo(p.x - r * 0.7, cy + r * 0.6);
  ctx.lineTo(p.x - r, cy - r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Eye
  const eyePulse = 0.7 + 0.3 * Math.sin(t * 10);
  const eg = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, r * 0.42);
  eg.addColorStop(0, '#ffffff');
  eg.addColorStop(0.4, '#ff5c93');
  eg.addColorStop(1, 'rgba(255,45,117,0)');
  ctx.globalAlpha = eyePulse;
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(p.x, cy, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Nav lights
  const blinkA = Math.sin(t * 6) > 0;
  ctx.fillStyle = blinkA ? '#ff3b5c' : '#00ff88';
  ctx.beginPath();
  ctx.arc(p.x - r * 1.5, cy - r * 0.5, Math.max(1, 1.6 * s), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blinkA ? '#00ff88' : '#ff3b5c';
  ctx.beginPath();
  ctx.arc(p.x + r * 1.5, cy - r * 0.5, Math.max(1, 1.6 * s), 0, Math.PI * 2);
  ctx.fill();
}

// ---------- COURIER ----------
function drawCourier(runner, rPos, groundPos, t) {
  const s = rPos.scale;
  const style = RUNNER_STYLE[runner.runnerId] || RUNNER_STYLE.vex;
  const boardColor = runner.boostTimer > 0 ? '#ff2d75' : (BOARD_STYLE[runner.boardId] || '#00f0ff');
  const jumpRatio = Math.min(1, runner.y / 110);

  // Drop shadow on the track
  ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * (1 - jumpRatio * 0.6)})`;
  ctx.beginPath();
  ctx.ellipse(groundPos.x, groundPos.y, 36 * s * (1 - jumpRatio * 0.35), 7 * s * (1 - jumpRatio * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();

  // Board underglow projected onto the ground
  const ug = ctx.createRadialGradient(groundPos.x, groundPos.y, 0, groundPos.x, groundPos.y, 60 * s);
  ug.addColorStop(0, boardColor + 'aa');
  ug.addColorStop(1, boardColor + '00');
  ctx.globalAlpha = 0.55 * (1 - jumpRatio * 0.7);
  ctx.fillStyle = ug;
  ctx.beginPath();
  ctx.ellipse(groundPos.x, groundPos.y, 60 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const hover = Math.sin(t * 6) * 1.5 * s;
  const lean = (runner.targetLane - runner.currentX) * 0.45;

  ctx.save();
  ctx.translate(rPos.x, rPos.y - 5 * s + hover);
  ctx.rotate(lean);

  // Invulnerability flicker
  if (runner.invulnerableTimer > 0 && Math.floor(t * 12) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  // --- Grav-board ---
  const bw = 70 * s;
  const bh = 11 * s;
  ctx.shadowColor = boardColor;
  ctx.shadowBlur = 18;
  const bgr = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
  bgr.addColorStop(0, '#2a3358');
  bgr.addColorStop(0.55, '#141a30');
  bgr.addColorStop(1, boardColor);
  ctx.fillStyle = bgr;
  roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Deck accent line
  ctx.strokeStyle = boardColor;
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.globalAlpha *= 0.9;
  ctx.beginPath();
  ctx.moveTo(-bw * 0.42, -bh * 0.1);
  ctx.lineTo(bw * 0.42, -bh * 0.1);
  ctx.stroke();
  // Thruster pods
  ctx.fillStyle = '#0d1020';
  roundRect(-bw * 0.28, bh * 0.25, 10 * s, 6 * s, 2 * s);
  ctx.fill();
  roundRect(bw * 0.28 - 10 * s, bh * 0.25, 10 * s, 6 * s, 2 * s);
  ctx.fill();
  ctx.fillStyle = boardColor;
  ctx.shadowColor = boardColor;
  ctx.shadowBlur = 12;
  ctx.fillRect(-bw * 0.28 + 2 * s, bh * 0.25 + 4 * s, 6 * s, 2 * s);
  ctx.fillRect(bw * 0.28 - 8 * s, bh * 0.25 + 4 * s, 6 * s, 2 * s);
  ctx.shadowBlur = 0;

  // --- Body ---
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const legW = Math.max(2, 6.5 * s);
  const armW = Math.max(2, 5 * s);

  if (runner.isSliding) {
    // Low slide pose: body horizontal along the board
    ctx.strokeStyle = style.suitDark;
    ctx.lineWidth = legW;
    ctx.beginPath();
    ctx.moveTo(-14 * s, -14 * s);
    ctx.lineTo(-30 * s, -8 * s);
    ctx.moveTo(-14 * s, -12 * s);
    ctx.lineTo(-28 * s, -4 * s);
    ctx.stroke();

    const tg = ctx.createLinearGradient(0, -26 * s, 0, -8 * s);
    tg.addColorStop(0, style.suit);
    tg.addColorStop(1, style.suitDark);
    ctx.fillStyle = tg;
    roundRect(-18 * s, -24 * s, 40 * s, 16 * s, 6 * s);
    ctx.fill();
    ctx.fillStyle = style.trim;
    ctx.fillRect(-10 * s, -22 * s, 22 * s, 2.5 * s);

    // Arm forward
    ctx.strokeStyle = style.suit;
    ctx.lineWidth = armW;
    ctx.beginPath();
    ctx.moveTo(16 * s, -18 * s);
    ctx.lineTo(30 * s, -12 * s);
    ctx.stroke();

    // Head
    ctx.fillStyle = style.suit;
    ctx.beginPath();
    ctx.arc(24 * s, -26 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.visor;
    ctx.shadowColor = style.visor;
    ctx.shadowBlur = 10;
    roundRect(24 * s, -29 * s, 11 * s, 5 * s, 2 * s);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    const jumpTuck = runner.isJumping ? 1 : 0;
    const runPhase = Math.sin(t * 9);

    // Satchel (behind torso)
    ctx.fillStyle = '#1d2240';
    roundRect(-19 * s, -58 * s, 9 * s, 22 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = style.trim;
    ctx.fillRect(-19 * s, -50 * s, 9 * s, 2 * s);

    // Legs (surf stance, knees bent; tucked when jumping)
    ctx.strokeStyle = style.suitDark;
    ctx.lineWidth = legW;
    const kneeLift = jumpTuck * 10 * s;
    ctx.beginPath();
    ctx.moveTo(-5 * s, -34 * s);
    ctx.lineTo(-13 * s, -20 * s - kneeLift + runPhase * 1.2 * s);
    ctx.lineTo(-15 * s, -6 * s - kneeLift * 1.4);
    ctx.moveTo(5 * s, -34 * s);
    ctx.lineTo(13 * s, -20 * s - kneeLift - runPhase * 1.2 * s);
    ctx.lineTo(16 * s, -6 * s - kneeLift * 1.4);
    ctx.stroke();
    // Boots
    ctx.fillStyle = style.trim;
    ctx.fillRect(-19 * s, -8 * s - kneeLift * 1.4, 9 * s, 3 * s);
    ctx.fillRect(12 * s, -8 * s - kneeLift * 1.4, 9 * s, 3 * s);

    // Back arm
    ctx.strokeStyle = style.suitDark;
    ctx.lineWidth = armW;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -58 * s);
    ctx.lineTo(-20 * s, -46 * s + runPhase * 2 * s);
    ctx.stroke();

    // Torso
    const tg = ctx.createLinearGradient(-12 * s, 0, 12 * s, 0);
    tg.addColorStop(0, style.suitDark);
    tg.addColorStop(0.35, style.suit);
    tg.addColorStop(1, style.suit);
    ctx.fillStyle = tg;
    roundRect(-12 * s, -66 * s, 24 * s, 34 * s, 7 * s);
    ctx.fill();
    // Jacket trim stripe
    ctx.fillStyle = style.trim;
    ctx.shadowColor = style.trim;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-12 * s, -50 * s);
    ctx.lineTo(12 * s, -56 * s);
    ctx.lineTo(12 * s, -53 * s);
    ctx.lineTo(-12 * s, -47 * s);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Front arm (reaching forward)
    ctx.strokeStyle = style.suit;
    ctx.lineWidth = armW;
    ctx.beginPath();
    ctx.moveTo(9 * s, -58 * s);
    ctx.lineTo(22 * s, -48 * s - runPhase * 2 * s);
    ctx.stroke();
    ctx.fillStyle = style.trim;
    ctx.beginPath();
    ctx.arc(22 * s, -48 * s - runPhase * 2 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Head + helmet
    ctx.fillStyle = style.suit;
    ctx.beginPath();
    ctx.arc(1 * s, -78 * s, 11 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.suitDark;
    ctx.beginPath();
    ctx.arc(1 * s, -78 * s, 11 * s, Math.PI * 0.9, Math.PI * 1.9);
    ctx.fill();
    // Visor
    ctx.fillStyle = style.visor;
    ctx.shadowColor = style.visor;
    ctx.shadowBlur = 12;
    roundRect(-4 * s, -82 * s, 15 * s, 6 * s, 3 * s);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Ear pod
    ctx.fillStyle = style.trim;
    ctx.beginPath();
    ctx.arc(-9 * s, -78 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  // --- Auras (drawn unrotated around the runner) ---
  const cx = rPos.x;
  const cyAura = rPos.y - 45 * s;
  if (runner.hasShield) {
    const sg = ctx.createRadialGradient(cx, cyAura, 20 * s, cx, cyAura, 58 * s);
    sg.addColorStop(0, 'rgba(0,255,136,0)');
    sg.addColorStop(0.85, 'rgba(0,255,136,0.12)');
    sg.addColorStop(1, 'rgba(0,255,136,0.4)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, cyAura, 58 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 22;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cyAura, 58 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (runner.invulnerableTimer > 0) {
    ctx.strokeStyle = 'rgba(0,240,255,0.7)';
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -t * 40;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cyAura, 54 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (runner.magnetTimer > 0) {
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + k * (Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 44 * s, cyAura + Math.sin(a) * 16 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  if (runner.multiplierTimer > 0) {
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + 0.3 * Math.sin(t * 8)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, groundPos.y, 48 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------- MAIN RENDER ----------
function render(runner, track, dt) {
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
  RenderFX.time += safeDt;
  const t = RenderFX.time;
  const gameState = (typeof game !== 'undefined' && game) ? game.state : 'RUNNING';
  const running = gameState === 'RUNNING';
  const inHub = gameState === 'HUB';

  // World scroll: follow the track speed while running, drift slowly otherwise.
  RenderFX.scroll += running ? track.speed * safeDt : 70 * safeDt;
  const scroll = RenderFX.scroll;

  // Effects decay
  if (RenderFX.shake > 0) RenderFX.shake = Math.max(0, RenderFX.shake - safeDt * 40);
  if (RenderFX.flash > 0) RenderFX.flash = Math.max(0, RenderFX.flash - safeDt * 2.2);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (RenderFX.shake > 0) {
    ctx.translate((Math.random() - 0.5) * RenderFX.shake, (Math.random() - 0.5) * RenderFX.shake);
  }

  const HZ = H * CAM.horizon;
  const hueShift = Math.sin(track.distance * 0.004) * 18; // slow district mood drift
  const parallax = -runner.currentX * 10;

  // 1. Sky, sun, stars
  drawSky(HZ, t, hueShift);

  // 2. Parallax skyline
  drawSkylineLayer(Scenery.far, parallax * 0.4, HZ, '#1b1440', '#2a1a55', 0.35, t, 1);
  hoverTraffic.update(safeDt, W);
  hoverTraffic.draw(ctx);
  drawSkylineLayer(Scenery.near, parallax, HZ, '#0b0c1c', '#151a33', 0.75, t, 1);

  // Horizon haze
  const haze = ctx.createLinearGradient(0, HZ - 60, 0, HZ + 40);
  haze.addColorStop(0, 'rgba(255, 80, 150, 0)');
  haze.addColorStop(0.6, 'rgba(255, 80, 150, 0.28)');
  haze.addColorStop(1, 'rgba(255, 80, 150, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, HZ - 60, W, 100);

  // 3. Ground + retro grid
  const groundGrad = ctx.createLinearGradient(0, HZ, 0, H);
  groundGrad.addColorStop(0, '#120a2c');
  groundGrad.addColorStop(0.3, '#0a0818');
  groundGrad.addColorStop(1, '#04050b');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, HZ, W, H - HZ);

  const GRID = 90;
  const gridScroll = scroll % GRID;
  ctx.lineWidth = 1;
  for (let z = -gridScroll; z < 1500; z += GRID) {
    const a = 0.32 * (1 - z / 1500);
    const pl = project(-1600, 0, z);
    const pr = project(1600, 0, z);
    if (pl.scale <= 0) continue;
    ctx.strokeStyle = `rgba(190, 80, 255, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y);
    ctx.lineTo(pr.x, pr.y);
    ctx.stroke();
  }
  for (let x = -1600; x <= 1600; x += LANE_WIDTH) {
    if (Math.abs(x) < LANE_WIDTH * 1.7) continue;
    const n = project(x, 0, -110);
    const f = project(x, 0, 1500);
    ctx.strokeStyle = 'rgba(190, 80, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(f.x, f.y);
    ctx.stroke();
  }

  // 4. Rooftop track (3 lanes)
  const zNear = -110;
  const zFar = 1400;
  const pNearL = project(-LANE_WIDTH * 1.6, 0, zNear);
  const pNearR = project(LANE_WIDTH * 1.6, 0, zNear);
  const pFarL = project(-LANE_WIDTH * 1.6, 0, zFar);
  const pFarR = project(LANE_WIDTH * 1.6, 0, zFar);

  const trackGrad = ctx.createLinearGradient(0, pFarL.y, 0, H);
  trackGrad.addColorStop(0, '#0d1024');
  trackGrad.addColorStop(0.5, '#121736');
  trackGrad.addColorStop(1, '#0b0e22');
  ctx.fillStyle = trackGrad;
  ctx.beginPath();
  ctx.moveTo(pNearL.x, pNearL.y);
  ctx.lineTo(pFarL.x, pFarL.y);
  ctx.lineTo(pFarR.x, pFarR.y);
  ctx.lineTo(pNearR.x, pNearR.y);
  ctx.closePath();
  ctx.fill();

  // Track panel seams (scrolling)
  const SEAM = 120;
  const seamScroll = scroll % SEAM;
  for (let z = -seamScroll; z < 1000; z += SEAM) {
    const l = project(-LANE_WIDTH * 1.6, 0, z);
    const r = project(LANE_WIDTH * 1.6, 0, z);
    if (l.scale <= 0) continue;
    ctx.strokeStyle = `rgba(120, 140, 220, ${(0.14 * (1 - z / 1000)).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();
  }

  // Dashed lane markers
  const DASH = 70;
  const dashScroll = scroll % DASH;
  [-0.5, 0.5].forEach(dl => {
    for (let z = -dashScroll; z < 1000; z += DASH) {
      const a = project(dl * LANE_WIDTH, 0, z);
      const b = project(dl * LANE_WIDTH, 0, z + DASH * 0.45);
      if (a.scale <= 0) continue;
      ctx.strokeStyle = `rgba(0, 240, 255, ${(0.55 * (1 - z / 1000)).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 2.2 * a.scale);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  });

  // Neon edge rails (bloom: wide soft + bright core + white hairline)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  [[pNearL, pFarL], [pNearR, pFarR]].forEach(([n, f]) => {
    ctx.strokeStyle = 'rgba(255, 45, 117, 0.22)';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(f.x, f.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 45, 117, 0.9)';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(f.x, f.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 220, 235, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(f.x, f.y); ctx.stroke();
  });
  ctx.restore();

  // Rail posts (scrolling light studs)
  const POST = 150;
  const postScroll = scroll % POST;
  for (let z = -postScroll; z < 1000; z += POST) {
    [-1.6, 1.6].forEach(side => {
      const base = project(side * LANE_WIDTH, 0, z);
      const top = project(side * LANE_WIDTH, 14, z);
      if (base.scale <= 0) return;
      ctx.strokeStyle = 'rgba(255, 120, 170, 0.9)';
      ctx.lineWidth = Math.max(1, 2 * base.scale);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(top.x, top.y, Math.max(1, 1.6 * base.scale), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 5. Rooftop props: AC units with spinning fans (scrolling)
  const PROP = 260;
  const propScroll = scroll % PROP;
  const fanAngle = t * 9;
  for (let z = 60 - propScroll; z < 1000; z += PROP) {
    [[-1.95, 0], [1.95, 130]].forEach(([side, zOff]) => {
      const zz = z + zOff;
      const p = project(side * LANE_WIDTH, 0, zz);
      if (p.scale <= 0 || zz < -60) return;
      const s = p.scale;
      const bw = 30 * s, bh = 26 * s;
      // Box: front + top face
      ctx.fillStyle = '#161a30';
      ctx.fillRect(p.x - bw / 2, p.y - bh, bw, bh);
      ctx.fillStyle = '#242a4a';
      ctx.beginPath();
      ctx.moveTo(p.x - bw / 2, p.y - bh);
      ctx.lineTo(p.x + bw / 2, p.y - bh);
      ctx.lineTo(p.x + bw / 2 - 3 * s, p.y - bh - 6 * s);
      ctx.lineTo(p.x - bw / 2 + 3 * s, p.y - bh - 6 * s);
      ctx.closePath();
      ctx.fill();
      // Fan grille
      ctx.fillStyle = '#0a0c18';
      ctx.beginPath();
      ctx.arc(p.x, p.y - bh / 2, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,240,255,0.7)';
      ctx.lineWidth = Math.max(1, 1.2 * s);
      ctx.beginPath();
      ctx.arc(p.x, p.y - bh / 2, 10 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(p.x, p.y - bh / 2);
      ctx.rotate(fanAngle + zz * 0.01);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = Math.max(1, 2 * s);
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(k * 2.094) * 8 * s, Math.sin(k * 2.094) * 8 * s);
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  // 6. Overhead sky-bridge (every ~140 m of track)
  const BRIDGE_SPAN = 2800;
  const bridgeZ = (BRIDGE_SPAN - (scroll % BRIDGE_SPAN)) * 0.3;
  if (bridgeZ > 20 && bridgeZ < 840) {
    const pBL = project(-LANE_WIDTH * 2.1, 110, bridgeZ);
    const pBR = project(LANE_WIDTH * 2.1, 110, bridgeZ);
    const pBLG = project(-LANE_WIDTH * 2.1, 0, bridgeZ);
    const pBRG = project(LANE_WIDTH * 2.1, 0, bridgeZ);
    if (pBL.scale > 0 && pBR.scale > 0) {
      const s = pBL.scale;
      ctx.strokeStyle = '#232a4c';
      ctx.lineWidth = 7 * s;
      ctx.beginPath();
      ctx.moveTo(pBLG.x, pBLG.y); ctx.lineTo(pBL.x, pBL.y);
      ctx.moveTo(pBRG.x, pBRG.y); ctx.lineTo(pBR.x, pBR.y);
      ctx.stroke();
      // Truss
      ctx.strokeStyle = '#2f3868';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(pBL.x, pBL.y - 10 * s); ctx.lineTo(pBR.x, pBR.y - 10 * s);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 1.2 * s);
      const segs = 8;
      for (let k = 0; k < segs; k++) {
        const xa = pBL.x + (pBR.x - pBL.x) * (k / segs);
        const xb = pBL.x + (pBR.x - pBL.x) * ((k + 1) / segs);
        ctx.beginPath();
        ctx.moveTo(xa, pBL.y - 10 * s);
        ctx.lineTo(xb, pBL.y);
        ctx.stroke();
      }
      // Glowing beam with lights
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      for (let k = 1; k < 6; k++) {
        const lx = pBL.x + (pBR.x - pBL.x) * (k / 6);
        ctx.beginPath();
        ctx.arc(lx, pBL.y, Math.max(1, 1.6 * s), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ff2d75';
      ctx.shadowColor = '#ff2d75';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(pBL.x, pBL.y - 14 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.arc(pBR.x, pBR.y - 14 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // 7. Neon billboards
  for (let bIdx = 0; bIdx < BILLBOARDS.length; bIdx++) {
    const bZ = ((bIdx * 200) - (scroll % 1000) + 1000) % 1000;
    if (bZ > 30 && bZ < 950) {
      const side = (bIdx % 2 === 0) ? -1 : 1;
      const pBoard = project(side * LANE_WIDTH * 2.4, 70, bZ);
      const pPole = project(side * LANE_WIDTH * 2.4, 0, bZ);
      if (pBoard.scale > 0) {
        const s = pBoard.scale;
        const bw = 96 * s;
        const bh = 46 * s;
        const col = (bIdx % 2 === 0) ? '#00f0ff' : '#ff2d75';
        const flicker = (Math.sin(t * 17 + bIdx * 3) > 0.94) ? 0.55 : 1;
        // Pole
        ctx.strokeStyle = '#1d2240';
        ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.moveTo(pPole.x, pPole.y);
        ctx.lineTo(pBoard.x, pBoard.y + bh / 2);
        ctx.stroke();
        ctx.save();
        ctx.globalAlpha = flicker;
        const pg = ctx.createLinearGradient(0, pBoard.y - bh / 2, 0, pBoard.y + bh / 2);
        pg.addColorStop(0, 'rgba(18, 22, 44, 0.95)');
        pg.addColorStop(1, 'rgba(8, 10, 24, 0.95)');
        ctx.fillStyle = pg;
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
        ctx.lineWidth = Math.max(1, 2 * s);
        roundRect(pBoard.x - bw / 2, pBoard.y - bh / 2, bw, bh, 4 * s);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.font = `900 ${Math.max(6, Math.floor(11 * s))}px Orbitron, sans-serif`;
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
        ctx.textAlign = 'center';
        ctx.fillText(BILLBOARDS[bIdx], pBoard.x, pBoard.y + 4 * s);
        ctx.shadowBlur = 0;
        // Scanline sweep
        const scanY = bh > 1 ? (pBoard.y - bh / 2 + ((t * 60) % bh)) : pBoard.y;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pBoard.x - bw / 2, scanY);
        ctx.lineTo(pBoard.x + bw / 2, scanY);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // 8. Track items (back to front) — hidden on the hub so the courier idles on a clean rooftop
  if (!inHub) {
    const sortedItems = [...track.segments].sort((a, b) => b.z - a.z);
    let chipIdx = 0;
    sortedItems.forEach(item => {
      if (item.z < -40 || item.z > 900) return;
      const p = project(item.lane * LANE_WIDTH, 0, item.z);
      if (p.scale <= 0) return;
      if (item.type === 'chip' && !item.collected) {
        drawChip(p, t, chipIdx++);
      } else if (item.type === 'powerup' && !item.collected) {
        drawPowerup(p, item, t);
      } else if (item.type === 'hurdle' && !item.cleared) {
        drawHurdle(p, item, t);
      } else if (item.type === 'high_pipe' && !item.cleared) {
        drawLaserBarrier(p, item, t);
      } else if (item.type === 'drone' && !item.cleared) {
        drawDrone(p, item, t);
      }
    });
  }

  // 9. Runner (on the hub, a showcase pose centred in front of the skyline)
  let rPos, groundPos;
  if (inHub) {
    const showY = H * 0.50 + Math.sin(t * 1.6) * 4;
    rPos = { x: W / 2, y: showY, scale: 1.7 };
    groundPos = { x: W / 2, y: H * 0.50 + 6, scale: 1.7 };
  } else {
    rPos = project(runner.currentX * LANE_WIDTH, runner.y, 0);
    groundPos = project(runner.currentX * LANE_WIDTH, 0, 0);
  }
  drawCourier(runner, rPos, groundPos, t);

  // 10. Particles (additive)
  particleSystem.update(safeDt);
  particleSystem.draw(ctx);

  // 11. Post-processing
  if (runner.boostTimer > 0 && running) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = H * 0.32 + Math.random() * H * 0.1;
      const r1 = r0 + 40 + Math.random() * 120;
      const cx = W / 2, cy = H * 0.5;
      ctx.strokeStyle = `rgba(255, ${120 + Math.floor(Math.random() * 120)}, 200, ${0.15 + Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.32, W / 2, H * 0.55, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Scanlines
  if (RenderFX.scanPattern) {
    ctx.fillStyle = RenderFX.scanPattern;
    ctx.fillRect(0, 0, W, H);
  }

  // Hit flash
  if (RenderFX.flash > 0) {
    ctx.fillStyle = `rgba(255, 45, 117, ${(RenderFX.flash * 0.45).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return rPos;
}

// -------------------------------------------------------------
// GAME CONTROLLER & UI CONTROLLER (OPTION A)
// -------------------------------------------------------------
class GameController {
  constructor() {
    this.runner = new Runner();
    this.track = new TrackManager();
    this.state = 'HUB';
    this.runStartTime = 0;
    this.redeployCount = 0;
    this.currentRunId = null;

    // Roster state
    this.rosterTab = 'runners';
    this.equippedRunner = 'vex';
    this.equippedBoard = 'ion-glide';

    // Parental gate state
    this.pendingAction = null;
    this.parentalInput = '';
    this.parentalSolution = null;

    this.bindUI();
    this.bindControls();
    this.initBackend();
  }

  async initBackend() {
    try {
      const auth = await Api.initAuth();
      if (auth) {
        const profile = await Api.getProfile();
        document.getElementById('hubPlayerName').textContent = profile.display_name;
        document.getElementById('hubAgeBadge').textContent = profile.age_bucket.replace('_', ' ');
        if (profile.equipped) {
          this.equippedRunner = profile.equipped.runner_id || 'vex';
          this.equippedBoard = profile.equipped.board_id || 'ion-glide';
          this.runner.runnerId = this.equippedRunner;
          this.runner.boardId = this.equippedBoard;
          document.getElementById('hubRunnerName').textContent = this.equippedRunner.toUpperCase();
          document.getElementById('hubBoardName').textContent = `Grav-Board: ${this.equippedBoard.replace('-', ' ').toUpperCase()}`;
        }
        this.updateBalances();
      }
    } catch (e) {
      console.warn("Using offline / mock profile", e);
      document.getElementById('hubPlayerName').textContent = 'Runner#4821 (Offline)';
    }

    // Friend code setup
    const friendCode = `SKY-${(Api.playerId || 'RUNNER').substring(0, 4).toUpperCase()}`;
    const codeEl = document.getElementById('myFriendCode');
    if (codeEl) codeEl.textContent = friendCode;
  }

  async updateBalances() {
    try {
      const bal = await Api.getBalance();
      document.getElementById('hubChipsVal').textContent = bal.chips;
      document.getElementById('hubCoresVal').textContent = bal.cores;
    } catch (e) {}
  }

  bindUI() {
    // Hub Buttons
    document.getElementById('btnPlay').onclick = () => this.startRun();
    document.getElementById('btnPause').onclick = () => this.togglePause();

    // Redeploy Buttons
    document.getElementById('btnAdRedeploy').onclick = () => this.executeRedeploy('ad');
    document.getElementById('btnCoreRedeploy').onclick = () => this.executeRedeploy('cores');
    document.getElementById('btnGiveUp').onclick = () => this.concludeRun();

    // Summary Buttons
    document.getElementById('btnSummaryPlayAgain').onclick = () => {
      document.getElementById('summaryModal').style.display = 'none';
      this.startRun();
    };
    document.getElementById('btnSummaryHub').onclick = () => {
      document.getElementById('summaryModal').style.display = 'none';
      document.getElementById('hubScreen').style.display = 'flex';
      this.state = 'HUB';
      this.updateBalances();
      AudioSynth.muffle();
    };

    // Sub-buttons: Shop, Roster, Contracts, Leaderboard, Drops, Settings
    document.getElementById('btnShop').onclick = () => this.openShop();
    document.getElementById('btnCloseShop').onclick = () => this.closeShop();

    document.getElementById('btnRoster').onclick = () => this.openRoster();
    document.getElementById('btnCloseRoster').onclick = () => this.closeRoster();

    document.getElementById('tabRunners').onclick = () => this.selectRosterTab('runners');
    document.getElementById('tabBoards').onclick = () => this.selectRosterTab('boards');

    document.getElementById('btnContracts').onclick = () => this.openContracts();
    document.getElementById('btnCloseContracts').onclick = () => this.closeContracts();

    document.getElementById('btnLeaderboard').onclick = () => this.openLeaderboard();
    document.getElementById('btnCloseLeaderboard').onclick = () => {
      document.getElementById('leaderboardModal').style.display = 'none';
      AudioSynth.unmuffle();
    };

    document.getElementById('btnSupplyDrop').onclick = () => this.openSupplyDrops();
    document.getElementById('btnCloseSupplyDrop').onclick = () => {
      document.getElementById('supplyDropModal').style.display = 'none';
      AudioSynth.unmuffle();
    };
    document.getElementById('btnOpenEarnedDrop').onclick = () => this.executeOpenDrop();

    // Settings & Privacy UI
    document.getElementById('btnHubSettings').onclick = () => this.openSettings();
    document.getElementById('btnCloseSettings').onclick = () => this.closeSettings();

    // Audio Sliders
    const sfxSlider = document.getElementById('sliderSfx');
    if (sfxSlider) {
      sfxSlider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        document.getElementById('valSfx').textContent = `${val}%`;
        AudioSynth.setSfxVolume(val / 100);
      };
    }
    const musicSlider = document.getElementById('sliderMusic');
    if (musicSlider) {
      musicSlider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        document.getElementById('valMusic').textContent = `${val}%`;
        AudioSynth.setMusicVolume(val / 100);
      };
    }

    // Friend code buttons
    document.getElementById('btnCopyFriendCode').onclick = () => {
      const code = document.getElementById('myFriendCode').textContent;
      navigator.clipboard?.writeText(code);
      alert(`Friend code ${code} copied to clipboard!`);
    };
    document.getElementById('btnOpenAddFriend').onclick = () => {
      document.getElementById('addFriendModal').style.display = 'flex';
      document.getElementById('addFriendStatus').style.display = 'none';
    };
    document.getElementById('btnCloseAddFriend').onclick = () => {
      document.getElementById('addFriendModal').style.display = 'none';
    };
    document.getElementById('btnConfirmAddFriend').onclick = () => this.confirmAddFriend();

    // Age bucket selector
    document.querySelectorAll('.age-option-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.age-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const bucket = btn.dataset.bucket;
        Api.ageBucket = bucket;
        localStorage.setItem(STORAGE_KEY_AGE_BUCKET, bucket);
        document.getElementById('hubAgeBadge').textContent = bucket.replace('_', ' ');
      };
    });

    // GDPR buttons
    document.getElementById('btnExportData').onclick = () => this.handleDataExport();
    document.getElementById('btnDeleteAccount').onclick = () => this.handleAccountDeletion();

    // Parental gate modal buttons
    document.getElementById('btnCloseParentalGate').onclick = () => this.closeParentalGate();
    document.querySelectorAll('.pin-key[data-digit]').forEach(k => {
      k.onclick = () => {
        if (this.parentalInput.length < 5) {
          this.parentalInput += k.dataset.digit;
          document.getElementById('parentalInputDisplay').textContent = this.parentalInput;
        }
      };
    });
    document.getElementById('btnPinClear').onclick = () => {
      this.parentalInput = '';
      document.getElementById('parentalInputDisplay').textContent = '_';
    };
    document.getElementById('btnPinSubmit').onclick = () => this.submitParentalGate();
  }

  bindControls() {
    window.addEventListener('keydown', (e) => {
      AudioSynth.init();
      if (this.state !== 'RUNNING') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.runner.changeLane(-1);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.runner.changeLane(1);
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') this.runner.jump();
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.runner.slide();
    });

    document.getElementById('ctrlLeft').onclick = () => { AudioSynth.init(); this.runner.changeLane(-1); };
    document.getElementById('ctrlRight').onclick = () => { AudioSynth.init(); this.runner.changeLane(1); };
    document.getElementById('ctrlJump').onclick = () => { AudioSynth.init(); this.runner.jump(); };
    document.getElementById('ctrlSlide').onclick = () => { AudioSynth.init(); this.runner.slide(); };

    let touchStartX = 0, touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
      AudioSynth.init();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });

    canvas.addEventListener('touchend', (e) => {
      if (this.state !== 'RUNNING') return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) > 25) {
        if (absX > absY) {
          if (dx > 0) this.runner.changeLane(1);
          else this.runner.changeLane(-1);
        } else {
          if (dy > 0) this.runner.slide();
          else this.runner.jump();
        }
      }
    });
  }

  startRun() {
    AudioSynth.init();
    AudioSynth.unmuffle();
    AudioSynth.startBassline();

    this.runner.reset();
    this.runner.runnerId = this.equippedRunner;
    this.runner.boardId = this.equippedBoard;
    this.runner.invulnerableTimer = 3.0; // 3s grace
    this.track.reset();
    this.redeployCount = 0;
    this.currentRunId = uuidv4();
    this.runStartTime = Date.now();

    document.getElementById('hubScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('redeployModal').style.display = 'none';
    document.getElementById('summaryModal').style.display = 'none';

    this.state = 'RUNNING';
  }

  togglePause() {
    if (this.state === 'RUNNING') {
      this.state = 'PAUSED';
      AudioSynth.muffle();
      document.getElementById('btnPause').textContent = '▶';
    } else if (this.state === 'PAUSED') {
      this.state = 'RUNNING';
      AudioSynth.unmuffle();
      document.getElementById('btnPause').textContent = '⏸';
    }
  }

  triggerCrash() {
    AudioSynth.crash();
    AudioSynth.muffle();
    this.state = 'REDEPLOY';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('redeployModal').style.display = 'flex';

    const coreCost = this.redeployCount === 0 ? 10 : (this.redeployCount === 1 ? 20 : 40);
    const btnCore = document.getElementById('btnCoreRedeploy');
    const costText = document.getElementById('coreRedeployCost');
    const currentCores = this.cores || 0;

    // CRIT-A2, RED-204: Check cores balance against cost and show shortfall
    if (currentCores < coreCost) {
      const shortfall = coreCost - currentCores;
      costText.textContent = `Cost: ${coreCost} Cores (Shortfall: ${shortfall})`;
      btnCore.disabled = true;
      btnCore.classList.add('disabled');
      btnCore.style.opacity = '0.5';
      btnCore.style.cursor = 'not-allowed';
    } else {
      costText.textContent = `Cost: ${coreCost} Cores`;
      btnCore.disabled = false;
      btnCore.classList.remove('disabled');
      btnCore.style.opacity = '1';
      btnCore.style.cursor = 'pointer';
    }
  }

  async executeRedeploy(method) {
    const coreCost = this.redeployCount === 0 ? 10 : (this.redeployCount === 1 ? 20 : 40);
    if (method === 'cores' && (this.cores || 0) < coreCost) {
      alert(`Insufficient Cores balance (${this.cores || 0}/${coreCost}). Please watch an ad or conclude run.`);
      return;
    }

    try {
      const res = await Api.redeploy(method, this.currentRunId);
      if (res && res.cores_remaining !== undefined) {
        this.cores = res.cores_remaining;
        this.updateBalances();
      }
    } catch (e) {
      console.warn("Redeploy failed:", e);
      alert(`Redeploy failed: ${e.message || 'Unable to redeploy'}. Please watch an ad or conclude run.`);
      return; // CRIT-A2: DO NOT revive player if redeploy fails!
    }

    this.redeployCount++;
    this.runner.invulnerableTimer = 2.5;
    document.getElementById('redeployModal').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    AudioSynth.unmuffle();
    this.state = 'RUNNING';
  }

  async concludeRun() {
    document.getElementById('redeployModal').style.display = 'none';
    AudioSynth.stopBassline();
    AudioSynth.muffle();

    const meters = Math.floor(this.track.distance);
    const chips = this.track.chipsCollected;
    const duration = (Date.now() - this.runStartTime) / 1000;

    document.getElementById('summaryMeters').textContent = `${meters} m`;
    document.getElementById('summaryChips').textContent = `+${chips}`;
    document.getElementById('summaryXp').textContent = `+${Math.floor(meters / 20)} XP`;

    try {
      const res = await Api.submitRun(meters, chips, duration, this.track.powerupsCollected, this.equippedRunner, this.equippedBoard);
      document.getElementById('summaryIntegrity').textContent = `VERIFIED (${res.integrity_flag.toUpperCase()})`;
      document.getElementById('summaryIntegrity').className = res.integrity_flag === 'ok' ? 'stat-val badge-ok' : 'stat-val';
    } catch (e) {
      document.getElementById('summaryIntegrity').textContent = 'QUEUED FOR SYNC';
    }

    document.getElementById('summaryModal').style.display = 'flex';
    this.state = 'SUMMARY';
  }

  // --- S04 Shop ---
  openShop() {
    AudioSynth.muffle();
    document.getElementById('shopModal').style.display = 'flex';
  }

  closeShop() {
    document.getElementById('shopModal').style.display = 'none';
    if (this.state === 'HUB') AudioSynth.unmuffle();
  }

  async buyPack(sku, coresAmount, price) {
    // Check if player is under 13 -> require parental gate
    if (Api.ageBucket === 'under_13') {
      this.openParentalGate(async (gateToken) => {
        await this.completePurchase(sku, coresAmount, gateToken);
      });
      return;
    }
    await this.completePurchase(sku, coresAmount, null);
  }

  async completePurchase(sku, coresAmount, gateToken) {
    try {
      const txId = `in_app_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await Api.submitPurchaseReceipt(sku, txId, 'mock_signed_jws_payload', gateToken);
      alert(`🎉 Purchase successful! Entitlements granted.`);
      this.updateBalances();
    } catch (e) {
      alert(`Purchase failed: ${e.message || 'Verification error'}`);
    }
  }

  // --- S04A Parental Gate Challenge Modal ---
  async openParentalGate(onSuccess) {
    this.pendingAction = onSuccess;
    this.parentalInput = '';
    document.getElementById('parentalInputDisplay').textContent = '_';
    document.getElementById('parentalGateError').style.display = 'none';
    document.getElementById('parentalGateModal').style.display = 'flex';

    try {
      const challenge = await Api.getParentalGateChallenge();
      this.challengeToken = challenge.challenge_token;
      document.getElementById('parentalChallengeText').textContent = challenge.question;
    } catch (e) {
      document.getElementById('parentalChallengeText').textContent = 'Parental gate server unavailable';
    }
  }

  closeParentalGate() {
    document.getElementById('parentalGateModal').style.display = 'none';
    this.pendingAction = null;
  }

  async submitParentalGate() {
    const answer = parseInt(this.parentalInput, 10);
    const errEl = document.getElementById('parentalGateError');
    if (isNaN(answer)) {
      errEl.textContent = 'Please enter an answer using the keypad.';
      errEl.style.display = 'block';
      return;
    }

    try {
      const res = await Api.verifyParentalGate(this.challengeToken, answer);
      document.getElementById('parentalGateModal').style.display = 'none';
      if (this.pendingAction) {
        this.pendingAction(res.parental_gate_token);
        this.pendingAction = null;
      }
    } catch (e) {
      errEl.textContent = 'Incorrect answer. Please solve the challenge to proceed.';
      errEl.style.display = 'block';
      this.parentalInput = '';
      document.getElementById('parentalInputDisplay').textContent = '_';
    }
  }

  // --- S05 Roster & Customization ---
  async openRoster() {
    AudioSynth.muffle();
    document.getElementById('rosterModal').style.display = 'flex';
    this.renderRosterTab();
  }

  closeRoster() {
    document.getElementById('rosterModal').style.display = 'none';
    if (this.state === 'HUB') AudioSynth.unmuffle();
  }

  selectRosterTab(tab) {
    this.rosterTab = tab;
    document.getElementById('tabRunners').classList.toggle('active', tab === 'runners');
    document.getElementById('tabBoards').classList.toggle('active', tab === 'boards');
    this.renderRosterTab();
  }

  async renderRosterTab() {
    const container = document.getElementById('rosterCardsContainer');
    container.innerHTML = '<div class="loading-msg">Loading tech specs...</div>';

    try {
      const roster = await Api.getRoster();
      const items = this.rosterTab === 'runners' ? roster.runners : roster.boards;

      container.innerHTML = items.map(item => {
        const isEquipped = item.equipped || (this.rosterTab === 'runners' ? item.id === this.equippedRunner : item.id === this.equippedBoard);
        const icon = this.rosterTab === 'runners'
          ? (item.id === 'vex' ? '⚡' : (item.id === 'kael' ? '🧲' : '🛡️'))
          : (item.id === 'ion-glide' ? '🛹' : (item.id === 'pulse-ray' ? '⚡' : '💥'));

        const desc = this.rosterTab === 'runners'
          ? (item.id === 'vex' ? 'Overdrive Speed (+10%)' : (item.id === 'kael' ? 'Magnetic Flux (+25% Reach)' : 'Force Shield (+30% Duration)'))
          : (item.id === 'ion-glide' ? 'Balanced Rooftop Glide' : (item.id === 'pulse-ray' ? '2X Chip Multiplier (+3s)' : 'Demolition Boost Shockwave'));

        return `
          <div class="roster-card ${isEquipped ? 'equipped' : ''}">
            ${isEquipped ? '<span class="badge-equipped">EQUIPPED</span>' : ''}
            <div class="roster-avatar">${icon}</div>
            <h4>${item.name.toUpperCase()}</h4>
            <p class="roster-stats">${desc}</p>
            ${isEquipped ? `
              <button class="btn btn-sm btn-secondary" disabled>EQUIPPED</button>
            ` : item.owned ? `
              <button class="btn btn-sm btn-primary" onclick="window.game.equipItem('${this.rosterTab === 'runners' ? 'runner' : 'board'}', '${item.id}')">EQUIP</button>
            ` : `
              <button class="btn btn-sm btn-accent" onclick="window.game.unlockItem('${this.rosterTab === 'runners' ? 'runner' : 'board'}', '${item.id}', ${item.unlock_cost_cores ?? 50})">UNLOCK (🔷 ${item.unlock_cost_cores ?? 50})</button>
            `}
          </div>
        `;
      }).join('');
    } catch (e) {
      container.innerHTML = '<div>Could not load roster catalog.</div>';
    }
  }

  async equipItem(type, id) {
    try {
      await Api.equipRosterItem(type, id);
      if (type === 'runner') {
        this.equippedRunner = id;
        this.runner.runnerId = id;
        document.getElementById('hubRunnerName').textContent = id.toUpperCase();
      } else {
        this.equippedBoard = id;
        this.runner.boardId = id;
        document.getElementById('hubBoardName').textContent = `Grav-Board: ${id.replace('-', ' ').toUpperCase()}`;
      }
      this.renderRosterTab();
    } catch (e) {
      alert(`Equip error: ${e.message || 'Failed'}`);
    }
  }

  async unlockItem(type, id, cost) {
    try {
      await Api.unlockRosterItem(type, id);
      alert(`🎉 Unlocked ${id.toUpperCase()}!`);
      this.updateBalances();
      this.renderRosterTab();
    } catch (e) {
      alert(`Unlock failed: ${e.message || 'Insufficient Cores'}`);
    }
  }

  // --- S06 Contracts ---
  async openContracts() {
    AudioSynth.muffle();
    document.getElementById('contractsModal').style.display = 'flex';
    const list = document.getElementById('contractsList');
    list.innerHTML = '<div class="loading-msg">Connecting to Contracts network...</div>';

    try {
      const data = await Api.getContracts();
      const allContracts = [...(data.daily || [])];
      if (data.weekly_heist) allContracts.push(data.weekly_heist);
      else if (data.weekly) allContracts.push(data.weekly);

      list.innerHTML = allContracts.map(c => {
        const current = c.progress !== undefined ? c.progress : (c.objective?.current || 0);
        const target = c.target !== undefined ? c.target : (c.objective?.target || 1);
        const pct = Math.min(100, Math.floor((current / target) * 100));
        const isComplete = c.completed !== undefined ? c.completed : (c.status === 'completed' || current >= target);
        const isClaimed = c.claimed !== undefined ? c.claimed : (c.status === 'claimed');
        const metric = c.metric || c.objective?.metric || 'points';
        const chipsReward = c.reward?.chips;
        const coresReward = c.reward?.cores;

        return `
          <div class="contract-card">
            <div class="contract-info">
              <h4>${c.title || c.contract_id.toUpperCase()}</h4>
              <div class="contract-desc">Target: ${target} ${metric} &bull; Reward: ${chipsReward ? `${chipsReward} Chips 💎` : `${coresReward} Cores 🔷`}</div>
              <div class="contract-progress-container">
                <div class="contract-progress-bar" style="width: ${pct}%"></div>
              </div>
              <div class="contract-progress-text">${current} / ${target} (${pct}%)</div>
            </div>
            ${isClaimed ? `
              <button class="btn btn-sm btn-secondary" disabled>CLAIMED</button>
            ` : isComplete ? `
              <button class="btn btn-sm btn-primary pulse-btn" onclick="window.game.claimContract('${c.contract_id}')">CLAIM</button>
            ` : `
              <button class="btn btn-sm btn-secondary" disabled>IN PROGRESS</button>
            `}
          </div>
        `;
      }).join('');
    } catch (e) {
      list.innerHTML = '<div>Could not load contracts.</div>';
    }
  }

  closeContracts() {
    document.getElementById('contractsModal').style.display = 'none';
    if (this.state === 'HUB') AudioSynth.unmuffle();
  }

  async claimContract(id) {
    try {
      await Api.claimContract(id);
      alert('🎉 Contract objective reward claimed!');
      this.updateBalances();
      this.openContracts();
    } catch (e) {
      alert(`Claim: ${e.message || 'Cannot claim yet'}`);
    }
  }

  // --- S08 Settings & Privacy ---
  openSettings() {
    AudioSynth.muffle();
    document.getElementById('settingsModal').style.display = 'flex';
  }

  closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
    if (this.state === 'HUB') AudioSynth.unmuffle();
  }

  async confirmAddFriend() {
    const input = document.getElementById('inputFriendCode');
    const status = document.getElementById('addFriendStatus');
    const code = (input.value || '').trim();
    if (!code) {
      status.textContent = 'Please enter a valid friend code.';
      status.style.display = 'block';
      return;
    }
    try {
      await Api.addFriend(code);
      alert(`Linked with Courier ${code}!`);
      document.getElementById('addFriendModal').style.display = 'none';
      input.value = '';
    } catch (e) {
      status.textContent = e.message || 'Friend code not found.';
      status.style.display = 'block';
    }
  }

  async handleDataExport() {
    const doExport = async (gateToken) => {
      try {
        const res = await Api.exportData(gateToken);
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `skyline-rush-player-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('📥 GDPR Art. 15 Data Export downloaded successfully.');
      } catch (e) {
        alert(`Export failed: ${e.message || 'Server error'}`);
      }
    };

    if (Api.ageBucket === 'under_13') {
      this.openParentalGate(doExport);
    } else {
      doExport(null);
    }
  }

  async handleAccountDeletion() {
    const confirmed = confirm('⚠️ WARNING: This will permanently wipe all courier progress, currency balances, and unlocks per GDPR Art. 17. Are you sure you want to proceed?');
    if (!confirmed) return;

    const doDelete = async (gateToken) => {
      try {
        await Api.deleteAccount(gateToken);
        localStorage.clear();
        alert('Account permanently wiped. Reloading fresh session.');
        window.location.reload();
      } catch (e) {
        alert(`Deletion error: ${e.message || 'Server error'}`);
      }
    };

    if (Api.ageBucket === 'under_13') {
      this.openParentalGate(doDelete);
    } else {
      doDelete(null);
    }
  }

  // --- Leaderboard & Drops ---
  async openLeaderboard() {
    AudioSynth.muffle();
    document.getElementById('leaderboardModal').style.display = 'flex';
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '<div class="loading-msg">Fetching rankings...</div>';

    try {
      const data = await Api.getLeaderboard();
      if (!data.items || data.items.length === 0) {
        list.innerHTML = '<div class="loading-msg">No runs recorded yet. Be the first!</div>';
      } else {
        list.innerHTML = data.items.map((item, idx) => `
          <div class="lb-row ${item.player_id === Api.playerId ? 'self' : ''}">
            <span class="lb-rank ${idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''))}">#${item.rank}</span>
            <span class="lb-name">${item.display_name}</span>
            <span class="lb-meters"><b>${item.meters} m</b></span>
          </div>
        `).join('');
      }

      if (data.self_rank) {
        document.getElementById('selfRankBar').innerHTML = `Your Best: <b>${data.self_rank.meters} m</b> (Rank: #${data.self_rank.rank})`;
      }
    } catch (e) {
      list.innerHTML = '<div class="loading-msg">Could not reach leaderboard service.</div>';
    }
  }

  async openSupplyDrops() {
    AudioSynth.muffle();
    document.getElementById('supplyDropModal').style.display = 'flex';
    document.getElementById('dropResultBox').style.display = 'none';
    const oddsList = document.getElementById('oddsTableList');

    try {
      const table = await Api.getSupplyDropTable();
      oddsList.innerHTML = table.entries.map(e => `
        <div class="odds-row">
          <span>${e.reward.replace('_', ' ').toUpperCase()}</span>
          <span><b>${(e.probability * 100).toFixed(1)}%</b></span>
        </div>
      `).join('');
    } catch (e) {
      oddsList.innerHTML = '<div>Disclosed table standard-v7</div>';
    }
  }

  async executeOpenDrop() {
    const resBox = document.getElementById('dropResultBox');
    try {
      const res = await Api.openSupplyDrop('earned');
      resBox.style.display = 'block';
      resBox.innerHTML = `🎉 DROPPED: <b>${res.result.reward.toUpperCase()}</b> (+${res.result.amount})`;
      this.updateBalances();
    } catch (e) {
      resBox.style.display = 'block';
      resBox.textContent = `Open failed: ${e.message || 'Error'}`;
    }
  }

  updateHUD() {
    document.getElementById('hudMeters').textContent = `${Math.floor(this.track.distance)} m`;
    document.getElementById('hudChips').textContent = `${this.track.chipsCollected}`;
    const speedEl = document.getElementById('hudSpeed');
    if (speedEl) {
      const kmh = Math.round(this.track.speed * 0.18);
      speedEl.textContent = `${kmh}`;
      const speedFill = document.getElementById('hudSpeedFill');
      if (speedFill) speedFill.style.width = `${Math.min(100, (this.track.speed / 720) * 100)}%`;
      speedEl.parentElement.classList.toggle('boosting', this.runner.boostTimer > 0);
    }

    const bar = document.getElementById('powerupBar');
    bar.innerHTML = '';
    if (this.runner.hasShield) bar.innerHTML += '<div class="powerup-pill">SHIELD ACTIVE</div>';
    if (this.runner.magnetTimer > 0) bar.innerHTML += `<div class="powerup-pill">MAGNET ${Math.ceil(this.runner.magnetTimer)}s</div>`;
    if (this.runner.boostTimer > 0) bar.innerHTML += `<div class="powerup-pill">BOOST ${Math.ceil(this.runner.boostTimer)}s</div>`;
    if (this.runner.multiplierTimer > 0) bar.innerHTML += `<div class="powerup-pill">2X CHIPS ${Math.ceil(this.runner.multiplierTimer)}s</div>`;
  }
}

// -------------------------------------------------------------
// MAIN GAME LOOP
// -------------------------------------------------------------
const game = new GameController();
window.game = game;

let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  let pRunner = null;
  if (game.state === 'RUNNING') {
    const result = game.track.update(dt, game.runner, particleSystem);
    if (result.crashed) {
      const p = project(game.runner.currentX * LANE_WIDTH, game.runner.y, 0);
      particleSystem.addDebrisShockwave(p.x, p.y);
      RenderFX.shake = 16;
      RenderFX.flash = 1;
      game.triggerCrash();
    }
    game.updateHUD();
  }

  pRunner = render(game.runner, game.track, dt);

  if (game.state === 'RUNNING') {
    game.runner.update(dt, particleSystem, pRunner);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
