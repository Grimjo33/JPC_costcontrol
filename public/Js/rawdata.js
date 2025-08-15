document.addEventListener('DOMContentLoaded', () => {
    let currentData = [];
    
    // Cache elemen DOM
    const categoryFilter = document.getElementById('categoryFilter');
    const alatFilter = document.getElementById('alatFilter');
    
    async function populateAlatFilter() {
        try {
            const res = await fetch('/api/alat');
            if (!res.ok) throw new Error('Gagal memuat daftar alat');
            const alatList = await res.json();
            alatFilter.innerHTML = '<option value="">Semua Alat & Sarana</option>';
            alatList.forEach(alat => {
                const option = document.createElement('option');
                option.value = alat;
                option.textContent = alat;
                alatFilter.appendChild(option);
            });
        } catch (error) {
            console.error(error);
        }
    }

    async function loadRawData(params = {}) {
      const tbody = document.getElementById('data-body');
      const loader = document.getElementById('loader-container');
      const selectedCategory = params.category || "";
      
      tbody.innerHTML = '';
      loader.style.display = 'block';

      const url = new URL('/data', window.location.origin);
      // Kirim filter tanggal dan alat ke backend
      if (params.startDate) url.searchParams.append('startDate', params.startDate);
      if (params.endDate) url.searchParams.append('endDate', params.endDate);
      if (params.alat) url.searchParams.append('alat', params.alat);

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server Error: ${res.statusText}`);
        const dataPerTanggal = await res.json();
        
        currentData = dataPerTanggal;

        if (dataPerTanggal.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-gray-400">Tidak ada data untuk ditampilkan.</td></tr>';
            return;
        }

        let rowsHtml = '';
        dataPerTanggal.forEach(dayData => {
            const tanggal = new Date(dayData.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            
            rowsHtml += `<tr class="bg-gray-800 font-bold"><td class="p-3" colspan="8">${tanggal}</td><td class="p-3 text-right"><a href="EditData.html?tanggal=${dayData.tanggal}" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-xs no-underline">Detail / Edit</a></td></tr>`;
            
            // Logika Tampilan Kondisional berdasarkan Kategori
            
            if (selectedCategory === "" || selectedCategory === "penambangan") {
                rowsHtml += `<tr class="bg-gray-700/50 text-gray-300 text-xs font-semibold"><td colspan="9" class="p-2 font-bold text-base text-white">1. Penambangan</td></tr>`;
                rowsHtml += `<tr class="bg-gray-700/50 text-gray-300 text-xs"><td class="p-2"></td><td class="p-2" colspan="2">Item</td><td class="p-2 text-right">Volume TC</td><td class="p-2 text-right">Volume Rekon</td><td class="p-2 text-right">Ritase</td><td class="p-2 text-right">Jarak (m)</td><td></td><td class="p-2 text-right">Biaya</td></tr>`;
                const obRekonInfo = dayData.ob_rekon > 0 ? `${formatNumber(dayData.ob_rekon, 1)} BCM` : '-';
                rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2 text-green-400" colspan="2">OB Removal</td><td class="p-2 text-right">${formatNumber(dayData.ob_removal_tc, 1)} BCM</td><td class="p-2 text-right text-cyan-400 font-semibold">${obRekonInfo}</td><td class="p-2 text-right">${formatNumber(dayData.ritase_ob, 0)}</td><td class="p-2 text-right">${formatNumber(dayData.jarak_ob, 0)}</td><td></td><td class="p-2 text-right">${formatCurrency(dayData.biaya_ob_harian)}</td></tr>`;
                if (dayData.biaya_overdistance_ob > 0) { const jarakLebihInfo = `(Kelebihan ${formatNumber(dayData.jarak_lebih_ob, 0)} m)`; rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2 text-orange-400" colspan="7">↳ Overdistance OB ${jarakLebihInfo}</td><td class="p-2 text-right">${formatCurrency(dayData.biaya_overdistance_ob)}</td></tr>`; }
                const coalRekonInfo = dayData.coal_rekon > 0 ? `${formatNumber(dayData.coal_rekon, 1)} Ton` : '-';
                rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2 text-green-400" colspan="2">Coal Getting</td><td class="p-2 text-right">${formatNumber(dayData.coal_getting_tc, 1)} Ton</td><td class="p-2 text-right text-cyan-400 font-semibold">${coalRekonInfo}</td><td class="p-2 text-right">${formatNumber(dayData.ritase_coal, 0)}</td><td class="p-2 text-right">${formatNumber(dayData.jarak_coal, 0)}</td><td></td><td class="p-2 text-right">${formatCurrency(dayData.biaya_coal_harian)}</td></tr>`;
                if (dayData.biaya_overdistance_coal > 0) { const jarakLebihInfoCoal = `(Kelebihan ${formatNumber(dayData.jarak_lebih_coal, 0)} m)`; rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2 text-orange-400" colspan="7">↳ Overdistance Coal ${jarakLebihInfoCoal}</td><td class="p-2 text-right">${formatCurrency(dayData.biaya_overdistance_coal)}</td></tr>`; }
            }

            const hasMaterial = dayData.tonase_batu_belah > 0 || dayData.tonase_batu_split > 0 || dayData.tonase_sirtu > 0;
            if ((selectedCategory === "" || selectedCategory === "material") && hasMaterial) {
                rowsHtml += `<tr class="bg-gray-700/50 text-gray-300 text-xs font-semibold"><td colspan="9" class="p-2 font-bold text-base text-white">2. Jenis Material</td></tr>`;
                rowsHtml += `<tr class="bg-gray-700/50 text-gray-300 text-xs"><td class="p-2"></td><td class="p-2" colspan="2">Item</td><td class="p-2" colspan="2">Tujuan</td><td class="p-2 text-right">Tonase</td><td colspan="2">-</td><td class="p-2 text-right">Biaya</td></tr>`;
                if (dayData.tonase_batu_belah > 0) { rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2" colspan="2">Batu Belah</td><td class="p-2" colspan="2">Hauling Road</td><td class="p-2 text-right">${formatNumber(dayData.tonase_batu_belah, 1)} Ton</td><td colspan="2">-</td><td class="p-2 text-right">${formatCurrency(dayData.biaya_batu_belah)}</td></tr>`; }
                if (dayData.tonase_batu_split > 0) { rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2" colspan="2">Batu Split</td><td class="p-2" colspan="2">Hauling Road</td><td class="p-2 text-right">${formatNumber(dayData.tonase_batu_split, 1)} Ton</td><td colspan="2">-</td><td class="p-2 text-right">${formatCurrency(dayData.biaya_batu_split)}</td></tr>`; }
                if (dayData.tonase_sirtu > 0) { rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2" colspan="2">Sirtu</td><td class="p-2" colspan="2">Hauling Road</td><td class="p-2 text-right">${formatNumber(dayData.tonase_sirtu, 1)} Ton</td><td colspan="2">-</td><td class="p-2 text-right">${formatCurrency(dayData.biaya_sirtu)}</td></tr>`; }
            }

            const alatList = dayData.alat || [];
            const alatBerat = alatList.filter(a => a.tujuan !== 'Sarana');
            const sarana = alatList.filter(a => a.tujuan === 'Sarana');

            if ((selectedCategory === "" || selectedCategory === "alat") && alatBerat.length > 0) {
                rowsHtml += `<tr class="bg-gray-700/50 text-gray-300 text-xs font-semibold"><td colspan="9" class="p-2 font-bold text-base text-white">3. Nama Alat</td></tr>`;
                rowsHtml += `<tr class="bg-gray-700/50 text-gray-300 text-xs"><td class="p-2"></td><td class="p-2">Item</td><td class="p-2">Tujuan</td><td colspan="2">-</td><td class="p-2 text-right">Jam Operasi</td><td class="p-2 text-right">Fuel Guna</td><td class="p-2 text-right">Fuel Isi</td><td class="p-2 text-right">Biaya</td></tr>`;
                alatBerat.forEach(alat => {
                    rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2">${alat.alat}</td><td class="p-2">${alat.tujuan}</td><td colspan="2">-</td><td class="p-2 text-right">${formatNumber(alat.jam_operasi, 1)}</td><td class="p-2 text-right">${formatNumber(alat.fuel_penggunaan, 1)}</td><td class="p-2 text-right">${formatNumber(alat.fuel_pengisian, 1)}</td><td class="p-2 text-right text-yellow-400">${formatCurrency(alat.total_biaya)}</td></tr>`;
                });
            }
            
            if ((selectedCategory === "" || selectedCategory === "sarana") && sarana.length > 0) {
                rowsHtml += `<tr class="bg-gray-700/50 text-gray-300 text-xs font-semibold"><td colspan="9" class="p-2 font-bold text-base text-white">4. Nama Sarana</td></tr>`;
                rowsHtml += `<tr class="bg-gray-700/50 text-gray-300 text-xs"><td class="p-2"></td><td class="p-2" colspan="2">Item</td><td class="p-2 text-right">Jarak (km)</td><td></td><td class="p-2 text-right">Fuel/km</td><td class="p-2 text-right">Fuel Guna</td><td class="p-2 text-right">Fuel Isi</td><td class="p-2 text-right">Biaya</td></tr>`;
                sarana.forEach(alat => {
                    const fuelPerKm = (alat.jarak_km > 0 && alat.fuel_penggunaan > 0) ? formatNumber(alat.fuel_penggunaan / alat.jarak_km, 2) : '-';
                    rowsHtml += `<tr class="border-b border-gray-700 hover:bg-gray-800/50"><td></td><td class="p-2" colspan="2">${alat.alat}</td><td class="p-2 text-right">${formatNumber(alat.jarak_km, 1)}</td><td></td><td class="p-2 text-right">${fuelPerKm}</td><td class="p-2 text-right">${formatNumber(alat.fuel_penggunaan, 1)}</td><td class="p-2 text-right">${formatNumber(alat.fuel_pengisian, 1)}</td><td class="p-2 text-right text-yellow-400">${formatCurrency(alat.total_biaya)}</td></tr>`;
                });
            }
            
            if (selectedCategory === "") {
                rowsHtml += `<tr class="bg-gray-700/80 font-bold border-b-2 border-gray-600"><td class="p-2" colspan="8">Total Biaya Harian</td><td class="p-2 text-right text-red-400">${formatCurrency(dayData.total_biaya_per_tanggal)}</td></tr>`;
            }
        });
        
        tbody.innerHTML = rowsHtml;
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-red-400">Error: ${error.message}</td></tr>`;
      } finally {
        loader.style.display = 'none';
      }
    }
    
    // Ganti fungsi exportToCsv di rawdata.js dengan kode ini

function exportToCsv() {
    if (currentData.length === 0) {
        showNotification("Tidak ada data untuk diekspor.", "yellow");
        return;
    }

    const headers = [
        "Tanggal",
        "Kategori",
        "Item",
        "Tujuan",
        "Volume TC",
        "Volume Rekon",
        "Ritase",
        "Jarak (m)",
        "Jam Operasi",
        "Fuel Guna (Ltr)",
        "Fuel Isi (Ltr)",
        "Jarak Sarana (km)",
        "Total Biaya (Rp)"
    ];

    const rows = [];
    rows.push(headers.join(','));

    // Fungsi helper untuk membersihkan data untuk CSV
    const escapeCsvCell = (cell) => {
        if (cell === null || cell === undefined) {
            return '';
        }
        const cellString = String(cell);
        // Jika mengandung koma, kutip dua, atau baris baru, bungkus dengan kutip dua
        if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
            return `"${cellString.replace(/"/g, '""')}"`;
        }
        return cellString;
    };

    currentData.forEach(day => {
        const tanggal = day.tanggal;

        // Penambangan OB
        rows.push([
            tanggal, "Penambangan", "OB Removal", "-",
            day.ob_removal_tc, day.ob_rekon, day.ritase_ob, day.jarak_ob,
            "-", "-", "-", "-", day.biaya_ob_harian + day.biaya_overdistance_ob
        ].map(escapeCsvCell).join(','));
        
        // Penambangan Coal
        rows.push([
            tanggal, "Penambangan", "Coal Getting", "-",
            day.coal_getting_tc, day.coal_rekon, day.ritase_coal, day.jarak_coal,
            "-", "-", "-", "-", day.biaya_coal_harian + day.biaya_overdistance_coal
        ].map(escapeCsvCell).join(','));

        // Materials
        if (day.tonase_batu_belah > 0) rows.push([tanggal, "Material", "Batu Belah", "Hauling Road", day.tonase_batu_belah, "-", "-", "-", "-", "-", "-", "-", day.biaya_batu_belah].map(escapeCsvCell).join(','));
        if (day.tonase_batu_split > 0) rows.push([tanggal, "Material", "Batu Split", "Hauling Road", day.tonase_batu_split, "-", "-", "-", "-", "-", "-", "-", day.biaya_batu_split].map(escapeCsvCell).join(','));
        if (day.tonase_sirtu > 0) rows.push([tanggal, "Material", "Sirtu", "Hauling Road", day.tonase_sirtu, "-", "-", "-", "-", "-", "-", "-", day.biaya_sirtu].map(escapeCsvCell).join(','));
        
        // Alat Berat & Sarana
        (day.alat || []).forEach(alat => {
            rows.push([
                tanggal,
                (alat.tujuan === 'Sarana' ? 'Sarana' : 'Alat Berat'),
                alat.alat,
                alat.tujuan,
                "-", "-", "-", "-",
                alat.jam_operasi,
                alat.fuel_penggunaan,
                alat.fuel_pengisian,
                alat.jarak_km,
                alat.total_biaya
            ].map(escapeCsvCell).join(','));
        });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "raw_data_produksi.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    showNotification("Ekspor CSV berhasil dibuat.", "green");
}
    
    // --- EVENT LISTENERS BARU ---
    categoryFilter.addEventListener('change', (e) => {
        const selectedCategory = e.target.value;
        if (selectedCategory === 'alat' || selectedCategory === 'sarana') {
            alatFilter.disabled = false;
            alatFilter.innerHTML = '<option value="">Semua di Kategori Ini</option>';
            // Anda bisa membuat API baru untuk mengisi alat/sarana saja, atau biarkan seperti ini
            populateAlatFilter(); // Panggil lagi untuk mengisi ulang
        } else {
            alatFilter.disabled = true;
            alatFilter.value = '';
        }
    });

    document.getElementById('filterButton').addEventListener('click', () => {
        const params = {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            category: categoryFilter.value,
            alat: alatFilter.disabled ? '' : alatFilter.value
        };
        loadRawData(params);
    });
    
    document.getElementById('resetButton').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        categoryFilter.value = '';
        alatFilter.value = '';
        alatFilter.disabled = true;
        loadRawData();
    });

    document.getElementById('export-btn').addEventListener('click', exportToCsv);

    // Eksekusi awal
    populateAlatFilter();
    loadRawData();
});