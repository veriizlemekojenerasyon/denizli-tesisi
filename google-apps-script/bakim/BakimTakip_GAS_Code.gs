// Bakim Takip Sistemi - Google Apps Script V2
// Ortak kayit modeli + tur/motor bazli Sheets yapisi.

const SPREADSHEET_NAME = 'Bakim Takip Sistemi';
const SPREADSHEET_ID = '1ep4yY5U_QRghohq6DtkbG68KT8MMFLVMXe6S7atd2AQ';
const KOJEN_ENERJI_API_URL = 'https://script.google.com/macros/s/AKfycbxysc_Z4VtE1Weohc91XcOi651EwxrPlanIOyebKfSJyBEUQJ2lvf6hP-fkS1OKqyk/exec';

const DRIVE_FOLDERS = {
  PERIODIC: '1TGrKfYHrayZmiGW1J8GQd70jPtByBKY9',
  NORMAL: '10D4LgnGYN0TMdweTIfeMjoKSX2ZLaYCA',
  FAULT: '1TGrKfYHrayZmiGW1J8GQd70jPtByBKY9'
};

const MOTORS = ['GM-1', 'GM-2', 'GM-3'];
const SHEET_STATS = 'Istatistikler';
const SHEET_SETTINGS = 'Ayarlar';
const DEFAULT_ALERT_EMAIL = 'mrtcsk0320@gmail.com';
const ALERT_EMAIL_PROPERTY = 'BAKIM_ALERT_EMAIL';
const MAINTENANCE_LAST_RUN_PROPERTY = 'BAKIM_LAST_TRIGGER_RUN';
const MAINTENANCE_LAST_ERROR_PROPERTY = 'BAKIM_LAST_TRIGGER_ERROR';
const ENABLE_PUBLIC_FILE_SHARING = false;

const PERIODIC_BASE_HOURS = 40000;
const PERIODIC_STEP_HOURS = 2000;
const PERIODIC_WARNING_HOURS = 200;
const PERIODIC_URGENT_WARNING_HOURS = 100;
const PERIODIC_INTERVALS = [30000, 20000, 10000, 6000, 2000];

const OIL_SAMPLE_INTERVAL_HOURS = 500;
const OIL_SAMPLE_WARNING_HOURS = 100;
const OIL_SAMPLE_URGENT_WARNING_HOURS = 50;
const ALTERNATOR_GREASE_INTERVAL_HOURS = 1000;
const ALTERNATOR_GREASE_WARNING_HOURS = 100;

const COMMON_RECORD_HEADERS = [
  'Kayit No',
  'Tarih',
  'Saat',
  'Motor',
  'Bakim Ana Turu',
  'Bakim Alt Turu',
  'Destek Tipi',
  'Sorumlu',
  'Durum',
  'Aciklama',
  'Dosyalar',
  'Kayit Zamani',
  'Kapama Zamani',
  'Guncel Motor Saati',
  'Baslangic Tarihi',
  'Baslangic Saati',
  'Bitis Tarihi',
  'Bitis Saati'
];

const SHEET_EXTRA_HEADERS = {
  periodic: ['Periyodik Son Esik', 'Periyodik Sonraki Esik', 'Kalan Saat', 'Bildirim Durumu', 'Plan Detayi'],
  oilSample: ['Barkod No'],
  oilFilter: ['Yag Calisma Saati'],
  oilChange: ['Yag Calisma Saati'],
  htLtJacket: ['HT Deger', 'LT Deger', 'Ceket Suyu Deger'],
  alternator: ['Alternator On', 'Alternator Arka', 'Alternator Toplam'],
  fault: ['Ariza Saati', 'Ariza Nedeni'],
  other: []
};

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = normalizeEventParams(e);
    const action = getParam(params, 'action') || 'health';
    const ss = getSpreadsheet();
    if (shouldEnsureWorkbookForAction(action)) ensureWorkbook(ss);

    switch (action) {
      case 'health':
      case 'test':
        return jsonResponse(true, 'Bakim Takip V2 calisiyor', {
          version: '2.0',
          sheets: getSheetDefinitions().map(function(item) { return item.name; })
        });
      case 'init':
        return jsonResponse(true, 'Sayfalar hazirlandi', {
          sheets: getSheetDefinitions().map(function(item) { return item.name; })
        });
      case 'resetSheetHeaders':
        return resetSheetHeaders(ss);
      case 'testDriveAccess':
      case 'testDriveFolders':
        return testDriveAccess();
      case 'save':
        return saveMaintenanceRecordV2(ss, params);
      case 'savePeriodicMaintenanceV2':
        params.type = ['Periyodik'];
        return saveMaintenanceRecordV2(ss, params);
      case 'getPeriodicMaintenanceStatus':
        return getPeriodicMaintenanceStatus(ss);
      case 'checkPeriodicMaintenanceAlerts':
        return getPeriodicMaintenanceStatus(ss);
      case 'getMotorHours':
        return getMotorHours(ss);
      case 'checkOilSampleAlerts':
        return checkOilSampleAlerts(ss);
      case 'checkAlternatorGreaseAlerts':
        return checkAlternatorGreaseAlerts(ss);
      case 'runMaintenanceCheck':
        return runMaintenanceCheck();
      case 'updateSettingsMotorHours':
        return updateSettingsMotorHours(ss);
      case 'installMaintenanceTriggers':
        return installMaintenanceTriggers();
      case 'removeMaintenanceTriggers':
        return removeMaintenanceTriggers();
      case 'getMaintenanceTriggers':
        return getMaintenanceTriggers();
      case 'getStats':
        return getMaintenanceStats(ss, params);
      case 'getReport':
        return getMaintenanceReport(ss, params);
      case 'getActiveRecords':
        return getActiveRecords(ss, params);
      case 'closeRecord':
        return closeRecord(ss, params);
      case 'updateMotorHours':
        return jsonResponse(true, 'Motor saati Enerji sayfasindan otomatik okunuyor');
      case 'updateOilSample':
        return createQuickMaintenanceRecord(ss, params, 'Normal', 'YAG NUMUNE ALMA');
      case 'updateAlternatorGrease':
        return createQuickMaintenanceRecord(ss, params, 'Normal', 'ALTERNATOR GRESLEME');
      default:
        return jsonResponse(false, 'Gecersiz islem: ' + action);
    }
  } catch (error) {
    Logger.log('Sistem hatasi: ' + error.toString());
    Logger.log(error.stack || '');
    return jsonResponse(false, 'Sistem hatasi: ' + error.toString());
  }
}

function shouldEnsureWorkbookForAction(action) {
  return ['init', 'resetSheetHeaders', 'installMaintenanceTriggers', 'runMaintenanceCheck'].indexOf(action) !== -1;
}

function normalizeEventParams(e) {
  if (!e) return {};
  if (e.parameters) return e.parameters;
  if (e.parameter) {
    const out = {};
    Object.keys(e.parameter).forEach(function(key) {
      out[key] = [e.parameter[key]];
    });
    return out;
  }
  return {};
}

function getParam(params, key) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] || '';
  if (value === null || typeof value === 'undefined') return '';
  return String(value);
}

function getSpreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);

  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.openById(files.next().getId());
  return SpreadsheetApp.create(SPREADSHEET_NAME);
}

function ensureWorkbook(ss) {
  getSheetDefinitions().forEach(function(definition) {
    ensureRecordSheet(ss, definition.name);
  });
  ensureStatsSheet(ss);
  ensureSettingsSheet(ss);
}

function resetSheetHeaders(ss) {
  const sheets = getSheetDefinitions().map(function(definition) {
    const sheet = ensureRecordSheet(ss, definition.name);
    const headers = getHeadersForSheet(definition.name);
    return {
      sheetName: definition.name,
      columnCount: headers.length,
      headers: headers
    };
  });

  return jsonResponse(true, 'Sayfa basliklari yenilendi', { sheets: sheets });
}

function getSheetDefinitions() {
  const sheets = [];
  MOTORS.forEach(function(motor) {
    sheets.push({ name: 'Periyodik ' + motor, mainType: 'Periyodik' });
    sheets.push({ name: 'Yag Numune ' + motor, mainType: 'Normal' });
    sheets.push({ name: 'Yag Filtre Degisimi ' + motor, mainType: 'Normal' });
    sheets.push({ name: 'Yag Degisimi ' + motor, mainType: 'Normal' });
    sheets.push({ name: 'HT LT Ceket Suyu ' + motor, mainType: 'Normal' });
    sheets.push({ name: 'Alternator Gresleme ' + motor, mainType: 'Normal' });
    sheets.push({ name: 'Ariza ' + motor, mainType: 'Ariza' });
  });
  sheets.push({ name: 'Diger Bakim', mainType: 'Normal' });
  return sheets;
}

function ensureRecordSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  const headers = getHeadersForSheet(sheetName);
  const existingHeaders = getSheetHeaders(sheet);

  if (existingHeaders.length && headers.join('|') !== existingHeaders.join('|')) {
    rewriteSheetRowsToHeaders(sheet, existingHeaders, headers);
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1d4ed8')
    .setFontColor('#ffffff');
  if (sheet.getLastColumn() > headers.length) {
    sheet.getRange(1, headers.length + 1, 1, sheet.getLastColumn() - headers.length).clearContent();
  }
  sheet.setFrozenRows(1);

  return sheet;
}

function rewriteSheetRowsToHeaders(sheet, oldHeaders, newHeaders) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const oldColumnCount = oldHeaders.length;
  const rowCount = lastRow - 1;
  const oldRows = sheet.getRange(2, 1, rowCount, oldColumnCount).getValues();
  const newRows = oldRows.map(function(row) {
    return newHeaders.map(function(header) {
      const oldIndex = oldHeaders.indexOf(header);
      return oldIndex === -1 ? '' : row[oldIndex];
    });
  });

  const clearColumnCount = Math.max(oldColumnCount, newHeaders.length);
  sheet.getRange(2, 1, rowCount, clearColumnCount).clearContent();
  sheet.getRange(2, 1, newRows.length, newHeaders.length).setValues(newRows);
}

function getHeadersForSheet(sheetName) {
  const kind = getSheetKind(sheetName);
  return COMMON_RECORD_HEADERS.concat(SHEET_EXTRA_HEADERS[kind] || []);
}

function getSheetKind(sheetName) {
  const text = normalizeSearchText(sheetName);
  if (text.indexOf('PERIYODIK') === 0) return 'periodic';
  if (text.indexOf('YAG NUMUNE') === 0) return 'oilSample';
  if (text.indexOf('YAG FILTRE DEGISIMI') === 0) return 'oilFilter';
  if (text.indexOf('YAG FILITRE DEGISIMI') === 0) return 'oilFilter';
  if (text.indexOf('YAG DEGISIMI') === 0) return 'oilChange';
  if (text.indexOf('HT LT CEKET SUYU') === 0) return 'htLtJacket';
  if (text.indexOf('ALTERNATOR GRESLEME') === 0) return 'alternator';
  if (text.indexOf('ARIZA') === 0) return 'fault';
  return 'other';
}

function ensureStatsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_STATS);
  if (!sheet) sheet = ss.insertSheet(SHEET_STATS);
  sheet.getRange(1, 1, 1, 8)
    .setValues([['Ay', 'Toplam', 'Periyodik', 'Normal', 'Ariza', 'GM-1', 'GM-2', 'GM-3']])
    .setFontWeight('bold')
    .setBackground('#15803d')
    .setFontColor('#ffffff');
  return sheet;
}

function ensureSettingsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) sheet = ss.insertSheet(SHEET_SETTINGS);
  if (!sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1, 1, 2).setValues([['Ayar', 'Deger']]).setFontWeight('bold');
    sheet.getRange(2, 1, 1, 2).setValues([['Son Kayit No', '']]);
    sheet.getRange(3, 1, 1, 2).setValues([['Bildirim Maili', DEFAULT_ALERT_EMAIL]]);
  }
  return sheet;
}

function saveMaintenanceRecordV2(ss, params) {
  const mainType = normalizeMainType(getParam(params, 'type'));
  const subtype = normalizeSubtype(getParam(params, 'subtype'));
  const motor = normalizeMotor(getParam(params, 'motor'));
  const sheetName = getTargetSheetName(mainType, subtype, motor);
  const sheet = ensureRecordSheet(ss, sheetName);
  const headers = getHeadersForSheet(sheetName);
  const now = new Date();
  const createdAt = formatDateTime(now);
  const submittedMotorHours = getRecordMotorHours(params, 0);
  const shouldReadCurrentHours = mainType === 'Periyodik' || submittedMotorHours <= 0;
  const currentHours = shouldReadCurrentHours ? getLatestEnergyMotorHours(ss, motor) : 0;
  const effectiveCurrentHours = currentHours || submittedMotorHours;
  const recordMotorHours = submittedMotorHours || currentHours;
  const periodicPlan = mainType === 'Periyodik' ? calculatePeriodicPlan(effectiveCurrentHours) : null;
  const recordNo = createRecordNo(ss, mainType);
  const fileCount = parseInt(getParam(params, 'fileCount'), 10) || 0;
  const files = uploadFilesIfPresent(params, mainType, motor, subtype, fileCount);
  const warningStatus = periodicPlan ? getPeriodicWarningStatus(periodicPlan) : '';

  const recordMap = {
    'Kayit No': recordNo,
    'Tarih': getParam(params, 'date') || formatDate(now),
    'Saat': getParam(params, 'time') || formatTime(now),
    'Motor': motor,
    'Bakim Ana Turu': mainType,
    'Bakim Alt Turu': subtype,
    'Destek Tipi': normalizeSupportType(getParam(params, 'company')),
    'Sorumlu': getParam(params, 'technician'),
    'Durum': normalizeStatus(getParam(params, 'status')),
    'Aciklama': getParam(params, 'notes'),
    'Dosyalar': files,
    'Kayit Zamani': createdAt,
    'Kapama Zamani': '',
    'Guncel Motor Saati': recordMotorHours,
    'Baslangic Tarihi': getParam(params, 'startDate') || getParam(params, 'date') || formatDate(now),
    'Baslangic Saati': getParam(params, 'startTime') || getParam(params, 'time') || formatTime(now),
    'Bitis Tarihi': getParam(params, 'endDate') || getParam(params, 'date') || formatDate(now),
    'Bitis Saati': getParam(params, 'endTime') || getParam(params, 'time') || formatTime(now),
    'Periyodik Son Esik': periodicPlan ? periodicPlan.lastThreshold : '',
    'Periyodik Sonraki Esik': periodicPlan ? periodicPlan.nextThreshold : '',
    'Kalan Saat': periodicPlan ? periodicPlan.remainingHours : '',
    'Bildirim Durumu': warningStatus,
    'Plan Detayi': periodicPlan ? periodicPlan.planDetail : '',
    'Ariza Saati': getParam(params, 'faultTime'),
    'Ariza Nedeni': mainType === 'Ariza' ? subtype : '',
    'Barkod No': getParam(params, 'barcodeNumber'),
    'Yag Calisma Saati': getParam(params, 'filterOilHours'),
    'HT Deger': getParam(params, 'htTemperature'),
    'LT Deger': getParam(params, 'ltTemperature'),
    'Ceket Suyu Deger': getParam(params, 'jacketTemperature'),
    'Alternator On': getParam(params, 'alternatorFront'),
    'Alternator Arka': getParam(params, 'alternatorRear'),
    'Alternator Toplam': getParam(params, 'alternatorTotal')
  };
  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(recordMap, header) ? recordMap[header] : '';
  });

  sheet.appendRow(row);
  const newRow = sheet.getLastRow();
  sheet.getRange(newRow, 1, 1, row.length).setFontFamily('Arial').setFontSize(10);
  updateLastRecordNo(ss, recordNo);

  const alternatorPlan = getSheetKind(sheetName) === 'alternator'
    ? calculateAlternatorGreasePlan(effectiveCurrentHours, recordMotorHours)
    : null;

  return jsonResponse(true, 'Kayit basariyla eklendi', {
    recordNo: recordNo,
    sheetName: sheetName,
    currentHours: effectiveCurrentHours,
    recordMotorHours: recordMotorHours,
    periodicPlan: periodicPlan,
    alternatorPlan: alternatorPlan,
    nextAlternatorGrease: alternatorPlan ? alternatorPlan.nextHours : ''
  });
}

function createQuickMaintenanceRecord(ss, params, mainType, subtype) {
  params.type = [mainType];
  params.subtype = [subtype];
  params.status = ['Aktif'];
  params.notes = [subtype + ' otomatik kaydi'];
  params.technician = ['SISTEM'];
  params.company = ['IC DESTEK'];
  if (getParam(params, 'currentHours') && !getParam(params, 'motorHours')) {
    params.motorHours = [getParam(params, 'currentHours')];
  }
  return saveMaintenanceRecordV2(ss, params);
}

function getRecordMotorHours(params, fallbackHours) {
  const candidates = [
    getParam(params, 'alternatorMotorHours'),
    getParam(params, 'motorHours'),
    getParam(params, 'filterMotorHours'),
    getParam(params, 'currentHours')
  ];

  for (let i = 0; i < candidates.length; i++) {
    const hours = parseNumber(candidates[i]);
    if (hours > 0) return hours;
  }

  return fallbackHours;
}

function getTargetSheetName(mainType, subtype, motor) {
  if (mainType === 'Periyodik') return 'Periyodik ' + motor;
  if (mainType === 'Ariza') return 'Ariza ' + motor;

  const normalized = normalizeSearchText(subtype);
  if (normalized.indexOf('NUMUNE') !== -1) return 'Yag Numune ' + motor;
  if (normalized.indexOf('FILTRE') !== -1 || normalized.indexOf('FILITRE') !== -1) return 'Yag Filtre Degisimi ' + motor;
  if (normalized.indexOf('YAG') !== -1 && normalized.indexOf('DEGIS') !== -1) return 'Yag Degisimi ' + motor;
  if (normalized.indexOf('HT') !== -1 && normalized.indexOf('LT') !== -1 &&
      (normalized.indexOf('CEKET') !== -1 || normalized.indexOf('JACKET') !== -1)) {
    return 'HT LT Ceket Suyu ' + motor;
  }
  if (normalized.indexOf('GRES') !== -1 || normalized.indexOf('ALTERNATOR') !== -1) return 'Alternator Gresleme ' + motor;
  return 'Diger Bakim';
}

function normalizeMainType(value) {
  const text = normalizeSearchText(value);
  if (text.indexOf('PERIYODIK') !== -1) return 'Periyodik';
  if (text.indexOf('ARIZA') !== -1) return 'Ariza';
  return 'Normal';
}

function normalizeSubtype(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Diger';
  return raw.toUpperCase();
}

function normalizeSupportType(value) {
  const text = normalizeSearchText(value);
  if (text.indexOf('DIS') !== -1 || text.indexOf('EXTERNAL') !== -1) return 'Dis destek';
  return 'Ic destek';
}

function normalizeStatus(value) {
  const text = normalizeSearchText(value);
  if (text.indexOf('KAPALI') !== -1 || text.indexOf('PASIF') !== -1) return 'Kapali';
  return 'Aktif';
}

function normalizeMotor(value) {
  let text = String(value || 'GM-1').trim().toUpperCase().replace(/\s+/g, '');
  const match = text.match(/GM-?(\d+)$/);
  if (match) return 'GM-' + match[1];
  if (/^\d+$/.test(text)) return 'GM-' + text;
  return text || 'GM-1';
}

function normalizeSearchText(value) {
  return String(value || '')
    .replace(/\u0131/g, 'i')
    .replace(/\u0130/g, 'I')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function createRecordNo(ss, mainType) {
  const prefix = mainType === 'Periyodik' ? 'PB' : mainType === 'Ariza' ? 'AB' : 'NB';
  const settings = ensureSettingsSheet(ss);
  const lastValue = String(settings.getRange(2, 2).getValue() || '');
  const lastNumber = parseInt((lastValue.match(/(\d+)$/) || [0, 0])[1], 10) || 0;
  const recordNo = prefix + '-' + String(lastNumber + 1).padStart(5, '0');
  return recordNo;
}

function updateLastRecordNo(ss, recordNo) {
  ensureSettingsSheet(ss).getRange(2, 1, 1, 2).setValues([['Son Kayit No', recordNo]]);
}

function calculatePeriodicPlan(currentHours) {
  const current = parseNumber(currentHours);
  const lastThreshold = current > 0 ? Math.floor(current / PERIODIC_STEP_HOURS) * PERIODIC_STEP_HOURS : 0;
  const nextThreshold = current > 0 && current % PERIODIC_STEP_HOURS === 0
    ? current
    : (Math.floor(current / PERIODIC_STEP_HOURS) + 1) * PERIODIC_STEP_HOURS;
  const remainingHours = Math.max(0, nextThreshold - current);
  const nextMaintenanceType = getPeriodicTypeForThreshold(nextThreshold);
  const lastMaintenanceType = getPeriodicTypeForThreshold(lastThreshold);

  return {
    currentHours: current,
    lastThreshold: lastThreshold,
    lastMaintenanceType: String(lastMaintenanceType),
    nextThreshold: nextThreshold,
    nextMaintenanceType: String(nextMaintenanceType),
    remainingHours: remainingHours,
    needsMaintenance: remainingHours === 0,
    warnsMaintenance: remainingHours > 0 && remainingHours <= PERIODIC_WARNING_HOURS,
    warningLimit: PERIODIC_WARNING_HOURS,
    planDetail: 'Baz ' + PERIODIC_BASE_HOURS + ', adim ' + PERIODIC_STEP_HOURS
  };
}

function getPeriodicTypeForThreshold(threshold) {
  const value = parseNumber(threshold);
  if (!value) return PERIODIC_STEP_HOURS;

  let basis = value > PERIODIC_BASE_HOURS ? value - PERIODIC_BASE_HOURS : value;
  if (!basis) basis = value;

  for (let i = 0; i < PERIODIC_INTERVALS.length; i++) {
    if (basis % PERIODIC_INTERVALS[i] === 0) return PERIODIC_INTERVALS[i];
  }
  return PERIODIC_STEP_HOURS;
}

function getPeriodicWarningStatus(plan) {
  if (plan.needsMaintenance) return 'Bakim zamani geldi';
  if (plan.remainingHours > 0 && plan.remainingHours <= PERIODIC_URGENT_WARNING_HOURS) return PERIODIC_URGENT_WARNING_HOURS + ' saat kala tekrar uyarildi';
  if (plan.warnsMaintenance) return PERIODIC_WARNING_HOURS + ' saat kala uyarildi';
  return 'Normal';
}

function getPeriodicMaintenanceStatus(ss) {
  ss = ss || getSpreadsheet();
  const motors = MOTORS.map(function(motor) {
    ensureRecordSheet(ss, 'Periyodik ' + motor);
    const currentHours = getLatestEnergyMotorHours(ss, motor);
    const plan = calculatePeriodicPlan(currentHours);
    const mail = sendPeriodicMaintenanceEmailIfNeeded(motor, plan);
    return Object.assign({ motor: motor, mail: mail }, plan);
  });

  return jsonResponse(true, 'Periyodik bakim durumu getirildi', { motors: motors });
}

function sendPeriodicMaintenanceEmailIfNeeded(motor, plan) {
  try {
    if (!plan.needsMaintenance && !plan.warnsMaintenance) {
      return { sent: false, skipped: true };
    }

    const props = PropertiesService.getScriptProperties();
    const warningStage = getPeriodicWarningStage(plan);
    const key = 'periodic:' + motor + ':' + plan.nextThreshold + ':' + plan.nextMaintenanceType + ':' + warningStage;
    if (props.getProperty(key)) return { sent: false, skipped: true, reason: 'sent-before' };

    MailApp.sendEmail({
      to: getAlertEmail(),
      subject: 'Periyodik Bakim Uyarisi - ' + motor,
      body: [
        'Periyodik Bakim Uyarisi',
        '',
        'Motor: ' + motor,
        'Guncel calisma saati: ' + plan.currentHours,
        'Bakim tipi: ' + plan.nextMaintenanceType + ' saat',
        'Bakim esigi: ' + plan.nextThreshold,
        'Kalan saat: ' + plan.remainingHours,
        'Uyari kademesi: ' + warningStage
      ].join('\n')
    });

    props.setProperty(key, new Date().toISOString());
    return { sent: true, stage: warningStage };
  } catch (error) {
    Logger.log('Mail gonderilemedi: ' + error.toString());
    return { sent: false, error: error.toString() };
  }
}

function getPeriodicWarningStage(plan) {
  if (plan.needsMaintenance) return 'due';
  if (plan.remainingHours > 0 && plan.remainingHours <= PERIODIC_URGENT_WARNING_HOURS) return 'urgent-' + PERIODIC_URGENT_WARNING_HOURS;
  return 'warning-' + PERIODIC_WARNING_HOURS;
}

function getAlertEmail() {
  const fromProps = PropertiesService.getScriptProperties().getProperty(ALERT_EMAIL_PROPERTY);
  if (fromProps) return fromProps;

  const settings = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_SETTINGS);
  if (settings) {
    const value = settings.getRange(3, 2).getValue();
    if (value) return String(value);
  }
  return DEFAULT_ALERT_EMAIL;
}

function getLatestEnergyMotorHours(ss, motor) {
  ss = ss || getSpreadsheet();
  const local = getLatestEnergyMotorHoursFromSheets(ss, motor);
  if (local > 0) return local;
  return getLatestEnergyMotorHoursFromApi(motor);
}

function getLatestEnergyMotorHoursFromSheets(ss, motor) {
  ss = ss || getSpreadsheet();
  const normalized = normalizeMotor(motor);
  const names = ['Enerji ' + normalized, 'Enerji GM-' + normalized.replace('GM-', ''), 'Enerji ' + normalized.replace('-', ' ')];

  for (let i = 0; i < names.length; i++) {
    const sheet = ss.getSheetByName(names[i]);
    if (!sheet || sheet.getLastRow() < 2) continue;

    const values = sheet.getRange(2, 14, sheet.getLastRow() - 1, 1).getDisplayValues();
    for (let r = values.length - 1; r >= 0; r--) {
      const hours = parseNumber(values[r][0]);
      if (hours > 0) return hours;
    }
  }
  return 0;
}

function getLatestEnergyMotorHoursFromApi(motor) {
  try {
    const response = UrlFetchApp.fetch(KOJEN_ENERJI_API_URL + '?action=getLastRecords&count=150', {
      method: 'get',
      muteHttpExceptions: true
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return 0;

    const payload = JSON.parse(response.getContentText());
    if (!payload.success || !payload.data) return 0;

    const normalized = normalizeMotor(motor);
    for (let i = 0; i < payload.data.length; i++) {
      const record = payload.data[i];
      if (normalizeMotor(record.motor) === normalized) {
        return parseNumber(record.calismaSaati);
      }
    }
  } catch (error) {
    Logger.log('Enerji API okunamadi: ' + error.toString());
  }
  return 0;
}

function getMotorHours(ss) {
  ss = ss || getSpreadsheet();
  const motors = MOTORS.map(function(motor) {
    const currentHours = getLatestEnergyMotorHours(ss, motor);
    const lastOil = getLastOilSampleHours(ss, motor);
    const lastAlt = getLastAlternatorGreaseHours(ss, motor);
    const oilPlan = calculateOilSamplePlan(currentHours, lastOil);
    const altPlan = calculateAlternatorGreasePlan(currentHours, lastAlt);

    return {
      motor: motor,
      currentHours: currentHours,
      currentHoursSource: 'Enerji',
      lastOilSampleHours: lastOil,
      nextOilSampleHours: oilPlan.nextHours,
      remainingOilHours: oilPlan.remainingHours,
      needsOilSample: oilPlan.needsMaintenance,
      warnsOilSample: oilPlan.warnsMaintenance,
      warnsOilSampleUrgent: oilPlan.warnsUrgent,
      oilSampleBasis: oilPlan.basis,
      lastAlternatorGreaseHours: lastAlt,
      nextAlternatorGreaseHours: altPlan.nextHours,
      remainingAltHours: altPlan.remainingHours,
      needsAlternatorGrease: altPlan.needsMaintenance,
      warnsAlternatorGrease: altPlan.warnsMaintenance,
      alternatorGreaseBasis: altPlan.basis
    };
  });
  writeSettingsMotorHours(ss, motors);
  writeSettingsAlternatorGreaseTable(ss, motors);
  writeSettingsOilSampleTable(ss, motors);
  return jsonResponse(true, 'Motor saatleri getirildi', { motors: motors });
}

function calculateOilSamplePlan(currentHours, lastSampleHours) {
  const current = parseNumber(currentHours);
  const last = parseNumber(lastSampleHours);
  let next = 0;
  let basis = 'kayit-yok';

  if (last > 0) {
    next = last + OIL_SAMPLE_INTERVAL_HOURS;
    basis = 'son-yag-numune-kaydi';
  }

  const remaining = next > 0 ? Math.max(0, next - current) : '';

  return {
    currentHours: current,
    lastSampleHours: last,
    nextHours: next,
    remainingHours: remaining,
    needsMaintenance: next > 0 && remaining === 0,
    warnsMaintenance: next > 0 && remaining > 0 && remaining <= OIL_SAMPLE_WARNING_HOURS,
    warnsUrgent: next > 0 && remaining > 0 && remaining <= OIL_SAMPLE_URGENT_WARNING_HOURS,
    warningLimit: OIL_SAMPLE_WARNING_HOURS,
    urgentWarningLimit: OIL_SAMPLE_URGENT_WARNING_HOURS,
    intervalHours: OIL_SAMPLE_INTERVAL_HOURS,
    basis: basis
  };
}

function checkOilSampleAlerts(ss) {
  ss = ss || getSpreadsheet();
  const motors = MOTORS.map(function(motor) {
    const currentHours = getLatestEnergyMotorHours(ss, motor);
    const lastOil = getLastOilSampleHours(ss, motor);
    const plan = calculateOilSamplePlan(currentHours, lastOil);
    const mail = sendOilSampleEmailIfNeeded(motor, plan);
    return Object.assign({ motor: motor, mail: mail }, plan);
  });

  return jsonResponse(true, 'Yag numune uyarilari kontrol edildi', { motors: motors });
}

function sendOilSampleEmailIfNeeded(motor, plan) {
  try {
    if (!plan.needsMaintenance && !plan.warnsMaintenance) {
      return { sent: false, skipped: true };
    }

    const stage = plan.needsMaintenance
      ? 'due'
      : plan.remainingHours <= OIL_SAMPLE_URGENT_WARNING_HOURS
        ? 'urgent-' + OIL_SAMPLE_URGENT_WARNING_HOURS
        : 'warning-' + OIL_SAMPLE_WARNING_HOURS;
    const props = PropertiesService.getScriptProperties();
    const key = 'oilSample:' + motor + ':' + plan.nextHours + ':' + stage;
    if (props.getProperty(key)) return { sent: false, skipped: true, reason: 'sent-before', stage: stage };

    MailApp.sendEmail({
      to: getAlertEmail(),
      subject: 'Yag Numune Uyarisi - ' + motor,
      body: [
        'Yag Numune Uyarisi',
        '',
        'Motor: ' + motor,
        'Guncel calisma saati: ' + plan.currentHours,
        'Son yag numune saati: ' + (plan.lastSampleHours || 'Kayit yok'),
        'Numune araligi: ' + plan.intervalHours + ' saat',
        'Sonraki numune esigi: ' + plan.nextHours,
        'Kalan saat: ' + plan.remainingHours,
        'Uyari kademesi: ' + stage,
        'Hesap kaynagi: ' + plan.basis
      ].join('\n')
    });

    props.setProperty(key, new Date().toISOString());
    return { sent: true, stage: stage };
  } catch (error) {
    Logger.log('Yag numune maili gonderilemedi: ' + error.toString());
    return { sent: false, error: error.toString() };
  }
}

function calculateAlternatorGreasePlan(currentHours, lastGreaseHours) {
  const current = parseNumber(currentHours);
  const last = parseNumber(lastGreaseHours);
  let next = 0;
  let basis = 'kayit-yok';

  if (last > 0) {
    next = last + ALTERNATOR_GREASE_INTERVAL_HOURS;
    basis = 'son-gresleme-kaydi';
  } else if (current > 0) {
    next = Math.ceil(current / ALTERNATOR_GREASE_INTERVAL_HOURS) * ALTERNATOR_GREASE_INTERVAL_HOURS;
    if (!next) next = ALTERNATOR_GREASE_INTERVAL_HOURS;
    basis = 'motor-saati-esigi';
  }

  const remaining = next > 0 ? Math.max(0, next - current) : ALTERNATOR_GREASE_INTERVAL_HOURS;

  return {
    currentHours: current,
    lastGreaseHours: last,
    nextHours: next,
    remainingHours: remaining,
    needsMaintenance: next > 0 && remaining === 0,
    warnsMaintenance: next > 0 && remaining > 0 && remaining <= ALTERNATOR_GREASE_WARNING_HOURS,
    warningLimit: ALTERNATOR_GREASE_WARNING_HOURS,
    intervalHours: ALTERNATOR_GREASE_INTERVAL_HOURS,
    basis: basis
  };
}

function checkAlternatorGreaseAlerts(ss) {
  ss = ss || getSpreadsheet();
  const motors = MOTORS.map(function(motor) {
    const currentHours = getLatestEnergyMotorHours(ss, motor);
    const lastAlt = getLastAlternatorGreaseHours(ss, motor);
    const plan = calculateAlternatorGreasePlan(currentHours, lastAlt);
    const mail = sendAlternatorGreaseEmailIfNeeded(motor, plan);
    return Object.assign({ motor: motor, mail: mail }, plan);
  });

  return jsonResponse(true, 'Alternator gresleme uyarilari kontrol edildi', { motors: motors });
}

function sendAlternatorGreaseEmailIfNeeded(motor, plan) {
  try {
    if (!plan.needsMaintenance && !plan.warnsMaintenance) {
      return { sent: false, skipped: true };
    }

    const stage = plan.needsMaintenance ? 'due' : 'warning-' + ALTERNATOR_GREASE_WARNING_HOURS;
    const props = PropertiesService.getScriptProperties();
    const key = 'alternatorGrease:' + motor + ':' + plan.nextHours + ':' + stage;
    if (props.getProperty(key)) return { sent: false, skipped: true, reason: 'sent-before', stage: stage };

    MailApp.sendEmail({
      to: getAlertEmail(),
      subject: 'Alternator Gresleme Uyarisi - ' + motor,
      body: [
        'Alternator Gresleme Uyarisi',
        '',
        'Motor: ' + motor,
        'Guncel calisma saati: ' + plan.currentHours,
        'Son gresleme saati: ' + (plan.lastGreaseHours || 'Kayit yok'),
        'Gresleme araligi: ' + plan.intervalHours + ' saat',
        'Sonraki gresleme esigi: ' + plan.nextHours,
        'Kalan saat: ' + plan.remainingHours,
        'Uyari kademesi: ' + stage,
        'Hesap kaynagi: ' + plan.basis
      ].join('\n')
    });

    props.setProperty(key, new Date().toISOString());
    return { sent: true, stage: stage };
  } catch (error) {
    Logger.log('Alternator gresleme maili gonderilemedi: ' + error.toString());
    return { sent: false, error: error.toString() };
  }
}

function updateSettingsMotorHours(ss) {
  ss = ss || getSpreadsheet();
  const motors = MOTORS.map(function(motor) {
    const info = getLatestEnergyMotorHoursInfo(ss, motor);
    return {
      motor: motor,
      currentHours: info.hours,
      currentHoursSource: info.source,
      lastUpdated: formatDateTime(new Date()),
      note: info.note || ''
    };
  });

  writeSettingsMotorHours(ss, motors);
  writeSettingsAlternatorGreaseTable(ss, motors);
  writeSettingsOilSampleTable(ss, motors);
  return jsonResponse(true, 'Ayarlar motor saatleri guncellendi', { motors: motors });
}

function writeSettingsMotorHours(ss, motors) {
  ss = ss || getSpreadsheet();
  const sheet = ensureSettingsSheet(ss);
  const startColumn = 4;
  const headers = ['Motor', 'Guncel Calisma Saati', 'Kaynak', 'Son Guncelleme', 'Not'];
  const rows = (motors || []).map(function(item) {
    return [
      item.motor || '',
      item.currentHours || 0,
      item.currentHoursSource || '',
      item.lastUpdated || formatDateTime(new Date()),
      item.note || ''
    ];
  });

  sheet.getRange(1, startColumn, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#0f766e')
    .setFontColor('#ffffff');

  sheet.getRange(2, startColumn, MOTORS.length, headers.length).clearContent();

  if (rows.length) {
    sheet.getRange(2, startColumn, rows.length, headers.length).setValues(rows);
  }
}

function writeSettingsAlternatorGreaseTable(ss, motors) {
  ss = ss || getSpreadsheet();
  const sheet = ensureSettingsSheet(ss);
  const startRow = 10;
  const startColumn = 4;
  const headers = [
    'Motor',
    'Son Alternator Gresleme Saati',
    'Guncel Motor Saati',
    'Sonraki Gresleme Saati',
    'Greslemeye Kalan Saat',
    'Durum'
  ];

  const motorHoursMap = buildMotorHoursMap(motors);
  const rows = MOTORS.map(function(motor) {
    const currentHours = getCachedMotorHours(motorHoursMap, motor);
    const lastGreaseHours = getLastAlternatorGreaseHours(ss, motor);
    const nextGreaseHours = lastGreaseHours > 0 ? lastGreaseHours + ALTERNATOR_GREASE_INTERVAL_HOURS : '';
    const remainingHours = nextGreaseHours ? Math.max(0, nextGreaseHours - currentHours) : '';
    let status = 'Kayit yok';

    if (nextGreaseHours) {
      if (remainingHours === 0) status = 'Gresleme zamani geldi';
      else if (remainingHours <= ALTERNATOR_GREASE_WARNING_HOURS) status = ALTERNATOR_GREASE_WARNING_HOURS + ' saat kala uyar';
      else status = 'Normal';
    }

    return [
      motor,
      lastGreaseHours || '',
      currentHours || 0,
      nextGreaseHours,
      remainingHours,
      status
    ];
  });

  sheet.getRange(startRow, startColumn, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#92400e')
    .setFontColor('#ffffff');

  sheet.getRange(startRow + 1, startColumn, MOTORS.length, headers.length).clearContent();
  sheet.getRange(startRow + 1, startColumn, rows.length, headers.length).setValues(rows);
}

function writeSettingsOilSampleTable(ss, motors) {
  ss = ss || getSpreadsheet();
  const sheet = ensureSettingsSheet(ss);
  const startRow = 20;
  const startColumn = 4;
  const headers = [
    'Motor',
    'Son Yag Numune Saati',
    'Guncel Motor Saati',
    'Sonraki Numune Saati',
    'Numuneye Kalan Saat',
    'Durum'
  ];

  const motorHoursMap = buildMotorHoursMap(motors);
  const rows = MOTORS.map(function(motor) {
    const currentHours = getCachedMotorHours(motorHoursMap, motor);
    const lastSampleHours = getLastOilSampleHours(ss, motor);
    const plan = calculateOilSamplePlan(currentHours, lastSampleHours);
    let status = 'Kayit yok';

    if (plan.nextHours) {
      if (plan.remainingHours === 0) status = 'Numune zamani geldi';
      else if (plan.remainingHours <= OIL_SAMPLE_URGENT_WARNING_HOURS) status = OIL_SAMPLE_URGENT_WARNING_HOURS + ' saat kala uyar';
      else if (plan.remainingHours <= OIL_SAMPLE_WARNING_HOURS) status = OIL_SAMPLE_WARNING_HOURS + ' saat kala uyar';
      else status = 'Normal';
    }

    return [
      motor,
      lastSampleHours || '',
      currentHours || 0,
      plan.nextHours || '',
      plan.remainingHours,
      status
    ];
  });

  sheet.getRange(startRow, startColumn, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1d4ed8')
    .setFontColor('#ffffff');

  sheet.getRange(startRow + 1, startColumn, MOTORS.length, headers.length).clearContent();
  sheet.getRange(startRow + 1, startColumn, rows.length, headers.length).setValues(rows);
}

function buildMotorHoursMap(motors) {
  const map = {};
  (motors || []).forEach(function(item) {
    if (!item || !item.motor) return;
    map[normalizeMotor(item.motor)] = parseNumber(item.currentHours);
  });
  return map;
}

function getCachedMotorHours(map, motor) {
  const normalized = normalizeMotor(motor);
  return map && Object.prototype.hasOwnProperty.call(map, normalized) ? map[normalized] : 0;
}

function getLatestEnergyMotorHoursInfo(ss, motor) {
  ss = ss || getSpreadsheet();
  const local = getLatestEnergyMotorHoursFromSheets(ss, motor);
  if (local > 0) {
    return { hours: local, source: 'Enerji sheet N sutunu', note: '' };
  }

  const api = getLatestEnergyMotorHoursFromApi(motor);
  if (api > 0) {
    return { hours: api, source: 'Kojen Enerji API', note: '' };
  }

  return { hours: 0, source: 'Bulunamadi', note: 'Enerji sheet ve API kaydi yok' };
}

function getLastRecordMotorHours(ss, sheetName) {
  ss = ss || getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  const headers = getSheetHeaders(sheet);
  const hoursColumn = getHeaderIndex(headers, [
    'Guncel Motor Saati',
    'Motor Saati',
    'Calisma Saati',
    'Çalışma Saati',
    'Filtre Motor Saati',
    'Alternator Motor Saati'
  ]) + 1;
  if (!hoursColumn) return 0;

  const values = sheet.getRange(2, hoursColumn, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let i = values.length - 1; i >= 0; i--) {
    const hours = parseNumber(values[i][0]);
    if (hours > 0) return hours;
  }
  return 0;
}

function getLastOilSampleHours(ss, motor) {
  ss = ss || getSpreadsheet();
  const direct = getLastRecordMotorHours(ss, 'Yag Numune ' + normalizeMotor(motor));
  if (direct > 0) return direct;
  return getLastMaintenanceHoursByTerms(ss, motor, ['NUMUNE']);
}

function getLastAlternatorGreaseHours(ss, motor) {
  ss = ss || getSpreadsheet();
  const direct = getLastRecordMotorHours(ss, 'Alternator Gresleme ' + normalizeMotor(motor));
  if (direct > 0) return direct;
  return getLastMaintenanceHoursByTerms(ss, motor, ['GRES', 'ALTERNATOR']);
}

function getLastMaintenanceHoursByTerms(ss, motor, terms) {
  ss = ss || getSpreadsheet();
  const normalizedMotor = normalizeMotor(motor);
  const sheets = ss.getSheets();
  let latestHours = 0;

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    if (!sheet || sheet.getLastRow() < 2) continue;

    const headers = getSheetHeaders(sheet);
    const motorColumn = getHeaderIndex(headers, ['Motor']);
    const hoursColumns = getHeaderIndexes(headers, [
      'Guncel Motor Saati',
      'Motor Saati',
      'Calisma Saati',
      'Çalışma Saati',
      'Filtre Motor Saati',
      'Alternator Motor Saati'
    ]);
    if (motorColumn === -1 || !hoursColumns.length) continue;

    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues();
    for (let r = rows.length - 1; r >= 0; r--) {
      const row = rows[r];
      if (normalizeMotor(row[motorColumn]) !== normalizedMotor) continue;

      if (!rowMatchesMaintenanceTerms(sheet, headers, row, terms)) continue;

      const hours = getBestRowHours(row, hoursColumns);
      if (hours > latestHours) latestHours = hours;
    }
  }

  return latestHours;
}

function rowMatchesMaintenanceTerms(sheet, headers, row, terms) {
  const haystack = normalizeSearchText(sheet.getName() + ' ' + headers.join(' ') + ' ' + row.join(' '));
  return (terms || []).some(function(term) {
    return haystack.indexOf(normalizeSearchText(term)) !== -1;
  });
}

function getBestRowHours(row, indexes) {
  let best = 0;
  (indexes || []).forEach(function(index) {
    const hours = parseNumber(row[index]);
    if (hours > best) best = hours;
  });
  return best;
}

function getHeaderIndex(headers, names) {
  const normalizedNames = (names || []).map(function(name) {
    return normalizeSearchText(name);
  });

  for (let i = 0; i < headers.length; i++) {
    if (normalizedNames.indexOf(normalizeSearchText(headers[i])) !== -1) return i;
  }

  for (let i = 0; i < headers.length; i++) {
    const headerText = normalizeSearchText(headers[i]);
    for (let n = 0; n < normalizedNames.length; n++) {
      if (headerText.indexOf(normalizedNames[n]) !== -1) return i;
    }
  }

  return -1;
}

function getHeaderIndexes(headers, names) {
  const indexes = [];
  (names || []).forEach(function(name) {
    const index = getHeaderIndex(headers, [name]);
    if (index !== -1 && indexes.indexOf(index) === -1) indexes.push(index);
  });
  return indexes;
}

function scheduledMaintenanceCheck() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getSpreadsheet();
    ensureWorkbook(ss);
    updateSettingsMotorHours(ss);
    getPeriodicMaintenanceStatus(ss);
    checkOilSampleAlerts(ss);
    checkAlternatorGreaseAlerts(ss);
    updateStatsSheet(ss);

    PropertiesService.getScriptProperties().setProperties({
      [MAINTENANCE_LAST_RUN_PROPERTY]: formatDateTime(new Date()),
      [MAINTENANCE_LAST_ERROR_PROPERTY]: ''
    });
  } catch (error) {
    PropertiesService.getScriptProperties().setProperties({
      [MAINTENANCE_LAST_RUN_PROPERTY]: formatDateTime(new Date()),
      [MAINTENANCE_LAST_ERROR_PROPERTY]: error.toString()
    });
    Logger.log('Bakim tetikleyici hatasi: ' + error.toString());
    Logger.log(error.stack || '');
    throw error;
  } finally {
    try {
      lock.releaseLock();
    } catch (lockError) {}
  }
}

function runMaintenanceCheck() {
  scheduledMaintenanceCheck();
  return jsonResponse(true, 'Bakim kontrolleri calistirildi');
}

function installMaintenanceTriggers() {
  removeProjectTriggersByHandler(['scheduledMaintenanceCheck']);

  const hourlyTrigger = ScriptApp.newTrigger('scheduledMaintenanceCheck')
    .timeBased()
    .everyHours(1)
    .create();
  const dailyTrigger = ScriptApp.newTrigger('scheduledMaintenanceCheck')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  scheduledMaintenanceCheck();

  return jsonResponse(true, 'Bakim tetikleyicileri kuruldu', {
    installed: true,
    triggerCount: 2,
    lastRun: PropertiesService.getScriptProperties().getProperty(MAINTENANCE_LAST_RUN_PROPERTY) || '',
    lastError: PropertiesService.getScriptProperties().getProperty(MAINTENANCE_LAST_ERROR_PROPERTY) || '',
    triggers: [{
      handler: hourlyTrigger.getHandlerFunction(),
      type: 'timeBased',
      interval: '1 saat'
    }, {
      handler: dailyTrigger.getHandlerFunction(),
      type: 'timeBased',
      interval: 'her gun 07:00'
    }]
  });
}

function removeMaintenanceTriggers() {
  const removed = removeProjectTriggersByHandler(['scheduledMaintenanceCheck']);
  return jsonResponse(true, 'Bakim tetikleyicileri kaldirildi', { removed: removed });
}

function getMaintenanceTriggers() {
  const props = PropertiesService.getScriptProperties();
  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === 'scheduledMaintenanceCheck';
    })
    .map(function(trigger) {
      return {
        handler: trigger.getHandlerFunction(),
        eventType: String(trigger.getEventType()),
        source: String(trigger.getTriggerSource()),
        id: trigger.getUniqueId ? trigger.getUniqueId() : ''
      };
    });

  return jsonResponse(true, 'Bakim tetikleyicileri getirildi', {
    installed: triggers.length > 0,
    triggerCount: triggers.length,
    lastRun: props.getProperty(MAINTENANCE_LAST_RUN_PROPERTY) || '',
    lastError: props.getProperty(MAINTENANCE_LAST_ERROR_PROPERTY) || '',
    lastLog: {
      kayitZamani: props.getProperty(MAINTENANCE_LAST_RUN_PROPERTY) || '',
      hataMesaji: props.getProperty(MAINTENANCE_LAST_ERROR_PROPERTY) || ''
    },
    triggers: triggers
  });
}

function removeProjectTriggersByHandler(handlerNames) {
  const names = handlerNames || [];
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (names.indexOf(trigger.getHandlerFunction()) === -1) return;
    ScriptApp.deleteTrigger(trigger);
    removed++;
  });
  return removed;
}

function getMaintenanceStats(ss, params) {
  const records = readAllRecords(ss);
  const now = new Date();
  const monthKey = formatMonthKey(now);
  const technicians = {};
  let monthly = 0;
  let faults = 0;

  records.forEach(function(record) {
    if (formatMonthKey(parseDateTR(record.date)) === monthKey) monthly++;
    if (record.type === 'Ariza') faults++;
    if (record.technician) technicians[record.technician] = true;
  });

  const chartData = buildChartData(records, parseInt(getParam(params, 'period'), 10) || 6);
  return jsonResponse(true, 'Istatistikler getirildi', {
    stats: {
      total: records.length,
      monthly: monthly,
      faults: faults,
      technicians: Object.keys(technicians).length
    },
    chartData: chartData
  });
}

function getMaintenanceReport(ss, params) {
  const motorFilter = getParam(params, 'motor');
  const typeFilter = normalizeMainType(getParam(params, 'type'));
  const rawType = getParam(params, 'type');
  const range = parseInt(getParam(params, 'range'), 10) || 30;
  const start = new Date();
  start.setDate(start.getDate() - range);

  let records = readAllRecords(ss).filter(function(record) {
    const date = parseDateTR(record.date);
    if (date && date < start) return false;
    if (motorFilter && record.motor !== motorFilter) return false;
    if (rawType && record.type !== typeFilter) return false;
    return true;
  });

  const summary = { total: records.length, periodic: 0, normal: 0, fault: 0 };
  records.forEach(function(record) {
    if (record.type === 'Periyodik') summary.periodic++;
    else if (record.type === 'Ariza') summary.fault++;
    else summary.normal++;
  });

  return jsonResponse(true, 'Rapor olusturuldu', { summary: summary, records: records });
}

function getActiveRecords(ss, params) {
  const motorFilter = getParam(params, 'motor');
  const rawType = getParam(params, 'type');
  const typeFilter = rawType ? normalizeMainType(rawType) : '';

  const records = readAllRecords(ss).filter(function(record) {
    if (record.status !== 'Aktif') return false;
    if (motorFilter && record.motor !== motorFilter) return false;
    if (typeFilter && record.type !== typeFilter) return false;
    return true;
  });

  return jsonResponse(true, 'Aktif kayitlar getirildi', { records: records });
}

function closeRecord(ss, params) {
  const recordNo = getParam(params, 'recordNo');
  if (!recordNo) return jsonResponse(false, 'Kayit numarasi eksik');

  const sheets = getSheetDefinitions();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = ss.getSheetByName(sheets[i].name);
    if (!sheet || sheet.getLastRow() < 2) continue;

    const headers = getSheetHeaders(sheet);
    const recordNoColumn = headers.indexOf('Kayit No') + 1;
    const statusColumn = headers.indexOf('Durum') + 1;
    const closedAtColumn = headers.indexOf('Kapama Zamani') + 1;
    if (!recordNoColumn || !statusColumn || !closedAtColumn) continue;

    const values = sheet.getRange(2, recordNoColumn, sheet.getLastRow() - 1, 1).getValues();
    for (let r = 0; r < values.length; r++) {
      if (String(values[r][0]) === recordNo) {
        const row = r + 2;
        sheet.getRange(row, statusColumn).setValue('Kapali');
        sheet.getRange(row, closedAtColumn).setValue(formatDateTime(new Date()));
        updateStatsSheet(ss);
        return jsonResponse(true, 'Kayit kapatildi', { recordNo: recordNo });
      }
    }
  }

  return jsonResponse(false, 'Kayit bulunamadi: ' + recordNo);
}

function readAllRecords(ss) {
  const records = [];
  getSheetDefinitions().forEach(function(definition) {
    const sheet = ss.getSheetByName(definition.name);
    if (!sheet || sheet.getLastRow() < 2) return;

    const headers = getSheetHeaders(sheet);
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues();
    rows.forEach(function(row) {
      const value = function(header) {
        const index = headers.indexOf(header);
        return index === -1 ? '' : row[index];
      };
      if (!value('Kayit No')) return;
      records.push({
        recordNo: value('Kayit No'),
        date: value('Tarih'),
        time: value('Saat'),
        motor: value('Motor'),
        type: value('Bakim Ana Turu'),
        subtype: value('Bakim Alt Turu'),
        company: value('Destek Tipi'),
        technician: value('Sorumlu'),
        status: value('Durum'),
        notes: value('Aciklama'),
        files: value('Dosyalar'),
        timestamp: value('Kayit Zamani'),
        closedAt: value('Kapama Zamani'),
        currentHours: value('Guncel Motor Saati'),
        startDate: value('Baslangic Tarihi'),
        startTime: value('Baslangic Saati'),
        endDate: value('Bitis Tarihi'),
        endTime: value('Bitis Saati'),
        operation: value('Bakim Alt Turu') || value('Aciklama'),
        sheetName: definition.name
      });
    });
  });

  records.sort(function(a, b) {
    return parseDateTimeTR(b.date, b.time) - parseDateTimeTR(a.date, a.time);
  });
  return records;
}

function getSheetHeaders(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].filter(function(header) {
    return String(header || '').trim() !== '';
  });
}

function buildChartData(records, period) {
  const labels = [];
  const periodic = [];
  const normal = [];
  const fault = [];
  const now = new Date();

  for (let i = period - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = formatMonthKey(date);
    labels.push((date.getMonth() + 1) + '/' + date.getFullYear());
    periodic.push(0);
    normal.push(0);
    fault.push(0);

    records.forEach(function(record) {
      if (formatMonthKey(parseDateTR(record.date)) !== key) return;
      if (record.type === 'Periyodik') periodic[periodic.length - 1]++;
      else if (record.type === 'Ariza') fault[fault.length - 1]++;
      else normal[normal.length - 1]++;
    });
  }

  return {
    labels: labels,
    periodic: periodic,
    normal: normal,
    fault: fault,
    data: periodic.map(function(value, index) {
      return value + normal[index] + fault[index];
    })
  };
}

function updateStatsSheet(ss) {
  const stats = buildChartData(readAllRecords(ss), 12);
  const sheet = ensureStatsSheet(ss);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).clearContent();
  }
  const rows = stats.labels.map(function(label, index) {
    return [
      label,
      stats.data[index],
      stats.periodic[index],
      stats.normal[index],
      stats.fault[index],
      '',
      '',
      ''
    ];
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, 8).setValues(rows);
}

function uploadFilesIfPresent(params, mainType, motor, subtype, expectedFileCount) {
  const filesParam = getParam(params, 'files');
  if (!filesParam || filesParam === '[]' || filesParam === 'undefined') {
    return expectedFileCount > 0 ? 'Dosya secildi ancak files parametresi bos geldi' : '';
  }

  try {
    const files = JSON.parse(filesParam);
    if (!Array.isArray(files) || !files.length) return '';

    const folderResult = getUploadFolder(mainType);
    if (!folderResult.success) return folderResult.error;

    const folder = folderResult.folder;
    const links = [];
    const errors = [];

    files.forEach(function(file) {
      try {
        if (!file.base64) {
          errors.push((file.name || 'dosya') + ': base64 veri yok');
          return;
        }

        const base64 = String(file.base64).indexOf(',') !== -1 ? String(file.base64).split(',')[1] : file.base64;
        const bytes = Utilities.base64Decode(base64);
        const name = [motor, subtype, formatDateTime(new Date()).replace(/[:. ]/g, '-'), file.name || 'dosya'].join('_');
        const blob = Utilities.newBlob(bytes, file.type || 'application/octet-stream', name);
        const driveFile = folder.createFile(blob);
        const sharingNote = setFileSharingSafely(driveFile);
        links.push(driveFile.getName() + ': ' + driveFile.getUrl() + sharingNote);
      } catch (fileError) {
        errors.push((file.name || 'dosya') + ': ' + fileError.toString());
      }
    });

    if (links.length && errors.length) return links.concat(['Hatalar: ' + errors.join(' | ')]).join('\n');
    if (links.length) return links.join('\n');
    if (errors.length) return 'Dosya yuklenemedi: ' + errors.join(' | ');
    return 'Dosya secildi ancak yuklenecek veri bulunamadi';
  } catch (error) {
    Logger.log('Dosya yukleme hatasi: ' + error.toString());
    return 'Dosya yukleme hatasi: ' + error.toString();
  }
}

function getUploadFolder(mainType) {
  const folderId = mainType === 'Periyodik'
    ? DRIVE_FOLDERS.PERIODIC
    : mainType === 'Ariza'
      ? DRIVE_FOLDERS.FAULT
      : DRIVE_FOLDERS.NORMAL;

  try {
    return { success: true, folder: DriveApp.getFolderById(folderId), source: 'configured' };
  } catch (configuredError) {
    try {
      const folderName = 'Bakim Takip Dosyalari';
      const folders = DriveApp.getFoldersByName(folderName);
      const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
      return { success: true, folder: folder, source: 'fallback', configuredError: configuredError.toString() };
    } catch (fallbackError) {
      return {
        success: false,
        error: 'Drive erisimi yok. Apps Script editorunde testDriveAccess fonksiyonunu calistirip Drive iznini onaylayin. Hata: ' + fallbackError.toString()
      };
    }
  }
}

function setFileSharingSafely(driveFile) {
  if (!ENABLE_PUBLIC_FILE_SHARING) return '';

  try {
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return '';
  } catch (sharingError) {
    return ' (paylasim ayari yapilamadi: ' + sharingError.toString() + ')';
  }
}

function testDriveAccess() {
  const checks = {};
  Object.keys(DRIVE_FOLDERS).forEach(function(key) {
    try {
      const folder = DriveApp.getFolderById(DRIVE_FOLDERS[key]);
      checks[key] = {
        success: true,
        folderId: DRIVE_FOLDERS[key],
        folderName: folder.getName()
      };
    } catch (error) {
      checks[key] = {
        success: false,
        folderId: DRIVE_FOLDERS[key],
        error: error.toString()
      };
    }
  });

  try {
    const fallback = getUploadFolder('Normal');
    checks.fallback = {
      success: fallback.success,
      folderName: fallback.folder ? fallback.folder.getName() : '',
      error: fallback.error || fallback.configuredError || ''
    };
  } catch (error) {
    checks.fallback = { success: false, error: error.toString() };
  }

  return jsonResponse(true, 'Drive erisim testi tamamlandi', { checks: checks });
}

function parseNumber(value) {
  if (value === null || typeof value === 'undefined' || value === '') return 0;
  if (typeof value === 'number') return value;

  let text = String(value).trim();
  if (text.indexOf(',') !== -1) text = text.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(text);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDateTR(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.indexOf('-') !== -1) {
    const p = text.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }
  const parts = text.split('.');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
}

function parseDateTimeTR(dateValue, timeValue) {
  const date = parseDateTR(dateValue) || new Date(0);
  const timeParts = String(timeValue || '00:00').split(':');
  date.setHours(parseInt(timeParts[0] || '0', 10), parseInt(timeParts[1] || '0', 10), 0, 0);
  return date;
}

function formatMonthKey(date) {
  if (!date || isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function formatDate(date) {
  return String(date.getDate()).padStart(2, '0') + '.' +
    String(date.getMonth() + 1).padStart(2, '0') + '.' +
    date.getFullYear();
}

function formatTime(date) {
  return String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0');
}

function formatDateTime(date) {
  return formatDate(date) + ' ' + formatTime(date) + ':' + String(date.getSeconds()).padStart(2, '0');
}

function jsonResponse(success, message, data) {
  const response = {
    success: success,
    message: message,
    timestamp: formatDateTime(new Date())
  };
  if (data) Object.assign(response, data);

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
