document.addEventListener('DOMContentLoaded', async () => {
    const alatByCategory = { 'Dewatering': ["DND 150", "DND 200"], 'Stockpile': ["Exca20-01", "Exca20-02", "Exca20-07", "Exca20-09", "Exca7-1", "Exca330-1", "Grader-1", "Compact-1"], 'Screening': [], 'Hauling Road': ["Grader-1", "Compact-1","WaterTruck01", "WaterTruck02", "Exca20-01", "Exca20-02", "Exca20-07", "Exca20-09", "Exca7-1", "Exca330-1"], 'Sarana': ["LV01", "LV02", "LV03", "LV04", "BUS01", "Genset-1"], 'Penambangan': ["Grader-1", "Compact-1","WaterTruck01", "WaterTruck02", "Exca20-01", "Exca20-02", "Exca20-07", "Exca20-09", "Exca7-1", "Exca330-1"] };
    const saranaList = ["LV01", "LV02", "LV03", "LV04", "BUS", "Genset1", "Genset2"];
    const tujuanList = Object.keys(alatByCategory);
    const materialList = ['Batu Belah', 'Batu Split', 'Sirtu'];
    
    // PERBAIKAN: Gunakan counter untuk ID yang dijamin unik, bukan Date.now()
    let uniqueIdCounter = 0;

    function tambahMaterial(data = {}) {
        const container = document.getElementById("materialContainer");
        const id = uniqueIdCounter++; // Gunakan counter
        const materialDiv = document.createElement("div");
        materialDiv.className = "grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-800/50 p-3 rounded-lg";
        const jenis = data.jenis || 'batu_belah';
        const tonase = data.tonase || '';
        materialDiv.innerHTML = `<div class="md:col-span-2"><label class="text-sm text-gray-400">Jenis Material</label><select name="material_jenis_${id}" class="w-full p-2 bg-gray-700 text-white rounded">${materialList.map(m => `<option value="${m.toLowerCase().replace(' ', '_')}" ${m.toLowerCase().replace(' ', '_') === jenis ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div><label class="text-sm text-gray-400">Tonase</label><input type="number" step="any" name="material_tonase_${id}" value="${tonase}" class="w-full p-2 bg-gray-700 text-white rounded"></div><div><button type="button" class="remove-btn bg-red-800 hover:bg-red-700 text-white font-bold p-2 rounded-lg w-full">Hapus</button></div>`;
        container.appendChild(materialDiv);
        materialDiv.querySelector('.remove-btn').addEventListener('click', function() { this.parentElement.parentElement.remove(); });
    }

    function tambahSarana(data = {}) {
        const container = document.getElementById("saranaContainer");
        const id = uniqueIdCounter++; // Gunakan counter
        const saranaDiv = document.createElement("div");
        saranaDiv.className = "grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-gray-800/50 p-3 rounded-lg";
        const saranaOptions = saranaList.map(s => `<option value="${s}" ${s === data.alat ? 'selected' : ''}>${s}</option>`).join('');
        saranaDiv.innerHTML = `<div class="md:col-span-2"><label class="text-sm text-gray-400">Nama Sarana</label><select name="sarana_nama_${id}" class="w-full p-2 bg-gray-700 text-white rounded">${saranaOptions}</select></div><div class="grid grid-cols-2 gap-2"><div><label class="text-sm text-gray-400">Isi Fuel</label><input type="number" step="any" name="sarana_fuel_isi_${id}" value="${data.fuel_pengisian || ''}" class="w-full p-2 bg-gray-700 text-white rounded"></div><div><label class="text-sm text-gray-400">Guna Fuel</label><input type="number" step="any" name="sarana_fuel_guna_${id}" value="${data.fuel_penggunaan || ''}" class="w-full p-2 bg-gray-700 text-white rounded"></div></div><div><label class="text-sm text-gray-400">Jarak (km)</label><input type="number" step="any" name="sarana_jarak_km_${id}" value="${data.jarak_km || ''}" class="w-full p-2 bg-gray-700 text-white rounded"></div><div><button type="button" class="remove-btn bg-red-800 hover:bg-red-700 text-white font-bold p-2 rounded-lg w-full">Hapus</button></div>`;
        container.appendChild(saranaDiv);
        saranaDiv.querySelector('.remove-btn').addEventListener('click', function() { this.parentElement.parentElement.remove(); });
    }
    
    function tambahAlat(data = {}) {
      const container = document.getElementById("alatContainer");
      const id = uniqueIdCounter++; // Gunakan counter
      const alatDiv = document.createElement("div");
      alatDiv.className = "grid grid-cols-1 md:grid-cols-7 gap-4 items-end bg-gray-800/50 p-3 rounded-lg";
      const tujuanOptions = tujuanList.map(t => `<option value="${t}" ${t === data.tujuan ? 'selected' : ''}>${t}</option>`).join('');
      const tujuanSelectHTML = `<select name="alat_tujuan_${id}" class="w-full p-2 bg-gray-700 text-white rounded">${tujuanOptions}</select>`;
      const alatListForTujuan = alatByCategory[data.tujuan || tujuanList[0]] || [];
      const alatOptions = alatListForTujuan.map(a => `<option value="${a}" ${a === data.alat ? 'selected' : ''}>${a}</option>`).join('');
      const alatSelectHTML = `<select name="alat_nama_${id}" class="w-full p-2 bg-gray-700 text-white rounded">${alatOptions}</select>`;
      alatDiv.innerHTML = `<div class="md:col-span-2">${tujuanSelectHTML}</div><div class="md:col-span-2">${alatSelectHTML}</div><div><input type="number" step="any" name="alat_jam_${id}" placeholder="Jam Operasi" value="${data.jam_operasi || ''}" class="w-full p-2 bg-gray-700 text-white rounded"></div><div class="grid grid-cols-2 gap-2"><div><input type="number" step="any" name="alat_fuel_isi_${id}" placeholder="Isi Fuel" value="${data.fuel_pengisian || ''}" class="w-full p-2 bg-gray-700 text-white rounded"></div><div><input type="number" step="any" name="alat_fuel_guna_${id}" placeholder="Guna Fuel" value="${data.fuel_penggunaan || ''}" class="w-full p-2 bg-gray-700 text-white rounded"></div></div><div><button type="button" class="remove-btn bg-red-800 hover:bg-red-700 text-white font-bold p-2 rounded-lg w-full">Hapus</button></div>`;
      container.appendChild(alatDiv);
      const tujuanSelect = alatDiv.querySelector(`select[name="alat_tujuan_${id}"]`);
      const alatSelect = alatDiv.querySelector(`select[name="alat_nama_${id}"]`);
      tujuanSelect.addEventListener('change', (e) => { const selectedTujuan = e.target.value; const alatOptions = alatByCategory[selectedTujuan] || []; alatSelect.innerHTML = alatOptions.map(a => `<option value="${a}">${a}</option>`).join(''); });
      alatDiv.querySelector('.remove-btn').addEventListener('click', function() { this.parentElement.parentElement.remove(); });
    }

    const form = document.getElementById("dailyForm");
    const loader = document.getElementById("loader");

    async function loadDataForEdit() {
        const params = new URLSearchParams(window.location.search);
        const tanggal = params.get('tanggal');
        if (!tanggal) {
            loader.innerHTML = '<p class="text-red-500">Tanggal tidak ditemukan di URL. Kembali ke Raw Data.</p>';
            return;
        }
        try {
            const res = await fetch(`/api/harian-detail/${tanggal}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error);
            }
            const { harian, alat } = await res.json();
            form.querySelector('[name="tanggal"]').value = harian.tanggal;
            form.querySelector('[name="ob_removal_tc"]').value = harian.ob_removal_tc;
            form.querySelector('[name="ritase_ob"]').value = harian.ritase_ob;
            form.querySelector('[name="jarak_ob"]').value = harian.jarak_ob;
            form.querySelector('[name="coal_getting_tc"]').value = harian.coal_getting_tc;
            form.querySelector('[name="ritase_coal"]').value = harian.ritase_coal;
            form.querySelector('[name="jarak_coal"]').value = harian.jarak_coal;
            form.querySelector('[name="mud_removal"]').value = harian.mud_removal;
            if (harian.tonase_batu_belah > 0) tambahMaterial({ jenis: 'batu_belah', tonase: harian.tonase_batu_belah });
            if (harian.tonase_batu_split > 0) tambahMaterial({ jenis: 'batu_split', tonase: harian.tonase_batu_split });
            if (harian.tonase_sirtu > 0) tambahMaterial({ jenis: 'sirtu', tonase: harian.tonase_sirtu });
            
            alat.forEach(item => {
                if (item.tujuan === 'Sarana') {
                    tambahSarana(item);
                } else {
                    tambahAlat(item);
                }
            });
            loader.style.display = 'none';
            form.classList.remove('hidden');
        } catch (error) {
            loader.innerHTML = `<p class="text-red-500">Gagal memuat data: ${error.message}</p>`;
        }
    }

    form.addEventListener("submit", async function(e) {
        e.preventDefault();
        const submitButton = document.getElementById('submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';

        const formData = new FormData(form);
        const materials_list = [];
        form.querySelectorAll("#materialContainer > div").forEach(div => {
            const nameAttr = div.querySelector('select[name^="material_jenis_"]').name;
            const id = nameAttr.substring(nameAttr.lastIndexOf('_') + 1);
            materials_list.push({ jenis: formData.get(`material_jenis_${id}`), tonase: formData.get(`material_tonase_${id}`) });
        });

        const alat_list = [];
        form.querySelectorAll("#alatContainer > div").forEach(div => {
            const nameAttr = div.querySelector('select[name^="alat_tujuan_"]').name;
            const id = nameAttr.substring(nameAttr.lastIndexOf('_') + 1);
            alat_list.push({ alat: formData.get(`alat_nama_${id}`), tujuan: formData.get(`alat_tujuan_${id}`), jam_operasi: formData.get(`alat_jam_${id}`), fuel_pengisian: formData.get(`alat_fuel_isi_${id}`), fuel_penggunaan: formData.get(`alat_fuel_guna_${id}`) });
        });
      
        form.querySelectorAll("#saranaContainer > div").forEach(div => {
            const nameAttr = div.querySelector('select[name^="sarana_nama_"]').name;
            const id = nameAttr.substring(nameAttr.lastIndexOf('_') + 1);
            const saranaData = {
                alat: formData.get(`sarana_nama_${id}`),
                tujuan: 'Sarana',
                jam_operasi: 0,
                fuel_pengisian: formData.get(`sarana_fuel_isi_${id}`),
                fuel_penggunaan: formData.get(`sarana_fuel_guna_${id}`),
                jarak_km: formData.get(`sarana_jarak_km_${id}`)
            };
            if (saranaData.fuel_pengisian || saranaData.jarak_km) {
                alat_list.push(saranaData);
            }
        });

        const materials_object = materials_list.reduce((acc, item) => {
            const key = `tonase_${item.jenis}`;
            acc[key] = parseFloat(item.tonase) || 0;
            return acc;
        }, { tonase_batu_belah: 0, tonase_batu_split: 0, tonase_sirtu: 0 });

        const payload = {
            tanggal: formData.get("tanggal"),
            penambangan: { ob_removal_tc: formData.get("ob_removal_tc"), ritase_ob: formData.get("ritase_ob"), jarak_ob: formData.get("jarak_ob"), coal_getting_tc: formData.get("coal_getting_tc"), ritase_coal: formData.get("ritase_coal"), jarak_coal: formData.get("jarak_coal"), mud_removal: formData.get("mud_removal") },
            materials: materials_object,
            alat_list: alat_list
        };

        try {
            const res = await fetch("/api/update-harian", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            
            showNotification(result.message, 'green');
            
            setTimeout(() => { window.location.href = 'RawData.html'; }, 1500);

        } catch (error) {
            showNotification(`Gagal menyimpan perubahan: ${error.message}`, 'red');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Simpan Perubahan';
        }
    });

    document.getElementById("addMaterialButton").addEventListener('click', () => tambahMaterial());
    document.getElementById("addAlatButton").addEventListener('click', () => tambahAlat());
    document.getElementById("addSaranaButton").addEventListener('click', () => tambahSarana());
    
    loadDataForEdit();
});