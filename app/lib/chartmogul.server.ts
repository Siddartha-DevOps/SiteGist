import ChartMogul from "chartmogul-node";

/**
 * ChartMogul is used for detailed subscription and revenue analytics.
 */
let _cm: any = null;

export function getChartMogul() {
  if (!_cm) {
    const apiKey = process.env.CHARTMOGUL_API_KEY;
    if (!apiKey) {
      console.warn("CHARTMOGUL_API_KEY is not defined.");
      return null;
    }
    _cm = new (ChartMogul as any)(apiKey);
  }
  return _cm;
}

// Add methods to push customer data or retrieve metrics
