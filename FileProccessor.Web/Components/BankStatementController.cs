using FileProccessor.Cores.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FileProccessor.Web.Components
{
    [ApiController]
    [Route("api/[controller]")]
    public class BankStatementController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
        private readonly IBankStatementService _service;

        public BankStatementController(IBankStatementService service)
        {
            _service = service;
        }

        [HttpPost("upload")]
        public IActionResult Upload(IFormFile file)
        {
            if (file == null || !file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "Please upload a valid CSV file." });

            try
            {
                var result = _service.Process(file.OpenReadStream(), file.FileName);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("download")]
        public IActionResult Download(IFormFile file)
        {
            if (file == null || !file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Invalid file.");

            try
            {
                var result = _service.Process(file.OpenReadStream(), file.FileName);
                return File(result.FileData, "text/csv", "bank_statement_converted.csv");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
