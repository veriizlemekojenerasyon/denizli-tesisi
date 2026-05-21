// Google Apps Script URL - Global
const USER_URL = 'https://script.google.com/macros/s/AKfycbzt8MaQa9ikOO8gS0WbLhKjxJoFMXIrtj0It1U-8yMyQhFRE1rBnKlHJeG31n0tnnWB/exec';

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const changePasswordLink = document.getElementById('changePassword');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const changePasswordModal = document.getElementById('changePasswordModal');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const closeButtons = document.querySelectorAll('.close');
    
    // Şifre Değiştir - 3 Adım Formları
    const changePasswordStep1Form = document.getElementById('changePasswordStep1Form');
    const changePasswordStep2Form = document.getElementById('changePasswordStep2Form');
    const changePasswordStep3Form = document.getElementById('changePasswordStep3Form');
    const resendChangePassCode = document.getElementById('resendChangePassCode');

    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        const eyeIcon = this.querySelector('.eye-icon');
        eyeIcon.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });

    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        openModal(forgotPasswordModal);
    });

    changePasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        resetChangePasswordModal();
        openModal(changePasswordModal);
    });

    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });

    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (validateLoginForm(email, password)) {
            performLogin(email, password, rememberMe);
        }
    });

    // 📧 Şifremi unuttum - Adım 1: Kod gönder
    forgotPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const resetEmail = document.getElementById('resetEmail').value;
        
        if (validateEmail(resetEmail)) {
            await sendPasswordResetCode(resetEmail);
        } else {
            showError('Lütfen geçerli bir e-posta adresi girin.');
        }
    });
    
    // 🔑 Şifremi unuttum - Adım 2: Kod doğrula ve şifreyi sıfırla
    verifyCodeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value;
        const code = document.getElementById('resetCode').value;
        const newPassword = document.getElementById('newResetPassword').value;
        const confirmPassword = document.getElementById('confirmResetPassword').value;
        
        if (newPassword !== confirmPassword) {
            showError('Şifreler eşleşmiyor!');
            return;
        }
        
        if (newPassword.length < 6) {
            showError('Şifre en az 6 karakter olmalı!');
            return;
        }
        
        await resetPasswordWithCode(email, code, newPassword);
    });

    // Şifre Değiştir - Adım 1: Email gönder
    changePasswordStep1Form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('changePassEmail').value;
        await sendChangePassCode(email);
    });

    // Şifre Değiştir - Adım 2: Kod doğrula
    changePasswordStep2Form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const code = document.getElementById('changePassCode').value;
        const email = document.getElementById('changePassEmail').value;
        await verifyChangePassCode(email, code);
    });

    // Şifre Değiştir - Adım 3: Yeni şifre belirle
    changePasswordStep3Form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('changePassEmail').value;
        const code = document.getElementById('changePassCode').value;
        const newPassword = document.getElementById('changePassNewPassword').value;
        const confirmPassword = document.getElementById('changePassConfirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            showError('Şifreler eşleşmiyor!');
            return;
        }
        
        if (newPassword.length < 6) {
            showError('Şifre en az 6 karakter olmalı!');
            return;
        }
        
        await resetPasswordWithCode(email, code, newPassword);
    });

    // Kodu tekrar gönder
    resendChangePassCode.addEventListener('click', async function() {
        const email = document.getElementById('changePassEmail').value;
        await sendChangePassCode(email);
    });

    function openModal(modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    function validateLoginForm(email, password) {
        if (!validateEmail(email)) {
            showError('Lütfen geçerli bir e-posta adresi girin.');
            return false;
        }

        if (password.length < 6) {
            showError('Şifre en az 6 karakter olmalıdır.');
            return false;
        }

        return true;
    }

    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function validatePasswordChange(currentPassword, newPassword, confirmNewPassword) {
        if (currentPassword.length < 6) {
            showError('Mevcut şifre en az 6 karakter olmalıdır.');
            return false;
        }

        if (newPassword.length < 6) {
            showError('Yeni şifre en az 6 karakter olmalıdır.');
            return false;
        }

        if (newPassword !== confirmNewPassword) {
            showError('Yeni şifreler eşleşmiyor.');
            return false;
        }

        if (currentPassword === newPassword) {
            showError('Yeni şifre mevcut şifreden farklı olmalıdır.');
            return false;
        }

        return true;
    }

    async function performLogin(email, password, rememberMe) {
        try {
            const res = await fetch(USER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `action=validateLogin&data=${encodeURIComponent(JSON.stringify({ email, password }))}`
            });
            const result = await res.json();
            
            if (!result.success) {
                showError(result.error || 'Giriş başarısız!');
                return;
            }
            
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }
            
            // Gerçek kullanıcı bilgilerini kaydet
            const userData = {
                email: email,
                firstName: result.user.firstName || result.user.ad || '',
                lastName: result.user.lastName || result.user.soyad || '',
                role: result.user.role || result.user.rol || 'operator'
            };
            localStorage.setItem('loggedInUser', JSON.stringify(userData));
            localStorage.setItem('currentUser', JSON.stringify(userData));
            if (userData.role === 'admin') {
                sessionStorage.setItem('adminTriggerCheckPending', '1');
            } else {
                sessionStorage.removeItem('adminTriggerCheckPending');
            }

            showSuccess('Giriş başarılı! Yönlendiriliyorsunuz...');
            
            setTimeout(() => {
                window.location.href = 'anasayfa.html';
            }, 1500);
        } catch (e) {
            showError('Sunucu hatası: ' + e.message);
        }
    }

    // 📧 Şifre sıfırlama kodu gönder (Adım 1)
    async function sendPasswordResetCode(email) {
        try {
            showSuccess('Kod gönderiliyor...');
            
            const response = await fetch(USER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'sendResetCode',
                    data: JSON.stringify({ email: email })
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showSuccess(result.message || 'Kod gönderildi! E-postanızı kontrol edin.');
                
                // İkinci adım modalını aç
                setTimeout(() => {
                    closeModal(forgotPasswordModal);
                    openModal(verifyCodeModal);
                }, 1500);
                
                return true;
            } else {
                showError(result.error || 'Kod gönderilemedi!');
                return false;
            }
        } catch (error) {
            console.error('Kod gönderme hatası:', error);
            showError('Bağlantı hatası!');
            return false;
        }
    }
    
    // 🔑 Şifreyi sıfırla (Adım 2 - Kod + Yeni Şifre)
    async function resetPasswordWithCode(email, code, newPassword) {
        try {
            showSuccess('Şifre güncelleniyor...');
            
            const response = await fetch(USER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'resetPassword',
                    data: JSON.stringify({ email: email, code: code, newPassword: newPassword })
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showSuccess(result.message || 'Şifreniz başarıyla değiştirildi!');
                
                setTimeout(() => {
                    closeModal(verifyCodeModal);
                    verifyCodeForm.reset();
                    forgotPasswordForm.reset();
                }, 2000);
                
                return true;
            } else {
                showError(result.error || 'Şifre değiştirilemedi!');
                return false;
            }
        } catch (error) {
            console.error('Şifre sıfırlama hatası:', error);
            showError('Bağlantı hatası!');
            return false;
        }
    }

    // Şifre Değiştir - Adım 1: Kod gönder
    async function sendChangePassCode(email) {
        if (!email) {
            showError('E-posta adresi girin!');
            return;
        }
        
        try {
            showSuccess('Kod gönderiliyor...');
            
            const response = await fetch(USER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'sendResetCode',
                    data: JSON.stringify({ email: email })
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showSuccess(result.message || 'Doğrulama kodu gönderildi!');
                // Adım 2'ye geç
                changePasswordStep1Form.style.display = 'none';
                changePasswordStep2Form.style.display = 'block';
            } else {
                showError(result.error || 'Kod gönderilemedi!');
            }
        } catch (error) {
            console.error('Kod gönderme hatası:', error);
            showError('Bağlantı hatası!');
        }
    }
    
    // Şifre Değiştir - Adım 2: Kod doğrula
    async function verifyChangePassCode(email, code) {
        if (!email || !code) {
            showError('E-posta ve kod gerekli!');
            return;
        }
        
        try {
            showSuccess('Kod doğrulanıyor...');
            
            const response = await fetch(USER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'verifyResetCode',
                    data: JSON.stringify({ email: email, code: code })
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showSuccess(result.message || 'Kod doğrulandı!');
                // Adım 3'e geç
                changePasswordStep2Form.style.display = 'none';
                changePasswordStep3Form.style.display = 'block';
            } else {
                showError(result.error || 'Kod doğrulanamadı!');
            }
        } catch (error) {
            console.error('Kod doğrulama hatası:', error);
            showError('Bağlantı hatası!');
        }
    }
    
    // Şifre Değiştir modalını sıfırla
    function resetChangePasswordModal() {
        changePasswordStep1Form.style.display = 'block';
        changePasswordStep2Form.style.display = 'none';
        changePasswordStep3Form.style.display = 'none';
        changePasswordStep1Form.reset();
        changePasswordStep2Form.reset();
        changePasswordStep3Form.reset();
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    function showSuccess(message) {
        showNotification(message, 'success');
    }

    function showNotification(message, type) {
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

        if (type === 'error') {
            notification.style.background = '#e53e3e';
        } else if (type === 'success') {
            notification.style.background = '#38a169';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        document.getElementById('email').value = rememberedEmail;
        document.getElementById('rememberMe').checked = true;
    }
});

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
