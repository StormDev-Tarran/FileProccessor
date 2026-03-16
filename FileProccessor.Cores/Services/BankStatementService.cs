using FileProccessor.Cores.Models;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace FileProccessor.Cores.Services
{
    public class BankStatementService
    {
        public ConversionResult Process(Stream csvStream)
        {
            var result = new ConversionResult();

            using var reader = new StreamReader(csvStream);
            var lines = new List<string>();
            while (!reader.EndOfStream)
            {
                var line = reader.ReadLine();
                if (!string.IsNullOrWhiteSpace(line)) lines.Add(line);
            }

            if (lines.Count == 0)
            {
                result.Error = "File is empty.";
                return result;
            }

            result.Headers = ParseCsvLine(lines[0]);

            for (int i = 1; i < lines.Count; i++)
            {
                var vals = ParseCsvLine(lines[i]);
                if (vals.Count < 10) continue;

                var amountStr = vals.Count > 6 ? vals[6] : "0";
                if (!double.TryParse(amountStr, out double amount) || amount == 0) continue;

                result.BankStatementTotal += Math.Abs(amount);
                result.BankStatementCount++;

                if (result.PreviewInputRows.Count < 3)
                    result.PreviewInputRows.Add(vals);

                var txDate = vals[2];
                var description = vals[9];
                var account = GetAccount(description);
                var module = account == null
                    ? "Please check data"
                    : Regex.IsMatch(account, @"^[A-Z]{3}\d{3}$") ? "2" : "0";

                result.Rows.Add(new OutputRow
                {
                    TXdate = FormatDate(txDate),
                    Description = description,
                    Reference = CreateReference(txDate),
                    Amount = Math.Abs(amount).ToString("F2"),
                    Account = account ?? "",
                    IsDebit = amount >= 0 ? "Y" : "N",
                    Module = module
                });
            }

            return result;
        }

        private static string? GetAccount(string description)
        {
            var desc = description.ToUpperInvariant();

            if (desc.Contains("EFT"))
            {
                var cleaned = Regex.Replace(desc, @"[^A-Z0-9]", "");
                if (cleaned.Length >= 6) return cleaned.Substring(0, 6);
            }
            if (desc.Contains("SARS")) return "9500/HQ";
            if (desc.Contains("TRANSACTION CHARGE")) return "4150/ZZIN/0001";
            if (desc.Contains("FEE")) return "4150/ZZIN/0002";
            if (desc.Contains("TRANSFER")) return "8499/HQ";
            if (desc.Contains("40-5494-3698")) return "8499/HQ";

            return null;
        }

        private static string FormatDate(string d)
        {
            if (d.Length != 8) return d;
            return $"{d[6..8]}/{d[4..6]}/{d[0..4]}";
        }

        private static string CreateReference(string d)
        {
            if (d.Length != 8) return "EXPENSE ACC";
            return $"EXPENSE ACC {d[0..4]}-{d[4..6]}";
        }

        private static List<string> ParseCsvLine(string line)
        {
            var result = new List<string>();
            var current = "";
            bool inQuotes = false;

            foreach (char c in line)
            {
                if (c == '"') { inQuotes = !inQuotes; }
                else if (c == ',' && !inQuotes) { result.Add(current.Trim()); current = ""; }
                else { current += c; }
            }
            result.Add(current.Trim());
            return result;
        }

    }
}
