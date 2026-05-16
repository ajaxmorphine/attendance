var ss = SpreadsheetApp.openById("1Uwh7bJgDzMKVo4CwV2v1hAXRSLQI2l6_QQLMMDmW5_c");
var sheet = ss.getSheetByName('Sheet1');
var timezone = "Asia/Makassar"; // WITA - Balikpapan

function doGet(e) {
  if (!e || !e.parameter || !e.parameter.name) {
    return ContentService.createTextOutput("ERROR: Parameter 'name' tidak ditemukan.");
  }

  // Format nama
  var name = e.parameter.name.trim();
  name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

  // ID opsional
  var id = e.parameter.id ? e.parameter.id.trim() : "";

  var now = new Date();
  var date = Utilities.formatDate(now, timezone, "dd/MM/yyyy"); // Kolom A
  var time = Utilities.formatDate(now, timezone, "HH:mm:ss");  // Kolom B

  var lastRow = sheet.getLastRow();
  var lastStatus = "";

  // Cari status terakhir berdasarkan nama & tanggal hari ini
  for (var i = lastRow; i >= 5; i--) {
    var rowTanggal = sheet.getRange(i, 1).getDisplayValue(); // A = Tanggal
    var rowNama    = sheet.getRange(i, 3).getDisplayValue(); // C = Nama

    if (rowNama === name && rowTanggal === date) {
      lastStatus = sheet.getRange(i, 5).getDisplayValue();   // E = Status
      break;
    }
  }

  // Toggle IN / OUT
  var status = (lastStatus === "IN") ? "OUT" : "IN";

  // Tulis ke spreadsheet sesuai urutan kolom
  sheet.appendRow([
    date,   // A - Tanggal
    time,   // B - Waktu
    name,   // C - Nama
    id,     // D - ID
    status  // E - Status
  ]);

  return ContentService.createTextOutput(name + " - " + status + " Berhasil Dicatat");
}
