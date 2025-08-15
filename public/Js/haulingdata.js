document.addEventListener('DOMContentLoaded', () => {
    let currentDataForExport = [];
    let currentPage = 1;
    let limit = 50;
    // formatNumber sudah ada di common.js

    async function populateFilters() {
        try {
            const [buyersRes, termsRes] = await Promise.all([
                fetch('/api/trucking-customers'),
                fetch('/api/trade-terms')
            ]);
            const buyers = await buyersRes.json();
            const terms = await termsRes.json();
            
            const buyerSelect = document.getElementById('buyerFilter');
            buyers.forEach(b => { const option = document.createElement('option'); option.value = b; option.textContent = b; buyerSelect.appendChild(option); });
            
            const termSelect = document.getElementById('tradeTermFilter');
            terms.forEach(t => { const option = document.createElement('option'); option.value = t; option.textContent = t; termSelect.appendChild(option); });
        } catch (error) { console.error(error); }
    }

    async function loadHaulingData(page = 1) {
        currentPage = page;
        const loader = document.getElementById('loader-container');
        const tbody = document.getElementById('data-body');
        tbody.innerHTML = '';
        loader.style.display = 'block';

        const params = {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            buyer: document.getElementById('buyerFilter').value,
            tradeTerm: document.getElementById('tradeTermFilter').value,
            page: currentPage,
            limit: limit
        };

        const url = new URL('/trucking-data', window.location.origin);
        Object.keys(params).forEach(key => { if (params[key]) url.searchParams.append(key, params[key]); });
        
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Gagal mengambil data: ${res.statusText}`);
            const { data, total } = await res.json();
            
            currentDataForExport = data;
            renderTable(data);
            renderPagination(total);
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center p-4 text-red-400">Error: ${error.message}</td></tr>`;
            renderPagination(0);
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderTable(data) {
        const tbody = document.getElementById('data-body');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center p-4 text-gray-400">Tidak ada data yang cocok.</td></tr>';
            document.getElementById('totalTonase').textContent = '0';
            return;
        }
        let rowsHtml = '', totalTonase = 0;
        data.forEach(row => {
            rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800">
                <td class="p-3">${row.date || ''}</td><td class="p-3">${row.do_number || ''}</td><td class="p-3">${row.buyer || ''}</td>
                <td class="p-3">${row.trade_term || ''}</td><td class="p-3">${row.truck_number || ''}</td><td class="p-3">${row.driver_name || ''}</td>
                <td class="p-3">${row.checkout_time || ''}</td><td class="p-3 text-right">${formatNumber(row.tare)}</td>
                <td class="p-3 text-right">${formatNumber(row.gross)}</td><td class="p-3 text-right font-bold text-yellow-400">${formatNumber(row.nett)}</td>
            </tr>`;
            totalTonase += parseFloat(row.nett) || 0;
        });
        tbody.innerHTML = rowsHtml;
        document.getElementById('totalTonase').textContent = formatNumber(totalTonase);
    }
    
    function renderPagination(totalItems) {
        const controls = document.getElementById('pagination-controls');
        if (totalItems <= 0 || limit === -1) { controls.innerHTML = `<span class="text-gray-400 text-sm">Menampilkan ${totalItems} data</span>`; return; }

        const totalPages = Math.ceil(totalItems / limit);
        controls.innerHTML = `
            <button onclick="loadHaulingData(${currentPage - 1})" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
            <span class="text-gray-400 text-sm">Halaman ${currentPage} dari ${totalPages} (${totalItems} data)</span>
            <button onclick="loadHaulingData(${currentPage + 1})" class="pagination-btn" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
        `;
        // Re-assign event listeners because innerHTML replaces them
        controls.querySelector('button:first-child').addEventListener('click', () => loadHaulingData(currentPage - 1));
        controls.querySelector('button:last-child').addEventListener('click', () => loadHaulingData(currentPage + 1));
    }

    function exportToCsv() {
        if (currentDataForExport.length === 0) return alert("Tidak ada data untuk diekspor.");
        const headers = Object.keys(currentDataForExport[0]);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\r\n";
        currentDataForExport.forEach(row => {
            const values = headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`);
            csvContent += values.join(",") + "\r\n";
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `laporan_hauling_halaman_${currentPage}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Main execution
    populateFilters();
    loadHaulingData(1);
    document.getElementById('filterButton').addEventListener('click', () => loadHaulingData(1));
    document.getElementById('resetButton').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('buyerFilter').value = '';
        document.getElementById('tradeTermFilter').value = '';
        loadHaulingData(1);
    });
    document.getElementById('limit-select').addEventListener('change', (event) => {
        limit = parseInt(event.target.value);
        loadHaulingData(1);
    });
    document.getElementById('export-btn').addEventListener('click', exportToCsv);
});