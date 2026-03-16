using FileProccessor.Core.Models;

namespace FileProccessor.Core.Interfaces
{
    public interface IFileProccessorService
    {
        Task<ResultModel> ProccessFileAsync(Stream inputStream, string originalFileName);
    }
}
