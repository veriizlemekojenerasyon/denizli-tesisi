/**
 * GUNLUK VERI GIRISI - Google Sheets Entegrasyonu
 * Bu dosya gunluk-veri-giris.html için Google Sheets bağlantısını sağlar
 */

// ============================================
// YAPILANDIRMA - BU ALANI DOLDURUN
// ============================================
const GUNLUK_CONFIG = {
    // Google Apps Script Web App URL
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyJILN_PHL9Tw_BxRf_TuAOOsc7YqpmYQCgc-MYuhNJeRgiL9P9tczw2njQ7HndQE_8XA/exec',
    
    // Sayfa başlığı
    PAGE_NAME: 'Günlük Veri Girişi',
    
    // Varsayılan kullanıcı adı
    DEFAULT_USER: 'Admin',

    // Mail uyarı ayarları
    EMAIL_ENABLED: true,
    EMAIL_TO: 'mrtcsk0320@gmail.com',
    EMAIL_SUBJECT: 'Günlük Veri Girişi Uyarısı - Kayıt Girilmedi',
    AUTO_CHECK_HOUR: 23,
    AUTO_CHECK_MINUTE: 59
};

// ============================================
// GUNLUK VERI SAYFASI ANA NESNESİ
// ============================================
const GunlukApp = {
    // Başlangıç
    init: function() {
        console.log('GunlukApp başlatılıyor...');
        
        if (!this.validateConfig()) {
            this.showNotification('Hata', 'Apps Script URL ayarlanmamış!', 'error');
            return;
        }
        
        this.setupEventListeners();
        this.setDefaultDate();
        this.checkExistingRecord();
        this.loadLastRecords();
        this.startAutoRecordCheck();
        
        console.log('GunlukApp başlatıldı');
    },
    
    // Konfigürasyon kontrolü
    validateConfig: function() {
        return GUNLUK_CONFIG.APPS_SCRIPT_URL && GUNLUK_CONFIG.APPS_SCRIPT_URL.length > 0;
    },
    
    // Olay dinleyicileri
    setupEventListeners: function() {
        const form = document.getElementById('gunlukVeriForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
        
        // Çıkış butonları
        const sidebarLogout = document.getElementById('sidebarLogout');
        const headerLogout = document.getElementById('headerLogout');
        
        if (sidebarLogout) {
            sidebarLogout.addEventListener('click', () => this.handleLogout());
        }
        if (headerLogout) {
            headerLogout.addEventListener('click', () => this.handleLogout());
        }
    },
    
    // Varsayılan tarih ayarla
    setDefaultDate: function() {
        const tarihInput = document.getElementById('TARIH');
        if (tarihInput) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            tarihInput.value = `${year}-${month}-${day}`;
            
            // Tarih değiştiğinde kontrol et
            tarihInput.addEventListener('change', () => {
                this.checkExistingRecord();
            });
        }
    },
    
    // Form gönderimi işleme
    handleFormSubmit: async function(e) {
        e.preventDefault();
        
        // Butonu loading durumuna getir
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.textContent : 'KAYDET';
        if (submitBtn) {
            submitBtn.textContent = 'KAYDEDİLİYOR...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
        }
        
        const formData = {
            tarih: document.getElementById('TARIH').value,
            yagSeviyesi: document.getElementById('YAGSEVIYESI').value,
            kuplaj: document.getElementById('KUPLAJ').value,
            gm1: document.getElementById('GM1').value,
            gm2: document.getElementById('GM2').value,
            gm3: document.getElementById('GM3').value,
            icihtiyac: document.getElementById('ICIHTIYAC').value,
            redresor1: document.getElementById('REDRESOR1').value,
            redresor2: document.getElementById('REDRESOR2').value,
            kojenIcihtiyac: document.getElementById('KOJENICIHTIYAC').value,
            servisTrafo: document.getElementById('SERVISTRAFO').value,
            kaydeden: this.getUserName()
        };
        
        // Validasyon
        if (!formData.tarih) {
            this.showNotification('Hata', 'Lütfen tarih seçin!', 'error');
            // Butonu eski haline getir
            if (submitBtn) {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
            return;
        }
        
        // Önce kayıt var mı kontrol et
        const isEdit = await this.isExistingRecord(formData.tarih);
        
        let result;
        if (isEdit) {
            // Güncelle - otomatik açıklama oluştur
            const existingRecord = await this.getRecordByDate(formData.tarih);
            const aciklama = this.generateEditDescription(existingRecord, formData);
            formData.aciklama = aciklama;
            formData.duzeltenKullanici = this.getUserName();
            result = await this.updateRecord(formData);
        } else {
            // Yeni kayıt
            result = await this.addRecord(formData);
        }
        
        // Butonu eski haline getir
        if (submitBtn) {
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
        
        if (result.success) {
            this.showNotification('Başarılı', result.message, 'success');
            this.loadLastRecords();
            this.lockForm(true);
            this.showEditButton();
        } else {
            this.showNotification('Hata', result.error || 'İşlem başarısız!', 'error');
        }
    },
    
    // Kayıt ekle (Google Sheets)
    addRecord: async function(data) {
        try {
            const url = new URL(GUNLUK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'addRecord');
            Object.keys(data).forEach(key => {
                url.searchParams.append(key, data[key]);
            });
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return await response.json();
            
        } catch (error) {
            console.error('Kayıt hatası:', error);
            return { success: false, error: 'Bağlantı hatası: ' + error.message };
        }
    },
    
    // Kayıt güncelle (Google Sheets)
    updateRecord: async function(data) {
        try {
            const url = new URL(GUNLUK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'updateRecord');
            Object.keys(data).forEach(key => {
                url.searchParams.append(key, data[key]);
            });
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return await response.json();
            
        } catch (error) {
            console.error('Güncelleme hatası:', error);
            return { success: false, error: 'Bağlantı hatası: ' + error.message };
        }
    },

    // Mail gönderme
    sendEmailAlert: async function(subject, body) {
        if (!GUNLUK_CONFIG.EMAIL_ENABLED) {
            console.log('Mail gönderme kapalı');
            return { success: true, message: 'Mail gönderme kapalı' };
        }

        try {
            const url = new URL(GUNLUK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'sendEmail');
            url.searchParams.append('to', GUNLUK_CONFIG.EMAIL_TO);
            url.searchParams.append('subject', subject || GUNLUK_CONFIG.EMAIL_SUBJECT);
            url.searchParams.append('body', body || '');

            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return await response.json();

        } catch (error) {
            console.error('Mail gönderme hatası:', error);
            return { success: false, error: 'Mail bağlantı hatası: ' + error.message };
        }
    },
    
    // Kayıt var mı kontrolü
    isExistingRecord: async function(tarih) {
        try {
            const url = new URL(GUNLUK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getRecords');
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            if (result.success && result.data) {
                return result.data.some(record => record.tarih === this.formatDateTR(tarih));
            }
            return false;
            
        } catch (error) {
            console.error('Kontrol hatası:', error);
            return false;
        }
    },
    
    // Tarih kontrolü ve form kilitleme
    checkExistingRecord: async function() {
        const tarihInput = document.getElementById('TARIH');
        if (!tarihInput || !tarihInput.value) return;
        
        const currentDate = tarihInput.value;
        
        try {
            const url = new URL(GUNLUK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getRecords');
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            if (result.success && result.data) {
                const existingRecord = result.data.find(record => 
                    record.tarih === this.formatDateTR(currentDate)
                );
                
                if (existingRecord) {
                    // Formu doldur
                    this.fillForm(existingRecord);
                    this.lockForm(true);
                    this.showEditButton();
                } else {
                    this.lockForm(false);
                    this.clearForm();
                }
            }
            
        } catch (error) {
            console.error('Tarih kontrol hatası:', error);
        }
    },
    
    // Formu doldur
    fillForm: function(record) {
        // Türkçe sayı formatını (virgül) noktaya çevir
        var parseTurkishNumber = function(val) {
            if (!val) return '';
            var str = val.toString();
            // Virgülü noktaya çevir
            str = str.replace(/\./g, '').replace(',', '.');
            var num = parseFloat(str);
            return isNaN(num) ? '' : num;
        };
        
        document.getElementById('YAGSEVIYESI').value = parseTurkishNumber(record.yagSeviyesi);
        document.getElementById('KUPLAJ').value = parseTurkishNumber(record.kuplaj);
        document.getElementById('GM1').value = parseTurkishNumber(record.gm1);
        document.getElementById('GM2').value = parseTurkishNumber(record.gm2);
        document.getElementById('GM3').value = parseTurkishNumber(record.gm3);
        document.getElementById('ICIHTIYAC').value = parseTurkishNumber(record.icihtiyac);
        document.getElementById('REDRESOR1').value = parseTurkishNumber(record.redresor1);
        document.getElementById('REDRESOR2').value = parseTurkishNumber(record.redresor2);
        document.getElementById('KOJENICIHTIYAC').value = parseTurkishNumber(record.kojenIcihtiyac);
        document.getElementById('SERVISTRAFO').value = parseTurkishNumber(record.servisTrafo);
    },
    
    // Tarihe göre kayıt getir
    getRecordByDate: async function(tarih) {
        try {
            const url = new URL(GUNLUK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getRecords');
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            if (result.success && result.data) {
                const formattedTarih = this.formatDateTR(tarih);
                return result.data.find(record => record.tarih === formattedTarih);
            }
            return null;
            
        } catch (error) {
            console.error('Kayıt getirme hatası:', error);
            return null;
        }
    },

    // Günlük kayıt girilmediyse mail uyarısı gönder
    startAutoRecordCheck: function() {
        console.log('Günlük otomatik kayıt kontrolü başlatılıyor...');

        setInterval(() => {
            this.checkAndSendMissingRecordMail();
        }, 60000);

        setTimeout(() => {
            this.checkAndSendMissingRecordMail();
        }, 5000);
    },

    checkAndSendMissingRecordMail: async function() {
        const now = new Date();

        if (now.getHours() !== GUNLUK_CONFIG.AUTO_CHECK_HOUR || now.getMinutes() !== GUNLUK_CONFIG.AUTO_CHECK_MINUTE) {
            return;
        }

        const todayStr = this.formatDateInput(now);
        const sentKey = `gunlukMissingMailSent:${todayStr}`;

        if (localStorage.getItem(sentKey)) {
            return;
        }

        const hasRecord = await this.isExistingRecord(todayStr);
        if (hasRecord) {
            return;
        }

        const formattedToday = this.formatDateTR(todayStr);
        const subject = `${GUNLUK_CONFIG.EMAIL_SUBJECT} - ${formattedToday}`;
        const body = `Günlük Veri Girişi Uyarısı\n\nTarih: ${formattedToday}\n\nBugün için günlük veri kaydı girilmedi.\n\nLütfen ilgili personeli bilgilendirin.`;

        const result = await this.sendEmailAlert(subject, body);
        if (result.success) {
            localStorage.setItem(sentKey, new Date().toISOString());
            this.showNotification('Uyarı Maili', 'Günlük veri girilmediği için mail gönderildi.', 'warning');
        } else {
            console.error('Günlük veri uyarı maili gönderilemedi:', result.error);
        }
    },
    
    // Düzenleme açıklaması oluştur
    generateEditDescription: function(oldRecord, newData) {
        if (!oldRecord) return 'Kayıt güncellendi';
        
        const changes = [];
        const fieldNames = {
            yagSeviyesi: 'Yağ Seviyesi',
            kuplaj: 'Kuplaj',
            gm1: 'GM-1',
            gm2: 'GM-2',
            gm3: 'GM-3',
            icihtiyac: 'İç İhtiyaç',
            redresor1: 'Redresör-1',
            redresor2: 'Redresör-2',
            kojenIcihtiyac: 'Kojen İç İhtiyaç',
            servisTrafo: 'Servis Trafo'
        };
        
        // Değişen alanları kontrol et
        for (const [key, label] of Object.entries(fieldNames)) {
            const oldVal = parseFloat(oldRecord[key]) || 0;
            const newVal = parseFloat(newData[key]) || 0;
            
            if (Math.abs(oldVal - newVal) > 0.001) {
                changes.push(label);
            }
        }
        
        if (changes.length === 0) {
            return 'Kayıt güncellendi (değişiklik yok)';
        }
        
        if (changes.length === 1) {
            return changes[0] + ' düzenlendi';
        }
        
        if (changes.length <= 3) {
            return changes.join(', ') + ' düzenlendi';
        }
        
        return changes.slice(0, 3).join(', ') + ' ve diğer alanlar düzenlendi';
    },
    
    // Form kilitle/aç
    lockForm: function(locked) {
        const form = document.getElementById('gunlukVeriForm');
        const inputs = form.querySelectorAll('input[type="number"]');
        
        inputs.forEach(input => {
            input.readOnly = locked;
            input.style.backgroundColor = locked ? '#f0f0f0' : '';
            input.style.cursor = locked ? 'not-allowed' : '';
        });
        
        // Kaydet butonunu gizle/göster
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.style.display = locked ? 'none' : 'inline-block';
        }
        
        // Temizle butonunu gizle/göster
        const resetBtn = form.querySelector('button[type="reset"]');
        if (resetBtn) {
            resetBtn.style.display = locked ? 'none' : 'inline-block';
        }
    },
    
    // Düzenle butonu göster
    showEditButton: function() {
        const form = document.getElementById('gunlukVeriForm');
        
        // Varsa eski butonu kaldır
        const existingEditBtn = form.querySelector('.edit-btn');
        if (existingEditBtn) existingEditBtn.remove();
        
        // Yeni buton oluştur
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'DÜZENLE';
        editBtn.style.cssText = `
            padding: 12px 25px;
            background: linear-gradient(135deg, #f39c12, #e67e22);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(243, 156, 18, 0.3);
        `;
        
        editBtn.addEventListener('click', () => {
            this.lockForm(false);
            editBtn.remove();
            this.showNotification('Bilgi', 'Form düzenleme modunda!', 'info');
        });
        
        // Form actions'a ekle
        const formActions = form.querySelector('.form-actions');
        if (formActions) {
            formActions.appendChild(editBtn);
        }
    },
    
    // Form temizle (tarih hariç)
    clearForm: function() {
        const form = document.getElementById('gunlukVeriForm');
        const inputs = form.querySelectorAll('input[type="number"]');
        inputs.forEach(input => input.value = '');
    },
    
    // Son kayıtları yükle
    loadLastRecords: async function() {
        const tableBody = document.getElementById('recordsTableBody');
        if (!tableBody) return;
        
        try {
            const url = new URL(GUNLUK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecords');
            url.searchParams.append('count', '32');
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            if (result.success) {
                this.renderTable(result.data);
            } else {
                console.error('Kayıtlar yüklenemedi:', result.error);
            }
            
        } catch (error) {
            console.error('Kayıt yükleme hatası:', error);
            tableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 40px; color: #64748b;">Kayıtlar yüklenemedi!</td></tr>';
        }
    },
    
    // Tablo render et
    renderTable: function(records) {
        const tableBody = document.getElementById('recordsTableBody');
        if (!tableBody) return;
        
        if (!records || records.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 40px; color: #64748b;">Henüz kayıt bulunmuyor.</td></tr>';
            return;
        }
        
        // Sayı değerini kayıttan geldiği gibi göster; yuvarlama yapma.
        const formatNum = (val) => {
            if (!val || val === '' || val === '-') return '-';
            return String(val);
        };
        
        let html = '';
        records.forEach((record, index) => {
            // Açıklama varsa göster
            const aciklamaBadge = record.aciklama ? 
                `<span class="edit-badge" title="${record.aciklama}">📝 Düzenlendi</span>` : '';
            
            html += `
                <tr>
                    <td class="col-num">${index + 1}</td>
                    <td class="col-date">${record.tarih || '-'} ${aciklamaBadge}</td>
                    <td class="col-oil">${formatNum(record.yagSeviyesi)}</td>
                    <td class="col-kuplaj">${formatNum(record.kuplaj)}</td>
                    <td class="col-gm">${formatNum(record.gm1)}</td>
                    <td class="col-gm">${formatNum(record.gm2)}</td>
                    <td class="col-gm">${formatNum(record.gm3)}</td>
                    <td class="col-consumption">${formatNum(record.icihtiyac)}</td>
                    <td class="col-redresor">${formatNum(record.redresor1)}</td>
                    <td class="col-redresor">${formatNum(record.redresor2)}</td>
                    <td class="col-kojen">${formatNum(record.kojenIcihtiyac)}</td>
                    <td class="col-consumption">${formatNum(record.servisTrafo)}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
    },
    
    // Tarih formatla (TR)
    formatDateTR: function(dateString) {
        if (!dateString) return '-';
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return parts[2] + '.' + parts[1] + '.' + parts[0];
        }
        return dateString;
    },

    // Date nesnesini input tarih formatına çevir (YYYY-MM-DD)
    formatDateInput: function(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    // Kullanıcı adı göster
    displayUserName: function() {
        const display = document.getElementById('userNameDisplay');
        if (display) {
            display.textContent = this.getUserName();
        }
    },
    
    // Kullanıcı adı al
    getUserName: function() {
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        const firstName = loggedInUser.firstName || loggedInUser.ad || loggedInUser['Ad'] || loggedInUser.name || '';
        const lastName = loggedInUser.lastName || loggedInUser.soyad || loggedInUser['Soyad'] || loggedInUser.surname || '';
        const fullName = (firstName + ' ' + lastName).trim() || loggedInUser.email || GUNLUK_CONFIG.DEFAULT_USER;
        return fullName;
    },
    
    // Çıkış işlemi
    handleLogout: function() {
        if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
            localStorage.removeItem('loggedInUser');
            window.location.href = 'anasayfa.html';
        }
    },
    
    // Bildirim göster
    showNotification: function(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<strong>${title}</strong><br>${message}`;
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
            default:
                notification.style.background = '#3b82f6';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
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
        
        // Tüm userNameDisplay elementlerini güncelle
        const allUserNameDisplays = document.querySelectorAll('[id="userNameDisplay"]');
        
        allUserNameDisplays.forEach((element, index) => {
            element.textContent = fullName || user.email || 'Kullanici';
        });
        
        // user-name-display elementini de güncelle
        const userNameDisplayKebab = document.getElementById('user-name-display');
        if (userNameDisplayKebab) {
            userNameDisplayKebab.textContent = fullName || user.email || 'Kullanici';
        }
        
        console.log('Günlük Veri - Kullanici adi ayarlandi:', fullName || user.email || 'Kullanici');
    } catch (e) {
        console.error('Günlük Veri - Kullanici bilgileri okunamadi:', e);
        const allElements = document.querySelectorAll('[id="userNameDisplay"]');
        allElements.forEach(element => {
            element.textContent = 'Kullanici';
        });
        
        const userNameDisplayKebab = document.getElementById('user-name-display');
        if (userNameDisplayKebab) {
            userNameDisplayKebab.textContent = 'Kullanici';
        }
    }
}

// Sayfa yüklendiðinde baþlat
document.addEventListener('DOMContentLoaded', function() {
    // Önce kimlik dogrulama kontrolü
    checkAuth();
    
    GunlukApp.init();
});
