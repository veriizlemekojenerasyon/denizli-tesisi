(function() {
    function clearSession() {
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('rememberedEmail');
    }

    function logout() {
        if (!confirm('Cikis yapmak istediginizden emin misiniz?')) return;
        clearSession();
        window.location.href = 'index.html';
    }

    document.addEventListener('click', function(event) {
        const target = event.target.closest('#sidebarLogout, #headerLogout, #btnLogout, .logout-btn');
        if (!target) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        logout();
    }, true);

    window.SystemLogout = {
        clearSession,
        logout
    };
})();
