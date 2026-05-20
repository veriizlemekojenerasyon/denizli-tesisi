// 🔥 GLOBAL MESAJ GÖSTER FONKSİYONU
function showMessage(message, type) {
    // Mevcut mesajları temizle
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    // Yeni mesaj oluştur
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Stiller
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
    `;
    
    // Renkler
    const colors = {
        success: 'linear-gradient(135deg, #28a745, #20c997)',
        error: 'linear-gradient(135deg, #dc3545, #c82333)',
        warning: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
        info: 'linear-gradient(135deg, #17a2b8, #138496)'
    };
    
    messageDiv.style.background = colors[type] || colors.info;
    document.body.appendChild(messageDiv);
    
    // 3 saniye sonra kaldır
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// 🔥 GLOBAL DEĞİŞKENLER
let cachedRecords = [];
let recordMap = new Map();
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

// 🚀 ARKA PLAN KAYIT SİSTEMİ
let kayitKuyrugu = [];
let islemSirasi = 0;
let kayitIslemiDevamEdiyor = false;
const MAX_PARALEL_KAYIT = 3; // Aynı anda max 3 kayıt

// 🔥 GLOBAL MOTOR DEĞİŞKENİ
let selectedMotor = 'GM-1'; // Varsayılan motor

// � Giriş yapan kullanıcının adını al
function getCurrentUserName() {
    try {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (!loggedInUser) return 'Admin';
        const user = JSON.parse(loggedInUser);
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        return fullName || user.email || 'Admin';
    } catch (e) {
        console.error('Kullanıcı adı okunamadı:', e);
        return 'Admin';
    }
}

// 🔍 MOTORUN SON KAYDINI GETİR (Motor Çalışmıyor için)
async function getLastRecordForMotor(motor) {
    try {
        let motorRecords = [];
        
        // Önce cache'den dene
        if (cachedRecords.length > 0) {
            motorRecords = cachedRecords.filter(record => 
                record.motor === motor && 
                record.durum !== 'MOTOR ÇALIŞMIYOR' // Sadece normal kayıtları al
            );
        }
        
        // Cache'de yoksa API'den çek
        if (motorRecords.length === 0) {
            console.log(`⚡ Cache'de kayıt yok, API'den çekiliyor: ${motor}`);
            const result = await getMotorRecordsByMotorAndDate(motor, document.getElementById('tarihSecimi')?.value || '');
            if (result.success && result.data) {
                motorRecords = result.data.filter(record => 
                    record.durum !== 'MOTOR ÇALIŞMIYOR'
                );
            }
        }
        
        if (motorRecords.length === 0) {
            console.log(`⚠️ ${motor} için normal kayıt bulunamadı`);
            return null;
        }
        
        // Tarih ve saate göre sırala (en son kayıt)
        motorRecords.sort((a, b) => {
            const dateA = parseDateTime(a.tarih, a.saat);
            const dateB = parseDateTime(b.tarih, b.saat);
            return dateB - dateA; // En son kayıt önce
        });
        
        const lastRecord = motorRecords[0];
        console.log(`✅ ${motor} için son kayıt bulundu:`, lastRecord);
        return lastRecord;
        
    } catch (error) {
        console.error('Son kayıt getirme hatası:', error);
        return null;
    }
}

// 📅 Tarih ve saat string'ini Date objesine çevir
function parseDateTime(tarih, saat) {
    try {
        // Tarih formatı: DD.MM.YYYY
        const [day, month, year] = tarih.split('.');
        // Saat formatı: HH:00
        const [hour, minute] = saat.split(':');
        
        return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute || 0)
        );
    } catch (error) {
        console.error('Tarih parse hatası:', error);
        return new Date();
    }
}

// ⚡ KAYIT KONTROLÜ - GLOBAL
async function checkExistingRecord(motor, tarih, saat) {
    try {
        // 🔥 ULTRA HIZLI KONTROL - Map'den ara (O(1) complexity)
        const now = Date.now();
        if (now - cacheTimestamp < CACHE_DURATION) {
            const mapKey = `${motor}|${tarih}|${saat}`;
            const cached = recordMap.get(mapKey);
            if (cached) {
                console.log('⚡ Ultra hızlı Map hit!');
                return cached;
            }
        }
        
        // Cache'de yoksa Google Sheets'den kontrol et
        const result = await checkExistingMotorRecord(motor, tarih, saat);
        if (result.success && result.exists) {
            // Cache'e ve Map'e ekle
            cachedRecords.push(result.record);
            const mapKey = `${result.record.motor}|${result.record.tarih}|${result.record.saat}`;
            recordMap.set(mapKey, result.record);
            return result.record;
        }
        return null;
    } catch (error) {
        console.error('Kayıt kontrolü hatası:', error);
        return null;
    }
}

// � GLOBAL loadVardiyaData FONKSİYONU
async function loadVardiyaData() {
    const vardiya = vardiyaSecimi.value;
    const tarih = tarihSecimi.value;
    const motor = selectedMotor; // Seçili motoru al
    
    if (!vardiya || !tarih || !motor) return;
    
    try {
        console.log(`📊 ${motor} motoru için ${tarih} tarih ${vardiya} vardiya verileri yükleniyor...`);
        console.log(`🔍 Parametreler: motor=${motor}, tarih=${tarih}, vardiya=${vardiya}`);
        
        // 🔥 ENERJİ VERİLERİNDEKİ GİBİ TÜM KAYITLARI ÇEK
        const result = await getAllMotorRecords();
        console.log(`📊 API sonucu:`, result);
        
        if (!result.success) {
            console.error('❌ Veriler yüklenemedi:', result.error);
            console.error('❌ Hata detayı:', JSON.stringify(result));
            return;
        }
        
        const allRecords = result.data;
        console.log(`📊 Toplam kayıt sayısı: ${allRecords ? allRecords.length : 0}`);
        
        // 🔥 TARİH VE VARDİYA FİLTRELEME (ENERJİ VERİLERİNDEKİ GİBİ)
        let searchTarih = tarih;
        if (searchTarih.includes('-')) { 
            const parts = searchTarih.split('-'); 
            searchTarih = `${parts[2]}.${parts[1]}.${parts[0]}`; 
        }
        
        console.log('🔍 Arama tarihi:', searchTarih);
        
        const filtered = allRecords.filter(r => {
            const matchTarih = (r.tarih || '') === searchTarih;
            const matchVardiya = kayitVardiyaAraligindaMi(r.saat || '', vardiya);
            const matchMotor = (r.motor || '') === motor;
            
            // Debug log
            if (!matchTarih || !matchVardiya || !matchMotor) {
                console.log(`🔍 Filtre - Kayıt:`, r.tarih, r.saat, r.motor, `| matchTarih:${matchTarih} matchVardiya:${matchVardiya} matchMotor:${matchMotor}`);
            }
            
            return matchTarih && matchVardiya && matchMotor;
        });
        
        console.log(`🔍 Filtrelenmiş kayıtlar:`, filtered);
        console.log(`🔍 Filtrelenmiş kayıt sayısı: ${filtered.length}`);
        
        // İlk 3 kayıt örneği
        if (allRecords.length > 0) {
            console.log(`🔍 İlk 3 kayıt örneği:`, allRecords.slice(0, 3).map(r => ({tarih: r.tarih, saat: r.saat, motor: r.motor})));
        }
        
        const tbody = document.getElementById('vardiyaTableBody');
        const noDataMessage = document.getElementById('noDataMessage');
        
        if (!tbody) {
            console.error('❌ vardiyaTableBody bulunamadı!');
            return;
        }
        
        // Mevcut satırları temizle
        tbody.innerHTML = '';
        
        if (noDataMessage) noDataMessage.style.display = 'none';
        
        // 🔥 VARDİYA SAAT ARALIĞINI GÜNCELLE
        const vardiyaAraliklari = {
            '08-16': { basla: '08:00', bit: '16:00' },
            '16-24': { basla: '16:00', bit: '24:00' },
            '24-08': { basla: '00:00', bit: '08:00' }
        };
        
        const aralik = vardiyaAraliklari[vardiya];
        const saatAraligiElement = document.getElementById('saatAraligi');
        const vardiyaBadgeElement = document.getElementById('vardiyaBadge');
        
        if (saatAraligiElement && aralik) {
            saatAraligiElement.textContent = `${aralik.basla} - ${aralik.bit}`;
        }
        
        if (vardiyaBadgeElement) {
            vardiyaBadgeElement.textContent = vardiya;
        }
        
        if (!filtered.length) { 
            if (noDataMessage) { 
                noDataMessage.textContent = `${motor} motoru için bu vardiya saat aralığında henüz kayıt bulunmamaktadır.`; 
                noDataMessage.style.display = 'block'; 
            }
            return;
        }
        
        // 🔥 SAATE GÖRE SIRALA
        filtered.sort((a, b) => (getSaatDegeri(a.saat) || 0) - (getSaatDegeri(b.saat) || 0));
        
        // 🔥 MOTOR ÇALIŞMIYOR KAYITLARI İÇİN SON NORMAL KAYITLARI BUL
        const sonNormalKayitlar = {};
        filtered.forEach(record => {
            if (record.durum !== 'MOTOR ÇALIŞMIYOR') {
                const motor = record.motor;
                const recDateTime = parseDateTime(record.tarih, record.saat);
                if (!sonNormalKayitlar[motor] || parseDateTime(sonNormalKayitlar[motor].tarih, sonNormalKayitlar[motor].saat) < recDateTime) {
                    sonNormalKayitlar[motor] = record;
                }
            }
        });
        
        // 🔥 TABLOYU DOLDUR
        filtered.forEach(record => {
            const row = document.createElement('tr');
            if (record.durum === 'MOTOR ÇALIŞMIYOR') row.classList.add('motor-calismiyor');
            
            // 🔥 MOTOR ÇALIŞMIYOR ise son değerleri kullan
            let jenYatakSicaklikDE = record.jenYatakSicaklikDE || '-';
            let jenYatakSicaklikNDE = record.jenYatakSicaklikNDE || '-';
            let sogutmaSuyuSicaklik = record.sogutmaSuyuSicaklik || '-';
            let sogutmaSuyuBasinc = record.sogutmaSuyuBasinc || '-';
            let yagSicaklik = record.yagSicaklik || '-';
            let yagBasinc = record.yagBasinc || '-';
            let sarjSicaklik = record.sarjSicaklik || '-';
            let sarjBasinc = record.sarjBasinc || '-';
            let gazRegulatoru = record.gazRegulatoru || '-';
            let makineDairesiSicaklik = record.makineDairesiSicaklik || '-';
            let karterBasinc = record.karterBasinc || '-';
            let onKamaraFarkBasinc = record.onKamaraFarkBasinc || '-';
            let sargiSicaklik1 = record.sargiSicaklik1 || '-';
            let sargiSicaklik2 = record.sargiSicaklik2 || '-';
            let sargiSicaklik3 = record.sargiSicaklik3 || '-';
            
            if (record.durum === 'MOTOR ÇALIŞMIYOR' && sonNormalKayitlar[record.motor]) {
                const sonKayit = sonNormalKayitlar[record.motor];
                jenYatakSicaklikDE = sonKayit.jenYatakSicaklikDE || '-';
                jenYatakSicaklikNDE = sonKayit.jenYatakSicaklikNDE || '-';
                sogutmaSuyuSicaklik = sonKayit.sogutmaSuyuSicaklik || '-';
                sogutmaSuyuBasinc = sonKayit.sogutmaSuyuBasinc || '-';
                yagSicaklik = sonKayit.yagSicaklik || '-';
                yagBasinc = sonKayit.yagBasinc || '-';
                sarjSicaklik = sonKayit.sarjSicaklik || '-';
                sarjBasinc = sonKayit.sarjBasinc || '-';
                gazRegulatoru = sonKayit.gazRegulatoru || '-';
                makineDairesiSicaklik = sonKayit.makineDairesiSicaklik || '-';
                karterBasinc = sonKayit.karterBasinc || '-';
                onKamaraFarkBasinc = sonKayit.onKamaraFarkBasinc || '-';
                sargiSicaklik1 = sonKayit.sargiSicaklik1 || '-';
                sargiSicaklik2 = sonKayit.sargiSicaklik2 || '-';
                sargiSicaklik3 = sonKayit.sargiSicaklik3 || '-';
            }
            
            row.innerHTML = `
                <td>${record.saat || '-'}</td>
                <td>${record.motor || '-'}</td>
                <td>${jenYatakSicaklikDE}</td>
                <td>${jenYatakSicaklikNDE}</td>
                <td>${sogutmaSuyuSicaklik}</td>
                <td>${sogutmaSuyuBasinc}</td>
                <td>${yagSicaklik}</td>
                <td>${yagBasinc}</td>
                <td>${sarjSicaklik}</td>
                <td>${sarjBasinc}</td>
                <td>${gazRegulatoru}</td>
                <td>${makineDairesiSicaklik}</td>
                <td>${karterBasinc}</td>
                <td>${onKamaraFarkBasinc}</td>
                <td>${sargiSicaklik1}</td>
                <td>${sargiSicaklik2}</td>
                <td>${sargiSicaklik3}</td>
                <td class="${record.durum === 'MOTOR ÇALIŞMIYOR' ? 'durum-calismiyor' : 'durum-normal'}">${record.durum === 'MOTOR ÇALIŞMIYOR' ? 'ÇALIŞMIYOR' : 'NORMAL'}</td>
            `;
            tbody.appendChild(row);
        });
        
        console.log(`✅ ${filtered.length} kayıt yüklendi`);
        
    } catch (error) {
        console.error('Vardiya verileri yüklenirken hata:', error);
    }
}

// 🔄 YARDIMCI FONKSİYONLAR (GLOBAL)
function kayitVardiyaAraligindaMi(saat, vardiya) {
    const aralik = {
        '08-16': { basla: '08:00', bit: '16:00' },
        '16-24': { basla: '16:00', bit: '24:00' },
        '24-08': { basla: '00:00', bit: '08:00' }
    };
    
    if (!aralik[vardiya]) return false;
    
    const saatDegeri = getSaatDegeri(saat);
    const baslaDegeri = getSaatDegeri(aralik[vardiya].basla);
    const bitDegeri = getSaatDegeri(aralik[vardiya].bit);
    
    return saatDegeri >= baslaDegeri && saatDegeri < bitDegeri;
}

function getSaatDegeri(saat) {
    if (!saat) return 0;
    const [saatStr] = saat.split(':');
    return parseInt(saatStr) || 0;
}

// � ARKA PLAN KAYIT SİSTEMİ FONKSİYONLARI

// Kayıt kuyruğuna yeni işlem ekle
function kayitKuyrugunaEkle(kayitVerisi) {
    const islem = {
        id: ++islemSirasi,
        ...kayitVerisi,
        durum: 'beklemede',
        baslangicZamani: null,
        bitisZamani: null,
        hata: null
    };
    
    kayitKuyrugu.push(islem);
    console.log(`📝 Kayıt kuyruğa eklendi: #${islem.id} - ${islem.motor} - ${islem.saat}`);
    
    // Arka plan işlemi başlat
    if (!kayitIslemiDevamEdiyor) {
        arkaPlanKayitIsleminiBaslat();
    }
    
    return islem.id;
}

// Arka plan kayıt işlemini başlat
async function arkaPlanKayitIsleminiBaslat() {
    if (kayitIslemiDevamEdiyor || kayitKuyrugu.length === 0) {
        return;
    }
    
    kayitIslemiDevamEdiyor = true;
    console.log('🚀 Arka plan kayıt işlemi başlatıldı...');
    
    let successCount = 0;
    let errorCount = 0;
    
    while (kayitKuyrugu.length > 0) {
        // Bekleyen işlemleri al (max paralel)
        const yapilacakIslemler = kayitKuyrugu
            .filter(islem => islem.durum === 'beklemede')
            .slice(0, MAX_PARALEL_KAYIT);
        
        if (yapilacakIslemler.length === 0) {
            break;
        }
        
        console.log(`🔄 ${yapilacakIslemler.length} işlem sıralı başlatılıyor...`);
        console.log(`📊 İşlem saatleri:`, yapilacakIslemler.map(i => i.saat));
        
        // İşlemleri sıralı çalıştır (saat sırası korunur)
        for (const islem of yapilacakIslemler) {
            try {
                console.log(`🔄 İşlem başlatılıyor: #${islem.id} - ${islem.motor} - ${islem.saat}`);
                const sonuc = await tekilKayitYap(islem);
                
                if (sonuc.status === 'success') {
                    islem.durum = 'basarili';
                    islem.bitisZamani = new Date();
                    successCount++;
                    console.log(`✅ İşlem tamamlandı: #${islem.id} - ${islem.motor} - ${islem.saat}`);
                } else {
                    islem.durum = 'hatali';
                    islem.bitisZamani = new Date();
                    islem.hata = sonuc.error || 'Bilinmeyen hata';
                    errorCount++;
                    console.log(`❌ İşlem hatalı: #${islem.id} - ${islem.motor} - ${islem.saat} - ${islem.hata}`);
                }
            } catch (error) {
                islem.durum = 'hatali';
                islem.bitisZamani = new Date();
                islem.hata = error.message;
                errorCount++;
                console.log(`💀 İşlem hatası: #${islem.id} - ${islem.motor} - ${islem.saat} - ${error.message}`);
            }
        }
        
        // Tamamlanan işlemleri kuyruktan temizle
        kayitKuyrugu = kayitKuyrugu.filter(islem => islem.durum === 'beklemede');
        
        // Kısa bekleme (API limitleri için)
        if (kayitKuyrugu.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    kayitIslemiDevamEdiyor = false;
    console.log('🏁 Arka plan kayıt işlemi tamamlandı');
    console.log(`📊 Sonuç: ${successCount} başarılı, ${errorCount} hatalı`);
    
    // Verileri yenile
    loadVardiyaData();
}

// Tekil kayıt yap
async function tekilKayitYap(islem) {
    islem.durum = 'isleniyor';
    islem.baslangicZamani = Date.now();
    
    try {
        const sonuc = await saveMotorToSheets({
            motor: islem.motor,
            tarih: islem.tarih,
            vardiya: islem.vardiya,
            saat: islem.saat,
            kaydeden: islem.kaydeden,
            durum: 'MOTOR ÇALIŞMIYOR',
            not: islem.not,
            // Son kayıt değerleri (doğru alanlar)
            jenYatakSicaklikDE: islem.sonKayit?.jenYatakSicaklikDE || '0',
            jenYatakSicaklikNDE: islem.sonKayit?.jenYatakSicaklikNDE || '0',
            sogutmaSuyuSicaklik: islem.sonKayit?.sogutmaSuyuSicaklik || '0',
            sogutmaSuyuBasinc: islem.sonKayit?.sogutmaSuyuBasinc || '0',
            yagSicaklik: islem.sonKayit?.yagSicaklik || '0',
            yagBasinc: islem.sonKayit?.yagBasinc || '0',
            sarjSicaklik: islem.sonKayit?.sarjSicaklik || '0',
            sarjBasinc: islem.sonKayit?.sarjBasinc || '0',
            gazRegulatoru: islem.sonKayit?.gazRegulatoru || '0',
            makineDairesiSicaklik: islem.sonKayit?.makineDairesiSicaklik || '0',
            karterBasinc: islem.sonKayit?.karterBasinc || '0',
            onKamaraFarkBasinc: islem.sonKayit?.onKamaraFarkBasinc || '0',
            sargiSicaklik1: islem.sonKayit?.sargiSicaklik1 || '0',
            sargiSicaklik2: islem.sonKayit?.sargiSicaklik2 || '0',
            sargiSicaklik3: islem.sonKayit?.sargiSicaklik3 || '0'
        });
        
        if (!sonuc || !sonuc.success) {
            throw new Error(sonuc?.error || 'Kayıt başarısız');
        }
        
        return { success: true, islem };
        
    } catch (error) {
        console.error(`Tekil kayıt hatası #${islem.id}:`, error);
        throw error;
    }
}

// Kayıt durumunu göster
function kayitDurumunuGoster() {
    const bekleyen = kayitKuyrugu.filter(i => i.durum === 'beklemede').length;
    const islenen = kayitKuyrugu.filter(i => i.durum === 'isleniyor').length;
    const tamamlanan = kayitKuyrugu.filter(i => i.durum === 'tamamlandi').length;
    const hatali = kayitKuyrugu.filter(i => i.durum === 'hata').length;
    
    if (bekleyen > 0 || islenen > 0) {
        showMessage(`📊 Kayıt durumu: ${bekleyen} bekleyen, ${islenen} işleniyor, ${tamamlanan} tamamlandı, ${hatali} hatalı`, 'info');
    }
}

// Kimlik dogrulama kontrolü
function checkAuth() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        window.location.href = 'anasayfa.html';
        return;
    }
    
    try {
        const user = JSON.parse(loggedInUser);
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // Tüm userNameDisplay elementlerini güncelle
        const allUserNameDisplays = document.querySelectorAll('[id="userNameDisplay"]');
        
        allUserNameDisplays.forEach((element, index) => {
            element.textContent = fullName || user.email || 'Kullanici';
        });
        
        console.log('Kojen Motor Veri - Kullanici adi ayarlandi:', fullName || user.email || 'Kullanici');
    } catch (e) {
        console.error('Kojen Motor Veri - Kullanici bilgileri okunamadi:', e);
        const allElements = document.querySelectorAll('[id="userNameDisplay"]');
        allElements.forEach(element => {
            element.textContent = 'Kullanici';
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Önce kimlik dogrulama kontrolü
    checkAuth();
    
    // 🔥 Vardiya verileri bölümünü göster
    showVardiyaVerileriSection();
    
    // Elementleri seç
    const tarihSecimi = document.getElementById('tarihSecimi');
    const vardiyaSecimi = document.getElementById('vardiyaSecimi');
    const currentHourElement = document.getElementById('currentHour');
    
    // Motor seçim butonları
    const motorButtons = document.querySelectorAll('.motor-btn');
    
    // Butonlar
    const kaydetBtn = document.getElementById('kaydetBtn');
    const temizleBtn = document.getElementById('temizleBtn');
    const motorCalismiyorKaydetBtn = document.getElementById('motorCalismiyorKaydetBtn');
    
    // Çıkış butonları
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');

    // Form kilit durumu
    let isLocked = false; // Form kilit durumu

    // 🔒 BAŞLANGIÇTA TÜM FORM PASİF YAP
    disableAllFormElements();
    
    // ⚡ CACHE BAŞLAT
    setTimeout(() => refreshCache(), 100);
    
    // 🔍 1 SN SONRA KAYIT KONTROLÜ VE AÇ/KİLİTLE
    setTimeout(async () => {
        await checkAndUnlockOrLockForm();
    }, 1000);

    // Mevcut saati güncelleme fonksiyonu
    function updateCurrentHour() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        currentHourElement.textContent = `${hours}:00`;
    }

    // ⚡ SUPER HIZLI Local cache için kayıt verileri
    let cachedRecords = [];
    let cacheTimestamp = 0;
    const CACHE_DURATION = 300000; // 5 dakika cache (daha uzun)
    
    // 🔥 Memory Map için ultra hızlı arama
    let recordMap = new Map(); // motor|tarih|saat -> record
    
    // ⚡ Background cache yenileme timer
    let cacheRefreshTimer = null;

    
    // Cache'i yenile - ⚡ Optimize edilmiş
    async function refreshCache() {
        try {
            const result = await getAllMotorRecords();
            if (result.success) {
                cachedRecords = result.data;
                recordMap.clear(); // Map'i temizle
                
                // 🔥 Map'i hızlıca doldur
                result.data.forEach(record => {
                    const mapKey = `${record.motor}|${record.tarih}|${record.saat}`;
                    recordMap.set(mapKey, record);
                });
                
                cacheTimestamp = Date.now();
                console.log('⚡ Ultra hızlı cache yenilendi:', cachedRecords.length, 'kayıt, Map size:', recordMap.size);
                
                // ⚡ Background timer'ı başlat
                startBackgroundRefresh();
            }
        } catch (error) {
            console.error('Cache yenileme hatası:', error);
        }
    }

    // ⚡ Background cache yenileme - sessizce günceller
    function startBackgroundRefresh() {
        if (cacheRefreshTimer) {
            clearInterval(cacheRefreshTimer);
        }
        
        // 4 dakikada bir sessizce yenile
        cacheRefreshTimer = setInterval(async () => {
            try {
                const result = await getAllMotorRecords();
                if (result.success) {
                    cachedRecords = result.data;
                    recordMap.clear();
                    
                    result.data.forEach(record => {
                        const mapKey = `${record.motor}|${record.tarih}|${record.saat}`;
                        recordMap.set(mapKey, record);
                    });
                    
                    cacheTimestamp = Date.now();
                    console.log('🔄 Background cache güncellendi:', result.data.length, 'kayıt');
                }
            } catch (error) {
                console.error('Background cache hatası:', error);
            }
        }, 240000); // 4 dakika
    }

    // � VARDİYA VERİLERİ BÖLÜMÜNÜ GÖSTER
    function showVardiyaVerileriSection() {
        const vardiyaVerileriSection = document.getElementById('vardiyaVerileriSection');
        if (vardiyaVerileriSection) {
            vardiyaVerileriSection.style.display = 'block';
        }
    }

    // �� BAŞLANGIÇTA TÜM FORM PASİF YAP
    function disableAllFormElements() {
        console.log('🔒 Form başlangıçta pasif yapılıyor...');
        
        // Input'ları pasif yap
        const allInputs = document.querySelectorAll('.data-input');
        allInputs.forEach(input => {
            input.disabled = true;
            input.style.background = '#f5f5f5';
            input.style.cursor = 'not-allowed';
        });
        
        // Butonları pasif yap (AMA MOTOR ÇALIŞMIYOR BUTONUNU AKTİF TUT)
        const buttons = [kaydetBtn, temizleBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
        
        // 🔥 MOTOR ÇALIŞMIYOR BUTONUNU HER ZAMAN AKTİF TUT
        if (motorCalismiyorKaydetBtn) {
            motorCalismiyorKaydetBtn.disabled = false;
            motorCalismiyorKaydetBtn.style.opacity = '1';
            motorCalismiyorKaydetBtn.style.cursor = 'pointer';
        }
        
        // 🔥 MOTOR SEÇİM BUTONLARINI HER ZAMAN AKTIF TUT (BAŞLANGIÇTA DA)
        motorButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
    }
    
    // 🔓 TÜM FORM ELEMANLARINI AKTİF YAP (kayıt yoksa)
    function enableAllFormElements() {
        console.log('🔓 Form aktif yapılıyor...');
        
        // Input'ları aktif yap
        const allInputs = document.querySelectorAll('.data-input');
        allInputs.forEach(input => {
            input.disabled = false;
            input.style.background = 'white';
            input.style.cursor = 'text';
        });
        
        // Butonları aktif yap
        const buttons = [kaydetBtn, temizleBtn, motorCalismiyorKaydetBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
        
        // Motor seçim butonlarını aktif yap
        motorButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
        
        showMessage('Yeni kayıt yapabilirsiniz.', 'success');
    }
    
    // 🔍 KAYIT KONTROLÜ SONRASI AÇ/KİLİTLE MANTIĞI
    async function checkAndUnlockOrLockForm() {
        if (!selectedMotor || !tarihSecimi?.value || !currentHourElement?.textContent) {
            console.log('Kontrol: Eksik parametre');
            enableAllFormElements(); // Eksikse yine de aç
            return;
        }
        
        try {
            const saat = currentHourElement.textContent.trim();
            const existingRecord = await checkExistingRecord(selectedMotor, tarihSecimi.value, saat);
            
            if (existingRecord) {
                // 🔒 KAYIT VAR - Form kilitli kalır, veriler yüklenir
                console.log('🔒 Kayıt bulundu, form kilitli:', existingRecord);
                lockForm(false);
                loadExistingRecord(existingRecord);
                showMessage(`Mevcut kayıt yüklendi: ${existingRecord.durum || 'NORMAL'}`, 'info');
            } else {
                // 🔓 KAYIT YOK - Form açılır
                console.log('🔓 Kayıt yok, form açılıyor');
                enableAllFormElements();
            }
        } catch (error) {
            console.error('Kontrol hatası:', error);
            enableAllFormElements(); // Hata durumunda yine de aç
        }
    }

    // Tarih formatını düzeltme fonksiyonu (HTML input için)
    function formatTarihForInput(tarihStr) {
        // DD.MM.YYYY formatını YYYY-MM-DD formatına çevir
        if (tarihStr && tarihStr.includes('.')) {
            const parts = tarihStr.split('.');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        return tarihStr;
    }

    // Tarih formatını düzeltme fonksiyonu (gösterim için)
    function formatTarihForDisplay(tarihStr) {
        // YYYY-MM-DD formatını DD.MM.YYYY formatına çevir
        if (tarihStr && tarihStr.includes('-')) {
            const parts = tarihStr.split('-');
            if (parts.length === 3) {
                return `${parts[2]}.${parts[1]}.${parts[0]}`;
            }
        }
        return tarihStr;
    }

    // Otomatik tarih formatlama (nokta ekleme)
    function autoFormatTarih(input) {
        let value = input.value.replace(/\D/g, ''); // Sadece rakamları al
        let formattedValue = '';
        
        if (value.length >= 2) {
            formattedValue = value.substring(0, 2);
            if (value.length >= 4) {
                formattedValue += '.' + value.substring(2, 4);
                if (value.length >= 8) {
                    formattedValue += '.' + value.substring(4, 8);
                } else {
                    formattedValue += '.' + value.substring(4);
                }
            } else {
                formattedValue += '.' + value.substring(2);
            }
        } else {
            formattedValue = value;
        }
        
        input.value = formattedValue;
    }

    // Tarih validasyonu
    function validateTarih(tarihStr) {
        const regex = /^\d{2}\.\d{2}\.\d{4}$/;
        if (!regex.test(tarihStr)) return false;
        
        const parts = tarihStr.split('.');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        if (day < 1 || day > 31) return false;
        if (month < 1 || month > 12) return false;
        if (year < 1900 || year > 2100) return false;
        
        return true;
    }

    // ⚡ HIZLI Form kilitleme fonksiyonu
    function lockForm(showMessageFlag = true) {
        isLocked = true;
        
        // 🔥 Input'ları batch kilitle - daha hızlı
        const allInputs = document.querySelectorAll('.data-input');
        const calismiyorInputs = [];
        const normalInputs = [];
        
        allInputs.forEach(input => {
            input.disabled = true;
            input.style.cursor = 'not-allowed';
            
            if (input.getAttribute('data-calismiyor') === 'true') {
                calismiyorInputs.push(input);
            } else {
                normalInputs.push(input);
            }
        });
        
        // 🔥 Batch style güncelleme - daha performanslı
        if (calismiyorInputs.length > 0) {
            calismiyorInputs.forEach(input => {
                input.style.background = '#ffebee';
                input.style.color = '#c62828';
            });
        }
        
        if (normalInputs.length > 0) {
            normalInputs.forEach(input => {
                input.style.background = '#f8f9fa';
            });
        }
        
        // ⚡ Butonları hızlıca kilitle (AMA MOTOR SEÇİM BUTONLARINI AKTIF TUT)
        const buttons = [kaydetBtn, temizleBtn, motorCalismiyorKaydetBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
        motorCalismiyorKaydetBtn.style.opacity = '0.5';
        motorCalismiyorKaydetBtn.style.cursor = 'not-allowed';
        
        // 🔥 MOTOR SEÇİM BUTONLARINI HER ZAMAN AKTIF TUT
        motorButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
        
        // Sadece istendiğinde mesaj göster
        if (showMessageFlag) {
            showMessage('Bu tarih ve saat için kayıt zaten mevcut! Form kilitlendi.', 'error');
        }
    }

    // ⚡ HIZLI Form kilidini açma fonksiyonu
    function unlockForm() {
        isLocked = false;
        
        // 🔥 Input'ların kilidini batch aç
        const allInputs = document.querySelectorAll('.data-input');
        allInputs.forEach(input => {
            input.disabled = false;
            input.removeAttribute('data-calismiyor');
            input.style.background = 'white';
            input.style.color = '';
            input.style.cursor = 'text';
        });
        
        // ⚡ Butonların kilidini hızlıca aç
        const buttons = [kaydetBtn, temizleBtn, motorCalismiyorKaydetBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
        
        // 🔥 Motor seçim butonlarının kilidini aç
        motorButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.cursor = 'pointer';
        });
    }

    // 🔥 HIZLI Kayıt kontrolü ve form durumunu güncelleme - Cache ile
    async function checkAndUpdateFormStatus() {
        if (!selectedMotor || !tarihSecimi.value || !currentHourElement.textContent) {
            console.log('Form durumu: Eksik parametre', { selectedMotor, tarih: tarihSecimi.value, saat: currentHourElement.textContent });
            return;
        }
        
        console.log('🔥 Hızlı kayıt kontrolü yapılıyor:', { motor: selectedMotor, tarih: tarihSecimi.value, saat: currentHourElement.textContent });
        
        try {
            // ⚡ Önce cache'den kontrol et
            const existingRecord = await checkExistingRecord(selectedMotor, tarihSecimi.value, currentHourElement.textContent);
            
            if (existingRecord) {
                console.log('🔥 Cache hit - Kayıt bulundu, form kilitleniyor:', existingRecord);
                lockForm(false);
                loadExistingRecord(existingRecord);
                return;
            }
            
            console.log('🔥 Cache miss - Form açılıyor');
            unlockForm();
        } catch (error) {
            console.error('Form durumu güncelleme hatası:', error);
            unlockForm();
        }
    }

    // 🔥 Mevcut kaydı input'lara yükleme fonksiyonu
    function loadExistingRecord(existingRecord) {
        if (existingRecord.durum === 'MOTOR ÇALIŞMIYOR') {
            const allInputs = document.querySelectorAll('.data-input');
            allInputs.forEach(input => {
                input.value = '0';
                input.style.background = '#ffebee';
                input.style.color = '#c62828';
                input.setAttribute('data-calismiyor', 'true');
            });
        } else {
            // Normal verileri input'lara yükle - virgülü noktaya çevir
            document.getElementById('jenYatakSicaklikDE').value = (existingRecord.jenYatakSicaklikDE || '').replace(',', '.');
            document.getElementById('jenYatakSicaklikNDE').value = (existingRecord.jenYatakSicaklikNDE || '').replace(',', '.');
            document.getElementById('sogutmaSuyuSicaklik').value = (existingRecord.sogutmaSuyuSicaklik || '').replace(',', '.');
            document.getElementById('sogutmaSuyuBasinc').value = (existingRecord.sogutmaSuyuBasinc || '').replace(',', '.');
            document.getElementById('yagSicaklik').value = (existingRecord.yagSicaklik || '').replace(',', '.');
            document.getElementById('yagBasinc').value = (existingRecord.yagBasinc || '').replace(',', '.');
            document.getElementById('sarjSicaklik').value = (existingRecord.sarjSicaklik || '').replace(',', '.');
            document.getElementById('sarjBasinc').value = (existingRecord.sarjBasinc || '').replace(',', '.');
            document.getElementById('gazRegulatoru').value = (existingRecord.gazRegulatoru || '').replace(',', '.');
            document.getElementById('makineDairesiSicaklik').value = (existingRecord.makineDairesiSicaklik || '').replace(',', '.');
            document.getElementById('karterBasinc').value = (existingRecord.karterBasinc || '').replace(',', '.');
            document.getElementById('onKamaraFarkBasinc').value = (existingRecord.onKamaraFarkBasinc || '').replace(',', '.');
            document.getElementById('sargiSicaklik1').value = (existingRecord.sargiSicaklik1 || '').replace(',', '.');
            document.getElementById('sargiSicaklik2').value = (existingRecord.sargiSicaklik2 || '').replace(',', '.');
            document.getElementById('sargiSicaklik3').value = (existingRecord.sargiSicaklik3 || '').replace(',', '.');
            
            const allInputs = document.querySelectorAll('.data-input');
            allInputs.forEach(input => {
                input.removeAttribute('data-calismiyor');
                input.style.background = 'white';
                input.style.color = '';
            });
        }
    }

    // Tüm input'ları getir
    function getAllInputValues() {
        const inputs = {
            jenYatakSicaklikDE: document.getElementById('jenYatakSicaklikDE').value,
            jenYatakSicaklikNDE: document.getElementById('jenYatakSicaklikNDE').value,
            sogutmaSuyuSicaklik: document.getElementById('sogutmaSuyuSicaklik').value,
            sogutmaSuyuBasinc: document.getElementById('sogutmaSuyuBasinc').value,
            yagSicaklik: document.getElementById('yagSicaklik').value,
            yagBasinc: document.getElementById('yagBasinc').value,
            sarjSicaklik: document.getElementById('sarjSicaklik').value,
            sarjBasinc: document.getElementById('sarjBasinc').value,
            gazRegulatoru: document.getElementById('gazRegulatoru').value,
            makineDairesiSicaklik: document.getElementById('makineDairesiSicaklik').value,
            karterBasinc: document.getElementById('karterBasinc').value,
            onKamaraFarkBasinc: document.getElementById('onKamaraFarkBasinc').value,
            sargiSicaklik1: document.getElementById('sargiSicaklik1').value,
            sargiSicaklik2: document.getElementById('sargiSicaklik2').value,
            sargiSicaklik3: document.getElementById('sargiSicaklik3').value
        };
        
        return {
            motor: selectedMotor,
            tarih: tarihSecimi.value,
            vardiya: vardiyaSecimi.value,
            saat: currentHourElement.textContent,
            veriler: inputs
        };
    }

    // Motor butonu event listener'ları - Async güncelleme
    motorButtons.forEach(button => {
        button.addEventListener('click', async function() {
            // Active class'ını kaldır
            motorButtons.forEach(btn => btn.classList.remove('active'));
            // Tıklanana active class'ını ekle
            this.classList.add('active');
            // Seçili motoru güncelle
            selectedMotor = this.dataset.motor;
            
            // 🔥 TÜM INPUT'LARI TEMİZLE
            const allInputs = document.querySelectorAll('.data-input');
            allInputs.forEach(input => {
                input.value = '';
                input.style.background = 'white';
                input.style.color = '';
                input.removeAttribute('data-calismiyor');
                input.disabled = false;
            });
            
            // 🔥 VARDİYA TABLOSUNU SIFIRLA
            const tbody = document.getElementById('vardiyaTableBody');
            if (tbody) {
                tbody.innerHTML = '';
            }
            const noDataMessage = document.getElementById('noDataMessage');
            if (noDataMessage) {
                noDataMessage.style.display = 'block';
            }
            
            showMessage(`${selectedMotor} motoru seçildi!`, 'info');
            
            // Vardiya verilerini güncelle (seçili motor için)
            await loadVardiyaData();
            
            // Kayıt kontrolü yap (form durumunu güncelle)
            await checkAndUpdateFormStatus();
            
            // 🔥 KONTROL SONRASI INPUT'LARI TEKRAR AKTIF ET
            allInputs.forEach(input => {
                input.disabled = false;
                input.style.background = 'white';
                input.style.color = '';
            });
        });
    });

    // KAYDET butonu - Google Sheets'e kaydeder
    kaydetBtn.addEventListener('click', async function() {
        if (isLocked) {
            showMessage('Bu kayıt zaten mevcut!', 'error');
            return;
        }
        
        const data = getAllInputValues();
        
        if (!data.motor || !data.tarih || !data.vardiya) {
            showMessage('Lütfen motor, tarih ve vardiya seçin!', 'error');
            return;
        }
        
        // Tüm input'ların dolu olup olmadığını kontrol et
        const allInputs = document.querySelectorAll('.data-input');
        const emptyInputs = Array.from(allInputs).filter(input => !input.value);
        
        if (emptyInputs.length > 0) {
            showMessage('Lütfen tüm veri alanlarını doldurun!', 'error');
            return;
        }
        
        // Negatif değer kontrolü - Karter Basıncı ve Ön Kamara Fark Basıncı
        const karterBasinc = parseFloat(document.getElementById('karterBasinc').value);
        const onKamaraFarkBasinc = parseFloat(document.getElementById('onKamaraFarkBasinc').value);
        
        if (karterBasinc >= 0) {
            const onay = confirm(`Karter basıncı pozitif değer girildi (${karterBasinc}).\n\nNegatif olması bekleniyor. Yine de pozitif değeri kaydetmek istiyor musunuz?`);
            if (!onay) {
                document.getElementById('karterBasinc').value = -Math.abs(karterBasinc);
                showMessage('Karter basıncı otomatik olarak negatife çevrildi: ' + (-Math.abs(karterBasinc)), 'info');
                document.getElementById('karterBasinc').focus();
                return;
            }
        }
        
        if (onKamaraFarkBasinc >= 0) {
            const onay = confirm(`Ön kamara fark basıncı pozitif değer girildi (${onKamaraFarkBasinc}).\n\nNegatif olması bekleniyor. Yine de pozitif değeri kaydetmek istiyor musunuz?`);
            if (!onay) {
                document.getElementById('onKamaraFarkBasinc').value = -Math.abs(onKamaraFarkBasinc);
                showMessage('Ön kamara fark basıncı otomatik olarak negatife çevrildi: ' + (-Math.abs(onKamaraFarkBasinc)), 'info');
                document.getElementById('onKamaraFarkBasinc').focus();
                return;
            }
        }
        
        try {
            // 🔒 ÇİFT KAYIT KONTROLÜ - Butonu kilitlemeden önce yap
            const existingRecord = await checkExistingRecord(data.motor, data.tarih, data.saat);
            if (existingRecord) {
                showMessage(`Bu tarih, saat ve motor (${data.motor}) için kayıt zaten var!\nMevcut kayıt: ${existingRecord.durum || 'NORMAL'}`, 'error');
                return;
            }
            
            // Kaydet butonunu devre dışı bırak
            kaydetBtn.disabled = true;
            kaydetBtn.textContent = '💾 KAYDEDİLİYOR...';
            
            // Google Sheets'e kaydet
            const sheetsData = {
                ...data.veriler,
                motor: data.motor,
                tarih: data.tarih,
                vardiya: data.vardiya,
                saat: data.saat,
                kaydeden: getCurrentUserName(),
                durum: 'NORMAL'
            };
            
            const result = await saveMotorToSheets(sheetsData);
            
            if (result.success) {
                console.log('Google Sheets kaydı:', result);
                
                // 🔥 CACHE'I GÜNCELLE - Yeni kayıt eklendi
                refreshCache();
                
                // Pozitif değer kaydetme kontrolü
                const pozitifMesajlar = [];
                if (karterBasinc >= 0) {
                    pozitifMesajlar.push(`Karter basıncı: ${karterBasinc} (pozitif)`);
                }
                if (onKamaraFarkBasinc >= 0) {
                    pozitifMesajlar.push(`Ön kamara fark basıncı: ${onKamaraFarkBasinc} (pozitif)`);
                }
                
                if (pozitifMesajlar.length > 0) {
                    showMessage(`${data.motor} motoru için veriler kaydedildi! Pozitif değerler: ${pozitifMesajlar.join(', ')}`, 'warning');
                } else {
                    showMessage(`${data.motor} motoru için veriler başarıyla kaydedildi!`, 'success');
                }
                
                // Formu kilitle (mesaj göstermeden)
                lockForm(false);
                
                // 🔥 OTOMATİK SONRAKİ MOTORA GEÇİŞ
                setTimeout(() => {
                    moveToNextMotor(data.motor);
                }, 1500);
            } else {
                showMessage('Kayıt hatası: ' + (result.error || 'Bilinmeyen hata'), 'error');
            }
        } catch (error) {
            console.error('Kayıt hatası:', error);
            showMessage('Bağlantı hatası: ' + error.message, 'error');
        } finally {
            // Kaydet butonunu geri aktif et
            if (!isLocked) {
                kaydetBtn.disabled = false;
            }
            kaydetBtn.textContent = '💾 KAYDET';
        }
    });

    // 🔥 SONRAKİ MOTORA OTOMATİK GEÇİŞ FONKSİYONU
    function moveToNextMotor(currentMotor) {
        const motorOrder = ['GM-1', 'GM-2', 'GM-3'];
        const currentIndex = motorOrder.indexOf(currentMotor);
        
        if (currentIndex < motorOrder.length - 1) {
            // Sonraki motora geç
            const nextMotor = motorOrder[currentIndex + 1];
            const nextButton = document.querySelector(`[data-motor="${nextMotor}"]`);
            
            if (nextButton) {
                // 🔥 FORM KİLİDİNİ AÇ
                isLocked = false;
                
                // 🔥 TÜM INPUT'LARI TEMİZLE
                const allInputs = document.querySelectorAll('.data-input');
                allInputs.forEach(input => {
                    input.value = '';
                    input.style.background = 'white';
                    input.style.color = '';
                    input.removeAttribute('data-calismiyor');
                    input.disabled = false;
                });
                
                // 🔥 BUTONLARI AKTİF ET
                const buttons = [kaydetBtn, temizleBtn, motorCalismiyorKaydetBtn];
                buttons.forEach(btn => {
                    if (btn) {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                    }
                });
                
                // Motor seçim butonlarını aktif yap
                motorButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                });
                
                // Active class'ını kaldır
                motorButtons.forEach(btn => btn.classList.remove('active'));
                // Yeni motora active class'ını ekle
                nextButton.classList.add('active');
                // Seçili motoru güncelle
                selectedMotor = nextMotor;
                
                // 🔥 VARDİYA TABLOSUNU SIFIRLA
                const tbody = document.getElementById('vardiyaTableBody');
                if (tbody) {
                    tbody.innerHTML = '';
                }
                const noDataMessage = document.getElementById('noDataMessage');
                if (noDataMessage) {
                    noDataMessage.style.display = 'block';
                }
                
                showMessage(`Otomatik geçiş: ${nextMotor} motoru seçildi!`, 'info');
                
                // Vardiya verilerini güncelle
                setTimeout(async () => {
                    await loadVardiyaData();
                    
                    // 🔥 FORM DURUMUNU KONTROL ET AMA BUTONLARI AKTIF TUT
                    setTimeout(async () => {
                        await checkAndUpdateFormStatus();
                        
                        // 🔥 KONTROL SONRASI BUTONLARI TEKRAR AKTIF ET
                        motorButtons.forEach(btn => {
                            btn.disabled = false;
                            btn.style.opacity = '1';
                            btn.style.cursor = 'pointer';
                        });
                        
                        const buttons = [kaydetBtn, temizleBtn, motorCalismiyorKaydetBtn];
                        buttons.forEach(btn => {
                            if (btn) {
                                btn.disabled = false;
                                btn.style.opacity = '1';
                                btn.style.cursor = 'pointer';
                            }
                        });
                    }, 500);
                }, 300);
            }
        } else {
            // Son motor ise bildir
            showMessage('Tüm motorlar için kayıt tamamlandı!', 'success');
        }
    }

    // TEMİZLE butonu
    temizleBtn.addEventListener('click', function() {
        if (isLocked) {
            showMessage('Form kilitli! Kayıt silinemez.', 'error');
            return;
        }
        
        // Tüm input'ları temizle
        const allInputs = document.querySelectorAll('.data-input');
        allInputs.forEach(input => input.value = '');
        
        showMessage('Tüm veriler temizlendi!', 'info');
    });

    // MOTOR ÇALIŞMIYOR KAYDET butonu - Google Sheets'e kaydeder
    motorCalismiyorKaydetBtn.addEventListener('click', async function() {
        if (isLocked) {
            showMessage('Bu kayıt zaten mevcut!', 'error');
            return;
        }
        
        const data = getAllInputValues();
        
        if (!data.motor || !data.tarih || !data.vardiya) {
            showMessage('Lütfen motor, tarih ve vardiya seçin!', 'error');
            return;
        }
        
        try {
            // 🔒 ÇİFT KAYIT KONTROLÜ - Butonu kilitlemeden önce yap
            const existingRecord = await checkExistingRecord(data.motor, data.tarih, data.saat);
            if (existingRecord) {
                showMessage(`Bu tarih, saat ve motor (${data.motor}) için kayıt zaten var!\nMevcut kayıt: ${existingRecord.durum || 'NORMAL'}`, 'error');
                return;
            }
            
            // Butonu devre dışı bırak
            motorCalismiyorKaydetBtn.disabled = true;
            motorCalismiyorKaydetBtn.textContent = '⚠️ KAYDEDİLİYOR...';
            
            // Google Sheets'e kaydet
            const sheetsData = {
                motor: data.motor,
                tarih: data.tarih,
                vardiya: data.vardiya,
                saat: data.saat,
                kaydeden: getCurrentUserName(),
                durum: 'MOTOR ÇALIŞMIYOR'
            };
            
            const result = await saveMotorToSheets(sheetsData);
            
            if (result.success) {
                console.log('Motor çalışmıyor kaydı:', result);
                
                // 🔥 CACHE'I GÜNCELLE - Yeni kayıt eklendi
                refreshCache();
                
                showMessage(`${data.motor} motoru için "ÇALIŞMIYOR" durumu kaydedildi!`, 'warning');
                
                // Input'lara işaretle ve formu kilitle
                const allInputs = document.querySelectorAll('.data-input');
                allInputs.forEach(input => {
                    input.value = '0';
                    input.style.background = '#ffebee';
                    input.style.color = '#c62828';
                    input.setAttribute('data-calismiyor', 'true');
                });
                
                lockForm(false);
                
                // 🔥 OTOMATİK SONRAKİ MOTORA GEÇİŞ
                setTimeout(() => {
                    moveToNextMotor(data.motor);
                }, 1500);
            } else {
                showMessage('Kayıt hatası: ' + (result.error || 'Bilinmeyen hata'), 'error');
            }
        } catch (error) {
            console.error('Kayıt hatası:', error);
            showMessage('Bağlantı hatası: ' + error.message, 'error');
        } finally {
            // Butonu geri aktif et
            if (!isLocked) {
                motorCalismiyorKaydetBtn.disabled = false;
            }
            motorCalismiyorKaydetBtn.textContent = '⚠️ MOTOR ÇALIŞMIYOR KAYDET';
        }
    });

    // Otomatik ayarları yap
    async function otomatikAyarlar() {
        // Bugünün tarihini ayarla (TR formatı)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        tarihSecimi.value = `${day}.${month}.${year}`;

        // Saate göre vardiya ayarla
        const currentHour = today.getHours();
        if (currentHour >= 8 && currentHour < 16) {
            vardiyaSecimi.value = '08-16';
        } else if (currentHour >= 16 && currentHour < 24) {
            vardiyaSecimi.value = '16-24';
        } else {
            vardiyaSecimi.value = '24-08';
        }
        
        // Mevcut saati güncelle
        updateCurrentHour();
        
        // Vardiya bilgisini güncelle
        guncelleVardiyaBilgisi();
        
        // Vardiya verilerini yükle
        await loadVardiyaData();
        
        // Kayıt kontrolü yap
        await checkAndUpdateFormStatus();
    }

    // Tarih ve vardiya değişiminde kontrol et
    tarihSecimi.addEventListener('input', async function() {
        autoFormatTarih(this);
        await checkAndUpdateFormStatus();
    });
    
    tarihSecimi.addEventListener('change', async function() {
        if (!validateTarih(this.value)) {
            showMessage('Lütfen geçerli bir tarih formatı girin (GG.AA.YYYY)', 'error');
            this.value = '';
            return;
        }
        await checkAndUpdateFormStatus();
    });
    
    vardiyaSecimi.addEventListener('change', async function() {
        await checkAndUpdateFormStatus();
    });

    // Çıkış butonları
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', function() {
            if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                window.location.href = 'anasayfa.html';
            }
        });
    }

    if (headerLogout) {
        headerLogout.addEventListener('click', function() {
            if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                window.location.href = 'anasayfa.html';
            }
        });
    }

    // Vardiya Verileri Görüntüleme Fonksiyonları
    
    // Vardiya saat aralıklarını tanımla
    const vardiyaSaatAraliklari = {
        '08-16': { baslangic: 7, bitis: 15, baslangicSaat: '07:00', bitisSaat: '15:00' },
        '16-24': { baslangic: 15, bitis: 24, baslangicSaat: '15:00', bitisSaat: '24:00' },
        '24-08': { baslangic: 23, bitis: 7, baslangicSaat: '23:00', bitisSaat: '07:00' }
    };
    
    // Saat değerini saat kısmına çevir (14:00 -> 14)
    function getSaatDegeri(saatStr) {
        if (!saatStr) return null;
        const parts = saatStr.split(':');
        return parseInt(parts[0]);
    }
    
    // Kaydın vardiya aralığında olup olmadığını kontrol et
    function kayitVardiyaAraligindaMi(saatStr, vardiya) {
        const saat = getSaatDegeri(saatStr);
        if (saat === null) return false;
        
        const aralik = vardiyaSaatAraliklari[vardiya];
        if (!aralik) return false;
        
        if (vardiya === '24-08') {
            // Gece vardiyası: 23:00 - 07:00
            return saat >= 23 || saat < 7;
        } else {
            // Normal vardiyalar
            return saat >= aralik.baslangic && saat < aralik.bitis;
        }
    }
    
    // Vardiya bilgisi gösterimini güncelle
    function guncelleVardiyaBilgisi() {
        const vardiya = vardiyaSecimi.value;
        const aralik = vardiyaSaatAraliklari[vardiya];
        
        const vardiyaBadge = document.getElementById('vardiyaBadge');
        const saatAraligi = document.getElementById('saatAraligi');
        
        if (vardiyaBadge && aralik) {
            vardiyaBadge.textContent = vardiya;
        }
        
        if (saatAraligi && aralik) {
            saatAraligi.textContent = `${aralik.baslangicSaat} - ${aralik.bitisSaat}`;
        }
    }

    // Motor verisi girilmediyse mail uyarısı gönder
    async function checkAndSendMissingMotorMail() {
        const now = new Date();

        const hour = String(now.getHours()).padStart(2, '0');
        const saat = `${hour}:00`;
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const tarih = `${day}.${month}.${year}`;
        const sentKey = `kojenMotorMissingMailSent:${tarih}:${saat}`;

        if (typeof runKojenMotorHourlyMissingRecordCheck === 'function') {
            const serverResult = await runKojenMotorHourlyMissingRecordCheck();
            if (serverResult.success) {
                if ((serverResult.addedCount || 0) > 0) {
                    showMessage(`${serverResult.addedCount} otomatik kojen motor kaydi olusturuldu.`, 'warning');
                    await loadVardiyaData();
                }
                localStorage.setItem(sentKey, new Date().toISOString());
                return;
            }

            console.error('Kojen motor sunucu otomatik kayit kontrolu basarisiz:', serverResult.error);
        }

        if (localStorage.getItem(sentKey)) {
            return;
        }

        const motors = ['GM-1', 'GM-2', 'GM-3'];
        const kontrolListesi = motors.map(motor => ({ motor, tarih, saat }));
        const eksikMotorlar = [];

        try {
            const bulkResult = await checkMultipleMotorRecords(kontrolListesi);

            if (bulkResult.success && bulkResult.results) {
                kontrolListesi.forEach(({ motor }) => {
                    const key = `${motor}|${tarih}|${saat}`;
                    if (!bulkResult.results[key] || !bulkResult.results[key].exists) {
                        eksikMotorlar.push(motor);
                    }
                });
            } else {
                for (const motor of motors) {
                    const result = await checkExistingMotorRecord(motor, tarih, saat);
                    if (!result.success || !result.exists) {
                        eksikMotorlar.push(motor);
                    }
                }
            }

            if (eksikMotorlar.length === 0) {
                return;
            }

            const subject = `${KojenMotorSheetsConfig.EMAIL_SUBJECT} - ${tarih} ${saat}`;
            const body = `Kojen Motor Veri Uyarısı\n\nTarih: ${tarih}\nSaat: ${saat}\nEksik motor kayıtları: ${eksikMotorlar.join(', ')}\n\nBu saat için kojen motor veri kaydı girilmedi.\n\nLütfen ilgili personeli bilgilendirin.`;
            const mailResult = await sendKojenMotorEmailAlert(subject, body);

            if (mailResult.success) {
                localStorage.setItem(sentKey, new Date().toISOString());
                showMessage(`${saat} için eksik motor veri maili gönderildi.`, 'warning');
            } else {
                console.error('Kojen motor uyarı maili gönderilemedi:', mailResult.error);
            }
        } catch (error) {
            console.error('Kojen motor eksik kayıt mail kontrolü hatası:', error);
        }
    }

    function startMissingMotorMailCheck() {
        console.log('Kojen motor mail kontrolü başlatılıyor...');

        setInterval(() => {
            checkAndSendMissingMotorMail();
        }, 5 * 60 * 1000);

        setTimeout(() => {
            checkAndSendMissingMotorMail();
        }, 5000);
    }
    
        
    // Vardiya veya tarih değiştiğinde tabloyu güncelle
    vardiyaSecimi.addEventListener('change', async function() {
        guncelleVardiyaBilgisi();
        await loadVardiyaData();
        await checkAndUpdateFormStatus();
    });
    
    tarihSecimi.addEventListener('change', async function() {
        if (validateTarih(this.value)) {
            await loadVardiyaData();
        }
    });
    
    // Sayfa yüklendiğinde vardiya bilgisini güncelle
    guncelleVardiyaBilgisi();
    
    // Sayfa yüklendiğinde otomatik ayarları yap
    otomatikAyarlar();
    startMissingMotorMailCheck();

    // Her saniyede bir saati güncelle
    setInterval(async () => {
        const previousHour = currentHourElement.textContent;
        updateCurrentHour();
        const currentHour = currentHourElement.textContent;
        // Sadece saat değiştiğinde kontrol et
        if (previousHour !== currentHour) {
            await checkAndUpdateFormStatus();
        }
    }, 1000);

    // Her 30 saniyede bir vardiya ayarını kontrol et
    setInterval(() => {
        const currentHour = new Date().getHours();
        let yeniVardiya;
        
        if (currentHour >= 8 && currentHour < 16) {
            yeniVardiya = '08-16';
        } else if (currentHour >= 16 && currentHour < 24) {
            yeniVardiya = '16-24';
        } else {
            yeniVardiya = '24-08';
        }

        // Eğer vardiya değiştiyse güncelle (kullanıcı manuel değişmediyse)
        if (vardiyaSecimi.value !== yeniVardiya && !vardiyaSecimi.matches(':focus')) {
            vardiyaSecimi.value = yeniVardiya;
        }
    }, 30000);
});

// 🔥 MOTOR ÇALIŞMIYOR MODAL FONKSİYONLARI (KOJEN MOTOR VERİLERİ İÇİN)
function openMotorCalismiyorModal() {
    const modal = document.getElementById('motorCalismiyorModal');
    const modalTarih = document.getElementById('modalTarih');
    const modalVardiya = document.getElementById('modalVardiya');
    
    // 🔥 OTOMATİK BUGÜN TARİHİNİ GETİR (HTML input için yyyy-MM-dd formatında)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const htmlDateStr = `${year}-${month}-${day}`; // HTML input formatı
    const displayDateStr = `${day}.${month}.${year}`; // Display formatı
    
    // Modal alanını doldur (HTML input formatı)
    modalTarih.value = htmlDateStr;
    console.log('📅 Modal tarihi ayarlandı (HTML):', htmlDateStr);
    console.log('📅 Modal tarihi (Display):', displayDateStr);
    
    // Display formatını data attribute olarak sakla
    modalTarih.setAttribute('data-display-date', displayDateStr);
    modalVardiya.value = vardiyaSecimi.value;
    
    // Vardiya saatlerini filtrele
    filterSaatByVardiya(vardiyaSecimi.value);
    
    // Modalı göster
    modal.style.display = 'flex';
    
    // Event listener'ı ekle
    document.getElementById('modalKaydetBtn').onclick = handleModalKaydet;
}

function closeMotorCalismiyorModal() {
    console.log('🚪 closeMotorCalismiyorModal çağrıldı...');
    
    const modal = document.getElementById('motorCalismiyorModal');
    if (!modal) {
        console.log('❌ Modal bulunamadı!');
        return;
    }
    
    console.log('✅ Modal bulundu, kapatılıyor...');
    modal.style.display = 'none';
    
    // Formu temizle
    setTimeout(() => {
        // Motor seçimlerini temizle
        document.querySelectorAll('input[name="motor"]:checked').forEach(cb => {
            cb.checked = false;
        });
        
        // Saat seçimlerini temizle
        document.querySelectorAll('input[name="saat"]:checked').forEach(cb => {
            cb.checked = false;
        });
        
        // Not alanını temizle
        const modalNot = document.getElementById('modalNot');
        if (modalNot) {
            modalNot.value = '';
        }
        
        console.log('🧹 Modal form temizlendi');
    }, 100);
}

function filterSaatByVardiya(vardiya) {
    const saatCheckboxes = document.querySelectorAll('input[name="saat"]');
    const vardiyaSaatleri = {
        '08-16': ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        '16-24': ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
        '24-08': ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00']
    };
    
    saatCheckboxes.forEach(checkbox => {
        const saat = checkbox.value;
        if (vardiyaSaatleri[vardiya].includes(saat)) {
            checkbox.checked = true;
            checkbox.disabled = false;
            checkbox.parentElement.style.opacity = '1';
        } else {
            checkbox.checked = false;
            checkbox.disabled = true;
            checkbox.parentElement.style.opacity = '0.5';
        }
    });
}

async function handleModalKaydet() {
    const kaydetBtn = document.getElementById('modalKaydetBtn');
    const originalText = kaydetBtn.textContent;
    
    try {
        // Seçili motorları al
        const selectedMotors = Array.from(document.querySelectorAll('input[name="motor"]:checked'))
            .map(cb => cb.value);
        
        if (selectedMotors.length === 0) {
            showMessage('Lütfen en az bir motor seçin!', 'error');
            return;
        }
        
        // Seçili saatleri al ve sıralı olarak düzenle
        const selectedSaatler = Array.from(document.querySelectorAll('input[name="saat"]:checked:not(:disabled)'))
            .map(cb => cb.value)
            .sort((a, b) => {
                // Saatleri sayısal olarak karşılaştır (00:00, 01:00, 02:00...)
                const hourA = parseInt(a.split(':')[0]);
                const hourB = parseInt(b.split(':')[0]);
                return hourA - hourB;
            });
        
        console.log('📋 Seçili saatler (sıralı):', selectedSaatler);
        
        if (selectedSaatler.length === 0) {
            showMessage('Lütfen en az bir saat seçin!', 'error');
            return;
        }
        
        // Butonu devre dışı bırak
        kaydetBtn.disabled = true;
        kaydetBtn.textContent = '⚠️ KAYDEDİLİYOR...';
        
        // 🔥 TARİH FORMAT DÖNÜŞTÜRME - HTML yyyy-MM-dd -> DD.MM.YYYY
        const modalTarihInput = document.getElementById('modalTarih');
        let modalTarih = modalTarihInput.value;
        
        // HTML formatından display formatına çevir
        if (modalTarih && modalTarih.includes('-')) {
            const parts = modalTarih.split('-');
            modalTarih = `${parts[2]}.${parts[1]}.${parts[0]}`; // DD.MM.YYYY
        }
        
        const modalVardiya = document.getElementById('modalVardiya').value;
        const modalNot = document.getElementById('modalNot').value;
        
        console.log('📅 Modal değerleri:', { 
            modalTarih: modalTarih, 
            modalTarihRaw: modalTarihInput.value,
            modalVardiya, 
            modalNot 
        });
        
        let successCount = 0;
        let errorCount = 0;
        let errors = [];
        
        console.log('🚀 HIZLI TOPLU MOTOR KAYIT SİSTEMİ BAŞLIYOR...');
        
        // 🚀 TOPLU KAYIT İÇİN HAZIRLIK
        const kayitlar = [];
        const kontrolListesi = [];
        
        // Tüm kombinasyonları hazırla
        for (const motor of selectedMotors) {
            for (const saat of selectedSaatler) {
                kontrolListesi.push({ motor, tarih: modalTarih, saat });
            }
        }
        
        console.log('📊 Kontrol listesi:', kontrolListesi);
        
        console.log(`📋 ${kontrolListesi.length} motor kombinasyonu hazırlandı...`);
        
        // 🚀 SÜPER HIZLI TOPLU KAYIT KONTROLÜ (TEK API ÇAĞRISI)
        console.log('🔍 Tüm motor kayıtları tek seferde kontrol ediliyor...');
        const bulkKontrolResult = await checkMultipleMotorRecords(kontrolListesi);
        
        // 🚀 KAYIT EDİLECEKLERİ FİLTRELE
        const kayitEdilecekler = [];
        
        if (bulkKontrolResult.success) {
            console.log(`📊 Toplu motor kontrol sonucu: ${bulkKontrolResult.existingCount} var, ${bulkKontrolResult.totalCount - bulkKontrolResult.existingCount} yok`);
            
            kontrolListesi.forEach(({ motor, saat }) => {
                const key = `${motor}|${modalTarih}|${saat}`;
                const sonuc = bulkKontrolResult.results[key];
                
                if (sonuc && !sonuc.exists) {
                    kayitEdilecekler.push({ motor, saat });
                } else if (sonuc && sonuc.exists) {
                    console.log(`⏭️ ${motor} - ${saat} için kayıt zaten var`);
                } else {
                    console.log(`❌ ${motor} - ${saat} kontrol hatası`);
                    errors.push(`${motor} - ${saat}: Kontrol hatası`);
                }
            });
        } else {
            console.log('❌ Toplu motor kontrol başarısız, tek tek deneniyor...');
            // Fallback: Tek tek kontrol et
            for (const motor of selectedMotors) {
                for (const saat of selectedSaatler) {
                    try {
                        const existingRecord = await checkExistingRecord(motor, modalTarih, saat);
                        if (!existingRecord) {
                            kayitEdilecekler.push({ motor, saat });
                        } else {
                            console.log(`${motor} - ${modalTarih} ${saat} için kayıt zaten var`);
                        }
                    } catch (error) {
                        console.log(`❌ ${motor} - ${saat} kontrol hatası:`, error);
                        errors.push(`${motor} - ${saat}: Kontrol hatası`);
                    }
                }
            }
        }
        
        console.log(`📊 ${kayitEdilecekler.length} motor kaydı yapılacak...`);
        
        if (kayitEdilecekler.length === 0) {
            console.log('⏭️ Kayıt yapılacak şey yok, işlem tamamlandı');
            showMessage('Tüm seçili saatler için zaten kayıt mevcut! Modal kapatılıyor...', 'info');
            kaydetBtn.disabled = false;
            kaydetBtn.textContent = originalText;
            
            // Modalı otomatik kapat
            setTimeout(() => {
                closeMotorCalismiyorModal();
            }, 1500);
            
            return;
        }
        
        // 🚀 SON KAYIT DEĞERLERİNİ TOPLU AL (PARALEL)
        console.log('📊 Son motor kayıt değerleri toplanıyor...');
        const motorlar = [...new Set(kayitEdilecekler.map(k => k.motor))];
        const sonKayitSonuclari = await Promise.allSettled(
            motorlar.map(motor => getLastRecordForMotor(motor))
        );
        
        const sonKayitlar = {};
        sonKayitSonuclari.forEach((sonuc, index) => {
            const motor = motorlar[index];
            if (sonuc.status === 'fulfilled') {
                sonKayitlar[motor] = sonuc.value || {};
            } else {
                sonKayitlar[motor] = {};
                console.log(`❌ ${motor} son motor kayıt hatası:`, sonuc.reason);
            }
        });
        
        // 🚀 HIZLI ÇOKLU KAYIT SİSTEMİ - Tüm verileri tek seferde gönder
        console.log('🚀 Çoklu kayıt sistemi başlatılıyor...');
        
        // Kayıt verilerini hazırla
        const recordsToSave = kayitEdilecekler.map(({ motor, saat }) => {
            const sonKayit = sonKayitlar[motor] || {};
            
            return {
                motor: motor,
                tarih: modalTarih,
                vardiya: modalVardiya,
                saat: saat,
                jenYatakSicaklikDE: sonKayit.jenYatakSicaklikDE || '0,00',
                jenYatakSicaklikNDE: sonKayit.jenYatakSicaklikNDE || '0,00',
                sogutmaSuyuSicaklik: sonKayit.sogutmaSuyuSicaklik || '0,00',
                sogutmaSuyuBasinc: sonKayit.sogutmaSuyuBasinc || '0,00',
                yagSicaklik: sonKayit.yagSicaklik || '0,00',
                yagBasinc: sonKayit.yagBasinc || '0,00',
                sarjSicaklik: sonKayit.sarjSicaklik || '0,00',
                sarjBasinc: sonKayit.sarjBasinc || '0,00',
                gazRegulatoru: sonKayit.gazRegulatoru || '0,00',
                makineDairesiSicaklik: sonKayit.makineDairesiSicaklik || '0,00',
                karterBasinc: sonKayit.karterBasinc || '0,00',
                onKamaraFarkBasinc: sonKayit.onKamaraFarkBasinc || '0,00',
                sargiSicaklik1: sonKayit.sargiSicaklik1 || '0,00',
                sargiSicaklik2: sonKayit.sargiSicaklik2 || '0,00',
                sargiSicaklik3: sonKayit.sargiSicaklik3 || '0,00',
                durum: 'MOTOR ÇALIŞMIYOR',
                not: modalNot || '',
                kullanici: getCurrentUserName()
            };
        });
        
        try {
            // Çoklu kayıt gönder
            const bulkResult = await addMultipleMotorRecords(recordsToSave);
            
            if (bulkResult.success) {
                console.log(`✅ ${bulkResult.addedCount}/${bulkResult.totalCount} kayıt başarıyla eklendi`);
                showMessage(`${bulkResult.addedCount} kayıt başarıyla eklendi!`, 'success');
                
                // Cache'i temizle
                recordMap.clear();
                cachedRecords = [];
                
                // Formu kapat
                closeMotorCalismiyorModal();
                
            } else {
                console.error('❌ Çoklu kayıt hatası:', bulkResult.error);
                showMessage('Kayıt hatası: ' + bulkResult.error, 'error');
            }
            
        } catch (error) {
            console.error('❌ Çoklu kayıt gönderme hatası:', error);
            showMessage('Kayıt gönderilemedi: ' + error.message, 'error');
        }
        
        // Durum güncellemelerini göster
        const durumInterval = setInterval(() => {
            kayitDurumunuGoster();
            
            // Tüm işlemler bittiğinde interval'i temizle
            const bekleyen = kayitKuyrugu.filter(i => i.durum === 'beklemede').length;
            const islenen = kayitKuyrugu.filter(i => i.durum === 'isleniyor').length;
            
            if (bekleyen === 0 && islenen === 0) {
                clearInterval(durumInterval);
                
                // Son durum mesajı
                const tamamlanan = kayitKuyrugu.filter(i => i.durum === 'tamamlandi').length;
                const hatali = kayitKuyrugu.filter(i => i.durum === 'hata').length;
                
                if (tamamlanan > 0) {
                    showMessage(`🎉 Tüm kayıtlar tamamlandı! ${tamamlanan} başarılı, ${hatali} hatalı`, 'success');
                }
                
                // Kuyruğu temizle (sadece son 10 işlemi tut)
                kayitKuyrugu = kayitKuyrugu.slice(-10);
            }
        }, 2000); // Her 2 saniyede bir durum göster
        
    } catch (error) {
        showMessage('İşlem hatası: ' + error.message, 'error');
    } finally {
        kaydetBtn.disabled = false;
        kaydetBtn.textContent = originalText;
    }
}

// Event listener'ları ekle
document.addEventListener('DOMContentLoaded', function() {
    // Motor çalışmıyor butonuna modal açma event listener'ı ekle
    const motorCalismiyorKaydetBtn = document.getElementById('motorCalismiyorKaydetBtn');
    if (motorCalismiyorKaydetBtn) {
        // Eski listener'ı kaldır
        motorCalismiyorKaydetBtn.replaceWith(motorCalismiyorKaydetBtn.cloneNode(true));
        
        // Yeni listener'ı ekle
        document.getElementById('motorCalismiyorKaydetBtn').addEventListener('click', function() {
            openMotorCalismiyorModal();
        });
    }
    
    // Vardiya değiştiğinde saatleri filtrele
    document.getElementById('modalVardiya')?.addEventListener('change', function() {
        filterSaatByVardiya(this.value);
    });
});
