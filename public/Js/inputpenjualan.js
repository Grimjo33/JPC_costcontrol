document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("penjualanForm").addEventListener("submit", async function(e) {
        e.preventDefault();
        const submitButton = document.getElementById('submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';

        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());

        try {
            const res = await fetch("/submit-penjualan", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.error || 'Terjadi kesalahan.');
            
            showNotification(result.message, 'green');
            e.target.reset();
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'red');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Simpan Data Penjualan';
        }
    });
});