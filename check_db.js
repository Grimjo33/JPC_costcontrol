const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.db');

console.log(`Mencari database di lokasi: ${dbPath}`);

if (fs.existsSync(dbPath)) {
    console.log('\x1b[32m%s\x1b[0m', 'BERHASIL: File database ditemukan!');
} else {
    console.log('\x1b[31m%s\x1b[0m', 'GAGAL: File database TIDAK ditemukan di lokasi tersebut.');
    console.log('Pastikan Anda memiliki struktur folder: c:\\eng\\data\\database.db');
}