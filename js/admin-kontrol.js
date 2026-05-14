const AdminControlConfig = {
    saatlik: 'https://script.google.com/macros/s/AKfycbzaIRgb1ip6MwKh05rs1xYsSPjAXXQDiQYRUX-qm1cneDDoTBNG3xN27ayT8m21r5vUhg/exec',
    motor: 'https://script.google.com/macros/s/AKfycbwb_wqukKlsGx5JdPx0eESVAfgxHvMIjUCFZneGEgIXcAf6XwSbXFGN10s0Ei54_LwSVA/exec',
    enerji: 'https://script.google.com/macros/s/AKfycbyCPe9cugO5Njv4L52AUnttuOwTcC_FFG46QCOnLoHuXTsEtM5eULNF-TrmtvGa3ppFMA/exec',
    vardiya: 'https://script.google.com/macros/s/AKfycbxnCKSZtDelL04-ZQY3yx_ePSCK9Qy9R0WgFwtsFXj_B6HayfmwM8i_HYU-AAUETleSRA/exec',
    bildirim: 'https://script.google.com/macros/s/AKfycbyjW5gbtw0BRHjDlmeLYmaio0UQWw8DG1B89X85BYwI-dw4YqaTuEPYilmv6B_xrXDmTA/exec'
};

document.addEventListener('DOMContentLoaded', function() {
    if (!requireAdmin()) return;
    document.getElementById('refreshDashboardBtn').addEventListener('click', loadDashboard);
    document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
    loadDashboard();
    renderLogs();
});

function requireAdmin() {
    const user = getCurrentUser();
    if (!user) {
        location.href = 'anasayfa.html';
        return false;
    }

    if (user.role !== 'admin') {
        document.body.innerHTML = `
            <div class="admin-shell">
                <section class="panel">
                    <h1>Yetki Gerekli</h1>
                    <p>Bu sayfa sadece admin kullanıcılar içindir.</p>
                    <a class="btn ghost" href="anasayfa.html">Ana Sayfa</a>
                </section>
            </div>`;
        return false;
    }

    document.getElementById('adminUserName').textContent = getUserName(user);
    return true;
}

async function loadDashboard() {
    const statusGrid = document.getElementById('statusGrid');
    const checkList = document.getElementById('missingCheckList');
    statusGrid.innerHTML = loadingCard();
    checkList.innerHTML = '<div class="empty">Kontroller çalışıyor...</div>';

    const [saatlik, motor, enerji, vardiya, bildirim] = await Promise.all([
        fetchJson(AdminControlConfig.saatlik, { action: 'getLastRecords', count: '24' }),
        fetchJson(AdminControlConfig.motor, { action: 'getLastRecords', count: '60' }),
        fetchJson(AdminControlConfig.enerji, { action: 'getLastRecords', count: '60' }),
        fetchJson(AdminControlConfig.vardiya, { action: 'getLastRecordsWithIslemler', count: '12' }),
        fetchJson(AdminControlConfig.bildirim, { action: 'getAnnouncements', active: 'true' })
    ]);

    const checks = [
        buildSaatlikCheck(saatlik),
        buildMotorCheck(motor, 'Kojen Motor'),
        buildMotorCheck(enerji, 'Kojen Enerji'),
        buildVardiyaCheck(vardiya),
        buildBildirimCheck(bildirim)
    ];
    const qualityChecks = buildQualityChecks(saatlik, motor, enerji);

    statusGrid.innerHTML = checks.map(renderStatusCard).join('');
    checkList.innerHTML = checks.concat(qualityChecks).map(renderCheckItem).join('');

    window.SystemAuditLog?.write?.('Merkezi kontrol yenilendi', `${checks.length} baslik kontrol edildi`, checks.some(item => item.level === 'danger') ? 'warn' : 'ok');
    await renderLogs();
}

async function fetchJson(baseUrl, params) {
    try {
        const url = new URL(baseUrl);
        Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));
        const response = await fetch(url);
        const result = await response.json();
        if (!result.success) {
            return { success: false, error: result.error || 'Servis hatasi' };
        }
        return result;
    } catch (error) {
        return { success: false, error: error.message || String(error) };
    }
}

function buildSaatlikCheck(result) {
    if (!result.success) return makeCheck('Saatlik Veri', 'Hata', result.error, 'danger');
    const records = Array.isArray(result.data) ? result.data : [];
    const slot = getExpectedSlot();
    const exists = records.some(record => matchesDate(record.tarih, slot.trDate) && record.saat === slot.hour);
    return makeCheck('Saatlik Veri', exists ? 'Tamam' : 'Kontrol Et', exists ? `${slot.trDate} ${slot.hour} kaydı mevcut` : `${slot.trDate} ${slot.hour} kaydı görünmüyor`, exists ? 'ok' : 'warn');
}

function buildMotorCheck(result, title) {
    if (!result.success) return makeCheck(title, 'Hata', result.error, 'danger');
    const records = Array.isArray(result.data) ? result.data : [];
    const slot = getExpectedSlot();
    const motors = ['GM-1', 'GM-2', 'GM-3'];
    const missing = motors.filter(motor => !records.some(record => matchesDate(record.tarih, slot.trDate) && record.saat === slot.hour && String(record.motor || '').trim() === motor));
    return makeCheck(title, missing.length ? `${missing.length} Eksik` : 'Tamam', missing.length ? `${slot.trDate} ${slot.hour}: ${missing.join(', ')}` : `${slot.trDate} ${slot.hour} kayıtları mevcut`, missing.length ? 'warn' : 'ok');
}

function buildVardiyaCheck(result) {
    if (!result.success) return makeCheck('Vardiya', 'Hata', result.error, 'danger');
    const records = Array.isArray(result.data) ? result.data : [];
    const active = records.find(record => String(record.durum || '').toLowerCase() === 'aktif');
    return makeCheck('Vardiya', active ? 'Aktif' : 'Pasif', active ? `${active.vardiya} - ${active.personel}` : 'Aktif vardiya görünmüyor', active ? 'ok' : 'warn');
}

function buildBildirimCheck(result) {
    if (!result.success) return makeCheck('Duyurular', 'Hata', result.error, 'danger');
    const records = Array.isArray(result.data) ? result.data : [];
    return makeCheck('Duyurular', `${records.length} Aktif`, records.length ? 'Aktif duyuru yayında' : 'Aktif duyuru yok', records.length ? 'ok' : 'warn');
}

function buildQualityChecks(saatlik, motor, enerji) {
    const saatlikIssues = analyzeSaatlikQuality(Array.isArray(saatlik.data) ? saatlik.data : []);
    const motorIssues = analyzeMotorQuality(Array.isArray(motor.data) ? motor.data : []);
    const enerjiIssues = analyzeEnerjiQuality(Array.isArray(enerji.data) ? enerji.data : []);

    return [
        makeCheck('Saatlik Kalite', saatlikIssues.length ? `${saatlikIssues.length} Uyari` : 'Temiz', saatlikIssues[0] || 'Son kayitlarda supheli durum yok', saatlikIssues.length ? 'warn' : 'ok'),
        makeCheck('Motor Kalite', motorIssues.length ? `${motorIssues.length} Uyari` : 'Temiz', motorIssues[0] || 'Son motor kayitlari normal', motorIssues.length ? 'warn' : 'ok'),
        makeCheck('Enerji Kalite', enerjiIssues.length ? `${enerjiIssues.length} Uyari` : 'Temiz', enerjiIssues[0] || 'Son enerji kayitlari normal', enerjiIssues.length ? 'warn' : 'ok')
    ];
}

function analyzeSaatlikQuality(records) {
    const issues = [];
    const sorted = sortRecordsAsc(records);
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (toNumber(cur.aktifMwh) < toNumber(prev.aktifMwh)) {
            issues.push(`${cur.tarih} ${cur.saat}: aktif enerji onceki kayittan dusuk`);
            break;
        }
        const prev2 = sorted[i - 2];
        if (prev2 &&
            toNumber(prev2.aktifMwh) === toNumber(prev.aktifMwh) &&
            toNumber(prev.aktifMwh) === toNumber(cur.aktifMwh) &&
            toNumber(prev2.reaktifMwh) === toNumber(prev.reaktifMwh) &&
            toNumber(prev.reaktifMwh) === toNumber(cur.reaktifMwh)) {
            issues.push(`${cur.tarih} ${cur.saat}: ayni degerler 3 kayittir tekrar ediyor`);
            break;
        }
    }
    return issues;
}

function analyzeMotorQuality(records) {
    const issues = [];
    records.slice(0, 60).forEach(record => {
        const durum = String(record.durum || '').toUpperCase();
        const values = [
            record.jenYatakSicaklikDE, record.jenYatakSicaklikNDE, record.sogutmaSuyuSicaklik,
            record.yagSicaklik, record.yagBasinc, record.sarjSicaklik,
            record.sargiSicaklik1, record.sargiSicaklik2, record.sargiSicaklik3
        ].map(toNumber);
        if (durum === 'NORMAL' && values.every(value => value === 0)) {
            issues.push(`${record.tarih} ${record.saat} ${record.motor}: normal ama tum degerler sifir`);
        }
        if (toNumber(record.sogutmaSuyuSicaklik) > 110 || toNumber(record.yagSicaklik) > 120 || toNumber(record.yagBasinc) > 10) {
            issues.push(`${record.tarih} ${record.saat} ${record.motor}: limit disi sicaklik/basinc`);
        }
    });
    return issues.slice(0, 5);
}

function analyzeEnerjiQuality(records) {
    const issues = [];
    const byMotor = {};
    sortRecordsAsc(records).forEach(record => {
        const motor = String(record.motor || '').trim();
        const durum = String(record.durum || '').toUpperCase();
        if (durum === 'NORMAL') {
            const liveValues = [record.aydemVoltaji, record.aktifGuc, record.reaktifGuc, record.ortAkim, record.ortGerilim].map(toNumber);
            if (liveValues.every(value => value === 0)) {
                issues.push(`${record.tarih} ${record.saat} ${motor}: normal ama enerji degerleri sifir`);
            }
        }

        const total = toNumber(record.toplamAktifEnerji);
        if (byMotor[motor] !== undefined && total < byMotor[motor]) {
            issues.push(`${record.tarih} ${record.saat} ${motor}: toplam aktif enerji geriye dusmus`);
        }
        byMotor[motor] = total;
    });
    return issues.slice(0, 5);
}

function makeCheck(title, value, detail, level) {
    return { title, value, detail, level };
}

function renderStatusCard(item) {
    return `
        <article class="status-card ${item.level}">
            <span class="card-label">${escapeHtml(item.title)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <p>${escapeHtml(item.detail)}</p>
        </article>`;
}

function renderCheckItem(item) {
    return `
        <div class="check-item ${item.level}">
            <span class="check-dot"></span>
            <div>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.detail)}</p>
            </div>
            <span class="badge ${item.level}">${escapeHtml(item.value)}</span>
        </div>`;
}

function loadingCard() {
    return `
        <article class="status-card loading">
            <span class="card-label">Sistem</span>
            <strong>Kontrol</strong>
            <p>Veriler okunuyor.</p>
        </article>`;
}

async function renderLogs() {
    const body = document.getElementById('logTableBody');
    const localLogs = window.SystemAuditLog?.read?.() || [];
    const remoteLogs = await fetchAllSystemLogs();
    const logs = remoteLogs.concat(localLogs.map(log => ({
        kayitZamani: log.at,
        modul: log.page,
        tarih: '',
        saat: '',
        eksikKayit: log.action,
        otomatikKayitSonucu: log.status,
        mailSonucu: '-',
        hataMesaji: '',
        detay: log.detail
    })));
    if (!logs.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">Henuz log yok.</td></tr>';
        return;
    }

    body.innerHTML = logs.slice(0, 80).map(log => `
        <tr>
            <td>${escapeHtml(log.kayitZamani || log.at)}</td>
            <td>${escapeHtml(log.modul || log.page || '-')}</td>
            <td>${escapeHtml(`${log.tarih || ''} ${log.saat || ''}`.trim() || '-')}</td>
            <td>${escapeHtml(log.eksikKayit || log.action || '-')}</td>
            <td>${escapeHtml(log.detay || log.detail || log.hataMesaji || '-')}</td>
            <td><span class="badge ${getLogBadgeLevel(log)}">${escapeHtml(log.otomatikKayitSonucu || log.status || 'info')}</span></td>
        </tr>`).join('');
}
function clearLogs() {
    if (!confirm('Sistem logları temizlensin mi?')) return;
    window.SystemAuditLog?.clear?.();
    renderLogs();
}

async function fetchAllSystemLogs() {
    const results = await Promise.all([
        fetchJson(AdminControlConfig.saatlik, { action: 'getSystemLogs', count: '30' }),
        fetchJson(AdminControlConfig.motor, { action: 'getSystemLogs', count: '30' }),
        fetchJson(AdminControlConfig.enerji, { action: 'getSystemLogs', count: '30' }),
        fetchJson(AdminControlConfig.bildirim, { action: 'getSystemLogs', count: '30' })
    ]);
    return results.flatMap(result => result.success && Array.isArray(result.data) ? result.data : []);
}

function getLogBadgeLevel(log) {
    const text = `${log.otomatikKayitSonucu || ''} ${log.mailSonucu || ''} ${log.hataMesaji || ''}`.toLowerCase();
    if (text.includes('hata') || text.includes('basarisiz')) return 'danger';
    if (text.includes('gerekmedi') || text.includes('basarili') || text.includes('ok')) return 'ok';
    return 'warn';
}
function getExpectedSlot() {
    const now = new Date();
    if (now.getMinutes() < 55) {
        now.setHours(now.getHours() - 1);
    }
    return {
        hour: `${String(now.getHours()).padStart(2, '0')}:00`,
        trDate: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`,
        isoDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    };
}

function matchesDate(value, trDate) {
    const parts = trDate.split('.');
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    return String(value || '').includes(trDate) || String(value || '').startsWith(isoDate);
}

function sortRecordsAsc(records) {
    return [...records].sort((a, b) => recordTime(a) - recordTime(b));
}

function recordTime(record) {
    const date = normalizeDateForParse(record.tarih);
    const hour = String(record.saat || '00:00').split(':')[0] || '0';
    return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime() || 0;
}

function normalizeDateForParse(value) {
    const text = String(value || '').trim();
    if (text.includes('-')) return text.slice(0, 10);
    const parts = text.split('.');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '1970-01-01';
}

function toNumber(value) {
    const normalized = String(value ?? '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    } catch (error) {
        return null;
    }
}

function getUserName(user) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Admin';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
