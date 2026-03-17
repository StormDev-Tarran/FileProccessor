using Blazorise;
using Blazorise.Bootstrap;
using Blazorise.Icons.FontAwesome;
using FileProccessor.Cores.Interfaces;
using FileProccessor.Cores.Services;
using FileProccessor.Web.Components;
using FileProccessor.Web.Components.Pages;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddScoped<IFileProccessorService, FileProccessorService>();
builder.Services.AddScoped<IBankStatementService, BankStatementService>();

//builder.Services
//    .AddBlazorise(options =>
//    {
//        options.Immediate = true;
//    })
//    .AddBootstrapProviders() // This registers the IClassProvider implementation
//    .AddFontAwesomeIcons();

builder.Services.AddControllers();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();

app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.MapControllers();

app.Run();
