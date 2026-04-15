// Buhar Verisi JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Tarih alanını bir gün öncesi olarak ayarla
    setYesterdayDate();
    
    // Son kayıtları göster
    loadRecentRecords();
    
    // Form event listener'ları
    initializeEventListeners();
});

// Bir gün önceki tarihi ayarla
function setYesterdayDate() {
    const tarihInput = document.getElementById('buharTarih');
    if (!tarihInput) return;
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const formattedDate = yesterday.toISOString().split('T')[0];
    tarihInput.value = formattedDate;
}

// Event listener'ları başlat
function initializeEventListeners() {
    // Çıkış butonları
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');
    
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', logout);
    }
    if (headerLogout) {
        headerLogout.addEventListener('click', logout);
    }
    
    // Form submit
    const buharForm = document.getElementById('buharForm');
    if (buharForm) {
        buharForm.addEventListener('submit', handleFormSubmit);
    }
}

// Çıkış işlemi
function logout() {
    localStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
}

// Form gönderme işlemi
function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        tarih: document.getElementById('buharTarih').value,
        buharTon: parseFloat(document.getElementById('buharMiktari').value)
    };
    
    // Validasyon
    if (!formData.tarih || isNaN(formData.buharTon)) {
        alert('Lütfen tüm alanları doğru şekilde doldurun!');
        return;
    }
    
    // Kaydet
    saveBuharRecord(formData);
    
    // Formu temizle
    document.getElementById('buharMiktari').value = '';
    
    // Tarihi tekrar ayarla (bir gün öncesi)
    setYesterdayDate();
}

// Buhar kaydını kaydet
function saveBuharRecord(data) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    const record = {
        id: Date.now(),
        tarih: data.tarih,
        buharTon: data.buharTon,
        kaydeden: `${currentUser.ad || 'Admin'} ${currentUser.soyad || ''}`,
        timestamp: new Date().toISOString()
    };
    
    // localStorage'dan mevcut kayıtları al
    let records = JSON.parse(localStorage.getItem('buharRecords') || '[]');
    
    // Yeni kaydı ekle
    records.push(record);
    
    // Tarihe göre sırala (en yeni en üstte)
    records.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
    
    // Sadece son 32 kaydı tut
    records = records.slice(0, 32);
    
    // localStorage'a kaydet
    localStorage.setItem('buharRecords', JSON.stringify(records));
    
    // Tabloyu güncelle
    loadRecentRecords();
    
    alert('Buhar verisi başarıyla kaydedildi!');
}

// Son kayıtları tabloya yükle
function loadRecentRecords() {
    const tableBody = document.getElementById('recordsTableBody');
    if (!tableBody) return;
    
    // localStorage'dan kayıtları al
    const records = JSON.parse(localStorage.getItem('buharRecords') || '[]');
    
    // Tarihe göre sırala (en yeni en üstte)
    records.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
    
    // Tablo içeriğini temizle
    tableBody.innerHTML = '';
    
    // Son 32 kaydı göster
    const recentRecords = records.slice(0, 32);
    
    if (recentRecords.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="4" style="text-align: center; padding: 30px; color: #7f8c8d;">Henüz kayıt bulunmamaktadır.</td>';
        tableBody.appendChild(emptyRow);
        return;
    }
    
    // Kayıtları tabloya ekle
    recentRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        
        // Tarihi formatla (DD.MM.YYYY)
        const dateParts = record.tarih.split('-');
        const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formattedDate}</td>
            <td>${record.buharTon.toFixed(2)}</td>
            <td>${record.kaydeden}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Örnek/TEST verileri ekle (isteğe bağlı - geliştirme için)
function addSampleData() {
    const sampleData = [
        { tarih: '2026-03-24', buharTon: 45.5, kaydeden: 'Admin User' },
        { tarih: '2026-03-23', buharTon: 42.3, kaydeden: 'Admin User' },
        { tarih: '2026-03-22', buharTon: 48.7, kaydeden: 'Admin User' },
        { tarih: '2026-03-21', buharTon: 44.2, kaydeden: 'Admin User' },
        { tarih: '2026-03-20', buharTon: 46.8, kaydeden: 'Admin User' }
    ];
    
    let records = JSON.parse(localStorage.getItem('buharRecords') || '[]');
    
    sampleData.forEach(data => {
        const exists = records.some(r => r.tarih === data.tarih);
        if (!exists) {
            records.push({
                id: Date.now() + Math.random(),
                ...data,
                timestamp: new Date().toISOString()
            });
        }
    });
    
    records.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
    localStorage.setItem('buharRecords', JSON.stringify(records.slice(0, 32)));
    loadRecentRecords();
}

// Test verilerini eklemek için konsoldan çalıştırılabilir:
// addSampleData();
