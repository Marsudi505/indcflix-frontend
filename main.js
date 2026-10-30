/* =============================================
   IndcHub - main.js
   ============================================= */

// ─── THEME ───────────────────────────────────
function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('bawx_theme', isDark ? 'dark' : 'light');
    document.getElementById('iconSun').classList.toggle('hidden', !isDark);
    document.getElementById('iconMoon').classList.toggle('hidden', isDark);
}

// Apply saved theme on load
(function applyTheme() {
    const saved = localStorage.getItem('bawx_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.getElementById('iconSun').classList.remove('hidden');
        document.getElementById('iconMoon').classList.add('hidden');
    }
})();


// ─── STATE ───────────────────────────────────
let dbTokoLokal    = null;
let dbRakLokal     = null;
let dbBarcodeLokal = null;
let currentUser    = null;
let currentRole    = null;
let currentActiveBatch = [];
let isRegisterMode = false;


// ─── KATALOG / DATA LOADER ───────────────────
async function muatDataKatalog() {
    if (!dbRakLokal) {
        fetch('https://raw.githubusercontent.com/Marsudi505/Listing/main/listing.json')
            .then(r => r.json())
            .then(data => dbRakLokal = data)
            .catch(() => dbRakLokal = {});
    }
    if (!dbBarcodeLokal) {
        fetch('https://raw.githubusercontent.com/Marsudi505/Barcodes/main/barcodesheet.json')
            .then(r => r.json())
            .then(data => dbBarcodeLokal = data)
            .catch(() => dbBarcodeLokal = []);
    }
}


// ─── LOCAL STORAGE HELPERS ───────────────────
function getDbKey(type) { return `${currentUser}_bawx_${type}`; }
function getNumbers()   { return JSON.parse(localStorage.getItem(getDbKey('numbers'))) || []; }
function getMyLogs()    { return JSON.parse(localStorage.getItem(getDbKey('logs'))) || []; }
function saveNumbers(data) { localStorage.setItem(getDbKey('numbers'), JSON.stringify(data)); }
function saveMyLogs(data)  { localStorage.setItem(getDbKey('logs'), JSON.stringify(data)); }


// ─── ACTIVITY LOGGER ─────────────────────────
function catatAktivitas(action, detail) {
    if (!currentUser) return;
    fetch('/api/log/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, action, detail, timestamp: Date.now() })
    }).catch(() => {});
}


// ─── GEO HELPER ──────────────────────────────
function hitungJarak(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// ─── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('bawx_session')) {
        currentUser = localStorage.getItem('bawx_session');
        currentRole = localStorage.getItem('bawx_role');
        showWorkspace();
        muatDataKatalog();
    }
});


// ─── SIDEBAR ─────────────────────────────────
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    const isHidden = sb.classList.contains('-translate-x-full');
    sb.classList.toggle('-translate-x-full', !isHidden);
    ov.classList.toggle('hidden', !isHidden);
}


// ─── MODE SWITCHER ────────────────────────────
function switchMode(mode) {
    toggleSidebar();
    ['areaHome', 'areaDashboard', 'areaAdmin', 'areaSearch', 'areaToko', 'areaDetail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const map = {
        home:      'areaHome',
        dashboard: 'areaDashboard',
        admin:     'areaAdmin',
        search:    'areaSearch',
        toko:      'areaToko',
    };
    if (map[mode]) document.getElementById(map[mode]).classList.remove('hidden');
    if (mode === 'admin') loadAdminData();
    if (mode === 'search') muatDataKatalog();
}


// ─── AUTH ─────────────────────────────────────
window.toggleAuthMode = function () {
    isRegisterMode = !isRegisterMode;
    document.getElementById('authMessage').classList.add('hidden');
    if (isRegisterMode) {
        document.getElementById('btnSubmitAuth').innerText = 'DAFTAR SEKARANG';
        document.getElementById('toggleText').innerHTML =
            `Sudah punya akses? <span onclick="toggleAuthMode()" class="text-blue-500 font-bold cursor-pointer hover:underline">Login Disini</span>`;
    } else {
        document.getElementById('btnSubmitAuth').innerText = 'MASUK WORKSPACE';
        document.getElementById('toggleText').innerHTML =
            `Belum memiliki akses? <span onclick="toggleAuthMode()" class="text-blue-500 font-bold cursor-pointer hover:underline">Minta Akses</span>`;
    }
};

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitAuth');
    const msg = document.getElementById('authMessage');
    btn.disabled = true;
    msg.classList.add('hidden');

    try {
        const url = isRegisterMode ? '/api/register' : '/api/login';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value.trim().toLowerCase(),
                password: document.getElementById('password').value
            })
        });
        const data = await res.json();
        msg.classList.remove('hidden');
        msg.innerText = data.message || 'Berhasil!';
        msg.className = `text-xs text-center mt-3 ${data.success ? 'text-emerald-500' : 'text-red-500'}`;

        if (data.success && !isRegisterMode) {
            currentUser = data.username;
            currentRole = data.role || 'user';
            localStorage.setItem('bawx_session', currentUser);
            localStorage.setItem('bawx_role', currentRole);
            setTimeout(() => { showWorkspace(); muatDataKatalog(); }, 500);
        } else if (data.success && isRegisterMode) {
            setTimeout(toggleAuthMode, 1000);
        }
    } catch {
        msg.classList.remove('hidden');
        msg.innerText = 'Error server lokal.';
        msg.className = 'text-xs text-center text-red-500 mt-3';
    }

    btn.disabled = false;
});


// ─── WORKSPACE ────────────────────────────────
function showWorkspace() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainWorkspace').classList.remove('hidden');
    document.getElementById('displayUsername').innerHTML =
        ` ${currentUser.toUpperCase()} ${currentRole === 'admin' ? '' : ''}`;
    document.getElementById('btnMenuAdmin').classList.toggle('hidden', currentRole !== 'admin');
    renderNumbers();
    renderLogs();
    switchTab('order');

    // Auto-detect subdomain routing
    const host = window.location.hostname;
    if      (host.startsWith('toko.')) switchMode('toko');
    else if (host.startsWith('plu.'))  switchMode('search');
    else if (host.startsWith('co.'))   switchMode('dashboard');
    else                               switchMode('home');
}

function logoutUser() {
    localStorage.removeItem('bawx_session');
    localStorage.removeItem('bawx_role');
    location.reload();
}


// ─── TAB SWITCHER ────────────────────────────
function switchTab(tab) {
    ['Order', 'Transaksi', 'Log'].forEach(t => {
        document.getElementById('view' + t).classList.add('hidden');
        document.getElementById('btnTab' + t).classList.replace('tab-active', 'tab-inactive');
    });
    const capitalized = tab.charAt(0).toUpperCase() + tab.slice(1);
    document.getElementById('view' + capitalized).classList.remove('hidden');
    document.getElementById('btnTab' + capitalized).classList.replace('tab-inactive', 'tab-active');
}


// ─── NUMBER DATABASE ──────────────────────────
function renderNumbers() {
    const listEl  = document.getElementById('numberList');
    const nums    = getNumbers();
    const usedSet = new Set(getMyLogs().map(l => l.nomor));

    if (!nums.length) {
        listEl.innerHTML = '<p class="text-xs text-center text-slate-400 py-4 font-bold">Database Kosong.</p>';
        return;
    }
    listEl.innerHTML = '';
    nums.forEach((n, i) => {
        const isUsed = usedSet.has(n);
        listEl.innerHTML += `
        <div class="flex items-center space-x-3 p-2 border-b dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition rounded">
            <input type="checkbox" class="num-checkbox w-4 h-4 rounded text-blue-600 focus:ring-blue-500" value="${n}">
            <span class="text-[11px] font-mono font-bold flex-1 ${isUsed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}">${i + 1}. ${n}</span>
            ${isUsed ? '<span class="text-[9px] text-red-500 bg-red-100/50 border border-red-200 px-1.5 py-0.5 rounded font-black">USED</span>' : ''}
        </div>`;
    });
}

document.getElementById('btnSimpanNomor').addEventListener('click', () => {
    const newNums = document.getElementById('inputNumbers').value
        .split(/[\n,]+/)
        .map(n => n.replace(/\D/g, ''))
        .filter(n => n.length > 8);
    let db = getNumbers();
    newNums.forEach(n => {
        const formatted = n.startsWith('62') ? '0' + n.substring(2) : n;
        if (!db.includes(formatted)) db.push(formatted);
    });
    saveNumbers(db);
    document.getElementById('inputNumbers').value = '';
    renderNumbers();
});

document.getElementById('btnSelectUnused').addEventListener('click', () => {
    const used = new Set(getMyLogs().map(l => l.nomor));
    const cbs  = Array.from(document.querySelectorAll('.num-checkbox')).filter(c => !used.has(c.value));
    const allChecked = cbs.every(c => c.checked);
    cbs.forEach(c => c.checked = !allChecked);
});

document.getElementById('btnSelectUsed').addEventListener('click', () => {
    const used = new Set(getMyLogs().map(l => l.nomor));
    const cbs  = Array.from(document.querySelectorAll('.num-checkbox')).filter(c => used.has(c.value));
    const allChecked = cbs.every(c => c.checked);
    cbs.forEach(c => c.checked = !allChecked);
});

document.getElementById('btnHapusTerpilih').addEventListener('click', () => {
    const checked = Array.from(document.querySelectorAll('.num-checkbox:checked')).map(c => c.value);
    if (checked.length) {
        saveNumbers(getNumbers().filter(n => !checked.includes(n)));
        renderNumbers();
    }
});


// ─── CHECKOUT ────────────────────────────────
async function prosesCheckout(formatOverride) {
    const checked = document.querySelectorAll('.num-checkbox:checked');
    if (!checked.length) return alert('Pilih nomor!');

    const btn1 = document.getElementById('btnGas');
    const btn2 = document.getElementById('btnPin');
    btn1.innerHTML = 'MENGIRIM...'; btn2.innerHTML = '...';
    btn1.disabled = btn2.disabled = true;
    btn1.classList.add('opacity-50'); btn2.classList.add('opacity-50');

    const nums          = Array.from(checked).map(c => c.value);
    const kode          = document.getElementById('kodeToko').value || '-';
    const plu           = document.getElementById('pluToko').value || '-';
    const formatDipakai = formatOverride || document.getElementById('formatMetode').value;

    currentActiveBatch = nums.map(n => ({ nomor: n, kodeToko: kode, pluToko: plu, status: 'LOADING' }));
    switchTab('transaksi');
    renderActiveBatch();
    document.querySelectorAll('.num-checkbox').forEach(c => c.checked = false);

    try {
        const res  = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, format: formatDipakai, kodeToko: kode, plu, numbers: nums })
        });
        const data = await res.json();

        if (data.success) {
            let logs = getMyLogs();
            data.data.forEach((item, i) => {
                if (currentActiveBatch[i]) {
                    currentActiveBatch[i].status = 'SUCCESS';
                    currentActiveBatch[i].result = item;
                    logs.push({ nomor: currentActiveBatch[i].nomor, kodeToko: kode, timestamp: Date.now(), result: item });
                }
            });
            saveMyLogs(logs);
            renderNumbers();
            renderLogs();
            document.getElementById('soundSuccess').play().catch(() => {});
        } else {
            alert('Sistem Menolak: ' + data.message);
        }
    } catch {
        currentActiveBatch.forEach(i => i.status = 'ERROR');
    }

    btn1.innerHTML = 'GAS KAN!';
    btn2.innerHTML = '<span class="text-lg mb-1"></span> AMBIL PIN';
    btn1.disabled = btn2.disabled = false;
    btn1.classList.remove('opacity-50'); btn2.classList.remove('opacity-50');
    renderActiveBatch();
}

document.getElementById('btnGas').addEventListener('click', () => prosesCheckout(null));
document.getElementById('btnPin').addEventListener('click', () => prosesCheckout('GAS.PIN'));


// ─── RENDER BATCH & LOGS ─────────────────────
function renderActiveBatch() {
    const body = document.getElementById('activeTableBody');
    let isProc = false;

    if (!currentActiveBatch.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-slate-400 font-bold">Tidak ada task berjalan.</td></tr>';
        return;
    }
    body.innerHTML = '';
    currentActiveBatch.forEach((item, i) => {
        let ui;
        if (item.status === 'LOADING') {
            isProc = true;
            ui = '<span class="text-amber-500 animate-spin inline-block font-bold"></span>';
        } else if (item.status === 'SUCCESS') {
            ui = `<button onclick='showModalLog(${JSON.stringify(item.result).replace(/'/g, "&#39;")})' class="bg-blue-500 hover:bg-blue-600 px-3 rounded text-[10px] text-white py-1.5 font-bold shadow transition">CEK</button>`;
        } else {
            ui = '';
        }
        body.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <td class="py-3 px-2 text-[10px] text-slate-400 font-bold">${i + 1}</td>
            <td class="py-3 px-2 font-mono font-bold text-[11px]">${item.nomor}</td>
            <td class="py-3 px-2 text-[10px] font-black">${item.kodeToko}</td>
            <td class="py-3 px-2 text-center">${ui}</td>
        </tr>`;
    });
    document.getElementById('pingIndicator').style.display = isProc ? 'block' : 'none';
}

function renderLogs() {
    const body = document.getElementById('logTableBody');
    const logs = [...getMyLogs()].sort((a, b) => b.timestamp - a.timestamp);

    if (!logs.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-slate-400 font-bold">Log kosong.</td></tr>';
        return;
    }
    body.innerHTML = '';
    logs.forEach((log, i) => {
        body.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <td class="py-3 text-[10px] text-slate-400 font-bold">${logs.length - i}</td>
            <td class="py-3 font-mono text-[10px] font-bold">${log.nomor}</td>
            <td class="py-3 text-[10px] font-black">${log.kodeToko}</td>
            <td class="py-3 text-right">
                <button onclick='showModalLog(${JSON.stringify(log.result).replace(/'/g, "&#39;")})' class="bg-slate-800 dark:bg-slate-700 hover:bg-black px-3 py-1.5 rounded text-[10px] text-white font-bold transition">Buka</button>
            </td>
        </tr>`;
    });
}

window.bersihkanLogSaya = function () {
    if (confirm('Hapus histori log Anda secara permanen?')) {
        saveMyLogs([]);
        renderLogs();
        renderNumbers();
    }
};

window.showModalLog = function (obj) {
    let h = obj.barcodeUrl
        ? `<div class="bg-white p-3 rounded-xl mb-4 shadow-inner border border-slate-200"><img src="${obj.barcodeUrl}" class="w-full mix-blend-multiply"></div>`
        : '';
    h += `<pre class="text-[10px] whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl font-mono text-slate-700 dark:text-slate-300 shadow-inner">${obj.text || ''}</pre>`;
    document.getElementById('modalContent').innerHTML = h;
    document.getElementById('modalLihat').classList.remove('hidden');
};


// ─── CARI TOKO ───────────────────────────────
async function doSearchToko() {
    const q   = document.getElementById('inputSearchToko').value.trim().toLowerCase();
    const box = document.getElementById('resultToko');

    if (!q || q.length < 3) {
        box.innerHTML = '<p class="text-center text-sm text-amber-500 py-4 font-bold bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200"> Masukkan minimal 3 karakter</p>';
        return;
    }
    box.innerHTML = '<div class="flex justify-center py-8"><span class="animate-spin text-3xl text-emerald-500"></span></div>';
    catatAktivitas('Pencarian Toko', q);

    try {
        if (!dbTokoLokal) {
            const res = await fetch('https://raw.githubusercontent.com/Marsudi505/toko-idm/main/toko.json');
            dbTokoLokal = await res.json();
        }
        const results = dbTokoLokal.filter(t =>
            (t.storeCode && t.storeCode.toLowerCase().includes(q)) ||
            (t.storeName && t.storeName.toLowerCase().includes(q)) ||
            (t.address   && t.address.toLowerCase().includes(q))
        ).slice(0, 15);

        if (!results.length) {
            box.innerHTML = '<p class="text-center text-sm text-slate-500 py-6 font-bold">Data toko tidak ditemukan di sistem.</p>';
            return;
        }
        box.innerHTML = '';
        results.forEach(t => renderTokoCard(box, t));
    } catch {
        box.innerHTML = '<p class="text-center text-sm text-red-500 py-6 font-bold">Gagal sinkronisasi dengan GitHub.</p>';
    }
}

async function cariTokoTerdekat() {
    const box = document.getElementById('resultToko');
    if (!navigator.geolocation) {
        box.innerHTML = '<p class="text-center text-sm text-red-500 py-4 font-bold bg-red-50 rounded-xl">GPS tidak didukung di browser Anda.</p>';
        return;
    }
    box.innerHTML = '<div class="flex flex-col items-center py-8"><span class="animate-bounce text-3xl mb-2"></span><p class="text-xs font-bold text-emerald-600 animate-pulse">Melacak lokasi Anda...</p></div>';

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const uLat = pos.coords.latitude;
        const uLon = pos.coords.longitude;
        catatAktivitas('Cari Toko Terdekat', `Titik GPS User: ${uLat.toFixed(3)}, ${uLon.toFixed(3)}`);

        try {
            if (!dbTokoLokal) {
                const res = await fetch('https://raw.githubusercontent.com/Marsudi505/toko-idm/main/toko.json');
                dbTokoLokal = await res.json();
            }
            let withDist = [];
            dbTokoLokal.forEach(t => {
                if (t.latitude && t.longitude) {
                    const d = hitungJarak(uLat, uLon, parseFloat(t.latitude), parseFloat(t.longitude));
                    if (d <= 10) withDist.push({ ...t, jarakAsli: d });
                }
            });
            withDist.sort((a, b) => a.jarakAsli - b.jarakAsli);
            const results = withDist.slice(0, 15);

            if (!results.length) {
                box.innerHTML = '<p class="text-center text-sm text-amber-500 py-6 font-bold bg-amber-50 rounded-xl">Tidak ada toko dalam radius 10 KM.</p>';
                return;
            }
            box.innerHTML = `<div class="mb-3 text-center"><span class="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full shadow-sm border border-emerald-200">DITEMUKAN ${results.length} TOKO TERDEKAT (MAX 10 KM)</span></div>`;
            results.forEach(t => renderTokoCard(box, t, t.jarakAsli));
        } catch {
            box.innerHTML = '<p class="text-center text-sm text-red-500 py-6 font-bold">Gagal menghitung data jarak toko.</p>';
        }
    }, (err) => {
        const msg = err.code === 1 ? 'Izin akses GPS / Lokasi ditolak oleh Browser Anda.' : 'Gagal mendapatkan lokasi GPS Anda.';
        box.innerHTML = `<p class="text-center text-sm text-red-500 py-4 font-bold bg-red-50 rounded-xl">${msg}</p>`;
    }, { enableHighAccuracy: true });
}

function renderTokoCard(container, t, jarakAsli = null) {
    const isBuka     = t.operational === true;
    const isCoverage = t.inCoverage === true;
    const jarakBadge = jarakAsli !== null
        ? `<span class="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded border border-amber-200"> ${jarakAsli.toFixed(1)} KM</span>`
        : '';

    container.innerHTML += `
    <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 hover:border-emerald-500 hover:shadow-emerald-500/20 transition-all group relative overflow-hidden">
        <div class="absolute right-0 top-0 w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-[100px] z-0"></div>
        <div class="flex justify-between items-start mb-3 relative z-10">
            <div>
                <h4 class="font-black text-slate-800 dark:text-white text-[15px] leading-tight group-hover:text-emerald-600 transition">${t.storeName}</h4>
                <div class="flex space-x-2 mt-2 items-center flex-wrap gap-y-1">
                    <span class="text-[9px] font-mono font-black bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">ID: ${t.storeCode || '-'}</span>
                    <span class="text-[9px] font-mono font-black bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">DC: ${t.dcCode || '-'}</span>
                    ${jarakBadge}
                </div>
            </div>
            <span class="text-[9px] ${isBuka ? 'bg-emerald-500 text-white shadow-emerald-500/40' : 'bg-red-500 text-white shadow-red-500/40'} font-black px-2.5 py-1.5 rounded-full shadow-md tracking-wider">
                ${isBuka ? 'ONLINE' : 'OFFLINE'}
            </span>
        </div>
        <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-4 leading-relaxed relative z-10">${t.address}</p>
        <div class="grid grid-cols-2 gap-2 mb-4 relative z-10">
            <div class="bg-slate-50 dark:bg-[#0f172a] p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                <span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tipe Toko</span>
                <span class="block text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">${t.storeType || 'Reguler'}</span>
            </div>
            <div class="bg-slate-50 dark:bg-[#0f172a] p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                <span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Layanan Antar</span>
                <span class="block text-[10px] font-bold ${isCoverage ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}">${isCoverage ? 'Tersedia (Coverage)' : 'Tidak Tersedia'}</span>
            </div>
        </div>
        <div class="flex justify-between items-center mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/50 relative z-10">
            <div class="flex flex-col">
                <div class="text-[10px] font-bold text-slate-500 mb-0.5"> <span class="text-slate-800 dark:text-slate-200">${t.openingHour || '?'} - ${t.closingHour || '?'}</span></div>
                ${(t.latitude && t.longitude) ? `<span class="text-[8px] font-mono text-slate-400"> ${t.latitude}, ${t.longitude}</span>` : ''}
            </div>
            ${t.googleMaps ? `<a href="${t.googleMaps}" target="_blank" class="bg-white text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 text-[10px] font-black py-1.5 px-4 rounded-full shadow-sm transition duration-300">BUKA MAPS</a>` : ''}
        </div>
    </div>`;
}


// ─── SCANNER (QR/BARCODE) ─────────────────────
let html5QrcodeScanner = null;
let isCameraOpen = false;

function toggleScanner() {
    const camArea = document.getElementById('cameraArea');
    if (isCameraOpen) {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.stop().then(() => { html5QrcodeScanner.clear(); html5QrcodeScanner = null; });
        }
        camArea.classList.add('hidden');
        isCameraOpen = false;
    } else {
        camArea.classList.remove('hidden');
        html5QrcodeScanner = new Html5Qrcode('reader');
        html5QrcodeScanner.start(
            { facingMode: 'environment' },
            { fps: 15, qrbox: { width: 250, height: 100 } },
            (decoded) => { document.getElementById('inputSearchProd').value = decoded; toggleScanner(); doSearchProd(); },
            () => {}
        ).catch(() => { alert('Kamera ditolak browser.'); camArea.classList.add('hidden'); });
        isCameraOpen = true;
    }
}


// ─── CARI BARANG ─────────────────────────────
async function doSearchProd() {
    const q    = document.getElementById('inputSearchProd').value.trim().toLowerCase();
    const grid = document.getElementById('resultGrid');
    if (!q) return;

    grid.innerHTML = '<div class="col-span-2 flex flex-col items-center justify-center py-10"><div class="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3"></div><p class="text-xs font-bold text-purple-600 animate-pulse">Mencari di Database...</p></div>';
    catatAktivitas('Pencarian Barang', q);

    try {
        if (!dbBarcodeLokal) {
            const res = await fetch('https://raw.githubusercontent.com/Marsudi505/Barcodes/main/barcodesheet.json');
            dbBarcodeLokal = await res.json();
        }
        const results = dbBarcodeLokal.filter(item =>
            (item.plu     && String(item.plu).toLowerCase().includes(q)) ||
            (item.barcode && String(item.barcode).toLowerCase().includes(q)) ||
            (item.nama    && String(item.nama).toLowerCase().includes(q))
        ).slice(0, 20);

        if (!results.length) {
            grid.innerHTML = '<div class="col-span-2 text-center py-10 bg-slate-100 dark:bg-slate-800 rounded-2xl"><span class="text-3xl mb-2 block"></span><p class="text-sm font-bold text-slate-500">Item tidak ada di database inti.</p></div>';
            return;
        }
        grid.innerHTML = '';
        results.forEach(item => {
            const pluStr = String(item.plu).trim();
            const imgUrl = `https://raw.githubusercontent.com/Marsudi505/katalog-klik/main/${pluStr}.jpg`;
            const nama   = item.nama || 'Nama Item Unknown';
            grid.innerHTML += `
            <div onclick='showDetailProduct(${JSON.stringify(item).replace(/'/g, "&#39;")})' class="bg-white dark:bg-[#1e293b] rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-purple-500 hover:shadow-purple-500/20 transition-all transform hover:-translate-y-1 overflow-hidden relative group">
                <div class="h-28 bg-slate-50 dark:bg-slate-800 flex justify-center items-center p-2 border-b border-slate-100 dark:border-slate-700">
                    <img src="${imgUrl}" class="max-h-full max-w-full object-contain filter drop-shadow group-hover:scale-110 transition duration-300" onerror="this.src='https://via.placeholder.com/150?text=No+Img'">
                </div>
                <div class="p-3 flex flex-col h-24">
                    <h4 class="text-[11px] font-black leading-tight text-slate-700 dark:text-slate-200 mb-1 line-clamp-3">${nama}</h4>
                    <div class="mt-auto flex justify-between items-center">
                        <p class="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">PLU: ${pluStr}</p>
                        <span class="text-[10px] text-purple-500 font-black">Cek Rak →</span>
                    </div>
                </div>
            </div>`;
        });
    } catch {
        grid.innerHTML = '<p class="col-span-2 text-center text-red-500 text-sm py-4 font-bold bg-red-50 rounded-xl">Gagal sinkronisasi data katalog.</p>';
    }
}

window.showDetailProduct = function (item) {
    const pluStr = String(item.plu).trim();
    document.getElementById('modProdName').innerText = item.nama || 'Nama Item Unknown';
    document.getElementById('modProdPlu').innerText  = pluStr;
    document.getElementById('modProdImg').src        = `https://raw.githubusercontent.com/Marsudi505/katalog-klik/main/${pluStr}.jpg`;

    if (item.barcode && item.barcode !== '') {
        document.getElementById('modProdBarcodeTxt').innerText  = item.barcode;
        document.getElementById('modProdBarcodeImg').src        = `https://barcode.tec-it.com/barcode.ashx?data=${item.barcode}&code=Code128&translate-esc=on`;
        document.getElementById('modProdBarcodeImg').style.display = 'block';
    } else {
        document.getElementById('modProdBarcodeTxt').innerText  = '-';
        document.getElementById('modProdBarcodeImg').style.display = 'none';
    }

    let dRak = null;
    if (dbRakLokal) {
        const key = Object.keys(dbRakLokal).find(k => k === pluStr || parseInt(k, 10) === parseInt(pluStr, 10));
        if (key) dRak = dbRakLokal[key];
    }

    document.getElementById('txtRak').innerText      = (dRak && dRak.rak && dRak.rak !== '-') ? dRak.rak : 'KOSONG';
    document.getElementById('txtShelving').innerText = dRak && dRak.shelving ? dRak.shelving : '-';
    document.getElementById('txtUrutan').innerText   = dRak && dRak.urutan  ? dRak.urutan  : '-';
    document.getElementById('txtRetur').innerText    = (dRak && dRak.retur && dRak.retur !== '-') ? dRak.retur : 'Aman (Tidak Ada Info)';

    document.getElementById('areaSearch').classList.add('hidden');
    document.getElementById('areaDetail').classList.remove('hidden');
    window.scrollTo(0, 0);
    catatAktivitas('Membuka Detail Rak Produk', pluStr);
};

window.closeDetail = function () {
    document.getElementById('areaDetail').classList.add('hidden');
    document.getElementById('areaSearch').classList.remove('hidden');
};


// ─── ADMIN PANEL ─────────────────────────────
window.switchAdminTab = function (tab) {
    const active   = 'bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm';
    const inactive = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition border border-slate-200 dark:border-slate-700';

    document.getElementById('adminViewTx').classList.toggle('hidden', tab !== 'transaksi');
    document.getElementById('adminViewAct').classList.toggle('hidden', tab !== 'kegiatan');
    document.getElementById('btnAdminTabTx').className  = tab === 'transaksi' ? active : inactive;
    document.getElementById('btnAdminTabAct').className = tab === 'kegiatan'  ? active : inactive;
};

async function loadAdminData() {
    try {
        const res  = await fetch('/api/admin/data');
        const data = await res.json();

        // Users table
        const uBody = document.getElementById('adminUserTable');
        uBody.innerHTML = '';
        (data.users || []).forEach(u => {
            uBody.innerHTML += `
            <tr>
                <td class="py-2 font-bold">${u.username}</td>
                <td class="text-slate-400 font-mono">${u.password}</td>
                <td>${u.role !== 'admin' ? `<button onclick="adminDelUser('${u.username}')" class="text-red-500 font-bold px-1">X</button>` : ''}</td>
            </tr>`;
        });

        const logsArray = Array.isArray(data.logs) ? data.logs : [];
        const actArray  = Array.isArray(data.activityLogs) ? data.activityLogs : [];

        // Transaksi log
        const lBody = document.getElementById('adminLogTable');
        if (lBody) {
            lBody.innerHTML = '';
            [...logsArray].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200).forEach(l => {
                const d   = new Date(l.timestamp);
                const wkt = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear().toString().slice(-2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                lBody.innerHTML += `
                <tr>
                    <td class="py-2 pl-2 text-[8px] text-slate-500 whitespace-nowrap">${wkt}</td>
                    <td class="font-bold text-emerald-600">${l.username}</td>
                    <td class="font-mono">${l.nomor}</td>
                    <td>${l.kodeToko}</td>
                    <td><button onclick='showModalLog(${JSON.stringify(l.result).replace(/'/g, "&#39;")})' class="bg-indigo-500 hover:bg-indigo-600 px-1.5 py-0.5 rounded text-white text-[9px] shadow-sm">Cek</button></td>
                </tr>`;
            });
        }

        // Aktivitas log
        const aBody = document.getElementById('adminActTable');
        if (aBody) {
            aBody.innerHTML = '';
            [...actArray].sort((a, b) => b.timestamp - a.timestamp).slice(0, 1000).forEach(a => {
                const d   = new Date(a.timestamp);
                const wkt = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear().toString().slice(-2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                aBody.innerHTML += `
                <tr>
                    <td class="py-2 pl-2 text-[8px] text-slate-500 whitespace-nowrap">${wkt}</td>
                    <td class="font-bold text-blue-600">${a.username}</td>
                    <td class="text-[9px] font-bold text-slate-700 dark:text-slate-300">${a.action}</td>
                    <td class="font-mono text-slate-500 dark:text-slate-400 truncate max-w-[100px]">${a.detail}</td>
                </tr>`;
            });
        }

        // Stats
        document.getElementById('statTotalTx').innerText  = logsArray.length;
        document.getElementById('statTotalAct').innerText = actArray.length;

        const userCounts = {};
        logsArray.forEach(l => { if (l.username) userCounts[l.username] = (userCounts[l.username] || 0) + 1; });
        actArray.forEach(a  => { if (a.username) userCounts[a.username] = (userCounts[a.username] || 0) + 1; });

        let topUser = '-', maxCount = 0;
        for (const u in userCounts) {
            if (userCounts[u] > maxCount) { maxCount = userCounts[u]; topUser = u; }
        }
        document.getElementById('statTopUser').innerText = maxCount > 0 ? `${topUser.toUpperCase()} (${maxCount} Act)` : '-';

    } catch (e) {
        console.error('Admin Load Error:', e);
    }
}

async function adminAddUser() {
    const u = document.getElementById('newUsername').value;
    const p = document.getElementById('newPassword').value;
    if (!u || !p) return;
    await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u.toLowerCase(), password: p })
    });
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    loadAdminData();
}

async function adminDelUser(u) {
    if (confirm(`Hapus user ${u}?`)) {
        await fetch('/api/admin/users/' + u, { method: 'DELETE' });
        loadAdminData();
    }
}