/**
 * KOJEN MOTOR VERİLERİ - Google Sheets Entegrasyonu
 * Bu dosya kojen-motor-veri.js ile birlikte kullanılır
 */

const KojenMotorSheetsConfig = {
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzUnvtc9XKqFbEx3jUC9MBbaERxwmQ2jVp8j3x4p7Y0N1DZwi3WW0xmllk_rxFMqzBn/exec'
};

/**
 * Motor verilerini Google Sheets'e kaydet
 * @param {Object} data - Kaydedilecek motor verileri
 * @returns {Promise<Object>} - Kayıt sonucu
 */
async function saveMotorToSheets(data) {
    try {
        const url = KojenMotorSheetsConfig.WEB_APP_URL;
        
        // Tarih formatını düzelt (dd.MM.yyyy -> yyyy-MM-dd)
        let formattedTarih = data.tarih;
        if (formattedTarih.includes('.')) {
            const parts = formattedTarih.split('.');
            formattedTarih = `${parts[2]}-${parts[1]}-${parts[0]}`;
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
        
        // Motor çalışmıyor durumunda verileri ekleme
        if (data.durum !== 'MOTOR ÇALIŞMIYOR') {
            params.append('jenYatakSicaklikDE', data.jenYatakSicaklikDE || '0');
            params.append('jenYatakSicaklikNDE', data.jenYatakSicaklikNDE || '0');
            params.append('sogutmaSuyuSicaklik', data.sogutmaSuyuSicaklik || '0');
            params.append('sogutmaSuyuBasinc', data.sogutmaSuyuBasinc || '0');
            params.append('yagSicaklik', data.yagSicaklik || '0');
            params.append('yagBasinc', data.yagBasinc || '0');
            params.append('sarjSicaklik', data.sarjSicaklik || '0');
            params.append('sarjBasinc', data.sarjBasinc || '0');
            params.append('gazRegulatoru', data.gazRegulatoru || '0');
            params.append('makineDairesiSicaklik', data.makineDairesiSicaklik || '0');
            params.append('karterBasinc', data.karterBasinc || '0');
            params.append('onKamaraFarkBasinc', data.onKamaraFarkBasinc || '0');
            params.append('sargiSicaklik1', data.sargiSicaklik1 || '0');
            params.append('sargiSicaklik2', data.sargiSicaklik2 || '0');
            params.append('sargiSicaklik3', data.sargiSicaklik3 || '0');
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
async function checkExistingMotorRecord(motor, tarih, saat) {
    try {
        // Tarih formatını düzelt
        let formattedTarih = tarih;
        if (formattedTarih.includes('.')) {
            const parts = formattedTarih.split('.');
            formattedTarih = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        const url = KojenMotorSheetsConfig.WEB_APP_URL + 
            `?action=checkExistingRecord&motor=${encodeURIComponent(motor)}&tarih=${encodeURIComponent(formattedTarih)}&saat=${encodeURIComponent(saat)}`;
        
        const response = await fetch(url);
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Kayıt kontrolü hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Motor ve tarihe göre kayıtları getir
 * @param {string} motor - Motor adı
 * @param {string} tarih - Tarih (dd.MM.yyyy)
 * @returns {Promise<Object>} - Kayıtlar
 */
async function getMotorRecordsByMotorAndDate(motor, tarih) {
    try {
        // Tarih formatını düzelt
        let formattedTarih = tarih;
        if (formattedTarih.includes('.')) {
            const parts = formattedTarih.split('.');
            formattedTarih = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        const url = KojenMotorSheetsConfig.WEB_APP_URL + 
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
async function getLastMotorRecords(count = 50) {
    try {
        const url = KojenMotorSheetsConfig.WEB_APP_URL + 
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
async function getAllMotorRecords() {
    try {
        const url = KojenMotorSheetsConfig.WEB_APP_URL + '?action=getRecords';
        
        const response = await fetch(url);
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Veri getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Global scope'a ekle (HTML dosyasından erişim için)
window.KojenMotorSheetsConfig = KojenMotorSheetsConfig;
window.saveMotorToSheets = saveMotorToSheets;
window.checkExistingMotorRecord = checkExistingMotorRecord;
window.getMotorRecordsByMotorAndDate = getMotorRecordsByMotorAndDate;
window.getLastMotorRecords = getLastMotorRecords;
window.getAllMotorRecords = getAllMotorRecords;
