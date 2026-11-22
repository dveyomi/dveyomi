import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

import { lastPage } from "@/lib/lastPage";
import { PageMemory } from "./PageMemory";

describe("PageMemory", () => {
  it("remembers each page the user moves to", () => {
    usePathname.mockReturnValue("/budget");
    const { rerender } = render(<PageMemory />);
    expect(lastPage()).toBe("/budget");
    usePathname.mockReturnValue("/expenses/trips");
    rerender(<PageMemory />);
    expect(lastPage()).toBe("/expenses/trips");
    usePathname.mockReturnValue("/settings");
    rerender(<PageMemory />);
    expect(lastPage()).toBe("/expenses/trips");
  });
});
