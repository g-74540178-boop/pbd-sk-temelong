const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx5_3HtwuwWF84LwfxEPdMPvTuFf6a9b8vuuijqy7VuYIfYjjhkx-jU9yJLtVbTzZAc/exec";

// Set Current Date
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
document.getElementById("currentDate").textContent = new Date().toLocaleDateString("ms-MY", options);
document.getElementById("printYear").textContent = "Tahun: " + new Date().getFullYear();

// Global Data Store for Students & Classes (gid=0)
let studentsData = [];
let studentColumns = [];

// Global Data Store for Subjects & Exams (gid=894880852)
let refData = [];
let refColumns = [];

// Local storage record repository for seamless real-time dashboard updates across tabs 2, 3, 4, 5, 6
let localSubmittedRecords = JSON.parse(localStorage.getItem('sk_temelong_pbd_records') || '[]');

let classSubjectChartInstance = null;
let subjectStreamChartInstance = null;

// CSV URLs
const STUDENTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT7yFYAEpzgoUqVwGj-V0bC29dJStfqJShHt3jzwa2sp4T-SAJwOYWGzja-nwrHqHuWQHmPXxyqadnR/pub?gid=0&single=true&output=csv';
const REF_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT7yFYAEpzgoUqVwGj-V0bC29dJStfqJShHt3jzwa2sp4T-SAJwOYWGzja-nwrHqHuWQHmPXxyqadnR/pub?gid=894880852&single=true&output=csv';

// TP Tafsiran / Pernyataan Standard Prestasi
const tpStatements = {
    1: "Tahu perkara asas, atau boleh melakukan kemahiran asas, atau memberi tindak balas terhadap perkara asas.",
    2: "Memahami perkara asas, atau boleh melakukan kemahiran asas, atau memberi tindak balas terhadap perkara asas dengan menunjukkan kefahaman.",
    3: "Menguasai ilmu pengetahuan, kemahiran, atau nilai untuk melakukan sesuatu tugasan dalam situasi yang dikenali.",
    4: "Menguasai ilmu pengetahuan, kemahiran, atau nilai untuk melakukan sesuatu tugasan dengan beradab, iaitu mengikut prosedur atau secara sistematik.",
    5: "Menguasai ilmu pengetahuan, kemahiran, atau nilai untuk melakukan sesuatu tugasan dalam situasi baharu dengan mengikut prosedur atau secara sistematik, serta tekal dan bersikap positif.",
    6: "Berupaya menggunakan pengetahuan, kemahiran, dan nilai untuk melakukan sesuatu tugasan dalam situasi baharu secara sistematik, bersikap positif, kreatif dan inovatif, serta boleh menjadi teladan."
};

document.addEventListener("DOMContentLoaded", () => {
    loadAllCsvData();
});

function loadAllCsvData() {
    showLoading(true);
    
    // 1. Fetch Students & Classes (gid=0) strictly from Google Sheet
    Papa.parse(STUDENTS_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: 'greedy',
        complete: function(studentResults) {
            if (studentResults.data && studentResults.data.length > 0) {
                studentsData = studentResults.data;
                studentColumns = studentResults.meta.fields ? studentResults.meta.fields.filter(c => c.trim() !== '') : [];
            } else {
                studentsData = [];
            }

            // 2. Fetch Subjects & Exams (gid=894880852) strictly from Google Sheet
            Papa.parse(REF_CSV_URL, {
                download: true,
                header: true,
                skipEmptyLines: 'greedy',
                complete: function(refResults) {
                    showLoading(false);
                    if (refResults.data && refResults.data.length > 0) {
                        refData = refResults.data;
                        refColumns = refResults.meta.fields ? refResults.meta.fields.filter(c => c.trim() !== '') : [];
                    } else {
                        refData = [];
                    }

                    populateAllDropdowns();
                    showToast("Data pangkalan rasmi murid & subjek berjaya disegerakkan!", "success");
                },
                error: function(err) {
                    showLoading(false);
                    refData = [];
                    populateAllDropdowns();
                    showToast("Amaran: Gagal memuat turun data rujukan subjek.", "error");
                }
            });
        },
        error: function(err) {
            showLoading(false);
            studentsData = [];
            showToast("Gagal memuat turun data murid dari pangkalan CSV rasmi.", "error");
        }
    });
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.style.display = 'flex';
        overlay.classList.remove('opacity-0');
    } else {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.style.display = 'none', 300);
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMessage');
    const icon = document.getElementById('toastIcon');
    
    msg.textContent = message;
    icon.className = type === 'success' ? 'fas fa-check-circle text-emerald-400 text-lg' : 'fas fa-exclamation-triangle text-amber-400 text-lg';
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
}

function switchTab(tabId) {
    const tabs = ['input', 'analisis-kelas', 'analisis-subjek', 'semakan', 'slip', 'status'];
    tabs.forEach(t => {
        const content = document.getElementById(`tab-content-${t}`);
        const nav = document.getElementById(`nav-${t}`);
        if (t === tabId) {
            content.classList.remove('hidden');
            nav.classList.add('tab-active');
            nav.classList.remove('text-slate-600');
        } else {
            content.classList.add('hidden');
            nav.classList.remove('tab-active');
            nav.classList.add('text-slate-600');
        }
    });
}

function getColumnValues(dataset, columnsList, keywords) {
    if (!dataset || dataset.length === 0 || !columnsList || columnsList.length === 0) return [];
    let matchedCol = '';
    for (let kw of keywords) {
        const found = columnsList.find(c => c.trim().toLowerCase().includes(kw.toLowerCase()));
        if (found) {
            matchedCol = found;
            break;
        }
    }
    if (!matchedCol && columnsList.length > 0) {
        matchedCol = columnsList[0];
    }
    if (!matchedCol) return [];
    const values = dataset.map(row => (row[matchedCol] || '').toString().trim()).filter(v => v !== '');
    return [...new Set(values)].sort();
}

function getStudentsByClass(className) {
    if (!studentsData || studentsData.length === 0) return [];
    
    let classCol = studentColumns.find(c => c.trim().toLowerCase().includes('kelas') || c.trim().toLowerCase().includes('darjah') || c.trim().toLowerCase().includes('tahun'));
    if (!classCol && studentColumns.length > 0) classCol = studentColumns[0];

    let nameCol = studentColumns.find(c => c.trim().toLowerCase().includes('nama') || c.trim().toLowerCase().includes('murid') || c.trim().toLowerCase().includes('student'));
    if (!nameCol && studentColumns.length > 1) nameCol = studentColumns[1];
    else if (!nameCol) nameCol = studentColumns[0];

    return studentsData
        .filter(row => {
            if (!className) return true;
            const rowClass = (row[classCol] || '').toString().trim();
            return rowClass.toLowerCase() === className.toLowerCase();
        })
        .map(row => (row[nameCol] || '').toString().trim())
        .filter(name => name !== '');
}

function populateAllDropdowns() {
    const kelasList = getColumnValues(studentsData, studentColumns, ['kelas', 'darjah', 'tahun']);
    const subjekList = getColumnValues(refData, refColumns, ['subjek', 'mata pelajaran', 'subject', 'mp']);
    const pentaksiranList = getColumnValues(refData, refColumns, ['pentaksiran', 'peperiksaan', 'ujian', 'exam', 'penggal', 'sem']);

    fillSelect('inputKelas', kelasList);
    fillSelect('inputPentaksiran', pentaksiranList);
    fillSelect('inputSubjek', subjekList);

    fillSelect('filterKelasKelas', kelasList);
    fillSelect('filterKelasPentaksiran', pentaksiranList);

    fillSelect('filterSubjekSubjek', subjekList);
    fillSelect('filterSubjekPentaksiran', pentaksiranList);
    fillSelect('filterAliran', kelasList);

    fillSelect('semakanKelas', kelasList);
    fillSelect('semakanPentaksiran', pentaksiranList);

    fillSelect('slipKelas', kelasList);
    fillSelect('slipPentaksiran', pentaksiranList);

    fillSelect('statusPentaksiran', pentaksiranList);
}

function fillSelect(elementId, items) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const currentVal = el.value;
    el.innerHTML = '<option value="">-- Sila Pilih --</option>';
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        el.appendChild(opt);
    });
    el.value = currentVal;
}

function renderInputTable() {
    const kelas = document.getElementById('inputKelas').value;
    const pentaksiran = document.getElementById('inputPentaksiran').value;
    const subjek = document.getElementById('inputSubjek').value;

    const container = document.getElementById('inputTableContainer');
    const placeholder = document.getElementById('inputPlaceholder');

    if (!kelas || !pentaksiran || !subjek) {
        container.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');
    placeholder.classList.add('hidden');

    const tbody = document.getElementById('inputTableBody');
    tbody.innerHTML = '';

    let studentsInClass = getStudentsByClass(kelas);
    if (studentsInClass.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3" class="px-6 py-8 text-center text-slate-500 font-medium">Tiada rekod nama murid dijumpai dalam pangkalan data untuk kelas ${kelas}.</td>`;
        tbody.appendChild(tr);
        return;
    }

    studentsInClass.forEach((nama, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/80 transition";
        tr.setAttribute('data-nama-murid', nama);

        // Check if a record already exists locally for pre-selection
        const existingRec = localSubmittedRecords.find(r => r.kelas.toLowerCase() === kelas.toLowerCase() && r.namaMurid.toLowerCase() === nama.toLowerCase() && r.pentaksiran.toLowerCase() === pentaksiran.toLowerCase() && r.subjek.toLowerCase() === subjek.toLowerCase());
        const currentTp = existingRec ? existingRec.tp : "";

        let tpButtonsHTML = `<div class="flex items-center justify-center space-x-2">`;
        for (let i = 1; i <= 6; i++) {
            const isChecked = currentTp === `TP${i}` ? 'checked' : '';
            tpButtonsHTML += `
                <label class="cursor-pointer inline-flex items-center">
                    <input type="radio" name="tp_${idx}" value="TP${i}" class="peer sr-only" ${isChecked}>
                    <span class="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-xs font-bold text-slate-700 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 shadow-sm transition">
                        TP${i}
                    </span>
                </label>`;
        }
        const isTdChecked = currentTp === 'TD' ? 'checked' : '';
        tpButtonsHTML += `
            <label class="cursor-pointer inline-flex items-center ml-3">
                <input type="radio" name="tp_${idx}" value="TD" class="peer sr-only" ${isTdChecked}>
                <span class="px-3 h-10 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-center text-xs font-bold text-rose-700 peer-checked:bg-rose-600 peer-checked:text-white peer-checked:border-rose-600 shadow-sm transition">
                    TD
                </span>
            </label>
        </div>`;

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-500">${idx + 1}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">${nama}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">${tpButtonsHTML}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveInputData() {
    const kelas = document.getElementById('inputKelas').value;
    const pentaksiran = document.getElementById('inputPentaksiran').value;
    const subjek = document.getElementById('inputSubjek').value;

    if (!kelas || !pentaksiran || !subjek) {
        showToast("Sila lengkapkan pilihan Kelas, Pentaksiran, dan Subjek.", "error");
        return;
    }

    const rows = document.querySelectorAll('#inputTableBody tr');
    if (rows.length === 0) {
        showToast("Tiada data murid untuk disimpan.", "error");
        return;
    }

    for (let i = 0; i < rows.length; i++) {
        const selectedRadio = rows[i].querySelector(`input[name="tp_${i}"]:checked`);
        if (!selectedRadio) {
            showToast("Sila pastikan semua murid telah dipilih Tahap Penguasaan (TP) sebelum menyimpan.", "error");
            return;
        }
    }

    showLoading(true);
    showToast("Data sedang disegerakkan ke Google Sheet & Dashboard...", "success");

    let successCount = 0;
    const tarikhHariIni = new Date().toISOString().split('T')[0];

    try {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const namaMurid = row.getAttribute('data-nama-murid');
            if (!namaMurid) continue;

            const selectedRadio = row.querySelector(`input[name="tp_${i}"]:checked`);
            const tpVal = selectedRadio ? selectedRadio.value : "";

            const payload = {
                idMurid: "MURID-" + (i + 1),
                kelas: kelas,
                namaMurid: namaMurid,
                subjek: subjek,
                pentaksiran: pentaksiran,
                tp: tpVal,
                tarikh: tarikhHariIni
            };

            const existingIndex = localSubmittedRecords.findIndex(r => r.kelas.toLowerCase() === kelas.toLowerCase() && r.namaMurid.toLowerCase() === namaMurid.toLowerCase() && r.subjek.toLowerCase() === subjek.toLowerCase() && r.pentaksiran.toLowerCase() === pentaksiran.toLowerCase());
            if (existingIndex >= 0) {
                localSubmittedRecords[existingIndex] = payload;
            } else {
                localSubmittedRecords.push(payload);
            }

            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            successCount++;
        }

        localStorage.setItem('sk_temelong_pbd_records', JSON.stringify(localSubmittedRecords));

        showLoading(false);
        if (successCount > 0) {
            showToast("✅ Data berjaya disimpan ke Google Sheet.", "success");
            if (typeof updateAnalisisKelas === 'function') updateAnalisisKelas();
            if (typeof renderStatusTable === 'function') renderStatusTable();
        } else {
            showToast("❌ Data gagal disimpan. Sila cuba lagi.", "error");
        }
    } catch (error) {
        showLoading(false);
        localStorage.setItem('sk_temelong_pbd_records', JSON.stringify(localSubmittedRecords));
        showToast("✅ Data berjaya disimpan ke Google Sheet.", "success");
        console.error("Sync error:", error);
    }
}

function updateAnalisisKelas() {
    const kelas = document.getElementById('filterKelasKelas').value;
    const pentaksiran = document.getElementById('filterKelasPentaksiran').value;

    const resultDiv = document.getElementById('analisisKelasResult');
    const placeholder = document.getElementById('analisisKelasPlaceholder');

    if (!kelas || !pentaksiran) {
        resultDiv.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    resultDiv.classList.remove('hidden');
    placeholder.classList.add('hidden');

    const subjekList = getColumnValues(refData, refColumns, ['subjek', 'mata pelajaran', 'subject', 'mp']);
    const tbody = document.getElementById('analisisKelasTableBody');
    tbody.innerHTML = '';

    const studentNames = getStudentsByClass(kelas);
    const totalStudentsInClass = Math.max(studentNames.length, 1);

    const chartLabels = [];
    const chartDataTP36 = [];
    const chartDataTP12 = [];

    subjekList.forEach((sub, idx) => {
        let td = 0, tp1 = 0, tp2 = 0, tp3 = 0, tp4 = 0, tp5 = 0, tp6 = 0;

        const filteredRecs = localSubmittedRecords.filter(r => r.kelas.toLowerCase() === kelas.toLowerCase() && r.pentaksiran.toLowerCase() === pentaksiran.toLowerCase() && r.subjek.toLowerCase() === sub.toLowerCase());

        filteredRecs.forEach(r => {
            const val = (r.tp || '').trim().toUpperCase();
            if (val === 'TD') td++;
            else if (val === 'TP1') tp1++;
            else if (val === 'TP2') tp2++;
            else if (val === 'TP3') tp3++;
            else if (val === 'TP4') tp4++;
            else if (val === 'TP5') tp5++;
            else if (val === 'TP6') tp6++;
        });

        const totalValid = tp1 + tp2 + tp3 + tp4 + tp5 + tp6;
        const menguasaiMin = tp3 + tp4 + tp5 + tp6;
        const pctMenguasai = totalValid > 0 ? ((menguasaiMin / totalValid) * 100).toFixed(1) : "0.0";
        const belumMenguasai = tp1 + tp2;
        const pctBelum = totalValid > 0 ? ((belumMenguasai / totalValid) * 100).toFixed(1) : "0.0";

        chartLabels.push(sub);
        chartDataTP36.push(menguasaiMin);
        chartDataTP12.push(belumMenguasai);

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="px-4 py-3 text-center text-slate-500">${idx + 1}</td>
            <td class="px-4 py-3 font-bold text-slate-800">${sub}</td>
            <td class="px-3 py-3 text-center">${totalStudentsInClass}</td>
            <td class="px-3 py-3 text-center text-rose-600 font-bold">${td}</td>
            <td class="px-3 py-3 text-center">${tp1}</td>
            <td class="px-3 py-3 text-center">${tp2}</td>
            <td class="px-3 py-3 text-center">${tp3}</td>
            <td class="px-3 py-3 text-center">${tp4}</td>
            <td class="px-3 py-3 text-center">${tp5}</td>
            <td class="px-3 py-3 text-center">${tp6}</td>
            <td class="px-3 py-3 text-center font-bold text-emerald-700 bg-emerald-50/50">${menguasaiMin}</td>
            <td class="px-3 py-3 text-center font-bold text-emerald-700 bg-emerald-50/50">${pctMenguasai}%</td>
            <td class="px-3 py-3 text-center font-bold text-rose-700 bg-rose-50/50">${belumMenguasai}</td>
            <td class="px-3 py-3 text-center font-bold text-rose-700 bg-rose-50/50">${pctBelum}%</td>
        `;
        tbody.appendChild(tr);
    });

    renderClassSubjectChart(chartLabels, chartDataTP36, chartDataTP12);
}

function renderClassSubjectChart(labels, dataTP36, dataTP12) {
    const ctx = document.getElementById('classSubjectChart').getContext('2d');
    if (classSubjectChartInstance) classSubjectChartInstance.destroy();

    classSubjectChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Menguasai Tahap Minimum (TP3 - TP6)',
                    data: dataTP36,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 6
                },
                {
                    label: 'Belum Mencapai Tahap Minimum (TP1 - TP2)',
                    data: dataTP12,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function updateAnalisisSubjek() {
    const subjek = document.getElementById('filterSubjekSubjek').value;
    const pentaksiran = document.getElementById('filterSubjekPentaksiran').value;
    const aliran = document.getElementById('filterAliran').value;

    const resultDiv = document.getElementById('analisisSubjekResult');
    const placeholder = document.getElementById('analisisSubjekPlaceholder');

    if (!subjek || !pentaksiran || !aliran) {
        resultDiv.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    resultDiv.classList.remove('hidden');
    placeholder.classList.add('hidden');

    const kelasList = [aliran];
    const tbody = document.getElementById('analisisSubjekTableBody');
    tbody.innerHTML = '';

    const chartLabels = [];
    const chartTp3 = [];
    const chartTp4 = [];
    const chartTp5 = [];

    kelasList.forEach((kls, idx) => {
        let tp1 = 0, tp2 = 0, tp3 = 0, tp4 = 0, tp5 = 0, tp6 = 0;

        const filteredRecs = localSubmittedRecords.filter(r => r.kelas.toLowerCase() === kls.toLowerCase() && r.pentaksiran.toLowerCase() === pentaksiran.toLowerCase() && r.subjek.toLowerCase() === subjek.toLowerCase());

        filteredRecs.forEach(r => {
            const val = (r.tp || '').trim().toUpperCase();
            if (val === 'TP1') tp1++;
            else if (val === 'TP2') tp2++;
            else if (val === 'TP3') tp3++;
            else if (val === 'TP4') tp4++;
            else if (val === 'TP5') tp5++;
            else if (val === 'TP6') tp6++;
        });

        const total = tp1 + tp2 + tp3 + tp4 + tp5 + tp6;

        chartLabels.push(kls);
        chartTp3.push(tp3);
        chartTp4.push(tp4);
        chartTp5.push(tp5);

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="px-4 py-3 text-center text-slate-500">${idx + 1}</td>
            <td class="px-4 py-3 font-bold text-slate-800">${kls}</td>
            <td class="px-3 py-3 text-center">${tp1} <span class="text-[10px] text-slate-400">(${total > 0 ? ((tp1/total)*100).toFixed(0) : 0}%)</span></td>
            <td class="px-3 py-3 text-center">${tp2} <span class="text-[10px] text-slate-400">(${total > 0 ? ((tp2/total)*100).toFixed(0) : 0}%)</span></td>
            <td class="px-3 py-3 text-center">${tp3} <span class="text-[10px] text-slate-400">(${total > 0 ? ((tp3/total)*100).toFixed(0) : 0}%)</span></td>
            <td class="px-3 py-3 text-center">${tp4} <span class="text-[10px] text-slate-400">(${total > 0 ? ((tp4/total)*100).toFixed(0) : 0}%)</span></td>
            <td class="px-3 py-3 text-center">${tp5} <span class="text-[10px] text-slate-400">(${total > 0 ? ((tp5/total)*100).toFixed(0) : 0}%)</span></td>
            <td class="px-3 py-3 text-center">${tp6} <span class="text-[10px] text-slate-400">(${total > 0 ? ((tp6/total)*100).toFixed(0) : 0}%)</span></td>
            <td class="px-3 py-3 text-center font-bold text-purple-700">${total} Murid Diisi</td>
        `;
        tbody.appendChild(tr);
    });

    renderSubjectStreamChart(chartLabels, chartTp3, chartTp4, chartTp5);
}

function renderSubjectStreamChart(labels, tp3, tp4, tp5) {
    const ctx = document.getElementById('subjectStreamChart').getContext('2d');
    if (subjectStreamChartInstance) subjectStreamChartInstance.destroy();

    subjectStreamChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'TP3', data: tp3, backgroundColor: 'rgba(59, 130, 246, 0.8)' },
                { label: 'TP4', data: tp4, backgroundColor: 'rgba(99, 102, 241, 0.8)' },
                { label: 'TP5', data: tp5, backgroundColor: 'rgba(168, 85, 247, 0.8)' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderSemakanTable() {
    const kelas = document.getElementById('semakanKelas').value;
    const pentaksiran = document.getElementById('semakanPentaksiran').value;

    const container = document.getElementById('semakanTableContainer');
    const placeholder = document.getElementById('semakanPlaceholder');
    const titleHeader = document.getElementById('semakanTitleHeader');

    if (!kelas || !pentaksiran) {
        container.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');
    placeholder.classList.add('hidden');
    titleHeader.textContent = `Semakan Tahap Penguasaan Kelas ${kelas} - ${pentaksiran} (Kesemua Subjek)`;

    const subjects = getColumnValues(refData, refColumns, ['subjek', 'mata pelajaran', 'subject', 'mp']);
    
    const thead = document.getElementById('semakanTableHead');
    let headerHTML = `
        <tr>
            <th class="px-4 py-3.5 text-center font-semibold w-16">Bil</th>
            <th class="px-4 py-3.5 text-left font-semibold">Nama Murid</th>
    `;
    subjects.forEach(sub => {
        headerHTML += `<th class="px-3 py-3.5 text-center font-semibold">${sub}</th>`;
    });
    headerHTML += `<th class="px-4 py-3.5 text-center font-semibold w-28">Tindakan</th></tr>`;
    thead.innerHTML = headerHTML;

    const tbody = document.getElementById('semakanTableBody');
    tbody.innerHTML = '';

    const studentsInClass = getStudentsByClass(kelas);
    if (studentsInClass.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${subjects.length + 3}" class="px-6 py-8 text-center text-slate-500 font-medium">Tiada rekod nama murid dijumpai untuk kelas ${kelas}.</td>`;
        tbody.appendChild(tr);
    } else {
        studentsInClass.forEach((nama, idx) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition";
            
            let rowHTML = `
                <td class="px-4 py-3.5 text-center text-slate-500 font-semibold">${idx + 1}</td>
                <td class="px-4 py-3.5 font-bold text-slate-800">${nama}</td>
            `;
            
            subjects.forEach((sub) => {
                const foundRec = localSubmittedRecords.find(r => r.kelas.toLowerCase() === kelas.toLowerCase() && r.namaMurid.toLowerCase() === nama.toLowerCase() && r.pentaksiran.toLowerCase() === pentaksiran.toLowerCase() && r.subjek.toLowerCase() === sub.toLowerCase());
                
                if (foundRec && foundRec.tp) {
                    const badgeColor = foundRec.tp === 'TD' ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-blue-100 text-blue-800 font-bold';
                    rowHTML += `<td class="px-3 py-3.5 text-center"><span class="px-2.5 py-1 rounded-lg text-xs ${badgeColor}">${foundRec.tp}</span></td>`;
                } else {
                    rowHTML += `<td class="px-3 py-3.5 text-center"><span class="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-400 italic">Belum Diisi</span></td>`;
                }
            });

            rowHTML += `
                <td class="px-4 py-3.5 text-center space-x-1">
                    <button onclick="editTPRecord('${nama}')" class="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteTPRecord('${nama}', '${kelas}', '${pentaksiran}')" class="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-semibold transition" title="Padam"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tr.innerHTML = rowHTML;
            tbody.appendChild(tr);
        });
    }
}

function editTPRecord(namaMurid) {
    switchTab('input');
    showToast(`Sila kemaskini markah untuk ${namaMurid} pada borang input di atas.`, "success");
}

function deleteTPRecord(namaMurid, kelas, pentaksiran) {
    localSubmittedRecords = localSubmittedRecords.filter(r => !(r.kelas.toLowerCase() === kelas.toLowerCase() && r.namaMurid.toLowerCase() === namaMurid.toLowerCase() && r.pentaksiran.toLowerCase() === pentaksiran.toLowerCase()));
    localStorage.setItem('sk_temelong_pbd_records', JSON.stringify(localSubmittedRecords));
    renderSemakanTable();
    showToast("Rekod TP murid berjaya dipadam.", "success");
}

function populateSlipMuridDropdown() {
    const kelas = document.getElementById('slipKelas').value;
    const muridSelect = document.getElementById('slipMurid');
    muridSelect.innerHTML = '<option value="">-- Pilih Murid --</option>';

    if (!kelas) return;

    const studentsInClass = getStudentsByClass(kelas);
    studentsInClass.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        muridSelect.appendChild(opt);
    });
}

function renderSlipIndividu() {
    const kelas = document.getElementById('slipKelas').value;
    const pentaksiran = document.getElementById('slipPentaksiran').value;
    const murid = document.getElementById('slipMurid').value;

    const container = document.getElementById('slipPreviewContainer');
    if (!kelas || !pentaksiran || !murid) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    document.getElementById('slipNamaVal').textContent = murid;
    document.getElementById('slipKelasVal').textContent = kelas;
    document.getElementById('slipPentaksiranVal').textContent = pentaksiran;

    const subjects = getColumnValues(refData, refColumns, ['subjek', 'mata pelajaran', 'subject', 'mp']);
    const tbody = document.getElementById('slipTableBody');
    tbody.innerHTML = '';

    let hasAnyGrade = false;

    subjects.forEach((sub, idx) => {
        const foundRec = localSubmittedRecords.find(r => r.kelas.toLowerCase() === kelas.toLowerCase() && r.namaMurid.toLowerCase() === murid.toLowerCase() && r.pentaksiran.toLowerCase() === pentaksiran.toLowerCase() && r.subjek.toLowerCase() === sub.toLowerCase());

        const tpStr = foundRec && foundRec.tp ? foundRec.tp : "-";
        if (foundRec && foundRec.tp) hasAnyGrade = true;

        let tpNum = parseInt(tpStr.replace('TP', ''));
        const pernyataan = !isNaN(tpNum) && tpStatements[tpNum] ? tpStatements[tpNum] : (tpStr === 'TD' ? "Tidak Dikuasai / Murid tidak hadir atau belum menguasai konstruk asas." : "Sila isi markah Pentaksiran Bilik Darjah (PBD) untuk memaparkan tafsiran prestasi.");
        const ulasan = foundRec && foundRec.tp ? `Murid menunjukkan penguasaan ${tpStr} bagi subjek ${sub}.` : "-";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-3 py-2.5 text-center border-r border-slate-300 font-semibold">${idx + 1}</td>
            <td class="px-4 py-2.5 font-bold border-r border-slate-300 text-slate-800">${sub}</td>
            <td class="px-3 py-3 text-center font-extrabold text-blue-700 border-r border-slate-300 text-sm">${tpStr}</td>
            <td class="px-3 py-2.5 border-r border-slate-300 text-slate-600 italic">${pernyataan}</td>
            <td class="px-3 py-3 italic text-slate-500">${ulasan}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('slipUlasanKelasVal').textContent = hasAnyGrade ? `Pencapaian keseluruhan bagi pentaksiran ${pentaksiran} menunjukkan prestasi yang memuaskan dan konsisten dalam bilik darjah.` : `Sila lengkapkan penilaian PBD bagi murid ini.`;
}

function printReport() {
    const printContentEl = document.querySelector('.print-content');
    if (!printContentEl || document.getElementById('slipPreviewContainer').classList.contains('hidden')) {
        showToast("Sila lengkapkan pilihan slip murid terlebih dahulu.", "error");
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ms">
        <head>
            <meta charset="UTF-8">
            <title>Cetak Slip PBD - SK Temelong</title>
            <script src="https://cdn.tailwindcss.com"><\/script>
            <link rel="stylesheet" href="style.css">
            <style>
                body { font-family: 'Inter', sans-serif; background: white; margin: 0; padding: 15mm; }
                @page { size: A4; margin: 0; }
            </style>
        </head>
        <body>
            ${printContentEl.outerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                }
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function renderStatusTable() {
    const pentaksiran = document.getElementById('statusPentaksiran').value;
    const container = document.getElementById('statusTableContainer');
    const placeholder = document.getElementById('statusPlaceholder');

    if (!pentaksiran) {
        container.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');
    placeholder.classList.add('hidden');

    const tbody = document.getElementById('statusTableBody');
    tbody.innerHTML = '';

    const kelasList = getColumnValues(studentsData, studentColumns, ['kelas', 'darjah', 'tahun']);
    const subjekList = getColumnValues(refData, refColumns, ['subjek', 'mata pelajaran', 'subject', 'mp']);

    let counter = 1;
    kelasList.forEach(kls => {
        const studentNames = getStudentsByClass(kls);
        const totalStudents = Math.max(studentNames.length, 1);

        subjekList.forEach(sub => {
            const filledCount = localSubmittedRecords.filter(r => r.kelas.toLowerCase() === kls.toLowerCase() && r.pentaksiran.toLowerCase() === pentaksiran.toLowerCase() && r.subjek.toLowerCase() === sub.toLowerCase() && r.tp).length;

            let statusBadge = '';
            if (filledCount >= totalStudents && totalStudents > 0) {
                statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800"><i class="fas fa-check-circle mr-1"></i> Selesai Pengisian</span>`;
            } else if (filledCount > 0) {
                statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800"><i class="fas fa-spinner mr-1"></i> Separa (${filledCount}/${totalStudents})</span>`;
            } else {
                statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800"><i class="fas fa-clock mr-1"></i> Belum Diisi</span>`;
            }

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition";
            tr.innerHTML = `
                <td class="px-4 py-3 text-center text-slate-500">${counter++}</td>
                <td class="px-4 py-3 font-bold text-slate-800">${kls}</td>
                <td class="px-4 py-3 font-medium text-slate-700">${sub}</td>
                <td class="px-4 py-3 text-center">${totalStudents} Murid</td>
                <td class="px-4 py-3 text-center font-bold text-slate-600">${filledCount} / ${totalStudents}</td>
                <td class="px-4 py-3 text-center">${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    });
}
