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
  var action = String(params.action || '').trim();
  var lock = null;
  try {
    if (isWriteAction(action)) {
      lock = LockService.getScriptLock();
      lock.waitLock(5000);
    }
    
    var result = {};
    
    switch(action) {
      case '':
      case 'health':
        result = getApiHealth();
        break;
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
      case 'getDashboardSummary':
        result = getDashboardSummary(params.tarih);
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
      case 'updateYearlyEnergySheet':
        result = updateYearlyEnergySheet(params.year, params.motor);
        break;
      case 'updateYearlyEnergySummarySheet':
        result = updateYearlyEnergySummarySheet(params.year);
        break;
      case 'backupYearlyEnergySheets':
        result = backupYearlyEnergySheets(params.year);
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
  return ['addRecord', 'addMultipleRecords', 'sendEmail', 'checkHourlyMissingRecords', 'installHourlyMissingRecordTrigger', 'updateYearlyEnergySheet', 'updateYearlyEnergySummarySheet', 'backupYearlyEnergySheets'].indexOf(action) !== -1;
}

function getApiHealth() {
  return {
    success: true,
    service: 'Kojen Enerji',
    message: 'API calisiyor. Islem yapmak icin action parametresi ekleyin.',
    checkedAt: new Date().toISOString(),
    availableActions: [
      'addRecord',
      'getRecords',
      'getRecordsByDate',
      'getRecordsByMotorAndDate',
      'checkExistingRecord',
      'checkMultipleRecords',
      'addMultipleRecords',
      'getLastRecords',
      'getDashboardSummary',
      'sendEmail',
      'checkHourlyMissingRecords',
      'installHourlyMissingRecordTrigger',
      'getTriggerHealth',
      'getSystemLogs',
      'updateYearlyEnergySheet',
      'updateYearlyEnergySummarySheet',
      'backupYearlyEnergySheets'
    ],
    examples: {
      health: '?action=health',
      lastRecords: '?action=getLastRecords&count=10',
      yearlyEnergy: '?action=updateYearlyEnergySheet&year=2026',
      yearlySummary: '?action=updateYearlyEnergySummarySheet&year=2026',
      yearlyBackup: '?action=backupYearlyEnergySheets&year=2026'
    }
  };
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

function getLastEnerjiCountersBefore(sheet, tarih, saat) {
  var fallback = {
    toplamAktifEnerji: 0,
    calismaSaati: 0,
    kalkisSayisi: 0
  };

  try {
    if (!sheet || sheet.getLastRow() < 2) {
      return fallback;
    }

    var targetTime = parseDateTimeTR(tarih, saat).getTime();
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
    var bestRecord = null;
    var bestTime = -Infinity;

    for (var i = 0; i < rows.length; i++) {
      var record = mapEnerjiRow(rows[i]);
      var recordTime = parseDateTimeTR(record.tarih, record.saat).getTime();
      if (isNaN(recordTime) || recordTime >= targetTime || recordTime < bestTime) {
        continue;
      }

      var energy = parseEnerjiNumber(record.toplamAktifEnerji);
      var hours = parseEnerjiNumber(record.calismaSaati);
      var starts = parseEnerjiNumber(record.kalkisSayisi);
      if (energy > 0 || hours > 0 || starts > 0) {
        bestTime = recordTime;
        bestRecord = {
          toplamAktifEnerji: energy,
          calismaSaati: hours,
          kalkisSayisi: starts
        };
      }
    }

    return bestRecord || fallback;
  } catch (error) {
    Logger.log('Son enerji sayaclari alinamadi: ' + error.toString());
    return fallback;
  }
}

function getCounterOrLatest(value, latestValue) {
  var parsed = parseEnerjiNumber(value);
  var latest = parseEnerjiNumber(latestValue);
  return parsed > 0 ? parsed : latest;
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
      var latestCounters = getLastEnerjiCountersBefore(sheet, formattedTarih, data.saat);
      var toplamAktifEnerji = getCounterOrLatest(data.toplamAktifEnerji, latestCounters.toplamAktifEnerji);
      var calismaSaati = getCounterOrLatest(data.calismaSaati, latestCounters.calismaSaati);
      var kalkisSayisi = getCounterOrLatest(data.kalkisSayisi, latestCounters.kalkisSayisi);

      values = [
        tarihObj, data.vardiya, data.saat, data.motor,
        zeroValue, zeroValue, zeroValue, zeroValue, zeroValue, zeroValue, zeroValue, zeroValue, // Diğer değerler 0.00 (8 tane)
        toplamAktifEnerji, // M sütunu - son değer
        calismaSaati,      // N sütunu - son değer
        kalkisSayisi,      // O sütunu - son değer
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
    
    var yearlyResult = updateYearlyEnergyAfterRecord(data.motor, formattedTarih, data.saat);

    return { success: true, message: data.motor + ' motoru için enerji kaydı başarıyla eklendi!', yearly: yearlyResult };
    
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

function getDashboardSummary(tarih) {
  var startedAt = new Date();
  var targetTarih = normalizeDateTR(tarih || Utilities.formatDate(startedAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'));
  var motorData = createEmptyDashboardMotors();
  var summary = {
    dailyProduction: 0,
    dailySteam: null,
    pendingMaintenance: 0,
    activeFaults: 0
  };
  var errors = [];

  try {
    summary.dailyProduction = getDashboardDailyProductionMwh(targetTarih);

    var latestEnergy = getLastRecords(100);
    if (latestEnergy.success && latestEnergy.data) {
      applyLatestEnergyToDashboard(motorData, latestEnergy.data);
    } else if (!latestEnergy.success) {
      errors.push('latestEnergy: ' + latestEnergy.error);
    }

    var external = fetchDashboardExternalData();
    applyDashboardMotorStatus(motorData, external.motorRecords);
    summary.dailySteam = getDashboardSteamValue(external.buharRecords);
    var maintenanceSummary = getDashboardMaintenanceSummary(external.maintenanceRecords);
    summary.pendingMaintenance = maintenanceSummary.pendingMaintenance;
    summary.activeFaults = maintenanceSummary.activeFaults;

    if (external.errors.length) {
      errors = errors.concat(external.errors);
    }

    return {
      success: true,
      tarih: targetTarih,
      summary: summary,
      motors: motorData,
      announcements: external.announcements,
      errors: errors,
      durationMs: new Date().getTime() - startedAt.getTime()
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      durationMs: new Date().getTime() - startedAt.getTime()
    };
  }
}

function createEmptyDashboardMotors() {
  return {
    gm1: { totalProduction: 0, hourlyProduction: 0, totalHours: 0, hourlyHours: 0, status: 'stopped' },
    gm2: { totalProduction: 0, hourlyProduction: 0, totalHours: 0, hourlyHours: 0, status: 'stopped' },
    gm3: { totalProduction: 0, hourlyProduction: 0, totalHours: 0, hourlyHours: 0, status: 'stopped' }
  };
}

function getDashboardDailyProductionMwh(tarih) {
  var motors = ['GM-1', 'GM-2', 'GM-3'];
  var totalMwh = 0;

  for (var i = 0; i < motors.length; i++) {
    var sheet = getEnerjiSheetIfExists(motors[i]);
    if (!sheet || sheet.getLastRow() < 2) continue;

    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
    var records = [];
    for (var j = 0; j < rows.length; j++) {
      var record = mapEnerjiRow(rows[j]);
      if (String(record.tarih || '').trim() === tarih) {
        records.push(record);
      }
    }

    records.sort(function(a, b) {
      return parseDateTimeTR(a.tarih, a.saat) - parseDateTimeTR(b.tarih, b.saat);
    });

    var firstEnergy = null;
    var lastEnergy = null;
    for (var k = 0; k < records.length; k++) {
      var energy = parseEnerjiNumber(records[k].toplamAktifEnerji);
      if (firstEnergy === null) firstEnergy = energy;
      lastEnergy = energy;
    }

    if (firstEnergy !== null && lastEnergy !== null) {
      totalMwh += Math.max(0, lastEnergy - firstEnergy);
    }
  }

  return totalMwh;
}

function getDashboardMotorKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeDashboardText(value) {
  return String(value || '').toLowerCase()
    .replace(/\u0131/g, 'i')
    .replace(/\u011F/g, 'g')
    .replace(/\u00FC/g, 'u')
    .replace(/\u015F/g, 's')
    .replace(/\u00F6/g, 'o')
    .replace(/\u00E7/g, 'c');
}

function isDashboardStoppedStatus(value) {
  var status = normalizeDashboardText(value);
  return status.indexOf('calismiyor') !== -1 ||
    status.indexOf('durdu') !== -1 ||
    status.indexOf('stop') !== -1;
}

function isDashboardFaultType(value) {
  return normalizeDashboardText(value) === 'ariza';
}

function applyLatestEnergyToDashboard(motorData, records) {
  var seen = {};
  var recordsByMotor = {};

  for (var groupIndex = 0; groupIndex < records.length; groupIndex++) {
    var groupRecord = records[groupIndex];
    var groupKey = getDashboardMotorKey(groupRecord.motor);
    if (!motorData[groupKey]) continue;
    if (!recordsByMotor[groupKey]) recordsByMotor[groupKey] = [];
    recordsByMotor[groupKey].push(groupRecord);
  }

  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    var key = getDashboardMotorKey(record.motor);
    if (!motorData[key] || seen[key]) continue;
    seen[key] = true;

    var totalEnergy = parseEnerjiNumber(record.toplamAktifEnerji);
    var totalHours = parseEnerjiNumber(record.calismaSaati);
    var previousRecord = recordsByMotor[key] && recordsByMotor[key].length > 1 ? recordsByMotor[key][1] : null;
    var previousEnergy = previousRecord ? parseEnerjiNumber(previousRecord.toplamAktifEnerji) : totalEnergy;
    var previousHours = previousRecord ? parseEnerjiNumber(previousRecord.calismaSaati) : totalHours;

    motorData[key].totalProduction = totalEnergy / 1000;
    motorData[key].hourlyProduction = Math.max(0, (totalEnergy - previousEnergy) / 1000);
    motorData[key].totalHours = totalHours;
    motorData[key].hourlyHours = Math.max(0, totalHours - previousHours);
    if (isDashboardStoppedStatus(record.durum)) {
      motorData[key].status = 'stopped';
    }
  }
}

function applyDashboardMotorStatus(motorData, records) {
  var seen = {};
  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    var key = getDashboardMotorKey(record.motor);
    if (!motorData[key] || seen[key]) continue;
    seen[key] = true;
    motorData[key].status = isDashboardStoppedStatus(record.durum) ? 'stopped' : 'running';
  }
}

function getDashboardSteamValue(records) {
  if (!records || !records.length) return null;
  var record = records[0];
  return parseEnerjiNumber(record.buharMiktari);
}

function getDashboardMaintenanceSummary(records) {
  var result = { pendingMaintenance: 0, activeFaults: 0 };
  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    if (normalizeDashboardText(record.status) !== 'aktif') continue;
    if (isDashboardFaultType(record.type)) {
      result.activeFaults++;
    } else {
      result.pendingMaintenance++;
    }
  }
  return result;
}

function fetchDashboardExternalData() {
  var urls = {
    motor: 'https://script.google.com/macros/s/AKfycbzqMKhkZXsKyywOZ3D-Ks3xzLz4HxBeR6vkLUdD57nfgcgf5NJleuAt24uv1-1Av7-jHQ/exec?action=getLastRecords&count=100',
    buhar: 'https://script.google.com/macros/s/AKfycbwAI0OS8V5naHu1-k0c57QwZTJgt2WeVX8pmmeT45d56wZqiFyCHv8jMLu-1StLSfwy1Q/exec?action=getLastRecords&count=1',
    announcements: 'https://script.google.com/macros/s/AKfycbyjW5gbtw0BRHjDlmeLYmaio0UQWw8DG1B89X85BYwI-dw4YqaTuEPYilmv6B_xrXDmTA/exec?action=getAnnouncements&active=true'
  };

  var keys = ['motor', 'buhar', 'announcements'];
  var requests = keys.map(function(key) {
    return {
      url: urls[key],
      method: 'get',
      muteHttpExceptions: true
    };
  });

  var output = {
    motorRecords: [],
    buharRecords: [],
    maintenanceRecords: [],
    announcements: [],
    errors: []
  };

  try {
    var responses = UrlFetchApp.fetchAll(requests);
    for (var i = 0; i < responses.length; i++) {
      var key = keys[i];
      var response = responses[i];
      var code = response.getResponseCode();
      if (code < 200 || code >= 300) {
        output.errors.push(key + ': HTTP ' + code);
        continue;
      }

      var payload = JSON.parse(response.getContentText());
      if (!payload.success) {
        output.errors.push(key + ': ' + (payload.error || payload.message || 'Basarisiz'));
        continue;
      }

      if (key === 'motor') output.motorRecords = payload.data || [];
      if (key === 'buhar') output.buharRecords = payload.data || [];
      if (key === 'announcements') output.announcements = payload.data || [];
    }
  } catch (error) {
    output.errors.push('externalFetch: ' + error.toString());
  }

  return output;
}

// Yillik enerji sayfasi guncelleme
function updateYearlyEnergySheet(year, motor) {
  try {
    var targetYear = parseInt(year, 10) || new Date().getFullYear();
    var motors = motor ? [String(motor).trim()] : ['GM-1', 'GM-2', 'GM-3'];
    var results = [];

    for (var i = 0; i < motors.length; i++) {
      var currentMotor = motors[i];
      var model = buildYearlyEnergySheetModel(currentMotor, targetYear);
      var sheet = getOrCreateYearlyEnergySheet(currentMotor, targetYear);
      renderYearlyEnergySheet(sheet, model);

      results.push({
        motor: currentMotor,
        year: targetYear,
        sheetName: sheet.getName(),
        dayCount: model.days.length,
        slotCount: model.slots.length
      });
    }

    var summaryResult = updateYearlyEnergySummarySheet(targetYear);

    return {
      success: true,
      year: targetYear,
      results: results,
      summary: summaryResult,
      message: results.length + ' adet yillik enerji sayfasi guncellendi.'
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getOrCreateYearlyEnergySheet(motor, year) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = 'YillikEnerji-' + String(motor || '').trim() + '-' + String(year || '').trim();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function buildYearlyEnergySheetModel(motor, year) {
  var slots = getYearlyEnergyHourSlots();
  var lookup = buildYearlyEnergyRecordLookup(motor, year);
  var sortedRecords = lookup.sortedRecords;
  var exactMap = lookup.exactMap;
  var days = [];
  var dayCount = Math.round((new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 86400000);
  var pointer = -1;

  for (var dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    var currentDate = new Date(year, 0, dayIndex + 1);
    var nextDate = new Date(year, 0, dayIndex + 2);
    var dateKey = formatEnerjiDateTR(currentDate);
    var nextDateKey = formatEnerjiDateTR(nextDate);
    var startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0).getTime();

    while (pointer + 1 < sortedRecords.length && sortedRecords[pointer + 1].timestamp <= startOfDay) {
      pointer++;
    }

    var previousRecord = pointer >= 0 ? sortedRecords[pointer] : null;
    var previousEnergy = previousRecord ? previousRecord.toplamAktifEnerji : null;
    var previousHours = previousRecord ? previousRecord.calismaSaati : null;
    var rows = [];

    rows.push({
      saat: '23:59',
      calismaSaati: previousHours,
      toplamAktifEnerji: previousEnergy,
      saatlikUretim: 0
    });

    for (var hour = 1; hour <= 23; hour++) {
      var slot = pad2(hour) + ':00';
      var record = exactMap[dateKey + '|' + slot] || null;
      var output = buildYearlyEnergySlotOutput(record, previousEnergy, previousHours);
      previousEnergy = output.nextEnergy;
      previousHours = output.nextHours;
      rows.push({
        saat: slot,
        calismaSaati: output.calismaSaati,
        toplamAktifEnerji: output.toplamAktifEnerji,
        saatlikUretim: output.saatlikUretim
      });
    }

    var midnightRecord = exactMap[nextDateKey + '|00:00'] || null;
    var midnightOutput = buildYearlyEnergySlotOutput(midnightRecord, previousEnergy, previousHours);
    rows.push({
      saat: '00:00',
      calismaSaati: midnightOutput.calismaSaati,
      toplamAktifEnerji: midnightOutput.toplamAktifEnerji,
      saatlikUretim: midnightOutput.saatlikUretim
    });

    days.push({
      dateKey: dateKey,
      headerText: formatEnerjiHeaderDate(currentDate),
      rows: rows
    });
  }

  return {
    motor: motor,
    year: year,
    slots: slots,
    days: days
  };
}

function buildYearlyEnergyRecordLookup(motor, year) {
  var sheet = getEnerjiSheetIfExists(motor);
  var sortedRecords = [];
  var exactMap = {};
  if (!sheet || sheet.getLastRow() < 2) {
    return { sortedRecords: sortedRecords, exactMap: exactMap };
  }

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getDisplayValues();
  var minTime = new Date(year - 1, 11, 31, 0, 0, 0, 0).getTime();
  var maxTime = new Date(year + 1, 0, 1, 0, 0, 0, 0).getTime();

  for (var i = 0; i < rows.length; i++) {
    var row = mapEnerjiRow(rows[i]);
    var tarihObj = parseEnerjiDateOnly(row.tarih);
    if (!tarihObj) continue;

    var tarih = formatEnerjiDateTR(tarihObj);
    var saat = normalizeEnerjiSaat(row.saat);
    var timestamp = parseDateTimeTR(tarih, saat).getTime();

    if (timestamp < minTime || timestamp > maxTime) {
      continue;
    }

    var record = {
      tarih: tarih,
      saat: saat,
      timestamp: timestamp,
      calismaSaati: parseEnerjiNumber(row.calismaSaati),
      toplamAktifEnerji: parseEnerjiNumber(row.toplamAktifEnerji)
    };

    sortedRecords.push(record);
    exactMap[tarih + '|' + saat] = record;
  }

  sortedRecords.sort(function(a, b) {
    return a.timestamp - b.timestamp;
  });

  return {
    sortedRecords: sortedRecords,
    exactMap: exactMap
  };
}

function buildYearlyEnergySlotOutput(record, previousEnergy, previousHours) {
  if (record) {
    var hourlyMwh = previousEnergy === null ? 0 : Math.max(0, record.toplamAktifEnerji - previousEnergy);
    return {
      calismaSaati: record.calismaSaati,
      toplamAktifEnerji: record.toplamAktifEnerji,
      saatlikUretim: hourlyMwh,
      nextEnergy: record.toplamAktifEnerji,
      nextHours: record.calismaSaati
    };
  }

  return {
    calismaSaati: previousHours,
    toplamAktifEnerji: previousEnergy,
    saatlikUretim: 0,
    nextEnergy: previousEnergy,
    nextHours: previousHours
  };
}

function renderYearlyEnergySheet(sheet, model) {
  var totalRows = model.slots.length + 2;
  var totalCols = 1 + (model.days.length * 3);
  var values = [];
  var backgrounds = [];

  backupSheetBeforeFullRender(sheet, 'Yillik enerji tam guncelleme');
  ensureSheetGridSize(sheet, totalRows, totalCols);
  sheet.getDataRange().breakApart();
  sheet.clear();

  for (var rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    var rowValues = [];
    var rowBackgrounds = [];
    for (var colIndex = 0; colIndex < totalCols; colIndex++) {
      rowValues.push('');
      rowBackgrounds.push('#ffffff');
    }
    values.push(rowValues);
    backgrounds.push(rowBackgrounds);
  }

  values[0][0] = model.motor;
  values[1][0] = 'Saat';
  backgrounds[0][0] = '#ffe699';
  backgrounds[1][0] = '#f3f3f3';

  for (var slotIndex = 0; slotIndex < model.slots.length; slotIndex++) {
    values[slotIndex + 2][0] = model.slots[slotIndex];
  }

  for (var dayIndex = 0; dayIndex < model.days.length; dayIndex++) {
    var day = model.days[dayIndex];
    var startCol = 1 + (dayIndex * 3);

    values[0][startCol] = day.headerText;
    values[1][startCol] = 'Calisma Saati';
    values[1][startCol + 1] = 'Toplam Aktif Enerji (MWh)';
    values[1][startCol + 2] = 'Saatlik Uretim (MW)';
    backgrounds[0][startCol] = '#c4d79b';
    backgrounds[0][startCol + 1] = '#c4d79b';
    backgrounds[0][startCol + 2] = '#c4d79b';
    backgrounds[1][startCol] = '#f3f3f3';
    backgrounds[1][startCol + 1] = '#f3f3f3';
    backgrounds[1][startCol + 2] = '#f3f3f3';

    for (var itemIndex = 0; itemIndex < day.rows.length; itemIndex++) {
      var item = day.rows[itemIndex];
      var targetRow = itemIndex + 2;
      values[targetRow][startCol] = item.calismaSaati === null ? '' : item.calismaSaati;
      values[targetRow][startCol + 1] = item.toplamAktifEnerji === null ? '' : item.toplamAktifEnerji;
      values[targetRow][startCol + 2] = item.saatlikUretim;

      if (item.saatlikUretim === 0) {
        backgrounds[targetRow][startCol + 2] = '#d9d9d9';
      } else if (item.saatlikUretim < 1) {
        backgrounds[targetRow][startCol + 2] = '#fff2cc';
      }
    }
  }

  var fullRange = sheet.getRange(1, 1, totalRows, totalCols);
  fullRange.setValues(values);
  fullRange.setBackgrounds(backgrounds);
  fullRange.setHorizontalAlignment('center');
  fullRange.setVerticalAlignment('middle');
  fullRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange(1, 1, 1, 1).setFontWeight('bold');
  sheet.getRange(2, 1, totalRows - 1, 1).setFontWeight('bold');
  sheet.getRange(2, 1, 1, totalCols).setFontWeight('bold');
  sheet.getRange(2, 1, 1, totalCols).setWrap(true);

  for (var mergeIndex = 0; mergeIndex < model.days.length; mergeIndex++) {
    var mergeStartCol = 2 + (mergeIndex * 3);
    var titleRange = sheet.getRange(1, mergeStartCol, 1, 3);
    titleRange.merge();
    titleRange.setValue(model.days[mergeIndex].headerText);
    titleRange.setFontWeight('bold');
  }

  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidth(1, 70);

  for (var widthIndex = 0; widthIndex < model.days.length; widthIndex++) {
    var widthStartCol = 2 + (widthIndex * 3);
    sheet.setColumnWidth(widthStartCol, 90);
    sheet.setColumnWidth(widthStartCol + 1, 115);
    sheet.setColumnWidth(widthStartCol + 2, 95);
    sheet.getRange(3, widthStartCol, model.slots.length, 1).setNumberFormat('0.##');
    sheet.getRange(3, widthStartCol + 1, model.slots.length, 1).setNumberFormat('0.##');
    sheet.getRange(3, widthStartCol + 2, model.slots.length, 1).setNumberFormat('0.###');
  }
}

function updateYearlyEnergyAfterRecord(motor, tarih, saat) {
  try {
    var affectedDates = getYearlyEnergyAffectedDates(tarih, saat);
    return updateYearlyEnergyDayBlocks(motor, affectedDates);
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function updateYearlyEnergyAfterAddedRecords(addedRecords) {
  try {
    var grouped = {};

    for (var i = 0; i < addedRecords.length; i++) {
      var record = addedRecords[i];
      var affectedDates = getYearlyEnergyAffectedDates(record.tarih, record.saat);
      for (var j = 0; j < affectedDates.length; j++) {
        var date = parseEnerjiDateOnly(affectedDates[j]);
        if (!date) continue;

        var motor = String(record.motor || '').trim();
        var year = date.getFullYear();
        var groupKey = motor + '|' + year;
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            motor: motor,
            year: year,
            dates: {}
          };
        }
        grouped[groupKey].dates[formatEnerjiDateTR(date)] = true;
      }
    }

    var results = [];
    for (var key in grouped) {
      var group = grouped[key];
      var dates = Object.keys(group.dates).sort(function(a, b) {
        return parseEnerjiDateOnly(a).getTime() - parseEnerjiDateOnly(b).getTime();
      });
      results.push(updateYearlyEnergyDayBlocksForYear(group.motor, group.year, dates));
    }

    return { success: true, results: results };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getYearlyEnergyAffectedDates(tarih, saat) {
  var date = parseEnerjiDateOnly(tarih);
  if (!date) return [];

  var dateMap = {};
  dateMap[formatEnerjiDateTR(date)] = true;

  if (normalizeEnerjiSaat(saat) === '00:00') {
    var previousDate = new Date(date.getTime());
    previousDate.setDate(previousDate.getDate() - 1);
    dateMap[formatEnerjiDateTR(previousDate)] = true;
  }

  return Object.keys(dateMap);
}

function updateYearlyEnergyDayBlocks(motor, dates) {
  var grouped = {};
  for (var i = 0; i < dates.length; i++) {
    var date = parseEnerjiDateOnly(dates[i]);
    if (!date) continue;

    var year = date.getFullYear();
    if (!grouped[year]) grouped[year] = {};
    grouped[year][formatEnerjiDateTR(date)] = true;
  }

  var results = [];
  for (var yearKey in grouped) {
    results.push(updateYearlyEnergyDayBlocksForYear(
      motor,
      parseInt(yearKey, 10),
      Object.keys(grouped[yearKey]).sort(function(a, b) {
        return parseEnerjiDateOnly(a).getTime() - parseEnerjiDateOnly(b).getTime();
      })
    ));
  }

  return { success: true, results: results };
}

function updateYearlyEnergyDayBlocksForYear(motor, year, dates) {
  var model = buildYearlyEnergySheetModel(motor, year);
  var sheet = getOrCreateYearlyEnergySheet(motor, year);
  var totalRows = model.slots.length + 2;
  var totalCols = 1 + (model.days.length * 3);

  if (shouldRenderFullYearlyEnergySheet(sheet, model, totalRows, totalCols)) {
    renderYearlyEnergySheet(sheet, model);
    var fullSummaryResult = updateYearlyEnergySummaryDayBlocks(year, dates);
    return {
      success: true,
      motor: motor,
      year: year,
      sheetName: sheet.getName(),
      fullRender: true,
      updatedDates: dates,
      summary: fullSummaryResult
    };
  }

  ensureSheetGridSize(sheet, totalRows, totalCols);
  renderYearlyEnergyBaseColumn(sheet, model);

  var updatedDates = [];
  for (var i = 0; i < dates.length; i++) {
    var date = parseEnerjiDateOnly(dates[i]);
    if (!date || date.getFullYear() !== year) continue;

    var dayIndex = getYearlyEnergyDayIndex(date);
    if (dayIndex < 0 || dayIndex >= model.days.length) continue;

    var updated = renderYearlyEnergyDayBlock(sheet, model, dayIndex);
    if (updated) updatedDates.push(updated.date);
  }

  var summaryResult = updateYearlyEnergySummaryDayBlocks(year, updatedDates);

  return {
    success: true,
    motor: motor,
    year: year,
    sheetName: sheet.getName(),
    fullRender: false,
    updatedDates: updatedDates,
    summary: summaryResult
  };
}

function shouldRenderFullYearlyEnergySheet(sheet, model, totalRows, totalCols) {
  if (sheet.getLastRow() < 2) return true;
  if (sheet.getLastColumn() < totalCols) return true;
  if (sheet.getMaxRows() < totalRows || sheet.getMaxColumns() < totalCols) return true;
  if (String(sheet.getRange(1, 1).getDisplayValue()).trim() !== String(model.motor || '').trim()) return true;
  if (String(sheet.getRange(2, 1).getDisplayValue()).trim() !== 'Saat') return true;
  return false;
}

function renderYearlyEnergyBaseColumn(sheet, model) {
  var slotValues = [];
  for (var i = 0; i < model.slots.length; i++) {
    slotValues.push([model.slots[i]]);
  }

  sheet.getRange(1, 1).setValue(model.motor);
  sheet.getRange(2, 1).setValue('Saat');
  sheet.getRange(3, 1, model.slots.length, 1).setValues(slotValues);
  sheet.getRange(1, 1).setBackground('#ffe699').setFontWeight('bold');
  sheet.getRange(2, 1).setBackground('#f3f3f3').setFontWeight('bold');
  sheet.getRange(1, 1, model.slots.length + 2, 1)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidth(1, 70);
}

function renderYearlyEnergyDayBlock(sheet, model, dayIndex) {
  var day = model.days[dayIndex];
  if (!day) return null;

  var startCol = 2 + (dayIndex * 3);
  var totalRows = model.slots.length + 2;
  var titleRange = sheet.getRange(1, startCol, 1, 3);
  titleRange.breakApart();
  titleRange.merge();
  titleRange.setValue(day.headerText);
  titleRange.setFontWeight('bold');
  titleRange.setHorizontalAlignment('center');
  titleRange.setBackground('#c4d79b');

  var headerRange = sheet.getRange(2, startCol, 1, 3);
  headerRange.setValues([['Calisma Saati', 'Toplam Aktif Enerji (MWh)', 'Saatlik Uretim (MW)']]);
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setWrap(true);
  headerRange.setBackground('#f3f3f3');

  var values = [];
  var backgrounds = [];
  for (var i = 0; i < day.rows.length; i++) {
    var item = day.rows[i];
    values.push([
      item.calismaSaati === null ? '' : item.calismaSaati,
      item.toplamAktifEnerji === null ? '' : item.toplamAktifEnerji,
      item.saatlikUretim
    ]);

    var rowBackgrounds = ['#ffffff', '#ffffff', '#ffffff'];
    if (item.saatlikUretim === 0) {
      rowBackgrounds[2] = '#d9d9d9';
    } else if (item.saatlikUretim < 1) {
      rowBackgrounds[2] = '#fff2cc';
    }
    backgrounds.push(rowBackgrounds);
  }

  var dataRange = sheet.getRange(3, startCol, model.slots.length, 3);
  dataRange.setValues(values);
  dataRange.setBackgrounds(backgrounds);
  dataRange.setHorizontalAlignment('center');
  dataRange.setVerticalAlignment('middle');

  sheet.getRange(1, startCol, totalRows, 3)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setColumnWidth(startCol, 90);
  sheet.setColumnWidth(startCol + 1, 115);
  sheet.setColumnWidth(startCol + 2, 95);
  sheet.getRange(3, startCol, model.slots.length, 1).setNumberFormat('0.##');
  sheet.getRange(3, startCol + 1, model.slots.length, 1).setNumberFormat('0.##');
  sheet.getRange(3, startCol + 2, model.slots.length, 1).setNumberFormat('0.###');

  return { date: day.dateKey, startColumn: startCol };
}

function updateYearlyEnergySummarySheet(year) {
  try {
    var targetYear = parseInt(year, 10) || new Date().getFullYear();
    var model = buildYearlyEnergySummaryModel(targetYear);
    var sheet = getOrCreateYearlyEnergySummarySheet(targetYear);
    renderYearlyEnergySummarySheet(sheet, model);

    return {
      success: true,
      year: targetYear,
      sheetName: sheet.getName(),
      dayCount: model.days.length,
      message: 'Yillik enerji toplam sayfasi guncellendi.'
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function updateYearlyEnergySummaryDayBlocks(year, dates) {
  try {
    var targetYear = parseInt(year, 10) || new Date().getFullYear();
    var model = buildYearlyEnergySummaryModel(targetYear);
    var sheet = getOrCreateYearlyEnergySummarySheet(targetYear);

    if (!dates || !dates.length || shouldRenderFullYearlyEnergySummarySheet(sheet, model)) {
      renderYearlyEnergySummarySheet(sheet, model);
      return {
        success: true,
        year: targetYear,
        sheetName: sheet.getName(),
        fullRender: true,
        updatedDates: dates || []
      };
    }

    var updatedDates = [];
    ensureSheetGridSize(sheet, getYearlyEnergySummaryRowCount(), getYearlyEnergySummaryColumnCount(model));
    renderYearlyEnergySummaryLabels(sheet);

    for (var i = 0; i < dates.length; i++) {
      var date = parseEnerjiDateOnly(dates[i]);
      if (!date || date.getFullYear() !== targetYear) continue;

      var dayIndex = getYearlyEnergyDayIndex(date);
      if (dayIndex < 0 || dayIndex >= model.days.length) continue;

      renderYearlyEnergySummaryBlock(sheet, model.days[dayIndex], dayIndex);
      updatedDates.push(model.days[dayIndex].dateKey);
    }

    formatYearlyEnergySummarySheet(sheet, model.days.length);

    return {
      success: true,
      year: targetYear,
      sheetName: sheet.getName(),
      fullRender: false,
      updatedDates: updatedDates
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getOrCreateYearlyEnergySummarySheet(year) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = 'YillikEnerjiToplam-' + String(year || '').trim();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function buildYearlyEnergySummaryModel(year) {
  var targetYear = parseInt(year, 10) || new Date().getFullYear();
  var motors = ['GM-1', 'GM-2', 'GM-3'];
  var motorModels = {};
  var days = [];

  for (var i = 0; i < motors.length; i++) {
    motorModels[motors[i]] = buildYearlyEnergySheetModel(motors[i], targetYear);
  }

  var dayCount = Math.round((new Date(targetYear + 1, 0, 1) - new Date(targetYear, 0, 1)) / 86400000);
  for (var dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    var currentDate = new Date(targetYear, 0, dayIndex + 1);
    var gm1 = buildYearlyEnergyDailyMetric(motorModels['GM-1'].days[dayIndex].rows);
    var gm2 = buildYearlyEnergyDailyMetric(motorModels['GM-2'].days[dayIndex].rows);
    var gm3 = buildYearlyEnergyDailyMetric(motorModels['GM-3'].days[dayIndex].rows);
    var totalProductionMwh = gm1.productionMwh + gm2.productionMwh + gm3.productionMwh;
    var totalHours = gm1.hours + gm2.hours + gm3.hours;

    days.push({
      dateKey: formatEnerjiDateTR(currentDate),
      headerText: formatEnerjiHeaderDate(currentDate),
      gm1: gm1,
      gm2: gm2,
      gm3: gm3,
      total: {
        productionMwh: totalProductionMwh,
        hours: totalHours,
        averageMw: totalHours > 0 ? totalProductionMwh / totalHours : 0
      }
    });
  }

  return {
    year: targetYear,
    days: days
  };
}

function buildYearlyEnergyDailyMetric(rows) {
  var firstHours = null;
  var lastHours = null;
  var previousHours = null;
  var productionMwh = 0;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var hours = row.calismaSaati === null ? null : parseEnerjiNumber(row.calismaSaati);
    var energy = row.toplamAktifEnerji === null ? null : parseEnerjiNumber(row.toplamAktifEnerji);
    var hasValidCounter = (hours !== null && hours > 0) || (energy !== null && energy > 0);

    if (!hasValidCounter) continue;
    if (previousHours !== null && hours !== null && hours < previousHours) continue;

    if (firstHours === null && hours !== null) firstHours = hours;
    if (hours !== null) {
      lastHours = hours;
      previousHours = hours;
    }

    productionMwh += Math.max(0, parseEnerjiNumber(row.saatlikUretim));
  }

  var hoursDiff = firstHours === null || lastHours === null ? 0 : Math.max(0, lastHours - firstHours);

  return {
    productionMwh: productionMwh,
    hours: hoursDiff,
    averageMw: hoursDiff > 0 ? productionMwh / hoursDiff : 0
  };
}

function renderYearlyEnergySummarySheet(sheet, model) {
  var totalRows = getYearlyEnergySummaryRowCount();
  var totalCols = getYearlyEnergySummaryColumnCount(model);
  backupSheetBeforeFullRender(sheet, 'Yillik enerji toplam tam guncelleme');
  ensureSheetGridSize(sheet, totalRows, totalCols);
  sheet.getDataRange().breakApart();
  sheet.clear();
  renderYearlyEnergySummaryLabels(sheet);

  for (var i = 0; i < model.days.length; i++) {
    renderYearlyEnergySummaryBlock(sheet, model.days[i], i);
  }

  formatYearlyEnergySummarySheet(sheet, model.days.length);
}

function renderYearlyEnergySummaryBlock(sheet, day, dayIndex) {
  var startCol = 2 + (dayIndex * 4);
  var values = [
    [day.headerText, '', '', ''],
    ['GM1', 'GM2', 'GM3', 'TOPLAM'],
    [day.gm1.productionMwh, day.gm2.productionMwh, day.gm3.productionMwh, day.total.productionMwh],
    [day.gm1.hours, day.gm2.hours, day.gm3.hours, day.total.hours],
    [day.gm1.averageMw, day.gm2.averageMw, day.gm3.averageMw, day.total.averageMw]
  ];
  var backgrounds = [
    ['#ffffff', '#ffffff', '#ffffff', '#cfe2f3'],
    ['#f3f3f3', '#f3f3f3', '#f3f3f3', '#cfe2f3'],
    ['#ffffff', '#ffffff', '#ffffff', '#cfe2f3'],
    ['#ffffff', '#ffffff', '#ffffff', '#cfe2f3'],
    ['#ffffff', '#ffffff', '#ffffff', '#cfe2f3']
  ];

  var titleRange = sheet.getRange(1, startCol, 1, 4);
  titleRange.breakApart();
  sheet.getRange(1, startCol, 5, 4).setValues(values);
  sheet.getRange(1, startCol, 5, 4).setBackgrounds(backgrounds);
  titleRange.merge();
  titleRange.setValue(day.headerText);
  titleRange.setFontWeight('bold');
  titleRange.setHorizontalAlignment('center');
  sheet.getRange(2, startCol, 1, 4).setFontWeight('bold');
  sheet.getRange(1, startCol, 5, 4)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(3, startCol, 1, 4).setNumberFormat('0.#');
  sheet.getRange(4, startCol, 1, 4).setNumberFormat('0.#');
  sheet.getRange(5, startCol, 1, 4).setNumberFormat('0.##');
}

function shouldRenderFullYearlyEnergySummarySheet(sheet, model) {
  return sheet.getLastRow() < getYearlyEnergySummaryRowCount() ||
    sheet.getLastColumn() < getYearlyEnergySummaryColumnCount(model) ||
    String(sheet.getRange(3, 1).getDisplayValue()).trim() !== 'Uretim (MWh)';
}

function formatYearlyEnergySummarySheet(sheet, dayCount) {
  var totalCols = 1 + (dayCount * 4);
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidth(1, 125);
  for (var i = 0; i < dayCount; i++) {
    var startCol = 2 + (i * 4);
    sheet.setColumnWidth(startCol, 75);
    sheet.setColumnWidth(startCol + 1, 75);
    sheet.setColumnWidth(startCol + 2, 75);
    sheet.setColumnWidth(startCol + 3, 90);
  }
  sheet.getRange(1, 1, getYearlyEnergySummaryRowCount(), Math.max(totalCols, 1)).setFontSize(10);
}

function renderYearlyEnergySummaryLabels(sheet) {
  var values = [
    ['Tarih'],
    ['Motor'],
    ['Uretim (MWh)'],
    ['Calisma Saati'],
    ['Ort. Guc (MW)']
  ];
  var backgrounds = [
    ['#ffffff'],
    ['#f3f3f3'],
    ['#f3f3f3'],
    ['#f3f3f3'],
    ['#f3f3f3']
  ];
  var range = sheet.getRange(1, 1, getYearlyEnergySummaryRowCount(), 1);
  range.setValues(values);
  range.setBackgrounds(backgrounds);
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
  range.setVerticalAlignment('middle');
  range.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
}

function getYearlyEnergySummaryRowCount() {
  return 5;
}

function getYearlyEnergySummaryColumnCount(model) {
  return 1 + ((model.days || []).length * 4);
}

function backupYearlyEnergySheets(year) {
  try {
    var targetYear = parseInt(year, 10) || new Date().getFullYear();
    var yearText = String(targetYear);
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = spreadsheet.getSheets();
    var backups = [];
    var createdCount = 0;

    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var name = sheet.getName();
      if (name.indexOf('-Yedek-') !== -1) continue;

      var isMotorYearly = name.indexOf('YillikEnerji-') === 0 &&
        name.substring(name.length - yearText.length) === yearText;
      var isSummaryYearly = name === 'YillikEnerjiToplam-' + yearText;
      if (!isMotorYearly && !isSummaryYearly) continue;

      var backup = backupSheetBeforeFullRender(sheet, 'Manuel yillik enerji yedegi');
      if (backup.success && !backup.skipped) createdCount++;
      backups.push({
        sourceSheet: name,
        backupSheet: backup.sheetName || '',
        skipped: !!backup.skipped,
        success: backup.success !== false,
        error: backup.error || ''
      });
    }

    return {
      success: true,
      year: targetYear,
      matchedCount: backups.length,
      backupCount: createdCount,
      backups: backups,
      message: createdCount + ' adet yillik enerji sayfasi yedeklendi.'
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function backupSheetBeforeFullRender(sheet, reason) {
  try {
    if (!sheet || !sheetHasDisplayData(sheet)) {
      return { success: true, skipped: true, message: 'Yedeklenecek veri yok' };
    }

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    var baseName = sheet.getName();
    var maxBaseLength = 100 - ('-Yedek-' + timestamp).length;
    var backupName = baseName.substring(0, maxBaseLength) + '-Yedek-' + timestamp;
    var suffix = 2;

    while (spreadsheet.getSheetByName(backupName)) {
      var suffixText = '-' + suffix;
      backupName = baseName.substring(0, maxBaseLength - suffixText.length) + '-Yedek-' + timestamp + suffixText;
      suffix++;
    }

    var backupSheet = sheet.copyTo(spreadsheet);
    backupSheet.setName(backupName);
    backupSheet.setTabColor('#f4b183');
    spreadsheet.setActiveSheet(sheet);

    return {
      success: true,
      sheetName: backupName,
      sourceSheet: baseName,
      reason: reason || ''
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function sheetHasDisplayData(sheet) {
  var values = sheet.getDataRange().getDisplayValues();
  for (var row = 0; row < values.length; row++) {
    for (var col = 0; col < values[row].length; col++) {
      if (String(values[row][col] || '').trim() !== '') {
        return true;
      }
    }
  }
  return false;
}

function getYearlyEnergyDayIndex(date) {
  var startOfYear = new Date(date.getFullYear(), 0, 1);
  var startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startOfDay.getTime() - startOfYear.getTime()) / 86400000);
}

function parseEnerjiDateOnly(tarih) {
  var text = normalizeDateTR(tarih);
  var parts = text.split('.');
  if (parts.length !== 3) return null;

  var day = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  return new Date(year, month - 1, day);
}

function ensureSheetGridSize(sheet, rowCount, columnCount) {
  if (sheet.getMaxRows() < rowCount) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rowCount - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < columnCount) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), columnCount - sheet.getMaxColumns());
  }
}

function getYearlyEnergyHourSlots() {
  var slots = ['23:59'];
  for (var hour = 1; hour <= 23; hour++) {
    slots.push(pad2(hour) + ':00');
  }
  slots.push('00:00');
  return slots;
}

function normalizeEnerjiSaat(value) {
  var text = String(value || '').trim();
  if (!text) return '00:00';
  var parts = text.split(':');
  var hour = parseInt(parts[0] || '0', 10);
  var minute = parseInt(parts[1] || '0', 10);
  return pad2(isNaN(hour) ? 0 : hour) + ':' + pad2(isNaN(minute) ? 0 : minute);
}

function formatEnerjiDateTR(date) {
  return pad2(date.getDate()) + '.' + pad2(date.getMonth() + 1) + '.' + date.getFullYear();
}

function formatEnerjiHeaderDate(date) {
  return date.getDate() + '.' + pad2(date.getMonth() + 1) + '.' + date.getFullYear();
}

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
          var latestCounters = getLastEnerjiCountersBefore(sheet, tarih, record.saat);
          rowData[4] = zeroValue;
          rowData[5] = zeroValue;
          rowData[6] = zeroValue;
          rowData[7] = zeroValue;
          rowData[8] = zeroValue;
          rowData[9] = zeroValue;
          rowData[10] = zeroValue;
          rowData[11] = zeroValue;
          rowData[12] = getCounterOrLatest(record.toplamAktifEnerji, latestCounters.toplamAktifEnerji);
          rowData[13] = getCounterOrLatest(record.calismaSaati, latestCounters.calismaSaati);
          rowData[14] = getCounterOrLatest(record.kalkisSayisi, latestCounters.kalkisSayisi);
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
    var yearlyResult = updateYearlyEnergyAfterAddedRecords(addedRecords);
    
    return {
      success: true,
      addedCount: addedRecords.length,
      totalCount: records.length,
      addedRecords: addedRecords,
      errors: errors,
      yearly: yearlyResult
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
    if (added.length === missing.length) {
      props.setProperty(sentKey, new Date().toISOString());
    }
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
