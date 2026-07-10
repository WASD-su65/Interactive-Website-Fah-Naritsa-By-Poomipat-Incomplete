// ==========================================
// 🛠️ CONFIG & SUPABASE
// ==========================================
const supabaseUrl = 'https://twlgyxiocuspjdyfqjcf.supabase.co'; 
const supabaseKey = 'sb_publishable_8hWGjA385yLCYdVL3jsdfg_9dHtq2ZW'; 

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 🛠️ ZONE นักพัฒนา: พิกัดแปลงดิน
// ==========================================
const SHOW_DEBUG_ZONE = false; 
const MIN_DISTANCE = 2.6;      

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
    "6.png", "7.png", "8.png", "9.png", "10.png",
    "11.png"
];

let tempX = 0;
let tempY = 0;
let currentUser = "";

async function loadFlowers() {
    const { data, error } = await supabaseClient.from('flower').select('*');
    if (error) {
        console.error("Error loading:", error);
        return;
    }
    data.forEach(item => {
        spawnFlower(item.x, item.y, item.flower_id, item.nickname, item.message);
        spawnedFlowers.push({ x: item.x, y: item.y }); 
    });
}

async function saveToDatabase(x, y, flower_id, nickname, message) {
    const { data, error } = await supabaseClient
        .from('flower')
        .insert([{ 
            x: x, 
            y: y, 
            flower_id: flower_id, 
            nickname: nickname, 
            message: message 
        }]);
    
    if (error) {
        console.error("บันทึกไม่สำเร็จ:", error);
        alert("บันทึกไม่สำเร็จ: " + error.message);
    } else {
        console.log("บันทึกสำเร็จ!");
    }
}

function getUserIdentity() {
    let uuid = localStorage.getItem('user_uuid');
    if (!uuid) {
        uuid = crypto.randomUUID();
        localStorage.setItem('user_uuid', uuid);
    }
    return uuid;
}

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

function spawnFlower(xPercent, yPercent, imgName = null, nickname = "I", message = "plant for Fah Naritsa✿") {
    const patchZone = document.querySelector('.dirt-patch-zone');
    if (!patchZone) return;

    const randomImgSrc = imgName || flowerAssets[Math.floor(Math.random() * flowerAssets.length)];
    const flowerItem = document.createElement('div');
    flowerItem.className = 'flower-item';
    flowerItem.style.left = `${xPercent}%`;
    flowerItem.style.bottom = `${yPercent}%`;
    flowerItem.style.zIndex = Math.floor(100 - yPercent);
    
    const randomScale = 0.85 + Math.random() * 0.3;
    flowerItem.style.transform = `scale(${randomScale})`;

    const randomFlip = Math.random() > 0.5 ? 1 : -1;

    flowerItem.innerHTML = `
        <div class="speech-bubble">
            <strong>${nickname}</strong><br>${message}
        </div>
        <img src="${randomImgSrc}" class="flower-img" style="transform: scaleX(${randomFlip});">
    `;

    flowerItem.addEventListener('touchstart', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.flower-item').forEach(el => el.classList.remove('show-bubble'));
        flowerItem.classList.toggle('show-bubble');
    });

    patchZone.appendChild(flowerItem);
}

document.addEventListener("DOMContentLoaded", () => {
    loadFlowers(); 
    
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

            tempX = clickX;
            tempY = clickY;
            
            const modal = document.getElementById('plantingModal');
            if(modal) {
                modal.classList.remove('hidden');
            } else {
                console.log("กรุณาเพิ่ม #plantingModal ใน HTML เพื่อใช้ระบบหน้าต่างปลูกดอกไม้");
            }
        });
    }
});

document.addEventListener('touchstart', function() {
    document.querySelectorAll('.flower-item').forEach(el => el.classList.remove('show-bubble'));
});

function startPlantingMode() {
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.add('hidden');

    const nameModal = document.getElementById('nameInputModal');
    if (nameModal) {
        nameModal.classList.remove('hidden');
    }
    document.getElementById('counterCard').classList.add('hidden');
}

function submitNameAndStart() {
    const nameInput = document.getElementById('userNameInput').value;
    
    if (nameInput.trim() === "") {
        alert("กรอกชื่อก่อนน้าาา");
        return;
    }

    document.getElementById('displayName').innerText = nameInput;
    document.getElementById('nameInputModal').classList.add('hidden');
    document.getElementById('flowerSelectionModal').classList.remove('hidden');
}

function selectFlower(flowerName) {
    console.log("เลือกดอกไม้: " + flowerName);
}

function confirmPlanting() {
    const msgInput = document.getElementById('messageInput');
    const message = (msgInput && msgInput.value) ? msgInput.value : "ส่งต่อความรัก ✿";
    const randomImg = flowerAssets[Math.floor(Math.random() * flowerAssets.length)];

    spawnFlower(tempX, tempY, randomImg, currentUser, message);

    saveToDatabase(tempX, tempY, randomImg, currentUser, message);
    spawnedFlowers.push({ x: tempX, y: tempY });
    
    closeModal();
}

function closeModal() {
    const modal = document.getElementById('plantingModal');
    if (modal) modal.classList.add('hidden');
    
    const msgInput = document.getElementById('messageInput');
    if (msgInput) msgInput.value = "";
}

function closeMainMenu() {
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.add('hidden');
}

function closeCounter() {
    const counterCard = document.getElementById('counterCard');
    if (counterCard) counterCard.classList.add('hidden-counter');
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

function toggleMusic() {
    const music = document.getElementById('bgMusic');
    const audioIcon = document.getElementById('audioIcon');
    
    if (!music) return;

    music.muted = !music.muted;

    if (music.muted) {
        if (audioIcon) audioIcon.src = 'ปิดเสียง.png';
    } else {
        if (audioIcon) audioIcon.src = 'เปิดเสียง.png';
    }

    if (music.paused) {
        music.play().catch(e => console.log("รอการโต้ตอบจากผู้ใช้"));
    }
}

document.addEventListener('click', function() {
    const music = document.getElementById('bgMusic');
    const audioBtn = document.querySelector('.audio-toggle-btn');
    
    if (music && music.paused) {
        music.play().then(() => {
            console.log("เล่นเพลงสำเร็จจากคลิกแรกของผู้ใช้");
            if (audioBtn) audioBtn.textContent = '🔊';
        }).catch(err => {
            console.log("Autoplay โดนบล็อกชั่วคราวโดยระบบความปลอดภัยของเบราว์เซอร์");
        });
    }
}, { once: true });

function enterGarden() {
    const welcome = document.getElementById('welcomeScreen');
    const music = document.getElementById('bgMusic');
    const audioBtn = document.getElementById('audioBtn');

    if (welcome) welcome.classList.add('fade-away');
    if (audioBtn) audioBtn.classList.remove('hidden');

    if (music) {
        music.play().then(() => {
            console.log("เข้าสวนแล้ว!");
        }).catch(error => {
            console.log("เบราว์เซอร์บล็อกเพลง:", error);
        });
    }
}

window.toggleMusic = toggleMusic;
window.closeMainMenu = closeMainMenu;
window.closeCounter = closeCounter;
window.startPlantingMode = startPlantingMode;
window.closePlantingIntro = closePlantingIntro;
window.backToMainMenu = backToMainMenu;