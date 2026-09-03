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
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      if (p.isRing) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = 'bold 16px Orbitron, monospace';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
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
    for (let i = 0; i < 7; i++) {
      this.vehicles.push({
        x: Math.random() * 800 - 400,
        y: 45 + Math.random() * 110,
        speed: (Math.random() > 0.5 ? 1 : -1) * (45 + Math.random() * 65),
        color: (i % 2 === 0) ? '#00f0ff' : '#ff0055',
        length: 22 + Math.random() * 16
      });
    }
  }
  update(dt, w) {
    this.vehicles.forEach(v => {
      v.x += v.speed * dt;
      if (v.speed > 0 && v.x > w + 60) v.x = -60;
      if (v.speed < 0 && v.x < -60) v.x = w + 60;
    });
  }
  draw(ctx) {
    ctx.save();
    this.vehicles.forEach(v => {
      ctx.fillStyle = v.color;
      ctx.shadowColor = v.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(v.x, v.y, v.length, 4);

      // Headlight / Taillight
      const isRight = v.speed > 0;
      ctx.fillStyle = isRight ? '#ffffff' : '#ff0055';
      ctx.fillRect(isRight ? v.x + v.length : v.x - 3, v.y - 1, 4, 6);
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
// RENDERER (CYBERPUNK VANTAGE CITY)
// -------------------------------------------------------------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = canvas.width;
let H = canvas.height;

function resizeCanvas() {
  const container = document.getElementById('game-container');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  W = canvas.width;
  H = canvas.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function project(x, y, z) {
  const fov = 320;
  const cameraZ = -140;
  const cameraY = 160;
  const dist = z - cameraZ;
  if (dist <= 10) return { x: -9999, y: -9999, scale: 0 };
  const scale = fov / dist;
  const projX = (W / 2) + (x * scale);
  const projY = (H * 0.68) - ((y - cameraY) * scale);
  return { x: projX, y: projY, scale: scale };
}

const hoverTraffic = new HoverTraffic();
const particleSystem = new ParticleSystem();

// Billboard slogans
const BILLBOARDS = [
  'NEO MARINA', 'ION DRINK', 'CYBER-LINK', 'RUN FASTER', 'VANTAGE TECH'
];

function render(runner, track, dt) {
  ctx.clearRect(0, 0, W, H);

  // 1. Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  skyGrad.addColorStop(0, '#0a0d1a');
  skyGrad.addColorStop(0.5, '#19153a');
  skyGrad.addColorStop(1, '#ff0055');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.65);

  // Distant Skyscraper Silhouettes
  ctx.fillStyle = '#0a0c18';
  const time = Date.now() * 0.0005;
  for (let i = 0; i < 14; i++) {
    const bW = 35 + ((i * 19) % 45);
    const bH = 140 + ((i * 37) % 180);
    const bX = (i * 38) - 20;
    const bY = (H * 0.65) - bH;
    ctx.fillRect(bX, bY, bW, bH);

    // Glowing Windows
    ctx.fillStyle = (i % 3 === 0) ? '#00f0ff' : ((i % 3 === 1) ? '#ff0055' : '#ffd700');
    ctx.globalAlpha = 0.35 + Math.sin(time + i) * 0.15;
    for (let wy = bY + 15; wy < (H * 0.65) - 20; wy += 22) {
      ctx.fillRect(bX + 8, wy, 4, 8);
      ctx.fillRect(bX + bW - 12, wy, 4, 8);
    }
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#0a0c18';
  }

  // Option C: Moving Skyline Hover-Traffic
  hoverTraffic.update(dt, W);
  hoverTraffic.draw(ctx);

  // 2. Rooftop Runner Track (3 Lanes)
  const pNearL = project(-LANE_WIDTH * 1.6, 0, 0);
  const pNearR = project(LANE_WIDTH * 1.6, 0, 0);
  const pFarL = project(-LANE_WIDTH * 1.6, 0, 800);
  const pFarR = project(LANE_WIDTH * 1.6, 0, 800);

  // Track Surface
  ctx.fillStyle = '#0d1020';
  ctx.beginPath();
  ctx.moveTo(pNearL.x, pNearL.y);
  ctx.lineTo(pFarL.x, pFarL.y);
  ctx.lineTo(pFarR.x, pFarR.y);
  ctx.lineTo(pNearR.x, pNearR.y);
  ctx.closePath();
  ctx.fill();

  // Lane Dividers
  ctx.lineWidth = 2;
  [-0.5, 0.5].forEach(dividerLane => {
    const n = project(dividerLane * LANE_WIDTH, 0, 0);
    const f = project(dividerLane * LANE_WIDTH, 0, 800);
    ctx.strokeStyle = '#00f0ff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(f.x, f.y);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  });

  // Track Edges (Magenta Glow)
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pNearL.x, pNearL.y);
  ctx.lineTo(pFarL.x, pFarL.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pNearR.x, pNearR.y);
  ctx.lineTo(pFarR.x, pFarR.y);
  ctx.stroke();

  // Option C: Rooftop Props (Industrial Fans & AC units along track sides)
  const fanAngle = Date.now() * 0.008;
  for (let zProp = 100; zProp < 700; zProp += 180) {
    const pPropL = project(-LANE_WIDTH * 1.9, 0, zProp);
    const pPropR = project(LANE_WIDTH * 1.9, 0, zProp + 90);
    [pPropL, pPropR].forEach(pProp => {
      if (pProp.scale > 0) {
        ctx.fillStyle = '#181b2e';
        ctx.fillRect(pProp.x - 12 * pProp.scale, pProp.y - 24 * pProp.scale, 24 * pProp.scale, 24 * pProp.scale);
        // Spinning Fan Blades
        ctx.save();
        ctx.translate(pProp.x, pProp.y - 12 * pProp.scale);
        ctx.rotate(fanAngle);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2 * pProp.scale;
        ctx.beginPath();
        ctx.moveTo(-8 * pProp.scale, 0);
        ctx.lineTo(8 * pProp.scale, 0);
        ctx.moveTo(0, -8 * pProp.scale);
        ctx.lineTo(0, 8 * pProp.scale);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // Option C: Overhead Sky-Bridges (every 140m of track distance)
  const bridgeZ = (140 - (track.distance % 140)) * 6;
  if (bridgeZ > 20 && bridgeZ < 750) {
    const pBLeft = project(-LANE_WIDTH * 2.1, 110, bridgeZ);
    const pBRight = project(LANE_WIDTH * 2.1, 110, bridgeZ);
    const pBLeftG = project(-LANE_WIDTH * 2.1, 0, bridgeZ);
    const pBRightG = project(LANE_WIDTH * 2.1, 0, bridgeZ);

    if (pBLeft.scale > 0 && pBRight.scale > 0) {
      // Pylons
      ctx.strokeStyle = '#1e2540';
      ctx.lineWidth = 6 * pBLeft.scale;
      ctx.beginPath();
      ctx.moveTo(pBLeftG.x, pBLeftG.y);
      ctx.lineTo(pBLeft.x, pBLeft.y);
      ctx.moveTo(pBRightG.x, pBRightG.y);
      ctx.lineTo(pBRight.x, pBRight.y);
      ctx.stroke();

      // Bridge Beam
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 4 * pBLeft.scale;
      ctx.beginPath();
      ctx.moveTo(pBLeft.x, pBLeft.y);
      ctx.lineTo(pBRight.x, pBRight.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // High-voltage warning beacons
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(pBLeft.x, pBLeft.y - 6 * pBLeft.scale, 4 * pBLeft.scale, 0, Math.PI * 2);
      ctx.arc(pBRight.x, pBRight.y - 6 * pBRight.scale, 4 * pBRight.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Option C: Volumetric Neon Billboards
  for (let bIdx = 0; bIdx < BILLBOARDS.length; bIdx++) {
    const bZ = ((bIdx * 160) - (track.distance * 5 % 800) + 800) % 800;
    if (bZ > 30 && bZ < 750) {
      const side = (bIdx % 2 === 0) ? -1 : 1;
      const pBoard = project(side * LANE_WIDTH * 2.3, 60, bZ);
      if (pBoard.scale > 0) {
        const bw = 90 * pBoard.scale;
        const bh = 45 * pBoard.scale;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 14, 28, 0.85)';
        ctx.strokeStyle = (bIdx % 2 === 0) ? '#00f0ff' : '#ff0055';
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2 * pBoard.scale;
        ctx.strokeRect(pBoard.x - bw / 2, pBoard.y - bh / 2, bw, bh);
        ctx.fillRect(pBoard.x - bw / 2, pBoard.y - bh / 2, bw, bh);

        // Animated Slogan with Scanlines
        ctx.font = `bold ${Math.max(6, Math.floor(10 * pBoard.scale))}px Orbitron, monospace`;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.textAlign = 'center';
        ctx.fillText(BILLBOARDS[bIdx], pBoard.x, pBoard.y + 4 * pBoard.scale);

        // Scanline sweep (RED-213: guard bh > 1 against modulo zero NaN)
        const scanY = bh > 1 ? (pBoard.y - bh / 2 + ((Date.now() * 0.05) % bh)) : pBoard.y;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pBoard.x - bw / 2, scanY);
        ctx.lineTo(pBoard.x + bw / 2, scanY);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // 3. Render Track Elements (Back to Front)
  const sortedItems = [...track.segments].sort((a, b) => b.z - a.z);

  sortedItems.forEach(item => {
    if (item.z < -40 || item.z > 800) return;
    const p = project(item.lane * LANE_WIDTH, 0, item.z);

    if (item.type === 'chip' && !item.collected) {
      const size = Math.max(4, 18 * p.scale);
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 15 * p.scale - size);
      ctx.lineTo(p.x + size, p.y - 15 * p.scale);
      ctx.lineTo(p.x, p.y - 15 * p.scale + size);
      ctx.lineTo(p.x - size, p.y - 15 * p.scale);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (item.type === 'powerup' && !item.collected) {
      const size = Math.max(6, 24 * p.scale);
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 25 * p.scale, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (item.type === 'hurdle' && !item.cleared) {
      const w = Math.max(10, item.width * p.scale);
      const h = Math.max(8, item.height * p.scale);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(p.x - w / 2, p.y - h, w, h);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
    } else if (item.type === 'high_pipe' && !item.cleared) {
      const w = Math.max(12, item.width * p.scale);
      const h = Math.max(10, item.height * p.scale);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(p.x - w / 2, p.y - h - 45 * p.scale, w, 18 * p.scale);
    } else if (item.type === 'drone' && !item.cleared) {
      const r = Math.max(8, 22 * p.scale);
      ctx.fillStyle = '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 30 * p.scale, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Scanning beam
      ctx.fillStyle = 'rgba(255, 0, 85, 0.2)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 30 * p.scale);
      ctx.lineTo(p.x - r * 1.8, p.y);
      ctx.lineTo(p.x + r * 1.8, p.y);
      ctx.closePath();
      ctx.fill();
    }
  });

  // 4. Render Runner (Grav-Board + Courier)
  const rPos = project(runner.currentX * LANE_WIDTH, runner.y, 0);
  const rScale = rPos.scale;

  // Invulnerability shield
  if (runner.invulnerableTimer > 0) {
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rPos.x, rPos.y - 45 * rScale, 52 * rScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
  }

  // Force Shield Bubble
  if (runner.hasShield) {
    ctx.strokeStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 22;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(rPos.x, rPos.y - 45 * rScale, 56 * rScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Grav-Board
  ctx.fillStyle = runner.boostTimer > 0 ? '#ff0055' : (runner.boardId === 'pulse-ray' ? '#ffaa00' : '#00f0ff');
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 16;
  const bW = 68 * rScale;
  const bH = 12 * rScale;
  ctx.beginPath();
  ctx.ellipse(rPos.x, rPos.y - 5 * rScale, bW / 2, bH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Courier Body
  if (runner.isSliding) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rPos.x - 24 * rScale, rPos.y - 28 * rScale, 48 * rScale, 20 * rScale);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(rPos.x + 10 * rScale, rPos.y - 25 * rScale, 12 * rScale, 8 * rScale);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rPos.x - 16 * rScale, rPos.y - 65 * rScale, 32 * rScale, 45 * rScale);
    ctx.fillStyle = '#101426';
    ctx.beginPath();
    ctx.arc(rPos.x, rPos.y - 78 * rScale, 15 * rScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(rPos.x - 8 * rScale, rPos.y - 82 * rScale, 18 * rScale, 7 * rScale);
  }

  ctx.globalAlpha = 1.0;

  // 5. Draw Particle Systems (Option C)
  particleSystem.update(dt);
  particleSystem.draw(ctx);

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
