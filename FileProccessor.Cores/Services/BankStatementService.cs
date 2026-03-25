using FileProccessor.Cores.Interfaces;
using FileProccessor.Cores.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace FileProccessor.Cores.Services
{
    public class BankStatementService : IBankStatementService
    {
        public ResultModel Process(Stream csvStream, string originalFileName)
        {
            if (csvStream == null)
                throw new ArgumentNullException(nameof(csvStream));

            var result = new ResultModel();

            using var reader = new StreamReader(csvStream, leaveOpen: true);
            var lines = new List<string>();

            while (!reader.EndOfStream)
            {
                var line = reader.ReadLine();
                if (!string.IsNullOrWhiteSpace(line))
                    lines.Add(line);
            }

            if (lines.Count == 0)
            {
                throw new InvalidOperationException("File is empty.");
            }

            result.Headers = ParseCsvLine(lines[0]);

            for (int i = 1; i < lines.Count; i++)
            {
                var vals = ParseCsvLine(lines[i]);

                if (vals.Count < 10)
                    continue;

                var amountStr = vals.Count > 6 ? vals[6] : "0";

                if (!decimal.TryParse(amountStr, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal amount) || amount == 0)
                    continue;

                result.BankStatementTotal += Math.Abs(amount);
                result.BankStatementCount++;

                if (result.PreviewRows.Count < 3)
                    result.PreviewRows.Add(vals);

                var txDate = vals[2];
                Console.WriteLine(txDate);
                var description = vals[9];
                var account = GetAccount(description);
                Console.WriteLine($"ACCOUNT: {account}");

                var module = account == null
                    ? "Please check data"
                    : Regex.IsMatch(account, @"^[A-Z]{3}\d{3}$") ? "2" : "0";

                result.AllOutputRows.Add(new OutputRow
                {
                    TXdate = FormatDate(txDate),
                    Description = description,
                    Reference = CreateReference(txDate),
                    Amount = Math.Abs(amount).ToString("F2", CultureInfo.InvariantCulture),
                    Account = account ?? "",
                    IsDebit = amount >= 0 ? "Y" : "N",
                    Module = module
                });
            }

            result.OutputPreview = result.AllOutputRows.Take(3).ToList();
            result.OutputTotal = result.AllOutputRows.Sum(r =>
                decimal.TryParse(r.Amount, NumberStyles.Any, CultureInfo.InvariantCulture, out var amt) ? amt : 0);

            result.RecordsMatch = result.BankStatementCount == result.AllOutputRows.Count;
            result.TotalsMatch = Math.Abs(result.BankStatementTotal - result.OutputTotal) < 0.01m;

            var csvBytes = GenerateCsvBytes(result.AllOutputRows);
            result.FileData = csvBytes;
            result.FileName = "bank_statement_converted.csv";
            result.ContentType = "text/csv";

            return result;
        }

        public byte[] GenerateCsvBytes(List<OutputRow> rows)
        {
            var cols = new[]
            {
                "TXdate", "Description", "Reference", "Amount", "UseTax", "TaxType", "TaxAccount",
                "TaxAmount", "Project", "Account", "IsDebit", "SplitType", "SplitGroup", "Reconcile",
                "PostDated", "UseDiscount", "DiscPerc", "DiscTrCode", "DiscDesc", "UseDiscTax",
                "DiscTaxType", "DiscTaxAcc", "DiscTaxAmt", "PayeeName", "PrintCheque", "SalesRep", "Module"
            };

            var sb = new StringBuilder();
            sb.AppendLine(string.Join(",", cols));

            foreach (var row in rows)
            {
                var vals = new[]
                {
                    row.TXdate, row.Description, row.Reference, row.Amount, row.UseTax,
                    row.TaxType, row.TaxAccount, row.TaxAmount, row.Project, row.Account,
                    row.IsDebit, row.SplitType, row.SplitGroup, row.Reconcile, row.PostDated,
                    row.UseDiscount, row.DiscPerc, row.DiscTrCode, row.DiscDesc, row.UseDiscTax,
                    row.DiscTaxType, row.DiscTaxAcc, row.DiscTaxAmt, row.PayeeName,
                    row.PrintCheque, row.SalesRep, row.Module
                };

                sb.AppendLine(string.Join(",", vals.Select(v => $"\"{(v ?? "").Replace("\"", "\"\"")}\"")));
            }

            return Encoding.UTF8.GetBytes(sb.ToString());
        }

        private static string? GetAccount(string description)
        {
            var desc = (description ?? "").ToUpperInvariant();

            if (desc.Contains("EFT"))
            {
                var cleaned = Regex.Replace(desc, @"[^A-Z0-9]", "");
                if (cleaned.Length >= 6)
                    return cleaned.Substring(0, 6);
            }

            if (desc.Contains("SARS"))
                return "9500/HQ";

            if (desc.Contains("TRANSACTION CHARGE"))
                return "4150/ZZIN/0001";

            if (desc.Contains("FEE"))
                return "4150/ZZIN/0002";

            if (desc.Contains("TRANSFER"))
                return "8499/HQ";

            if (desc.Contains("40-5494-3698"))
                return "8499/HQ";

            return null;
        }

        private static string FormatDate(string d)
        {
            if (string.IsNullOrWhiteSpace(d))
                return "";

            d = d.Trim();

            if (d.Length != 8)
                return d;

            return $"{d[6..8]}/{d[4..6]}/{d[0..4]}";

        }

        private static string CreateReference(string d)
        {
            if (string.IsNullOrWhiteSpace(d) || d.Length != 8)
                return "EXPENSE ACC";

            return $"EXPENSE ACC {d[0..4]}-{d[4..6]}";
        }

        private static List<string> ParseCsvLine(string line)
        {
            var result = new List<string>();
            var current = "";
            bool inQuotes = false;

            foreach (char c in line)
            {
                if (c == '"')
                {
                    inQuotes = !inQuotes;
                }
                else if (c == ',' && !inQuotes)
                {
                    result.Add(current.Trim());
                    current = "";
                }
                else
                {
                    current += c;
                }
            }

            result.Add(current.Trim());
            return result;
        }

    }
}
