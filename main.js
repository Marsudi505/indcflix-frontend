/* ========================================================
   IndcHub - Web App Cari Toko & Cari Barang (Free & No Login)
   ======================================================== */

// Global State
let currentTab = "toko"; // "toko" | "barang"
let html5QrCodeScanner = null;
let isScannerOpen = false;
let currentProducts = [];
let lastSearchQuery = { toko: "", barang: "" };

// ─── UTILS: TOAST NOTIFIKASI ────────────────────────────
function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    let bg = "bg-neutral-800 text-white border-neutral-700";
    let icon = "ℹ️";

    if (type === "success") {
        bg = "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20";
        icon = "✅";
    } else if (type === "error") {
        bg = "bg-red-600 text-white border-red-500 shadow-red-500/20";
        icon = "⚠️";
    } else if (type === "warning") {
        bg = "bg-amber-600 text-white border-amber-500 shadow-amber-500/20";
        icon = "⚡";
    }

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold border pointer-events-auto toast-enter ${bg}`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.replace("toast-enter", "toast-leave");
        setTimeout(() => toast.remove(), 250);
    }, 2800);
}

// ─── SALIN TEKS KE CLIPBOARD ────────────────────────────
function salinTeks(text) {
    if (!text || text === "-" || text.trim() === "") return;
    navigator.clipboard.writeText(text.trim()).then(() => {
        showToast(`Berhasil disalin: "${text.trim()}"`, "success");
    }).catch(() => {
        showToast("Gagal menyalin teks ke clipboard.", "error");
    });
}

// ─── TAB SWITCHER ───────────────────────────────────────
function switchTab(tab, updateUrl = true) {
    currentTab = tab;
    const viewToko = document.getElementById("viewToko");
    const viewBarang = document.getElementById("viewBarang");
    const viewDetail = document.getElementById("viewDetail");
    const btnToko = document.getElementById("navBtnToko");
    const btnBarang = document.getElementById("navBtnBarang");

    // Tutup kamera jika sedang menyala saat pindah tab
    if (isScannerOpen) toggleScanner(false);

    // Tutup detail barang
    if (viewDetail) viewDetail.classList.add("hidden");

    if (tab === "barang") {
        viewToko.classList.add("hidden");
        viewBarang.classList.remove("hidden");
        btnBarang.className = "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-all tab-btn-active";
        btnToko.className = "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-all tab-btn-inactive";
        if (updateUrl) history.pushState(null, "", "/caribarang");
    } else {
        viewBarang.classList.add("hidden");
        viewToko.classList.remove("hidden");
        btnToko.className = "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-all tab-btn-active";
        btnBarang.className = "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-all tab-btn-inactive";
        if (updateUrl) history.pushState(null, "", "/caritoko");
    }
}

// ─── 1. FITUR: PENCARIAN TOKO ───────────────────────────
function quickSearchToko(q) {
    const input = document.getElementById("inputSearchToko");
    input.value = q;
    doSearchToko();
}

async function doSearchToko() {
    const input = document.getElementById("inputSearchToko");
    const q = input.value.trim();
    const box = document.getElementById("resultToko");

    if (!q || q.length < 2) {
        showToast("Ketik minimal 2 karakter untuk mencari toko.", "warning");
        input.focus();
        return;
    }

    lastSearchQuery.toko = q;
    box.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-neutral-400">
            <div class="w-9 h-9 border-3 border-orange-500/20 border-t-[#ff9000] rounded-full animate-spin mb-3"></div>
            <p class="text-xs font-semibold text-orange-400 animate-pulse">Mencari data toko...</p>
        </div>
    `;

    try {
        const res = await fetch(`/api/toko/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        const results = json.data || [];

        renderHasilToko(results, `Hasil pencarian untuk "${q}"`);
    } catch (e) {
        box.innerHTML = `
            <div class="text-center py-8 px-4 bg-red-950/20 border border-red-900/40 rounded-2xl text-red-400">
                <p class="text-xs font-bold">Gagal menghubungkan ke server toko.</p>
                <p class="text-[11px] text-neutral-500 mt-1">Silakan coba beberapa saat lagi.</p>
            </div>
        `;
    }
}

// Cari Toko Terdekat via GPS
async function cariTokoTerdekat() {
    const box = document.getElementById("resultToko");

    if (!navigator.geolocation) {
        showToast("Perangkat atau browser tidak mendukung fitur Geolocation GPS.", "error");
        return;
    }

    box.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-neutral-400">
            <div class="w-9 h-9 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
            <p class="text-xs font-semibold text-emerald-400 animate-pulse">Mendeteksi lokasi GPS Anda...</p>
        </div>
    `;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
                const res = await fetch(`/api/toko/nearby?lat=${lat}&lon=${lon}`);
                const json = await res.json();
                const results = json.data || [];
                renderHasilToko(results, "Toko Terdekat di Sekitar Anda (Radius 10 km)");
            } catch (err) {
                showToast("Gagal mengambil data toko terdekat.", "error");
            }
        },
        (error) => {
            let msg = "Akses lokasi ditolak atau GPS tidak aktif.";
            if (error.code === error.TIMEOUT) msg = "Waktu pencarian lokasi GPS habis.";
            showToast(msg, "warning");
            box.innerHTML = `
                <div class="text-center py-8 px-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl text-amber-400">
                    <p class="text-xs font-bold">${msg}</p>
                    <p class="text-[11px] text-neutral-400 mt-1">Aktifkan izin lokasi (GPS) pada browser atau gunakan pencarian manual dengan nama daerah.</p>
                </div>
            `;
        },
        { timeout: 10000, enableHighAccuracy: true }
    );
}

function renderHasilToko(results, headerTitle = "Hasil Toko") {
    const box = document.getElementById("resultToko");

    if (!results || results.length === 0) {
        box.innerHTML = `
            <div class="text-center py-10 px-4 bg-[#141414] rounded-2xl border border-neutral-800 text-neutral-400">
                <p class="text-3xl mb-2">🔍</p>
                <p class="text-sm font-bold text-neutral-300">Toko tidak ditemukan</p>
                <p class="text-xs text-neutral-500 mt-1">Coba gunakan kata kunci nama kecamatan, jalan, atau kode toko lain.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="flex justify-between items-center px-1 text-xs text-neutral-400">
            <span class="font-bold text-white">${headerTitle}</span>
            <span class="bg-neutral-800 px-2 py-0.5 rounded text-[10px] font-mono text-orange-400">${results.length} Toko</span>
        </div>
    `;

    results.forEach((t) => {
        const isBuka = t.operational !== false;
        const isCoverage = t.inCoverage === true;
        const mapsUrl = t.googleMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((t.storeName || "") + " Indomaret " + (t.address || ""))}`;
        const jarakText = t.jarakAsli !== undefined ? `${t.jarakAsli.toFixed(1)} km` : null;

        html += `
            <div class="bg-[#161616] p-4 sm:p-5 rounded-2xl border border-neutral-800 hover:border-orange-500/50 transition-all shadow-md space-y-3">
                <div class="flex justify-between items-start gap-2">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-black text-white text-base leading-tight">${t.storeName || "Indomaret"}</h3>
                            ${jarakText ? `<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">📍 ${jarakText}</span>` : ""}
                        </div>
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="bg-neutral-800 text-neutral-300 border border-neutral-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                KDTK: ${t.storeCode || "-"}
                            </span>
                            <span class="bg-orange-950/40 text-orange-400 border border-orange-800/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                DC: ${t.dcCode || "-"}
                            </span>
                        </div>
                    </div>
                    <span class="shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full ${isBuka ? bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 : bg-red-500/20 text-red-400 border border-red-500/30}">
                        ${isBuka ? "BUKA" : "TUTUP"}
                    </span>
                </div>

                <p class="text-xs text-neutral-400 leading-relaxed">${t.address || "Alamat belum tercatat"}</p>

                <div class="grid grid-cols-2 gap-2 text-[10px]">
                    <div class="bg-[#0f0f0f] p-2.5 rounded-xl border border-neutral-800/80">
                        <span class="text-neutral-500 font-bold uppercase tracking-wider block mb-0.5">Tipe Toko</span>
                        <span class="text-neutral-200 font-semibold truncate block">${t.storeType || "Reguler"}</span>
                    </div>
                    <div class="bg-[#0f0f0f] p-2.5 rounded-xl border border-neutral-800/80">
                        <span class="text-neutral-500 font-bold uppercase tracking-wider block mb-0.5">Layanan Klik / Antar</span>
                        <span class="font-semibold block ${isCoverage ? text-emerald-400 : text-neutral-400}">
                            ${isCoverage ? "✓ Tersedia (Cover)" : "✕ Tidak Cover"}
                        </span>
                    </div>
                </div>

                <div class="flex justify-between items-center pt-2 border-t border-neutral-800/70 text-xs">
                    <div class="text-[11px] text-neutral-400">
                        ⏰ <span class="text-neutral-300 font-medium">${t.openingHour || "07:00"} - ${t.closingHour || "22:00"}</span>
                    </div>
                    <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="bg-[#ff9000] hover:bg-[#ffa733] text-black font-black text-[11px] py-1.5 px-3.5 rounded-xl transition shadow active:scale-95 flex items-center gap-1">
                        <span>MAPS</span> ↗
                    </a>
                </div>
            </div>
        `;
    });

    box.innerHTML = html;
}


// ─── 2. FITUR: PENCARIAN BARANG & PLANOGRAM ─────────────
function quickSearchProd(q) {
    const input = document.getElementById("inputSearchProd");
    input.value = q;
    doSearchProd();
}

async function doSearchProd() {
    const input = document.getElementById("inputSearchProd");
    const q = input.value.trim();
    const grid = document.getElementById("resultGrid");

    if (!q || q.length < 2) {
        showToast("Ketik minimal 2 karakter untuk mencari barang.", "warning");
        input.focus();
        return;
    }

    lastSearchQuery.barang = q;
    grid.innerHTML = `
        <div class="col-span-2 flex flex-col items-center justify-center py-12 text-neutral-400">
            <div class="w-9 h-9 border-3 border-orange-500/20 border-t-[#ff9000] rounded-full animate-spin mb-3"></div>
            <p class="text-xs font-semibold text-orange-400 animate-pulse">Mencari di database katalog...</p>
        </div>
    `;

    try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        currentProducts = json.data || [];

        renderHasilBarang(currentProducts, q);
    } catch (e) {
        grid.innerHTML = `
            <div class="col-span-2 text-center py-8 px-4 bg-red-950/20 border border-red-900/40 rounded-2xl text-red-400">
                <p class="text-xs font-bold">Gagal menghubungkan ke server barang.</p>
                <p class="text-[11px] text-neutral-500 mt-1">Silakan coba beberapa saat lagi.</p>
            </div>
        `;
    }
}

function renderHasilBarang(products, q) {
    const grid = document.getElementById("resultGrid");

    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div class="col-span-2 text-center py-10 px-4 bg-[#141414] rounded-2xl border border-neutral-800 text-neutral-400">
                <p class="text-3xl mb-2">🔍</p>
                <p class="text-sm font-bold text-neutral-300">Barang tidak ditemukan</p>
                <p class="text-xs text-neutral-500 mt-1">Cek kembali ejaan nama produk, nomor PLU, atau barcode.</p>
            </div>
        `;
        return;
    }

    let html = "";
    products.forEach((item, index) => {
        const plu = String(item.plu || "").trim();
        const nama = item.nama || "Item Tanpa Nama";
        const imgUrl = item.gambar || `https://cdn-klik.klikindomaret.com/klik-catalog/product/${plu}_1.jpg`;
        const fallbackImg = `https://raw.githubusercontent.com/Marsudi505/katalog-klik/main/${plu}.jpg`;
        const kodeRak = item.rakData && item.rakData.rak && item.rakData.rak !== "-" ? item.rakData.rak : null;

        html += `
            <div onclick="showDetailByIndex(${index})" class="bg-[#161616] rounded-2xl border border-neutral-800 hover:border-orange-500/60 transition-all cursor-pointer shadow-md overflow-hidden flex flex-col group active:scale-[0.98]">
                <div class="h-32 bg-[#0e0e0e] flex items-center justify-center p-3 relative border-b border-neutral-800/80">
                    <img src="${imgUrl}" alt="${nama}" class="max-h-full max-w-full object-contain filter drop-shadow group-hover:scale-105 transition duration-200" onerror="if(this.src!==) this.src=; else this.src=https://via.placeholder.com/150/161616/ff9000?text=No+Img;">
                    ${kodeRak ? `<span class="absolute bottom-2 right-2 bg-orange-500 text-black text-[9px] font-black font-mono px-2 py-0.5 rounded shadow">RAK ${kodeRak}</span>` : ""}
                </div>

                <div class="p-3 flex flex-col flex-1 justify-between gap-2">
                    <h4 class="text-xs font-bold text-neutral-200 line-clamp-2 leading-tight group-hover:text-orange-400 transition">
                        ${nama}
                    </h4>

                    <div class="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-[10px]">
                        <span class="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono font-bold">
                            ${plu}
                        </span>
                        <span class="text-orange-400 font-bold group-hover:translate-x-0.5 transition flex items-center">
                            Cek Rak →
                        </span>
                    </div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// ─── 3. DETAIL PRODUK & PLANOGRAM ───────────────────────
function showDetailByIndex(index) {
    const item = currentProducts[index];
    if (!item) return;
    showProductDetail(item);
}

function showProductDetail(item) {
    const viewBarang = document.getElementById("viewBarang");
    const viewDetail = document.getElementById("viewDetail");

    const plu = String(item.plu || "").trim();
    const nama = item.nama || "Nama Item Tidak Diketahui";
    const imgUrl = item.gambar || `https://cdn-klik.klikindomaret.com/klik-catalog/product/${plu}_1.jpg`;
    const fallbackImg = `https://raw.githubusercontent.com/Marsudi505/katalog-klik/main/${plu}.jpg`;

    document.getElementById("detailProdName").innerText = nama;
    document.getElementById("detailProdPlu").innerText = plu;

    const imgEl = document.getElementById("detailProdImg");
    imgEl.src = imgUrl;
    imgEl.onerror = () => {
        if (imgEl.src !== fallbackImg) imgEl.src = fallbackImg;
        else imgEl.src = "https://via.placeholder.com/250/161616/ff9000?text=Gambar+Offline";
    };

    // Planogram Rak
    const rak = item.rakData || {};
    document.getElementById("txtRak").innerText = rak.rak && rak.rak !== "-" ? rak.rak : "TIDAK ADA";
    document.getElementById("txtShelving").innerText = rak.shelving || "-";
    document.getElementById("txtUrutan").innerText = rak.urutan || "-";
    document.getElementById("txtRetur").innerText = rak.retur && rak.retur !== "-" ? rak.retur : "Aman (Tidak Ada Catatan Retur Khusus)";

    // Barcode
    const barcode = item.barcode || "";
    const bcImg = document.getElementById("detailBarcodeImg");
    const bcTxt = document.getElementById("detailBarcodeTxt");

    if (barcode && barcode !== "") {
        bcTxt.innerText = barcode;
        bcImg.src = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=Code128&translate-esc=on`;
        bcImg.parentElement.classList.remove("hidden");
    } else {
        bcTxt.innerText = "Barcode Belum Terdaftar";
        bcImg.parentElement.classList.add("hidden");
    }

    viewBarang.classList.add("hidden");
    viewDetail.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeDetail() {
    const viewBarang = document.getElementById("viewBarang");
    const viewDetail = document.getElementById("viewDetail");
    if (viewDetail) viewDetail.classList.add("hidden");
    if (viewBarang) viewBarang.classList.remove("hidden");
}

// ─── 4. KAMERA SCANNER BARCODE ──────────────────────────
function toggleScanner(forceState) {
    const camArea = document.getElementById("cameraArea");
    const targetState = forceState !== undefined ? forceState : !isScannerOpen;

    if (!targetState) {
        // Matikan scanner
        if (html5QrCodeScanner) {
            html5QrCodeScanner.stop().then(() => {
                html5QrCodeScanner.clear();
            }).catch(() => {});
        }
        camArea.classList.add("hidden");
        isScannerOpen = false;
    } else {
        // Nyalakan scanner
        camArea.classList.remove("hidden");
        html5QrCodeScanner = new Html5Qrcode("reader");

        html5QrCodeScanner.start(
            { facingMode: "environment" },
            { fps: 15, qrbox: { width: 250, height: 120 } },
            (decodedText) => {
                document.getElementById("inputSearchProd").value = decodedText;
                showToast(`Barcode terdeteksi: ${decodedText}`, "success");
                toggleScanner(false);
                doSearchProd();
            },
            (err) => {}
        ).catch((err) => {
            showToast("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.", "error");
            camArea.classList.add("hidden");
            isScannerOpen = false;
        });

        isScannerOpen = true;
    }
}

// ─── KEYBOARD SHORTCUTS ─────────────────────────────────
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (isScannerOpen) toggleScanner(false);
        closeDetail();
    }
});

// ─── INISIALISASI ROUTING & LOAD ────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("barang") || path.includes("plu")) {
        switchTab("barang", false);
    } else {
        switchTab("toko", false);
    }
});
