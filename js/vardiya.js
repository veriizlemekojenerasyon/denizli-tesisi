document.addEventListener('DOMContentLoaded', function() {
    // Vardiya Google Apps Script URL
    const VARDIYA_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2NzLeBDcrZ9T-VoyqrK1J07zN4UlXm-WMrKkMv0AP_puG-0AMzQhNqnQ92D1zHWSp/exec';
    
    // Tarih seçicisine otomatik bugünün tarihini atama
    const tarihInput = document.getElementById('tarih');
    const vardiyaSelect = document.getElementById('vardiya');
    const personelSelect = document.getElementById('personel');
    const operatorStatus = document.getElementById('operatorStatus');
    const kaydetBtn = document.getElementById('kaydetBtn');
    const temizleBtn = document.getElementById('temizleBtn');
    const islemKaydetBtn = document.getElementById('islemKaydetBtn');
    const vardiyaBitirBtn = document.getElementById('vardiyaBitirBtn');
    
    // Yardımcı operatör elementleri
    const yardimciOperatorSection = document.getElementById('yardimciOperatorSection');
    const yardimciOperatorVar = document.getElementById('yardimciOperatorVar');
    const yardimciOperatorListesi = document.getElementById('yardimciOperatorListesi');
    const yardimciOperator = document.getElementById('yardimciOperator');

    // Bugünün tarihini al ve input'a ata (DD.MM.YYYY formatında)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    tarihInput.value = `${day}.${month}.${year}`;

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
            const tarihParts = selectedTarih.split('.');
            const formattedTarih = `${tarihParts[2]}-${tarihParts[1]}-${tarihParts[0]}`;

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
                
                // Buton loading durumu
                vardiyaBitirBtn.textContent = 'BİTİRİLİYOR...';
                vardiyaBitirBtn.disabled = true;
                
                try {
                    // Tarih formatını çevir
                    const tarihParts = vardiya.tarih.split('.');
                    const formattedTarih = `${tarihParts[2]}-${tarihParts[1]}-${tarihParts[0]}`;
                    
                    // Vardiya bitir API çağrısı
                    const url = new URL(VARDIYA_APPS_SCRIPT_URL);
                    url.searchParams.append('action', 'endVardiya');
                    url.searchParams.append('tarih', formattedTarih);
                    url.searchParams.append('vardiya', vardiyaSelect.value);
                    
                    const response = await fetch(url);
                    const result = await response.json();
                    
                    if (result.success) {
                        localStorage.removeItem('mevcutVardiya');
                        document.getElementById('mevcutVardiya').style.display = 'none';
                        personelSelect.value = '';
                        operatorStatus.textContent = 'Personel seçiniz.';
                        operatorStatus.style.color = '#e74c3c';
                        
                        alert('Vardiya başarıyla bitirildi! (ID: ' + result.data.id + ')');
                        haftalikVardiyaKayitlariniGoster();
                    } else {
                        alert('Hata: ' + (result.error || 'İşlem başarısız!'));
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

    // Mevcut vardiya bilgisi (localStorage'dan)
    mevcutVardiyaBilgisi();

    // Haftalık vardiya kayıtlarını göster
    haftalikVardiyaKayitlariniGoster();

    // İşlem detaylarını göster
    function islemDetaylariniGoster() {
        const tumIslemler = JSON.parse(localStorage.getItem('vardiyaIslemleri') || '[]');
        const mevcutVardiya = localStorage.getItem('mevcutVardiya');
        
        // Modal oluştur
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
                    ${islemDetaylariHTML(tumIslemler, mevcutVardiya)}
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
    }

    // İşlem detayları HTML'i oluştur
    function islemDetaylariHTML(tumIslemler, mevcutVardiya) {
        let html = '';
        
        // Mevcut vardiya işlemleri
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
        
        // Arşivlenmiş vardiya işlemleri
        if (tumIslemler.length > 0) {
            html += `
                <div class="islem-grubu">
                    <h3>📁 Arşivlenmiş Vardiya İşlemleri</h3>
                    <div class="islem-listesi">
                        ${tumIslemler.map(vardiya => `
                            <div class="vardiya-grubu">
                                <div class="vardiya-baslik">
                                    📅 ${vardiya.tarih} - ${vardiya.vardiyaAdi}
                                    <span class="personel-info">${vardiya.personelAdSoyad}</span>
                                </div>
                                <div class="vardiya-islemleri">
                                    ${vardiya.islemler && vardiya.islemler.length > 0 ? 
                                        vardiya.islemler.map(islem => `
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
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (!mevcutVardiya && tumIslemler.length === 0) {
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

    // localStorage'daki vardiya işlemlerini kontrol et
    function localStorageVardiyaIslemleriniKontrolEt() {
        const mevcutVardiya = localStorage.getItem('mevcutVardiya');
        const tumIslemler = localStorage.getItem('vardiyaIslemleri');
        
        console.log('=== Vardiya İşlemleri Kontrol ===');
        console.log('Mevcut Vardiya:', mevcutVardiya ? JSON.parse(mevcutVardiya) : 'Yok');
        console.log('Tüm İşlemler:', tumIslemler ? JSON.parse(tumIslemler) : 'Yok');
        
        if (mevcutVardiya) {
            const vardiya = JSON.parse(mevcutVardiya);
            console.log('Mevcut Vardiya İşlemleri:', vardiya.islemler || 'İşlem Yok');
            console.log('İşlem Sayısı:', vardiya.islemler ? vardiya.islemler.length : 0);
        }
        
        if (tumIslemler) {
            const islemler = JSON.parse(tumIslemler);
            console.log('Arşivdeki Toplam Vardiya Sayısı:', islemler.length);
            
            islemler.forEach((vardiya, index) => {
                console.log(`Vardiya ${index + 1}:`, {
                    tarih: vardiya.tarih,
                    personel: vardiya.personelAdSoyad,
                    vardiya: vardiya.vardiyaAdi,
                    islemSayisi: vardiya.islemler ? vardiya.islemler.length : 0,
                    bitisZamani: vardiya.bitisZamani || 'Devam Ediyor'
                });
            });
        }
        
        return {
            mevcutVardiya: mevcutVardiya ? JSON.parse(mevcutVardiya) : null,
            tumIslemler: tumIslemler ? JSON.parse(tumIslemler) : []
        };
    }

    // Sayfa yüklendiğinde kontrol et
    localStorageVardiyaIslemleriniKontrolEt();

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
            // Google Sheets'ten son kayıtları çek
            const url = new URL(VARDIYA_APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getLastRecords');
            url.searchParams.append('count', '32');
            
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
            
            // Son 7 günün kayıtlarını göster
            const yediGunOnce = new Date();
            yediGunOnce.setDate(yediGunOnce.getDate() - 7);
            
            const sonHaftaKayitlari = tumIslemler.filter(vardiya => {
                // DD.MM.YYYY formatını parse et
                const tarihParts = vardiya.tarih.split('.');
                if (tarihParts.length === 3) {
                    const vardiyaTarihi = new Date(tarihParts[2], tarihParts[1] - 1, tarihParts[0]);
                    return vardiyaTarihi >= yediGunOnce;
                }
                return false;
            });
            
            if (sonHaftaKayitlari.length === 0) {
                haftalikVardiyaTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
                            Son 7 günde vardiya kaydı bulunamadı.
                        </td>
                    </tr>
                `;
                return;
            }
            
            sonHaftaKayitlari.forEach(vardiya => {
                const tr = document.createElement('tr');
                const vardiyaAdiMap = {
                    '08-16': '08:00 - 16:00',
                    '16-24': '16:00 - 24:00',
                    '24-08': '24:00 - 08:00'
                };
                
                tr.innerHTML = `
                    <td>${vardiya.tarih}</td>
                    <td>${vardiyaAdiMap[vardiya.vardiya] || vardiya.vardiya}</td>
                    <td>${vardiya.personel}</td>
                    <td>${vardiya.yardimciOperator || 'Yok'}</td>
                    <td>${vardiya.baslangicSaati}</td>
                    <td>${vardiya.bitisSaati || 'Devam Ediyor'}</td>
                    <td><span class="badge ${vardiya.durum === 'Aktif' ? 'badge-success' : 'badge-secondary'}">${vardiya.durum}</span></td>
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
            window.location.href = 'index.html';
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

