// Kullanici Yonetimi JavaScript - Ayrik Dosya
const USER_URL = 'https://script.google.com/macros/s/AKfycbzt8MaQa9ikOO8gS0WbLhKjxJoFMXIrtj0It1U-8yMyQhFRE1rBnKlHJeG31n0tnnWB/exec';

let users = [];
let filteredUsers = [];
let currentPage = 1;
const usersPerPage = 10;
let currentUser = null;
let currentEditId = null;
let deleteUserId = null;
let userPhotoData = null;

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    loadUsers();
    setupEvents();
    updateStats();
});

function checkAuth() {
    const logged = localStorage.getItem('loggedInUser');
    if (!logged) {
        showLockScreen('giris');
        return false;
    }
    
    try {
        currentUser = JSON.parse(logged);
        if (currentUser.role !== 'admin') {
            showLockScreen('yetki');
            return false;
        }
        
        const display = document.getElementById('currentUserName');
        if (display) {
            const firstName = currentUser.firstName || currentUser.ad || currentUser['Ad'] || '';
            const lastName = currentUser.lastName || currentUser.soyad || currentUser['Soyad'] || '';
            display.textContent = (firstName + ' ' + lastName).trim() || currentUser.email || 'Kullanici';
        }
        return true;
    } catch (e) {
        localStorage.removeItem('loggedInUser');
        showLockScreen('hata');
        return false;
    }
}

function showLockScreen(type) {
    const messages = {
        giris: { title: '🔒 Giris Gerekli', text: 'Lutfen index.html sayfasindan giris yapin.' },
        yetki: { title: '🚫 Yetkisiz Erisim', text: 'Bu sayfa sadece admin kullanicilar icindir.' },
        hata: { title: '⚠️ Oturum Hatasi', text: 'Oturumunuz sonlandi. Lutfen tekrar giris yapin.' }
    };
    
    const msg = messages[type] || messages.giris;
    document.body.innerHTML = `
        <div class="container">
            <div class="lock-screen">
                <h2>${msg.title}</h2>
                <p>${msg.text}</p>
                <p><a href="anasayfa.html">Ana Sayfaya Git</a></p>
            </div>
        </div>`;
}

function setupEvents() {
    document.getElementById('btnLogout')?.addEventListener('click', logout);
    document.getElementById('btnAddUser')?.addEventListener('click', openAddModal);
    document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
    document.getElementById('btnCancel')?.addEventListener('click', closeModal);
    document.getElementById('btnSave')?.addEventListener('click', saveUser);
    document.getElementById('btnCancelDelete')?.addEventListener('click', closeDeleteModal);
    document.getElementById('btnConfirmDelete')?.addEventListener('click', confirmDelete);
    
    document.getElementById('searchInput')?.addEventListener('input', filterUsers);
    document.getElementById('filterRole')?.addEventListener('change', filterUsers);
    document.getElementById('filterStatus')?.addEventListener('change', filterUsers);
    
    document.getElementById('photoInput')?.addEventListener('change', previewPhoto);
    
    document.getElementById('prevPage')?.addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage')?.addEventListener('click', () => changePage(1));
    
    document.querySelector('.modal-overlay')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
}

function logout() {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('currentUser');
    alert('Cikis yapildi!');
    window.location.href = 'anasayfa.html';
}

async function loadUsers() {
    showLoading(true);
    try {
        const res = await fetch(USER_URL + '?action=getAllUsers');
        const data = await res.json();
        if (data.success && data.users) {
            users = data.users;
        } else {
            users = [];
            showNotif('Google Sheets baglanti hatasi!', 'error');
        }
    } catch (e) {
        users = [];
        showNotif('Sunucuya ulasilamadi: ' + e.message, 'error');
    }
    filteredUsers = [...users];
    renderUsers();
    updateStats();
    showLoading(false);
}

function getDefaultUsers() {
    return [
        { id: 1, firstName: 'Admin', lastName: 'Kullanici', email: 'admin@sistem.com', role: 'admin', status: 'active', photo: '', createdAt: new Date().toLocaleDateString('tr-TR') },
        { id: 2, firstName: 'Operator', lastName: 'Test', email: 'operator@sistem.com', role: 'operator', status: 'active', photo: '', createdAt: new Date().toLocaleDateString('tr-TR') }
    ];
}

function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    const start = (currentPage - 1) * usersPerPage;
    const pageUsers = filteredUsers.slice(start, start + usersPerPage);
    
    tbody.innerHTML = pageUsers.length === 0
        ? '<tr><td colspan="7" style="text-align:center;padding:40px;">Kullanici bulunamadi</td></tr>'
        : pageUsers.map(u => `
            <tr>
                <td><img src="${u.photo || (u.role === 'admin' ? 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%234a90d9%22/><path d=%22M20 8c3 0 5.5 2.5 5.5 5.5S23 19 20 19s-5.5-2.5-5.5-5.5S17 8 20 8zm0 12c5.5 0 11 2.8 11 8.3V32H9v-3.7c0-5.5 5.5-8.3 11-8.3z%22 fill=%22white%22/></svg>' : 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2327ae60%22/><path d=%22M20 8c3 0 5.5 2.5 5.5 5.5S23 19 20 19s-5.5-2.5-5.5-5.5S17 8 20 8zm0 12c5.5 0 11 2.8 11 8.3V32H9v-3.7c0-5.5 5.5-8.3 11-8.3z%22 fill=%22white%22/></svg>')}" class="user-avatar" alt="${u.firstName}"></td>
                <td><div class="user-name">${u.firstName} ${u.lastName}</div><div class="user-email">${u.email}</div></td>
                <td>${u.email}</td>
                <td><span class="badge badge-${u.role}">${u.role === 'admin' ? 'Admin' : 'Operator'}</span></td>
                <td><span class="badge badge-${u.status}">${u.status === 'active' ? 'Aktif' : 'Pasif'}</span></td>
                <td>${u.createdAt || '-'}</td>
                <td>
                    <div class="actions">
                        <button class="btn-icon btn-edit" onclick="editUser(${u.id})" title="Duzenle">✏️</button>
                        <button class="btn-icon btn-delete" onclick="deleteUser(${u.id})" ${u.id === 1 ? 'disabled' : ''} title="Sil">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    
    updatePagination();
}

function updatePagination() {
    const total = Math.ceil(filteredUsers.length / usersPerPage);
    document.getElementById('pageInfo').textContent = `Sayfa ${currentPage} / ${total || 1}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage >= total;
}

function changePage(dir) {
    const total = Math.ceil(filteredUsers.length / usersPerPage);
    const newPage = currentPage + dir;
    if (newPage >= 1 && newPage <= total) {
        currentPage = newPage;
        renderUsers();
    }
}

function filterUsers() {
    const term = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const role = document.getElementById('filterRole')?.value || '';
    const status = document.getElementById('filterStatus')?.value || '';
    
    filteredUsers = users.filter(u => {
        const searchMatch = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(term);
        const roleMatch = !role || u.role === role;
        const statusMatch = !status || u.status === status;
        return searchMatch && roleMatch && statusMatch;
    });
    
    currentPage = 1;
    renderUsers();
}

function updateStats() {
    document.getElementById('statTotal').textContent = users.length;
    document.getElementById('statActive').textContent = users.filter(u => u.status === 'active').length;
    document.getElementById('statAdmin').textContent = users.filter(u => u.role === 'admin').length;
    document.getElementById('statOperator').textContent = users.filter(u => u.role === 'operator').length;
}

function openAddModal() {
    currentEditId = null;
    userPhotoData = null;
    document.getElementById('modalTitle').textContent = 'Yeni Kullanici Ekle';
    document.getElementById('userForm').reset();
    document.getElementById('previewImage').src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23e0e0e0%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2230%22>👤</text></svg>';
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('password').required = true;
    document.querySelector('.modal-overlay').classList.add('active');
}

function editUser(id) {
    const u = users.find(x => x.id === id);
    if (!u) return;
    
    currentEditId = id;
    userPhotoData = u.photo || null;
    document.getElementById('modalTitle').textContent = 'Kullanici Duzenle';
    document.getElementById('firstName').value = u.firstName;
    document.getElementById('lastName').value = u.lastName;
    document.getElementById('email').value = u.email;
    document.getElementById('role').value = u.role;
    document.getElementById('status').value = u.status;
    document.getElementById('previewImage').src = u.photo || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23e0e0e0%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2230%22>👤</text></svg>';
    document.getElementById('passwordGroup').style.display = 'none';
    document.getElementById('password').required = false;
    document.getElementById('password').value = '';
    document.querySelector('.modal-overlay').classList.add('active');
}

function closeModal() {
    document.querySelector('.modal-overlay').classList.remove('active');
}

function previewPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = ev => {
        userPhotoData = ev.target.result;
        document.getElementById('previewImage').src = userPhotoData;
    };
    reader.readAsDataURL(file);
}

async function saveUser() {
    const form = document.getElementById('userForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const data = {
        id: currentEditId || Date.now(),
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        role: document.getElementById('role').value,
        status: document.getElementById('status').value,
        photo: userPhotoData || '',
        createdAt: currentEditId ? (users.find(u => u.id === currentEditId)?.createdAt || new Date().toLocaleDateString('tr-TR')) : new Date().toLocaleDateString('tr-TR')
    };
    
    if (!currentEditId) {
        const pass = document.getElementById('password').value;
        if (pass.length < 6) {
            showNotif('Sifre en az 6 karakter olmali!', 'error');
            return;
        }
        data.password = pass;
    }
    
    if (users.find(u => u.email === data.email && u.id !== data.id)) {
        showNotif('Bu e-posta kullaniliyor!', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const action = currentEditId ? 'updateUser' : 'saveUser';
        const res = await fetch(USER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `action=${action}&data=${encodeURIComponent(JSON.stringify(data))}`
        });
        const result = await res.json();
        
        if (result.success) {
            // Google Sheets'ten yeniden yukle
            await loadUsers();
            closeModal();
            showNotif(currentEditId ? 'Guncellendi!' : 'Eklendi!', 'success');
        } else {
            showNotif('Kayit hatasi: ' + (result.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (e) {
        showNotif('Sunucu hatasi: ' + e.message, 'error');
    }
    
    showLoading(false);
}

function deleteUser(id) {
    if (id === 1) {
        showNotif('Admin silinemez!', 'error');
        return;
    }
    const u = users.find(x => x.id === id);
    if (!u) return;
    deleteUserId = id;
    document.getElementById('deleteUserName').textContent = `${u.firstName} ${u.lastName}`;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteUserId = null;
}

async function confirmDelete() {
    if (!deleteUserId) return;
    
    showLoading(true);
    const u = users.find(x => x.id === deleteUserId);
    
    try {
        const res = await fetch(USER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `action=deleteUser&data=${encodeURIComponent(JSON.stringify({ email: u.email }))}`
        });
        const result = await res.json();
        
        if (result.success) {
            await loadUsers();
            closeDeleteModal();
            showNotif('Silindi!', 'success');
        } else {
            showNotif('Silme hatasi: ' + (result.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (e) {
        showNotif('Sunucu hatasi: ' + e.message, 'error');
    }
    
    showLoading(false);
}

function showNotif(msg, type) {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 100);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
}

function showLoading(show) {
    document.querySelector('.loading-overlay').classList.toggle('active', show);
}
