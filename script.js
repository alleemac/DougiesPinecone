const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const scoreDisplay = document.getElementById("score");
const highScoreDisplay = document.getElementById("highScore");
const missesDisplay = document.getElementById("misses");

const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");
const jumpButton = document.getElementById("jumpButton");

// ----------------------
// HIGH SCORE
// ----------------------
function getSavedHighScore() {
  const savedScore = localStorage.getItem("dougiePineconeHighScore");
  return savedScore ? Number(savedScore) : 0;
}

function saveHighScore(newHighScore) {
  localStorage.setItem("dougiePineconeHighScore", String(newHighScore));
}

let highScore = getSavedHighScore();

// ----------------------
// IMAGE ASSETS
// Replace these placeholder filenames with your actual PNGs
// ----------------------
const dougieStand = new Image();
dougieStand.src = "Dougie-Pixel-sprite-idle.PNG";

const dougieJump = new Image();
dougieJump.src = "dougiejump.png";

const dougieRunLeft = new Image();
dougieRunLeft.src = "dougierunleft.png";

const dougieRunRight = new Image();
dougieRunRight.src = "dougierunright.png";

const dougieBasket = new Image();
dougieBasket.src = "Dougie-Pixel-sprite-idle.PNG";

const dougieHappy = new Image();
dougieHappy.src = "Dougie-Pixel-sprite-idle.PNG";

// ----------------------
// GAME STATE
// ----------------------
let gameStarted = false;
let gameOver = false;
let score = 0;

const gameDuration = 45;
let timeLeft = gameDuration;
let lastTimeUpdate = 0;

let happyTimer = 0;
let ouchTimer = 0;

const dougie = {
  width: 120,
  height: 155,
  x: canvas.width / 2 - 60,
  y: canvas.height - 205,
  baseY: canvas.height - 205,
  speed: 7,
  movingLeft: false,
  movingRight: false,
  velocityY: 0,
  gravity: 0.8,
  jumpStrength: -16,
  isJumping: false,
  facing: "right"
};

// Catch zone at top of Dougie's head
const headCatchZone = {
  offsetX: dougie.width / 2,
  offsetY: 18,
  radius: 34
};

let fallingItems = [];
let frameCount = 0;

// Pinecone pacing
let spawnRate = 58;
let paceMode = "normal";
let paceTimer = 180;

const paceSettings = {
  slow: {
    spawnRate: 78,
    speedMultiplier: 0.85
  },
  normal: {
    spawnRate: 58,
    speedMultiplier: 1
  },
  fast: {
    spawnRate: 38,
    speedMultiplier: 1.35
  },
  storm: {
    spawnRate: 24,
    speedMultiplier: 1.15
  }
};

let goldenSpawnFrames = [];
let goldenSpawnIndex = 0;

// ----------------------
// HELPERS
// ----------------------
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");

  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpColor(color1, color2, t) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  return rgbToHex(
    lerp(c1.r, c2.r, t),
    lerp(c1.g, c2.g, t),
    lerp(c1.b, c2.b, t)
  );
}

function createGoldenSpawnFrames() {
  // Two golden pinecones per game, spaced apart
  const first = getRandomInt(8 * 60, 20 * 60);
  const second = getRandomInt(25 * 60, 40 * 60);

  return [first, second];
}

function chooseNewPaceMode() {
  const roll = Math.random();

  if (roll < 0.25) {
    paceMode = "slow";
    paceTimer = getRandomInt(160, 260);
  } else if (roll < 0.68) {
    paceMode = "normal";
    paceTimer = getRandomInt(180, 320);
  } else if (roll < 0.9) {
    paceMode = "fast";
    paceTimer = getRandomInt(120, 210);
  } else {
    paceMode = "storm";
    paceTimer = getRandomInt(70, 130);
  }

  spawnRate = paceSettings[paceMode].spawnRate;
}

function updatePaceMode() {
  paceTimer--;

  if (paceTimer <= 0) {
    chooseNewPaceMode();
  }
}

function makeDougieJump() {
  if (!dougie.isJumping) {
    dougie.velocityY = dougie.jumpStrength;
    dougie.isJumping = true;
  }
}

function imageIsReady(image) {
  return image.complete && image.naturalWidth > 0;
}

// ----------------------
// GAME RESET
// ----------------------
function resetGame() {
  gameStarted = true;
  gameOver = false;

  score = 0;
  timeLeft = gameDuration;

  fallingItems = [];
  frameCount = 0;

  paceMode = "normal";
  paceTimer = 180;
  spawnRate = paceSettings.normal.spawnRate;

  happyTimer = 0;
  ouchTimer = 0;

  dougie.x = canvas.width / 2 - dougie.width / 2;
  dougie.y = dougie.baseY;
  dougie.velocityY = 0;
  dougie.isJumping = false;
  dougie.movingLeft = false;
  dougie.movingRight = false;
  dougie.facing = "right";

  lastTimeUpdate = performance.now();

  goldenSpawnFrames = createGoldenSpawnFrames();
  goldenSpawnIndex = 0;

  updateHUD();
}

function updateHUD() {
  scoreDisplay.textContent = `Score: ${score}`;
  highScoreDisplay.textContent = `High Score: ${highScore}`;
  missesDisplay.textContent = `Time Left: ${timeLeft}s`;
}

function updateHighScoreIfNeeded() {
  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
    updateHUD();
  }
}

// ----------------------
// SPAWNING
// ----------------------
function spawnItem(type = "pinecone") {
  const isGolden = type === "golden";
  const isBad = type === "bad";

  const size = isGolden ? 30 : isBad ? 30 : 24 + Math.random() * 8;

  const baseSpeed = isGolden
    ? 1.7
    : isBad
    ? 1.9
    : 1.35 + Math.random() * 0.75;

  fallingItems.push({
    type,
    x: Math.random() * (canvas.width - size),
    y: -45,
    width: size,
    height: isBad ? size : size * 1.35,
    radius: size * 0.45,
    speed: baseSpeed * paceSettings[paceMode].speedMultiplier,
    rotation: Math.random() * Math.PI * 2,
    spin: isBad ? 0.02 : Math.random() * 0.03 - 0.015
  });
}

// ----------------------
// RETRO BACKGROUND
// ----------------------
function drawPixelSkyAndGrass() {
  const pixel = 16;
  const grassHeight = 88;
  const skyHeight = canvas.height - grassHeight;

  const topColor = "#3f5fbf";
  const bottomColor = "#b9e8ff";

  // Pixel sky gradient
  for (let y = 0; y < skyHeight; y += pixel) {
    const t = y / skyHeight;
    ctx.fillStyle = lerpColor(topColor, bottomColor, t);
    ctx.fillRect(0, y, canvas.width, pixel);
  }

  // Pixel clouds
  drawPixelCloud(90, 72, 1);
  drawPixelCloud(250, 118, 1);
  drawPixelCloud(510, 82, 1.2);

  // Flat grass
  ctx.fillStyle = "#5fb54a";
  ctx.fillRect(0, canvas.height - grassHeight, canvas.width, grassHeight);

  // Slight darker top edge on the grass
  ctx.fillStyle = "#4d9f39";
  ctx.fillRect(0, canvas.height - grassHeight, canvas.width, 12);
}

function drawPixelCloud(x, y, scale = 1) {
  const block = 14 * scale;

  const pattern = [
    [0, 1], [1, 0], [1, 1], [1, 2],
    [2, 0], [2, 1], [2, 2],
    [3, 0], [3, 1], [3, 2],
    [4, 1], [4, 2],
    [5, 1]
  ];

  ctx.fillStyle = "#ffffff";

  for (const [px, py] of pattern) {
    ctx.fillRect(x + px * block, y + py * block, block, block);
  }

  // Small shadow row for depth
  ctx.fillStyle = "#d7ebff";

  const shadowBlocks = [
    [1, 2], [2, 2], [3, 2], [4, 2]
  ];

  for (const [px, py] of shadowBlocks) {
    ctx.fillRect(
      x + px * block,
      y + py * block + block * 0.2,
      block,
      block * 0.8
    );
  }
}

// ----------------------
// DOUGIE
// ----------------------
function getCurrentDougieImage() {
  // Jump image has top priority while airborne
  if (dougie.isJumping && imageIsReady(dougieJump)) {
    return dougieJump;
  }

  // Running images while moving on the ground
  if (dougie.movingLeft && imageIsReady(dougieRunLeft)) {
    return dougieRunLeft;
  }

  if (dougie.movingRight && imageIsReady(dougieRunRight)) {
    return dougieRunRight;
  }

  // Happy image after catching a pinecone
  if (happyTimer > 0 && imageIsReady(dougieHappy)) {
    return dougieHappy;
  }

  // Basket image as a default gameplay pose
  if (imageIsReady(dougieBasket)) {
    return dougieBasket;
  }

  // Standing image as backup
  if (imageIsReady(dougieStand)) {
    return dougieStand;
  }

  return null;
}

function drawFallbackDougie() {
  const centerX = dougie.x + dougie.width / 2;

  ctx.fillStyle = ouchTimer > 0 ? "#2d7d36" : "#2f8f3a";

  ctx.beginPath();
  ctx.moveTo(centerX, dougie.y);
  ctx.lineTo(dougie.x + 12, dougie.y + 78);
  ctx.lineTo(dougie.x + dougie.width - 12, dougie.y + 78);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(centerX, dougie.y + 28);
  ctx.lineTo(dougie.x, dougie.y + 118);
  ctx.lineTo(dougie.x + dougie.width, dougie.y + 118);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";

  ctx.beginPath();
  ctx.arc(centerX - 16, dougie.y + 88, 6, 0, Math.PI * 2);
  ctx.arc(centerX + 16, dougie.y + 88, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#222";

  ctx.beginPath();
  ctx.arc(centerX - 15, dougie.y + 88, 2.5, 0, Math.PI * 2);
  ctx.arc(centerX + 17, dougie.y + 88, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ouchTimer > 0 ? "#91442f" : "#222";
  ctx.lineWidth = 2;

  ctx.beginPath();

  if (ouchTimer > 0) {
    ctx.arc(centerX, dougie.y + 106, 9, Math.PI, Math.PI * 2);
  } else {
    ctx.arc(centerX, dougie.y + 100, 11, 0, Math.PI);
  }

  ctx.stroke();
}

function drawDougie() {
  const currentImage = getCurrentDougieImage();

  if (currentImage) {
    ctx.drawImage(currentImage, dougie.x, dougie.y, dougie.width, dougie.height);
  } else {
    drawFallbackDougie();
  }

  // Uncomment if you want to see the catch circle for testing
  /*
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(
    dougie.x + headCatchZone.offsetX,
    dougie.y + headCatchZone.offsetY,
    headCatchZone.radius,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  */
}

// ----------------------
// ITEM DRAWING
// ----------------------
function drawPixelPinecone(item, palette) {
  ctx.save();

  ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
  ctx.rotate(item.rotation);

  const px = Math.max(4, Math.round(item.width / 8));

  // Small glow for golden pinecones
  if (palette.glow) {
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 12;
  }

  // Stem
  ctx.fillStyle = palette.stem;
  ctx.fillRect(-px / 2, -7 * px, px, 2 * px);

  // Pinecone body row widths
  const rows = [1, 3, 5, 5, 7, 7, 7, 5, 5, 3, 1];
  const topY = -5 * px;

  for (let r = 0; r < rows.length; r++) {
    const count = rows[r];
    const rowWidth = count * px;
    const startX = -rowWidth / 2;
    const y = topY + r * px;

    for (let c = 0; c < count; c++) {
      const x = startX + c * px;

      const isEdge =
        c === 0 ||
        c === count - 1 ||
        r === 0 ||
        r === rows.length - 1;

      if (isEdge) {
        ctx.fillStyle = palette.dark;
      } else if ((r + c) % 2 === 0) {
        ctx.fillStyle = palette.light;
      } else {
        ctx.fillStyle = palette.mid;
      }

      ctx.fillRect(x, y, px, px);
    }
  }

  // Tiny highlight blocks
  ctx.fillStyle = palette.highlight;
  ctx.fillRect(-px, -3 * px, px, px);
  ctx.fillRect(0, -1 * px, px, px);
  ctx.fillRect(-2 * px, 2 * px, px, px);

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawPixelBadItem(item) {
  ctx.save();

  ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
  ctx.rotate(item.rotation);

  const px = Math.max(4, Math.round(item.width / 8));

  // Stem
  ctx.fillStyle = "#5a6f2a";
  ctx.fillRect(-px / 2, -5 * px, px, px);

  // Rotten blob shape
  const rows = [3, 5, 7, 7, 5, 3];
  const topY = -4 * px;

  for (let r = 0; r < rows.length; r++) {
    const count = rows[r];
    const rowWidth = count * px;
    const startX = -rowWidth / 2;
    const y = topY + r * px;

    for (let c = 0; c < count; c++) {
      const x = startX + c * px;

      const isEdge =
        c === 0 ||
        c === count - 1 ||
        r === 0 ||
        r === rows.length - 1;

      if (isEdge) {
        ctx.fillStyle = "#2a231f";
      } else if ((r + c) % 3 === 0) {
        ctx.fillStyle = "#5e6f34";
      } else {
        ctx.fillStyle = "#463b35";
      }

      ctx.fillRect(x, y, px, px);
    }
  }

  // X eyes
  ctx.fillStyle = "#d7ef9c";
  ctx.fillRect(-2 * px, -1 * px, px, px);
  ctx.fillRect(-1 * px, 0, px, px);
  ctx.fillRect(-2 * px, 0, px, px);
  ctx.fillRect(-1 * px, -1 * px, px, px);

  ctx.fillRect(px, -1 * px, px, px);
  ctx.fillRect(2 * px, 0, px, px);
  ctx.fillRect(px, 0, px, px);
  ctx.fillRect(2 * px, -1 * px, px, px);

  // Sad mouth
  ctx.fillStyle = "#1f1a18";
  ctx.fillRect(-px, 2 * px, 3 * px, px);

  ctx.restore();
}

function drawItem(item) {
  if (item.type === "bad") {
    drawPixelBadItem(item);
    return;
  }

  if (item.type === "golden") {
    drawPixelPinecone(item, {
      light: "#ffe88a",
      mid: "#f6c43c",
      dark: "#b87c09",
      stem: "#8a5d00",
      highlight: "#fff7c8",
      glow: "rgba(255, 221, 80, 0.85)"
    });

    return;
  }

  drawPixelPinecone(item, {
    light: "#b7793d",
    mid: "#8a5529",
    dark: "#5a3316",
    stem: "#3b6b29",
    highlight: "#d39a62",
    glow: null
  });
}

// ----------------------
// GAME UPDATES
// ----------------------
function updateDougie() {
  if (dougie.movingLeft) {
    dougie.x -= dougie.speed;
    dougie.facing = "left";
  }

  if (dougie.movingRight) {
    dougie.x += dougie.speed;
    dougie.facing = "right";
  }

  // Jump movement
  dougie.y += dougie.velocityY;
  dougie.velocityY += dougie.gravity;

  // Land back on the ground
  if (dougie.y >= dougie.baseY) {
    dougie.y = dougie.baseY;
    dougie.velocityY = 0;
    dougie.isJumping = false;
  }

  if (dougie.x < 0) {
    dougie.x = 0;
  }

  if (dougie.x + dougie.width > canvas.width) {
    dougie.x = canvas.width - dougie.width;
  }
}

function didCatchItem(item) {
  const catchCenterX = dougie.x + headCatchZone.offsetX;
  const catchCenterY = dougie.y + headCatchZone.offsetY;

  const itemCenterX = item.x + item.width / 2;
  const itemCenterY = item.y + item.height / 2;

  const distanceX = itemCenterX - catchCenterX;
  const distanceY = itemCenterY - catchCenterY;

  const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

  return distance < headCatchZone.radius + item.radius;
}

function updateFallingItems() {
  for (let i = fallingItems.length - 1; i >= 0; i--) {
    const item = fallingItems[i];

    item.y += item.speed;
    item.rotation += item.spin;

    if (didCatchItem(item)) {
      fallingItems.splice(i, 1);

      if (item.type === "golden") {
        score += 5;
        happyTimer = 22;
      } else if (item.type === "bad") {
        score = Math.max(0, score - 3);
        ouchTimer = 22;
      } else {
        score += 1;
        happyTimer = 14;
      }

      updateHighScoreIfNeeded();
      updateHUD();

      // Small difficulty boost without making the pacing too predictable
      if (score > 0 && score % 12 === 0) {
        fallingItems.forEach((fallingItem) => {
          fallingItem.speed += 0.05;
        });
      }

      continue;
    }

    if (item.y > canvas.height - 40) {
      fallingItems.splice(i, 1);
    }
  }
}

function updateTimer(currentTime) {
  if (!gameStarted || gameOver) {
    return;
  }

  const elapsed = currentTime - lastTimeUpdate;

  if (elapsed >= 1000) {
    const secondsPassed = Math.floor(elapsed / 1000);

    timeLeft -= secondsPassed;
    lastTimeUpdate += secondsPassed * 1000;

    if (timeLeft <= 0) {
      timeLeft = 0;
      gameOver = true;
      updateHighScoreIfNeeded();
    }

    updateHUD();
  }
}

// ----------------------
// SCREENS
// ----------------------
function drawStartScreen() {
  ctx.fillStyle = "rgba(15, 25, 60, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  ctx.font = "bold 36px Arial";
  ctx.fillText("Dougie's Pinecone Catch", canvas.width / 2, canvas.height / 2 - 60);

  ctx.font = "20px Arial";
  ctx.fillText("Catch pinecones with the top of Dougie's head.", canvas.width / 2, canvas.height / 2 - 18);
  ctx.fillText("Press Space to jump while playing.", canvas.width / 2, canvas.height / 2 + 12);
  ctx.fillText("Avoid the rotten ones.", canvas.width / 2, canvas.height / 2 + 42);

  ctx.font = "bold 22px Arial";
  ctx.fillText("Press Space to Start", canvas.width / 2, canvas.height / 2 + 92);
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  ctx.font = "bold 38px Arial";
  ctx.fillText("Time's Up!", canvas.width / 2, canvas.height / 2 - 35);

  ctx.font = "22px Arial";
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 5);
  ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 35);

  ctx.font = "bold 22px Arial";
  ctx.fillText("Press Space or Jump to Play Again", canvas.width / 2, canvas.height / 2 + 85);
}

// ----------------------
// MAIN DRAW / UPDATE
// ----------------------
function draw() {
  drawPixelSkyAndGrass();

  for (const item of fallingItems) {
    drawItem(item);
  }

  drawDougie();

  if (!gameStarted) {
    drawStartScreen();
  }

  if (gameOver) {
    drawGameOverScreen();
  }
}

function update(currentTime) {
  if (!gameStarted || gameOver) {
    return;
  }

  frameCount++;

  updateTimer(currentTime);
  updateDougie();
  updatePaceMode();

  if (frameCount % spawnRate === 0) {
    const badChance = Math.random();

    if (badChance < 0.14) {
      spawnItem("bad");
    } else {
      spawnItem("pinecone");
    }
  }

  if (
    goldenSpawnIndex < goldenSpawnFrames.length &&
    frameCount >= goldenSpawnFrames[goldenSpawnIndex]
  ) {
    spawnItem("golden");
    goldenSpawnIndex++;
  }

  updateFallingItems();

  if (happyTimer > 0) {
    happyTimer--;
  }

  if (ouchTimer > 0) {
    ouchTimer--;
  }
}

function loop(currentTime) {
  update(currentTime);
  draw();
  requestAnimationFrame(loop);
}

// ----------------------
// CONTROLS
// ----------------------
function startJumpOrRestart() {
  if (!gameStarted || gameOver) {
    resetGame();
  } else {
    makeDougieJump();
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    dougie.movingLeft = true;
  }

  if (e.key === "ArrowRight") {
    dougie.movingRight = true;
  }

  if (e.key === " ") {
    e.preventDefault();
    startJumpOrRestart();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") {
    dougie.movingLeft = false;
  }

  if (e.key === "ArrowRight") {
    dougie.movingRight = false;
  }
});

function pressMobileDirection(direction) {
  if (direction === "left") {
    dougie.movingLeft = true;
  }

  if (direction === "right") {
    dougie.movingRight = true;
  }
}

function releaseMobileDirection(direction) {
  if (direction === "left") {
    dougie.movingLeft = false;
  }

  if (direction === "right") {
    dougie.movingRight = false;
  }
}

function setupMobileButton(button, pressAction, releaseAction) {
  if (!button) {
    return;
  }

  button.addEventListener("touchstart", (e) => {
    e.preventDefault();
    pressAction();
  });

  button.addEventListener("touchend", (e) => {
    e.preventDefault();

    if (releaseAction) {
      releaseAction();
    }
  });

  button.addEventListener("touchcancel", (e) => {
    e.preventDefault();

    if (releaseAction) {
      releaseAction();
    }
  });

  button.addEventListener("mousedown", (e) => {
    e.preventDefault();
    pressAction();
  });

  button.addEventListener("mouseup", (e) => {
    e.preventDefault();

    if (releaseAction) {
      releaseAction();
    }
  });

  button.addEventListener("mouseleave", () => {
    if (releaseAction) {
      releaseAction();
    }
  });
}

setupMobileButton(
  leftButton,
  () => pressMobileDirection("left"),
  () => releaseMobileDirection("left")
);

setupMobileButton(
  rightButton,
  () => pressMobileDirection("right"),
  () => releaseMobileDirection("right")
);

setupMobileButton(
  jumpButton,
  () => startJumpOrRestart(),
  null
);

updateHUD();
draw();
requestAnimationFrame(loop);
