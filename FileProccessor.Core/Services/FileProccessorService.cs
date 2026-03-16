using ClosedXML.Excel;
using DocumentFormat.OpenXml.Bibliography;
using FileProccessor.Core.Interfaces;
using FileProccessor.Core.Models;
using System.Globalization;
using System.Text;

namespace FileProccessor.Core.Services
{
    public class FileProccessorService : IFileProccessorService
    {
        public async Task<ResultModel> ProccessFileAsync(Stream inputStream, string originalFileName)
        {
            if (inputStream == null)
            {
                throw new ArgumentNullException(nameof(inputStream));
            }

            if (string.IsNullOrWhiteSpace(originalFileName))
            {
                throw new ArgumentException("File name required for processing", nameof(originalFileName));
            }

            var fileExtension = Path.GetExtension(originalFileName).ToLowerInvariant();

            await using var memoryStream = new MemoryStream();
            await inputStream.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            List<string> headers;
            List<List<string>> rows;

            if (fileExtension == ".csv")
            {
                (headers, rows) = await ParseCsvAsync(memoryStream);
            }
            else if (fileExtension == ".xlsx" || fileExtension == ".xls")
            {
                (headers, rows) = ParseExcel(memoryStream);
            }
            else
            {
                throw new InvalidOperationException("Please upload a valid  CSV or Excel file");
            }

            var processedFile = ProcessData(rows, headers);
            var contentOfCsvFile = GenerateCsvFile(processedFile.AllOutputRows);
            var outputBytes = Encoding.UTF8.GetBytes(contentOfCsvFile);

            processedFile.FileData = outputBytes;
            processedFile.FileName = "sb_payshap_converted.csv";
            processedFile.ContentType = "text/csv";

            return processedFile;
        }

        public async Task<(List<string> Headers, List<List<string>> Rows)> ParseCsvAsync(Stream inputStream)
        {
            using var reader = new StreamReader(inputStream, leaveOpen: true);
            var text = await reader.ReadToEndAsync();

            var lines = text
                       .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
                       .Where(line => !string.IsNullOrWhiteSpace(line))
                       .ToList();

            if (lines.Count == 0)
                return (new List<string>(), new List<List<string>>());

            int headerIndex = 0;

            for (int i = 0; i < lines.Count; i++)
            {
                var firstCell = lines[i]
                               .Split(',')[0]
                               .Trim()
                               .Trim('"')
                               .ToUpperInvariant();

                if (firstCell.Contains("STATEMENT DATE") || firstCell.Contains("DATE"))
                {
                    headerIndex = i;
                    break;
                }

                if (firstCell.Contains("DEBITS AND CREDITS") || firstCell.Contains("ACCOUNT NUMBER"))
                {
                    headerIndex = i + 1;
                }
            }

            var headerLine = lines[headerIndex]
                       .Split(',')
                       .Select(h => h.Trim().Trim('"'))
                       .ToList();

            var rows = new List<List<string>>();

            for (int i = headerIndex + 1; i < lines.Count; i++)
            {
                var row = lines[i]
                               .Split(',')
                               .Select(v => v.Trim().Trim('"'))
                               .ToList();

                rows.Add(row);
            }

            return (headerLine, rows);
        }

        public (List<string> Headers, List<List<string>> Rows) ParseExcel(Stream inputStream)
        {
            using var workbook = new XLWorkbook(inputStream);
            var worksheet = workbook.Worksheet(1);

            var usedRange = worksheet.RangeUsed();
            if (usedRange == null)
                return (new List<string>(), new List<List<string>>());

            var allRows = new List<List<string>>();

            foreach (var row in usedRange.Rows())
            {
                var currentRow = row.Cells().Select(c => c.GetValue<string>().Trim()).ToList();
                allRows.Add(currentRow);
            }

            int headerIndex = 0;

            for (int i = 0; i < allRows.Count; i++)
            {
                var firstCell = (allRows[i].FirstOrDefault() ?? "").ToUpperInvariant();

                if (firstCell.Contains("STATEMENT DATE") || firstCell.Contains("DATE"))
                {
                    headerIndex = i;
                    break;
                }

                if (firstCell.Contains("DEBITS AND CREDITS") || firstCell.Contains("ACCOUNT NUMBER"))
                {
                    headerIndex = i + 1;
                }
            }

            var headers = allRows[headerIndex].Select(h => (h ?? "").Trim()).ToList();
            var rows = allRows.Skip(headerIndex + 1).ToList();

            return (headers, rows);
        }

        public ResultModel ProcessData(List<List<string>> rows, List<string> headerLine)
        {
            var filteredRows = new List<List<string>>();
            var outputRows = new List<OutputRow>();
            decimal bankTotal = 0;
            int bankCount = 0;

            var dataRows = rows.Where(row =>
            {
                return !row.Any(cell =>
                {
                    var cellStr = (cell ?? "").ToUpperInvariant();
                    return cellStr == "DEBITS" || cellStr == "CREDITS" || cellStr == "DEBIT" || cellStr == "CREDIT";
                });
            }).ToList();

            foreach (var values in dataRows)
            {
                var joinedRows =  string.Join(" | ", values);

                var amountValue = values.Count > 3 ? values[3] : "";
                var cleanedAmount = new string((amountValue ?? "").Where(c => char.IsDigit(c) || c == '.' || c == '-').ToArray());
                var checkCombinedOne = (values.Count > 4 ? values[4] : "");
                var checkCombinedTwo = (values.Count > 5 ? values[5] : "");

                if (!decimal.TryParse(cleanedAmount, NumberStyles.Any, CultureInfo.InvariantCulture, out var amountNumber))
                {
                    continue;
                }

                if (amountNumber == 0)
                {
                    continue;
                }

                bankTotal += Math.Abs(amountNumber);
                bankCount++;

                if (filteredRows.Count < 3)
                    filteredRows.Add(values);

                //Testing creating desc
                var firstValue = (values.Count > 4 ? values[4] : "");
                var secondValue = (values.Count > 5 ? values[5] : "");

               
                var txDate = values.Count > 1 ? values[1] : "";
                var description = (values.Count > 2 ? values[2] : "");
                var descriptionHidden = $"{firstValue}{secondValue}".Trim();
                var amount = Math.Abs(amountNumber).ToString(CultureInfo.InvariantCulture);
                var isDebit = amountNumber >= 0 ? "Y" : "N";

                var result = GetAccountFromDescription(descriptionHidden);
                var account = result?.Account ?? "Update data";
                var module = result?.Module ?? "Update data";

                outputRows.Add(new OutputRow
                {
                    TXdate = FormatDate(txDate),
                    Description = description,
                    Reference = CreateReference(txDate),
                    Amount = amount,
                    UseTax = "N",
                    TaxType = "",
                    TaxAccount = "",
                    TaxAmount = "0",
                    Project = "",
                    Account = account,
                    IsDebit = isDebit,
                    SplitType = "0",
                    SplitGroup = "0",
                    Reconcile = "Y",
                    PostDated = "N",
                    UseDiscount = "N",
                    DiscPerc = "0",
                    DiscTrCode = "",
                    DiscDesc = "",
                    UseDiscTax = "N",
                    DiscTaxType = "",
                    DiscTaxAcc = "",
                    DiscTaxAmt = "0",
                    PayeeName = "",
                    PrintCheque = "N",
                    SalesRep = "",
                    Module = module,
                    CombinedDescription = descriptionHidden
                });
            }

            var outputPreview = outputRows.Take(3).ToList();
            var outputTotal = outputRows.Sum(r =>
            decimal.TryParse(r.Amount, NumberStyles.Any, CultureInfo.InvariantCulture, out var amt) ? amt : 0);

            return new ResultModel
            {
                Headers = headerLine,
                PreviewRows = filteredRows,
                OutputPreview = outputPreview,
                AllOutputRows = outputRows,
                BankStatementTotal = bankTotal,
                BankStatementCount = bankCount,
                OutputTotal = outputTotal,
                RecordsMatch = bankCount == outputRows.Count,
                TotalsMatch = Math.Abs(bankTotal - outputTotal) < 0.01m
            };
        }

        public AccountModel? GetAccountFromDescription(string descriptionHidden)
        {
            var desc = (descriptionHidden ?? "").ToUpper();

            if (desc.Contains("BOLSA TRANSFER"))
                return new AccountModel { Account = "8499/HQ", Module = "0" };

            if (desc.Contains("REVERSAL RPP PAYSHAP") && desc.Contains("BFS"))
            {
                var bfsIndex = desc.IndexOf("BFS", StringComparison.Ordinal);
                if (bfsIndex != -1)
                {
                    var afterBfs = desc.Substring(bfsIndex + 4).Replace(" ", "");

                    if (afterBfs.StartsWith("RR"))
                        return new AccountModel { Account = "8447/HQ", Module = "0" };

                    var firstSix = afterBfs.Length >= 6 ? afterBfs.Substring(0, 6) : afterBfs;
                    if (firstSix.Length == 6)
                        return new AccountModel { Account = $"8447/{firstSix}", Module = "0" };
                }

                return new AccountModel { Account = "8447/HQ", Module = "0" };
            }

            if (desc.Contains("RPP PAYSHAP FROM") && desc.Contains("BFS"))
            {
                var bfsIndex = desc.IndexOf("BFS", StringComparison.Ordinal);
                if (bfsIndex != -1)
                {
                    var afterBfs = desc.Substring(bfsIndex + 4).Replace(" ", "");

                    if (afterBfs.StartsWith("RR"))
                        return new AccountModel { Account = "8447/HQ", Module = "0" };

                    if (afterBfs.StartsWith("AA"))
                        afterBfs = afterBfs.Substring(2);

                    if (afterBfs.StartsWith("DM"))
                    {
                        var fiveChars = afterBfs.Length >= 5 ? afterBfs.Substring(0, 5) : afterBfs;
                        if (fiveChars.Length == 5)
                            return new AccountModel { Account = $"8447/{fiveChars}", Module = "0" };
                    }
                    else
                    {
                        var sixChars = afterBfs.Length >= 6 ? afterBfs.Substring(0, 6) : afterBfs;
                        if (sixChars.Length == 6)
                            return new AccountModel { Account = $"8447/{sixChars}", Module = "0" };
                    }
                }

                return new AccountModel { Account = "8447/HQ", Module = "0" };
            }

            return null;
        }

        public string FormatDate(string dateStr)
        {
            var raw = dateStr?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(raw))
            {
                return "No date to return";
            }

            if(double.TryParse(raw, out double numValue))
            {
                if (numValue > 40000 && numValue < 60000)
                {
                    DateTime excelEpoch = new DateTime(1899, 12, 30);
                    DateTime date = excelEpoch.AddDays(numValue);

                    string dd = date.Day.ToString().PadLeft(2, '0');
                    string mm = date.Month.ToString("D2");
                    string yyyy = date.Year.ToString();

                    date.ToString($"{dd}/{mm}/{yyyy}");
                }
                else
                {
                    int v = (int)numValue;
                    var currentYear = DateTime.Now.Year;
                    var currentDay = v / 100;
                    var currentMonth = v % 100;

                    var padDay = (currentDay).ToString().PadLeft(2, '0');
                    var padMonth = (currentMonth).ToString().PadLeft(2, '0');

                    DateTime date = new DateTime(currentYear);
                    return date.ToString($"{padDay}/{padMonth}/{currentYear}");
                }
            }

            if (raw.Contains('/'))
                return raw;

            if (raw.Length != 8)
                return raw;
            

            var year = raw.Substring(0, 4);
            var month = raw.Substring(4, 2);
            var day = raw.Substring(6, 2);

            return $"{day}/{month}/{year}";
        }

        //The whole goal here is just make the reference 'PAYSHAP {currentYear}-{currentMonth}'
        public string CreateReference(string dateStr)
        {
            // Because the reference comes from the transaction date of the entry, since I formatted the date already I reused logic
            var formattedDateForReference = FormatDate(dateStr);
            //First check if we actually have a date
            if(string.IsNullOrWhiteSpace(formattedDateForReference))
            {
                return "SBSA PAYSHAP";
            }

            //Then if the date is in Excel Serial Date
            if(double.TryParse(formattedDateForReference, out double numValue))
            {
                if(numValue > 40000 && numValue < 60000)
                {
                    DateTime excelEpoch = new DateTime(1899, 12, 30);
                    DateTime date = excelEpoch.AddDays(numValue);

                    string month = date.Month.ToString("D2");
                    string year = date.Year.ToString();
                    return $"SBSA PAYSHAP {year}-{month}";
                }
            }

            //Handel dates like 14/03/2026
            if (formattedDateForReference.Contains('/'))
            {
                string[] dateParts = formattedDateForReference.Split("/");
                if (dateParts.Length == 3)
                {
                    string month = dateParts[1];
                    string year = dateParts[2];

                    return $"SBSA PAYSHAP {year}-{month}";
                }
            }

            //Handel YYYYMMDD
            if(formattedDateForReference.Length == 8)
            {
                string year = dateStr.Substring(0, 4);
                string month = dateStr.Substring(4, 2);

                return $"SBSA PAYSHAP {year}-{month}";
            }
            
            
            return $"SBSA PAYSHAP5";
        }

        public string GenerateCsvFile(List<OutputRow> rows)
        {
            var csvHeaders = new[]
            {
                "TXdate", "Description", "Reference", "Amount", "UseTax", "TaxType", "TaxAccount",
                "TaxAmount", "Project", "Account", "IsDebit", "SplitType", "SplitGroup", "Reconcile","PostDated", "UseDiscount",
                "DiscPerc", "DiscTrCode", "DiscDesc", "UseDiscTax",
                "DiscTaxType", "DiscTaxAcc", "DiscTaxAmt", "PayeeName", "PrintCheque", "SalesRep", "Module", "Combined Description"
            };

            var lines = new List<string>
            {
                string.Join(",", csvHeaders)
            };

            lines.AddRange(rows.Select(row => string.Join(",", new[]
            {
                EscapeCsv(row.TXdate), EscapeCsv(row.Description),
                EscapeCsv(row.Reference), EscapeCsv(row.Amount),
                EscapeCsv(row.UseTax), EscapeCsv(row.TaxType),
                EscapeCsv(row.TaxAccount), EscapeCsv(row.TaxAmount),
                EscapeCsv(row.Project), EscapeCsv(row.Account),
                EscapeCsv(row.IsDebit), EscapeCsv(row.SplitType),
                EscapeCsv(row.SplitGroup), EscapeCsv(row.Reconcile),
                EscapeCsv(row.PostDated), EscapeCsv(row.UseDiscount),
                EscapeCsv(row.DiscPerc), EscapeCsv(row.DiscTrCode),
                EscapeCsv(row.DiscDesc), EscapeCsv(row.UseDiscTax),
                EscapeCsv(row.DiscTaxType), EscapeCsv(row.DiscTaxAcc),
                EscapeCsv(row.DiscTaxAmt), EscapeCsv(row.PayeeName),
                EscapeCsv(row.PrintCheque), EscapeCsv(row.SalesRep), EscapeCsv(row.Module), EscapeCsv(row.CombinedDescription)
            })));
            return string.Join(Environment.NewLine, lines);
        }

        private static string EscapeCsv(string? value)
        {
            var safe = value ?? "";
            return $"\"{safe.Replace("\"", "\"\"")}\"";
        }
    }
}
