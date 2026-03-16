using FileProccessor.Cores.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Text;

namespace FileProccessor.Cores.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BankStatementController : ControllerBase
    {
        private readonly BankStatementService _service;
        public BankStatementController(BankStatementService service) => _service = service;

        [HttpPost("upload")]
        public IActionResult Upload(IFormFile file)
        {
            if (file == null || !file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "Please upload a valid CSV file." });

            var result = _service.Process(file.OpenReadStream());

            if (result.Error != null)
                return BadRequest(new { error = result.Error });

            return Ok(result);
        }

        [HttpPost("download")]
        public IActionResult Download(IFormFile file)
        {
            if (file == null || !file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Invalid file.");

            var result = _service.Process(file.OpenReadStream());
            if (result.Error != null) return BadRequest(result.Error);

            var cols = new[]
            {
            "TXdate","Description","Reference","Amount","UseTax","TaxType","TaxAccount",
            "TaxAmount","Project","Account","IsDebit","SplitType","SplitGroup","Reconcile",
            "PostDated","UseDiscount","DiscPerc","DiscTrCode","DiscDesc","UseDiscTax",
            "DiscTaxType","DiscTaxAcc","DiscTaxAmt","PayeeName","PrintCheque","SalesRep","Module"
        };

            var sb = new StringBuilder();
            sb.AppendLine(string.Join(",", cols));

            foreach (var row in result.Rows)
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
                sb.AppendLine(string.Join(",", vals.Select(v => $"\"{v}\"")));
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            return File(bytes, "text/csv", "bank_statement_converted.csv");
        }

    }
}
