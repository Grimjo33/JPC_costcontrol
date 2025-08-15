document.addEventListener('DOMContentLoaded', () => {
    const targetForm = document.getElementById('targetForm');
    const submitButton = document.getElementById('submit-button');
    const targetListContainer = document.getElementById('target-list-container');
    const loader = document.getElementById('loader');

    function formatPeriode(periode) {
        const [year, month] = periode.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    }

    async function loadTargets() {
        try {
            loader.style.display = 'block';
            targetListContainer.innerHTML = '';
            const res = await fetch('/api/targets');
            if (!res.ok) throw new Error('Gagal memuat data target');
            const targets = await res.json();
            
            if (targets.length === 0) {
                targetListContainer.innerHTML = '<p class="text-gray-500">Belum ada target yang disimpan.</p>';
            } else {
                targets.forEach(target => {
                    const el = document.createElement('div');
                    el.className = 'p-3 bg-gray-800 rounded-lg flex justify-between items-center';
                    el.innerHTML = `
                        <div>
                            <p class="font-bold text-white">${formatPeriode(target.periode)}</p>
                            <p class="text-xs text-gray-400">OB: ${formatNumber(target.target_ob)} BCM | Coal: ${formatNumber(target.target_coal)} Ton</p>
                        </div>
                        <button data-periode="${target.periode}" class="delete-btn text-red-500 hover:text-red-400 text-xs font-bold">HAPUS</button>
                    `;
                    targetListContainer.appendChild(el);
                });
            }
        } catch (error) {
            loader.innerText = error.message;
        } finally {
            loader.style.display = 'none';
        }
    }
    
    async function deleteTarget(periode) {
        if (confirm(`Anda yakin ingin menghapus target untuk periode ${formatPeriode(periode)}?`)) {
            try {
                const res = await fetch('/delete-target', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ periode })
                });
                const result = await res.json();
                if (!result.success) throw new Error(result.error);
                showNotification(result.message, 'green');
                loadTargets(); // Muat ulang daftar
            } catch (error) {
                showNotification(`Gagal menghapus: ${error.message}`, 'red');
            }
        }
    }

    targetListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const periode = e.target.dataset.periode;
            deleteTarget(periode);
        }
    });

    targetForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';

        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());

        try {
            const res = await fetch("/submit-target", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.error || 'Terjadi kesalahan.');
            
            showNotification(result.message, 'green');
            e.target.reset();
            loadTargets();
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'red');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Simpan Target';
        }
    });

    // Main execution
    loadTargets();
});