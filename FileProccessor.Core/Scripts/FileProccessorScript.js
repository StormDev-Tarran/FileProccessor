const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

function getAccountFromDescription(description)
{
    const desc = (description || '').toUpperCase();

    // Rule 1: BOLSA TRANSFER
    if (desc.includes('BOLSA TRANSFER')) return { account: '8499/HQ', module: '0' };

    // Rule 2 & 3: REVERSAL RPP PAYSHAP BFS
    if (desc.includes('REVERSAL RPP PAYSHAP') && desc.includes('BFS')) {
        const bfsIndex = desc.indexOf('BFS');
        if (bfsIndex !== -1) {
            // Get characters after "BFS " (skip the space)
            const afterBfs = desc.substring(bfsIndex + 4).replace(/\s/g, ''); // Remove any spaces

            // If starts with "RR", return 8447/HQ
            if (afterBfs.startsWith('RR')) {
                return { account: '8447/HQ', module: '0' };
            }

            const firstSix = afterBfs.substring(0, 6);
            if (firstSix.length === 6) {
                return { account: `8447/${firstSix}`, module: '0' };
            }
        }
        // Fallback if can't extract 6 characters
        return { account: '8447/HQ', module: '0' };
    }

    // Rule 4: RPP PAYSHAP FROM BFS
    if (desc.includes('RPP PAYSHAP FROM') && desc.includes('BFS')) {
        const bfsIndex = desc.indexOf('BFS');
        if (bfsIndex !== -1) {
            let afterBfs = desc.substring(bfsIndex + 4).replace(/\s/g, ''); // Remove any spaces

            // If starts with "RR", return 8447/HQ
            if (afterBfs.startsWith('RR')) {
                return { account: '8447/HQ', module: '0' };
            }

            // If starts with "AA", skip it
            if (afterBfs.startsWith('AA')) {
                afterBfs = afterBfs.substring(2);
            }

            // If starts with "DM" (or after removing AA), take first 5 characters
            if (afterBfs.startsWith('DM')) {
                const fiveChars = afterBfs.substring(0, 5);
                if (fiveChars.length === 5) {
                    return { account: `8447/${fiveChars}`, module: '0' };
                }
            }
            // Otherwise, take first 6 characters
            else {
                const sixChars = afterBfs.substring(0, 6);
                if (sixChars.length === 6) {
                    return { account: `8447/${sixChars}`, module: '0' };
                }
            }
        }
        return { account: '8447/HQ', module: '0' };
    }

    return null;
}

function formatDate(dateStr)
{
    // Handle Excel serial date numbers (e.g., 46045)
    const numValue = Number(dateStr);
    if (!isNaN(numValue) && numValue > 40000 && numValue < 60000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    // Handle date format like "23/01/2026" - already in correct format
    if (dateStr && String(dateStr).includes('/')) return dateStr;
    // Handle YYYYMMDD format
    if (!dateStr || String(dateStr).length !== 8) return dateStr;
    const year = String(dateStr).substring(0, 4);
    const month = String(dateStr).substring(4, 6);
    const day = String(dateStr).substring(6, 8);
    return `${day}/${month}/${year}`;
}

function createReference(dateStr)
{
    // Handle Excel serial date numbers
    const numValue = Number(dateStr);
    if (!isNaN(numValue) && numValue > 40000 && numValue < 60000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `SBSA PAYSHAP ${year}-${month}`;
    }
    // Extract month and year from date like "23/01/2026"
    if (dateStr && String(dateStr).includes('/')) {
        const parts = String(dateStr).split('/');
        if (parts.length === 3) {
            const year = parts[2];
            const month = parts[1];
            return `SBSA PAYSHAP ${year}-${month}`;
        }
    }
    // Handle YYYYMMDD format
    if (!dateStr || String(dateStr).length !== 8) return 'SBSA PAYSHAP';
    const year = String(dateStr).substring(0, 4);
    const month = String(dateStr).substring(4, 6);
    return `SBSA PAYSHAP ${year}-${month}`;
}

function parseCSV(file)
{
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            // Find the actual header row (skip title rows like "Debits and Credits for Account Number...")
            let headerIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                const firstCell = lines[i].split(',')[0].trim().replace(/^"|"$/g, '').toUpperCase();
                if (firstCell.includes('STATEMENT DATE') || firstCell.includes('DATE')) {
                    headerIndex = i;
                    break;
                }
                if (firstCell.includes('DEBITS AND CREDITS') || firstCell.includes('ACCOUNT NUMBER')) {
                    headerIndex = i + 1;
                }
            }
            const headerLine = lines[headerIndex].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const rows = [];
            for (let i = headerIndex + 1; i < lines.length; i++) {
                rows.push(lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '')));
            }
            processData(rows, headerLine);
        }
    };
    reader.readAsText(file);
}

function parseExcel(file)
{
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (jsonData.length > 0) {
            // Find the actual header row (skip title rows like "Debits and Credits for Account Number...")
            let headerIndex = 0;
            for (let i = 0; i < jsonData.length; i++) {
                const firstCell = String(jsonData[i][0] || '').toUpperCase();
                if (firstCell.includes('STATEMENT DATE') || firstCell.includes('DATE')) {
                    headerIndex = i;
                    break;
                }
                if (firstCell.includes('DEBITS AND CREDITS') || firstCell.includes('ACCOUNT NUMBER')) {
                    headerIndex = i + 1;
                }
            }
            const headerLine = jsonData[headerIndex].map(h => String(h || '').trim());
            const rows = jsonData.slice(headerIndex + 1).map(row => row.map(cell => String(cell || '').trim()));
            processData(rows, headerLine);
        }
    };
    reader.readAsArrayBuffer(file);
}

function processData(rows, headerLine)
{
    setHeaders(headerLine);
    const filteredRows = [];
    const outputRows = [];
    let bankTotal = 0;
    let bankCount = 0;

    // Skip rows that contain "Debits" or "Credits" as sub-headers
    const dataRows = rows.filter(row => {
        const firstCell = String(row[0] || '').toUpperCase();
        const hasDebitsCredits = row.some(cell => {
            const cellStr = String(cell || '').toUpperCase();
            return cellStr === 'DEBITS' || cellStr === 'CREDITS' || cellStr === 'DEBIT' || cellStr === 'CREDIT';
        });
        return !hasDebitsCredits;
    });

    for (let i = 0; i < dataRows.length; i++) {
        const values = dataRows[i];
        const amountValue = values[3] || ''; // Fourth column - Transaction Amount
        const amountNumber = parseFloat(String(amountValue).replace(/[^0-9.-]/g, ''));

        if (!isNaN(amountNumber) && amountNumber !== 0) {
            bankTotal += Math.abs(amountNumber);
            bankCount++;
            if (filteredRows.length < 3) filteredRows.push(values);

            const txDate = values[0] || ''; // First column - Statement Date
            const description = values[2] || ''; // Third column - Transaction Details
            const amount = Math.abs(amountNumber).toString();
            const isDebit = amountNumber >= 0 ? 'Y' : 'N';
            const result = getAccountFromDescription(description);
            const account = result ? result.account : 'Update data';
            const module = result ? result.module : 'Update data';
            outputRows.push({
                TXdate: formatDate(txDate),
                Description: description,
                Reference: createReference(txDate),
                Amount: amount,
                UseTax: 'N',
                TaxType: '',
                TaxAccount: '',
                TaxAmount: '0',
                Project: '',
                Account: account || '',
                IsDebit: isDebit,
                SplitType: '0',
                SplitGroup: '0',
                Reconcile: 'Y',
                PostDated: 'N',
                UseDiscount: 'N',
                DiscPerc: '0',
                DiscTrCode: '',
                DiscDesc: '',
                UseDiscTax: 'N',
                DiscTaxType: '',
                DiscTaxAcc: '',
                DiscTaxAmt: '0',
                PayeeName: '',
                PrintCheque: 'N',
                SalesRep: '',
                Module: module
            });
        }
    }
    setPreviewRows(filteredRows);
    setOutputPreview(outputRows.slice(0, 3));
    setAllOutputRows(outputRows);
    setBankStatementTotal(bankTotal);
    setBankStatementCount(bankCount);
}

function processToCSV(rows) {
    const csvHeaders = ["TXdate",
        "Description",
        "Reference",
        "Amount",
        "UseTax",
        "TaxType",
        "TaxAccount",
        "TaxAmount",
        "Project",
        "Account",
        "IsDebit",
        "SplitType",
        "SplitGroup",
        "Reconcile",
        "PostDated",
        "UseDiscount",
        "DiscPerc",
        "DiscTrCode",
        "DiscDesc",
        "UseDiscTax",
        "DiscTaxType",
        "DiscTaxAcc",
        "DiscTaxAmt",
        "PayeeName",
        "PrintCheque",
        "SalesRep",
        "Module"
    ];

    const csvRows = rows.map(row => csvHeaders.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",");

    return [csvHeaders.join(","), ...csvRows].join("\n");
}

function processFile(inputPath, outputPath) {
    const extension = path.extname(inputPath).toLowerCase();

    let parsedData;
    if (extension === ".csv") {
        parsedData = parseCSV(inputPath);
    } else if (extension === ".xlsx" || extension === ".xls") {
        parsed = parseExcel(inputPath);
    } else {
        throw new Error("Unsupported file type. Only .csv, .xlsx and xls are allowed");
    }

    const result = processData(parsed.rows);
    const csv = processToCSV(result.outputRows);

    fs.writeFileSync(outputPath, csv, "utf8");

    return result;
}


module.exports = {proc}