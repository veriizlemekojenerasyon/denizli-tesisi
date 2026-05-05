/**
 * KOJEN ENERJİ VERİLERİ - Google Sheets Entegrasyonu
 * Bu dosya kojen-enerji-veri.js ile birlikte kullanılır
 */

const KojenEnerjiSheetsConfig = {
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzL1RDBYT3SCS2Nvn6SY8ySkv7-6XZAbxe9gWenoeNVsoEUPEaO0bfDWQ0eWR7hnQEc/exec'
};

/**
 * Enerji verilerini Google Sheets'e kaydet
 * @param {Object} data - Kaydedilecek enerji verileri
 * @returns {Promise<Object>} - Kayıt sonucu
 */
async function saveEnerjiToSheets(data) {
    try {
        const url = KojenEnerjiSheetsConfig.WEB_APP_URL;
        
        // Tarih formatını düzelt (dd.MM.yyyy -> yyyy-MM-dd)
        let formattedTarih = data.tarih;
        if (formattedTarih && formattedTarih.includes('.')) {
            const parts = formattedTarih.split('.');
            formattedTarih = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else if (!formattedTarih) {
            formattedTarih = new Date().toISOString().split('T')[0]; // Bugün tarihi
        }
        
        // Parametreleri hazırla
        const params = new URLSearchParams({
            action: 'addRecord',
            tarih: formattedTarih,
            vardiya: data.vardiya || '',
            saat: data.saat || '',
            motor: data.motor || '',
            kaydeden: data.kaydeden || 'Admin',
            durum: data.durum || 'NORMAL'
        });
        
        // Motor çalışmıyor durumunda diğer veriler 0, ama son değerler korunur
        if (data.durum === 'MOTOR ÇALIŞMIYOR') {
            // Diğer değerler 0
            params.append('aydemVoltaji', '0');
            params.append('aktifGuc', '0');
            params.append('reaktifGuc', '0');
            params.append('cosPhi', '0');
            params.append('ortAkim', '0');
            params.append('ortGerilim', '0');
            params.append('notrAkim', '0');
            params.append('tahrikGerilimi', '0');
            // Son değerler (kaydedilen)
            params.append('toplamAktifEnerji', data.toplamAktifEnerji || '0');
            params.append('calismaSaati', data.calismaSaati || '0');
            params.append('kalkisSayisi', data.kalkisSayisi || '0');
        } else {
            // Normal durumda tüm veriler
            params.append('aydemVoltaji', data.aydemVoltaji || '0');
            params.append('aktifGuc', data.aktifGuc || '0');
            params.append('reaktifGuc', data.reaktifGuc || '0');
            params.append('cosPhi', data.cosPhi || '0');
            params.append('ortAkim', data.ortAkim || '0');
            params.append('ortGerilim', data.ortGerilim || '0');
            params.append('notrAkim', data.notrAkim || '0');
            params.append('tahrikGerilimi', data.tahrikGerilimi || '0');
            params.append('toplamAktifEnerji', data.toplamAktifEnerji || '0');
            params.append('calismaSaati', data.calismaSaati || '0');
            params.append('kalkisSayisi', data.kalkisSayisi || '0');
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params
        });
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Sheets kayıt hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Kayıt kontrolü - Belirli tarih, saat ve motor için kayıt var mı?
 * @param {string} motor - Motor adı (GM-1, GM-2, GM-3)
 * @param {string} tarih - Tarih (dd.MM.yyyy)
 * @param {string} saat - Saat (HH:MM)
 * @returns {Promise<Object>} - Kontrol sonucu
 */
async function checkExistingEnerjiRecord(motor, tarih, saat) {
    console.log('🔍 checkExistingEnerjiRecord başlatıldı:', motor, tarih, saat);
    
    try {
        // Tarih formatını düzelt
        let formattedTarih = tarih;
        if (formattedTarih.includes('.')) {
            const parts = formattedTarih.split('.');
            formattedTarih = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        console.log('📅 Formatlanmış tarih:', formattedTarih);
        
        const url = KojenEnerjiSheetsConfig.WEB_APP_URL + 
            `?action=checkExistingRecord&motor=${encodeURIComponent(motor)}&tarih=${encodeURIComponent(formattedTarih)}&saat=${encodeURIComponent(saat)}`;
        
        console.log('🌐 İstek URL:', url);
        console.log('📡 Fetch isteği gönderiliyor...');
        
        const response = await fetch(url);
        console.log('📡 Response status:', response.status);
        
        const result = await response.json();
        console.log('📊 Response result:', result.success ? 'SUCCESS' : 'FAILED');
        
        return result;
        
    } catch (error) {
        console.error('Kayıt kontrolü hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 🚀 TOPLU KAYIT KONTROLÜ - Tek seferde çoklu kayıt kontrolü
 * @param {Array} kombinasyonlar - [{motor, tarih, saat}, ...]
 * @returns {Promise<Object>} - Kontrol sonuçları
 */
async function checkMultipleEnerjiRecords(kombinasyonlar) {
    console.log('🚀 TOPLU KAYIT KONTROLÜ BAŞLATILIYOR:', kombinasyonlar.length, 'kombinasyon');
    console.log('📊 Gelen kombinasyonlar:', kombinasyonlar);
    
    try {
        // Tüm kombinasyonları tek bir string'e dönüştür
        const kontrolData = kombinasyonlar.map(k => `${k.motor}|${k.tarih}|${k.saat}`).join(',');
        
        console.log('📊 Oluşturulan kontrolData:', kontrolData);
        
        const url = KojenEnerjiSheetsConfig.WEB_APP_URL + 
            `?action=checkMultipleRecords&data=${encodeURIComponent(kontrolData)}`;
        
        console.log('🌐 Toplu kontrol URL:', url);
        console.log('📡 Toplu fetch isteği gönderiliyor...');
        
        const response = await fetch(url);
        console.log('📡 Response status:', response.status);
        
        const result = await response.json();
        console.log('📊 Toplu kontrol sonucu:', result);
        
        return result;
        
    } catch (error) {
        console.error('Toplu kayıt kontrolü hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Motor ve tarihe göre kayıtları getir
 * @param {string} motor - Motor adı
 * @param {string} tarih - Tarih (dd.MM.yyyy)
 * @returns {Promise<Object>} - Kayıtlar
 */
async function getEnerjiRecordsByMotorAndDate(motor, tarih) {
    try {
        // Tarih formatını düzelt
        let formattedTarih = tarih;
        if (formattedTarih.includes('.')) {
            const parts = formattedTarih.split('.');
            formattedTarih = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        const url = KojenEnerjiSheetsConfig.WEB_APP_URL + 
            `?action=getRecordsByMotorAndDate&motor=${encodeURIComponent(motor)}&tarih=${encodeURIComponent(formattedTarih)}`;
        
        const response = await fetch(url);
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Veri getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Son N kaydı getir
 * @param {number} count - Kayıt sayısı (varsayılan: 50)
 * @returns {Promise<Object>} - Kayıtlar
 */
async function getLastEnerjiRecords(count = 50) {
    try {
        const url = KojenEnerjiSheetsConfig.WEB_APP_URL + 
            `?action=getLastRecords&count=${count}`;
        
        const response = await fetch(url);
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Veri getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Tüm kayıtları getir
 * @returns {Promise<Object>} - Tüm kayıtlar
 */
async function getAllEnerjiRecords() {
    try {
        const url = KojenEnerjiSheetsConfig.WEB_APP_URL + '?action=getRecords';
        
        const response = await fetch(url);
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Veri getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Global scope'a ekle (HTML dosyasından erişim için)
window.KojenEnerjiSheetsConfig = KojenEnerjiSheetsConfig;
window.saveEnerjiToSheets = saveEnerjiToSheets;
window.checkExistingEnerjiRecord = checkExistingEnerjiRecord;
window.getEnerjiRecordsByMotorAndDate = getEnerjiRecordsByMotorAndDate;
window.getLastEnerjiRecords = getLastEnerjiRecords;
window.getAllEnerjiRecords = getAllEnerjiRecords;
