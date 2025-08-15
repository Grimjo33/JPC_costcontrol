document.addEventListener('DOMContentLoaded', () => {
    
    // Fungsi untuk memuat dan menampilkan data
    async function loadJarakData() {
        const tbody = document.getElementById('data-body');
        const loader = document.getElementById('loader-container');
        tbody.innerHTML = '';
        loader.style.display = 'block';

        try {
            const res = await fetch('/api/jarak-data');
            if (!res.ok) throw new Error(`Gagal mengambil data: ${res.statusText}`);
            const data = await res.json();
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-400">Belum ada data jarak fleet.</td></tr>';
                return;
            }

            let currentTanggal = null;
            let rowsHtml = '';
            data.forEach(row => {
                const tanggalFormatted = new Date(row.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

                // Tambahkan header tanggal jika tanggalnya berbeda dari baris sebelumnya
                if (row.tanggal !== currentTanggal) {
                    rowsHtml += `<tr class="bg-gray-800 font-bold"><td class="p-2" colspan="5">${tanggalFormatted}</td></tr>`;
                    currentTanggal = row.tanggal;
                }

                rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50">
                    <td></td>
                    <td class="p-3">${row.nama_fleet}</td>
                    <td class="p-3 text-right font-bold text-yellow-400">${formatNumber(row.volume_bcm)}</td>
                    <td class="p-3 text-right">${formatNumber(row.jarak_meter, 0)}</td>
                    <td class="p-3 text-center">
                        <button data-id="${row.id}" class="delete-btn text-red-500 hover:text-red-400">Hapus</button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = rowsHtml;
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-400">Error: ${error.message}</td></tr>`;
        } finally {
            loader.style.display = 'none';
        }
    }

    // Event listener untuk tombol hapus
    document.getElementById('data-body').addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (confirm(`Anda yakin ingin menghapus data ini?`)) {
                try {
                    const res = await fetch('/api/delete-jarak-fleet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                    const result = await res.json();
                    if (!result.success) throw new Error(result.error);
                    showNotification(result.message, 'green');
                    loadJarakData(); // Muat ulang data setelah berhasil dihapus
                } catch (error) {
                    showNotification(`Gagal menghapus: ${error.message}`, 'red');
                }
            }
        }
    });

    // Eksekusi awal
    loadJarakData();
});