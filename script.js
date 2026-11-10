// ==========================================
// T-REX DINO RUNNER WITH WEB AUDIO SYNTHESIS
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const muteBtn = document.getElementById('muteBtn');
const finalScoreText = document.getElementById('finalScoreText');

// ------------------------------------------
// Web Audio System (Self-contained sound effects)
// ------------------------------------------
class SoundEffects {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    muteBtn.innerText = this.isMuted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
  }

  // Jump Beep
  playJump() {
    if (this.isMuted) return;
    this.init();
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {}
  }

  // Hit / Game Over Sound
  playHit() {
    if (this.isMuted) return;
    this.init();
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }

  // Milestone / Score 100 Ding
  playMilestone() {
    if (this.isMuted) return;
    this.init();
    try {
      const now = this.audioCtx.currentTime;
      [587.33, 880].forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const startTime = now + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.19);
      });
    } catch (e) {}
  }
}

const sounds = new SoundEffects();

// ------------------------------------------
// Game Constants & Variables
// ------------------------------------------
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const GROUND_Y = 210;

let isPlaying = false;
let isGameOver = false;
let score = 0;
let highScore = parseInt(localStorage.getItem('dino_hi_score') || '0', 10);
let speed = 6;
let animationFrameId = null;
let lastMilestone = 0;

// ------------------------------------------
// Dino Class
// ------------------------------------------
class Dino {
  constructor() {
    this.x = 50;
    this.baseY = GROUND_Y;
    this.width = 44;
    this.height = 47;
    this.y = this.baseY - this.height;
    
    this.vy = 0;
    this.gravity = 0.65;
    this.jumpForce = -12;
    this.isGrounded = true;
    this.isDucking = false;
    this.legStep = 0;
    this.stepTimer = 0;
  }

  reset() {
    this.width = 44;
    this.height = 47;
    this.y = this.baseY - this.height;
    this.vy = 0;
    this.isGrounded = true;
    this.isDucking = false;
  }

  jump() {
    if (this.isGrounded) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
      sounds.playJump();
    }
  }

  duck(active) {
    if (this.isGrounded) {
      if (active && !this.isDucking) {
        this.isDucking = true;
        this.height = 28;
        this.width = 56;
        this.y = this.baseY - this.height;
      } else if (!active && this.isDucking) {
        this.isDucking = false;
        this.height = 47;
        this.width = 44;
        this.y = this.baseY - this.height;
      }
    }
  }

  update() {
    if (!this.isGrounded) {
      this.vy += this.gravity;
      this.y += this.vy;

      if (this.y >= this.baseY - this.height) {
        this.y = this.baseY - this.height;
        this.vy = 0;
        this.isGrounded = true;
      }
    }

    if (this.isGrounded) {
      this.stepTimer++;
      if (this.stepTimer > 6) {
        this.legStep = 1 - this.legStep;
        this.stepTimer = 0;
      }
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#535353';

    if (this.isDucking) {
      // Ducking Dino Body
      ctx.fillRect(this.x, this.y + 10, this.width - 12, 14);
      // Head
      ctx.fillRect(this.x + this.width - 20, this.y, 20, 16);
      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + this.width - 15, this.y + 3, 3, 3);
      ctx.fillStyle = '#535353';
      // Feet
      if (this.legStep === 0) {
        ctx.fillRect(this.x + 8, this.y + 24, 6, 4);
        ctx.fillRect(this.x + 22, this.y + 22, 6, 6);
      } else {
        ctx.fillRect(this.x + 8, this.y + 22, 6, 6);
        ctx.fillRect(this.x + 22, this.y + 24, 6, 4);
      }
      return;
    }

    // Normal Dino Body
    // Torso
    ctx.fillRect(this.x + 10, this.y + 12, 22, 22);
    // Neck & Head
    ctx.fillRect(this.x + 24, this.y, 18, 16);
    // Snout
    ctx.fillRect(this.x + 30, this.y + 4, 14, 8);
    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x + 32, this.y + 3, 3, 3);
    ctx.fillStyle = '#535353';
    // Back tail
    ctx.fillRect(this.x, this.y + 18, 10, 10);
    ctx.fillRect(this.x - 4, this.y + 16, 4, 6);
    // Tiny arm
    ctx.fillRect(this.x + 28, this.y + 18, 5, 4);

    // Legs
    if (!this.isGrounded) {
      // In air
      ctx.fillRect(this.x + 14, this.y + 34, 4, 11);
      ctx.fillRect(this.x + 24, this.y + 34, 4, 9);
    } else {
      // Running legs
      if (this.legStep === 0) {
        ctx.fillRect(this.x + 14, this.y + 34, 4, 13);
        ctx.fillRect(this.x + 14, this.y + 45, 6, 2);
        ctx.fillRect(this.x + 24, this.y + 34, 4, 7);
      } else {
        ctx.fillRect(this.x + 14, this.y + 34, 4, 7);
        ctx.fillRect(this.x + 24, this.y + 34, 4, 13);
        ctx.fillRect(this.x + 24, this.y + 45, 6, 2);
      }
    }
  }

  getBounds() {
    // Return tighter collision box
    return {
      x: this.x + 4,
      y: this.y + 2,
      width: this.width - 8,
      height: this.height - 4
    };
  }
}

// ------------------------------------------
// Obstacle Classes (Cactus & Pterodactyl Bird)
// ------------------------------------------
class Cactus {
  constructor(x, type) {
    this.x = x;
    this.type = type; // 1: small single, 2: small double, 3: tall
    if (type === 1) {
      this.width = 16;
      this.height = 36;
    } else if (type === 2) {
      this.width = 30;
      this.height = 38;
    } else {
      this.width = 24;
      this.height = 48;
    }
    this.y = GROUND_Y - this.height;
  }

  update(currentSpeed) {
    this.x -= currentSpeed;
  }

  draw(ctx) {
    ctx.fillStyle = '#535353';
    if (this.type === 1) {
      // Main trunk
      ctx.fillRect(this.x + 5, this.y, 6, this.height);
      // Left arm
      ctx.fillRect(this.x, this.y + 10, 5, 4);
      ctx.fillRect(this.x, this.y + 6, 4, 8);
      // Right arm
      ctx.fillRect(this.x + 11, this.y + 14, 5, 4);
      ctx.fillRect(this.x + 12, this.y + 10, 4, 8);
    } else if (this.type === 2) {
      // Double cactus
      ctx.fillRect(this.x + 4, this.y + 4, 6, this.height - 4);
      ctx.fillRect(this.x, this.y + 12, 4, 8);
      ctx.fillRect(this.x + 18, this.y, 7, this.height);
      ctx.fillRect(this.x + 25, this.y + 14, 5, 8);
    } else {
      // Big tall cactus
      ctx.fillRect(this.x + 8, this.y, 8, this.height);
      ctx.fillRect(this.x + 1, this.y + 12, 7, 5);
      ctx.fillRect(this.x + 1, this.y + 6, 5, 12);
      ctx.fillRect(this.x + 16, this.y + 18, 7, 5);
      ctx.fillRect(this.x + 18, this.y + 12, 5, 12);
    }
  }

  getBounds() {
    return {
      x: this.x + 2,
      y: this.y + 2,
      width: this.width - 4,
      height: this.height - 2
    };
  }
}

class Bird {
  constructor(x) {
    this.x = x;
    this.width = 42;
    this.height = 30;
    // Bird can fly at low (must jump or duck), mid (must duck), or high
    const altitudes = [GROUND_Y - 32, GROUND_Y - 58, GROUND_Y - 80];
    this.y = altitudes[Math.floor(Math.random() * altitudes.length)];
    this.wingState = 0;
    this.animTimer = 0;
  }

  update(currentSpeed) {
    this.x -= currentSpeed * 1.08;
    this.animTimer++;
    if (this.animTimer > 8) {
      this.wingState = 1 - this.wingState;
      this.animTimer = 0;
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#535353';
    // Body
    ctx.fillRect(this.x + 10, this.y + 10, 20, 8);
    // Beak / head
    ctx.fillRect(this.x, this.y + 12, 10, 6);
    // Tail
    ctx.fillRect(this.x + 30, this.y + 8, 8, 4);

    // Wings flapping
    if (this.wingState === 0) {
      // Wings Up
      ctx.fillRect(this.x + 14, this.y, 6, 12);
      ctx.fillRect(this.x + 18, this.y + 2, 6, 10);
    } else {
      // Wings Down
      ctx.fillRect(this.x + 14, this.y + 14, 6, 12);
      ctx.fillRect(this.x + 18, this.y + 12, 6, 10);
    }
  }

  getBounds() {
    return {
      x: this.x + 3,
      y: this.y + 3,
      width: this.width - 6,
      height: this.height - 6
    };
  }
}

// ------------------------------------------
// Background Decor: Ground lines & Clouds
// ------------------------------------------
class Cloud {
  constructor(x) {
    this.x = x;
    this.y = Math.random() * 80 + 20;
    this.width = 46;
    this.speed = Math.random() * 0.5 + 0.5;
  }

  update() {
    this.x -= this.speed;
  }

  draw(ctx) {
    ctx.fillStyle = '#c7c7c7';
    ctx.fillRect(this.x, this.y + 8, 46, 8);
    ctx.fillRect(this.x + 8, this.y + 4, 30, 4);
    ctx.fillRect(this.x + 16, this.y, 16, 4);
  }
}

// ------------------------------------------
// Game Instance & State Management
// ------------------------------------------
const dino = new Dino();
let obstacles = [];
let clouds = [];
let groundOffset = 0;
let nextSpawnTimer = 0;

function formatScore(num) {
  return String(Math.floor(num)).padStart(5, '0');
}

function updateScoreboard() {
  scoreEl.innerText = formatScore(score);
  highScoreEl.innerText = `HI ${formatScore(highScore)}`;
}

function resetGame() {
  score = 0;
  speed = 6.5;
  obstacles = [];
  clouds = [];
  groundOffset = 0;
  nextSpawnTimer = 60;
  lastMilestone = 0;
  dino.reset();

  // Spawn initial background clouds
  for (let i = 0; i < 4; i++) {
    clouds.push(new Cloud(Math.random() * CANVAS_WIDTH + (i * 200)));
  }

  isGameOver = false;
  gameOverScreen.classList.add('hidden');
  startScreen.classList.add('hidden');
}

function spawnObstacle() {
  // Allow birds once score > 150
  const canSpawnBird = score > 150 && Math.random() < 0.35;
  if (canSpawnBird) {
    obstacles.push(new Bird(CANVAS_WIDTH + 20));
  } else {
    const cactusType = Math.floor(Math.random() * 3) + 1;
    obstacles.push(new Cactus(CANVAS_WIDTH + 20, cactusType));
  }
  // Schedule next obstacle based on current speed
  const minInterval = Math.max(45, Math.floor(100 - speed * 3));
  const maxInterval = Math.max(80, Math.floor(150 - speed * 4));
  nextSpawnTimer = Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;
}

function checkCollision(box1, box2) {
  return (
    box1.x < box2.x + box2.width &&
    box1.x + box1.width > box2.x &&
    box1.y < box2.y + box2.height &&
    box1.y + box1.height > box2.y
  );
}

function drawGround() {
  ctx.strokeStyle = '#535353';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
  ctx.stroke();

  // Ground bumps / pebbles effect
  ctx.fillStyle = '#999999';
  groundOffset = (groundOffset + speed) % 120;
  for (let x = -groundOffset; x < CANVAS_WIDTH; x += 30) {
    if ((x + 10) % 60 === 0) {
      ctx.fillRect(x, GROUND_Y + 5, 8, 2);
    } else if ((x + 25) % 90 === 0) {
      ctx.fillRect(x, GROUND_Y + 9, 4, 2);
    }
  }
}

function gameOver() {
  isGameOver = true;
  isPlaying = false;
  sounds.playHit();

  if (score > highScore) {
    highScore = Math.floor(score);
    localStorage.setItem('dino_hi_score', highScore);
  }
  updateScoreboard();

  finalScoreText.innerText = `SCORE: ${Math.floor(score)}`;
  gameOverScreen.classList.remove('hidden');
}

// ------------------------------------------
// Main Game Loop
// ------------------------------------------
function gameLoop() {
  if (!isPlaying) return;

  // 1. Update State
  score += 0.15;
  speed += 0.0007; // Smooth acceleration over time

  // Score milestone sound (every 100 points)
  const currentHundred = Math.floor(score / 100);
  if (currentHundred > lastMilestone) {
    lastMilestone = currentHundred;
    sounds.playMilestone();
  }
  updateScoreboard();

  dino.update();

  // Spawn obstacles
  nextSpawnTimer--;
  if (nextSpawnTimer <= 0) {
    spawnObstacle();
  }

  // Update Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.update(speed);

    // Collision Check
    if (checkCollision(dino.getBounds(), obs.getBounds())) {
      gameOver();
      return;
    }

    // Clean up passed obstacles
    if (obs.x + obs.width < -50) {
      obstacles.splice(i, 1);
    }
  }

  // Update Clouds
  if (Math.random() < 0.008 && clouds.length < 5) {
    clouds.push(new Cloud(CANVAS_WIDTH + 60));
  }
  for (let i = clouds.length - 1; i >= 0; i--) {
    clouds[i].update();
    if (clouds[i].x < -60) {
      clouds.splice(i, 1);
    }
  }

  // 2. Render Screen
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw Clouds
  clouds.forEach(c => c.draw(ctx));

  // Draw Ground
  drawGround();

  // Draw Dino & Obstacles
  dino.draw(ctx);
  obstacles.forEach(obs => obs.draw(ctx));

  animationFrameId = requestAnimationFrame(gameLoop);
}

// ------------------------------------------
// Input Handlers
// ------------------------------------------
function handleJumpAction() {
  sounds.init();
  if (!isPlaying) {
    if (isGameOver || startScreen.classList.contains('hidden') === false) {
      startGame();
    }
    return;
  }
  dino.jump();
}

function startGame() {
  resetGame();
  isPlaying = true;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Keyboard events
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    handleJumpAction();
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (isPlaying) dino.duck(true);
  } else if (e.code === 'KeyM') {
    sounds.toggleMute();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') {
    if (isPlaying) dino.duck(false);
  }
});

// Mouse & Touch events for mobile/click controls
canvas.addEventListener('pointerdown', (e) => {
  handleJumpAction();
});

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

restartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  sounds.toggleMute();
});

// Initial display
updateScoreboard();
drawGround();
dino.draw(ctx);

