document.addEventListener('DOMContentLoaded', function() {
    // Kullanıcı giriş kontrolü
    checkAuth();
    
    // Motor verileri
    const motorData = {
        gm1: {
            totalProduction: 0,
            hourlyProduction: 0,
            totalHours: 0,
            hourlyHours: 0,
            status: 'stopped'
        },
        gm2: {
            totalProduction: 0,
            hourlyProduction: 0,
            totalHours: 0,
            hourlyHours: 0,
            status: 'stopped'
        },
        gm3: {
            totalProduction: 0,
            hourlyProduction: 0,
            totalHours: 0,
            hourlyHours: 0,
            status: 'stopped'
        }
    };

    // Günlük özet verileri
    const summaryData = {
        dailyProduction: 0,
        dailySteam: null, // Buhar verisinden çekilecek
        pendingMaintenance: 3,
        activeFaults: 1
    };

    // Buhar verisi config
    const BUHAR_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwSmfP2MQ5hz3rlWUXcr46zFLc8zZx9gQ8Onh0xZCSVWfkXbDFrh3ufPuMzk2WHoF7P/exec';
    const KOJEN_ENERJI_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxysc_Z4VtE1Weohc91XcOi651EwxrPlanIOyebKfSJyBEUQJ2lvf6hP-fkS1OKqyk/exec';
    const KOJEN_MOTOR_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx0hVgnAIHSlaXAoFBc0-96SsMjb9R_GD3ptKlBBK7L_hjGFQBWqezV9w55X4MyZu3U/exec';
    const BAKIM_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgjdH1kftdCxqrcUFwWMWSX7j6t0XAKVThgQjUVkwA8BlpzA5GS5VH3-ln3LP8c6NolQ/exec';
    const SAATLIK_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxKo1fwJBYHGNbrrIW5agfYkAqLSj8nVbKzbi2OXoeTLM7oZLyfNSMqQP-uGIsDQp5y/exec';
    const GUNLUK_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwNka_9UemxV0HPBVA02qUE2ayzICY4OH0Ms3uBx4VupMB-4UZlnvNhCoeV6SRzkAFy/exec';
    const ADMIN_TRIGGER_MODULES = [
        { key: 'saatlik', label: 'Saatlik Veri', url: SAATLIK_APPS_SCRIPT_URL },
        { key: 'motor', label: 'Kojen Motor', url: KOJEN_MOTOR_APPS_SCRIPT_URL },
        { key: 'enerji', label: 'Kojen Enerji', url: KOJEN_ENERJI_APPS_SCRIPT_URL },
        { key: 'buhar', label: 'Buhar', url: BUHAR_APPS_SCRIPT_URL },
        { key: 'gunluk', label: 'Gunluk Veri', url: GUNLUK_APPS_SCRIPT_URL }
    ];
    const ANNOUNCEMENTS_STORAGE_KEY = 'shiftAnnouncements';
    const defaultAnnouncements = [
        {
            title: '08-16 vardiyasi: kojenerasyon saha kontrol listesi tamamlanacak',
            priority: 'high'
        },
        {
            title: 'GM motor yag ve sogutma degerleri saatlik kayitlarda dikkatle kontrol edilecek',
            priority: 'medium'
        },
        {
            title: 'Vardiya tesliminde yapilan isler ve bekleyen konular vardiya notuna yazilacak',
            priority: 'normal'
        }
    ];
    let dashboardAnnouncements = null;

    // Sayfa yüklendiğinde verileri göster
    setTimeout(loadDashboardData, 1000);
    setInterval(loadDashboardData, 5 * 60 * 1000);
    setTimeout(ensureAdminTriggersAfterLogin, 1800);

    async function loadDashboardData() {
        const dashboardLoaded = await loadDashboardSummary();
        await updateAnnouncementTicker();
        await loadLatestEnergyData();
        await loadLatestMotorStatus();
        await loadMaintenanceData();
        if (!dashboardLoaded) {
            await loadBuharData();
        }
        updateMotorData();
        updateSummaryData();
    }

    // Motor verilerini güncelle
    async function updateAnnouncementTicker() {
        const tickerTrack = document.getElementById('announcementTickerTrack');
        if (!tickerTrack) return;

        const announcements = await getTodayAnnouncements();
        tickerTrack.innerHTML = '';

        if (announcements.length === 0) {
            tickerTrack.appendChild(createTickerItem('Bugun icin aktif vardiya duyurusu bulunmuyor.', 'normal'));
            tickerTrack.style.animation = 'none';
            return;
        }

        const tickerItems = [...announcements, ...announcements];
        tickerItems.forEach(item => {
            tickerTrack.appendChild(createTickerItem(formatTickerText(item), item.priority, item.category));
        });

        tickerTrack.style.animation = announcements.length === 1 ? 'tickerScroll 24s linear infinite' : '';
    }

    function createTickerItem(text, priority = 'normal', category = 'general') {
        const item = document.createElement('span');
        item.className = `ticker-item ${priority || 'normal'} category-${category || 'general'}`;
        item.textContent = text;
        return item;
    }

    function formatTickerText(item) {
        const category = formatAnnouncementCategory(item.category);
        const text = item.title || item.message || 'Duyuru metni yok';
        return category ? `${category}: ${text}` : text;
    }

    async function loadDashboardSummary() {
        try {
            const url = new URL(KOJEN_ENERJI_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getDashboardSummary');

            const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
            const result = await response.json();

            if (!result.success) {
                const errorText = String(result.error || result.message || '');
                if (errorText.includes('Geçersiz işlem') || errorText.includes('Gecersiz islem')) {
                    console.warn('Dashboard ozeti bu Apps Script deployunda yok; getLastRecords fallback kullaniliyor.');
                } else {
                    console.error('Dashboard ozeti alinamadi:', result.error);
                }
                return false;
            }

            if (result.summary) {
                summaryData.dailyProduction = parseDashboardNumber(result.summary.dailyProduction);
                summaryData.dailySteam = result.summary.dailySteam === null || result.summary.dailySteam === undefined
                    ? null
                    : parseDashboardNumber(result.summary.dailySteam);
                summaryData.pendingMaintenance = parseDashboardNumber(result.summary.pendingMaintenance);
                summaryData.activeFaults = parseDashboardNumber(result.summary.activeFaults);
            }

            if (result.motors) {
                Object.entries(result.motors).forEach(([key, data]) => {
                    if (!motorData[key]) return;
                    motorData[key].totalProduction = parseDashboardNumber(data.totalProduction);
                    motorData[key].hourlyProduction = parseDashboardNumber(data.hourlyProduction);
                    motorData[key].totalHours = parseDashboardNumber(data.totalHours);
                    motorData[key].hourlyHours = parseDashboardNumber(data.hourlyHours);
                    motorData[key].status = data.status === 'running' ? 'running' : 'stopped';
                });
            }

            if (Array.isArray(result.announcements)) {
                dashboardAnnouncements = result.announcements;
                localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(result.announcements));
            }

            if (Array.isArray(result.errors) && result.errors.length) {
                console.warn('Dashboard kismi hatalar:', result.errors);
            }

            return true;
        } catch (error) {
            console.error('Dashboard ozeti yuklenemedi:', error);
            return false;
        }
    }

    async function getTodayAnnouncements() {
        if (Array.isArray(dashboardAnnouncements)) {
            return filterTodayAnnouncements(dashboardAnnouncements);
        }

        if (window.fetchAnnouncementsFromSheets && window.isBildirimSheetsEnabled?.()) {
            try {
                const result = await fetchAnnouncementsFromSheets({ active: 'true' });
                if (result.success && Array.isArray(result.data)) {
                    localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(result.data));
                    return filterTodayAnnouncements(result.data);
                }
            } catch (error) {
                console.error('Sheets duyurulari okunamadi:', error);
            }
        }

        try {
            const stored = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY) || '[]');
            if (!Array.isArray(stored) || stored.length === 0) return defaultAnnouncements;
            return filterTodayAnnouncements(stored);
        } catch (error) {
            console.error('Vardiya duyurulari okunamadi:', error);
            return defaultAnnouncements;
        }
    }

    function filterTodayAnnouncements(items) {
        const today = new Date().toISOString().split('T')[0];
        const user = getLoggedInUser();
        const activeItems = items.filter(item => {
            const isActive = item.active !== false;
            return isActive && matchesDateRange(item, today) && matchesTarget(item, user);
        });

        return activeItems.length > 0 ? activeItems : defaultAnnouncements;
    }

    function matchesDateRange(item, today) {
        const start = toIsoDate(item.startDate || item.date || '');
        const end = toIsoDate(item.endDate || '');
        if (start && today < start) return false;
        if (end && today > end) return false;
        return true;
    }

    function matchesTarget(item, user) {
        const target = item.target || 'all';
        if (target === 'all') return true;
        return user?.role === target;
    }

    function toIsoDate(value) {
        if (!value) return '';
        const text = String(value);
        if (text.includes('-')) return text;
        const parts = text.split('.');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
    }

    function getLoggedInUser() {
        try {
            return JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        } catch (error) {
            return null;
        }
    }

    async function ensureAdminTriggersAfterLogin() {
        const user = getLoggedInUser();
        if (user?.role !== 'admin') return;
        if (sessionStorage.getItem('adminTriggerCheckPending') !== '1') return;

        try {
            const healthResults = await Promise.all(ADMIN_TRIGGER_MODULES.map(async module => ({
                module,
                result: await fetchTriggerJson(module.url, { action: 'getTriggerHealth' })
            })));
            const missing = healthResults.filter(item => item.result.success && !item.result.installed);
            const failedChecks = healthResults.filter(item => !item.result.success);

            if (!missing.length && !failedChecks.length) {
                showNotification('Tetikleyiciler kurulu.', 'success');
                return;
            }

            if (missing.length) {
                showNotification(
                    `Eksik tetikleyici: ${missing.map(item => item.module.label).join(', ')}. Kurulum baslatildi.`,
                    'warning'
                );

                const installResults = await Promise.all(missing.map(async item => ({
                    module: item.module,
                    result: await fetchTriggerJson(item.module.url, { action: 'installHourlyMissingRecordTrigger' })
                })));
                const installErrors = installResults.filter(item => !item.result.success);

                if (installErrors.length) {
                    showNotification(
                        `Tetikleyici kurulum hatasi: ${installErrors.map(item => item.module.label).join(', ')}`,
                        'error'
                    );
                } else {
                    showNotification('Eksik tetikleyiciler kuruldu.', 'success');
                }
            }

            if (failedChecks.length) {
                showNotification(
                    `Tetikleyici kontrol hatasi: ${failedChecks.map(item => item.module.label).join(', ')}`,
                    'error'
                );
            }
        } catch (error) {
            console.error('Admin tetikleyici kontrolu calisamadi:', error);
            showNotification('Tetikleyici kontrolu yapilamadi.', 'error');
        } finally {
            sessionStorage.removeItem('adminTriggerCheckPending');
        }
    }

    async function fetchTriggerJson(baseUrl, params) {
        try {
            const url = new URL(baseUrl);
            Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));
            const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
            const result = await response.json();
            return result.success ? result : { success: false, error: result.error || 'Servis hatasi' };
        } catch (error) {
            return { success: false, error: error.message || String(error) };
        }
    }

    const announcementDetailsBtn = document.getElementById('announcementDetailsBtn');
    if (announcementDetailsBtn) {
        announcementDetailsBtn.addEventListener('click', async function() {
            const announcements = await getTodayAnnouncements();
            await markVisibleAnnouncementsRead(announcements);
            const message = announcements.map((item, index) => {
                const attachment = item.attachmentUrl ? `\n   Ek: ${item.attachmentUrl}` : '';
                return `${index + 1}. ${formatTickerText(item)}${attachment}`;
            }).join('\n');
            alert(message || 'Bugun icin aktif vardiya duyurusu bulunmuyor.');
        });
    }

    async function markVisibleAnnouncementsRead(announcements) {
        const user = getLoggedInUser();
        const reader = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Kullanici';

        let storedReads = {};
        try {
            storedReads = JSON.parse(localStorage.getItem('announcementReads') || '{}');
        } catch (error) {
            storedReads = {};
        }
        announcements.forEach(item => {
            if (item.id) storedReads[item.id] = true;
        });
        localStorage.setItem('announcementReads', JSON.stringify(storedReads));

        if (!window.markAnnouncementReadOnSheets || !window.isBildirimSheetsEnabled?.()) return;
        try {
            await Promise.all(announcements.filter(item => item.id).map(item =>
                markAnnouncementReadOnSheets(item.id, reader, user?.email || '')
            ));
        } catch (error) {
            console.error('Okundu bilgisi kaydedilemedi:', error);
        }
    }

    function formatAnnouncementCategory(value) {
        const labels = {
            operation: 'Isletme',
            maintenance: 'Bakim',
            safety: 'Guvenlik',
            shift: 'Vardiya',
            general: 'Genel'
        };
        return labels[value] || '';
    }

    function updateMotorData() {
        for (const [motorId, data] of Object.entries(motorData)) {
            // Toplam üretim
            const totalProductionEl = document.getElementById(`${motorId}-total-production`);
            if (totalProductionEl) {
                animateValue(totalProductionEl, 0, data.totalProduction, 1500, ' MWh');
            }

            const hourlyProductionEl = document.getElementById(`${motorId}-hourly-production`);
            if (hourlyProductionEl) {
                animateValue(hourlyProductionEl, 0, data.hourlyProduction || 0, 1500, ' MWh');
            }

            // Toplam çalışma
            const totalHoursEl = document.getElementById(`${motorId}-total-hours`);
            if (totalHoursEl) {
                animateValue(totalHoursEl, 0, data.totalHours, 1500, ' saat');
            }

            const hourlyHoursEl = document.getElementById(`${motorId}-hourly-hours`);
            if (hourlyHoursEl) {
                animateValue(hourlyHoursEl, 0, data.hourlyHours || 0, 1500, ' saat');
            }

            // Motor durumunu güncelle
            const motorCard = document.querySelector(`[data-motor="${motorId}"]`);
            if (motorCard) {
                const statusEl = motorCard.querySelector('.motor-status');
                if (statusEl) {
                    statusEl.className = `motor-status ${data.status}`;
                    statusEl.textContent = data.status === 'running' ? 'Çalışıyor' : 'Durdu';
                }
            }
        }
    }

    // Özet verilerini güncelle
    function updateSummaryData() {
        const dailyProductionEl = document.getElementById('daily-production-value');
        if (dailyProductionEl) {
            animateValue(dailyProductionEl, 0, summaryData.dailyProduction, 1500, ' MWh');
        }

        // Günlük buhar
        const dailySteamEl = document.getElementById('daily-steam-value');
        if (dailySteamEl && summaryData.dailySteam !== null) {
            dailySteamEl.textContent = summaryData.dailySteam.toFixed(2) + ' Ton';
        }

        // Bekleyen bakım
        const pendingMaintenanceEl = document.getElementById('pending-maintenance-value');
        if (pendingMaintenanceEl) {
            animateValue(pendingMaintenanceEl, 0, summaryData.pendingMaintenance, 1500, ' İş Emri');
        }

        // Aktif arızalar
        const activeFaultsEl = document.getElementById('active-faults-value');
        if (activeFaultsEl) {
            animateValue(activeFaultsEl, 0, summaryData.activeFaults, 1500, ' Arıza');
        }
    }

    // Buhar verisini çek (son kayıt)
    async function loadBuharData() {
        try {
            const url = new URL(BUHAR_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecords');
            url.searchParams.append('count', '1');
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            if (result.success && result.data && result.data.length > 0) {
                const lastRecord = result.data[0];
                summaryData.dailySteam = parseFloat(lastRecord.buharMiktari) || 0;
            } else {
                summaryData.dailySteam = null;
            }
        } catch (error) {
            console.error('Buhar verisi yüklenemedi:', error);
        }
    }
    async function loadMaintenanceData() {
        try {
            const url = new URL(BAKIM_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getActiveRecords');

            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();

            if (!result.success || !Array.isArray(result.records)) {
                console.error('Bekleyen bakim verisi alinamadi:', result.message || result.error);
                return;
            }

            const activeRecords = result.records.filter(record => {
                return String(record.status || '').toLowerCase() === 'aktif';
            });

            summaryData.pendingMaintenance = activeRecords.filter(record => {
                return !isFaultRecordType(record.type);
            }).length;

            summaryData.activeFaults = activeRecords.filter(record => {
                return isFaultRecordType(record.type);
            }).length;
        } catch (error) {
            console.error('Bekleyen bakim verisi yuklenemedi:', error);
        }
    }

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c');
    }

    function parseDashboardNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return value;

        let normalized = String(value).trim();
        if (normalized.includes(',')) {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        }

        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function getMotorKey(value) {
        const text = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
        const gmMatch = text.match(/GM-?(?:GM-?)?(\d+)$/);
        if (gmMatch) return `gm${gmMatch[1]}`;

        const numericMatch = text.match(/(\d+)$/);
        if (numericMatch) return `gm${numericMatch[1]}`;

        return text.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function isStoppedMotorStatus(value) {
        const status = normalizeText(value);
        const originalStatus = String(value || '').toLowerCase();
        return status.includes('calismiyor') ||
            originalStatus.includes('\u00E7al\u0131\u015Fm\u0131yor') ||
            status.includes('durdu') ||
            status.includes('stop');
    }

    function isFaultRecordType(value) {
        const type = normalizeText(value);
        const originalType = String(value || '').toLowerCase();
        return type === 'ariza' || originalType === 'ar\u0131za';
    }

    async function loadLatestEnergyData() {
        try {
            const url = new URL(KOJEN_ENERJI_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecords');
            url.searchParams.append('count', '100');

            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();

            if (!result.success || !Array.isArray(result.data)) {
                console.error('Son enerji kayitlari alinamadi:', result.error);
                return;
            }

            const latestByMotor = {};
            const recordsByMotor = {};
            result.data.forEach(record => {
                const key = getMotorKey(record.motor);
                if (!motorData[key]) return;
                if (!recordsByMotor[key]) recordsByMotor[key] = [];
                recordsByMotor[key].push(record);
                if (!latestByMotor[key]) latestByMotor[key] = record;
            });

            Object.entries(latestByMotor).forEach(([key, record]) => {
                const totalEnergyKwh = parseDashboardNumber(record.toplamAktifEnerji);
                const totalHours = parseDashboardNumber(record.calismaSaati);
                const previousRecord = recordsByMotor[key] && recordsByMotor[key][1] ? recordsByMotor[key][1] : null;
                const previousEnergyKwh = previousRecord ? parseDashboardNumber(previousRecord.toplamAktifEnerji) : totalEnergyKwh;
                const previousHours = previousRecord ? parseDashboardNumber(previousRecord.calismaSaati) : totalHours;

                motorData[key].totalProduction = totalEnergyKwh / 1000;
                motorData[key].hourlyProduction = Math.max(0, (totalEnergyKwh - previousEnergyKwh) / 1000);
                motorData[key].totalHours = totalHours;
                motorData[key].hourlyHours = Math.max(0, totalHours - previousHours);

                if (isStoppedMotorStatus(record.durum)) {
                    motorData[key].status = 'stopped';
                }
            });
        } catch (error) {
            console.error('Son enerji verisi yuklenemedi:', error);
        }
    }

    async function loadLatestMotorStatus() {
        try {
            const url = new URL(KOJEN_MOTOR_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecords');
            url.searchParams.append('count', '100');

            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();

            if (!result.success || !Array.isArray(result.data)) {
                console.error('Son motor kayitlari alinamadi:', result.error);
                return;
            }

            const latestByMotor = {};
            result.data.forEach(record => {
                const key = getMotorKey(record.motor);
                if (!motorData[key] || latestByMotor[key]) return;
                latestByMotor[key] = record;
            });

            Object.entries(latestByMotor).forEach(([key, record]) => {
                motorData[key].status = isStoppedMotorStatus(record.durum) ? 'stopped' : 'running';
            });
        } catch (error) {
            console.error('Son motor durumu yuklenemedi:', error);
        }
    }

    // Sayısal değer animasyonu
    function animateValue(element, start, end, duration, suffix = '') {
        const startTime = performance.now();
        const isFloat = end % 1 !== 0;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing fonksiyonu
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            
            const currentValue = start + (end - start) * easeOutQuart;
            
            if (isFloat) {
                element.textContent = currentValue.toFixed(1) + suffix;
            } else {
                element.textContent = Math.round(currentValue) + suffix;
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // Çıkış yap butonları
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');

    sidebarLogout.addEventListener('click', handleLogout);
    headerLogout.addEventListener('click', handleLogout);

    function handleLogout() {
        if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
            localStorage.removeItem('rememberedEmail');
            window.location.href = 'index.html';
        }
    }

    // Menü navigasyonu
    const menuLinks = document.querySelectorAll('.menu-link');
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Sadece # ise veya boşsa engelle, değilse normal yönlendirme yap
            if (href === '#' || !href) {
                e.preventDefault();
                
                // Aktif menü öğesini güncelle
                menuLinks.forEach(l => l.parentElement.classList.remove('active'));
                this.parentElement.classList.add('active');
                
                // Menü text'ine göre bildirim göster
                const menuText = this.querySelector('.menu-text').textContent;
                if (menuText !== 'Ana Sayfa') {
                    showNotification(`${menuText} sayfası yapım aşamasında.`, 'info');
                }
            }
            // Diğer durumlarda normal link davranışı devam etsin (sayfa yönlendirmesi)
        });
    });

    function handleMenuNavigation(menuText) {
        switch(menuText) {
            case 'Ana Sayfa':
                // Zaten ana sayfadayız
                break;
            case 'Motor Durumları':
                showNotification('Motor durumları sayfası yapım aşamasında.', 'info');
                break;
            case 'Raporlar':
                showNotification('Raporlar sayfası yapım aşamasında.', 'info');
                break;
            case 'Bakım':
                showNotification('Bakım sayfası yapım aşamasında.', 'info');
                break;
            case 'Arızalar':
                showNotification('Arızalar sayfası yapım aşamasında.', 'info');
                break;
            case 'Kullanıcı Yönetimi':
                window.location.href = 'kullanici-yonetimi.html';
                break;
            default:
                break;
        }
    }

    // Bildirim sistemi
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;

        // Bildirim renkleri
        switch(type) {
            case 'success':
                notification.style.background = '#10b981';
                break;
            case 'error':
                notification.style.background = '#ef4444';
                break;
            case 'warning':
                notification.style.background = '#f59e0b';
                break;
            case 'info':
            default:
                notification.style.background = '#3b82f6';
                break;
        }

        document.body.appendChild(notification);

        // Otomatik kaldır
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Motor kartlarına tıklama olayı
    const motorCards = document.querySelectorAll('.motor-card');
    motorCards.forEach(card => {
        card.addEventListener('click', function() {
            const motorId = this.getAttribute('data-motor');
            const motorName = this.querySelector('h3').textContent;
            showNotification(`${motorName} detayları için sayfa yapım aşamasında.`, 'info');
        });
    });

    // Özet kartlarına tıklama olayı
    const summaryCards = document.querySelectorAll('.summary-card');
    summaryCards.forEach(card => {
        card.addEventListener('click', function() {
            const cardTitle = this.querySelector('h3').textContent;
            showNotification(`${cardTitle} detayları için sayfa yapım aşamasında.`, 'info');
        });
    });

    // Klavye kısayolları
    document.addEventListener('keydown', function(e) {
        // Ctrl + L: Çıkış yap
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            handleLogout();
        }
        
        // Ctrl + H: Ana sayfa
        if (e.ctrlKey && e.key === 'h') {
            e.preventDefault();
            window.location.href = 'anasayfa.html';
        }
        
        // Ctrl + U: Kullanıcı yönetimi
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            window.location.href = 'kullanici-yonetimi.html';
        }
    });

    // Sayfa görünürlük değişikliği
    document.addEventListener('visibilitychange', async function() {
        if (!document.hidden) {
            // Sayfa tekrar görünür olduğunda verileri güncelle
            await loadDashboardData();
        }
    });

    // Responsive menü kontrolü
    function checkResponsiveMenu() {
        if (window.innerWidth <= 768) {
            document.body.classList.add('mobile-view');
        } else {
            document.body.classList.remove('mobile-view');
        }
    }

    window.addEventListener('resize', checkResponsiveMenu);
    checkResponsiveMenu();
});

// CSS animasyonları için stil ekle
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .mobile-view .sidebar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: auto;
        width: 100%;
        z-index: 1000;
    }
    
    .mobile-view .main-content {
        margin-bottom: 80px;
    }
`;
document.head.appendChild(style);

// Kimlik doğrulama kontrolü
function checkAuth() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const user = JSON.parse(loggedInUser);
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // Tüm userNameDisplay elementlerini güncelle
        const allUserNameDisplays = document.querySelectorAll('[id="userNameDisplay"]');
        
        allUserNameDisplays.forEach((element, index) => {
            element.textContent = fullName || user.email || 'Kullanici';
        });
        
        console.log('Ana Sayfa - Kullanici adi ayarlandi:', fullName || user.email || 'Kullanici');
    } catch (e) {
        console.error('Ana Sayfa - Kullanici bilgileri okunamadi:', e);
        const allElements = document.querySelectorAll('[id="userNameDisplay"]');
        allElements.forEach(element => {
            element.textContent = 'Kullanici';
        });
    }
}

// ... (geri kalan kod)
