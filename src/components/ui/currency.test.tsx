import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { AmountInput, Money } from "@/components/ui";

const twd = (ui: React.ReactNode) =>
  render(
    <I18nProvider locale="en-GB" currency="TWD">
      {ui}
    </I18nProvider>,
  );

describe("amounts in New Taiwan dollars", () => {
  it("Money writes whole dollars", () => {
    twd(<Money pence={125000} />);
    expect(screen.getByText("NT$1,250")).toBeInTheDocument();
  });

  it("AmountInput shows NT$, takes whole dollars and refuses cents", () => {
    const onValueChange = vi.fn();
    twd(<AmountInput label="Amount" onValueChange={onValueChange} />);
    expect(screen.getByText("NT$")).toBeInTheDocument();
    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "1250" } });
    expect(onValueChange).toHaveBeenLastCalledWith(125000);
    fireEvent.change(input, { target: { value: "12.50" } });
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("Enter a whole number of dollars, e.g. 1250")).toBeInTheDocument();
  });

  it("AmountInput in Chinese explains the error in Chinese", () => {
    render(
      <I18nProvider locale="zh-TW" currency="TWD">
        <AmountInput label="金額" />
      </I18nProvider>,
    );
    const input = screen.getByLabelText("金額");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    expect(screen.getByText("請輸入整數金額，例如 1250")).toBeInTheDocument();
  });
});
