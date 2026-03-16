let currentFile = null;
let conversionData = null;

document.getElementById('fileInput').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) handleFile(f);
});

const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500', 'bg-blue-50'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
    currentFile = file;
    const form = new FormData();
    form.append('file', file);

    const res = await fetch('/api/bankstatement/upload', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
        document.getElementById('errorMsg').textContent = data.error;
        document.getElementById('errorMsg').classList.remove('hidden');
        return;
    }

    conversionData = data;
    showResults(file.name, data);
}

function showResults(name, data) {
    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');
    document.getElementById('fileName').textContent = name;

    const outputTotal = data.rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const countMatch = data.bankStatementCount === data.rows.length;
    const amountMatch = Math.abs(data.bankStatementTotal - outputTotal) < 0.01;

    document.getElementById('bankCount').textContent = data.bankStatementCount;
    document.getElementById('outputCount').textContent = data.rows.length;
    document.getElementById('bankTotal').textContent = data.bankStatementTotal.toFixed(2);
    document.getElementById('outputTotal').textContent = outputTotal.toFixed(2);
    document.getElementById('countStatus').innerHTML = countMatch
        ? '<span class="text-green-600 font-semibold">✓ Match</span>'
        : '<span class="text-red-600 font-semibold">✗ Error</span>';
    document.getElementById('amountStatus').innerHTML = amountMatch
        ? '<span class="text-green-600 font-semibold">✓ Match</span>'
        : '<span class="text-red-600 font-semibold">✗ Error</span>';
    document.getElementById('recordCount').textContent =
        `Complete converted file with all ${data.rows.length} records`;
}

async function downloadFile() {
    if (!currentFile) return;
    const form = new FormData();
    form.append('file', currentFile);
    const res = await fetch('/api/bankstatement/download', { method: 'POST', body: form });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bank_statement_converted.csv';
    a.click();
}

function clearData() {
    currentFile = null;
    conversionData = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('uploadSection').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('errorMsg').classList.add('hidden');
}