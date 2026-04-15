// Tüm sayfalardaki sidebar menülerini düzeltmek için kullanılacak standart menü yapısı
// Her sayfa için aktif menüyü belirlemek üzere kullanılır

const standardMenu = [
    { id: 'anasayfa', icon: '🏠', text: 'Ana Sayfa', href: 'index.html' },
    { id: 'saatlik', icon: '📊', text: 'Saatlik Veri Girişi', href: 'saatlik-veri-giris.html' },
    { id: 'gunluk', icon: '📆', text: 'Günlük Veri Girişi', href: 'gunluk-veri-giris.html' },
    { id: 'buhar', icon: '💨', text: 'Buhar Verisi', href: 'buhar-verisi.html' },
    { id: 'vardiya', icon: '👥', text: 'Vardiya Takip', href: 'vardiya.html' },
    { id: 'motor-takip', icon: '⚙️', text: 'Motor Takip', href: 'motor-takip.html' },
    { id: 'kojen-motor', icon: '⚙️', text: 'Kojen Motor Veri', href: 'kojen-motor-veri.html' },
    { id: 'kojen-enerji', icon: '⚡', text: 'Kojen Enerji Veri', href: 'kojen-enerji-veri.html' },
    { id: 'bakim', icon: '🔧', text: 'Bakım Takibi', href: 'bakim-takibi.html' },
    { id: 'kullanici', icon: '👤', text: 'Kullanıcı Yönetimi', href: 'kullanici-yonetimi.html' }
];

function generateMenuHTML(activePage) {
    return standardMenu.map(item => {
        const isActive = item.id === activePage ? 'active' : '';
        return `
                <li class="menu-item ${isActive}">
                    <a href="${item.href}" class="menu-link">
                        <span class="menu-icon">${item.icon}</span>
                        <span class="menu-text">${item.text}</span>
                    </a>
                </li>`;
    }).join('');
}
