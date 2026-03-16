using FileProccessor.Cores.Services;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Text;

namespace FileProccessor.Cores.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FileProccessorController : ControllerBase
    {
        private readonly FileProccessorService _service;
        public FileProccessorController(FileProccessorService service) => _service = service;
    }
}
