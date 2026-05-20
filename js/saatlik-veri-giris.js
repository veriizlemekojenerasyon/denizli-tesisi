/**
 * SAATLIK VERI GIRISI - Google Sheets Entegrasyonu
 * Bu dosya saatlik-veri-giris.html iÃ§in Google Sheets baÄŸlantÄ±sÄ±nÄ± saÄŸlar
 */

// ============================================
// YAPILANDIRMA - BU ALANI DOLDURUN
// ============================================
const SAATLIK_CONFIG = {
    // Google Apps Script Web App URL
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyb2Cww6ah8SzBUr3rgkvzuQuwRf-vJ2cMgw4xulxmjcEO34BNzhbky8QCWNIoUBXa7_Q/exec',
    
    // Sayfa baÅŸlÄ±ÄŸÄ±
    PAGE_NAME: 'Saatlik Veri GiriÅŸi',
    
    // VarsayÄ±lan kullanÄ±cÄ± adÄ±
    DEFAULT_USER: 'Admin',
    
    // ğŸ“§ Mail uyarÄ± ayarlarÄ±
    EMAIL_ENABLED: true, // Mail gÃ¶nderme aÃ§/kapa
    EMAIL_TO: 'mrtcsk0320@gmail.com', // UyarÄ± maili gÃ¶nderilecek adres
    EMAIL_SUBJECT: 'Saatlik Veri GiriÅŸi UyarÄ±sÄ± - KayÄ±t Girilmedi'
};

// ============================================
// SAATLIK VERI SAYFASI ANA NESNESÄ°
// ============================================
const SaatlikApp = {
    
    init: function() {
        console.log('SaatlikApp baÅŸlatÄ±lÄ±yor...');
        
        this.manualSlotSelected = false;
        this.setupEventListeners();
        this.setInitialValues();
        this.loadLastRecords();
        
        // ğŸ”¥ OTOMATÄ°K KAYIT KONTROLÃœ BAÅLAT
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
        // KayÄ±t kontrolÃ¼ iÃ§in placeholder
        // Google Sheets entegrasyonu yapÄ±ldÄ±ÄŸÄ±nda aktif edilecek
    },
    
    handleFormSubmit: async function(e) {
        e.preventDefault();
        if (!this.manualSlotSelected) {
            this.syncCurrentDateTime();
        }
        
        const submitBtn = document.getElementById('submitBtn');
        const originalBtnText = submitBtn ? submitBtn.textContent : 'Kaydet';
        
        if (submitBtn) {
            submitBtn.textContent = 'KAYDEDÄ°LÄ°YOR...';
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
            this.showNotification('Hata', 'LÃ¼tfen tarih ve saat seÃ§in!', 'error');
            if (submitBtn) {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
            return;
        }
        
        const result = await this.saveRecord(formData);
        
        if (submitBtn) {
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
        
        if (result.success) {
            this.showNotification('BaÅŸarÄ±lÄ±', result.message, 'success');
            this.loadLastRecords();
            this.lockForm(true);
        } else {
            this.showNotification('Hata', result.error || 'Ä°ÅŸlem baÅŸarÄ±sÄ±z!', 'error');
        }
    },
    
    // KayÄ±t var mÄ± kontrol et (Google Sheets)
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
            console.error('KayÄ±t kontrolÃ¼ hatasÄ±:', error);
            return false;
        }
    },
    
    // Google Sheets'e yeni kayÄ±t ekle
    addRecord: async function(data) {
        try {
            // Kaydeden kullanÄ±cÄ± bilgisini ekle
            const loggedInUser = localStorage.getItem('loggedInUser');
            if (loggedInUser) {
                try {
                    const user = JSON.parse(loggedInUser);
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    data.kaydeden = fullName || user.email || 'Bilinmeyen KullanÄ±cÄ±';
                    console.log('ğŸ‘¤ Kaydeden kullanÄ±cÄ±:', data.kaydeden);
                } catch (e) {
                    console.error('KullanÄ±cÄ± bilgileri okunamadÄ±:', e);
                    data.kaydeden = 'Bilinmeyen KullanÄ±cÄ±';
                }
            } else {
                data.kaydeden = 'Misafir KullanÄ±cÄ±';
                console.log('ğŸ‘¤ GiriÅŸ yapÄ±lmadÄ±, misafir olarak kaydediliyor');
            }
            
            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'addRecord');
            Object.keys(data).forEach(key => {
                url.searchParams.append(key, data[key]);
            });
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return await response.json();
        } catch (error) {
            console.error('KayÄ±t ekleme hatasÄ±:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ğŸ“§ Mail gÃ¶nderme fonksiyonu
    sendEmailAlert: async function(subject, body) {
        if (!SAATLIK_CONFIG.EMAIL_ENABLED) {
            console.log('ğŸ“§ Mail gÃ¶nderme kapalÄ±');
            return { success: true, message: 'Mail gÃ¶nderme kapalÄ±' };
        }
        
        try {
            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'sendEmail');
            url.searchParams.append('to', SAATLIK_CONFIG.EMAIL_TO);
            url.searchParams.append('subject', subject || SAATLIK_CONFIG.EMAIL_SUBJECT);
            url.searchParams.append('body', body);
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const result = await response.json();
            
            console.log('ğŸ“§ Mail sonucu:', result);
            return result;
        } catch (error) {
            console.error('Mail gÃ¶nderme hatasÄ±:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Google Sheets'te kayÄ±t gÃ¼ncelle
    updateRecord: async function(data) {
        try {
            // Kaydeden kullanÄ±cÄ± bilgisini ekle
            const loggedInUser = localStorage.getItem('loggedInUser');
            if (loggedInUser) {
                try {
                    const user = JSON.parse(loggedInUser);
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    data.kaydeden = fullName || user.email || 'Bilinmeyen KullanÄ±cÄ±';
                    console.log('ğŸ‘¤ Kaydeden kullanÄ±cÄ± (gÃ¼ncelleme):', data.kaydeden);
                } catch (e) {
                    console.error('KullanÄ±cÄ± bilgileri okunamadÄ±:', e);
                    data.kaydeden = 'Bilinmeyen KullanÄ±cÄ±';
                }
            } else {
                data.kaydeden = 'Misafir KullanÄ±cÄ±';
                console.log('ğŸ‘¤ GiriÅŸ yapÄ±lmadÄ±, misafir olarak gÃ¼ncelleniyor');
            }
            
            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'updateRecord');
            Object.keys(data).forEach(key => {
                url.searchParams.append(key, data[key]);
            });
            
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return await response.json();
        } catch (error) {
            console.error('KayÄ±t gÃ¼ncelleme hatasÄ±:', error);
            return { success: false, error: error.message };
        }
    },
    
    saveToLocal: function(data) {
        let records = JSON.parse(localStorage.getItem('saatlikVeriler') || '[]');
        
        // AynÄ± tarih/saat varsa gÃ¼ncelle
        const existingIndex = records.findIndex(r => r.tarih === data.tarih && r.saat === data.saat);
        
        if (existingIndex >= 0) {
            records[existingIndex] = data;
        } else {
            records.unshift(data);
        }
        
        // Sadece son 48 kaydÄ± tut
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
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">KayÄ±tlar yÃ¼klenemedi.</td></tr>';
                this.renderMissingHours([]);
            }
        } catch (error) {
            console.error('KayÄ±tlar yÃ¼klenirken hata:', error);
            // Hata durumunda localStorage'dan gÃ¶ster
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

    saveRecord: async function(data) {
        try {
            this.attachCurrentUser(data);

            const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'saveRecord');
            Object.keys(data).forEach(key => {
                url.searchParams.append(key, data[key]);
            });

            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return await response.json();
        } catch (error) {
            console.error('Kayit kaydetme hatasi:', error);
            return { success: false, error: error.message };
        }
    },

    attachCurrentUser: function(data) {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser) {
            try {
                const user = JSON.parse(loggedInUser);
                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                data.kaydeden = fullName || user.email || 'Bilinmeyen Kullanici';
                return;
            } catch (e) {
                console.error('Kullanici bilgileri okunamadi:', e);
            }
        }
        data.kaydeden = 'Misafir Kullanici';
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
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">HenÃ¼z kayÄ±t bulunmuyor.</td></tr>';
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
        if (confirm('Ã‡Ä±kÄ±ÅŸ yapmak istediÄŸinizden emin misiniz?')) {
            localStorage.removeItem('rememberedEmail');
            window.location.href = 'anasayfa.html';
        }
    },
    
    // Form inputlarÄ±nÄ± kilitle/aÃ§
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
    
    // ğŸ”¥ OTOMATÄ°K KAYIT KONTROLÃœ
    startAutoRecordCheck: function() {
        console.log('ğŸ”¥ Otomatik kayÄ±t kontrolÃ¼ baÅŸlatÄ±lÄ±yor...');
        
        // Her dakika kontrol et; hedef saat 59. dakika kuralina gore belirlenir.
        setInterval(() => {
            this.checkAndAutoRecord();
        }, 60 * 1000);
        
        // Sayfa yÃ¼klendiÄŸinde de kontrol et
        setTimeout(() => {
            this.checkAndAutoRecord();
        }, 5000);
    },
    
    // ğŸ”¥ OTOMATÄ°K KAYIT KONTROLÃœ VE GÃ–NDERÄ°M
    checkAndAutoRecord: async function() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        console.log(`ğŸ”¥ Saat kontrolÃ¼: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
        
        // Her saatin 59. dakikasÄ±nda kontrol et (08:59, 09:59, 10:59, vb.)
        if (currentMinute !== 59) {
            return;
        }
        
        console.log(`ğŸ”¥ ${currentHour}:59 kontrolÃ¼ yapÄ±lÄ±yor...`);
        
        // BugÃ¼nÃ¼n tarihini al
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        // GeÃ§erli saat iÃ§in kayÄ±t var mÄ± kontrol et
        const checkHour = String(currentHour).padStart(2, '0') + ':00';
        const hasRecord = await this.isExistingRecord(todayStr, checkHour);
        
        if (!hasRecord) {
            console.log(`ğŸš¨ ${checkHour} kaydÄ± bulunamadÄ±! Otomatik kayÄ±t gÃ¶nderiliyor...`);
            
            // Vardiya belirle
            const vardiya = this.getVardiyaByHour(currentHour);
            
            // Otomatik kayÄ±t verileri
            // Kaydeden kullanÄ±cÄ± bilgisini al
            const loggedInUser = localStorage.getItem('loggedInUser');
            let kaydedenKullanici = 'OTOMATÄ°K SÄ°STEM';
            
            if (loggedInUser) {
                try {
                    const user = JSON.parse(loggedInUser);
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    kaydedenKullanici = fullName || user.email || 'Bilinmeyen KullanÄ±cÄ±';
                    console.log('ğŸ‘¤ Otomatik kayÄ±t - Kaydeden kullanÄ±cÄ±:', kaydedenKullanici);
                } catch (e) {
                    console.error('KullanÄ±cÄ± bilgileri okunamadÄ±:', e);
                    kaydedenKullanici = 'Bilinmeyen KullanÄ±cÄ±';
                }
            }
            
            const autoData = {
                tarih: todayStr,
                saat: checkHour,
                vardiya: vardiya,
                aktifMwh: '0',
                reaktifMwh: '0',
                notlar: 'KAYIT GÄ°RÄ°LMEDÄ°',
                kaydeden: kaydedenKullanici
            };
            
            // KaydÄ± gÃ¶nder
            const result = await this.addRecord(autoData);
            
            if (result.success) {
                console.log(`âœ… Otomatik ${checkHour} kaydÄ± baÅŸarÄ±yla gÃ¶nderildi!`);
                this.showNotification('Otomatik KayÄ±t', `${checkHour} verisi otomatik olarak kaydedildi (KayÄ±t girilmedi)`, 'warning');
                this.loadLastRecords();
                
                // ğŸ“§ Mail gÃ¶nder
                const mailBody = `Saatlik Veri GiriÅŸi UyarÄ±sÄ±\n\nTarih: ${todayStr}\nSaat: ${checkHour}\nVardiya: ${vardiya}\n\n${checkHour} iÃ§in saatlik veri girilmedi. Otomatik olarak boÅŸ kayÄ±t yapÄ±ldÄ±.\n\nLÃ¼tfen ilgili personeli bilgilendirin.`;
                await this.sendEmailAlert(`Saatlik Veri GiriÅŸi UyarÄ±sÄ± - ${checkHour} KayÄ±t Girilmedi`, mailBody);
                
            } else {
                console.error('âŒ Otomatik kayÄ±t baÅŸarÄ±sÄ±z:', result.error);
            }
        } else {
            console.log(`âœ… ${checkHour} kaydÄ± mevcut, otomatik kayÄ±t gerekmiyor`);
        }
    }
};

// Dayanikli otomatik kontrol: 59. dakikadan sonra mevcut saati,
// sonraki saatte ise bir onceki saati kontrol eder.
SaatlikApp.getHourlyCheckTarget = function(date) {
    const target = new Date(date);
    if (target.getMinutes() < 59) {
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

    try {
        const url = new URL(SAATLIK_CONFIG.APPS_SCRIPT_URL);
        url.searchParams.append('action', 'checkHourlyMissingRecords');
        const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
        const serverResult = await response.json();

        if (serverResult.success) {
            if (serverResult.added) {
                this.showNotification('Otomatik Kayit', `${target.saat} verisi otomatik olarak kaydedildi`, 'warning');
                this.loadLastRecords();
            }
            localStorage.setItem(sentKey, new Date().toISOString());
            return;
        }

        console.error('Saatlik sunucu otomatik kayit kontrolu basarisiz:', serverResult.error);
    } catch (error) {
        console.error('Saatlik sunucu otomatik kayit kontrolu hatasi:', error);
    }

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
// SAYFA YÃœKLENDÄ°ÄÄ°NDE BAÅLAT
// ============================================
// Kimlik dogrulama kontrolÃ¼
function checkAuth() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        window.location.href = 'anasayfa.html';
        return;
    }
    
    try {
        const user = JSON.parse(loggedInUser);
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // TÃ¼m userNameDisplay elementlerini gÃ¼ncelle
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
    // Ã–nce kimlik dogrulama kontrolÃ¼
    checkAuth();
    
    SaatlikApp.init();
    
    // SayÄ±sal inputlara formatlama
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value) {
                this.value = parseFloat(this.value).toFixed(3);
            }
        });
    });
});

