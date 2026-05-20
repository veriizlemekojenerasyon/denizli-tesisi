document.addEventListener('DOMContentLoaded', function() {
    // Tarih seçicisine otomatik bugünün tarihini atama
    const tarihInput = document.getElementById('TARIH');
    
    // Bugünün tarihini al ve input'a ata (YYYY-MM-DD formatında)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    tarihInput.value = `${year}-${month}-${day}`;
    
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
    
    // Form gönderme işlemi
    const form = document.getElementById('gunlukVeriForm');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Form verilerini al
        const formData = {
            TARIH: document.getElementById('TARIH').value,
            YAGSEVIYESI: parseFloat(document.getElementById('YAGSEVIYESI').value) || 0,
            KUPLAJ: parseFloat(document.getElementById('KUPLAJ').value) || 0,
            GM1: parseFloat(document.getElementById('GM1').value) || 0,
            GM2: parseFloat(document.getElementById('GM2').value) || 0,
            GM3: parseFloat(document.getElementById('GM3').value) || 0,
            ICIHTIYAC: parseFloat(document.getElementById('ICIHTIYAC').value) || 0,
            REDRESOR1: parseFloat(document.getElementById('REDRESOR1').value) || 0,
            REDRESOR2: parseFloat(document.getElementById('REDRESOR2').value) || 0,
            KOJENICIHTIYAC: parseFloat(document.getElementById('KOJENICIHTIYAC').value) || 0,
            SERVISTRAFO: parseFloat(document.getElementById('SERVISTRAFO').value) || 0
        };
        
        // Verileri kontrol et
        if (!formData.TARIH) {
            showNotification('Lütfen tarih seçin.', 'error');
            return;
        }
        
        // Burada verileri kaydetme işlemi yapılabilir
        console.log('Günlük veri form verileri:', formData);
        
        // LocalStorage'a kaydet
        let records = JSON.parse(localStorage.getItem('gunlukVeriRecords') || '[]');
        
        // Aynı tarih için kayıt var mı kontrol et
        const existingIndex = records.findIndex(r => r.TARIH === formData.TARIH);
        if (existingIndex >= 0) {
            // Varsa güncelle
            records[existingIndex] = formData;
            showNotification('Günlük veriler güncellendi!', 'success');
        } else {
            // Yoksa ekle
            records.push(formData);
            showNotification('Günlük veriler başarıyla kaydedildi!', 'success');
        }
        
        // Kaydet
        localStorage.setItem('gunlukVeriRecords', JSON.stringify(records));
        
        // Tabloyu yenile
        loadRecentRecords();
        
        // Formu kilitle (veriler görünür ama değiştirilemez)
        lockForm(true);
        
        // Düzenle butonu göster
        showEditButton();
    });
    
    // Form kilitle/aç
    function lockForm(locked) {
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            input.readOnly = locked;
            input.style.backgroundColor = locked ? '#f0f0f0' : '';
            input.style.cursor = locked ? 'not-allowed' : '';
        });
        
        // Kaydet butonunu gizle/göster
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.style.display = locked ? 'none' : 'inline-block';
        }
        
        // Temizle butonunu gizle/göster
        const resetBtn = form.querySelector('button[type="reset"]');
        if (resetBtn) {
            resetBtn.style.display = locked ? 'none' : 'inline-block';
        }
    }
    
    // Düzenle butonu göster
    function showEditButton() {
        // Varsa eski butonu kaldır
        const existingEditBtn = form.querySelector('.edit-btn');
        if (existingEditBtn) existingEditBtn.remove();
        
        // Yeni buton oluştur
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'DÜZENLE';
        editBtn.style.cssText = `
            padding: 12px 25px;
            background: linear-gradient(135deg, #f39c12, #e67e22);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(243, 156, 18, 0.3);
        `;
        
        editBtn.addEventListener('click', function() {
            lockForm(false);
            editBtn.remove();
            showNotification('Form düzenleme modunda!', 'info');
        });
        
        // Form actions'a ekle
        const formActions = form.querySelector('.form-actions');
        if (formActions) {
            formActions.appendChild(editBtn);
        }
    }
    
    // Sayfa yüklenince form durumunu kontrol et
    function checkFormStatus() {
        const tarihInput = document.getElementById('TARIH');
        if (!tarihInput || !tarihInput.value) return;
        
        const records = JSON.parse(localStorage.getItem('gunlukVeriRecords') || '[]');
        const existingRecord = records.find(r => r.TARIH === tarihInput.value);
        
        if (existingRecord) {
            // Mevcut kaydı forma doldur
            document.getElementById('YAGSEVIYESI').value = existingRecord.YAGSEVIYESI;
            document.getElementById('KUPLAJ').value = existingRecord.KUPLAJ;
            document.getElementById('GM1').value = existingRecord.GM1;
            document.getElementById('GM2').value = existingRecord.GM2;
            document.getElementById('GM3').value = existingRecord.GM3;
            document.getElementById('ICIHTIYAC').value = existingRecord.ICIHTIYAC;
            document.getElementById('REDRESOR1').value = existingRecord.REDRESOR1;
            document.getElementById('REDRESOR2').value = existingRecord.REDRESOR2;
            document.getElementById('KOJENICIHTIYAC').value = existingRecord.KOJENICIHTIYAC;
            document.getElementById('SERVISTRAFO').value = existingRecord.SERVISTRAFO;
            
            // Formu kilitle
            lockForm(true);
            showEditButton();
        }
    }
    
    // Tarih değişince form durumunu kontrol et
    if (tarihInput) {
        tarihInput.addEventListener('change', checkFormStatus);
    }
    
    // Sayfa yüklenince kontrol et
    checkFormStatus();
    
    // Bildirim fonksiyonu
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;

        switch(type) {
            case 'success':
                notification.style.background = '#10b981';
                break;
            case 'error':
                notification.style.background = '#ef4444';
                break;
            case 'warning':
                notification.style.background = '#f59e0b';
                break;
            case 'info':
            default:
                notification.style.background = '#3b82f6';
                break;
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // CSS animasyonları için stil ekle
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Son 32 kaydı yükle ve göster
    loadRecentRecords();
});

// Son kayıtları yükle
function loadRecentRecords() {
    const tableBody = document.getElementById('recordsTableBody');
    if (!tableBody) return;
    
    // LocalStorage'dan kayıtları al
    const records = JSON.parse(localStorage.getItem('gunlukVeriRecords') || '[]');
    
    // Tarihe göre sırala (en yeni en üstte)
    records.sort((a, b) => new Date(b.TARIH) - new Date(a.TARIH));
    
    // Son 32 kaydı al
    const recentRecords = records.slice(0, 32);
    
    // Tabloyu doldur
    renderRecordsTable(recentRecords, tableBody);
}

// Kayıtları tabloya render et
function renderRecordsTable(records, tableBody) {
    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 40px; color: #64748b;">Henüz kayıt bulunmuyor</td></tr>';
        return;
    }
    
    const formatValue = (value) => {
        if (value === null || value === undefined || value === '') return '-';
        return String(value);
    };

    let html = '';
    records.forEach((record, index) => {
        html += `
            <tr>
                <td class="col-num">${index + 1}</td>
                <td class="col-date">${formatDate(record.TARIH)}</td>
                <td class="col-oil">${formatValue(record.YAGSEVIYESI)}</td>
                <td class="col-kuplaj">${formatValue(record.KUPLAJ)}</td>
                <td class="col-gm">${formatValue(record.GM1)}</td>
                <td class="col-gm">${formatValue(record.GM2)}</td>
                <td class="col-gm">${formatValue(record.GM3)}</td>
                <td class="col-consumption">${formatValue(record.ICIHTIYAC)}</td>
                <td class="col-redresor">${formatValue(record.REDRESOR1)}</td>
                <td class="col-redresor">${formatValue(record.REDRESOR2)}</td>
                <td class="col-kojen">${formatValue(record.KOJENICIHTIYAC)}</td>
                <td class="col-consumption">${formatValue(record.SERVISTRAFO)}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Tarih formatla
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
