// --- Inisialisasi Aplikasi ---
// Kunci untuk localStorage
const APP_KEY = 'fokusMasaDepanDB';

// State global aplikasi (Database)
let db = {
    saldo: 0,
    dream: {
        title: 'Membeli Motor Baru',
        targetAmount: 10000000,
        targetDate: '2026-12-31'
    },
    settings: {
        limitBulanan: 2000000,
        motivasi: {
            kuning: 'Hati-hati, pengeluaranmu banyak!',
            merah: 'STOP! Kamu sudah boros!'
        },
        kategori: [
            '🍔 Makanan',
            '🚌 Transportasi',
            '💡 Tagihan',
            '🏠 Sewa/Cicilan',
            '🎬 Hiburan',
            '👕 Belanja',
            'Lainnya'
        ],
        notifikasi: {
            aktif: false,
            waktu: '09:00'
        }
    },
    transactions: []
};

let currentTxType = 'pengeluaran';
let myAnalysisChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadDB();
    populateCategorySelects();
    renderDashboard();
    navigateTo('page-dashboard');
    const txDate = document.getElementById('form-tx-tanggal');
    if (txDate) txDate.value = getISODate(new Date());
});

// --- localStorage ---
function loadDB() {
    try {
        const data = localStorage.getItem(APP_KEY);
        if (data) {
            db = JSON.parse(data);
            if (!db.settings) db.settings = { limitBulanan: 2000000, motivasi: { kuning: 'Hati-hati!', merah: 'STOP!' }, kategori: [], notifikasi: { aktif: false, waktu: '09:00' } };
            if (!db.settings.motivasi) db.settings.motivasi = { kuning: 'Hati-hati!', merah: 'STOP!' };
            if (!db.settings.notifikasi) db.settings.notifikasi = { aktif: false, waktu: '09:00' };
            if (!Array.isArray(db.settings.kategori)) db.settings.kategori = [];
            if (!Array.isArray(db.transactions)) db.transactions = [];
        } else {
            saveDB();
        }
    } catch (e) {
        console.error('loadDB error', e);
    }
}

function saveDB() {
    try {
        localStorage.setItem(APP_KEY, JSON.stringify(db));
    } catch (error) {
        console.error("Gagal menyimpan ke localStorage:", error);
        showToast("Gagal menyimpan data. Mungkin penyimpanan penuh.", 'error');
    }
}

// --- Navigasi & Modal ---
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo(0, 0);
        if (pageId === 'page-dashboard') renderDashboard();
        if (pageId === 'page-history') renderHistoryPage();
        if (pageId === 'page-analysis') renderAnalysisPage();
        if (pageId === 'page-settings-limit') renderSettingsLimitPage();
        if (pageId === 'page-settings-kategori') renderSettingsKategoriPage();
        if (pageId === 'page-settings-motivasi') renderSettingsMotivasiPage();
        if (pageId === 'page-settings-notifikasi') renderSettingsNotifikasiPage();
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');

    if (modalId === 'modal-edit-dream') {
        document.getElementById('form-dream-title').value = db.dream.title || '';
        document.getElementById('form-dream-target').value = db.dream.targetAmount || '';
        document.getElementById('form-dream-date').value = db.dream.targetDate || '';
    } else if (modalId === 'modal-add-tx') {
        document.getElementById('form-tx-nominal').value = '';
        document.getElementById('form-tx-alasan').value = '';
        const txDate = document.getElementById('form-tx-tanggal');
        if (txDate) txDate.value = getISODate(new Date());
        switchTxType('pengeluaran');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// --- Transaksi ---
function switchTxType(type) {
    currentTxType = type;
    const tabPengeluaran = document.getElementById('tab-pengeluaran');
    const tabPemasukan = document.getElementById('tab-pemasukan');
    const kategoriGroup = document.getElementById('form-tx-kategori-group');

    if (type === 'pengeluaran') {
        if (tabPengeluaran) tabPengeluaran.className = 'flex-1 py-2 text-center font-semibold border-b-2 border-primary text-primary';
        if (tabPemasukan) tabPemasukan.className = 'flex-1 py-2 text-center font-semibold text-gray-500';
        if (kategoriGroup) kategoriGroup.style.display = 'block';
    } else {
        if (tabPemasukan) tabPemasukan.className = 'flex-1 py-2 text-center font-semibold border-b-2 border-primary text-primary';
        if (tabPengeluaran) tabPengeluaran.className = 'flex-1 py-2 text-center font-semibold text-gray-500';
        if (kategoriGroup) kategoriGroup.style.display = 'none';
    }
}

function saveTransaction() {
    const nominalEl = document.getElementById('form-tx-nominal');
    const amount = nominalEl ? parseFloat(nominalEl.value) : NaN;
    const categoryEl = document.getElementById('form-tx-kategori');
    const category = (currentTxType === 'pengeluaran') ? (categoryEl ? categoryEl.value : 'Lainnya') : 'Pemasukan';
    const note = (document.getElementById('form-tx-alasan') || {}).value || '';
    const date = (document.getElementById('form-tx-tanggal') || {}).value || '';

    if (!amount || amount <= 0 || isNaN(amount)) {
        showToast("Nominal harus diisi dan lebih dari 0", 'error');
        return;
    }
    if (!date) {
        showToast("Tanggal harus diisi", 'error');
        return;
    }

    const newTx = {
        id: Date.now().toString(),
        type: currentTxType,
        amount: amount,
        category: category,
        note: note,
        date: date
    };

    db.transactions.push(newTx);
    db.saldo = (db.saldo || 0) + (currentTxType === 'pemasukan' ? amount : -amount);

    saveDB();
    hideModal('modal-add-tx');
    showToast("Transaksi berhasil disimpan!", 'success');
    renderDashboard();
}

// --- History ---
function renderHistoryPage() {
    const filterEl = document.getElementById('history-filter-time');
    const filter = filterEl ? filterEl.value : 'month';
    const filteredTx = filterTransactions(db.transactions, filter).slice();

    const listEl = document.getElementById('history-full-list');
    const totalInEl = document.getElementById('hist-total-in');
    const totalOutEl = document.getElementById('hist-total-out');

    let totalIn = 0;
    let totalOut = 0;
    let html = '';

    filteredTx.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredTx.length === 0) {
        if (listEl) listEl.innerHTML = '<p class="text-center text-gray-500 py-8">Tidak ada transaksi untuk periode ini.</p>';
    } else {
        filteredTx.forEach(tx => {
            let amountHtml = '';
            if (tx.type === 'pemasukan') {
                totalIn += tx.amount;
                amountHtml = `<span class="font-bold text-success">+${formatRupiah(tx.amount)}</span>`;
            } else {
                totalOut += tx.amount;
                amountHtml = `<span class="font-bold text-danger">-${formatRupiah(tx.amount)}</span>`;
            }

            html += `
                <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-gray-800">${tx.category}</p>
                            <p class="text-sm text-gray-500">${tx.note || formatDate(tx.date)}</p>
                        </div>
                        <div class="text-right">
                            ${amountHtml}
                            <p class="text-xs text-gray-400">${tx.note ? formatDate(tx.date) : ''}</p>
                        </div>
                    </div>
                </div>
            `;
        });
        if (listEl) listEl.innerHTML = html;
    }

    if (totalInEl) totalInEl.textContent = formatRupiah(totalIn);
    if (totalOutEl) totalOutEl.textContent = formatRupiah(totalOut);
}

// --- Analysis ---
function renderAnalysisPage() {
    const filterEl = document.getElementById('analysis-filter-time');
    const filter = filterEl ? filterEl.value : 'month';
    const allPengeluaran = (db.transactions || []).filter(tx => tx.type === 'pengeluaran');
    const filteredTx = filterTransactions(allPengeluaran, filter);

    const limit = db.settings.limitBulanan || 0;
    const terpakai = filteredTx.reduce((s, tx) => s + tx.amount, 0);
    const sisa = limit - terpakai;

    const limitEl = document.getElementById('analysis-limit');
    const terpakaiEl = document.getElementById('analysis-terpakai');
    const sisaEl = document.getElementById('analysis-sisa');

    if (limitEl) limitEl.textContent = formatRupiah(limit);
    if (terpakaiEl) terpakaiEl.textContent = formatRupiah(terpakai);
    if (sisaEl) sisaEl.textContent = formatRupiah(sisa);

    const spendingByCategory = filteredTx.reduce((acc, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
        return acc;
    }, {});

    const labels = Object.keys(spendingByCategory);
    const data = Object.values(spendingByCategory);

    const canvas = document.getElementById('analysis-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (myAnalysisChart) myAnalysisChart.destroy();

    if (labels.length > 0) {
        myAnalysisChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pengeluaran per Kategori',
                    data: data,
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6',
                        '#ec4899', '#f97316', '#06b6d4', '#14b8a6', '#65a30d'
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 10 } } }
                }
            }
        });
    } else {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText('Tidak ada data pengeluaran', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

// --- Settings ---
function renderSettingsLimitPage() {
    const el = document.getElementById('setting-limit-bulanan');
    if (el) el.value = db.settings.limitBulanan || 0;
}

function saveSettingsLimit() {
    const el = document.getElementById('setting-limit-bulanan');
    const limit = el ? parseFloat(el.value) : NaN;
    if (!isNaN(limit) && limit >= 0) {
        db.settings.limitBulanan = limit;
        saveDB();
        showToast("Limit berhasil disimpan!", 'success');
        navigateTo('page-settings');
    } else {
        showToast("Limit tidak valid", 'error');
    }
}

function renderSettingsKategoriPage() {
    const listEl = document.getElementById('settings-kategori-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    (db.settings.kategori || []).forEach((kategori, index) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-3 bg-gray-100 rounded-lg';
        div.innerHTML = `<span class="text-gray-800">${kategori}</span><button data-index="${index}" class="text-red-500 hover:text-red-700 font-medium">Hapus</button>`;
        listEl.appendChild(div);
        div.querySelector('button').addEventListener('click', () => deleteCategory(index));
    });
}

function addCategory() {
    const inputEl = document.getElementById('setting-kategori-baru');
    if (!inputEl) return;
    const newKategori = inputEl.value.trim();
    if (newKategori) {
        db.settings.kategori = db.settings.kategori || [];
        db.settings.kategori.push(newKategori);
        saveDB();
        renderSettingsKategoriPage();
        populateCategorySelects();
        inputEl.value = '';
        showToast("Kategori ditambahkan!", 'success');
    }
}

function deleteCategory(index) {
    const kategori = db.settings.kategori[index];
    showToast(`Kategori "${kategori}" dihapus.`);
    db.settings.kategori.splice(index, 1);
    saveDB();
    renderSettingsKategoriPage();
    populateCategorySelects();
}

function renderSettingsMotivasiPage() {
    document.getElementById('setting-motivasi-kuning').value = (db.settings.motivasi && db.settings.motivasi.kuning) || '';
    document.getElementById('setting-motivasi-merah').value = (db.settings.motivasi && db.settings.motivasi.merah) || '';
}

function saveSettingsMotivasi() {
    db.settings.motivasi = db.settings.motivasi || {};
    db.settings.motivasi.kuning = document.getElementById('setting-motivasi-kuning').value;
    db.settings.motivasi.merah = document.getElementById('setting-motivasi-merah').value;
    saveDB();
    showToast("Motivasi berhasil disimpan!", 'success');
    navigateTo('page-settings');
}

function renderSettingsNotifikasiPage() {
    document.getElementById('setting-notif-aktif').checked = !!(db.settings.notifikasi && db.settings.notifikasi.aktif);
    document.getElementById('setting-notif-waktu').value = (db.settings.notifikasi && db.settings.notifikasi.waktu) || '09:00';
}

function saveSettingsNotifikasi() {
    db.settings.notifikasi = db.settings.notifikasi || {};
    db.settings.notifikasi.aktif = !!document.getElementById('setting-notif-aktif').checked;
    db.settings.notifikasi.waktu = document.getElementById('setting-notif-waktu').value;
    saveDB();
    showToast("Pengaturan notifikasi disimpan!", 'success');
    navigateTo('page-settings');
}

// --- Dream ---
function saveDream() {
    const title = document.getElementById('form-dream-title').value;
    const targetAmount = parseFloat(document.getElementById('form-dream-target').value);
    const targetDate = document.getElementById('form-dream-date').value;

    if (!title || !targetAmount || !targetDate) {
        showToast("Semua field impian harus diisi", 'error');
        return;
    }

    db.dream.title = title;
    db.dream.targetAmount = targetAmount;
    db.dream.targetDate = targetDate;

    saveDB();
    hideModal('modal-edit-dream');
    showToast("Impian berhasil disimpan!", 'success');
    renderDashboard();
}

// --- Render Dashboard ---
function renderDashboard() {
    const dashSaldo = document.getElementById('dash-saldo');
    if (dashSaldo) dashSaldo.textContent = formatRupiah(db.saldo || 0);

    const { title, targetAmount, targetDate } = db.dream || {};
    const progress = targetAmount ? ((db.saldo || 0) / targetAmount) * 100 : 0;
    const progressPercent = Math.min(Math.max(progress, 0), 100);

    const elTitle = document.getElementById('dash-dream-title');
    const elTargetAmount = document.getElementById('dash-dream-target-amount');
    const elTargetDate = document.getElementById('dash-dream-target-date');
    const elProgress = document.getElementById('dash-dream-progress');
    const elProgressPercent = document.getElementById('dash-dream-progress-percent');

    if (elTitle) elTitle.textContent = title || 'Atur Impian Anda!';
    if (elTargetAmount) elTargetAmount.textContent = formatRupiah(targetAmount || 0);
    if (elTargetDate) elTargetDate.textContent = formatDate(targetDate || '-');
    if (elProgress) elProgress.style.width = `${progressPercent}%`;
    if (elProgressPercent) elProgressPercent.textContent = `${progressPercent.toFixed(1)}%`;

    const limit = db.settings.limitBulanan || 0;
    const pengeluaranBulanIni = filterTransactions((db.transactions || []).filter(tx => tx.type === 'pengeluaran'), 'month').reduce((s, t) => s + t.amount, 0);
    const sisa = limit - pengeluaranBulanIni;
    const sisaPercent = limit ? ((sisa / limit) * 100) : 100;

    const dashLimitEl = document.getElementById('dash-budget-limit');
    const dashSisaEl = document.getElementById('dash-budget-sisa');
    const indicatorEl = document.getElementById('dash-budget-indicator');
    const warningEl = document.getElementById('dash-budget-warning');

    if (dashLimitEl) dashLimitEl.textContent = formatRupiah(limit);
    if (dashSisaEl) dashSisaEl.textContent = formatRupiah(sisa);

    if (indicatorEl && warningEl) {
        if (sisaPercent > 40) {
            indicatorEl.className = 'px-3 py-1 rounded-full text-sm font-semibold text-white bg-success';
            indicatorEl.textContent = 'Aman';
            warningEl.textContent = '';
        } else if (sisaPercent > 10) {
            indicatorEl.className = 'px-3 py-1 rounded-full text-sm font-semibold text-white bg-warning';
            indicatorEl.textContent = 'Hati-hati';
            warningEl.textContent = db.settings.motivasi.kuning;
        } else {
            indicatorEl.className = 'px-3 py-1 rounded-full text-sm font-semibold text-white bg-danger';
            indicatorEl.textContent = 'Bahaya';
            warningEl.textContent = db.settings.motivasi.merah;
        }
    }

    const listEl = document.getElementById('dash-history-list');
    const recentTx = (db.transactions || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (listEl) {
        if (recentTx.length === 0) {
            listEl.innerHTML = '<p class="text-center text-gray-500 py-4">Belum ada transaksi.</p>';
        } else {
            let html = '';
            recentTx.forEach(tx => {
                const amountHtml = tx.type === 'pemasukan'
                    ? `<span class="font-bold text-success">+${formatRupiah(tx.amount)}</span>`
                    : `<span class="font-bold text-danger">-${formatRupiah(tx.amount)}</span>`;

                html += `
                    <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                        <div>
                            <p class="font-semibold text-gray-800">${tx.category}</p>
                            <p class="text-sm text-gray-500">${formatDate(tx.date)}</p>
                        </div>
                        ${amountHtml}
                    </div>
                `;
            });
            listEl.innerHTML = html;
        }
    }
}

// --- Helpers ---
function formatRupiah(number) {
    if (isNaN(number)) number = 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(number);
}

function formatDate(dateString, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
    try {
        const date = new Date(dateString + 'T00:00:00');
        return new Intl.DateTimeFormat('id-ID', options).format(date);
    } catch (e) {
        return dateString;
    }
}

function getISODate(date) {
    return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
}

function populateCategorySelects() {
    const selectEl = document.getElementById('form-tx-kategori');
    if (!selectEl) return;
    selectEl.innerHTML = '';
    (db.settings.kategori || []).forEach(kategori => {
        const option = document.createElement('option');
        option.value = kategori;
        option.textContent = kategori;
        selectEl.appendChild(option);
    });
}

function filterTransactions(transactions, filter) {
    const now = new Date();
    const today = getISODate(now);

    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeek = getISODate(firstDayOfWeek);

    const startOfMonth = getISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const startOfYear = getISODate(new Date(now.getFullYear(), 0, 1));

    switch (filter) {
        case 'today':
            return transactions.filter(tx => tx.date === today);
        case 'week':
            return transactions.filter(tx => tx.date >= startOfWeek && tx.date <= today);
        case 'month':
            return transactions.filter(tx => tx.date >= startOfMonth && tx.date <= today);
        case 'year':
            return transactions.filter(tx => tx.date >= startOfYear && tx.date <= today);
        case 'all':
        default:
            return transactions;
    }
}

function showToast(message, type = 'default') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;

    if (type === 'success') toast.style.backgroundColor = '#22c55e';
    else if (type === 'error') toast.style.backgroundColor = '#ef4444';
    else toast.style.backgroundColor = '#333';

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
            }
