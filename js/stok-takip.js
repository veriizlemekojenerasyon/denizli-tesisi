// Stok Takip JavaScript

// Google Apps Script URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxttVkL243aTFdGTKJCTJYoPfKGccCymmMTRt1w2zpFSVf53wY7eRB-_5_jqdA3QRi_/exec";

document.addEventListener('DOMContentLoaded', async function() {
    // Başlangıç değerlerini ayarla
    await initializePage();
    
    // Event listener'ları ekle
    setupEventListeners();
    
    // Stok listesini yükle
    await loadStockList();
    
    // Son işlemleri yükle
    await loadRecentTransactions();
    
    // Özet kartları güncelle (fonksiyon tanımlı değil, geçici olarak kaldırıldı)
    // await updateSummaryCards();
    
    // Kullanıcı adını göster
    displayUserName();
});

// Sayfa başlangıç ayarları
async function initializePage() {
    // Tarih alanını bugün olarak ayarla
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
    
    // İşlem formundaki malzeme select'ini doldur
    await populateMaterialSelect();
    
    // Personel select'ini doldur
    populatePersonnelSelect();
}

// Event listener'ları ekle
function setupEventListeners() {
    // Malzeme ekleme formu
    const stockForm = document.getElementById('stock-form');
    if (stockForm) {
        stockForm.addEventListener('submit', handleStockSubmit);
    }
    
    // Stok giriş/çıkış formu
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }
    
    // Arama ve filtreleme
    const searchInput = document.getElementById('stock-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterStockList);
    }
    
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterStockList);
    }
    
    // Excel export
    const exportBtn = document.getElementById('export-stock');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToExcel);
    }
    
    // Çıkış butonları
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');
    
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', handleLogout);
    }
    if (headerLogout) {
        headerLogout.addEventListener('click', handleLogout);
    }
}

// Malzeme ekleme formu gönderimi
async function handleStockSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        // Backend'e malzeme ekle
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'addMaterial',
                materialCode: formData.get('material-code'),
                materialName: formData.get('material-name'),
                materialCategory: formData.get('material-category'),
                materialQuantity: formData.get('material-quantity'),
                materialUnit: formData.get('material-unit'),
                minStock: formData.get('min-stock'),
                materialDescription: formData.get('material-description'),
                createdBy: 'Admin'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('success', 'Başarılı', result.message);
            
            // Formu temizle ve listeyi güncelle
            e.target.reset();
            await loadStockList();
            await populateMaterialSelect();
            // await updateSummaryCards(); // Fonksiyon tanımlı değil
        } else {
            showNotification('error', 'Hata', result.error || 'Malzeme eklenemedi!');
        }
        
    } catch (error) {
        console.error('Malzeme ekleme hatası:', error);
        showNotification('error', 'Hata', 'Bağlantı hatası! Lütfen tekrar deneyin.');
    }
}

// Stok giriş/çıkış formu gönderimi
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        // Backend'e işlem ekle
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'addTransaction',
                materialId: formData.get('transaction-material'),
                materialName: document.querySelector('#transaction-material option:checked')?.text.split(' - ')[1] || '',
                transactionType: formData.get('transaction-type'),
                transactionQuantity: formData.get('transaction-quantity'),
                materialUnit: 'adet', // Bu dinamik olabilir
                transactionDate: formData.get('transaction-date'),
                transactionPerson: formData.get('transaction-person'),
                transactionReason: formData.get('transaction-reason')
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('success', 'Başarılı', result.message);
            
            // Formu temizle ve listeleri güncelle
            e.target.reset();
            document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
            await loadStockList();
            await populateMaterialSelect();
            await loadRecentTransactions();
            // await updateSummaryCards(); // Fonksiyon tanımlı değil
        } else {
            showNotification('error', 'Hata', result.error || 'İşlem kaydedilemedi!');
        }
        
    } catch (error) {
        console.error('Stok işlemi hatası:', error);
        showNotification('error', 'Hata', 'Bağlantı hatası! Lütfen tekrar deneyin.');
    }
}

// Malzeme select'ini doldur
async function populateMaterialSelect() {
    const select = document.getElementById('transaction-material');
    if (!select) return;
    
    try {
        // Backend'den malzemeleri getir
        const response = await fetch(SCRIPT_URL + '?action=getMaterials');
        const result = await response.json();
        
        select.innerHTML = '<option value="">Malzeme seçin</option>';
        
        if (result.success && result.data) {
            result.data.forEach(material => {
                const option = document.createElement('option');
                option.value = material.id;
                option.textContent = `${material.code} - ${material.name} (${material.quantity} ${material.unit})`;
                select.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Malzeme select doldurma hatası:', error);
        select.innerHTML = '<option value="">Malzemeler yüklenemedi</option>';
    }
}

// Personel select'ini doldur
function populatePersonnelSelect() {
    const select = document.getElementById('transaction-person');
    if (!select) return;
    
    // Mevcut kullanıcıları al
    const users = getUsers();
    
    select.innerHTML = '<option value="">Personel seçin</option>';
    
    // Kullanıcıları listele
    users.forEach(user => {
        const option = document.createElement('option');
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Bilinmeyen Kullanıcı';
        option.value = fullName;
        option.textContent = fullName;
        select.appendChild(option);
    });
}

// Stok listesini yükle
async function loadStockList() {
    const tbody = document.getElementById('stock-tbody');
    if (!tbody) return;
    
    try {
        // Backend'den malzemeleri getir
        const response = await fetch(SCRIPT_URL + '?action=getMaterials');
        const result = await response.json();
        
        if (result.success) {
            const materials = result.data || [];
            
            if (materials.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #7f8c8d;">Henüz malzeme eklenmemiş</td></tr>';
                return;
            }
            
            tbody.innerHTML = '';
            materials.forEach(material => {
                const row = createStockRow(material);
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">Malzemeler yüklenemedi: ' + (result.error || 'Bilinmeyen hata') + '</td></tr>';
        }
        
    } catch (error) {
        console.error('Stok listesi yükleme hatası:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">Bağlantı hatası! Lütfen sayfayı yenileyin.</td></tr>';
    }
}

// Stok satırı oluştur
function createStockRow(material) {
    const row = document.createElement('tr');
    
    const status = getStockStatus(material);
    
    row.innerHTML = `
        <td><strong>${material.code}</strong></td>
        <td>${material.name}</td>
        <td>${getCategoryName(material.category)}</td>
        <td>${material.quantity.toFixed(2)}</td>
        <td>${material.unit}</td>
        <td>${material.minStock.toFixed(2)}</td>
        <td><span class="status-badge ${status.class}">${status.text}</span></td>
        <td>
            <button class="action-btn edit" onclick="editMaterial(${material.id})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete" onclick="deleteMaterial(${material.id})">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    return row;
}

// Stok durumunu belirle
function getStockStatus(material) {
    if (material.quantity <= 0) {
        return { class: 'status-low', text: 'Tükendi' };
    } else if (material.quantity <= material.minStock) {
        return { class: 'status-warning', text: 'Kritik' };
    } else {
        return { class: 'status-normal', text: 'Normal' };
    }
}

// Kategori adını getir
function getCategoryName(category) {
    const categories = {
        'yag': 'Yağ',
        'filtre': 'Filtre',
        'yedek-parca': 'Yedek Parça',
        'kimyasal': 'Kimyasal',
        'elektrik': 'Elektrik Malzemesi',
        'sarf-malzeme': 'Sarf Malzeme',
        'diger': 'Diğer'
    };
    return categories[category] || category;
}

// Stok listesini filtrele
function filterStockList() {
    const searchTerm = document.getElementById('stock-search').value.toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;
    
    const materials = getMaterials();
    
    const filtered = materials.filter(material => {
        const matchesSearch = material.name.toLowerCase().includes(searchTerm) || 
                             material.code.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || material.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
    
    const tbody = document.getElementById('stock-tbody');
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #7f8c8d;">Filtreleme sonucu bulunamadı</td></tr>';
        return;
    }
    
    filtered.forEach(material => {
        tbody.appendChild(createStockRow(material));
    });
}

// Son işlemleri yükle
async function loadRecentTransactions() {
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;
    
    try {
        // Backend'den işlemleri getir
        const response = await fetch(SCRIPT_URL + '?action=getTransactions');
        const result = await response.json();
        
        if (result.success) {
            const transactions = result.data || [];
            
            if (transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #7f8c8d;">Henüz işlem yapılmamış</td></tr>';
                return;
            }
            
            tbody.innerHTML = '';
            transactions.forEach(transaction => {
                const row = createTransactionRow(transaction);
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #e74c3c;">İşlemler yüklenemedi: ' + (result.error || 'Bilinmeyen hata') + '</td></tr>';
        }
        
    } catch (error) {
        console.error('Son işlemler yükleme hatası:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #e74c3c;">Bağlantı hatası! Lütfen sayfayı yenileyin.</td></tr>';
    }
}

// İşlem satırı oluştur
function createTransactionRow(transaction) {
    const row = document.createElement('tr');
    
    const typeClass = transaction.type === 'in' ? 'text-success' : 'text-danger';
    const typeText = transaction.type === 'in' ? 'Giriş' : 'Çıkış';
    const typeIcon = transaction.type === 'in' ? '↓' : '↑';
    
    row.innerHTML = `
        <td>${formatDate(transaction.date)}</td>
        <td>${transaction.materialName}</td>
        <td class="${typeClass}"><strong>${typeIcon} ${typeText}</strong></td>
        <td>${transaction.quantity.toFixed(2)}</td>
        <td>${transaction.person}</td>
        <td>${getReasonName(transaction.reason)}</td>
    `;
    
    return row;
}

// İşlem nedenini getir
function getReasonName(reason) {
    const reasons = {
        'satin-alma': 'Satın Alma',
        'kullanim': 'Kullanım',
        'bakim': 'Bakım',
        'degisim': 'Değişim',
        'diger': 'Diğer'
    };
    return reasons[reason] || reason;
}

// Malzeme düzenle
function editMaterial(id) {
    const materials = getMaterials();
    const material = materials.find(m => m.id === id);
    
    if (!material) return;
    
    // Form alanlarını doldur
    document.getElementById('material-code').value = material.code;
    document.getElementById('material-name').value = material.name;
    document.getElementById('material-category').value = material.category;
    document.getElementById('material-quantity').value = material.quantity;
    document.getElementById('material-unit').value = material.unit;
    document.getElementById('min-stock').value = material.minStock;
    document.getElementById('material-description').value = material.description || '';
    
    // Malzemeyi sil (düzenleme sonrası yeniden eklenecek)
    deleteMaterial(id, false);
    
    showNotification('info', 'Düzenleme', 'Malzeme bilgileri forma yüklendi. Düzenlemeyi tamamlayıp kaydedin.');
}

// Malzeme sil
function deleteMaterial(id, showConfirm = true) {
    if (showConfirm && !confirm('Bu malzemeyi silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    let materials = getMaterials();
    materials = materials.filter(m => m.id !== id);
    localStorage.setItem('stockMaterials', JSON.stringify(materials));
    
    if (showConfirm) {
        showNotification('success', 'Başarılı', 'Malzeme silindi!');
        loadStockList();
        populateMaterialSelect();
        // updateSummaryCards(); // Fonksiyon tanımlı değil, geçici olarak kaldırıldı
    }
}

// Excel'e aktar
function exportToExcel() {
    const materials = getMaterials();
    
    if (materials.length === 0) {
        showNotification('warning', 'Uyarı', 'Aktarılacak malzeme bulunamadı!');
        return;
    }
    
    // CSV formatında hazırla
    const headers = ['Kod', 'Ad', 'Kategori', 'Miktar', 'Birim', 'Min. Stok', 'Durum'];
    const rows = materials.map(m => [
        m.code,
        m.name,
        getCategoryName(m.category),
        m.quantity,
        m.unit,
        m.minStock,
        getStockStatus(m).text
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.join(';'))
        .join('\n');
    
    // İndir
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stok-listesi-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showNotification('success', 'Başarılı', 'Stok listesi Excel\'e aktarıldı!');
}

// Çıkış işlemi
function handleLogout() {
    if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = 'anasayfa.html';
    }
}

// Kullanıcı adını göster
function displayUserName() {
    const updateUserName = () => {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (!loggedInUser) {
            window.location.href = 'anasayfa.html';
            return;
        }
        
        try {
            const user = JSON.parse(loggedInUser);
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            
            // userNameDisplay elementini güncelle
            const userNameElement = document.getElementById('userNameDisplay');
            if (userNameElement) {
                userNameElement.textContent = fullName || user.email || 'Kullanıcı';
                console.log('Stok Takip - Kullanıcı adı ayarlandı:', fullName || user.email || 'Kullanıcı');
            } else {
                console.error('userNameDisplay elementi bulunamadı');
            }
        } catch (e) {
            console.error('Stok Takip - Kullanıcı bilgileri okunamadı:', e);
            const userNameElement = document.getElementById('userNameDisplay');
            if (userNameElement) {
                userNameElement.textContent = 'Kullanıcı';
            }
        }
    };
    
    // Birden fazla deneme
    updateUserName();
    setTimeout(updateUserName, 100);
    setTimeout(updateUserName, 500);
    setTimeout(updateUserName, 1000);
}

// Yardımcı fonksiyonlar
function getMaterials() {
    return JSON.parse(localStorage.getItem('stockMaterials') || '[]');
}

function getTransactions() {
    return JSON.parse(localStorage.getItem('stockTransactions') || '[]');
}

function getUsers() {
    // Gerçek kullanıcı listesi
    const realUsers = [
        { firstName: 'admin', lastName: '', email: 'admin@sistem.com' },
        { firstName: 'YAKUP CAN', lastName: 'CİN', email: 'yakup@sistem.com' },
        { firstName: 'İBRAHİM OGÜN', lastName: 'ŞAHİN', email: 'i.ogun@sistem.com' },
        { firstName: 'OGUZHAN', lastName: 'YAYLALI', email: 'o.yaylali@sistem.com' },
        { firstName: 'ALTAN', lastName: 'HUNOĞLU', email: 'a.hunoglu@sistem.com' },
        { firstName: 'KADİR', lastName: 'KORKMAZ', email: 'k.korkmaz@sistem.com' },
        { firstName: 'MURAT', lastName: 'COŞKUN', email: 'mrtcsk0320@gmail.com' }
    ];
    
    // Mevcut logged in kullanıcıyı kontrol et ve ekle
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (loggedInUser) {
        try {
            const user = JSON.parse(loggedInUser);
            const exists = realUsers.some(realUser => 
                realUser.email === user.email || 
                `${realUser.firstName} ${realUser.lastName}`.trim() === `${user.firstName || ''} ${user.lastName || ''}`.trim()
            );
            if (!exists) {
                realUsers.push(user);
            }
        } catch (e) {
            console.error('Kullanıcı bilgileri okunamadı:', e);
        }
    }
    
    return realUsers;
}

function formatDate(dateString) {
    // dd.MM.yyyy formatını parse et
    if (!dateString) return '';
    
    // Eğer zaten dd.MM.yyyy formatındaysa
    if (typeof dateString === 'string' && dateString.includes('.')) {
        return dateString;
    }
    
    // Diğer formatları dene
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return dateString; // Parse edilemezse orijinali döndür
    }
    
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Bildirim göster
function showNotification(type, title, message) {
    const modal = document.getElementById('notification-modal');
    const titleEl = document.getElementById('notification-title');
    const messageEl = document.getElementById('notification-message');
    
    if (!modal || !titleEl || !messageEl) {
        alert(message);
        return;
    }
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    modal.classList.add('show');
    
    setTimeout(() => {
        closeNotification();
    }, 5000);
}

// Bildirim kapat
function closeNotification() {
    const modal = document.getElementById('notification-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}
