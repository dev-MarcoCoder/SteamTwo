export function formatCurrency(amountInCents, currency = "BRL") {
  if (amountInCents == null) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amountInCents / 100);
  } catch {
    return `R$ ${(amountInCents / 100).toFixed(2)}`;
  }
}
