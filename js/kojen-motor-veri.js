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

    // Seçili motor
    let selectedMotor = 'GM-1';
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

    // Kayıt kontrolü fonksiyonu - ⚡ ULTRA HIZLI Map arama
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

    // 🔒 BAŞLANGIÇTA TÜM FORM PASİF YAP
    function disableAllFormElements() {
        console.log('🔒 Form başlangıçta pasif yapılıyor...');
        
        // Input'ları pasif yap
        const allInputs = document.querySelectorAll('.data-input');
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
        
        // ⚡ Butonları hızlıca kilitle
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

    // Mesaj gösterme fonksiyonu
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
        
        // Tip'e göre renk belirle
        switch(type) {
            case 'success':
                messageDiv.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                break;
            case 'error':
                messageDiv.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
                break;
            case 'warning':
                messageDiv.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
                break;
            case 'info':
                messageDiv.style.background = 'linear-gradient(135deg, #17a2b8, #138496)';
                break;
            default:
                messageDiv.style.background = 'linear-gradient(135deg, #6c757d, #5a6268)';
        }
        
        document.body.appendChild(messageDiv);
        
        // 3 saniye sonra mesajı kaldır
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
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
            
            showMessage(`${selectedMotor} motoru seçildi!`, 'info');
            
            // Vardiya verilerini güncelle (seçili motor için)
            await loadVardiyaData();
            
            // Kayıt kontrolü yap (form durumunu güncelle)
            await checkAndUpdateFormStatus();
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
                kaydeden: 'Admin',
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
                kaydeden: 'Admin',
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
        '16-24': { baslangic: 15, bitis: 23, baslangicSaat: '15:00', bitisSaat: '23:00' },
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
    
    // Vardiya tablosunu doldur - sadece seçili motorun verileri
    async function loadVardiyaData() {
        const vardiya = vardiyaSecimi.value;
        const tarih = tarihSecimi.value;
        const motor = selectedMotor; // Seçili motoru al
        
        if (!vardiya || !tarih || !motor) return;
        
        const tableBody = document.getElementById('vardiyaTableBody');
        const noDataMessage = document.getElementById('noDataMessage');
        
        if (!tableBody) return;
        
        // Tabloyu temizle
        tableBody.innerHTML = '';
        
        try {
            // Tüm kayıtları getir
            const result = await getAllMotorRecords();
            
            if (!result.success || !result.data || result.data.length === 0) {
                if (noDataMessage) noDataMessage.style.display = 'block';
                return;
            }
            
            // Tarih formatını normalize et
            let searchTarih = tarih;
            if (searchTarih.includes('-')) {
                const parts = searchTarih.split('-');
                searchTarih = `${parts[2]}.${parts[1]}.${parts[0]}`;
            }
            
            // Vardiya aralığındaki ve seçili motorun kayıtlarını filtrele
            const filteredRecords = result.data.filter(record => {
                const recordTarih = record.tarih || '';
                const recordSaat = record.saat || '';
                const recordMotor = record.motor || '';
                return recordTarih === searchTarih && 
                       kayitVardiyaAraligindaMi(recordSaat, vardiya) &&
                       recordMotor === motor; // Sadece seçili motor
            });
            
            // Saate göre sırala
            filteredRecords.sort((a, b) => {
                const saatA = getSaatDegeri(a.saat) || 0;
                const saatB = getSaatDegeri(b.saat) || 0;
                return saatA - saatB;
            });
            
            if (filteredRecords.length === 0) {
                if (noDataMessage) {
                    noDataMessage.textContent = `${motor} motoru için bu vardiya saat aralığında henüz kayıt bulunmamaktadır.`;
                    noDataMessage.style.display = 'block';
                }
                return;
            }
            
            if (noDataMessage) noDataMessage.style.display = 'none';
            
            // Tabloyu doldur
            filteredRecords.forEach(record => {
                const row = document.createElement('tr');
                
                // Motor çalışmıyor durumunda sınıf ekle
                if (record.durum === 'MOTOR ÇALIŞMIYOR') {
                    row.classList.add('motor-calismiyor');
                }
                
                row.innerHTML = `
                    <td>${record.saat || '-'}</td>
                    <td>${record.motor || '-'}</td>
                    <td>${record.jenYatakSicaklikDE || '-'}</td>
                    <td>${record.jenYatakSicaklikNDE || '-'}</td>
                    <td>${record.sogutmaSuyuSicaklik || '-'}</td>
                    <td>${record.sogutmaSuyuBasinc || '-'}</td>
                    <td>${record.yagSicaklik || '-'}</td>
                    <td>${record.yagBasinc || '-'}</td>
                    <td>${record.sarjSicaklik || '-'}</td>
                    <td>${record.sarjBasinc || '-'}</td>
                    <td>${record.gazRegulatoru || '-'}</td>
                    <td>${record.makineDairesiSicaklik || '-'}</td>
                    <td>${record.karterBasinc || '-'}</td>
                    <td>${record.onKamaraFarkBasinc || '-'}</td>
                    <td>${record.sargiSicaklik1 || '-'}</td>
                    <td>${record.sargiSicaklik2 || '-'}</td>
                    <td>${record.sargiSicaklik3 || '-'}</td>
                    <td class="${record.durum === 'MOTOR ÇALIŞMIYOR' ? 'durum-calismiyor' : 'durum-normal'}">
                        ${record.durum === 'MOTOR ÇALIŞMIYOR' ? 'ÇALIŞMIYOR' : 'NORMAL'}
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Vardiya verileri yüklenirken hata:', error);
            if (noDataMessage) {
                noDataMessage.textContent = 'Veriler yüklenirken bir hata oluştu.';
                noDataMessage.style.display = 'block';
            }
        }
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
