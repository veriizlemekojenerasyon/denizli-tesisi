// Kojen Enerji Veri JavaScript - Google Sheets Entegrasyonu
document.addEventListener('DOMContentLoaded', async function() {
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
        if (Object.values(data).filter(v => !v).length > 0) { showMessage('Lütfen tüm alanları doldurun!', 'error'); return; }
        
        kaydetBtn.disabled = true; kaydetBtn.textContent = '💾 KAYDEDİLİYOR...';
        try {
            const result = await saveEnerjiToSheets({...data, motor: selectedMotor, tarih: tarihSecimi.value, vardiya: vardiyaSecimi.value, saat, kaydeden: 'Admin', durum: 'NORMAL'});
            if (result.success) {
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

    // Motor çalışmıyor kaydet
    motorCalismiyorKaydetBtn?.addEventListener('click', async function() {
        if (isLocked) { showMessage('Bu kayıt zaten mevcut!', 'error'); return; }
        const saat = `${String(new Date().getHours()).padStart(2, '0')}:00`;
        motorCalismiyorKaydetBtn.disabled = true; motorCalismiyorKaydetBtn.textContent = '⚠️ KAYDEDİLİYOR...';
        try {
            const result = await saveEnerjiToSheets({motor: selectedMotor, tarih: tarihSecimi.value, vardiya: vardiyaSecimi.value, saat, kaydeden: 'Admin', durum: 'MOTOR ÇALIŞMIYOR'});
            if (result.success) {
                document.querySelectorAll('.kojen-input').forEach(input => { input.value = '0'; input.style.background = '#ffebee'; input.style.color = '#c62828'; });
                showMessage(`${selectedMotor} motoru için "ÇALIŞMIYOR" durumu kaydedildi!`, 'warning');
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
            filtered.forEach(record => {
                const row = document.createElement('tr');
                if (record.durum === 'MOTOR ÇALIŞMIYOR') row.classList.add('motor-calismiyor');
                row.innerHTML = `<td>${record.saat || '-'}</td><td>${record.motor || '-'}</td><td>${record.aydemVoltaji || '-'}</td><td>${record.aktifGuc || '-'}</td><td>${record.reaktifGuc || '-'}</td><td>${record.cosPhi || '-'}</td><td>${record.ortAkif || '-'}</td><td>${record.ortGerilim || '-'}</td><td>${record.notrAkim || '-'}</td><td>${record.tahrikGerilimi || '-'}</td><td>${record.toplamAktifEnerji || '-'}</td><td>${record.calismaSaati || '-'}</td><td>${record.kalkisSayisi || '-'}</td><td class="${record.durum === 'MOTOR ÇALIŞMIYOR' ? 'durum-calismiyor' : 'durum-normal'}">${record.durum === 'MOTOR ÇALIŞMIYOR' ? 'ÇALIŞMIYOR' : 'NORMAL'}</td>`;
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
