document.addEventListener('DOMContentLoaded', () => {
    const loaderWrapper = document.getElementById('loader-wrapper');
    const mainContent = document.getElementById('main-content');
    let costPieChart = null;

    async function loadReport(params = {}) {
        loaderWrapper.style.display = 'flex';
        mainContent.style.display = 'none';

        const url = new URL('/api/bpp-produksi-report', window.location.origin);
        if (params.startDate) url.searchParams.append('startDate', params.startDate);
        if (params.endDate) url.searchParams.append('endDate', params.endDate);

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Gagal mengambil data laporan');
            }
            const data = await res.json();
            
            renderSummary(data.summary);
            renderCostBreakdown(data.costBreakdown, data.summary.totalBiayaProduksi, data.summary.totalTonaseProduksi);
            // MODIFIKASI DISINI: Kirim flag isRekonDataAvailable ke fungsi render
            renderTonnageBreakdown(data.tonnageBreakdown, data.isRekonDataAvailable);
            
            mainContent.style.display = 'block';
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'red');
        } finally {
            loaderWrapper.style.display = 'none';
        }
    }

    function renderSummary(summary) {
        document.getElementById('summary-total-biaya').textContent = formatCurrency(summary.totalBiayaProduksi);
        document.getElementById('summary-total-tonase').textContent = `${formatNumber(summary.totalTonaseProduksi)} Ton`;
        document.getElementById('summary-bpp').textContent = `${formatCurrency(summary.bppProduksi)} / Ton`;
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
                    backgroundColor: ['#ef4444', '#3b82f6', '#f97316', '#a855f7', '#d97706', '#22c55e', '#f43f5e', '#8b5cf6'],
                    borderColor: '#1f2937', borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#d1d5db',
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${formatCurrency(ctx.parsed)}`
                        }
                    }
                }
            }
        };
        if (costPieChart) costPieChart.destroy();
        costPieChart = new Chart(ctx, chartConfig);
    }

    // GANTI KESELURUHAN FUNGSI DI BAWAH INI
    function renderTonnageBreakdown(tonnageData, isRekonAvailable) {
        const tableBody = document.getElementById('tonnage-breakdown-table');

        // Data Coal
        const coal = tonnageData.coal;
        const coalDeviationClass = isRekonAvailable ? (coal.deviation >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400';
        const coalDeviationSign = isRekonAvailable && coal.deviation >= 0 ? '+' : '';
        const rekonCoalText = isRekonAvailable ? `${formatNumber(coal.totalRekon)} Ton` : `<span class="text-gray-400">Belum Ada</span>`;
        const deviationCoalText = isRekonAvailable ? `${coalDeviationSign}${coal.deviation.toFixed(2)}%` : `-`;

        // Data OB
        const ob = tonnageData.ob;
        const obDeviationClass = isRekonAvailable ? (ob.deviation >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400';
        const obDeviationSign = isRekonAvailable && ob.deviation >= 0 ? '+' : '';
        const rekonOBText = isRekonAvailable ? `${formatNumber(ob.totalRekon)} BCM` : `<span class="text-gray-400">Belum Ada</span>`;
        const deviationOBText = isRekonAvailable ? `${obDeviationSign}${ob.deviation.toFixed(2)}%` : `-`;

        tableBody.innerHTML = `
            <tr class="bg-gray-800 font-semibold">
                <td class="py-2 px-2" colspan="2">Coal Getting</td>
            </tr>
            <tr class="border-b border-gray-700">
                <td class="py-2 px-2">Total Tonase (Truck Count)</td>
                <td class="py-2 px-2 text-right">${formatNumber(coal.totalTC)} Ton</td>
            </tr>
            <tr class="border-b border-gray-700 font-bold">
                <td class="py-2 px-2">Total Tonase (Survey/Rekon)</td>
                <td class="py-2 px-2 text-right">${rekonCoalText}</td>
            </tr>
            <tr class="border-b border-gray-700">
                <td class="py-2 px-2">Deviasi</td>
                <td class="py-2 px-2 text-right ${coalDeviationClass}">${deviationCoalText}</td>
            </tr>
            <tr><td class="py-2" colspan="2"></td></tr>
            <tr class="bg-gray-800 font-semibold">
                <td class="py-2 px-2" colspan="2">Overburden Removal</td>
            </tr>
            <tr class="border-b border-gray-700">
                <td class="py-2 px-2">Total Volume (Truck Count)</td>
                <td class="py-2 px-2 text-right">${formatNumber(ob.totalTC)} BCM</td>
            </tr>
            <tr class="border-b border-gray-700 font-bold">
                <td class="py-2 px-2">Total Volume (Survey/Rekon)</td>
                <td class="py-2 px-2 text-right">${rekonOBText}</td>
            </tr>
            <tr class="border-b border-gray-700">
                <td class="py-2 px-2">Deviasi</td>
                <td class="py-2 px-2 text-right ${obDeviationClass}">${deviationOBText}</td>
            </tr>
        `;
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