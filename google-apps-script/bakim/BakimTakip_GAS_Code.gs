// Bakım Takibi Google Apps Script
// Sheet ID ve Sheet Name olmadan dinamik çalışır

// Global değişkenler - Kullanıcı linkleri
const SPREADSHEET_NAME = "Bakım Takip Sistemi";
const SPREADSHEET_ID = "1226RpbRSRp4ryBgUVxw69wPwcmJq0wHQ0OafEHqnuoo"; // Kullanıcı Sheets ID
const DRIVE_FOLDERS = {
  PERIODIC: "1TGrKfYHrayZmiGW1J8GQd70jPtByBKY9", // Periyodik Bakım Drive ID
  NORMAL: "10D4LgnGYN0TMdweTIfeMjoKSX2ZLaYCA",   // Normal Bakım Drive ID  
  FAULT: "1TGrKfYHrayZmiGW1J8GQd70jPtByBKY9"     // Arıza Bakım Drive ID (Periyodik ile aynı)
};

const KOJEN_ENERJI_API_URL = "https://script.google.com/macros/s/AKfycby5FigD2Hj_Qq9fzrjDjPmg44xQUGu2gklxfdXFS8UD6wIFtwhgbdUC9lIj3EkYb3tViQ/exec";
const OIL_SAMPLE_INTERVAL_HOURS = 500;
const OIL_SAMPLE_WARNING_HOURS = 400;
const ALTERNATOR_GREASE_INTERVAL_HOURS = 1000;
const ALTERNATOR_GREASE_WARNING_HOURS = 900;

const SHEET_NAMES = {
  PERIODIC_MAINTENANCE: "Periyodik Bakım Kayıtları",
  NORMAL_MAINTENANCE: "Normal Bakım Kayıtları", 
  FAULT_MAINTENANCE: "Arıza Bakım Kayıtları",
  STATISTICS: "İstatistikler",
  SETTINGS: "Ayarlar",
  MOTOR_HOURS: "Motor Saatleri"
};

// Ana doPost fonksiyonu
function doPost(e) {
  try {
    // e veya e.parameters undefined ise varsayılan değerler kullan
    if (!e) {
      Logger.log('UYARI: e parametresi undefined, test modu');
      e = { parameters: {} };
    }
    
    if (!e.parameters) {
      Logger.log('UYARI: e.parameters undefined, boş obje oluşturuluyor');
      e.parameters = {};
    }
    
    const params = e.parameters;
    // params.action bir array olduğu için ilk elemanı al
    const action = (params.action && params.action[0]) || 'save';
    
    Logger.log('İşlem: ' + action);
    Logger.log('Parametreler: ' + JSON.stringify(params));
    
    // Spreadsheet'i oluştur veya al
    const ss = getOrCreateSpreadsheet();
    
    switch(action) {
      case 'save':
        return saveMaintenanceRecord(ss, params);
      case 'getStats':
        return getMaintenanceStats(ss, params);
      case 'getReport':
        return getMaintenanceReport(ss, params);
      case 'getActiveRecords':
        return getActiveRecords(ss, params);
      case 'closeRecord':
        return closeRecord(ss, params);
      case 'getMotorHours':
        return getMotorHoursV2(ss);
      case 'updateMotorHours':
        return updateMotorHours(ss, params);
      case 'updateOilSample':
        return updateOilSample(ss, params);
      case 'updateAlternatorGrease':
        return updateAlternatorGrease(ss, params);
      case 'init':
        return initializeSystem(ss);
      case 'test':
        return testConnection(ss);
      default:
        Logger.log('Geçersiz işlem: ' + action);
        return createResponse(false, "Geçersiz işlem: " + action);
    }
  } catch (error) {
    Logger.log('HATA: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return createResponse(false, "Sistem hatası: " + error.toString());
  }
}

// GET istekleri için doGet fonksiyonu
function doGet(e) {
  Logger.log('GET isteği alındı');
  if (!e) {
    Logger.log('UYARI: GET isteğinde e parametresi undefined');
    e = { parameter: {} };
  }
  return doPost(e);
}

// Spreadsheet'i oluştur veya mevcut olanı al
function getOrCreateSpreadsheet() {
  try {
    // Kullanıcının mevcut spreadsheet'ini kullan
    if (SPREADSHEET_ID) {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      Logger.log('Mevcut spreadsheet kullanılıyor: ' + SPREADSHEET_ID);
      
      // Sayfaları kontrol et ve gerekirse oluştur
      createSheets(ss);
      
      return ss;
    }
    
    // Eğer ID yoksa, isimle ara
    const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    
    if (files.hasNext()) {
      // Mevcut spreadsheet'i kullan
      const file = files.next();
      const ss = SpreadsheetApp.openById(file.getId());
      Logger.log('Mevcut spreadsheet bulundu: ' + file.getId());
      
      createSheets(ss);
      return ss;
    } else {
      // Yeni spreadsheet oluştur
      const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
      Logger.log('Yeni spreadsheet oluşturuldu: ' + ss.getId());
      
      // Sayfaları oluştur
      createSheets(ss);
      
      // Paylaşım ayarları (isteğe bağlı)
      ss.addEditor(Session.getActiveUser().getEmail());
      
      return ss;
    }
  } catch (error) {
    throw new Error('Spreadsheet oluşturulamadı: ' + error.toString());
  }
}

// Sayfaları oluştur
function createSheets(ss) {
  // Her bakım türü için ayrı sayfalar oluştur
  const maintenanceSheets = [
    { name: SHEET_NAMES.PERIODIC_MAINTENANCE, title: 'Periyodik Bakım Kayıtları' },
    { name: SHEET_NAMES.NORMAL_MAINTENANCE, title: 'Normal Bakım Kayıtları' },
    { name: SHEET_NAMES.FAULT_MAINTENANCE, title: 'Arıza Bakım Kayıtları' }
  ];
  
  maintenanceSheets.forEach(sheetInfo => {
    createMaintenanceSheet(ss, sheetInfo.name, sheetInfo.title);
  });
}

function createMaintenanceSheet(ss, sheetName, sheetTitle) {
  let sheet = ss.getSheetByName(sheetName);
  
  if (sheet) {
    // Mevcut sayfayı kontrol et ve düzelt
    Logger.log('Mevcut ' + sheetName + ' sayfası kontrol ediliyor...');
    
    // Mevcut sütun sayısını kontrol et
    const lastColumn = sheet.getLastColumn();
    Logger.log('Mevcut sütun sayısı: ' + lastColumn);
    
    if (lastColumn > 21) {
      // Fazla sütunları temizle
      Logger.log('Fazla sütunlar temizleniyor...');
      sheet.deleteColumns(22, lastColumn - 21);
    }
    
    // Header'ları kontrol et ve güncelle
    const currentHeaders = sheet.getRange('A1:U1').getValues()[0];
    const expectedHeaders = [
      'Kayıt No', 'Tarih', 'Motor', 'Bakım Türü', 'Bakım Tipi',
      'Teknisyen', 'Firma', 'Notlar', 'Dosyalar', 'Durum', 'Oluşturulma Tarihi',
      'Motor Saati', 'Barkod No', 'Alt. Ön (cm³)', 'Alt. Arka (cm³)', 'Alt. Toplam (cm³)',
      'Filtre Motor Saati', 'Filtre Yağ Saati', 'HT Sıcaklık (°C)', 'LT Sıcaklık (°C)', 'Ceket Suyu (°C)'
    ];
    
    // Header'ları güncelle
    sheet.getRange('A1:U1')
      .setValues([expectedHeaders])
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('white');
      
  } else {
    // Yeni sayfa oluştur
    sheet = ss.insertSheet(sheetName);
    
    const maintenanceHeaders = [
      'Kayıt No',
      'Tarih',
      'Motor',
      'Bakım Türü',
      'Bakım Tipi',
      'Teknisyen',
      'Firma',
      'Notlar',
      'Dosyalar',
      'Durum',
      'Oluşturulma Tarihi',
      'Motor Saati',
      'Barkod No',
      'Alt. Ön (cm³)',
      'Alt. Arka (cm³)',
      'Alt. Toplam (cm³)',
      'Filtre Motor Saati',
      'Filtre Yağ Saati',
      'HT Sıcaklık (°C)',
      'LT Sıcaklık (°C)',
      'Ceket Suyu (°C)'
    ];
    
    sheet.getRange('A1:U1')
      .setValues([maintenanceHeaders])
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('white');
      
    Logger.log('Yeni ' + sheetName + ' sayfası oluşturuldu');
  }
  
  // Sütun genişlikleri (16 sütun)
  sheet.setColumnWidth(1, 120);  // Kayıt No
  sheet.setColumnWidth(2, 100);  // Tarih
  sheet.setColumnWidth(3, 80);   // Motor
  sheet.setColumnWidth(4, 80);   // Bakım Türü
  sheet.setColumnWidth(5, 100);  // Bakım Tipi
  sheet.setColumnWidth(6, 120);  // Teknisyen
  sheet.setColumnWidth(7, 150);  // Firma
  sheet.setColumnWidth(8, 100);  // Notlar
  sheet.setColumnWidth(9, 300);  // Dosyalar
  sheet.setColumnWidth(10, 200); // Durum
  sheet.setColumnWidth(11, 80);  // Oluşturulma Tarihi
  sheet.setColumnWidth(12, 80);  // Motor Saati
  sheet.setColumnWidth(13, 100); // Barkod No
  sheet.setColumnWidth(14, 80);  // Alt. Ön (cm³)
  sheet.setColumnWidth(15, 80);  // Alt. Arka (cm³)
  sheet.setColumnWidth(16, 90);  // Alt. Toplam (cm³)
  sheet.setColumnWidth(17, 90);  // Filtre Motor Saati
  sheet.setColumnWidth(18, 90);  // Filtre Yağ Saati
  sheet.setColumnWidth(19, 80);  // HT Sıcaklık (°C)
  sheet.setColumnWidth(20, 80);  // LT Sıcaklık (°C)
  sheet.setColumnWidth(21, 90);  // Ceket Suyu (°C)
  
  // İstatistikler sayfası
  let statsSheet = ss.getSheetByName(SHEET_NAMES.STATISTICS);
  
  if (statsSheet) {
    Logger.log('Mevcut İstatistikler sayfası kontrol ediliyor...');
    
    const lastColumn = statsSheet.getLastColumn();
    if (lastColumn > 8) {
      statsSheet.deleteColumns(9, lastColumn - 8);
    }
    
    const statsHeaders = [
      'Tarih', 'Toplam Bakım', 'Periyodik', 'Normal', 'Arıza', 'GM-1', 'GM-2', 'GM-3'
    ];
    
    statsSheet.getRange('A1:H1')
      .setValues([statsHeaders])
      .setFontWeight('bold')
      .setBackground('#34a853')
      .setFontColor('white');
      
  } else {
    statsSheet = ss.insertSheet(SHEET_NAMES.STATISTICS);
    
    const statsHeaders = [
      'Tarih',
      'Toplam Bakım',
      'Periyodik',
      'Normal',
      'Arıza',
      'GM-1',
      'GM-2',
      'GM-3'
    ];
    
    statsSheet.getRange('A1:H1')
      .setValues([statsHeaders])
      .setFontWeight('bold')
      .setBackground('#34a853')
      .setFontColor('white');
  }
  
  statsSheet.setColumnWidth(1, 100);
  statsSheet.setColumnWidth(2, 100);
  statsSheet.setColumnWidth(3, 100);
  statsSheet.setColumnWidth(4, 100);
  statsSheet.setColumnWidth(5, 100);
  statsSheet.setColumnWidth(6, 80);
  statsSheet.setColumnWidth(7, 80);
  statsSheet.setColumnWidth(8, 80);
  
  // Ayarlar sayfası
  let settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  
  if (settingsSheet) {
    Logger.log('Mevcut Ayarlar sayfası kontrol ediliyor...');
    
    const lastColumn = settingsSheet.getLastColumn();
    if (lastColumn > 3) {
      settingsSheet.deleteColumns(4, lastColumn - 3);
    }
    
    const settingsHeaders = ['Ayar', 'Değer', 'Açıklama'];
    settingsSheet.getRange('A1:C1')
      .setValues([settingsHeaders])
      .setFontWeight('bold')
      .setBackground('#fbbc04')
      .setFontColor('white');
      
  } else {
    settingsSheet = ss.insertSheet(SHEET_NAMES.SETTINGS);
    
    const settingsHeaders = ['Ayar', 'Değer', 'Açıklama'];
    const settingsData = [
      ['Son Kayıt No', '0', 'Otomatik artan kayıt numarası'],
      ['Sistem Versiyonu', '1.0', 'Bakım takip sistemi versiyonu'],
      ['Oluşturulma Tarihi', new Date().toLocaleDateString('tr-TR'), 'Sistem kurulum tarihi']
    ];
    
    settingsSheet.getRange('A1:C1')
      .setValues([settingsHeaders])
      .setFontWeight('bold')
      .setBackground('#fbbc04')
      .setFontColor('white');
    
    settingsSheet.getRange('A2:C4')
      .setValues(settingsData);
  }
  
  settingsSheet.setColumnWidth(1, 150);
  settingsSheet.setColumnWidth(2, 200);
  settingsSheet.setColumnWidth(3, 300);
  
  // Motor Saatleri sayfası
  let motorHoursSheet = ss.getSheetByName(SHEET_NAMES.MOTOR_HOURS);
  
  if (motorHoursSheet) {
    Logger.log('Mevcut Motor Saatleri sayfası kontrol ediliyor...');
    
    const lastColumn = motorHoursSheet.getLastColumn();
    if (lastColumn > 10) {
      motorHoursSheet.deleteColumns(11, lastColumn - 10);
    }
    
    const motorHoursHeaders = ['Motor', 'Çalışma Saati', 'Son Yağ Numune Saati', 'Son Yağ Numune Tarihi', 'Bir Sonraki Yağ Numune', 'Notlar', 'Son Alternatör Gresleme Saati', 'Son Alternatör Gresleme Tarihi', 'Bir Sonraki Alternatör Gresleme', 'Alternatör Notlar'];
    motorHoursSheet.getRange('A1:J1')
      .setValues([motorHoursHeaders])
      .setFontWeight('bold')
      .setBackground('#ea4335')
      .setFontColor('white');
      
  } else {
    motorHoursSheet = ss.insertSheet(SHEET_NAMES.MOTOR_HOURS);
    
    const motorHoursHeaders = ['Motor', 'Çalışma Saati', 'Son Yağ Numune Saati', 'Son Yağ Numune Tarihi', 'Bir Sonraki Yağ Numune', 'Notlar', 'Son Alternatör Gresleme Saati', 'Son Alternatör Gresleme Tarihi', 'Bir Sonraki Alternatör Gresleme', 'Alternatör Notlar'];
    const motorHoursData = [
      ['GM-1', '0', '0', '', '500', 'Otomatik hesaplanır', '0', '', '1000', ''],
      ['GM-2', '0', '0', '', '500', 'Otomatik hesaplanır', '0', '', '1000', ''],
      ['GM-3', '0', '0', '', '500', 'Otomatik hesaplanır', '0', '', '1000', '']
    ];
    
    motorHoursSheet.getRange('A1:J1')
      .setValues([motorHoursHeaders])
      .setFontWeight('bold')
      .setBackground('#ea4335')
      .setFontColor('white');
    
    motorHoursSheet.getRange('A2:J4')
      .setValues(motorHoursData);
  }
  
  motorHoursSheet.setColumnWidth(1, 80);
  motorHoursSheet.setColumnWidth(2, 120);
  motorHoursSheet.setColumnWidth(3, 150);
  motorHoursSheet.setColumnWidth(4, 150);
  motorHoursSheet.setColumnWidth(5, 150);
  motorHoursSheet.setColumnWidth(6, 200);
  motorHoursSheet.setColumnWidth(7, 180);
  motorHoursSheet.setColumnWidth(8, 180);
  motorHoursSheet.setColumnWidth(9, 200);
  motorHoursSheet.setColumnWidth(10, 200);
  
  Logger.log('Tüm sayfalar başarılya kontrol edildi ve hazırlandı');
}

// Bakım kaydı kaydet
function saveMaintenanceRecord(ss, params) {
  try {
    Logger.log('=== BAKIM KAYDI BAŞLATILIYOR ===');
    Logger.log('Raw parametreler: ' + JSON.stringify(params));
    
    // Parametreleri array'den string'e çevir - güçlendirilmiş versiyon
    const getParam = (key) => {
      const val = params[key];
      Logger.log('getParam - ' + key + ': ' + JSON.stringify(val) + ' (type: ' + typeof val + ')');
      if (Array.isArray(val)) return val[0] || '';
      if (typeof val === 'undefined' || val === null) return '';
      return String(val);
    };
    
    // Bakım türüne göre doğru sayfayı seç
    const maintenanceType = getParam('type');
    let sheetName;
    
    if (maintenanceType && maintenanceType.toLowerCase().includes('periyodik')) {
      sheetName = SHEET_NAMES.PERIODIC_MAINTENANCE;
    } else if (maintenanceType && maintenanceType.toLowerCase().includes('normal')) {
      sheetName = SHEET_NAMES.NORMAL_MAINTENANCE;
    } else if (maintenanceType && maintenanceType.toLowerCase().includes('arıza')) {
      sheetName = SHEET_NAMES.FAULT_MAINTENANCE;
    } else {
      sheetName = SHEET_NAMES.PERIODIC_MAINTENANCE; // Varsayılan
    }
    
    Logger.log('Seçilen bakım türü: ' + maintenanceType + ', Sayfa: ' + sheetName);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(sheetName + ' sayfası bulunamadı');
    }
    
    Logger.log('Sayfa bulundu: ' + sheet.getName());
    
    // Kayıt numarasını al
    const lastRow = sheet.getLastRow();
    Logger.log('Son satır: ' + lastRow);
    
    const recordNo = lastRow === 1 ? generateRecordNo('', maintenanceType) : generateRecordNo(sheet.getRange(lastRow, 1).getValue(), maintenanceType);
    Logger.log('Kayıt numarası: ' + recordNo);
    
    // Dosya yükleme (varsa)
    let uploadedFiles = '';
    const filesParam = getParam('files');
    if (filesParam && filesParam !== 'undefined' && filesParam !== '' && filesParam !== '[]') {
      Logger.log('Dosyalar işleniyor...');
      uploadedFiles = uploadFilesToDrive(params, getParam('type') || 'normal');
      Logger.log('Dosyalar yüklendi: ' + uploadedFiles);
    }
    
    // Parametreleri al ve kontrol et
    const record = [
      recordNo || '',
      getParam('date') || new Date().toLocaleDateString('tr-TR'),
      getParam('motor') || '',
      getParam('type') || '',
      getParam('subtype') || '',
      getParam('technician') || '',
      getParam('company') || '',
      getParam('notes') || '',
      uploadedFiles,
      getParam('status') || 'Aktif',
      new Date().toLocaleDateString('tr-TR'),
      getParam('motorHours') || '',  // Motor Saati
      getParam('barcodeNumber') || '',  // Barkod No
      getParam('alternatorFront') || '',  // Alt. Ön (cm³)
      getParam('alternatorRear') || '',  // Alt. Arka (cm³)
      getParam('alternatorTotal') || '',  // Alt. Toplam (cm³)
      getParam('filterMotorHours') || '',  // Filtre Motor Saati
      getParam('filterOilHours') || '',  // Filtre Yağ Saati
      getParam('htTemperature') || '',  // HT Sıcaklık (°C)
      getParam('ltTemperature') || '',  // LT Sıcaklık (°C)
      getParam('jacketTemperature') || ''  // Ceket Suyu (°C)
    ];
    
    Logger.log('Kayıt dizisi oluşturuldu, uzunluk: ' + record.length);
    Logger.log('Kayıt verisi: ' + JSON.stringify(record));
    
    // Yeni satır ekle
    sheet.appendRow(record);
    Logger.log('Satır eklendi');
    
    // Formatlama
    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 1, 1, 21).setFontFamily('Arial').setFontSize(10);
    Logger.log('Formatlama yapıldı');
    
    // Kayıt numarasını güncelle
    updateLastRecordNo(ss, recordNo);
    Logger.log('Kayıt numarası güncellendi');
    
    // İstatistikleri güncelle
    updateStatistics(ss, params);
    Logger.log('İstatistikler güncellendi');
    
    Logger.log('Bakım kaydı başarıyla eklendi: ' + recordNo);
    
    return createResponse(true, "Kayıt başarıyla eklendi", {
      recordNo: recordNo,
      timestamp: new Date().toLocaleDateString('tr-TR'),
      files: uploadedFiles
    });
    
  } catch (error) {
    Logger.log('KAYIT HATASI: ' + error.toString());
    Logger.log('Hata detayı: ' + error.stack);
    throw new Error('Kayıt eklenemedi: ' + error.toString());
  }
}

// Dosyaları Drive'a yükle - Klasör linki döndür
function uploadFilesToDrive(params, maintenanceType) {
  try {
    Logger.log('=== DOSYA YÜKLEME BAŞLATILIYOR ===');
    
    // maintenanceType'ı string'e çevir (array olabilir)
    const typeStr = Array.isArray(maintenanceType) ? maintenanceType[0] : maintenanceType;
    Logger.log('Maintenance type (string): ' + typeStr);
    
    // files parametresini array'den string'e çevir
    const filesParam = Array.isArray(params.files) ? params.files[0] : params.files;
    Logger.log('Files param: ' + filesParam);
    
    // Bakım türüne göre doğru Drive folder'ını seç
    let folderId = DRIVE_FOLDERS.NORMAL;
    let folderName = 'Normal Bakım';
    
    if (typeStr) {
      const typeLower = typeStr.toLowerCase();
      if (typeLower.includes('periyodik')) {
        folderId = DRIVE_FOLDERS.PERIODIC;
        folderName = 'Periyodik Bakım';
      } else if (typeLower.includes('normal')) {
        folderId = DRIVE_FOLDERS.NORMAL;
        folderName = 'Normal Bakım';
      } else if (typeLower.includes('ariza')) {
        folderId = DRIVE_FOLDERS.FAULT;
        folderName = 'Arıza Bakımı';
      }
    }
    
    Logger.log('Seçilen folder: ' + folderName + ' (' + folderId + ')');
    
    // Drive folder'ını al
    const folder = DriveApp.getFolderById(folderId);
    const folderUrl = 'https://drive.google.com/drive/folders/' + folderId;
    Logger.log('Folder URL: ' + folderUrl);
    
    // Dosya kontrolü
    let filesArray = [];
    if (filesParam && filesParam !== 'undefined' && filesParam !== '' && filesParam !== '[]') {
      try {
        filesArray = JSON.parse(filesParam);
        Logger.log('Parse edilen dosya sayısı: ' + filesArray.length);
      } catch (e) {
        Logger.log('JSON parse hatası: ' + e);
      }
    }
    
    // motor parametresini al
    const motorParam = Array.isArray(params.motor) ? params.motor[0] : params.motor;
    
    let uploadedCount = 0;
    
    // Dosyaları yükle
    if (filesArray && filesArray.length > 0) {
      filesArray.forEach((fileData, index) => {
        try {
          if (!fileData.base64) {
            Logger.log('Dosya ' + (index + 1) + ' için base64 yok');
            return;
          }
          
          let base64Data = fileData.base64;
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }
          
          const blob = Utilities.base64Decode(base64Data);
          const fileBlob = Utilities.newBlob(blob, fileData.type || 'application/octet-stream', fileData.name);
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `${motorParam || 'Bilinmeyen'}_${typeStr || 'Bakim'}_${timestamp}_${fileData.name}`;
          
          const driveFile = folder.createFile(fileBlob.setName(fileName));
          driveFile.setSharing(DriveApp.Domain.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          uploadedCount++;
          Logger.log('✅ Yüklendi: ' + fileName);
          
        } catch (err) {
          Logger.log('❌ Dosya hatası: ' + err);
        }
      });
    }
    
    Logger.log('=== YÜKLEME TAMAMLANDI ===');
    Logger.log(uploadedCount + ' dosya yüklendi');
    
    // Klasör linkini döndür
    return folderUrl;
    
  } catch (error) {
    Logger.log('❌❌ Drive hatası: ' + error);
    return '';
  }
}

// Kayıt numarası oluştur
function generateRecordNo(lastRecordNo, maintenanceType) {
  if (!lastRecordNo) {
    // İlk kayıt için bakım türüne göre prefix
    switch(maintenanceType) {
      case 'Periyodik': return 'PB-00001';
      case 'Normal': return 'NB-00001';
      case 'Arıza': return 'AB-00001';
      default: return 'BK-00001';
    }
  }
  
  // Mevcut kayıt numarasından prefix ve numarayı ayır
  let prefix = 'BK';
  let match = lastRecordNo.match(/([A-Z]+)-(\d+)/);
  
  if (match) {
    prefix = match[1];
    const nextNumber = parseInt(match[2]) + 1;
    return prefix + '-' + nextNumber.toString().padStart(5, '0');
  } else {
    // Eğer format uymazsa, bakım türüne göre yeni kayıt oluştur
    switch(maintenanceType) {
      case 'Periyodik': return 'PB-00001';
      case 'Normal': return 'NB-00001';
      case 'Arıza': return 'AB-00001';
      default: return 'BK-00001';
    }
  }
}

// Son kayıt numarasını güncelle
function updateLastRecordNo(ss, recordNo) {
  const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  const recordNoCell = settingsSheet.getRange('A2:B2');
  recordNoCell.setValues([['Son Kayıt No', recordNo]]);
}

// Belirli bir aydaki istatistikleri hesapla
function calculateMonthlyStatistics(ss, year, month) {
  try {
    Logger.log(`=== ${year}-${month} AYI İSTATİSTİKLERİ HESAPLANIYOR ===`);
    
    // Sayfaları al
    const periodicSheet = ss.getSheetByName(SHEET_NAMES.PERIODIC_MAINTENANCE);
    const normalSheet = ss.getSheetByName(SHEET_NAMES.NORMAL_MAINTENANCE);
    const faultSheet = ss.getSheetByName(SHEET_NAMES.FAULT_MAINTENANCE);
    
    Logger.log('Sayfa durumları:');
    Logger.log('  - Periyodik: ' + (periodicSheet ? 'BULUNDU' : 'YOK'));
    Logger.log('  - Normal: ' + (normalSheet ? 'BULUNDU' : 'YOK'));
    Logger.log('  - Arıza: ' + (faultSheet ? 'BULUNDU' : 'YOK'));
    
    // İstatistikleri tutacak obje
    const stats = {
      total: 0,
      periodic: 0,
      normal: 0,
      fault: 0,
      gm1: 0,
      gm2: 0,
      gm3: 0
    };
    
    // Yardımcı fonksiyon: Motor kodunu normalize et
    function normalizeMotor(motorValue) {
      if (!motorValue) return '';
      return String(motorValue).toLowerCase().replace(/[-\s]/g, '');
    }
    
    // Yardımcı fonksiyon: Sayfadaki kayıtları say
    function countRecords(sheet, type, typeLabel) {
      if (!sheet) {
        Logger.log(typeLabel + ' sayfası bulunamadı, atlanıyor');
        return;
      }
      
      const lastRow = sheet.getLastRow();
      Logger.log(`${typeLabel} sayfası son satır: ${lastRow}`);
      
      if (lastRow <= 1) {
        Logger.log(typeLabel + ' sayfasında kayıt yok');
        return;
      }
      
      // 3 kolon oku: Kayıt No(0), Tarih(1), Motor(2)
      const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
      Logger.log(`${typeLabel} sayfasından ${data.length} satır okundu`);
      
      let count = 0;
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        // Tarih değerini olduğu gibi al (Date objesi veya string olabilir)
        const recordDate = row[1];
        const motorRaw = row[2];
        const motor = normalizeMotor(motorRaw);
        
        Logger.log(`${typeLabel} Satır ${i+2}: Tarih="${recordDate}" (tip: ${typeof recordDate}), Motor="${motorRaw}" -> normalize="${motor}"`);
        
        // Tarih kontrolü - Date objesi veya string olarak geçir
        const inMonth = isDateInMonth(recordDate, year, month);
        Logger.log(`  -> isDateInMonth sonucu = ${inMonth}`);
        
        if (inMonth) {
          count++;
          stats[type]++;
          stats.total++;
          
          // Motor bazında say (gm1, gm2, gm3 formatında)
          if (motor.includes('gm1')) {
            stats.gm1++;
            Logger.log('  -> GM1 sayıldı');
          } else if (motor.includes('gm2')) {
            stats.gm2++;
            Logger.log('  -> GM2 sayıldı');
          } else if (motor.includes('gm3')) {
            stats.gm3++;
            Logger.log('  -> GM3 sayıldı');
          } else {
            Logger.log('  -> Motor eşleşmedi: ' + motor);
          }
        }
      }
      
      Logger.log(`${typeLabel} sayfasında ${count} kayıt sayıldı`);
    }
    
    // Tüm sayfalardan kayıtları say
    countRecords(periodicSheet, 'periodic', 'Periyodik');
    countRecords(normalSheet, 'normal', 'Normal');
    countRecords(faultSheet, 'fault', 'Arıza');
    
    Logger.log('=== HESAPLANAN İSTATİSTİKLER ===');
    Logger.log('  - Toplam: ' + stats.total);
    Logger.log('  - Periyodik: ' + stats.periodic);
    Logger.log('  - Normal: ' + stats.normal);
    Logger.log('  - Arıza: ' + stats.fault);
    Logger.log('  - GM1: ' + stats.gm1);
    Logger.log('  - GM2: ' + stats.gm2);
    Logger.log('  - GM3: ' + stats.gm3);
    
    return stats;
  } catch (error) {
    Logger.log('❌ calculateMonthlyStatistics hatası: ' + error.toString());
    Logger.log('Hata stack: ' + error.stack);
    return { total: 0, periodic: 0, normal: 0, fault: 0, gm1: 0, gm2: 0, gm3: 0 };
  }
}

// Tarih belirli ay/yıl içinde mi kontrol et (Date objesi veya DD.MM.YYYY formatı)
function isDateInMonth(dateInput, year, month) {
  try {
    if (!dateInput || dateInput === '') return false;
    
    let recordYear, recordMonth;
    
    // Eğer Date objesi geldiyse
    if (dateInput instanceof Date) {
      recordYear = dateInput.getFullYear();
      recordMonth = dateInput.getMonth() + 1; // JavaScript aylar 0-11
      Logger.log(`  -> Date objesi algılandı: ${dateInput} -> Yıl: ${recordYear}, Ay: ${recordMonth}`);
    } else {
      // String formatı - DD.MM.YYYY formatını parse et
      const dateStr = String(dateInput).trim();
      const parts = dateStr.split('.');
      if (parts.length !== 3) {
        Logger.log(`  -> Geçersiz tarih formatı: ${dateStr}`);
        return false;
      }
      
      recordYear = parseInt(parts[2], 10);
      recordMonth = parseInt(parts[1], 10);
    }
    
    // Ay ve yıl eşleşiyor mu?
    const result = recordYear === year && recordMonth === month;
    Logger.log(`  -> Karşılaştırma: ${recordYear} === ${year} && ${recordMonth} === ${month} = ${result}`);
    return result;
  } catch (error) {
    Logger.log('❌ Tarih parse hatası: ' + dateInput + ' - ' + error.toString());
    return false;
  }
}

// İstatistikleri güncelle - Bakım tarihine göre ay bazlı hesaplama
function updateStatistics(ss, params) {
  try {
    Logger.log('=== İSTATİSTİKLER GÜNCELLENİYOR ===');
    Logger.log('Params: ' + JSON.stringify(params));
    
    let statsSheet = ss.getSheetByName(SHEET_NAMES.STATISTICS);
    
    // İstatistikler sayfası yoksa oluştur
    if (!statsSheet) {
      Logger.log('İstatistikler sayfası bulunamadı, oluşturuluyor...');
      statsSheet = ss.insertSheet(SHEET_NAMES.STATISTICS);
      // Başlıkları oluştur
      statsSheet.getRange(1, 1, 1, 8).setValues([['Tarih', 'Toplam Bakım', 'Periyodik', 'Normal', 'Arıza', 'GM-1', 'GM-2', 'GM-3']]);
      statsSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      // Sütun genişlikleri
      statsSheet.setColumnWidth(1, 12);
      statsSheet.setColumnWidths(2, 7, 10);
      Logger.log('İstatistikler sayfası oluşturuldu');
    }
    
    // Bakım tarihini params'dan al (DD.MM.YYYY formatında)
    const maintenanceDateStr = Array.isArray(params.date) ? params.date[0] : (params.date || '');
    Logger.log('Bakım tarihi (raw): ' + maintenanceDateStr);
    
    let year, month, monthLabel, fullMonthLabel;
    
    if (maintenanceDateStr && maintenanceDateStr.includes('.')) {
      // DD.MM.YYYY formatını parse et
      const dateParts = maintenanceDateStr.split('.');
      if (dateParts.length === 3) {
        year = parseInt(dateParts[2], 10);
        month = parseInt(dateParts[1], 10);
        monthLabel = month.toString().padStart(2, '0') + '.' + year;
        fullMonthLabel = getMonthName(month) + ' ' + year;
        Logger.log(`✅ Bakım tarihi parse edildi: ${maintenanceDateStr} -> Ay: ${month}, Yıl: ${year}, Label: ${monthLabel}`);
      } else {
        // Format uymazsa bugünün tarihini kullan
        const today = new Date();
        year = today.getFullYear();
        month = today.getMonth() + 1;
        monthLabel = month.toString().padStart(2, '0') + '.' + year;
        fullMonthLabel = getMonthName(month) + ' ' + year;
        Logger.log('⚠️ Tarih formatı uyumsuz, bugünün tarihi kullanılıyor: ' + monthLabel);
      }
    } else {
      // Tarih yoksa bugünün tarihini kullan
      const today = new Date();
      year = today.getFullYear();
      month = today.getMonth() + 1;
      monthLabel = month.toString().padStart(2, '0') + '.' + year;
      fullMonthLabel = getMonthName(month) + ' ' + year;
      Logger.log('⚠️ Bakım tarihi bulunamadı, bugünün tarihi kullanılıyor: ' + monthLabel);
    }
    
    Logger.log(`📊 İstatistikler hesaplanıyor: ${fullMonthLabel} (${monthLabel})`);
    
    // Bakım tarihinin olduğu ayın istatistiklerini hesapla
    const calculatedStats = calculateMonthlyStatistics(ss, year, month);
    
    Logger.log('Hesaplanan istatistikler: ' + JSON.stringify(calculatedStats));
    
    // Ay kaydını bul veya oluştur
    const lastRow = statsSheet.getLastRow();
    let monthRow = -1;
    
    Logger.log(`İstatistikler sayfası son satır: ${lastRow}`);
    
    // İlk satır başlık kontrolü
    if (lastRow === 0 || lastRow === 1) {
      // Başlıkları oluştur
      statsSheet.getRange(1, 1, 1, 8).setValues([['Tarih', 'Toplam Bakım', 'Periyodik', 'Normal', 'Arıza', 'GM-1', 'GM-2', 'GM-3']]);
      statsSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      Logger.log('Başlıklar oluşturuldu');
    }
    
    // Mevcut ayı ara
    for (let i = 2; i <= statsSheet.getLastRow(); i++) {
      const rowValue = statsSheet.getRange(i, 1).getValue();
      // Date objesini stringe çevir (Google Sheets bazen tarih olarak algılar)
      const rowValueStr = rowValue instanceof Date ? 
        (rowValue.getMonth() + 1).toString().padStart(2, '0') + '.' + rowValue.getFullYear() :
        String(rowValue).trim();
      Logger.log(`Satır ${i} kontrol ediliyor: "${rowValueStr}" === "${monthLabel}"?`);
      if (rowValueStr === monthLabel || rowValueStr === fullMonthLabel) {
        monthRow = i;
        Logger.log(`✅ Mevcut ay bulundu: Satır ${monthRow}`);
        break;
      }
    }
    
    if (monthRow === -1) {
      // Yeni ay kaydı oluştur
      Logger.log(`Yeni ay kaydı oluşturuluyor: ${monthLabel}`);
      statsSheet.appendRow([monthLabel, 0, 0, 0, 0, 0, 0, 0]);
      monthRow = statsSheet.getLastRow();
      Logger.log(`✅ Yeni ay kaydı oluşturuldu: ${monthLabel} (satır: ${monthRow})`);
    }
    
    // Hesaplanan istatistikleri yaz
    const values = [
      calculatedStats.total,
      calculatedStats.periodic,
      calculatedStats.normal,
      calculatedStats.fault,
      calculatedStats.gm1,
      calculatedStats.gm2,
      calculatedStats.gm3
    ];
    
    Logger.log(`İstatistikler yazılıyor: Satır ${monthRow}, Kolon 2-8, Değerler: ${JSON.stringify(values)}`);
    statsSheet.getRange(monthRow, 2, 1, 7).setValues([values]);
    
    Logger.log(`✅ ${fullMonthLabel} istatistikleri güncellendi: Toplam=${calculatedStats.total}, Periyodik=${calculatedStats.periodic}, Normal=${calculatedStats.normal}, Arıza=${calculatedStats.fault}, GM1=${calculatedStats.gm1}, GM2=${calculatedStats.gm2}, GM3=${calculatedStats.gm3}`);
    
    // TOPLAM BAKIM ÖZET SATIRINI GÜNCELLE
    updateTotalMaintenanceSummary(statsSheet);
    
    Logger.log('=== İSTATİSTİKLER GÜNCELLENDİ ===');
    
  } catch (error) {
    Logger.log('❌ updateStatistics hatası: ' + error.toString());
    Logger.log('❌ Hata stack: ' + error.stack);
  }
}

// Toplam Bakım Özet Satırını Güncelle
function updateTotalMaintenanceSummary(statsSheet) {
  try {
    Logger.log('📊 Toplam Bakım Özeti hesaplanıyor...');
    
    const lastRow = statsSheet.getLastRow();
    
    // En altta "TOPLAM" satırı var mı kontrol et
    let totalRow = -1;
    for (let i = 2; i <= lastRow; i++) {
      const rowValue = statsSheet.getRange(i, 1).getValue();
      if (rowValue.toString().toUpperCase() === 'TOPLAM') {
        totalRow = i;
        Logger.log('✅ Mevcut TOPLAM satırı bulundu: Satır ' + totalRow);
        break;
      }
    }
    
    // Tüm aylık verileri topla
    let totalStats = {
      total: 0,
      periodic: 0,
      normal: 0,
      fault: 0,
      gm1: 0,
      gm2: 0,
      gm3: 0
    };
    
    // Aylık verileri topla (TOPLAM satırı hariç)
    for (let i = 2; i <= lastRow; i++) {
      if (i === totalRow) continue; // TOPLAM satırını atla
      
      const rowValue = statsSheet.getRange(i, 1).getValue();
      if (rowValue && rowValue.toString().toUpperCase() !== 'TOPLAM') {
        // Bu satırdaki verileri topla
        totalStats.total += statsSheet.getRange(i, 2).getValue() || 0;
        totalStats.periodic += statsSheet.getRange(i, 3).getValue() || 0;
        totalStats.normal += statsSheet.getRange(i, 4).getValue() || 0;
        totalStats.fault += statsSheet.getRange(i, 5).getValue() || 0;
        totalStats.gm1 += statsSheet.getRange(i, 6).getValue() || 0;
        totalStats.gm2 += statsSheet.getRange(i, 7).getValue() || 0;
        totalStats.gm3 += statsSheet.getRange(i, 8).getValue() || 0;
      }
    }
    
    if (totalRow === -1) {
      // Yeni TOPLAM satırı ekle
      Logger.log('📊 Yeni TOPLAM satırı ekleniyor...');
      statsSheet.appendRow(['TOPLAM', totalStats.total, totalStats.periodic, totalStats.normal, totalStats.fault, totalStats.gm1, totalStats.gm2, totalStats.gm3]);
      totalRow = statsSheet.getLastRow();
      
      // TOPLAM satırını formatla
      statsSheet.getRange(totalRow, 1, 1, 8)
        .setFontWeight('bold')
        .setBackground('#f1f3f4')
        .setFontColor('#202124');
    } else {
      // Mevcut TOPLAM satırını güncelle
      Logger.log('📊 Mevcut TOPLAM satırı güncelleniyor...');
      const totalValues = [
        totalStats.total,
        totalStats.periodic,
        totalStats.normal,
        totalStats.fault,
        totalStats.gm1,
        totalStats.gm2,
        totalStats.gm3
      ];
      statsSheet.getRange(totalRow, 2, 1, 7).setValues([totalValues]);
    }
    
    Logger.log(`✅ Toplam Bakım Özeti güncellendi: Toplam=${totalStats.total}, Periyodik=${totalStats.periodic}, Normal=${totalStats.normal}, Arıza=${totalStats.fault}, GM1=${totalStats.gm1}, GM2=${totalStats.gm2}, GM3=${totalStats.gm3}`);
    
  } catch (error) {
    Logger.log('❌ updateTotalMaintenanceSummary hatası: ' + error.toString());
  }
}

// Ay ismini getir (Türkçe)
function getMonthName(monthNumber) {
  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  return months[monthNumber - 1] || 'Bilinmiyor';
}

// Türkçe tarih formatını parse et (DD.MM.YYYY -> Date)
function parseTurkishDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // DD.MM.YYYY formatını parse et
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JavaScript aylar 0-11
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  
  // Alternatif: Standart Date parse dene
  const standardDate = new Date(dateStr);
  if (!isNaN(standardDate.getTime())) {
    return standardDate;
  }
  
  return null;
}

// İstatistikleri al - Ayrı sayfalardan oku
function getMaintenanceStats(ss, params = {}) {
  try {
    Logger.log('🔍 getMaintenanceStats başlatıldı - Ayrı sayfalardan okuma');
    
    // Eğer ss parametresi yoksa, spreadsheet'i al
    if (!ss) {
      Logger.log('⚠️ ss parametresi yok, getOrCreateSpreadsheet() çağrılıyor...');
      ss = getOrCreateSpreadsheet();
      Logger.log('📋 ss alındı: ' + (ss ? 'VAR' : 'YOK'));
    }
    
    Logger.log('📋 ss parametresi: ' + (ss ? 'VAR' : 'YOK'));
    Logger.log('📋 SHEET_NAMES.PERIODIC_MAINTENANCE: ' + SHEET_NAMES.PERIODIC_MAINTENANCE);
    Logger.log('📋 SHEET_NAMES.NORMAL_MAINTENANCE: ' + SHEET_NAMES.NORMAL_MAINTENANCE);
    Logger.log('📋 SHEET_NAMES.FAULT_MAINTENANCE: ' + SHEET_NAMES.FAULT_MAINTENANCE);
    
    // Spreadsheet tüm sayfalarını listele
    if (ss) {
      const allSheets = ss.getSheets();
      Logger.log('📊 Tüm sayfalar (' + allSheets.length + '):');
      allSheets.forEach(sheet => {
        Logger.log('  - ' + sheet.getName());
      });
    }
    
    // Ayrı bakım sayfalarını al
    const periodicSheet = ss.getSheetByName(SHEET_NAMES.PERIODIC_MAINTENANCE);
    const normalSheet = ss.getSheetByName(SHEET_NAMES.NORMAL_MAINTENANCE);
    const faultSheet = ss.getSheetByName(SHEET_NAMES.FAULT_MAINTENANCE);
    
    Logger.log('📊 Sayfa durumları:');
    Logger.log('  - Periyodik: ' + (periodicSheet ? 'BULUNDU' : 'BULUNAMADI'));
    Logger.log('  - Normal: ' + (normalSheet ? 'BULUNDU' : 'BULUNAMADI'));
    Logger.log('  - Arıza: ' + (faultSheet ? 'BULUNDU' : 'BULUNAMADI'));
    
    // Eğer hiç sheet yoksa boş yanıt dön
    if (!periodicSheet && !normalSheet && !faultSheet) {
      Logger.log('❌ Hiçbir bakım sayfası bulunamadı');
      return createResponse(true, "Henüz veri yok", {
        stats: { total: 0, monthly: 0, faults: 0, technicians: 0 },
        chartData: { 
          labels: ['Oca.2026', 'Şub.2026', 'Mar.2026', 'Nis.2026', 'May.2026', 'Haz.2026'], 
          periodic: [0, 0, 0, 0, 0, 0],
          normal: [0, 0, 0, 0, 0, 0],
          fault: [0, 0, 0, 0, 0, 0]
        }
      });
    }
    
    // İstatistikler sayfasından verileri oku
    const statsSheet = ss.getSheetByName(SHEET_NAMES.STATISTICS);
    
    let totalMaintenance = 0;
    let monthlyCount = 0;
    let faultCount = 0;
    const technicians = new Set();
    
    if (statsSheet) {
      Logger.log('📊 İstatistikler sayfası bulundu, veriler okunuyor...');
      const lastRow = statsSheet.getLastRow();
      
      if (lastRow > 1) {
        const statsData = statsSheet.getRange(2, 1, lastRow - 1, 8).getValues();
        
        // Toplam bakım - son satırdaki toplam değeri al
        if (statsData.length > 0) {
          const lastRowData = statsData[statsData.length - 1];
          totalMaintenance = lastRowData[1] || 0; // Toplam sütunu
          faultCount = lastRowData[4] || 0;      // Arıza sütunu
          
          Logger.log('📊 İstatistikler sayfasından okunan veriler:');
          Logger.log('  - Toplam Bakım: ' + totalMaintenance);
          Logger.log('  - Arıza: ' + faultCount);
        }
        
        // Bu ayki bakımları bul - güncel ayın verisi
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const currentMonthStr = (currentMonth + 1).toString().padStart(2, '0') + '.' + currentYear;
        
        Logger.log('📊 Aranan ay: ' + currentMonthStr);
        Logger.log('📊 Stats data length: ' + statsData.length);
        
        for (let i = 0; i < statsData.length; i++) {
          const row = statsData[i];
          const rowDate = row[0];
          const rowValue = row[1] || 0;
          
          Logger.log(`📊 Satır ${i+2}: "${rowDate}" -> Toplam: ${rowValue}`);
          
          // Eğer rowDate bir Date objesi ise, ay ve yılı karşılaştır
          if (rowDate && typeof rowDate === 'object' && rowDate.getMonth) {
            const rowMonth = (rowDate.getMonth() + 1).toString().padStart(2, '0');
            const rowYear = rowDate.getFullYear().toString();
            const rowMonthStr = rowMonth + '.' + rowYear;
            
            Logger.log(`📊 Date karşılaştırma: "${rowMonthStr}" === "${currentMonthStr}"?`);
            
            if (rowMonthStr === currentMonthStr) {
              monthlyCount = row[1] || 0; // Bu ayın toplamı
              Logger.log('✅ Bu ayki bakımlar bulundu (Date): ' + monthlyCount);
              break;
            }
          }
          // Eğer string ise eski yöntemle karşılaştır
          else if (row[0] && row[0].toString().includes(currentMonthStr)) {
            monthlyCount = row[1] || 0; // Bu ayın toplamı
            Logger.log('✅ Bu ayki bakımlar bulundu (String): ' + monthlyCount);
            break;
          }
        }
        
        Logger.log('📊 Sonuç - Bu ayki bakımlar: ' + monthlyCount);
      }
    } else {
      Logger.log('⚠️ İstatistikler sayfası bulunamadı, manuel sayım yapılıyor...');
      
      // İstatistikler sayfası yoksa eski yöntemle say
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      // Yardımcı fonksiyon: Sayfadaki kayıtları say
      function countRecords(sheet, typeFilter) {
        if (!sheet) return;
        
        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return;
        
        const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          
          // Tarih kontrolü
          if (row[1] && row[1] !== "") {
            try {
              const recordDate = parseTurkishDate(row[1]);
              if (recordDate && !isNaN(recordDate.getTime())) {
                totalMaintenance++;
                
                // Bu ayki bakımlar
                if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
                  monthlyCount++;
                }
              }
            } catch (e) {
              Logger.log('❌ Tarih hatası: ' + row[1]);
            }
          }
          
          // Arıza sayısı
          if (typeFilter === 'fault' && row[5]) {
            faultCount++;
          }
          
          // Teknisyen ekle
          if (row[5]) {
            technicians.add(row[5]);
          }
        }
      }
      
      // Tüm sayfalardan kayıtları say
      countRecords(periodicSheet, 'periodic');
      countRecords(normalSheet, 'normal');
      countRecords(faultSheet, 'fault');
    }
    
    Logger.log('📊 Son İstatistikler: Toplam=' + totalMaintenance + ', Aylık=' + monthlyCount + ', Arıza=' + faultCount + ', Teknisyen=' + technicians.size);
    
    const stats = {
      total: totalMaintenance,
      monthly: monthlyCount,
      faults: faultCount,
      technicians: technicians.size
    };
    
    // Grafik verisi - İstatistikler sayfasından oku
    let period = 6;
    if (params && params.period) {
      period = parseInt(params.period);
    }
    
    const chartData = generateChartDataFromStatisticsSheet(statsSheet, period);
    
    return createResponse(true, "İstatistikler alındı", {
      stats: stats,
      chartData: chartData
    });
    
  } catch (error) {
    Logger.log('❌ getMaintenanceStats hatası: ' + error.toString());
    return createResponse(true, "Henüz veri yok", {
      stats: { total: 0, monthly: 0, faults: 0, technicians: 0 },
      chartData: { 
        labels: ['Oca.2026', 'Şub.2026', 'Mar.2026', 'Nis.2026', 'May.2026', 'Haz.2026'], 
        periodic: [0, 0, 0, 0, 0, 0],
        normal: [0, 0, 0, 0, 0, 0],
        fault: [0, 0, 0, 0, 0, 0]
      }
    });
  }
}

// Grafik verisi oluştur - İstatistikler sayfasından oku
function generateChartDataFromStatisticsSheet(statsSheet, period = 6) {
  Logger.log('📊 generateChartDataFromStatisticsSheet başlatıldı - Periyot: ' + period);
  
  const labels = [];
  const periodicData = [];
  const normalData = [];
  const faultData = [];
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  
  if (!statsSheet) {
    Logger.log('⚠️ İstatistikler sayfası yok, boş grafik verisi dönülüyor');
    return {
      labels: labels,
      periodic: periodicData,
      normal: normalData,
      fault: faultData
    };
  }
  
  // İstatistikler sayfasından verileri oku
  const lastRow = statsSheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('⚠️ İstatistikler sayfasında veri yok');
    return {
      labels: labels,
      periodic: periodicData,
      normal: normalData,
      fault: faultData
    };
  }
  
  const statsData = statsSheet.getRange(2, 1, lastRow - 1, 8).getValues();
  Logger.log('📊 İstatistikler sayfasından ' + statsData.length + ' satır okundu');
  
  // Tüm satırları logla
  for (let k = 0; k < statsData.length; k++) {
    const row = statsData[k];
    Logger.log('📊 Satır ' + (k+2) + ': "' + (row[0] || 'NULL') + '" -> Periyodik=' + (row[2] || 0) + ', Normal=' + (row[3] || 0) + ', Arıza=' + (row[4] || 0));
  }
  
  // Belirtilen periyot kadar ayın verisini al
  for (let i = period - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStr = months[date.getMonth()];
    const yearStr = date.getFullYear().toString();
    
    // Türkçe format: "Oca.2026"
    labels.push(monthStr + '.' + yearStr);
    
    // İstatistikler sayfasından bu ayın verisini bul
    const currentMonthStr = (date.getMonth() + 1).toString().padStart(2, '0') + '.' + date.getFullYear();
    let periodicCount = 0;
    let normalCount = 0;
    let faultCount = 0;
    
    Logger.log('📊 Aranan ay: ' + currentMonthStr);
    
    for (let j = 0; j < statsData.length; j++) {
      const row = statsData[j];
      const rowDate = row[0];
      
      Logger.log('📊 Karşılaştırma: "' + rowDate + '" === "' + currentMonthStr + '"?');
      
      // Eğer rowDate bir Date objesi ise, ay ve yılı karşılaştır
      if (rowDate && typeof rowDate === 'object' && rowDate.getMonth) {
        const rowMonth = (rowDate.getMonth() + 1).toString().padStart(2, '0');
        const rowYear = rowDate.getFullYear().toString();
        const rowMonthStr = rowMonth + '.' + rowYear;
        
        Logger.log('📊 Date karşılaştırma: "' + rowMonthStr + '" === "' + currentMonthStr + '"?');
        
        if (rowMonthStr === currentMonthStr) {
          periodicCount = row[2] || 0; // Periyodik sütunu
          normalCount = row[3] || 0;   // Normal sütunu
          faultCount = row[4] || 0;    // Arıza sütunu
          Logger.log('✅ ' + currentMonthStr + ' için veriler bulundu: Periyodik=' + periodicCount + ', Normal=' + normalCount + ', Arıza=' + faultCount);
          break;
        }
      }
      // Eğer string ise eski yöntemle karşılaştır
      else if (rowDate && (rowDate.toString() === currentMonthStr || rowDate.toString().includes(currentMonthStr))) {
        periodicCount = row[2] || 0; // Periyodik sütunu
        normalCount = row[3] || 0;   // Normal sütunu
        faultCount = row[4] || 0;    // Arıza sütunu
        Logger.log('✅ ' + currentMonthStr + ' için veriler bulundu (string): Periyodik=' + periodicCount + ', Normal=' + normalCount + ', Arıza=' + faultCount);
        break;
      }
    }
    
    Logger.log('📊 ' + currentMonthStr + ' sonuç: Periyodik=' + periodicCount + ', Normal=' + normalCount + ', Arıza=' + faultCount);
    
    // Verileri ekle
    periodicData.push(periodicCount);
    normalData.push(normalCount);
    faultData.push(faultCount);
  }
  
  Logger.log('📊 Grafik verisi İstatistikler sayfasından oluşturuldu');
  Logger.log('📈 Periyodik: ' + periodicData.join(','));
  Logger.log('📈 Normal: ' + normalData.join(','));
  Logger.log('📈 Arıza: ' + faultData.join(','));
  
  return {
    labels: labels,
    periodic: periodicData,
    normal: normalData,
    fault: faultData
  };
}

// Rapor al - Ayrı sayfalardan oku
function getMaintenanceReport(ss, params) {
  try {
    // Ayrı bakım sayfalarını al
    const periodicSheet = ss.getSheetByName(SHEET_NAMES.PERIODIC_MAINTENANCE);
    const normalSheet = ss.getSheetByName(SHEET_NAMES.NORMAL_MAINTENANCE);
    const faultSheet = ss.getSheetByName(SHEET_NAMES.FAULT_MAINTENANCE);
    
    // Filtreleme parametreleri
    let motor = (Array.isArray(params.motor) ? params.motor[0] : params.motor) || '';
    let type = (Array.isArray(params.type) ? params.type[0] : params.type) || '';
    const range = parseInt(Array.isArray(params.range) ? params.range[0] : params.range) || 30;
    
    // Tür filtresi mapping
    const typeMapping = {
      'periodic': 'Periyodik',
      'normal': 'Normal',
      'fault': 'Arıza'
    };
    
    if (type && typeMapping[type.toLowerCase()]) {
      type = typeMapping[type.toLowerCase()];
    }
    
    Logger.log('Rapor filtresi - Motor: ' + motor + ', Tip: ' + type + ', Aralık: ' + range);
    
    // Tarih aralığı
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - range);
    
    const records = [];
    let summary = { total: 0, periodic: 0, normal: 0, fault: 0 };
    
    // Yardımcı fonksiyon: Sayfadan kayıtları oku
    function readRecords(sheet, typeLabel) {
      if (!sheet) return;
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;
      
      // Son kayıttan başlayarak geriye doğru oku
      for (let i = lastRow; i >= 2; i--) {
        const row = sheet.getRange(i, 1, 1, 12).getValues()[0];
        
        if (!row[1]) continue; // Tarih yoksa atla
        
        try {
          const recordDate = parseTurkishDate(row[1]);
          
          // Tarih aralığı kontrolü
          if (recordDate && recordDate >= startDate && recordDate <= endDate) {
            // Motor filtresi
            if (motor && row[2] && !String(row[2]).toLowerCase().includes(motor.toLowerCase())) {
              continue;
            }
            
            // Tür filtresi
            if (type && !typeLabel.toLowerCase().includes(type.toLowerCase())) {
              continue;
            }
            
            // Özeti güncelle
            summary.total++;
            if (typeLabel === 'Periyodik') summary.periodic++;
            else if (typeLabel === 'Normal') summary.normal++;
            else if (typeLabel === 'Arıza') summary.fault++;
            
            // Kayıt ekle
            records.push({
              date: row[1],
              motor: row[2],
              type: typeLabel,
              technician: row[5],
              operation: row[4] || row[7]
            });
          }
        } catch (e) {
          Logger.log('Tarih hatası: ' + row[1]);
        }
      }
    }
    
    // Tüm sayfalardan kayıtları oku
    readRecords(periodicSheet, 'Periyodik');
    readRecords(normalSheet, 'Normal');
    readRecords(faultSheet, 'Arıza');
    
    return createResponse(true, "Rapor oluşturuldu", {
      summary: summary,
      records: records.reverse() // Tarih sırasına göre
    });
    
  } catch (error) {
    throw new Error('Rapor alınamadı: ' + error.toString());
  }
}

// Aktif kayıtları getir - Ayrı sayfalardan oku
function getActiveRecords(ss, params) {
  try {
    // Ayrı bakım sayfalarını al
    const periodicSheet = ss.getSheetByName(SHEET_NAMES.PERIODIC_MAINTENANCE);
    const normalSheet = ss.getSheetByName(SHEET_NAMES.NORMAL_MAINTENANCE);
    const faultSheet = ss.getSheetByName(SHEET_NAMES.FAULT_MAINTENANCE);
    
    // Filtreleme parametreleri
    const motor = (Array.isArray(params.motor) ? params.motor[0] : params.motor) || '';
    const type = (Array.isArray(params.type) ? params.type[0] : params.type) || '';
    
    Logger.log('Aktif kayıtlar filtresi - Motor: ' + motor + ', Tip: ' + type);
    
    const records = [];
    
    // Yardımcı fonksiyon: Sayfadan aktif kayıtları oku
    function readActiveRecords(sheet, typeLabel) {
      if (!sheet) return;
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;
      
      const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const recordStatus = row[9]; // Durum sütunu (10. sütun, index 9)
        
        // Sadece Aktif kayıtları göster
        if (recordStatus !== 'Aktif') continue;
        
        const recordMotor = row[2]; // Motor (3. sütun, index 2)
        
        // Motor filtresi
        if (motor && recordMotor !== motor) continue;
        
        // Tür filtresi (sayfa türüne göre)
        if (type && !typeLabel.toLowerCase().includes(type.toLowerCase())) continue;
        
        records.push({
          recordNo: row[0],
          date: row[1],
          motor: recordMotor,
          type: typeLabel,
          subtype: row[4],
          technician: row[5],
          company: row[6],
          notes: row[7],
          files: row[8],
          status: recordStatus,
          timestamp: row[10]
        });
      }
    }
    
    // Tüm sayfalardan aktif kayıtları oku
    readActiveRecords(periodicSheet, 'Periyodik');
    readActiveRecords(normalSheet, 'Normal');
    readActiveRecords(faultSheet, 'Arıza');
    
    Logger.log('Bulunan aktif kayıt sayısı: ' + records.length);
    
    return createResponse(true, 'Aktif kayıtlar getirildi', { records: records });
    
  } catch (error) {
    Logger.log('Aktif kayıtlar getirilirken hata: ' + error.toString());
    return createResponse(false, 'Kayıtlar getirilemedi: ' + error.toString());
  }
}

// Kayıt kapat - Kayıt prefixine göre doğru sayfayı bul
function closeRecord(ss, params) {
  try {
    const recordNo = (Array.isArray(params.recordNo) ? params.recordNo[0] : params.recordNo) || '';
    
    if (!recordNo) {
      return createResponse(false, 'Kayıt numarası belirtilmedi');
    }
    
    Logger.log('Kayıt kapatılıyor: ' + recordNo);
    
    // Kayıt prefixine göre doğru sayfayı belirle
    let targetSheet;
    if (recordNo.startsWith('PB-')) {
      targetSheet = ss.getSheetByName(SHEET_NAMES.PERIODIC_MAINTENANCE);
    } else if (recordNo.startsWith('NB-')) {
      targetSheet = ss.getSheetByName(SHEET_NAMES.NORMAL_MAINTENANCE);
    } else if (recordNo.startsWith('AB-')) {
      targetSheet = ss.getSheetByName(SHEET_NAMES.FAULT_MAINTENANCE);
    } else {
      // Eski BK- formatı veya bilinmeyen prefix - tüm sayfalarda ara
      targetSheet = ss.getSheetByName(SHEET_NAMES.PERIODIC_MAINTENANCE);
    }
    
    if (!targetSheet) {
      return createResponse(false, 'Bakım sayfası bulunamadı');
    }
    
    let foundRow = -1;
    let sheetName = '';
    
    // Önce belirlenen sayfada ara
    const lastRow = targetSheet.getLastRow();
    if (lastRow > 1) {
      const data = targetSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === recordNo) {
          foundRow = i + 2;
          sheetName = targetSheet.getName();
          break;
        }
      }
    }
    
    // Bulunamazsa diğer sayfalarda da ara
    if (foundRow === -1) {
      const sheets = [
        ss.getSheetByName(SHEET_NAMES.PERIODIC_MAINTENANCE),
        ss.getSheetByName(SHEET_NAMES.NORMAL_MAINTENANCE),
        ss.getSheetByName(SHEET_NAMES.FAULT_MAINTENANCE)
      ];
      
      for (const sheet of sheets) {
        if (!sheet || sheet.getName() === targetSheet.getName()) continue;
        
        const lr = sheet.getLastRow();
        if (lr <= 1) continue;
        
        const data = sheet.getRange(2, 1, lr - 1, 1).getValues();
        for (let i = 0; i < data.length; i++) {
          if (data[i][0] === recordNo) {
            foundRow = i + 2;
            sheetName = sheet.getName();
            targetSheet = sheet;
            break;
          }
        }
        if (foundRow !== -1) break;
      }
    }
    
    if (foundRow === -1) {
      return createResponse(false, 'Kayıt bulunamadı: ' + recordNo);
    }
    
    // Durum sütununu güncelle (10. sütun, index 9)
    targetSheet.getRange(foundRow, 10).setValue('Pasif');
    targetSheet.getRange(foundRow, 11).setValue(new Date().toLocaleString('tr-TR'));
    
    Logger.log('Kayıt kapatıldı: ' + recordNo + ' (Sayfa: ' + sheetName + ', Satır: ' + foundRow + ')');
    
    return createResponse(true, 'Kayıt başarıyla kapatıldı', { 
      recordNo: recordNo,
      closedAt: new Date().toLocaleString('tr-TR')
    });
    
  } catch (error) {
    Logger.log('Kayıt kapatılırken hata: ' + error.toString());
    return createResponse(false, 'Kayıt kapatılamadı: ' + error.toString());
  }
}

function getMotorHoursV2(ss) {
  try {
    const sheet = ss.getSheetByName(SHEET_NAMES.MOTOR_HOURS);
    if (!sheet) {
      return createResponse(false, 'Motor Saatleri sayfasi bulunamadi');
    }

    const data = sheet.getRange(2, 1, 3, 10).getValues();
    const motors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const motorName = row[0];
      const energyHours = getLatestEnergyMotorHours(ss, motorName);
      const currentHours = energyHours > 0 ? energyHours : parseBakimNumber(row[1]);

      const lastOilSample = parseBakimNumber(row[2]);
      const nextOilSample = parseBakimNumber(row[4]) || (lastOilSample + OIL_SAMPLE_INTERVAL_HOURS);
      const oilElapsedHours = Math.max(0, currentHours - lastOilSample);
      const remainingOilHours = Math.max(0, OIL_SAMPLE_INTERVAL_HOURS - oilElapsedHours);
      const needsOilSample = oilElapsedHours >= OIL_SAMPLE_INTERVAL_HOURS;
      const warnsOilSample = oilElapsedHours >= OIL_SAMPLE_WARNING_HOURS && !needsOilSample;

      const lastAlternatorGrease = parseBakimNumber(row[6]);
      const nextAlternatorGrease = parseBakimNumber(row[8]) || (lastAlternatorGrease + ALTERNATOR_GREASE_INTERVAL_HOURS);
      const alternatorElapsedHours = Math.max(0, currentHours - lastAlternatorGrease);
      const remainingAltHours = Math.max(0, ALTERNATOR_GREASE_INTERVAL_HOURS - alternatorElapsedHours);
      const needsAlternatorGrease = alternatorElapsedHours >= ALTERNATOR_GREASE_INTERVAL_HOURS;
      const warnsAlternatorGrease = alternatorElapsedHours >= ALTERNATOR_GREASE_WARNING_HOURS && !needsAlternatorGrease;

      motors.push({
        motor: motorName,
        currentHours: currentHours,
        currentHoursSource: energyHours > 0 ? 'Enerji' : 'Motor Saatleri',
        lastOilSampleHours: lastOilSample,
        lastOilSampleDate: row[3],
        nextOilSampleHours: nextOilSample,
        oilElapsedHours: oilElapsedHours,
        remainingOilHours: remainingOilHours,
        needsOilSample: needsOilSample,
        warnsOilSample: warnsOilSample,
        notes: row[5],
        lastAlternatorGreaseHours: lastAlternatorGrease,
        lastAlternatorGreaseDate: row[7],
        nextAlternatorGreaseHours: nextAlternatorGrease,
        alternatorElapsedHours: alternatorElapsedHours,
        remainingAltHours: remainingAltHours,
        needsAlternatorGrease: needsAlternatorGrease,
        warnsAlternatorGrease: warnsAlternatorGrease,
        alternatorNotes: row[9]
      });
    }

    return createResponse(true, 'Motor saatleri getirildi', { motors: motors });
  } catch (error) {
    Logger.log('Motor saatleri getirilirken hata: ' + error.toString());
    return createResponse(false, 'Motor saatleri getirilemedi: ' + error.toString());
  }
}

function getLatestEnergyMotorHours(ss, motor) {
  const localHours = getLatestEnergyMotorHoursFromSheets(ss, motor);
  if (localHours > 0) return localHours;
  return getLatestEnergyMotorHoursFromApi(motor);
}

function getLatestEnergyMotorHoursFromSheets(ss, motor) {
  const sheetNames = [
    'Enerji GM-' + motor,
    'Enerji ' + motor,
    'Enerji ' + String(motor || '').replace('-', ' ')
  ];

  for (let i = 0; i < sheetNames.length; i++) {
    const sheet = ss.getSheetByName(sheetNames[i]);
    if (!sheet || sheet.getLastRow() < 2) continue;

    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
      const hours = parseBakimNumber(rows[rowIndex][13]);
      if (hours > 0) return hours;
    }
  }

  return 0;
}

function getLatestEnergyMotorHoursFromApi(motor) {
  try {
    const response = UrlFetchApp.fetch(KOJEN_ENERJI_API_URL + '?action=getLastRecords&count=120', {
      method: 'get',
      muteHttpExceptions: true
    });

    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return 0;

    const payload = JSON.parse(response.getContentText());
    if (!payload.success || !payload.data) return 0;

    for (let i = 0; i < payload.data.length; i++) {
      const record = payload.data[i];
      if (String(record.motor || '').trim() === String(motor || '').trim()) {
        return parseBakimNumber(record.calismaSaati);
      }
    }
  } catch (error) {
    Logger.log('Enerji motor saati alinamadi: ' + error.toString());
  }

  return 0;
}

function parseBakimNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  let normalized = String(value).trim();
  if (normalized.indexOf(',') !== -1) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

// Motor saatlerini getir
function getMotorHours(ss) {
  try {
    const sheet = ss.getSheetByName(SHEET_NAMES.MOTOR_HOURS);
    if (!sheet) {
      return createResponse(false, 'Motor Saatleri sayfası bulunamadı');
    }
    
    const data = sheet.getRange(2, 1, 3, 10).getValues();
    const motors = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const currentHours = parseInt(row[1]) || 0;
      
      // Yağ numune hesaplamaları
      const lastOilSample = parseInt(row[2]) || 0;
      const nextOilSample = parseInt(row[5]) || 500;
      const remainingOilHours = nextOilSample - (currentHours - lastOilSample);
      const needsOilSample = remainingOilHours <= 50; // 50 saat kala uyarı
      
      // Alternatör gresleme hesaplamaları
      const lastAlternatorGrease = parseInt(row[6]) || 0;
      const nextAlternatorGrease = parseInt(row[8]) || 1000;
      const remainingAltHours = nextAlternatorGrease - (currentHours - lastAlternatorGrease);
      const needsAlternatorGrease = remainingAltHours <= 100; // 100 saat kala uyarı
      
      motors.push({
        motor: row[0],
        currentHours: currentHours,
        // Yağ numune
        lastOilSampleHours: lastOilSample,
        lastOilSampleDate: row[3],
        nextOilSampleHours: nextOilSample,
        remainingOilHours: remainingOilHours,
        needsOilSample: needsOilSample,
        notes: row[5],
        // Alternatör gresleme
        lastAlternatorGreaseHours: lastAlternatorGrease,
        lastAlternatorGreaseDate: row[7],
        nextAlternatorGreaseHours: nextAlternatorGrease,
        remainingAltHours: remainingAltHours,
        needsAlternatorGrease: needsAlternatorGrease,
        alternatorNotes: row[9]
      });
    }
    
    return createResponse(true, 'Motor saatleri getirildi', { motors: motors });
    
  } catch (error) {
    Logger.log('Motor saatleri getirilirken hata: ' + error.toString());
    return createResponse(false, 'Motor saatleri getirilemedi: ' + error.toString());
  }
}

// Motor saatlerini güncelle
function updateMotorHours(ss, params) {
  try {
    const motor = (Array.isArray(params.motor) ? params.motor[0] : params.motor) || '';
    const hours = parseInt(Array.isArray(params.hours) ? params.hours[0] : params.hours) || 0;
    
    if (!motor || hours < 0) {
      return createResponse(false, 'Geçersiz motor veya saat değeri');
    }
    
    const sheet = ss.getSheetByName(SHEET_NAMES.MOTOR_HOURS);
    if (!sheet) {
      return createResponse(false, 'Motor Saatleri sayfası bulunamadı');
    }
    
    // Motor satırını bul
    const data = sheet.getRange(2, 1, 3, 1).getValues();
    let foundRow = -1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === motor) {
        foundRow = i + 2;
        break;
      }
    }
    
    if (foundRow === -1) {
      return createResponse(false, 'Motor bulunamadı: ' + motor);
    }
    
    // Çalışma saatini güncelle
    sheet.getRange(foundRow, 2).setValue(hours);
    
    Logger.log('Motor saati güncellendi: ' + motor + ' = ' + hours + ' saat');
    
    return createResponse(true, 'Motor saati güncellendi', { 
      motor: motor,
      hours: hours
    });
    
  } catch (error) {
    Logger.log('Motor saati güncellenirken hata: ' + error.toString());
    return createResponse(false, 'Motor saati güncellenemedi: ' + error.toString());
  }
}

// Yağ numune alma kaydı
function updateOilSample(ss, params) {
  try {
    const motor = (Array.isArray(params.motor) ? params.motor[0] : params.motor) || '';
    const currentHours = parseInt(Array.isArray(params.currentHours) ? params.currentHours[0] : params.currentHours) || 0;
    
    if (!motor) {
      return createResponse(false, 'Motor belirtilmedi');
    }
    
    const sheet = ss.getSheetByName(SHEET_NAMES.MOTOR_HOURS);
    if (!sheet) {
      return createResponse(false, 'Motor Saatleri sayfası bulunamadı');
    }
    
    // Motor satırını bul
    const data = sheet.getRange(2, 1, 3, 1).getValues();
    let foundRow = -1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === motor) {
        foundRow = i + 2;
        break;
      }
    }
    
    if (foundRow === -1) {
      return createResponse(false, 'Motor bulunamadı: ' + motor);
    }
    
    const today = new Date().toLocaleDateString('tr-TR');
    const nextSample = currentHours + 500; // Bir sonraki yağ numune +500 saat
    
    // Yağ numune bilgilerini güncelle
    sheet.getRange(foundRow, 2).setValue(currentHours); // Mevcut saat
    sheet.getRange(foundRow, 3).setValue(currentHours); // Son yağ numune saati
    sheet.getRange(foundRow, 4).setValue(today); // Son yağ numune tarihi
    sheet.getRange(foundRow, 5).setValue(nextSample); // Bir sonraki yağ numune
    
    Logger.log('Yağ numune kaydı güncellendi: ' + motor + ' - ' + currentHours + ' saat');
    
    return createResponse(true, 'Yağ numune kaydı güncellendi', { 
      motor: motor,
      currentHours: currentHours,
      nextOilSample: nextSample,
      date: today
    });
    
  } catch (error) {
    Logger.log('Yağ numune kaydı güncellenirken hata: ' + error.toString());
    return createResponse(false, 'Yağ numune kaydı güncellenemedi: ' + error.toString());
  }
}

// Alternatör gresleme kaydı
function updateAlternatorGrease(ss, params) {
  try {
    const motor = (Array.isArray(params.motor) ? params.motor[0] : params.motor) || '';
    const currentHours = parseInt(Array.isArray(params.currentHours) ? params.currentHours[0] : params.currentHours) || 0;
    
    if (!motor) {
      return createResponse(false, 'Motor belirtilmedi');
    }
    
    const sheet = ss.getSheetByName(SHEET_NAMES.MOTOR_HOURS);
    if (!sheet) {
      return createResponse(false, 'Motor Saatleri sayfası bulunamadı');
    }
    
    // Motor satırını bul
    const data = sheet.getRange(2, 1, 3, 1).getValues();
    let foundRow = -1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === motor) {
        foundRow = i + 2;
        break;
      }
    }
    
    if (foundRow === -1) {
      return createResponse(false, 'Motor bulunamadı: ' + motor);
    }
    
    const today = new Date().toLocaleDateString('tr-TR');
    const nextGrease = currentHours + 1000; // Bir sonraki alternatör gresleme +1000 saat
    
    // Alternatör gresleme bilgilerini güncelle (sütun 7, 8, 9)
    sheet.getRange(foundRow, 7).setValue(currentHours); // Son alternatör gresleme saati
    sheet.getRange(foundRow, 8).setValue(today); // Son alternatör gresleme tarihi
    sheet.getRange(foundRow, 9).setValue(nextGrease); // Bir sonraki alternatör gresleme
    
    Logger.log('Alternatör gresleme kaydı güncellendi: ' + motor + ' - ' + currentHours + ' saat');
    
    return createResponse(true, 'Alternatör gresleme kaydı güncellendi', { 
      motor: motor,
      currentHours: currentHours,
      nextAlternatorGrease: nextGrease,
      date: today
    });
    
  } catch (error) {
    Logger.log('Alternatör gresleme kaydı güncellenirken hata: ' + error.toString());
    return createResponse(false, 'Alternatör gresleme kaydı güncellenemedi: ' + error.toString());
  }
}

// Sistemi başlat
function initializeSystem(ss) {
  try {
    // Eğer ss parametresi yoksa, spreadsheet'i al
    if (!ss) {
      Logger.log('initializeSystem: ss parametresi yok, getOrCreateSpreadsheet() çağrılıyor...');
      ss = getOrCreateSpreadsheet();
    }
    
    createSheets(ss);
    
    const spreadsheetId = ss.getId();
    const spreadsheetUrl = ss.getUrl();
    
    return createResponse(true, "Sistem başarıyla başlatıldı", {
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheetUrl,
      message: "Google Sheets başarıyla oluşturuldu ve hazırlandı."
    });
    
  } catch (error) {
    throw new Error('Sistem başlatılamadı: ' + error.toString());
  }
}

// Bağlantı testi
function testConnection(ss) {
  try {
    if (!ss) {
      // Eğer ss gönderilmemişse, spreadsheet'i al
      ss = getOrCreateSpreadsheet();
    }
    
    const spreadsheetId = ss.getId();
    const spreadsheetUrl = ss.getUrl();
    const sheetNames = [];
    
    // Tüm sayfaları kontrol et
    const sheets = ss.getSheets();
    sheets.forEach(sheet => {
      sheetNames.push(sheet.getName());
    });
    
    return createResponse(true, "Bağlantı başarılı", {
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheetUrl,
      sheetNames: sheetNames,
      totalSheets: sheets.length,
      timestamp: new Date().toLocaleDateString('tr-TR')
    });
    
  } catch (error) {
    throw new Error('Bağlantı testi başarısız: ' + error.toString());
  }
}

// Yanıt oluştur
function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toLocaleDateString('tr-TR')
  };
  
  if (data) {
    // Veriyi direkt response objesine spread et (data.data içine değil)
    Object.assign(response, data);
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Test fonksiyonları
function testSystem() {
  try {
    Logger.log('=== SİSTEM TEST BAŞLATILIYOR ===');
    
    const ss = getOrCreateSpreadsheet();
    Logger.log('Spreadsheet ID: ' + ss.getId());
    Logger.log('URL: ' + ss.getUrl());
    
    // Sayfaları kontrol et
    const sheets = ss.getSheets();
    Logger.log('Toplam sayfa sayısı: ' + sheets.length);
    
    sheets.forEach(sheet => {
      Logger.log('Sayfa: ' + sheet.getName() + ' (Son satır: ' + sheet.getLastRow() + ')');
    });
    
    // Test kaydı ekle
    Logger.log('Test kaydı ekleniyor...');
    const testParams = {
      action: 'save',
      date: new Date().toLocaleDateString('tr-TR'),
      time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
      motor: 'GM-1',
      type: 'Periyodik',
      subtype: '2000 Saat',
      technician: 'Test Teknisyen',
      company: 'İç Destek',
      notes: 'Test kaydı'
    };
    
    const result = saveMaintenanceRecord(ss, testParams);
    Logger.log('Test sonucu: ' + result.getContent());
    
    // Bağlantı testi
    Logger.log('Bağlantı testi yapılıyor...');
    const testResult = testConnection(ss);
    Logger.log('Bağlantı testi: ' + testResult.getContent());
    
    Logger.log('=== SİSTEM TEST BAŞARILI ===');
    
  } catch (error) {
    Logger.log('Test hatası: ' + error.toString());
    Logger.log('Hata detayı: ' + error.stack);
  }
}

// Manuel kurulum fonksiyonu
function manualSetup() {
  const ss = getOrCreateSpreadsheet();
  const result = initializeSystem(ss);
  
  Logger.log('=== BAKIM TAKİP SİSTEMİ KURULUMU ===');
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('Sonuç: ' + result.getContent());
  
  return ss.getId();
}

// Drive folder test fonksiyonu
function testDriveFolders() {
  try {
    Logger.log('=== DRIVE FOLDER TEST ===');
    
    Object.keys(DRIVE_FOLDERS).forEach(key => {
      const folderId = DRIVE_FOLDERS[key];
      const folder = DriveApp.getFolderById(folderId);
      Logger.log(`${key}: ${folder.getName()} (${folderId})`);
    });
    
    Logger.log('Tüm Drive folder\'ları başarıyla ulaşıldı');
    
  } catch (error) {
    Logger.log('Drive folder hatası: ' + error.toString());
  }
}

// Basit kayıt test fonksiyonu
function testSimpleSave() {
  try {
    Logger.log('=== BASİT KAYIT TESTİ ===');
    
    const ss = getOrCreateSpreadsheet();
    Logger.log('Spreadsheet: ' + ss.getUrl());
    
    const testParams = {
      action: 'save',
      date: '06.04.2026',
      time: '13:43',
      motor: 'GM-1',
      type: 'Periyodik',
      subtype: '2000 Saat',
      technician: 'ibrahim-ogun',
      company: 'internal',
      notes: 'Test kaydı',
      status: 'Aktif',
      files: '[]'
    };
    
    Logger.log('Test params: ' + JSON.stringify(testParams));
    
    const result = saveMaintenanceRecord(ss, testParams);
    Logger.log('Test sonucu: ' + result.getContent());
    
    Logger.log('=== BASİT KAYIT TESTİ BAŞARILI ===');
    
  } catch (error) {
    Logger.log('Basit kayıt test hatası: ' + error.toString());
    Logger.log('Hata detayı: ' + error.stack);
  }
}
