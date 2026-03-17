let currentFile = null;

export function initializeBankStatementUpload() {
    const fileInput = document.getElementById("fileInput");
    const dropZone = document.getElementById("dropZone");
    const clearButton = document.getElementById("clearButton");
    const downloadButton = document.getElementById("downloadButton");

    if (!fileInput || !dropZone) {
        console.error("Bank upload elements not found.");
        return;
    }

    fileInput.addEventListener("change", e => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    dropZone.addEventListener("dragover", e => {
        e.preventDefault();
        dropZone.classList.add("border-blue-500", "bg-blue-50");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("border-blue-500", "bg-blue-50");
    });

    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("border-blue-500", "bg-blue-50");

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    });

    if (clearButton) {
        clearButton.addEventListener("click", clearData);
    }

    if (downloadButton) {
        downloadButton.addEventListener("click", downloadFile);
    }
}

async function handleFile(file) {
    currentFile = file;

    const errorMsg = document.getElementById("errorMsg");
    errorMsg.classList.add("hidden");
    errorMsg.textContent = "";

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/bankstatement/upload", {
        method: "POST",
        body: form
    });

    const data = await res.json();

    if (!res.ok) {
        errorMsg.textContent = data.error || "Upload failed.";
        errorMsg.classList.remove("hidden");
        return;
    }

    showResults(file.name, data);
}

function showResults(name, data) {
    document.getElementById("uploadSection").classList.add("hidden");
    document.getElementById("resultsSection").classList.remove("hidden");
    document.getElementById("fileName").textContent = name;

    const outputTotal = data.allOutputRows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
    const countMatch = data.bankStatementCount === data.allOutputRows.length;
    const amountMatch = Math.abs(data.bankStatementTotal - outputTotal) < 0.01;

    document.getElementById("bankCount").textContent = data.bankStatementCount;
    document.getElementById("outputCount").textContent = data.allOutputRows.length;
    document.getElementById("bankTotal").textContent = Number(data.bankStatementTotal).toFixed(2);
    document.getElementById("outputTotal").textContent = outputTotal.toFixed(2);

    document.getElementById("countStatus").innerHTML = countMatch
        ? '<span class="text-green-600 font-semibold">✓ Match</span>'
        : '<span class="text-red-600 font-semibold">X Error</span>';

    document.getElementById("amountStatus").innerHTML = amountMatch
        ? '<span class="text-green-600 font-semibold">✓ Match</span>'
        : '<span class="text-red-600 font-semibold">X Error</span>';

    document.getElementById("recordCount").textContent =
        `Complete converted file with all ${data.allOutputRows.length} records`;
}

async function downloadFile() {
    if (!currentFile) return;

    const form = new FormData();
    form.append("file", currentFile);

    const res = await fetch("/api/bankstatement/download", {
        method: "POST",
        body: form
    });

    if (!res.ok) {
        alert("Download failed.");
        return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "bank_statement_converted.csv";
    a.click();

    URL.revokeObjectURL(url);
}

function clearData() {
    currentFile = null;

    document.getElementById("fileInput").value = "";
    document.getElementById("uploadSection").classList.remove("hidden");
    document.getElementById("resultsSection").classList.add("hidden");
    document.getElementById("errorMsg").classList.add("hidden");
    document.getElementById("errorMsg").textContent = "";
}