var ss = SpreadsheetApp.openById("1Uwh7bJgDzMKVo4CwV2v1hAXRSLQI2l6_QQLMMDmW5_c");
var sheetLog  = ss.getSheetByName('Sheet1');
var sheetDash = ss.getSheetByName('Dashboard');
var timezone  = "Asia/Makassar";

// ===================== 1. doGet — Terima data dari Vercel Backend =====================
function doGet(e) {
  if (!e || !e.parameter || !e.parameter.name) {
    return ContentService.createTextOutput("ERROR: Parameter 'name' tidak ditemukan.");
  }

  // Format Nama: Huruf pertama kapital, sisanya kecil
  var name = e.parameter.name.trim();
  name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  var id = e.parameter.id ? e.parameter.id.trim() : "";
  
  // Menerima parameter status waktu dari Vercel (MASUK / KELUAR / TERLAMBAT)
  var vercelStatus = e.parameter.status ? e.parameter.status.trim().toUpperCase() : "";

  var now  = new Date();
  var date = Utilities.formatDate(now, timezone, "dd/MM/yyyy");
  var time = Utilities.formatDate(now, timezone, "HH:mm:ss");

  var lastRow    = sheetLog.getLastRow();
  var lastStatus = "";

  // Cari riwayat status terakhir siswa tersebut KHUSUS HARI INI
  for (var i = lastRow; i >= 5; i--) {
    var rowTanggal = sheetLog.getRange(i, 1).getDisplayValue();
    var rowNama    = sheetLog.getRange(i, 3).getDisplayValue();
    if (rowNama === name && rowTanggal === date) {
      lastStatus = sheetLog.getRange(i, 5).getDisplayValue();
      break;
    }
  }

  // Logika Toggle Status yang Aman:
  // Jika sebelumnya sudah 'IN', maka tap selanjutnya otomatis menjadi 'OUT'
  var status = "IN"; 
  if (lastStatus === "IN") {
    status = "OUT";
  } else if (vercelStatus === "KELUAR") {
    status = "OUT";
  }

  // Tulis data absensi ke tabel Log (Sheet1) mulai dari baris ke-5 dst.
  sheetLog.appendRow([date, time, name, id, status]);

  // Update tabel Dashboard secara realtime
  updateDashboard();

  // Mengembalikan respon sukses pendek agar dibaca dengan bersih oleh Vercel
  return ContentService.createTextOutput("OK");
}

// ===================== 2. Update Dashboard Harian =====================
function updateDashboard() {
  var today   = Utilities.formatDate(new Date(), timezone, "dd/MM/yyyy");
  var lastRow = sheetLog.getLastRow();

  // Objek untuk mengelompokkan data kehadiran per nama siswa
  var peserta = {};

  // Membaca seluruh data log di Sheet1 dari baris ke-5 hingga baris terakhir
  for (var i = 5; i <= lastRow; i++) {
    var rowDate   = sheetLog.getRange(i, 1).getDisplayValue();
    var rowTime   = sheetLog.getRange(i, 2).getDisplayValue();
    var rowName   = sheetLog.getRange(i, 3).getDisplayValue();
    var rowId     = sheetLog.getRange(i, 4).getDisplayValue();
    var rowStatus = sheetLog.getRange(i, 5).getDisplayValue();

    if (rowDate !== today || rowName === "") continue;

    if (!peserta[rowName]) {
      peserta[rowName] = { id: rowId, logs: [], lastStatus: "" };
    }

    peserta[rowName].logs.push({ time: rowTime, status: rowStatus });
    peserta[rowName].lastStatus = rowStatus;
  }

  // Bersihkan konten data lama di tabel Dashboard (mulai baris ke-5 ke bawah)
  var dashLastRow = sheetDash.getLastRow();
  if (dashLastRow >= 5) {
    sheetDash.getRange(5, 1, dashLastRow - 4, 5).clearContent();
    sheetDash.getRange(5, 1, dashLastRow - 4, 5).setBackground(null);
  }

  // Jika belum ada data kehadiran sama sekali hari ini, hentikan proses
  if (Object.keys(peserta).length === 0) return;

  var rows = [];
  for (var nama in peserta) {
    var data           = peserta[nama];
    var totalMenit     = hitungTotalWaktu(data.logs);
    var totalFormatted = menitKeJam(totalMenit);

    rows.push([
      nama,              // Kolom A - Nama
      data.id,           // Kolom B - ID / UID Kartu
      today,             // Kolom C - Tanggal
      totalFormatted,    // Kolom D - Total Waktu di Kelas
      data.lastStatus    // Kolom E - Status Akhir (IN / OUT)
    ]);
  }

  // Tulis ulang seluruh data rekap terbaru ke sheet Dashboard mulai baris 5
  sheetDash.getRange(5, 1, rows.length, 5).setValues(rows);

  // Berikan pewarnaan latar belakang otomatis berdasarkan status akhir
  for (var r = 0; r < rows.length; r++) {
    var statusCell = sheetDash.getRange(5 + r, 5);
    if (rows[r][4] === "IN") {
      statusCell.setBackground("#b7e1cd"); // Hijau muda hangat
      statusCell.setFontColor("#0d6740");
    } else {
      statusCell.setBackground("#f4c7c3"); // Merah muda pastel
      statusCell.setFontColor("#a61c00");
    }
  }
}

// ===================== 3. Hitung Total Waktu (Pasangan IN -> OUT) =====================
function hitungTotalWaktu(logs) {
  var totalMenit = 0;
  var lastIn     = null;

  for (var i = 0; i < logs.length; i++) {
    if (logs[i].status === "IN") {
      lastIn = logs[i].time;
    } else if (logs[i].status === "OUT" && lastIn !== null) {
      var inParts  = lastIn.split(":");
      var outParts = logs[i].time.split(":");
      var inMenit  = parseInt(inParts[0]) * 60 + parseInt(inParts[1]);
      var outMenit = parseInt(outParts[0]) * 60 + parseInt(outParts[1]);
      totalMenit  += (outMenit - inMenit);
      lastIn       = null; // Reset penanda setelah berpasangan
    }
  }

  return totalMenit;
}

// ===================== 4. Format Menit Ke Jam Menit =====================
function menitKeJam(menit) {
  if (menit <= 0) return "Masih IN";
  var jam  = Math.floor(menit / 60);
  var sisa = menit % 60;
  if (jam > 0) return jam + "j " + sisa + "m";
  return sisa + " menit";
}
