const AdminControlConfig = {
    saatlik: 'https://script.google.com/macros/s/AKfycbyNov_Ynr4EifhOqXBb2YUAON9ctyUemz_ms1qLC_FygxC18HZ8mcnEThddZYjYdP7sdg/exec',
    motor: 'https://script.google.com/macros/s/AKfycbztrKVv4ioi72xRo7g7_YcaA9zAxq12wdvQk7o2yLMjV5FozhVnquc970_iuuhulrGySw/exec',
    enerji: 'https://script.google.com/macros/s/AKfycbyTefsxh9IOyLXrAoFeaxsjunnYpv42a205JTA7byRV0GgLGc9_35Rftp_lkX0KrQfhFw/exec',
    buhar: 'https://script.google.com/macros/s/AKfycbwAI0OS8V5naHu1-k0c57QwZTJgt2WeVX8pmmeT45d56wZqiFyCHv8jMLu-1StLSfwy1Q/exec',
    gunluk: 'https://script.google.com/macros/s/AKfycbyJILN_PHL9Tw_BxRf_TuAOOsc7YqpmYQCgc-MYuhNJeRgiL9P9tczw2njQ7HndQE_8XA/exec',
    vardiya: 'https://script.google.com/macros/s/AKfycbylytHcQf5Uf_exGe9UZxwie9r8xzYhKFzRcrEBd0OLm7rXjulkkMd33O63rn0KL3QXeg/exec',
    bildirim: 'https://script.google.com/macros/s/AKfycbyjW5gbtw0BRHjDlmeLYmaio0UQWw8DG1B89X85BYwI-dw4YqaTuEPYilmv6B_xrXDmTA/exec'
};

const AdminControlLabels = {
    saatlik: 'Saatlik Veri',
    motor: 'Kojen Motor',
    enerji: 'Kojen Enerji',
    buhar: 'Buhar',
    gunluk: 'Gunluk Veri',
    vardiya: 'Vardiya',
    bildirim: 'Bildirim'
};

const AdminBackupModules = {
    saatlik: { label: 'Saatlik Veri', urlKey: 'saatlik', params: { action: 'getRecords' } },
    motor: { label: 'Kojen Motor', urlKey: 'motor', params: { action: 'getRecords' } },
    enerji: { label: 'Kojen Enerji', urlKey: 'enerji', params: { action: 'getRecords' } },
    buhar: { label: 'Buhar', urlKey: 'buhar', params: { action: 'getRecords' } },
    gunluk: { label: 'Gunluk Veri', urlKey: 'gunluk', params: { action: 'getRecords' } },
    vardiya: { label: 'Vardiya', urlKey: 'vardiya', params: { action: 'getRecords' } },
    bildirim: { label: 'Bildirim', urlKey: 'bildirim', params: { action: 'getAnnouncements' } }
};

document.addEventListener('DOMContentLoaded', function() {
    if (!requireAdmin()) return;

    document.getElementById('refreshDashboardBtn')?.addEventListener('click', loadDashboard);
    document.getElementById('clearLogsBtn')?.addEventListener('click', clearLogs);
    document.getElementById('installTriggersBtn')?.addEventListener('click', installAllTriggers);
    document.getElementById('testMailBtn')?.addEventListener('click', runTestMail);
    document.getElementById('backupAllBtn')?.addEventListener('click', runFullBackup);
    document.querySelectorAll('[data-backup-module]').forEach(button => {
        button.addEventListener('click', () => runModuleBackup(button.dataset.backupModule));
    });
    document.querySelectorAll('[data-test-module]').forEach(button => {
        button.addEventListener('click', () => runModuleTest(button.dataset.testModule));
    });

    loadDashboard();
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
                    <p>Bu sayfa sadece admin kullanicilar icindir.</p>
                    <a class="btn ghost" href="anasayfa.html">Ana Sayfa</a>
                </section>
            </div>`;
        return false;
    }

    const nameNode = document.getElementById('adminUserName');
    if (nameNode) nameNode.textContent = getUserName(user);
    return true;
}

async function loadDashboard() {
    const statusGrid = document.getElementById('statusGrid');
    const checkList = document.getElementById('missingCheckList');
    if (statusGrid) statusGrid.innerHTML = loadingCard();
    if (checkList) checkList.innerHTML = '<div class="empty">Kontroller calisiyor...</div>';

    renderTriggerHealthLoading();

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
    const qualityDetails = buildDetailedQuality(saatlik, motor, enerji);
    const shiftChecks = buildShiftCloseChecks(saatlik, motor, enerji, vardiya, bildirim);

    if (statusGrid) statusGrid.innerHTML = checks.map(renderStatusCard).join('');
    if (checkList) checkList.innerHTML = checks.concat(qualityChecks).map(renderCheckItem).join('');
    renderShiftCloseChecklist(shiftChecks);
    renderQualityDetails(qualityDetails);
    renderOperatorMobileSummary(checks, shiftChecks);
    renderUserActivity();

    window.SystemAuditLog?.write?.(
        'Merkezi kontrol yenilendi',
        `${checks.length} ana kontrol, ${qualityDetails.length} kalite uyarisi`,
        checks.some(item => item.level === 'danger') ? 'warn' : 'ok'
    );
    loadDeferredAdminData();
}

async function loadDeferredAdminData() {
    const [saatlikHealth, motorHealth, enerjiHealth, buharHealth, gunlukHealth] = await Promise.all([
        fetchJson(AdminControlConfig.saatlik, { action: 'getTriggerHealth' }),
        fetchJson(AdminControlConfig.motor, { action: 'getTriggerHealth' }),
        fetchJson(AdminControlConfig.enerji, { action: 'getTriggerHealth' }),
        fetchJson(AdminControlConfig.buhar, { action: 'getTriggerHealth' }),
        fetchJson(AdminControlConfig.gunluk, { action: 'getTriggerHealth' })
    ]);

    renderTriggerHealth([
        { key: 'saatlik', title: 'Saatlik Veri', result: saatlikHealth },
        { key: 'motor', title: 'Kojen Motor', result: motorHealth },
        { key: 'enerji', title: 'Kojen Enerji', result: enerjiHealth },
        { key: 'buhar', title: 'Buhar', result: buharHealth },
        { key: 'gunluk', title: 'Gunluk Veri', result: gunlukHealth }
    ]);
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

async function postCentralLog(action, detail, status = 'info') {
    window.SystemAuditLog?.write?.(action, detail, status);
    try {
        await fetchJson(AdminControlConfig.bildirim, {
            action: 'addSystemLog',
            modul: 'Merkezi Kontrol',
            eksikKayit: action,
            otomatikKayitSonucu: status,
            mailSonucu: '-',
            hataMesaji: status === 'danger' ? detail : '',
            detay: detail
        });
    } catch (error) {
        console.warn('Merkezi log yazilamadi:', error);
    }
}

function buildSaatlikCheck(result) {
    if (!result.success) return makeCheck('Saatlik Veri', 'Hata', result.error, 'danger');
    const records = Array.isArray(result.data) ? result.data : [];
    const slot = getExpectedSlot();
    const exists = records.some(record => matchesDate(record.tarih, slot.trDate) && record.saat === slot.hour);
    return makeCheck(
        'Saatlik Veri',
        exists ? 'Tamam' : 'Kontrol Et',
        exists ? `${slot.trDate} ${slot.hour} kaydi mevcut` : `${slot.trDate} ${slot.hour} kaydi gorunmuyor`,
        exists ? 'ok' : 'warn'
    );
}

function buildMotorCheck(result, title) {
    if (!result.success) return makeCheck(title, 'Hata', result.error, 'danger');
    const records = Array.isArray(result.data) ? result.data : [];
    const slot = getExpectedSlot();
    const motors = ['GM-1', 'GM-2', 'GM-3'];
    const missing = motors.filter(motor =>
        !records.some(record => matchesDate(record.tarih, slot.trDate) && record.saat === slot.hour && String(record.motor || '').trim() === motor)
    );
    return makeCheck(
        title,
        missing.length ? `${missing.length} Eksik` : 'Tamam',
        missing.length ? `${slot.trDate} ${slot.hour}: ${missing.join(', ')}` : `${slot.trDate} ${slot.hour} kayitlari mevcut`,
        missing.length ? 'warn' : 'ok'
    );
}

function buildVardiyaCheck(result) {
    if (!result.success) return makeCheck('Vardiya', 'Hata', result.error, 'danger');
    const records = Array.isArray(result.data) ? result.data : [];
    const active = records.find(record => String(record.durum || '').toLowerCase() === 'aktif');
    return makeCheck(
        'Vardiya',
        active ? 'Aktif' : 'Pasif',
        active ? `${active.vardiya} - ${active.personel}` : 'Aktif vardiya gorunmuyor',
        active ? 'ok' : 'warn'
    );
}

function buildBildirimCheck(result) {
    if (!result.success) return makeCheck('Duyurular', 'Hata', result.error, 'danger');
    const records = Array.isArray(result.data) ? result.data : [];
    return makeCheck(
        'Duyurular',
        `${records.length} Aktif`,
        records.length ? 'Aktif duyuru yayinda' : 'Aktif duyuru yok',
        records.length ? 'ok' : 'warn'
    );
}

function buildQualityChecks(saatlik, motor, enerji) {
    const saatlikIssues = analyzeSaatlikQuality(Array.isArray(saatlik.data) ? saatlik.data : []);
    const motorIssues = analyzeMotorQuality(Array.isArray(motor.data) ? motor.data : []);
    const enerjiIssues = analyzeEnerjiQuality(Array.isArray(enerji.data) ? enerji.data : []);

    return [
        makeCheck('Saatlik Kalite', saatlikIssues.length ? `${saatlikIssues.length} Uyari` : 'Temiz', saatlikIssues[0]?.text || 'Son kayitlarda supheli durum yok', saatlikIssues.length ? 'warn' : 'ok'),
        makeCheck('Motor Kalite', motorIssues.length ? `${motorIssues.length} Uyari` : 'Temiz', motorIssues[0]?.text || 'Son motor kayitlari normal', motorIssues.length ? 'warn' : 'ok'),
        makeCheck('Enerji Kalite', enerjiIssues.length ? `${enerjiIssues.length} Uyari` : 'Temiz', enerjiIssues[0]?.text || 'Son enerji kayitlari normal', enerjiIssues.length ? 'warn' : 'ok')
    ];
}

function buildDetailedQuality(saatlik, motor, enerji) {
    return []
        .concat(analyzeSaatlikQuality(Array.isArray(saatlik.data) ? saatlik.data : []))
        .concat(analyzeMotorQuality(Array.isArray(motor.data) ? motor.data : []))
        .concat(analyzeEnerjiQuality(Array.isArray(enerji.data) ? enerji.data : []));
}

function analyzeSaatlikQuality(records) {
    const issues = [];
    const sorted = sortRecordsAsc(records);
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (toNumber(cur.aktifMwh) < toNumber(prev.aktifMwh)) {
            issues.push(makeIssue('Saatlik Veri', 'danger', `${cur.tarih} ${cur.saat}: aktif enerji onceki kayittan dusuk`, `Onceki: ${prev.aktifMwh}, simdiki: ${cur.aktifMwh}`));
        }
        const prev2 = sorted[i - 2];
        if (prev2 &&
            toNumber(prev2.aktifMwh) === toNumber(prev.aktifMwh) &&
            toNumber(prev.aktifMwh) === toNumber(cur.aktifMwh) &&
            toNumber(prev2.reaktifMwh) === toNumber(prev.reaktifMwh) &&
            toNumber(prev.reaktifMwh) === toNumber(cur.reaktifMwh)) {
            issues.push(makeIssue('Saatlik Veri', 'warn', `${cur.tarih} ${cur.saat}: ayni degerler 3 kayittir tekrar ediyor`, `Aktif: ${cur.aktifMwh}, Reaktif: ${cur.reaktifMwh}`));
        }
    }
    return issues.slice(0, 6);
}

function analyzeMotorQuality(records) {
    const issues = [];
    records.slice(0, 90).forEach(record => {
        const durum = String(record.durum || '').toUpperCase();
        const values = [
            record.jenYatakSicaklikDE, record.jenYatakSicaklikNDE, record.sogutmaSuyuSicaklik,
            record.yagSicaklik, record.yagBasinc, record.sarjSicaklik,
            record.sargiSicaklik1, record.sargiSicaklik2, record.sargiSicaklik3
        ].map(toNumber);
        if (durum === 'NORMAL' && values.every(value => value === 0)) {
            issues.push(makeIssue('Kojen Motor', 'danger', `${record.tarih} ${record.saat} ${record.motor}: normal ama tum degerler sifir`, 'Durum NORMAL ise olcum degerleri kontrol edilmeli'));
        }
        if (toNumber(record.sogutmaSuyuSicaklik) > 110 || toNumber(record.yagSicaklik) > 120 || toNumber(record.yagBasinc) > 10) {
            issues.push(makeIssue('Kojen Motor', 'danger', `${record.tarih} ${record.saat} ${record.motor}: limit disi sicaklik/basinc`, `Sogutma: ${record.sogutmaSuyuSicaklik}, Yag sic.: ${record.yagSicaklik}, Yag bas.: ${record.yagBasinc}`));
        }
        if (durum === 'NORMAL' && toNumber(record.yagBasinc) < 1) {
            issues.push(makeIssue('Kojen Motor', 'warn', `${record.tarih} ${record.saat} ${record.motor}: yag basinci dusuk gorunuyor`, `Yag basinci: ${record.yagBasinc}`));
        }
    });
    return issues.slice(0, 8);
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
                issues.push(makeIssue('Kojen Enerji', 'danger', `${record.tarih} ${record.saat} ${motor}: normal ama enerji degerleri sifir`, 'Durum NORMAL iken anlik enerji degerleri sifir'));
            }
            if (toNumber(record.cosPhi) > 1 || toNumber(record.cosPhi) < 0) {
                issues.push(makeIssue('Kojen Enerji', 'warn', `${record.tarih} ${record.saat} ${motor}: Cos Phi aralik disi`, `Cos Phi: ${record.cosPhi}`));
            }
        }

        const total = toNumber(record.toplamAktifEnerji);
        if (byMotor[motor] !== undefined && total < byMotor[motor]) {
            issues.push(makeIssue('Kojen Enerji', 'danger', `${record.tarih} ${record.saat} ${motor}: toplam aktif enerji geriye dusmus`, `Onceki toplam: ${byMotor[motor]}, simdiki: ${total}`));
        }
        byMotor[motor] = total;
    });
    return issues.slice(0, 8);
}

function buildShiftCloseChecks(saatlik, motor, enerji, vardiya, bildirim) {
    const slot = getExpectedSlot();
    const activeShift = Array.isArray(vardiya.data) ? vardiya.data.find(record => String(record.durum || '').toLowerCase() === 'aktif') : null;
    const activeAnnouncements = Array.isArray(bildirim.data) ? bildirim.data : [];
    const criticalOpen = activeAnnouncements.filter(item => item.priority === 'high' && !item.completed);

    return [
        buildSaatlikCheck(saatlik),
        buildMotorCheck(motor, 'Kojen Motor'),
        buildMotorCheck(enerji, 'Kojen Enerji'),
        makeCheck('Aktif Vardiya', activeShift ? 'Var' : 'Yok', activeShift ? `${activeShift.vardiya} - ${activeShift.personel}` : 'Vardiya kapatma icin aktif vardiya gorunmuyor', activeShift ? 'ok' : 'warn'),
        makeCheck('Kritik Duyuru', criticalOpen.length ? `${criticalOpen.length} Acik` : 'Tamam', criticalOpen.length ? criticalOpen.map(item => item.title || item.message).join(', ') : 'Tamamlanmamis kritik duyuru yok', criticalOpen.length ? 'warn' : 'ok'),
        makeCheck('Kontrol Saati', slot.hour, `${slot.trDate} saatine gore on kontrol`, 'ok')
    ];
}

function renderTriggerHealth(items) {
    const list = document.getElementById('triggerHealthList');
    if (!list) return;
    list.innerHTML = items.map(item => {
        const result = item.result || {};
        const level = result.success ? (result.installed ? 'ok' : 'warn') : 'danger';
        const detail = result.success
            ? `${result.triggerCount || 0} tetikleyici. Son log: ${result.lastLog?.kayitZamani || 'yok'}`
            : result.error || 'Servis okunamadi';
        return `
            <div class="health-card ${level}">
                <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <p>${escapeHtml(detail)}</p>
                </div>
                <span class="badge ${level}">${result.installed ? 'Kurulu' : (result.success ? 'Eksik' : 'Hata')}</span>
            </div>`;
    }).join('');
}

function renderTriggerHealthLoading() {
    const list = document.getElementById('triggerHealthList');
    if (!list) return;
    list.innerHTML = '<div class="empty">Tetikleyici sagligi arka planda okunuyor...</div>';
}

function renderShiftCloseChecklist(items) {
    const list = document.getElementById('shiftCloseChecklist');
    if (!list) return;
    list.innerHTML = items.map(renderCheckItem).join('');
}

function renderQualityDetails(items) {
    const list = document.getElementById('qualityDetailList');
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<div class="quality-item ok"><strong>Kalite temiz</strong><p>Son kayitlarda detayli uyari yok.</p></div>';
        return;
    }
    list.innerHTML = items.map(item => `
        <div class="quality-item ${item.level}">
            <strong>${escapeHtml(item.module)}</strong>
            <p>${escapeHtml(item.text)}</p>
            <div class="meta-row">
                <span class="badge ${item.level}">${escapeHtml(item.level)}</span>
                <span>${escapeHtml(item.detail || '')}</span>
            </div>
        </div>`).join('');
}

function renderOperatorMobileSummary(checks, shiftChecks) {
    const list = document.getElementById('operatorMobileList');
    if (!list) return;
    const actionItems = checks
        .concat(shiftChecks.filter(item => ['Kritik Duyuru', 'Aktif Vardiya'].includes(item.title)))
        .filter(item => item.level !== 'ok')
        .slice(0, 6);
    if (!actionItems.length) {
        list.innerHTML = '<div class="operator-action-card ok"><strong>Operatore acil is yok</strong><p>Eksik kayit veya kritik uyari gorunmuyor.</p></div>';
        return;
    }
    list.innerHTML = actionItems.map(item => `
        <div class="operator-action-card ${item.level}">
            <strong>${escapeHtml(item.title)} - ${escapeHtml(item.value)}</strong>
            <p>${escapeHtml(item.detail)}</p>
        </div>`).join('');
}

function renderUserActivity() {
    const list = document.getElementById('userActivityList');
    if (!list) return;
    const logs = window.SystemAuditLog?.read?.() || [];
    const byUser = {};
    logs.forEach(log => {
        const key = log.user || log.email || 'Bilinmeyen Kullanici';
        if (!byUser[key]) byUser[key] = { count: 0, last: '' };
        byUser[key].count++;
        byUser[key].last = byUser[key].last || `${log.action || '-'} - ${log.at || ''}`;
    });
    const rows = Object.keys(byUser).map(user => ({ user, ...byUser[user] })).slice(0, 8);
    if (!rows.length) {
        list.innerHTML = '<div class="activity-item"><strong>Kayit yok</strong><p>Bu tarayicida kullanici islem gecmisi bulunmuyor.</p></div>';
        return;
    }
    list.innerHTML = rows.map(row => `
        <div class="activity-item">
            <strong>${escapeHtml(row.user)}</strong>
            <p>${row.count} islem. Son: ${escapeHtml(row.last)}</p>
        </div>`).join('');
}

async function installAllTriggers() {
    const box = document.getElementById('testResultBox');
    if (box) box.textContent = 'Tetikleyiciler kuruluyor...';
    const modules = ['saatlik', 'motor', 'enerji', 'buhar', 'gunluk'];
    const results = await Promise.all(modules.map(moduleName =>
        fetchJson(AdminControlConfig[moduleName], { action: 'installHourlyMissingRecordTrigger' })
            .then(result => ({ moduleName, result }))
    ));
    const summary = results.map(item => `${AdminControlLabels[item.moduleName]}: ${item.result.success ? 'kuruldu' : item.result.error}`).join(' | ');
    if (box) box.textContent = summary;
    await postCentralLog('Tetikleyici kurulumu', summary, results.every(item => item.result.success) ? 'ok' : 'warn');
    loadDashboard();
}

async function runModuleTest(moduleName) {
    const box = document.getElementById('testResultBox');
    if (box) box.textContent = `${AdminControlLabels[moduleName] || moduleName} testi calisiyor...`;
    const result = await fetchJson(AdminControlConfig[moduleName], { action: 'checkHourlyMissingRecords' });
    const summary = result.success
        ? `${AdminControlLabels[moduleName]}: ${result.message || `eksik=${result.missingCount ?? result.missing ?? '-'}, eklenen=${result.addedCount ?? result.added ?? '-'}`}`
        : `${AdminControlLabels[moduleName]}: ${result.error}`;
    if (box) box.textContent = summary;
    await postCentralLog('Manuel test', summary, result.success ? 'ok' : 'danger');
    loadDashboard();
}

async function runTestMail() {
    const box = document.getElementById('testResultBox');
    if (box) box.textContent = 'Test maili gonderiliyor...';
    const result = await fetchJson(AdminControlConfig.saatlik, {
        action: 'sendEmail',
        subject: 'Merkezi Kontrol Test Maili',
        body: `Merkezi kontrol test maili. Zaman: ${new Date().toLocaleString('tr-TR')}`
    });
    const summary = result.success ? 'Test maili basarili' : `Test maili hata: ${result.error}`;
    if (box) box.textContent = summary;
    await postCentralLog('Test maili', summary, result.success ? 'ok' : 'danger');
    renderLogs();
}

async function runFullBackup() {
    const box = document.getElementById('backupResultBox');
    setBackupStatus('Tum yedek hazirlaniyor...');
    const keys = Object.keys(AdminBackupModules);
    const results = await Promise.all(keys.map(key => fetchBackupModule(key)));
    const data = {};
    const errors = [];

    results.forEach(item => {
        data[item.key] = item.result.success ? item.result.data : [];
        if (!item.result.success) {
            errors.push(`${item.label}: ${item.result.error || 'Yedek alinamadi'}`);
        }
    });

    const logs = await buildLogsBackup();
    data.loglar = logs.data;
    if (logs.errors.length) errors.push(...logs.errors);

    const payload = createBackupPayload('tum-veriler', data, errors);
    exportBackupPayload(payload, `kojenerasyon-tum-yedek-${fileDateStamp()}`);

    const total = Object.keys(data).reduce((sum, key) => sum + (Array.isArray(data[key]) ? data[key].length : 0), 0);
    const message = errors.length
        ? `Yedek indirildi; ${errors.length} bolumde uyari var. Toplam ${total} kayit.`
        : `Yedek indirildi. Toplam ${total} kayit.`;
    if (box) box.textContent = message;
    await postCentralLog('Veri yedegi', message, errors.length ? 'warn' : 'ok');
}

async function runModuleBackup(moduleKey) {
    setBackupStatus(`${AdminControlLabels[moduleKey] || moduleKey} yedegi hazirlaniyor...`);
    let payload;

    if (moduleKey === 'loglar') {
        const logs = await buildLogsBackup();
        payload = createBackupPayload('loglar', { loglar: logs.data }, logs.errors);
    } else {
        const item = await fetchBackupModule(moduleKey);
        const errors = item.result.success ? [] : [item.result.error || 'Yedek alinamadi'];
        payload = createBackupPayload(moduleKey, { [moduleKey]: item.result.success ? item.result.data : [] }, errors);
    }

    exportBackupPayload(payload, `kojenerasyon-${moduleKey}-yedek-${fileDateStamp()}`);
    const count = Object.values(payload.data).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
    const message = `${payload.title} yedegi indirildi. Kayit: ${count}${payload.errors.length ? ', uyari: ' + payload.errors.length : ''}.`;
    setBackupStatus(message);
    await postCentralLog('Modul yedegi', message, payload.errors.length ? 'warn' : 'ok');
}

async function fetchBackupModule(moduleKey) {
    const config = AdminBackupModules[moduleKey];
    if (!config) {
        return { key: moduleKey, label: moduleKey, result: { success: false, error: 'Bilinmeyen modul' } };
    }
    const result = await fetchJson(AdminControlConfig[config.urlKey], config.params);
    return { key: moduleKey, label: config.label, result };
}

async function buildLogsBackup() {
    const errors = [];
    const remoteLogs = await fetchAllSystemLogs().catch(error => {
        errors.push(error.message || String(error));
        return [];
    });
    const localLogs = window.SystemAuditLog?.read?.() || [];
    return {
        data: remoteLogs.concat(localLogs.map(log => ({
            kayitZamani: log.at,
            modul: log.page,
            eksikKayit: log.action,
            otomatikKayitSonucu: log.status,
            detay: log.detail,
            kaynak: 'local'
        }))),
        errors
    };
}

function createBackupPayload(title, data, errors) {
    return {
        title,
        createdAt: new Date().toISOString(),
        createdAtLocal: new Date().toLocaleString('tr-TR'),
        version: 1,
        data,
        errors: errors || []
    };
}

function exportBackupPayload(payload, fileBaseName) {
    const format = getBackupFormat();
    if (format === 'excel') {
        downloadExcelBackup(payload, `${fileBaseName}.xls`);
        return;
    }
    if (format === 'pdf') {
        openPdfBackup(payload);
        return;
    }
    downloadJsonBackup(payload, `${fileBaseName}.json`);
}

function getBackupFormat() {
    return document.getElementById('backupFormatSelect')?.value || 'json';
}

function downloadJsonBackup(payload, fileName) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, fileName);
}

function downloadExcelBackup(payload, fileName) {
    const html = buildExcelHtml(payload);
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    downloadBlob(blob, fileName);
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function openPdfBackup(payload) {
    const win = window.open('', '_blank');
    if (!win) {
        setBackupStatus('PDF penceresi acilamadi. Tarayici popup iznini kontrol edin.');
        return;
    }
    win.document.open();
    win.document.write(buildPdfHtml(payload));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
}

function buildExcelHtml(payload) {
    const sections = Object.keys(payload.data || {}).map(key => {
        const rows = Array.isArray(payload.data[key]) ? payload.data[key] : [];
        return `<h2>${escapeHtml(getBackupSectionTitle(key))}</h2>${buildHtmlTable(rows)}`;
    }).join('<br>');
    return `\uFEFF<html><head><meta charset="UTF-8"></head><body>
        <h1>${escapeHtml(payload.title)}</h1>
        <p>Olusturma: ${escapeHtml(payload.createdAtLocal)}</p>
        ${sections}
        ${payload.errors.length ? `<h2>Uyarilar</h2><p>${escapeHtml(payload.errors.join(' | '))}</p>` : ''}
    </body></html>`;
}

function buildPdfHtml(payload) {
    const sections = Object.keys(payload.data || {}).map(key => {
        const rows = Array.isArray(payload.data[key]) ? payload.data[key] : [];
        return `<section><h2>${escapeHtml(getBackupSectionTitle(key))} (${rows.length})</h2>${buildHtmlTable(rows.slice(0, 250))}${rows.length > 250 ? '<p>PDF on izlemede ilk 250 kayit gosterildi. Tum kayitlar icin JSON/Excel alin.</p>' : ''}</section>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="UTF-8"><title>${escapeHtml(payload.title)}</title>
        <style>
            body{font-family:Arial,sans-serif;color:#172033;margin:24px}
            h1{font-size:22px;margin-bottom:4px} h2{font-size:16px;margin-top:22px}
            p{color:#64748b} table{width:100%;border-collapse:collapse;font-size:10px;margin-top:8px}
            th,td{border:1px solid #d9e2ef;padding:5px;text-align:left;vertical-align:top}
            th{background:#eef4ff} section{page-break-inside:auto}
            @media print{button{display:none} body{margin:10mm}}
        </style></head><body>
        <button onclick="window.print()">PDF Kaydet / Yazdir</button>
        <h1>${escapeHtml(payload.title)}</h1>
        <p>Olusturma: ${escapeHtml(payload.createdAtLocal)}</p>
        ${sections}
        ${payload.errors.length ? `<h2>Uyarilar</h2><p>${escapeHtml(payload.errors.join(' | '))}</p>` : ''}
    </body></html>`;
}

function buildHtmlTable(rows) {
    if (!rows.length) return '<p>Kayit yok.</p>';
    const columns = Array.from(rows.reduce((set, row) => {
        Object.keys(row || {}).forEach(key => set.add(key));
        return set;
    }, new Set()));
    return `<table><thead><tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}</tr></thead><tbody>
        ${rows.map(row => `<tr>${columns.map(col => `<td>${escapeHtml(formatBackupCell(row?.[col]))}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
}

function formatBackupCell(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function getBackupSectionTitle(key) {
    return AdminBackupModules[key]?.label || (key === 'loglar' ? 'Loglar' : key);
}

function setBackupStatus(message) {
    const box = document.getElementById('backupResultBox');
    if (box) box.textContent = message;
}

function fileDateStamp() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
}

async function renderLogs() {
    const body = document.getElementById('logTableBody');
    if (!body) return;
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
    if (!confirm('Sistem loglari temizlensin mi?')) return;
    window.SystemAuditLog?.clear?.();
    renderUserActivity();
    renderLogs();
}

async function fetchAllSystemLogs() {
    const results = await Promise.all([
        fetchJson(AdminControlConfig.saatlik, { action: 'getSystemLogs', count: '30' }),
        fetchJson(AdminControlConfig.motor, { action: 'getSystemLogs', count: '30' }),
        fetchJson(AdminControlConfig.enerji, { action: 'getSystemLogs', count: '30' }),
        fetchJson(AdminControlConfig.buhar, { action: 'getSystemLogs', count: '30' }),
        fetchJson(AdminControlConfig.gunluk, { action: 'getSystemLogs', count: '30' }),
        fetchJson(AdminControlConfig.bildirim, { action: 'getSystemLogs', count: '30' })
    ]);
    return results.flatMap(result => result.success && Array.isArray(result.data) ? result.data : []);
}

function getLogBadgeLevel(log) {
    const text = `${log.otomatikKayitSonucu || ''} ${log.mailSonucu || ''} ${log.hataMesaji || ''}`.toLowerCase();
    if (text.includes('hata') || text.includes('basarisiz') || text.includes('danger')) return 'danger';
    if (text.includes('gerekmedi') || text.includes('basarili') || text.includes('ok')) return 'ok';
    return 'warn';
}

function makeCheck(title, value, detail, level) {
    return { title, value, detail, level };
}

function makeIssue(module, level, text, detail) {
    return { module, level, text, detail };
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

