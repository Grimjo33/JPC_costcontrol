document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById("rekonForm");
    const title = document.getElementById("form-title");
    const submitButton = document.getElementById('submit-button');
    
    const params = new URLSearchParams(window.location.search);
    const rekonId = params.get('id');
    let isEditMode = false;

    // Jika ada ID di URL, kita masuk ke mode Edit
    if (rekonId) {
        isEditMode = true;
        title.textContent = "Edit Data Rekonsiliasi Survey";
        submitButton.textContent = "Simpan Perubahan";

        // Ambil data dari server dan isi form
        try {
            const res = await fetch(`/api/rekon-detail/${rekonId}`);
            if (!res.ok) throw new Error('Gagal memuat data');
            const data = await res.json();
            
            form.querySelector('[name="id"]').value = data.id;
            form.querySelector('[name="start_date"]').value = data.start_date;
            form.querySelector('[name="end_date"]').value = data.end_date;
            form.querySelector('[name="volume_ob_survey"]').value = data.volume_ob_survey;
            form.querySelector('[name="volume_coal_survey"]').value = data.volume_coal_survey;
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'red');
            title.textContent = "Gagal memuat data untuk diedit";
        }
    }

    form.addEventListener("submit", async function(e) {
        e.preventDefault();
        
        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';

        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());

        // Logika submit yang sama, server akan handle INSERT atau UPDATE
        // berdasarkan primary key (start_date, end_date)
        try {
            const res = await fetch("/submit-rekon", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.error || 'Terjadi kesalahan.');
            
            showNotification(result.message, 'green');
            
            // Jika mode edit, kembali ke halaman data. Jika tidak, reset form.
            if (isEditMode) {
                setTimeout(() => { window.location.href = 'RekonData.html'; }, 1500);
            } else {
                e.target.reset();
            }

        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'red');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Simpan Perubahan' : 'Simpan Data';
        }
    });
});