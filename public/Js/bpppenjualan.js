document.addEventListener('DOMContentLoaded', () => {
    const loaderWrapper = document.getElementById('loader-wrapper');
    const mainContent = document.getElementById('main-content');
    let costPieChart = null;

    async function loadReport(params = {}) {
        loaderWrapper.style.display = 'flex';
        mainContent.style.display = 'none';

        const url = new URL('/api/bpp-penjualan-report', window.location.origin);
        if (params.startDate) url.searchParams.append('startDate', params.startDate);
        if (params.endDate) url.searchParams.append('endDate', params.endDate);

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Gagal mengambil data laporan');
            }
            const data = await res.json();
            
            document.getElementById('summary-total-biaya').textContent = formatCurrency(data.summary.totalBiayaProduksi);
            document.getElementById('summary-total-tonase').textContent = `${formatNumber(data.summary.totalTonasePenjualan)} Ton`;
            document.getElementById('summary-bpp').textContent = `${formatCurrency(data.summary.bppPenjualan)} / Ton`;
            
            renderCostBreakdown(data.costBreakdown, data.summary.totalBiayaProduksi, data.summary.totalTonasePenjualan);
            
            mainContent.style.display = 'block';
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'red');
        } finally {
            loaderWrapper.style.display = 'none';
        }
    }

    function renderCostBreakdown(costData, total, totalTonase) {
        const tableBody = document.getElementById('cost-breakdown-table');
        tableBody.innerHTML = '';
        if (!costData || costData.length === 0) return;

        costData.forEach(item => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            const costPerTon = totalTonase > 0 ? item.value / totalTonase : 0;

            tableBody.innerHTML += `
                <tr class="border-b border-gray-700">
                    <td class="py-2">${item.component}</td>
                    <td class="py-2 text-right">${formatCurrency(item.value)}</td>
                    <td class="py-2 text-right text-sky-400">${formatCurrency(costPerTon)}</td>
                    <td class="py-2 text-right text-gray-400">${percentage}%</td>
                </tr>
            `;
        });

        const ctx = document.getElementById('cost-pie-chart').getContext('2d');
        const chartConfig = {
            type: 'pie',
            data: {
                labels: costData.map(d => d.component),
                datasets: [{
                    data: costData.map(d => d.value),
                    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6'],
                    borderColor: '#1f2937', borderWidth: 2,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatCurrency(ctx.parsed)}` }}
                }
            }
        };
        if (costPieChart) costPieChart.destroy();
        costPieChart = new Chart(ctx, chartConfig);
    }

    document.getElementById('filterButton').addEventListener('click', () => {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        if (!startDate || !endDate) {
            showNotification('Silakan pilih tanggal mulai dan akhir', 'yellow');
            return;
        }
        loadReport({ startDate, endDate });
    });

    document.getElementById('resetButton').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        loadReport();
    });

    loadReport();
});