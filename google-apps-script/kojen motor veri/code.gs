/**
 * KOJEN MOTOR VERİLERİ - Google Apps Script Kodu
 * Bu dosya Google Sheets > Extensions > Apps Script'e yapıştırılacak
 * 
 * Kurulum Adımları:
 * 1. Google Sheets'de yeni bir sayfa oluşturun
 * 2. Sheet adını "KojenMotorVerileri" yapın
 * 3. İlk satır başlıkları: Tarih | Vardiya | Saat | Motor | JEN. YATAK SIC. (DE) | JEN. YATAK SIC. (NDE) | SOĞUTMA SUYU SIC. | SOĞUTMA SUYU BAS. | YAĞ SIC. | YAĞ BAS. | ŞARJ SIC. | ŞARJ BAS. | GAZ REG. (λ) | MAKİNE DAİRESİ SIC. | KARTER BAS. | ÖN KAMARA FARK BAS. | SARGI SIC. -1- | SARGI SIC. -2- | SARGI SIC. -3- | Durum | Kaydeden | Kayıt Tarihi
 * 4. Extensions > Apps Script'e gidin
 * 5. Bu kodu yapıştırın
 * 6. Deploy > New Deployment > Web App seçin
 * 7. Execute as: Me, Who has access: Anyone seçin
 * 8. URL'i kopyalayın ve kojen-motor-config.js'e yapıştırın
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
      case 'sendEmail':
        result = sendEmailAlert(params);
        break;
      case 'checkHourlyMissingRecords':
        result = checkHourlyMissingRecords();
        break;
      case 'fillMissingFullDay':
        result = fillMissingFullDay(params.tarih, params.motor, params.startSaat, params.endSaat);
        break;
      case 'normalizeMotorSheetNames':
        result = normalizeMotorSheetNames();
        break;
      case 'sortMotorSheet':
      case 'sortEnergySheet':
        result = sortMotorSheet(params.motor);
        break;
      case 'colorizeMotorSheet':
      case 'colorizeEnergySheet':
        result = colorizeMotorSheet(params.motor);
        break;
      case 'installHourlyMissingRecordTrigger':
        result = installHourlyMissingRecordTrigger();
        break;
      case 'getTriggerHealth':
        result = getTriggerHealth();
        break;
      case 'getMotorSheetReport':
        result = getMotorSheetReport();
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
  return ['addRecord', 'addMultipleRecords', 'sendEmail', 'checkHourlyMissingRecords', 'fillMissingFullDay', 'normalizeMotorSheetNames', 'sortMotorSheet', 'sortEnergySheet', 'colorizeMotorSheet', 'colorizeEnergySheet', 'installHourlyMissingRecordTrigger'].indexOf(action) !== -1;
}

function getApiHealth() {
  return {
    success: true,
    service: 'Kojen Motor',
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
      'sendEmail',
      'checkHourlyMissingRecords',
      'fillMissingFullDay',
      'normalizeMotorSheetNames',
      'sortMotorSheet',
      'colorizeMotorSheet',
      'installHourlyMissingRecordTrigger',
      'getTriggerHealth',
      'getMotorSheetReport',
      'getSystemLogs'
    ]
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

function normalizeMotorLabel(motor) {
  var value = String(motor || 'GM-1').trim().toUpperCase();
  if (!value) return 'GM-1';
  value = value.replace(/\s+/g, '');
  var gmMatch = value.match(/GM-?(\d+)$/);
  if (gmMatch) return 'GM-' + gmMatch[1];
  if (/^\d+$/.test(value)) return 'GM-' + value;
  return 'GM-' + value;
}

function getMotorSheetName(motor) {
  return 'Motor GM-' + normalizeMotorLabel(motor);
}

function isMotorDataSheetName(sheetName) {
  return /^Motor\s+GM-/i.test(String(sheetName || ''));
}

function getCanonicalMotorFromSheet(sheet) {
  if (!sheet) return '';

  var sheetName = sheet.getName();
  if (!isMotorDataSheetName(sheetName)) {
    return '';
  }

  var nameMotor = normalizeMotorLabel(sheetName.replace(/^Motor\s+/i, ''));
  if (/^GM-\d+$/.test(nameMotor)) {
    return nameMotor;
  }

  if (sheet.getLastColumn() >= 4 && sheet.getLastRow() >= 2) {
    var rowCount = Math.min(sheet.getLastRow() - 1, 500);
    var motorValues = sheet.getRange(2, 4, rowCount, 1).getDisplayValues();
    for (var i = 0; i < motorValues.length; i++) {
      var value = String(motorValues[i][0] || '').trim();
      if (!value) continue;

      var rowMotor = normalizeMotorLabel(value);
      if (/^GM-\d+$/.test(rowMotor)) {
        return rowMotor;
      }
    }
  }

  return '';
}

function normalizeMotorSheetNames() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = spreadsheet.getSheets();
    var existingNames = {};
    var renamed = [];
    var merged = [];
    var skipped = [];

    for (var i = 0; i < sheets.length; i++) {
      existingNames[sheets[i].getName()] = true;
    }

    for (var j = 0; j < sheets.length; j++) {
      var sheet = sheets[j];
      var currentName = sheet.getName();
      if (currentName === 'SistemLoglari') {
        continue;
      }

      var canonicalMotor = getCanonicalMotorFromSheet(sheet);
      if (!canonicalMotor) {
        continue;
      }

      var canonicalName = getMotorSheetName(canonicalMotor);
      if (currentName === canonicalName) {
        continue;
      }

      if (existingNames[canonicalName]) {
        var targetSheet = spreadsheet.getSheetByName(canonicalName);
        var mergeResult = mergeMotorSheetData(sheet, targetSheet, canonicalMotor);
        var archiveName = getUniqueSheetName(spreadsheet, 'Arsiv ' + currentName);
        sheet.setName(archiveName);
        delete existingNames[currentName];
        existingNames[archiveName] = true;
        merged.push({
          sourceSheet: currentName,
          archiveSheet: archiveName,
          targetSheet: canonicalName,
          copiedCount: mergeResult.copiedCount,
          skippedCount: mergeResult.skippedCount,
          error: mergeResult.error || ''
        });
        continue;
      }

      sheet.setName(canonicalName);
      delete existingNames[currentName];
      existingNames[canonicalName] = true;
      renamed.push({
        oldName: currentName,
        newName: canonicalName
      });
    }

    return {
      success: true,
      renamedCount: renamed.length,
      mergedCount: merged.length,
      skippedCount: skipped.length,
      renamed: renamed,
      merged: merged,
      skipped: skipped
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function mergeMotorSheetData(sourceSheet, targetSheet, motor) {
  try {
    if (!sourceSheet || !targetSheet) {
      return { success: false, copiedCount: 0, skippedCount: 0, error: 'Kaynak veya hedef sayfa bulunamadi' };
    }

    var targetLastRow = targetSheet.getLastRow();
    var targetRows = targetLastRow >= 2
      ? targetSheet.getRange(2, 1, targetLastRow - 1, 22).getDisplayValues()
      : [];
    var existingKeys = {};
    for (var i = 0; i < targetRows.length; i++) {
      var targetRecord = mapMotorRow(targetRows[i]);
      var targetDate = normalizeDateTR(targetRecord.tarih || '');
      var targetSaat = normalizeMotorSaat(targetRecord.saat || '');
      var targetMotor = normalizeMotorLabel(targetRecord.motor || motor);
      existingKeys[targetDate + '|' + targetSaat + '|' + targetMotor] = true;
    }

    var sourceLastRow = sourceSheet.getLastRow();
    var sourceRows = sourceLastRow >= 2
      ? sourceSheet.getRange(2, 1, sourceLastRow - 1, 22).getValues()
      : [];
    var sourceDisplayRows = sourceLastRow >= 2
      ? sourceSheet.getRange(2, 1, sourceLastRow - 1, 22).getDisplayValues()
      : [];
    var rowsToCopy = [];
    var recordsToColorize = [];
    var skippedCount = 0;

    for (var j = 0; j < sourceDisplayRows.length; j++) {
      var sourceRecord = mapMotorRow(sourceDisplayRows[j]);
      var sourceDate = normalizeDateTR(sourceRecord.tarih || '');
      var sourceSaat = normalizeMotorSaat(sourceRecord.saat || '');
      var sourceMotor = normalizeMotorLabel(sourceRecord.motor || motor);
      var key = sourceDate + '|' + sourceSaat + '|' + sourceMotor;

      if (!sourceDate || existingKeys[key]) {
        skippedCount++;
        continue;
      }

      var rowToCopy = sourceRows[j].slice(0, 22);
      rowToCopy[0] = sourceDate;
      rowToCopy[2] = sourceSaat;
      rowToCopy[3] = sourceMotor;
      rowsToCopy.push(rowToCopy);
      recordsToColorize.push({ tarih: sourceDate, saat: sourceSaat });
      existingKeys[key] = true;
    }

    if (rowsToCopy.length) {
      var appendStartRow = targetSheet.getLastRow() + 1;
      targetSheet.getRange(appendStartRow, 1, rowsToCopy.length, 22).setValues(rowsToCopy);
      var copiedRange = targetSheet.getRange(appendStartRow, 1, rowsToCopy.length, 22);
      copiedRange.setHorizontalAlignment('center');
      copiedRange.setFontSize(10);
      copiedRange.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
      targetSheet.getRange(appendStartRow, 5, rowsToCopy.length, 15).setNumberFormat('0.00');
      sortMotorSheetRowsByDateTime(targetSheet, motor);
      colorizeDates(targetSheet, recordsToColorize);
    }

    return { success: true, copiedCount: rowsToCopy.length, skippedCount: skippedCount };
  } catch (error) {
    return { success: false, copiedCount: 0, skippedCount: 0, error: error.toString() };
  }
}

function getUniqueSheetName(spreadsheet, baseName) {
  var cleanBaseName = String(baseName || 'Arsiv').substring(0, 90);
  var name = cleanBaseName;
  var index = 1;
  while (spreadsheet.getSheetByName(name)) {
    name = cleanBaseName.substring(0, 85) + ' ' + index;
    index++;
  }
  return name;
}

function getMotorSheetIfExists(motor) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var targetMotor = normalizeMotorLabel(motor);
  var exactSheet = spreadsheet.getSheetByName(getMotorSheetName(targetMotor));
  if (exactSheet) {
    return exactSheet;
  }

  var sheets = spreadsheet.getSheets();
  var bestSheet = null;
  var bestScore = -1;
  var bestRowCount = -1;

  for (var i = 0; i < sheets.length; i++) {
    var currentSheet = sheets[i];
    var sheetName = currentSheet.getName();
    if (!isMotorDataSheetName(sheetName)) {
      continue;
    }

    if (currentSheet.getLastColumn() < 4) {
      continue;
    }

    var score = 0;
    var dataRowCount = Math.max(0, currentSheet.getLastRow() - 1);
    var normalizedSheetMotor = normalizeMotorLabel(sheetName.replace(/^Motor\s+/i, ''));
    if (normalizedSheetMotor === targetMotor) {
      score += 10;
    }

    if (currentSheet.getLastRow() >= 2) {
      var rowCount = Math.min(currentSheet.getLastRow() - 1, 500);
      var motorValues = currentSheet.getRange(2, 4, rowCount, 1).getDisplayValues();
      for (var j = 0; j < motorValues.length; j++) {
        var rawMotor = String(motorValues[j][0] || '').trim();
        if (rawMotor && normalizeMotorLabel(rawMotor) === targetMotor) {
          score++;
        }
      }
    }

    if (score > bestScore || (score === bestScore && dataRowCount > bestRowCount)) {
      bestScore = score;
      bestRowCount = dataRowCount;
      bestSheet = currentSheet;
    }
  }

  if (bestScore > 0) {
    return bestSheet;
  }

  return spreadsheet.getSheetByName(getMotorSheetName(targetMotor));
}

function normalizeMotorDurum(durum) {
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

function mapMotorRow(row) {
  return {
    tarih: row[0],
    vardiya: row[1],
    saat: row[2],
    motor: row[3],
    jenYatakSicaklikDE: row[4],
    jenYatakSicaklikNDE: row[5],
    sogutmaSuyuSicaklik: row[6],
    sogutmaSuyuBasinc: row[7],
    yagSicaklik: row[8],
    yagBasinc: row[9],
    sarjSicaklik: row[10],
    sarjBasinc: row[11],
    gazRegulatoru: row[12],
    makineDairesiSicaklik: row[13],
    karterBasinc: row[14],
    onKamaraFarkBasinc: row[15],
    sargiSicaklik1: row[16],
    sargiSicaklik2: row[17],
    sargiSicaklik3: row[18],
    durum: row[19],
    kaydeden: row[20],
    kayitTarihi: row[21]
  };
}

// 🔥 MOTOR BAZLI SAYFA GETİRME FONKSİYONU
function getOrCreateSheet(motor) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var existingSheet = getMotorSheetIfExists(motor);
  if (existingSheet) {
    return existingSheet;
  }
  
  // Motor bazlı sayfa adı
  var sheetName = getMotorSheetName(motor);
  var sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    
    // Başlık satırını ekle
    var headers = [
      'Tarih', 'Vardiya', 'Saat', 'Motor',
      'JEN. YATAK SIC. (DE)', 'JEN. YATAK SIC. (NDE)',
      'SOĞUTMA SUYU SIC.', 'SOĞUTMA SUYU BAS.',
      'YAĞ SIC.', 'YAĞ BAS.',
      'ŞARJ SIC.', 'ŞARJ BAS.',
      'GAZ REG. (λ)', 'MAKİNE DAİRESİ SIC.',
      'KARTER BAS.', 'ÖN KAMARA FARK BAS.',
      'SARGI SIC. -1-', 'SARGI SIC. -2-', 'SARGI SIC. -3-',
      'Durum', 'Kaydeden', 'Kayıt Tarihi'
    ];
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]).setFontWeight('bold');
    headerRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    
    console.log('📄 Yeni motor sayfası oluşturuldu: ' + sheetName);
    
    // Sütun genişliklerini ayarla
    sheet.setColumnWidth(1, 100);  // Tarih
    sheet.setColumnWidth(2, 80);   // Vardiya
    sheet.setColumnWidth(3, 60);   // Saat
    sheet.setColumnWidth(4, 80);   // Motor
    sheet.setColumnWidth(5, 120);  // JEN. YATAK SIC. (DE)
    sheet.setColumnWidth(6, 120);  // JEN. YATAK SIC. (NDE)
    sheet.setColumnWidth(7, 120);  // SOĞUTMA SUYU SIC.
    sheet.setColumnWidth(8, 120);  // SOĞUTMA SUYU BAS.
    sheet.setColumnWidth(9, 80);   // YAĞ SIC.
    sheet.setColumnWidth(10, 80);  // YAĞ BAS.
    sheet.setColumnWidth(11, 80);  // ŞARJ SIC.
    sheet.setColumnWidth(12, 80);  // ŞARJ BAS.
    sheet.setColumnWidth(13, 100); // GAZ REG. (λ)
    sheet.setColumnWidth(14, 130); // MAKİNE DAİRESİ SIC.
    sheet.setColumnWidth(15, 90);  // KARTER BAS.
    sheet.setColumnWidth(16, 140); // ÖN KAMARA FARK BAS.
    sheet.setColumnWidth(17, 100); // SARGI SIC. -1-
    sheet.setColumnWidth(18, 100); // SARGI SIC. -2-
    sheet.setColumnWidth(19, 100); // SARGI SIC. -3-
    sheet.setColumnWidth(20, 120); // Durum
    sheet.setColumnWidth(21, 100); // Kaydeden
    sheet.setColumnWidth(22, 150); // Kayıt Tarihi
    
    // Sütun formatlarını ayarla
    sheet.getRange(2, 1, 1000, 1).setNumberFormat('@'); // Tarih
    sheet.getRange(2, 2, 1000, 1).setNumberFormat('@'); // Vardiya
    sheet.getRange(2, 3, 1000, 1).setNumberFormat('@'); // Saat
    sheet.getRange(2, 4, 1000, 1).setNumberFormat('@'); // Motor
    sheet.getRange(2, 5, 1000, 15).setNumberFormat('0.00'); // Tüm sayısal değerler
    sheet.getRange(2, 20, 1000, 1).setNumberFormat('@'); // Durum
    sheet.getRange(2, 21, 1000, 1).setNumberFormat('@'); // Kaydeden
    sheet.getRange(2, 22, 1000, 1).setNumberFormat('@'); // Kayıt Tarihi
    
    Logger.log('KojenMotorVerileri sayfası otomatik olarak oluşturuldu.');
  }
  
  return sheet;
}

// Yeni kayıt ekle (Motor Bazlı)
function addRecord(data) {
  try {
    // Motor bilgisinden sayfa adı belirle
    var motor = normalizeMotorLabel(data.motor);
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
    
    // Kayıt zamanı
    var kayitTarihi = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
    
    // Verileri al (Motor çalışmıyor durumu kontrolü)
    var durum = normalizeMotorDurum(data.durum || 'NORMAL');
    var kaydeden = data.kaydeden || 'Admin';
    
    // Eğer motor çalışmıyorsa, tüm değerleri 0 olarak kaydet
    var values;
    if (durum === 'MOTOR ÇALIŞMIYOR') {
      values = [
        formattedTarih, data.vardiya, data.saat, motor,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        durum, kaydeden, kayitTarihi
      ];
    } else {
      values = [
        formattedTarih,
        data.vardiya,
        data.saat,
        motor,
        parseFloat(data.jenYatakSicaklikDE) || 0,
        parseFloat(data.jenYatakSicaklikNDE) || 0,
        parseFloat(data.sogutmaSuyuSicaklik) || 0,
        parseFloat(data.sogutmaSuyuBasinc) || 0,
        parseFloat(data.yagSicaklik) || 0,
        parseFloat(data.yagBasinc) || 0,
        parseFloat(data.sarjSicaklik) || 0,
        parseFloat(data.sarjBasinc) || 0,
        parseFloat(data.gazRegulatoru) || 0,
        parseFloat(data.makineDairesiSicaklik) || 0,
        parseFloat(data.karterBasinc) || 0,
        parseFloat(data.onKamaraFarkBasinc) || 0,
        parseFloat(data.sargiSicaklik1) || 0,
        parseFloat(data.sargiSicaklik2) || 0,
        parseFloat(data.sargiSicaklik3) || 0,
        durum,
        kaydeden,
        kayitTarihi
      ];
    }
    
    // Kayıt ekle
    var insertRow = findInsertPosition(sheet, formattedTarih, data.saat);
    if (insertRow <= sheet.getLastRow()) {
      sheet.insertRowBefore(insertRow);
    }
    sheet.getRange(insertRow, 1, 1, 22).setValues([values]);
    
    // Yeni eklenen satırın formatını ayarla
    var newRow = insertRow;
    var dataRange = sheet.getRange(newRow, 1, 1, 22);
    dataRange.setHorizontalAlignment('center');
    dataRange.setFontSize(10);
    dataRange.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
    
    // Sayısal sütunları ortala
    sheet.getRange(newRow, 5, 1, 15).setNumberFormat('0.00');

    colorizeDates(sheet, [{ tarih: formattedTarih, saat: data.saat, row: newRow }]);
    
    // Motor çalışmıyor durumunda yazıyı kırmızı yap, tarih rengini ezme
    if (durum === 'MOTOR ÇALIŞMIYOR') {
      dataRange.setFontColor('#c62828');
    }
    
    return { success: true, message: motor + ' motoru için kayıt başarıyla eklendi!' };
    
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
    
    // Sadece Motor GM-* sayfalarını işle
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var sheetName = sheet.getName();
      
      // Sadece motor sayfalarını işle
      if (!sheetName.startsWith('Motor GM-')) {
        continue;
      }
      
      console.log('📊 Motor sayfası okunuyor: ' + sheetName);
      
      if (sheet.getLastRow() < 2) {
        continue;
      }
      
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 22).getDisplayValues();
      
      for (var j = data.length - 1; j >= 0; j--) {
        var row = data[j];
        
        records.push(mapMotorRow(row));
      }
    }
    
    console.log('📊 Toplam ' + records.length + ' motor kaydı okundu');
    return { success: true, data: records };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getMotorSheetReport() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = spreadsheet.getSheets();
    var report = [];

    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var sheetName = sheet.getName();
      if (!isMotorDataSheetName(sheetName)) {
        continue;
      }

      var lastRow = sheet.getLastRow();
      var lastColumn = sheet.getLastColumn();
      var sampleMotor = '';
      var firstDate = '';
      var lastDate = '';
      var lastSaat = '';

      if (lastRow >= 2 && lastColumn >= 4) {
        sampleMotor = sheet.getRange(2, 4).getDisplayValue();
        firstDate = sheet.getRange(2, 1).getDisplayValue();
        lastDate = sheet.getRange(lastRow, 1).getDisplayValue();
        lastSaat = sheet.getRange(lastRow, 3).getDisplayValue();
      }

      report.push({
        sheetName: sheetName,
        canonicalMotor: getCanonicalMotorFromSheet(sheet),
        lastRow: lastRow,
        dataRowCount: Math.max(0, lastRow - 1),
        lastColumn: lastColumn,
        sampleMotor: sampleMotor,
        firstDate: firstDate,
        lastDate: lastDate,
        lastSaat: lastSaat
      });
    }

    return {
      success: true,
      spreadsheetName: spreadsheet.getName(),
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      checkedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
      sheets: report
    };
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
function getRecordsByMotorAndDate(motor, tarih, vardiya) {
  try {
    var sheet = getMotorSheetIfExists(motor);
    if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };

    var searchTarih = normalizeDateTR(tarih);
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 22).getDisplayValues();
    var filtered = [];

    for (var i = data.length - 1; i >= 0; i--) {
      var record = mapMotorRow(data[i]);
      var matchTarih = record.tarih === searchTarih;
      var matchVardiya = true;

      if (vardiya) {
        var saat = record.saat || '';
        var hour = parseInt(saat.split(':')[0]) || 0;
        if (vardiya === '08-16') {
          matchVardiya = (hour >= 8 && hour < 16);
        } else if (vardiya === '16-24') {
          matchVardiya = (hour >= 16 && hour < 24);
        } else if (vardiya === '24-08') {
          matchVardiya = (hour >= 0 && hour < 8);
        }
      }

      if (matchTarih && matchVardiya) filtered.push(record);
    }
    
    return { success: true, data: filtered };
    
  } catch (error) {
    Logger.log('Hata: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Kayıt var mı kontrol et
function checkExistingRecord(motor, tarih, saat) {
  try {
    var sheet = getMotorSheetIfExists(motor);
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, exists: false, record: null };
    }

    var searchTarih = normalizeDateTR(tarih);
    var searchMotor = normalizeMotorLabel(motor);
    var searchSaat = String(saat || '').trim();
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 22).getDisplayValues();
    var existing = null;

    for (var i = 0; i < data.length; i++) {
      var record = mapMotorRow(data[i]);
      var recMotor = normalizeMotorLabel(record.motor);
      var recTarih = String(record.tarih || '').trim();
      var recSaat = String(record.saat || '').trim();

      if (recMotor === searchMotor && recTarih === searchTarih && recSaat === searchSaat) {
        existing = record;
        break;
      }
    }
    
    return { 
      success: true, 
      exists: !!existing,
      record: existing || null
    };
    
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

      var motor = normalizeMotorLabel(parts[0]);
      var tarih = parts[1].trim();
      var saat = parts[2].trim();
      var searchTarih = normalizeDateTR(tarih);
      var key = motor + '|' + tarih + '|' + saat;

      if (!recordsByMotor[motor]) {
        var sheet = getMotorSheetIfExists(motor);
        recordsByMotor[motor] = !sheet || sheet.getLastRow() < 2
          ? []
          : sheet.getRange(2, 1, sheet.getLastRow() - 1, 22).getDisplayValues().map(mapMotorRow);
      }

      var existing = recordsByMotor[motor].find(function(record) {
        var recMotor = normalizeMotorLabel(record.motor);
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
    console.error('Toplu motor kayıt kontrolü hatası: ' + error.toString());
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
      if (!sheet.getName().startsWith('Motor GM-')) continue;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;

      total += lastRow - 1;
      var rowCount = Math.min(perSheetCount, lastRow - 1);
      var startRow = Math.max(2, lastRow - rowCount + 1);
      var rows = sheet.getRange(startRow, 1, rowCount, 22).getDisplayValues();
      for (var j = 0; j < rows.length; j++) {
        records.push(mapMotorRow(rows[j]));
      }
    }

    records.sort(function(a, b) {
      return parseRecordDateTime(b.tarih, b.saat) - parseRecordDateTime(a.tarih, a.saat);
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

// Çoklu kayıt ekleme
function parseMotorNumber(value) {
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

function findInsertPosition(sheet, tarih, saat) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return 2;
  }

  var targetTime = parseRecordDateTime(tarih, saat).getTime();
  var data = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();

  for (var i = 0; i < data.length; i++) {
    var rowTime = parseRecordDateTime(data[i][0], data[i][2]).getTime();
    if (rowTime > targetTime) {
      return i + 2;
    }
  }

  return lastRow + 1;
}

function parseRecordDateTime(tarih, saat) {
  if (Object.prototype.toString.call(tarih) === '[object Date]' && !isNaN(tarih.getTime())) {
    var dateHourParts = String(saat || '00:00').split(':');
    return new Date(
      tarih.getFullYear(),
      tarih.getMonth(),
      tarih.getDate(),
      parseInt(dateHourParts[0] || '0', 10),
      parseInt(dateHourParts[1] || '0', 10)
    );
  }

  var text = String(tarih || '');
  var parts;
  if (text.indexOf('-') !== -1) {
    parts = text.split('-').reverse();
  } else if (text.indexOf('/') !== -1) {
    var slashParts = text.split('/');
    parts = slashParts[0].length === 4
      ? [slashParts[2], slashParts[1], slashParts[0]]
      : [slashParts[1], slashParts[0], slashParts[2]];
  } else {
    parts = text.split('.');
  }
  var hourParts = String(saat || '00:00').split(':');
  return new Date(
    parseInt(parts[2], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[0], 10),
    parseInt(hourParts[0] || '0', 10),
    parseInt(hourParts[1] || '0', 10)
  );
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
        var motor = normalizeMotorLabel(record.motor);
        var sheet = getOrCreateSheet(motor);
        motorSheets[motor] = sheet;
        
        // Tarih formatını kontrol et (Türkçe formatında tut)
        var tarih = record.tarih;
        // Gelen tarih zaten dd.MM.yyyy formatında olduğu gibi kullan
        
        // Satır verilerini hazırla (Excel sütunlarına göre)
        var rowData = [
          tarih || '',                                     // Tarih (2026-05-11)
          record.vardiya || '',                            // Vardiya (08-16)
          record.saat || '',                               // Saat (08:00)
          motor || '',                                     // Motor (GM-1)
          parseMotorNumber(record.jenYatakSicaklikDE),     // JEN. YATAK SIC. (DE)
          parseMotorNumber(record.jenYatakSicaklikNDE),    // JEN. YATAK SIC. (NDE)
          record.sogutmaSoyuSicaklik || '0',               // SOĞUTMA SUYU SIC.
          record.sogutmaSoyuBasinc || '0',                 // SOĞUTMA SUYU BAS.
          record.yagSicaklik || '0',                       // YAĞ SIC.
          record.yagBasinc || '0',                         // YAĞ BAS.
          record.sarjSicaklik || '0',                      // ŞARJ SIC.
          record.sarjBasinc || '0',                        // ŞARJ BAS.
          record.gazRegulator || '0',                      // GAZ REG. (λ)
          record.makineDairesiSicaklik || '0',             // MAKİNE DAİRESİ SIC.
          record.karterBasinc || '0',                      // KARTER BAS.
          record.onKamaraFarkBasinc || '0',                 // ÖN KAMARA FARK BAS.
          record.sargiSicaklik1 || '0',                    // SARGI SIC. -1-
          record.sargiSicaklik2 || '0',                    // SARGI SIC. -2-
          record.sargiSicaklik3 || '0',                    // SARGI SIC. -3-
          record.not || 'Motor çalışmıyor',               // Durum
          record.kullanici || '',                          // Kaydeden
          new Date().toLocaleString('tr-TR')               // Kayıt Tarihi
        ];
        rowData[6] = parseMotorNumber(record.sogutmaSuyuSicaklik);
        rowData[7] = parseMotorNumber(record.sogutmaSuyuBasinc);
        rowData[8] = parseMotorNumber(record.yagSicaklik);
        rowData[9] = parseMotorNumber(record.yagBasinc);
        rowData[10] = parseMotorNumber(record.sarjSicaklik);
        rowData[11] = parseMotorNumber(record.sarjBasinc);
        rowData[12] = parseMotorNumber(record.gazRegulatoru);
        rowData[13] = parseMotorNumber(record.makineDairesiSicaklik);
        rowData[14] = parseMotorNumber(record.karterBasinc);
        rowData[15] = parseMotorNumber(record.onKamaraFarkBasinc);
        rowData[16] = parseMotorNumber(record.sargiSicaklik1);
        rowData[17] = parseMotorNumber(record.sargiSicaklik2);
        rowData[18] = parseMotorNumber(record.sargiSicaklik3);
        rowData[19] = normalizeMotorDurum(record.durum || 'MOTOR ÇALIŞMIYOR');
        
        // Satırı ekle
        var newRow = findInsertPosition(sheet, tarih, record.saat);
        if (newRow <= sheet.getLastRow()) {
          sheet.insertRowBefore(newRow);
        }
        sheet.getRange(newRow, 1, 1, 22).setValues([rowData]);
        var dataRange = sheet.getRange(newRow, 1, 1, 22);
        dataRange.setHorizontalAlignment('center');
        dataRange.setFontSize(10);
        dataRange.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
        sheet.getRange(newRow, 5, 1, 15).setNumberFormat('0.00');
        if (rowData[19] === 'MOTOR ÇALIŞMIYOR') {
          dataRange.setFontColor('#c62828');
        }
        addedRecords.push({
          motor: motor,
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
    
    console.log('📊 Çoklu kayıt sonucu: ' + addedRecords.length + ' eklendi, ' + errors.length + ' hata');
    
    // Tarih rengini en son uygula; durum yazı rengi korunur.
    for (var motorName in motorSheets) {
      var motorRecords = addedRecords.filter(function(r) { return r.motor === motorName; });
      colorizeDates(motorSheets[motorName], motorRecords);
    }
    
    return {
      success: true,
      addedCount: addedRecords.length,
      totalCount: records.length,
      addedRecords: addedRecords,
      errors: errors
    };
    
  } catch (error) {
    console.error('Çoklu kayıt ekleme hatası: ' + error.toString());
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
    var sentKey = 'kojenMotorHourlyCheck:' + tarih + ':' + saat;
    var props = PropertiesService.getScriptProperties();

    if (props.getProperty(sentKey)) {
      return { success: true, skipped: true, message: 'Bu saat daha once kontrol edildi' };
    }

    var motors = ['GM-1', 'GM-2', 'GM-3'];
    var missing = [];
    var existingErrors = [];
    for (var i = 0; i < motors.length; i++) {
      var exists = checkExistingRecord(motors[i], tarih, saat);
      if (!exists.success || !exists.exists) {
        missing.push(motors[i]);
        if (!exists.success) {
          existingErrors.push(motors[i] + ': ' + exists.error);
        }
      }
    }

    if (missing.length === 0) {
      props.setProperty(sentKey, new Date().toISOString());
      addSystemLog({
        tarih: tarih,
        saat: saat,
        modul: 'Kojen Motor',
        eksikKayit: 'Yok',
        otomatikKayitSonucu: 'Gerekmedi',
        mailSonucu: 'Gonderilmedi',
        detay: 'Eksik motor kaydi yok'
      });
      return { success: true, missingCount: 0, addedCount: 0, message: 'Eksik motor kaydi yok' };
    }

    var added = [];
    var errors = [];
    var addedRecords = [];
    var sheetsByMotor = {};
    for (var j = 0; j < missing.length; j++) {
      var motor = missing[j];
      var autoData = {
        tarih: tarih,
        vardiya: vardiya,
        saat: saat,
        motor: motor,
        kaydeden: 'OTOMATIK SISTEM',
        durum: 'MOTOR ÇALIŞMIYOR'
      };
      var addResult = addRecord(autoData);
      if (addResult.success) {
        added.push(motor);
        addedRecords.push({ motor: motor, tarih: tarih, saat: saat });
        sheetsByMotor[motor] = getMotorSheetIfExists(motor);
      } else {
        errors.push(motor + ': ' + addResult.error);
      }
    }

    for (var sheetMotor in sheetsByMotor) {
      if (!sheetsByMotor[sheetMotor]) continue;
      colorizeDates(sheetsByMotor[sheetMotor], addedRecords.filter(function(record) {
        return record.motor === sheetMotor;
      }));
    }

    var subject = 'Kojen Motor Veri Uyarisi - ' + tarih + ' ' + saat + ' Kayit Girilmedi';
    var body = 'Kojen Motor Veri Uyarisi\n\n' +
      'Tarih: ' + tarih + '\n' +
      'Saat: ' + saat + '\n' +
      'Vardiya: ' + vardiya + '\n\n' +
      'Eksik motor kayitlari: ' + missing.join(', ') + '\n' +
      'Otomatik bos kayit eklenenler: ' + (added.length ? added.join(', ') : '-') + '\n' +
      (existingErrors.length ? 'Kontrol hatalari: ' + existingErrors.join('; ') + '\n' : '') +
      (errors.length ? 'Kayit hatalari: ' + errors.join('; ') + '\n' : '') +
      '\nBu saat icin veri girilmedigi icin sistem otomatik bos kayit olusturdu.';

    var mailResult = sendEmailAlert({ subject: subject, body: body });
    if (added.length === missing.length) {
      props.setProperty(sentKey, new Date().toISOString());
    }
    addSystemLog({
      tarih: tarih,
      saat: saat,
      modul: 'Kojen Motor',
      eksikKayit: missing.join(', '),
      otomatikKayitSonucu: added.length + '/' + missing.length + ' basarili',
      mailSonucu: mailResult.success ? 'Basarili' : 'Basarisiz',
      hataMesaji: existingErrors.concat(errors).concat(mailResult.success ? [] : [mailResult.error]).join('; '),
      detay: 'Otomatik motor calismiyor kaydi'
    });

    return {
      success: true,
      missingCount: missing.length,
      addedCount: added.length,
      missing: missing,
      added: added,
      errors: existingErrors.concat(errors),
      mail: mailResult
    };
  } catch (error) {
    addSystemLog({
      modul: 'Kojen Motor',
      otomatikKayitSonucu: 'Hata',
      mailSonucu: 'Bilinmiyor',
      hataMesaji: error.toString(),
      detay: 'checkHourlyMissingRecords'
    });
    return { success: false, error: error.toString() };
  }
}

function fillMissingFullDay(tarih, motor, startSaat, endSaat) {
  try {
    var targetTarih = normalizeDateTR(tarih || '');
    var motors = motor ? [normalizeMotorLabel(motor)] : ['GM-1', 'GM-2', 'GM-3'];
    var startHour = startSaat ? parseInt(normalizeMotorSaat(startSaat).split(':')[0], 10) : 0;
    var endHour = endSaat ? parseInt(normalizeMotorSaat(endSaat).split(':')[0], 10) : 23;

    if (isNaN(startHour) || isNaN(endHour) || startHour < 0 || endHour > 23 || endHour < startHour) {
      return { success: false, error: 'Saat araligi hatali. Ornek: 00:00 - 23:00' };
    }

    var dates = [];
    if (targetTarih) {
      dates.push(targetTarih);
    } else {
      var dateMap = {};
      for (var scanMotorIndex = 0; scanMotorIndex < motors.length; scanMotorIndex++) {
        var scanSheet = getMotorSheetIfExists(motors[scanMotorIndex]);
        if (!scanSheet || scanSheet.getLastRow() < 2) continue;

        var scanDates = scanSheet.getRange(2, 1, scanSheet.getLastRow() - 1, 1).getDisplayValues();
        for (var scanRow = 0; scanRow < scanDates.length; scanRow++) {
          var recordDate = normalizeDateTR(scanDates[scanRow][0] || '');
          if (recordDate) dateMap[recordDate] = true;
        }
      }
      dates = Object.keys(dateMap).sort(function(a, b) {
        return parseRecordDateTime(a, '00:00') - parseRecordDateTime(b, '00:00');
      });
    }

    if (!dates.length) {
      return { success: false, error: 'Taranacak tarih bulunamadi.' };
    }

    var totalAdded = 0;
    var totalColored = 0;
    var allErrors = [];
    var motorResults = [];
    var perDate = dates.map(function(currentDate) {
      return {
        tarih: currentDate,
        motors: []
      };
    });
    var perDateByDate = {};
    for (var d = 0; d < perDate.length; d++) {
      perDateByDate[perDate[d].tarih] = perDate[d];
    }

    for (var m = 0; m < motors.length; m++) {
      var currentMotor = motors[m];
      var sheet = getMotorSheetIfExists(currentMotor);
      if (!sheet) {
        var sheetError = currentMotor + ' icin mevcut motor sayfasi bulunamadi. Yeni sayfa olusturulmadi.';
        for (var missingSheetDateIndex = 0; missingSheetDateIndex < dates.length; missingSheetDateIndex++) {
          var missingSheetDate = dates[missingSheetDateIndex];
          allErrors.push(missingSheetDate + ' ' + currentMotor + ': ' + sheetError);
          perDateByDate[missingSheetDate].motors.push({
            motor: currentMotor,
            addedCount: 0,
            addedHours: [],
            skippedCount: 0,
            skippedHours: [],
            errors: [sheetError]
          });
        }
        motorResults.push({
          motor: currentMotor,
          success: false,
          error: sheetError,
          addedCount: 0,
          coloredCount: 0,
          rowCount: 0
        });
        continue;
      }

      var lastRow = sheet.getLastRow();
      var rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 22).getDisplayValues() : [];
      var existingByDateHour = {};

      for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        var existingRecord = mapMotorRow(rows[rowIndex]);
        var existingDate = normalizeDateTR(existingRecord.tarih || '');
        var existingHour = normalizeMotorSaat(existingRecord.saat || '');
        if (existingDate && existingHour) {
          existingByDateHour[existingDate + '|' + existingHour] = true;
        }
      }

      var rowsToAdd = [];
      var recordsToColorize = [];
      var colorResult = { success: true, coloredCount: 0 };

      for (var dateIndex = 0; dateIndex < dates.length; dateIndex++) {
        var currentDate = dates[dateIndex];
        var addedHours = [];
        var skippedHours = [];

        for (var hour = startHour; hour <= endHour; hour++) {
          var saat = pad2(hour) + ':00';
          if (existingByDateHour[currentDate + '|' + saat]) {
            skippedHours.push(saat);
            continue;
          }

          rowsToAdd.push([
            currentDate,
            getVardiyaByHour(hour),
            saat,
            currentMotor,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            normalizeMotorDurum('MOTOR CALISMIYOR'),
            'OTOMATIK SISTEM',
            Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss')
          ]);

          existingByDateHour[currentDate + '|' + saat] = true;
          addedHours.push(saat);
          recordsToColorize.push({
            tarih: currentDate,
            saat: saat
          });
          totalAdded++;
        }

        perDateByDate[currentDate].motors.push({
          motor: currentMotor,
          addedCount: addedHours.length,
          addedHours: addedHours,
          skippedCount: skippedHours.length,
          skippedHours: skippedHours,
          errors: []
        });
      }

      if (rowsToAdd.length) {
        var appendStartRow = sheet.getLastRow() + 1;
        sheet.getRange(appendStartRow, 1, rowsToAdd.length, 22).setValues(rowsToAdd);
        var addedRange = sheet.getRange(appendStartRow, 1, rowsToAdd.length, 22);
        addedRange.setHorizontalAlignment('center');
        addedRange.setFontSize(10);
        addedRange.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
        addedRange.setFontColor('#c62828');
        sheet.getRange(appendStartRow, 5, rowsToAdd.length, 15).setNumberFormat('0.00');
        sortMotorSheetRowsByDateTime(sheet, currentMotor);
        colorResult = colorizeDates(sheet, recordsToColorize);
        totalColored += colorResult.coloredCount || 0;
      }

      var finalRowCount = Math.max(0, sheet.getLastRow() - 1);
      console.log(
        'Motor eksik doldurma: ' + currentMotor +
        ', eklenen ' + rowsToAdd.length +
        ', renklendirilen ' + (colorResult.coloredCount || 0) +
        ', sayfa satiri ' + finalRowCount
      );
      motorResults.push({
        motor: currentMotor,
        success: colorResult.success !== false,
        sheetName: sheet.getName(),
        addedCount: rowsToAdd.length,
        coloredCount: colorResult.coloredCount || 0,
        rowCount: finalRowCount,
        error: colorResult.error || ''
      });
    }

    addSystemLog({
      tarih: targetTarih || dates[0],
      modul: 'Kojen Motor',
      eksikKayit: totalAdded ? ('Toplam ' + totalAdded + ' saat dolduruldu') : 'Yok',
      otomatikKayitSonucu: totalAdded ? 'Tum gun eksik saat doldurma' : 'Gerekmedi',
      mailSonucu: 'Gonderilmedi',
      hataMesaji: allErrors.join('; '),
      detay: targetTarih ? 'Tek tarih icin kojen motor eksikleri dolduruldu' : 'Tum tarihler icin kojen motor eksikleri dolduruldu'
    });

    return {
      success: true,
      scannedDateCount: dates.length,
      totalAddedCount: totalAdded,
      totalColoredCount: totalColored,
      motors: motorResults,
      dates: perDate,
      errors: allErrors
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function sortMotorSheet(motor) {
  try {
    var motors = motor ? [normalizeMotorLabel(motor)] : ['GM-1', 'GM-2', 'GM-3'];
    var results = [];

    for (var i = 0; i < motors.length; i++) {
      var currentMotor = motors[i];
      var sheet = getMotorSheetIfExists(currentMotor);
      if (!sheet) {
        results.push({
          motor: currentMotor,
          success: false,
          error: 'Mevcut motor sayfasi bulunamadi'
        });
        continue;
      }

      results.push(sortMotorSheetRowsByDateTime(sheet, currentMotor));
    }

    return { success: true, results: results };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function colorizeMotorSheet(motor) {
  try {
    var motors = motor ? [normalizeMotorLabel(motor)] : ['GM-1', 'GM-2', 'GM-3'];
    var results = [];

    for (var i = 0; i < motors.length; i++) {
      var currentMotor = motors[i];
      var sheet = getMotorSheetIfExists(currentMotor);
      if (!sheet) {
        results.push({
          motor: currentMotor,
          success: false,
          error: 'Mevcut motor sayfasi bulunamadi'
        });
        continue;
      }

      var records = [];
      var lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        var rows = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          records.push({
            row: rowIndex + 2,
            tarih: rows[rowIndex][0],
            saat: rows[rowIndex][2]
          });
        }
      }

      var colorResult = colorizeDates(sheet, records);
      results.push({
        success: colorResult.success !== false,
        motor: currentMotor,
        sheetName: sheet.getName(),
        rowCount: Math.max(0, lastRow - 1),
        coloredCount: colorResult.coloredCount || 0,
        error: colorResult.error || ''
      });
    }

    return { success: true, results: results };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function sortMotorSheetRowsByDateTime(sheet, motor) {
  try {
    if (!sheet || sheet.getLastRow() < 3) {
      return {
        success: true,
        sheetName: sheet ? sheet.getName() : '',
        rowCount: 0,
        skipped: true
      };
    }

    var rowCount = sheet.getLastRow() - 1;
    var range = sheet.getRange(2, 1, rowCount, 22);
    var values = range.getValues();
    var displayValues = range.getDisplayValues();
    var backgrounds = range.getBackgrounds();
    var fontColors = range.getFontColors();
    var rows = [];

    for (var i = 0; i < values.length; i++) {
      rows.push({
        values: values[i],
        backgrounds: backgrounds[i],
        fontColors: fontColors[i],
        timestamp: parseRecordDateTime(displayValues[i][0] || values[i][0], displayValues[i][2] || values[i][2]).getTime(),
        originalIndex: i
      });
    }

    rows.sort(function(a, b) {
      var aTime = isNaN(a.timestamp) ? Number.MAX_SAFE_INTEGER : a.timestamp;
      var bTime = isNaN(b.timestamp) ? Number.MAX_SAFE_INTEGER : b.timestamp;
      if (aTime !== bTime) return aTime - bTime;
      return a.originalIndex - b.originalIndex;
    });

    var sortedValues = [];
    var sortedBackgrounds = [];
    var sortedFontColors = [];
    for (var j = 0; j < rows.length; j++) {
      sortedValues.push(rows[j].values);
      sortedBackgrounds.push(rows[j].backgrounds);
      sortedFontColors.push(rows[j].fontColors);
    }

    range.setValues(sortedValues);
    range.setBackgrounds(sortedBackgrounds);
    range.setFontColors(sortedFontColors);
    range.setHorizontalAlignment('center');
    sheet.getRange(2, 5, rowCount, 15).setNumberFormat('0.00');

    return {
      success: true,
      motor: motor || '',
      sheetName: sheet.getName(),
      rowCount: rowCount
    };
  } catch (error) {
    return {
      success: false,
      sheetName: sheet ? sheet.getName() : '',
      error: error.toString()
    };
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
      data.modul || data.module || 'Kojen Motor',
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

  return { success: true, message: 'Motor saatlik eksik kayit tetikleyicisi kuruldu' };
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

function pad2(value) {
  return String(value).padStart(2, '0');
}

function colorizeDates(sheet, addedRecords) {
  try {
    if (!sheet || !addedRecords || !addedRecords.length) {
      return { success: true, coloredCount: 0, dateCount: 0 };
    }

    var dateGroups = {};
    var rowTargets = {};
    var keyTargets = {};

    for (var i = 0; i < addedRecords.length; i++) {
      var record = addedRecords[i] || {};
      var tarih = normalizeDateTR(record.tarih || '');
      var saat = normalizeMotorSaat(record.saat || '');
      if (!tarih) continue;

      dateGroups[tarih] = true;
      if (record.row) {
        rowTargets[String(record.row)] = tarih;
      }
      if (saat) {
        keyTargets[tarih + '|' + saat] = tarih;
      }
    }

    var coloredCount = 0;
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var rowCount = lastRow - 1;
      var displayRows = sheet.getRange(2, 1, rowCount, 3).getDisplayValues();
      var backgrounds = sheet.getRange(2, 1, rowCount, 22).getBackgrounds();

      for (var rowIndex = 0; rowIndex < displayRows.length; rowIndex++) {
        var sheetRow = rowIndex + 2;
        var rowDate = normalizeDateTR(displayRows[rowIndex][0] || '');
        var rowSaat = normalizeMotorSaat(displayRows[rowIndex][2] || '');
        var targetDate = rowTargets[String(sheetRow)] || keyTargets[rowDate + '|' + rowSaat] || '';
        if (!targetDate) continue;

        var color = getDateColor(targetDate);
        for (var col = 0; col < 22; col++) {
          backgrounds[rowIndex][col] = color;
        }
        coloredCount++;
      }

      sheet.getRange(2, 1, rowCount, 22).setBackgrounds(backgrounds);
    }

    console.log('Motor tarih renklendirme: ' + coloredCount + ' satir, ' + Object.keys(dateGroups).length + ' tarih');
    return { success: true, coloredCount: coloredCount, dateCount: Object.keys(dateGroups).length };
  } catch (error) {
    console.error('Motor renklendirme hatası: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

function normalizeMotorSaat(value) {
  var text = String(value || '').trim();
  if (!text) return '00:00';
  var parts = text.split(':');
  var hour = parseInt(parts[0] || '0', 10);
  var minute = parseInt(parts[1] || '0', 10);
  return pad2(isNaN(hour) ? 0 : hour) + ':' + pad2(isNaN(minute) ? 0 : minute);
}

function getDateColor(tarih) {
  var colors = [
    '#e8f4ff', '#eaf7ea', '#fff4d6', '#f3e8ff', '#ffe8ef',
    '#e7f7f7', '#f7efe7', '#eef2ff', '#f2f7e7', '#fff0e6'
  ];
  var text = normalizeDateTR(tarih || '');
  var hash = 0;
  for (var i = 0; i < text.length; i++) {
    hash = ((hash * 31) + text.charCodeAt(i)) % colors.length;
  }
  return colors[Math.abs(hash) % colors.length];
}

// Geriye dönük uyumluluk için bırakıldı
function getRandomColor() {
  return getDateColor(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy'));
}

// Mail gönderme fonksiyonu
function sendEmailAlert(data) {
  try {
    if (!data) {
      return { success: false, error: 'Veri parametresi eksik' };
    }

    var to = data.to || 'mrtcsk0320@gmail.com';
    var subject = data.subject || 'Kojen Motor Veri Uyarısı';
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
