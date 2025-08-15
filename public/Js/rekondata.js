document.addEventListener('DOMContentLoaded', () => {
    
    async function loadRekonData() {
        const tbody = document.getElementById('data-body');
        const loader = document.getElementById('loader-container');
        tbody.innerHTML = '';
        loader.style.display = 'block';

        try {
            const res = await fetch('/api/rekon-data');
            if (!res.ok) throw new Error(`Gagal mengambil data: ${res.statusText}`);
            const data = await res.json();
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-400">Belum ada data rekonsiliasi.</td></tr>';
                return;
            }

            let rowsHtml = '';
            data.forEach(row => {
                rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800">
                    <td class="p-3">${new Date(row.start_date + 'T00:00:00').toLocaleDateString('id-ID')}</td>
                    <td class="p-3">${new Date(row.end_date + 'T00:00:00').toLocaleDateString('id-ID')}</td>
                    <td class="p-3 text-right font-bold text-yellow-400">${formatNumber(row.volume_ob_survey)}</td>
                    <td class="p-3 text-right font-bold text-yellow-400">${formatNumber(row.volume_coal_survey)}</td>
                    <td class="p-3 text-center">
                        <a href="InputRekon.html?id=${row.id}" class="text-blue-400 hover:text-blue-300 mr-4">Edit</a>
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
            if (confirm(`Anda yakin ingin menghapus data rekonsiliasi ini? Tindakan ini tidak dapat dibatalkan.`)) {
                try {
                    const res = await fetch('/api/delete-rekon', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                    const result = await res.json();
                    if (!result.success) throw new Error(result.error);
                    showNotification(result.message, 'green');
                    loadRekonData(); // Muat ulang data setelah berhasil dihapus
                } catch (error) {
                    showNotification(`Gagal menghapus: ${error.message}`, 'red');
                }
            }
        }
    });

    // Eksekusi awal
    loadRekonData();
});