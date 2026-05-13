/**
 * KOJEN MOTOR VERİLERİ - Google Sheets Entegrasyonu
 * Bu dosya kojen-motor-veri.js ile birlikte kullanılır
 */

const KojenMotorSheetsConfig = {
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxqjnnIjj6hWMuKYa_ioBPx6hS8STMtDHeVj5__TaG632-V6Cel5BxNGWDkZ_wMmI16fw/exec',
    EMAIL_ENABLED: true,
    EMAIL_TO: 'mrtcsk0320@gmail.com',
    EMAIL_SUBJECT: 'Kojen Motor Veri Uyarısı - Kayıt Girilmedi'
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
        const urlParams = new URLSearchParams({
            action: 'addRecord',
            motor: data.motor,
            tarih: formattedTarih,
            vardiya: data.vardiya,
            saat: data.saat,
            kaydeden: data.kaydeden || 'Admin',
            durum: data.durum || 'NORMAL',
            not: data.not || ''
        });
        
        // Motor çalışmıyorsa tüm değerleri 0 olarak gönder
        if (data.durum === 'MOTOR ÇALIŞMIYOR') {
            // Doğru alanları gönder
            urlParams.append('jenYatakSicaklikDE', '0');
            urlParams.append('jenYatakSicaklikNDE', '0');
            urlParams.append('sogutmaSuyuSicaklik', '0');
            urlParams.append('sogutmaSuyuBasinc', '0');
            urlParams.append('yagSicaklik', '0');
            urlParams.append('yagBasinc', '0');
            urlParams.append('sarjSicaklik', '0');
            urlParams.append('sarjBasinc', '0');
            urlParams.append('gazRegulatoru', '0');
            urlParams.append('makineDairesiSicaklik', '0');
            urlParams.append('karterBasinc', '0');
            urlParams.append('onKamaraFarkBasinc', '0');
            urlParams.append('sargiSicaklik1', '0');
            urlParams.append('sargiSicaklik2', '0');
            urlParams.append('sargiSicaklik3', '0');
        } else {
            // Normal değerleri gönder
            urlParams.append('jenYatakSicaklikDE', data.jenYatakSicaklikDE || '0');
            urlParams.append('jenYatakSicaklikNDE', data.jenYatakSicaklikNDE || '0');
            urlParams.append('sogutmaSuyuSicaklik', data.sogutmaSuyuSicaklik || '0');
            urlParams.append('sogutmaSuyuBasinc', data.sogutmaSuyuBasinc || '0');
            urlParams.append('yagSicaklik', data.yagSicaklik || '0');
            urlParams.append('yagBasinc', data.yagBasinc || '0');
            urlParams.append('sarjSicaklik', data.sarjSicaklik || '0');
            urlParams.append('sarjBasinc', data.sarjBasinc || '0');
            urlParams.append('gazRegulatoru', data.gazRegulatoru || '0');
            urlParams.append('makineDairesiSicaklik', data.makineDairesiSicaklik || '0');
            urlParams.append('karterBasinc', data.karterBasinc || '0');
            urlParams.append('onKamaraFarkBasinc', data.onKamaraFarkBasinc || '0');
            urlParams.append('sargiSicaklik1', data.sargiSicaklik1 || '0');
            urlParams.append('sargiSicaklik2', data.sargiSicaklik2 || '0');
            urlParams.append('sargiSicaklik3', data.sargiSicaklik3 || '0');
        }
        
        const fullUrl = url + '?' + urlParams.toString();
        
        const response = await fetch(fullUrl, {
            method: 'GET',
            cache: 'no-cache'
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
 * 🚀 TOPLU MOTOR KAYIT KONTROLÜ - Tek seferde çoklu kayıt kontrolü
 * @param {Array} kombinasyonlar - [{motor, tarih, saat}, ...]
 * @returns {Promise<Object>} - Kontrol sonuçları
 */
async function checkMultipleMotorRecords(kombinasyonlar) {
    console.log('🚀 TOPLU MOTOR KAYIT KONTROLÜ BAŞLATILIYOR:', kombinasyonlar.length, 'kombinasyon');
    console.log('📊 Gelen kombinasyonlar:', kombinasyonlar);
    
    try {
        // Tüm kombinasyonları tek bir string'e dönüştür
        const kontrolData = kombinasyonlar.map(k => {
            console.log('🔍 Kombinasyon:', k);
            return `${k.motor}|${k.tarih}|${k.saat}`;
        }).join(',');
        
        console.log('📊 Oluşturulan kontrolData:', kontrolData);
        
        const url = KojenMotorSheetsConfig.WEB_APP_URL + 
            `?action=checkMultipleRecords&data=${encodeURIComponent(kontrolData)}`;
        
        console.log('🌐 Toplu motor kontrol URL:', url);
        console.log('📡 Toplu motor fetch isteği gönderiliyor...');
        
        const response = await fetch(url);
        console.log('📡 Response status:', response.status);
        
        const result = await response.json();
        console.log('📊 Toplu motor kontrol sonucu:', result);
        
        return result;
        
    } catch (error) {
        console.error('Toplu motor kayıt kontrolü hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Motor ve tarihe göre kayıtları getir
 * @param {string} motor - Motor adı
 * @param {string} tarih - Tarih (dd.MM.yyyy)
 * @param {string} vardiya - Vardiya (08-16, 16-24, 24-08)
 * @returns {Promise<Object>} - Kayıtlar
 */
async function getMotorRecordsByMotorAndDate(motor, tarih, vardiya) {
    try {
        // Tarih formatını düzelt
        let formattedTarih = tarih;
        if (formattedTarih.includes('.')) {
            const parts = formattedTarih.split('.');
            formattedTarih = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        let url = KojenMotorSheetsConfig.WEB_APP_URL + 
            `?action=getRecordsByMotorAndDate&motor=${encodeURIComponent(motor)}&tarih=${encodeURIComponent(formattedTarih)}`;
        
        // Vardiya parametresi varsa ekle
        if (vardiya) {
            url += `&vardiya=${encodeURIComponent(vardiya)}`;
        }
        
        console.log(`🔍 API çağrısı: ${url}`);
        
        const response = await fetch(url);
        const result = await response.json();
        console.log(`🔍 API yanıt:`, result);
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

/**
 * Mail uyarısı gönder
 * @param {string} subject - Mail konusu
 * @param {string} body - Mail içeriği
 * @returns {Promise<Object>} - Mail sonucu
 */
async function sendKojenMotorEmailAlert(subject, body) {
    if (!KojenMotorSheetsConfig.EMAIL_ENABLED) {
        console.log('Kojen motor mail gönderme kapalı');
        return { success: true, message: 'Mail gönderme kapalı' };
    }

    try {
        const url = new URL(KojenMotorSheetsConfig.WEB_APP_URL);
        url.searchParams.append('action', 'sendEmail');
        url.searchParams.append('to', KojenMotorSheetsConfig.EMAIL_TO);
        url.searchParams.append('subject', subject || KojenMotorSheetsConfig.EMAIL_SUBJECT);
        url.searchParams.append('body', body || '');

        const response = await fetch(url, { method: 'GET', mode: 'cors' });
        return await response.json();

    } catch (error) {
        console.error('Kojen motor mail gönderme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Çoklu motor kaydı ekleme
 * @param {Array} records - Kaydedilecek motor verileri dizisi
 * @returns {Promise<Object>} - Kayıt sonucu
 */
async function addMultipleMotorRecords(records) {
    try {
        const url = KojenMotorSheetsConfig.WEB_APP_URL;
        
        // Verileri JSON string'e çevir
        const jsonData = JSON.stringify(records);
        
        // Parametreleri hazırla
        const urlParams = new URLSearchParams({
            action: 'addMultipleRecords',
            data: jsonData
        });
        
        console.log('🚀 Çoklu motor kaydı gönderiliyor:', records.length, 'kayıt');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: urlParams.toString()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📊 Çoklu motor kayıt sonucu:', result);
        
        return result;
        
    } catch (error) {
        console.error('Çoklu motor kayıt hatası:', error);
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
window.addMultipleMotorRecords = addMultipleMotorRecords;
window.sendKojenMotorEmailAlert = sendKojenMotorEmailAlert;
