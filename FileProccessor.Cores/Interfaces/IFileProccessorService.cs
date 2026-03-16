using FileProccessor.Cores.Models;
using System;
using System.Collections.Generic;
using System.Text;

namespace FileProccessor.Cores.Interfaces
{
    public interface IFileProccessorService
    {
        Task<ResultModel> ProccessFileAsync(Stream inputStream, string originalFileName);
        
    }
}
