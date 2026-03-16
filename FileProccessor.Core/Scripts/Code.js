import React, { useState } from 'react';
import { Upload, FileText, X, Download, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function BankStatementUpload() {
    const [file, setFile] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [previewRows, setPreviewRows] = useState([]);
    const [outputPreview, setOutputPreview] = useState([]);
    const [allOutputRows, setAllOutputRows] = useState([]);
    const [bankStatementTotal, setBankStatementTotal] = useState(0);
    const [bankStatementCount, setBankStatementCount] = useState(0);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    //Backend logic
    const getAccountFromDescription = (description) => {
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
    };

    //Backend logic
    const formatDate = (dateStr) => {
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
    };

    //Backend logic
    const createReference = (dateStr) => {
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
    };

    //Backend Logic
    const processData = (rows, headerLine) => {
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
                    TXdate: formatDate(txDate), Description: description, Reference: createReference(txDate),
                    Amount: amount, UseTax: 'N', TaxType: '', TaxAccount: '', TaxAmount: '0', Project: '',
                    Account: account || '', IsDebit: isDebit, SplitType: '0', SplitGroup: '0', Reconcile: 'Y',
                    PostDated: 'N', UseDiscount: 'N', DiscPerc: '0', DiscTrCode: '', DiscDesc: '', UseDiscTax: 'N',
                    DiscTaxType: '', DiscTaxAcc: '', DiscTaxAmt: '0', PayeeName: '', PrintCheque: 'N', SalesRep: '', Module: module
                });
            }
        }
        setPreviewRows(filteredRows);
        setOutputPreview(outputRows.slice(0, 3));
        setAllOutputRows(outputRows);
        setBankStatementTotal(bankTotal);
        setBankStatementCount(bankCount);
    };

    //Frontend Logic
    const parseCSV = (file) => {
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
    };

    //Frontend logic
    const parseExcel = (file) => {
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
    };

    //Backend
    const handleFileSelect = (selectedFile) => {
        const fileName = selectedFile?.name?.toLowerCase() || '';
        const isCSV = selectedFile?.type === 'text/csv' || fileName.endsWith('.csv');
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        if (selectedFile && (isCSV || isExcel)) {
            setFile(selectedFile);
            setError('');
            if (isExcel) parseExcel(selectedFile);
            else parseCSV(selectedFile);
        } else {
            setError('Please upload a valid CSV or Excel file');
        }
    };

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files[0]); };
    const handleFileInput = (e) => handleFileSelect(e.target.files[0]);

    //Backend
    const clearFile = () => {
        setFile(null); setHeaders([]); setPreviewRows([]); setOutputPreview([]);
        setAllOutputRows([]); setBankStatementTotal(0); setBankStatementCount(0); setError(''); setIsDragging(false);
    };

    //UI/ Browser
    const downloadCSV = () => {
        const csvHeaders = ['TXdate', 'Description', 'Reference', 'Amount', 'UseTax', 'TaxType', 'TaxAccount', 'TaxAmount', 'Project', 'Account', 'IsDebit', 'SplitType', 'SplitGroup', 'Reconcile', 'PostDated', 'UseDiscount', 'DiscPerc', 'DiscTrCode', 'DiscDesc', 'UseDiscTax', 'DiscTaxType', 'DiscTaxAcc', 'DiscTaxAmt', 'PayeeName', 'PrintCheque', 'SalesRep', 'Module'];
        const csvRows = allOutputRows.map(row => [row.TXdate, row.Description, row.Reference, row.Amount, row.UseTax, row.TaxType, row.TaxAccount, row.TaxAmount, row.Project, row.Account, row.IsDebit, row.SplitType, row.SplitGroup, row.Reconcile, row.PostDated, row.UseDiscount, row.DiscPerc, row.DiscTrCode, row.DiscDesc, row.UseDiscTax, row.DiscTaxType, row.DiscTaxAcc, row.DiscTaxAmt, row.PayeeName, row.PrintCheque, row.SalesRep, row.Module]);
        const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', 'sb_payshap_converted.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const outputTotal = allOutputRows.reduce((sum, row) => sum + parseFloat(row.Amount || 0), 0);
    const recordsMatch = bankStatementCount === allOutputRows.length;
    const totalsMatch = Math.abs(bankStatementTotal - outputTotal) < 0.01;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">SB Payshap</h1>
                    <p className="text-gray-600">Upload your bank statement to convert for ERP import</p>
                </div>

                {!file ? (
                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                            className={`border-4 border-dashed rounded-lg p-12 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">Drop your bank statement here</h3>
                            <p className="text-gray-500 mb-4">or</p>
                            <label className="inline-block">
                                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileInput} className="hidden" />
                                <span className="bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors inline-block">Browse Files</span>
                            </label>
                            <p className="text-sm text-gray-400 mt-4">Supports CSV and Excel files (.csv, .xlsx, .xls)</p>
                        </div>
                        {error && <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-8 h-8 text-green-600" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800">{file.name}</h3>
                                        <p className="text-sm text-gray-500">File uploaded successfully</p>
                                    </div>
                                </div>
                                <button onClick={clearFile} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                    <X className="w-4 h-4" />Clear Data
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="font-semibold text-blue-900 mb-2">Bank Statement Preview - First 3 Rows (Column 7 ≠ 0)</h4>
                                <p className="text-sm text-blue-700">Original bank statement data (rows where Column 7 = 0 are excluded)</p>
                            </div>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-100 border-b border-gray-300">
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Row</th>
                                            {headers.map((header, idx) => {
                                                const headerUpper = String(header || '').toUpperCase();
                                                if (headerUpper === 'DEBITS' || headerUpper === 'CREDITS' || headerUpper === 'DEBIT' || headerUpper === 'CREDIT') return null;
                                                return <th key={idx} className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{header || `Column ${idx + 1}`}</th>;
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {previewRows.map((row, rowIdx) => (
                                            <tr key={rowIdx} className="border-b border-gray-200 hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-500">{rowIdx + 1}</td>
                                                {row.map((cell, cellIdx) => {
                                                    const headerUpper = String(headers[cellIdx] || '').toUpperCase();
                                                    if (headerUpper === 'DEBITS' || headerUpper === 'CREDITS' || headerUpper === 'DEBIT' || headerUpper === 'CREDIT') return null;
                                                    // Convert Excel date numbers in first column (Statement Date)
                                                    let displayCell = cell;
                                                    if (cellIdx === 0) {
                                                        displayCell = formatDate(cell);
                                                    }
                                                    return <td key={cellIdx} className="px-4 py-3 text-sm text-gray-700">{displayCell}</td>;
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                                    <Download className="w-5 h-5" />Output File Preview - First 3 Rows (All 27 Columns)
                                </h4>
                                <p className="text-sm text-green-700">Converted data ready for ERP import - scroll horizontally to see all columns</p>
                            </div>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-green-100 border-b border-green-300">
                                            {['TXdate', 'Description', 'Reference', 'Amount', 'UseTax', 'TaxType', 'TaxAccount', 'TaxAmount', 'Project', 'Account', 'IsDebit', 'SplitType', 'SplitGroup', 'Reconcile', 'PostDated', 'UseDiscount', 'DiscPerc', 'DiscTrCode', 'DiscDesc', 'UseDiscTax', 'DiscTaxType', 'DiscTaxAcc', 'DiscTaxAmt', 'PayeeName', 'PrintCheque', 'SalesRep', 'Module'].map(h => (
                                                <th key={h} className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {outputPreview.map((row, rowIdx) => (
                                            <tr key={rowIdx} className="border-b border-gray-200 hover:bg-gray-50">
                                                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{row.TXdate}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.Description}</td>
                                                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{row.Reference}</td>
                                                <td className="px-2 py-2 text-gray-700 text-right">{row.Amount}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.UseTax}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.TaxType}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.TaxAccount}</td>
                                                <td className="px-2 py-2 text-gray-700 text-right">{row.TaxAmount}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.Project}</td>
                                                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{row.Account}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.IsDebit}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.SplitType}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.SplitGroup}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.Reconcile}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.PostDated}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.UseDiscount}</td>
                                                <td className="px-2 py-2 text-gray-700 text-right">{row.DiscPerc}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.DiscTrCode}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.DiscDesc}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.UseDiscTax}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.DiscTaxType}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.DiscTaxAcc}</td>
                                                <td className="px-2 py-2 text-gray-700 text-right">{row.DiscTaxAmt}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.PayeeName}</td>
                                                <td className="px-2 py-2 text-gray-700 text-center">{row.PrintCheque}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.SalesRep}</td>
                                                <td className="px-2 py-2 text-gray-700">{row.Module}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />Reconciliation Check
                                </h4>
                                <p className="text-sm text-amber-800">
                                    <strong>Note:</strong> "Absolute Total Amount" means all amounts are treated as positive values.
                                </p>
                            </div>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-100 border-b border-gray-300">
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Check</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bank Statement File</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Output File</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        <tr className="border-b border-gray-200">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-700">Number of Records</td>
                                            <td className="px-4 py-3 text-sm text-gray-800">{bankStatementCount}</td>
                                            <td className="px-4 py-3 text-sm text-gray-800">{allOutputRows.length}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {recordsMatch ? (
                                                    <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle className="w-4 h-4" />Match</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-red-600 font-semibold"><AlertCircle className="w-4 h-4" />Error</span>
                                                )}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-200">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-700">Absolute Total Amount</td>
                                            <td className="px-4 py-3 text-sm text-gray-800">{bankStatementTotal.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-800">{outputTotal.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {totalsMatch ? (
                                                    <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle className="w-4 h-4" />Match</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-red-600 font-semibold"><AlertCircle className="w-4 h-4" />Error</span>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            {recordsMatch && totalsMatch ? (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-green-800 font-medium flex items-center gap-2"><CheckCircle className="w-5 h-5" />Reconciliation Successful! All records and amounts match.</p>
                                </div>
                            ) : (
                                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-800 font-medium flex items-center gap-2"><AlertCircle className="w-5 h-5" />Reconciliation Failed! Please review the discrepancies above.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                            <button onClick={downloadCSV} className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg">
                                <Download className="w-6 h-6" />Download CSV Output File
                            </button>
                            <p className="text-sm text-gray-600 mt-3">Click to download the complete converted file with all {allOutputRows.length} records</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}