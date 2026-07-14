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
const MIN_DISTANCE = 1.4;      

// ═══════════════════════════════════════════════════════════
// 🌸 ระบบ FIFO Cooldown - ควบคุมจำนวนดอกไม้บนหน้าจอ
// ═══════════════════════════════════════════════════════════
// เต็ม MAX_FLOWERS → เริ่ม cooldown ทุก COOLDOWN_INTERVAL ms → หายเก่าสุดก่อน
// ลดลงเหลือ MIN_FLOWERS → หยุด cooldown → รอปลูกใหม่จนเต็มอีก
// (ข้อมูลใน Supabase ยังคงอยู่ครบ - แค่ลบออกจาก DOM เท่านั้น)
const MAX_FLOWERS = 100;                // เต็มเพดาน → เริ่ม cooldown
const MIN_FLOWERS = 80;                 // ลดถึงจุดนี้ → หยุด cooldown
const COOLDOWN_INTERVAL = 10 * 1000;    // 10 วินาที ต่อการหาย 1 ดอก
const FADE_OUT_DURATION = 1000;         // fade-out animation 1 วิ ก่อนลบ DOM
let cooldownTimer = null;               // reference ของ setInterval - เพื่อหยุดได้

// ✅ พื้นที่แปลงดินจริงไม่ใช่วงรีสมมาตร (ปลายซ้ายแหลม ปลายขวาป้าน) จึงใช้ polygon
// ที่วัดจากขอบเขตพื้นที่ดินจริงในภาพพื้นหลัง (BG_Flower_1920x1080px.png) แทนสูตรวงรี
// พิกัดแต่ละจุดคือ { x, y } เป็นเปอร์เซ็นต์ (x = จากซ้าย, y = จากล่าง) ของ .dirt-patch-zone
const DIRT_POLYGON = [
    { x: 8.79,  y: 17.11 },
    { x: 9.04,  y: 15.09 },
    { x: 14.84, y: 8.64 },
    { x: 17.84, y: 6.99 },
    { x: 30.19, y: 7.07 },
    { x: 48.60, y: 4.29 },
    { x: 56.49, y: 4.44 },
    { x: 59.83, y: 5.50 },
    { x: 63.59, y: 8.20 },
    { x: 64.96, y: 12.76 },
    { x: 64.75, y: 19.45 },
    { x: 63.05, y: 24.02 },
    { x: 50.86, y: 28.21 },
    { x: 21.73, y: 27.46 },
    { x: 14.93, y: 24.02 },
    { x: 9.84,  y: 19.89 }
];

const DIRT_BOUNDS = {
    minX: Math.min(...DIRT_POLYGON.map(p => p.x)),
    maxX: Math.max(...DIRT_POLYGON.map(p => p.x)),
    minY: Math.min(...DIRT_POLYGON.map(p => p.y)),
    maxY: Math.max(...DIRT_POLYGON.map(p => p.y)),
};

const spawnedFlowers = [];
const flowerAssets = [
    "1.png", "2.png", "3.png", "4.png", "5.png",
    "6.png", "7.png", "8.png", "9.png", "10.png",
    "11.png"
];

let tempX = 0;
let tempY = 0;
let currentUser = "";
let selectedFlowerName = "";
let selectedFlowerMeaning = "";
let selectedFlowerImg = "";
let selectedFlowerDetail = "";

async function updateFlowerPosition(id, x, y) {
    if (id === undefined || id === null) {
        console.warn("⚠️ ไม่มี id ของดอกไม้ เลยบันทึกตำแหน่งใหม่กลับเข้า database ไม่ได้ (จะสุ่มตำแหน่งใหม่ทุกครั้งที่โหลดหน้าแทน)");
        return;
    }

    const { error } = await supabaseClient
        .from('flower')
        .update({ x: x, y: y })
        .eq('id', id);

    if (error) {
        console.error(`❌ บันทึกตำแหน่งใหม่ของดอกไม้ id ${id} ไม่สำเร็จ:`, error);
    } else {
        console.log(`✅ บันทึกตำแหน่งใหม่ของดอกไม้ id ${id} ลง database ถาวรแล้ว (x:${x}, y:${y})`);
    }
}

async function loadFlowers() {

    const { data, error } = await supabaseClient
        .from('flower')
        .select('*')
        .order('id', { ascending: false })
        .limit(MAX_FLOWERS);

    if (error) {
        console.error("Error loading:", error);
        return;
    }

    console.log(`🌱 โหลดดอกไม้ ${data.length} ดอกจาก Database (เอาแค่ ${MAX_FLOWERS} ล่าสุด)`);

    data.reverse().forEach(item => {
        let posX = Number(item.x);
        let posY = Number(item.y);

        if (isNaN(posX) || isNaN(posY) || !isInsideDirtEllipse(posX, posY)) {
            const safePos = getRandomValidDirtPosition();
            console.warn(`⚠️ ดอกไม้ id ${item.id ?? '(ไม่ทราบ)'} มีตำแหน่งหลุดนอกแปลงดิน (x:${item.x}, y:${item.y}, type: ${typeof item.x}) เลยสุ่มตำแหน่งใหม่ในแปลงดินให้แทน`);
            posX = safePos.x;
            posY = safePos.y;

            updateFlowerPosition(item.id, posX, posY);
        }

        const el = spawnFlower(posX, posY, item.flower_id, item.nickname, item.message);
        spawnedFlowers.push({ x: posX, y: posY, element: el }); 
    });

    manageFlowerCap();
}

async function saveToDatabase(x, y, flower_id, nickname, message, flower_name = "") {    
    const uuid = localStorage.getItem('user_uuid');

    const payload = { 
        x: x, 
        y: y, 
        flower_id: flower_id, 
        flower_name: flower_name,
        nickname: nickname, 
        message: message,
        user_uuid: uuid
    };

    console.log("🚀 กำลังส่งข้อมูล:", payload);

    const { data, error } = await supabaseClient
        .from('flower')
        .insert([payload]);
    
    if (error) {
        console.error("❌ บันทึกพลาด! สาเหตุ:", error);
        alert("บันทึกไม่สำเร็จ ลองดู Console (F12) นะครับ");
        return false;
    }
    console.log("✅ บันทึกสำเร็จ!");
    return true;
}

async function showFlowerCounter() {
    let totalCount = spawnedFlowers.length;
    try {
        const { count, error } = await supabaseClient
            .from('flower')
            .select('*', { count: 'exact', head: true });
        if (!error && count !== null && count !== undefined) totalCount = count;
    } catch (err) {
        console.error("⚠️ นับ Supabase ไม่ได้ ใช้ fallback:", err);
    }

    const counterCard   = document.getElementById('counterCard');
    const counterNumber = document.getElementById('counterNumber');

    if (counterNumber) counterNumber.innerText = totalCount;
    if (counterCard) {
        counterCard.classList.remove('hidden');
        counterCard.classList.remove('hidden-counter');
    }

    console.log(`🎉 คุณเป็นคนปลูกดอกไม้ ดอกที่ ${totalCount}`);
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
    let inside = false;
    for (let i = 0, j = DIRT_POLYGON.length - 1; i < DIRT_POLYGON.length; j = i++) {
        const xi = DIRT_POLYGON[i].x, yi = DIRT_POLYGON[i].y;
        const xj = DIRT_POLYGON[j].x, yj = DIRT_POLYGON[j].y;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getRandomValidDirtPosition(maxAttempts = 300) {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const x = DIRT_BOUNDS.minX + Math.random() * (DIRT_BOUNDS.maxX - DIRT_BOUNDS.minX);
        const y = DIRT_BOUNDS.minY + Math.random() * (DIRT_BOUNDS.maxY - DIRT_BOUNDS.minY);

        if (isInsideDirtEllipse(x, y) && !isTooCloseToOthers(x, y)) {
            return { x, y };
        }
    }

    return {
        x: (DIRT_BOUNDS.minX + DIRT_BOUNDS.maxX) / 2,
        y: (DIRT_BOUNDS.minY + DIRT_BOUNDS.maxY) / 2
    };
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
    if (!patchZone) return null;

    const randomImgSrc = imgName || flowerAssets[Math.floor(Math.random() * flowerAssets.length)];
    const flowerItem = document.createElement('div');
    flowerItem.className = 'flower-item';
    flowerItem.style.left = `${xPercent}%`;
    flowerItem.style.bottom = `${yPercent}%`;
    flowerItem.style.zIndex = Math.floor(100 - yPercent);
    
    const randomScale = 0.85 + Math.random() * 0.3;

    flowerItem.style.transform = `translateX(-50%) scale(${randomScale})`;

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
    return flowerItem;
}

function manageFlowerCap() {
    const currentCount = spawnedFlowers.length;

    if (currentCount >= MAX_FLOWERS && !cooldownTimer) {
        console.log(`🌼 สวนเต็ม cap (${currentCount}/${MAX_FLOWERS}) - เริ่ม cooldown ทุก ${COOLDOWN_INTERVAL/1000} วินาที`);
        cooldownTimer = setInterval(removeOldestFlower, COOLDOWN_INTERVAL);
    }
}

function removeOldestFlower() {
    if (spawnedFlowers.length === 0) return;

    if (spawnedFlowers.length <= MIN_FLOWERS) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        console.log(`🌱 ลดถึง ${MIN_FLOWERS} ดอกแล้ว - หยุด cooldown รอปลูกใหม่จนเต็ม ${MAX_FLOWERS} อีกครั้ง`);
        return;
    }

    const oldest = spawnedFlowers.shift();
    const el = oldest.element;

    if (!el || !el.parentNode) {

        console.log(`⏳ FIFO: ดอกเก่าสุดไม่มี DOM element - ข้าม (เหลือ ${spawnedFlowers.length} ดอก)`);
        return;
    }

    el.classList.add('fading-out');
    console.log(`🍂 FIFO: ดอกเก่าสุดกำลังหาย... (จะเหลือ ${spawnedFlowers.length} ดอก)`);

    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, FADE_OUT_DURATION);
}

document.addEventListener("DOMContentLoaded", () => {
    getUserIdentity();
    loadFlowers(); 
    
    const dirtPatchZone = document.querySelector('.dirt-patch-zone');
    if (dirtPatchZone) {
        if (SHOW_DEBUG_ZONE) {
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('style', 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999;');
            svg.setAttribute('viewBox', '0 0 100 100');
            svg.setAttribute('preserveAspectRatio', 'none');

            const polygon = document.createElementNS(svgNS, 'polygon');
            const pointsAttr = DIRT_POLYGON.map(p => `${p.x},${100 - p.y}`).join(' ');
            polygon.setAttribute('points', pointsAttr);
            polygon.setAttribute('fill', 'rgba(255,0,0,0.15)');
            polygon.setAttribute('stroke', 'red');
            polygon.setAttribute('stroke-width', '0.3');
            polygon.setAttribute('vector-effect', 'non-scaling-stroke');

            svg.appendChild(polygon);
            dirtPatchZone.appendChild(svg);
        }

        // ❌ [DISABLED] ปิดการสุ่มดอกไม้ - ใช้ข้อมูลจริงจาก Database เท่านั้น
        /*
        const TARGET_RANDOM_FLOWERS = 120 + Math.floor(Math.random() * 10);
        let spawnedCount = 0;
        let attempts = 0;
        while (spawnedCount < TARGET_RANDOM_FLOWERS && attempts < 12000) {
            attempts++;
            const initialX = DIRT_BOUNDS.minX + Math.random() * (DIRT_BOUNDS.maxX - DIRT_BOUNDS.minX);
            const initialY = DIRT_BOUNDS.minY + Math.random() * (DIRT_BOUNDS.maxY - DIRT_BOUNDS.minY);
            
            if (isInsideDirtEllipse(initialX, initialY) && !isTooCloseToOthers(initialX, initialY)) {
                const el = spawnFlower(initialX, initialY);
                spawnedFlowers.push({ x: initialX, y: initialY, element: el });
                spawnedCount++;
            }
        }

        console.log(`🧪 [TEST] เป้าหมาย: ${TARGET_RANDOM_FLOWERS} ดอก | สุ่มได้จริง: ${spawnedCount} ดอก | attempts: ${attempts}`);
        console.log(`🧪 [TEST] MIN_DISTANCE: ${MIN_DISTANCE}% | ถ้าสุ่มไม่ครบ = แปลว่าพื้นที่หนาแน่นมาก`);
        if (spawnedCount < TARGET_RANDOM_FLOWERS) {
            console.warn(`⚠️ สุ่มไม่ครบเป้า! ขาดอีก ${TARGET_RANDOM_FLOWERS - spawnedCount} ดอก - พื้นที่ปลูกใกล้เต็มแล้ว`);
        }
        */

        dirtPatchZone.addEventListener('click', async function(e) {
            if (!this.classList.contains('planting-active')) return;
            if (e.target.closest('.flower-item')) return; 

            const rect = this.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * 100;
            const clickY = 100 - (((e.clientY - rect.top) / rect.height) * 100);

            if (!isInsideDirtEllipse(clickX, clickY)) { console.log('❌ คลิกนอกแปลงดิน'); return; }
            if (isTooCloseToOthers(clickX, clickY)) { console.log('❌ ใกล้ดอกอื่นเกินไป'); return; }

            tempX = clickX;
            tempY = clickY;

            const flowerImgToUse = selectedFlowerImg || flowerAssets[Math.floor(Math.random() * flowerAssets.length)];
            const flowerNameToUse = selectedFlowerName || "";
            const message = pendingMessage || "ส่งต่อความรัก ✿";

            console.log(`🌸 ปลูก: x=${tempX.toFixed(2)}, y=${tempY.toFixed(2)}, flower=${flowerImgToUse}`);

            const el = spawnFlower(tempX, tempY, flowerImgToUse, currentUser, message);
            const saveOk = await saveToDatabase(tempX, tempY, flowerImgToUse, currentUser, message, flowerNameToUse);
            spawnedFlowers.push({ x: tempX, y: tempY, element: el });

            manageFlowerCap();

            this.classList.remove('planting-active');
            const hintToast = document.getElementById('plantingHintToast');
            if (hintToast) hintToast.classList.add('hidden');
            pendingMessage = "";

            if (saveOk) {
                showThankYouCard(flowerImgToUse);
            } else {

                const mainMenu = document.getElementById('mainMenu');
                if (mainMenu) mainMenu.classList.remove('hidden');
                const songTitle = document.querySelector('.song-title');
                if (songTitle) songTitle.classList.remove('hidden');
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

    const counterCard = document.getElementById('counterCard');
    if (counterCard) counterCard.classList.add('hidden-counter');

    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.add('hidden');
}

function submitNameAndStart() {
    const nameInput = document.getElementById('userNameInput').value;
    
    if (nameInput.trim() === "") {
        alert("กรอกชื่อก่อนน้าาา");
        return;
    }

    currentUser = nameInput.trim();

    document.getElementById('displayName').innerText = currentUser;
    document.getElementById('nameInputModal').classList.add('hidden');
    document.getElementById('flowerSelectionModal').classList.remove('hidden');

    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.add('hidden');
}

function selectFlower(flowerName, flowerMeaning, flowerImg, flowerDetail) {
    selectedFlowerName = flowerName;
    selectedFlowerMeaning = flowerMeaning;
    selectedFlowerImg = flowerImg;
    selectedFlowerDetail = flowerDetail;

    document.getElementById('modalFlowerName').innerText = selectedFlowerName;
    document.getElementById('modalFlowerMeaning').innerText = selectedFlowerMeaning;
    document.getElementById('modalFlowerImg').src = selectedFlowerImg;
    document.getElementById('modalFlowerDetail').innerText = selectedFlowerDetail;

    const selectionModal = document.getElementById('flowerSelectionModal');
    if (selectionModal) selectionModal.classList.add('hidden');

    const plantModal = document.getElementById('plantingModal');
    if (plantModal) plantModal.classList.remove('hidden');

    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.add('hidden');
}

let pendingMessage = "";

function confirmPlanting() {
    const msgInput = document.getElementById('messageInput');
    pendingMessage = (msgInput && msgInput.value) ? msgInput.value : "ส่งต่อความรัก ✿";

    console.log(`🌸 พร้อมปลูก: flower=${selectedFlowerImg}, msg=${pendingMessage} - รอคลิกที่พื้นดิน`);

    const plantModal = document.getElementById('plantingModal');
    if (plantModal) plantModal.classList.add('hidden');

    const dirtPatch = document.querySelector('.dirt-patch-zone');
    if (dirtPatch) dirtPatch.classList.add('planting-active');

    const hintToast = document.getElementById('plantingHintToast');
    if (hintToast) hintToast.classList.remove('hidden');
}

function closeModal(backToSelection = true) {
    const plantModal = document.getElementById('plantingModal');
    if (plantModal) {
        plantModal.classList.add('hidden');
    }
    
    if (backToSelection) {
        const selectionModal = document.getElementById('flowerSelectionModal');
        if (selectionModal) {
            selectionModal.classList.remove('hidden');
        }
    }

    const msgInput = document.getElementById('messageInput');
    if (msgInput) {
        msgInput.value = "";
    }

    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.add('hidden');
}

function closeMainMenu() {
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.add('collapsed');
}
function expandMainMenu() {
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.remove('collapsed');
}

function closeCounter() {
    const counterCard = document.getElementById('counterCard');
    if (counterCard) counterCard.classList.add('collapsed');
}
function expandCounter() {
    const counterCard = document.getElementById('counterCard');
    if (counterCard) counterCard.classList.remove('collapsed');
}

let currentThankYouCardImg = "";

function showThankYouCard(flowerImg) {

    const cardImg = flowerImg.replace('.png', '_card.png');
    currentThankYouCardImg = cardImg;

    const card = document.getElementById('thankYouCard');
    const cardImgEl = document.getElementById('thankYouCardImg');
    if (!card || !cardImgEl) {
        console.error("❌ ไม่พบ #thankYouCard หรือ #thankYouCardImg");
        return;
    }

    cardImgEl.src = cardImg;
    card.classList.remove('hidden');
    console.log(`🎴 โชว์การ์ดขอบคุณ: ${cardImg}`);
}

async function downloadThankYouCard() {
    if (!currentThankYouCardImg) return;

    try {
        const response = await fetch(currentThankYouCardImg);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = currentThankYouCardImg;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        console.log(`📥 ดาวน์โหลดการ์ด: ${currentThankYouCardImg}`);
    } catch (err) {
        console.error("❌ ดาวน์โหลดล้มเหลว:", err);
        window.open(currentThankYouCardImg, '_blank');
    }
}

function closeThankYouCard() {
    const card = document.getElementById('thankYouCard');
    if (card) card.classList.add('hidden');

    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.remove('hidden');
    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.remove('hidden');

    showFlowerCounter();
}

const ALBUM_ENTRIES_PER_PAGE = 5;
const ALBUM_ENTRIES_PER_SPREAD = 10;
const ALBUM_MAX_SPREADS = 5;
const ALBUM_MAX_ENTRIES = ALBUM_MAX_SPREADS * ALBUM_ENTRIES_PER_SPREAD;
let albumData = [];
let albumCurrentSpread = 0;

async function openAlbum() {
    console.log(`📖 เปิดอัลบัม - ดึงข้อมูล ${ALBUM_MAX_ENTRIES} แถวล่าสุดจาก Database...`);

    const albumModal = document.getElementById('albumModal');
    if (!albumModal) {
        console.error("❌ ไม่พบ #albumModal");
        return;
    }

    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.add('hidden');

    try {
        const { data, error } = await supabaseClient
            .from('flower')
            .select('flower_id, flower_name, nickname, message, created_at, id')
            .order('created_at', { ascending: false })
            .limit(ALBUM_MAX_ENTRIES);

        if (error) {
            console.error("❌ ดึงข้อมูลอัลบัมไม่สำเร็จ:", error);
            const fallback = await supabaseClient
                .from('flower')
                .select('flower_id, flower_name, nickname, message, id')
                .order('id', { ascending: false })
                .limit(ALBUM_MAX_ENTRIES);
            if (fallback.error) {
                albumData = [];
            } else {
                albumData = fallback.data || [];
            }
        } else {
            albumData = data || [];
        }

        console.log(`📖 ได้ข้อมูล ${albumData.length} รายการ`);
    } catch (err) {
        console.error("❌ Exception ตอนดึงอัลบัม:", err);
        albumData = [];
    }

    albumCurrentSpread = 0;
    renderAlbumPage();
    albumModal.classList.remove('hidden');
}

function closeAlbum() {
    const albumModal = document.getElementById('albumModal');
    if (albumModal) albumModal.classList.add('hidden');

    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.remove('hidden');
}

function renderAlbumPage() {
    const listLeft  = document.getElementById('albumListLeft');
    const listRight = document.getElementById('albumListRight');
    const curPageEl = document.getElementById('albumCurrentPage');
    const totPageEl = document.getElementById('albumTotalPage');
    const prevBtn   = document.querySelector('.album-prev-btn');
    const nextBtn   = document.querySelector('.album-next-btn');

    if (!listLeft || !listRight) return;

    const totalSpreads = Math.max(1, Math.ceil(albumData.length / ALBUM_ENTRIES_PER_SPREAD));
    if (curPageEl) curPageEl.innerText = albumCurrentSpread + 1;
    if (totPageEl) totPageEl.innerText = totalSpreads;

    if (prevBtn) prevBtn.disabled = albumCurrentSpread === 0;
    if (nextBtn) nextBtn.disabled = albumCurrentSpread >= totalSpreads - 1;

    const startIdx = albumCurrentSpread * ALBUM_ENTRIES_PER_SPREAD;
    const leftEntries  = albumData.slice(startIdx, startIdx + ALBUM_ENTRIES_PER_PAGE);
    const rightEntries = albumData.slice(startIdx + ALBUM_ENTRIES_PER_PAGE, startIdx + ALBUM_ENTRIES_PER_SPREAD);

    listLeft.innerHTML  = renderAlbumEntries(leftEntries);
    listRight.innerHTML = renderAlbumEntries(rightEntries);
}

function renderAlbumEntries(entries) {
    if (!entries || entries.length === 0) {
        return '<li class="album-entry-empty">ยังไม่มีดอกไม้ในหน้านี้</li>';
    }
    return entries.map(item => {
        const flowerImg  = item.flower_id || '1.png';
        const nickname   = escapeHtml(item.nickname || '(ไม่ระบุชื่อ)');
        const flowerName = escapeHtml(item.flower_name || 'ดอกไม้');
        const message    = escapeHtml(item.message || '');

        return `
            <li class="album-entry">
                <img src="${flowerImg}" alt="flower" class="album-entry-img" onerror="this.style.opacity='0.3'">
                <div class="album-entry-text">
                    <div class="album-entry-line">
                        <span class="album-entry-label">คุณ</span>
                        <span class="album-entry-value" title="${nickname}">${nickname}</span>
                    </div>
                    <div class="album-entry-line">
                        <span class="album-entry-label">ปลูก</span>
                        <span class="album-entry-value" title="${flowerName}">${flowerName}</span>
                    </div>
                    <div class="album-entry-line">
                        <span class="album-entry-label">ข้อความ</span>
                        <span class="album-entry-value" title="${message}">${message}</span>
                    </div>
                </div>
            </li>
        `;
    }).join('');
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function albumPrevPage() {
    if (albumCurrentSpread > 0) {
        albumCurrentSpread--;
        renderAlbumPage();
    }
}

function albumNextPage() {
    const totalSpreads = Math.max(1, Math.ceil(albumData.length / ALBUM_ENTRIES_PER_SPREAD));
    if (albumCurrentSpread < totalSpreads - 1) {
        albumCurrentSpread++;
        renderAlbumPage();
    }
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

    const hintToast = document.getElementById('plantingHintToast');
    if (hintToast) hintToast.classList.add('hidden');
    pendingMessage = "";
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
window.expandMainMenu = expandMainMenu;
window.closeCounter = closeCounter;
window.expandCounter = expandCounter;
window.showThankYouCard = showThankYouCard;
window.closeThankYouCard = closeThankYouCard;
window.downloadThankYouCard = downloadThankYouCard;
window.startPlantingMode = startPlantingMode;
window.closePlantingIntro = closePlantingIntro;
window.backToMainMenu = backToMainMenu;
window.openAlbum = openAlbum;
window.closeAlbum = closeAlbum;
window.albumPrevPage = albumPrevPage;
window.albumNextPage = albumNextPage;