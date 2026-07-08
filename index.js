// ==========================================
// 🛠️ ZONE นักพัฒนา: พิกัดแปลงดิน + ระบบล็อกขอบเขตไม่ให้ดอกไม้โผล่พ้นเส้นประ
// ==========================================
const SHOW_DEBUG_ZONE = false; // 🔴 เปิดไว้ดูเส้นประแดงก่อนครับ ถ้ามั่นใจแล้วค่อยปิดเป็น false
const MIN_DISTANCE = 2.6;      // 📏 ระยะห่างขั้นต่ำกันดอกไม้ขึ้นซ้อนกัน (%)

const cx = 36.5; 
const cy = 14.5; 
const rx = 28.5; 
const ry = 9.5;  

const PAD_X = 1.8;
const PAD_Y_TOP = 2.5;
const PAD_Y_BOTTOM = 0.2;

const spawnedFlowers = [];

const flowerAssets = [
    "1.png", "2.png", "3.png", "4.png", "5.png",
    "6.png", "7.png", "8.png", "9.png", "10.png"
];

function isInsideDirtEllipse(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    
    const safeRx = rx - PAD_X;
    
    const safeRy = dy >= 0 ? (ry - PAD_Y_TOP) : (ry - PAD_Y_BOTTOM);

    return (dx * dx) / (safeRx * safeRx) + (dy * dy) / (safeRy * safeRy) <= 1;
}

function isTooCloseToOthers(x, y) {
    for (const flower of spawnedFlowers) {
        const dist = Math.hypot(x - flower.x, y - flower.y);
        if (dist < MIN_DISTANCE) return true; 
    }
    return false; 
}

function closeMainMenu() {
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.add('hidden');
}

function closeCounter() {
    const counterCard = document.getElementById('counterCard');
    if (counterCard) counterCard.classList.add('hidden-counter');
}

function startPlantingMode() {
    closeMainMenu();
    const dirtPatch = document.querySelector('.dirt-patch-zone');
    if (dirtPatch) dirtPatch.classList.add('planting-active');
}

window.closeMainMenu = closeMainMenu;
window.closeCounter = closeCounter;
window.startPlantingMode = startPlantingMode;

function spawnFlower(xPercent, yPercent) {
    const patchZone = document.querySelector('.dirt-patch-zone');
    if (!patchZone) return;

    const randomImgSrc = flowerAssets[Math.floor(Math.random() * flowerAssets.length)];
    const flowerItem = document.createElement('div');
    flowerItem.className = 'flower-item';
    flowerItem.style.left = `${xPercent}%`;
    flowerItem.style.bottom = `${yPercent}%`;
    
    flowerItem.style.zIndex = Math.floor(100 - yPercent);
    
    const randomScale = 0.85 + Math.random() * 0.3;
    flowerItem.style.transform = `scale(${randomScale})`;

    const randomFlip = Math.random() > 0.5 ? 1 : -1;

    flowerItem.innerHTML = `
        <div class="speech-bubble">I planted a flower for Fah Naritsa ✿</div>
        <img src="${randomImgSrc}" class="flower-img" alt="Flower for Fah" style="transform: scaleX(${randomFlip});">
    `;

    flowerItem.addEventListener('touchstart', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.flower-item').forEach(el => {
            if (el !== flowerItem) el.classList.remove('show-bubble');
        });
        flowerItem.classList.toggle('show-bubble');
    });

    patchZone.appendChild(flowerItem);
}

document.addEventListener("DOMContentLoaded", () => {
    const dirtPatchZone = document.querySelector('.dirt-patch-zone');
    
    if (dirtPatchZone) {
        if (SHOW_DEBUG_ZONE) {
            const debugEllipse = document.createElement('div');
            debugEllipse.style.position = 'absolute';
            debugEllipse.style.left = `${cx - rx}%`;
            debugEllipse.style.bottom = `${cy - ry}%`;
            debugEllipse.style.width = `${rx * 2}%`;
            debugEllipse.style.height = `${ry * 2}%`;
            debugEllipse.style.border = '3px dashed red';
            debugEllipse.style.borderRadius = '50%';
            debugEllipse.style.pointerEvents = 'none'; 
            debugEllipse.style.zIndex = '9999';
            dirtPatchZone.appendChild(debugEllipse);
        }

        let spawnedCount = 0;
        let attempts = 0;
        while (spawnedCount < 120 && attempts < 8000) {
            attempts++;
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.sqrt(Math.random());
            
            const initialX = cx + radius * rx * Math.cos(angle);
            const initialY = cy + radius * ry * Math.sin(angle);
            
            if (isInsideDirtEllipse(initialX, initialY) && !isTooCloseToOthers(initialX, initialY)) {
                spawnFlower(initialX, initialY);
                spawnedFlowers.push({ x: initialX, y: initialY });
                spawnedCount++;
            }
        }

        dirtPatchZone.addEventListener('click', function(e) {
            if (!this.classList.contains('planting-active')) return;
            if (e.target.closest('.flower-item')) return; 

            const rect = this.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * 100;
            const clickY = 100 - (((e.clientY - rect.top) / rect.height) * 100);

            if (!isInsideDirtEllipse(clickX, clickY)) return;
            if (isTooCloseToOthers(clickX, clickY)) return;

            spawnFlower(clickX, clickY);
            spawnedFlowers.push({ x: clickX, y: clickY });
        });
    }
});

document.addEventListener('touchstart', function() {
    document.querySelectorAll('.flower-item').forEach(el => el.classList.remove('show-bubble'));
});

function startPlantingMode() {
    const mainMenu = document.getElementById('mainMenu');
    const plantingIntro = document.getElementById('plantingIntroCard');

    if (mainMenu) {
        mainMenu.classList.add('fade-out');
        setTimeout(() => {
            mainMenu.classList.add('hidden');
            
            if (plantingIntro) {
                plantingIntro.classList.remove('card-hidden');
            }
        }, 400);
    }

    const dirtPatch = document.querySelector('.dirt-patch-zone');
    if (dirtPatch) dirtPatch.classList.add('planting-active');
}

function closePlantingIntro() {
    const plantingIntro = document.getElementById('plantingIntroCard');
    if (plantingIntro) {
        plantingIntro.classList.add('card-hidden');
    }
}

function backToMainMenu() {
    const mainMenu = document.getElementById('mainMenu');
    const plantingIntro = document.getElementById('plantingIntroCard');
    const dirtPatch = document.querySelector('.dirt-patch-zone');

    if (plantingIntro) {
        plantingIntro.classList.add('card-hidden');
        setTimeout(() => {
            if (mainMenu) {
                mainMenu.classList.remove('hidden');
                void mainMenu.offsetWidth;
                mainMenu.classList.remove('fade-out');
            }
        }, 400);
    }
    
    if (dirtPatch) dirtPatch.classList.remove('planting-active');
}

window.startPlantingMode = startPlantingMode;
window.closePlantingIntro = closePlantingIntro;
window.backToMainMenu = backToMainMenu;
