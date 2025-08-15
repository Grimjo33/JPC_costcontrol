document.addEventListener('DOMContentLoaded', () => {
    const alatByCategory = {
        'Dewatering': ["DND 150", "DND 200"],
        'Stockpile': ["Exca20-01", "Exca20-02", "Exca20-07", "Exca20-09", "Exca7-1", "Exca330-1", "Grader-1", "Compact-1"],
        'Screening': ["Exca20-01", "Exca20-02", "Exca20-07", "Exca20-09", "Exca7-1", "Exca330-1"],
        'Hauling Road': ["Grader-1", "Compact-1","WaterTruck01", "WaterTruck02", "Exca20-01", "Exca20-02", "Exca20-07", "Exca20-09", "Exca7-1", "Exca330-1"],
        'Penambangan': ["Grader-1", "Compact-1","WaterTruck01", "WaterTruck02", "Exca20-01", "Exca20-02", "Exca20-07", "Exca20-09", "Exca7-1", "Exca330-1"]
    };
	const saranaList = ["LV01", "LV02", "LV03", "LV04", "BUS", "Genset1", "Genset2"];
    const tujuanList = Object.keys(alatByCategory);
    const materialList = ['Batu Belah', 'Batu Split', 'Sirtu'];

    function tambahMaterial(data = {}) {
        const container = document.getElementById("materialContainer");
        const id = Date.now(); // ID Sederhana
        const materialDiv = document.createElement("div");
        materialDiv.className = "grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-800/50 p-3 rounded-lg";
        materialDiv.innerHTML = `<div class="md:col-span-2"><label class="text-sm text-gray-400">Jenis Material</label><select name="material_jenis_${id}" class="w-full p-2 bg-gray-700 text-white rounded">${materialList.map(m => `<option value="${m.toLowerCase().replace(' ', '_')}">${m}</option>`).join('')}</select></div><div><label class="text-sm text-gray-400">Tonase</label><input type="number" step="any" name="material_tonase_${id}" class="w-full p-2 bg-gray-700 text-white rounded"></div><div><button type="button" class="remove-btn bg-red-800 hover:bg-red-700 text-white font-bold p-2 rounded-lg w-full">Hapus</button></div>`;
        container.appendChild(materialDiv);
        materialDiv.querySelector('.remove-btn').addEventListener('click', function() { this.parentElement.parentElement.remove(); });
    }

    function tambahSarana(data = {}) {
        const container = document.getElementById("saranaContainer");
        const id = Date.now(); // ID Sederhana
        const saranaDiv = document.createElement("div");
        saranaDiv.className = "grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-gray-800/50 p-3 rounded-lg";
        const saranaOptions = saranaList.map(s => `<option value="${s}">${s}</option>`).join('');
        saranaDiv.innerHTML = `<div class="md:col-span-2"><label class="text-sm text-gray-400">Nama Sarana</label><select name="sarana_nama_${id}" class="w-full p-2 bg-gray-700 text-white rounded">${saranaOptions}</select></div><div class="grid grid-cols-2 gap-2"><div><label class="text-sm text-gray-400">Isi Fuel</label><input type="number" step="any" name="sarana_fuel_isi_${id}" class="w-full p-2 bg-gray-700 text-white rounded"></div><div><label class="text-sm text-gray-400">Guna Fuel</label><input type="number" step="any" name="sarana_fuel_guna_${id}" class="w-full p-2 bg-gray-700 text-white rounded"></div></div><div><label class="text-sm text-gray-400">Jarak (km)</label><input type="number" step="any" name="sarana_jarak_km_${id}" class="w-full p-2 bg-gray-700 text-white rounded"></div><div><button type="button" class="remove-btn bg-red-800 hover:bg-red-700 text-white font-bold p-2 rounded-lg w-full">Hapus</button></div>`;
        container.appendChild(saranaDiv);
        saranaDiv.querySelector('.remove-btn').addEventListener('click', function() { this.parentElement.parentElement.remove(); });
    }

    function tambahAlat(data = {}) {
      const container = document.getElementById("alatContainer");
      const id = Date.now(); // ID Sederhana
      const alatDiv = document.createElement("div");
      alatDiv.className = "grid grid-cols-1 md:grid-cols-7 gap-4 items-end bg-gray-800/50 p-3 rounded-lg";
      const tujuanOptions = tujuanList.map(t => `<option value="${t}">${t}</option>`).join('');
      const tujuanSelectHTML = `<select name="alat_tujuan_${id}" class="w-full p-2 bg-gray-700 text-white rounded">${tujuanOptions}</select>`;
      const initialAlatOptions = alatByCategory[tujuanList[0]].map(a => `<option value="${a}">${a}</option>`).join('');
      const alatSelectHTML = `<select name="alat_nama_${id}" class="w-full p-2 bg-gray-700 text-white rounded">${initialAlatOptions}</select>`;
      alatDiv.innerHTML = `<div class="md:col-span-2">${tujuanSelectHTML}</div><div class="md:col-span-2">${alatSelectHTML}</div><div><input type="number" step="any" name="alat_jam_${id}" placeholder="Jam Operasi" class="w-full p-2 bg-gray-700 text-white rounded"></div><div class="grid grid-cols-2 gap-2"><div><input type="number" step="any" name="alat_fuel_isi_${id}" placeholder="Isi Fuel" class="w-full p-2 bg-gray-700 text-white rounded"></div><div><input type="number" step="any" name="alat_fuel_guna_${id}" placeholder="Guna Fuel" class="w-full p-2 bg-gray-700 text-white rounded"></div></div><div><button type="button" class="remove-btn bg-red-800 hover:bg-red-700 text-white font-bold p-2 rounded-lg w-full">Hapus</button></div>`;
      container.appendChild(alatDiv);
      const tujuanSelect = alatDiv.querySelector(`select[name="alat_tujuan_${id}"]`);
      const alatSelect = alatDiv.querySelector(`select[name="alat_nama_${id}"]`);
      tujuanSelect.addEventListener('change', (e) => { const selectedTujuan = e.target.value; const alatOptions = alatByCategory[selectedTujuan] || []; alatSelect.innerHTML = alatOptions.map(a => `<option value="${a}">${a}</option>`).join(''); });
      alatDiv.querySelector('.remove-btn').addEventListener('click', function() { this.parentElement.parentElement.remove(); });
    }

    document.getElementById("addMaterialButton").addEventListener('click', tambahMaterial);
    document.getElementById("addAlatButton").addEventListener('click', tambahAlat);
    document.getElementById("addSaranaButton").addEventListener('click', tambahSarana);
    
    document.getElementById("dailyForm").addEventListener("submit", async function(e) {
      e.preventDefault();
      const submitButton = document.getElementById('submit-button');
      submitButton.disabled = true;
      submitButton.textContent = 'Menyimpan...';

      const form = e.target;
      const formData = new FormData(form);
      
      const materials_list = [];
      form.querySelectorAll("#materialContainer > div").forEach(div => {
          const nameAttr = div.querySelector('select[name^="material_jenis_"]').name;
          const id = nameAttr.substring(nameAttr.lastIndexOf('_') + 1);
          const materialData = {
              jenis: formData.get(`material_jenis_${id}`),
              tonase: formData.get(`material_tonase_${id}`),
          };
          if (materialData.tonase) { materials_list.push(materialData); }
      });
      
      const alat_list = [];
      form.querySelectorAll("#alatContainer > div").forEach(div => {
          const nameAttr = div.querySelector('select[name^="alat_tujuan_"]').name;
          const id = nameAttr.substring(nameAttr.lastIndexOf('_') + 1);
          const alatData = {
              alat: formData.get(`alat_nama_${id}`),
              tujuan: formData.get(`alat_tujuan_${id}`),
              jam_operasi: formData.get(`alat_jam_${id}`),
              fuel_pengisian: formData.get(`alat_fuel_isi_${id}`),
              fuel_penggunaan: formData.get(`alat_fuel_guna_${id}`),
          };
          if (alatData.jam_operasi || alatData.fuel_pengisian) { alat_list.push(alatData); }
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
              jarak_km: formData.get(`sarana_jarak_km_${id}`),
          };
          if (saranaData.fuel_pengisian || saranaData.jarak_km) { alat_list.push(saranaData); }
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
        const res = await fetch("/submit-daily", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'Terjadi kesalahan di server.');
        showNotification(result.message, 'green');
        form.reset();
        document.getElementById("materialContainer").innerHTML = "";
        document.getElementById("alatContainer").innerHTML = "";
        document.getElementById("saranaContainer").innerHTML = "";
      } catch (error) {
          showNotification(`Gagal menyimpan data: ${error.message}`, 'red');
      } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Submit Data Harian';
      }
    });
});