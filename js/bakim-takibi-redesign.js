function renderModernMaintenanceForms() {
  const container = document.querySelector('.maintenance-container');
  if (!container) return;

  const technicians = `
    <option value="">Teknisyen secin</option>
    <option value="ibrahim-ogun">Ibrahim Ogun Sahin</option>
    <option value="yakup-can">Yakup Can Cin</option>
    <option value="oguzhan-yaylali">Oguzhan Yaylali</option>
    <option value="altan-hunoglu">Altan Hunoglu</option>
  `;

  const motors = `
    <option value="">Motor secin</option>
    <option value="GM-1">GM-1</option>
    <option value="GM-2">GM-2</option>
    <option value="GM-3">GM-3</option>
  `;

  const companyFields = (prefix) => `
    <div class="technician-input-group">
      <select id="${prefix}-technician-company" name="technician-company">
        <option value="internal" selected>Ic destek</option>
        <option value="external">Dis destek</option>
      </select>
      <select id="${prefix}-technician" name="technician" required>${technicians}</select>
      <select id="${prefix}-external-company" name="${prefix}-external-company" style="display: none;">
        <option value="">Dis firma secin</option>
        <option value="topkapi">Topkapi Endustri</option>
        <option value="other">Diger dis firma</option>
      </select>
    </div>
  `;

  const fileFields = (prefix) => `
    <div class="file-upload-container">
      <div class="file-upload-area" id="${prefix}-file-area">
        <p class="file-upload-text">Dosya veya fotograf ekle</p>
        <input type="file" id="${prefix}-files" name="${prefix}-files" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" class="file-input">
      </div>
      <div class="file-list" id="${prefix}-file-list"></div>
    </div>
  `;

  container.innerHTML = `
    <div class="maintenance-workbench-header">
      <div>
        <span class="section-kicker">Bakim kayit merkezi</span>
        <h2>Yeni kayit olustur</h2>
      </div>
      <div class="form-buttons" role="tablist" aria-label="Bakim turu">
        <button type="button" class="form-btn active" data-form="periodic">Periyodik</button>
        <button type="button" class="form-btn" data-form="normal">Normal is</button>
        <button type="button" class="form-btn" data-form="fault">Ariza</button>
      </div>
    </div>

    <div class="maintenance-form modern-record-form" id="periodic-form">
      <div class="record-form-title">
        <span class="record-type-pill">Periyodik</span>
        <h3>Periyodik bakim kaydi</h3>
      </div>
      <form class="maintenance-form-content">
        <section class="form-step">
          <div class="step-label">1</div>
          <div class="step-body">
            <h4>Temel bilgiler</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="periodic-date">Baslangic tarihi</label>
                <input type="date" id="periodic-date" name="periodic-date" required>
              </div>
              <div class="form-group">
                <label for="periodic-start-time">Baslangic saati</label>
                <input type="time" id="periodic-start-time" name="periodic-start-time" required>
              </div>
              <div class="form-group">
                <label for="periodic-end-date">Bitis tarihi</label>
                <input type="date" id="periodic-end-date" name="periodic-end-date" required>
              </div>
              <div class="form-group">
                <label for="periodic-end-time">Bitis saati</label>
                <input type="time" id="periodic-end-time" name="periodic-end-time" required>
              </div>
              <div class="form-group">
                <label for="periodic-equipment">Motor</label>
                <select id="periodic-equipment" name="periodic-equipment" required>${motors}</select>
              </div>
              <div class="form-group">
                <label for="periodic-type">Bakim tipi</label>
                <select id="periodic-type" name="type" required>
                  <option value="">Tip secin</option>
                  <option value="2000">2000 Saat</option>
                  <option value="6000">6000 Saat</option>
                  <option value="10000">10000 Saat</option>
                  <option value="20000">20000 Saat</option>
                  <option value="30000">30000 Saat</option>
                </select>
              </div>
              <div class="form-group">
                <label for="periodic-status">Durum</label>
                <select id="periodic-status" name="periodic-status" required>
                  <option value="Aktif" selected>Aktif</option>
                  <option value="Pasif">Pasif</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section class="form-step">
          <div class="step-label">2</div>
          <div class="step-body">
            <h4>Sorumlu ekip</h4>
            ${companyFields('periodic')}
          </div>
        </section>

        <section class="form-step">
          <div class="step-label">3</div>
          <div class="step-body">
            <h4>Not ve ekler</h4>
            <div class="form-group full-width">
              <label for="periodic-description">Bakim notlari</label>
              <textarea id="periodic-description" name="periodic-description" rows="4" placeholder="Yapilan bakim islemleri..."></textarea>
            </div>
            ${fileFields('periodic')}
          </div>
        </section>

        <div class="form-actions full-width">
          <button type="reset" class="btn btn-secondary">Temizle</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    </div>

    <div class="maintenance-form modern-record-form" id="normal-form" style="display: none;">
      <div class="record-form-title">
        <span class="record-type-pill">Normal is</span>
        <h3>Normal bakim kaydi</h3>
      </div>
      <form class="maintenance-form-content">
        <section class="form-step">
          <div class="step-label">1</div>
          <div class="step-body">
            <h4>Temel bilgiler</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="normal-date">Baslangic tarihi</label>
                <input type="date" id="normal-date" name="normal-date" required>
              </div>
              <div class="form-group">
                <label for="normal-start-time">Baslangic saati</label>
                <input type="time" id="normal-start-time" name="normal-start-time" required>
              </div>
              <div class="form-group">
                <label for="normal-end-date">Bitis tarihi</label>
                <input type="date" id="normal-end-date" name="normal-end-date" required>
              </div>
              <div class="form-group">
                <label for="normal-end-time">Bitis saati</label>
                <input type="time" id="normal-end-time" name="normal-end-time" required>
              </div>
              <div class="form-group">
                <label for="normal-equipment">Motor</label>
                <select id="normal-equipment" name="normal-equipment" required>${motors}</select>
              </div>
              <div class="form-group">
                <label for="normal-priority">Bakim tipi</label>
                <select id="normal-priority" name="type" required>
                  <option value="">Tip secin</option>
                  <option value="alternator-grease">Alternator Gresleme</option>
                  <option value="oil-sample">Yag Numune Alma</option>
                  <option value="oil-filter">Yag Filtre Degisimi</option>
                  <option value="heat-exchanger">Esanjor Olcumu</option>
                  <option value="ht-lt-jacket">HT LT Ceket Suyu Deger Olcumu</option>
                  <option value="other">Diger</option>
                </select>
              </div>
              <div class="form-group">
                <label for="normal-status">Durum</label>
                <select id="normal-status" name="normal-status" required>
                  <option value="Aktif" selected>Aktif</option>
                  <option value="Pasif">Pasif</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section class="form-step">
          <div class="step-label">2</div>
          <div class="step-body">
            <h4>Olcum detaylari</h4>
            <div class="conditional-fields-grid">
              <div id="alternator-grease-fields" style="display: none;">
                <h4>Alternator gresleme</h4>
                <div class="measurement-row">
                  <div class="measurement-item">
                    <label for="alternator-motor-hours">Motor calisma saati</label>
                    <input type="number" id="alternator-motor-hours" name="alternator-motor-hours" step="1" min="0" placeholder="0">
                  </div>
                  <div class="measurement-item">
                    <label for="alternator-front">On (cm3)</label>
                    <input type="number" id="alternator-front" name="alternator-front" step="0.1" min="0" placeholder="0.0">
                  </div>
                  <div class="measurement-item">
                    <label for="alternator-rear">Arka (cm3)</label>
                    <input type="number" id="alternator-rear" name="alternator-rear" step="0.1" min="0" placeholder="0.0">
                  </div>
                  <div class="measurement-item">
                    <label for="alternator-total">Toplam (cm3)</label>
                    <input type="number" id="alternator-total" name="alternator-total" step="0.1" min="0" placeholder="0.0" readonly>
                  </div>
                </div>
              </div>

              <div id="oil-sample-fields" style="display: none;">
                <h4>Yag numune</h4>
                <div class="oil-sample-row">
                  <div class="oil-sample-item">
                    <label for="motor-hours">Motor calisma saati</label>
                    <input type="number" id="motor-hours" name="motor-hours" step="1" min="0" placeholder="0">
                  </div>
                  <div class="oil-sample-item">
                    <label for="barcode-number">Barkod numarasi</label>
                    <input type="text" id="barcode-number" name="barcode-number" placeholder="Barkod numarasi">
                  </div>
                </div>
              </div>

              <div id="oil-filter-fields" style="display: none;">
                <h4>Yag filtre degisimi</h4>
                <div class="oil-filter-row">
                  <div class="oil-filter-item">
                    <label for="filter-motor-hours">Motor calisma saati</label>
                    <input type="number" id="filter-motor-hours" name="filter-motor-hours" step="1" min="0" placeholder="0">
                  </div>
                  <div class="oil-filter-item">
                    <label for="filter-oil-hours">Yag calisma saati</label>
                    <input type="number" id="filter-oil-hours" name="filter-oil-hours" step="1" min="0" placeholder="0">
                  </div>
                </div>
              </div>

              <div id="ht-lt-jacket-fields" style="display: none;">
                <h4>HT LT ceket suyu</h4>
                <div class="ht-lt-jacket-row">
                  <div class="ht-lt-jacket-item">
                    <label for="ht-temperature">HT deger</label>
                    <input type="number" id="ht-temperature" name="ht-temperature" step="0.1" placeholder="0.0">
                  </div>
                  <div class="ht-lt-jacket-item">
                    <label for="lt-temperature">LT deger</label>
                    <input type="number" id="lt-temperature" name="lt-temperature" step="0.1" placeholder="0.0">
                  </div>
                  <div class="ht-lt-jacket-item">
                    <label for="jacket-temperature">Ceket suyu deger</label>
                    <input type="number" id="jacket-temperature" name="jacket-temperature" step="0.1" placeholder="0.0">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="form-step">
          <div class="step-label">3</div>
          <div class="step-body">
            <h4>Sorumlu, not ve ekler</h4>
            ${companyFields('normal')}
            <div class="form-group full-width">
              <label for="normal-description">Bakim notlari</label>
              <textarea id="normal-description" name="normal-description" rows="4" placeholder="Yapilan bakim islemleri..."></textarea>
            </div>
            ${fileFields('normal')}
          </div>
        </section>

        <div class="form-actions full-width">
          <button type="reset" class="btn btn-secondary">Temizle</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    </div>

    <div class="maintenance-form modern-record-form" id="fault-form" style="display: none;">
      <div class="record-form-title">
        <span class="record-type-pill record-type-danger">Ariza</span>
        <h3>Ariza bakim kaydi</h3>
      </div>
      <form class="maintenance-form-content">
        <section class="form-step">
          <div class="step-label">1</div>
          <div class="step-body">
            <h4>Ariza bilgileri</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="fault-date">Baslangic tarihi</label>
                <input type="date" id="fault-date" name="fault-date" required>
              </div>
              <div class="form-group">
                <label for="fault-start-time">Baslangic saati</label>
                <input type="time" id="fault-start-time" name="fault-start-time" required>
              </div>
              <div class="form-group">
                <label for="fault-end-date">Bitis tarihi</label>
                <input type="date" id="fault-end-date" name="fault-end-date" required>
              </div>
              <div class="form-group">
                <label for="fault-end-time">Bitis saati</label>
                <input type="time" id="fault-end-time" name="fault-end-time" required>
              </div>
              <div class="form-group">
                <label for="fault-time">Ariza zamani</label>
                <input type="time" id="fault-time" name="fault-time" required>
              </div>
              <div class="form-group">
                <label for="fault-equipment">Motor</label>
                <select id="fault-equipment" name="fault-equipment" required>${motors}</select>
              </div>
              <div class="form-group">
                <label for="fault-reason">Ariza nedeni</label>
                <select id="fault-reason" name="type" required>
                  <option value="">Neden secin</option>
                  <option value="electrical">Elektriksel</option>
                  <option value="mechanical">Mekanik</option>
                  <option value="electronic">Elektronik</option>
                  <option value="hydraulic">Hidrolik</option>
                  <option value="pneumatic">Pnomatik</option>
                  <option value="software">Yazilim</option>
                  <option value="maintenance">Bakim kaynakli</option>
                  <option value="other">Diger</option>
                </select>
              </div>
              <div class="form-group">
                <label for="fault-status">Durum</label>
                <select id="fault-status" name="fault-status" required>
                  <option value="Aktif" selected>Aktif</option>
                  <option value="Pasif">Pasif</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section class="form-step">
          <div class="step-label">2</div>
          <div class="step-body">
            <h4>Sorumlu ve aciklama</h4>
            ${companyFields('fault')}
            <div class="form-group full-width">
              <label for="fault-notes">Ariza notlari</label>
              <textarea id="fault-notes" name="fault-notes" rows="4" placeholder="Ariza ve yapilan islem..."></textarea>
            </div>
            ${fileFields('fault')}
          </div>
        </section>

        <div class="form-actions full-width">
          <button type="reset" class="btn btn-secondary">Temizle</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    </div>
  `;
}
