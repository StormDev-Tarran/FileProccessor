using System;
using System.Collections.Generic;
using System.Text;

namespace FileProccessor.Cores.Models
{
    public class ResultModel
    {
        public byte[] FileData { get; set; } = Array.Empty<byte>();
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = "text/csv";

        public List<string> Headers { get; set; } = new(); //public List<string> Headers { get; set; } = new();
        public List<List<string>> PreviewRows { get; set; } = new(); //public List<List<string>> PreviewInputRows { get; set; } = new();
        public List<OutputRow> OutputPreview { get; set; } = new(); //public List<OutputRow> Rows { get; set; } = new();
        public List<OutputRow> AllOutputRows { get; set; } = new();
        public decimal BankStatementTotal { get; set; } //public double BankStatementTotal { get; set; }
        public int BankStatementCount { get; set; } //public int BankStatementCount { get; set; }
        public decimal OutputTotal { get; set; }
        public bool RecordsMatch { get; set; }
        public bool TotalsMatch { get; set; }

        //public string? Error { get; set; }
    }
}
