export interface PositionInput {
  capital: number;
  riskPct: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  quantityStep: number;
  minNotional: number;
  feeRate: number;
}

export interface PositionSize {
  quantity: number;
  /** Quantity formatted to the exchange step, ready to paste into the order form. */
  quantityText: string;
  notional: number;
  maxLoss: number;
  potentialProfit: number;
  /** Risk-based size exceeded available capital, so the position was reduced. */
  cappedByCapital: boolean;
  /** Order would be rejected by the exchange minimum order value. */
  belowMinNotional: boolean;
}

function stepDecimals(step: number): number {
  const [, fraction = ""] = step.toFixed(12).replace(/0+$/, "").split(".");
  return fraction.length;
}

function floorToStep(value: number, step: number): number {
  const decimals = stepDecimals(step);
  return Number((Math.floor(value / step + 1e-9) * step).toFixed(decimals));
}

/**
 * Sizes a position so that hitting the stop loses at most `riskPct` of capital, fees included.
 * Quantity is floored to the exchange step, so the real loss can only be smaller.
 */
export function sizePosition(input: PositionInput): PositionSize | null {
  const { capital, riskPct, entry, stopLoss, takeProfit, quantityStep, feeRate } = input;
  if (![capital, riskPct, entry, stopLoss, takeProfit, quantityStep].every((v) => v > 0)) return null;

  const lossPerUnit = Math.abs(entry - stopLoss) + feeRate * (entry + stopLoss);
  const profitPerUnit = Math.abs(takeProfit - entry) - feeRate * (entry + takeProfit);
  const riskQuantity = (capital * riskPct) / 100 / lossPerUnit;
  const capitalQuantity = capital / (entry * (1 + feeRate));
  const quantity = floorToStep(Math.min(riskQuantity, capitalQuantity), quantityStep);
  const notional = quantity * entry;

  return {
    quantity,
    quantityText: quantity.toFixed(stepDecimals(quantityStep)),
    notional,
    maxLoss: quantity * lossPerUnit,
    potentialProfit: quantity * profitPerUnit,
    cappedByCapital: riskQuantity > capitalQuantity,
    belowMinNotional: quantity === 0 || notional < input.minNotional,
  };
}
