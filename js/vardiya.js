// â° Otomatik yÃ¶nlendirme kontrolÃ¼ (15:59, 23:59, 07:59)
function checkAutoRedirect() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    
    // YÃ¶nlendirme saatleri: 15:59, 23:59, 07:59
    const redirectTimes = ['15:59', '23:59', '07:59'];
    
    if (redirectTimes.includes(currentTime)) {
        // Aktif vardiya varken kullaniciyi otomatik cikarma; kayit akisini bozabilir.
        if (localStorage.getItem('mevcutVardiya')) {
            console.log('Aktif vardiya var, otomatik yonlendirme atlandi.');
            return false;
        }
        console.log(`â° Otomatik yÃ¶nlendirme saati: ${currentTime}`);
        
        // Vardiya Ä°ÅŸlem Kaydetme modal'Ä± aÃ§Ä±k mÄ± kontrol et
        const islemModal = document.querySelector('.islem-detaylari-modal');
        if (islemModal) {
            console.log('ğŸ’¾ Vardiya Ä°ÅŸlem Kaydetme aÃ§Ä±k, kaydediliyor...');
            // Modal'Ä± kapat ve kaydet
            islemModal.remove();
        }
        
        // 2 saniye bekle ve yÃ¶nlendir
        setTimeout(() => {
            localStorage.removeItem('loggedInUser');
            window.location.href = 'index.html';
        }, 2000);
        return true;
    }
    return false;
}

// Kimlik dogrulama kontrolÃ¼
function checkAuth() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        window.location.href = 'anasayfa.html';
        return;
    }
    
    try {
        const user = JSON.parse(loggedInUser);
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // TÃ¼m userNameDisplay elementlerini gÃ¼ncelle
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
    // Ã–nce kimlik dogrulama kontrolÃ¼
    checkAuth();
    
    // â° Otomatik yÃ¶nlendirme kontrolÃ¼nÃ¼ baÅŸlat (her dakika kontrol et)
    checkAutoRedirect();
    setInterval(checkAutoRedirect, 60000); // Her 60 saniyede bir kontrol et
    
    // Vardiya Google Apps Script URL
    const VARDIYA_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbylytHcQf5Uf_exGe9UZxwie9r8xzYhKFzRcrEBd0OLm7rXjulkkMd33O63rn0KL3QXeg/exec';
    const VARDIYA_CONTROL_URLS = {
        saatlik: 'https://script.google.com/macros/s/AKfycbyNov_Ynr4EifhOqXBb2YUAON9ctyUemz_ms1qLC_FygxC18HZ8mcnEThddZYjYdP7sdg/exec',
        motor: 'https://script.google.com/macros/s/AKfycbztrKVv4ioi72xRo7g7_YcaA9zAxq12wdvQk7o2yLMjV5FozhVnquc970_iuuhulrGySw/exec',
        enerji: 'https://script.google.com/macros/s/AKfycbyTefsxh9IOyLXrAoFeaxsjunnYpv42a205JTA7byRV0GgLGc9_35Rftp_lkX0KrQfhFw/exec',
        bildirim: 'https://script.google.com/macros/s/AKfycbyjW5gbtw0BRHjDlmeLYmaio0UQWw8DG1B89X85BYwI-dw4YqaTuEPYilmv6B_xrXDmTA/exec'
    };
    
    // Tarih seÃ§icisine otomatik bugÃ¼nÃ¼n tarihini atama
    const tarihInput = document.getElementById('tarih');
    const vardiyaSelect = document.getElementById('vardiya');
    const personelSelect = document.getElementById('personel');
    const operatorStatus = document.getElementById('operatorStatus');
    const kaydetBtn = document.getElementById('kaydetBtn');
    const temizleBtn = document.getElementById('temizleBtn');
    const islemKaydetBtn = document.getElementById('islemKaydetBtn');
    const vardiyaBitirBtn = document.getElementById('vardiyaBitirBtn');
    const devredenIslerInput = document.getElementById('devredenIsler');
    
    // HaftalÄ±k vardiya kayÄ±tlarÄ± elementleri
    const baslangicTarihInput = document.getElementById('baslangicTarih');
    const bitisTarihInput = document.getElementById('bitisTarih');
    const tarihFiltreBtn = document.getElementById('tarihFiltreBtn');
    const tarihSifirlaBtn = document.getElementById('tarihSifirlaBtn');
    
    // YardÄ±mcÄ± operatÃ¶r elementleri
    const yardimciOperatorSection = document.getElementById('yardimciOperatorSection');
    const yardimciOperatorVar = document.getElementById('yardimciOperatorVar');
    const yardimciOperatorListesi = document.getElementById('yardimciOperatorListesi');
    const yardimciOperator = document.getElementById('yardimciOperator');

    
    // BugÃ¼nÃ¼n tarihini al ve input'a ata (DD.MM.YYYY formatÄ±nda)
    const today = new Date();
    tarihInput.value = formatDateTR(today);

    // Vardiya kayÄ±tlarÄ± iÃ§in varsayÄ±lan tarih aralÄ±ÄŸÄ± (son 30 gÃ¼n)
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

    // Vardiya seÃ§icisine otomatik deÄŸeri ata (saate gÃ¶re)
    function setVardiyaByHour() {
        const now = new Date();
        const currentHour = now.getHours();
        
        console.log('Åu anki saat:', currentHour);
        console.log('Vardiya select elementi:', vardiyaSelect);
        
        // 08:00 - 16:00 arasÄ±: 08-16 vardiyasÄ±
        // 16:00 - 24:00 arasÄ±: 16-24 vardiyasÄ±  
        // 00:00 - 08:00 arasÄ±: 24-08 vardiyasÄ±
        if (currentHour >= 8 && currentHour < 16) {
            vardiyaSelect.value = '08-16';
            console.log('GÃ¼ndÃ¼z vardiyasÄ± seÃ§ildi: 08-16');
        } else if (currentHour >= 16 && currentHour < 24) {
            vardiyaSelect.value = '16-24';
            console.log('AkÅŸam vardiyasÄ± seÃ§ildi: 16-24');
        } else {
            vardiyaSelect.value = '24-08';
            console.log('Gece vardiyasÄ± seÃ§ildi: 24-08');
        }
        
        console.log('Vardiya deÄŸeri:', vardiyaSelect.value);
        
        // Vardiya deÄŸiÅŸtiÄŸinde yardÄ±mcÄ± operatÃ¶r bÃ¶lÃ¼mÃ¼nÃ¼ kontrol et
        yardimciOperatorKontrolu();
    }
    setVardiyaByHour(); // Fonksiyonu sayfa yÃ¼klendikten sonra Ã§aÄŸÄ±r

    // Vardiya baÅŸlat - Google Sheets
    kaydetBtn.addEventListener('click', async function() {
        const selectedPersonelId = personelSelect.value;
        const selectedVardiya = vardiyaSelect.value;
        const selectedTarih = tarihInput.value;
        
        if (!selectedPersonelId || !selectedVardiya || !selectedTarih) {
            alert('LÃ¼tfen tÃ¼m alanlarÄ± doldurun!');
            return;
        }

        if (!operatorYetkisiKontrolu()) {
            alert('SeÃ§ilen personelin operatÃ¶r yetkisi yok!');
            return;
        }

        const selectedPersonel = personelListesi.find(p => p.id == selectedPersonelId);
        const vardiyaAdi = vardiyaSelect.options[vardiyaSelect.selectedIndex].text;

        // YardÄ±mcÄ± operatÃ¶r bilgisi
        let yardimciOperatorBilgisi = '';
        const yardimciOperatorId = yardimciOperator.value;
        const yardimciOperatorVarMi = yardimciOperatorVar.checked;

        if (yardimciOperatorId && yardimciOperatorVarMi) {
            const yardimciPersonel = personelListesi.find(p => p.id == yardimciOperatorId);
            yardimciOperatorBilgisi = yardimciPersonel.adSoyad;
        }

        // Buton loading durumu
        kaydetBtn.textContent = 'KAYDEDÄ°LÄ°YOR...';
        kaydetBtn.disabled = true;

        try {
            // Tarih formatÄ±nÄ± GG.AA.YYYY'den YYYY-AA-GG'ye Ã§evir
            const formattedTarih = toIsoDateParam(selectedTarih);

            // Mevcut kayÄ±t var mÄ± kontrol et
            const checkUrl = new URL(VARDIYA_APPS_SCRIPT_URL);
            checkUrl.searchParams.append('action', 'getRecordByDateVardiya');
            checkUrl.searchParams.append('tarih', formattedTarih);
            checkUrl.searchParams.append('vardiya', selectedVardiya);

            const checkResponse = await fetch(checkUrl);
            const checkResult = await checkResponse.json();

            if (checkResult.found && checkResult.data && checkResult.data.durum === 'Aktif') {
                if (confirm('Bu tarih ve vardiya iÃ§in aktif kayÄ±t var. Devam edilsin mi?')) {
                    // Mevcut kaydÄ± bitir
                    const endUrl = new URL(VARDIYA_APPS_SCRIPT_URL);
                    endUrl.searchParams.append('action', 'endVardiya');
                    endUrl.searchParams.append('id', checkResult.data.id || '');
                    endUrl.searchParams.append('tarih', formattedTarih);
                    endUrl.searchParams.append('vardiya', selectedVardiya);
                    
                    await fetch(endUrl);
                } else {
                    kaydetBtn.textContent = 'VARDÄ°YA BAÅLAT';
                    kaydetBtn.disabled = false;
                    return;
                }
            }

            // Yeni kayÄ±t ekle
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
                alert('Vardiya baÅŸarÄ±yla baÅŸlatÄ±ldÄ±! (ID: ' + result.data.id + ')');
                haftalikVardiyaKayitlariniGoster();
            } else {
                alert('Hata: ' + (result.error || 'Ä°ÅŸlem baÅŸarÄ±sÄ±z!'));
            }
        } catch (error) {
            console.error('Vardiya kayÄ±t hatasÄ±:', error);
            alert('BaÄŸlantÄ± hatasÄ±!');
        } finally {
            kaydetBtn.textContent = 'VARDÄ°YA BAÅLAT';
            kaydetBtn.disabled = false;
        }
    });

    // Vardiya bitir - Google Sheets
    vardiyaBitirBtn.addEventListener('click', async function() {
        if (confirm('Vardiya bitirilsin mi?')) {
            const mevcutVardiya = localStorage.getItem('mevcutVardiya');
            if (mevcutVardiya) {
                const vardiya = JSON.parse(mevcutVardiya);
                // Buton loading durumu
                vardiyaBitirBtn.textContent = 'BÄ°TÄ°RÄ°LÄ°YOR...';
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

                    // Tarih formatÄ±nÄ± Ã§evir
                    const formattedTarih = toIsoDateParam(vardiya.tarih);
                    
                    // Vardiya bitir API Ã§aÄŸrÄ±sÄ±
                    const url = new URL(VARDIYA_APPS_SCRIPT_URL);
                    url.searchParams.append('action', 'endVardiya');
                    url.searchParams.append('id', vardiya.id || '');
                    url.searchParams.append('tarih', formattedTarih);
                    url.searchParams.append('vardiya', vardiya.vardiya || vardiyaSelect.value);
                    url.searchParams.append('devredenIsler', devredenIslerInput?.value.trim() || '');
                    
                    const response = await fetch(url);
                    const result = await response.json();
                    
                    if (result.success) {
                        localStorage.removeItem('mevcutVardiya');
                        document.getElementById('mevcutVardiya').style.display = 'none';
                        personelSelect.value = '';
                        if (devredenIslerInput) devredenIslerInput.value = '';
                        operatorStatus.textContent = 'Personel seÃ§iniz.';
                        operatorStatus.style.color = '#e74c3c';
                        window.SystemAuditLog?.write?.('Vardiya bitirildi', `${vardiya.vardiya || vardiyaSelect.value} - ${vardiya.personelAdSoyad || ''}`, 'ok');
                        
                        alert('Vardiya baÅŸarÄ±yla bitirildi! (ID: ' + result.data.id + ')');
                        haftalikVardiyaKayitlariniGoster();
                    } else {
                        if (String(result.error || '').includes('Aktif vardiya')) {
                            clearMevcutVardiyaDisplay();
                            alert('Bu vardiya tarayicida aktif gorunuyordu ancak Google Sheets tarafinda aktif kayit bulunamadi. Eski yerel kayit temizlendi.');
                            haftalikVardiyaKayitlariniGoster();
                        } else {
                            alert('Hata: ' + (result.error || 'Ä°ÅŸlem baÅŸarÄ±sÄ±z!'));
                        }
                    }
                } catch (error) {
                    console.error('Vardiya bitirme hatasÄ±:', error);
                    alert('BaÄŸlantÄ± hatasÄ±!');
                } finally {
                    vardiyaBitirBtn.textContent = 'VARDÄ°YAYI BÄ°TÄ°R';
                    vardiyaBitirBtn.disabled = false;
                }
            }
        }
    });

    // Personel listesi (gerÃ§ek kullanÄ±cÄ± verileri)
    const personelListesi = [
        { id: 1771831539045, adSoyad: 'Ä°BRAHÄ°M OGÃœN ÅAHÄ°N', pozisyon: 'OperatÃ¶r', operator: true },
        { id: 1771831665826, adSoyad: 'OGUZHAN YAYLALI', pozisyon: 'OperatÃ¶r', operator: true },
        { id: 1771831695619, adSoyad: 'ALTAN HUNOÄLU', pozisyon: 'OperatÃ¶r', operator: true },
        { id: 1771831749332, adSoyad: 'MURAT COÅKUN', pozisyon: 'Admin', operator: true },
        { id: 1773382635961, adSoyad: 'KADÄ°R KORKMAZ', pozisyon: 'Admin', operator: true },
        { id: 1774245338572, adSoyad: 'ADMÄ°N', pozisyon: 'Admin', operator: true },
        { id: 9999999999, adSoyad: 'YAKUP CAN CÄ°N', pozisyon: 'OperatÃ¶r', operator: true }
    ];

    // Personel listesini doldur (sadece operatÃ¶r rolÃ¼ndeki kullanÄ±cÄ±lar)
    function personelListesiniDoldur() {
        personelSelect.innerHTML = '<option value="">Personel seÃ§in...</option>';
        const operatorler = personelListesi.filter(p => p.pozisyon === 'OperatÃ¶r');
        operatorler.forEach(personel => {
            const option = document.createElement('option');
            option.value = personel.id;
            option.textContent = personel.adSoyad;
            personelSelect.appendChild(option);
        });
    }
    personelListesiniDoldur();

    // YardÄ±mcÄ± operatÃ¶r listesini doldur (mevcut operatÃ¶rler, ana operatÃ¶r hariÃ§)
    function yardimciOperatorListesiniDoldur() {
        yardimciOperator.innerHTML = '<option value="">YardÄ±mcÄ± operatÃ¶r seÃ§in...</option>';
        const anaOperatorId = personelSelect.value;
        
        // Mevcut operatÃ¶rler (seÃ§ili olan hariÃ§)
        const yardimciOperatÃ¶rler = personelListesi.filter(p => 
            p.operator === true && p.id != anaOperatorId && p.pozisyon === 'OperatÃ¶r'
        );
        
        if (yardimciOperatÃ¶rler.length === 0) {
            // YardÄ±mcÄ± operatÃ¶r yok
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "DiÄŸer operatÃ¶rler mevcut deÄŸil";
            option.disabled = true;
            yardimciOperator.appendChild(option);
        } else {
            yardimciOperatÃ¶rler.forEach(personel => {
                const option = document.createElement('option');
                option.value = personel.id;
                option.textContent = `${personel.adSoyad} - ${personel.pozisyon}`;
                yardimciOperator.appendChild(option);
            });
        }
    }
    yardimciOperatorListesiniDoldur();

    // YardÄ±mcÄ± operatÃ¶r kontrolÃ¼ (sadece gÃ¼ndÃ¼z vardiyasÄ±nda gÃ¶ster)
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

    // Vardiya deÄŸiÅŸtiÄŸinde yardÄ±mcÄ± operatÃ¶r kontrolÃ¼
    vardiyaSelect.addEventListener('change', yardimciOperatorKontrolu);

    // YardÄ±mcÄ± operatÃ¶r checkbox'Ä± deÄŸiÅŸtiÄŸinde
    yardimciOperatorVar.addEventListener('change', function() {
        if (this.checked) {
            yardimciOperatorListesi.style.display = 'block';
        } else {
            yardimciOperatorListesi.style.display = 'none';
            yardimciOperator.value = '';
        }
    });

    // Personel listesi tablosunu doldur (sadece operatÃ¶r rolÃ¼ndeki kullanÄ±cÄ±lar)
    function personelTablosunuDoldur() {
        const tbody = document.getElementById('personelTableBody');
        tbody.innerHTML = '';
        
        const operatorler = personelListesi.filter(p => p.pozisyon === 'OperatÃ¶r');
        operatorler.forEach(personel => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${personel.adSoyad}</td>
                <td>${personel.pozisyon}</td>
                <td>${personel.operator ? 'âœ… Evet' : 'âŒ HayÄ±r'}</td>
                <td><span class="status-badge ${personel.operator ? 'operator' : 'non-operator'}">${personel.operator ? 'OperatÃ¶r' : 'OperatÃ¶r DeÄŸil'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
    personelTablosunuDoldur();

    // OperatÃ¶r yetkisi kontrolÃ¼
    function operatorYetkisiKontrolu() {
        const selectedPersonelId = personelSelect.value;
        if (!selectedPersonelId) {
            operatorStatus.textContent = 'Personel seÃ§iniz.';
            operatorStatus.style.color = '#e74c3c';
            return false;
        }

        const selectedPersonel = personelListesi.find(p => p.id == selectedPersonelId);
        if (selectedPersonel && selectedPersonel.operator) {
            operatorStatus.textContent = 'âœ… OperatÃ¶r yetkisi var';
            operatorStatus.style.color = '#28a745';
            return true;
        } else {
            operatorStatus.textContent = 'âŒ OperatÃ¶r yetkisi yok';
            operatorStatus.style.color = '#dc3545';
            return false;
        }
    }

    // Personel seÃ§imi deÄŸiÅŸtiÄŸinde yardÄ±mcÄ± operatÃ¶r listesini gÃ¼ncelle
    personelSelect.addEventListener('change', function() {
        operatorYetkisiKontrolu();
        yardimciOperatorListesiniDoldur();
    });

    // Vardiya seÃ§imi deÄŸiÅŸtiÄŸinde mevcut vardiya formunu gÃ¼ncelle
    vardiyaSelect.addEventListener('change', function() {
        yardimciOperatorKontrolu();
    });

    // BaÅŸlangÄ±Ã§ta yetki kontrolÃ¼ yap
    operatorYetkisiKontrolu();

    // Mevcut vardiya bilgisi (Google Sheets ile dogrula)
    mevcutVardiyaBilgisiDogrula();

    // HaftalÄ±k vardiya kayÄ±tlarÄ±nÄ± gÃ¶ster
    haftalikVardiyaKayitlariniGoster();

    // Tarih filtrele butonu
    tarihFiltreBtn.addEventListener('click', function() {
        haftalikVardiyaKayitlariniGoster();
    });

    // Tarih sÄ±fÄ±rla butonu
    tarihSifirlaBtn.addEventListener('click', function() {
        // Tarih alanlarÄ±nÄ± temizle
        setDefaultDateRange();
        
        haftalikVardiyaKayitlariniGoster();
    });

    // Ä°ÅŸlem detaylarÄ±nÄ± gÃ¶ster
    async function islemDetaylariniGoster() {
        // Modal oluÅŸtur (loading ile)
        const modal = document.createElement('div');
        modal.className = 'islem-detaylari-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>ğŸ“‹ Ä°ÅŸlem DetaylarÄ±</h2>
                    <button class="modal-close">âœ•</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px; color: #6c757d;">
                        Ä°ÅŸlemler yÃ¼kleniyor...
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
            console.log('ğŸ“Š Vardiya kayÄ±tlarÄ± ve iÅŸlemler tek seferde Ã§ekiliyor...');
            // Google Sheets'ten vardiya kayÄ±tlarÄ±nÄ± ve iÅŸlemleri tek seferde Ã§ek
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecordsWithIslemler');
            url.searchParams.append('count', '270'); // Son 90 gÃ¼n
            
            const response = await fetch(url);
            const result = await response.json();
            
            console.log('ğŸ“Š SonuÃ§:', result);
            
            if (!result.success) {
                throw new Error(result.error || 'Ä°ÅŸlemler yÃ¼klenemedi');
            }
            
            const tumVardiyaKayitlari = result.data || [];
            const mevcutVardiya = localStorage.getItem('mevcutVardiya');
            
            console.log('ğŸ“Š Toplam vardiya sayÄ±sÄ±:', tumVardiyaKayitlari.length);
            
            // Ä°ÅŸlemler her vardiya kaydÄ±nÄ±n iÃ§inde (islemler) olarak geliyor
            // Map oluÅŸturmaya gerek yok, direkt kullanabiliriz
            const vardiyaIslemleriMap = new Map();
            tumVardiyaKayitlari.forEach(vardiya => {
                if (vardiya.id) {
                    vardiyaIslemleriMap.set(vardiya.id, vardiya.islemler || []);
                }
            });
            
            console.log('ğŸ“Š Ä°ÅŸlemler yÃ¼klendi');
            
            // Modal iÃ§eriÄŸini gÃ¼ncelle
            const modalBody = modal.querySelector('.modal-body');
            modalBody.innerHTML = islemDetaylariHTML(tumVardiyaKayitlari, mevcutVardiya, vardiyaIslemleriMap);
            
        } catch (error) {
            console.error('âŒ Ä°ÅŸlem detaylarÄ± yÃ¼kleme hatasÄ±:', error);
            const modalBody = modal.querySelector('.modal-body');
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #e74c3c;">
                    Ä°ÅŸlemler yÃ¼klenemedi: ${error.message}
                </div>
            `;
        }
    }

    // Ä°ÅŸlem detaylarÄ± HTML'i oluÅŸtur
    function islemDetaylariHTML(tumVardiyaKayitlari, mevcutVardiya, vardiyaIslemleriMap) {
        let html = '';
        
        // Mevcut vardiya iÅŸlemleri (localStorage'dan)
        if (mevcutVardiya) {
            const vardiya = JSON.parse(mevcutVardiya);
            html += `
                <div class="islem-grubu">
                    <h3>ğŸ”„ Mevcut Vardiya Ä°ÅŸlemleri</h3>
                    <div class="islem-listesi">
                        ${vardiya.islemler && vardiya.islemler.length > 0 ? 
                            vardiya.islemler.map(islem => `
                                <div class="islem-item">
                                    <div class="islem-baslik">${islem.islem}</div>
                                    <div class="islem-zaman">${islem.zaman}</div>
                                    <div class="islem-kaydeden">Kaydeden: ${islem.kaydeden}</div>
                                </div>
                            `).join('') : 
                            '<div class="bos-mesaj">HenÃ¼z iÅŸlem kaydedilmemiÅŸ.</div>'
                        }
                    </div>
                </div>
            `;
        }
        
        // ArÅŸivlenmiÅŸ vardiya iÅŸlemleri (Google Sheets'ten)
        if (tumVardiyaKayitlari.length > 0) {
            // Ä°ÅŸlemi olan vardiyalarÄ± filtrele
            const islemliVardiyalar = tumVardiyaKayitlari.filter(vardiya => {
                const islemler = vardiyaIslemleriMap.get(vardiya.id);
                return (islemler && islemler.length > 0) || !!vardiya.devredenIsler;
            });
            
            if (islemliVardiyalar.length > 0) {
                html += `
                    <div class="islem-grubu">
                        <h3>ğŸ“ ArÅŸivlenmiÅŸ Vardiya Ä°ÅŸlemleri</h3>
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
                                            ğŸ“… ${vardiya.tarih} - ${vardiyaAdiMap[vardiya.vardiya] || vardiya.vardiya}
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
                                                '<div class="bos-mesaj">Bu vardiya iÃ§in iÅŸlem kaydedilmemiÅŸ.</div>'
                                            }
                                            ${vardiya.devredenIsler ? `
                                                <div class="islem-item">
                                                    <div class="islem-baslik">Devreden Isler</div>
                                                    <div class="islem-zaman">${vardiya.devredenIsler}</div>
                                                </div>
                                            ` : ''}
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
                        <h3>ğŸ“ ArÅŸivlenmiÅŸ Vardiya Ä°ÅŸlemleri</h3>
                        <div class="islem-listesi">
                            <div class="bos-mesaj">ArÅŸivde iÅŸlem kaydÄ± bulunamadÄ±.</div>
                        </div>
                    </div>
                `;
            }
        }
        
        if (!mevcutVardiya && tumVardiyaKayitlari.length === 0) {
            html = '<div class="bos-mesaj">HenÃ¼z hiÃ§ vardiya kaydÄ± bulunamadÄ±.</div>';
        }
        
        return html;
    }

    // Ä°ÅŸlem detaylarÄ± linkine event listener ekle
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
            
            // YardÄ±mcÄ± operatÃ¶r bilgisini gÃ¶ster
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
            
            // YardÄ±mcÄ± operatÃ¶r bilgisi
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

    // Ä°ÅŸlem kaydetme - Google Sheets
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
        const devredenIsler = devredenIslerInput?.value.trim() || '';
        
        if (!aciklama && !devredenIsler) {
            alert('LÃ¼tfen iÅŸlem aÃ§Ä±klamasÄ±nÄ± girin!');
            return;
        }

        // Mevcut vardiya varsa iÅŸlemi kaydet
        const mevcutVardiya = localStorage.getItem('mevcutVardiya');
        if (!mevcutVardiya) {
            alert('Aktif vardiya bulunamadÄ±!');
            return;
        }

        const vardiya = JSON.parse(mevcutVardiya);
        
        // Buton loading durumu
        islemKaydetmeBtn.textContent = 'KAYDEDÄ°LÄ°YOR...';
        islemKaydetmeBtn.disabled = true;
        
        try {
            if (!aciklama && devredenIsler) {
                const devredenUrl = new URL(VARDIYA_APPS_SCRIPT_URL);
                devredenUrl.searchParams.append('action', 'updateDevredenIsler');
                devredenUrl.searchParams.append('vardiyaId', vardiya.id);
                devredenUrl.searchParams.append('tarih', toIsoDateParam(vardiya.tarih));
                devredenUrl.searchParams.append('vardiya', vardiya.vardiya || vardiyaSelect.value);
                devredenUrl.searchParams.append('devredenIsler', devredenIsler);

                const devredenResponse = await fetch(devredenUrl);
                const devredenResult = await devredenResponse.json();

                if (devredenResult.success) {
                    vardiya.devredenIsler = devredenIsler;
                    localStorage.setItem('mevcutVardiya', JSON.stringify(vardiya));
                    window.SystemAuditLog?.write?.('Vardiya devreden isi kaydedildi', devredenIsler.slice(0, 80), 'ok');
                    alert('Devreden isler kaydedildi!');
                    haftalikVardiyaKayitlariniGoster();
                } else {
                    alert('Hata: ' + (devredenResult.error || 'Devreden isler kaydedilemedi!'));
                }
                return;
            }

            // Google Sheets'e iÅŸlem kaydet
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'addIslem');
            url.searchParams.append('vardiyaId', vardiya.id);
            url.searchParams.append('islem', aciklama);
            url.searchParams.append('zaman', new Date().toLocaleString('tr-TR'));
            url.searchParams.append('kaydeden', vardiya.personelAdSoyad || 'OperatÃ¶r');
            
            const response = await fetch(url);
            const result = await response.json();

            let devredenResult = { success: true };
            if (devredenIsler) {
                const devredenUrl = new URL(VARDIYA_APPS_SCRIPT_URL);
                devredenUrl.searchParams.append('action', 'updateDevredenIsler');
                devredenUrl.searchParams.append('vardiyaId', vardiya.id);
                devredenUrl.searchParams.append('tarih', toIsoDateParam(vardiya.tarih));
                devredenUrl.searchParams.append('vardiya', vardiya.vardiya || vardiyaSelect.value);
                devredenUrl.searchParams.append('devredenIsler', devredenIsler);

                const devredenResponse = await fetch(devredenUrl);
                devredenResult = await devredenResponse.json();
            }
            
            if (result.success && devredenResult.success) {
                const yeniIslem = {
                    islem: aciklama,
                    zaman: new Date().toLocaleString('tr-TR'),
                    kaydeden: vardiya.personelAdSoyad || 'OperatÃ¶r'
                };

                // Vardiya iÅŸlemlerini gÃ¼ncelle (localStorage)
                if (!vardiya.islemler) {
                    vardiya.islemler = [];
                }
                vardiya.islemler.push(yeniIslem);
                if (devredenIsler) {
                    vardiya.devredenIsler = devredenIsler;
                }
                localStorage.setItem('mevcutVardiya', JSON.stringify(vardiya));
                window.SystemAuditLog?.write?.('Vardiya islemi/devreden isi kaydedildi', (aciklama || devredenIsler).slice(0, 80), 'ok');
                
                // AlanÄ± temizle
                islemAciklama.value = '';
                haftalikVardiyaKayitlariniGoster();
                
                alert('Ä°ÅŸlem baÅŸarÄ±yla kaydedildi! (ID: ' + result.data.id + ')');
            } else {
                alert('Hata: ' + (result.error || 'Ä°ÅŸlem baÅŸarÄ±sÄ±z!'));
            }
        } catch (error) {
            console.error('Ä°ÅŸlem kayÄ±t hatasÄ±:', error);
            alert('BaÄŸlantÄ± hatasÄ±!');
        } finally {
            islemKaydetmeBtn.textContent = 'Ä°ÅLEMÄ° KAYDET';
            islemKaydetmeBtn.disabled = false;
        }
    });

    // HaftalÄ±k vardiya kayÄ±tlarÄ±nÄ± gÃ¶ster - Google Sheets
    async function haftalikVardiyaKayitlariniGoster() {
        const haftalikVardiyaTableBody = document.getElementById('haftalikVardiyaTableBody');
        
        // Loading mesajÄ± gÃ¶ster
        haftalikVardiyaTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: #6c757d; padding: 20px;">
                    KayÄ±tlar yÃ¼kleniyor...
                </td>
            </tr>
        `;
        
        try {
            // Google Sheets'ten son kayÄ±tlarÄ± ve iÅŸlemleri tek seferde Ã§ek (son 90 gÃ¼n iÃ§in yeterli)
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecordsWithIslemler');
            url.searchParams.append('count', '270'); // 90 gÃ¼n * 3 vardiya
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (!result.success) {
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; color: #e74c3c; padding: 20px;">
                            KayÄ±tlar yÃ¼klenemedi: ${result.error || 'Bilinmeyen hata'}
                        </td>
                    </tr>
                `;
                return;
            }
            
            const tumIslemler = result.data || [];
            haftalikVardiyaTableBody.innerHTML = '';
            
            console.log('Google Sheets vardiya kayÄ±tlarÄ±:', tumIslemler);
            
            if (tumIslemler.length === 0) {
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; color: #6c757d; padding: 20px;">
                            Vardiya kaydÄ± bulunamadÄ±.
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Ä°ÅŸlemler her vardiya kaydÄ±nÄ±n iÃ§inde (islemler) olarak geliyor
            const vardiyaIslemleriMap = new Map();
            tumIslemler.forEach(vardiya => {
                if (vardiya.id) {
                    vardiyaIslemleriMap.set(vardiya.id, vardiya.islemler || []);
                }
            });
            
            // Tarih aralÄ±ÄŸÄ±na gÃ¶re filtrele
            const baslangicTarihInput = document.getElementById('baslangicTarih').value;
            const bitisTarihInput = document.getElementById('bitisTarih').value;
            
            let filtrelenmisKayitlar = tumIslemler;
            
            if (baslangicTarihInput && bitisTarihInput) {
                // KullanÄ±cÄ± tarih seÃ§tiyse o aralÄ±ktaki kayÄ±tlarÄ± gÃ¶ster
                const baslangicDate = parseDateValue(baslangicTarihInput);
                const bitisDate = parseDateValue(bitisTarihInput);

                if (!baslangicDate || !bitisDate) {
                    haftalikVardiyaTableBody.innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; color: #e74c3c; padding: 20px;">
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
                // Tarih girilmediyse kayÄ±tlarÄ± gÃ¶sterme
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; color: #6c757d; padding: 20px;">
                            Tarih aralÄ±ÄŸÄ± seÃ§in.
                        </td>
                    </tr>
                `;
                return;
            }
            
            if (filtrelenmisKayitlar.length === 0) {
                const mesaj = baslangicTarihInput && bitisTarihInput 
                    ? 'SeÃ§ilen tarih aralÄ±ÄŸÄ±nda vardiya kaydÄ± bulunamadÄ±.' 
                    : 'Tarih aralÄ±ÄŸÄ± seÃ§in veya kayÄ±t bulunamadÄ±.';
                    
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; color: #6c757d; padding: 20px;">
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
                
                // Ä°ÅŸlem detaylarÄ±nÄ± formatla (VardiyaIslemleri sheet'inden)
                let islemDetaylariText = '-';
                const islemler = vardiyaIslemleriMap.get(vardiya.id) || [];
                const detaylar = [];
                const devredenIslerText = vardiya.devredenIsler || '-';
                
                if (islemler.length > 0) {
                    detaylar.push(...islemler.map(i => `${i.islem} (${i.zaman})`));
                }
                if (detaylar.length > 0) {
                    islemDetaylariText = detaylar.join(' | ');
                }
                
                tr.innerHTML = `
                    <td>${vardiya.tarih}</td>
                    <td>${vardiyaAdiMap[vardiya.vardiya] || vardiya.vardiya}</td>
                    <td>${vardiya.personel}</td>
                    <td>${vardiya.yardimciOperator || '-'}</td>
                    <td>${vardiya.baslangicSaati || '-'}</td>
                    <td>${vardiya.bitisSaati || '-'}</td>
                    <td>${islemDetaylariText}</td>
                    <td>${devredenIslerText}</td>
                `;
                
                haftalikVardiyaTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Vardiya kayÄ±tlarÄ± yÃ¼kleme hatasÄ±:', error);
            haftalikVardiyaTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #e74c3c; padding: 20px;">
                        BaÄŸlantÄ± hatasÄ±! KayÄ±tlar yÃ¼klenemedi.
                    </td>
                </tr>
            `;
        }
    }

    // Ã‡Ä±kÄ±ÅŸ yap butonlarÄ±
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');
    
    sidebarLogout.addEventListener('click', handleLogout);
    headerLogout.addEventListener('click', handleLogout);
    
    function handleLogout() {
        if (confirm('Ã‡Ä±kÄ±ÅŸ yapmak istediÄŸinizden emin misiniz?')) {
            localStorage.removeItem('rememberedEmail');
            window.location.href = 'anasayfa.html';
        }
    }

    // Sayfa deÄŸiÅŸtiÄŸinde vardiyanÄ±n otomatik bitirilmesini engelle
    window.addEventListener('beforeunload', function(e) {
        // Vardiya bitirme mesajÄ±nÄ± engelle
        return null;
    });

    // Sayfa kapatÄ±ldÄ±ÄŸÄ±nda vardiyanÄ±n kalmasÄ±nÄ± saÄŸla
    window.addEventListener('unload', function() {
        // Vardiya bilgilerini koru, bitirme iÅŸlemi yapma
        return;
    });
});


