document.addEventListener('DOMContentLoaded', () => {
    let jsonData = [];
    const expectedHeaders = ['date', 'shift', 'checkout_time', 'do_number', 'truck_number', 'driver_name', 'buyer', 'rom', 'port', 'trade_term', 'tare', 'gross', 'nett', 'notes'];
    
    const pasteArea = document.getElementById('paste-area');
    const uploadFile = document.getElementById('upload-file');
    const processBtn = document.getElementById('process-btn');
    const previewSection = document.getElementById('preview-section');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const imporArea = document.getElementById('impor-area');

    processBtn.addEventListener('click', () => {
        try {
            if (uploadFile.files.length > 0) handleFileUpload(uploadFile.files[0]);
            else if (pasteArea.value.trim() !== '') handlePasteData(pasteArea.value);
            else showNotification('Tidak ada data untuk diproses.', 'red');
        } catch (error) {
            showNotification(`Terjadi error: ${error.message}`, 'red');
            console.error("Processing Error:", error);
        }
    });
    
    cancelBtn.addEventListener('click', () => { 
        previewSection.classList.add('hidden'); 
        imporArea.classList.remove('hidden'); 
        pasteArea.value = ''; 
        uploadFile.value = ''; 
        jsonData = []; 
    });
    
    submitBtn.addEventListener('click', async () => {
        if (jsonData.length === 0) { 
            showNotification('Tidak ada data untuk disimpan.', 'red'); 
            return; 
        }
        submitBtn.disabled = true; 
        submitBtn.textContent = 'Menyimpan...';
        try {
            const res = await fetch('/submit-trucking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: jsonData }) });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);
            showNotification(result.message, 'green');
            cancelBtn.click();
        } catch (error) { 
            showNotification(`Gagal menyimpan: ${error.message}`, 'red'); 
        } finally { 
            submitBtn.disabled = false; 
            submitBtn.textContent = 'Simpan ke Database'; 
        }
    });

    function handleFileUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            const workbook = file.name.toLowerCase().endsWith('.csv') ? XLSX.read(data, { type: 'string' }) : XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });
            processData(rawJson);
        };
        if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
    }

    function handlePasteData(text) {
        const rows = text.trim().replace(/\r/g, '').split('\n').map(row => row.split('\t'));
        if (rows.length < 2) { 
            showNotification('Format data tidak valid. Pastikan ada header dan minimal 1 baris data.', 'red'); 
            return; 
        }
        const headers = rows[0];
        const dataRows = rows.slice(1);
        const rawJson = dataRows.map(row => {
            const obj = {};
            headers.forEach((header, i) => { obj[header.trim()] = row[i] || ''; });
            return obj;
        });
        processData(rawJson);
    }
    
    function processData(rawJson) {
        if (!rawJson || rawJson.length === 0) {
            showNotification('Tidak ada data yang bisa diproses.', 'red');
            return;
        }

        const normalizedData = rawJson.map(rawRow => {
            const newRow = {};
            const findValue = (variations) => {
                for (const key of Object.keys(rawRow)) {
                    const cleanKey = key.trim().toLowerCase().replace(/_/g, '').replace(/ /g, '');
                    if (variations.includes(cleanKey)) return rawRow[key];
                }
                return undefined;
            };
            
            newRow.do_number = findValue(['donumber']);
            newRow.rom = findValue(['rom']);
            newRow.port = findValue(['port']);
            newRow.trade_term = findValue(['tradeterm']);
            newRow.buyer = findValue(['buyer']);
            newRow.truck_number = findValue(['trucknumber']);
            newRow.driver_name = findValue(['drivername']);
            newRow.notes = findValue(['notes']);
            const rawDate = findValue(['date']);
            newRow.shift = findValue(['shift']);
            newRow.tare = findValue(['tare']);
            const rawCheckoutTime = findValue(['checkouttime']);
            newRow.gross = findValue(['gross']);
            newRow.nett = findValue(['nett']);
            
            const { date, time } = parseDateTime(rawCheckoutTime || rawDate);
            newRow.date = date;
            newRow.checkout_time = time;
            
            return newRow;
        });
        
        const validData = normalizedData.filter(row => row.date && row.do_number);

        if (validData.length === 0) {
            showNotification(`Ditemukan ${rawJson.length} baris, namun tidak ada data yang valid (pastikan kolom "checkoutTime/date" & "doNumber" ada dan terisi).`, 'red');
            return;
        }
        jsonData = validData;
        displayPreview(rawJson.length);
    }
    
    function parseDateTime(value) {
        if (!value) return { date: null, time: null };
        let dateStr = String(value);

        // Coba parsing sebagai string ISO 8601 (YYYY-MM-DDTHH:MM:SS) atau (YYYY-MM-DD HH:MM:SS)
        const isoMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/);
        if (isoMatch) {
            return { date: isoMatch[1], time: isoMatch[2] };
        }

        // Jika gagal, coba parsing sebagai nomor seri Excel
        if (typeof value === 'number' && value > 1) {
            const date = XLSX.SSF.parse_date_code(value);
            if (date.y) {
                 const year = date.y;
                const month = String(date.m).padStart(2, '0');
                const day = String(date.d).padStart(2, '0');
                const hours = String(date.H).padStart(2, '0');
                const minutes = String(date.M).padStart(2, '0');
                const seconds = String(date.S).padStart(2, '0');
                return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}:${seconds}` };
            }
        }
        
        // Fallback untuk format lain yang bisa dibaca Date() (seperti MM/DD/YYYY)
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
            const year = dateObj.getFullYear();
            if(year < 2000) return { date: null, time: String(value) }; // Hindari parsing tanggal yang salah

            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            const seconds = String(dateObj.getSeconds()).padStart(2, '0');
            return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}:${seconds}` };
        }
        
        return { date: null, time: String(value) };
    }

    function displayPreview(totalRows) {
        const tableHead = document.querySelector('#preview-table thead');
        const tableBody = document.querySelector('#preview-table tbody');
        const summaryEl = document.getElementById('preview-summary');
        const validRows = jsonData.length;
        const totalNett = jsonData.reduce((sum, row) => sum + (parseFloat(row.nett) || 0), 0);
        const uniqueDates = [...new Set(jsonData.map(row => row.date))].sort();
        let dateText = `tanggal ${uniqueDates[0]}`;
        if (uniqueDates.length > 1) {
            dateText = `rentang tanggal ${uniqueDates[0]} hingga ${uniqueDates[uniqueDates.length - 1]}`;
        }

        summaryEl.innerHTML = `Ditemukan <strong>${totalRows}</strong> baris, <strong>${validRows}</strong> baris valid untuk ${dateText}. <span class="ml-4">Total Nett: <strong class="text-yellow-400">${formatNumber(totalNett)}</strong> Ton</span>`;
        tableHead.innerHTML = `<tr>${expectedHeaders.map(h => `<th class="capitalize p-2">${h.replace(/_/g, ' ')}</th>`).join('')}</tr>`;
        tableBody.innerHTML = jsonData.slice(0, 50).map(row => `<tr>${expectedHeaders.map(h => `<td class="p-2">${row[h] === undefined || row[h] === null ? '' : row[h]}</td>`).join('')}</tr>`).join('');
        imporArea.classList.add('hidden');
        previewSection.classList.remove('hidden');
    }
});