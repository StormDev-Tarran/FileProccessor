using FileProccessor.Cores.Models;
using System;
using System.Collections.Generic;
using System.Text;

namespace FileProccessor.Cores.Interfaces
{
    public interface IBankStatementService
    {
        ResultModel Process(Stream csvStream, string originalFileName);
        byte[] GenerateCsvBytes(List<OutputRow> rows);
    }
}
