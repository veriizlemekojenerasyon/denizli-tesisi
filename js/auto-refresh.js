/**
 * Sayfalari kontrollu yeniler.
 * - En az 5 dakika bekler.
 * - Sadece guvenli cift dakikalarda yeniler.
 * - Otomatik kayit kontrol saati olan xx:59'a yaklasirken yenilemez.
 * - Formda girilmis/kaydedilmemis veri varsa yenilemeyi erteler.
 */
(function () {
    const MIN_REFRESH_AGE_MS = 5 * 60 * 1000;
    const CHECK_INTERVAL_MS = 30 * 1000;
    const LAST_REFRESH_KEY = 'autoRefresh:lastReloadAt';
    const startedAt = Date.now();
    let hasUnsavedInput = false;

    const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
    const formPages = [
        'saatlik-veri-giris.html',
        'kojen-motor-veri.html',
        'kojen-enerji-veri.html',
        'vardiya.html'
    ];
    const shouldWatchForms = formPages.includes(currentPage);

    if (shouldWatchForms) {
        document.addEventListener('input', markDirty, true);
        document.addEventListener('change', markDirty, true);
        document.addEventListener('submit', markClean, true);
    }

    window.autoRefreshMarkClean = markClean;
    window.autoRefreshMarkDirty = markDirty;

    function markDirty(event) {
        if (!event || !event.target) return;
        if (!event.target.matches('input, textarea, select')) return;
        hasUnsavedInput = true;
    }

    function markClean() {
        hasUnsavedInput = false;
    }

    function isSafeRefreshMinute(date) {
        const minute = date.getMinutes();
        return minute % 2 === 0 && minute <= 54;
    }

    function shouldRefreshNow() {
        if (Date.now() - startedAt < MIN_REFRESH_AGE_MS) return false;
        if (hasUnsavedInput) return false;

        const lastRefreshAt = parseInt(localStorage.getItem(LAST_REFRESH_KEY) || '0', 10);
        if (lastRefreshAt && Date.now() - lastRefreshAt < MIN_REFRESH_AGE_MS) return false;

        return isSafeRefreshMinute(new Date());
    }

    window.setInterval(function () {
        if (!shouldRefreshNow()) return;
        localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
        window.location.reload();
    }, CHECK_INTERVAL_MS);
})();
