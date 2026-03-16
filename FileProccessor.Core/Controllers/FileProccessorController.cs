using FileProccessor.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FileProccessor.Core.Controllers
{
    public class FileProccessorController : Controller
    {
        private readonly IFileProccessorService _fileProccessorService;
        public FileProccessorController(IFileProccessorService fileProccessorService)
        {
            _fileProccessorService = fileProccessorService;
        }

        [HttpGet]
        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        [RequestSizeLimit(20_000_000)]
        public async Task<IActionResult> Process(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                ViewBag.Error = "Please select a valid file";
                return View("Index");
            }
            try
            {
                await using var stream = file.OpenReadStream();
                var result = await _fileProccessorService.ProccessFileAsync(stream, file.FileName);

                return File(result.FileData, result.ContentType, result.FileName);
            }
            catch (Exception ex)
            {
                ViewBag.Error = ex.Message;
                return View("Index");
            }
        }
    }
}
