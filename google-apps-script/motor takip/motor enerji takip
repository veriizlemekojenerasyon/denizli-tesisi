/**
 * KOJEN ENERJİ VERİLERİ - Google Apps Script Kodu
 * Bu dosya Google Sheets > Extensions > Apps Script'e yapıştırılacak
 * 
 * Kurulum Adımları:
 * 1. Google Sheets'de yeni bir sayfa oluşturun
 * 2. Sheet adını "KojenEnerjiVerileri" yapın
 * 3. İlk satır başlıkları: Tarih | Vardiya | Saat | Motor | L1-L2 AYDEM VOLTAJI | (P) AKTİF GÜÇ | (Q) REAKTİF GÜÇ | Cos φ | ORT.AKIM | ORT.GERİLİM | NÖTR AKIMI (LN) | TAHRİK GERİLİMİ (UE) | TOPLAM AKTİF ENERJİ | ÇALIŞMA SAATİ | KALKIŞ SAYISI | Durum | Kaydeden | Kayıt Tarihi
 * 4. Extensions > Apps Script'e gidin
 * 5. Bu kodu yapıştırın
 * 6. Deploy > New Deployment > Web App seçin
 * 7. Execute as: Me, Who has access: Anyone seçin
 * 8. URL'i kopyalayın ve kojen-enerji-sheets-config.js'e yapıştırın
 */

// CORS ayarları - tüm origin'lere izin ver
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    var action = e.parameter.action;
    var result = {};
    
    switch(action) {
      case 'addRecord':
        result = addRecord(e.parameter);
        break;
      case 'getRecords':
        result = getRecords();
        break;
      case 'getRecordsByDate':
        result = getRecordsByDate(e.parameter.tarih);
        break;
      case 'getRecordsByMotorAndDate':
        result = getRecordsByMotorAndDate(e.parameter.motor, e.parameter.tarih);
        break;
      case 'checkExistingRecord':
        result = checkExistingRecord(e.parameter.motor, e.parameter.tarih, e.parameter.saat);
        break;
      case 'getLastRecords':
        result = getLastRecords(parseInt(e.parameter.count) || 50);
        break;
      default:
        result = { success: false, error: 'Geçersiz işlem' };
    }
    
    lock.releaseLock();
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    lock.releaseLock();
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Sayfa oluşturma veya alma fonksiyonu
function getOrCreateSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('KojenEnerjiVerileri');
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet('KojenEnerjiVerileri');
    
    // Başlık satırını ekle
    var headers = [
      'Tarih', 'Vardiya', 'Saat', 'Motor',
      'L1-L2 AYDEM VOLTAJI', '(P) AKTİF GÜÇ', '(Q) REAKTİF GÜÇ',
      'Cos φ', 'ORT.AKIM', 'ORT.GERİLİM',
      'NÖTR AKIMI (LN)', 'TAHRİK GERİLİMİ (UE)',
      'TOPLAM AKTİF ENERJİ', 'ÇALIŞMA SAATİ', 'KALKIŞ SAYISI',
      'Durum', 'Kaydeden', 'Kayıt Tarihi'
    ];
    sheet.appendRow(headers);
    
    // Başlık formatı
    var headerRange = sheet.getRange(1, 1, 1, 18);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#e74c3c');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    headerRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    
    // Sütun genişliklerini ayarla
    sheet.setColumnWidth(1, 100);  // Tarih
    sheet.setColumnWidth(2, 80);   // Vardiya
    sheet.setColumnWidth(3, 60);   // Saat
    sheet.setColumnWidth(4, 80);   // Motor
    sheet.setColumnWidth(5, 130);  // L1-L2 AYDEM VOLTAJI
    sheet.setColumnWidth(6, 110);  // (P) AKTİF GÜÇ
    sheet.setColumnWidth(7, 110);  // (Q) REAKTİF GÜÇ
    sheet.setColumnWidth(8, 80);   // Cos φ
    sheet.setColumnWidth(9, 90);   // ORT.AKIM
    sheet.setColumnWidth(10, 100); // ORT.GERİLİM
    sheet.setColumnWidth(11, 110); // NÖTR AKIMI
    sheet.setColumnWidth(12, 120); // TAHRİK GERİLİMİ
    sheet.setColumnWidth(13, 130); // TOPLAM AKTİF ENERJİ
    sheet.setColumnWidth(14, 100); // ÇALIŞMA SAATİ
    sheet.setColumnWidth(15, 100); // KALKIŞ SAYISI
    sheet.setColumnWidth(16, 120); // Durum
    sheet.setColumnWidth(17, 100); // Kaydeden
    sheet.setColumnWidth(18, 150); // Kayıt Tarihi
    
    // Sütun formatlarını ayarla
    sheet.getRange(2, 1, 1000, 4).setNumberFormat('@'); // Tarih, Vardiya, Saat, Motor
    sheet.getRange(2, 5, 1000, 11).setNumberFormat('0.00'); // Sayısal değerler
    sheet.getRange(2, 16, 1000, 3).setNumberFormat('@'); // Durum, Kaydeden, Kayıt Tarihi
    
    Logger.log('KojenEnerjiVerileri sayfası otomatik olarak oluşturuldu.');
  }
  
  return sheet;
}

// Yeni kayıt ekle
function addRecord(data) {
  try {
    var sheet = getOrCreateSheet();
    
    // Zorunlu alanları kontrol et
    if (!data.tarih || !data.vardiya || !data.saat || !data.motor) {
      return { success: false, error: 'Tarih, vardiya, saat ve motor zorunludur!' };
    }
    
    // Aynı tarih, saat ve motor için kayıt var mı kontrol et
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var allData = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
      
      // Input tarihini dd.MM.yyyy formatına çevir
      var inputTarih = data.tarih;
      if (inputTarih.includes('-')) {
        var inputParts = inputTarih.split('-');
        inputTarih = inputParts[2] + '.' + inputParts[1] + '.' + inputParts[0];
      }
      
      for (var i = 0; i < allData.length; i++) {
        var row = allData[i];
        var rowTarih = row[0];
        var rowVardiya = row[1];
        var rowSaat = row[2];
        var rowMotor = row[3];
        
        if (rowTarih instanceof Date) {
          rowTarih = Utilities.formatDate(rowTarih, Session.getScriptTimeZone(), 'dd.MM.yyyy');
        }
        
        if (rowTarih === inputTarih && rowSaat === data.saat && rowMotor === data.motor) {
          return { success: false, error: 'Bu tarih, saat ve motor için kayıt zaten var!' };
        }
      }
    }
    
    // Tarih formatını düzelt
    var formattedTarih = data.tarih;
    if (formattedTarih.includes('-')) {
      var tarihParts = formattedTarih.split('-');
      formattedTarih = tarihParts[2] + '.' + tarihParts[1] + '.' + tarihParts[0];
    }
    
    // Kayıt zamanı
    var kayitTarihi = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
    
    // Verileri al (Motor çalışmıyor durumu kontrolü)
    var durum = data.durum || 'NORMAL';
    var kaydeden = data.kaydeden || 'Admin';
    
    // Eğer motor çalışmıyorsa, tüm değerleri 0 olarak kaydet
    var values;
    if (durum === 'MOTOR ÇALIŞMIYOR') {
      values = [
        formattedTarih, data.vardiya, data.saat, data.motor,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        durum, kaydeden, kayitTarihi
      ];
    } else {
      values = [
        formattedTarih,
        data.vardiya,
        data.saat,
        data.motor,
        parseFloat(data.aydemVoltaji) || 0,
        parseFloat(data.aktifGuc) || 0,
        parseFloat(data.reaktifGuc) || 0,
        parseFloat(data.cosPhi) || 0,
        parseFloat(data.ortAkim) || 0,
        parseFloat(data.ortGerilim) || 0,
        parseFloat(data.notrAkim) || 0,
        parseFloat(data.tahrikGerilimi) || 0,
        parseFloat(data.toplamAktifEnerji) || 0,
        parseFloat(data.calismaSaati) || 0,
        parseFloat(data.kalkisSayisi) || 0,
        durum,
        kaydeden,
        kayitTarihi
      ];
    }
    
    // Kayıt ekle
    sheet.appendRow(values);
    
    // Yeni eklenen satırın formatını ayarla
    var newRow = sheet.getLastRow();
    var dataRange = sheet.getRange(newRow, 1, 1, 18);
    dataRange.setHorizontalAlignment('center');
    dataRange.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
    
    // Sayısal sütunları ortala
    sheet.getRange(newRow, 5, 1, 11).setNumberFormat('0.00');
    
    // Motor çalışmıyor durumunda kırmızı arka plan
    if (durum === 'MOTOR ÇALIŞMIYOR') {
      dataRange.setBackground('#ffebee');
      dataRange.setFontColor('#c62828');
    }
    
    return { success: true, message: data.motor + ' motoru için enerji kaydı başarıyla eklendi!' };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Tüm kayıtları getir
function getRecords() {
  try {
    var sheet = getOrCreateSheet();
    
    if (sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }
    
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
    var records = [];
    
    for (var i = data.length - 1; i >= 0; i--) {
      var row = data[i];
      
      records.push({
        tarih: row[0],
        vardiya: row[1],
        saat: row[2],
        motor: row[3],
        aydemVoltaji: row[4],
        aktifGuc: row[5],
        reaktifGuc: row[6],
        cosPhi: row[7],
        ortAkif: row[8],
        ortGerilim: row[9],
        notrAkim: row[10],
        tahrikGerilimi: row[11],
        toplamAktifEnerji: row[12],
        calismaSaati: row[13],
        kalkisSayisi: row[14],
        durum: row[15],
        kaydeden: row[16],
        kayitTarihi: row[17]
      });
    }
    
    return { success: true, data: records };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Tarihe göre kayıtları getir
function getRecordsByDate(tarih) {
  try {
    var allRecords = getRecords();
    if (!allRecords.success) return allRecords;
    
    // Tarih formatını normalize et
    var searchTarih = tarih;
    if (searchTarih.includes('-')) {
      var parts = searchTarih.split('-');
      searchTarih = parts[2] + '.' + parts[1] + '.' + parts[0];
    }
    
    var filtered = allRecords.data.filter(function(record) {
      return record.tarih === searchTarih;
    });
    
    return { success: true, data: filtered };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Motor ve tarihe göre kayıtları getir
function getRecordsByMotorAndDate(motor, tarih) {
  try {
    var allRecords = getRecords();
    if (!allRecords.success) return allRecords;
    
    // Tarih formatını normalize et
    var searchTarih = tarih;
    if (searchTarih.includes('-')) {
      var parts = searchTarih.split('-');
      searchTarih = parts[2] + '.' + parts[1] + '.' + parts[0];
    }
    
    var filtered = allRecords.data.filter(function(record) {
      return record.motor === motor && record.tarih === searchTarih;
    });
    
    return { success: true, data: filtered };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Kayıt var mı kontrol et
function checkExistingRecord(motor, tarih, saat) {
  try {
    var allRecords = getRecords();
    if (!allRecords.success) return allRecords;
    
    // Tarih formatını normalize et
    var searchTarih = tarih;
    if (searchTarih.includes('-')) {
      var parts = searchTarih.split('-');
      searchTarih = parts[2] + '.' + parts[1] + '.' + parts[0];
    }
    
    // Motor ve saat değerlerini trim et ve string olarak kullan
    var searchMotor = String(motor || '').trim();
    var searchSaat = String(saat || '').trim();
    
    var existing = allRecords.data.find(function(record) {
      var recMotor = String(record.motor || '').trim();
      var recTarih = String(record.tarih || '').trim();
      var recSaat = String(record.saat || '').trim();
      
      return recMotor === searchMotor && 
             recTarih === searchTarih && 
             recSaat === searchSaat;
    });
    
    return { 
      success: true, 
      exists: !!existing,
      record: existing || null
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Son N kaydı getir
function getLastRecords(count) {
  try {
    var result = getRecords();
    if (!result.success) return result;
    
    return { 
      success: true, 
      data: result.data.slice(0, count),
      total: result.data.length
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
