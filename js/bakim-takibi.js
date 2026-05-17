// Bakım Takibi JavaScript - ÇALIŞAN VERSİYON
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPyZrQ77uxqfy1SR32dWUqy4EymmhrtW7deH6g81L9AA76JUYfZNvmUbRHbViv2m2v/exec";

// Sistem başlatma fonksiyonu
async function initializeSystem() {
    try {
        showNotification('Sistem Başlatılıyor', 'Google Sheets bağlantısı kuruluyor...', 'info');
        
        console.log('Testing URL:', SCRIPT_URL);
        
        // Basit GET request ile test et
        const response = await fetch(SCRIPT_URL + '?action=test', {
            method: 'GET'
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        // Response'u text olarak oku
        const responseText = await response.text();
        console.log('Response text:', responseText.substring(0, 200));
        
        // JSON parse etmeyi dene
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('Parsed result:', result);
        } catch (e) {
            console.error('JSON parse hatası:', e);
            showNotification('Hata', 'Backend yanıtı JSON formatında değil. Deploy izinlerini kontrol edin.', 'error');
            return;
        }
        
        if (result && result.success) {
            showNotification('Başarılı', 'Backend bağlantısı başarılı!', 'success');
            
            // İstatistikleri yükle (DOMContentLoaded'da zaten çağrılıyor)
            
            // Raporu da yükle
            if (maintenanceReporter) {
                await maintenanceReporter.generateReport();
            }
            
        } else {
            showNotification('Hata', result?.message || 'Backend bağlantısı başarısız', 'error');
        }
        
    } catch (error) {
        console.error('Sistem başlatılamadı:', error);
        showNotification('Hata', 'Deploy izinlerini kontrol edin: ' + error.message, 'error');
    }
}

// Bakım kaydetme fonksiyonu
async function saveMaintenanceData(formType, formElement) {
    try {
        const formData = new FormData(formElement);
        
        // DEBUG: Form verilerini kontrol et
        console.log('=== FORM DEBUG ===');
        console.log('Form type:', formType);
        for (let [key, value] of formData.entries()) {
            console.log(`FormData: ${key} = ${value}`);
        }
        
        // Dosyaları işle
        const files = await processFiles(formType);
        
        // Input değerlerini direkt al (FormData yerine)
        const getInputValue = (name) => {
            const input = formElement.querySelector(`[name="${name}"]`);
            console.log(`🔍 Looking for [name="${name}"]:`, input ? `Found: "${input.value}"` : 'NOT FOUND');
            return input ? input.value : '';
        };
        
        // Alternatif yöntem: Tüm inputları topla
        const allInputs = formElement.querySelectorAll('input, select, textarea');
        console.log('📋 All inputs in form:', allInputs.length);
        allInputs.forEach(input => {
            console.log(`  - ${input.tagName} [name="${input.name}"] = "${input.value}"`);
        });

        // Değerleri once alalim
        let typeValue = getInputValue('type');
        let technicianValue = getInputValue('technician');
        let companyValue = getInputValue('technician-company');
        
        // Teknisyen ve Firma değerlerini büyük harfe çevir
        const technicianMapping = {
            'ibrahim-ogun': 'İBRAHİM OĞUN ŞAHİN',
            'yakup-can': 'YAKUP CAN CİN',
            'oguzhan-yaylali': 'OĞUZHAN YAYLALI',
            'altan-hunoglu': 'ALTAN HUNOĞLU'
        };
        
        // Dış destek seçildiyse teknisyen yerine firma ismini yaz
        if (companyValue && companyValue.toUpperCase() === 'EXTERNAL') {
            // Dış destek için firma ismini al
            const externalCompanyId = `${formType}-external-company`;
            const externalCompanySelect = document.getElementById(externalCompanyId);
            
            if (externalCompanySelect && externalCompanySelect.value) {
                const externalCompanyMapping = {
                    'topkapi': 'TOPKAPI',
                    'other': 'DİĞER'
                };
                technicianValue = externalCompanyMapping[externalCompanySelect.value] || externalCompanySelect.value.toUpperCase();
            } else {
                technicianValue = 'DIŞ DESTEK';
            }
        } else {
            technicianValue = technicianMapping[technicianValue] || technicianValue.toUpperCase();
        }
        
        // Firma değerini Türkçe'ye çevir
        const companyMapping = {
            'INTERNAL': 'İÇ DESTEK',
            'EXTERNAL': 'DIŞ DESTEK',
            'internal': 'İÇ DESTEK',
            'external': 'DIŞ DESTEK'
        };
        
        companyValue = companyMapping[companyValue] || companyValue.toUpperCase();
        
        // Bakım tipini Türkçe ve büyük harfe çevir
        const typeMapping = {
            'oil-sample': 'YAĞ NUMUNE ALMA',
            'alternator-grease': 'ALTERNATÖR GRESLEME',
            'oil-filter': 'YAĞ FİLTRE DEĞİŞİMİ',
            'heat-exchanger': 'EŞANJÖR ÖLÇÜMÜ',
            'ht-lt-jacket': 'HT LT CEKET SUYU SICAKLIK ÖLÇÜMÜ',
            'other': 'DİĞER',
            // Periyodik bakım tipleri
            '2000': '2000 SAAT',
            '6000': '6000 SAAT',
            '10000': '10000 SAAT',
            '20000': '20000 SAAT',
            '30000': '30000 SAAT',
            // Arıza nedenleri
            'electrical': 'ELEKTRİKSEL',
            'mechanical': 'MEKANİK',
            'electronic': 'ELEKTRONİK',
            'hydraulic': 'HİDROLİK',
            'pneumatic': 'PNÖMATİK',
            'software': 'YAZILIM',
            'maintenance': 'BAKIM KAYNAKLI'
        };
        
        typeValue = typeMapping[typeValue] || typeValue.toUpperCase();
        
        console.log('🔍 Direct values:');
        console.log('  - typeValue:', typeValue);
        console.log('  - raw technicianValue:', getInputValue('technician'));
        console.log('  - raw companyValue:', getInputValue('technician-company'));
        console.log('  - raw external-company:', document.querySelector(`[name="${formType}-external-company"]`)?.value);
        console.log('  - final technicianValue:', technicianValue);
        console.log('  - final companyValue:', companyValue);

        // Yağ numune alma özel alanları
        const motorHours = getInputValue('motor-hours');
        const barcodeNumber = getInputValue('barcode-number');
        
        // Alternatör gresleme özel alanları
        const alternatorFront = getInputValue('alternator-front');
        const alternatorRear = getInputValue('alternator-rear');
        const alternatorTotal = getInputValue('alternator-total');
        
        // Yağ filtresi değişimi özel alanları
        const filterMotorHours = getInputValue('filter-motor-hours');
        const filterOilHours = getInputValue('filter-oil-hours');
        
        // HT LT Ceket Suyu özel alanları
        const htTemperature = getInputValue('ht-temperature');
        const ltTemperature = getInputValue('lt-temperature');
        const jacketTemperature = getInputValue('jacket-temperature');
        
        const params = {
            action: 'save',
            date: getInputValue(`${formType}-date`) ? new Date(getInputValue(`${formType}-date`)).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR'),
            motor: getInputValue(`${formType}-equipment`),
            type: formType === 'periodic' ? 'Periyodik' : formType === 'normal' ? 'Normal' : 'Arıza',
            subtype: typeValue,
            technician: technicianValue,
            company: companyValue,
            notes: getInputValue(`${formType}-description`) || getInputValue(`${formType}-notes`),
            status: getInputValue(`${formType}-status`) || 'Aktif',
            files: files.length > 0 ? JSON.stringify(files) : '',
            motorHours: motorHours || '',
            barcodeNumber: barcodeNumber || '',
            alternatorFront: alternatorFront || '',
            alternatorRear: alternatorRear || '',
            alternatorTotal: alternatorTotal || '',
            filterMotorHours: filterMotorHours || '',
            filterOilHours: filterOilHours || '',
            htTemperature: htTemperature || '',
            ltTemperature: ltTemperature || '',
            jacketTemperature: jacketTemperature || ''
        };
        
        // DEBUG: Params kontrol
        console.log('=== PARAMS DEBUG ===');
        console.log('Form type:', formType);
        console.log('Technician value:', getInputValue('technician'));
        console.log('Type value:', getInputValue('type'));
        console.log('Company value:', getInputValue('technician-company'));
        console.log('Final params:', params);
        
        showNotification('Kaydediliyor', 'Bakım kaydı oluşturuluyor...', 'info');
        
        // DEBUG: Gönderilecek veriler
        console.log('=== POST VERİLERİ ===');
        console.log('Files JSON:', params.files);
        console.log('Files uzunluğu:', params.files ? params.files.length : 0);
        
        // URLSearchParams oluştur
        const urlParams = new URLSearchParams(params);
        console.log('URLSearchParams oluşturuldu');
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: urlParams
        });
        
        console.log('Response status:', response.status);
        
        const result = await response.json();
        console.log('Response result:', result);
        
        if (result.success) {
            const fileCount = files.length;
            let message = `Kayıt eklendi: ${result.recordNo}`;
            if (fileCount > 0) {
                message += ` (${fileCount} dosya yüklendi)`;
            }
            
            showNotification('Başarılı', message, 'success');
            formElement.reset();
            
            // Tarihleri yenile
            setAutoDate();
            
            // İstatistikleri yenile (manuel çağrı gerektiğinde)
            // maintenanceStats.loadStats(); // Çakışmayı önlemek için yorum satırı
            
            // Raporu yenile
            if (maintenanceReporter) {
                maintenanceReporter.generateReport();
            }
            
            // Dosya listelerini temizle
            clearFileLists(formType);
            
            // İstatistikleri otomatik yenile
            setTimeout(() => {
                if (window.maintenanceStats) {
                    console.log('📊 Kayıt başarılı, istatistikler yenileniyor...');
                    window.maintenanceStats.loadStats(6);
                }
            }, 1000);
            
        } else {
            showNotification('Hata', result.message, 'error');
        }
    } catch (error) {
        console.error('Kayıt hatası:', error);
        showNotification('Hata', 'Kayıt eklenemedi. Lütfen tekrar deneyin.', 'error');
    }
}

// Dosyaları işle
async function processFiles(formType) {
    const fileInput = document.getElementById(`${formType}-files`);
    console.log('Dosya input elementi:', fileInput);
    console.log('Dosya sayısı:', fileInput ? fileInput.files.length : 0);
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        console.log('Dosya bulunamadı');
        return [];
    }
    
    const files = [];
    
    for (let i = 0; i < fileInput.files.length; i++) {
        const file = fileInput.files[i];
        console.log(`Dosya ${i + 1}:`, file.name, 'Tip:', file.type, 'Boyut:', file.size);
        
        try {
            const base64 = await fileToBase64(file);
            console.log(`Dosya ${i + 1} Base64 uzunluğu:`, base64.length);
            
            files.push({
                name: file.name,
                type: file.type,
                size: file.size,
                base64: base64
            });
        } catch (error) {
            console.error(`Dosya işleme hatası (${file.name}):`, error);
        }
    }
    
    console.log('Toplam işlenen dosya:', files.length);
    return files;
}

// Dosyayı Base64'e çevir
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Dosya listelerini temizle
function clearFileLists(formType) {
    const fileInput = document.getElementById(`${formType}-files`);
    const fileList = document.getElementById(`${formType}-file-list`);
    
    if (fileInput) {
        fileInput.value = '';
    }
    
    if (fileList) {
        fileList.innerHTML = '';
    }
}

// İstatistik ve Grafik Fonksiyonları
class MaintenanceStats {
    constructor() {
        this.maintenanceData = [];
        this.chart = null;
        this.chartData = null;
    }

    // İstatistikleri yükle
    async loadStats(period = 6) {
        try {
            console.log('=== İSTATİSTİKLER YÜKLENİYOR ===');
            console.log('Periyot:', period, 'ay');
            
            const response = await fetch(SCRIPT_URL + '?action=getStats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'getStats',
                    period: period.toString()
                })
            });
            console.log('Stats response status:', response.status);
            
            const data = await response.json();
            console.log('Stats API yanıtı:', data);
            
            if (data.success) {
                console.log('📊 Stats verisi:', data.stats);
                console.log('📊 Chart verisi:', data.chartData);
                console.log('📊 Chart JSON:', JSON.stringify(data.chartData, null, 2));
                
                // Chart verisini sakla
                this.chartData = data.chartData;
                
                this.updateStatCards(data.stats);
                
                // Grafik loading'ini göster
                const loadingElement = document.getElementById('chart-loading');
                if (loadingElement) {
                    loadingElement.style.display = 'flex';
                }
                
                // Grafiği çiz
                setTimeout(() => {
                    this.drawChart(data.chartData);
                }, 500); // Kısa gecikme için
                
                // Toplam kayıt bilgisini güncelle
                const chartTotal = document.getElementById('chart-total');
                if (chartTotal && data.stats) {
                    chartTotal.textContent = `Toplam: ${data.stats.total} kayıt`;
                }
                
                showNotification('Başarılı', 'İstatistikler yüklendi', 'success');
            } else {
                console.error('Stats API hatası:', data.message);
                showNotification('Hata', 'İstatistikler alınamadı: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('İstatistikler yüklenemedi:', error);
            showNotification('Hata', 'Google Sheets bağlantısı kurulamadı: ' + error.message, 'error');
        }
    }

    // İstatistik kartlarını güncelle
    updateStatCards(stats) {
        console.log('📊 updateStatCards çağrıldı, gelen stats:', stats);
        console.log('📊 Stats JSON:', JSON.stringify(stats, null, 2));
        
        if (!stats) {
            console.warn('Stats verisi yok, demo veriler gösteriliyor');
            this.showDemoStats();
            return;
        }
        
        console.log('📊 Stats değerleri:');
        console.log('  - total:', stats.total);
        console.log('  - monthly:', stats.monthly);
        console.log('  - faults:', stats.faults);
        console.log('  - fault:', stats.fault);
        console.log('  - technicians:', stats.technicians);
        
        document.getElementById('total-maintenance').textContent = stats.total || 0;
        document.getElementById('monthly-maintenance').textContent = stats.monthly || 0;
        document.getElementById('fault-count').textContent = stats.faults || stats.fault || 0;  // Her iki formatı da destekle
        document.getElementById('technician-count').textContent = stats.technicians || 0;
        
        console.log('✅ İstatistik kartları güncellendi');
    }

    // Demo istatistikler göster - SADECE hata durumunda
    showDemoStats() {
        console.warn('Demo veriler gösteriliyor - Google Sheets bağlantısı kurulamadı');
        // Boş değerler göster
        this.updateStatCards({
            total: 0,
            monthly: 0,
            faults: 0,
            technicians: 0
        });
        // Boş grafik çiz
        const canvas = document.getElementById('maintenance-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            this.drawEmptyChart(ctx);
        }
    }

    // Grafik çiz
    drawChart(chartData, period = 6) {
        console.log('=== drawChart BAŞLADI ===');
        
        const canvas = document.getElementById('maintenance-chart');
        if (!canvas) {
            console.log('Canvas bulunamadı!');
            return;
        }

        // Loading ve empty state'ini kontrol et
        const loadingElement = document.getElementById('chart-loading');
        const emptyElement = document.getElementById('chart-empty');
        
        console.log('drawChart çağrıldı, chartData:', chartData);
        console.log('chartData.labels:', chartData?.labels);
        console.log('chartData.data:', chartData?.data);
        console.log('chartData.periodic:', chartData?.periodic);
        console.log('chartData.normal:', chartData?.normal);
        console.log('chartData.fault:', chartData?.fault);
        
        // Loading'i gizle
        if (loadingElement) {
            loadingElement.style.display = 'none';
            console.log('Loading gizlendi');
        }
        
        // Empty state'i gizle
        if (emptyElement) {
            emptyElement.style.display = 'none';
            console.log('Empty state gizlendi');
        }

        // Canvas boyutunu dinamik ayarla
        const container = canvas.parentElement;
        canvas.width = Math.max(container.offsetWidth - 30, 800); // Minimum 800px
        canvas.height = 300; // Yüksekliği artır
        
        console.log('Canvas boyutu:', canvas.width, 'x', canvas.height);

        const ctx = canvas.getContext('2d');
        console.log('Canvas context alındı');
        
        // Eğer chartData yoksa boş grafik çiz
        if (!chartData || !chartData.labels || (!chartData.data && !chartData.periodic)) {
            console.log('ChartData yok veya eksik - Boş grafik çiziliyor');
            this.drawEmptyChart(ctx);
            if (emptyElement) emptyElement.style.display = 'flex';
            return;
        }
        
        console.log('ChartData var - drawLineChart çağrılıyor');
        // Çizgisel grafik çizimi
        this.drawLineChart(ctx, chartData);
        console.log('=== drawChart BİTTİ ===');
    }
    
    // Çoklu çizgi grafik - Periyodik, Normal, Arıza
    drawLineChart(ctx, data) {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        
        // Temizle
        ctx.clearRect(0, 0, width, height);
        
        // Grafik konfigürasyonu
        const config = {
            padding: { top: 50, right: 100, bottom: 80, left: 70 },
            colors: {
                periodic: { line: '#4285f4', area: 'rgba(66, 133, 244, 0.08)', point: '#4285f4' },
                normal: { line: '#34a853', area: 'rgba(52, 168, 83, 0.08)', point: '#34a853' },
                fault: { line: '#ea4335', area: 'rgba(234, 67, 53, 0.08)', point: '#ea4335' },
                grid: '#e5e7eb',
                text: '#374151',
                axis: '#6b7280',
                background: '#ffffff'
            },
            font: {
                family: 'Inter, Arial, sans-serif',
                size: { title: 18, axis: 12, label: 10, value: 11, legend: 12 }
            }
        };
        
        // Çizim alanı
        const chartArea = {
            x: config.padding.left,
            y: config.padding.top,
            width: width - config.padding.left - config.padding.right,
            height: height - config.padding.top - config.padding.bottom
        };
        
        // Arka plan
        ctx.fillStyle = config.colors.background;
        ctx.fillRect(chartArea.x, chartArea.y, chartArea.width, chartArea.height);
        
        // Veri kontrolü
        if (!data || !data.labels || (!data.data && !data.periodic)) {
            ctx.fillStyle = config.colors.text;
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Veri bulunamadı', width / 2, height / 2);
            return;
        }
        
        // Veriyi normalize et
        let chartData;
        if (data.periodic && data.normal && data.fault) {
            // Yeni format
            chartData = {
                labels: data.labels,
                periodic: data.periodic.map(v => Math.max(0, v || 0)),
                normal: data.normal.map(v => Math.max(0, v || 0)),
                fault: data.fault.map(v => Math.max(0, v || 0))
            };
        } else {
            // Eski format - hepsini periyodik olarak kabul et
            chartData = {
                labels: data.labels,
                periodic: data.data.map(v => Math.max(0, v || 0)),
                normal: new Array(data.labels.length).fill(0),
                fault: new Array(data.labels.length).fill(0)
            };
        }
        
        console.log('🎨 Çoklu çizgi grafik çiziliyor:', chartData);
        
        const allValues = [...chartData.periodic, ...chartData.normal, ...chartData.fault];
        const maxValue = Math.max(...allValues, 1);
        
        // Grid çizgileri
        ctx.strokeStyle = config.colors.grid;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
        const gridLines = Math.min(8, maxValue + 1);
        for (let i = 0; i <= gridLines; i++) {
            const y = chartArea.y + (chartArea.height / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(chartArea.x, y);
            ctx.lineTo(chartArea.x + chartArea.width, y);
            ctx.stroke();
        }
        
        ctx.setLineDash([]);
        
        // Çizgi çizim fonksiyonu
        const drawLine = (values, colorConfig, label) => {
            const points = [];
            const pointSpacing = chartArea.width / Math.max(chartData.labels.length - 1, 1);
            
            values.forEach((value, index) => {
                const x = chartArea.x + pointSpacing * index;
                const y = chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
                points.push({ x, y, value });
            });
            
            // Alan grafiği
            if (points.some(p => p.value > 0)) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, chartArea.y + chartArea.height);
                
                points.forEach(point => {
                    ctx.lineTo(point.x, point.y);
                });
                
                ctx.lineTo(points[points.length - 1].x, chartArea.y + chartArea.height);
                ctx.closePath();
                
                const gradient = ctx.createLinearGradient(0, chartArea.y, 0, chartArea.y + chartArea.height);
                gradient.addColorStop(0, colorConfig.area);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
            
            // Çizgiyi çiz
            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                
                for (let i = 1; i < points.length; i++) {
                    const prevPoint = points[i - 1];
                    const currentPoint = points[i];
                    const cpx = (prevPoint.x + currentPoint.x) / 2;
                    const cpy = (prevPoint.y + currentPoint.y) / 2;
                    ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpx, cpy);
                }
                
                ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
                
                ctx.strokeStyle = colorConfig.line;
                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            
            // Noktaları çiz
            points.forEach((point, index) => {
                if (point.value > 0) {
                    // Dış çember
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = colorConfig.point;
                    ctx.fill();
                    
                    // Beyaz iç nokta
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                }
            });
        };
        
        // Çizgileri çiz
        drawLine(chartData.periodic, config.colors.periodic, 'Periyodik');
        drawLine(chartData.normal, config.colors.normal, 'Normal');
        drawLine(chartData.fault, config.colors.fault, 'Arıza');
        
        // X ekseni etiketleri
        const pointSpacing = chartArea.width / Math.max(chartData.labels.length - 1, 1);
        chartData.labels.forEach((label, index) => {
            const x = chartArea.x + pointSpacing * index;
            
            ctx.save();
            ctx.translate(x, chartArea.y + chartArea.height + 25);
            ctx.rotate(-Math.PI / 6);
            ctx.fillStyle = config.colors.text;
            ctx.font = `${config.font.size.label}px ${config.font.family}`;
            ctx.textAlign = 'right';
            ctx.fillText(label || `Ay${index + 1}`, 0, 0);
            ctx.restore();
        });
        
        // Eksenler
        ctx.strokeStyle = config.colors.axis;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        // X ekseni
        ctx.beginPath();
        ctx.moveTo(chartArea.x, chartArea.y + chartArea.height);
        ctx.lineTo(chartArea.x + chartArea.width, chartArea.y + chartArea.height);
        ctx.stroke();
        
        // Y ekseni
        ctx.beginPath();
        ctx.moveTo(chartArea.x, chartArea.y);
        ctx.lineTo(chartArea.x, chartArea.y + chartArea.height);
        ctx.stroke();
        
        // Y ekseni etiketleri
        ctx.fillStyle = config.colors.text;
        ctx.font = `${config.font.size.axis}px ${config.font.family}`;
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= gridLines; i++) {
            const value = Math.round((maxValue / gridLines) * (gridLines - i));
            const y = chartArea.y + (chartArea.height / gridLines) * i;
            ctx.fillText(value.toString(), chartArea.x - 10, y + 4);
        }
        
        // Legend
        const legendY = chartArea.y + 20;
        const legendItems = [
            { label: 'Periyodik', color: config.colors.periodic.line },
            { label: 'Normal', color: config.colors.normal.line },
            { label: 'Arıza', color: config.colors.fault.line }
        ];
        
        legendItems.forEach((item, index) => {
            const legendX = chartArea.x + chartArea.width - 80;
            const itemY = legendY + index * 20;
            
            // Çizgi
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(legendX, itemY);
            ctx.lineTo(legendX + 20, itemY);
            ctx.stroke();
            
            // Text
            ctx.fillStyle = config.colors.text;
            ctx.font = `${config.font.size.legend}px ${config.font.family}`;
            ctx.textAlign = 'left';
            ctx.fillText(item.label, legendX + 25, itemY + 4);
        });
        
        // Başlık
        ctx.fillStyle = config.colors.text;
        ctx.font = `bold ${config.font.size.title}px ${config.font.family}`;
        ctx.textAlign = 'center';
        ctx.fillText('Bakım Tipine Göre Dağılım', width / 2, 30);
        
        // Alt bilgi
        const totalMaintenances = chartData.periodic.reduce((a, b) => a + b, 0) + 
                                 chartData.normal.reduce((a, b) => a + b, 0) + 
                                 chartData.fault.reduce((a, b) => a + b, 0);
        
        ctx.fillStyle = config.colors.text;
        ctx.font = `${config.font.size.label}px ${config.font.family}`;
        ctx.textAlign = 'center';
        ctx.fillText(`Toplam: ${totalMaintenances} bakım`, width / 2, height - 10);
        
        console.log('✅ Çoklu çizgi grafik başarıyla çizildi');
    }
    
    // Eski parseChartData fonksiyonu kaldırıldı - artık çoklu çizgi grafik kullanılacak
    
    // Boş grafik çiz
    drawEmptyChart(ctx) {
        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Henüz veri yok', canvas.width / 2, canvas.height / 2);
    }

    // Basit bar chart çizim fonksiyonu - Geliştirilmiş versiyon
    drawBarChart(ctx, data) {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        
        // Temizle
        ctx.clearRect(0, 0, width, height);
        
        // Grafik konfigürasyonu
        const config = {
            padding: { top: 40, right: 30, bottom: 60, left: 60 },
            barWidth: 0.5, // Bar genişliği (spacing'in yüzdesi)
            colors: {
                bars: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'],
                grid: '#e0e0e0',
                text: '#333333',
                axis: '#666666',
                background: '#fafafa'
            },
            font: {
                family: 'Arial, sans-serif',
                size: {
                    title: 16,
                    axis: 12,
                    value: 11,
                    label: 12
                }
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            grid: {
                show: true,
                lines: 5,
                lineWidth: 0.5
            },
            legend: {
                show: true,
                position: 'top'
            }
        };
        
        const chartWidth = width - config.padding.left - config.padding.right;
        const chartHeight = height - config.padding.top - config.padding.bottom;
        
        // Arka plan
        ctx.fillStyle = config.colors.background;
        ctx.fillRect(config.padding.left, config.padding.top, chartWidth, chartHeight);
        
        const maxValue = Math.max(...data.data, 1); // En az 1 olsun
        
        // Eğer tüm değerler 0 ise boş grafik göster
        if (maxValue === 0) {
            ctx.fillStyle = '#999';
            ctx.font = `${config.font.size.title}px ${config.font.family}`;
            ctx.textAlign = 'center';
            ctx.fillText('Henüz veri yok', width / 2, height / 2);
            return;
        }
        
        // Grid çizgileri (Yatay)
        if (config.grid.show) {
            ctx.strokeStyle = config.colors.grid;
            ctx.lineWidth = config.grid.lineWidth;
            ctx.setLineDash([5, 5]); // Kesikli çizgi
            
            for (let i = 0; i <= config.grid.lines; i++) {
                const y = config.padding.top + (chartHeight / config.grid.lines) * i;
                ctx.beginPath();
                ctx.moveTo(config.padding.left, y);
                ctx.lineTo(width - config.padding.right, y);
                ctx.stroke();
                
                // Y ekseni değerleri
                const value = Math.round(maxValue - (maxValue / config.grid.lines) * i);
                ctx.fillStyle = config.colors.text;
                ctx.font = `${config.font.size.axis}px ${config.font.family}`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(value.toString(), config.padding.left - 10, y);
            }
            ctx.setLineDash([]); // Kesikli çizgiyi resetle
        }
        
        // Eksen çizgileri
        ctx.strokeStyle = config.colors.axis;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        
        // X ekseni
        ctx.beginPath();
        ctx.moveTo(config.padding.left, height - config.padding.bottom);
        ctx.lineTo(width - config.padding.right, height - config.padding.bottom);
        ctx.stroke();
        
        // Y ekseni
        ctx.beginPath();
        ctx.moveTo(config.padding.left, config.padding.top);
        ctx.lineTo(config.padding.left, height - config.padding.bottom);
        ctx.stroke();
        
        // Bar çizimi
        const spacing = chartWidth / data.labels.length;
        const barWidth = spacing * config.barWidth;
        
        data.labels.forEach((label, index) => {
            const value = data.data[index];
            const barHeight = (value / maxValue) * chartHeight * 0.95; // %95 kapla
            const x = config.padding.left + index * spacing + (spacing - barWidth) / 2;
            const y = height - config.padding.bottom - barHeight;
            
            if (isNaN(y) || isNaN(barHeight)) return;
            
            // Bar rengi (döngüsel renk paleti)
            const colorIndex = index % config.colors.bars.length;
            const gradient = ctx.createLinearGradient(0, y, 0, height - config.padding.bottom);
            gradient.addColorStop(0, config.colors.bars[colorIndex]);
            gradient.addColorStop(1, this.hexToRgba(config.colors.bars[colorIndex], 0.7));
            
            // Bar gölgesi
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            // Bar çiz
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Gölgeyi resetle
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Değer etiketi (barın üzerinde)
            if (value > 0) {
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${config.font.size.value}px ${config.font.family}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(value.toString(), x + barWidth / 2, y + barHeight - 5);
            }
            
            // X ekseni etiketi (döndürülmüş)
            ctx.save();
            ctx.translate(x + barWidth / 2, height - config.padding.bottom + 20);
            ctx.rotate(-Math.PI / 6); // -30 derece döndür
            ctx.fillStyle = config.colors.text;
            ctx.font = `${config.font.size.label}px ${config.font.family}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 0);
            ctx.restore();
        });
        
        // Başlık
        ctx.fillStyle = config.colors.text;
        ctx.font = `bold ${config.font.size.title}px ${config.font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Aylık Bakım İstatistikleri', width / 2, 10);
        
        // Y ekseni başlığı
        ctx.save();
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = config.colors.axis;
        ctx.font = `${config.font.size.axis}px ${config.font.family}`;
        ctx.textAlign = 'center';
        ctx.fillText('Bakım Sayısı', 0, 0);
        ctx.restore();
        
        // X ekseni başlığı
        ctx.fillStyle = config.colors.axis;
        ctx.font = `${config.font.size.axis}px ${config.font.family}`;
        ctx.textAlign = 'center';
        ctx.fillText('Ay', width / 2, height - 15);
    }
    
    // Hex rengi RGBA'ya çevir
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

// Global istatistik nesnesi
const maintenanceStats = new MaintenanceStats();

// Grafik kontrol butonlari icin fonksiyon
function setupChartButtons() {
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            // Aktif butonu degistir
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const period = parseInt(this.dataset.period);
            console.log(' Periyot degistiriliyor:', period, 'ay');
            
            // Loading goster
            const loadingElement = document.getElementById('chart-loading');
            const emptyElement = document.getElementById('chart-empty');
            if (loadingElement) loadingElement.style.display = 'flex';
            if (emptyElement) emptyElement.style.display = 'none';
            
            // Istatistikleri yeniden yukle (periyot parametresi ile)
            await maintenanceStats.loadStats(period);
            
            console.log(' Periyot guncellendi:', period, 'ay');
        });
    });
}

// Otomatik tarih atama - HTML input için ISO format (yyyy-MM-dd)
function setAutoDate() {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // yyyy-MM-dd format
    
    // Tüm tarih input'larını otomatik doldur
    const dateInputs = [
        'periodic-date',
        'normal-date', 
        'fault-date'
    ];
    
    dateInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input && !input.value) {
            input.value = dateString;
            console.log(`Otomatik tarih ayarlandı ${id}: ${dateString}`);
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('=== SAYFA YUKLENDI ===');
    
    // Sayfa yuklendiginde tarihleri ayarla
    setAutoDate();
    
    // Grafik butonlarini ayarla
    setupChartButtons();
    
    // Arama fonksiyonunu ayarla
    setupSearchFunction();
    
    // Otomatik sistem baslatma
    console.log('Sistem otomatik baslatiliyor...');
    initializeSystem();
    
    // Istatistikleri yukle (sistem baslatildiktan sonra)
    setTimeout(() => {
        console.log('Istatistikler otomatik yukleniyor...');
        maintenanceStats.loadStats();
    }, 1000);

    setTimeout(() => {
        loadActiveRecords();
    }, 1500);
    
    // Bakim hatiraticilarini kontrol et
    setTimeout(() => {
        checkMaintenanceReminders();
    }, 3000);
    
    // Yag numune kontrolunu baslat
    setTimeout(() => {
        checkOilSamples();
    }, 4000)
    
    // Form submit olaylarını güncelle
    document.querySelector('#periodic-form form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveMaintenanceData('periodic', e.target);
    });
    document.querySelector('#normal-form form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveMaintenanceData('normal', e.target);
    });
    document.querySelector('#fault-form form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveMaintenanceData('fault', e.target);
    });
    
    // Sistem otomatik başlatıldığı için butona gerek yok
    
    // Çıkış butonları
    const sidebarLogout = document.getElementById('sidebarLogout');
    const headerLogout = document.getElementById('headerLogout');

    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', function() {
            if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                window.location.href = 'giris.html';
            }
        });
    }

    if (headerLogout) {
        headerLogout.addEventListener('click', function() {
            if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                window.location.href = 'giris.html';
            }
        });
    }

    // Form butonları
    const formButtons = document.querySelectorAll('.form-btn');
    const forms = document.querySelectorAll('.maintenance-form');

    function switchForm(formType) {
        forms.forEach(form => { form.style.display = 'none'; });
        formButtons.forEach(btn => { btn.classList.remove('active'); });
        const selectedForm = document.getElementById(formType + '-form');
        if (selectedForm) selectedForm.style.display = 'block';
        const selectedButton = document.querySelector(`[data-form="${formType}"]`);
        if (selectedButton) selectedButton.classList.add('active');
    }

    formButtons.forEach(button => {
        button.addEventListener('click', function() {
            switchForm(this.getAttribute('data-form'));
        });
    });

    // Alternatör Gresleme hesaplama
    const frontInput = document.getElementById('alternator-front');
    const rearInput = document.getElementById('alternator-rear');
    const totalInput = document.getElementById('alternator-total');
    if (frontInput && rearInput && totalInput) {
        function calculateTotal() {
            const frontValue = parseFloat(frontInput.value) || 0;
            const rearValue = parseFloat(rearInput.value) || 0;
            totalInput.value = (frontValue + rearValue).toFixed(1);
        }
        frontInput.addEventListener('input', calculateTotal);
        rearInput.addEventListener('input', calculateTotal);
    }

    
    // Dış destek/Iç destek seçimi - varsayılan teknisyen gizli, seçime göre göster
    function initCompanySelect(companyId, technicianId, externalId) {
        const companySelect = document.getElementById(companyId);
        const technicianSelect = document.getElementById(technicianId);
        const externalSelect = document.getElementById(externalId);
        if (companySelect && technicianSelect && externalSelect) {
            // Varsayılan: teknisyen görünür
            technicianSelect.style.display = 'block';
            technicianSelect.required = true;
            externalSelect.style.display = 'none';
            externalSelect.required = false;
            
            companySelect.addEventListener('change', function() {
                if (this.value === 'internal') {
                    technicianSelect.style.display = 'block';
                    technicianSelect.required = true;
                    externalSelect.style.display = 'none';
                    externalSelect.required = false;
                    externalSelect.value = '';
                } else if (this.value === 'external') {
                    technicianSelect.style.display = 'none';
                    technicianSelect.required = false;
                    technicianSelect.value = '';
                    externalSelect.style.display = 'block';
                    externalSelect.required = true;
                } else {
                    // Seçim yoksa - varsayılan gizli
                    technicianSelect.style.display = 'none';
                    technicianSelect.required = false;
                    technicianSelect.value = '';
                    externalSelect.style.display = 'none';
                    externalSelect.required = false;
                    externalSelect.value = '';
                }
            });
        }
    }
    function initCompanySelectV2(companyId, technicianId, externalId) {
        const companySelect = document.getElementById(companyId);
        const technicianSelect = document.getElementById(technicianId);
        const externalSelect = document.getElementById(externalId);
        if (!companySelect || !technicianSelect || !externalSelect) return;

        function applyCompanyMode() {
            if (!companySelect.value) companySelect.value = 'internal';

            if (companySelect.value === 'external') {
                technicianSelect.style.display = 'none';
                technicianSelect.required = false;
                technicianSelect.value = '';
                externalSelect.style.display = 'block';
                externalSelect.required = true;
                return;
            }

            technicianSelect.style.display = 'block';
            technicianSelect.required = true;
            externalSelect.style.display = 'none';
            externalSelect.required = false;
            externalSelect.value = '';
        }

        applyCompanyMode();
        companySelect.addEventListener('change', applyCompanyMode);
    }

    initCompanySelectV2('periodic-technician-company', 'periodic-technician', 'periodic-external-company');
    initCompanySelectV2('normal-technician-company', 'normal-technician', 'normal-external-company');
    initCompanySelectV2('fault-technician-company', 'fault-technician', 'fault-external-company');

    // Dosya yükleme alanları
    function initFileUpload(areaId, inputId, listId) {
        const area = document.getElementById(areaId);
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
                
        console.log(`[initFileUpload] ${areaId}:`, { area: !!area, input: !!input, list: !!list });
                
        if (!area || !input || !list) {
            console.warn(`[initFileUpload] ${areaId}: Elementler bulunamadi!`);
            return;
        }

        // Dosya seçimi için özel handler
        // Kullanıcı direkt input üzerine tıklayabilir (CSS z-index ile üstte) 
        // veya area üzerine tıklayabilir
        
        input.addEventListener('click', (e) => {
            console.log(`[${inputId}] Input click - deger temizleniyor`);
            // Her tıklamada değeri temizle ki change event çalışsın
            input.value = '';
        });
        
        // Area click - input'a yönlendir
        area.addEventListener('click', (e) => {
            // Input zaten üstte ve tıklanabilir durumda
            // Bu event sadece yedek olarak kalıyor
            console.log(`[${areaId}] Area click`);
        });
        
        input.addEventListener('change', (e) => {
            console.log(`[${inputId}] Change event tetiklendi, dosya sayısı:`, input.files ? input.files.length : 0);
                    
            // Dosya seçilmeden çıkıldıysa işlem yapma
            if (!input.files || input.files.length === 0) {
                console.log(`[${inputId}] Dosya seçilmedi, çıkılıyor`);
                return;
            }
            
            console.log(`[${inputId}] ${input.files.length} dosya seçildi, listeleniyor...`);
            
            list.innerHTML = '';
            Array.from(input.files).forEach(file => {
                const div = document.createElement('div');
                div.className = 'file-item';
                div.innerHTML = `<span>📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)</span>
                                <button class="file-remove" data-name="${file.name}">&times;</button>`;
                list.appendChild(div);
            });
            
            console.log(`[${inputId}] Input temizleniyor...`);
            const selectedFiles = Array.from(input.files);
            const dt = new DataTransfer();
            selectedFiles.forEach(f => dt.items.add(f));
            input.files = dt.files;
        });
        
        area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
        area.addEventListener('dragleave', () => { area.classList.remove('dragover'); });
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            input.files = e.dataTransfer.files;
            input.dispatchEvent(new Event('change'));
        });
    }
    
    initFileUpload('periodic-file-area', 'periodic-files', 'periodic-file-list');
    initFileUpload('normal-file-area', 'normal-files', 'normal-file-list');
    initFileUpload('fault-file-area', 'fault-files', 'fault-file-list');

    // Bakım tipine göre dinamik alanlar
    const prioritySelect = document.getElementById('normal-priority');
    if (prioritySelect) {
        prioritySelect.addEventListener('change', function() {
            document.getElementById('alternator-grease-fields').style.display = 'none';
            document.getElementById('oil-sample-fields').style.display = 'none';
            document.getElementById('oil-filter-fields').style.display = 'none';
            document.getElementById('ht-lt-jacket-fields').style.display = 'none';
            if (this.value === 'alternator-grease') document.getElementById('alternator-grease-fields').style.display = 'block';
            else if (this.value === 'oil-sample') document.getElementById('oil-sample-fields').style.display = 'block';
            else if (this.value === 'oil-filter') document.getElementById('oil-filter-fields').style.display = 'block';
            else if (this.value === 'ht-lt-jacket') document.getElementById('ht-lt-jacket-fields').style.display = 'block';
        });
    }

    // Yardımcı fonksiyonlar
    function getTechnicianName(val) {
        const map = { 'ibrahim-ogun': 'İbrahim Ogün Şahin', 'yakup-can': 'Yakup Can Cin', 
                      'oguzhan-yaylali': 'Oğuzhan Yaylalı', 'altan-hunoglu': 'Altan Hunoğlu' };
        return map[val] || val;
    }
    function getNormalPriorityText(val) {
        const map = { 'alternator-grease': 'Alternatör Gresleme', 'oil-sample': 'Yağ Numune Alma',
                      'oil-filter': 'Yağ Filtre Değişimi', 'heat-exchanger': 'Eşanjör Ölçümü',
                      'ht-lt-jacket': 'HT LT Ceket Suyu Sıcaklık Ölçümü', 'other': 'Diğer' };
        return map[val] || val;
    }
    function getFaultReasonText(val) {
        const map = { 'electrical': 'Elektriksel', 'mechanical': 'Mekanik', 'electronic': 'Elektronik',
                      'hydraulic': 'Hidrolik', 'pneumatic': 'Pnömatik', 'software': 'Yazılım',
                      'maintenance': 'Bakım kaynaklı', 'other': 'Diğer' };
        return map[val] || val;
    }
    function getExternalCompanyName(val) {
        const map = { 'topkapi': 'Topkapı', 'other': 'Diğer' };
        return map[val] || val;
    }

});

// Bakım Hatırlatıcı Fonksiyonları
function checkMaintenanceReminders() {
    return;

    const reminders = [
        {
            title: 'GM-1 2000 Saat Bakımı',
            message: 'GM-1 motoru için 2000 saatlik periyodik bakım zamanı yaklaşıyor!',
            type: 'warning'
        },
        {
            title: 'Yağ Numunesi Kontrolü',
            message: 'GM-2 ve GM-3 için yağ numunesi alma zamanı geldi.',
            type: 'info'
        }
    ];

    // Hatırlatıcıları göster
    setTimeout(() => {
        reminders.forEach(reminder => {
            showNotification(reminder.title, reminder.message, reminder.type);
        });
    }, 3000); // Sistem başlatma bildiriminden sonra göster
}

// Sistem başlatma butonları kaldırıldı - sistem otomatik başlıyor

// Bağlantı test fonksiyonu kaldırıldı - sistem otomatik test ediyor

// Bildirim gösterme fonksiyonu - eski ve yeni kodla uyumlu
function showNotification(arg1, arg2, arg3) {
    // Eski format: showNotification(type, title, message)
    // Yeni format: showNotification(title, message, type)
    let title, message, type;
    
    if (['success', 'error', 'warning', 'info'].includes(arg1) && typeof arg2 === 'string') {
        // Eski format
        type = arg1;
        title = arg2;
        message = arg3 || '';
    } else {
        // Yeni format
        title = arg1;
        message = arg2 || '';
        type = arg3 || 'info';
    }
    
    // Mevcut bildirimleri temizle
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    // Renkleri belirle
    const colors = {
        success: { bg: '#28a745', text: 'white' },
        error: { bg: '#dc3545', text: 'white' },
        warning: { bg: '#ffc107', text: '#212529' },
        info: { bg: '#17a2b8', text: 'white' }
    };
    
    const color = colors[type] || colors.info;
    
    // Bildirim container'ı oluştur
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color.bg};
        color: ${color.text};
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 350px;
        animation: slideIn 0.3s ease;
        border-left: 4px solid ${type === 'success' ? '#20c997' : type === 'error' ? '#bd2130' : type === 'warning' ? '#e0a800' : '#138496'};
    `;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; font-size: 1rem;">
            ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'} ${title}
        </div>
        <div style="font-size: 0.9rem; line-height: 1.4;">${message}</div>
        <button onclick="this.parentElement.remove()" style="
            position: absolute;
            top: 5px;
            right: 10px;
            background: none;
            border: none;
            color: ${color.text};
            font-size: 18px;
            cursor: pointer;
            opacity: 0.8;
        ">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Otomatik kaldır (süreye göre)
    const timeout = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, timeout);
}

// Slide-out animasyonu ekle
const slideOutStyle = document.createElement('style');
slideOutStyle.textContent = `
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
document.head.appendChild(slideOutStyle);

// Arama fonksiyonu
function setupSearchFunction() {
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const tbody = document.getElementById('maintenance-tbody');
            const rows = tbody.getElementsByTagName('tr');

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const text = row.textContent.toLowerCase();
                
                if (text.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }
}

// Bakım Raporlama Sınıfı
class MaintenanceReporter {
    constructor() {
        this.records = [];
        this.filteredRecords = [];
        this.currentSort = { column: null, direction: 'asc' };
    }

    // Rapor oluştur
    async generateReport() {
        const motor = document.getElementById('report-motor')?.value || '';
        const type = document.getElementById('report-type')?.value || '';
        const dateRange = document.getElementById('report-date-range')?.value || '7';

        console.log('=== RAPOR OLUŞTURMA BAŞLATILIYOR ===');
        console.log('Motor:', motor, 'Tip:', type, 'Tarih aralığı:', dateRange);

        try {
            const url = `${SCRIPT_URL}?action=getReport&motor=${encodeURIComponent(motor)}&type=${encodeURIComponent(type)}&range=${encodeURIComponent(dateRange)}`;
            console.log('URL:', url);
            
            const response = await fetch(url);
            console.log('Response status:', response.status);
            
            const data = await response.json();
            console.log('API yanıtı:', data);
            
            if (data.success) {
                console.log('Başarılı - displayReport çağrılıyor');
                this.displayReport(data);
            } else {
                console.warn('API başarısız:', data.message);
                this.showDemoReport();
            }
        } catch (error) {
            console.error('Rapor alınamadı - HATA:', error);
            this.showDemoReport();
        }
    }

    // Raporu göster
    displayReport(data) {
        const summary = data.summary || {};
        const records = data.records || [];
        
        // Özet kartları güncelle - null kontrolü ile
        const totalEl = document.getElementById('summary-total');
        const periodicEl = document.getElementById('summary-periodic');
        const normalEl = document.getElementById('summary-normal');
        const faultEl = document.getElementById('summary-fault');
        
        if (totalEl) totalEl.textContent = summary.total || 0;
        if (periodicEl) periodicEl.textContent = summary.periodic || 0;
        if (normalEl) normalEl.textContent = summary.normal || 0;
        if (faultEl) faultEl.textContent = summary.fault || 0;
        
        // Tabloyu doldur
        this.populateTable(records);
    }

    // Demo rapor göster
    showDemoReport() {
        console.warn('Demo rapor gösteriliyor');
        
        // Boş özet - null kontrolü ile
        const totalEl = document.getElementById('summary-total');
        const periodicEl = document.getElementById('summary-periodic');
        const normalEl = document.getElementById('summary-normal');
        const faultEl = document.getElementById('summary-fault');
        
        if (totalEl) totalEl.textContent = '0';
        if (periodicEl) periodicEl.textContent = '0';
        if (normalEl) normalEl.textContent = '0';
        if (faultEl) faultEl.textContent = '0';
        
        // Boş tablo
        this.populateTable([]);
    }

    // Tabloyu doldur - 5 sütun: tarih, motor, tür, teknisyen, işlem
    populateTable(records) {
        const tbody = document.getElementById('maintenance-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">Henüz kayıt bulunmamaktadır</td></tr>';
            return;
        }
        
        records.forEach(record => {
            const tr = document.createElement('tr');
            
            // Tarihi TR formatına çevir (dd.MM.yyyy)
            let dateStr = record.date || '-';
            if (dateStr && dateStr !== '-') {
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj)) {
                    dateStr = dateObj.toLocaleDateString('tr-TR');
                }
            }
            
            // Motor adını büyük harfe çevir
            const motorStr = (record.motor || '-').toString().toUpperCase();
            
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${motorStr}</td>
                <td><span class="badge badge-${(record.type && typeof record.type === 'string' ? record.type.toLowerCase() : '')}">${record.type || '-'}</span></td>
                <td>${record.technician || '-'}</td>
                <td>${record.subtype || record.notes || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Tabloyu sırala
    sortTable(columnIndex) {
        const tbody = document.getElementById('maintenance-tbody');
        if (!tbody) return;
        
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0) return;
        
        // Sıralama yönünü belirle
        if (this.currentSort.column === columnIndex) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = columnIndex;
            this.currentSort.direction = 'asc';
        }
        
        // Sırala
        rows.sort((a, b) => {
            const aText = a.cells[columnIndex]?.textContent || '';
            const bText = b.cells[columnIndex]?.textContent || '';
            
            if (this.currentSort.direction === 'asc') {
                return aText.localeCompare(bText);
            } else {
                return bText.localeCompare(aText);
            }
        });
        
        // Tabloyu güncelle
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
    }

    // Excel'e export - Detaylı format (12 sütun)
    exportToExcel() {
        // Önce rapor verilerini al
        const motor = document.getElementById('report-motor')?.value || '';
        const type = document.getElementById('report-type')?.value || '';
        const dateRange = document.getElementById('report-date-range')?.value || '7';
        
        // API'den verileri çek ve export et
        const url = `${SCRIPT_URL}?action=getReport&motor=${encodeURIComponent(motor)}&type=${encodeURIComponent(type)}&range=${encodeURIComponent(dateRange)}`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (!data.success || !data.records) {
                    showNotification('Hata', 'Export için veri alınamadı', 'error');
                    return;
                }
                
                // CSV başlıkları (Türkçe) - noktalı virgül ile
                const headers = ['Kayıt No', 'Tarih', 'Saat', 'Motor', 'Tür', 'Alt Tür', 'Teknisyen', 'Firma', 'Notlar', 'Dosyalar', 'Durum', 'Oluşturulma Zamanı'];
                let csv = [headers.join(';')];
                
                // Verileri ekle - noktalı virgül ile
                data.records.forEach(record => {
                    const row = [
                        record.recordNo || '',
                        record.date || '',
                        record.time || '',
                        record.motor || '',
                        record.type || '',
                        record.subtype || '',
                        record.technician || '',
                        record.company || '',
                        record.notes || '',
                        record.files || '',
                        record.status || 'Aktif',
                        record.timestamp || ''
                    ];
                    
                    // Her hücreyi tırnak içine al ve içindeki tırnakları çiftleyerek escape et
                    const escapedRow = row.map(cell => {
                        const cellStr = String(cell || '').replace(/"/g, '""');
                        return `"${cellStr}"`;
                    });
                    
                    csv.push(escapedRow.join(';'));
                });
                
                // CSV dosyasını indir
                const csvContent = '\uFEFF' + csv.join('\n'); // BOM ekleyerek Türkçe karakterleri destekle
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                
                link.setAttribute('href', url);
                link.setAttribute('download', 'bakim_raporu_detayli_' + new Date().toISOString().split('T')[0] + '.csv');
                link.style.visibility = 'hidden';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showNotification('Başarılı', `Rapor Excel olarak indirildi (${data.records.length} kayıt)`, 'success');
            })
            .catch(error => {
                console.error('Export hatası:', error);
                showNotification('Hata', 'Rapor indirilemedi', 'error');
            });
    }
}

// Global raporlama nesnesi
const maintenanceReporter = new MaintenanceReporter();

// Global rapor fonksiyonları
function generateReport() {
    maintenanceReporter.generateReport();
}

function refreshTable() {
    maintenanceReporter.generateReport();
}

function exportReport() {
    maintenanceReporter.exportToExcel();
}

function sortTable(columnIndex) {
    maintenanceReporter.sortTable(columnIndex);
}

// Aktif Kayıtlar Yönetimi - Listeleme ve Kapatma
async function loadActiveRecords() {
    const motor = document.getElementById('active-filter-motor')?.value || '';
    const type = document.getElementById('active-filter-type')?.value || '';
    
    console.log('Aktif kayıtlar yükleniyor... Motor:', motor, 'Tip:', type);
    
    try {
        // Aktif kayıtları getir (status=Aktif)
        const url = `${SCRIPT_URL}?action=getActiveRecords&motor=${encodeURIComponent(motor)}&type=${encodeURIComponent(type)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            displayActiveRecords(data.records || []);
        } else {
            showNotification('Hata', data.message || 'Kayıtlar yüklenemedi', 'error');
            document.getElementById('active-records-tbody').innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #666;">Kayıt bulunamadı</td></tr>';
        }
    } catch (error) {
        console.error('Aktif kayıtlar yüklenirken hata:', error);
        showNotification('Hata', 'Bağlantı hatası', 'error');
    }
}

function calculateOverdueMaintenanceCount(records) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (records || []).filter(record => {
        const parts = String(record.date || '').split('.');
        if (parts.length !== 3) return false;

        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return false;

        const recordDate = new Date(year, month, day);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate < today;
    }).length;
}

function displayActiveRecords(records) {
    const tbody = document.getElementById('active-records-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const overdueEl = document.getElementById('overdue-maintenance');
    if (overdueEl) overdueEl.textContent = calculateOverdueMaintenanceCount(records);
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #666;">Aktif kayıt bulunmamaktadır</td></tr>';
        return;
    }
    
    records.forEach(record => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${record.recordNo}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${record.date}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${record.motor}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${record.type}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${record.technician}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><span style="color: #28a745; font-weight: 500;">● ${record.status}</span></td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: center;">
                <button onclick="closeRecord('${record.recordNo}')" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">Kapat</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function closeRecord(recordNo) {
    if (!confirm(`Kayıt ${recordNo} kapatılacak. Emin misiniz?`)) {
        return;
    }
    
    console.log('Kayıt kapatılıyor:', recordNo);
    
    try {
        const params = new URLSearchParams();
        params.append('action', 'closeRecord');
        params.append('recordNo', recordNo);
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: params
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Başarılı', `Kayıt ${recordNo} kapatıldı`, 'success');
            // Listeyi yenile
            loadActiveRecords();
            // Ana raporu da yenile
            if (maintenanceReporter) {
                maintenanceReporter.generateReport();
            }
        } else {
            showNotification('Hata', data.message || 'Kayıt kapatılamadı', 'error');
        }
    } catch (error) {
        console.error('Kayıt kapatılırken hata:', error);
        showNotification('Hata', 'Bağlantı hatası', 'error');
    }
}

// ========== YAĞ NUMUNE KONTROLÜ ==========

// Motor saatlerini getir ve kontrol et
async function checkOilSamples() {
    console.log('Yağ numune kontrolü başlatılıyor...');
    
    try {
        const url = `${SCRIPT_URL}?action=getMotorHours`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.motors) {
            displayOilSampleNotifications(data.motors);
        } else {
            console.log('Motor saatleri alınamadı');
        }
    } catch (error) {
        console.error('Yağ numune kontrolünde hata:', error);
    }
}

// Yağ numune ve alternatör gresleme bildirimlerini göster
function formatMaintenanceRemaining(remainingHours) {
    const value = parseInt(remainingHours, 10) || 0;
    return value > 0 ? `Kalan: ${value} saat` : 'Bakim zamani geldi';
}

function displayOilSampleNotifications(motors) {
    const oilAlerts = [];
    const oilWarnings = [];
    const altAlerts = [];
    const altWarnings = [];
    
    motors.forEach(motor => {
        // Yağ numune kontrolü (50 saat kala uyarı)
        if (motor.needsOilSample) {
            oilAlerts.push({
                motor: motor.motor,
                message: `${motor.motor} için YAĞ NUMUNE alma zamanı geldi! ${formatMaintenanceRemaining(motor.remainingOilHours)}`,
                type: 'urgent'
            });
        } else if (motor.warnsOilSample || motor.remainingOilHours <= 100) {
            oilWarnings.push({
                motor: motor.motor,
                message: `${motor.motor} için yağ numune alma yaklaşıyor. ${formatMaintenanceRemaining(motor.remainingOilHours)}`,
                type: 'warning'
            });
        }
        
        // Alternatör gresleme kontrolü (100 saat kala uyarı)
        if (motor.needsAlternatorGrease) {
            altAlerts.push({
                motor: motor.motor,
                message: `${motor.motor} için ALTERNATÖR GRESLEME zamanı geldi! ${formatMaintenanceRemaining(motor.remainingAltHours)}`,
                type: 'urgent'
            });
        } else if (motor.warnsAlternatorGrease || motor.remainingAltHours <= 100) {
            altWarnings.push({
                motor: motor.motor,
                message: `${motor.motor} için alternatör gresleme yaklaşıyor. ${formatMaintenanceRemaining(motor.remainingAltHours)}`,
                type: 'warning'
            });
        }
    });
    
    // Yağ numune bildirimleri
    if (oilAlerts.length > 0) {
        oilAlerts.forEach(alert => {
            showNotification('⚠️ Yağ Numune Zamanı', alert.message, 'error', 10000);
        });
    }
    
    if (oilWarnings.length > 0) {
        oilWarnings.forEach(warning => {
            showNotification('ℹ️ Yağ Numune Yaklaşıyor', warning.message, 'warning', 8000);
        });
    }
    
    // Alternatör gresleme bildirimleri
    if (altAlerts.length > 0) {
        altAlerts.forEach(alert => {
            showNotification('🔧 Alternatör Gresleme Zamanı', alert.message, 'error', 10000);
        });
    }
    
    if (altWarnings.length > 0) {
        altWarnings.forEach(warning => {
            showNotification('ℹ️ Alternatör Gresleme Yaklaşıyor', warning.message, 'warning', 8000);
        });
    }
    
    console.log(`Kontrol tamamlandı: ${oilAlerts.length} yağ acil, ${oilWarnings.length} yağ uyarı, ${altAlerts.length} alternatör acil, ${altWarnings.length} alternatör uyarı`);
}

// Motor saati güncelle
async function updateMotorHours(motor, hours) {
    console.log(`Motor saati güncelleniyor: ${motor} = ${hours}`);
    
    try {
        const params = new URLSearchParams();
        params.append('action', 'updateMotorHours');
        params.append('motor', motor);
        params.append('hours', hours);
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: params
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Başarılı', `${motor} saati güncellendi: ${hours} saat`, 'success');
            // Tekrar kontrol et
            checkOilSamples();
        } else {
            showNotification('Hata', data.message || 'Saat güncellenemedi', 'error');
        }
    } catch (error) {
        console.error('Motor saati güncellenirken hata:', error);
        showNotification('Hata', 'Bağlantı hatası', 'error');
    }
}

// Yağ numune alma kaydı
async function recordOilSample(motor, currentHours) {
    console.log(`Yağ numune kaydı: ${motor} - ${currentHours} saat`);
    
    if (!confirm(`${motor} için yağ numune alındı mı?\nMevcut saat: ${currentHours}\nBir sonraki: ${currentHours + 500} saat`)) {
        return;
    }
    
    try {
        const params = new URLSearchParams();
        params.append('action', 'updateOilSample');
        params.append('motor', motor);
        params.append('currentHours', currentHours);
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: params
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Başarılı', `${motor} yağ numune kaydı güncellendi. Bir sonraki: ${data.nextOilSample} saat`, 'success');
            checkOilSamples();
        } else {
            showNotification('Hata', data.message || 'Kayıt güncellenemedi', 'error');
        }
    } catch (error) {
        console.error('Yağ numune kaydı güncellenirken hata:', error);
        showNotification('Hata', 'Bağlantı hatası', 'error');
    }
}

// Alternatör gresleme kaydı
async function recordAlternatorGrease(motor, currentHours) {
    console.log(`Alternatör gresleme kaydı: ${motor} - ${currentHours} saat`);
    
    if (!confirm(`${motor} için alternatör greslemesi yapıldı mı?\nMevcut saat: ${currentHours}\nBir sonraki: ${parseInt(currentHours) + 1000} saat`)) {
        return;
    }
    
    try {
        const params = new URLSearchParams();
        params.append('action', 'updateAlternatorGrease');
        params.append('motor', motor);
        params.append('currentHours', currentHours);
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: params
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Başarılı', `${motor} alternatör gresleme kaydı güncellendi. Bir sonraki: ${data.nextAlternatorGrease} saat`, 'success');
            checkOilSamples();
        } else {
            showNotification('Hata', data.message || 'Kayıt güncellenemedi', 'error');
        }
    } catch (error) {
        console.error('Alternatör gresleme kaydı güncellenirken hata:', error);
        showNotification('Hata', 'Bağlantı hatası', 'error');
    }
}
