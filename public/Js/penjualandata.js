document.addEventListener('DOMContentLoaded', () => {
    let currentData = [];

    async function populateFilters() {
        try {
            const res = await fetch('/api/penjualan-buyers');
            if (!res.ok) throw new Error('Gagal memuat data filter buyer');
            const buyers = await res.json();
            const buyerSelect = document.getElementById('buyerFilter');
            buyers.forEach(b => {
                const option = document.createElement('option');
                option.value = b;
                option.textContent = b;
                buyerSelect.appendChild(option);
            });
        } catch (error) { console.error(error); }
    }

    async function loadPenjualanData(params = {}) {
        const tbody = document.getElementById('data-body');
        const loader = document.getElementById('loader-container');
        tbody.innerHTML = '';
        loader.style.display = 'block';

        const url = new URL('/penjualan-data', window.location.origin);
        Object.keys(params).forEach(key => {
            if (params[key]) url.searchParams.append(key, params[key]);
        });

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Gagal mengambil data: ${res.statusText}`);
            const data = await res.json();
            currentData = data;

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-gray-400">Tidak ada data.</td></tr>';
                document.getElementById('totalTonase').textContent = '0';
                return;
            }

            let rowsHtml = '';
            let totalTonase = 0;
            data.forEach(row => {
                rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800">
                    <td class="p-3">${new Date(row.tanggal_penjualan + 'T00:00:00').toLocaleDateString('id-ID')}</td>
                    <td class="p-3">${row.tipe_dokumen}</td>
                    <td class="p-3">${row.nomor_dokumen}</td>
                    <td class="p-3">${row.buyer || ''}</td>
                    <td class="p-3 text-right font-bold text-yellow-400">${formatNumber(row.tonase_penjualan)}</td>
                    <td class="p-3">${row.notes || ''}</td>
                    <td class="p-3 text-center whitespace-nowrap">
                        <button data-id="${row.id}" class="delete-btn text-red-500 hover:text-red-400 text-sm font-medium">Hapus</button>
                    </td>
                </tr>`;
                totalTonase += row.tonase_penjualan || 0;
            });
            tbody.innerHTML = rowsHtml;
            document.getElementById('totalTonase').textContent = formatNumber(totalTonase);
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-400">Error: ${error.message}</td></tr>`;
        } finally {
            loader.style.display = 'none';
        }
    }

    function exportToCsv() {
        if (currentData.length === 0) return alert("Tidak ada data untuk diekspor.");
        const headers = Object.keys(currentData[0]);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\r\n";
        currentData.forEach(row => {
            const values = headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`);
            csvContent += values.join(",") + "\r\n";
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "laporan_penjualan.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Event listener untuk tombol hapus
    document.getElementById('data-body').addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (confirm(`Anda yakin ingin menghapus data penjualan ini?`)) {
                try {
                    const res = await fetch(`/api/delete-penjualan/${id}`, { method: 'POST' });
                    const result = await res.json();
                    if (!result.success) throw new Error(result.error);
                    showNotification(result.message, 'green');
                    loadPenjualanData(); // Muat ulang data setelah berhasil dihapus
                } catch (error) {
                    showNotification(`Gagal menghapus: ${error.message}`, 'red');
                }
            }
        }
    });
    
    // Event listener untuk filter dan export
    populateFilters();
    loadPenjualanData();
    
    document.getElementById('filterButton').addEventListener('click', () => {
        const params = {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            buyer: document.getElementById('buyerFilter').value,
        };
        loadPenjualanData(params);
    });
    
    document.getElementById('resetButton').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('buyerFilter').value = '';
        loadPenjualanData();
    });

    document.getElementById('export-btn').addEventListener('click', exportToCsv);
});