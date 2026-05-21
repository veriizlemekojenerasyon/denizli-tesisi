/**
 * Motor Takip - Google Apps Script
 * Drive'a fotoğraf yükleme ve Sheets'e kayıt yapma
 * 
 * Drive Klasör: https://drive.google.com/drive/folders/1ae4WbGS2qXnKcJc9gX7Dc0Od2kSoTYiM
 * Sheets: https://docs.google.com/spreadsheets/d/1ep4yY5U_QRghohq6DtkbG68KT8MMFLVMXe6S7atd2AQ/edit
 */

// === AYARLAR ===
const DRIVE_FOLDER_ID = '1ae4WbGS2qXnKcJc9gX7Dc0Od2kSoTYiM';
const SHEET_ID = '1ep4yY5U_QRghohq6DtkbG68KT8MMFLVMXe6S7atd2AQ';
const SHEET_NAME = 'Motor Takip'; // Sayfa adı

/**
 * Web uygulaması entry point - POST isteklerini işler
 */
function doPost(e) {
  try {
    // Form verilerini al - FormData için postData kullan
    let params = {};
    
    if (e.postData) {
      // FormData veya JSON olarak gelen veri
      const contentType = e.postData.type || '';
      if (contentType.includes('application/json')) {
        params = JSON.parse(e.postData.contents);
      } else {
        // FormData parametreleri
        const contents = e.postData.contents;
        const pairs = contents.split('&');
        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i].split('=');
          params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
        }
      }
    }
    
    // 📧 Mail gönderme action'ı
    if (params.action === 'sendEmail') {
      const mailResult = sendMotorEmail(params);
      return createResponse(mailResult.success, mailResult.message || mailResult.error);
    }
    
    // Eksik parametre kontrolü
    if (!e.postData) {
      params = e.parameter || {};
    }
    
    // Gerekli alanları kontrol et (category veya kontrolYeri kabul et)
    const category = params.category || params.kontrolYeri;
    const motor = params.motor || params.Motor;
    
    if (!params.image || !category) {
      return createResponse(false, 'Eksik parametre: image ve category/kontrolYeri zorunlu');
    }

    // 1. Fotoğrafı Drive'a yükle
    const uploadResult = uploadImageToDrive(params);
    
    if (!uploadResult.success) {
      return createResponse(false, 'Drive yükleme hatası: ' + uploadResult.error);
    }

    // 2. Sheets'e kayıt ekle
    const sheetResult = addRecordToSheet(params, uploadResult.fileUrl, uploadResult.fileId);
    
    if (!sheetResult.success) {
      return createResponse(false, 'Sheets kayıt hatası: ' + sheetResult.error);
    }

    // Başarılı yanıt
    return createResponse(true, 'Kayıt başarıyla tamamlandı', {
      kayitNo: sheetResult.kayitNo,
      fileUrl: uploadResult.fileUrl,
      fileId: uploadResult.fileId,
      sheetRow: sheetResult.rowNumber
    });

  } catch (error) {
    console.error('doPost Hatası:', error);
    return createResponse(false, 'Sunucu hatası: ' + error.message);
  }
}

/**
 * CORS Preflight (OPTIONS) isteği için
 */
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * GET istekleri için - mevcut kayıtları getir
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    
    // Başlık satırını atla, kayıtları formatla
    const records = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // Kayıt No varsa
        records.push({
          'Kayıt No': row[0],
          'Tarih': row[1],
          'Saat': row[2],
          'Motor': row[3],
          'Kontrol Yeri': row[4],
          'Operatör': row[5],
          'Vardiya': row[6],
          'Drive Link': row[7],
          'Dosya ID': row[8],
          'timestamp': row[9]
        });
      }
    }

    // Tarihe göre sırala (en yeni önce)
    records.sort((a, b) => {
      const timeA = new Date(a['Tarih'] + ' ' + a['Saat']).getTime();
      const timeB = new Date(b['Tarih'] + ' ' + b['Saat']).getTime();
      return timeB - timeA;
    });

    return createResponse(true, 'Kayıtlar alındı', {
      records: records,
      total: records.length
    });

  } catch (error) {
    return createResponse(false, 'Hata: ' + error.message);
  }
}

/**
 * Base64 görüntüyü Drive'a yükle
 */
function uploadImageToDrive(params) {
  try {
    console.log('uploadImageToDrive başladı');
    
    // Base64 veriyi al (data:image/jpeg;base64, prefix'ini kaldır)
    let base64Data = params.image;
    if (base64Data.indexOf('base64,') !== -1) {
      base64Data = base64Data.split('base64,')[1];
    }
    console.log('Base64 uzunluk:', base64Data.length);

    // Blob oluştur
    const contentType = 'image/jpeg';
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, contentType, params.filename || 'motor-foto.jpg');
    console.log('Blob oluşturuldu, boyut:', blob.getBytes().length);

    // Hedef klasörü al
    console.log('DriveApp.getFolderById çağrılıyor, ID:', DRIVE_FOLDER_ID);
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    console.log('Klasör bulundu:', folder.getName());
    
    // Dosya adını oluştur
    const motor = params.motor || 'unknown';
    const category = params.category || 'unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${motor}_${category}_${timestamp}.jpg`;
    console.log('Dosya adı:', fileName);

    // Drive'a yükle
    console.log('Dosya yükleniyor...');
    const file = folder.createFile(blob);
    file.setName(fileName);
    console.log('Dosya yüklendi, ID:', file.getId());
    
    // Paylaşım ayarları (herkese görüntülenebilir link) - hata olursa atla
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      console.log('Paylaşım ayarları yapıldı');
    } catch (shareError) {
      console.warn('Paylaşım ayarı hatası (görmezden geliniyor):', shareError.message);
    }
    
    // URL ve ID döndür
    const fileUrl = file.getUrl();
    const fileId = file.getId();

    console.log('Drive yükleme başarılı:', fileName, fileUrl);

    return {
      success: true,
      fileUrl: fileUrl,
      fileId: fileId,
      fileName: fileName
    };

  } catch (error) {
    console.error('uploadImageToDrive Hatası:', error);
    console.error('Hata stack:', error.stack);
    return {
      success: false,
      error: error.message + ' (Stack: ' + error.stack + ')'
    };
  }
}

/**
 * Sheets'e kayıt ekle - çift kayıt kontrolü ile
 */
function addRecordToSheet(params, fileUrl, fileId) {
  try {
    const sheet = getOrCreateSheet();
    
    // Tarih ve saat bilgilerini işle - normalize et
    let trackingDate = params.trackingDate || params.tarih || new Date().toISOString().split('T')[0];
    let trackingTime = params.trackingTime || params.saat || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    // Tarih formatını normalize et (YYYY-MM-DD)
    if (trackingDate instanceof Date) {
      trackingDate = trackingDate.toISOString().split('T')[0];
    } else {
      const d = new Date(trackingDate);
      if (!isNaN(d.getTime())) {
        trackingDate = d.toISOString().split('T')[0];
      }
    }
    
    // Saat formatını normalize et (HH:mm)
    if (trackingTime instanceof Date) {
      const hours = trackingTime.getHours().toString().padStart(2, '0');
      const minutes = trackingTime.getMinutes().toString().padStart(2, '0');
      trackingTime = `${hours}:${minutes}`;
    } else {
      const timeMatch = String(trackingTime).match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        trackingTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      }
    }
    
    console.log('Normalize edilmiş:', { trackingDate, trackingTime });
    
    // Motor adını formatla (tek formatta)
    const motorMap = {
      'gm1': 'GM-1',
      'gm2': 'GM-2',
      'gm3': 'GM-3'
    };
    const motor = motorMap[params.motor] || params.motor || '-';
    
    // Kontrol yerini al - orijinal ve lowercase versiyonlar
    const kontrolYeriRaw = params.category || params.kontrolYeri || '-';
    const kontrolYeri = String(kontrolYeriRaw).toLowerCase();  // karşılaştırma için
    
    // ÇİFT KAYIT KONTROLÜ - Saat aralığı kontrolü
    const data = sheet.getDataRange().getValues();
    
    console.log('KONTROL BAŞLIYOR... Yeni kayıt:', motor, trackingDate, trackingTime, kontrolYeri);
    
    // Yeni kayıt saatini al (sadece saat kısmı)
    const newHour = String(trackingTime).split(':')[0];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      let existingDate = row[1];
      let existingTime = row[2];
      const existingMotor = row[3];
      const existingKontrol = String(row[4]).toLowerCase();
      
      // Mevcut kayıt tarihini normalize et
      if (existingDate instanceof Date) {
        existingDate = existingDate.toISOString().split('T')[0];
      } else {
        const d = new Date(existingDate);
        if (!isNaN(d.getTime())) {
          existingDate = d.toISOString().split('T')[0];
        } else {
          existingDate = String(existingDate);
        }
      }
      
      // Mevcut kayıt saatini normalize et
      if (existingTime instanceof Date) {
        const hours = existingTime.getHours().toString().padStart(2, '0');
        const minutes = existingTime.getMinutes().toString().padStart(2, '0');
        existingTime = `${hours}:${minutes}`;
      } else {
        const timeMatch = String(existingTime).match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          existingTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        } else {
          existingTime = String(existingTime);
        }
      }
      
      // Mevcut kayıt saatini al (sadece saat kısmı)
      const existingHour = String(existingTime).split(':')[0];
      
      console.log(`Satır ${i}:`, existingMotor, existingDate, existingTime, existingHour, existingKontrol);
      console.log(`Karşılaştırma:`, {
        motorMatch: existingMotor === motor,
        kontrolMatch: existingKontrol === kontrolYeri,
        dateMatch: String(existingDate) === String(trackingDate),
        hourMatch: existingHour === newHour
      });

      if (
        existingMotor === motor &&
        existingKontrol === kontrolYeri &&
        String(existingDate) === String(trackingDate) &&
        existingHour === newHour
      ) {
        console.log('ÇİFT KAYIT BULUNDU!');
        return {
          success: false,
          duplicate: true,
          error: `Bu motor (${motor}) için ${trackingDate} tarihinde saat ${newHour}:00-${newHour}:59 arasında ${kontrolYeriRaw} kontrolü zaten kaydedilmiş`
        };
      }
    }
    console.log('Çift kayıt bulunamadı, kayıt yapılıyor...');
    
    // Son kayıt numarasını bul
    let lastKayitNo = 0;
    for (let i = 1; i < data.length; i++) {
      const rowKayitNo = parseInt(data[i][0].toString().replace('MT-', ''));
      if (!isNaN(rowKayitNo) && rowKayitNo > lastKayitNo) {
        lastKayitNo = rowKayitNo;
      }
    }
    
    const newKayitNo = 'MT-' + (lastKayitNo + 1).toString().padStart(5, '0');
    
    // Vardiya adını Türkçeleştir
    const vardiyaMap = {
      'morning': 'Gündüz',
      'evening': 'Akşam', 
      'night': 'Gece'
    };
    const vardiya = vardiyaMap[params.shift] || vardiyaMap[params.vardiya] || params.shift || params.vardiya || '-';
    
    // Operatör adını al
    const operatorMap = {
      'ibrahim-ogun': 'İbrahim Ogün Şahin',
      'yakup-can': 'Yakup Can Cin',
      'oguzhan-yaylali': 'Oğuzhan Yaylalı',
      'altan-hunoglu': 'Altan Hunoğlu'
    };
    const operator = operatorMap[params.operator] || params.operator || '-';
    
    // Yeni satır ekle
    const newRow = [
      newKayitNo,           // A: Kayıt No
      trackingDate,         // B: Tarih
      trackingTime,         // C: Saat
      motor,                // D: Motor (tek formatta)
      kontrolYeriRaw,        // E: Kontrol Yeri (orijinal HT/LT/Yağ Seviyesi)
      operator,             // F: Operatör
      vardiya,              // G: Vardiya
      fileUrl,              // H: Drive Link
      fileId,               // I: Dosya ID
      new Date().toISOString() // J: Timestamp
    ];
    
    sheet.appendRow(newRow);
    const rowNumber = sheet.getLastRow();
    
    console.log('Sheets kayıt başarılı:', newKayitNo, 'Satır:', rowNumber);

    return {
      success: true,
      kayitNo: newKayitNo,
      rowNumber: rowNumber
    };

  } catch (error) {
    console.error('addRecordToSheet Hatası:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sheet'i al veya oluştur
 */
function getOrCreateSheet() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    // Sayfa var mı kontrol et
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      // Yeni sayfa oluştur
      sheet = ss.insertSheet(SHEET_NAME);
      
      // Başlık satırını ekle
      const headers = [
        'Kayıt No', 'Tarih', 'Saat', 'Motor', 'Kontrol Yeri', 
        'Operatör', 'Vardiya', 'Drive Link', 'Dosya ID', 'Timestamp'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Başlık stilini ayarla
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#667eea');
      headerRange.setFontColor('#ffffff');
      
      // Sütun genişliklerini ayarla
      sheet.setColumnWidth(1, 100);  // Kayıt No
      sheet.setColumnWidth(2, 100);  // Tarih
      sheet.setColumnWidth(3, 80);   // Saat
      sheet.setColumnWidth(4, 80);   // Motor
      sheet.setColumnWidth(5, 120);  // Kontrol Yeri
      sheet.setColumnWidth(6, 150);  // Operatör
      sheet.setColumnWidth(7, 100);  // Vardiya
      sheet.setColumnWidth(8, 300); // Drive Link
      sheet.setColumnWidth(9, 150);  // Dosya ID
      sheet.setColumnWidth(10, 150); // Timestamp
      
      console.log('Yeni sheet oluşturuldu:', SHEET_NAME);
    }
    
    return sheet;
    
  } catch (error) {
    throw new Error('Sheet erişim hatası: ' + error.message);
  }
}

/**
 * JSON yanıt oluştur
 */
function createResponse(success, message, data) {
  const response = {
    success: success,
    message: message
  };
  
  if (data) {
    Object.assign(response, data);
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 📧 Motor Takip Mail Gönderme Fonksiyonu
 */
function sendMotorEmail(data) {
  try {
    // Parametreleri kontrol et
    if (!data) {
      return { success: false, error: 'Veri parametresi eksik' };
    }
    
    var to = data.to || 'mrtcsk0320@gmail.com'; // Varsayılan mail adresi
    var subject = data.subject || 'Motor Takip Uyarısı';
    var body = data.body || '';
    
    Logger.log('Motor takip mail gönderiliyor: ' + to + ', Konu: ' + subject);
    
    // Mail gönder
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      htmlBody: body.replace(/\n/g, '<br>')
    });
    
    Logger.log('Motor takip mail başarıyla gönderildi: ' + to);
    return { success: true, message: 'Mail başarıyla gönderildi!' };
    
  } catch (error) {
    Logger.log('Motor takip mail gönderme hatası: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Manuel test fonksiyonu
 */
function testScript() {
  console.log('Script çalışıyor...');
  console.log('Drive Klasör ID:', DRIVE_FOLDER_ID);
  console.log('Sheet ID:', SHEET_ID);
  
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    console.log('Drive klasörü erişimi OK:', folder.getName());
    
    const sheet = getOrCreateSheet();
    console.log('Sheet erişimi OK:', sheet.getName());
    
  } catch (error) {
    console.error('Test hatası:', error);
  }
}
