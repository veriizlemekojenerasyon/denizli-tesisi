const ANNOUNCEMENTS_STORAGE_KEY = 'shiftAnnouncements';

let announcements = [];
let editingId = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    setDefaultDate();
    setupEvents();
    loadAnnouncements();
});

function checkAuth() {
    const logged = localStorage.getItem('loggedInUser');
    if (!logged) {
        showLockScreen('Bu sayfayi kullanmak icin giris yapmalisiniz.');
        return false;
    }

    try {
        currentUser = JSON.parse(logged);
        if (currentUser.role !== 'admin') {
            showLockScreen('Bu sayfa sadece admin kullanicilar icindir.');
            return false;
        }

        const name = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'Admin';
        document.getElementById('currentUserName').textContent = name;
        return true;
    } catch (error) {
        showLockScreen('Oturum bilgisi okunamadi. Lutfen tekrar giris yapin.');
        return false;
    }
}

function showLockScreen(message) {
    document.body.innerHTML = `
        <div class="container">
            <div class="page-header">
                <div>
                    <h1>Yetki Gerekli</h1>
                    <p>${message}</p>
                </div>
                <a href="anasayfa.html" class="btn btn-secondary">Ana Sayfa</a>
            </div>
        </div>`;
}

function setDefaultDate() {
    const startDateInput = document.getElementById('announcementStartDate');
    if (startDateInput && !startDateInput.value) {
        startDateInput.value = new Date().toISOString().split('T')[0];
    }
}

function setupEvents() {
    document.getElementById('announcementForm').addEventListener('submit', saveAnnouncement);
    document.getElementById('btnReset').addEventListener('click', resetForm);
    document.getElementById('btnClearInactive').addEventListener('click', clearInactiveAnnouncements);
}

async function loadAnnouncements() {
    try {
        if (window.fetchAnnouncementsFromSheets && window.isBildirimSheetsEnabled?.()) {
            const result = await fetchAnnouncementsFromSheets();
            if (result.success) {
                announcements = result.data || [];
                localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(announcements));
                renderAnnouncements();
                return;
            }
        }

        loadAnnouncementsFromLocal();
    } catch (error) {
        loadAnnouncementsFromLocal();
    }

    renderAnnouncements();
}

function loadAnnouncementsFromLocal() {
    try {
        const stored = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY) || '[]');
        announcements = Array.isArray(stored) ? stored : [];
    } catch (error) {
        announcements = [];
    }
}

function persistAnnouncements() {
    localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(announcements));
}

async function saveAnnouncement(event) {
    event.preventDefault();

    const title = document.getElementById('announcementTitle').value.trim();
    if (!title) return;

    const attachment = await getSelectedAttachment();
    const existingAttachmentUrl = document.getElementById('announcementAttachmentUrl').value;
    const existingAttachmentName = document.getElementById('announcementAttachmentName').value;

    const record = {
        id: editingId || createId(),
        title,
        startDate: document.getElementById('announcementStartDate').value,
        endDate: document.getElementById('announcementEndDate').value,
        category: document.getElementById('announcementCategory').value,
        shift: document.getElementById('announcementShift').value,
        priority: document.getElementById('announcementPriority').value,
        target: document.getElementById('announcementTarget').value,
        pageTarget: document.getElementById('announcementPageTarget').value,
        active: document.getElementById('announcementActive').checked,
        attachmentUrl: existingAttachmentUrl,
        attachmentName: existingAttachmentName,
        createdBy: getCurrentUserName(),
        updatedAt: new Date().toISOString()
    };

    if (attachment) {
        record.attachmentData = attachment.data;
        record.attachmentName = attachment.name;
        record.attachmentType = attachment.type;
    }

    if (window.saveAnnouncementToSheets && window.isBildirimSheetsEnabled?.()) {
        const result = await saveAnnouncementToSheets(record, Boolean(editingId));
        if (!result.success) {
            alert('Google Sheets kayit hatasi: ' + (result.error || 'Bilinmeyen hata'));
            return;
        }

        await loadAnnouncements();
        window.SystemAuditLog?.write?.(editingId ? 'Bildirim guncellendi' : 'Bildirim eklendi', title, 'ok');
        resetForm();
        return;
    }

    saveAnnouncementLocally(record);
    persistAnnouncements();
    window.SystemAuditLog?.write?.(editingId ? 'Bildirim guncellendi' : 'Bildirim eklendi', title, 'ok');
    resetForm();
    renderAnnouncements();
}

function saveAnnouncementLocally(record) {
    if (editingId) {
        announcements = announcements.map(item => item.id === editingId ? { ...item, ...record } : item);
    } else {
        record.createdAt = new Date().toISOString();
        announcements.unshift(record);
    }
}

function createId() {
    return `ann-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCurrentUserName() {
    if (!currentUser) return 'Admin';
    return `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'Admin';
}

function resetForm() {
    editingId = null;
    document.getElementById('formTitle').textContent = 'Yeni Bildirim';
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementActive').checked = true;
    document.getElementById('announcementAttachmentUrl').value = '';
    document.getElementById('announcementAttachmentName').value = '';
    setDefaultDate();
}

function renderAnnouncements() {
    const list = document.getElementById('announcementList');
    const count = document.getElementById('announcementCount');
    const preview = document.getElementById('previewText');

    count.textContent = `${announcements.length} bildirim`;
    list.innerHTML = '';

    const activeAnnouncements = announcements.filter(item => item.active !== false);
    preview.textContent = activeAnnouncements.length
        ? activeAnnouncements.map(item => item.title).join('  |  ')
        : 'Aktif bildirim yok.';

    if (announcements.length === 0) {
        list.innerHTML = '<div class="empty-state">Henuz bildirim yok. Soldaki formdan ilk duyuruyu ekleyin.</div>';
        return;
    }

    announcements.forEach(item => {
        const card = document.createElement('article');
        card.className = `announcement-card ${item.priority || 'normal'} category-${item.category || 'general'} ${item.active === false ? 'inactive' : ''}`;
        card.innerHTML = `
            <div class="announcement-text">${escapeHtml(item.title)}</div>
            <div class="announcement-meta">
                <span class="badge">${formatDateRange(item)}</span>
                <span class="badge">${formatCategory(item.category)}</span>
                <span class="badge">${item.shift || 'Tum vardiyalar'}</span>
                <span class="badge">${formatPageTarget(item.pageTarget)}</span>
                <span class="badge">${formatPriority(item.priority)}</span>
                <span class="badge">${getReadCount(item)} okundu</span>
                <span class="badge">${item.completed ? 'Tamamlandi' : 'Bekliyor'}</span>
                <span class="badge">${item.active === false ? 'Pasif' : 'Aktif'}</span>
            </div>
            ${item.attachmentUrl ? `<a class="attachment-link" href="${escapeHtml(item.attachmentUrl)}" target="_blank" rel="noopener">${escapeHtml(item.attachmentName || 'Eki ac')}</a>` : ''}
            <div class="card-actions">
                <button type="button" class="btn btn-secondary" data-action="toggle" data-id="${item.id}">${item.active === false ? 'Yayinla' : 'Pasif Yap'}</button>
                <button type="button" class="btn btn-secondary" data-action="complete" data-id="${item.id}">Tamamlandi</button>
                <button type="button" class="btn btn-primary" data-action="edit" data-id="${item.id}">Duzenle</button>
                <button type="button" class="btn btn-danger" data-action="delete" data-id="${item.id}">Sil</button>
            </div>
        `;
        list.appendChild(card);
    });

    list.querySelectorAll('button[data-action]').forEach(button => {
        button.addEventListener('click', handleListAction);
    });
}

async function handleListAction(event) {
    const action = event.currentTarget.dataset.action;
    const id = event.currentTarget.dataset.id;
    const item = announcements.find(record => record.id === id);
    if (!item) return;

    if (action === 'edit') {
        editingId = id;
        document.getElementById('formTitle').textContent = 'Bildirimi Duzenle';
        document.getElementById('announcementTitle').value = item.title || '';
        document.getElementById('announcementStartDate').value = toInputDate(item.startDate || item.date || '');
        document.getElementById('announcementEndDate').value = toInputDate(item.endDate || '');
        document.getElementById('announcementCategory').value = item.category || 'general';
        document.getElementById('announcementShift').value = item.shift || '';
        document.getElementById('announcementPriority').value = item.priority || 'normal';
        document.getElementById('announcementTarget').value = item.target || 'all';
        document.getElementById('announcementPageTarget').value = item.pageTarget || 'all';
        document.getElementById('announcementActive').checked = item.active !== false;
        document.getElementById('announcementAttachment').value = '';
        document.getElementById('announcementAttachmentUrl').value = item.attachmentUrl || '';
        document.getElementById('announcementAttachmentName').value = item.attachmentName || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (action === 'toggle') {
        const nextActive = item.active === false;
        if (window.setAnnouncementActiveOnSheets && window.isBildirimSheetsEnabled?.()) {
            const result = await setAnnouncementActiveOnSheets(id, nextActive);
            if (!result.success) {
                alert('Durum guncellenemedi: ' + (result.error || 'Bilinmeyen hata'));
                return;
            }
            window.SystemAuditLog?.write?.('Bildirim durumu degisti', item.title || id, 'ok');
            await loadAnnouncements();
            return;
        }

        item.active = nextActive;
        item.updatedAt = new Date().toISOString();
        persistAnnouncements();
        window.SystemAuditLog?.write?.('Bildirim durumu degisti', item.title || id, 'ok');
        renderAnnouncements();
        return;
    }

    if (action === 'complete') {
        if (window.completeAnnouncementOnSheets && window.isBildirimSheetsEnabled?.()) {
            const result = await completeAnnouncementOnSheets(id, getCurrentUserName(), currentUser?.email || '');
            if (!result.success) {
                alert('Bildirim tamamlanamadi: ' + (result.error || 'Bilinmeyen hata'));
                return;
            }
            window.SystemAuditLog?.write?.('Bildirim tamamlandi', item.title || id, 'ok');
            await loadAnnouncements();
            return;
        }

        item.completed = true;
        item.completedBy = item.completedBy || [];
        item.completedBy.push({ reader: getCurrentUserName(), email: currentUser?.email || '', readAt: new Date().toISOString() });
        item.updatedAt = new Date().toISOString();
        persistAnnouncements();
        window.SystemAuditLog?.write?.('Bildirim tamamlandi', item.title || id, 'ok');
        renderAnnouncements();
        return;
    }

    if (action === 'delete' && confirm('Bu bildirimi silmek istiyor musunuz?')) {
        if (window.deleteAnnouncementFromSheets && window.isBildirimSheetsEnabled?.()) {
            const result = await deleteAnnouncementFromSheets(id);
            if (!result.success) {
                alert('Bildirim silinemedi: ' + (result.error || 'Bilinmeyen hata'));
                return;
            }
            window.SystemAuditLog?.write?.('Bildirim silindi', item.title || id, 'warn');
            await loadAnnouncements();
            return;
        }

        announcements = announcements.filter(record => record.id !== id);
        persistAnnouncements();
        window.SystemAuditLog?.write?.('Bildirim silindi', item.title || id, 'warn');
        renderAnnouncements();
    }
}

async function clearInactiveAnnouncements() {
    const inactiveCount = announcements.filter(item => item.active === false).length;
    if (inactiveCount === 0) return;
    if (!confirm(`${inactiveCount} pasif bildirim silinsin mi?`)) return;

    if (window.clearInactiveAnnouncementsOnSheets && window.isBildirimSheetsEnabled?.()) {
        const result = await clearInactiveAnnouncementsOnSheets();
        if (!result.success) {
            alert('Pasif bildirimler silinemedi: ' + (result.error || 'Bilinmeyen hata'));
            return;
        }
        window.SystemAuditLog?.write?.('Pasif bildirimler silindi', `${inactiveCount} kayit`, 'warn');
        await loadAnnouncements();
        return;
    }

    announcements = announcements.filter(item => item.active !== false);
    persistAnnouncements();
    window.SystemAuditLog?.write?.('Pasif bildirimler silindi', `${inactiveCount} kayit`, 'warn');
    renderAnnouncements();
}

function formatDateRange(item) {
    const start = item.startDate || item.date || '';
    const end = item.endDate || '';
    if (!start && !end) return 'Tum tarihler';
    if (!end || end === start) return formatDate(start);
    return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatDate(value) {
    if (!value) return 'Tum tarihler';
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
}

function toInputDate(value) {
    if (!value) return '';
    if (value.includes('-')) return value;
    const parts = value.split('.');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
}

function formatPriority(value) {
    const labels = {
        high: 'Kritik',
        medium: 'Orta',
        normal: 'Normal'
    };
    return labels[value] || 'Normal';
}

function formatCategory(value) {
    const labels = {
        operation: 'Isletme',
        maintenance: 'Bakim',
        safety: 'Guvenlik',
        shift: 'Vardiya',
        general: 'Genel'
    };
    return labels[value] || 'Genel';
}

function formatPageTarget(value) {
    const labels = {
        all: 'Tum sayfalar',
        anasayfa: 'Ana sayfa',
        vardiya: 'Vardiya',
        saatlik: 'Saatlik',
        'kojen-motor': 'Kojen Motor',
        'kojen-enerji': 'Kojen Enerji',
        bakim: 'Bakim',
        stok: 'Stok',
        admin: 'Admin'
    };
    return labels[value || 'all'] || 'Tum sayfalar';
}

function getReadCount(item) {
    if (Array.isArray(item.readBy)) return item.readBy.length;
    if (!item.readBy) return 0;
    return String(item.readBy).split(',').filter(Boolean).length;
}

function getSelectedAttachment() {
    const input = document.getElementById('announcementAttachment');
    const file = input?.files?.[0];
    if (!file) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            resolve({
                name: file.name,
                type: file.type || 'application/octet-stream',
                data: dataUrl.split(',')[1] || ''
            });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
