document.addEventListener('DOMContentLoaded', () => {
    const loaderWrapper = document.getElementById('loader-wrapper');
    const mainContent = document.getElementById('main-content');
    
    // Variabel untuk menyimpan instance chart agar bisa di-destroy
    let costChart, trendChart, targetChart;

    // Ambil fungsi formatting dari common.js, atau definisikan di sini jika perlu
    const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
    const formatNumber = (value, decimals = 2) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: decimals }).format(value || 0);

    async function loadAndRender(params = {}) {
        loaderWrapper.style.display = 'flex';
        mainContent.style.display = 'none';

        // Hancurkan chart lama sebelum memuat data baru untuk mencegah bug
        if (costChart) costChart.destroy();
        if (trendChart) trendChart.destroy();
        if (targetChart) targetChart.destroy();

        const url = new URL('/api/dashboard-data', window.location.origin);
        if (params.startDate) url.searchParams.append('startDate', params.startDate);
        if (params.endDate) url.searchParams.append('endDate', params.endDate);
        
        try {
            const res = await fetch(url);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Gagal mengambil data dari server');
            }
            const data = await res.json();
            
            renderKPIs(data.cumulativeBpp);
            renderCostCompositionChart(data.costComposition);
            renderBppTrendChart(data.bppTrend);
            renderProductionTargetChart(data.productionVsTarget);
            
            mainContent.style.display = 'block';
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showNotification(`Error: ${error.message}`, 'red');
            mainContent.style.display = 'none';
        } finally {
            loaderWrapper.style.display = 'none';
        }
    }

    function renderKPIs(cumulativeBppData) {
        const kpiContainer = document.getElementById('kpi-container');
        if (!kpiContainer) return;
        
        kpiContainer.innerHTML = `
            <div class="kpi-box">
                <p class="kpi-title">BPP Produksi (Kumulatif)</p>
                <p class="kpi-value">${formatCurrency(cumulativeBppData.produksi)}</p>
            </div>
            <div class="kpi-box">
                <p class="kpi-title">BPP Hauling (Kumulatif)</p>
                <p class="kpi-value">${formatCurrency(cumulativeBppData.hauling)}</p>
            </div>
            <div class="kpi-box">
                <p class="kpi-title">BPP Penjualan (Kumulatif)</p>
                <p class="kpi-value">${formatCurrency(cumulativeBppData.penjualan)}</p>
            </div>
        `;
    }

    function renderCostCompositionChart(costData) {
        const ctx = document.getElementById('costCompositionChart').getContext('2d');
        const labels = Object.keys(costData).map(k => k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' '));
        const values = Object.values(costData);

        costChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Komposisi Biaya',
                    data: values,
                    backgroundColor: ['#ef4444', '#3b82f6', '#f97316', '#a855f7', '#d97706', '#22c55e'],
                    borderColor: '#1f2937',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: 'white', font: { size: 12 }}},
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatCurrency(ctx.parsed)}` }}
                }
            }
        });
    }

    function renderBppTrendChart(trendData) {
        const ctx = document.getElementById('bppTrendChart').getContext('2d');
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.map(d => d.tanggal),
                datasets: [
                    { label: 'BPP Produksi', data: trendData.map(d => d.bpp_produksi), borderColor: '#34d399', backgroundColor: '#34d399', tension: 0.1, fill: false },
                    { label: 'BPP Hauling', data: trendData.map(d => d.bpp_hauling), borderColor: '#60a5fa', backgroundColor: '#60a5fa', tension: 0.1, fill: false },
                    { label: 'BPP Penjualan', data: trendData.map(d => d.bpp_penjualan), borderColor: '#f87171', backgroundColor: '#f87171', tension: 0.1, fill: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                },
                plugins: { legend: { labels: { color: 'white' } } }
            }
        });
    }

    function renderProductionTargetChart(targetData) {
        const ctx = document.getElementById('productionTargetChart').getContext('2d');
        targetChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Overburden (BCM)', 'Coal (Ton)'],
                datasets: [
                    { 
                        label: 'Realisasi', 
                        data: [targetData.realisasi.ob, targetData.realisasi.coal],
                        backgroundColor: '#22c55e'
                    },
                    { 
                        label: 'Target', 
                        data: [targetData.target.ob, targetData.target.coal],
                        backgroundColor: '#4b5563'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                },
                plugins: { 
                    legend: { labels: { color: 'white' } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.raw, 0)}`
                        }
                    }
                }
            }
        });
    }
    
    document.getElementById('filterButton').addEventListener('click', () => {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        if (!startDate || !endDate) {
            showNotification('Silakan pilih tanggal mulai dan akhir', 'yellow');
            return;
        }
        loadAndRender({ startDate, endDate });
    });

    document.getElementById('resetButton').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        loadAndRender();
    });

    // GANTI BLOK KODE LAMA DI BAGIAN BAWAH dashboard.js DENGAN INI:

// Set tanggal default ke bulan berjalan
const today = new Date();
const year = today.getFullYear();
const month = today.getMonth(); // 0-11

const firstDay = new Date(year, month, 1);
const lastDay = new Date(year, month + 1, 0);

// Mengonversi ke string YYYY-MM-DD secara manual untuk menghindari masalah zona waktu
const pad = (num) => num.toString().padStart(2, '0');

const firstDayString = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
const lastDayString = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;

document.getElementById('startDate').value = firstDayString;
document.getElementById('endDate').value = lastDayString;

loadAndRender({
    startDate: firstDayString,
    endDate: lastDayString
});
});