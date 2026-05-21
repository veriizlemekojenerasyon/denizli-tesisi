const BildirimSheetsConfig = {
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbz9uR24xQeuV85ygxfFiakRRJz601KgaKCgOlHcsuYDjUl5xkR4o3HbIVn-tgVdSnTF/exec'
};

function isBildirimSheetsEnabled() {
    return Boolean(BildirimSheetsConfig.WEB_APP_URL);
}

async function fetchAnnouncementsFromSheets(params = {}) {
    if (!isBildirimSheetsEnabled()) {
        return { success: false, fallback: true, error: 'Bildirim Apps Script URL tanimli degil' };
    }

    const url = new URL(BildirimSheetsConfig.WEB_APP_URL);
    url.searchParams.append('action', 'getAnnouncements');
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.append(key, value);
        }
    });

    const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
    return response.json();
}

async function saveAnnouncementToSheets(data, isUpdate = false) {
    return postAnnouncementAction(isUpdate ? 'updateAnnouncement' : 'addAnnouncement', data);
}

async function deleteAnnouncementFromSheets(id) {
    return postAnnouncementAction('deleteAnnouncement', { id });
}

async function setAnnouncementActiveOnSheets(id, active) {
    return postAnnouncementAction('setAnnouncementActive', { id, active });
}

async function clearInactiveAnnouncementsOnSheets() {
    return postAnnouncementAction('clearInactiveAnnouncements', {});
}

async function markAnnouncementReadOnSheets(id, reader, email = '') {
    return postAnnouncementAction('markAnnouncementRead', { id, reader, email });
}

async function completeAnnouncementOnSheets(id, reader, email = '') {
    return postAnnouncementAction('completeAnnouncement', { id, reader, email });
}

async function addSystemLogToSheets(data) {
    return postAnnouncementAction('addSystemLog', data);
}

async function fetchSystemLogsFromSheets(count = 100) {
    if (!isBildirimSheetsEnabled()) {
        return { success: false, fallback: true, error: 'Bildirim Apps Script URL tanimli degil' };
    }

    const url = new URL(BildirimSheetsConfig.WEB_APP_URL);
    url.searchParams.append('action', 'getSystemLogs');
    url.searchParams.append('count', String(count));
    const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
    return response.json();
}

async function postAnnouncementAction(action, data) {
    if (!isBildirimSheetsEnabled()) {
        return { success: false, fallback: true, error: 'Bildirim Apps Script URL tanimli degil' };
    }

    const params = new URLSearchParams({ action });
    Object.entries(data || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            params.append(key, value);
        }
    });

    const response = await fetch(BildirimSheetsConfig.WEB_APP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    return response.json();
}

window.BildirimSheetsConfig = BildirimSheetsConfig;
window.isBildirimSheetsEnabled = isBildirimSheetsEnabled;
window.fetchAnnouncementsFromSheets = fetchAnnouncementsFromSheets;
window.saveAnnouncementToSheets = saveAnnouncementToSheets;
window.deleteAnnouncementFromSheets = deleteAnnouncementFromSheets;
window.setAnnouncementActiveOnSheets = setAnnouncementActiveOnSheets;
window.clearInactiveAnnouncementsOnSheets = clearInactiveAnnouncementsOnSheets;
window.markAnnouncementReadOnSheets = markAnnouncementReadOnSheets;
window.completeAnnouncementOnSheets = completeAnnouncementOnSheets;
window.addSystemLogToSheets = addSystemLogToSheets;
window.fetchSystemLogsFromSheets = fetchSystemLogsFromSheets;
