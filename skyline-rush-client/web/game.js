/**
 * Skyline Rush — Playable Web Runner (Vantage City)
 * Full client engine connected to the Skyline Rush API Gateway.
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? window.location.origin
  : 'http://localhost:3000';

// Storage keys
const STORAGE_KEY_TOKEN = 'skyline_access_token';
const STORAGE_KEY_PLAYER_ID = 'skyline_player_id';
const STORAGE_KEY_DEVICE_ID = 'skyline_device_id';

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
          age_bucket: '16_plus'
        })
      });
      this.token = auth.access_token;
      this.playerId = auth.player_id;
      localStorage.setItem(STORAGE_KEY_TOKEN, this.token);
      localStorage.setItem(STORAGE_KEY_PLAYER_ID, this.playerId);
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

  async submitRun(meters, chips, durationSec, powerupsCount) {
    return this.request('/v1/runs', {
      method: 'POST',
      headers: { 'Idempotency-Key': uuidv4() },
      body: JSON.stringify({
        district_id: 'neo-marina',
        runner_id: 'vex',
        board_id: 'ion-glide',
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
  }
};

// -------------------------------------------------------------
// GAME STATE & AUDIO
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

const AudioSynth = {
  ctx: null,
  init() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {}
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
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },
  chip() { this.beep(880, 0.08, 'triangle', 0.12); },
  jump() { this.beep(340, 0.15, 'sine', 0.2); },
  slide() { this.beep(180, 0.18, 'sawtooth', 0.15); },
  crash() { this.beep(110, 0.35, 'square', 0.3); },
  powerup() {
    this.beep(520, 0.1, 'sine', 0.2);
    setTimeout(() => this.beep(780, 0.15, 'sine', 0.2), 80);
  }
};

// -------------------------------------------------------------
// RUNNER & 3-LANE SIMULATION
// -------------------------------------------------------------
const Lanes = { LEFT: -1, CENTER: 0, RIGHT: 1 };
const LANE_WIDTH = 110;

class Runner {
  constructor() {
    this.reset();
  }

  reset() {
    this.targetLane = Lanes.CENTER;
    this.currentX = 0; // -1 to 1
    this.y = 0; // vertical height above track
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

    this.invulnerableTimer = 0; // post-redeploy grace
    this.particles = [];
  }

  changeLane(dir) {
    const next = this.targetLane + dir;
    if (next >= -1 && next <= 1) {
      this.targetLane = next;
      AudioSynth.beep(420, 0.06, 'triangle', 0.08);
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

  update(dt) {
    // Lane lateral interpolation
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

    // Slide timer
    if (this.isSliding) {
      this.slideTimer += dt;
      if (this.slideTimer >= this.slideDuration) {
        this.isSliding = false;
      }
    }

    // Power-up durations
    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.multiplierTimer > 0) this.multiplierTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

    // Thruster particles
    if (Math.random() < 0.6) {
      this.particles.push({
        x: this.currentX * LANE_WIDTH,
        y: this.y + (this.isSliding ? 8 : 16),
        z: 0,
        vx: (Math.random() - 0.5) * 20,
        vy: -Math.random() * 20,
        life: 0.35,
        maxLife: 0.35,
        color: this.boostTimer > 0 ? '#ff0055' : '#00f0ff'
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }
}

// -------------------------------------------------------------
// TRACK & OBSTACLE PROCEDURAL GENERATION
// -------------------------------------------------------------
class TrackManager {
  constructor() {
    this.segments = [];
    this.nextZ = 450;
    this.baseSpeed = 240; // units per sec
    this.speed = this.baseSpeed;
    this.distance = 0;
    this.chipsCollected = 0;
    this.powerupsCollected = 0;
    this.lastObstacleLane = null;
  }

  reset() {
    this.segments = [];
    this.nextZ = 400; // Far enough ahead so nothing spawns in player's face
    this.speed = this.baseSpeed;
    this.distance = 0;
    this.chipsCollected = 0;
    this.powerupsCollected = 0;
    this.lastObstacleLane = null;

    // Pre-populate starter runway with coins and 1 power-up (zero obstacles!)
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
    const typeRoll = Math.random();

    // First 80 meters: Runway is strictly chips or powerups, NO obstacles!
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
      this.nextZ += 200;
      return;
    }

    // Normal gameplay spawning (after 80 meters)
    if (typeRoll < 0.35) {
      // Barrier obstacle (jump over)
      this.segments.push({
        type: 'hurdle',
        lane: lane,
        z: this.nextZ,
        width: 55,
        height: 35,
        cleared: false
      });
      this.lastObstacleLane = lane;
    } else if (typeRoll < 0.60) {
      // High laser pipe (slide under)
      this.segments.push({
        type: 'high_pipe',
        lane: lane,
        z: this.nextZ,
        width: 65,
        height: 60,
        cleared: false
      });
      this.lastObstacleLane = lane;
    } else if (typeRoll < 0.75) {
      // Drone
      this.segments.push({
        type: 'drone',
        lane: lane,
        z: this.nextZ,
        width: 50,
        height: 50,
        hoverAnim: Math.random() * 6.28,
        cleared: false
      });
      this.lastObstacleLane = lane;
    } else if (typeRoll < 0.90) {
      // Coin arc
      for (let c = 0; c < 4; c++) {
        this.segments.push({
          type: 'chip',
          lane: lane,
          z: this.nextZ + c * 30,
          collected: false
        });
      }
    } else {
      // PowerUp drop
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

    this.nextZ += 220 + Math.random() * 80;
  }

  update(dt, runner) {
    const speedMult = runner.boostTimer > 0 ? 1.8 : 1.0;
    const currentSpeed = this.speed * speedMult;
    const deltaDist = currentSpeed * dt;

    this.distance += deltaDist / 20; // 20 units = 1 meter

    // Slowly accelerate over distance
    this.speed = Math.min(480, this.baseSpeed + (this.distance * 0.12));

    // Move all track items closer
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const item = this.segments[i];
      item.z -= currentSpeed * dt;

      // Magnet attraction
      if (item.type === 'chip' && !item.collected && runner.magnetTimer > 0 && item.z < 400 && item.z > -40) {
        const dx = (runner.currentX * LANE_WIDTH) - (item.lane * LANE_WIDTH);
        item.lane += (runner.currentX - item.lane) * Math.min(1, dt * 10);
      }

      // Check collision with runner
      if (item.z > -20 && item.z < 40) {
        const runnerX = runner.currentX * LANE_WIDTH;
        const itemX = item.lane * LANE_WIDTH;
        const xDist = Math.abs(runnerX - itemX);

        // Chip collection
        if (item.type === 'chip' && !item.collected && xDist < 45 && runner.y < 70) {
          item.collected = true;
          const delta = runner.multiplierTimer > 0 ? 2 : 1;
          this.chipsCollected += delta;
          AudioSynth.chip();
        }

        // PowerUp collection
        if (item.type === 'powerup' && !item.collected && xDist < 50 && runner.y < 70) {
          item.collected = true;
          this.powerupsCollected++;
          AudioSynth.powerup();
          if (item.puType === 'shield') runner.hasShield = true;
          if (item.puType === 'magnet') runner.magnetTimer = 12.0;
          if (item.puType === 'boost') runner.boostTimer = 6.0;
          if (item.puType === 'multiplier') runner.multiplierTimer = 15.0;
        }

        // Obstacle collision
        if (!item.cleared && (item.type === 'hurdle' || item.type === 'high_pipe' || item.type === 'drone')) {
          let hit = false;
          if (xDist < 35) {
            if (item.type === 'hurdle') {
              // must jump
              if (runner.y < 35) hit = true;
            } else if (item.type === 'high_pipe') {
              // must slide
              if (!runner.isSliding) hit = true;
            } else if (item.type === 'drone') {
              // must not hit mid-body
              if (runner.boostTimer > 0) {
                hit = false; // boost smashes drones
              } else if (runner.y < 30 && !runner.isSliding) {
                hit = true;
              }
            }
          }

          if (hit) {
            if (runner.invulnerableTimer > 0 || runner.boostTimer > 0) {
              item.cleared = true;
            } else if (runner.hasShield) {
              // Shield absorbs single hit
              runner.hasShield = false;
              item.cleared = true;
              AudioSynth.beep(600, 0.25, 'sine', 0.25);
            } else {
              // CRASH!
              item.cleared = true;
              return { crashed: true, cause: item.type };
            }
          }
        }
      }

      // Evict old segments
      if (item.z < -80) {
        this.segments.splice(i, 1);
      }
    }

    // Spawn more ahead safely without while loop
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

function render(runner, track) {
  ctx.clearRect(0, 0, W, H);

  // 1. Sky Gradient & Neon Skyline
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

    // Glowing Neon Windows
    ctx.fillStyle = (i % 3 === 0) ? '#00f0ff' : ((i % 3 === 1) ? '#ff0055' : '#ffd700');
    ctx.globalAlpha = 0.35 + Math.sin(time + i) * 0.15;
    for (let wy = bY + 15; wy < (H * 0.65) - 20; wy += 22) {
      ctx.fillRect(bX + 8, wy, 4, 8);
      ctx.fillRect(bX + bW - 12, wy, 4, 8);
    }
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#0a0c18';
  }

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

  // Lane Dividers (Glowing Neon Lines)
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

  // 3. Render Track Elements (Back to Front)
  const sortedItems = [...track.segments].sort((a, b) => b.z - a.z);

  sortedItems.forEach(item => {
    if (item.z < -40 || item.z > 800) return;
    const p = project(item.lane * LANE_WIDTH, 0, item.z);

    if (item.type === 'chip' && !item.collected) {
      // Golden Energy Diamond
      const size = Math.max(4, 18 * p.scale);
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size * 1.5);
      ctx.lineTo(p.x + size, p.y - size * 0.7);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x - size, p.y - size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (item.type === 'powerup' && !item.collected) {
      // Glowing Sphere with Icon
      const r = Math.max(6, 24 * p.scale);
      ctx.fillStyle = item.puType === 'shield' ? '#00f0ff' : (item.puType === 'boost' ? '#ff0055' : '#ffd700');
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p.x, p.y - r, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.floor(r * 1.1)}px Rajdhani`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const symbol = item.puType === 'shield' ? 'S' : (item.puType === 'magnet' ? 'M' : (item.puType === 'boost' ? 'B' : '2X'));
      ctx.fillText(symbol, p.x, p.y - r);
    } else if (item.type === 'hurdle' && !item.cleared) {
      // Yellow Hurdle
      const w = Math.max(10, item.width * p.scale);
      const h = Math.max(8, item.height * p.scale);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(p.x - w / 2, p.y - h, w, h);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
    } else if (item.type === 'high_pipe' && !item.cleared) {
      // High Blue Industrial Laser Pipe
      const w = Math.max(12, item.width * p.scale);
      const h = Math.max(10, item.height * p.scale);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(p.x - w / 2, p.y - h - 45 * p.scale, w, 18 * p.scale);
    } else if (item.type === 'drone' && !item.cleared) {
      // Security Drone with scanning laser
      const r = Math.max(8, 22 * p.scale);
      ctx.fillStyle = '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 30 * p.scale, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Red scanning cone
      ctx.fillStyle = 'rgba(255, 0, 85, 0.2)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 30 * p.scale);
      ctx.lineTo(p.x - r * 1.8, p.y);
      ctx.lineTo(p.x + r * 1.8, p.y);
      ctx.closePath();
      ctx.fill();
    }
  });

  // 4. Render Runner Particles
  runner.particles.forEach(pt => {
    const p = project(pt.x, pt.y, 0);
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  });

  // 5. Render Runner (Grav-Board + Courier)
  const rPos = project(runner.currentX * LANE_WIDTH, runner.y, 0);
  const rScale = rPos.scale;

  // Invulnerability launch shield / flashing
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

  // Shield Bubble
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
  ctx.fillStyle = runner.boostTimer > 0 ? '#ff0055' : '#00f0ff';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 16;
  const bW = 68 * rScale;
  const bH = 12 * rScale;
  ctx.beginPath();
  ctx.ellipse(rPos.x, rPos.y - 5 * rScale, bW / 2, bH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Runner Body (Vex)
  if (runner.isSliding) {
    // Sliding pose: low horizontal profile
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rPos.x - 24 * rScale, rPos.y - 28 * rScale, 48 * rScale, 20 * rScale);
    // Cyan Visor
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(rPos.x + 10 * rScale, rPos.y - 25 * rScale, 12 * rScale, 8 * rScale);
  } else {
    // Upright / Jumping pose
    ctx.fillStyle = '#ffffff';
    // Torso
    ctx.fillRect(rPos.x - 16 * rScale, rPos.y - 65 * rScale, 32 * rScale, 45 * rScale);
    // Helmet
    ctx.fillStyle = '#101426';
    ctx.beginPath();
    ctx.arc(rPos.x, rPos.y - 78 * rScale, 15 * rScale, 0, Math.PI * 2);
    ctx.fill();
    // Glowing Visor
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(rPos.x - 8 * rScale, rPos.y - 82 * rScale, 18 * rScale, 7 * rScale);
  }

  ctx.globalAlpha = 1.0;
}

// -------------------------------------------------------------
// GAME CONTROLLER & UI WIRING
// -------------------------------------------------------------
class GameController {
  constructor() {
    this.runner = new Runner();
    this.track = new TrackManager();
    this.state = 'HUB'; // 'HUB', 'RUNNING', 'PAUSED', 'REDEPLOY', 'SUMMARY'
    this.runStartTime = 0;
    this.redeployCount = 0;
    this.currentRunId = null;

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
        this.updateBalances();
      }
    } catch (e) {
      console.warn("Using offline / mock profile", e);
      document.getElementById('hubPlayerName').textContent = 'Runner#4821 (Offline)';
    }
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
    };

    // Sub-buttons (Leaderboard, Supply Drops, Contracts)
    document.getElementById('btnLeaderboard').onclick = () => this.openLeaderboard();
    document.getElementById('btnCloseLeaderboard').onclick = () => {
      document.getElementById('leaderboardModal').style.display = 'none';
    };

    document.getElementById('btnSupplyDrop').onclick = () => this.openSupplyDrops();
    document.getElementById('btnCloseSupplyDrop').onclick = () => {
      document.getElementById('supplyDropModal').style.display = 'none';
    };
    document.getElementById('btnOpenEarnedDrop').onclick = () => this.executeOpenDrop();

    document.getElementById('btnContracts').onclick = () => this.openContracts();
    document.getElementById('btnCloseContracts').onclick = () => {
      document.getElementById('contractsModal').style.display = 'none';
    };
  }

  bindControls() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      AudioSynth.init();
      if (this.state !== 'RUNNING') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.runner.changeLane(-1);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.runner.changeLane(1);
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') this.runner.jump();
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.runner.slide();
    });

    // Touch Buttons
    document.getElementById('ctrlLeft').onclick = () => { AudioSynth.init(); this.runner.changeLane(-1); };
    document.getElementById('ctrlRight').onclick = () => { AudioSynth.init(); this.runner.changeLane(1); };
    document.getElementById('ctrlJump').onclick = () => { AudioSynth.init(); this.runner.jump(); };
    document.getElementById('ctrlSlide').onclick = () => { AudioSynth.init(); this.runner.slide(); };

    // Canvas Swipes
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
    this.runner.reset();
    this.runner.invulnerableTimer = 3.0; // 3 seconds launch invulnerability shield!
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
      document.getElementById('btnPause').textContent = '▶';
    } else if (this.state === 'PAUSED') {
      this.state = 'RUNNING';
      document.getElementById('btnPause').textContent = '⏸';
    }
  }

  triggerCrash() {
    AudioSynth.crash();
    this.state = 'REDEPLOY';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('redeployModal').style.display = 'flex';

    // Update Core price escalation: 10 -> 20 -> 40
    const coreCost = this.redeployCount === 0 ? 10 : (this.redeployCount === 1 ? 20 : 40);
    document.getElementById('coreRedeployCost').textContent = `Cost: ${coreCost} Cores`;
  }

  async executeRedeploy(method) {
    try {
      await Api.redeploy(method, this.currentRunId);
    } catch (e) {
      console.warn("Offline redeploy bypass / mock ok:", e);
    }
    this.redeployCount++;
    this.runner.invulnerableTimer = 2.5; // 2.5s invincibility shield
    document.getElementById('redeployModal').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    this.state = 'RUNNING';
  }

  async concludeRun() {
    document.getElementById('redeployModal').style.display = 'none';
    const meters = Math.floor(this.track.distance);
    const chips = this.track.chipsCollected;
    const duration = (Date.now() - this.runStartTime) / 1000;

    document.getElementById('summaryMeters').textContent = `${meters} m`;
    document.getElementById('summaryChips').textContent = `+${chips}`;
    document.getElementById('summaryXp').textContent = `+${Math.floor(meters / 20)} XP`;

    // Submit to real Backend
    try {
      const res = await Api.submitRun(meters, chips, duration, this.track.powerupsCollected);
      document.getElementById('summaryIntegrity').textContent = `VERIFIED (${res.integrity_flag.toUpperCase()})`;
      document.getElementById('summaryIntegrity').className = res.integrity_flag === 'ok' ? 'stat-val badge-ok' : 'stat-val';
    } catch (e) {
      console.warn("Offline run queued / submission err:", e);
      document.getElementById('summaryIntegrity').textContent = 'QUEUED FOR SYNC';
    }

    document.getElementById('summaryModal').style.display = 'flex';
    this.state = 'SUMMARY';
  }

  // --- Modals ---
  async openLeaderboard() {
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

  async openContracts() {
    document.getElementById('contractsModal').style.display = 'flex';
    const list = document.getElementById('contractsList');
    list.innerHTML = '<div class="loading-msg">Loading daily contracts...</div>';

    try {
      const data = await Api.getContracts();
      list.innerHTML = data.daily.map(c => `
        <div class="contract-card">
          <div>
            <h4>${c.contract_id.toUpperCase()}</h4>
            <p>Target: ${c.objective.target} ${c.objective.metric} (Reward: ${c.reward.chips || c.reward.cores} ${c.reward.chips ? 'Chips' : 'Cores'})</p>
          </div>
          <button class="btn btn-secondary" onclick="window.game.claimContract('${c.contract_id}')">CLAIM</button>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = '<div>Could not load contracts.</div>';
    }
  }

  async claimContract(id) {
    try {
      await Api.claimContract(id);
      alert('Contract reward claimed!');
      this.updateBalances();
    } catch (e) {
      alert(`Claim: ${e.message || 'Cannot claim yet'}`);
    }
  }

  updateHUD() {
    document.getElementById('hudMeters').textContent = `${Math.floor(this.track.distance)} m`;
    document.getElementById('hudChips').textContent = `${this.track.chipsCollected}`;

    // PowerUp active pills
    const bar = document.getElementById('powerupBar');
    bar.innerHTML = '';
    if (this.runner.hasShield) bar.innerHTML += '<div class="powerup-pill">SHIELD ACTIVE</div>';
    if (this.runner.magnetTimer > 0) bar.innerHTML += `<div class="powerup-pill">MAGNET ${Math.ceil(this.runner.magnetTimer)}s</div>`;
    if (this.runner.boostTimer > 0) bar.innerHTML += `<div class="powerup-pill">BOOST ${Math.ceil(this.runner.boostTimer)}s</div>`;
    if (this.runner.multiplierTimer > 0) bar.innerHTML += `<div class="powerup-pill">2X CHIPS ${Math.ceil(this.runner.multiplierTimer)}s</div>`;
  }
}

// -------------------------------------------------------------
// MAIN LOOP
// -------------------------------------------------------------
const game = new GameController();
window.game = game;

let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (game.state === 'RUNNING') {
    game.runner.update(dt);
    const result = game.track.update(dt, game.runner);
    if (result.crashed) {
      game.triggerCrash();
    }
    game.updateHUD();
  }

  render(game.runner, game.track);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
