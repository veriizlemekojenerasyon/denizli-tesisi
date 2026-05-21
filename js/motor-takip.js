// Motor Takip JavaScript Fonksiyonları

// 📧 Mail gönderme konfigürasyonu
const MOTOR_MAIL_CONFIG = {
    ENABLED: false, // Şimdilik kapalı
    EMAIL_TO: 'mrtcsk0320@gmail.com',
    EMAIL_SUBJECT: 'Motor Takip Uyarısı'
};

// Kimlik dogrulama kontrolü
function checkAuth() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        window.location.href = 'anasayfa.html';
        return;
    }
    
    try {
        const user = JSON.parse(loggedInUser);
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // 🔒 ROL KONTROLÜ - Motor takip sadece admin kullanıcılara açık
        if (user.role !== 'admin') {
            document.body.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial; background: #f5f5f5;">
                    <div style="text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                        <h2 style="color: #e74c3c; margin-bottom: 15px;">🚫 Yetkisiz Erişim</h2>
                        <p style="color: #666; margin-bottom: 20px;">Motor Takip sayfasına erişim yetkiniz bulunmamaktadır.</p>
                        <p style="margin-bottom: 20px;">Bu sayfa sadece admin kullanıcılar içindir.</p>
                        <a href="anasayfa.html" style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">🏠 Ana Sayfaya Git</a>
                    </div>
                </div>
            `;
            return;
        }
        
        // Tüm userNameDisplay elementlerini güncelle
        const allUserNameDisplays = document.querySelectorAll('[id="userNameDisplay"]');
        
        allUserNameDisplays.forEach((element, index) => {
            element.textContent = fullName || user.email || 'Kullanici';
        });
        
        console.log('Motor Takip - Kullanici adi ayarlandi:', fullName || user.email || 'Kullanici');
    } catch (e) {
        console.error('Motor Takip - Kullanici bilgileri okunamadi:', e);
        const allElements = document.querySelectorAll('[id="userNameDisplay"]');
        allElements.forEach(element => {
            element.textContent = 'Kullanici';
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Önce kimlik dogrulama kontrolü
    checkAuth();
    
    // Sayfa yüklendiğinde çalışacak fonksiyonlar
    initializeMotorTracking();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Çıkış yap butonları
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');
    
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', function() {
            if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                localStorage.removeItem('loggedInUser');
                window.location.href = 'index.html';
            }
        });
    }
    
    if (headerLogout) {
        headerLogout.addEventListener('click', function() {
            if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                localStorage.removeItem('loggedInUser');
                window.location.href = 'index.html';
            }
        });
    }
    
    console.log('Motor Takip sayfası yüklendi');
});

// Tarih ve Saat Güncelleme
function updateDateTime() {
    const now = new Date();
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    
    if (dateElement) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = now.toLocaleDateString('tr-TR', options);
    }
    
    if (timeElement) {
        timeElement.textContent = now.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// Motor Takip Sistemi
function initializeMotorTracking() {
    // Motor butonları
    initializeMotorButtons();
    
    // Varsayılan değerleri ayarla
    setDefaultValues();
    
    // Kayıtları yükle
    loadRecords();
}

// Kayıt kontrolü - aynı tarih ve saat için kayıt var mı? (Sadece GAS üzerinden)
function isRecordExists(tarih, saat) {
    // LocalStorage devre dışı - sadece GAS kontrolü yapılacak
    return false;
}

// Google Apps Script URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbySQpjSWkHLMppL6lhNTxw0Q1UzM6BAB3Rc4FF3mr3IsDqPUa1vJtA4kexQxkuRoK8Y/exec';

// Kayıtları Yükle - Sadece Google Apps Script'ten çek (LocalStorage devre dışı)
async function loadRecords() {
    const tbody = document.getElementById('records-tbody');
    const counterElement = document.getElementById('total-records-count');
    
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">⏳ Kayıtlar yükleniyor...</td></tr>';
    
    try {
        // Google Apps Script'ten kayıtları çek
        const response = await fetch(GAS_URL, {
            method: 'GET'
        });
        
        const result = await response.json();
        
        tbody.innerHTML = '';
        
        if (result.success && result.records) {
            // GAS kayıtlarını formatla
            const allRecords = result.records.map(r => ({
                ...r,
                source: 'gas',
                timestamp: r.timestamp || new Date(r['Tarih'] + ' ' + r['Saat']).getTime()
            }));
            
            // Tarih/saat'e göre sırala (en yeni önce)
            allRecords.sort((a, b) => {
                const timeA = new Date(a['Tarih'] + ' ' + a['Saat']).getTime() || a.timestamp || 0;
                const timeB = new Date(b['Tarih'] + ' ' + b['Saat']).getTime() || b.timestamp || 0;
                return timeB - timeA;
            });
            
            // Kayıt sayısını güncelle
            if (counterElement) {
                counterElement.textContent = allRecords.length;
            }
            
            if (allRecords.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">Henüz kayıt bulunmuyor</td></tr>';
                return;
            }
            
            // Son 10 kaydı göster
            const recentRecords = allRecords.slice(0, 10);
            
            recentRecords.forEach(record => {
                const row = createRecordRowUnified(record);
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">Henüz kayıt bulunmuyor</td></tr>';
        }
        
    } catch (error) {
        console.error('Kayıtları yükleme hatası:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">Sunucuya ulaşılamıyor. Lütfen internet bağlantınızı kontrol edin.</td></tr>';
    }
}

// Sheets'ten ve LocalStorage'dan gelen kayıt için birleşik satır oluşturma
function createRecordRowUnified(record) {
    const row = document.createElement('tr');
    
    const rawMotor = record['Motor'] || record['Motor'] || '-';
    const motorName = formatMotorName(rawMotor);
    const operatorName = record['Operatör'] || record['Operatör'] || '-';
    const vardiya = record['Vardiya'] || record['Vardiya'] || '-';
    const tarih = record['Tarih'] || record['Tarih'] || '-';
    const saat = record['Saat'] || record['Saat'] || '-';
    const kontrolYeri = record['Kontrol Yeri'] || record['KontrolYeri'] || '-';
    const fileUrl = record['Drive Link'] || record['Drive Link'] || '';
    const kayitNo = record['Kayit No'] || record['Kayıt No'] || '-';
    const source = record.source || 'gas';
    const fotoData = record.fotoData;
    const syncError = record.syncError;
    
    const kontrolAdi = kontrolYeri === 'ht' ? 'HT' : kontrolYeri === 'lt' ? 'LT' : kontrolYeri === 'yag' ? 'Yağ' : kontrolYeri;
    
    // Kaynak göstergesi
    const sourceBadge = source === 'local' 
        ? `<span style="background: ${syncError ? '#dc3545' : '#ffc107'}; color: ${syncError ? 'white' : '#333'}; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">${syncError ? 'SENKRONIZE' : 'YEREL'}</span>`
        : '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">BULUT</span>';
    
    // Fotoğraf görüntüleme linki
    let photoLink;
    if (fileUrl) {
        photoLink = `<a href="${fileUrl}" target="_blank" style="color: #667eea; text-decoration: none;">
            <i class="fas fa-image"></i> Görüntüle
        </a>`;
    } else if (fotoData && source === 'local') {
        // Local fotoğraf için data URL
        photoLink = `<a href="${fotoData}" target="_blank" style="color: #ffc107; text-decoration: none;">
            <i class="fas fa-image"></i> Yerel Görüntü
        </a>`;
    } else {
        photoLink = '<span style="color: #64748b;">Fotoğraf yok</span>';
    }
    
    row.innerHTML = `
        <td>${formatDate(tarih)}</td>
        <td>${saat}</td>
        <td>${motorName} ${sourceBadge}</td>
        <td>${kontrolAdi}</td>
        <td>${operatorName}</td>
        <td>${vardiya}</td>
        <td>${photoLink}</td>
        <td>
            <div class="action-buttons">
                <button class="action-btn view-btn" onclick="viewRecordFromSheet('${kayitNo}')">
                    <i class="fas fa-eye"></i> Gör
                </button>
            </div>
        </td>
    `;
    
    return row;
}


// Kayıt silme - Devre dışı (sadece GAS üzerinden silme yapılabilir)
function deleteLocalRecord(kayitNo) {
    showNotification('info', 'Bilgi', 'Kayıt silme şu anda sadece Google Sheets üzerinden yapılabilir.');
}

// Kayıt detaylarını görüntüle (LocalStorage devre dışı - sadece GAS)
function viewRecordFromSheet(kayitNo) {
    // GAS kaydı için bilgi mesajı göster
    showNotification('info', 'Kayıt', `Kayıt No: ${kayitNo} - Detaylar için Google Sheets'i kontrol edin.`);
}

// Kayıt detay modalı göster
function showRecordModal(record) {
    const modal = document.createElement('div');
    modal.className = 'record-modal';
    modal.id = 'record-modal';
    
    const motorName = record.motor === 'gm1' ? 'GM-1' : record.motor === 'gm2' ? 'GM-2' : 'GM-3';
    const kontrolAdi = record.kontrolYeri === 'ht' ? 'HT' : record.kontrolYeri === 'lt' ? 'LT' : 'Yağ Seviyesi';
    const operatorName = getOperatorName(record.operator);
    const vardiyaName = getShiftName(record.vardiya);
    
    modal.innerHTML = `
        <div class="record-modal-content" style="
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        ">
            <button class="record-modal-close" id="record-modal-close" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #64748b;
            ">
                <i class="fas fa-times"></i>
            </button>
            
            <h3 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 1.5rem;">
                <i class="fas fa-clipboard-list"></i> Kayıt Detayları
            </h3>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b;">Kayıt No:</span>
                    <span style="font-weight: 600; color: #2c3e50;">${record.kayitNo}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b;">Tarih:</span>
                    <span style="font-weight: 600; color: #2c3e50;">${formatDate(record.date)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b;">Saat:</span>
                    <span style="font-weight: 600; color: #2c3e50;">${record.time}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b;">Motor:</span>
                    <span style="font-weight: 600; color: #2c3e50;">${motorName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b;">Kontrol:</span>
                    <span style="font-weight: 600; color: #2c3e50;">${kontrolAdi}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b;">Operatör:</span>
                    <span style="font-weight: 600; color: #2c3e50;">${operatorName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b;">Vardiya:</span>
                    <span style="font-weight: 600; color: #2c3e50;">${vardiyaName}</span>
                </div>
            </div>
            
            ${record.fotoData ? `
                <div style="margin-top: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #64748b; font-size: 1rem;">Fotoğraf:</h4>
                    <img src="${record.fotoData}" style="
                        width: 100%;
                        max-height: 300px;
                        object-fit: contain;
                        border-radius: 8px;
                        border: 1px solid #e2e8f0;
                    " />
                    <a href="${record.fotoData}" target="_blank" style="
                        display: block;
                        margin-top: 10px;
                        text-align: center;
                        color: #667eea;
                        text-decoration: none;
                        padding: 10px;
                        background: #f1f5f9;
                        border-radius: 6px;
                    ">
                        <i class="fas fa-external-link-alt"></i> Tam Boy Görüntüle
                    </a>
                </div>
            ` : ''}
            
            ${record.syncError ? `
                <div style="
                    margin-top: 20px;
                    padding: 15px;
                    background: #fff3cd;
                    border-radius: 8px;
                    border-left: 4px solid #ffc107;
                ">
                    <i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i>
                    <span style="color: #856404; margin-left: 8px;">Bu kayıt henüz sunucuya senkronize edilmemiş.</span>
                </div>
            ` : ''}
        </div>
    `;
    
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3000;
    `;
    
    document.body.appendChild(modal);
    
    // Event listener'ları ekle
    document.getElementById('record-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Varsayılan Değerleri Ayarlama
function setDefaultValues() {
    const timeInput = document.getElementById('tracking-time');
    const shiftSelect = document.getElementById('shift');
    const operatorSelect = document.getElementById('operator');
    
    // Kullanıcı adını göster
    displayUserName();
    
    // Tarih HTML tarafından otomatik ayarlanıyor - burada kontrol et
    const dateInput = document.getElementById('tracking-date');
    if (dateInput && !dateInput.value) {
        // Eğer HTML tarafından ayarlanmadıysa, burada ayarla
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    if (timeInput) {
        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, '0');
        timeInput.value = `${currentHour}:00`;
    }
    
    // Saat 00:00 kontrolü ve kilitleme mantığı
    checkAndLockForm();
    
    // Otomatik vardiya belirleme
    if (shiftSelect) {
        const currentHour = new Date().getHours();
        let autoShift = '';
        
        if (currentHour >= 8 && currentHour < 16) {
            autoShift = 'morning'; // Gündüz 08:00 - 16:00
        } else if (currentHour >= 16 && currentHour < 24) {
            autoShift = 'evening'; // Akşam 16:00 - 24:00
        } else {
            autoShift = 'night'; // Gece 24:00 - 08:00
        }
        
        shiftSelect.value = autoShift;
        shiftSelect.disabled = true; // Kullanıcı değiştiremesin
    }
}

// Saat 00:00 kontrolü ve form kilitleme (LocalStorage devre dışı - sadece GAS)
function checkAndLockForm() {
    // LocalStorage devre dışı - GAS üzerinden kontrol gerekebilir
    // Şimdilik pasif - tüm formlar aktif
    const operatorSelect = document.getElementById('operator');
    if (operatorSelect) operatorSelect.disabled = false;
}

// Kullanıcı adını göster (LocalStorage devre dışı)
function displayUserName() {
    const userNameDisplay = document.getElementById('user-name-display');
    if (userNameDisplay) {
        // LocalStorage devre dışı - sabit değer göster
        userNameDisplay.textContent = 'Admin';
    }
}

// Yardımcı Fonksiyonlar
function getOperatorName(operatorValue) {
    const operatorMap = {
        'ibrahim-ogun': 'İbrahim Ogün Şahin',
        'yakup-can': 'Yakup Can Cin',
        'oguzhan-yaylali': 'Oğuzhan Yaylalı',
        'altan-hunoglu': 'Altan Hunoğlu'
    };
    return operatorMap[operatorValue] || operatorValue;
}

function getShiftName(shiftValue) {
    const shiftMap = {
        'morning': 'Gündüz',
        'evening': 'Akşam',
        'night': 'Gece'
    };
    return shiftMap[shiftValue] || shiftValue;
}

function formatMotorName(motorValue) {
    const motorMap = {
        'gm1': 'GM-1',
        'gm2': 'GM-2',
        'gm3': 'GM-3'
    };
    return motorMap[motorValue] || motorValue;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Bildirim Sistemi
function showNotification(type, title, message) {
    // Bildirim elementi oluştur
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const iconMap = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-circle',
        'info': 'fas fa-info-circle',
        'warning': 'fas fa-exclamation-triangle'
    };
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="${iconMap[type] || 'fas fa-info-circle'}"></i>
        </div>
        <div class="notification-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: flex-start;
        gap: 15px;
        min-width: 350px;
        max-width: 450px;
        z-index: 3000;
        animation: slideIn 0.3s ease;
    `;
    
    const iconElement = notification.querySelector('.notification-icon');
    iconElement.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 1.2rem;
    `;
    
    const contentElement = notification.querySelector('.notification-content');
    contentElement.style.cssText = `
        flex: 1;
    `;
    
    const titleElement = notification.querySelector('h4');
    titleElement.style.cssText = `
        margin: 0 0 5px 0;
        font-size: 1rem;
        font-weight: 600;
        color: #2c3e50;
    `;
    
    const messageElement = notification.querySelector('p');
    messageElement.style.cssText = `
        margin: 0;
        font-size: 0.9rem;
        color: #64748b;
        white-space: pre-line;
    `;
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        font-size: 1rem;
        padding: 0;
        transition: color 0.3s ease;
    `;
    
    closeBtn.addEventListener('mouseover', () => {
        closeBtn.style.color = '#2c3e50';
    });
    
    closeBtn.addEventListener('mouseout', () => {
        closeBtn.style.color = '#64748b';
    });
    
    // Renkleri ayarla
    const colorMap = {
        'success': { bg: '#d4edda', icon: '#28a745' },
        'error': { bg: '#f8d7da', icon: '#dc3545' },
        'info': { bg: '#d1ecf1', icon: '#17a2b8' },
        'warning': { bg: '#fff3cd', icon: '#ffc107' }
    };
    
    const colors = colorMap[type] || colorMap['info'];
    iconElement.style.background = colors.bg;
    iconElement.style.color = colors.icon;
    
    // Ekrana ekle
    document.body.appendChild(notification);
    
    // Otomatik kaldır
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Sidebar Toggle
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
});

// Bildirim Modal
document.addEventListener('DOMContentLoaded', function() {
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationModal = document.getElementById('notification-modal');
    const closeNotifications = document.getElementById('close-notifications');
    
    if (notificationBtn && notificationModal) {
        notificationBtn.addEventListener('click', function() {
            notificationModal.style.display = 'flex';
        });
    }
    
    if (closeNotifications && notificationModal) {
        closeNotifications.addEventListener('click', function() {
            notificationModal.style.display = 'none';
        });
    }
    
    if (notificationModal) {
        notificationModal.addEventListener('click', function(e) {
            if (e.target === notificationModal) {
                notificationModal.style.display = 'none';
            }
        });
    }
});

// CSS Animasyonları
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
`;
document.head.appendChild(style);

// ==================== 3 KONTROL KUTUSU FONKSİYONLARI ====================

// Global değişkenler
let selectedMotor = null;
let currentStream = null;

// Fotoğraf verilerini sakla
const fotografVerileri = {
    ht: null,
    lt: null,
    yag: null
};

// Motor Butonlarını Başlat - Güncellenmiş versiyon
function initializeMotorButtons() {
    const motorButtons = document.querySelectorAll('.motor-btn');
    
    motorButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const motor = this.dataset.motor;
            
            // Tüm butonlardan selected class'ını kaldır
            motorButtons.forEach(b => b.classList.remove('selected'));
            
            // Tıklanan butona selected class'ı ekle
            this.classList.add('selected');
            
            // Seçili motoru kaydet
            selectedMotor = motor;
            
            // 3 kutuyu göster
            gosterKontrolKutulari();
            
            // Bildirim göster
            const motorName = motor === 'gm1' ? 'GM-1' : motor === 'gm2' ? 'GM-2' : 'GM-3';
            showNotification('info', 'Motor Seçildi', `${motorName} motoru seçildi. HT, LT ve Yağ Seviyesi kayıtları için fotoğraf ekleyin.`);
        });
    });
}

// 3 Kontrol Kutularını Göster
function gosterKontrolKutulari() {
    const kontrolKutulari = document.getElementById('kontrol-kutulari');
    const kaydetAlani = document.getElementById('kaydet-alani');
    
    if (kontrolKutulari) {
        kontrolKutulari.style.display = 'grid';
        kontrolKutulari.style.animation = 'fadeIn 0.5s ease';
    }
    
    if (kaydetAlani) {
        kaydetAlani.style.display = 'block';
        kaydetAlani.style.animation = 'fadeIn 0.5s ease';
    }
}

// Kamera Aç - Device in use çözümü
function openCamera(kontrolTipi) {
    showNotification('info', 'Kamera', `${kontrolTipi.toUpperCase()} için kamera açılıyor...`);
    
    // Tüm streamleri zorla kapat
    forceStopAllStreams();
    
    // Kısa bekleme sonra dene
    setTimeout(() => {
        attemptCameraAccess(kontrolTipi);
    }, 500);
}

// Tüm streamleri zorla kapat
function forceStopAllStreams() {
    // Global stream'i kapat
    if (window.currentCameraStream) {
        window.currentCameraStream.getTracks().forEach(track => {
            track.stop();
        });
        window.currentCameraStream = null;
    }
    
    // Tüm media stream'leri bul ve kapat
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                devices.forEach(device => {
                    if (device.kind === 'videoinput') {
                        console.log('Video device found:', device.label);
                    }
                });
            });
    }
}

// Kamera erişimi dene
function attemptCameraAccess(kontrolTipi, attempt = 1) {
    const maxAttempts = 3;
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Basit video constraint ile dene
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        };
        
        navigator.mediaDevices.getUserMedia(constraints)
            .then(function(stream) {
                showNotification('success', 'Kamera', 'Kamera başarıyla açıldı!');
                showCameraModal(stream, kontrolTipi);
            })
            .catch(function(error) {
                console.error(`Kamera denemesi ${attempt} başarısız:`, error);
                
                if (attempt < maxAttempts) {
                    // Tekrar dene - daha uzun bekleme
                    showNotification('warning', 'Tekrar Deneniyor', `Kamera tekrar deneniyor (${attempt + 1}/${maxAttempts})...`);
                    
                    // Önceki stream'i temizle
                    forceStopAllStreams();
                    
                    setTimeout(() => {
                        attemptCameraAccess(kontrolTipi, attempt + 1);
                    }, 1000 * attempt); // 1s, 2s, 3s bekle
                } else {
                    // Son deneme başarısız - detaylı hata mesajı
                    let errorMessage = 'Kamera erişimi başarısız oldu.';
                    
                    if (error.name === 'NotAllowedError') {
                        errorMessage = '❌ Kamera izni reddedildi. Lütfen tarayıcı ayarlarından kamera iznini verin.';
                    } else if (error.name === 'NotFoundError') {
                        errorMessage = '📷 Kamera bulunamadı. Lütfen kamera bağlantısını kontrol edin.';
                    } else if (error.name === 'NotReadableError' || error.name === 'DeviceInUseError') {
                        errorMessage = '🔒 Kamera başka bir uygulama tarafından kullanılıyor.\n\nÇözümler:\n• Tüm sekmeleri kapatıp browser\'ı yeniden başlatın\n• Zoom/Teams/Skype gibi uygulamaları kapatın\n• Farklı browser deneyin';
                    } else if (error.name === 'OverconstrainedError') {
                        errorMessage = '⚙️ Kamera ayarları desteklenmiyor.';
                    } else {
                        errorMessage = `❌ Bilinmeyen hata: ${error.name} - ${error.message}`;
                    }
                    
                    showNotification('error', 'Kamera Hatası', errorMessage);
                }
            });
    } else {
        showNotification('error', 'Desteklenmiyor', 'Tarayıcınız kamera API\'yi desteklemiyor.');
    }
}

// Düşük çözünürlük ile kamera aç
function openCameraLowRes(kontrolTipi) {
    showNotification('info', 'Kamera', 'Düşük çözünürlük deneniyor...');
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        })
        .then(function(stream) {
            showCameraModal(stream, kontrolTipi);
        })
        .catch(function(error) {
            console.error('Düşük çözünürlük kamera hatası:', error);
            showNotification('error', 'Kamera Hatası', 'Kamera erişimi tamamen başarısız oldu.');
        });
    }
}

// Kamera Modal Göster
function showCameraModal(stream, kontrolTipi) {
    // Stream'i global değişkende sakla
    window.currentCameraStream = stream;
    window.currentKontrolTipi = kontrolTipi;
    
    const modal = document.createElement('div');
    modal.className = 'camera-modal';
    modal.id = 'camera-modal';
    modal.innerHTML = `
        <div class="camera-modal-content">
            <div class="camera-header">
                <h3>${kontrolTipi.toUpperCase()} - Fotoğraf Çek</h3>
                <button class="camera-close" id="camera-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="camera-body">
                <video id="camera-video" autoplay playsinline style="width: 100%; max-height: 400px; border-radius: 8px;"></video>
                <canvas id="camera-canvas" style="display: none;"></canvas>
                <div class="camera-controls">
                    <button class="camera-capture-btn" id="camera-capture-btn">
                        <i class="fas fa-camera"></i> Fotoğraf Çek
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3000;
    `;
    
    document.body.appendChild(modal);
    
    const video = document.getElementById('camera-video');
    video.srcObject = stream;
    
    // Event listener'ları ekle
    document.getElementById('camera-close-btn').addEventListener('click', kapatKamera);
    document.getElementById('camera-capture-btn').addEventListener('click', capturePhotoForKontrol);
}

// Kamera Modal Kapat
function kapatKamera() {
    if (window.currentCameraStream) {
        window.currentCameraStream.getTracks().forEach(track => track.stop());
        window.currentCameraStream = null;
    }
    const modal = document.getElementById('camera-modal');
    if (modal) modal.remove();
}

// Fotoğraf Çek ve Kaydet - Güncellenmiş
function capturePhotoForKontrol() {
    const kontrolTipi = window.currentKontrolTipi;
    const stream = window.currentCameraStream;
    
    if (!kontrolTipi || !stream) {
        showNotification('error', 'Hata', 'Kamera bağlantısı bulunamadı.');
        return;
    }
    
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    
    if (!video || !canvas) {
        showNotification('error', 'Hata', 'Kamera elemanları bulunamadı.');
        return;
    }
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);
    
    // Base64 olarak kaydet (kalite 0.4 - boyut küçültme)
    const fotoData = canvas.toDataURL('image/jpeg', 0.4);
    fotografVerileri[kontrolTipi] = fotoData;
    
    // Stream'i durdur
    stream.getTracks().forEach(track => track.stop());
    window.currentCameraStream = null;
    
    // Modal'ı kapat
    const modal = document.getElementById('camera-modal');
    if (modal) modal.remove();
    
    // Önizleme göster
    gosterFotoOnizleme(kontrolTipi, fotoData);
    
    showNotification('success', 'Başarılı', `${kontrolTipi.toUpperCase()} fotoğrafı çekildi.`);
}

// Fotoğraf Önizlemesi Göster
function gosterFotoOnizleme(kontrolTipi, fotoData) {
    const yerTutucu = document.querySelector(`#kamera-${kontrolTipi} .kamera-yer-tutucu`);
    const onizleme = document.getElementById(`foto-onizleme-${kontrolTipi}`);
    const img = onizleme.querySelector('img');
    
    if (yerTutucu) yerTutucu.style.display = 'none';
    if (onizleme) {
        onizleme.style.display = 'block';
        img.src = fotoData;
    }
}

// Fotoğraf Sil
function silFoto(kontrolTipi) {
    fotografVerileri[kontrolTipi] = null;
    
    const yerTutucu = document.querySelector(`#kamera-${kontrolTipi} .kamera-yer-tutucu`);
    const onizleme = document.getElementById(`foto-onizleme-${kontrolTipi}`);
    const img = onizleme.querySelector('img');
    
    if (yerTutucu) yerTutucu.style.display = 'flex';
    if (onizleme) {
        onizleme.style.display = 'none';
        img.src = '';
    }
    
    showNotification('info', 'Silindi', `${kontrolTipi.toUpperCase()} fotoğrafı silindi.`);
}

// Kontrol Sil (Tüm kutuyu temizle)
function silKontrol(kontrolTipi) {
    silFoto(kontrolTipi);
    showNotification('info', 'Temizlendi', `${kontrolTipi.toUpperCase()} verileri temizlendi.`);
}

// Tümünü Kaydet - Sadece Apps Script (LocalStorage devre dışı)
async function kaydetTumunu() {
    if (!selectedMotor) {
        showNotification('error', 'Hata', 'Lütfen önce bir motor seçin.');
        return;
    }
    
    const operatorSelect = document.getElementById('operator');
    if (!operatorSelect || !operatorSelect.value) {
        showNotification('error', 'Hata', 'Lütfen operatör seçin.');
        operatorSelect.focus();
        return;
    }
    
    const vardiyaSelect = document.getElementById('shift');
    if (!vardiyaSelect || !vardiyaSelect.value) {
        showNotification('error', 'Hata', 'Lütfen vardiya seçin.');
        vardiyaSelect.focus();
        return;
    }
    
    // En az bir fotoğraf eklenmiş mi kontrol et
    const fotoSayisi = Object.values(fotografVerileri).filter(f => f !== null).length;
    if (fotoSayisi === 0) {
        showNotification('error', 'Hata', 'En az bir kontrol için fotoğraf eklemelisiniz.');
        return;
    }
    
    showNotification('info', 'Kaydediliyor', 'Veriler kaydediliyor, lütfen bekleyin...');
    
    const tarih = document.getElementById('tracking-date').value;
    const saat = document.getElementById('tracking-time').value;
    const vardiya = document.getElementById('shift').value;
    const operator = operatorSelect.value;
    
    try {
        // Her kontrol tipi için ayrı kayıt yap
        const kayitlar = [];
        
        for (const [kontrolTipi, fotoData] of Object.entries(fotografVerileri)) {
            if (fotoData) {
                const payload = {
                    tarih: tarih,
                    saat: saat,
                    motor: selectedMotor,
                    kontrolYeri: kontrolTipi,
                    operator: operator,
                    vardiya: vardiya,
                    image: fotoData
                };
                
                // GAS'e gönder
                const response = await fetch(GAS_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                if (result.success) {
                    kayitlar.push(kontrolTipi);
                }
            }
        }
        
        if (kayitlar.length > 0) {
            showNotification('success', 'Başarılı', `${kayitlar.length} kontrol kaydı Google Drive/Sheets'e kaydedildi.`);
            
            // Formu temizle
            temizleTumKontroller();
            
            // Kayıtları yeniden yükle
            loadRecords();
        } else {
            showNotification('error', 'Hata', 'Kayıt yapılırken bir sorun oluştu.');
        }
        
    } catch (error) {
        console.error('Kayıt hatası:', error);
        showNotification('error', 'Hata', 'Sunucuya bağlanırken hata oluştu. İnternet bağlantınızı kontrol edin.');
    }
}

// Tüm Kontrolleri Temizle
function temizleTumKontroller() {
    // Fotoğraf verilerini temizle
    fotografVerileri.ht = null;
    fotografVerileri.lt = null;
    fotografVerileri.yag = null;
    
    // UI'ı temizle
    ['ht', 'lt', 'yag'].forEach(kontrolTipi => {
        silFoto(kontrolTipi);
    });
    
    // Kutuları gizle
    const kontrolKutulari = document.getElementById('kontrol-kutulari');
    const kaydetAlani = document.getElementById('kaydet-alani');
    
    if (kontrolKutulari) kontrolKutulari.style.display = 'none';
    if (kaydetAlani) kaydetAlani.style.display = 'none';
    
    // Motor butonlarını sıfırla
    const motorButtons = document.querySelectorAll('.motor-btn');
    motorButtons.forEach(btn => btn.classList.remove('selected'));
    selectedMotor = null;
}

// 📧 Motor Takip Mail Gönderme Fonksiyonu
async function sendMotorMail(subject, body) {
    if (!MOTOR_MAIL_CONFIG.ENABLED) {
        console.log('📧 Motor takip mail gönderme kapalı');
        return { success: true, message: 'Mail gönderme kapalı' };
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'sendEmail');
        formData.append('to', MOTOR_MAIL_CONFIG.EMAIL_TO);
        formData.append('subject', subject || MOTOR_MAIL_CONFIG.EMAIL_SUBJECT);
        formData.append('body', body);
        
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('📧 Motor takip mail sonucu:', result);
        return result;
    } catch (error) {
        console.error('Motor takip mail gönderme hatası:', error);
        return { success: false, error: error.message };
    }
}

// 🔧 Mail ayarlarını aç/kapat (sadece admin)
function toggleMotorMailSettings() {
    const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    
    // Sadece admin kullanıcılara izin ver
    if (user.role !== 'admin') {
        alert('Bu ayarı değiştirmek için admin yetkisi gereklidir!');
        return;
    }
    
    const newStatus = !MOTOR_MAIL_CONFIG.ENABLED;
    MOTOR_MAIL_CONFIG.ENABLED = newStatus;
    
    const statusText = newStatus ? 'açıldı' : 'kapatıldı';
    const statusColor = newStatus ? '#27ae60' : '#e74c3c';
    
    // Buton rengini güncelle
    const mailToggleBtn = document.getElementById('mailToggleBtn');
    if (mailToggleBtn) {
        if (newStatus) {
            mailToggleBtn.classList.add('mail-enabled');
        } else {
            mailToggleBtn.classList.remove('mail-enabled');
        }
        mailToggleBtn.textContent = newStatus ? '📧 Mail Açık' : '📧 Mail Kapalı';
    }
    
    // Bildirim göster
    alert(`📧 Motor takip mail gönderme ${statusText}!\n\nDurum: ${newStatus ? 'Açık' : 'Kapalı'}\nMail adresi: ${MOTOR_MAIL_CONFIG.EMAIL_TO}`);
    
    // Test mail gönder (açık ise)
    if (newStatus) {
        sendMotorMail('Motor Takip Mail Test', 'Motor takip mail sistemi başarıyla açıldı. Bu bir test mailidir.');
    }
}
