/**
 * SAATLIK VERI GIRISI - Google Sheets Entegrasyonu
 * Bu dosya saatlik-veri-giris.html için Google Sheets bağlantısını sağlar
 */

// ============================================
// YAPILANDIRMA - BU ALANI DOLDURUN
// ============================================
const SAATLIK_CONFIG = {
    // Google Apps Script Web App URL
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyFwSoehdajKxEGYnw5UWNlPYvpVMl0WJ43i_sl3wsxdD5-AoRAMgIX3-uxXFZUfJTC-Q/exec',
    
    // Sayfa başlığı
    PAGE_NAME: 'Saatlik Veri Girişi',
    
    // Varsayılan kullanıcı adı
    DEFAULT_USER: 'Admin',
    
    // 📧 Mail uyarı ayarları
    EMAIL_ENABLED: true, // Mail gönderme aç/kapa
    EMAIL_TO: 'mrtcsk0320@gmail.com', // Uyarı maili gönderilecek adres
    EMAIL_SUBJECT: 'Saatlik Veri Girişi Uyarısı - Kayıt Girilmedi'
};

// ============================================
// SAATLIK VERI SAYFASI ANA NESNESİ
// ============================================
const SaatlikApp = {
    
    init: function() {
        console.log('SaatlikApp başlatılıyor...');
        
        this.manualSlotSelected = false;
        this.setupEventListeners();
        this.setInitialValues();
        this.loadLastRecords();
        
        // 🔥 OTOMATİK KAYIT KONTROLÜ BAŞLAT
        this.startAutoRecordCheck();
    },
    
    setupEventListeners: function() {
        const form = document.getElementById('saatlikVeriForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
            form.addEventListener('reset', () => {
                this.manualSlotSelected = false;
                setTimeout(() => this.setInitialValues(), 0);
            });
        }

        const quickCurrentHourBtn = document.getElementById('quickCurrentHourBtn');
        const quickPreviousHourBtn = document.getElementById('quickPreviousHourBtn');
        const quickZeroRecordBtn = document.getElementById('quickZeroRecordBtn');
        const refreshMissingHoursBtn = document.getElementById('refreshMissingHoursBtn');

        if (quickCurrentHourBtn) quickCurrentHourBtn.addEventListener('click', () => this.prepareQuickSlot(0));
        if (quickPreviousHourBtn) quickPreviousHourBtn.addEventListener('click', () => this.prepareQuickSlot(-1));
        if (quickZeroRecordBtn) quickZeroRecordBtn.addEventListener('click', () => this.prepareZeroRecord());
        if (refreshMissingHoursBtn) refreshMissingHoursBtn.addEventListener('click', () => this.loadLastRecords());
        
        const tarihInput = document.getElementById('tarih');
        
        if (tarihInput) {
            tarihInput.addEventListener('change', () => {
                this.manualSlotSelected = true;
                this.checkExistingRecord();
            });
        }
        
        const sidebarLogout = document.getElementById('sidebarLogout');
        const headerLogout = document.getElementById('headerLogout');
        
        if (sidebarLogout) sidebarLogout.addEventListener('click', () => this.handleLogout());
        if (headerLogout) headerLogout.addEventListener('click', () => this.handleLogout());
    },
    
    setInitialValues: function() {
        this.syncCurrentDateTime();
    },

    syncCurrentDateTime: function() {
        const tarihInput = document.getElementById('tarih');
        const saatInput = document.getElementById('saat');
        const vardiyaSelect = document.getElementById('vardiya');
        
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const currentHour = String(today.getHours()).padStart(2, '0') + ':00';
        
        if (tarihInput) tarihInput.value = `${year}-${month}-${day}`;
        
        if (saatInput) {
            saatInput.value = currentHour;
        }
        
        if (vardiyaSelect) {
            vardiyaSelect.value = this.getVardiyaByHour(today.getHours());
        }
    },

    prepareQuickSlot: function(hourOffset) {
        const date = new Date();
        date.setHours(date.getHours() + hourOffset, 0, 0, 0);
        this.fillSlot(date);
        this.showNotification('Hazir', `${this.formatDateTR(date)} ${this.formatHour(date)} forma alindi`, 'info');
    },

    prepareZeroRecord: function() {
        const target = this.manualSlotSelected ? this.getSelectedSlotDate() : new Date();
        this.fillSlot(target);
        const aktifInput = document.getElementById('aktifMwh');
        const reaktifInput = document.getElementById('reaktifMwh');
        const notlarInput = document.getElementById('notlar');
        if (aktifInput) aktifInput.value = '0.000';
        if (reaktifInput) reaktifInput.value = '0.000';
        if (notlarInput) notlarInput.value = 'KAYIT GIRILMEDI';
        this.showNotification('Sifir kayit hazir', 'Kontrol edip Kaydet butonuna dokunabilirsiniz.', 'warning');
    },

    fillSlot: function(date) {
        const tarihInput = document.getElementById('tarih');
        const saatInput = document.getElementById('saat');
        const vardiyaSelect = document.getElementById('vardiya');
        if (tarihInput) tarihInput.value = this.formatDateISO(date);
        if (saatInput) saatInput.value = this.formatHour(date);
        if (vardiyaSelect) vardiyaSelect.value = this.getVardiyaByHour(date.getHours());
        this.manualSlotSelected = true;
        this.lockForm(false);
    },

    getSelectedSlotDate: function() {
        const tarihInput = document.getElementById('tarih');
        const saatInput = document.getElementById('saat');
        const value = tarihInput?.value || this.formatDateISO(new Date());
        const hour = parseInt((saatInput?.value || this.getCurrentHourRounded()).split(':')[0], 10) || 0;
        const date = new Date(value + 'T00:00:00');
        date.setHours(hour, 0, 0, 0);
        return date;
    },

    formatDateISO: function(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    formatDateTR: function(date) {
        return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    },

    formatHour: function(date) {
        return `${String(date.getHours()).padStart(2, '0')}:00`;
    },
    
    getCurrentHourRounded: function() {
        return String(new Date().getHours()).padStart(2, '0') + ':00';
    },
    
    getVardiyaByHour: function(hour) {
        if (hour >= 8 && hour < 16) return '08-16';
        if (hour >= 16 && hour < 24) return '16-24';
        return '24-08';
    },
    
    checkExistingRecord: async function() {
        // Kayıt kontrolü için placeholder
        // Google Sheets entegrasyonu yapıldığında aktif edilecek
    },
    
    handleFormSubmit: async function(e) {
        e.preventDefault();
        if (!this.manualSlotSelected) {
            this.syncCurrentDateTime();
        }
        
        const submitBtn = document.getElementById('submitBtn');
        const originalBtnText = submitBtn ? submitBtn.textContent : 'Kaydet';
        
        if (submitBtn) {
            submitBtn.textContent = 'KAYDEDİLİYOR...';
            submitBtn.disabled = true;
        }
        
        const formData = {
            tarih: document.getElementById('tarih').value,
            saat: document.getElementById('saat').value,
            vardiya: document.getElementById('vardiya').value,
            aktifMwh: document.getElementById('aktifMwh').value,
            reaktifMwh: document.getElementById('reaktifMwh').value,
            notlar: document.getElementById('notlar').value
        };
        
        if (!formData.tarih || !formData.saat) {
            this.showNotification('Hata', 'Lütfen tarih ve saat seçin!', 'error');
            if (submitBtn) {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
            return;
        }
        
        // Kayıt var mı kontrol et ve Google Sheets'e gönder
        const isEdit = await this.isExistingRecord(formData.tarih, formData.saat);
        
        let result;
        if (isEdit) {
            result = await this.updateRecord(formData);
        } else {
            result = await this.addRecord(formData);
        }
        
        if (submitBtn) {
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
        
        if (result.success) {
            this.showNotification('Başarılı', result.message, 'success');
            this.loadLastRecords();
            this.lockForm(true);
        } else {
            this.showNotification('Hata', result.error || 'İşlem başarısız!', 'error');
        }
    },
    
    // Kayıt var mı kontrol et (Google Sheets)
    isExistingRecord: async function(tarih, saat) {
        try {
            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getRecordByDateTime');
            url.searchParams.append('tarih', tarih);
            url.searchParams.append('saat', saat);
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            return result.success && result.found;
        } catch (error) {
            console.error('Kayıt kontrolü hatası:', error);
            return false;
        }
    },
    
    // Google Sheets'e yeni kayıt ekle
    addRecord: async function(data) {
        try {
            // Kaydeden kullanıcı bilgisini ekle
            const loggedInUser = localStorage.getItem('loggedInUser');
            if (loggedInUser) {
                try {
                    const user = JSON.parse(loggedInUser);
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    data.kaydeden = fullName || user.email || 'Bilinmeyen Kullanıcı';
                    console.log('👤 Kaydeden kullanıcı:', data.kaydeden);
                } catch (e) {
                    console.error('Kullanıcı bilgileri okunamadı:', e);
                    data.kaydeden = 'Bilinmeyen Kullanıcı';
                }
            } else {
                data.kaydeden = 'Misafir Kullanıcı';
                console.log('👤 Giriş yapılmadı, misafir olarak kaydediliyor');
            }
            
            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'addRecord');
            Object.keys(data).forEach(key => {
                url.searchParams.append(key, data[key]);
            });
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return await response.json();
        } catch (error) {
            console.error('Kayıt ekleme hatası:', error);
            return { success: false, error: error.message };
        }
    },
    
    // 📧 Mail gönderme fonksiyonu
    sendEmailAlert: async function(subject, body) {
        if (!SAATLIK_CONFIG.EMAIL_ENABLED) {
            console.log('📧 Mail gönderme kapalı');
            return { success: true, message: 'Mail gönderme kapalı' };
        }
        
        try {
            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'sendEmail');
            url.searchParams.append('to', SAATLIK_CONFIG.EMAIL_TO);
            url.searchParams.append('subject', subject || SAATLIK_CONFIG.EMAIL_SUBJECT);
            url.searchParams.append('body', body);
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            console.log('📧 Mail sonucu:', result);
            return result;
        } catch (error) {
            console.error('Mail gönderme hatası:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Google Sheets'te kayıt güncelle
    updateRecord: async function(data) {
        try {
            // Kaydeden kullanıcı bilgisini ekle
            const loggedInUser = localStorage.getItem('loggedInUser');
            if (loggedInUser) {
                try {
                    const user = JSON.parse(loggedInUser);
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    data.kaydeden = fullName || user.email || 'Bilinmeyen Kullanıcı';
                    console.log('👤 Kaydeden kullanıcı (güncelleme):', data.kaydeden);
                } catch (e) {
                    console.error('Kullanıcı bilgileri okunamadı:', e);
                    data.kaydeden = 'Bilinmeyen Kullanıcı';
                }
            } else {
                data.kaydeden = 'Misafir Kullanıcı';
                console.log('👤 Giriş yapılmadı, misafir olarak güncelleniyor');
            }
            
            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'updateRecord');
            Object.keys(data).forEach(key => {
                url.searchParams.append(key, data[key]);
            });
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return await response.json();
        } catch (error) {
            console.error('Kayıt güncelleme hatası:', error);
            return { success: false, error: error.message };
        }
    },
    
    saveToLocal: function(data) {
        let records = JSON.parse(localStorage.getItem('saatlikVeriler') || '[]');
        
        // Aynı tarih/saat varsa güncelle
        const existingIndex = records.findIndex(r => r.tarih === data.tarih && r.saat === data.saat);
        
        if (existingIndex >= 0) {
            records[existingIndex] = data;
        } else {
            records.unshift(data);
        }
        
        // Sadece son 48 kaydı tut
        if (records.length > 48) {
            records = records.slice(0, 48);
        }
        
        localStorage.setItem('saatlikVeriler', JSON.stringify(records));
    },
    
    loadLastRecords: async function() {
        const tableBody = document.getElementById('recordsTableBody');
        if (!tableBody) return;
        
        try {
            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecords');
            url.searchParams.append('count', '48');
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            if (result.success) {
                this.renderTable(result.data);
                this.renderMissingHours(result.data);
            } else {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">Kayıtlar yüklenemedi.</td></tr>';
                this.renderMissingHours([]);
            }
        } catch (error) {
            console.error('Kayıtlar yüklenirken hata:', error);
            // Hata durumunda localStorage'dan göster
            const records = JSON.parse(localStorage.getItem('saatlikVeriler') || '[]');
            this.renderTable(records);
            this.renderMissingHours(records);
        }
    },
    
    renderMissingHours: function(records) {
        const list = document.getElementById('missingHoursList');
        if (!list) return;

        const existing = new Set((records || []).map(record => {
            return `${this.normalizeDateKey(record.tarih)}|${String(record.saat || '').trim()}`;
        }));

        const missing = [];
        const base = new Date();
        if (base.getMinutes() < 55) {
            base.setHours(base.getHours() - 1);
        }

        for (let i = 0; i < 12; i++) {
            const date = new Date(base);
            date.setHours(date.getHours() - i, 0, 0, 0);
            const key = `${this.formatDateTR(date)}|${this.formatHour(date)}`;
            if (!existing.has(key)) {
                missing.push(date);
            }
        }

        if (!missing.length) {
            list.innerHTML = '<button type="button" class="missing-hour-chip ok">Son 12 saatte eksik yok</button>';
            return;
        }

        list.innerHTML = missing.slice(0, 8).map(date => {
            const iso = this.formatDateISO(date);
            const hour = this.formatHour(date);
            return `<button type="button" class="missing-hour-chip" data-date="${iso}" data-hour="${hour}">${this.formatDateTR(date)} ${hour}</button>`;
        }).join('');

        list.querySelectorAll('[data-date][data-hour]').forEach(button => {
            button.addEventListener('click', () => {
                const date = new Date(button.dataset.date + 'T00:00:00');
                date.setHours(parseInt(button.dataset.hour.split(':')[0], 10), 0, 0, 0);
                this.fillSlot(date);
                this.showNotification('Eksik saat secildi', `${this.formatDateTR(date)} ${this.formatHour(date)} forma alindi`, 'warning');
            });
        });
    },

    normalizeDateKey: function(value) {
        const text = String(value || '').trim();
        if (text.includes('-')) {
            const parts = text.slice(0, 10).split('-');
            if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return text.slice(0, 10);
    },

    renderTable: function(records) {
        const tableBody = document.getElementById('recordsTableBody');
        if (!tableBody) return;
        
        if (!records || records.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">Henüz kayıt bulunmuyor.</td></tr>';
            return;
        }
        
        let html = '';
        records.forEach((record, index) => {
            html += `
                <tr>
                    <td class="col-num">${index + 1}</td>
                    <td class="col-date">${record.tarih || '-'}</td>
                    <td class="col-time">${record.saat || '-'}</td>
                    <td class="col-shift">${this.formatVardiya(record.vardiya)}</td>
                    <td class="col-active">${record.aktifMwh ? parseFloat(record.aktifMwh).toFixed(3) : '-'}</td>
                    <td class="col-reactive">${record.reaktifMwh ? parseFloat(record.reaktifMwh).toFixed(3) : '-'}</td>
                    <td class="col-notes" title="${record.notlar || ''}">${record.notlar || '-'}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
    },
    
    formatVardiya: function(vardiya) {
        if (!vardiya) return '-';
        const map = {
            '08-16': '08:00 - 16:00',
            '16-24': '16:00 - 24:00',
            '24-08': '24:00 - 08:00'
        };
        return map[vardiya] || vardiya;
    },
    
    handleLogout: function() {
        if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
            localStorage.removeItem('rememberedEmail');
            window.location.href = 'anasayfa.html';
        }
    },
    
    // Form inputlarını kilitle/aç
    lockForm: function(locked) {
        const inputs = document.querySelectorAll('#saatlikVeriForm input:not([type="date"]):not(#saat), #saatlikVeriForm select:not(#tarih):not(#saat), #saatlikVeriForm textarea');
        
        inputs.forEach(input => {
            input.readOnly = locked;
            input.disabled = locked;
            input.style.backgroundColor = locked ? '#f0f0f0' : '';
            input.style.opacity = locked ? '0.7' : '1';
        });
        
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.style.display = locked ? 'none' : 'inline-block';
        }
    },
    
    showNotification: function(title, message, type) {
        const notification = document.createElement('div');
        notification.innerHTML = `<strong>${title}</strong><br>${message}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 350px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        `;
        
        const colors = {
            success: 'linear-gradient(135deg, #10b981, #059669)',
            error: 'linear-gradient(135deg, #ef4444, #dc2626)',
            info: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            warning: 'linear-gradient(135deg, #f59e0b, #d97706)'
        };
        
        notification.style.background = colors[type] || colors.info;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 4000);
    },
    
    // 🔥 OTOMATİK KAYIT KONTROLÜ
    startAutoRecordCheck: function() {
        console.log('🔥 Otomatik kayıt kontrolü başlatılıyor...');
        
        // Her 30 saniyede bir kontrol et
        setInterval(() => {
            this.checkAndAutoRecord();
        }, 30000);
        
        // Sayfa yüklendiğinde de kontrol et
        setTimeout(() => {
            this.checkAndAutoRecord();
        }, 5000);
    },
    
    // 🔥 OTOMATİK KAYIT KONTROLÜ VE GÖNDERİM
    checkAndAutoRecord: async function() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        console.log(`🔥 Saat kontrolü: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
        
        // Her saatin 59. dakikasında kontrol et (08:59, 09:59, 10:59, vb.)
        if (currentMinute !== 59) {
            return;
        }
        
        console.log(`🔥 ${currentHour}:59 kontrolü yapılıyor...`);
        
        // Bugünün tarihini al
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        // Geçerli saat için kayıt var mı kontrol et
        const checkHour = String(currentHour).padStart(2, '0') + ':00';
        const hasRecord = await this.isExistingRecord(todayStr, checkHour);
        
        if (!hasRecord) {
            console.log(`🚨 ${checkHour} kaydı bulunamadı! Otomatik kayıt gönderiliyor...`);
            
            // Vardiya belirle
            const vardiya = this.getVardiyaByHour(currentHour);
            
            // Otomatik kayıt verileri
            // Kaydeden kullanıcı bilgisini al
            const loggedInUser = localStorage.getItem('loggedInUser');
            let kaydedenKullanici = 'OTOMATİK SİSTEM';
            
            if (loggedInUser) {
                try {
                    const user = JSON.parse(loggedInUser);
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    kaydedenKullanici = fullName || user.email || 'Bilinmeyen Kullanıcı';
                    console.log('👤 Otomatik kayıt - Kaydeden kullanıcı:', kaydedenKullanici);
                } catch (e) {
                    console.error('Kullanıcı bilgileri okunamadı:', e);
                    kaydedenKullanici = 'Bilinmeyen Kullanıcı';
                }
            }
            
            const autoData = {
                tarih: todayStr,
                saat: checkHour,
                vardiya: vardiya,
                aktifMwh: '0',
                reaktifMwh: '0',
                notlar: 'KAYIT GİRİLMEDİ',
                kaydeden: kaydedenKullanici
            };
            
            // Kaydı gönder
            const result = await this.addRecord(autoData);
            
            if (result.success) {
                console.log(`✅ Otomatik ${checkHour} kaydı başarıyla gönderildi!`);
                this.showNotification('Otomatik Kayıt', `${checkHour} verisi otomatik olarak kaydedildi (Kayıt girilmedi)`, 'warning');
                this.loadLastRecords();
                
                // 📧 Mail gönder
                const mailBody = `Saatlik Veri Girişi Uyarısı\n\nTarih: ${todayStr}\nSaat: ${checkHour}\nVardiya: ${vardiya}\n\n${checkHour} için saatlik veri girilmedi. Otomatik olarak boş kayıt yapıldı.\n\nLütfen ilgili personeli bilgilendirin.`;
                await this.sendEmailAlert(`Saatlik Veri Girişi Uyarısı - ${checkHour} Kayıt Girilmedi`, mailBody);
                
            } else {
                console.error('❌ Otomatik kayıt başarısız:', result.error);
            }
        } else {
            console.log(`✅ ${checkHour} kaydı mevcut, otomatik kayıt gerekmiyor`);
        }
    }
};

// Dayanikli otomatik kontrol: 55. dakikadan sonra mevcut saati,
// sonraki saatte ise bir onceki saati kontrol eder.
SaatlikApp.getHourlyCheckTarget = function(date) {
    const target = new Date(date);
    if (target.getMinutes() < 55) {
        target.setHours(target.getHours() - 1);
    }

    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hour = target.getHours();

    return {
        isoTarih: `${year}-${month}-${day}`,
        tarih: `${day}.${month}.${year}`,
        hour,
        saat: `${String(hour).padStart(2, '0')}:00`
    };
};

SaatlikApp.checkAndAutoRecord = async function() {
    const target = this.getHourlyCheckTarget(new Date());
    const sentKey = `saatlikAutoRecordCheck:${target.tarih}:${target.saat}`;
    if (localStorage.getItem(sentKey)) return;

    const hasRecord = await this.isExistingRecord(target.isoTarih, target.saat);
    if (hasRecord) {
        localStorage.setItem(sentKey, new Date().toISOString());
        console.log(`${target.saat} kaydi mevcut, otomatik kayit gerekmiyor`);
        return;
    }

    const loggedInUser = localStorage.getItem('loggedInUser');
    let kaydedenKullanici = 'OTOMATIK SISTEM';
    if (loggedInUser) {
        try {
            const user = JSON.parse(loggedInUser);
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            kaydedenKullanici = fullName || user.email || 'Bilinmeyen Kullanici';
        } catch (e) {
            kaydedenKullanici = 'Bilinmeyen Kullanici';
        }
    }

    const vardiya = this.getVardiyaByHour(target.hour);
    const result = await this.addRecord({
        tarih: target.isoTarih,
        saat: target.saat,
        vardiya,
        aktifMwh: '0',
        reaktifMwh: '0',
        aydemAktif: '0',
        aydemReaktif: '0',
        notlar: 'KAYIT GIRILMEDI - OTOMATIK',
        kaydeden: kaydedenKullanici
    });

    if (result.success) {
        localStorage.setItem(sentKey, new Date().toISOString());
        this.showNotification('Otomatik Kayit', `${target.saat} verisi otomatik olarak kaydedildi`, 'warning');
        this.loadLastRecords();
        const mailBody = `Saatlik Veri Girisi Uyarisi\n\nTarih: ${target.isoTarih}\nSaat: ${target.saat}\nVardiya: ${vardiya}\n\n${target.saat} icin saatlik veri girilmedi. Otomatik olarak bos kayit yapildi.`;
        await this.sendEmailAlert(`Saatlik Veri Girisi Uyarisi - ${target.saat} Kayit Girilmedi`, mailBody);
    } else {
        console.error('Otomatik kayit basarisiz:', result.error);
    }
};

// ============================================
// SAYFA YÜKLENDİĞİNDE BAŞLAT
// ============================================
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
        
        console.log('Saatlik Veri - Kullanici adi ayarlandi:', fullName || user.email || 'Kullanici');
    } catch (e) {
        console.error('Saatlik Veri - Kullanici bilgileri okunamadi:', e);
        const allElements = document.querySelectorAll('[id="userNameDisplay"]');
        allElements.forEach(element => {
            element.textContent = 'Kullanici';
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Önce kimlik dogrulama kontrolü
    checkAuth();
    
    SaatlikApp.init();
    
    // Sayısal inputlara formatlama
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value) {
                this.value = parseFloat(this.value).toFixed(3);
            }
        });
    });
});
