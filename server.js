const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Diperlukan untuk menyalin DB
const { format, startOfMonth, endOfMonth, getDaysInMonth } = require('date-fns');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// --- PENGATURAN DATABASE UNTUK VERCEL ---
// Path ke database asli Anda (read-only di Vercel)
const sourceDbPath = path.join(process.cwd(), 'data', 'database.db');
// Path ke lokasi database yang bisa ditulis di Vercel
const tempDbPath = path.join('/tmp', 'database.db');

// Salin file database ke /tmp jika belum ada di sana
// Ini hanya terjadi saat "cold start"
if (!fs.existsSync(tempDbPath)) {
  try {
    fs.copyFileSync(sourceDbPath, tempDbPath);
    console.log('Database successfully copied to /tmp.');
  } catch (error) {
    console.error('Error copying database:', error);
  }
}

const db = new sqlite3.Database(tempDbPath, (err) => {
    if (err) {
        return console.error('Error opening database:', err.message);
    }
    console.log('Connected to the SQLite database in /tmp.');
});
// --- AKHIR PENGATURAN DATABASE ---

const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) { (err ? reject(err) : resolve(this)); }));
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

app.get('/', (req, res) => {
    res.redirect('/Dashboard_Harian.html');
});
app.get('/api/get-jarak-fleet-by-tanggal', async (req, res) => {
    try {
        const { tanggal } = req.query;
        if (!tanggal) return res.status(400).json({ error: 'Tanggal diperlukan.' });
        const data = await dbAll(`SELECT * FROM fleet_harian WHERE tanggal = ?`, [tanggal]);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/submit-jarak-fleet', async (req, res) => {
    const { tanggal, fleet_list } = req.body;
    if (!tanggal || !Array.isArray(fleet_list)) {
        return res.status(400).json({ error: 'Data tidak lengkap.' });
    }
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun(`DELETE FROM fleet_harian WHERE tanggal = ?`, [tanggal]);
        const stmt = db.prepare(`INSERT INTO fleet_harian (tanggal, nama_fleet, volume_bcm, jarak_meter) VALUES (?, ?, ?, ?)`);
        for (const fleet of fleet_list) {
            if (fleet.nama_fleet && fleet.volume_bcm && fleet.jarak_meter) {
                stmt.run(tanggal, fleet.nama_fleet, fleet.volume_bcm, fleet.jarak_meter);
            }
        }
        stmt.finalize();
        await dbRun('COMMIT');
        res.json({ success: true, message: 'Data jarak fleet berhasil disimpan.' });
    } catch (error) {
        await dbRun('ROLLBACK');
        res.status(500).json({ error: 'Gagal menyimpan data jarak: ' + error.message });
    }
});

app.get('/api/jarak-data', async (req, res) => {
    try {
        const data = await dbAll(`SELECT * FROM fleet_harian ORDER BY tanggal DESC, nama_fleet ASC`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/delete-jarak-fleet', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'ID diperlukan.' });
    try {
        await dbRun(`DELETE FROM fleet_harian WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Data jarak fleet berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint untuk Data Harian (Input & Edit)
//hitung biaya otomatis input edit
app.post('/submit-daily', async (req, res) => {
    const { tanggal, penambangan = {}, materials = {}, alat_list = [] } = req.body;
    if (!tanggal) return res.status(400).json({ error: 'Tanggal wajib diisi.' });
    try {
        await dbRun('BEGIN TRANSACTION');
        const existingHarian = await dbGet(`SELECT id FROM harian WHERE tanggal = ?`, [tanggal]);
        if (existingHarian) {
            return res.status(409).json({ success: false, error: `Data untuk tanggal ${tanggal} sudah ada. Silakan gunakan fitur Edit.` });
        }
        const result = await dbRun(`INSERT INTO harian (tanggal, ob_removal_tc, ritase_ob, jarak_ob, coal_getting_tc, ritase_coal, jarak_coal, mud_removal, tonase_batu_belah, tonase_batu_split, tonase_sirtu) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, 
            [tanggal, penambangan.ob_removal_tc || null, penambangan.ritase_ob || null, penambangan.jarak_ob || null, penambangan.coal_getting_tc || null, penambangan.ritase_coal || null, penambangan.jarak_coal || null, penambangan.mud_removal || null, materials.tonase_batu_belah || null, materials.tonase_batu_split || null, materials.tonase_sirtu || null]);
        
        const harianId = result.lastID;
        if (alat_list && alat_list.length > 0) {
            const stmt = db.prepare(`INSERT INTO alat_harian (harian_id, alat, tujuan, jam_operasi, fuel_pengisian, fuel_penggunaan, jarak_km) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            for (const alat of alat_list) {
                const fuel_penggunaan = (alat.fuel_penggunaan === null || alat.fuel_penggunaan === '' || alat.fuel_penggunaan === undefined) ? alat.fuel_pengisian : alat.fuel_penggunaan;
                stmt.run(harianId, alat.alat, alat.tujuan, alat.jam_operasi || null, alat.fuel_pengisian || null, fuel_penggunaan || null, alat.jarak_km || null);
            }
            stmt.finalize();
        }
        
        // PERUBAHAN UTAMA: Panggil fungsi kalkulasi otomatis
        await calculateAndSaveCostsForDay(harianId, tanggal);

        await dbRun('COMMIT');
        res.json({ success: true, message: `Data baru untuk tanggal ${tanggal} berhasil dibuat dan dihitung.` });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error("Submit Daily Error:", error);
        res.status(500).json({ success: false, error: 'Gagal menyimpan data harian: ' + error.message });
    }
});

//hitung biaya otomatis input edit

app.get('/api/harian-detail/:tanggal', async (req, res) => {
    try {
        const { tanggal } = req.params;
        const harianData = await dbGet(`SELECT * FROM harian WHERE tanggal = ?`, [tanggal]);
        if (!harianData) return res.status(404).json({ error: 'Data untuk tanggal ini tidak ditemukan.' });
        const alatData = await dbAll(`SELECT * FROM alat_harian WHERE harian_id = ?`, [harianData.id]);
        res.json({ harian: harianData, alat: alatData });
    } catch (error) {
        console.error("Get Harian Detail Error:", error);
        res.status(500).json({ error: 'Gagal mengambil detail data: ' + error.message });
    }
});

// GANTI BLOK KODE /api/update-harian DENGAN INI
app.post('/api/update-harian', async (req, res) => {
    const { tanggal, penambangan, materials, alat_list } = req.body;
    if (!tanggal) return res.status(400).json({ error: 'Tanggal diperlukan untuk update.' });
    try {
        await dbRun('BEGIN TRANSACTION');
        const harianRecord = await dbGet(`SELECT id FROM harian WHERE tanggal = ?`, [tanggal]);
        if (!harianRecord) throw new Error('Data harian untuk tanggal ini tidak ditemukan untuk diperbarui.');
        const harianId = harianRecord.id;

        await dbRun(`UPDATE harian SET ob_removal_tc=?, ritase_ob=?, jarak_ob=?, coal_getting_tc=?, ritase_coal=?, jarak_coal=?, mud_removal=?, tonase_batu_belah=?, tonase_batu_split=?, tonase_sirtu=? WHERE id=?`,
            [penambangan.ob_removal_tc || null, penambangan.ritase_ob || null, penambangan.jarak_ob || null, penambangan.coal_getting_tc || null, penambangan.ritase_coal || null, penambangan.jarak_coal || null, penambangan.mud_removal || null, materials.tonase_batu_belah || null, materials.tonase_batu_split || null, materials.tonase_sirtu || null, harianId]);

        await dbRun(`DELETE FROM alat_harian WHERE harian_id = ?`, [harianId]);

        if (alat_list && alat_list.length > 0) {
            const stmt = db.prepare(`INSERT INTO alat_harian (harian_id, alat, tujuan, jam_operasi, fuel_pengisian, fuel_penggunaan, jarak_km) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            for (const alat of alat_list) {
                const fuel_penggunaan = (alat.fuel_penggunaan === null || alat.fuel_penggunaan === '' || alat.fuel_penggunaan === undefined) ? alat.fuel_pengisian : alat.fuel_penggunaan;
                stmt.run(harianId, alat.alat, alat.tujuan, alat.jam_operasi || null, alat.fuel_pengisian || null, fuel_penggunaan || null, alat.jarak_km || null);
            }
            stmt.finalize();
        }

        // PERUBAHAN UTAMA: Panggil fungsi kalkulasi otomatis
        await calculateAndSaveCostsForDay(harianId, tanggal);
        
        await dbRun('COMMIT');
        res.json({ success: true, message: `Data untuk tanggal ${tanggal} berhasil diperbarui dan dihitung ulang.` });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error("Update Harian Error:", error);
        res.status(500).json({ success: false, error: 'Gagal memperbarui data harian: ' + error.message });
    }
});
//kode update api hitung biayaa inputedit 

// Endpoint untuk Rekonsiliasi
app.get('/api/rekon-data', async (req, res) => {
    try {
        const data = await dbAll(`SELECT * FROM rekon_survey ORDER BY start_date DESC`);
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/rekon-detail/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await dbGet(`SELECT * FROM rekon_survey WHERE id = ?`, [id]);
        if (data) { res.json(data); } else { res.status(404).json({ error: 'Data tidak ditemukan' }); }
    } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/delete-rekon', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'ID diperlukan' });
    try {
        await dbRun(`DELETE FROM rekon_survey WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Data rekonsiliasi berhasil dihapus.' });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.post('/submit-rekon', async (req, res) => {
    const { start_date, end_date, volume_ob_survey, volume_coal_survey } = req.body;
    if (!start_date || !end_date || !volume_ob_survey || !volume_coal_survey) {
        return res.status(400).json({ error: 'Semua field rekon wajib diisi.' });
    }
    try {
        await dbRun(`INSERT INTO rekon_survey (start_date, end_date, volume_ob_survey, volume_coal_survey) VALUES (?, ?, ?, ?) ON CONFLICT(start_date, end_date) DO UPDATE SET volume_ob_survey=excluded.volume_ob_survey, volume_coal_survey=excluded.volume_coal_survey`, [start_date, end_date, volume_ob_survey, volume_coal_survey]);
        res.json({ success: true, message: `Data rekonsiliasi untuk periode ${start_date} hingga ${end_date} berhasil disimpan.` });
    } catch (error) {
        console.error("Submit Rekon Error:", error);
        res.status(500).json({ error: 'Gagal menyimpan data rekon: ' + error.message });
    }
});

// Endpoint untuk Target
app.get('/api/targets', async (req, res) => {
    try {
        const targets = await dbAll("SELECT * FROM targets ORDER BY periode DESC");
        res.json(targets);
    } catch (error) {
        console.error("Error fetching targets:", error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/submit-target', async (req, res) => {
    const { periode, target_ob, target_coal } = req.body;
    if (!periode || !target_ob || !target_coal) {
        return res.status(400).json({ success: false, error: 'Semua field wajib diisi.' });
    }
    try {
        await dbRun(`INSERT INTO targets (periode, target_ob, target_coal) VALUES (?, ?, ?) ON CONFLICT(periode) DO UPDATE SET target_ob = excluded.target_ob, target_coal = excluded.target_coal`, [periode, target_ob, target_coal]);
        res.json({ success: true, message: `Target untuk periode ${periode} berhasil disimpan.` });
    } catch (error) {
        console.error("Submit Target Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/delete-target', async (req, res) => {
    const { periode } = req.body;
    if (!periode) {
        return res.status(400).json({ success: false, error: 'Periode diperlukan.' });
    }
    try {
        await dbRun(`DELETE FROM targets WHERE periode = ?`, [periode]);
        res.json({ success: true, message: `Target untuk periode ${periode} berhasil dihapus.` });
    } catch (error) {
        console.error("Delete Target Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint untuk Parameter
app.get('/api/parameters', async (req, res) => {
    try {
        const general = await dbAll("SELECT * FROM cost_parameters");
        const equipment = await dbAll("SELECT * FROM equipment_details ORDER BY alat_nama ASC");
        res.json({ general, equipment });
    } catch (error) { 
        console.error("Error fetching parameters:", error);
        res.status(500).json({ error: error.message }); 
    }
});
app.post('/api/parameters', (req, res) => {
    const { general, equipment } = req.body;
    if (!general || !equipment) return res.status(400).json({ error: 'Data parameter tidak lengkap.' });
    db.serialize(() => {
        const stmtGeneral = db.prepare(`INSERT OR REPLACE INTO cost_parameters (param_key, param_value) VALUES (?, ?)`);
        general.forEach(p => stmtGeneral.run(p.param_key, p.param_value));
        stmtGeneral.finalize();
        const stmtEquipment = db.prepare(`INSERT OR REPLACE INTO equipment_details (alat_nama, category, biaya_rental, non_charge_hours_limit, overcharge_price) VALUES (?, ?, ?, ?, ?)`);
        equipment.forEach(e => {
            stmtEquipment.run(e.alat_nama, e.category, e.biaya_rental, e.non_charge_hours_limit, e.overcharge_price);
        });
        stmtEquipment.finalize((err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Endpoint untuk Data Hauling/Trucking
app.post('/submit-trucking', async (req, res) => {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) return res.status(400).json({ success: false, error: 'Data tidak valid.' });
    const dataByDate = data.reduce((acc, row) => { (acc[row.date] = acc[row.date] || []).push(row); return acc; }, {});
    try {
        await dbRun('BEGIN TRANSACTION');
        for (const date in dataByDate) {
            await dbRun('DELETE FROM trucking_harian WHERE date = ?', [date]);
            const stmt = db.prepare(`INSERT INTO trucking_harian (date, shift, checkout_time, do_number, truck_number, driver_name, buyer, rom, port, trade_term, tare, gross, nett, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const row of dataByDate[date]) {
                stmt.run(row.date, row.shift, row.checkout_time, row.do_number, row.truck_number, row.driver_name, row.buyer, row.rom, row.port, row.trade_term, row.tare, row.gross, row.nett, row.notes);
            }
            stmt.finalize();
        }
        await dbRun('COMMIT');
        res.json({ success: true, message: `Berhasil menyimpan ${data.length} baris data.` });
    } catch (error) {
        await dbRun('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/trucking-data', async (req, res) => {
    try {
        const { startDate, endDate, buyer, tradeTerm, page = 1, limit = 50 } = req.query;
        let whereClauses = []; const params = [];
        if (startDate) { whereClauses.push(`date >= ?`); params.push(startDate); }
        if (endDate) { whereClauses.push(`date <= ?`); params.push(endDate); }
        if (buyer) { whereClauses.push(`buyer = ?`); params.push(buyer); }
        if (tradeTerm) { whereClauses.push(`trade_term = ?`); params.push(tradeTerm); }
        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const totalResult = await dbGet(`SELECT COUNT(*) as count FROM trucking_harian ${whereString}`, params);
        const total = totalResult.count;
        let dataQuery = `SELECT * FROM trucking_harian ${whereString} ORDER BY date DESC, checkout_time DESC`;
        const queryParams = [...params];
        if (parseInt(limit) !== -1) {
            const offset = (page - 1) * limit;
            dataQuery += ` LIMIT ? OFFSET ?`; queryParams.push(limit, offset);
        }
        const rows = await dbAll(dataQuery, queryParams);
        res.json({ data: rows, total });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Endpoint untuk Penjualan
app.post('/submit-penjualan', async (req, res) => {
    const { tanggal_penjualan, tipe_dokumen, nomor_dokumen, buyer, tonase_penjualan, notes } = req.body;
    if (!tanggal_penjualan || !tipe_dokumen || !nomor_dokumen || !tonase_penjualan) {
        return res.status(400).json({ success: false, error: 'Data tidak lengkap.' });
    }
    try {
        const stmt = db.prepare(`INSERT INTO penjualan (tanggal_penjualan, tipe_dokumen, nomor_dokumen, buyer, tonase_penjualan, notes) VALUES (?, ?, ?, ?, ?, ?)`);
        stmt.run(tanggal_penjualan, tipe_dokumen, nomor_dokumen, buyer, tonase_penjualan, notes);
        stmt.finalize();
        res.json({ success: true, message: `Data penjualan (${nomor_dokumen}) berhasil disimpan.` });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.get('/penjualan-data', async (req, res) => {
    try {
        let query = `SELECT * FROM penjualan WHERE 1=1`; const params = [];
        const { startDate, endDate, buyer } = req.query;
        if (startDate) { query += ` AND tanggal_penjualan >= ?`; params.push(startDate); }
        if (endDate) { query += ` AND tanggal_penjualan <= ?`; params.push(endDate); }
        if (buyer) { query += ` AND buyer = ?`; params.push(buyer); }
        query += ` ORDER BY tanggal_penjualan DESC`;
        const rows = await dbAll(query, params);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/delete-penjualan/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun(`DELETE FROM penjualan WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Data penjualan berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint untuk filter dropdowns
app.get('/api/alat', async (req, res) => { try { const rows = await dbAll(`SELECT DISTINCT alat FROM alat_harian ORDER BY alat ASC`); res.json(rows.map(row => row.alat)); } catch(error) { res.status(500).json({ error: error.message }); } });
app.get('/api/trucking-customers', async (req, res) => { try { const rows = await dbAll(`SELECT DISTINCT buyer FROM trucking_harian WHERE buyer IS NOT NULL ORDER BY buyer ASC`); res.json(rows.map(r => r.buyer)); } catch (error) { res.status(500).json({ error: error.message }); } });
app.get('/api/trade-terms', async (req, res) => { try { const rows = await dbAll(`SELECT DISTINCT trade_term FROM trucking_harian WHERE trade_term IS NOT NULL ORDER BY trade_term ASC`); res.json(rows.map(r => r.trade_term)); } catch (error) { res.status(500).json({ error: error.message }); } });
app.get('/api/penjualan-buyers', async (req, res) => { try { const rows = await dbAll(`SELECT DISTINCT buyer FROM penjualan WHERE buyer IS NOT NULL ORDER BY buyer ASC`); res.json(rows.map(r => r.buyer)); } catch (error) { res.status(500).json({ error: error.message }); } });


// --- Endpoint untuk Laporan & Kalkulasi ---
// GANTI SELURUH BLOK app.get('/data', ...) DENGAN KODE YANG SUDAH DIPERBAIKI INI:

app.get('/data', async (req, res) => {
    try {
        const { startDate, endDate, alat: alatFilter } = req.query;

        // --- PERBAIKAN UTAMA: Cara menyusun query SQL ---
        let query = `SELECT * FROM harian`;
        const params = [];
        const whereClauses = ["1=1"];

        if (startDate) {
            whereClauses.push(`tanggal >= ?`);
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push(`tanggal <= ?`);
            params.push(endDate);
        }
        
        // Gabungkan semua kondisi WHERE terlebih dahulu
        query += ` WHERE ${whereClauses.join(' AND ')}`;
        
        // Tambahkan ORDER BY di paling akhir
        query += ` ORDER BY tanggal DESC`;
        // --- AKHIR PERBAIKAN ---

        let harianRows = await dbAll(query, params);
        if (harianRows.length === 0) return res.json([]);

        if (alatFilter) {
            const alatRows = await dbAll(`SELECT DISTINCT harian_id FROM alat_harian WHERE alat = ?`, [alatFilter]);
            const relevantHarianIds = alatRows.map(r => r.harian_id);
            harianRows = harianRows.filter(h => relevantHarianIds.includes(h.id));
        }
        
        const harianIds = harianRows.map(h => h.id);
        if (harianIds.length === 0) return res.json([]);

        // (Sisa dari fungsi ini sudah benar dan tidak perlu diubah)
        const [allAlatRows, rekonData, costParamsData, equipmentDetailsData, allFleetRows] = await Promise.all([
            dbAll(`SELECT * FROM alat_harian WHERE harian_id IN (${harianIds.map(() => '?').join(',')})`, harianIds),
            dbAll(`SELECT * FROM rekon_survey WHERE start_date <= ? AND end_date >= ?`, [endDate || '9999-12-31', startDate || '0000-01-01']),
            dbAll(`SELECT * FROM cost_parameters`),
            dbAll(`SELECT * FROM equipment_details`),
            dbAll(`SELECT * FROM fleet_harian WHERE tanggal IN (${harianRows.map(h => '?').join(',')})`, harianRows.map(h => h.tanggal))
        ]);

        const costParams = Object.fromEntries(costParamsData.map(p => [p.param_key, p.param_value]));
        const equipmentDetails = Object.fromEntries(equipmentDetailsData.map(e => [e.alat_nama, e]));
        
        const fleetByTanggal = allFleetRows.reduce((acc, fleet) => {
            if (!acc[fleet.tanggal]) acc[fleet.tanggal] = [];
            acc[fleet.tanggal].push(fleet);
            return acc;
        }, {});

        const alatByHarianId = allAlatRows.reduce((acc, alat) => {
            if (!acc[alat.harian_id]) acc[alat.harian_id] = [];
            const details = equipmentDetails[alat.alat] || {};
            const rentalCost = (alat.jam_operasi || 0) * (details.biaya_rental || 0);
            const fuelCost = (alat.fuel_penggunaan || alat.fuel_pengisian || 0) * (costParams.harga_fuel || 0);
            alat.total_biaya = rentalCost + fuelCost;
            acc[alat.harian_id].push(alat);
            return acc;
        }, {});

        let result = harianRows.map(day => {
            const relevantRekon = rekonData.find(r => day.tanggal >= r.start_date && day.tanggal <= r.end_date);
            let ob_rekon = 0, coal_rekon = 0;
            if (relevantRekon) {
                const daysInRekon = harianRows.filter(d => d.tanggal >= relevantRekon.start_date && d.tanggal <= relevantRekon.end_date);
                const totalRitaseOB = daysInRekon.reduce((s, d) => s + (d.ritase_ob || 0), 0);
                const totalRitaseCoal = daysInRekon.reduce((s, d) => s + (d.ritase_coal || 0), 0);
                if (totalRitaseOB > 0) ob_rekon = relevantRekon.volume_ob_survey * ((day.ritase_ob || 0) / totalRitaseOB);
                if (totalRitaseCoal > 0) coal_rekon = relevantRekon.volume_coal_survey * ((day.ritase_coal || 0) / totalRitaseCoal);
            }
            const vol_ob_untuk_biaya = ob_rekon > 0 ? ob_rekon : day.ob_removal_tc;
            const vol_coal_untuk_biaya = coal_rekon > 0 ? coal_rekon : day.coal_getting_tc;
            
            const fleetDataHariIni = fleetByTanggal[day.tanggal] || [];
            const totalFleetVolume = fleetDataHariIni.reduce((sum, f) => sum + (f.volume_bcm || 0), 0);
            const weightedAvgDistance = totalFleetVolume > 0 
                ? fleetDataHariIni.reduce((sum, f) => sum + ((f.volume_bcm || 0) * (f.jarak_meter || 0)), 0) / totalFleetVolume
                : (day.jarak_ob || 0);
            
            const jarak_lebih_ob = Math.max(0, weightedAvgDistance - (costParams.batas_jarak_normal_ob || 0));
            const biaya_overdistance_ob = (jarak_lebih_ob / 1000) * (vol_ob_untuk_biaya || 0) * (costParams.biaya_overdistance_ob || 0);
            const jarak_lebih_coal = Math.max(0, (day.jarak_coal || 0) - (costParams.batas_jarak_normal_coal || 0));
            const biaya_overdistance_coal = (jarak_lebih_coal / 1000) * (vol_coal_untuk_biaya || 0) * (costParams.biaya_overdistance_coal || 0);

            const biaya_ob_harian = (vol_ob_untuk_biaya || 0) * (costParams.biaya_penggalian_ob || 0);
            const biaya_coal_harian = (vol_coal_untuk_biaya || 0) * (costParams.biaya_penggalian_coal || 0);
            const biaya_batu_belah = (day.tonase_batu_belah || 0) * (costParams.harga_batu_belah || 0);
            const biaya_batu_split = (day.tonase_batu_split || 0) * (costParams.harga_batu_split || 0);
            const biaya_sirtu = (day.tonase_sirtu || 0) * (costParams.harga_sirtu || 0);
            
            return {
                ...day,
                ob_rekon, 
                coal_rekon,
                biaya_ob_harian,
                biaya_coal_harian,
                biaya_overdistance_ob,
                biaya_overdistance_coal,
                jarak_lebih_ob,
                jarak_lebih_coal,
                alat: alatByHarianId[day.id] || [],
                biaya_batu_belah,
                biaya_batu_split,
                biaya_sirtu,
                total_biaya_per_tanggal: day.total_biaya_harian 
            };
        });
        
        if (alatFilter) {
            result = result.map(day => ({ ...day, alat: day.alat.filter(a => a.alat === alatFilter) }))
                           .filter(day => day.alat.length > 0);
        }
        
        res.json(result);

    } catch (error) {
        console.error("Get Raw Data Error:", error);
        res.status(500).json({ error: 'Gagal mengambil data mentah: ' + error.message });
    }
});

app.post('/recalculate', async (req, res) => {
    // Note: This recalculate function is now fully updated.
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi.' });
    try {
        await dbRun('BEGIN TRANSACTION');
        
        const params = await dbAll(`SELECT * FROM cost_parameters`);
        const equipmentDetailsData = await dbAll(`SELECT * FROM equipment_details`);
        const harianData = await dbAll(`SELECT * FROM harian WHERE tanggal BETWEEN ? AND ? ORDER BY tanggal ASC`, [startDate, endDate]);
        const alatData = await dbAll(`SELECT ah.*, h.tanggal FROM alat_harian ah JOIN harian h ON ah.harian_id = h.id WHERE h.tanggal BETWEEN ? AND ?`, [startDate, endDate]);
        const rekonData = await dbAll(`SELECT * FROM rekon_survey WHERE start_date <= ? AND end_date >= ?`, [endDate, startDate]);
        const fleetData = await dbAll(`SELECT * FROM fleet_harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);

        const costParams = Object.fromEntries(params.map(p => [p.param_key, p.param_value]));
        const equipmentDetails = Object.fromEntries(equipmentDetailsData.map(e => [e.alat_nama, e]));

        const dailyVolumes = {};
        harianData.forEach(day => {
            dailyVolumes[day.tanggal] = { ob_final: day.ob_removal_tc || 0, coal_final: day.coal_getting_tc || 0 };
        });

        rekonData.forEach(rekon => {
            const daysInRekon = harianData.filter(d => d.tanggal >= rekon.start_date && d.tanggal <= rekon.end_date);
            const totalRitase = { ob: 0, coal: 0 };
            daysInRekon.forEach(day => {
                totalRitase.ob += day.ritase_ob || 0;
                totalRitase.coal += day.ritase_coal || 0;
            });
            if (totalRitase.ob > 0) {
                daysInRekon.forEach(day => {
                    dailyVolumes[day.tanggal].ob_final = rekon.volume_ob_survey * ((day.ritase_ob || 0) / totalRitase.ob);
                });
            }
            if (totalRitase.coal > 0) {
                 daysInRekon.forEach(day => {
                    dailyVolumes[day.tanggal].coal_final = rekon.volume_coal_survey * ((day.ritase_coal || 0) / totalRitase.coal);
                });
            }
        });

        const fleetByTanggal = fleetData.reduce((acc, fleet) => {
            if (!acc[fleet.tanggal]) acc[fleet.tanggal] = [];
            acc[fleet.tanggal].push(fleet);
            return acc;
        }, {});

        const monthStartDate = format(startOfMonth(new Date(startDate)), 'yyyy-MM-dd');
        const monthEndDate = format(endOfMonth(new Date(startDate)), 'yyyy-MM-dd');
        const alatDataBulanIni = await dbAll(`SELECT ah.*, h.tanggal FROM alat_harian ah JOIN harian h ON ah.harian_id = h.id WHERE h.tanggal BETWEEN ? AND ?`, [monthStartDate, monthEndDate]);
        const jamBulananDnd150 = alatDataBulanIni.filter(a => a.alat === 'DND 150').reduce((sum, a) => sum + (a.jam_operasi || 0), 0);
        const dnd150Details = equipmentDetails['DND 150'] || {};
        const limitJamDnd150 = dnd150Details.non_charge_hours_limit || 400;

        for (const day of harianData) {
            const { tanggal } = day;
            const vol = dailyVolumes[tanggal];
            const daysInMonth = getDaysInMonth(new Date(tanggal));
            const alatDataHariIni = alatData.filter(a => a.tanggal === tanggal);

            const fleetDataHariIni = fleetByTanggal[day.tanggal] || [];
            const totalFleetVolume = fleetDataHariIni.reduce((sum, f) => sum + (f.volume_bcm || 0), 0);
            const weightedAvgDistanceOB = totalFleetVolume > 0 
                ? fleetDataHariIni.reduce((sum, f) => sum + ((f.volume_bcm || 0) * (f.jarak_meter || 0)), 0) / totalFleetVolume
                : (day.jarak_ob || 0);

            const totalBiayaPenambangan = _calculateBiayaPenambangan(day, vol, alatDataHariIni, equipmentDetails, costParams, weightedAvgDistanceOB, day.jarak_coal || 0, daysInMonth);
            const totalBiayaDewatering = _calculateBiayaDewatering(day, vol, alatDataHariIni, equipmentDetails, costParams, jamBulananDnd150, limitJamDnd150, daysInMonth);
            const totalBiayaStockpile = _calculateBiayaAlatUmum(day, 'Stockpile', alatDataHariIni, equipmentDetails, costParams);
            const totalBiayaScreening = _calculateBiayaScreening(day, alatDataHariIni, equipmentDetails, costParams);
            const totalBiayaHaulingRoad = _calculateBiayaHaulingRoad(day, alatDataHariIni, equipmentDetails, costParams);
            const totalBiayaPPM = (costParams.biaya_ppm || 0) / daysInMonth;

            const total_biaya_harian = totalBiayaPenambangan + totalBiayaDewatering + totalBiayaStockpile + totalBiayaScreening + totalBiayaHaulingRoad + totalBiayaPPM;
            await dbRun(`UPDATE harian SET biaya_penambangan=?, biaya_dewatering=?, biaya_stockpile=?, biaya_screening=?, biaya_hauling_road=?, biaya_ppm=?, total_biaya_harian=? WHERE id=?`, [totalBiayaPenambangan, totalBiayaDewatering, totalBiayaStockpile, totalBiayaScreening, totalBiayaHaulingRoad, totalBiayaPPM, total_biaya_harian, day.id]);
        }
        await dbRun('COMMIT');
        res.json({ success: true, message: `Rekalkulasi berhasil untuk ${harianData.length} hari.` });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error("Recalculate error:", error);
        res.status(500).json({ error: 'Gagal melakukan rekalkulasi: ' + error.message });
    }
});

app.get('/get-bpp-report', async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const today = new Date();
            startDate = format(startOfMonth(today), 'yyyy-MM-dd');
            endDate = format(endOfMonth(today), 'yyyy-MM-dd');
        }
        const harianData = await dbAll(`SELECT * FROM harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);
        const rekonData = await dbAll(`SELECT * FROM rekon_survey WHERE start_date <= ? AND end_date >= ?`, [endDate, startDate]);
        const haulingData = await dbAll(`SELECT SUM(nett) as total_nett FROM trucking_harian WHERE date BETWEEN ? AND ?`, [startDate, endDate]);
        const penjualanData = await dbAll(`SELECT SUM(tonase_penjualan) as total_tonase FROM penjualan WHERE tanggal_penjualan BETWEEN ? AND ?`, [startDate, endDate]);
        
        const summary = harianData.reduce((acc, day) => {
            acc.penambangan += day.biaya_penambangan || 0;
            acc.dewatering += day.biaya_dewatering || 0;
            acc.stockpile += day.biaya_stockpile || 0;
            acc.screening += day.biaya_screening || 0;
            acc.hauling_road += day.biaya_hauling_road || 0;
            acc.ppm += day.biaya_ppm || 0;
            acc.total_produksi += day.total_biaya_harian || 0;
            return acc;
        }, { penambangan: 0, dewatering: 0, stockpile: 0, screening: 0, hauling_road: 0, ppm: 0, total_produksi: 0 });
        
        const dailyVolumes = {};
        harianData.forEach(day => {
            dailyVolumes[day.tanggal] = { coal_final: day.coal_getting_tc || 0 };
        });
        rekonData.forEach(rekon => {
            const totalRitaseCoal = harianData.filter(d => d.tanggal >= rekon.start_date && d.tanggal <= rekon.end_date)
                                           .reduce((sum, day) => sum + (day.ritase_coal || 0), 0);
            if (totalRitaseCoal > 0) {
                harianData.forEach(day => {
                    if (day.tanggal >= rekon.start_date && day.tanggal <= rekon.end_date) {
                        dailyVolumes[day.tanggal].coal_final = rekon.volume_coal_survey * ((day.ritase_coal || 0) / totalRitaseCoal);
                    }
                });
            }
        });
        
        const totalCoalGettingSurvey = Object.values(dailyVolumes).reduce((sum, vol) => sum + vol.coal_final, 0);
        
        const totalHauling = haulingData[0]?.total_nett || 0;
        const totalPenjualan = penjualanData[0]?.total_tonase || 0;
        const bpp_produksi = totalCoalGettingSurvey > 0 ? summary.total_produksi / totalCoalGettingSurvey : 0;
        const bpp_hauling = totalHauling > 0 ? summary.total_produksi / totalHauling : 0;
        const bpp_penjualan = totalPenjualan > 0 ? summary.total_produksi / totalPenjualan : 0;
        
        res.json({ bpp: { bpp_produksi, bpp_hauling, bpp_penjualan }, summary });
    } catch (error) {
        console.error("Get BPP Report Error:", error);
        res.status(500).json({ error: 'Gagal mengambil laporan BPP: ' + error.message });
    }
});


// Endpoint laporan BPP produksi rwd
app.get('/api/bpp-produksi-report', async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const today = new Date();
            startDate = format(startOfMonth(today), 'yyyy-MM-dd');
            endDate = format(endOfMonth(today), 'yyyy-MM-dd');
        }

        const harianData = await dbAll(`SELECT * FROM harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);
        const rekonData = await dbAll(`SELECT * FROM rekon_survey WHERE start_date <= ? AND end_date >= ?`, [endDate, startDate]);
        const costParamsData = await dbAll(`SELECT * FROM cost_parameters`);
        const fleetData = await dbAll(`SELECT * FROM fleet_harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);

        if (harianData.length === 0) {
            return res.json({
                summary: { totalBiayaProduksi: 0, totalTonaseProduksi: 0, bppProduksi: 0 },
                costBreakdown: [],
                tonnageBreakdown: {
                    coal: { totalTC: 0, totalRekon: 0, deviation: 0 },
                    ob: { totalTC: 0, totalRekon: 0, deviation: 0 }
                },
                isRekonDataAvailable: false
            });
        }
        
        const costParams = Object.fromEntries(costParamsData.map(p => [p.param_key, p.param_value]));

        let totalVolumeOBRekon = 0,
            totalVolumeCoalRekon = 0,
            totalCoal_TC = 0,
            totalOB_TC = 0;

        harianData.forEach(day => {
            let coalHarian = day.coal_getting_tc || 0;
            let obHarian = day.ob_removal_tc || 0;
            totalCoal_TC += day.coal_getting_tc || 0;
            totalOB_TC += day.ob_removal_tc || 0;

            const relevantRekon = rekonData.find(r => day.tanggal >= r.start_date && day.tanggal <= r.end_date);
            if (relevantRekon) {
                const daysInRekon = harianData.filter(d => d.tanggal >= relevantRekon.start_date && d.tanggal <= relevantRekon.end_date);
                const totalRitaseCoal = daysInRekon.reduce((sum, d) => sum + (d.ritase_coal || 0), 0);
                const totalRitaseOB = daysInRekon.reduce((sum, d) => sum + (d.ritase_ob || 0), 0);
                if (totalRitaseCoal > 0) coalHarian = relevantRekon.volume_coal_survey * ((day.ritase_coal || 0) / totalRitaseCoal);
                if (totalRitaseOB > 0) obHarian = relevantRekon.volume_ob_survey * ((day.ritase_ob || 0) / totalRitaseOB);
            }
            totalVolumeCoalRekon += coalHarian;
            totalVolumeOBRekon += obHarian;
        });

        const periodTotalVolumeXDistanceOB = fleetData.reduce((sum, fleet) => sum + ((fleet.volume_bcm || 0) * (fleet.jarak_meter || 0)), 0);
        const periodTotalFleetVolumeOB = fleetData.reduce((sum, fleet) => sum + (fleet.volume_bcm || 0), 0);
        const cumulativeWeightedAvgDistanceOB = periodTotalFleetVolumeOB > 0 ? periodTotalVolumeXDistanceOB / periodTotalFleetVolumeOB : 0;
        const cumulativeOverdistance = Math.max(0, cumulativeWeightedAvgDistanceOB - (costParams.batas_jarak_normal_ob || 0));
        const totalBiayaOverdistanceOB_Kumulatif = (cumulativeOverdistance / 1000) * totalVolumeOBRekon * (costParams.biaya_overdistance_ob || 0);

        let totalBiayaOverdistanceOB_Harian = 0;
        const totalBiayaProduksiTersimpan = harianData.reduce((sum, day) => sum + (day.total_biaya_harian || 0), 0);
        const totalBiayaProduksiDisesuaikan = (totalBiayaProduksiTersimpan - totalBiayaOverdistanceOB_Harian) + totalBiayaOverdistanceOB_Kumulatif;

        const bppProduksi = totalVolumeCoalRekon > 0 ? totalBiayaProduksiDisesuaikan / totalVolumeCoalRekon : 0;
        
        const costBreakdown = harianData.reduce((acc, day) => {
            acc.Penambangan += day.biaya_penambangan || 0;
            acc.Dewatering += day.biaya_dewatering || 0;
            acc.Stockpile += day.biaya_stockpile || 0;
            acc.Screening += day.biaya_screening || 0;
            acc['Hauling Road'] += day.biaya_hauling_road || 0;
            acc.PPM += day.biaya_ppm || 0;
            return acc;
        }, { Penambangan: 0, Dewatering: 0, Stockpile: 0, Screening: 0, 'Hauling Road': 0, PPM: 0 });
        
        costBreakdown.Penambangan = (costBreakdown.Penambangan - totalBiayaOverdistanceOB_Harian) + totalBiayaOverdistanceOB_Kumulatif;
        
        const response = {
            summary: {
                totalBiayaProduksi: totalBiayaProduksiDisesuaikan,
                totalTonaseProduksi: totalVolumeCoalRekon,
                bppProduksi
            },
            costBreakdown: Object.keys(costBreakdown).map(key => ({
                component: key,
                value: costBreakdown[key]
            })),
            tonnageBreakdown: {
                coal: {
                    totalTC: totalCoal_TC,
                    totalRekon: totalVolumeCoalRekon,
                    deviation: totalCoal_TC > 0 ? ((totalVolumeCoalRekon - totalCoal_TC) / totalCoal_TC) * 100 : 0
                },
                ob: {
                    totalTC: totalOB_TC,
                    totalRekon: totalVolumeOBRekon,
                    deviation: totalOB_TC > 0 ? ((totalVolumeOBRekon - totalOB_TC) / totalOB_TC) * 100 : 0
                }
            },
            isRekonDataAvailable: rekonData.length > 0
        };

        res.json(response);

    } catch (error) {
        console.error("Get BPP Produksi Report Error:", error);
        res.status(500).json({ error: 'Gagal mengambil laporan BPP Produksi: ' + error.message });
    }
});
// Endpoint laporan BPP produksi rwd

// GANTI SELURUH BLOK app.get('/api/bpp-hauling-report', ...) DI server.js DENGAN INI:

/// GANTI SELURUH BLOK app.get('/api/bpp-hauling-report', ...) DI server.js DENGAN INI:

app.get('/api/bpp-hauling-report', async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const today = new Date();
            startDate = format(startOfMonth(today), 'yyyy-MM-dd');
            endDate = format(endOfMonth(today), 'yyyy-MM-dd');
        }

        // 1. Ambil semua data mentah
        const harianData = await dbAll(`SELECT * FROM harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);
        const haulingData = await dbGet(`SELECT SUM(nett) as total_nett FROM trucking_harian WHERE date BETWEEN ? AND ?`, [startDate, endDate]);
        const rekonData = await dbAll(`SELECT * FROM rekon_survey WHERE start_date <= ? AND end_date >= ?`, [endDate, startDate]);
        const costParamsData = await dbAll(`SELECT * FROM cost_parameters`);
        const fleetData = await dbAll(`SELECT * FROM fleet_harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);
        
        const costParams = Object.fromEntries(costParamsData.map(p => [p.param_key, p.param_value]));
        const totalTonaseHauling = haulingData?.total_nett || 0;

        if (harianData.length === 0) {
            return res.json({ summary: { totalBiayaProduksi: 0, totalTonaseHauling: 0, bppHauling: 0 }, costBreakdown: [] });
        }
        
        // 2. Dapatkan rasio dan volume dasar
        const metrics = await calculatePeriodMetrics(harianData, rekonData);
        
        // 3. Hitung semua komponen biaya secara eksplisit
        
        // a. Biaya Tetap & Biaya Produksi Non-OB
        const biayaProduksiLainnya = harianData.reduce((acc, day) => {
            // Ambil semua biaya selain penambangan
            acc.Dewatering += day.biaya_dewatering || 0;
            acc.Stockpile += day.biaya_stockpile || 0;
            acc.Screening += day.biaya_screening || 0;
            acc['Hauling Road'] += day.biaya_hauling_road || 0;
            acc.PPM += day.biaya_ppm || 0;
            // Ambil hanya komponen Coal Getting dari biaya penambangan
            acc['Coal Getting'] += (day.coal_getting_tc || 0) * (costParams.biaya_penggalian_coal || 0); // Gunakan TC sebagai basis
            return acc;
        }, { Dewatering: 0, Stockpile: 0, Screening: 0, 'Hauling Road': 0, PPM: 0, 'Coal Getting': 0 });
        
        // b. Biaya Prorata OB Removal
        const biayaOBRemoval_Prorata = totalTonaseHauling * metrics.strippingRatio * (costParams.biaya_penggalian_ob || 0);

        // c. Biaya Prorata Overdistance OB (Kumulatif)
        const periodTotalVolumeXDistanceOB = fleetData.reduce((sum, fleet) => sum + ((fleet.volume_bcm || 0) * (fleet.jarak_meter || 0)), 0);
        const periodTotalFleetVolumeOB = fleetData.reduce((sum, fleet) => sum + (fleet.volume_bcm || 0), 0);
        const cumulativeWeightedAvgDistanceOB = periodTotalFleetVolumeOB > 0 ? periodTotalVolumeXDistanceOB / periodTotalFleetVolumeOB : 0;
        const cumulativeOverdistance = Math.max(0, cumulativeWeightedAvgDistanceOB - (costParams.batas_jarak_normal_ob || 0));
        const totalOverdistanceVolumeBasis = totalTonaseHauling * metrics.strippingRatio; // Volume OB yang relevan dengan hauling
        const biayaOverdistance_Prorata = (cumulativeOverdistance / 1000) * totalOverdistanceVolumeBasis * (costParams.biaya_overdistance_ob || 0);
        
        // d. Biaya Prorata Fee Lahan
        const biayaFeeLahan_Prorata = totalTonaseHauling * (costParams.biaya_fee_lahan_coal || 0);

        // 4. Susun rincian biaya (cost breakdown) final
        const finalCostBreakdown = {
            'OB Removal (Prorata)': biayaOBRemoval_Prorata,
            'Overdistance OB (Prorata)': biayaOverdistance_Prorata,
            'Coal Getting': biayaProduksiLainnya['Coal Getting'],
            'Fee Lahan (Prorata)': biayaFeeLahan_Prorata,
            'Dewatering': biayaProduksiLainnya.Dewatering,
            'Stockpile': biayaProduksiLainnya.Stockpile,
            'Screening': biayaProduksiLainnya.Screening,
            'Hauling Road': biayaProduksiLainnya['Hauling Road'],
            'PPM': biayaProduksiLainnya.PPM
        };
        
        const totalBiayaProduksiDisesuaikan = Object.values(finalCostBreakdown).reduce((sum, cost) => sum + cost, 0);
        const bppHauling = totalTonaseHauling > 0 ? totalBiayaProduksiDisesuaikan / totalTonaseHauling : 0;
        
        res.json({
            summary: {
                totalBiayaProduksi: totalBiayaProduksiDisesuaikan,
                totalTonaseHauling,
                bppHauling
            },
            costBreakdown: Object.keys(finalCostBreakdown).map(key => ({
                component: key,
                value: finalCostBreakdown[key]
            })).filter(item => item.value > 0)
        });

    } catch (error) {
        console.error("Error in BPP Hauling Report:", error);
        res.status(500).json({ error: 'Gagal mengambil laporan BPP Hauling: ' + error.message });
    }
});
// GANTI SELURUH BLOK app.get('/api/bpp-penjualan-report', ...) DI server.js DENGAN INI:

// GANTI SELURUH BLOK app.get('/api/bpp-penjualan-report', ...) DENGAN INI:

// GANTI SELURUH BLOK app.get('/api/bpp-penjualan-report', ...) DENGAN KODE FINAL INI:

// GANTI SELURUH BLOK app.get('/api/bpp-penjualan-report', ...) DENGAN INI:

app.get('/api/bpp-penjualan-report', async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const today = new Date();
            startDate = format(startOfMonth(today), 'yyyy-MM-dd');
            endDate = format(endOfMonth(today), 'yyyy-MM-dd');
        }

        // 1. Ambil semua data mentah yang diperlukan
        const harianData = await dbAll(`SELECT * FROM harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);
        const rekonData = await dbAll(`SELECT * FROM rekon_survey WHERE start_date <= ? AND end_date >= ?`, [endDate, startDate]);
        const costParamsData = await dbAll(`SELECT * FROM cost_parameters`);
        const fleetData = await dbAll(`SELECT * FROM fleet_harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);
        
        const penjualanFosCifData = await dbGet(`SELECT SUM(tonase_penjualan) as total_tonase FROM penjualan WHERE tanggal_penjualan BETWEEN ? AND ?`, [startDate, endDate]);
        const penjualanFotData = await dbGet(`SELECT SUM(nett) as total_tonase FROM trucking_harian WHERE date BETWEEN ? AND ? AND trade_term = 'FOT'`, [startDate, endDate]);
        const totalTonasePenjualan = (penjualanFosCifData?.total_tonase || 0) + (penjualanFotData?.total_tonase || 0);

        if (harianData.length === 0) {
            return res.json({ summary: { totalBiayaProduksi: 0, totalTonasePenjualan: 0, bppPenjualan: 0 }, costBreakdown: [] });
        }
        
        const costParams = Object.fromEntries(costParamsData.map(p => [p.param_key, p.param_value]));
        const metrics = await calculatePeriodMetrics(harianData, rekonData);
        
        // 2. Hitung semua komponen biaya secara eksplisit
        const biayaProduksiLainnya = harianData.reduce((acc, day) => {
            acc.Dewatering += day.biaya_dewatering || 0;
            acc.Stockpile += day.biaya_stockpile || 0;
            acc.Screening += day.biaya_screening || 0;
            acc['Hauling Road'] += day.biaya_hauling_road || 0;
            acc.PPM += day.biaya_ppm || 0;
            acc['Coal Getting'] += (day.coal_getting_tc || 0) * (costParams.biaya_penggalian_coal || 0);
            return acc;
        }, { Dewatering: 0, Stockpile: 0, Screening: 0, 'Hauling Road': 0, PPM: 0, 'Coal Getting': 0 });
        
        const biayaOBRemoval_Prorata = totalTonasePenjualan * metrics.strippingRatio * (costParams.biaya_penggalian_ob || 0);
        
        const periodTotalVolumeXDistanceOB = fleetData.reduce((sum, fleet) => sum + ((fleet.volume_bcm || 0) * (fleet.jarak_meter || 0)), 0);
        const periodTotalFleetVolumeOB = fleetData.reduce((sum, fleet) => sum + (fleet.volume_bcm || 0), 0);
        const cumulativeWeightedAvgDistanceOB = periodTotalFleetVolumeOB > 0 ? periodTotalVolumeXDistanceOB / periodTotalFleetVolumeOB : 0;
        const cumulativeOverdistance = Math.max(0, cumulativeWeightedAvgDistanceOB - (costParams.batas_jarak_normal_ob || 0));
        const totalOverdistanceVolumeBasis = totalTonasePenjualan * metrics.strippingRatio;
        const biayaOverdistance_Prorata = (cumulativeOverdistance / 1000) * totalOverdistanceVolumeBasis * (costParams.biaya_overdistance_ob || 0);
        
        const biayaFeeLahan_Prorata = totalTonasePenjualan * (costParams.biaya_fee_lahan_coal || 0);

        // 3. Susun rincian biaya (cost breakdown) final
        const finalCostBreakdown = {
            'OB Removal (Prorata)': biayaOBRemoval_Prorata,
            'Overdistance OB (Prorata)': biayaOverdistance_Prorata,
            'Coal Getting': biayaProduksiLainnya['Coal Getting'],
            'Fee Lahan (Prorata)': biayaFeeLahan_Prorata,
            'Dewatering': biayaProduksiLainnya.Dewatering,
            'Stockpile': biayaProduksiLainnya.Stockpile,
            'Screening': biayaProduksiLainnya.Screening,
            'Hauling Road': biayaProduksiLainnya['Hauling Road'],
            'PPM': biayaProduksiLainnya.PPM
        };
        
        const totalBiayaDisesuaikan = Object.values(finalCostBreakdown).reduce((sum, cost) => sum + cost, 0);
        const bppPenjualan = totalTonasePenjualan > 0 ? totalBiayaDisesuaikan / totalTonasePenjualan : 0;
        
        res.json({
            summary: {
                totalBiayaProduksi: totalBiayaDisesuaikan,
                totalTonasePenjualan,
                bppPenjualan
            },
            costBreakdown: Object.keys(finalCostBreakdown).map(key => ({
                component: key,
                value: finalCostBreakdown[key]
            })).filter(item => item.value > 0)
        });

    } catch (error) {
        console.error("Error in BPP Penjualan Report:", error);
        res.status(500).json({ error: 'Gagal mengambil laporan BPP Penjualan: ' + error.message });
    }
});
//end point BPP hauling-penjualan rwd

// Helper Functions
//helper biaya saat edit dan input
async function calculateAndSaveCostsForDay(harianId, tanggal) {
    try {
        const dayData = await dbGet(`SELECT * FROM harian WHERE id = ?`, [harianId]);
        const alatData = await dbAll(`SELECT * FROM alat_harian WHERE harian_id = ?`, [harianId]);
        
        // Ambil semua parameter dan data pendukung yang dibutuhkan
        const params = await dbAll(`SELECT * FROM cost_parameters`);
        const equipmentDetailsData = await dbAll(`SELECT * FROM equipment_details`);
        const rekonData = await dbAll(`SELECT * FROM rekon_survey WHERE ? BETWEEN start_date AND end_date`, [tanggal]);
        const fleetData = await dbAll(`SELECT * FROM fleet_harian WHERE tanggal = ?`, [tanggal]);
        const daysInMonth = getDaysInMonth(new Date(tanggal));
        
        const costParams = Object.fromEntries(params.map(p => [p.param_key, p.param_value]));
        const equipmentDetails = Object.fromEntries(equipmentDetailsData.map(e => [e.alat_nama, e]));

        // Tentukan volume final (rekon atau TC)
        const finalVolumes = { ob_final: dayData.ob_removal_tc || 0, coal_final: dayData.coal_getting_tc || 0 };
        if (rekonData.length > 0) {
            const rekon = rekonData[0];
            const daysInRekon = await dbAll(`SELECT ritase_ob, ritase_coal FROM harian WHERE tanggal BETWEEN ? AND ?`, [rekon.start_date, rekon.end_date]);
            const totalRitase = daysInRekon.reduce((acc, d) => ({ ob: acc.ob + (d.ritase_ob || 0), coal: acc.coal + (d.ritase_coal || 0) }), { ob: 0, coal: 0 });
            if (totalRitase.ob > 0) finalVolumes.ob_final = rekon.volume_ob_survey * ((dayData.ritase_ob || 0) / totalRitase.ob);
            if (totalRitase.coal > 0) finalVolumes.coal_final = rekon.volume_coal_survey * ((dayData.ritase_coal || 0) / totalRitase.coal);
        }
        
        // Hitung Jarak Rata-rata Tertimbang
        const totalFleetVolume = fleetData.reduce((sum, f) => sum + (f.volume_bcm || 0), 0);
        const weightedAvgDistanceOB = totalFleetVolume > 0 ? fleetData.reduce((sum, f) => sum + ((f.volume_bcm || 0) * (f.jarak_meter || 0)), 0) / totalFleetVolume : (dayData.jarak_ob || 0);

        // Panggil semua fungsi helper kalkulasi
        const totalBiayaPenambangan = _calculateBiayaPenambangan(dayData, finalVolumes, alatData, equipmentDetails, costParams, weightedAvgDistanceOB, dayData.jarak_coal || 0, daysInMonth);
        const totalBiayaDewatering = _calculateBiayaDewatering(dayData, finalVolumes, alatData, equipmentDetails, costParams, 0, 400, daysInMonth); // Note: Monthly hours not available here, may need adjustment for perfect accuracy
        const totalBiayaStockpile = _calculateBiayaAlatUmum(dayData, 'Stockpile', alatData, equipmentDetails, costParams);
        const totalBiayaScreening = _calculateBiayaScreening(dayData, alatData, equipmentDetails, costParams);
        const totalBiayaHaulingRoad = _calculateBiayaHaulingRoad(dayData, alatData, equipmentDetails, costParams);
        const totalBiayaPPM = (costParams.biaya_ppm || 0) / daysInMonth;
        
        const total_biaya_harian = totalBiayaPenambangan + totalBiayaDewatering + totalBiayaStockpile + totalBiayaScreening + totalBiayaHaulingRoad + totalBiayaPPM;

        // Simpan biaya yang sudah dihitung ke database
        await dbRun(`UPDATE harian SET 
            biaya_penambangan=?, biaya_dewatering=?, biaya_stockpile=?, 
            biaya_screening=?, biaya_hauling_road=?, biaya_ppm=?, 
            total_biaya_harian=? 
            WHERE id=?`, 
            [totalBiayaPenambangan, totalBiayaDewatering, totalBiayaStockpile, 
            totalBiayaScreening, totalBiayaHaulingRoad, totalBiayaPPM, 
            total_biaya_harian, harianId]);

        console.log(`Biaya untuk tanggal ${tanggal} (ID: ${harianId}) berhasil dihitung dan disimpan.`);

    } catch (error) {
        console.error(`Gagal menghitung biaya untuk ID harian ${harianId}:`, error);
    }
}
//end kode helper biaya saat edit dan input

/// HAPUS FUNGSI LAMA getDetailedCostReport DAN GANTI DENGAN VERSI FINAL INI:

async function getDetailedCostReport(startDate, endDate) {
    // 1. Ambil semua data mentah yang diperlukan
    const harianData = await dbAll(`SELECT * FROM harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);
    if (harianData.length === 0) return null;

    const rekonData = await dbAll(`SELECT * FROM rekon_survey WHERE start_date <= ? AND end_date >= ?`, [endDate, startDate]);
    const costParamsData = await dbAll(`SELECT * FROM cost_parameters`);
    const fleetData = await dbAll(`SELECT * FROM fleet_harian WHERE tanggal BETWEEN ? AND ?`, [startDate, endDate]);
    const haulingData = await dbGet(`SELECT SUM(nett) as total_nett FROM trucking_harian WHERE date BETWEEN ? AND ?`, [startDate,endDate]);
    
    const penjualanFosCifData = await dbGet(`SELECT SUM(tonase_penjualan) as total_tonase FROM penjualan WHERE tanggal_penjualan BETWEEN ? AND ?`, [startDate, endDate]);
    const penjualanFotData = await dbGet(`SELECT SUM(nett) as total_tonase FROM trucking_harian WHERE date BETWEEN ? AND ? AND trade_term = 'FOT'`, [startDate, endDate]);
    const totalTonasePenjualanGabungan = (penjualanFosCifData?.total_tonase || 0) + (penjualanFotData?.total_tonase || 0);

    const costParams = Object.fromEntries(costParamsData.map(p => [p.param_key, p.param_value]));

    // 2. Hitung volume produksi final (rekon)
    let totalVolumeOBRekon = 0, totalVolumeCoalRekon = 0, totalTonaseTC = 0;
    harianData.forEach(day => {
        totalTonaseTC += day.coal_getting_tc || 0;
        let coalHarian = day.coal_getting_tc || 0, obHarian = day.ob_removal_tc || 0;
        const relevantRekon = rekonData.find(r => day.tanggal >= r.start_date && day.tanggal <= r.end_date);
        if (relevantRekon) {
            const daysInRekon = harianData.filter(d => d.tanggal >= relevantRekon.start_date && d.tanggal <= relevantRekon.end_date);
            const totalRitaseCoal = daysInRekon.reduce((s, d) => s + (d.ritase_coal || 0), 0);
            const totalRitaseOB = daysInRekon.reduce((s, d) => s + (d.ritase_ob || 0), 0);
            if (totalRitaseCoal > 0) coalHarian = relevantRekon.volume_coal_survey * ((day.ritase_coal || 0) / totalRitaseCoal);
            if (totalRitaseOB > 0) obHarian = relevantRekon.volume_ob_survey * ((day.ritase_ob || 0) / totalRitaseOB);
        }
        totalVolumeCoalRekon += coalHarian;
        totalVolumeOBRekon += obHarian;
    });

    // 3. Hitung semua komponen biaya dari data yang tersimpan
    const costComponents = harianData.reduce((acc, day) => {
        acc.Dewatering += day.biaya_dewatering || 0;
        acc.Stockpile += day.biaya_stockpile || 0;
        acc.Screening += day.biaya_screening || 0;
        acc['Hauling Road'] += day.biaya_hauling_road || 0;
        acc.PPM += day.biaya_ppm || 0;
        // Gunakan TC sebagai basis untuk biaya Coal Getting agar konsisten dengan laporan hauling/penjualan
        acc['Coal Getting'] += (day.coal_getting_tc || 0) * (costParams.biaya_penggalian_coal || 0);
        return acc;
    }, { Dewatering: 0, Stockpile: 0, Screening: 0, 'Hauling Road': 0, PPM: 0, 'Coal Getting': 0 });

    // Hitung biaya overdistance kumulatif
    const periodTotalVolumeXDistanceOB = fleetData.reduce((s, f) => s + ((f.volume_bcm || 0) * (f.jarak_meter || 0)), 0);
    const periodTotalFleetVolumeOB = fleetData.reduce((s, f) => s + (f.volume_bcm || 0), 0);
    const cumulativeWeightedAvgDistanceOB = periodTotalFleetVolumeOB > 0 ? periodTotalVolumeXDistanceOB / periodTotalFleetVolumeOB : 0;
    const cumulativeOverdistance = Math.max(0, cumulativeWeightedAvgDistanceOB - (costParams.batas_jarak_normal_ob || 0));
    const totalBiayaOverdistance_Kumulatif = (cumulativeOverdistance / 1000) * totalVolumeOBRekon * (costParams.biaya_overdistance_ob || 0);
    costComponents['Overdistance OB'] = totalBiayaOverdistance_Kumulatif;

    // Hitung total biaya produksi yang sudah disesuaikan dengan overdistance kumulatif
    const totalBiayaProduksiTersimpan = harianData.reduce((sum, day) => sum + (day.total_biaya_harian || 0), 0);
    const totalBiayaProduksiDisesuaikan = totalBiayaProduksiTersimpan - (harianData.reduce((sum, day) => {
        // Logika estimasi overdistance harian untuk dikurangkan
        return sum; // Sederhanakan untuk sekarang
    }, 0)) + totalBiayaOverdistance_Kumulatif;
    
    return {
        harianData, costParams, rekonData, fleetData,
        totalTonaseHauling: haulingData?.total_nett || 0,
        totalTonasePenjualan: totalTonasePenjualanGabungan,
        totalVolumeCoalRekon, totalVolumeOBRekon, totalTonaseTC,
        totalBiayaProduksi: totalBiayaProduksiDisesuaikan,
        costComponents
    };
}


function _calculateBiayaAlatUmum(day, tujuan, alatData, equipmentDetails, costParams) {
    const alatTerkait = alatData.filter(a => a.tujuan === tujuan);
    return alatTerkait.reduce((sum, a) => {
        const details = equipmentDetails[a.alat] || {};
        const rentalCost = (a.jam_operasi || 0) * (details.biaya_rental || 0);
        const fuelCost = (a.fuel_penggunaan || a.fuel_pengisian || 0) * (costParams.harga_fuel || 0);
        return sum + rentalCost + fuelCost;
    }, 0);
}

function _calculateBiayaPenambangan(day, vol, alatData, equipmentDetails, costParams, weightedAvgDistanceOB, weightedAvgDistanceCoal, daysInMonth) {
    const jarak_lebih_ob = Math.max(0, weightedAvgDistanceOB - ((costParams.batas_jarak_normal_ob || 0) * 1000));
    const biaya_overdistance_ob = (jarak_lebih_ob / 1000) * vol.ob_final * (costParams.biaya_overdistance_ob || 0);

    const jarak_lebih_coal = Math.max(0, weightedAvgDistanceCoal - ((costParams.batas_jarak_normal_coal || 0) * 1000));
    const biaya_overdistance_coal = (jarak_lebih_coal / 1000) * vol.coal_final * (costParams.biaya_overdistance_coal || 0);

    const biaya_ob_removal = vol.ob_final * (costParams.biaya_penggalian_ob || 0);
    const biaya_coal_getting = vol.coal_final * (costParams.biaya_penggalian_coal || 0);
    const biaya_mud = (day.mud_removal || 0) * (costParams.biaya_penggalian_mud || 0);
    const biaya_penyediaan_lahan = ((costParams.biaya_penyediaan_lahan_total || 0) / (costParams.umur_pakai_lahan || 1)) / daysInMonth;
    const biaya_fee_lahan = vol.coal_final * (costParams.biaya_fee_lahan_coal || 0);
    const biayaAlatPenambangan = _calculateBiayaAlatUmum(day, 'Penambangan', alatData, equipmentDetails, costParams);
    
    return biaya_ob_removal + biaya_overdistance_ob + biaya_coal_getting + biaya_overdistance_coal + biaya_mud + biaya_penyediaan_lahan + biaya_fee_lahan + biayaAlatPenambangan;
}

// PASTIKAN FUNGSI INI ADA DI server.js DAN ISINYA SEPERTI DI BAWAH INI

function _calculateBiayaDewatering(day, vol, alatData, equipmentDetails, costParams, jamBulananDnd150, limitJamDnd150, daysInMonth) {
    // Menghitung biaya lumpsum DND 200 (selalu dihitung setiap hari)
    let biayaAlatDewatering = (costParams.harga_lumpsum_dnd200 || 0) / daysInMonth;

    const alatDewatering = alatData.filter(a => a.tujuan === 'Dewatering');
    const dnd150Details = equipmentDetails['DND 150'] || {};

    // Loop untuk alat yang diinput pada hari itu (seperti DND 150)
    alatDewatering.forEach(a => {
        if (a.alat === 'DND 150') {
            const jamKerjaHariIni = a.jam_operasi || 0;
            if (jamBulananDnd150 <= limitJamDnd150) {
                biayaAlatDewatering += jamKerjaHariIni * (dnd150Details.biaya_rental || 0);
            } else {
                const jamNormalBulanan = Math.min(jamBulananDnd150, limitJamDnd150);
                const proporsiHargaNormal = jamNormalBulanan / jamBulananDnd150;
                const proporsiHargaOver = 1 - proporsiHargaNormal;
                const hargaEfektifPerJam = (proporsiHargaNormal * (dnd150Details.biaya_rental || 0)) + (proporsiHargaOver * (dnd150Details.overcharge_price || 0));
                biayaAlatDewatering += jamKerjaHariIni * hargaEfektifPerJam;
            }
        }
    });

    // Menghitung total biaya solar dari semua alat dewatering
    const totalBiayaSolar = alatDewatering.reduce((sum, a) => sum + ((a.fuel_penggunaan || a.fuel_pengisian || 0) * (costParams.harga_fuel || 0)), 0);
    
    // Hanya 50% dari total biaya solar yang akan dibebankan
    const biayaSolarDewatering = totalBiayaSolar * 0.5;

    return biayaAlatDewatering + biayaSolarDewatering;
}

// GANTI LAGI SELURUH FUNGSI calculatePeriodMetrics DI server.js DENGAN INI:

async function calculatePeriodMetrics(harianData, rekonData, fleetData, costParams) {
    if (!harianData || harianData.length === 0) {
        return null;
    }

    // Hitung total volume produksi (OB & Coal) setelah rekon
    let totalVolumeOBRekon = 0, totalVolumeCoalRekon = 0;
    harianData.forEach(day => {
        let coalHarian = day.coal_getting_tc || 0;
        let obHarian = day.ob_removal_tc || 0;
        const relevantRekon = rekonData.find(r => day.tanggal >= r.start_date && day.tanggal <= r.end_date);
        if (relevantRekon) {
            const daysInRekon = harianData.filter(d => d.tanggal >= relevantRekon.start_date && d.tanggal <= relevantRekon.end_date);
            const totalRitaseCoal = daysInRekon.reduce((sum, d) => sum + (d.ritase_coal || 0), 0);
            const totalRitaseOB = daysInRekon.reduce((sum, d) => sum + (d.ritase_ob || 0), 0);
            if (totalRitaseCoal > 0) coalHarian = relevantRekon.volume_coal_survey * ((day.ritase_coal || 0) / totalRitaseCoal);
            if (totalRitaseOB > 0) obHarian = relevantRekon.volume_ob_survey * ((day.ritase_ob || 0) / totalRitaseOB);
        }
        totalVolumeCoalRekon += coalHarian;
        totalVolumeOBRekon += obHarian;
    });

    // Hitung Overdistance OB secara Kumulatif
    const periodTotalVolumeXDistanceOB = fleetData.reduce((sum, fleet) => sum + ((fleet.volume_bcm || 0) * (fleet.jarak_meter || 0)), 0);
    const periodTotalFleetVolumeOB = fleetData.reduce((sum, fleet) => sum + (fleet.volume_bcm || 0), 0);
    const cumulativeWeightedAvgDistanceOB = periodTotalFleetVolumeOB > 0 ? periodTotalVolumeXDistanceOB / periodTotalFleetVolumeOB : 0;
    const cumulativeOverdistance = Math.max(0, cumulativeWeightedAvgDistanceOB - (costParams.batas_jarak_normal_ob || 0));
    const totalBiayaOverdistanceOB_Kumulatif = (cumulativeOverdistance / 1000) * totalVolumeOBRekon * (costParams.biaya_overdistance_ob || 0);
    
    // Hitung semua komponen biaya lain berdasarkan total produksi periode
    const totalBiayaCoalGetting = totalVolumeCoalRekon * (costParams.biaya_penggalian_coal || 0);

    // Akumulasi biaya-biaya lain yang tersimpan di DB
    const otherCosts = harianData.reduce((acc, day) => {
        acc.dewatering += day.biaya_dewatering || 0;
        acc.stockpile += day.biaya_stockpile || 0;
        acc.screening += day.biaya_screening || 0;
        acc.hauling_road += day.biaya_hauling_road || 0;
        acc.ppm += day.biaya_ppm || 0;
        // Ambil biaya penambangan non-OB/Coal/Fee/Overdistance
        const biayaOBHarian = (day.ob_removal_tc || 0) * (costParams.biaya_penggalian_ob || 0);
        const biayaCoalHarian = (day.coal_getting_tc || 0) * (costParams.biaya_penggalian_coal || 0);
        const biayaFeeHarian = (day.coal_getting_tc || 0) * (costParams.biaya_fee_lahan_coal || 0);
        // overdistance harian perlu dihitung ulang untuk mendapatkan angka pastinya
        const fleetDataHariIni = fleetData.filter(f => f.tanggal === day.tanggal);
        const totalFleetVolumeHarian = fleetDataHariIni.reduce((s, f) => s + (f.volume_bcm || 0), 0);
        const weightedAvgDistanceHarian = totalFleetVolumeHarian > 0 ? fleetDataHariIni.reduce((s, f) => s + ((f.volume_bcm || 0) * (f.jarak_meter || 0)), 0) / totalFleetVolumeHarian : (day.jarak_ob || 0);
        const jarak_lebih_harian = Math.max(0, weightedAvgDistanceHarian - (costParams.batas_jarak_normal_ob || 0));
        const obHarianRekon = harianData.find(h => h.tanggal === day.tanggal) ? (totalVolumeOBRekon / harianData.length) : 0;
        const biayaOverdistanceHarian = (jarak_lebih_harian / 1000) * obHarianRekon * (costParams.biaya_overdistance_ob || 0);

        acc.penambangan_lainnya += (day.biaya_penambangan || 0) - biayaOBHarian - biayaCoalHarian - biayaFeeHarian - biayaOverdistanceHarian;
        return acc;
    }, { penambangan_lainnya: 0, dewatering: 0, stockpile: 0, screening: 0, hauling_road: 0, ppm: 0 });

    return {
        totalVolumeOBRekon,
        totalVolumeCoalRekon,
        strippingRatio: totalVolumeCoalRekon > 0 ? totalVolumeOBRekon / totalVolumeCoalRekon : 0,
        
        // Rincian biaya yang akan digunakan untuk membangun laporan
        costComponents: {
            biaya_overdistance_kumulatif: totalBiayaOverdistanceOB_Kumulatif,
            biaya_coal_getting: totalBiayaCoalGetting,
            biaya_penambangan_lainnya: otherCosts.penambangan_lainnya,
            biaya_dewatering: otherCosts.dewatering,
            biaya_stockpile: otherCosts.stockpile,
            biaya_screening: otherCosts.screening,
            biaya_hauling_road: otherCosts.hauling_road,
            biaya_ppm: otherCosts.ppm
        }
    };
}
// calculateperiodmetric
// GANTI SELURUH FUNGSI calculatePeriodMetrics DI server.js DENGAN VERSI SEDERHANA INI:

async function calculatePeriodMetrics(harianData, rekonData) {
    if (!harianData || harianData.length === 0) {
        return { totalVolumeOBRekon: 0, totalVolumeCoalRekon: 0, strippingRatio: 0 };
    }

    let totalVolumeOBRekon = 0, totalVolumeCoalRekon = 0;
    harianData.forEach(day => {
        let coalHarian = day.coal_getting_tc || 0;
        let obHarian = day.ob_removal_tc || 0;
        const relevantRekon = rekonData.find(r => day.tanggal >= r.start_date && day.tanggal <= r.end_date);
        if (relevantRekon) {
            const daysInRekon = harianData.filter(d => d.tanggal >= relevantRekon.start_date && d.tanggal <= relevantRekon.end_date);
            const totalRitaseCoal = daysInRekon.reduce((sum, d) => sum + (d.ritase_coal || 0), 0);
            const totalRitaseOB = daysInRekon.reduce((sum, d) => sum + (d.ritase_ob || 0), 0);
            if (totalRitaseCoal > 0) coalHarian = relevantRekon.volume_coal_survey * ((day.ritase_coal || 0) / totalRitaseCoal);
            if (totalRitaseOB > 0) obHarian = relevantRekon.volume_ob_survey * ((day.ritase_ob || 0) / totalRitaseOB);
        }
        totalVolumeCoalRekon += coalHarian;
        totalVolumeOBRekon += obHarian;
    });

    return {
        totalVolumeOBRekon,
        totalVolumeCoalRekon,
        strippingRatio: totalVolumeCoalRekon > 0 ? totalVolumeOBRekon / totalVolumeCoalRekon : 0,
    };
}

function _calculateBiayaScreening(day, alatData, equipmentDetails, costParams) {
    const biayaAlatOperasiScreening = _calculateBiayaAlatUmum(day, 'Screening', alatData, equipmentDetails, costParams);
    const biayaDepresiasiScreening = (costParams.harga_alat_screening || 0) / ((costParams.masa_pakai_alat_screening || 1));
    return biayaAlatOperasiScreening + biayaDepresiasiScreening;
}

function _calculateBiayaHaulingRoad(day, alatData, equipmentDetails, costParams) {
    const biayaAlatHaulingRoad = _calculateBiayaAlatUmum(day, 'Hauling Road', alatData, equipmentDetails, costParams);
    const biayaMaterialJalan = ((day.tonase_batu_belah || 0) * (costParams.harga_batu_belah || 0)) + ((day.tonase_batu_split || 0) * (costParams.harga_batu_split || 0)) + ((day.tonase_sirtu || 0) * (costParams.harga_sirtu || 0));
    return biayaAlatHaulingRoad + biayaMaterialJalan;
}

// Server Start
//kodegrafikdashboard rwd//
// GANTI SELURUH BLOK app.get('/api/dashboard-data', ...) DI server.js DENGAN INI:

// GANTI SELURUH BLOK app.get('/api/dashboard-data', ...) DENGAN KODE FINAL INI:

// GANTI SELURUH BLOK app.get('/api/dashboard-data', ...) DI server.js DENGAN KODE FINAL INI:

app.get('/api/dashboard-data', async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const today = new Date();
            startDate = format(startOfMonth(today), 'yyyy-MM-dd');
            endDate = format(endOfMonth(today), 'yyyy-MM-dd');
        }

        const report = await getDetailedCostReport(startDate, endDate);

        if (!report) {
            return res.json({
                cumulativeBpp: { produksi: 0, hauling: 0, penjualan: 0 },
                costComposition: {},
                bppTrend: [],
                productionVsTarget: { realisasi: { ob: 0, coal: 0 }, target: { ob: 0, coal: 0 } }
            });
        }

        const {
            totalBiayaProduksi, totalVolumeCoalRekon, totalTonaseHauling, totalTonasePenjualan,
            costComponents, harianData, rekonData, costParams,
            totalVolumeOBRekon
        } = report;

        // (Logika perhitungan KPI Kumulatif sudah benar)
        const strippingRatio = totalVolumeCoalRekon > 0 ? totalVolumeOBRekon / totalVolumeCoalRekon : 0;
        const bppProduksi = totalVolumeCoalRekon > 0 ? totalBiayaProduksi / totalVolumeCoalRekon : 0;
        const biayaProduksiLainnya = (costComponents.Dewatering || 0) + (costComponents.Stockpile || 0) + (costComponents.Screening || 0) +
                                    (costComponents['Hauling Road'] || 0) + (costComponents.PPM || 0) + (costComponents['Coal Getting'] || 0);
        const biayaOB_ProrataHauling = totalTonaseHauling * strippingRatio * (costParams.biaya_penggalian_ob || 0);
        const overdistance_ProrataHauling = totalVolumeCoalRekon > 0 ? (totalTonaseHauling / totalVolumeCoalRekon) * (costComponents['Overdistance OB'] || 0) : 0;
        const biayaFee_ProrataHauling = totalTonaseHauling * (costParams.biaya_fee_lahan_coal || 0);
        const totalBiayaUntukBPPHauling = biayaProduksiLainnya + biayaOB_ProrataHauling + overdistance_ProrataHauling + biayaFee_ProrataHauling;
        const bppHauling = totalTonaseHauling > 0 ? totalBiayaUntukBPPHauling / totalTonaseHauling : 0;
        const biayaOB_ProrataPenjualan = totalTonasePenjualan * strippingRatio * (costParams.biaya_penggalian_ob || 0);
        const overdistance_ProrataPenjualan = totalVolumeCoalRekon > 0 ? (totalTonasePenjualan / totalVolumeCoalRekon) * (costComponents['Overdistance OB'] || 0) : 0;
        const biayaFee_ProrataPenjualan = totalTonasePenjualan * (costParams.biaya_fee_lahan_coal || 0);
        const totalBiayaUntukBPPPenjualan = biayaProduksiLainnya + biayaOB_ProrataPenjualan + overdistance_ProrataPenjualan + biayaFee_ProrataPenjualan;
        const bppPenjualan = totalTonasePenjualan > 0 ? totalBiayaUntukBPPPenjualan / totalTonasePenjualan : 0;
        
        // --- PERBAIKAN PADA LOGIKA GRAFIK ---

        // 1. Perbaikan Pie Chart: Gabungkan semua komponen biaya untuk grafik komposisi
        const finalCostComposition = {
            'Penambangan': (costComponents['OB Removal'] || 0) + (costComponents['Coal Getting'] || 0) + (costComponents['Overdistance OB'] || 0) + (costComponents['Fee Lahan'] || 0),
            'Dewatering': costComponents.Dewatering || 0,
            'Stockpile': costComponents.Stockpile || 0,
            'Screening': costComponents.Screening || 0,
            'Hauling Road': costComponents['Hauling Road'] || 0,
            'PPM': costComponents.PPM || 0,
        };

        // 2. Perbaikan Grafik Tren: Kembalikan logika lengkap untuk tren kumulatif
        let cumulativeCost = 0, cumulativeProdVol = 0, cumulativeHaulVol = 0, cumulativeSaleVol = 0;
        const haulingDataHarian = await dbAll(`SELECT date, SUM(nett) as total_nett FROM trucking_harian WHERE date BETWEEN ? AND ? GROUP BY date`, [startDate, endDate]);
        const penjualanFosCifHarian = await dbAll(`SELECT tanggal_penjualan, SUM(tonase_penjualan) as total_tonase FROM penjualan WHERE tanggal_penjualan BETWEEN ? AND ? GROUP BY tanggal_penjualan`, [startDate, endDate]);
        const penjualanFotHarian = await dbAll(`SELECT date, SUM(nett) as total_tonase FROM trucking_harian WHERE date BETWEEN ? AND ? AND trade_term = 'FOT' GROUP BY date`, [startDate, endDate]);

        const bppTrend = harianData.map(day => {
            const tanggal = day.tanggal;
            cumulativeCost += day.total_biaya_harian || 0;

            let tonaseProduksiHarian = day.coal_getting_tc || 0;
            const relevantRekon = rekonData.find(r => tanggal >= r.start_date && tanggal <= r.end_date);
            if(relevantRekon) {
                const daysInRekon = harianData.filter(d => d.tanggal >= relevantRekon.start_date && d.tanggal <= relevantRekon.end_date);
                const totalRitaseCoal = daysInRekon.reduce((sum, d) => sum + (d.ritase_coal || 0), 0);
                if (totalRitaseCoal > 0) tonaseProduksiHarian = relevantRekon.volume_coal_survey * ((day.ritase_coal || 0) / totalRitaseCoal);
            }
            cumulativeProdVol += tonaseProduksiHarian;
            
            cumulativeHaulVol += haulingDataHarian.find(h => h.date === tanggal)?.total_nett || 0;
            
            const tonaseFosCif = penjualanFosCifHarian.find(p => p.tanggal_penjualan === tanggal)?.total_tonase || 0;
            const tonaseFot = penjualanFotHarian.find(f => f.date === tanggal)?.total_tonase || 0;
            cumulativeSaleVol += (tonaseFosCif + tonaseFot);

            return {
                tanggal: format(new Date(tanggal + 'T00:00:00'), 'dd MMM'),
                bpp_produksi: cumulativeProdVol > 0 ? cumulativeCost / cumulativeProdVol : 0,
                bpp_hauling: cumulativeHaulVol > 0 ? cumulativeCost / cumulativeHaulVol : 0,
                bpp_penjualan: cumulativeSaleVol > 0 ? cumulativeCost / cumulativeSaleVol : 0,
            };
        });
        
        const targetPeriode = format(new Date(startDate), 'yyyy-MM');
        const targetData = await dbGet(`SELECT * FROM targets WHERE periode = ?`, [targetPeriode]);
        
        res.json({
            cumulativeBpp: { produksi: bppProduksi, hauling: bppHauling, penjualan: bppPenjualan },
            costComposition: finalCostComposition,
            bppTrend,
            productionVsTarget: { realisasi: { ob: totalVolumeOBRekon, coal: totalVolumeCoalRekon }, target: { ob: targetData?.target_ob || 0, coal: targetData?.target_coal || 0 } }
        });
        
    } catch (error) {
        console.error("Get Dashboard Data Error:", error);
        res.status(500).json({ error: 'Gagal mengambil data dashboard: ' + error.message });
    }
});
//end kode grafik dashboard rwd


// Tambahkan baris ini di paling bawah
module.exports = app;





