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
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action;
  var lock = null;
  try {
    if (isWriteAction(action)) {
      lock = LockService.getScriptLock();
      lock.waitLock(5000);
    }
    
    var result = {};
    
    switch(action) {
      case 'addRecord':
        result = addRecord(params);
        break;
      case 'getRecords':
        result = getRecords();
        break;
      case 'getRecordsByDate':
        result = getRecordsByDate(params.tarih);
        break;
      case 'getRecordsByMotorAndDate':
        result = getRecordsByMotorAndDate(params.motor, params.tarih);
        break;
      case 'checkExistingRecord':
        result = checkExistingRecord(params.motor, params.tarih, params.saat);
        break;
      case 'checkMultipleRecords':
        result = checkMultipleRecords(params.data);
        break;
      case 'addMultipleRecords':
        result = addMultipleRecords(params.data);
        break;
      case 'getLastRecords':
        result = getLastRecords(parseInt(params.count) || 50);
        break;
      case 'getDailyProductionSummary':
        result = getDailyProductionSummary(params.tarih, params.updateSheet === 'true');
        break;
      case 'updateDailyProductionSheet':
        result = updateDailyProductionSheet(params.tarih);
        break;
      case 'sendEmail':
        result = sendEmailAlert(params);
        break;
      case 'checkHourlyMissingRecords':
        result = checkHourlyMissingRecords();
        break;
      case 'installHourlyMissingRecordTrigger':
        result = installHourlyMissingRecordTrigger();
        break;
      case 'getTriggerHealth':
        result = getTriggerHealth();
        break;
      case 'getSystemLogs':
        result = getSystemLogs(parseInt(params.count, 10) || 100);
        break;
      default:
        result = { success: false, error: 'Geçersiz işlem' };
    }
    
    if (lock) lock.releaseLock();
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    if (lock) lock.releaseLock();
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function isWriteAction(action) {
  return ['addRecord', 'addMultipleRecords', 'getDailyProductionSummary', 'updateDailyProductionSheet', 'sendEmail', 'checkHourlyMissingRecords', 'installHourlyMissingRecordTrigger'].indexOf(action) !== -1;
}

function normalizeDateTR(tarih) {
  var value = String(tarih || '').trim();
  if (value.indexOf('-') !== -1) {
    var parts = value.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }
  return value;
}

function normalizeEnerjiDurum(durum) {
  var value = String(durum || 'NORMAL').trim();
  if (!value) return 'NORMAL';

  var upper = value.toUpperCase()
    .replace(/\u00C7/g, 'C')
    .replace(/\u011E/g, 'G')
    .replace(/\u0130/g, 'I')
    .replace(/\u0049\u0307/g, 'I')
    .replace(/\u00D6/g, 'O')
    .replace(/\u015E/g, 'S')
    .replace(/\u00DC/g, 'U');

  if (upper.indexOf('MOTOR') !== -1 && upper.indexOf('NORMAL') === -1) {
    return 'MOTOR ÇALIŞMIYOR';
  }

  return value;
}

function getEnerjiSheetIfExists(motor) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Enerji GM-' + motor);
}

function mapEnerjiRow(row) {
  return {
    tarih: row[0],
    vardiya: row[1],
    saat: row[2],
    motor: row[3],
    aydemVoltaji: row[4],
    aktifGuc: row[5],
    reaktifGuc: row[6],
    cosPhi: row[7],
    ortAkim: row[8],
    ortGerilim: row[9],
    notrAkim: row[10],
    tahrikGerilimi: row[11],
    toplamAktifEnerji: row[12],
    calismaSaati: row[13],
    kalkisSayisi: row[14],
    durum: row[15],
    kaydeden: row[16],
    kayitTarihi: row[17]
  };
}

// 🔥 MOTOR BAZLI SAYFA GETİRME FONKSİYONU
function getOrCreateSheet(motor) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Motor bazlı sayfa adı
  var sheetName = 'Enerji GM-' + motor;
  var sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    
    // Başlık satırını ekle
    var headers = [
      'Tarih', 'Vardiya', 'Saat', 'Motor',
      'L1-L2 AYDEM VOLTAJI', '(P) AKTİF GÜÇ', '(Q) REAKTİF GÜÇ',
      'Cos φ', 'ORT.AKIM', 'ORT.GERİLİM',
      'NÖTR AKIMI (LN)', 'TAHRİK GERİLİMİ (UE)',
      'TOPLAM AKTİF ENERJİ', 'ÇALIŞMA SAATİ', 'KALKIŞ SAYISI',
      'Durum', 'Kaydeden', 'Kayıt Tarihi'
    ];
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]).setFontWeight('bold');
    headerRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    
    console.log('📄 Yeni enerji sayfası oluşturuldu: ' + sheetName);
    
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

// Yeni kayıt ekle (Motor Bazlı)
function addRecord(data) {
  try {
    // Motor bilgisinden sayfa adı belirle
    var motor = data.motor || '1';
    var sheet = getOrCreateSheet(motor);
    
    // Zorunlu alanları kontrol et
    if (!data.tarih || !data.vardiya || !data.saat || !data.motor) {
      return { success: false, error: 'Tarih, vardiya, saat ve motor zorunludur!' };
    }
    
    // Aynı tarih, saat ve motor için kayıt var mı kontrol et
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var allData = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
      var inputTarih = normalizeDateTR(data.tarih);
      var inputSaat = String(data.saat || '').trim();

      for (var i = 0; i < allData.length; i++) {
        var row = allData[i];
        var rowTarih = String(row[0] || '').trim();
        var rowSaat = String(row[2] || '').trim();

        if (rowTarih === inputTarih && rowSaat === inputSaat) {
          return { success: false, error: 'Bu tarih, saat ve motor için kayıt zaten var!' };
        }
      }
    }
    
    // Tarih formatını düzelt ve Sheets formatına çevir
    var formattedTarih = normalizeDateTR(data.tarih);
    
    // dd.MM.yyyy formatını tarih nesnesine çevir
    var tarihObj;
    if (formattedTarih.includes('.')) {
      var tarihParts = formattedTarih.split('.');
      tarihObj = new Date(tarihParts[2], tarihParts[1] - 1, tarihParts[0]);
    } else {
      tarihObj = new Date(formattedTarih);
    }
    
    // Kayıt zamanı
    var kayitTarihi = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
    
    // Verileri al (Motor çalışmıyor durumu kontrolü)
    var durum = normalizeEnerjiDurum(data.durum || 'NORMAL');
    var kaydeden = data.kaydeden || 'Admin';
    
    // Eğer motor çalışmıyorsa, M, N, O sütunları için son değerleri kullan, diğerlerini 0 olarak kaydet
    var values;
    if (durum === 'MOTOR ÇALIŞMIYOR') {
      var zeroValue = parseEnerjiNumber('0.00');
      values = [
        tarihObj, data.vardiya, data.saat, data.motor,
        zeroValue, zeroValue, zeroValue, zeroValue, zeroValue, zeroValue, zeroValue, zeroValue, // Diğer değerler 0.00 (8 tane)
        parseEnerjiNumber(data.toplamAktifEnerji), // M sütunu - son değer
        parseEnerjiNumber(data.calismaSaati),      // N sütunu - son değer
        parseEnerjiNumber(data.kalkisSayisi),      // O sütunu - son değer
        durum, kaydeden, kayitTarihi
      ];
    } else {
      values = [
        tarihObj,
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
    
    // 🔥 SAAT SIRALAMASI İÇİN DOĞRU KONUMU BUL
    var insertRow = sheet.getLastRow() + 1;
    sheet.getRange(insertRow, 1, 1, 18).setValues([values]);
    
    // Yeni eklenen satırın formatını ayarla
    var newRow = insertRow;
    var dataRange = sheet.getRange(newRow, 1, 1, 18);
    dataRange.setHorizontalAlignment('center');
    dataRange.setFontSize(10);
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

// Tüm kayıtları getir (Tüm Motor Sayfalarından)
function getRecords() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = spreadsheet.getSheets();
    var records = [];
    
    // Sadece Enerji GM-* sayfalarını işle
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var sheetName = sheet.getName();
      
      // Sadece enerji sayfalarını işle
      if (!sheetName.startsWith('Enerji GM-')) {
        continue;
      }
      
      console.log('📊 Enerji sayfası okunuyor: ' + sheetName);
      
      if (sheet.getLastRow() < 2) {
        continue;
      }
      
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
      
      for (var j = data.length - 1; j >= 0; j--) {
        var row = data[j];
        
        records.push(mapEnerjiRow(row));
      }
    }
    
    console.log('📊 Toplam ' + records.length + ' enerji kaydı okundu');
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
    var sheet = getEnerjiSheetIfExists(motor);
    if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };

    var searchTarih = normalizeDateTR(tarih);
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
    var filtered = [];
    for (var i = rows.length - 1; i >= 0; i--) {
      var record = mapEnerjiRow(rows[i]);
      if (record.tarih === searchTarih) filtered.push(record);
    }
    
    return { success: true, data: filtered };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Kayıt var mı kontrol et
function checkExistingRecord(motor, tarih, saat) {
  try {
    var sheet = getEnerjiSheetIfExists(motor);
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, exists: false, record: null };
    }

    var searchTarih = normalizeDateTR(tarih);
    var searchMotor = String(motor || '').trim();
    var searchSaat = String(saat || '').trim();
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
    var existing = null;

    for (var i = 0; i < data.length; i++) {
      var record = mapEnerjiRow(data[i]);
      var recMotor = String(record.motor || '').trim();
      var recTarih = String(record.tarih || '').trim();
      var recSaat = String(record.saat || '').trim();

      if (recMotor === searchMotor && recTarih === searchTarih && recSaat === searchSaat) {
        existing = record;
        break;
      }
    }
    
    var result = { 
      success: true, 
      exists: !!existing,
      record: existing || null
    };
    
    return result;
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 🚀 TOPLU KAYIT KONTROLÜ - Tek seferde çoklu kayıt kontrolü
function checkMultipleRecords(data) {
  try {
    var kombinasyonlar = data.split(',');
    var sonuclar = {};
    var varOlanlar = [];
    var recordsByMotor = {};

    for (var i = 0; i < kombinasyonlar.length; i++) {
      var parts = kombinasyonlar[i].split('|');
      if (parts.length !== 3) continue;

      var motor = parts[0].trim();
      var tarih = parts[1].trim();
      var saat = parts[2].trim();
      var searchTarih = normalizeDateTR(tarih);
      var key = motor + '|' + tarih + '|' + saat;

      if (!recordsByMotor[motor]) {
        var sheet = getEnerjiSheetIfExists(motor);
        recordsByMotor[motor] = !sheet || sheet.getLastRow() < 2
          ? []
          : sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues().map(mapEnerjiRow);
      }

      var existing = recordsByMotor[motor].find(function(record) {
        var recMotor = String(record.motor || '').trim();
        var recTarih = String(record.tarih || '').trim();
        var recSaat = String(record.saat || '').trim();

        return recMotor === motor && recTarih === searchTarih && recSaat === saat;
      });

      sonuclar[key] = {
        exists: !!existing,
        record: existing || null
      };

      if (existing) {
        varOlanlar.push(key);
      }
    }

    return { 
      success: true, 
      results: sonuclar,
      existingCount: varOlanlar.length,
      totalCount: kombinasyonlar.length
    };
    
  } catch (error) {
    console.error('Toplu kayıt kontrolü hatası: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Son N kaydı getir
function getLastRecords(count) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = spreadsheet.getSheets();
    var records = [];
    var total = 0;
    var perSheetCount = Math.max(count || 50, 10);

    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      if (!sheet.getName().startsWith('Enerji GM-')) continue;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;

      total += lastRow - 1;
      var rowCount = Math.min(perSheetCount, lastRow - 1);
      var startRow = Math.max(2, lastRow - rowCount + 1);
      var rows = sheet.getRange(startRow, 1, rowCount, 18).getDisplayValues();
      for (var j = 0; j < rows.length; j++) {
        records.push(mapEnerjiRow(rows[j]));
      }
    }

    records.sort(function(a, b) {
      return parseDateTimeTR(b.tarih, b.saat) - parseDateTimeTR(a.tarih, a.saat);
    });
    
    return { 
      success: true, 
      data: records.slice(0, count),
      total: total
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getDailyProductionSummary(tarih, updateSheet) {
  try {
    var targetTarih = normalizeDateTR(tarih || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy'));
    var motors = ['GM-1', 'GM-2', 'GM-3'];
    var motorSummaries = [];
    var totalKwh = 0;

    for (var i = 0; i < motors.length; i++) {
      var motor = motors[i];
      var sheet = getEnerjiSheetIfExists(motor);
      var records = [];

      if (sheet && sheet.getLastRow() >= 2) {
        var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
        for (var j = 0; j < rows.length; j++) {
          var record = mapEnerjiRow(rows[j]);
          if (String(record.tarih || '').trim() === targetTarih) {
            records.push(record);
          }
        }
      }

      records.sort(function(a, b) {
        return parseDateTimeTR(a.tarih, a.saat) - parseDateTimeTR(b.tarih, b.saat);
      });

      var detailRows = [];
      var firstEnergy = null;
      var lastEnergy = null;
      var firstHour = null;
      var lastHour = null;
      var previousEnergy = null;

      for (var k = 0; k < records.length; k++) {
        var item = records[k];
        var energy = parseEnerjiNumber(item.toplamAktifEnerji);
        var workingHour = parseEnerjiNumber(item.calismaSaati);
        var hourlyKwh = previousEnergy === null ? 0 : Math.max(0, energy - previousEnergy);

        if (firstEnergy === null) firstEnergy = energy;
        if (firstHour === null) firstHour = workingHour;
        lastEnergy = energy;
        lastHour = workingHour;
        previousEnergy = energy;

        detailRows.push({
          saat: item.saat,
          calismaSaati: workingHour,
          toplamAktifEnerji: energy,
          saatlikUretimMw: hourlyKwh / 1000,
          saatlikUretimKwh: hourlyKwh
        });
      }

      var dailyKwh = firstEnergy === null || lastEnergy === null ? 0 : Math.max(0, lastEnergy - firstEnergy);
      var dailyHours = firstHour === null || lastHour === null ? 0 : Math.max(0, lastHour - firstHour);
      totalKwh += dailyKwh;

      motorSummaries.push({
        motor: motor,
        recordCount: records.length,
        firstEnergy: firstEnergy || 0,
        lastEnergy: lastEnergy || 0,
        dailyProductionKwh: dailyKwh,
        dailyProductionMwh: dailyKwh / 1000,
        dailyHours: dailyHours,
        lastWorkingHour: lastHour || 0,
        rows: detailRows
      });
    }

    var summary = {
      success: true,
      tarih: targetTarih,
      totalDailyProductionKwh: totalKwh,
      totalDailyProductionMwh: totalKwh / 1000,
      data: motorSummaries
    };

    if (updateSheet) {
      var sheetResult = updateDailyProductionSheetFromSummary(summary);
      summary.sheet = sheetResult;
    }

    return summary;
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function updateDailyProductionSheet(tarih) {
  var summary = getDailyProductionSummary(tarih, false);
  if (!summary.success) return summary;
  var sheetResult = updateDailyProductionSheetFromSummary(summary);
  summary.sheet = sheetResult;
  return summary;
}

function updateDailyProductionSheetFromSummary(summary) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = 'GunlukUretimOzeti';
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    sheet.getDataRange().breakApart();
    sheet.clear();
    var blockWidth = 3;
    var gap = 1;
    var maxRows = 0;

    for (var i = 0; i < summary.data.length; i++) {
      var motorSummary = summary.data[i];
      var startCol = i * (blockWidth + gap) + 1;
      var titleRange = sheet.getRange(1, startCol, 1, blockWidth);
      titleRange.merge();
      titleRange.setValue(motorSummary.motor + ' - ' + summary.tarih);
      titleRange.setFontWeight('bold');
      titleRange.setHorizontalAlignment('center');
      titleRange.setBackground('#c4d79b');

      var headers = [['Çalışma Saati', 'Toplam Aktif Enerji (kWh)', 'Saatlik Üretim (MW)']];
      sheet.getRange(2, startCol, 1, blockWidth).setValues(headers);
      sheet.getRange(2, startCol, 1, blockWidth).setFontWeight('bold');
      sheet.getRange(2, startCol, 1, blockWidth).setHorizontalAlignment('center');

      var values = motorSummary.rows.map(function(row) {
        return [row.calismaSaati, row.toplamAktifEnerji, row.saatlikUretimMw];
      });

      if (values.length > 0) {
        sheet.getRange(3, startCol, values.length, blockWidth).setValues(values);
        sheet.getRange(3, startCol, values.length, blockWidth).setHorizontalAlignment('center');
        sheet.getRange(3, startCol, values.length, 1).setNumberFormat('0.00');
        sheet.getRange(3, startCol + 1, values.length, 1).setNumberFormat('0.00');
        sheet.getRange(3, startCol + 2, values.length, 1).setNumberFormat('0.000');
      }

      var totalRow = values.length + 3;
      sheet.getRange(totalRow, startCol, 1, 2).merge();
      sheet.getRange(totalRow, startCol).setValue('Günlük Üretim (MWh)');
      sheet.getRange(totalRow, startCol + 2).setValue(motorSummary.dailyProductionMwh);
      sheet.getRange(totalRow, startCol, 1, blockWidth).setFontWeight('bold');
      sheet.getRange(totalRow, startCol + 2).setNumberFormat('0.000');

      var rangeHeight = Math.max(values.length + 3, 4);
      sheet.getRange(1, startCol, rangeHeight, blockWidth)
        .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

      sheet.setColumnWidth(startCol, 100);
      sheet.setColumnWidth(startCol + 1, 130);
      sheet.setColumnWidth(startCol + 2, 110);
      maxRows = Math.max(maxRows, totalRow);
    }

    var footerRow = maxRows + 2;
    sheet.getRange(footerRow, 1).setValue('Toplam Günlük Üretim (MWh)');
    sheet.getRange(footerRow, 2).setValue(summary.totalDailyProductionMwh);
    sheet.getRange(footerRow, 1, 1, 2).setFontWeight('bold');
    sheet.getRange(footerRow, 2).setNumberFormat('0.000');

    return {
      success: true,
      sheetName: sheetName,
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss')
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 🔥 SAAT SIRALAMASI İÇİN DOĞRU KONUMU BULAN FONKSİYON
function findInsertPosition(sheet, tarih, saat) {
  var lastRow = sheet.getLastRow();
  
  // Tablo boşsa 2. satıra ekle
  if (lastRow <= 1) {
    return 2;
  }
  
  // Mevcut verileri al (tarih, saat)
  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  
  // Saati sayısal olarak karşılaştır (08:00 -> 8, 09:00 -> 9)
  var saatNum = parseInt(saat.split(':')[0]);
  
  // Tarih ve saate göre doğru konumu bul
  for (var i = 0; i < data.length; i++) {
    var rowTarih = data[i][0];
    var rowSaat = data[i][2];
    var rowSaatNum = parseInt(rowSaat.toString().split(':')[0]);
    
    // Aynı tarih ve saatten önceki konumu bul
    if (rowTarih === tarih && rowSaatNum > saatNum) {
      return i + 2; // +2 çünkü başlıklar var
    }
    
    // Farklı tarihse, tarihe göre sırala
    if (rowTarih > tarih) {
      return i + 2;
    }
  }
  
  // En sona ekle
  return lastRow + 1;
}

// Çoklu kayıt ekleme
function findInsertPositionByDateTime(sheet, tarih, saat) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return 2;
  }

  var targetTime = parseDateTimeTR(tarih, saat).getTime();
  var data = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();

  for (var i = 0; i < data.length; i++) {
    var rowTime = parseDateTimeTR(data[i][0], data[i][2]).getTime();
    if (rowTime > targetTime) {
      return i + 2;
    }
  }

  return lastRow + 1;
}

function parseEnerjiNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  var normalized = String(value).trim();
  if (normalized.indexOf(',') !== -1) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }
  var parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

function addMultipleRecords(dataString) {
  try {
    // Verileri parse et
    var records = JSON.parse(dataString);
    if (!Array.isArray(records)) {
      return { success: false, error: 'Veri formatı hatalı' };
    }
    
    var addedRecords = [];
    var errors = [];
    var motorSheets = {}; // Motor sayfalarını sakla
    
    // Her bir kaydı ekle
    for (var i = 0; i < records.length; i++) {
      try {
        var record = records[i];
        
        // Motor için doğru sayfayı al ve sakla
        var sheet = getOrCreateSheet(record.motor);
        motorSheets[record.motor] = sheet;
        
        // Tarih formatını kontrol et (Türkçe formatında tut)
        var tarih = record.tarih;
        // Gelen tarih zaten dd.MM.yyyy formatında olduğu gibi kullan
        
        // Satır verilerini hazırla (Excel sütunlarına göre)
        var rowData = [
          tarih || '',                                     // Tarih
          record.vardiya || '',                            // Vardiya
          record.saat || '',                               // Saat
          record.motor || '',                              // Motor
          record.aydemVoltaji || '0',                      // L1-L2 AYDEM VOLTAJI
          record.aktifGuc || '0',                          // (P) AKTİF GÜÇ
          record.reaktifGuc || '0',                        // (Q) REAKTİF GÜÇ
          record.cosPhi || '0',                            // Cos φ
          record.ortAkim || '0',                           // ORT.AKIM
          record.ortGerilim || '0',                        // ORT.GERİLİM
          record.notrAkim || '0',                          // NÖTR AKIMI (LN)
          record.tahrikGerilimi || '0',                    // TAHRİK GERİLİMİ (UE)
          record.toplamAktifEnerji || '0',                 // TOPLAM AKTİF ENERJİ
          record.calismaSaati || '0',                      // ÇALIŞMA SAATİ
          record.kalkisSayisi || '0',                      // KALKIŞ SAYISI
          record.not || 'Motor çalışmıyor',               // Durum
          record.kullanici || '',                          // Kaydeden
          new Date().toLocaleString('tr-TR')               // Kayıt Tarihi
        ];
        rowData[4] = parseEnerjiNumber(record.aydemVoltaji);
        rowData[5] = parseEnerjiNumber(record.aktifGuc);
        rowData[6] = parseEnerjiNumber(record.reaktifGuc);
        rowData[7] = parseEnerjiNumber(record.cosPhi);
        rowData[8] = parseEnerjiNumber(record.ortAkim);
        rowData[9] = parseEnerjiNumber(record.ortGerilim);
        rowData[10] = parseEnerjiNumber(record.notrAkim);
        rowData[11] = parseEnerjiNumber(record.tahrikGerilimi);
        rowData[12] = parseEnerjiNumber(record.toplamAktifEnerji);
        rowData[13] = parseEnerjiNumber(record.calismaSaati);
        rowData[14] = parseEnerjiNumber(record.kalkisSayisi);
        rowData[15] = normalizeEnerjiDurum(record.durum || 'MOTOR ÇALIŞMIYOR');
        if (rowData[15] !== 'NORMAL') {
          var zeroValue = parseEnerjiNumber('0.00');
          rowData[4] = zeroValue;
          rowData[5] = zeroValue;
          rowData[6] = zeroValue;
          rowData[7] = zeroValue;
          rowData[8] = zeroValue;
          rowData[9] = zeroValue;
          rowData[10] = zeroValue;
          rowData[11] = zeroValue;
        }
        
        // Satırı ekle
        var newRow = sheet.getLastRow() + 1;
        sheet.getRange(newRow, 1, 1, 18).setValues([rowData]);
        var dataRange = sheet.getRange(newRow, 1, 1, 18);
        dataRange.setHorizontalAlignment('center');
        dataRange.setFontSize(10);
        dataRange.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
        sheet.getRange(newRow, 5, 1, 11).setNumberFormat('0.00');
        dataRange.setBackground('#ffebee');
        dataRange.setFontColor('#c62828');
        addedRecords.push({
          motor: record.motor,
          tarih: record.tarih,
          saat: record.saat,
          row: newRow
        });
        
      } catch (recordError) {
        errors.push({
          record: records[i],
          error: recordError.toString()
        });
      }
    }
    
    console.log('📊 Çoklu enerji kayıt sonucu: ' + addedRecords.length + ' eklendi, ' + errors.length + ' hata');
    
    // 🔥 Her motor için tarihleri renklendir
    for (var motorName in motorSheets) {
      var motorRecords = addedRecords.filter(function(r) { return r.motor === motorName; });
      colorizeDates(motorSheets[motorName], motorRecords);
    }
    for (var j = 0; j < addedRecords.length; j++) {
      var addedRecord = addedRecords[j];
      var addedSheet = motorSheets[addedRecord.motor];
      if (addedSheet) {
        var addedRange = addedSheet.getRange(addedRecord.row, 1, 1, 18);
        addedRange.setHorizontalAlignment('center');
        addedRange.setFontSize(10);
        addedRange.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
        addedSheet.getRange(addedRecord.row, 5, 1, 11).setNumberFormat('0.00');
        addedRange.setBackground('#ffebee');
        addedRange.setFontColor('#c62828');
      }
    }
    
    return {
      success: true,
      addedCount: addedRecords.length,
      totalCount: records.length,
      addedRecords: addedRecords,
      errors: errors
    };
    
  } catch (error) {
    console.error('Çoklu enerji kayıt ekleme hatası: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// 🔥 Tarihleri renklendirme fonksiyonu
function checkHourlyMissingRecords() {
  try {
    var now = new Date();
    var target = getHourlyCheckTarget(now);
    var hour = target.hour;
    var saat = target.saat;
    var tarih = target.tarih;
    var vardiya = getVardiyaByHour(hour);
    var sentKey = 'kojenEnerjiHourlyCheck:' + tarih + ':' + saat;
    var props = PropertiesService.getScriptProperties();

    if (props.getProperty(sentKey)) {
      return { success: true, skipped: true, message: 'Bu saat daha once kontrol edildi' };
    }

    var motors = ['GM-1', 'GM-2', 'GM-3'];
    var missing = [];
    for (var i = 0; i < motors.length; i++) {
      var exists = checkExistingRecord(motors[i], tarih, saat);
      if (!exists.success || !exists.exists) {
        missing.push(motors[i]);
      }
    }

    if (missing.length === 0) {
      props.setProperty(sentKey, new Date().toISOString());
      addSystemLog({
        tarih: tarih,
        saat: saat,
        modul: 'Kojen Enerji',
        eksikKayit: 'Yok',
        otomatikKayitSonucu: 'Gerekmedi',
        mailSonucu: 'Gonderilmedi',
        detay: 'Eksik enerji kaydi yok'
      });
      return { success: true, missingCount: 0, addedCount: 0, message: 'Eksik enerji kaydi yok' };
    }

    var added = [];
    var errors = [];
    for (var j = 0; j < missing.length; j++) {
      var motor = missing[j];
      var lastNormal = getLastNormalRecordBefore(motor, tarih, saat);
      var autoData = {
        tarih: tarih,
        vardiya: vardiya,
        saat: saat,
        motor: motor,
        kaydeden: 'OTOMATIK SISTEM',
        durum: 'MOTOR ÇALIŞMIYOR',
        toplamAktifEnerji: lastNormal ? lastNormal.toplamAktifEnerji : '0',
        calismaSaati: lastNormal ? lastNormal.calismaSaati : '0',
        kalkisSayisi: lastNormal ? lastNormal.kalkisSayisi : '0'
      };
      var addResult = addRecord(autoData);
      if (addResult.success) {
        added.push(motor);
      } else {
        errors.push(motor + ': ' + addResult.error);
      }
    }

    var subject = 'Kojen Enerji Veri Uyarisi - ' + tarih + ' ' + saat + ' Kayit Girilmedi';
    var body = 'Kojen Enerji Veri Uyarisi\n\n' +
      'Tarih: ' + tarih + '\n' +
      'Saat: ' + saat + '\n' +
      'Vardiya: ' + vardiya + '\n\n' +
      'Eksik motor enerji kayitlari: ' + missing.join(', ') + '\n' +
      'Otomatik bos kayit eklenenler: ' + (added.length ? added.join(', ') : '-') + '\n' +
      (errors.length ? 'Kayit hatalari: ' + errors.join('; ') + '\n' : '') +
      '\nBu saat icin veri girilmedigi icin sistem otomatik bos kayit olusturdu.';

    var mailResult = sendEmailAlert({ subject: subject, body: body });
    props.setProperty(sentKey, new Date().toISOString());
    addSystemLog({
      tarih: tarih,
      saat: saat,
      modul: 'Kojen Enerji',
      eksikKayit: missing.join(', '),
      otomatikKayitSonucu: added.length + '/' + missing.length + ' basarili',
      mailSonucu: mailResult.success ? 'Basarili' : 'Basarisiz',
      hataMesaji: errors.concat(mailResult.success ? [] : [mailResult.error]).join('; '),
      detay: 'Otomatik motor calismiyor enerji kaydi'
    });

    return {
      success: true,
      missingCount: missing.length,
      addedCount: added.length,
      errors: errors,
      mail: mailResult
    };
  } catch (error) {
    addSystemLog({
      modul: 'Kojen Enerji',
      otomatikKayitSonucu: 'Hata',
      mailSonucu: 'Bilinmiyor',
      hataMesaji: error.toString(),
      detay: 'checkHourlyMissingRecords'
    });
    return { success: false, error: error.toString() };
  }
}

function getOrCreateSystemLogsSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('SistemLoglari');
  var headers = ['Kayit Zamani', 'Tarih', 'Saat', 'Modul', 'Eksik Kayit', 'Otomatik Kayit Sonucu', 'Mail Sonucu', 'Hata Mesaji', 'Detay'];
  if (!sheet) {
    sheet = spreadsheet.insertSheet('SistemLoglari');
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#ffffff');
    sheet.getRange(2, 1, 1000, headers.length).setNumberFormat('@');
  }
  return sheet;
}

function addSystemLog(data) {
  try {
    var sheet = getOrCreateSystemLogsSheet();
    sheet.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
      data.tarih || data.date || '',
      data.saat || data.hour || '',
      data.modul || data.module || 'Kojen Enerji',
      data.eksikKayit || data.missing || '',
      data.otomatikKayitSonucu || data.autoResult || '',
      data.mailSonucu || data.mailResult || '',
      data.hataMesaji || data.error || '',
      data.detay || data.detail || ''
    ]);
    return { success: true, message: 'Sistem logu eklendi' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getSystemLogs(count) {
  try {
    var sheet = getOrCreateSystemLogsSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };
    var rowCount = Math.min(count || 100, lastRow - 1);
    var startRow = Math.max(2, lastRow - rowCount + 1);
    var rows = sheet.getRange(startRow, 1, rowCount, 9).getDisplayValues();
    var data = rows.map(function(row) {
      return { kayitZamani: row[0], tarih: row[1], saat: row[2], modul: row[3], eksikKayit: row[4], otomatikKayitSonucu: row[5], mailSonucu: row[6], hataMesaji: row[7], detay: row[8] };
    }).reverse();
    return { success: true, data: data };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function installHourlyMissingRecordTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkHourlyMissingRecords') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('checkHourlyMissingRecords')
    .timeBased()
    .everyMinutes(5)
    .create();

  return { success: true, message: 'Enerji saatlik eksik kayit tetikleyicisi kuruldu' };
}

function getTriggerHealth() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var hourlyTriggers = [];
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkHourlyMissingRecords') {
        hourlyTriggers.push({
          handler: triggers[i].getHandlerFunction(),
          source: String(triggers[i].getTriggerSource()),
          eventType: String(triggers[i].getEventType())
        });
      }
    }

    var logs = getSystemLogs(1);
    return {
      success: true,
      installed: hourlyTriggers.length > 0,
      triggerCount: hourlyTriggers.length,
      triggers: hourlyTriggers,
      lastLog: logs.success && logs.data.length ? logs.data[0] : null,
      checkedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss')
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getVardiyaByHour(hour) {
  if (hour >= 8 && hour < 16) return '08-16';
  if (hour >= 16 && hour < 24) return '16-24';
  return '24-08';
}

function getHourlyCheckTarget(date) {
  var target = new Date(date);
  if (target.getMinutes() < 55) {
    target.setHours(target.getHours() - 1);
  }
  return {
    hour: target.getHours(),
    saat: pad2(target.getHours()) + ':00',
    tarih: Utilities.formatDate(target, Session.getScriptTimeZone(), 'dd.MM.yyyy')
  };
}

function getLastNormalRecordBefore(motor, tarih, saat) {
  var result = getRecords();
  if (!result.success || !result.data) return null;

  var limit = parseDateTimeTR(tarih, saat);
  var records = result.data.filter(function(record) {
    return String(record.motor || '').trim() === motor &&
      String(record.durum || '').toUpperCase() === 'NORMAL' &&
      parseDateTimeTR(record.tarih, record.saat) < limit;
  });

  records.sort(function(a, b) {
    return parseDateTimeTR(b.tarih, b.saat) - parseDateTimeTR(a.tarih, a.saat);
  });

  return records[0] || null;
}

function parseDateTimeTR(tarih, saat) {
  var text = String(tarih || '');
  var parts = text.indexOf('-') !== -1 ? text.split('-').reverse() : text.split('.');
  var hourParts = String(saat || '00:00').split(':');
  return new Date(
    parseInt(parts[2], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[0], 10),
    parseInt(hourParts[0] || '0', 10),
    parseInt(hourParts[1] || '0', 10)
  );
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function colorizeDates(sheet, addedRecords) {
  try {
    // Tarihleri grupla
    var dateGroups = {};
    for (var i = 0; i < addedRecords.length; i++) {
      var record = addedRecords[i];
      var tarih = record.tarih;
      if (!dateGroups[tarih]) {
        dateGroups[tarih] = [];
      }
      dateGroups[tarih].push(record.row);
    }
    
    // Her tarih için rastgele renk atayıp boyala
    for (var tarih in dateGroups) {
      var rows = dateGroups[tarih];
      var color = getRandomColor();
      
      for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        // Tüm satırı boyala (18 sütun)
        var range = sheet.getRange(row, 1, 1, 18);
        range.setBackground(color);
      }
    }
    
    console.log('🎨 Enerji tarihler renklendirildi: ' + Object.keys(dateGroups).length + ' farklı tarih');
  } catch (error) {
    console.error('Enerji renklendirme hatası: ' + error.toString());
  }
}

// Rastgele pastel renk üret
function getRandomColor() {
  var colors = [
    '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
    '#E2F0CB', '#B5EAD7', '#C7CEEA', '#F0E68C', '#DDA0DD',
    '#98FB98', '#FFDAB9', '#E6E6FA', '#F0FFF0', '#FFF0F5',
    '#FFE4E1', '#E0FFFF', '#F5F5DC', '#FFEFD5', '#FAEBD7'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Mail gönderme fonksiyonu
function sendEmailAlert(data) {
  try {
    if (!data) {
      return { success: false, error: 'Veri parametresi eksik' };
    }

    var to = data.to || 'mrtcsk0320@gmail.com';
    var subject = data.subject || 'Kojen Enerji Veri Uyarısı';
    var body = data.body || '';

    Logger.log('Mail gönderiliyor: ' + to + ', Konu: ' + subject);

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      htmlBody: body.replace(/\n/g, '<br>')
    });

    Logger.log('Mail başarıyla gönderildi: ' + to);
    return { success: true, message: 'Mail başarıyla gönderildi!' };

  } catch (error) {
    Logger.log('Mail gönderme hatası: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
