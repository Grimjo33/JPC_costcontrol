// public/js/common.js

/**
 * Logika untuk membuat dropdown berfungsi dengan sistem klik.
 */
function initializeDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');

    dropdowns.forEach(dropdown => {
        const button = dropdown.querySelector('.nav-link-parent');
        if (button) {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                // Tutup dropdown lain yang mungkin terbuka
                document.querySelectorAll('.dropdown.is-open').forEach(openDropdown => {
                    if (openDropdown !== dropdown) {
                        openDropdown.classList.remove('is-open');
                    }
                });
                // Buka/tutup dropdown yang diklik
                dropdown.classList.toggle('is-open');
            });
        }
    });

    // Listener global untuk menutup dropdown saat klik di luar
    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown.is-open').forEach(openDropdown => {
            openDropdown.classList.remove('is-open');
        });
    });
}

/**
 * Memuat dan menyisipkan navigasi, lalu menandai link aktif.
 */
async function loadNav() {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (!navPlaceholder) return;

    try {
        const response = await fetch('nav.html');
        if (!response.ok) throw new Error('nav.html tidak ditemukan');
        const navHTML = await response.text();
        navPlaceholder.innerHTML = navHTML;

        // Inisialisasi logika dropdown SETELAH nav berhasil dimuat
        initializeDropdowns();

        // Logika untuk menandai link aktif
        const currentPage = window.location.pathname.split('/').pop();
        const navLinks = document.querySelectorAll('.nav-link');
        let activeParent = null;

        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPage) {
                link.classList.add('text-green-400', 'font-bold');
                if (currentPage !== 'Dashboard_Harian.html') {
                    link.classList.add('bg-green-500/10');
                }
                const parentDropdown = link.closest('.dropdown');
                if (parentDropdown) {
                    activeParent = parentDropdown.querySelector('.nav-link-parent');
                }
            }
        });

        if (activeParent) {
            activeParent.classList.add('text-green-400', 'font-bold', 'bg-green-500/10');
        } else {
            const topLevelActive = document.querySelector(`.nav-link[href="${currentPage}"]`);
            if (topLevelActive && !topLevelActive.closest('.dropdown')) {
                topLevelActive.classList.add('text-green-400', 'font-bold', 'bg-green-500/10');
            }
        }
    } catch (error) {
        console.error('Error loading navigation:', error);
        navPlaceholder.innerHTML = '<p class="text-red-500 text-center">Gagal memuat navigasi.</p>';
    }
}

/**
 * Menampilkan notifikasi sementara.
 * @param {string} message - Pesan yang akan ditampilkan.
 * @param {'green'|'red'|'yellow'} color - Warna notifikasi.
 */
function showNotification(message, color = 'green') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `bg-gray-800 border-l-4 border-${color}-500 p-4 rounded-lg shadow-lg mb-2 transition-all transform translate-y-4 opacity-0`;
    el.innerHTML = `<p>${message}</p>`;
    container.appendChild(el);
    setTimeout(() => el.classList.remove('translate-y-4', 'opacity-0'), 10);
    setTimeout(() => {
        el.classList.add('opacity-0');
        el.addEventListener('transitionend', () => el.remove());
    }, 4000);
}

// Fungsi formatting
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
const formatNumber = (value, decimals = 2) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: decimals }).format(value || 0);

// Panggil fungsi loadNav saat DOM siap
document.addEventListener('DOMContentLoaded', loadNav);