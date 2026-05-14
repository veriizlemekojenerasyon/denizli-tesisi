document.addEventListener('DOMContentLoaded', function() {
    // Kullanıcı giriş kontrolü
    checkAuth();
    
    // Motor verileri
    const motorData = {
        gm1: {
            totalProduction: 1250.5,
            dailyHours: 18.5,
            totalHours: 8760,
            dailyProduction: 2850,
            avgProduction: 154,
            progress: 75,
            status: 'running'
        },
        gm2: {
            totalProduction: 1180.2,
            dailyHours: 16.8,
            totalHours: 7520,
            dailyProduction: 2680,
            avgProduction: 160,
            progress: 68,
            status: 'running'
        },
        gm3: {
            totalProduction: 980.8,
            dailyHours: 0,
            totalHours: 5240,
            dailyProduction: 0,
            avgProduction: 0,
            progress: 0,
            status: 'stopped'
        }
    };

    // Günlük özet verileri
    const summaryData = {
        dailyProduction: 5.53,
        dailySteam: null, // Buhar verisinden çekilecek
        pendingMaintenance: 3,
        activeFaults: 1
    };

    // Buhar verisi config
    const BUHAR_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxnhHSmc5GTuOq8hdqgFM2-FA2XNjRdLHoED5gmjXbmWcYycPNXykdd0ZYTzOI3HNJxKg/exec';
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

    // Sayfa yüklendiğinde verileri göster
    setTimeout(async () => {
        updateAnnouncementTicker();
        updateMotorData();
        await loadBuharData(); // Buhar verisini çek
        updateSummaryData();
        animateProgressBars();
    }, 1000);

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

    async function getTodayAnnouncements() {
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

            // Günlük çalışma
            const dailyHoursEl = document.getElementById(`${motorId}-daily-hours`);
            if (dailyHoursEl) {
                animateValue(dailyHoursEl, 0, data.dailyHours, 1500, ' saat');
            }

            // Toplam çalışma
            const totalHoursEl = document.getElementById(`${motorId}-total-hours`);
            if (totalHoursEl) {
                animateValue(totalHoursEl, 0, data.totalHours, 1500, ' saat');
            }

            // Günlük üretim
            const dailyProductionEl = document.getElementById(`${motorId}-daily-production`);
            if (dailyProductionEl) {
                animateValue(dailyProductionEl, 0, data.dailyProduction, 1500, ' kWh');
            }

            // Ortalama üretim
            const avgProductionEl = document.getElementById(`${motorId}-avg-production`);
            if (avgProductionEl) {
                animateValue(avgProductionEl, 0, data.avgProduction, 1500, ' kWh/saat');
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
        // Günlük üretim
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
    function animateProgressBars() {
        for (const [motorId, data] of Object.entries(motorData)) {
            const progressEl = document.getElementById(`${motorId}-progress`);
            if (progressEl) {
                setTimeout(() => {
                    progressEl.style.width = `${data.progress}%`;
                }, 500);
            }
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

    // Gerçek zamanlı veri güncelleme simülasyonu
    setInterval(() => {
        // Rastgele veri değişiklikleri
        const motors = ['gm1', 'gm2', 'gm3'];
        const randomMotor = motors[Math.floor(Math.random() * motors.length)];
        
        if (motorData[randomMotor].status === 'running') {
            // Günlük üretimi güncelle
            motorData[randomMotor].dailyProduction += Math.floor(Math.random() * 10);
            motorData[randomMotor].dailyHours += 0.1;
            
            const dailyProductionEl = document.getElementById(`${randomMotor}-daily-production`);
            if (dailyProductionEl) {
                dailyProductionEl.textContent = motorData[randomMotor].dailyProduction + ' kWh';
            }
            
            const dailyHoursEl = document.getElementById(`${randomMotor}-daily-hours`);
            if (dailyHoursEl) {
                dailyHoursEl.textContent = motorData[randomMotor].dailyHours.toFixed(1) + ' saat';
            }
        }

        // Günlük özet verilerini güncelle
        summaryData.dailyProduction += 0.01;
        const dailyProductionEl = document.getElementById('daily-production-value');
        if (dailyProductionEl) {
            dailyProductionEl.textContent = summaryData.dailyProduction.toFixed(2) + ' MWh';
        }

    }, 10000); // Her 10 saniyede bir güncelle

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
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // Sayfa tekrar görünür olduğunda verileri güncelle
            updateMotorData();
            updateSummaryData();
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

// checkAuth fonksiyonunu çağır
checkAuth();

// ... (geri kalan kod)
