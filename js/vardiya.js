// ⏰ Otomatik yönlendirme kontrolü (15:59, 23:59, 07:59)
function checkAutoRedirect() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    
    // Yönlendirme saatleri: 15:59, 23:59, 07:59
    const redirectTimes = ['15:59', '23:59', '07:59'];
    
    if (redirectTimes.includes(currentTime)) {
        // Aktif vardiya varken kullaniciyi otomatik cikarma; kayit akisini bozabilir.
        if (localStorage.getItem('mevcutVardiya')) {
            console.log('Aktif vardiya var, otomatik yonlendirme atlandi.');
            return false;
        }
        console.log(`⏰ Otomatik yönlendirme saati: ${currentTime}`);
        
        // Vardiya İşlem Kaydetme modal'ı açık mı kontrol et
        const islemModal = document.querySelector('.islem-detaylari-modal');
        if (islemModal) {
            console.log('💾 Vardiya İşlem Kaydetme açık, kaydediliyor...');
            // Modal'ı kapat ve kaydet
            islemModal.remove();
        }
        
        // 2 saniye bekle ve yönlendir
        setTimeout(() => {
            localStorage.removeItem('loggedInUser');
            window.location.href = 'index.html';
        }, 2000);
        return true;
    }
    return false;
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
        
        console.log('Vardiya - Kullanici adi ayarlandi:', fullName || user.email || 'Kullanici');
    } catch (e) {
        console.error('Vardiya - Kullanici bilgileri okunamadi:', e);
        const allElements = document.querySelectorAll('[id="userNameDisplay"]');
        allElements.forEach(element => {
            element.textContent = 'Kullanici';
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Önce kimlik dogrulama kontrolü
    checkAuth();
    
    // ⏰ Otomatik yönlendirme kontrolünü başlat (her dakika kontrol et)
    checkAutoRedirect();
    setInterval(checkAutoRedirect, 60000); // Her 60 saniyede bir kontrol et
    
    // Vardiya Google Apps Script URL
    const VARDIYA_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxnCKSZtDelL04-ZQY3yx_ePSCK9Qy9R0WgFwtsFXj_B6HayfmwM8i_HYU-AAUETleSRA/exec';
    const VARDIYA_CONTROL_URLS = {
        saatlik: 'https://script.google.com/macros/s/AKfycbyFwSoehdajKxEGYnw5UWNlPYvpVMl0WJ43i_sl3wsxdD5-AoRAMgIX3-uxXFZUfJTC-Q/exec',
        motor: 'https://script.google.com/macros/s/AKfycbxNCwKHONUEqjf-Ptc-FuiwFPIYDjd_hLoYBgYs7uosM3eTa2gQZySnUHUQdrE55k2QaQ/exec',
        enerji: 'https://script.google.com/macros/s/AKfycbw80nNh6VtH3ZTwSPl5Z6W4ekI65Zo1UAm9CTnR4WESugakAnMsPzfFdbemzNgqAsDHhQ/exec',
        bildirim: 'https://script.google.com/macros/s/AKfycbyjW5gbtw0BRHjDlmeLYmaio0UQWw8DG1B89X85BYwI-dw4YqaTuEPYilmv6B_xrXDmTA/exec'
    };
    
    // Tarih seçicisine otomatik bugünün tarihini atama
    const tarihInput = document.getElementById('tarih');
    const vardiyaSelect = document.getElementById('vardiya');
    const personelSelect = document.getElementById('personel');
    const operatorStatus = document.getElementById('operatorStatus');
    const kaydetBtn = document.getElementById('kaydetBtn');
    const temizleBtn = document.getElementById('temizleBtn');
    const islemKaydetBtn = document.getElementById('islemKaydetBtn');
    const vardiyaBitirBtn = document.getElementById('vardiyaBitirBtn');
    const teslimOzetiInput = document.getElementById('teslimOzeti');
    const devredenIslerInput = document.getElementById('devredenIsler');
    const dikkatNotuInput = document.getElementById('dikkatNotu');
    
    // Haftalık vardiya kayıtları elementleri
    const baslangicTarihInput = document.getElementById('baslangicTarih');
    const bitisTarihInput = document.getElementById('bitisTarih');
    const tarihFiltreBtn = document.getElementById('tarihFiltreBtn');
    const tarihSifirlaBtn = document.getElementById('tarihSifirlaBtn');
    
    // Yardımcı operatör elementleri
    const yardimciOperatorSection = document.getElementById('yardimciOperatorSection');
    const yardimciOperatorVar = document.getElementById('yardimciOperatorVar');
    const yardimciOperatorListesi = document.getElementById('yardimciOperatorListesi');
    const yardimciOperator = document.getElementById('yardimciOperator');

    
    // Bugünün tarihini al ve input'a ata (DD.MM.YYYY formatında)
    const today = new Date();
    tarihInput.value = formatDateTR(today);

    // Vardiya kayıtları için varsayılan tarih aralığı (son 30 gün)
    setDefaultDateRange();

    function formatDateTR(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${day}.${month}.${year}`;
    }

    function formatDateInputValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function setDefaultDateRange() {
        const bitis = new Date();
        const baslangic = new Date();
        baslangic.setDate(baslangic.getDate() - 30);
        baslangicTarihInput.value = formatDateInputValue(baslangic);
        bitisTarihInput.value = formatDateInputValue(bitis);
    }

    function parseDateValue(value) {
        if (!value) return null;
        const text = String(value).trim();
        const isoParts = text.split('-');
        if (isoParts.length === 3) {
            return new Date(Number(isoParts[0]), Number(isoParts[1]) - 1, Number(isoParts[2]));
        }

        const trParts = text.split('.');
        if (trParts.length === 3) {
            return new Date(Number(trParts[2]), Number(trParts[1]) - 1, Number(trParts[0]));
        }

        return null;
    }

    function toIsoDateParam(value) {
        const date = parseDateValue(value);
        return date ? formatDateInputValue(date) : value;
    }

    function isActiveStatus(value) {
        return String(value || '').trim().toLowerCase() === 'aktif';
    }

    function clearMevcutVardiyaDisplay() {
        localStorage.removeItem('mevcutVardiya');
        const mevcutVardiyaDiv = document.getElementById('mevcutVardiya');
        if (mevcutVardiyaDiv) {
            mevcutVardiyaDiv.style.display = 'none';
        }
    }

    async function fetchControlJson(baseUrl, params) {
        const url = new URL(baseUrl);
        Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));
        const response = await fetch(url);
        return response.json();
    }

    function getShiftHours(vardiya) {
        if (vardiya === '08-16') return [8, 9, 10, 11, 12, 13, 14, 15];
        if (vardiya === '16-24') return [16, 17, 18, 19, 20, 21, 22, 23];
        return [0, 1, 2, 3, 4, 5, 6, 7];
    }

    function normalizeDateText(value) {
        const date = parseDateValue(value);
        return date ? formatDateTR(date) : String(value || '');
    }

    function recordMatchesDate(record, trDate) {
        const text = String(record.tarih || '');
        const parts = trDate.split('.');
        const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        return text.includes(trDate) || text.startsWith(iso);
    }

    function buildMissingForShift(records, trDate, vardiya, moduleName) {
        const motors = moduleName === 'saatlik' ? [''] : ['GM-1', 'GM-2', 'GM-3'];
        const missing = [];
        getShiftHours(vardiya).forEach(hour => {
            const saat = `${String(hour).padStart(2, '0')}:00`;
            motors.forEach(motor => {
                const exists = records.some(record =>
                    recordMatchesDate(record, trDate) &&
                    record.saat === saat &&
                    (!motor || String(record.motor || '').trim() === motor)
                );
                if (!exists) missing.push(motor ? `${saat} ${motor}` : saat);
            });
        });
        return missing;
    }

    async function runVardiyaClosePrecheck(vardiya) {
        const trDate = normalizeDateText(vardiya.tarih || tarihInput.value);
        const selectedShift = vardiya.vardiya || vardiyaSelect.value;
        const [saatlik, motor, enerji, bildirim] = await Promise.all([
            fetchControlJson(VARDIYA_CONTROL_URLS.saatlik, { action: 'getLastRecords', count: '48' }),
            fetchControlJson(VARDIYA_CONTROL_URLS.motor, { action: 'getLastRecords', count: '120' }),
            fetchControlJson(VARDIYA_CONTROL_URLS.enerji, { action: 'getLastRecords', count: '120' }),
            fetchControlJson(VARDIYA_CONTROL_URLS.bildirim, { action: 'getAnnouncements', active: 'true' })
        ]);

        const warnings = [];
        if (saatlik.success) {
            const missing = buildMissingForShift(saatlik.data || [], trDate, selectedShift, 'saatlik');
            if (missing.length) warnings.push(`Saatlik eksik: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '...' : ''}`);
        }
        if (motor.success) {
            const missing = buildMissingForShift(motor.data || [], trDate, selectedShift, 'motor');
            if (missing.length) warnings.push(`Kojen motor eksik: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '...' : ''}`);
        }
        if (enerji.success) {
            const missing = buildMissingForShift(enerji.data || [], trDate, selectedShift, 'enerji');
            if (missing.length) warnings.push(`Kojen enerji eksik: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '...' : ''}`);
        }
        if (bildirim.success) {
            const critical = (bildirim.data || []).filter(item => item.priority === 'high' && !item.completed);
            if (critical.length) warnings.push(`Tamamlanmamis kritik duyuru: ${critical.map(item => item.title || item.message).join(', ')}`);
        }
        return warnings;
    }

    // Vardiya seçicisine otomatik değeri ata (saate göre)
    function setVardiyaByHour() {
        const now = new Date();
        const currentHour = now.getHours();
        
        console.log('Şu anki saat:', currentHour);
        console.log('Vardiya select elementi:', vardiyaSelect);
        
        // 08:00 - 16:00 arası: 08-16 vardiyası
        // 16:00 - 24:00 arası: 16-24 vardiyası  
        // 00:00 - 08:00 arası: 24-08 vardiyası
        if (currentHour >= 8 && currentHour < 16) {
            vardiyaSelect.value = '08-16';
            console.log('Gündüz vardiyası seçildi: 08-16');
        } else if (currentHour >= 16 && currentHour < 24) {
            vardiyaSelect.value = '16-24';
            console.log('Akşam vardiyası seçildi: 16-24');
        } else {
            vardiyaSelect.value = '24-08';
            console.log('Gece vardiyası seçildi: 24-08');
        }
        
        console.log('Vardiya değeri:', vardiyaSelect.value);
        
        // Vardiya değiştiğinde yardımcı operatör bölümünü kontrol et
        yardimciOperatorKontrolu();
    }
    setVardiyaByHour(); // Fonksiyonu sayfa yüklendikten sonra çağır

    // Vardiya başlat - Google Sheets
    kaydetBtn.addEventListener('click', async function() {
        const selectedPersonelId = personelSelect.value;
        const selectedVardiya = vardiyaSelect.value;
        const selectedTarih = tarihInput.value;
        
        if (!selectedPersonelId || !selectedVardiya || !selectedTarih) {
            alert('Lütfen tüm alanları doldurun!');
            return;
        }

        if (!operatorYetkisiKontrolu()) {
            alert('Seçilen personelin operatör yetkisi yok!');
            return;
        }

        const selectedPersonel = personelListesi.find(p => p.id == selectedPersonelId);
        const vardiyaAdi = vardiyaSelect.options[vardiyaSelect.selectedIndex].text;

        // Yardımcı operatör bilgisi
        let yardimciOperatorBilgisi = '';
        const yardimciOperatorId = yardimciOperator.value;
        const yardimciOperatorVarMi = yardimciOperatorVar.checked;

        if (yardimciOperatorId && yardimciOperatorVarMi) {
            const yardimciPersonel = personelListesi.find(p => p.id == yardimciOperatorId);
            yardimciOperatorBilgisi = yardimciPersonel.adSoyad;
        }

        // Buton loading durumu
        kaydetBtn.textContent = 'KAYDEDİLİYOR...';
        kaydetBtn.disabled = true;

        try {
            // Tarih formatını GG.AA.YYYY'den YYYY-AA-GG'ye çevir
            const formattedTarih = toIsoDateParam(selectedTarih);

            // Mevcut kayıt var mı kontrol et
            const checkUrl = new URL(VARDIYA_APPS_SCRIPT_URL);
            checkUrl.searchParams.append('action', 'getRecordByDateVardiya');
            checkUrl.searchParams.append('tarih', formattedTarih);
            checkUrl.searchParams.append('vardiya', selectedVardiya);

            const checkResponse = await fetch(checkUrl);
            const checkResult = await checkResponse.json();

            if (checkResult.found && checkResult.data && checkResult.data.durum === 'Aktif') {
                if (confirm('Bu tarih ve vardiya için aktif kayıt var. Devam edilsin mi?')) {
                    // Mevcut kaydı bitir
                    const endUrl = new URL(VARDIYA_APPS_SCRIPT_URL);
                    endUrl.searchParams.append('action', 'endVardiya');
                    endUrl.searchParams.append('id', checkResult.data.id || '');
                    endUrl.searchParams.append('tarih', formattedTarih);
                    endUrl.searchParams.append('vardiya', selectedVardiya);
                    
                    await fetch(endUrl);
                } else {
                    kaydetBtn.textContent = 'VARDİYA BAŞLAT';
                    kaydetBtn.disabled = false;
                    return;
                }
            }

            // Yeni kayıt ekle
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'addRecord');
            url.searchParams.append('tarih', formattedTarih);
            url.searchParams.append('vardiya', selectedVardiya);
            url.searchParams.append('personel', selectedPersonel.adSoyad);
            url.searchParams.append('operator', selectedPersonel.adSoyad);
            url.searchParams.append('yardimciOperator', yardimciOperatorBilgisi);

            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                const vardiyaBilgisi = {
                    id: result.data.id,
                    vardiya: selectedVardiya,
                    vardiyaAdi: vardiyaAdi,
                    tarih: selectedTarih,
                    personelId: selectedPersonelId,
                    personelAdSoyad: selectedPersonel.adSoyad,
                    pozisyon: selectedPersonel.pozisyon,
                    baslangicZamani: new Date().toLocaleString('tr-TR'),
                    yardimciOperator: yardimciOperatorId && yardimciOperatorVarMi ? {
                        id: yardimciOperatorId,
                        adSoyad: yardimciOperatorBilgisi,
                        pozisyon: personelListesi.find(p => p.id == yardimciOperatorId).pozisyon
                    } : null,
                    islemler: []
                };

                localStorage.setItem('mevcutVardiya', JSON.stringify(vardiyaBilgisi));
                window.SystemAuditLog?.write?.('Vardiya baslatildi', `${selectedVardiya} - ${selectedPersonel.adSoyad}`, 'ok');
                mevcutVardiyaBilgisi();
                alert('Vardiya başarıyla başlatıldı! (ID: ' + result.data.id + ')');
                haftalikVardiyaKayitlariniGoster();
            } else {
                alert('Hata: ' + (result.error || 'İşlem başarısız!'));
            }
        } catch (error) {
            console.error('Vardiya kayıt hatası:', error);
            alert('Bağlantı hatası!');
        } finally {
            kaydetBtn.textContent = 'VARDİYA BAŞLAT';
            kaydetBtn.disabled = false;
        }
    });

    // Vardiya bitir - Google Sheets
    vardiyaBitirBtn.addEventListener('click', async function() {
        if (confirm('Vardiya bitirilsin mi?')) {
            const mevcutVardiya = localStorage.getItem('mevcutVardiya');
            if (mevcutVardiya) {
                const vardiya = JSON.parse(mevcutVardiya);
                const teslimOzeti = teslimOzetiInput?.value.trim() || '';

                if (teslimOzeti.length < 10) {
                    alert('Vardiya bitirmek icin teslim ozeti zorunludur. En az 10 karakterlik kisa ozet yazin.');
                    teslimOzetiInput?.focus();
                    return;
                }
                
                // Buton loading durumu
                vardiyaBitirBtn.textContent = 'BİTİRİLİYOR...';
                vardiyaBitirBtn.disabled = true;
                
                try {
                    const warnings = await runVardiyaClosePrecheck(vardiya);
                    if (warnings.length) {
                        const devam = confirm('Vardiya kapatma on kontrolunde uyarilar var:\n\n' + warnings.join('\n') + '\n\nYine de vardiya bitirilsin mi?');
                        if (!devam) {
                            window.SystemAuditLog?.write?.('Vardiya kapatma durduruldu', warnings.join(' | '), 'warn');
                            return;
                        }
                    }

                    // Tarih formatını çevir
                    const formattedTarih = toIsoDateParam(vardiya.tarih);
                    
                    // Vardiya bitir API çağrısı
                    const url = new URL(VARDIYA_APPS_SCRIPT_URL);
                    url.searchParams.append('action', 'endVardiya');
                    url.searchParams.append('id', vardiya.id || '');
                    url.searchParams.append('tarih', formattedTarih);
                    url.searchParams.append('vardiya', vardiya.vardiya || vardiyaSelect.value);
                    url.searchParams.append('teslimOzeti', teslimOzeti);
                    url.searchParams.append('devredenIsler', devredenIslerInput?.value.trim() || '');
                    url.searchParams.append('dikkatNotu', dikkatNotuInput?.value.trim() || '');
                    
                    const response = await fetch(url);
                    const result = await response.json();
                    
                    if (result.success) {
                        localStorage.removeItem('mevcutVardiya');
                        document.getElementById('mevcutVardiya').style.display = 'none';
                        personelSelect.value = '';
                        if (teslimOzetiInput) teslimOzetiInput.value = '';
                        if (devredenIslerInput) devredenIslerInput.value = '';
                        if (dikkatNotuInput) dikkatNotuInput.value = '';
                        operatorStatus.textContent = 'Personel seçiniz.';
                        operatorStatus.style.color = '#e74c3c';
                        window.SystemAuditLog?.write?.('Vardiya bitirildi', `${vardiya.vardiya || vardiyaSelect.value} - ${vardiya.personelAdSoyad || ''}`, 'ok');
                        
                        alert('Vardiya başarıyla bitirildi! (ID: ' + result.data.id + ')');
                        haftalikVardiyaKayitlariniGoster();
                    } else {
                        if (String(result.error || '').includes('Aktif vardiya')) {
                            clearMevcutVardiyaDisplay();
                            alert('Bu vardiya tarayicida aktif gorunuyordu ancak Google Sheets tarafinda aktif kayit bulunamadi. Eski yerel kayit temizlendi.');
                            haftalikVardiyaKayitlariniGoster();
                        } else {
                            alert('Hata: ' + (result.error || 'İşlem başarısız!'));
                        }
                    }
                } catch (error) {
                    console.error('Vardiya bitirme hatası:', error);
                    alert('Bağlantı hatası!');
                } finally {
                    vardiyaBitirBtn.textContent = 'VARDİYAYI BİTİR';
                    vardiyaBitirBtn.disabled = false;
                }
            }
        }
    });

    // Personel listesi (gerçek kullanıcı verileri)
    const personelListesi = [
        { id: 1771831539045, adSoyad: 'İBRAHİM OGÜN ŞAHİN', pozisyon: 'Operatör', operator: true },
        { id: 1771831665826, adSoyad: 'OGUZHAN YAYLALI', pozisyon: 'Operatör', operator: true },
        { id: 1771831695619, adSoyad: 'ALTAN HUNOĞLU', pozisyon: 'Operatör', operator: true },
        { id: 1771831749332, adSoyad: 'MURAT COŞKUN', pozisyon: 'Admin', operator: true },
        { id: 1773382635961, adSoyad: 'KADİR KORKMAZ', pozisyon: 'Admin', operator: true },
        { id: 1774245338572, adSoyad: 'ADMİN', pozisyon: 'Admin', operator: true },
        { id: 9999999999, adSoyad: 'YAKUP CAN CİN', pozisyon: 'Operatör', operator: true }
    ];

    // Personel listesini doldur (sadece operatör rolündeki kullanıcılar)
    function personelListesiniDoldur() {
        personelSelect.innerHTML = '<option value="">Personel seçin...</option>';
        const operatorler = personelListesi.filter(p => p.pozisyon === 'Operatör');
        operatorler.forEach(personel => {
            const option = document.createElement('option');
            option.value = personel.id;
            option.textContent = personel.adSoyad;
            personelSelect.appendChild(option);
        });
    }
    personelListesiniDoldur();

    // Yardımcı operatör listesini doldur (mevcut operatörler, ana operatör hariç)
    function yardimciOperatorListesiniDoldur() {
        yardimciOperator.innerHTML = '<option value="">Yardımcı operatör seçin...</option>';
        const anaOperatorId = personelSelect.value;
        
        // Mevcut operatörler (seçili olan hariç)
        const yardimciOperatörler = personelListesi.filter(p => 
            p.operator === true && p.id != anaOperatorId && p.pozisyon === 'Operatör'
        );
        
        if (yardimciOperatörler.length === 0) {
            // Yardımcı operatör yok
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Diğer operatörler mevcut değil";
            option.disabled = true;
            yardimciOperator.appendChild(option);
        } else {
            yardimciOperatörler.forEach(personel => {
                const option = document.createElement('option');
                option.value = personel.id;
                option.textContent = `${personel.adSoyad} - ${personel.pozisyon}`;
                yardimciOperator.appendChild(option);
            });
        }
    }
    yardimciOperatorListesiniDoldur();

    // Yardımcı operatör kontrolü (sadece gündüz vardiyasında göster)
    function yardimciOperatorKontrolu() {
        const selectedVardiya = vardiyaSelect.value;
        
        if (selectedVardiya === '08-16') {
            yardimciOperatorSection.style.display = 'block';
        } else {
            yardimciOperatorSection.style.display = 'none';
            yardimciOperatorVar.checked = false;
            yardimciOperatorListesi.style.display = 'none';
        }
    }

    // Vardiya değiştiğinde yardımcı operatör kontrolü
    vardiyaSelect.addEventListener('change', yardimciOperatorKontrolu);

    // Yardımcı operatör checkbox'ı değiştiğinde
    yardimciOperatorVar.addEventListener('change', function() {
        if (this.checked) {
            yardimciOperatorListesi.style.display = 'block';
        } else {
            yardimciOperatorListesi.style.display = 'none';
            yardimciOperator.value = '';
        }
    });

    // Personel listesi tablosunu doldur (sadece operatör rolündeki kullanıcılar)
    function personelTablosunuDoldur() {
        const tbody = document.getElementById('personelTableBody');
        tbody.innerHTML = '';
        
        const operatorler = personelListesi.filter(p => p.pozisyon === 'Operatör');
        operatorler.forEach(personel => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${personel.adSoyad}</td>
                <td>${personel.pozisyon}</td>
                <td>${personel.operator ? '✅ Evet' : '❌ Hayır'}</td>
                <td><span class="status-badge ${personel.operator ? 'operator' : 'non-operator'}">${personel.operator ? 'Operatör' : 'Operatör Değil'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
    personelTablosunuDoldur();

    // Operatör yetkisi kontrolü
    function operatorYetkisiKontrolu() {
        const selectedPersonelId = personelSelect.value;
        if (!selectedPersonelId) {
            operatorStatus.textContent = 'Personel seçiniz.';
            operatorStatus.style.color = '#e74c3c';
            return false;
        }

        const selectedPersonel = personelListesi.find(p => p.id == selectedPersonelId);
        if (selectedPersonel && selectedPersonel.operator) {
            operatorStatus.textContent = '✅ Operatör yetkisi var';
            operatorStatus.style.color = '#28a745';
            return true;
        } else {
            operatorStatus.textContent = '❌ Operatör yetkisi yok';
            operatorStatus.style.color = '#dc3545';
            return false;
        }
    }

    // Personel seçimi değiştiğinde yardımcı operatör listesini güncelle
    personelSelect.addEventListener('change', function() {
        operatorYetkisiKontrolu();
        yardimciOperatorListesiniDoldur();
    });

    // Vardiya seçimi değiştiğinde mevcut vardiya formunu güncelle
    vardiyaSelect.addEventListener('change', function() {
        yardimciOperatorKontrolu();
    });

    // Başlangıçta yetki kontrolü yap
    operatorYetkisiKontrolu();

    // Mevcut vardiya bilgisi (Google Sheets ile dogrula)
    mevcutVardiyaBilgisiDogrula();

    // Haftalık vardiya kayıtlarını göster
    haftalikVardiyaKayitlariniGoster();

    // Tarih filtrele butonu
    tarihFiltreBtn.addEventListener('click', function() {
        haftalikVardiyaKayitlariniGoster();
    });

    // Tarih sıfırla butonu
    tarihSifirlaBtn.addEventListener('click', function() {
        // Tarih alanlarını temizle
        setDefaultDateRange();
        
        haftalikVardiyaKayitlariniGoster();
    });

    // İşlem detaylarını göster
    async function islemDetaylariniGoster() {
        // Modal oluştur (loading ile)
        const modal = document.createElement('div');
        modal.className = 'islem-detaylari-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📋 İşlem Detayları</h2>
                    <button class="modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px; color: #6c757d;">
                        İşlemler yükleniyor...
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Modal kapatma butonuna event listener ekle
        const modalCloseBtn = modal.querySelector('.modal-close');
        const modalOverlay = modal.querySelector('.modal-overlay');
        
        modalCloseBtn.addEventListener('click', function() {
            modal.remove();
        });
        
        modalOverlay.addEventListener('click', function() {
            modal.remove();
        });
        
        try {
            console.log('📊 Vardiya kayıtları ve işlemler tek seferde çekiliyor...');
            // Google Sheets'ten vardiya kayıtlarını ve işlemleri tek seferde çek
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecordsWithIslemler');
            url.searchParams.append('count', '270'); // Son 90 gün
            
            const response = await fetch(url);
            const result = await response.json();
            
            console.log('📊 Sonuç:', result);
            
            if (!result.success) {
                throw new Error(result.error || 'İşlemler yüklenemedi');
            }
            
            const tumVardiyaKayitlari = result.data || [];
            const mevcutVardiya = localStorage.getItem('mevcutVardiya');
            
            console.log('📊 Toplam vardiya sayısı:', tumVardiyaKayitlari.length);
            
            // İşlemler her vardiya kaydının içinde (islemler) olarak geliyor
            // Map oluşturmaya gerek yok, direkt kullanabiliriz
            const vardiyaIslemleriMap = new Map();
            tumVardiyaKayitlari.forEach(vardiya => {
                if (vardiya.id) {
                    vardiyaIslemleriMap.set(vardiya.id, vardiya.islemler || []);
                }
            });
            
            console.log('📊 İşlemler yüklendi');
            
            // Modal içeriğini güncelle
            const modalBody = modal.querySelector('.modal-body');
            modalBody.innerHTML = islemDetaylariHTML(tumVardiyaKayitlari, mevcutVardiya, vardiyaIslemleriMap);
            
        } catch (error) {
            console.error('❌ İşlem detayları yükleme hatası:', error);
            const modalBody = modal.querySelector('.modal-body');
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #e74c3c;">
                    İşlemler yüklenemedi: ${error.message}
                </div>
            `;
        }
    }

    // İşlem detayları HTML'i oluştur
    function islemDetaylariHTML(tumVardiyaKayitlari, mevcutVardiya, vardiyaIslemleriMap) {
        let html = '';
        
        // Mevcut vardiya işlemleri (localStorage'dan)
        if (mevcutVardiya) {
            const vardiya = JSON.parse(mevcutVardiya);
            html += `
                <div class="islem-grubu">
                    <h3>🔄 Mevcut Vardiya İşlemleri</h3>
                    <div class="islem-listesi">
                        ${vardiya.islemler && vardiya.islemler.length > 0 ? 
                            vardiya.islemler.map(islem => `
                                <div class="islem-item">
                                    <div class="islem-baslik">${islem.islem}</div>
                                    <div class="islem-zaman">${islem.zaman}</div>
                                    <div class="islem-kaydeden">Kaydeden: ${islem.kaydeden}</div>
                                </div>
                            `).join('') : 
                            '<div class="bos-mesaj">Henüz işlem kaydedilmemiş.</div>'
                        }
                    </div>
                </div>
            `;
        }
        
        // Arşivlenmiş vardiya işlemleri (Google Sheets'ten)
        if (tumVardiyaKayitlari.length > 0) {
            // İşlemi olan vardiyaları filtrele
            const islemliVardiyalar = tumVardiyaKayitlari.filter(vardiya => {
                const islemler = vardiyaIslemleriMap.get(vardiya.id);
                return islemler && islemler.length > 0;
            });
            
            if (islemliVardiyalar.length > 0) {
                html += `
                    <div class="islem-grubu">
                        <h3>📁 Arşivlenmiş Vardiya İşlemleri</h3>
                        <div class="islem-listesi">
                            ${islemliVardiyalar.map(vardiya => {
                                const islemler = vardiyaIslemleriMap.get(vardiya.id) || [];
                                const vardiyaAdiMap = {
                                    '08-16': '08:00 - 16:00',
                                    '16-24': '16:00 - 24:00',
                                    '24-08': '24:00 - 08:00'
                                };
                                
                                return `
                                    <div class="vardiya-grubu">
                                        <div class="vardiya-baslik">
                                            📅 ${vardiya.tarih} - ${vardiyaAdiMap[vardiya.vardiya] || vardiya.vardiya}
                                            <span class="personel-info">${vardiya.personel || '-'}</span>
                                        </div>
                                        <div class="vardiya-islemleri">
                                            ${islemler.length > 0 ? 
                                                islemler.map(islem => `
                                                    <div class="islem-item">
                                                        <div class="islem-baslik">${islem.islem}</div>
                                                        <div class="islem-zaman">${islem.zaman}</div>
                                                        <div class="islem-kaydeden">Kaydeden: ${islem.kaydeden}</div>
                                                    </div>
                                                `).join('') : 
                                                '<div class="bos-mesaj">Bu vardiya için işlem kaydedilmemiş.</div>'
                                            }
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="islem-grubu">
                        <h3>📁 Arşivlenmiş Vardiya İşlemleri</h3>
                        <div class="islem-listesi">
                            <div class="bos-mesaj">Arşivde işlem kaydı bulunamadı.</div>
                        </div>
                    </div>
                `;
            }
        }
        
        if (!mevcutVardiya && tumVardiyaKayitlari.length === 0) {
            html = '<div class="bos-mesaj">Henüz hiç vardiya kaydı bulunamadı.</div>';
        }
        
        return html;
    }

    // İşlem detayları linkine event listener ekle
    const islemDetayLink = document.getElementById('islemDetayLink');
    if (islemDetayLink) {
        islemDetayLink.addEventListener('click', function(e) {
            e.preventDefault();
            islemDetaylariniGoster();
        });
    }

    // Mevcut vardiya bilgisi (localStorage'dan)
    function mevcutVardiyaBilgisi() {
        const mevcutVardiya = localStorage.getItem('mevcutVardiya');
        if (mevcutVardiya) {
            const vardiya = JSON.parse(mevcutVardiya);
            const mevcutVardiyaDiv = document.getElementById('mevcutVardiya');
            
            document.getElementById('mevcutVardiyaAdi').textContent = vardiya.vardiyaAdi;
            document.getElementById('mevcutTarih').textContent = vardiya.tarih;
            document.getElementById('mevcutPersonel').textContent = vardiya.personelAdSoyad;
            document.getElementById('mevcutBaslangic').textContent = vardiya.baslangicZamani;
            
            // Yardımcı operatör bilgisini göster
            const yardimciOperatorInfo = document.getElementById('mevcutYardimciOperator');
            if (yardimciOperatorInfo) {
                if (vardiya.yardimciOperator) {
                    yardimciOperatorInfo.textContent = `${vardiya.yardimciOperator.adSoyad} - ${vardiya.yardimciOperator.pozisyon}`;
                } else {
                    yardimciOperatorInfo.textContent = 'Yok';
                }
            }
            
            mevcutVardiyaDiv.style.display = 'block';
            
            // Formu doldur
            tarihInput.value = vardiya.tarih;
            vardiyaSelect.value = vardiya.vardiya;
            personelSelect.value = vardiya.personelId;
            
            // Yardımcı operatör bilgisi
            if (vardiya.yardimciOperator) {
                yardimciOperatorVar.checked = true;
                yardimciOperatorListesi.style.display = 'block';
                yardimciOperator.value = vardiya.yardimciOperator.id;
            }
            
            operatorYetkisiKontrolu();
            
            return true;
        }
        return false;
    }

    // İşlem kaydetme - Google Sheets
    async function mevcutVardiyaBilgisiDogrula() {
        const mevcutVardiya = localStorage.getItem('mevcutVardiya');
        if (!mevcutVardiya) return false;

        try {
            const vardiya = JSON.parse(mevcutVardiya);
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getRecordByDateVardiya');
            url.searchParams.append('tarih', toIsoDateParam(vardiya.tarih));
            url.searchParams.append('vardiya', vardiya.vardiya);

            const response = await fetch(url);
            const result = await response.json();
            const sheetRecord = result && result.success && result.found ? result.data : null;
            const sameRecord = sheetRecord && (!vardiya.id || !sheetRecord.id || String(sheetRecord.id) === String(vardiya.id));

            if (sameRecord && isActiveStatus(sheetRecord.durum)) {
                return mevcutVardiyaBilgisi();
            }

            clearMevcutVardiyaDisplay();
            console.warn('Yerel aktif vardiya kaydi Google Sheets ile eslesmedi, temizlendi.', vardiya, sheetRecord);
            return false;
        } catch (error) {
            console.error('Mevcut vardiya dogrulama hatasi:', error);
            return mevcutVardiyaBilgisi();
        }
    }

    const islemKaydetmeBtn = document.getElementById('islemKaydetBtn');
    const islemAciklama = document.getElementById('islemAciklama');

    islemKaydetmeBtn.addEventListener('click', async function() {
        const aciklama = islemAciklama.value.trim();
        
        if (!aciklama) {
            alert('Lütfen işlem açıklamasını girin!');
            return;
        }

        // Mevcut vardiya varsa işlemi kaydet
        const mevcutVardiya = localStorage.getItem('mevcutVardiya');
        if (!mevcutVardiya) {
            alert('Aktif vardiya bulunamadı!');
            return;
        }

        const vardiya = JSON.parse(mevcutVardiya);
        
        // Buton loading durumu
        islemKaydetmeBtn.textContent = 'KAYDEDİLİYOR...';
        islemKaydetmeBtn.disabled = true;
        
        try {
            // Google Sheets'e işlem kaydet
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'addIslem');
            url.searchParams.append('vardiyaId', vardiya.id);
            url.searchParams.append('islem', aciklama);
            url.searchParams.append('zaman', new Date().toLocaleString('tr-TR'));
            url.searchParams.append('kaydeden', vardiya.personelAdSoyad || 'Operatör');
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                const yeniIslem = {
                    islem: aciklama,
                    zaman: new Date().toLocaleString('tr-TR'),
                    kaydeden: vardiya.personelAdSoyad || 'Operatör'
                };

                // Vardiya işlemlerini güncelle (localStorage)
                if (!vardiya.islemler) {
                    vardiya.islemler = [];
                }
                vardiya.islemler.push(yeniIslem);
                localStorage.setItem('mevcutVardiya', JSON.stringify(vardiya));
                window.SystemAuditLog?.write?.('Vardiya islemi eklendi', islemAciklama.value.trim().slice(0, 80), 'ok');
                
                // Alanı temizle
                islemAciklama.value = '';
                
                alert('İşlem başarıyla kaydedildi! (ID: ' + result.data.id + ')');
            } else {
                alert('Hata: ' + (result.error || 'İşlem başarısız!'));
            }
        } catch (error) {
            console.error('İşlem kayıt hatası:', error);
            alert('Bağlantı hatası!');
        } finally {
            islemKaydetmeBtn.textContent = 'İŞLEMİ KAYDET';
            islemKaydetmeBtn.disabled = false;
        }
    });

    // Haftalık vardiya kayıtlarını göster - Google Sheets
    async function haftalikVardiyaKayitlariniGoster() {
        const haftalikVardiyaTableBody = document.getElementById('haftalikVardiyaTableBody');
        
        // Loading mesajı göster
        haftalikVardiyaTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
                    Kayıtlar yükleniyor...
                </td>
            </tr>
        `;
        
        try {
            // Google Sheets'ten son kayıtları ve işlemleri tek seferde çek (son 90 gün için yeterli)
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecordsWithIslemler');
            url.searchParams.append('count', '270'); // 90 gün * 3 vardiya
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (!result.success) {
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #e74c3c; padding: 20px;">
                            Kayıtlar yüklenemedi: ${result.error || 'Bilinmeyen hata'}
                        </td>
                    </tr>
                `;
                return;
            }
            
            const tumIslemler = result.data || [];
            haftalikVardiyaTableBody.innerHTML = '';
            
            console.log('Google Sheets vardiya kayıtları:', tumIslemler);
            
            if (tumIslemler.length === 0) {
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
                            Vardiya kaydı bulunamadı.
                        </td>
                    </tr>
                `;
                return;
            }
            
            // İşlemler her vardiya kaydının içinde (islemler) olarak geliyor
            const vardiyaIslemleriMap = new Map();
            tumIslemler.forEach(vardiya => {
                if (vardiya.id) {
                    vardiyaIslemleriMap.set(vardiya.id, vardiya.islemler || []);
                }
            });
            
            // Tarih aralığına göre filtrele
            const baslangicTarihInput = document.getElementById('baslangicTarih').value;
            const bitisTarihInput = document.getElementById('bitisTarih').value;
            
            let filtrelenmisKayitlar = tumIslemler;
            
            if (baslangicTarihInput && bitisTarihInput) {
                // Kullanıcı tarih seçtiyse o aralıktaki kayıtları göster
                const baslangicDate = parseDateValue(baslangicTarihInput);
                const bitisDate = parseDateValue(bitisTarihInput);

                if (!baslangicDate || !bitisDate) {
                    haftalikVardiyaTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; color: #e74c3c; padding: 20px;">
                                Tarih araligi gecersiz.
                            </td>
                        </tr>
                    `;
                    return;
                }
                    
                filtrelenmisKayitlar = tumIslemler.filter(vardiya => {
                    const vardiyaTarihi = parseDateValue(vardiya.tarih);
                    return vardiyaTarihi && vardiyaTarihi >= baslangicDate && vardiyaTarihi <= bitisDate;
                });
            } else {
                // Tarih girilmediyse kayıtları gösterme
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
                            Tarih aralığı seçin.
                        </td>
                    </tr>
                `;
                return;
            }
            
            if (filtrelenmisKayitlar.length === 0) {
                const mesaj = baslangicTarihInput && bitisTarihInput 
                    ? 'Seçilen tarih aralığında vardiya kaydı bulunamadı.' 
                    : 'Tarih aralığı seçin veya kayıt bulunamadı.';
                    
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
                            ${mesaj}
                        </td>
                    </tr>
                `;
                return;
            }
            
            filtrelenmisKayitlar.forEach(vardiya => {
                const tr = document.createElement('tr');
                const vardiyaAdiMap = {
                    '08-16': '08:00 - 16:00',
                    '16-24': '16:00 - 24:00',
                    '24-08': '24:00 - 08:00'
                };
                
                // İşlem detaylarını formatla (VardiyaIslemleri sheet'inden)
                let islemDetaylariText = '-';
                const islemler = vardiyaIslemleriMap.get(vardiya.id) || [];
                
                if (islemler.length > 0) {
                    islemDetaylariText = islemler.map(i => `${i.islem} (${i.zaman})`).join(' | ');
                }
                
                tr.innerHTML = `
                    <td>${vardiya.tarih}</td>
                    <td>${vardiyaAdiMap[vardiya.vardiya] || vardiya.vardiya}</td>
                    <td>${vardiya.personel}</td>
                    <td>${vardiya.yardimciOperator || '-'}</td>
                    <td>${vardiya.baslangicSaati || '-'}</td>
                    <td>${vardiya.bitisSaati || '-'}</td>
                    <td>${islemDetaylariText}</td>
                `;
                
                haftalikVardiyaTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Vardiya kayıtları yükleme hatası:', error);
            haftalikVardiyaTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #e74c3c; padding: 20px;">
                        Bağlantı hatası! Kayıtlar yüklenemedi.
                    </td>
                </tr>
            `;
        }
    }

    // Çıkış yap butonları
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');
    
    sidebarLogout.addEventListener('click', handleLogout);
    headerLogout.addEventListener('click', handleLogout);
    
    function handleLogout() {
        if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
            localStorage.removeItem('rememberedEmail');
            window.location.href = 'anasayfa.html';
        }
    }

    // Sayfa değiştiğinde vardiyanın otomatik bitirilmesini engelle
    window.addEventListener('beforeunload', function(e) {
        // Vardiya bitirme mesajını engelle
        return null;
    });

    // Sayfa kapatıldığında vardiyanın kalmasını sağla
    window.addEventListener('unload', function() {
        // Vardiya bilgilerini koru, bitirme işlemi yapma
        return;
    });
});

