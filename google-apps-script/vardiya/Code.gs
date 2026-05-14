/**
 * VARDIYA TAKIP - Google Apps Script Kodu
 * Bu dosya Google Sheets > Extensions > Apps Script'e yapıştırılacak
 * 
 * Özellikler:
 * - Otomatik sayfa ve tablo oluşturma
 * - TR tarih formatı (dd.MM.yyyy)
 * - Vardiya bazlı kayıt (08-16, 16-24, 24-08)
 * - Personel ve operatör takibi
 * - Yardımcı operatör desteği
 */

// CORS ayarları
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
      case 'updateRecord':
        result = updateRecord(e.parameter);
        break;
      case 'getRecords':
        result = getRecords();
        break;
      case 'getLastRecords':
        result = getLastRecords(parseInt(e.parameter.count) || 32);
        break;
      case 'getLastRecordsWithIslemler':
        result = getLastRecordsWithIslemler(parseInt(e.parameter.count) || 32);
        break;
      case 'getRecordByDateVardiya':
        result = getRecordByDateVardiya(e.parameter.tarih, e.parameter.vardiya);
        break;
      case 'endVardiya':
        result = endVardiya(e.parameter);
        break;
      case 'addIslem':
        result = addIslem(e.parameter);
        break;
      case 'getIslemlerByVardiyaId':
        result = getIslemlerByVardiyaId(e.parameter.vardiyaId);
        break;
      default:
        result = { success: false, error: 'Geçersiz işlem' };
    }
    
    lock.releaseLock();
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    lock.releaseLock();
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Yeni vardiya kaydı ekle
function addRecord(data) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName('VardiyaTakip');
    
    // Sayfa yoksa otomatik oluştur
    if (!sheet) {
      sheet = spreadsheet.insertSheet('VardiyaTakip');
      
      // Başlıklar (10 sütun)
      var headers = [
        'ID', 'Tarih', 'Vardiya', 'Personel', 'Operatör',
        'Yardımcı Operatör', 'Başlangıç Saati', 'Bitiş Saati',
        'Durum', 'Kayıt Tarihi'
      ];
      
      sheet.appendRow(headers);
      
      // Başlık formatı
      var headerRange = sheet.getRange(1, 1, 1, 10);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#9b59b6');
      headerRange.setFontColor('#ffffff');
      headerRange.setHorizontalAlignment('center');
      
      // Sütun genişlikleri
      sheet.setColumnWidth(1, 60);    // ID
      sheet.setColumnWidth(2, 100);   // Tarih
      sheet.setColumnWidth(3, 100);   // Vardiya
      sheet.setColumnWidth(4, 150);   // Personel
      sheet.setColumnWidth(5, 150);   // Operatör
      sheet.setColumnWidth(6, 150);   // Yardımcı Operatör
      sheet.setColumnWidth(7, 130);   // Başlangıç Saati
      sheet.setColumnWidth(8, 130);   // Bitiş Saati
      sheet.setColumnWidth(9, 100);   // Durum
      sheet.setColumnWidth(10, 140);  // Kayıt Tarihi
      
      // Kenarlıklar
      headerRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
      
      // Sütun formatları
      sheet.getRange(2, 1, 1000, 1).setNumberFormat('@');   // ID
      sheet.getRange(2, 2, 1000, 1).setNumberFormat('@');   // Tarih metin
      sheet.getRange(2, 3, 1000, 7).setNumberFormat('@');  // Diğer metin sütunları
      
      Logger.log('VardiyaTakip sayfası otomatik olarak oluşturuldu.');
    }
    
    // Aynı tarih ve vardiya için aktif kayıt var mı kontrol et
    var lastRow = sheet.getLastRow();
    var nextID = 1;
    
    if (lastRow > 1) {
      var dates = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
      var vardiyas = sheet.getRange(2, 3, lastRow - 1, 1).getDisplayValues();
      var statuses = sheet.getRange(2, 9, lastRow - 1, 1).getDisplayValues();
      var inputTarih = formatDateTR(data.tarih);
      var inputVardiya = data.vardiya;
      
      for (var i = 0; i < dates.length; i++) {
        if (dates[i][0] === inputTarih && vardiyas[i][0] === inputVardiya && statuses[i][0] === 'Aktif') {
          return { success: false, error: 'Bu tarih ve vardiya için aktif kayıt zaten var!' };
        }
      }
      
      // Son ID'yi bul
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      var maxID = 0;
      for (var j = 0; j < ids.length; j++) {
        var idNum = parseInt(ids[j][0]) || 0;
        if (idNum > maxID) maxID = idNum;
      }
      nextID = maxID + 1;
    }
    
    // Kayıt ekle
    var kayitTarihi = formatDateTimeTR(new Date());
    var baslangicSaati = formatTimeTR(new Date());
    var formattedTarih = formatDateTR(data.tarih);
    
    sheet.appendRow([
      nextID.toString(),
      formattedTarih,
      data.vardiya,
      data.personel || '',
      data.operator || '',
      data.yardimciOperator || '',
      baslangicSaati,
      '',  // Bitiş Saati (boş)
      'Aktif',
      kayitTarihi
    ]);
    
    // Yeni satır formatı
    var newRow = sheet.getLastRow();
    sheet.getRange(newRow, 1, 1, 10).setHorizontalAlignment('center');
    sheet.getRange(newRow, 1, 1, 10).setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
    
    return { 
      success: true, 
      message: 'Vardiya başarıyla başlatıldı! (ID: ' + nextID + ')',
      data: {
        id: nextID.toString(),
        baslangicSaati: baslangicSaati
      }
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Vardiya bitir
function endVardiya(data) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName('VardiyaTakip');
    
    if (!sheet) {
      return { success: false, error: 'Sayfa bulunamadı!' };
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, error: 'Kayıt bulunamadı!' };
    }
    
    // Tarih ve vardiyaya göre aktif kaydı bul
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    var dates = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
    var vardiyas = sheet.getRange(2, 3, lastRow - 1, 1).getDisplayValues();
    var statuses = sheet.getRange(2, 9, lastRow - 1, 1).getDisplayValues();
    var targetId = data.id || '';
    var targetTarih = formatDateTR(data.tarih);
    var targetVardiya = data.vardiya;
    var foundRow = -1;
    var recordID = '';
    
    for (var i = 0; i < dates.length; i++) {
      var idMatches = targetId && ids[i][0] === targetId;
      var dateShiftMatches = dates[i][0] === targetTarih && vardiyas[i][0] === targetVardiya;
      if ((idMatches || dateShiftMatches) && isActiveStatus(statuses[i][0])) {
        foundRow = i + 2;
        break;
      }
    }
    
    if (foundRow === -1) {
      return { success: false, error: 'Aktif vardiya kaydı bulunamadı!' };
    }
    
    // ID'yi al
    recordID = sheet.getRange(foundRow, 1).getDisplayValue();
    
    // Bitiş saati ve durumu güncelle
    var bitisSaati = formatTimeTR(new Date());
    sheet.getRange(foundRow, 8).setValue(bitisSaati);
    sheet.getRange(foundRow, 9).setValue('Tamamlandı');
    sheet.getRange(foundRow, 10).setValue(formatDateTimeTR(new Date()));
    
    Logger.log('Vardiya sonlandırıldı - Satır ' + foundRow + ' (ID: ' + recordID + ')');
    
    return { 
      success: true, 
      message: 'Vardiya başarıyla sonlandırıldı! (ID: ' + recordID + ')',
      data: {
        id: recordID,
        bitisSaati: bitisSaati
      }
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Kayıt güncelle
function updateRecord(data) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName('VardiyaTakip');
    
    if (!sheet) {
      return { success: false, error: 'Sayfa bulunamadı!' };
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, error: 'Kayıt bulunamadı!' };
    }
    
    // ID'ye göre kaydı bul
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    var targetID = data.id;
    var foundRow = -1;
    
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === targetID) {
        foundRow = i + 2;
        break;
      }
    }
    
    if (foundRow === -1) {
      return { success: false, error: 'Kayıt bulunamadı!' };
    }
    
    // Verileri güncelle
    if (data.personel) sheet.getRange(foundRow, 4).setValue(data.personel);
    if (data.operator) sheet.getRange(foundRow, 5).setValue(data.operator);
    if (data.yardimciOperator) sheet.getRange(foundRow, 6).setValue(data.yardimciOperator);
    sheet.getRange(foundRow, 10).setValue(formatDateTimeTR(new Date()));
    
    Logger.log('Kayıt güncellendi - Satır ' + foundRow + ' (ID: ' + targetID + ')');
    
    return { success: true, message: 'Kayıt başarıyla güncellendi! (ID: ' + targetID + ')' };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Tüm kayıtları getir
function getRecords() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName('VardiyaTakip');
    
    if (!sheet) {
      return { success: true, data: [], message: 'Sayfa henüz oluşturulmamış.' };
    }
    
    if (sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }
    
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getDisplayValues();
    var records = [];
    
    for (var i = data.length - 1; i >= 0; i--) {
      var row = data[i];
      records.push({
        id: row[0],
        tarih: row[1],
        vardiya: row[2],
        personel: row[3],
        operator: row[4],
        yardimciOperator: row[5],
        baslangicSaati: row[6],
        bitisSaati: row[7],
        durum: row[8],
        kayitTarihi: row[9]
      });
    }
    
    return { success: true, data: records };
    
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
      total: result.data.length,
      message: result.message
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Tarih ve vardiyaya göre kayıt getir
function getRecordByDateVardiya(tarih, vardiya) {
  try {
    var result = getRecords();
    if (!result.success) return result;
    
    var formattedTarih = formatDateTR(tarih);
    var records = result.data.filter(function(record) {
      return record.tarih === formattedTarih && record.vardiya === vardiya;
    });
    var record = records.find(function(item) {
      return isActiveStatus(item.durum);
    }) || records[0];
    
    if (record) {
      return { success: true, data: record, found: true };
    } else {
      return { success: true, data: null, found: false };
    }
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Tarih formatı (dd.MM.yyyy)
function formatDateTR(dateString) {
  if (!dateString) return '';
  var parts = dateString.split('-');
  if (parts.length === 3) {
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }
  return dateString;
}

// Saat formatı (HH:mm:ss)
function isActiveStatus(value) {
  return String(value || '').trim().toLowerCase() === 'aktif';
}

function formatTimeTR(date) {
  if (!date) return '';
  var d = new Date(date);
  var hours = String(d.getHours()).padStart(2, '0');
  var minutes = String(d.getMinutes()).padStart(2, '0');
  var seconds = String(d.getSeconds()).padStart(2, '0');
  return hours + ':' + minutes + ':' + seconds;
}

// Tarih-saat formatı (dd.MM.yyyy HH:mm:ss)
function formatDateTimeTR(date) {
  if (!date) return '';
  var d = new Date(date);
  var day = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var year = d.getFullYear();
  var hours = String(d.getHours()).padStart(2, '0');
  var minutes = String(d.getMinutes()).padStart(2, '0');
  var seconds = String(d.getSeconds()).padStart(2, '0');
  return day + '.' + month + '.' + year + ' ' + hours + ':' + minutes + ':' + seconds;
}

// Yeni işlem kaydı ekle
function addIslem(data) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName('VardiyaIslemleri');
    
    // Sayfa yoksa otomatik oluştur
    if (!sheet) {
      sheet = spreadsheet.insertSheet('VardiyaIslemleri');
      
      // Başlıklar (6 sütun)
      var headers = [
        'ID', 'Vardiya ID', 'İşlem Açıklaması', 'Zaman', 'Kaydeden', 'Kayıt Tarihi'
      ];
      
      sheet.appendRow(headers);
      
      // Başlık formatı
      var headerRange = sheet.getRange(1, 1, 1, 6);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#3498db');
      headerRange.setFontColor('#ffffff');
      headerRange.setHorizontalAlignment('center');
      
      // Sütun genişlikleri
      sheet.setColumnWidth(1, 60);    // ID
      sheet.setColumnWidth(2, 100);   // Vardiya ID
      sheet.setColumnWidth(3, 300);   // İşlem Açıklaması
      sheet.setColumnWidth(4, 140);   // Zaman
      sheet.setColumnWidth(5, 150);   // Kaydeden
      sheet.setColumnWidth(6, 140);   // Kayıt Tarihi
      
      // Kenarlıklar
      headerRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
      
      Logger.log('VardiyaIslemleri sayfası otomatik olarak oluşturuldu.');
    }
    
    // Son ID'yi bul
    var lastRow = sheet.getLastRow();
    var nextID = 1;
    
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      var maxID = 0;
      for (var j = 0; j < ids.length; j++) {
        var idNum = parseInt(ids[j][0]) || 0;
        if (idNum > maxID) maxID = idNum;
      }
      nextID = maxID + 1;
    }
    
    // Kayıt ekle
    var kayitTarihi = formatDateTimeTR(new Date());
    var zaman = data.zaman || formatDateTimeTR(new Date());
    
    sheet.appendRow([
      nextID.toString(),
      data.vardiyaId || '',
      data.islem || '',
      zaman,
      data.kaydeden || '',
      kayitTarihi
    ]);
    
    // Yeni satır formatı
    var newRow = sheet.getLastRow();
    sheet.getRange(newRow, 1, 1, 6).setHorizontalAlignment('center');
    sheet.getRange(newRow, 3).setHorizontalAlignment('left'); // İşlem açıklaması sola yaslı
    sheet.getRange(newRow, 1, 1, 6).setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
    
    return { 
      success: true, 
      message: 'İşlem başarıyla kaydedildi! (ID: ' + nextID + ')',
      data: { id: nextID.toString() }
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Vardiya ID'sine göre işlemleri getir
function getIslemlerByVardiyaId(vardiyaId) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName('VardiyaIslemleri');
    
    if (!sheet) {
      return { success: true, data: [], message: 'Sayfa henüz oluşturulmamış.' };
    }
    
    if (sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }
    
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues();
    var islemler = [];
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row[1] === vardiyaId) {
        islemler.push({
          id: row[0],
          vardiyaId: row[1],
          islem: row[2],
          zaman: row[3],
          kaydeden: row[4],
          kayitTarihi: row[5]
        });
      }
    }
    
    // Zmana göre sırala (en yeni en üste)
    islemler.sort(function(a, b) {
      return new Date(b.zaman) - new Date(a.zaman);
    });
    
    return { success: true, data: islemler };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Son kayıtları işlemleri ile birlikte getir
function getLastRecordsWithIslemler(count) {
  try {
    // Vardiya kayıtlarını çek
    var vardiyaResult = getLastRecords(count);
    
    if (!vardiyaResult.success) {
      return vardiyaResult;
    }
    
    var vardiyaKayitlari = vardiyaResult.data;
    
    // Tüm işlemleri çek
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var islemSheet = spreadsheet.getSheetByName('VardiyaIslemleri');
    var islemlerMap = {};
    
    if (islemSheet && islemSheet.getLastRow() > 1) {
      var islemData = islemSheet.getRange(2, 1, islemSheet.getLastRow() - 1, 6).getDisplayValues();
      
      for (var i = 0; i < islemData.length; i++) {
        var row = islemData[i];
        var vardiyaId = row[1];
        
        if (!islemlerMap[vardiyaId]) {
          islemlerMap[vardiyaId] = [];
        }
        
        islemlerMap[vardiyaId].push({
          id: row[0],
          vardiyaId: row[1],
          islem: row[2],
          zaman: row[3],
          kaydeden: row[4],
          kayitTarihi: row[5]
        });
      }
    }
    
    // Her vardiya kaydına işlemleri ekle
    for (var j = 0; j < vardiyaKayitlari.length; j++) {
      var vardiya = vardiyaKayitlari[j];
      var vardiyaId = vardiya.id;
      
      if (islemlerMap[vardiyaId]) {
        vardiya.islemler = islemlerMap[vardiyaId];
      } else {
        vardiya.islemler = [];
      }
    }
    
    return { success: true, data: vardiyaKayitlari };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
