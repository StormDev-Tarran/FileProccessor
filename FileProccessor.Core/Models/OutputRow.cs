using static System.Runtime.InteropServices.JavaScript.JSType;

namespace FileProccessor.Core.Models
{
    public class OutputRow
    {
        public string TXdate { get; set; } = "";
        public string Description { get; set; } = "";
        public string Reference { get; set; } = "";
        public string Amount { get; set; } = "";
        public string UseTax { get; set; } = "N";
        public string TaxType { get; set; } = "";
        public string TaxAccount { get; set; } = "";
        public string TaxAmount { get; set; } = "0";
        public string Project { get; set; } = "";
        public string Account { get; set; } = "";
        public string IsDebit { get; set; } = "";
        public string SplitType { get; set; } = "0";
        public string SplitGroup { get; set; } = "0";
        public string Reconcile { get; set; } = "Y";
        public string PostDated { get; set; } = "N";
        public string UseDiscount { get; set; } = "N";
        public string DiscPerc { get; set; } = "0";
        public string DiscTrCode { get; set; } = "";
        public string DiscDesc { get; set; } = "";
        public string UseDiscTax { get; set; } = "N";
        public string DiscTaxType { get; set; } = "";
        public string DiscTaxAcc { get; set; } = "";
        public string DiscTaxAmt { get; set; } = "0";
        public string PayeeName { get; set; } = "";
        public string PrintCheque { get; set; } = "N";
        public string SalesRep { get; set; } = "";
        public string Module { get; set; } = "";
        public string CombinedDescription { get; set; } = "";
    }
}
