/**
 * VARDIYA BILDIRIMLERI - Google Apps Script Kodu
 *
 * Kurulum:
 * 1. Google Sheets > Extensions > Apps Script acin.
 * 2. Bu kodu yapistirin.
 * 3. Deploy > New deployment > Web app.
 * 4. Execute as: Me, Who has access: Anyone secin.
 * 5. /exec URL'ini js/bildirim-sheets.js icindeki WEB_APP_URL alanina yazin.
 */

var ANNOUNCEMENTS_SHEET_NAME = 'VardiyaBildirimleri';
var ANNOUNCEMENT_HEADERS = [
  'ID', 'Baslangic Tarihi', 'Bitis Tarihi', 'Vardiya', 'Metin', 'Kategori',
  'Oncelik', 'Hedef', 'Aktif', 'Ek URL', 'Ek Adi', 'Okuyanlar',
  'Olusturan', 'Olusturma Zamani', 'Guncelleme Zamani'
];

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

    switch (action) {
      case 'getAnnouncements':
        result = getAnnouncements(e.parameter);
        break;
      case 'addAnnouncement':
        result = addAnnouncement(e.parameter);
        break;
      case 'updateAnnouncement':
        result = updateAnnouncement(e.parameter);
        break;
      case 'deleteAnnouncement':
        result = deleteAnnouncement(e.parameter.id);
        break;
      case 'setAnnouncementActive':
        result = setAnnouncementActive(e.parameter.id, e.parameter.active);
        break;
      case 'clearInactiveAnnouncements':
        result = clearInactiveAnnouncements();
        break;
      case 'markAnnouncementRead':
        result = markAnnouncementRead(e.parameter);
        break;
      default:
        result = { success: false, error: 'Gecersiz islem' };
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

function getOrCreateAnnouncementsSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(ANNOUNCEMENTS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ANNOUNCEMENTS_SHEET_NAME);
    sheet.appendRow(ANNOUNCEMENT_HEADERS);

    var headerRange = sheet.getRange(1, 1, 1, ANNOUNCEMENT_HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#2563eb');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    headerRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 110);
    sheet.setColumnWidth(3, 90);
    sheet.setColumnWidth(5, 420);
    sheet.setColumnWidth(10, 260);
    sheet.setColumnWidth(12, 260);
    sheet.getRange(2, 1, 1000, ANNOUNCEMENT_HEADERS.length).setNumberFormat('@');
  } else {
    migrateAnnouncementsSheet(sheet);
  }

  return sheet;
}

function migrateAnnouncementsSheet(sheet) {
  var lastColumn = sheet.getLastColumn();
  var currentHeaders = sheet.getRange(1, 1, 1, Math.max(lastColumn, 1)).getDisplayValues()[0];
  if (currentHeaders[1] === 'Baslangic Tarihi' && lastColumn >= ANNOUNCEMENT_HEADERS.length) return;

  var lastRow = sheet.getLastRow();
  var oldRows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, Math.min(lastColumn, 10)).getDisplayValues() : [];
  var migratedRows = oldRows.map(function(row) {
    return [
      row[0], row[1], '', row[2], row[3], 'general', row[4] || 'normal',
      row[5] || 'all', row[6], '', '', '', row[7], row[8], row[9]
    ];
  });

  sheet.clear();
  sheet.appendRow(ANNOUNCEMENT_HEADERS);
  if (migratedRows.length > 0) {
    sheet.getRange(2, 1, migratedRows.length, ANNOUNCEMENT_HEADERS.length).setValues(migratedRows);
  }

  var headerRange = sheet.getRange(1, 1, 1, ANNOUNCEMENT_HEADERS.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#2563eb');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  sheet.getRange(2, 1, Math.max(1000, migratedRows.length + 1), ANNOUNCEMENT_HEADERS.length).setNumberFormat('@');
}

function getAnnouncements(params) {
  try {
    var sheet = getOrCreateAnnouncementsSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [] };
    }

    var rows = sheet.getRange(2, 1, lastRow - 1, ANNOUNCEMENT_HEADERS.length).getDisplayValues();
    var onlyActive = String(params.active || '').toLowerCase() === 'true';
    var dateFilter = params.date || '';
    var shiftFilter = params.shift || '';

    var data = rows.map(rowToAnnouncement).filter(function(item) {
      if (onlyActive && item.active === false) return false;
      if (dateFilter && item.startDate && item.startDate !== dateFilter) return false;
      if (shiftFilter && item.shift && item.shift !== shiftFilter) return false;
      return true;
    });

    data.sort(function(a, b) {
      return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
    });

    return { success: true, data: data };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function addAnnouncement(data) {
  try {
    var sheet = getOrCreateAnnouncementsSheet();
    var now = formatDateTimeTR(new Date());
    var id = data.id || createAnnouncementId();

    if (!data.title && !data.message) {
      return { success: false, error: 'Bildirim metni zorunludur' };
    }

    var attachment = saveAttachmentIfNeeded(data);

    sheet.appendRow([
      id,
      normalizeDate(data.startDate || data.date || ''),
      normalizeDate(data.endDate || ''),
      data.shift || '',
      data.title || data.message || '',
      data.category || 'general',
      data.priority || 'normal',
      data.target || 'all',
      normalizeActive(data.active),
      attachment.url || data.attachmentUrl || '',
      attachment.name || data.attachmentName || '',
      '',
      data.createdBy || 'Admin',
      data.createdAt || now,
      now
    ]);

    formatAnnouncementRow(sheet, sheet.getLastRow());
    return { success: true, data: getAnnouncementById(id), message: 'Bildirim eklendi' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function updateAnnouncement(data) {
  try {
    if (!data.id) return { success: false, error: 'ID zorunludur' };
    var sheet = getOrCreateAnnouncementsSheet();
    var row = findRowById(sheet, data.id);
    if (!row) return { success: false, error: 'Bildirim bulunamadi' };

    var existing = rowToAnnouncement(sheet.getRange(row, 1, 1, ANNOUNCEMENT_HEADERS.length).getDisplayValues()[0]);
    var now = formatDateTimeTR(new Date());
    var attachment = saveAttachmentIfNeeded(data);

    var values = [[
      data.id,
      normalizeDate(data.startDate !== undefined ? data.startDate : (data.date !== undefined ? data.date : existing.startDate)),
      normalizeDate(data.endDate !== undefined ? data.endDate : existing.endDate),
      data.shift !== undefined ? data.shift : existing.shift,
      data.title || data.message || existing.title,
      data.category || existing.category || 'general',
      data.priority || existing.priority || 'normal',
      data.target || existing.target || 'all',
      normalizeActive(data.active !== undefined ? data.active : existing.active),
      attachment.url || data.attachmentUrl || existing.attachmentUrl || '',
      attachment.name || data.attachmentName || existing.attachmentName || '',
      existing.readByText || '',
      data.createdBy || existing.createdBy || 'Admin',
      existing.createdAt || now,
      now
    ]];

    sheet.getRange(row, 1, 1, ANNOUNCEMENT_HEADERS.length).setValues(values);
    formatAnnouncementRow(sheet, row);
    return { success: true, data: getAnnouncementById(data.id), message: 'Bildirim guncellendi' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function deleteAnnouncement(id) {
  try {
    var sheet = getOrCreateAnnouncementsSheet();
    var row = findRowById(sheet, id);
    if (!row) return { success: false, error: 'Bildirim bulunamadi' };
    sheet.deleteRow(row);
    return { success: true, message: 'Bildirim silindi' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function setAnnouncementActive(id, active) {
  try {
    var sheet = getOrCreateAnnouncementsSheet();
    var row = findRowById(sheet, id);
    if (!row) return { success: false, error: 'Bildirim bulunamadi' };
    sheet.getRange(row, 9).setValue(normalizeActive(active));
    sheet.getRange(row, 15).setValue(formatDateTimeTR(new Date()));
    formatAnnouncementRow(sheet, row);
    return { success: true, data: getAnnouncementById(id), message: 'Durum guncellendi' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function clearInactiveAnnouncements() {
  try {
    var sheet = getOrCreateAnnouncementsSheet();
    var lastRow = sheet.getLastRow();
    var deleted = 0;

    for (var row = lastRow; row >= 2; row--) {
      var active = String(sheet.getRange(row, 9).getDisplayValue()).toLowerCase();
      if (active === 'false' || active === 'pasif') {
        sheet.deleteRow(row);
        deleted++;
      }
    }

    return { success: true, deletedCount: deleted, message: deleted + ' pasif bildirim silindi' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getAnnouncementById(id) {
  var sheet = getOrCreateAnnouncementsSheet();
  var row = findRowById(sheet, id);
  if (!row) return null;
  return rowToAnnouncement(sheet.getRange(row, 1, 1, ANNOUNCEMENT_HEADERS.length).getDisplayValues()[0]);
}

function findRowById(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return null;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return null;
}

function rowToAnnouncement(row) {
  var readByText = row[11] || '';
  return {
    id: row[0],
    date: row[1],
    startDate: row[1],
    endDate: row[2],
    shift: row[3],
    title: row[4],
    message: row[4],
    category: row[5] || 'general',
    priority: row[6] || 'normal',
    target: row[7] || 'all',
    active: String(row[8]).toLowerCase() !== 'false' && String(row[8]).toLowerCase() !== 'pasif',
    attachmentUrl: row[9] || '',
    attachmentName: row[10] || '',
    readByText: readByText,
    readBy: parseReadBy(readByText),
    createdBy: row[12],
    createdAt: row[13],
    updatedAt: row[14]
  };
}

function formatAnnouncementRow(sheet, row) {
  var range = sheet.getRange(row, 1, 1, ANNOUNCEMENT_HEADERS.length);
  range.setBorder(true, true, true, true, true, true, '#d9e2ef', SpreadsheetApp.BorderStyle.SOLID);
  range.setVerticalAlignment('middle');
  sheet.getRange(row, 5).setWrap(true);

  var priority = String(sheet.getRange(row, 7).getDisplayValue()).toLowerCase();
  var active = String(sheet.getRange(row, 9).getDisplayValue()).toLowerCase();
  var color = '#ffffff';
  if (active === 'false' || active === 'pasif') color = '#f1f5f9';
  else if (priority === 'high') color = '#fee2e2';
  else if (priority === 'medium') color = '#fef3c7';
  range.setBackground(color);
}

function markAnnouncementRead(data) {
  try {
    if (!data.id) return { success: false, error: 'ID zorunludur' };
    var sheet = getOrCreateAnnouncementsSheet();
    var row = findRowById(sheet, data.id);
    if (!row) return { success: false, error: 'Bildirim bulunamadi' };

    var reader = data.reader || data.email || 'Kullanici';
    var email = data.email || '';
    var key = email || reader;
    var existingText = sheet.getRange(row, 12).getDisplayValue();
    var entries = parseReadBy(existingText);
    var exists = entries.some(function(entry) {
      return entry.key === key;
    });

    if (!exists) {
      entries.push({
        key: key,
        reader: reader,
        email: email,
        readAt: formatDateTimeTR(new Date())
      });
      sheet.getRange(row, 12).setValue(stringifyReadBy(entries));
      sheet.getRange(row, 15).setValue(formatDateTimeTR(new Date()));
    }

    return { success: true, data: getAnnouncementById(data.id), message: 'Okundu olarak islendi' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function parseReadBy(value) {
  if (!value) return [];
  return String(value).split('||').filter(Boolean).map(function(part) {
    var pieces = part.split('|');
    return {
      key: pieces[0] || '',
      reader: pieces[1] || pieces[0] || '',
      email: pieces[2] || '',
      readAt: pieces[3] || ''
    };
  });
}

function stringifyReadBy(entries) {
  return entries.map(function(entry) {
    return [entry.key, entry.reader, entry.email, entry.readAt].join('|');
  }).join('||');
}

function saveAttachmentIfNeeded(data) {
  if (!data.attachmentData || !data.attachmentName) {
    return { url: '', name: '' };
  }

  var bytes = Utilities.base64Decode(data.attachmentData);
  var blob = Utilities.newBlob(bytes, data.attachmentType || 'application/octet-stream', data.attachmentName);
  var file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    url: file.getUrl(),
    name: file.getName()
  };
}

function createAnnouncementId() {
  return 'ann-' + new Date().getTime() + '-' + Math.floor(Math.random() * 100000);
}

function normalizeActive(value) {
  if (value === false) return 'FALSE';
  var text = String(value);
  return (text.toLowerCase() === 'false' || text.toLowerCase() === 'pasif') ? 'FALSE' : 'TRUE';
}

function normalizeDate(value) {
  if (!value) return '';
  if (String(value).indexOf('.') !== -1) return String(value);
  var parts = String(value).split('-');
  return parts.length === 3 ? parts[2] + '.' + parts[1] + '.' + parts[0] : String(value);
}

function formatDateTimeTR(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
}
