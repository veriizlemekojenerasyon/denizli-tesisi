// Kojen Enerji Veri JavaScript - Google Sheets Entegrasyonu

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
        
        console.log('Kojen Enerji Veri - Kullanici adi ayarlandi:', fullName || user.email || 'Kullanici');
    } catch (e) {
        console.error('Kojen Enerji Veri - Kullanici bilgileri okunamadi:', e);
        const allElements = document.querySelectorAll('[id="userNameDisplay"]');
        allElements.forEach(element => {
            element.textContent = 'Kullanici';
        });
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Önce kimlik dogrulama kontrolü
    checkAuth();
    
    // ⚡ SUPER HIZLI Cache sistemi
    let cachedRecords = [];
    let cacheTimestamp = 0;
    const CACHE_DURATION = 300000; // 5 dakika
    let recordMap = new Map(); // motor|tarih|saat -> record
    let cacheRefreshTimer = null;
    
    // Motor seçim butonları
    const motorButtons = document.querySelectorAll('.motor-btn');
    let selectedMotor = 'GM-1';
    let isLocked = false;
    
    // Elementler
    const tarihSecimi = document.getElementById('tarihSecimi');
    const vardiyaSecimi = document.getElementById('vardiyaSecimi');
    const currentHourElement = document.querySelector('.kojen-enerji-table-body .sticky-col');
    const kaydetBtn = document.getElementById('kaydetBtn');
    const temizleBtn = document.getElementById('temizleBtn');
    const motorCalismiyorKaydetBtn = document.getElementById('motorCalismiyorKaydetBtn');
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');

    // ⚡ Cache'i yenile - Optimize edilmiş
    async function refreshCache() {
        try {
            const result = await getAllEnerjiRecords();
            if (result.success) {
                cachedRecords = result.data;
                recordMap.clear();
                
                result.data.forEach(record => {
                    const mapKey = `${record.motor}|${record.tarih}|${record.saat}`;
                    recordMap.set(mapKey, record);
                });
                
                cacheTimestamp = Date.now();
                console.log('⚡ Kojen Enerji cache yenilendi:', cachedRecords.length, 'kayıt');
                startBackgroundRefresh();
            }
        } catch (error) {
            console.error('Cache yenileme hatası:', error);
        }
    }
    
    // ⚡ Background cache yenileme
    function startBackgroundRefresh() {
        if (cacheRefreshTimer) clearInterval(cacheRefreshTimer);
        cacheRefreshTimer = setInterval(async () => {
            try {
                const result = await getAllEnerjiRecords();
                if (result.success) {
                    cachedRecords = result.data;
                    recordMap.clear();
                    result.data.forEach(record => {
                        const mapKey = `${record.motor}|${record.tarih}|${record.saat}`;
                        recordMap.set(mapKey, record);
                    });
                    cacheTimestamp = Date.now();
                }
            } catch (error) {
                console.error('Background cache hatası:', error);
            }
        }, 240000); // 4 dakika
    }
    
    // ⚡ ULTRA HIZLI çift kayıt kontrolü - Map tabanlı
    async function checkExistingRecord(motor, tarih, saat) {
        try {
            const now = Date.now();
            if (now - cacheTimestamp < CACHE_DURATION) {
                const mapKey = `${motor}|${tarih}|${saat}`;
                const cached = recordMap.get(mapKey);
                if (cached) {
                    console.log('⚡ Enerji cache hit!');
                    return cached;
                }
            }
            
            const result = await checkExistingEnerjiRecord(motor, tarih, saat);
            if (result.success && result.exists) {
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
    
    // 🔒 BAŞLANGIÇTA TÜM FORM PASİF
    disableAllFormElements();
    
    // ⚡ CACHE BAŞLAT
    setTimeout(() => refreshCache(), 100);
    
    // 🔍 1 SN SONRA KAYIT KONTROLÜ VE AÇ/KİLİTLE
    setTimeout(async () => {
        await checkAndUnlockOrLockForm();
    }, 1000);
    
    // 🔥 HIZLI form durumu kontrolü
    async function checkAndUpdateFormStatus() {
        if (!selectedMotor || !tarihSecimi?.value || !currentHourElement?.textContent) {
            console.log('Enerji form: Eksik parametre');
            return;
        }
        
        try {
            const saat = currentHourElement.textContent.trim();
            const existingRecord = await checkExistingRecord(selectedMotor, tarihSecimi.value, saat);
            
            if (existingRecord) {
                console.log('🔥 Enerji kayıt bulundu, kilitleniyor:', existingRecord);
                lockForm(false);
                loadExistingRecord(existingRecord);
            } else {
                console.log('🔥 Enerji kayıt yok, form açık');
                unlockForm();
            }
        } catch (error) {
            console.error('Enerji form kontrol hatası:', error);
            unlockForm();
        }
    }
    
    // 🔥 Mevcut kaydı yükle
    function loadExistingRecord(existingRecord) {
        const inputs = document.querySelectorAll('.kojen-input');
        if (existingRecord.durum === 'MOTOR ÇALIŞMIYOR') {
            inputs.forEach(input => {
                input.value = '0';
                input.style.background = '#ffebee';
                input.style.color = '#c62828';
            });
        } else {
            inputs[0].value = (existingRecord.aydemVoltaji || '').replace(',', '.');
            inputs[1].value = (existingRecord.aktifGuc || '').replace(',', '.');
            inputs[2].value = (existingRecord.reaktifGuc || '').replace(',', '.');
            inputs[3].value = (existingRecord.cosPhi || '').replace(',', '.');
            inputs[4].value = (existingRecord.ortAkim || '').replace(',', '.');
            inputs[5].value = (existingRecord.ortGerilim || '').replace(',', '.');
            inputs[6].value = (existingRecord.notrAkim || '').replace(',', '.');
            inputs[7].value = (existingRecord.tahrikGerilimi || '').replace(',', '.');
            inputs[8].value = (existingRecord.toplamAktifEnerji || '').replace(',', '.');
            inputs[9].value = (existingRecord.calismaSaati || '').replace(',', '.');
            inputs[10].value = (existingRecord.kalkisSayisi || '').replace(',', '.');
            
            inputs.forEach(input => {
                input.style.background = 'white';
                input.style.color = '';
            });
        }
    }

    // 🔒 BAŞLANGIÇTA TÜM FORM PASİF YAP
    function disableAllFormElements() {
        console.log('🔒 Enerji form başlangıçta pasif yapılıyor...');
        
        // Input'ları pasif yap
        const allInputs = document.querySelectorAll('.kojen-input');
        allInputs.forEach(input => {
            input.disabled = true;
            input.style.background = '#f5f5f5';
            input.style.cursor = 'not-allowed';
        });
        
        // Butonları pasif yap
        const buttons = [kaydetBtn, temizleBtn, motorCalismiyorKaydetBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
        
        // Motor seçim butonlarını pasif yap
        motorButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
    }
    
    // 🔓 TÜM FORM ELEMANLARINI AKTİF YAP (kayıt yoksa)
    function enableAllFormElements() {
        console.log('🔓 Enerji form aktif yapılıyor...');
        
        // Input'ları aktif yap
        const allInputs = document.querySelectorAll('.kojen-input');
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
            console.log('Enerji kontrol: Eksik parametre');
            enableAllFormElements(); // Eksikse yine de aç
            return;
        }
        
        try {
            const saat = currentHourElement.textContent.trim();
            const existingRecord = await checkExistingRecord(selectedMotor, tarihSecimi.value, saat);
            
            if (existingRecord) {
                // 🔒 KAYIT VAR - Form kilitli kalır, veriler yüklenir
                console.log('🔒 Enerji kayıt bulundu, form kilitli:', existingRecord);
                lockForm(false);
                loadExistingRecord(existingRecord);
                showMessage(`Mevcut kayıt yüklendi: ${existingRecord.durum || 'NORMAL'}`, 'info');
            } else {
                // 🔓 KAYIT YOK - Form açılır
                console.log('🔓 Enerji kayıt yok, form açılıyor');
                enableAllFormElements();
            }
        } catch (error) {
            console.error('Enerji kontrol hatası:', error);
            enableAllFormElements(); // Hata durumunda yine de aç
        }
    }

    // Vardiya aralıkları
    const vardiyaSaatAraliklari = {
        '08-16': { baslangic: 7, bitis: 16, baslangicSaat: '07:00', bitisSaat: '16:00' },
        '16-24': { baslangic: 15, bitis: 24, baslangicSaat: '15:00', bitisSaat: '24:00' },
        '24-08': { baslangic: 23, bitis: 7, baslangicSaat: '23:00', bitisSaat: '07:00' }
    };

    // Çıkış butonları
    sidebarLogout?.addEventListener('click', () => confirm('Çıkış yapmak istediğinizden emin misiniz?') && (window.location.href = 'index.html'));
    headerLogout?.addEventListener('click', () => confirm('Çıkış yapmak istediğinizden emin misiniz?') && (window.location.href = 'index.html'));

    // Input değerlerini al
    function getAllInputValues() {
        const inputs = document.querySelectorAll('.kojen-input');
        return {
            aydemVoltaji: inputs[0]?.value || '',
            aktifGuc: inputs[1]?.value || '',
            reaktifGuc: inputs[2]?.value || '',
            cosPhi: inputs[3]?.value || '',
            ortAkim: inputs[4]?.value || '',
            ortGerilim: inputs[5]?.value || '',
            notrAkim: inputs[6]?.value || '',
            tahrikGerilimi: inputs[7]?.value || '',
            toplamAktifEnerji: inputs[8]?.value || '',
            calismaSaati: inputs[9]?.value || '',
            kalkisSayisi: inputs[10]?.value || ''
        };
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
                const result = await getEnerjiRecordsByMotorAndDate(motor, tarihSecimi.value);
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
            const [hour] = saat.split(':');
            return new Date(year, month - 1, day, hour);
        } catch (e) {
            return new Date(0); // Hata durumunda en eski tarih
        }
    }

    // Form kilit fonksiyonları
    function lockForm(showMsg = true) {
        isLocked = true;
        document.querySelectorAll('.kojen-input').forEach(input => {
            input.disabled = true;
            input.style.background = '#f8f9fa';
        });
        [kaydetBtn, temizleBtn, motorCalismiyorKaydetBtn].forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });
        if (showMsg) showMessage('Bu tarih ve saat için kayıt zaten mevcut!', 'error');
    }

    function unlockForm() {
        isLocked = false;
        document.querySelectorAll('.kojen-input').forEach(input => {
            input.disabled = false;
            input.style.background = 'white';
        });
        [kaydetBtn, temizleBtn, motorCalismiyorKaydetBtn].forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
    }

    // Mesaj göster
    function showMessage(msg, type) {
        document.querySelectorAll('.message').forEach(m => m.remove());
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.textContent = msg;
        div.style.cssText = `position:fixed;top:20px;right:20px;padding:15px 20px;border-radius:8px;color:white;font-weight:500;z-index:9999;box-shadow:0 4px 15px rgba(0,0,0,0.2);background:${{success:'linear-gradient(135deg,#28a745,#20c997)',error:'linear-gradient(135deg,#dc3545,#c82333)',warning:'linear-gradient(135deg,#ff6b6b,#ee5a24)',info:'linear-gradient(135deg,#17a2b8,#138496)'}[type]};`;
        document.body.appendChild(div);
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 3000);
    }

    // Kayıt kontrolü
    async function checkAndUpdateFormStatus() {
        if (!selectedMotor || !tarihSecimi.value) return;
        const saat = `${String(new Date().getHours()).padStart(2, '0')}:00`;
        try {
            const result = await checkExistingEnerjiRecord(selectedMotor, tarihSecimi.value, saat);
            if (result.success && result.exists && result.record) {
                const record = result.record;
                lockForm(false);
                const inputs = document.querySelectorAll('.kojen-input');
                if (record.durum === 'MOTOR ÇALIŞMIYOR') {
                    inputs.forEach(input => { input.value = '0'; input.style.background = '#ffebee'; input.style.color = '#c62828'; });
                } else {
                    inputs[0].value = (record.aydemVoltaji || '').replace(',', '.');
                    inputs[1].value = (record.aktifGuc || '').replace(',', '.');
                    inputs[2].value = (record.reaktifGuc || '').replace(',', '.');
                    inputs[3].value = (record.cosPhi || '').replace(',', '.');
                    inputs[4].value = (record.ortAkif || '').replace(',', '.');
                    inputs[5].value = (record.ortGerilim || '').replace(',', '.');
                    inputs[6].value = (record.notrAkim || '').replace(',', '.');
                    inputs[7].value = (record.tahrikGerilimi || '').replace(',', '.');
                    inputs[8].value = (record.toplamAktifEnerji || '').replace(',', '.');
                    inputs[9].value = (record.calismaSaati || '').replace(',', '.');
                    inputs[10].value = (record.kalkisSayisi || '').replace(',', '.');
                    inputs.forEach(input => { input.style.background = 'white'; input.style.color = ''; });
                }
            } else {
                unlockForm();
            }
        } catch (error) {
            unlockForm();
        }
    }

    // Kaydet butonu
    kaydetBtn?.addEventListener('click', async function() {
        if (isLocked) { showMessage('Bu kayıt zaten mevcut!', 'error'); return; }
        const data = getAllInputValues();
        const saat = `${String(new Date().getHours()).padStart(2, '0')}:00`;
        
        // 🔒 ÇİFT KAYIT KONTROLÜ
        const existingRecord = await checkExistingRecord(selectedMotor, tarihSecimi.value, saat);
        if (existingRecord) {
            showMessage(`Bu tarih, saat ve motor (${selectedMotor}) için kayıt zaten var!\nMevcut kayıt: ${existingRecord.durum || 'NORMAL'}`, 'error');
            return;
        }
        if (Object.values(data).filter(v => !v).length > 0) { showMessage('Lütfen tüm alanları doldurun!', 'error'); return; }
        
        kaydetBtn.disabled = true; kaydetBtn.textContent = '💾 KAYDEDİLİYOR...';
        try {
            const result = await saveEnerjiToSheets({...data, motor: selectedMotor, tarih: tarihSecimi.value, vardiya: vardiyaSecimi.value, saat, kaydeden: 'Admin', durum: 'NORMAL'});
            if (result.success) {
                // 🔥 CACHE'İ GÜNCELLE
                refreshCache();
                showMessage(`${selectedMotor} motoru için enerji verileri kaydedildi!`, 'success');
                lockForm(false);
                await loadVardiyaData();
            } else {
                showMessage('Kayıt hatası: ' + (result.error || 'Bilinmeyen hata'), 'error');
            }
        } catch (error) {
            showMessage('Bağlantı hatası: ' + error.message, 'error');
        } finally {
            if (!isLocked) kaydetBtn.disabled = false;
            kaydetBtn.textContent = '💾 KAYDET';
        }
    });

    // Temizle butonu
    temizleBtn?.addEventListener('click', () => {
        if (isLocked) { showMessage('Form kilitli!', 'error'); return; }
        document.querySelectorAll('.kojen-input').forEach(input => { input.value = ''; input.style.background = 'white'; input.style.color = '#2c3e50'; });
        showMessage('Tüm veriler temizlendi!', 'info');
    });

    // Motor çalışmıyor kaydet - Son değerleri kullanarak
    motorCalismiyorKaydetBtn?.addEventListener('click', async function() {
        if (isLocked) { showMessage('Bu kayıt zaten mevcut!', 'error'); return; }
        const saat = `${String(new Date().getHours()).padStart(2, '0')}:00`;
        
        // 🔒 ÇİFT KAYIT KONTROLÜ
        const existingRecord = await checkExistingRecord(selectedMotor, tarihSecimi.value, saat);
        if (existingRecord) {
            showMessage(`Bu tarih, saat ve motor (${selectedMotor}) için kayıt zaten var!\nMevcut kayıt: ${existingRecord.durum || 'NORMAL'}`, 'error');
            return;
        }
        
        // 🔍 SON KAYITTAN DEĞERLERİ AL
        const lastRecord = await getLastRecordForMotor(selectedMotor);
        
        // Son kayıt değerleri (yoksa 0)
        const toplamAktifEnerji = lastRecord?.toplamAktifEnerji || '0';
        const calismaSaati = lastRecord?.calismaSaati || '0';
        const kalkisSayisi = lastRecord?.kalkisSayisi || '0';
        
        console.log('🔍 Son kayıt değerleri:', { toplamAktifEnerji, calismaSaati, kalkisSayisi });
        
        // Input'lara değerleri yaz (görsel geri bildirim)
        const inputs = document.querySelectorAll('.kojen-input');
        inputs.forEach((input, index) => {
            input.style.background = '#ffebee';
            input.style.color = '#c62828';
            if (index === 8) input.value = toplamAktifEnerji; // TOPLAM AKTİF ENERJİ
            else if (index === 9) input.value = calismaSaati;  // ÇALIŞMA SAATİ
            else if (index === 10) input.value = kalkisSayisi; // KALKIŞ SAYISI
            else input.value = '0'; // Diğerleri 0
        });
        
        motorCalismiyorKaydetBtn.disabled = true; motorCalismiyorKaydetBtn.textContent = '⚠️ KAYDEDİLİYOR...';
        
        try {
            const result = await saveEnerjiToSheets({
                motor: selectedMotor, 
                tarih: tarihSecimi.value, 
                vardiya: vardiyaSecimi.value, 
                saat, 
                kaydeden: 'Admin', 
                durum: 'MOTOR ÇALIŞMIYOR',
                // Son kayıt değerleri
                toplamAktifEnerji: toplamAktifEnerji,
                calismaSaati: calismaSaati,
                kalkisSayisi: kalkisSayisi,
                // Diğer değerler 0
                aydemVoltaji: '0',
                aktifGuc: '0',
                reaktifGuc: '0',
                cosPhi: '0',
                ortAkim: '0',
                ortGerilim: '0',
                notrAkim: '0',
                tahrikGerilimi: '0'
            });
            
            if (result.success) {
                // 🔥 CACHE'İ GÜNCELLE
                refreshCache();
                showMessage(`${selectedMotor} motoru için "ÇALIŞMIYOR" durumu kaydedildi! (Son değerler: Enerji ${toplamAktifEnerji}, Saat ${calismaSaati}, Kalkış ${kalkisSayisi})`, 'warning');
                lockForm(false);
                await loadVardiyaData();
            } else {
                showMessage('Kayıt hatası: ' + (result.error || 'Bilinmeyen hata'), 'error');
            }
        } catch (error) {
            showMessage('Bağlantı hatası: ' + error.message, 'error');
        } finally {
            if (!isLocked) motorCalismiyorKaydetBtn.disabled = false;
            motorCalismiyorKaydetBtn.textContent = '⚠️ MOTOR ÇALIŞMIYOR KAYDET';
        }
    });

    // Vardiya fonksiyonları
    function getSaatDegeri(saatStr) { return saatStr ? parseInt(saatStr.split(':')[0]) : null; }
    function kayitVardiyaAraligindaMi(saatStr, vardiya) {
        const saat = getSaatDegeri(saatStr);
        if (saat === null) return false;
        const aralik = vardiyaSaatAraliklari[vardiya];
        if (!aralik) return false;
        return vardiya === '24-08' ? (saat >= 23 || saat < 7) : (saat >= aralik.baslangic && saat < aralik.bitis);
    }
    function guncelleVardiyaBilgisi() {
        const vardiya = vardiyaSecimi.value, aralik = vardiyaSaatAraliklari[vardiya];
        const badge = document.getElementById('vardiyaBadge'), saatAraligi = document.getElementById('saatAraligi');
        if (badge && aralik) badge.textContent = vardiya;
        if (saatAraligi && aralik) saatAraligi.textContent = `${aralik.baslangicSaat} - ${aralik.bitisSaat}`;
    }

    async function loadVardiyaData() {
        const vardiya = vardiyaSecimi.value, tarih = tarihSecimi.value, motor = selectedMotor;
        console.log('DEBUG loadVardiyaData:', { vardiya, tarih, motor });
        if (!vardiya || !tarih || !motor) { console.log('DEBUG: Eksik parametre'); return; }
        const tableBody = document.getElementById('vardiyaTableBody'), noDataMessage = document.getElementById('noDataMessage');
        if (!tableBody) { console.log('DEBUG: tableBody bulunamadı'); return; }
        tableBody.innerHTML = '';
        try {
            const result = await getAllEnerjiRecords();
            console.log('DEBUG getAllEnerjiRecords result:', result);
            if (!result.success || !result.data?.length) { console.log('DEBUG: Veri yok veya başarısız'); if (noDataMessage) noDataMessage.style.display = 'block'; return; }
            let searchTarih = tarih;
            if (searchTarih.includes('-')) { const parts = searchTarih.split('-'); searchTarih = `${parts[2]}.${parts[1]}.${parts[0]}`; }
            console.log('DEBUG searchTarih:', searchTarih);
            console.log('DEBUG result.data[0]:', result.data[0]);
            const filtered = result.data.filter(r => {
                const matchTarih = (r.tarih || '') === searchTarih;
                const matchVardiya = kayitVardiyaAraligindaMi(r.saat || '', vardiya);
                const matchMotor = (r.motor || '') === motor;
                console.log('DEBUG filter:', { rTarih: r.tarih, rSaat: r.saat, rMotor: r.motor, matchTarih, matchVardiya, matchMotor });
                return matchTarih && matchVardiya && matchMotor;
            });
            console.log('DEBUG filtered:', filtered);
            filtered.sort((a, b) => (getSaatDegeri(a.saat) || 0) - (getSaatDegeri(b.saat) || 0));
            if (!filtered.length) { if (noDataMessage) { noDataMessage.textContent = `${motor} motoru için bu vardiya saat aralığında henüz kayıt bulunmamaktadır.`; noDataMessage.style.display = 'block'; } return; }
            if (noDataMessage) noDataMessage.style.display = 'none';
            
            // 🔍 MOTOR ÇALIŞMIYOR kayıtları için son normal kayıtları bul
            const sonNormalKayitlar = {};
            filtered.forEach(record => {
                if (record.durum !== 'MOTOR ÇALIŞMIYOR') {
                    // Bu motor için son normal kaydı sakla
                    const motor = record.motor;
                    const recDateTime = parseDateTime(record.tarih, record.saat);
                    if (!sonNormalKayitlar[motor] || parseDateTime(sonNormalKayitlar[motor].tarih, sonNormalKayitlar[motor].saat) < recDateTime) {
                        sonNormalKayitlar[motor] = record;
                    }
                }
            });
            
            filtered.forEach(record => {
                const row = document.createElement('tr');
                if (record.durum === 'MOTOR ÇALIŞMIYOR') row.classList.add('motor-calismiyor');
                
                // 🔍 MOTOR ÇALIŞMIYOR ise son değerleri kullan
                let toplamAktifEnerji = record.toplamAktifEnerji || '-';
                let calismaSaati = record.calismaSaati || '-';
                let kalkisSayisi = record.kalkisSayisi || '-';
                
                if (record.durum === 'MOTOR ÇALIŞMIYOR' && sonNormalKayitlar[record.motor]) {
                    const sonKayit = sonNormalKayitlar[record.motor];
                    // Sadece bu kayıttan önceki son normal kayıt varsa kullan
                    const currentDateTime = parseDateTime(record.tarih, record.saat);
                    const sonKayitDateTime = parseDateTime(sonKayit.tarih, sonKayit.saat);
                    
                    if (sonKayitDateTime < currentDateTime) {
                        toplamAktifEnerji = sonKayit.toplamAktifEnerji || '-';
                        calismaSaati = sonKayit.calismaSaati || '-';
                        kalkisSayisi = sonKayit.kalkisSayisi || '-';
                    }
                }
                
                row.innerHTML = `<td>${record.saat || '-'}</td><td>${record.motor || '-'}</td><td>${record.aydemVoltaji || '-'}</td><td>${record.aktifGuc || '-'}</td><td>${record.reaktifGuc || '-'}</td><td>${record.cosPhi || '-'}</td><td>${record.ortAkif || '-'}</td><td>${record.ortGerilim || '-'}</td><td>${record.notrAkim || '-'}</td><td>${record.tahrikGerilimi || '-'}</td><td>${toplamAktifEnerji}</td><td>${calismaSaati}</td><td>${kalkisSayisi}</td><td class="${record.durum === 'MOTOR ÇALIŞMIYOR' ? 'durum-calismiyor' : 'durum-normal'}">${record.durum === 'MOTOR ÇALIŞMIYOR' ? 'ÇALIŞMIYOR' : 'NORMAL'}</td>`;
                tableBody.appendChild(row);
            });
        } catch (error) { console.error('Vardiya verileri yüklenirken hata:', error); }
    }

    // Event listeners
    motorButtons.forEach(button => button.addEventListener('click', async function() {
        motorButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        selectedMotor = this.dataset.motor;
        showMessage(`${selectedMotor} motoru seçildi!`, 'info');
        // Inputları temizle
        document.querySelectorAll('.kojen-input').forEach(input => {
            input.value = '';
            input.style.background = 'white';
            input.style.color = '#2c3e50';
        });
        await loadVardiyaData();
        await checkAndUpdateFormStatus();
    }));

    tarihSecimi?.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length >= 2) value = value.slice(0, 2) + '.' + value.slice(2);
        if (value.length >= 5) value = value.slice(0, 5) + '.' + value.slice(5);
        this.value = value.slice(0, 10);
    });

    vardiyaSecimi?.addEventListener('change', async () => { guncelleVardiyaBilgisi(); await loadVardiyaData(); await checkAndUpdateFormStatus(); });
    tarihSecimi?.addEventListener('change', async () => { await loadVardiyaData(); await checkAndUpdateFormStatus(); });

    // Otomatik ayarlar
    async function otomatikAyarlar() {
        const today = new Date();
        tarihSecimi.value = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;
        const hour = today.getHours();
        vardiyaSecimi.value = hour >= 8 && hour < 16 ? '08-16' : hour >= 16 && hour < 24 ? '16-24' : '24-08';
        if (currentHourElement) currentHourElement.textContent = `${String(hour).padStart(2,'0')}:00`;
        guncelleVardiyaBilgisi();
        await loadVardiyaData();
        await checkAndUpdateFormStatus();
    }

    await otomatikAyarlar();
    setInterval(async () => {
        const hours = String(new Date().getHours()).padStart(2, '0');
        if (currentHourElement && currentHourElement.textContent !== `${hours}:00`) {
            currentHourElement.textContent = `${hours}:00`;
            await checkAndUpdateFormStatus();
        }
    }, 60000);
});
