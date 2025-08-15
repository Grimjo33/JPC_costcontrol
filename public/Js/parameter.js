document.addEventListener('DOMContentLoaded', () => {
    // Definisi parameter yang akan ditampilkan di UI
    const generalParamsConfig = {
        'harga_fuel': { label: 'Harga Solar', unit: 'Rp/Liter' },
        'biaya_penggalian_ob': { label: 'Biaya Penggalian OB', unit: 'Rp/BCM' },
        'biaya_penggalian_coal': { label: 'Biaya Penggalian Coal', unit: 'Rp/Ton' },
        'biaya_penggalian_mud': { label: 'Biaya Penggalian Mud', unit: 'Rp/BCM' },
        'batas_jarak_normal_ob': { label: 'Batas Jarak Normal OB', unit: 'meter' },
        'biaya_overdistance_ob': { label: 'Biaya Overdistance OB', unit: 'Rp/BCM/km' },
        'batas_jarak_normal_coal': { label: 'Batas Jarak Normal Coal', unit: 'meter' },
        'biaya_overdistance_coal': { label: 'Biaya Overdistance Coal', unit: 'Rp/Ton/km' },
        'biaya_penyediaan_lahan_total': { label: 'Total Biaya Penyediaan Lahan', unit: 'Rp' },
        'umur_pakai_lahan': { label: 'Umur Pakai Lahan', unit: 'Bulan' },
        'biaya_fee_lahan_coal': { label: 'Biaya Fee Lahan Coal', unit: 'Rp/Ton' },
        'biaya_ppm': { label: 'Biaya PPM', unit: 'Rp/Bulan' },
        'harga_batu_belah': { label: 'Harga Batu Belah', unit: 'Rp/Ton' },
        'harga_batu_split': { label: 'Harga Batu Split', unit: 'Rp/Ton' },
        'harga_sirtu': { label: 'Harga Sirtu', unit: 'Rp/Ton' },
    };
    
    // Daftar alat umum (termasuk Sarana)
    const heavyEquipmentList = ["Exca20-01", "Exca20-02", "Exca20-07", "Exca20-09", "Exca7-1", "Exca330-1", "Grader-1", "Compact-1", "Genset-1", "LV01", "LV02", "LV03", "LV04"];
    
    // Daftar alat dengan parameter biaya khusus
    const specialEquipmentParams = {
        'harga_lumpsum_dnd200': { label: 'Harga Lumpsum DND 200 (per Bulan)' },
        'harga_alat_screening': { label: 'Total Harga Alat Screening' },
        'masa_pakai_alat_screening': { label: 'Masa Pakai Alat Screening (Hari)' },
    };

    // Alat dengan skema biaya bertingkat
    const tieredEquipmentList = ["DND 150"];

    // Daftar baru untuk Standar BPP
    const targetBppConfig = {
        'target_bpp_penambangan': { label: 'Target BPP Penambangan' },
        'target_bpp_dewatering': { label: 'Target BPP Dewatering' },
        'target_bpp_stockpile': { label: 'Target BPP Stockpile' },
        'target_bpp_screening': { label: 'Target BPP Screening' },
        'target_bpp_hauling_road': { label: 'Target BPP Hauling Road' },
        'target_bpp_ppm': { label: 'Target BPP PPM' },
    };

    function createParamInput(key, config, value) {
        return `<div><label class="block text-sm text-gray-400">${config.label}</label><div class="flex items-center mt-1"><input type="number" step="any" data-key="${key}" value="${value || 0}" class="w-full p-2 bg-gray-800 text-white rounded-l border border-gray-600"><span class="bg-gray-700 p-2 rounded-r border border-l-0 border-gray-600 text-xs">${config.unit}</span></div></div>`;
    }
    
    async function loadParameters() {
        const loader = document.getElementById('loader');
        const paramsForm = document.getElementById('paramsForm');
        
        loader.style.display = 'block';
        paramsForm.style.display = 'none';
        try {
            const res = await fetch('/api/parameters');
            if (!res.ok) throw new Error('Gagal mengambil data parameter dari server');
            const data = await res.json();
            
            const generalContainer = document.getElementById('general-params-container');
            const heavyContainer = document.getElementById('heavy-equipment-params-container');
            const specialContainer = document.getElementById('special-equipment-params-container');
            const targetBppContainer = document.getElementById('target-bpp-container');

            if (!generalContainer || !heavyContainer || !specialContainer || !targetBppContainer) {
                throw new Error("Elemen HTML untuk parameter tidak ditemukan.");
            }

            generalContainer.innerHTML = '';
            heavyContainer.innerHTML = '';
            specialContainer.innerHTML = '';
            targetBppContainer.innerHTML = '';

            const existingGeneral = Object.fromEntries(data.general.map(p => [p.param_key, p.param_value]));
            
            Object.keys(generalParamsConfig).forEach(key => {
                const config = generalParamsConfig[key];
                const value = existingGeneral[key] || 0;
                generalContainer.innerHTML += createParamInput(key, config, value);
            });
            
            heavyEquipmentList.forEach(alat => {
                const existing = data.equipment.find(e => e.alat_nama === alat);
                heavyContainer.innerHTML += `<tr class="border-b border-gray-700" data-alat="${alat}"><td class="py-2 font-medium">${alat}</td><td><input type="number" step="any" data-field="biaya_rental" value="${existing?.biaya_rental || 0}" class="w-full p-2 bg-gray-800 text-white rounded"></td></tr>`;
            });
            
            Object.keys(specialEquipmentParams).forEach(key => {
                const config = specialEquipmentParams[key];
                const value = existingGeneral[key] || 0;
                specialContainer.innerHTML += `<tr class="border-b border-gray-700"><td class="py-2 font-medium">${config.label}</td><td><input type="number" step="any" data-key="${key}" value="${value}" class="w-full p-2 bg-gray-800 text-white rounded"></td></tr>`;
            });
            
            tieredEquipmentList.forEach(alat => {
                const existing = data.equipment.find(e => e.alat_nama === alat);
                specialContainer.innerHTML += `
                    <tr class="border-t-2 border-gray-600 bg-gray-800/20" data-alat-tiered="${alat}">
                        <td class="py-2 font-medium">${alat}</td>
                        <td class="p-2 space-y-2">
                            <div><label class="text-xs text-gray-400">Batas Jam Normal (per Bulan)</label><input type="number" step="any" data-field="non_charge_hours_limit" value="${existing?.non_charge_hours_limit || 400}" class="w-full p-2 bg-gray-700 text-white rounded"></div>
                            <div><label class="text-xs text-gray-400">Harga Jam Normal (per Jam)</label><input type="number" step="any" data-field="biaya_rental" value="${existing?.biaya_rental || 0}" class="w-full p-2 bg-gray-700 text-white rounded"></div>
                            <div><label class="text-xs text-gray-400">Harga Jam Overcharge (per Jam)</label><input type="number" step="any" data-field="overcharge_price" value="${existing?.overcharge_price || 0}" class="w-full p-2 bg-gray-700 text-white rounded"></div>
                        </td>
                    </tr>
                `;
            });

            Object.keys(targetBppConfig).forEach(key => {
                const config = targetBppConfig[key];
                const value = existingGeneral[key] || 0;
                targetBppContainer.innerHTML += `
                    <div class="flex items-center">
                        <label class="w-1/2 text-sm text-gray-400">${config.label}</label>
                        <input type="number" step="any" data-key="${key}" value="${value}" class="w-1/2 p-2 bg-gray-800 text-white rounded border border-gray-600">
                    </div>
                `;
            });

            loader.style.display = 'none';
            paramsForm.style.display = 'block';
        } catch (error) {
            loader.innerText = `Gagal memuat parameter: ${error.message}`;
            console.error(error);
        }
    }

    document.getElementById('paramsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = document.getElementById('submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';

        const general = [];
        document.querySelectorAll('#general-params-container input, #special-equipment-params-container input[data-key], #target-bpp-container input').forEach(input => {
            general.push({ param_key: input.dataset.key, param_value: input.value });
        });
        
        const equipment = [];
        document.querySelectorAll('#heavy-equipment-params-container tr').forEach(row => {
            equipment.push({ 
                alat_nama: row.dataset.alat, 
                category: "heavy",
                biaya_rental: row.querySelector('input[data-field="biaya_rental"]').value || 0,
                non_charge_hours_limit: null, 
                overcharge_price: null
            });
        });
        document.querySelectorAll('#special-equipment-params-container tr[data-alat-tiered]').forEach(row => {
            equipment.push({
                alat_nama: row.dataset.alatTiered, 
                category: "dewatering",
                biaya_rental: row.querySelector('input[data-field="biaya_rental"]').value || 0,
                non_charge_hours_limit: row.querySelector('input[data-field="non_charge_hours_limit"]').value || 0,
                overcharge_price: row.querySelector('input[data-field="overcharge_price"]').value || 0
            });
        });
        
        const payload = { general, equipment };
        
        try {
            const res = await fetch('/api/parameters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error('Gagal menyimpan perubahan ke server.');
            showNotification('Parameter berhasil disimpan!', 'green');
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'red');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Simpan Semua Perubahan';
        }
    });

    document.getElementById('recalcButton').addEventListener('click', async () => {
        const startDate = document.getElementById('recalcStartDate').value;
        const endDate = document.getElementById('recalcEndDate').value;
        if (!startDate || !endDate) {
            showNotification('Silakan pilih tanggal mulai dan akhir.', 'yellow');
            return;
        }
        if (confirm(`Anda yakin ingin menghitung ulang biaya dari ${startDate} hingga ${endDate} dengan parameter yang tersimpan saat ini?\nProses ini akan menimpa data biaya dan tidak bisa dibatalkan.`)) {
            const button = document.getElementById('recalcButton');
            button.disabled = true;
            button.textContent = 'Memproses...';
            try {
                const res = await fetch('/recalculate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ startDate, endDate })
                });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.error || 'Terjadi kesalahan di server.');
                showNotification(result.message, 'green');
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'red');
            } finally {
                button.disabled = false;
                button.textContent = 'Rekalkulasi Periode';
            }
        }
    });

    loadParameters();
});
