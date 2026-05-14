(function() {
    const STORAGE_KEY = 'shiftAnnouncements';
    const READS_KEY = 'announcementReads';
    const SHEETS_SCRIPT = 'js/bildirim-sheets.js';
    const TICKER_ID = 'globalAnnouncementTicker';

    const fallbackAnnouncements = [
        {
            title: 'Vardiya tesliminde yapilan isler ve bekleyen konular vardiya notuna yazilacak',
            priority: 'normal',
            category: 'shift'
        }
    ];

    document.addEventListener('DOMContentLoaded', initGlobalAnnouncements);

    async function initGlobalAnnouncements() {
        if (document.getElementById(TICKER_ID)) return;
        if (document.getElementById('announcementTickerTrack')) return;

        const host = findAnnouncementHost();
        if (!host) return;

        injectStyles();
        const ticker = createTicker();
        host.insertBefore(ticker, host.firstElementChild || null);

        await ensureBildirimSheets();
        const announcements = await getVisibleAnnouncements();
        renderTicker(ticker, announcements);
    }

    function findAnnouncementHost() {
        return document.querySelector('.dashboard-content') ||
            document.querySelector('main.content') ||
            document.querySelector('main') ||
            document.querySelector('.content-area') ||
            document.querySelector('.main-content-area') ||
            document.querySelector('.container');
    }

    function createTicker() {
        const section = document.createElement('section');
        section.id = TICKER_ID;
        section.className = 'global-announcement-ticker';
        section.setAttribute('aria-label', 'Vardiya duyurulari');
        section.innerHTML = `
            <div class="global-ticker-label">
                <span class="global-ticker-dot"></span>
                <span>Vardiya Duyurulari</span>
            </div>
            <div class="global-ticker-window">
                <div class="global-ticker-track">
                    <span class="global-ticker-item">Duyurular yukleniyor...</span>
                </div>
            </div>
            <button type="button" class="global-ticker-action">Detay</button>
        `;
        return section;
    }

    function renderTicker(ticker, announcements) {
        const track = ticker.querySelector('.global-ticker-track');
        const detailButton = ticker.querySelector('.global-ticker-action');
        const items = announcements.length ? announcements : [];

        track.innerHTML = '';
        if (items.length === 0) {
            track.appendChild(createTickerItem('Bugun icin aktif vardiya duyurusu bulunmuyor.', 'normal', 'general'));
            track.style.animation = 'none';
        } else {
            [...items, ...items].forEach(item => {
                track.appendChild(createTickerItem(formatTickerText(item), item.priority, item.category));
            });
            track.style.animation = items.length === 1 ? 'globalTickerScroll 24s linear infinite' : '';
        }

        detailButton.addEventListener('click', async function() {
            await markVisibleAnnouncementsRead(items);
            const message = items.map((item, index) => {
                const attachment = item.attachmentUrl ? `\n   Ek: ${item.attachmentUrl}` : '';
                return `${index + 1}. ${formatTickerText(item)}${attachment}`;
            }).join('\n');
            alert(message || 'Bugun icin aktif vardiya duyurusu bulunmuyor.');
        });

        showCriticalPopup(items);
    }

    function createTickerItem(text, priority = 'normal', category = 'general') {
        const item = document.createElement('span');
        item.className = `global-ticker-item ${priority || 'normal'} category-${category || 'general'}`;
        item.textContent = text;
        return item;
    }

    async function getVisibleAnnouncements() {
        if (window.fetchAnnouncementsFromSheets && window.isBildirimSheetsEnabled?.()) {
            try {
                const result = await window.fetchAnnouncementsFromSheets({ active: 'true' });
                if (result.success && Array.isArray(result.data)) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
                    return filterAnnouncements(result.data);
                }
            } catch (error) {
                console.error('Vardiya duyurulari Sheets uzerinden okunamadi:', error);
            }
        }

        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            const source = Array.isArray(stored) && stored.length ? stored : fallbackAnnouncements;
            return filterAnnouncements(source);
        } catch (error) {
            console.error('Vardiya duyurulari yerel kayittan okunamadi:', error);
            return filterAnnouncements(fallbackAnnouncements);
        }
    }

    function filterAnnouncements(items) {
        const today = formatDateInputValue(new Date());
        const user = getLoggedInUser();
        return items.filter(item =>
            item.active !== false &&
            matchesDateRange(item, today) &&
            matchesTarget(item, user) &&
            matchesPageTarget(item)
        );
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

    function matchesPageTarget(item) {
        const target = item.pageTarget || 'all';
        if (target === 'all') return true;

        const page = (location.pathname.split('/').pop() || 'anasayfa.html').replace('.html', '');
        const groups = {
            anasayfa: ['anasayfa'],
            vardiya: ['vardiya'],
            saatlik: ['saatlik-veri-giris'],
            'kojen-motor': ['kojen-motor-veri'],
            'kojen-enerji': ['kojen-enerji-veri'],
            bakim: ['bakim-takibi'],
            stok: ['stok-takip'],
            admin: ['admin-bildirim', 'admin-kontrol', 'kullanici-yonetimi', 'motor-takip']
        };

        return (groups[target] || []).includes(page);
    }

    function formatTickerText(item) {
        const category = formatCategory(item.category);
        const text = item.title || item.message || 'Duyuru metni yok';
        return category ? `${category}: ${text}` : text;
    }

    function formatCategory(value) {
        const labels = {
            operation: 'Isletme',
            maintenance: 'Bakim',
            safety: 'Guvenlik',
            shift: 'Vardiya',
            general: 'Genel'
        };
        return labels[value] || '';
    }

    async function markVisibleAnnouncementsRead(announcements) {
        if (!announcements.length) return;

        const user = getLoggedInUser();
        const reader = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Kullanici';
        let storedReads = {};

        try {
            storedReads = JSON.parse(localStorage.getItem(READS_KEY) || '{}');
        } catch (error) {
            storedReads = {};
        }

        announcements.forEach(item => {
            if (item.id) storedReads[item.id] = true;
        });
        localStorage.setItem(READS_KEY, JSON.stringify(storedReads));

        if (!window.markAnnouncementReadOnSheets || !window.isBildirimSheetsEnabled?.()) return;
        try {
            await Promise.all(announcements.filter(item => item.id).map(item =>
                window.markAnnouncementReadOnSheets(item.id, reader, user?.email || '')
            ));
        } catch (error) {
            console.error('Duyuru okundu bilgisi kaydedilemedi:', error);
        }
    }

    function showCriticalPopup(announcements) {
        const critical = announcements.find(item => item.priority === 'high' && !item.completed);
        if (!critical) return;

        const key = `criticalAnnouncementPopup:${critical.id || critical.title}`;
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, new Date().toISOString());

        const overlay = document.createElement('div');
        overlay.className = 'critical-announcement-overlay';
        overlay.innerHTML = `
            <div class="critical-announcement-modal" role="dialog" aria-modal="true">
                <div class="critical-announcement-kicker">Kritik Duyuru</div>
                <h2>${escapeHtml(critical.title || critical.message || 'Kritik duyuru')}</h2>
                <p>${escapeHtml(formatTickerText(critical))}</p>
                <div class="critical-announcement-actions">
                    <button type="button" class="critical-btn secondary" data-action="read">Okudum</button>
                    <button type="button" class="critical-btn primary" data-action="complete">Tamamlandi</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('[data-action="read"]').addEventListener('click', async () => {
            await markVisibleAnnouncementsRead([critical]);
            overlay.remove();
        });

        overlay.querySelector('[data-action="complete"]').addEventListener('click', async () => {
            await completeAnnouncement(critical);
            overlay.remove();
        });
    }

    async function completeAnnouncement(item) {
        const user = getLoggedInUser();
        const reader = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Kullanici';
        if (item.id && window.completeAnnouncementOnSheets && window.isBildirimSheetsEnabled?.()) {
            try {
                await window.completeAnnouncementOnSheets(item.id, reader, user?.email || '');
            } catch (error) {
                console.error('Duyuru tamamlandi bilgisi kaydedilemedi:', error);
            }
        }
    }

    function getLoggedInUser() {
        try {
            return JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        } catch (error) {
            return null;
        }
    }

    function toIsoDate(value) {
        if (!value) return '';
        const text = String(value).trim();
        if (text.includes('-')) return text;
        const parts = text.split('.');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
    }

    function formatDateInputValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function ensureBildirimSheets() {
        if (window.fetchAnnouncementsFromSheets) return Promise.resolve();
        if (document.querySelector(`script[src="${SHEETS_SCRIPT}"]`)) {
            return waitForSheetsApi();
        }

        return new Promise(resolve => {
            const script = document.createElement('script');
            script.src = SHEETS_SCRIPT;
            script.onload = resolve;
            script.onerror = resolve;
            document.head.appendChild(script);
        });
    }

    function waitForSheetsApi() {
        return new Promise(resolve => {
            let attempts = 0;
            const timer = setInterval(() => {
                attempts++;
                if (window.fetchAnnouncementsFromSheets || attempts > 20) {
                    clearInterval(timer);
                    resolve();
                }
            }, 50);
        });
    }

    function injectStyles() {
        if (document.getElementById('globalAnnouncementStyles')) return;
        const style = document.createElement('style');
        style.id = 'globalAnnouncementStyles';
        style.textContent = `
            .global-announcement-ticker {
                display: grid;
                grid-template-columns: auto minmax(0, 1fr) auto;
                align-items: center;
                gap: 14px;
                min-height: 54px;
                margin: 0 0 22px;
                padding: 10px 12px 10px 16px;
                background: #ffffff;
                border: 1px solid #d7e3f4;
                border-left: 5px solid #e94560;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(31, 47, 70, 0.08);
                overflow: hidden;
            }

            .global-ticker-label {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
                color: #2c3e50;
                font-size: 13px;
                font-weight: 700;
                text-transform: uppercase;
            }

            .global-ticker-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #e94560;
                box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.14);
            }

            .global-ticker-window {
                min-width: 0;
                overflow: hidden;
            }

            .global-ticker-track {
                display: inline-flex;
                align-items: center;
                gap: 34px;
                white-space: nowrap;
                min-width: max-content;
                animation: globalTickerScroll 36s linear infinite;
            }

            .global-announcement-ticker:hover .global-ticker-track {
                animation-play-state: paused;
            }

            .global-ticker-item {
                color: #34495e;
                font-size: 15px;
                font-weight: 600;
            }

            .global-ticker-item.high,
            .global-ticker-item.category-safety {
                color: #b91c1c;
            }

            .global-ticker-item.medium {
                color: #9a5b00;
            }

            .global-ticker-item.category-maintenance,
            .global-ticker-item.category-operation {
                text-decoration: underline;
                text-underline-offset: 4px;
            }

            .global-ticker-item.category-maintenance {
                text-decoration-color: #0ea5e9;
            }

            .global-ticker-item.category-operation {
                text-decoration-color: #16a34a;
            }

            .global-ticker-action {
                border: 0;
                border-radius: 6px;
                padding: 9px 12px;
                background: #1f6feb;
                color: #ffffff;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
            }

            .global-ticker-action:hover {
                background: #185abc;
            }

            .critical-announcement-overlay {
                position: fixed;
                inset: 0;
                z-index: 20000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(15, 23, 42, 0.62);
            }

            .critical-announcement-modal {
                width: min(520px, 100%);
                padding: 24px;
                border-radius: 8px;
                background: #ffffff;
                border-top: 6px solid #dc2626;
                box-shadow: 0 24px 70px rgba(15, 23, 42, 0.32);
            }

            .critical-announcement-kicker {
                margin-bottom: 8px;
                color: #dc2626;
                font-size: 13px;
                font-weight: 800;
                text-transform: uppercase;
            }

            .critical-announcement-modal h2 {
                margin: 0 0 10px;
                color: #111827;
                font-size: 24px;
            }

            .critical-announcement-modal p {
                margin: 0 0 18px;
                color: #334155;
                font-size: 15px;
                line-height: 1.5;
            }

            .critical-announcement-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }

            .critical-btn {
                min-height: 44px;
                border: 0;
                border-radius: 7px;
                padding: 10px 15px;
                font-weight: 800;
                cursor: pointer;
            }

            .critical-btn.primary {
                color: #ffffff;
                background: #dc2626;
            }

            .critical-btn.secondary {
                color: #1d4ed8;
                background: #dbeafe;
            }

            @keyframes globalTickerScroll {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
            }

            @media (max-width: 768px) {
                .global-announcement-ticker {
                    grid-template-columns: 1fr auto;
                    gap: 8px;
                }

                .global-ticker-label {
                    grid-column: 1 / -1;
                }
            }
        `;
        document.head.appendChild(style);
    }
})();
