document.addEventListener('DOMContentLoaded', () => {
    const fleetContainer = document.getElementById('fleetContainer');
    const tanggalInput = document.querySelector('[name="tanggal"]');
    let fleetCounter = 0;

    function addFleetRow(data = {}) {
        fleetCounter++;
        const fleetDiv = document.createElement("div");
        fleetDiv.className = "grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-800/50 p-3 rounded-lg";
        fleetDiv.innerHTML = `
            <div>
                <label class="text-sm text-gray-400">Nama Fleet / Excavator</label>
                <input type="text" name="nama_fleet_${fleetCounter}" value="${data.nama_fleet || ''}" class="w-full p-2 bg-gray-700 text-white rounded" required>
            </div>
            <div>
                <label class="text-sm text-gray-400">Volume (BCM)</label>
                <input type="number" step="any" name="volume_bcm_${fleetCounter}" value="${data.volume_bcm || ''}" class="w-full p-2 bg-gray-700 text-white rounded" required>
            </div>
            <div>
                <label class="text-sm text-gray-400">Jarak (meter)</label>
                <input type="number" step="any" name="jarak_meter_${fleetCounter}" value="${data.jarak_meter || ''}" class="w-full p-2 bg-gray-700 text-white rounded" required>
            </div>
            <div>
                <button type="button" class="remove-btn bg-red-800 hover:bg-red-700 text-white font-bold p-2 rounded-lg w-full">Hapus</button>
            </div>
        `;
        fleetContainer.appendChild(fleetDiv);
        fleetDiv.querySelector('.remove-btn').addEventListener('click', () => fleetDiv.remove());
    }

    async function loadExistingData(tanggal) {
        fleetContainer.innerHTML = ''; // Kosongkan dulu
        if (!tanggal) return;

        try {
            const res = await fetch(`/api/get-jarak-fleet-by-tanggal?tanggal=${tanggal}`);
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    data.forEach(addFleetRow);
                } else {
                    addFleetRow(); // Tambah satu baris kosong jika belum ada data
                }
            } else {
                 addFleetRow();
            }
        } catch (error) {
            console.error("Gagal memuat data fleet:", error);
            addFleetRow();
        }
    }

    document.getElementById('addFleetButton').addEventListener('click', () => addFleetRow());
    tanggalInput.addEventListener('change', (e) => loadExistingData(e.target.value));

    document.getElementById('jarakForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = document.getElementById('submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';

        const tanggal = tanggalInput.value;
        const fleet_list = [];
        const rows = fleetContainer.querySelectorAll('.grid');
        
        rows.forEach(row => {
            const nameInput = row.querySelector('input[name^="nama_fleet_"]');
            if (nameInput) {
                const id = nameInput.name.split('_').pop();
                const volumeInput = row.querySelector(`input[name="volume_bcm_${id}"]`);
                const jarakInput = row.querySelector(`input[name="jarak_meter_${id}"]`);
                if (nameInput.value && volumeInput.value && jarakInput.value) {
                    fleet_list.push({
                        nama_fleet: nameInput.value,
                        volume_bcm: volumeInput.value,
                        jarak_meter: jarakInput.value,
                    });
                }
            }
        });
        
        try {
            const res = await fetch("/api/submit-jarak-fleet", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tanggal, fleet_list })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            showNotification(result.message, 'green');
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'red');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Simpan Data Jarak';
        }
    });

    // Inisialisasi dengan satu baris kosong
    addFleetRow();
});