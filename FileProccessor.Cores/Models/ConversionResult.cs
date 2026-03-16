using System;
using System.Collections.Generic;
using System.Text;

namespace FileProccessor.Cores.Models
{
    public class ConversionResult
    {
        public List<OutputRow> Rows { get; set; } = new();
        public List<List<string>> PreviewInputRows { get; set; } = new();
        public List<string> Headers { get; set; } = new();
        public double BankStatementTotal { get; set; }
        public int BankStatementCount { get; set; }
        public string? Error { get; set; }
    }
}
